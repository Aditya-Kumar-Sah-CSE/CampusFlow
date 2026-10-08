/**
 * CampusFlow Production-Safe Read-Only k6 Load Test Suite
 * =======================================================
 * Target Application: CampusFlow (Multi-tenant Institutional Platform)
 * Active Live Tenant: BCE Bhagalpur (bce-bgp)
 *
 * SAFETY INVARIANTS:
 * 1. ZERO WRITE OPERATIONS: No INSERT, UPDATE, or DELETE queries triggered.
 * 2. NO THIRD-PARTY API CONSUMPTION: No Google Forms/Sheets API calls or Brevo email dispatches.
 * 3. NO HEAVY SERVERLESS CPU/RAM WORKLOADS: No synchronous pdfkit vector rendering endpoints.
 * 4. STRICT ZERO-POLLUTION: No mock exam attempts, test event registrations, or fake feedback responses.
 * 5. NO HARDCODED SECRETS: All configuration is passed via environment variables.
 *
 * TRAFFIC DISTRIBUTION:
 * - 40% Institutional Portals & Public Pages (/, /[tenant], /about, /services, /overview)
 * - 20% Events Discovery (/[tenant]/events, /events)
 * - 15% Exams Discovery & Rules (/[tenant]/exams, /exams)
 * - 15% Feedback Discovery (/[tenant]/feedback, /feedback)
 * - 10% Safe Assets & Manifests (/api/manifest/[tenant], /manifest.webmanifest, /robots.txt)
 *
 * SUPPORTED ENVIRONMENT VARIABLES:
 * - BASE_URL     : Target host (e.g. https://campusflow.in or http://localhost:3000)
 * - TEST_TENANT  : Target college tenant slug (default: bce-bgp)
 * - LOAD_STAGE   : Target test stage (1 to 7, default: 1)
 * - STAGED_RAMP  : If 'true', executes all 7 progressive stages sequentially
 * - TEST_TOKEN   : Optional Supabase JWT for authenticated read testing
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
const portalPageDuration = new Trend('cf_portal_page_duration', true);
const modulePageDuration = new Trend('cf_module_page_duration', true);
const staticAssetDuration = new Trend('cf_static_asset_duration', true);
const checksPassed = new Counter('cf_checks_passed');
const checksFailed = new Counter('cf_checks_failed');

// ==============================================================================
// ENVIRONMENT CONFIGURATION
// ==============================================================================
const rawBaseUrl = __ENV.BASE_URL || 'http://localhost:3000';
const BASE_URL = rawBaseUrl.replace(/\/+$/, '');
const TENANT = __ENV.TEST_TENANT || 'bce-bgp';
const TOKEN = __ENV.TEST_TOKEN || '';
const STAGE = parseInt(__ENV.LOAD_STAGE || '1', 10);
const IS_STAGED_RAMP = (__ENV.STAGED_RAMP || 'false').toLowerCase() === 'true';

// ==============================================================================
// STAGED SCENARIOS DEFINITION
// ==============================================================================
// Stage 1: 10 VUs   (Baseline Sanity & Warm-up)
// Stage 2: 25 VUs   (Light Traffic Baseline)
// Stage 3: 50 VUs   (Standard Operating Concurrency)
// Stage 4: 100 VUs  (Moderate Browsing Surge)
// Stage 5: 250 VUs  (High Academic Event Rush)
// Stage 6: 500 VUs  (Peak Result/Registration Discovery)
// Stage 7: 1000 VUs (Platform High-Concurrency Milestone)

function buildStagesConfig() {
  if (IS_STAGED_RAMP) {
    return [
      { duration: '1m', target: 10 },   // Stage 1: Ramp to 10 VUs
      { duration: '2m', target: 10 },   // Plateau 10 VUs
      { duration: '1m', target: 25 },   // Stage 2: Ramp to 25 VUs
      { duration: '2m', target: 25 },   // Plateau 25 VUs
      { duration: '1m', target: 50 },   // Stage 3: Ramp to 50 VUs
      { duration: '3m', target: 50 },   // Plateau 50 VUs
      { duration: '2m', target: 100 },  // Stage 4: Ramp to 100 VUs
      { duration: '4m', target: 100 },  // Plateau 100 VUs
      { duration: '2m', target: 250 },  // Stage 5: Ramp to 250 VUs
      { duration: '4m', target: 250 },  // Plateau 250 VUs
      { duration: '3m', target: 500 },  // Stage 6: Ramp to 500 VUs
      { duration: '5m', target: 500 },  // Plateau 500 VUs
      { duration: '3m', target: 1000 }, // Stage 7: Ramp to 1000 VUs
      { duration: '5m', target: 1000 }, // Plateau 1000 VUs
      { duration: '2m', target: 0 },    // Ramp down to 0
    ];
  }

  // Single-Stage Execution (Safe, default for beginners)
  const stageTargets = {
    1: 10,
    2: 25,
    3: 50,
    4: 100,
    5: 250,
    6: 500,
    7: 1000,
  };

  const targetVUs = stageTargets[STAGE] || 10;
  return [
    { duration: '30s', target: targetVUs }, // Gradual ramp-up
    { duration: '2m30s', target: targetVUs }, // Steady load hold
    { duration: '30s', target: 0 },         // Controlled cooldown
  ];
}

export const options = {
  stages: buildStagesConfig(),
  thresholds: {
    // Production Safety Threshold: under 1% total request failure rate
    http_req_failed: ['rate<0.01'],
    // Zero-Tolerance Threshold: under 0.5% HTTP 5xx errors (server crashes/timeouts)
    cf_http_5xx: ['rate<0.005'],
    // Latency Budget: p95 under 1.5s, p99 under 3.0s
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  },
  userAgent: 'CampusFlow-LoadTest/1.0 (k6-ProductionSafe-ReadAudit)',
  noConnectionReuse: false,
};

// ==============================================================================
// HELPER UTILITIES
// ==============================================================================
function getRandomDelay(minSeconds, maxSeconds) {
  return minSeconds + Math.random() * (maxSeconds - minSeconds);
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

  cfErrorRate.add(!isOk);
  cfHttp5xxRate.add(is5xx);
  cfHttp4xxRate.add(is4xx);

  if (trendMetric) {
    trendMetric.add(res.timings.duration);
  }

  if (isOk) {
    checksPassed.add(1);
  } else {
    checksFailed.add(1);
  }
}

// ==============================================================================
// USER JOURNEY IMPLEMENTATIONS (100% READ-ONLY)
// ==============================================================================

/**
 * Journey A: Institutional Portal & Public Pages (40% Weight)
 * Simulates a student browsing the primary platform landing and the BCE Bhagalpur portal.
 */
function journeyPortalAndPublicPages() {
  group('Portal & Institutional Browsing', () => {
    // 1. Root Platform Landing Page
    const resHome = http.get(`${BASE_URL}/`, { headers: getStandardHeaders() });
    check(resHome, {
      'Home page status is 200': (r) => r.status === 200,
      'Home contains CampusFlow brand': (r) => r.body && r.body.includes('CampusFlow'),
    });
    recordResponseMetrics(resHome, portalPageDuration);
    sleep(getRandomDelay(1.5, 3.0));

    // 2. Multi-tenant College Home Portal (BCE Bhagalpur)
    const resTenant = http.get(`${BASE_URL}/${TENANT}`, { headers: getStandardHeaders() });
    check(resTenant, {
      'Tenant portal status is 200': (r) => r.status === 200,
      'Tenant page loads valid HTML': (r) => r.body && r.body.length > 500,
    });
    recordResponseMetrics(resTenant, portalPageDuration);
    sleep(getRandomDelay(2.0, 4.0));

    // 3. Informational Pages (About / Services)
    const infoPage = Math.random() < 0.5 ? '/about' : '/services';
    const resInfo = http.get(`${BASE_URL}${infoPage}`, { headers: getStandardHeaders() });
    check(resInfo, {
      'Info page status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resInfo, portalPageDuration);
  });
}

/**
 * Journey B: Events Discovery (20% Weight)
 * Simulates a student viewing upcoming institutional events and fests without registering.
 */
function journeyEventsDiscovery() {
  group('Events Discovery', () => {
    // 1. Tenant-scoped Events Directory
    const resTenantEvents = http.get(`${BASE_URL}/${TENANT}/events`, { headers: getStandardHeaders() });
    check(resTenantEvents, {
      'Tenant events status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resTenantEvents, modulePageDuration);
    sleep(getRandomDelay(1.5, 3.5));

    // 2. Global Public Events Directory
    const resGlobalEvents = http.get(`${BASE_URL}/events`, { headers: getStandardHeaders() });
    check(resGlobalEvents, {
      'Global events status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resGlobalEvents, modulePageDuration);
  });
}

/**
 * Journey C: Exams Discovery & Instructions (15% Weight)
 * Simulates a student browsing available examinations and syllabus/rules without starting an attempt.
 */
function journeyExamsDiscovery() {
  group('Exams Discovery', () => {
    // 1. Tenant-scoped Exams Directory
    const resTenantExams = http.get(`${BASE_URL}/${TENANT}/exams`, { headers: getStandardHeaders() });
    check(resTenantExams, {
      'Tenant exams status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resTenantExams, modulePageDuration);
    sleep(getRandomDelay(1.5, 3.0));

    // 2. Public Exams Portal Root
    const resExams = http.get(`${BASE_URL}/exams`, { headers: getStandardHeaders() });
    check(resExams, {
      'Exams root status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resExams, modulePageDuration);
  });
}

/**
 * Journey D: Feedback Forms Discovery (15% Weight)
 * Simulates a student viewing published faculty/course feedback forms without submitting answers.
 */
function journeyFeedbackDiscovery() {
  group('Feedback Discovery', () => {
    // 1. Tenant-scoped Feedback Directory
    const resTenantFeedback = http.get(`${BASE_URL}/${TENANT}/feedback`, { headers: getStandardHeaders() });
    check(resTenantFeedback, {
      'Tenant feedback status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resTenantFeedback, modulePageDuration);
    sleep(getRandomDelay(1.5, 3.0));

    // 2. Global Public Feedback Directory
    const resGlobalFeedback = http.get(`${BASE_URL}/feedback`, { headers: getStandardHeaders() });
    check(resGlobalFeedback, {
      'Global feedback status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resGlobalFeedback, modulePageDuration);
  });
}

/**
 * Journey E: Safe Static Assets & Public Metadata (10% Weight)
 * Simulates PWA service worker lifecycle, manifest retrieval, and search engine checks.
 */
function journeySafeAssetsAndMetadata() {
  group('Static Assets & Metadata', () => {
    // 1. Dynamic Tenant PWA Manifest
    const resTenantManifest = http.get(`${BASE_URL}/api/manifest/${TENANT}`, { headers: getJsonHeaders() });
    check(resTenantManifest, {
      'Tenant manifest status is 200': (r) => r.status === 200,
      'Manifest contains valid JSON': (r) => r.headers['Content-Type'] && r.headers['Content-Type'].includes('json'),
    });
    recordResponseMetrics(resTenantManifest, staticAssetDuration);
    sleep(getRandomDelay(1.0, 2.0));

    // 2. Root Web Manifest
    const resRootManifest = http.get(`${BASE_URL}/manifest.webmanifest`, { headers: getStandardHeaders() });
    check(resRootManifest, {
      'Root manifest status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resRootManifest, staticAssetDuration);

    // 3. Search Engine Robots & Offline Route
    const resRobots = http.get(`${BASE_URL}/robots.txt`, { headers: getStandardHeaders() });
    check(resRobots, {
      'Robots.txt status is 200': (r) => r.status === 200,
    });
    recordResponseMetrics(resRobots, staticAssetDuration);
  });
}

// ==============================================================================
// MAIN EXECUTION LOGIC (TRAFFIC DISTRIBUTION DISPATCHER)
// ==============================================================================
export default function () {
  const roll = Math.random();

  if (roll < 0.40) {
    // 40% Traffic: Institutional Portal & Public Pages
    journeyPortalAndPublicPages();
  } else if (roll < 0.60) {
    // 20% Traffic: Events Discovery
    journeyEventsDiscovery();
  } else if (roll < 0.75) {
    // 15% Traffic: Exams Discovery
    journeyExamsDiscovery();
  } else if (roll < 0.90) {
    // 15% Traffic: Feedback Discovery
    journeyFeedbackDiscovery();
  } else {
    // 10% Traffic: Safe Assets & PWA Manifests
    journeySafeAssetsAndMetadata();
  }

  // Realistic human thinking time between page navigation flows
  sleep(getRandomDelay(2.0, 5.0));
}
