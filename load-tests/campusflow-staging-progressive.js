/**
 * CampusFlow Progressive Staging-Only Load Test Suite (250 -> 10,000 VUs)
 * =======================================================================
 * Target Application: CampusFlow (Multi-tenant Institutional Platform)
 * Target Environment: Dedicated STAGING only (STRICTLY NON-PRODUCTION)
 * Active Tenant: BCE Bhagalpur (bce-bgp)
 *
 * SAFETY INVARIANTS:
 * 1. DEDICATED STAGING ONLY: Built-in safety circuit breaker blocks execution
 *    against known live production domains (campusflow.in, 143campusflow.vercel.app).
 * 2. ZERO WRITE MUTATIONS: Strictly GET/read-only HTTP calls.
 * 3. NO THIRD-PARTY SERVICES: Zero calls to Google Sheets/Forms or Brevo transactional email.
 * 4. NO HEAVY PDF RENDERING: All pdfkit vector export endpoints are excluded.
 * 5. NO COMMITTED SECRETS: All credentials and tokens passed exclusively via environment.
 *
 * PROGRESSIVE STAGING STAGES:
 * - Stage 1: 250 VU   (High Concurrency Baseline - 60-120s)
 * - Stage 2: 500 VU   (Peak Event Browsing - 60-120s)
 * - Stage 3: 1,000 VU (Platform High-Water Mark - 60-120s)
 * - Stage 4: 2,500 VU (Campus Surge Simulation - 60-120s)
 * - Stage 5: 5,000 VU (Large Campus Stress Test - 60-120s)
 * - Stage 6: 7,500 VU (Multi-Institution Peak - 60-120s)
 * - Stage 7: 10,000 VU (Extreme Capacity Investigation - 60-120s)
 *
 * ENVIRONMENT VARIABLES:
 * - BASE_URL        : Dedicated staging URL (REQUIRED - e.g. https://staging.campusflow.in)
 * - TEST_TENANT     : Tenant slug (default: bce-bgp)
 * - LOAD_STAGE      : Progressive stage index 1 to 7 (default: 1 -> 250 VUs)
 * - STAGE_DURATION  : Duration string for steady plateau (default: 120s)
 * - STAGED_RAMP     : If 'true', executes the full progressive multi-stage ladder
 * - TEST_TOKEN      : Optional test-account Supabase JWT for authenticated read validation
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ==============================================================================
// CUSTOM PERFORMANCE & SLA METRICS
// ==============================================================================
const cfErrorRate = new Rate('cf_req_failed');
const cfHttp5xxRate = new Rate('cf_http_5xx');
const cfHttp4xxRate = new Rate('cf_http_4xx');
const cfHttp429Rate = new Rate('cf_http_429');
const cfHttp429Count = new Counter('cf_http_429_count');
const portalPageDuration = new Trend('cf_portal_page_duration', true);
const modulePageDuration = new Trend('cf_module_page_duration', true);
const staticAssetDuration = new Trend('cf_static_asset_duration', true);
const checksPassed = new Counter('cf_checks_passed');
const checksFailed = new Counter('cf_checks_failed');

// ==============================================================================
// ENVIRONMENT RESOLUTION & PRODUCTION SAFETY GUARD
// ==============================================================================
const rawBaseUrl = __ENV.BASE_URL || '';
if (!rawBaseUrl) {
  throw new Error(
    'FATAL: BASE_URL is empty. A dedicated STAGING environment URL must be provided via -e BASE_URL="https://staging..."'
  );
}

const BASE_URL = rawBaseUrl.replace(/\/+$/, '');

// Production Host Circuit Breaker
const KNOWN_PRODUCTION_HOSTS = ['campusflow.in', '143campusflow.vercel.app'];
const isProdTarget = KNOWN_PRODUCTION_HOSTS.some(prodHost => BASE_URL.toLowerCase().includes(prodHost));
if (isProdTarget && (__ENV.ALLOW_PROD_DANGEROUS || '').toLowerCase() !== 'true') {
  throw new Error(
    `SAFETY CIRCUIT BREAKER TRIGGERED: Target BASE_URL (${BASE_URL}) matches live production domain! ` +
    `Staging load tests MUST NEVER be run against live production. Execution aborted.`
  );
}

const TENANT = __ENV.TEST_TENANT || 'bce-bgp';
const TOKEN = __ENV.TEST_TOKEN || '';
const STAGE = parseInt(__ENV.LOAD_STAGE || '1', 10);
const STAGE_DURATION = __ENV.STAGE_DURATION || '120s';
const IS_STAGED_RAMP = (__ENV.STAGED_RAMP || 'false').toLowerCase() === 'true';

// ==============================================================================
// PROGRESSIVE STAGING TARGET MAP
// ==============================================================================
const STAGE_TARGETS = {
  1: 250,    // Stage 1
  2: 500,    // Stage 2
  3: 1000,   // Stage 3
  4: 2500,   // Stage 4
  5: 5000,   // Stage 5
  6: 7500,   // Stage 6
  7: 10000,  // Stage 7
};

function buildStagesConfig() {
  if (IS_STAGED_RAMP) {
    return [
      // Stage 1: 250 VUs
      { duration: '30s', target: 250 },
      { duration: '90s', target: 250 },
      // Stage 2: 500 VUs
      { duration: '30s', target: 500 },
      { duration: '90s', target: 500 },
      // Stage 3: 1,000 VUs
      { duration: '45s', target: 1000 },
      { duration: '90s', target: 1000 },
      // Stage 4: 2,500 VUs
      { duration: '60s', target: 2500 },
      { duration: '90s', target: 2500 },
      // Stage 5: 5,000 VUs
      { duration: '60s', target: 5000 },
      { duration: '90s', target: 5000 },
      // Stage 6: 7,500 VUs
      { duration: '60s', target: 7500 },
      { duration: '90s', target: 7500 },
      // Stage 7: 10,000 VUs
      { duration: '60s', target: 10000 },
      { duration: '90s', target: 10000 },
      // Cooldown
      { duration: '30s', target: 0 },
    ];
  }

  const targetVUs = parseInt(__ENV.TARGET_VUS || '', 10) || STAGE_TARGETS[STAGE] || 250;
  const rampDuration = __ENV.RAMP_DURATION || '30s';
  const cooldownDuration = __ENV.COOLDOWN_DURATION || '15s';
  const stages = [];
  if (rampDuration !== '0s') {
    stages.push({ duration: rampDuration, target: targetVUs });
  }
  stages.push({ duration: STAGE_DURATION, target: targetVUs });
  if (cooldownDuration !== '0s') {
    stages.push({ duration: cooldownDuration, target: 0 });
  }
  return stages;
}

export const options = {
  stages: buildStagesConfig(),
  thresholds: {
    // SLA 1: Request failure rate under 1.0%
    http_req_failed: ['rate<0.01'],
    cf_req_failed: ['rate<0.01'],
    // SLA 2: Server 5xx crash/timeout rate under 0.5%
    cf_http_5xx: ['rate<0.005'],
    // SLA 3: Latency budgets: p95 < 1500ms, p99 < 3000ms
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
  },
  userAgent: 'CampusFlow-StagingLoadTest/1.0 (k6-Progressive-ReadAudit)',
  noConnectionReuse: false,
};

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

  cfErrorRate.add(!isOk);
  cfHttp5xxRate.add(is5xx);
  cfHttp4xxRate.add(is4xx);
  cfHttp429Rate.add(is429);
  if (is429) {
    cfHttp429Count.add(1);
  }

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
// JOURNEYS (100% READ-ONLY SAFE USER BEHAVIORS)
// ==============================================================================

/** Journey A: Institutional Portals & Public Landing (40% Weight) */
function journeyPortalAndPublicPages() {
  group('Portal & Institutional Browsing', () => {
    // 1. Root Landing Page
    const resHome = http.get(`${BASE_URL}/`, { headers: getStandardHeaders() });
    check(resHome, {
      'Home status is 200': (r) => r.status === 200,
      'Home contains CampusFlow brand': (r) => r.body && r.body.includes('CampusFlow'),
    });
    recordResponseMetrics(resHome, portalPageDuration);
    sleep(getRandomDelay(1.5, 3.0));

    // 2. Tenant College Portal (BCE Bhagalpur)
    const resTenant = http.get(`${BASE_URL}/${TENANT}`, { headers: getStandardHeaders() });
    check(resTenant, {
      'Tenant portal status is 200': (r) => r.status === 200,
      'Tenant page has valid HTML': (r) => r.body && r.body.length > 500,
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
