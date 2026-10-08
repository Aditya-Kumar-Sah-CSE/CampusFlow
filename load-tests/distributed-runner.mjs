#!/usr/bin/env node
/**
 * CampusFlow Distributed k6 Load Test Runner & Aggregator
 * ========================================================
 * Coordinates multi-process / multi-worker execution across independent OS processes.
 * Features:
 * - Hard pre-flight safety circuit breaker (blocks production domains, verifies staging DB)
 * - Partitions total VUs across N independent worker processes
 * - Aggregates granular connection breakdown metrics:
 *     * http_req_connecting
 *     * http_req_tls_handshaking
 *     * http_req_waiting (TTFB)
 *     * http_req_receiving
 *     * total http_req_duration
 *     * TCP/socket errors (wsarecv / connection resets)
 *     * HTTP status failure rates
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';

// ==============================================================================
// ARGUMENT PARSING
// ==============================================================================
const args = process.argv.slice(2);
function getArg(flag, defaultValue) {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return defaultValue;
}

const TOTAL_VUS = parseInt(getArg('--vus', '10'), 10);
const NUM_WORKERS = parseInt(getArg('--workers', '2'), 10);
const STAGE_DURATION = getArg('--duration', '60s');
const RAMP_DURATION = getArg('--ramp', '10s');
const COOLDOWN_DURATION = getArg('--cooldown', '5s');
const BASE_URL = getArg(
  '--base-url',
  'https://campusflow-qo5zst2hb-aditya-kumar-sahs-projects-9a4c92bd.vercel.app'
).replace(/\/+$/, '');
const DISCARD_BODIES = args.includes('--discard-response-bodies');

const K6_BIN = process.env.K6_PATH || 'C:\\Program Files\\k6\\k6.exe';
const REPORTS_DIR = path.resolve('load-tests', 'reports');

// ==============================================================================
// PRE-FLIGHT CIRCUIT BREAKER
// ==============================================================================
async function runPreFlightCheck(baseUrl) {
  console.log('\n======================================================');
  console.log(' [SAFETY CIRCUIT BREAKER] Validating Target Environment');
  console.log('======================================================');
  console.log(` Target BASE_URL: ${baseUrl}`);

  const KNOWN_PRODUCTION_HOSTS = ['campusflow.in', '143campusflow.vercel.app'];
  if (KNOWN_PRODUCTION_HOSTS.some((h) => baseUrl.toLowerCase().includes(h))) {
    throw new Error(`ABORT: Target URL matches live production host! Execution blocked.`);
  }

  // Pre-flight call to /api/perf
  const perfUrl = `${baseUrl}/api/perf`;
  console.log(` Probing pre-flight diagnostics: ${perfUrl}...`);

  const client = perfUrl.startsWith('https') ? https : http;
  const perfData = await new Promise((resolve, reject) => {
    client
      .get(perfUrl, { headers: { Accept: 'application/json' }, timeout: 10000 }, (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`/api/perf returned HTTP ${res.statusCode}`));
          }
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error(`Failed to parse /api/perf JSON: ${e.message}`));
          }
        });
      })
      .on('error', reject);
  });

  console.log(` -> Environment      : ${perfData.environment}`);
  console.log(` -> Compute Region   : ${perfData.region} (${perfData.vercelId || 'N/A'})`);
  console.log(` -> Remote Database  : ${perfData.supabaseHost} (${perfData.supabaseRegion})`);

  if (!perfData.supabaseHost || !perfData.supabaseHost.includes('ggisjcegbcvxwgczwdbd')) {
    throw new Error(
      `ABORT: Database is ${perfData.supabaseHost}, NOT the designated staging Supabase instance!`
    );
  }

  console.log(' [SAFETY CHECK PASSED] Clean staging deployment & isolated database confirmed.\n');
}

// ==============================================================================
// PROCESS COORDINATION
// ==============================================================================
function startWorker(workerId, vus, scriptPath) {
  return new Promise((resolve, reject) => {
    const reportPath = path.join(REPORTS_DIR, `worker-${workerId}.json`);
    const envVars = {
      ...process.env,
      BASE_URL,
      WORKER_ID: String(workerId),
      TARGET_VUS: String(vus),
      RAMP_DURATION,
      STAGE_DURATION,
      COOLDOWN_DURATION,
      REPORT_PATH: reportPath,
    };

    const cmdArgs = [
      'run',
      '-e', `BASE_URL=${BASE_URL}`,
      '-e', `WORKER_ID=${workerId}`,
      '-e', `TARGET_VUS=${vus}`,
      '-e', `RAMP_DURATION=${RAMP_DURATION}`,
      '-e', `STAGE_DURATION=${STAGE_DURATION}`,
      '-e', `COOLDOWN_DURATION=${COOLDOWN_DURATION}`,
      '-e', `REPORT_PATH=${reportPath}`,
      '--summary-trend-stats', 'avg,min,med,max,p(90),p(95),p(99)',
    ];

    if (DISCARD_BODIES) {
      cmdArgs.push('--discard-response-bodies');
    }

    cmdArgs.push(scriptPath);

    console.log(`[Coordinator] Launching Worker ${workerId} with ${vus} VUs (discardBodies: ${DISCARD_BODIES})...`);
    const proc = spawn(K6_BIN, cmdArgs, {
      env: envVars,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (d) => {
      const lines = d.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        if (line.includes('running (') || line.includes('default') || line.includes('Finished')) {
          console.log(`[Worker-${workerId}] ${line.trim()}`);
        }
      }
    });

    proc.stderr.on('data', (d) => {
      const text = d.toString().trim();
      if (text && !text.includes('level=error msg="thresholds')) {
        console.error(`[Worker-${workerId} ERR] ${text}`);
      }
    });

    proc.on('close', (code) => {
      console.log(`[Coordinator] Worker ${workerId} completed (Exit Code: ${code}).`);
      resolve({ workerId, code, reportPath });
    });

    proc.on('error', (err) => {
      console.error(`[Coordinator] Worker ${workerId} failed to spawn:`, err);
      reject(err);
    });
  });
}

// ==============================================================================
// METRICS AGGREGATION
// ==============================================================================
function aggregateReports(workerResults) {
  console.log('\n======================================================');
  console.log(' [DISTRIBUTED AGGREGATION] Processing Worker Reports');
  console.log('======================================================');

  let totalRequests = 0;
  let totalIterations = 0;
  let aggregateRps = 0;
  let totalFailedRequests = 0;
  let total5xx = 0;
  let total4xx = 0;
  let total429 = 0;
  let totalTcpErrors = 0;
  let totalChecksPassed = 0;
  let totalChecksFailed = 0;

  const trendMetrics = {
    http_req_connecting: [],
    http_req_tls_handshaking: [],
    http_req_waiting: [],
    http_req_receiving: [],
    http_req_duration: [],
  };

  const reports = [];

  for (const { workerId, reportPath } of workerResults) {
    if (!fs.existsSync(reportPath)) {
      console.warn(`[Aggregation Warning] Missing report for Worker ${workerId}: ${reportPath}`);
      continue;
    }

    try {
      const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      reports.push({ workerId, data });
      const m = data.metrics || {};

      const getVal = (metricObj, prop) => {
        if (!metricObj) return 0;
        if (metricObj.values && metricObj.values[prop] !== undefined) return metricObj.values[prop];
        if (metricObj[prop] !== undefined) return metricObj[prop];
        return 0;
      };

      const reqs = getVal(m.http_reqs, 'count');
      totalRequests += reqs;
      totalIterations += getVal(m.iterations, 'count');
      aggregateRps += getVal(m.http_reqs, 'rate');
      totalFailedRequests += getVal(m.http_req_failed, 'passes');
      total5xx += getVal(m.cf_http_5xx, 'passes');
      total4xx += getVal(m.cf_http_4xx, 'passes');
      total429 += getVal(m.cf_http_429, 'passes');
      totalTcpErrors += getVal(m.cf_tcp_errors, 'count');
      totalChecksPassed += getVal(m.checks, 'passes') || getVal(m.cf_checks_passed, 'count');
      totalChecksFailed += getVal(m.checks, 'fails') || getVal(m.cf_checks_failed, 'count');

      for (const key of Object.keys(trendMetrics)) {
        if (m[key]) {
          const v = m[key].values || m[key];
          trendMetrics[key].push({
            count: reqs,
            avg: v.avg || 0,
            med: v.med || 0,
            p90: v['p(90)'] || 0,
            p95: v['p(95)'] || 0,
            p99: v['p(99)'] || 0,
            max: v.max || 0,
          });
        }
      }
    } catch (e) {
      console.error(`Failed to parse worker report ${reportPath}:`, e.message);
    }
  }

  // Calculate weighted trends
  function computeWeighted(metricList) {
    if (metricList.length === 0) return { avg: 0, med: 0, p90: 0, p95: 0, p99: 0, max: 0 };
    const totalCount = metricList.reduce((acc, m) => acc + m.count, 0) || 1;
    const avg = metricList.reduce((acc, m) => acc + m.avg * m.count, 0) / totalCount;
    const med = metricList.reduce((acc, m) => acc + m.med * m.count, 0) / totalCount;
    const p90 = metricList.reduce((acc, m) => acc + m.p90 * m.count, 0) / totalCount;
    const p95 = metricList.reduce((acc, m) => acc + m.p95 * m.count, 0) / totalCount;
    const p99 = metricList.reduce((acc, m) => acc + m.p99 * m.count, 0) / totalCount;
    const max = Math.max(...metricList.map((m) => m.max));
    return { avg, med, p90, p95, p99, max };
  }

  const timingBreakdown = {
    connecting: computeWeighted(trendMetrics.http_req_connecting),
    tls: computeWeighted(trendMetrics.http_req_tls_handshaking),
    waiting_ttfb: computeWeighted(trendMetrics.http_req_waiting),
    receiving: computeWeighted(trendMetrics.http_req_receiving),
    total_duration: computeWeighted(trendMetrics.http_req_duration),
  };

  const totalChecks = totalChecksPassed + totalChecksFailed;
  const checkSuccessRate = totalChecks > 0 ? ((totalChecksPassed / totalChecks) * 100).toFixed(2) : '100.00';
  const failureRate = totalRequests > 0 ? ((totalFailedRequests / totalRequests) * 100).toFixed(2) : '0.00';

  console.log(`\n======================================================`);
  console.log(` AGGREGATE LOAD TEST RESULTS (${NUM_WORKERS} Workers | ${TOTAL_VUS} Total VUs)`);
  console.log(`======================================================`);
  console.log(` Total Completed Requests : ${totalRequests.toLocaleString()}`);
  console.log(` Completed Iterations     : ${totalIterations.toLocaleString()}`);
  console.log(` Aggregate RPS            : ${aggregateRps.toFixed(2)} req/s`);
  console.log(` Check Success Rate       : ${checkSuccessRate}% (${totalChecksPassed}/${totalChecks})`);
  console.log(` HTTP Failed Requests     : ${totalFailedRequests} (${failureRate}%)`);
  console.log(` HTTP 5xx Server Errors   : ${total5xx}`);
  console.log(` HTTP 4xx Client Errors   : ${total4xx}`);
  console.log(` HTTP 429 Rate Limits     : ${total429}`);
  console.log(` TCP / Socket Errors      : ${totalTcpErrors}`);
  console.log('------------------------------------------------------');
  console.log(' LATENCY PHASE BREAKDOWN (ms):');
  console.log(
    ` Phase             | Avg       | Med (p50) | p90       | p95       | p99       | Max`
  );
  console.log(
    ` ----------------- | --------- | --------- | --------- | --------- | --------- | ---------`
  );

  const formatRow = (name, t) => {
    const pad = (n) => (n.toFixed(2) + 'ms').padEnd(9);
    console.log(
      ` ${name.padEnd(17)} | ${pad(t.avg)} | ${pad(t.med)} | ${pad(t.p90)} | ${pad(t.p95)} | ${pad(t.p99)} | ${pad(t.max)}`
    );
  };

  formatRow('1. Connecting', timingBreakdown.connecting);
  formatRow('2. TLS Handshake', timingBreakdown.tls);
  formatRow('3. Waiting (TTFB)', timingBreakdown.waiting_ttfb);
  formatRow('4. Receiving', timingBreakdown.receiving);
  formatRow('Total Duration', timingBreakdown.total_duration);
  console.log('======================================================\n');

  const aggregateSummary = {
    meta: {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      workers: NUM_WORKERS,
      totalVus: TOTAL_VUS,
      stageDuration: STAGE_DURATION,
      rampDuration: RAMP_DURATION,
      discardResponseBodies: DISCARD_BODIES,
    },
    totals: {
      totalRequests,
      totalIterations,
      aggregateRps,
      totalFailedRequests,
      failureRate: `${failureRate}%`,
      total5xx,
      total4xx,
      total429,
      totalTcpErrors,
      checkSuccessRate: `${checkSuccessRate}%`,
    },
    timingBreakdown,
  };

  const aggregateFile = path.join(REPORTS_DIR, 'aggregate-summary.json');
  fs.writeFileSync(aggregateFile, JSON.stringify(aggregateSummary, null, 2));
  console.log(`Full aggregate report saved to: ${aggregateFile}`);

  return aggregateSummary;
}

// ==============================================================================
// MAIN RUNNER ENTRY
// ==============================================================================
async function main() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  await runPreFlightCheck(BASE_URL);

  const scriptPath = path.resolve('load-tests', 'campusflow-distributed-worker.js');
  const vusPerWorker = Math.floor(TOTAL_VUS / NUM_WORKERS);
  const remainder = TOTAL_VUS % NUM_WORKERS;

  console.log(
    `[Coordinator] Distributing ${TOTAL_VUS} VUs across ${NUM_WORKERS} workers (~${vusPerWorker} VUs/worker)`
  );
  console.log(`[Coordinator] Test Duration: ${STAGE_DURATION} plateau (+ ${RAMP_DURATION} ramp, + ${COOLDOWN_DURATION} cooldown)\n`);

  const workerPromises = [];
  for (let i = 1; i <= NUM_WORKERS; i++) {
    const vus = i === 1 ? vusPerWorker + remainder : vusPerWorker;
    workerPromises.push(startWorker(i, vus, scriptPath));
  }

  const results = await Promise.all(workerPromises);
  aggregateReports(results);
}

main().catch((err) => {
  console.error('\n[FATAL ERROR IN DISTRIBUTED RUNNER]', err.message);
  process.exit(1);
});
