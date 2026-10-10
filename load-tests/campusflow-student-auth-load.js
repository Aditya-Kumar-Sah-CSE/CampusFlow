/**
 * CampusFlow Student Auth & Feedback Concurrent Load Test (k6)
 * ==============================================================
 * Tests performance, HTTP latency, and system stability under student load
 * simulating a college batch of 1,200 - 1,500 students.
 *
 * SAFETY INVARIANTS:
 * - Read-only & idempotent checks: Does not pollute Supabase with fake accounts.
 * - Tests Next.js Server, Edge Middleware, Student Auth Pages, Feedback lists.
 * - Zero third-party quota usage (no Google Sheets / Brevo emails triggered).
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom Metrics
const errorRate = new Rate('student_req_failed');
const loginPageDuration = new Trend('duration_student_login', true);
const signupPageDuration = new Trend('duration_student_signup', true);
const forgotPasswordDuration = new Trend('duration_student_forgot_pwd', true);
const feedbackPageDuration = new Trend('duration_feedback_portal', true);
const examsPageDuration = new Trend('duration_exams_portal', true);
const checksPassed = new Counter('checks_passed');
const checksFailed = new Counter('checks_failed');

const rawBaseUrl = __ENV.BASE_URL || 'https://143campusflow.vercel.app';
const BASE_URL = rawBaseUrl.replace(/\/+$/, '');
const TENANT = __ENV.TEST_TENANT || 'bce-bgp';

const PEAK_VUS = parseInt(__ENV.TARGET_PEAK || '100', 10);

export const options = {
  scenarios: {
    student_concurrency_surge: {
      executor: 'ramping-vus',
      startVUs: 5,
      stages: [
        { duration: '10s', target: Math.round(PEAK_VUS * 0.2) },  // Ramp to 20% (1 lab batch)
        { duration: '20s', target: Math.round(PEAK_VUS * 0.5) },  // Surge to 50% (class batch)
        { duration: '20s', target: PEAK_VUS },                    // Peak surge (100% capacity)
        { duration: '10s', target: 0 },                           // Graceful cool down
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    student_req_failed: ['rate<0.02'],   // Max 2% error tolerance under peak surge
    http_req_duration: ['p(90)<4000'],    // 90% requests under 4s on serverless cold/warm
  },
};

const HEADERS = {
  'User-Agent': 'CampusFlow-LoadTest/2.0 (Student Batch Simulation)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

function recordStepResult(isOk, passed) {
  errorRate.add(!passed || !isOk);
  if (passed && isOk) {
    checksPassed.add(1);
  } else {
    checksFailed.add(1);
  }
}

export default function () {
  // 1. Student hits the Student Login Page
  group('1. Student Login Page', function () {
    const res = http.get(`${BASE_URL}/auth/student/login`, { headers: HEADERS });
    loginPageDuration.add(res.timings.duration);
    
    const passed = check(res, {
      'login page status 200': (r) => r.status === 200,
      'login page contains student portal branding': (r) => r.body && (r.body.includes('Student') || r.body.includes('CampusFlow')),
    });
    recordStepResult(res.status === 200, passed);
  });

  sleep(0.4);

  // 2. Student checks the Student Signup Page
  group('2. Student Signup Page', function () {
    const res = http.get(`${BASE_URL}/auth/student/signup`, { headers: HEADERS });
    signupPageDuration.add(res.timings.duration);

    const passed = check(res, {
      'signup page status 200': (r) => r.status === 200,
      'signup page rendered': (r) => r.body && r.body.length > 500,
    });
    recordStepResult(res.status === 200, passed);
  });

  sleep(0.4);

  // 3. Student views Forgot Password Page
  group('3. Student Forgot Password', function () {
    const res = http.get(`${BASE_URL}/auth/student/forgot-password`, { headers: HEADERS });
    forgotPasswordDuration.add(res.timings.duration);

    const passed = check(res, {
      'forgot password status 200': (r) => r.status === 200,
      'forgot password page rendered': (r) => r.body && r.body.length > 500,
    });
    recordStepResult(res.status === 200, passed);
  });

  sleep(0.4);

  // 4. Student opens Feedback Forms listing for their institution
  group('4. Institutional Feedback Listing', function () {
    const res = http.get(`${BASE_URL}/${TENANT}/feedback`, { headers: HEADERS });
    feedbackPageDuration.add(res.timings.duration);

    const passed = check(res, {
      'feedback portal status 200': (r) => r.status === 200,
      'feedback page has valid HTML': (r) => r.body && r.body.includes('<!DOCTYPE html>'),
    });
    recordStepResult(res.status === 200, passed);
  });

  sleep(0.4);

  // 5. Student checks institutional Exams listing
  group('5. Institutional Exams Listing', function () {
    const res = http.get(`${BASE_URL}/${TENANT}/exams`, { headers: HEADERS });
    examsPageDuration.add(res.timings.duration);

    const passed = check(res, {
      'exams portal status 200': (r) => r.status === 200,
      'exams page has valid HTML': (r) => r.body && r.body.length > 500,
    });
    recordStepResult(res.status === 200, passed);
  });

  sleep(0.8);
}

export function handleSummary(data) {
  return {
    'load-tests/reports/student-auth-summary.json': JSON.stringify(data, null, 2),
  };
}
