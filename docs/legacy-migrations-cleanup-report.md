# Legacy BCE Migrations Cleanup Report

**Report Date:** 2026-09-30  
**Target Directory:** `supabase/migrations_legacy_bce`  
**Active Production Directory:** `supabase/migrations` (Untouched)  

---

## 1. Summary of Actions

Following an exhaustive audit of all 13 migration files in `supabase/migrations_legacy_bce` against the application codebase, current migrations, and live Supabase production schema, the retention status has been finalized:

- **Files Deleted:** `0`
- **Files Kept (KEEP):** `10`
- **Files Requiring Verification (REQUIRES VERIFICATION):** `3`
- **Definitively Safe to Delete:** `0`

---

## 2. Inventory Breakdown

### Files Kept (10 files)
1. `20260913_phase1_foundation.sql`: Foundational schema migration creating core academic, admin, and feedback tables (`academic_years`, `branches`, `semesters`, `faculties`, `subjects`, `faculty_subject_assignments`, `feedback_forms`, `audit_logs`). All are physically present and actively queried in production.
2. `20260913_phase2_google_integration.sql`: Established Google Forms & Sheets columns on `feedback_forms` (`google_form_edit_url`, `google_sheet_url`, `response_destination_type`, `response_count`, `last_synced_at`, etc.) and the `public_feedback_forms` view.
3. `20260913_phase3_student_portal.sql`: Configured student portal access rules allowing viewing of both `PUBLISHED` and `CLOSED` feedback forms, cascading lookup indexes, and view updates.
4. `20260914_multi_faculty_semester_forms.sql`: Established multi-faculty semester forms; altered `feedback_forms` constraints and created `feedback_form_items` table and indexes.
5. `20260914_performance_indexes.sql`: Established specialized performance indexes across academic entities, feedback forms, and audit logs.
6. `20260914_response_records_and_ratings.sql`: Created `feedback_response_records` table, unique constraints, and sync indexes.
7. `20260916_billing_and_payments.sql`: Created `payment_settings` table (currently active in production with live payment configuration) and historical billing tables.
8. `20260916_billing_plans.sql`: Created `billing_plans` table and seeded base plans (`FREE`, `MONTHLY`, `YEARLY`).
9. `20260917_payment_proofs_storage.sql`: Created the physical `'payment-proofs'` Supabase Storage bucket and storage RLS policies.
10. `20260917_plan_feature_matrix.sql`: Seeded authoritative feature matrix for billing plans (`BASIC`, `FULL_ACCESS`, `FREE`, `MONTHLY`, `YEARLY`).

### Files Requiring Verification (3 files)
1. `20260915_fix_admin_requests_rls.sql`: Resolved PostgreSQL runtime error 25006 on admin evaluation; added unique constraint `admins_email_key` and index on `admin_requests`. Retained because the physical `admin_requests` table exists in the live database.
2. `20260917_trial_entitlements.sql`: Created `admin_trial_entitlements` table and unique active trial constraint. Retained because `admin_trial_entitlements` physically exists in the live database.
3. `20260920_google_oauth_tokens.sql`: Created `google_oauth_tokens` table. Retained because the physical table exists in the live database and contains historical BCE credential storage schema.

---

## 3. Database Objects Affected

- **Active tables preserved:** `academic_years`, `branches`, `semesters`, `faculties`, `subjects`, `faculty_subject_assignments`, `feedback_forms`, `feedback_form_items`, `feedback_response_records`, `billing_plans`, `payment_settings`, `audit_logs`, `admins` (view).
- **Physical legacy tables preserved:** `admin_requests`, `admin_billing_accounts`, `payment_requests`, `admin_trial_entitlements`, `google_oauth_tokens`.
- **Storage assets preserved:** `'payment-proofs'` bucket in `storage.buckets`.
- **Database mutations performed:** **ZERO**. No tables, columns, indexes, triggers, functions, views, or RLS policies were modified or dropped.

---

## 4. Production Migrations Confirmation

- **Confirmation:** The current production directory `supabase/migrations/` was **100% UNTOUCHED**.
- No files in `supabase/migrations/` were modified, added, renamed, or deleted.

---

## 5. Verification and Build Results

### TypeScript Type-Checking (`npx tsc --noEmit`)
- **Status:** **PASS** (Exit Code: `0`)
- **Output:** Clean, zero TypeScript compilation errors.

### ESLint Validation (`npm run lint`)
- **Status:** **PASS** (Exit Code: `0`)
- **Output:** `✔ No ESLint warnings or errors`

### Production Build (`npm run build`)
- **Status:** **PASS** (Exit Code: `0`)
- **Output:** Next.js 15.5.25 production build succeeded in 30.8s. All 14 static and dynamic routes compiled and optimized without errors.
