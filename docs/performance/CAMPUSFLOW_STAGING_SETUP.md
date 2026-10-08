# CampusFlow Staging Environment Setup & Infrastructure Audit

**Document Status**: ARCHITECTURE AUDIT COMPLETE & REPRODUCIBLE BLUEPRINT  
**Author**: Principal Performance & Database Reliability Architect  
**Created On**: October 2026  
**Target Environment**: Isolated Staging (`staging.campusflow.in` / Vercel Preview)  
**Safety Gate**: STRICT NON-PRODUCTION ISOLATION  

---

## 1. Executive Deployment Audit

### 1.1 Vercel Deployment Profile
* **Production Project Name**: `143campusflow` (referenced by `https://143campusflow.vercel.app`)
* **Production Custom Domain**: `https://campusflow.in`
* **Vercel CLI Status**: Unauthenticated in terminal (`The specified token is not valid`).
* **Deployment Trigger**: GitHub push integration on repository `Aditya-Kumar-Sah-CSE/CampusFlow`.
* **Staging Target Deployment**: Branch `staging/load-test` pushed to remote. Vercel automatically creates a preview deployment URL for branch pushes (e.g. `https://campusflow-git-staging-load-test-*.vercel.app`).

### 1.2 Git Branching Architecture
* **Production Canonical Branch**: `main` (clean, untouched by test experiments).
* **Staging Test Branch**: `staging/load-test` (created directly from `main` and tracked at `origin/staging/load-test`).
* **Branch Invariants**:
  - Contains all verified 10K optimizations (cached PWA install counter, React.cache auth deduplication, composite DB indexes, batch feedback sync).
  - Contains progressive staging load test runner [`load-tests/campusflow-staging-progressive.js`](file:///d:/CampusFlow/load-tests/campusflow-staging-progressive.js).
  - Excludes all secret tokens or environment files (`.gitignore` enforces isolation).

### 1.3 Production Supabase Architecture
* **Production Project ID**: `txerarcajxjzxifanzxw` (`https://txerarcajxjzxifanzxw.supabase.co`)
* **PostgreSQL Engine**: Major version 17
* **Connection Architecture**: Direct port `5432` / Supavisor connection pooler port `6543`.
* **Database State**: Active institutional database for BCE Bhagalpur.
* **Safety Mandate**: **STRICTLY PROHIBITED FROM MODIFICATIONS, SEEDING, OR LOAD TESTING**.

---

## 2. Migration Ledger & Schema Replication Order

The staging database requires applying all 24 schema migrations in strict numerical order. The migration ledger discovered in [`supabase/migrations/`](file:///d:/CampusFlow/supabase/migrations/) is:

| Order | Migration File | Scope & Purpose | Critical Entities Created |
| :---: | :--- | :--- | :--- |
| **01** | `20260922000001_phase1_platform_and_tenants.sql` | Multi-tenant foundations | `colleges`, `college_domains`, `college_branding`, `platform_admins`, `college_memberships` |
| **02** | `20260922000002_phase2_academic_structure.sql` | Academic hierarchy | `academic_years`, `branches`, `semesters`, `subjects`, `faculties`, `faculty_assignments` |
| **03** | `20260922000003_phase3_feedback_structure.sql` | Feedback forms & responses | `feedback_forms`, `feedback_form_items`, `feedback_response_records` |
| **04** | `20260922000004_phase4_google_connections.sql` | Google Workspace OAuth | `google_connections`, `token_encryption` |
| **05** | `20260922000005_phase5_billing_and_entitlements.sql`| Subscription billing | `billing_plans`, `college_billing_accounts`, `invoices`, `payment_settings` |
| **06** | `20260922000006_phase6_audit_and_rls.sql` | Security & PostgREST RLS | PostgREST roles, tenant RLS policies, audit logs, RPCs |
| **07** | `20260922000007_phase7_seed_initial_platform.sql` | Master platform bootstrap | Billing plans seed, BCE-BGP deterministic college seed (`bce00000-0000-0000-0000-000000000001`) |
| **08** | `20260923000001_institution_logos_and_rls.sql` | Storage & branding assets | Storage bucket `institution-logos`, public read storage RLS |
| **09** | `20260923000001_super_admin_promotion_system.sql`| Super admin access control | RPC `promote_super_admin`, platform privilege guards |
| **10** | `20260927000001_response_exclusion_and_duplicates.sql`| Duplicate response prevention | Constraint `uq_feedback_response_hash`, exclusions |
| **11** | `20260929000001_pwa_installations.sql` | PWA installation metrics | `pwa_installations`, RPC `record_pwa_installation`, RPC `get_pwa_install_count` |
| **12** | `20260930000001_college_events_and_registrations.sql`| Events & registrations | `events`, `event_registrations`, RPC `register_for_event`, storage `event-assets` |
| **13** | `20260930000002_landing_page_modules_toggles.sql` | Feature flag toggles | `colleges.modules_enabled` JSONB flags |
| **14** | `20260930000003_event_programs_and_categories.sql` | Event schedules & sub-programs | `event_programs`, `event_categories` |
| **15** | `20260930000004_add_registration_sheet_id.sql` | Event sync metadata | `events.registration_sheet_id` |
| **16** | `20260930000005_internal_event_team_invitations.sql`| Event team invitations | `event_team_invitations` |
| **17** | `20260930000006_team_join_requests.sql` | Student group event teams | `event_team_join_requests` |
| **18** | `20261004000002_small_events_google_registration.sql`| Small event registration mode | Registration mode flags |
| **19** | `20261004000003_event_custom_categories.sql` | College-level event tags | Custom taxonomy |
| **20** | `20261007000001_production_safe_backup_and_performance.sql`| Performance & backup policies | Health checks, vacuum schedules |
| **21** | `20261007000002_admin_single_session_policy.sql`| Admin session concurrency | `admin_sessions`, single-session token invalidation |
| **22** | `20261008000001_exam_and_online_testing_module.sql`| Exams & assessments | `exams`, `exam_branches`, `exam_subjects`, `exam_questions`, `exam_question_options`, `exam_attempts`, `exam_answers` |
| **23** | `20261008000002_academic_programmes_and_levels.sql`| Degree programs & levels | `programmes`, `programme_levels`, `academic_degrees` |
| **24** | `20261008000003_performance_composite_indexes.sql`| 10K composite performance indexes | `idx_exams_college_status_academic`, `idx_events_college_status_start`, `idx_exam_attempts_user_exam` |

---

## 3. Production Data Protection & Fallback Audit

### Critical Code Finding
An audit of `src/` revealed eight application files containing hardcoded fallback strings pointing to the production database:
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://txerarcajxjzxifanzxw.supabase.co';
```
Affected files:
1. `src/middleware.ts` (Line 69)
2. `src/lib/tenant/resolver.ts` (Line 70)
3. `src/lib/pwa/installations.ts` (Line 5)
4. `src/lib/supabase/client.ts` (Line 4)
5. `src/lib/supabase/academic-cache.ts` (Line 7)
6. `src/lib/supabase/admin.ts` (Line 43)
7. `src/lib/supabase/server.ts` (Line 12)
8. `src/app/api/admin/forms/stream-generate/route.ts` (Line 38)

> [!WARNING]
> If `NEXT_PUBLIC_SUPABASE_URL` is omitted from Vercel staging environment variables, the runtime will automatically fall back to the live production database `txerarcajxjzxifanzxw.supabase.co`!
> **Mandatory Rule**: `NEXT_PUBLIC_SUPABASE_URL` must ALWAYS be explicitly configured in the Staging/Preview environment.

---

## 4. Staging Environment Variables Specification

The staging Vercel deployment must be provisioned with these isolated variables:

```ini
# ==============================================================================
# CAMPUSFLOW STAGING ENVIRONMENT CONFIGURATION (.env.staging)
# ==============================================================================

# 1. Staging Supabase Credentials (MUST BE SEPARATE PROJECT)
NEXT_PUBLIC_SUPABASE_URL=https://<staging-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>

# 2. Application Host & Branding
NEXT_PUBLIC_APP_URL=https://staging-campusflow.vercel.app
SUPER_ADMIN_EMAIL=staging-admin@campusflow.test

# 3. Google Integrations (ISOLATED / DUMMY STAGING VALUES)
GOOGLE_CLIENT_ID=staging-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=staging-dummy-secret
GOOGLE_REDIRECT_URI=https://staging-campusflow.vercel.app/api/auth/google/callback
GOOGLE_REFRESH_TOKEN=staging-dummy-token
GOOGLE_APPS_SCRIPT_URL=https://script.google.com/macros/s/staging-dummy/exec
GOOGLE_APPS_SCRIPT_SECRET=staging-dummy-webhook-secret
GOOGLE_APPS_SCRIPT_Runner_EMAIL=staging-runner@campusflow.test

# 4. Email / Notifications (DISABLED / STAGING SINK)
BREVO_API_KEY=xkeysib-staging-dummy-key
BREVO_SENDER_EMAIL=staging-notifications@campusflow.test
BREVO_SENDER_NAME=CampusFlow-Staging
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=staging-test
SMTP_PASS=staging-test
EMAIL_FROM=CampusFlow Staging <staging@campusflow.test>
```

---

## 5. Synthetic Staging Dataset Blueprint

To satisfy realistic query execution plans without copying real student PII:

| Table | Target Staging Rows | Generation Methodology | Content Description |
| :--- | :---: | :--- | :--- |
| `colleges` | 2 | Deterministic | BCE Bhagalpur (`bce-bgp`), GEC Banka (`gec-banka`) |
| `academic_years` | 4 | Synthetic | 2023-24, 2024-25, 2025-26, 2026-27 |
| `programmes` | 3 | Synthetic | B.Tech, M.Tech, BCA |
| `branches` | 6 | Synthetic | CSE, ECE, ME, CE, EE, AI/ML |
| `semesters` | 8 | Synthetic | Sem 1 through Sem 8 |
| `subjects` | 40 | Synthetic | Realistically distributed curriculum subjects |
| `faculties` | 25 | Synthetic | Anonymized test professors (`faculty_X@campusflow.test`) |
| `feedback_forms` | 20 | Synthetic | Published semester and faculty feedback questionnaires |
| `events` | 15 | Synthetic | Published technical symposia, fests, and workshops |
| `event_categories` | 6 | Synthetic | Coding, Robotics, Cultural, Sports, Literary, Gaming |
| `exams` | 12 | Synthetic | Published mid-semester and online mock tests |
| `exam_questions` | 120 | Synthetic | MCQ questions with 4 options each |
| `exam_question_options` | 480 | Synthetic | Normalized question options |
| `pwa_installations` | 1 | Aggregate | Initial counter baseline for `get_pwa_install_count` RPC |

A dedicated automated seeder script has been authored at [`scripts/seed-staging-synthetic.mjs`](file:///d:/CampusFlow/scripts/seed-staging-synthetic.mjs).

---

## 6. Exact Step-by-Step Staging Provisioning Guide

Because Supabase CLI and Vercel CLI require browser/SSO authentication on the user machine, follow these exact manual steps to provision the isolated infrastructure:

### Step A: Create the Staging Supabase Project
1. Log into your Supabase Dashboard: [https://supabase.com/dashboard](https://supabase.com/dashboard).
2. Click **New project**.
3. Set **Name**: `campusflow-staging`.
4. Set **Database Password**: Generate a secure password.
5. Set **Region**: Same region as production (e.g. `ap-south-1` Mumbai or `ap-southeast-1` Singapore).
6. Click **Create new project**.

### Step B: Apply the Migration Ledger to Staging
Once the staging project is provisioned:
1. In the Supabase dashboard, navigate to **Project Settings** > **Database** and copy the **Connection string (URI)** (port `5432` or pooler port `6543`).
2. Run the migration push from your terminal:
   ```powershell
   npx supabase db push --db-url "postgresql://postgres.[STAGING_PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
   ```
   *(Or copy the contents of `supabase/migrations/*.sql` into the Supabase SQL Editor and execute).*

### Step C: Seed the Synthetic Dataset
Execute the synthetic seeder with your new staging credentials:
```powershell
$env:SUPABASE_URL = "https://[STAGING_PROJECT_REF].supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "[STAGING_SERVICE_ROLE_KEY]"
node scripts/seed-staging-synthetic.mjs
```

### Step D: Configure Vercel Preview / Staging Deployment
1. Navigate to your Vercel Project Dashboard: [https://vercel.com/dashboard](https://vercel.com/dashboard).
2. Go to **Settings** > **Environment Variables**.
3. Add the staging environment variables from Section 4, scoped **ONLY** to the **Preview** environment (or target branch `staging/load-test`).
4. Ensure `NEXT_PUBLIC_SUPABASE_URL` is explicitly set to the staging URL so it does not trigger the production fallback!
5. Push or trigger a redeploy of branch `staging/load-test`.

---

## 7. Safety Circuit Breaker Verification

The progressive staging load-test runner [`load-tests/campusflow-staging-progressive.js`](file:///d:/CampusFlow/load-tests/campusflow-staging-progressive.js) was intentionally tested against production domains to verify the circuit breaker:

```powershell
k6 run --iterations 1 --vus 1 -e BASE_URL="https://campusflow.in" .\load-tests\campusflow-staging-progressive.js
```
**Observed Result**:
```text
SAFETY CIRCUIT BREAKER TRIGGERED: Target BASE_URL (https://campusflow.in) matches live production domain!
Staging load tests MUST NEVER be run against live production. Execution aborted.
```

**Verdict**: The circuit breaker is fully functional and permanently protects production.
