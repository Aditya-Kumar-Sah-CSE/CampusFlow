/**
 * CampusFlow Distributed Load Test Worker Script
 * ===============================================
 * Designed for multi-process / multi-machine distributed load generation.
 * Workload is 100% IDENTICAL to the progressive staging audit:
 * - Same 5 user journeys (40% Portal, 20% Events, 15% Exams, 15% Feedback, 10% Assets)
 * - Same public routes & headers (Accept, Cache-Control: no-cache, Pragma: no-cache)
 * - Same think times and SLA thresholds
 * - Strict Pre-flight Staging Isolation Circuit Breaker (validates against /api/perf)
 * - Granular connection phase breakdown:
 *     * http_req_connecting
 *     * http_req_tls_handshaking
 *     * http_req_waiting (TTFB)
 *     * http_req_receiving
 *     * http_req_duration
 *     * TCP/socket error tracking
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ==============================================================================
// CUSTOM PERFORMANCE & ERROR METRICS
// ==============================================================================
const cfErrorRate = new Rate('cf_req_failed');
const cfHttp5xxRate = new Rate('cf_http_5xx');
const cfHttp4xxRate = new Rate('cf_http_4xx');
const cfHttp429Rate = new Rate('cf_http_429');
const cfHttp429Count = new Counter('cf_http_429_count');
const cfTcpErrors = new Counter('cf_tcp_errors');
const portalPageDuration = new Trend('cf_portal_page_duration', true);
const modulePageDuration = new Trend('cf_module_page_duration', true);
const staticAssetDuration = new Trend('cf_static_asset_duration', true);
const checksPassed = new Counter('cf_checks_passed');
const checksFailed = new Counter('cf_checks_failed');

// Phase Timing Trends
const connectDuration = new Trend('cf_connect_duration', true);
const tlsDuration = new Trend('cf_tls_duration', true);
const ttfbDuration = new Trend('cf_ttfb_duration', true);
const receiveDuration = new Trend('cf_receive_duration', true);

// ==============================================================================
// ENVIRONMENT RESOLUTION & SAFETY CIRCUIT BREAKER
// ==============================================================================
const rawBaseUrl = __ENV.BASE_URL || '';
if (!rawBaseUrl) {
  throw new Error(
    'FATAL: BASE_URL is empty. A dedicated STAGING environment URL must be provided via -e BASE_URL="https://staging..."'
  );
}

const BASE_URL = rawBaseUrl.replace(/\/+$/, '');

// Static Production Host Circuit Breaker
const KNOWN_PRODUCTION_HOSTS = ['campusflow.in', '143campusflow.vercel.app'];
const isProdTarget = KNOWN_PRODUCTION_HOSTS.some((prodHost) => BASE_URL.toLowerCase().includes(prodHost));
if (isProdTarget && (__ENV.ALLOW_PROD_DANGEROUS || '').toLowerCase() !== 'true') {
  throw new Error(
    `SAFETY CIRCUIT BREAKER TRIGGERED: Target BASE_URL (${BASE_URL}) matches live production domain! ` +
      `Load tests MUST NEVER be run against live production. Execution aborted.`
  );
}

const WORKER_ID = __ENV.WORKER_ID || '1';
const TENANT = __ENV.TEST_TENANT || 'bce-bgp';
const TOKEN = __ENV.TEST_TOKEN || '';
const TARGET_VUS = parseInt(__ENV.TARGET_VUS || '10', 10);
const RAMP_DURATION = __ENV.RAMP_DURATION || '30s';
const STAGE_DURATION = __ENV.STAGE_DURATION || '120s';
const COOLDOWN_DURATION = __ENV.COOLDOWN_DURATION || '15s';

function buildStagesConfig() {
  const stages = [];
  if (RAMP_DURATION !== '0s') {
    stages.push({ duration: RAMP_DURATION, target: TARGET_VUS });
  }
  stages.push({ duration: STAGE_DURATION, target: TARGET_VUS });
  if (COOLDOWN_DURATION !== '0s') {
    stages.push({ duration: COOLDOWN_DURATION, target: 0 });
  }
  return stages;
}

export const options = {
  stages: buildStagesConfig(),
  thresholds: {
    http_req_failed: ['rate<0.01'],
    cf_req_failed: ['rate<0.01'],
    cf_http_5xx: ['rate<0.005'],
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  },
  userAgent: `CampusFlow-DistributedLoadTest/1.0 (Worker-${WORKER_ID})`,
  noConnectionReuse: false,
};

/**
 * Pre-flight test setup to verify database isolation before starting VUs.
 */
export function setup() {
  const perfRes = http.get(`${BASE_URL}/api/perf`, {
    headers: { 'Accept': 'application/json' },
    responseType: 'text',
    timeout: '15s',
  });

  if (perfRes.status !== 200) {
    throw new Error(
      `FATAL CIRCUIT BREAKER: Pre-flight check /api/perf returned ${perfRes.status}. Aborting execution.`
    );
  }

  try {
    const data = JSON.parse(perfRes.body);
    if (data.supabaseHost && !data.supabaseHost.includes('ggisjcegbcvxwgczwdbd')) {
      throw new Error(
        `FATAL CIRCUIT BREAKER: Remote Supabase is ${data.supabaseHost}, NOT the designated staging project! Aborting.`
      );
    }
  } catch (err) {
    throw new Error(`FATAL CIRCUIT BREAKER: Unable to parse /api/perf response: ${err.message}`);
  }

  return { workerId: WORKER_ID, baseUrl: BASE_URL };
}

// ==============================================================================
// REQUEST HELPERS
// ==============================================================================
function getRandomDelay(minSec, maxSec) {
  return minSec + Math.random() * (maxSec - minSec);
}

function getStandardHeaders() {
  const headers = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };
  if (TOKEN) {
    headers['Authorization'] = `Bearer ${TOKEN}`;
  }
  return headers;
}

function getJsonHeaders() {
  const headers = {
    'Accept': 'application/json',
    'Cache-Control': 'no-cache',
  };
  if (TOKEN) {
    headers['Authorization'] = `Bearer ${TOKEN}`;
  }
  return headers;
}

function recordResponseMetrics(res, trendMetric) {
  const isOk = res.status >= 200 && res.status < 400;
  const is5xx = res.status >= 500;
  const is4xx = res.status >= 400 && res.status < 500;
  const is429 = res.status === 429;
  const isTcpError = res.status === 0;

  cfErrorRate.add(!isOk);
  cfHttp5xxRate.add(is5xx);
  cfHttp4xxRate.add(is4xx);
  cfHttp429Rate.add(is429);
  if (is429) {
    cfHttp429Count.add(1);
  }
  if (isTcpError) {
    cfTcpErrors.add(1);
  }

  if (res.timings) {
    if (trendMetric) trendMetric.add(res.timings.duration);
    if (res.timings.connecting > 0) connectDuration.add(res.timings.connecting);
    if (res.timings.tls_handshaking > 0) tlsDuration.add(res.timings.tls_handshaking);
    if (res.timings.waiting > 0) ttfbDuration.add(res.timings.waiting);
    if (res.timings.receiving > 0) receiveDuration.add(res.timings.receiving);
  }

  if (isOk) {
    checksPassed.add(1);
  } else {
    checksFailed.add(1);
  }
}

// ==============================================================================
// IDENTICAL JOURNEYS (EXACT SAME AS STAGING TEST)
// ==============================================================================

/** Journey A: Institutional Portals & Public Landing (40% Weight) */
function journeyPortalAndPublicPages() {
  group('Portal & Institutional Browsing', () => {
    // 1. Root Landing Page
    const resHome = http.get(`${BASE_URL}/`, { headers: getStandardHeaders() });
    check(resHome, {
      'Home status is 200': (r) => r.status === 200,
      'Home contains CampusFlow brand': (r) => (r.body ? r.body.includes('CampusFlow') : r.status === 200),
    });
    recordResponseMetrics(resHome, portalPageDuration);
    sleep(getRandomDelay(1.5, 3.0));

    // 2. Tenant College Portal (BCE Bhagalpur)
    const resTenant = http.get(`${BASE_URL}/${TENANT}`, { headers: getStandardHeaders() });
    check(resTenant, {
      'Tenant portal status is 200': (r) => r.status === 200,
      'Tenant page has valid HTML': (r) => (r.body ? r.body.length > 500 : r.status === 200),
    });
    recordResponseMetrics(resTenant, portalPageDuration);
    sleep(getRandomDelay(2.0, 4.0));

    // 3. Informational Page
    const infoPath = Math.random() < 0.5 ? '/about' : '/services';
    const resInfo = http.get(`${BASE_URL}${infoPath}`, { headers: getStandardHeaders() });
    check(resInfo, {
      'Info page status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resInfo, portalPageDuration);
  });
}

/** Journey B: Events Discovery (20% Weight) */
function journeyEventsDiscovery() {
  group('Events Discovery', () => {
    const resTenantEvents = http.get(`${BASE_URL}/${TENANT}/events`, { headers: getStandardHeaders() });
    check(resTenantEvents, {
      'Tenant events status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resTenantEvents, modulePageDuration);
    sleep(getRandomDelay(1.5, 3.5));

    const resGlobalEvents = http.get(`${BASE_URL}/events`, { headers: getStandardHeaders() });
    check(resGlobalEvents, {
      'Global events status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resGlobalEvents, modulePageDuration);
  });
}

/** Journey C: Exams Discovery (15% Weight) */
function journeyExamsDiscovery() {
  group('Exams Discovery', () => {
    const resTenantExams = http.get(`${BASE_URL}/${TENANT}/exams`, { headers: getStandardHeaders() });
    check(resTenantExams, {
      'Tenant exams status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resTenantExams, modulePageDuration);
    sleep(getRandomDelay(1.5, 3.0));

    const resExams = http.get(`${BASE_URL}/exams`, { headers: getStandardHeaders() });
    check(resExams, {
      'Exams root status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resExams, modulePageDuration);
  });
}

/** Journey D: Feedback Forms Discovery (15% Weight) */
function journeyFeedbackDiscovery() {
  group('Feedback Discovery', () => {
    const resTenantFeedback = http.get(`${BASE_URL}/${TENANT}/feedback`, { headers: getStandardHeaders() });
    check(resTenantFeedback, {
      'Tenant feedback status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resTenantFeedback, modulePageDuration);
    sleep(getRandomDelay(1.5, 3.0));

    const resGlobalFeedback = http.get(`${BASE_URL}/feedback`, { headers: getStandardHeaders() });
    check(resGlobalFeedback, {
      'Global feedback status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resGlobalFeedback, modulePageDuration);
  });
}

/** Journey E: Static Assets & Manifests (10% Weight) */
function journeySafeAssetsAndMetadata() {
  group('Static Assets & Metadata', () => {
    const resTenantManifest = http.get(`${BASE_URL}/api/manifest/${TENANT}`, { headers: getJsonHeaders() });
    check(resTenantManifest, {
      'Tenant manifest status is 200': (r) => r.status === 200,
      'Manifest contains JSON': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('json'),
    });
    recordResponseMetrics(resTenantManifest, staticAssetDuration);
    sleep(getRandomDelay(1.0, 2.0));

    const resRootManifest = http.get(`${BASE_URL}/manifest.webmanifest`, { headers: getStandardHeaders() });
    check(resRootManifest, {
      'Root manifest status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resRootManifest, staticAssetDuration);

    const resRobots = http.get(`${BASE_URL}/robots.txt`, { headers: getStandardHeaders() });
    check(resRobots, {
      'Robots status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resRobots, staticAssetDuration);
  });
}

// ==============================================================================
// MAIN TRAFFIC DISPATCHER
// ==============================================================================
export default function () {
  const roll = Math.random();

  if (roll < 0.40) {
    journeyPortalAndPublicPages();
  } else if (roll < 0.60) {
    journeyEventsDiscovery();
  } else if (roll < 0.75) {
    journeyExamsDiscovery();
  } else if (roll < 0.90) {
    journeyFeedbackDiscovery();
  } else {
    journeySafeAssetsAndMetadata();
  }

  sleep(getRandomDelay(2.0, 5.0));
}

// ==============================================================================
// SUMMARY EXPORT HANDLER
// ==============================================================================
export function handleSummary(data) {
  const reportPath = __ENV.REPORT_PATH || `load-tests/reports/worker-${WORKER_ID}.json`;
  return {
    [reportPath]: JSON.stringify(data, null, 2),
    stdout: `[Worker-${WORKER_ID}] Finished execution. Summary written to ${reportPath}\n`,
  };
}
