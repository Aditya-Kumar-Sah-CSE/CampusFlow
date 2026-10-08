# CampusFlow Production-Safe Load Testing Plan
**Target Application:** CampusFlow (Multi-Tenant College Management Platform)  
**Production Institution:** Bhagalpur College of Engineering (BCE Bhagalpur – `bce-bgp`)  
**Target Concurrency Envelope:** 10 to 1,000 Virtual Users (VUs)  
**Author:** Senior Principal Performance & Database Reliability Architect  
**Status:** PRODUCTION OPERATIONAL MANUAL  

---

## 1. Executive Context & Safety Directives

### Live Production Environment Notice
> [!CAUTION]
> **CampusFlow is currently LIVE in production serving real administrators, faculty, and students at BCE Bhagalpur.**  
> Real student event registrations, exam schedules, course feedback, and administrative records are active.  
> Unconstrained, write-heavy, or careless load testing can:
> 1. Pollute production institutional records with fake student registrations and invalid exam scorecards.
> 2. Exhaust Google Workspace API quotas (300 requests/minute), causing real students to fail event registrations.
> 3. Trigger Brevo email delivery limits, spamming real institutional inboxes or incurring financial costs.
> 4. Overwhelm Vercel serverless CPU/RAM budgets with synchronous PDF rendering, leading to 504 Gateway Timeouts for active users.

### The Zero-Pollution Policy
For all load testing conducted against the live environment:
* **NO DATABASE WRITES:** No endpoints or Server Actions executing `INSERT`, `UPDATE`, or `DELETE` queries may be load-tested.
* **NO THIRD-PARTY API CONSUMPTION:** Endpoints that call Google Forms v1, Google Sheets v4, or Brevo Email are strictly forbidden.
* **NO CPU-HEAVY PDF GENERATION:** All 14 endpoints utilizing `pdfkit` are excluded from concurrent load tests.
* **NO HARDCODED SECRETS:** Service-role keys, database passwords, and production JWT tokens must never be embedded in scripts.

---

## 2. Master Route Inventory & Safety Classification

Every important route, API endpoint, and Server Action discovered in the repository has been evaluated and assigned one of five strict safety classifications:

* `SAFE_READ`: Completely read-only, safe to benchmark against production at staged concurrency.
* `SAFE_AUTH`: Unauthenticated login pages or session check endpoints that read state without mutations.
* `CAUTION_WRITE`: Low-risk or cached operations that could trigger background side effects or race conditions under concurrency.
* `DANGEROUS_WRITE`: Production state mutations (fake attempts, registrations, feedback, admin deletes). **NEVER LOAD TEST ON PRODUCTION.**
* `DO_NOT_LOAD_TEST`: Endpoints that trigger heavy CPU vector rendering (`pdfkit`), external API quotas, or file uploads. **STRICTLY PROHIBITED ON PRODUCTION.**

### 2.1 Public & Institutional Pages

| Method | Path | Auth Required | Database Access | Read/Write | Expected Size | Production Safe? | Risk Level | Classification | Recommended k6 Scenario |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | None | None (Static) | Read | ~20 KB | **YES** | Minimal | `SAFE_READ` | Platform landing entry point (Part of 40% journey) |
| `GET` | `/[tenant]` (e.g. `/bce-bgp`) | None | SELECT on `colleges`, `events`, `forms` | Read | ~35 KB | **YES** | Low-Medium | `SAFE_READ` | College portal homepage (Core 40% journey) |
| `GET` | `/about` | None | None (Static) | Read | ~18 KB | **YES** | Minimal | `SAFE_READ` | Marketing/about page (Part of 40% journey) |
| `GET` | `/services` | None | None (Static) | Read | ~22 KB | **YES** | Minimal | `SAFE_READ` | Services catalog (Part of 40% journey) |
| `GET` | `/overview` | None | None (Static) | Read | ~16 KB | **YES** | Minimal | `SAFE_READ` | System overview (Part of 40% journey) |
| `GET` | `/privacy-policy` | None | None (Static) | Read | ~15 KB | **YES** | Minimal | `SAFE_READ` | Compliance view (Infrequent read) |
| `GET` | `/terms-of-service` | None | None (Static) | Read | ~15 KB | **YES** | Minimal | `SAFE_READ` | Compliance view (Infrequent read) |
| `GET` | `/offline` | None | None (Static) | Read | ~8 KB | **YES** | Minimal | `SAFE_READ` | PWA offline fallback check |
| `GET` | `/sitemap.xml` | None | None (Static) | Read | ~2 KB | **YES** | Minimal | `SAFE_READ` | Edge-cached SEO check |
| `GET` | `/robots.txt` | None | None (Static) | Read | <1 KB | **YES** | Minimal | `SAFE_READ` | Edge-cached crawler check |
| `GET` | `/manifest.webmanifest` | None | None (Static) | Read | ~2 KB | **YES** | Minimal | `SAFE_READ` | PWA installation manifest check (10% journey) |

---

### 2.2 Academic Modules (Events, Exams, Feedback)

| Method | Path | Auth Required | Database Access | Read/Write | Expected Size | Production Safe? | Risk Level | Classification | Recommended k6 Scenario |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/[tenant]/events` | None | SELECT on `events` | Read | ~28 KB | **YES** | Low | `SAFE_READ` | Tenant events directory (Core 20% journey) |
| `GET` | `/events` | None | SELECT on `events` | Read | ~26 KB | **YES** | Low | `SAFE_READ` | Global public events list (Core 20% journey) |
| `GET` | `/events/[slug]` | None | SELECT on `events`, `colleges` | Read | ~30 KB | **YES** | Low | `SAFE_READ` | Event overview & rules view |
| `GET` | `/[tenant]/exams` | None | SELECT on `exams`, `colleges` | Read | ~25 KB | **YES** | Low | `SAFE_READ` | Tenant exams discovery (Core 15% journey) |
| `GET` | `/exams` | None | SELECT on `exams` | Read | ~24 KB | **YES** | Low | `SAFE_READ` | Global public exams directory (Core 15% journey) |
| `GET` | `/exams/[id]` | None | SELECT on `exams`, `questions` | Read | ~25 KB | **YES** | Medium | `SAFE_READ` | Exam instructions page before starting attempt |
| `GET` | `/[tenant]/feedback`| None | SELECT on `feedback_forms` | Read | ~22 KB | **YES** | Low | `SAFE_READ` | Tenant feedback directory (Core 15% journey) |
| `GET` | `/feedback` | None | SELECT on `feedback_forms` | Read | ~20 KB | **YES** | Low | `SAFE_READ` | Global public feedback list (Core 15% journey) |
| `GET` | `/feedback/[id]` | None | SELECT on `feedback_forms` | Read | ~20 KB | **YES** | Low | `SAFE_READ` | Feedback overview page |
| `GET` | `/events/[slug]/register` | None | SELECT on `events` | Read | ~35 KB | **CAUTION**| Medium | `CAUTION_WRITE` | Registration form view (Do not submit form!) |
| `POST` | Event Registration Action | None | INSERT `events`, Google Sheets | Write | ~2 KB | **NO** | Critical | `DANGEROUS_WRITE`| **DO NOT LOAD TEST** (Exhausts Google Sheets quota) |
| `POST` | `startExamAttemptAction` | None | INSERT `exam_attempts` | Write | ~10 KB | **NO** | Critical | `DANGEROUS_WRITE`| **DO NOT LOAD TEST** (Inserts mock student attempts) |
| `POST` | `saveAnswerIncremental` | None | UPSERT `exam_answers` | Write | <1 KB | **NO** | High | `CAUTION_WRITE` | **DO NOT LOAD TEST** (Floods database connections) |
| `POST` | `submitExamAttemptAction`| None | Sequential UPSERT, UPDATE | Write | ~5 KB | **NO** | Critical | `DANGEROUS_WRITE`| **DO NOT LOAD TEST** (Triggers 50+ DB queries per test) |

---

### 2.3 Authentication & Administrative Consoles

| Method | Path | Auth Required | Database Access | Read/Write | Expected Size | Production Safe? | Risk Level | Classification | Recommended k6 Scenario |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/admin/login` | None | None | Read | ~18 KB | **YES** | Low | `SAFE_AUTH` | Admin login form delivery |
| `GET` | `/[tenant]/admin/login`| None | SELECT on `colleges` | Read | ~19 KB | **YES** | Low | `SAFE_AUTH` | Tenant-branded admin login form delivery |
| `POST` | `/api/admin/verify-session` | Token | SELECT on `admin_sessions` | Read | <1 KB | **YES** | Low | `SAFE_AUTH` | Token validity verification (With valid test token) |
| `GET` | `/admin/dashboard` | Admin Token | 14 SELECTs + `listUsers()` | Read | ~45 KB | **NO** | High | `DO_NOT_LOAD_TEST`| High CPU/RAM and unpaginated user list scan |
| `GET` | `/admin/dashboard/academic`| Admin Token | 4 SELECTs | Read | ~35 KB | **CAUTION**| Medium | `SAFE_READ` (Auth)| Only test with $\le 10$ VUs on dedicated token |
| `GET` | `/admin/dashboard/exams` | Admin Token | 3 SELECTs | Read | ~30 KB | **CAUTION**| Medium | `SAFE_READ` (Auth)| Only test with $\le 10$ VUs on dedicated token |
| `POST` | Admin Mutation Actions | Admin Token | INSERT/UPDATE/DELETE | Write | Var | **NO** | Critical | `DANGEROUS_WRITE`| **DO NOT LOAD TEST** (Mutates college structure) |

---

### 2.4 API Endpoints Inventory

| Method | Path | Auth Required | Database Access | Read/Write | Expected Size | Production Safe? | Risk Level | Classification | Recommended k6 Scenario |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/manifest/[slug]` | None | SELECT on `colleges` | Read | ~3 KB | **YES** | Minimal | `SAFE_READ` | PWA metadata endpoint (Part of 10% journey) |
| `GET` | `/api/manifest` | None | None | Read | ~2 KB | **YES** | Minimal | `SAFE_READ` | Global PWA manifest |
| `POST` | `/api/pwa/installations` | None | RPC `record_pwa_installation`| Write | <1 KB | **NO** | Medium | `CAUTION_WRITE` | **DO NOT LOAD TEST** (Inserts mock installation rows) |
| `GET` | `/api/exams/pdf/result` | Token/ID | 2 SELECTs + `pdfkit` | Read (CPU) | 300 KB | **NO** | Critical | `DO_NOT_LOAD_TEST`| **DO NOT LOAD TEST** (Serverless CPU freeze & OOM) |
| `GET` | `/api/admin/events/[id]/pdf`| Admin Token | 3 SELECTs + `pdfkit` | Read (CPU) | 500 KB | **NO** | Critical | `DO_NOT_LOAD_TEST`| **DO NOT LOAD TEST** (Serverless memory exhaustion) |
| `ALL` | 14 PDF Endpoints | Var | Heavy CPU Vector Drawing | Read (CPU) | 200–1500 KB| **NO** | Critical | `DO_NOT_LOAD_TEST`| **DO NOT LOAD TEST** (Synchronous PDF rendering) |
| `POST` | `/api/admin/forms/[id]/sync`| Admin Token | Google Forms/Sheets API | Write/Sync | ~15 KB | **NO** | Critical | `DO_NOT_LOAD_TEST`| **DO NOT LOAD TEST** (Exhausts Google Workspace quota) |
| `GET` | `/api/admin/events/stats` | Admin Token | Google Sheets API Fetch | Read/API | ~5 KB | **NO** | High | `DO_NOT_LOAD_TEST`| **DO NOT LOAD TEST** (Direct Google Sheets API calls) |
| `GET` | `/api/image-proxy` | None | Outbound HTTP proxy | Read (Proxy) | 50KB–5MB | **NO** | High | `DO_NOT_LOAD_TEST`| **DO NOT LOAD TEST** (Unrestricted forward proxy) |

---

## 3. Staged Load Testing Progression (10 to 1,000 VUs)

Load testing against a live production application must be executed in **controlled stages**. You must never jump directly to a high concurrency level.

```
       1000 VUs ─────────────────────────────────────────────── Stage 7 (Milestone)
        500 VUs ─────────────────────────────────────── Stage 6 (Peak Discovery)
        250 VUs ─────────────────────────────── Stage 5 (High Academic Rush)
        100 VUs ─────────────────────── Stage 4 (Timetable/Result Release)
         50 VUs ─────────────── Stage 3 (Standard Class Concurrency)
         25 VUs ─────── Stage 2 (Light Daily Baseline)
         10 VUs ── Stage 1 (Sanity & Warm-up)
```

### Stage 1: 10 VUs (Sanity & Warm-Up)
* **Goal:** Verify that DNS, Edge SSL termination, middleware routing, and Next.js SSR functions are responding normally.
* **Duration:** 3 minutes (30s ramp-up, 2m hold, 30s cooldown).
* **Expected Throughput:** ~3 to 6 requests/second.
* **Pass Criteria:**
  * HTTP Failure Rate: `< 0.1%`
  * p95 Response Time: `< 400 ms`
  * HTTP 5xx Errors: `0`

### Stage 2: 25 VUs (Light Daily Baseline)
* **Goal:** Simulate normal mid-day student browsing traffic across the BCE Bhagalpur portal.
* **Duration:** 3 minutes (30s ramp-up, 2m hold, 30s cooldown).
* **Expected Throughput:** ~8 to 15 requests/second.
* **Pass Criteria:**
  * HTTP Failure Rate: `< 0.2%`
  * p95 Response Time: `< 600 ms`
  * HTTP 5xx Errors: `0`

### Stage 3: 50 VUs (Standard Classroom Concurrency)
* **Goal:** Simulate a classroom batch simultaneously exploring exam syllabi and upcoming events.
* **Duration:** 4 minutes (30s ramp-up, 3m hold, 30s cooldown).
* **Expected Throughput:** ~18 to 30 requests/second.
* **Pass Criteria:**
  * HTTP Failure Rate: `< 0.5%`
  * p95 Response Time: `< 800 ms`
  * HTTP 5xx Errors: `0`

### Stage 4: 100 VUs (Moderate Surge)
* **Goal:** Simulate traffic right after an institutional circular or notification is published.
* **Duration:** 5 minutes (1m ramp-up, 3m hold, 1m cooldown).
* **Expected Throughput:** ~35 to 60 requests/second.
* **Pass Criteria:**
  * HTTP Failure Rate: `< 0.8%`
  * p95 Response Time: `< 1,200 ms`
  * HTTP 5xx Errors: `< 0.1%`

### Stage 5: 250 VUs (High Academic Event Rush)
* **Goal:** Test Edge network caching efficiency and Supabase read connection multiplexing under high read demand.
* **Duration:** 5 minutes (1m ramp-up, 3m hold, 1m cooldown).
* **Expected Throughput:** ~80 to 140 requests/second.
* **Pass Criteria:**
  * HTTP Failure Rate: `< 1.0%`
  * p95 Response Time: `< 1,800 ms`
  * HTTP 5xx Errors: `< 0.2%`

### Stage 6: 500 VUs (Peak Event & Discovery Surge)
* **Goal:** Evaluate system stability under peak read discovery conditions.
* **Duration:** 6 minutes (1m30s ramp-up, 3m30s hold, 1m cooldown).
* **Expected Throughput:** ~150 to 280 requests/second.
* **Pass Criteria:**
  * HTTP Failure Rate: `< 1.5%`
  * p95 Response Time: `< 2,500 ms`
  * Supabase Database CPU: `< 75%`
  * HTTP 5xx Errors: `< 0.5%`

### Stage 7: 1,000 VUs (Platform High-Concurrency Milestone)
* **Goal:** Determine the practical ceiling of the current read-only architecture.
* **Duration:** 7 minutes (2m ramp-up, 4m hold, 1m cooldown).
* **Expected Throughput:** ~300 to 550 requests/second.
* **Pass Criteria:**
  * HTTP Failure Rate: `< 2.0%`
  * p95 Response Time: `< 3,500 ms`
  * Supabase Database CPU: `< 85%`
  * HTTP 5xx Errors: `< 0.5%`

---

## 4. Beginner's Step-by-Step Operator Manual

### Prerequisites
1. Open PowerShell or Terminal.
2. Verify k6 is installed:
   ```bash
   k6 version
   ```
   *(If not installed, install via `winget install k6` on Windows or `brew install k6` on macOS).*

---

### Step 1: Pre-Flight Check (Smoke Test)
Before applying any traffic, run 1 single virtual user for 30 seconds to confirm network connectivity and zero errors:
```bash
k6 run --vus 1 --duration 30s -e BASE_URL=https://campusflow.in -e TEST_TENANT=bce-bgp load-tests/campusflow-readonly.js
```
* **Expected Output:** Checks must show `100.00% ✓` and `cf_http_5xx` must be `0.00%`.

---

### Step 2: Running Stage 1 (10 VUs)
Run the initial baseline sanity test:
```bash
k6 run -e BASE_URL=https://campusflow.in -e TEST_TENANT=bce-bgp -e LOAD_STAGE=1 load-tests/campusflow-readonly.js
```
* Observe terminal output during the 3-minute run.
* Verify that `http_req_failed` remains `0.00%`.

---

### Step 3: Progressive Scaling (Stage 2 through Stage 7)
After each stage completes, wait **2 minutes** for serverless container stabilization and database connection reclamation.

```bash
# Stage 2: 25 VUs
k6 run -e BASE_URL=https://campusflow.in -e TEST_TENANT=bce-bgp -e LOAD_STAGE=2 load-tests/campusflow-readonly.js

# Stage 3: 50 VUs
k6 run -e BASE_URL=https://campusflow.in -e TEST_TENANT=bce-bgp -e LOAD_STAGE=3 load-tests/campusflow-readonly.js

# Stage 4: 100 VUs
k6 run -e BASE_URL=https://campusflow.in -e TEST_TENANT=bce-bgp -e LOAD_STAGE=4 load-tests/campusflow-readonly.js
```

> [!IMPORTANT]
> **Do not advance to Stage 5 (250 VUs) or beyond if Stage 4 shows any 5xx errors or p95 latency $> 1,500\text{ ms}$.**

---

## 5. Real-Time Production Monitoring & Circuit Breakers

While tests are executing, the operator must have two monitoring dashboards open in separate browser tabs:

### 1. Supabase Cloud Dashboard (`Database` $\rightarrow$ `Metrics`)
* **Metric to Monitor:** Database CPU Utilization (%)
  * **Normal:** `< 40%`
  * **Warning:** `40% – 70%`
  * **Critical:** `> 80%` (Abuse of connections or unindexed scans)
* **Metric to Monitor:** Active Database Connections
  * Ensure connections do not approach the plan limit (typically 60–500 direct connections).

### 2. Vercel Dashboard (`Project` $\rightarrow$ `Analytics` & `Logs`)
* **Metric to Monitor:** Function Duration & Invocations
* **Metric to Monitor:** Real-time 504 Gateway Timeouts or 500 Function Errors.

---

### Emergency Circuit Breaker (When to Hit Ctrl+C)
Immediately press **`Ctrl + C`** in your k6 terminal if:
1. **`cf_http_5xx` exceeds 1.0%** at any point.
2. **`p(95)` response time climbs past 3,000 ms** for more than 30 consecutive seconds.
3. Supabase database CPU exceeds **85%**.
4. Real administrators or students at BCE Bhagalpur report site degradation.

---

## 6. Post-Test Analysis Template

After completing a test stage, record the metrics in the following template:

```markdown
### Load Test Execution Summary
- **Date/Time:** YYYY-MM-DD HH:MM
- **Target Host:** https://campusflow.in
- **Tenant:** bce-bgp
- **Executed Stage:** Stage X (YY VUs)
- **Total Requests Dispatched:** ZZZZ
- **Total Duration:** M mins
- **HTTP Success Rate:** XX.X%
- **HTTP 5xx Rate:** X.XX%
- **p95 Latency:** XXX ms
- **p99 Latency:** XXX ms
- **Peak Database CPU:** XX%
- **Verdict:** [PASSED / FAILED / ABORTED]
- **Observations:** [Notes on edge caching, database connection queueing, or slowdowns]
```
