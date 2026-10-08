# CampusFlow Staging Load Test Report & Readiness Audit

**Document Status**: AUDIT COMPLETE — PHASE 0 SAFETY GATE TRIGGERED  
**Author**: Principal Performance & Database Reliability Architect  
**Target Environment**: CampusFlow Staging (Multi-tenant Institutional Platform)  
**Evaluated Tenant**: Bhagalpur College of Engineering (`bce-bgp`)  
**Target Concurrency Ladder**: 250 VU → 500 VU → 1,000 VU → 2,500 VU → 5,000 VU → 7,500 VU → 10,000 VU  
**Report Date**: October 2026  

---

## Executive Summary

Following successful local production-mode certification at 100 VUs (31.63 RPS, p95 1.13s, p99 2.26s, 0% errors across 4,128 requests), preparation for the **Staging Progressive Load Test Phase** was initiated.

During **Phase 0 — Safety Check**, a rigorous inspection of all environment variables, Git configuration, DNS records, and Supabase database endpoints revealed that **no isolated staging infrastructure currently exists**. The only configured remote endpoints in `.env.local` and source control are:
1. `NEXT_PUBLIC_APP_URL=https://143campusflow.vercel.app` (The active live production deployment for BCE Bhagalpur).
2. `NEXT_PUBLIC_SUPABASE_URL=https://txerarcajxjzxifanzxw.supabase.co` (The live production PostgreSQL database).

Pursuant to the mandatory Phase 0 protocol:
> **`STAGING TEST BLOCKED — ENVIRONMENT IS NOT SAFELY ISOLATED`**

Progressive load generation against the live production environment at 250 to 10,000 VUs would constitute an active Denial of Service attack against real college operations, deplete live database connections, and violate strict zero-pollution policies.

---

## Staging Environment Status (Phase 0 Audit)

```text
Environment:
STAGING

Production database:
NOT USED (Strictly isolated; circuit breaker verified)

Staging database:
PENDING MANUAL PROVISIONING (<staging-project>.supabase.co)

Staging deployment:
PENDING VERCEL PREVIEW PROVISIONING

Git branch:
staging/load-test (Pushed to origin/staging/load-test)

Data:
Synthetic / isolated (Blueprint ready in scripts/seed-staging-synthetic.mjs)

Production circuit breaker:
VERIFIED (campusflow.in and 143campusflow.vercel.app execution blocked)

1 VU smoke:
PENDING STAGING DEPLOYMENT

10 VU smoke:
PENDING STAGING DEPLOYMENT

250 VU:
PENDING (BLOCKED UNTIL STAGING ISOLATION VERIFIED)
```

This report documents the repository load-test audit, route safety classification, staging test configuration harness, baseline performance comparisons, and the exact steps required to provision an isolated staging environment to resume the staged ladder.

---

## 1. Test Environment

| Parameter | Configuration / Audit Finding | Status |
| :--- | :--- | :--- |
| **Local Test Baseline** | `http://localhost:3000` (Next.js 15.2.0 production build, Node.js v20) | PASS (Up to 100 VUs) |
| **Configured Remote App URL** | `https://143campusflow.vercel.app` | **PRODUCTION (RESTRICTED)** |
| **Production Custom Domain** | `https://campusflow.in` | **PRODUCTION (RESTRICTED)** |
| **Remote Database** | `https://txerarcajxjzxifanzxw.supabase.co` | **LIVE PRODUCTION DATA** |
| **Dedicated Staging URL** | None provisioned in repo or environment | **MISSING** |
| **Isolated Staging Database** | None provisioned in repo or environment | **MISSING** |

---

## 2. Staging URL Classification & Safety Gate (Phase 0)

The safety directives for CampusFlow mandate that before applying any traffic:
1. Target URL must be a dedicated STAGING environment: **UNVERIFIED (No staging URL provided)**.
2. Must NOT be the real BCE Bhagalpur production deployment: **CONFIRMED that configured URLs are production**.
3. Staging must use isolated/test data: **UNVERIFIED (Only live production data exists)**.
4. No real admin credentials used: **COMPLIANT (No admin credentials embedded)**.
5. No real student forms submitted: **COMPLIANT (Script is 100% read-only GET)**.
6. No real emails dispatched: **COMPLIANT (Script excludes Brevo APIs)**.
7. No Google Sheets sync triggered: **COMPLIANT (Script excludes Google APIs)**.
8. No high-volume PDF rendering: **COMPLIANT (Script excludes all 14 `pdfkit` endpoints)**.
9. No production database mutations: **COMPLIANT (Zero INSERT/UPDATE/DELETE queries)**.
10. No 10K load against production: **ENFORCED via automated script circuit breakers**.

Because items 1, 2, and 3 cannot be confirmed without dedicated staging infrastructure, the Phase 0 Gate is closed:
```text
STAGING TEST BLOCKED — ENVIRONMENT IS NOT SAFELY ISOLATED
```

---

## 3. Hardware & Infrastructure Overview

### Local Benchmark Node (Current Baseline)
* **CPU**: Intel Core i3-1315U (13th Gen, 6 cores / 8 threads)
* **RAM**: 20 GB DDR4
* **Storage**: NVMe SSD (Windows 11)
* **k6 Runtime**: k6 v2.2.0 (Official Windows 64-bit binary)

### Target Staging Infrastructure Requirements (To Be Provisioned)
* **Frontend/Edge**: Vercel Preview/Staging Environment linked to a staging branch (e.g., `staging.campusflow.in` or Vercel preview branch deployment).
* **Compute**: Node.js 20 Serverless Functions with Fluid Compute enabled.
* **Database**: Dedicated Supabase Staging Project (or Supabase Database Branch) with Supabase Supavisor Connection Pooling in Transaction mode on port `6543`.

---

## 4. Test Script Architecture & Audit (Phase 1)

The staging load-test harness has been created at `load-tests/campusflow-staging-progressive.js`, building upon the verified `load-tests/campusflow-readonly.js`.

### Key Safety Invariants in the Script
1. **Host Circuit Breaker**: The script programmatically inspects `BASE_URL`. If the host contains `campusflow.in` or `143campusflow.vercel.app`, execution aborts immediately with an exception.
2. **Strict GET-Only Operations**: All requests utilize `http.get()`. Zero `http.post()`, `http.put()`, or `http.delete()` calls exist.
3. **No Form Mutations**: Form submission routes (`/api/feedback/submit`, event registrations) are excluded.
4. **No Exam State Alterations**: Exam attempts (`startExamAttemptAction`, `saveAnswerIncremental`, `submitExamAttemptAction`) are excluded.
5. **No Vector PDF Generation**: Heavy CPU endpoints (`/api/exams/pdf/*`, `/api/admin/results/export-pdf`) are excluded.
6. **No Third-Party External APIs**: Google Apps Script webhooks, Google Forms v1, Google Sheets v4, and Brevo API are completely bypassed.

---

## 5. Master Route Inventory & Classification

| Route / Endpoint | HTTP Method | Safety Classification | Description | Included in Load Test? |
| :--- | :---: | :---: | :--- | :---: |
| `/` | `GET` | `SAFE_READ` | Platform public landing page | **Yes (40% Journey)** |
| `/[tenant]` (e.g. `/bce-bgp`) | `GET` | `SAFE_READ` | College portal homepage | **Yes (40% Journey)** |
| `/about`, `/services` | `GET` | `SAFE_READ` | Static platform info pages | **Yes (40% Journey)** |
| `/[tenant]/events` | `GET` | `SAFE_READ` | College events directory | **Yes (20% Journey)** |
| `/events` | `GET` | `SAFE_READ` | Global public events directory | **Yes (20% Journey)** |
| `/[tenant]/exams` | `GET` | `SAFE_READ` | College examination directory | **Yes (15% Journey)** |
| `/exams` | `GET` | `SAFE_READ` | Global exams directory | **Yes (15% Journey)** |
| `/[tenant]/feedback` | `GET` | `SAFE_READ` | Active feedback forms directory | **Yes (15% Journey)** |
| `/feedback` | `GET` | `SAFE_READ` | Global feedback directory | **Yes (15% Journey)** |
| `/api/manifest/[tenant]` | `GET` | `SAFE_READ` | Dynamic tenant PWA web manifest | **Yes (10% Journey)** |
| `/manifest.webmanifest`, `/robots.txt` | `GET` | `SAFE_READ` | Static edge assets | **Yes (10% Journey)** |
| `/admin/login`, `/[tenant]/admin/login` | `GET` | `SAFE_AUTH` | Admin login views | No (Read-only anonymous focus) |
| `/api/admin/verify-session` | `POST` | `SAFE_AUTH` | JWT verification | No |
| `/admin/dashboard` | `GET` | `EXPENSIVE` | Full admin overview (14 SELECTs + user directory) | **PROHIBITED from high-VU load** |
| `/api/exams/pdf/*` | `GET` | `EXPENSIVE` | Synchronous pdfkit vector generation | **PROHIBITED from high-VU load** |
| `/api/admin/results/export-pdf` | `GET` | `EXPENSIVE` | Multi-page PDF report generation | **PROHIBITED from high-VU load** |
| `/events/[slug]/register` | `POST` | `WRITE` | Student event registration + Google Sheets sync | **PROHIBITED from load test** |
| Exam Start / Save / Submit | `POST` | `WRITE` | Student exam session mutations | **PROHIBITED from load test** |
| Feedback Submit Action | `POST` | `WRITE` | Feedback response ingestion | **PROHIBITED from load test** |

---

## 6. Traffic Model & User Journeys

The simulation distributes virtual users across five realistic behavioral journeys:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CampusFlow Traffic Model                        │
├───────────────────────────────┬────────────────────────────────────────┤
│ 40% Institutional Portals     │ /, /[tenant], /about, /services        │
│ 20% Events Discovery          │ /[tenant]/events, /events              │
│ 15% Exams Discovery           │ /[tenant]/exams, /exams                │
│ 15% Feedback Discovery        │ /[tenant]/feedback, /feedback          │
│ 10% PWA Manifests & Metadata  │ /api/manifest/[tenant], /robots.txt    │
└───────────────────────────────┴────────────────────────────────────────┘
```

Each iteration includes realistic human think time (`sleep(1.5s - 4.0s)`) between page transitions to simulate authentic browsing habits.

---

## 7. Performance Progression & Local Baseline Comparison

The local production-mode tests establish the validated baseline capacity for the codebase:

| Concurrency | Requests | RPS | p50 (ms) | p90 (ms) | p95 (ms) | p99 (ms) | Max Latency | Error Rate | Status |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1 VU** (30s) | 10 | 0.30 | 362.4 | 450.1 | 461.6 | 513.3 | 526.2 ms | 0.00% | **PASS** |
| **10 VU** (60s) | 219 | 3.18 | 360.7 | 466.2 | 515.4 | 819.9 | 1.11 s | 0.00% | **PASS** |
| **25 VU** (90s) | 812 | 8.13 | 433.8 | 588.6 | 661.8 | 1,100.0 | 1.84 s | 0.00% | **PASS** |
| **50 VU** (Initial) | 1,842 | 15.35 | 450.2 | 682.1 | 842.4 | 10,930.0 | 13.47 s | 0.00% | **FAIL (RPC SLA)** |
| **50 VU** (Optimized) | 2,105 | 16.16 | 665.4 | 890.3 | 1,010.0 | 1,680.0 | 2.65 s | 0.00% | **PASS** |
| **100 VU** (120s) | 4,128 | 31.63 | 740.1 | 988.5 | 1,130.0 | 2,260.0 | 3.17 s | 0.00% | **PASS** |

### Staging Ladder Target Matrix (Pending Staging Isolation)

| Stage | Target VUs | Planned Duration | Target RPS (Est.) | SLA p95 Limit | SLA p99 Limit | Staging Execution Status |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Stage 1** | 250 VU | 120s | ~75 - 90 RPS | < 1,500 ms | < 3,000 ms | **BLOCKED (Phase 0)** |
| **Stage 2** | 500 VU | 120s | ~150 - 180 RPS | < 1,500 ms | < 3,000 ms | **BLOCKED (Phase 0)** |
| **Stage 3** | 1,000 VU | 120s | ~300 - 360 RPS | < 1,500 ms | < 3,000 ms | **BLOCKED (Phase 0)** |
| **Stage 4** | 2,500 VU | 120s | ~750 - 900 RPS | < 1,500 ms | < 3,000 ms | **BLOCKED (Phase 0)** |
| **Stage 5** | 5,000 VU | 120s | ~1,500 - 1,800 RPS | < 1,500 ms | < 3,000 ms | **BLOCKED (Phase 0)** |
| **Stage 6** | 7,500 VU | 120s | ~2,250 - 2,700 RPS | < 1,500 ms | < 3,000 ms | **BLOCKED (Phase 0)** |
| **Stage 7** | 10,000 VU | 120s | ~3,000 - 3,600 RPS | < 1,500 ms | < 3,000 ms | **BLOCKED (Phase 0)** |

---

## 8. Root Cause Analysis of Previous 50-VU Bottleneck

During initial local 50-VU testing, p99 latency degraded to 10.93 seconds due to:
* **The Root Cause**: `src/lib/pwa/installations.ts` executed an uncached remote Supabase RPC (`get_pwa_install_count`) on every request to `/[tenant]` and `/[tenant]/feedback` (which represented 55% of all incoming requests). Under 50 concurrent VUs, connection socket saturation caused `fetch failed` timeouts.
* **The Solution**: 
  1. Wrapped the RPC call in Next.js `unstable_cache` with a 60-second TTL.
  2. Implemented a cookie-free, stateless Supabase client to enable deterministic caching across all users.
  3. Added a 2,500ms `Promise.race` timeout guard with an immediate `0` fallback.
  4. Configured cache revalidation tag (`pwa-install-count`) on valid installations.
* **Result**: Latency at 50 VUs dropped from 10.93s to 1.68s p99, and the 100-VU test achieved 2.26s p99 with zero errors.

---

## 9. Infrastructure Capacity Projections (Staging vs. Production)

1. **Vercel Serverless Concurrency**:
   - Vercel Pro accounts support standard concurrent function execution envelopes (default 1,000 concurrent executions).
   - At 2,500 to 10,000 VUs, static page ISR/Edge caching is required to prevent serverless function invocation exhaustion. Public pages (`/`, `/[tenant]`, `/about`) must leverage edge caching headers (`s-maxage`).
2. **Supabase Connection Pooling**:
   - Direct connection limits on micro/small PostgreSQL instances range from 60 to 90 connections.
   - At 250+ VUs, direct connections will immediately fail with `FATAL: remaining connection slots are reserved`.
   - The staging environment **must connect via Supavisor Transaction Pooler (`aws-0-*.pooler.supabase.com:6543`)** rather than direct port `5432`.
3. **Database Read Replicas**:
   - Scaling beyond 2,500 VUs under sustained query loads typically requires read replicas or edge caching for tenant metadata queries.

---

## 10. Prerequisites to Unblock Staging Load Testing

To safely unblock and execute the 250 → 10,000 VU progressive test:

1. **Staging Vercel Deployment**:
   - Create a dedicated staging branch (e.g. `staging` or `preview`).
   - Deploy to a dedicated staging URL (e.g. `https://staging-campusflow.vercel.app` or custom preview domain).
2. **Staging Supabase Project / Branch**:
   - Provision a separate, isolated Supabase project or branching instance containing anonymized seed data.
   - Configure the staging environment variables in Vercel to point to this isolated instance.
3. **Execution Command**:
   Once the staging URL is available, execute Stage 1 using the newly configured runner:
   ```powershell
   $env:Path += ';C:\Program Files\k6'
   k6 run `
     --vus 250 `
     --duration 120s `
     -e BASE_URL="https://staging-campusflow.vercel.app" `
     -e TEST_TENANT="bce-bgp" `
     -e LOAD_STAGE="1" `
     .\load-tests\campusflow-staging-progressive.js
   ```

---

## 11. Final Verdict

```text
STAGING TEST BLOCKED — ENVIRONMENT IS NOT SAFELY ISOLATED
```

> **Mandatory Disclaimer**:  
> CampusFlow has achieved certified local production-mode capacity up to 100 VUs with 0% errors. Staging progressive tests (250 → 10,000 VUs) are staged and ready in the repository harness (`load-tests/campusflow-staging-progressive.js`), but are strictly blocked from execution until a physically isolated, non-production staging deployment and database are provided. Running 10,000 VUs against production or unverified environments is strictly prohibited.
