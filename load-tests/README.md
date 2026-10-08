# CampusFlow Production-Safe Load Testing Guide
**Target System:** CampusFlow Platform (Live Production at BCE Bhagalpur)  
**Primary Suite:** `load-tests/campusflow-readonly.js`  
**Tool Required:** [k6](https://k6.io/) (Open-source load testing tool by Grafana Labs)  

---

## 1. Production Safety Warning

> [!CAUTION]
> **CampusFlow is LIVE in production for BCE Bhagalpur (`bce-bgp`) and real administrators, faculty, and students use the system.**  
> Under no circumstances should you run unconstrained or write-heavy load tests against production.

This test suite has been engineered with **strict zero-pollution guarantees**:
* **ZERO DATABASE WRITES:** Does not insert fake exam attempts, fake feedback responses, test registrations, or admin records.
* **ZERO THIRD-PARTY API QUOTA IMPACT:** Does not call Google Sheets API v4, Google Forms API v1, or the Brevo transactional email API.
* **ZERO CPU-HEAVY PDF GENERATION:** Completely excludes synchronous `pdfkit` vector document generation routes.
* **NO HARDCODED SECRETS:** All configuration is injected via environment variables.

---

## 2. Installing k6 (Beginner Quickstart)

k6 is a standalone, lightweight binary that does not require Node.js or npm to run.

### On Windows
Open PowerShell as Administrator and run:
```powershell
winget install k6 --source winget
```
*Or via Chocolatey:*
```powershell
choco install k6
```
*Or download the standalone Windows ZIP from:* [k6 GitHub Releases](https://github.com/grafana/k6/releases)

### On macOS
```bash
brew install k6
```

### On Linux (Ubuntu/Debian)
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

Verify installation:
```bash
k6 version
```

---

## 3. Environment Variables

| Variable | Description | Default Value | Example Usage |
| :--- | :--- | :--- | :--- |
| `BASE_URL` | Root URL of the CampusFlow instance | `http://localhost:3000` | `-e BASE_URL=https://campusflow.in` |
| `TEST_TENANT` | Institutional slug to browse | `bce-bgp` | `-e TEST_TENANT=bce-bgp` |
| `LOAD_STAGE` | Single stage index to run (`1` to `7`) | `1` (10 VUs) | `-e LOAD_STAGE=3` |
| `STAGED_RAMP`| Run all 7 stages continuously | `false` | `-e STAGED_RAMP=true` |
| `TEST_TOKEN` | Optional Supabase JWT for auth reads | `""` (Anonymous) | `-e TEST_TOKEN=eyJhbGci...` |

---

## 4. How to Execute Tests (Step-by-Step)

Always start with **Step 1 (Smoke Test)** before scaling up to ensure target accessibility.

### Step 0: Pre-Flight Smoke Test (1 User, 30 Seconds)
Validates that the target URL is reachable and responding without errors.
```bash
k6 run --vus 1 --duration 30s -e BASE_URL=https://campusflow.in -e TEST_TENANT=bce-bgp load-tests/campusflow-readonly.js
```

### Step 1: Stage 1 (10 Concurrent Users — Baseline Sanity)
Warm-up test. Low load, verifies Edge CDN routing and basic page delivery.
```bash
k6 run -e BASE_URL=https://campusflow.in -e TEST_TENANT=bce-bgp -e LOAD_STAGE=1 load-tests/campusflow-readonly.js
```
* **Duration:** 3 minutes (30s ramp, 2m plateau, 30s cooldown)
* **Expected Result:** Error rate = 0%, p95 latency < 500ms.

### Step 2: Stage 2 (25 Concurrent Users — Light Traffic Baseline)
Simulates normal mid-day student browsing traffic.
```bash
k6 run -e BASE_URL=https://campusflow.in -e TEST_TENANT=bce-bgp -e LOAD_STAGE=2 load-tests/campusflow-readonly.js
```

### Step 3: Stage 3 (50 Concurrent Users — Standard Concurrency)
Simulates a classroom or batch browsing exam and event listings.
```bash
k6 run -e BASE_URL=https://campusflow.in -e TEST_TENANT=bce-bgp -e LOAD_STAGE=3 load-tests/campusflow-readonly.js
```

### Step 4: Stage 4 (100 Concurrent Users — Moderate Surge)
Simulates traffic during an announcement or timetable release.
```bash
k6 run -e BASE_URL=https://campusflow.in -e TEST_TENANT=bce-bgp -e LOAD_STAGE=4 load-tests/campusflow-readonly.js
```

### Step 5: Stage 5 (250 Concurrent Users — High Academic Rush)
Simulates multiple branches viewing published event details or exam syllabi.
```bash
k6 run -e BASE_URL=https://campusflow.in -e TEST_TENANT=bce-bgp -e LOAD_STAGE=5 load-tests/campusflow-readonly.js
```

### Step 6: Stage 6 (500 Concurrent Users — Peak Event Surge)
Tests Edge CDN resilience and Supabase read connection pooling.
```bash
k6 run -e BASE_URL=https://campusflow.in -e TEST_TENANT=bce-bgp -e LOAD_STAGE=6 load-tests/campusflow-readonly.js
```

### Step 7: Stage 7 (1,000 Concurrent Users — Platform Concurrency Milestone)
Evaluates high concurrency performance across read routes.
```bash
k6 run -e BASE_URL=https://campusflow.in -e TEST_TENANT=bce-bgp -e LOAD_STAGE=7 load-tests/campusflow-readonly.js
```

---

## 5. Automated Full Progressive Ramp (Optional)

If you wish to run all 7 stages continuously in a single 35-minute progressive ramp:
```bash
k6 run -e BASE_URL=https://campusflow.in -e TEST_TENANT=bce-bgp -e STAGED_RAMP=true load-tests/campusflow-readonly.js
```

---

## 6. How to Read k6 Output Metrics

When k6 finishes, it prints a terminal summary report:

```
     ✓ Home page status is 200
     ✓ Tenant portal status is 200
     ✓ Tenant events status is 200
     ✓ Tenant exams status is 200

     checks.........................: 100.00% ✓ 480       ✗ 0
     cf_http_5xx....................: 0.00%   ✓ 0         ✗ 480
     cf_portal_page_duration........: avg=212ms  min=140ms med=185ms max=820ms p(90)=290ms p(95)=340ms
     http_req_duration..............: avg=185ms  min=110ms med=160ms max=820ms p(90)=240ms p(95)=285ms p(99)=490ms
     http_req_failed................: 0.00%   ✓ 0         ✗ 480
```

### Critical Metrics Explained:
1. **`http_req_failed`**: Total percentage of failed HTTP requests (status $\ge 400$). Must stay **under 1.0%**.
2. **`cf_http_5xx`**: Server crashes, unhandled exceptions, or Vercel 504 Gateway Timeouts. Must stay **under 0.5%** (ideally 0.00%).
3. **`http_req_duration p(95)`**: 95% of all requests completed faster than this time. Target: **under 1,500 ms (1.5s)**.
4. **`http_req_duration p(99)`**: 99% of requests completed faster than this time. Target: **under 3,000 ms (3.0s)**.
5. **`cf_portal_page_duration`**: Average and 95th-percentile response time specifically for the college portal homepage (`/[tenant]`).

---

## 7. Emergency Abort Procedure (Circuit Breaker)

If you are running a test against production and notice any of the following symptoms:
1. **`cf_http_5xx` spikes above 1%** (server is failing or timing out).
2. **`p(95)` response time exceeds 3,000 ms** (requests are queuing).
3. Real users report slowdowns or errors.

### Immediate Action:
Press **`Ctrl + C`** in your terminal immediately to cancel the test. k6 will terminate all active virtual users within 1–2 seconds.
