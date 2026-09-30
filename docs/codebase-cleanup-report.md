# Codebase Cleanup Report

## A. Files changed

- Added the pre-cleanup audit and dependency inventory: [`codebase-cleanup-audit.md`](./codebase-cleanup-audit.md).
- Added this final cleanup report.
- The prior untracked [`codebase-structure.md`](./architecture/codebase-structure.md) from the preceding organization task was preserved.

## B. Files moved

None. App Router paths, import paths, middleware placement, and server/client boundaries remain unchanged.

## C. Files deleted

Four isolated components with no repository references were removed:

- `src/components/public/HeroSection.tsx`
- `src/components/ui/BranchSelect.tsx`
- `src/components/ui/InteractiveButton.tsx`
- `src/components/ui/LoadingButton.tsx`

The full repository search found only each component's own declaration; no route, static/dynamic import, barrel, script, test, or documentation usage exists. `git diff --stat` reports 528 deleted lines across these files. No imports required updates.

## D. Database objects intentionally NOT changed

No tables, views, RPCs/functions, triggers, RLS policies, indexes, columns, migrations, or production rows were changed. The current schema objects and all 13 files under `supabase/migrations_legacy_bce/` remain in place.

## E. Confirmed duplicate code

None confirmed. Similar names or roles did not establish behaviorally identical implementations. The two unreferenced button components were deleted independently, not merged.

## F. Suspected duplicate code

- `eslint.config.mjs` and `.eslintrc.json` coexist. `package.json` runs `next lint`; configuration consumers outside this invocation (editor/CI) were not fully established. Both remain.
- The three shared date hooks and multiple Google/analytics helpers have separate call sites. No safe duplicate utility/type consolidation was proven.
- `src/app/api/feedback/response/download/route.ts:103` references `college_admins`, but the live public schema and current migrations contain no such object. Current auth code uses `college_memberships` (`src/lib/auth/admin-auth.ts:101`). This is a reported API/auth-path mismatch, not a cleanup edit.

## G. Suspected redundant indexes

Migration definitions suggest possible overlap between explicit indexes and constraint-generated unique indexes, including:

- College slug/code indexes versus unique columns.
- Platform-admin user index versus unique `user_id`.
- College-membership college index versus unique `(college_id,user_id)`.
- College-only academic/branch/subject indexes versus unique indexes beginning with `college_id`; semester index versus the matching unique key.
- Feedback form college index versus unique `(college_id,slug)`.
- Billing plan slug index versus unique `slug`.
- College billing/Google connection indexes versus unique `college_id`.

These are **suspected only**. Live `pg_indexes`, `pg_constraint`, `pg_stat_user_indexes`, FK access patterns, and query plans were unavailable. No index was removed or modified. See `codebase-cleanup-audit.md` for migration references.

## H. Migration issues

- Two distinct current migrations share version prefix `20260923000001`: `institution_logos_and_rls.sql` and `super_admin_promotion_system.sql`. Both were preserved. The linked CLI migration listing returned 401, so deployed-ledger status remains unknown. Reconcile each environment's migration ledger before a new migration operation. Preserve existing files; use a new unique forward migration only if reconciliation requires forward SQL, and validate in staging.
- The deployed response-record schema lacks `is_excluded`, `excluded_at`, `excluded_by`, `exclusion_reason`, `included_at`, and `included_by`. A read-only `limit=0` API request returned PostgreSQL `42703` for `is_excluded`. The current migration `20260927000001_response_exclusion_and_duplicates.sql` declares those columns, indexes, and an update policy; app code reads/writes them. Verify live migration state and feature behavior separately. No schema change was attempted.
- Historical `CREATE OR REPLACE VIEW public_feedback_forms` statements define successive versions of one view; they do not establish duplicate database tables.

## I. Legacy objects requiring live verification

Do not declare these removable from a repository-only search. They were not exposed by the live public REST schema, but that does not establish whether physical relations or retained data exist:

- `admin_requests` → current code uses `college_admin_requests`.
- `admin_billing_accounts` → current code uses `college_billing_accounts`.
- `payment_requests` → current code uses `college_payment_requests`.
- `admin_trial_entitlements` → current code uses `college_trial_entitlements`.
- `google_oauth_tokens` → current server-side Google code uses `college_google_connections`.

Current same-name tenant-aware tables, the `admins` compatibility view, shared `billing_plans` / `payment_settings`, and all legacy migration files are kept. No object is classified as safe to drop.

## J. Tenant-security verification

- Static review confirms the current tenant-aware schema includes `college_id` on institution-owned academic, feedback, response, billing, audit, and PWA records. Current migration RLS declarations are in `20260922000006_phase6_audit_and_rls.sql`; Google connection grants/RLS and PWA RLS are declared in their respective current migrations.
- Source paths continue to use the existing session resolver, `activeCollegeId`, server-side action checks, and tenant-scoped query predicates. No auth, tenant, RLS, or application query code was modified.
- No BCE-vs-GEC runtime authorization test was run: available scripts create/update/delete records in the configured Supabase project and some delete Drive files. Run those only against a staging database with disposable accounts.
- Live RLS policies were not inspected from PostgreSQL catalogs; migration declarations are not proof of deployed policy state.

## K. Build/test results

- `npm run lint`: **passed**, no ESLint warnings/errors. Next emitted its existing notice that `next lint` is deprecated in a future Next.js version.
- `npx tsc --noEmit`: **passed**.
- `npm run build`: **passed** after the sandbox startup attempt failed with `spawn EPERM`; the elevated retry compiled, type-checked, generated all 14 static pages, collected traces, and listed the App Router endpoints.
- Existing integration scripts were **not run** against production. There is no `npm test` script and no `tests/` directory. Multiple scripts are destructive or externally mutating (`test-billing-matrix.ts`, `test-feedback-form-experience.ts`, `verify-admin-requests-lifecycle.ts`, `verify-phase5-billing.mjs`, `verify-real-db-rls.ts`, Google Forms/Sheets E2E scripts). `test-e2e-response-management.ts` reads response records and logs a sample; it was not run to avoid printing production response data. `test-submission-metadata-visibility.ts` writes PDF artifacts into the repository and was not run without a configured test runner/output isolation. Run the full suite after providing a staging project and disposable Google account/resources.

## L. Remaining recommended cleanup

1. Obtain catalog access and compare deployed `pg_indexes`, `pg_constraint`, `pg_stat_user_indexes`, RLS policies, triggers, and the Supabase migration ledger. Do not remove indexes until exact redundancy and workload safety are established.
2. Reconcile the duplicate `20260923000001` migration version with every deployment ledger before future migration pushes; preserve both files.
3. Verify the missing response-exclusion columns against migration history and restore intended feature state only through the approved database migration process.
4. Review the `college_admins` lookup in the response download route as a separate authorization issue; do not guess a replacement in a folder cleanup.
5. Add a test runner and separate unit tests from live integration tests; direct live tests should require explicit staging configuration and avoid deleting non-test user data or Drive files.
6. Keep the current incremental `app` / `components` / `lib` / `types` organization. No broad folder migration has a demonstrated low-risk benefit in this pass.
