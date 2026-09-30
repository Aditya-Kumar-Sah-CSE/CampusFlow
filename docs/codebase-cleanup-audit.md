# Codebase and Database Cleanup Audit

**Audit state:** Pre-cleanup inventory and reference scan. The only planned source cleanup is removal of four UI component files with no references anywhere in the repository. No application or database behavior is being refactored.

**Safety boundary:** No database object, migration, RLS rule, production row, environment value, API contract, route, calculation, PDF, PWA behavior, or authorization path is to be modified by this audit. Keep the legacy migration directory intact.

## Repository inventory and dependency map

| Layer | Current location | Dependencies / notes |
| --- | --- | --- |
| App Router | `src/app` | Root/public pages, `[tenant]` pages, admin and institution pages, API handlers, route-level layouts, server actions, manifest routes, policies and terms. URL structure remains route source of truth. |
| Middleware | `src/middleware.ts` | Supabase cookie/session refresh and protected admin routing. Depends on the browser-safe Supabase URL/key. Do not relocate or weaken. |
| Admin UI | `src/components/admin` | Forms, results, billing, tabs, admin session/tenant screens. Consumes server-action results and `src/types`. |
| Public/tenant UI | `src/components/public`, `src/components/tenant` | Discovery, feedback, institution selection, tenant provider; uses `src/lib/tenant`, feedback actions, academic data. |
| Shared/PWA UI | `src/components/ui`, `src/components/pwa` | Controls, navigation effects, install prompts, network state; service worker remains `public/sw.js`. |
| Auth and tenant | `src/lib/auth`, `src/lib/tenant` | Admin session/roles, tenant resolver, branding, active college context. `activeCollegeId` and server authorization must remain authoritative. |
| Supabase | `src/lib/supabase` | Separate browser (`client.ts`), cookie server (`server.ts`) and service-role (`admin.ts`) clients; academic cache is tenant-aware. Never merge clients or expose service-role code. |
| Domain services | `src/lib/feedback`, `billing`, `email`, `google`, `analytics`, `pwa`, `validation`, `utils`, `navigation`, `hooks` | Feedback tokens; entitlements/access control; Google OAuth/Forms/Sheets/linking/sync; analytics normalization/calculation/PDF; email, validation, PWA installation, navigation and hooks. |
| Shared types | `src/types` | `database.ts`, `auth.ts`, `tenant.ts`; compatibility type aliases are imported by current UI and must be retained. |
| Migrations | `supabase/migrations` | 11 active-tree SQL files; preserve historical contents and order. |
| Legacy migrations | `supabase/migrations_legacy_bce` | 13 BCE-era SQL files; preserve all. Migration-file presence is not proof a table remains in the live DB. |
| Static/PWA | `public` | College artwork, icons, verification file and service worker. PWA manifest and icon API routes are under `src/app`. |
| Scripts/tests | `scripts`, root `test-*.ts`, `scratch` | Verification and integration scripts. No `tests/` directory and no `npm test` script exist. Several scripts call live Supabase/Google services and insert, update or delete data/files. |
| Configuration/docs | root config files, `README.md`, `docs/architecture`, `google-apps-script` | Next, TypeScript, ESLint, Tailwind, PostCSS, Supabase config, integration script and historical architecture docs. Keep both ESLint config files until tool usage is verified. |

### Route inventory

- Public: `/`, `/feedback`, `/feedback/[id]`, `/feedback/confirmation`, `/privacy-policy`, `/terms-of-service`, `/offline`.
- Tenant: `/[tenant]`, `/[tenant]/feedback`, `/[tenant]/feedback/[id]`, `/[tenant]/admin/login`.
- Admin: `/admin/login`, `/admin/signup`, `/admin/pending`, `/admin/forgot-password`, `/admin/reset-password`, `/admin/dashboard`, `/admin/dashboard/forms`, `/admin/dashboard/forms/create`, `/admin/dashboard/forms/[id]`, `/admin/dashboard/results`, `/admin/dashboard/results/[id]`, `/admin/dashboard/results/[id]/responses`, `/admin/institutions`.
- API/framework: `/auth/callback`, admin forms generation/sync/access/session/results/PDF routes, Google OAuth/callback, feedback response download, manifest routes, PWA installations, tenant icon, `/manifest.webmanifest`.

Route handlers and server actions remain under `src/app`; no route files are being moved.

### Database/application dependency map

The deployed PostgREST schema query exposed 21 table resources and 3 views. Current tables referenced by application code include:

- Tenant/auth: `colleges` (`src/lib/tenant/resolver.ts`, `src/lib/auth/admin-auth.ts`), `platform_admins` (`admin-auth.ts`, `src/app/admin/actions.ts`), `college_memberships` and `college_admin_requests` (`src/app/admin/actions.ts`, `src/app/api/admin/request-access/route.ts`).
- Academic: `academic_years`, `branches`, `semesters`, `faculties`, `subjects`, `faculty_subject_assignments` (`src/app/admin/actions.ts`, dashboard pages, feedback actions, `src/lib/supabase/academic-cache.ts`).
- Feedback: `feedback_forms`, `feedback_form_items`, `feedback_response_records` (`src/app/admin/forms/actions.ts`, `src/app/feedback/actions.ts`, response actions, Google sync and analytics service).
- Google: `college_google_connections` (`src/lib/google/auth.ts`); OAuth, Forms, Sheets and sync modules use it server-side.
- Billing: `billing_plans`, `payment_settings`, `college_billing_accounts`, `college_trial_entitlements`, `college_payment_requests` (`src/app/admin/billing/*`, `src/lib/billing/*`).
- Audit/PWA: `audit_logs` (admin, billing, Google and analytics paths); `pwa_installations` through `record_pwa_installation` and `get_pwa_install_count` RPCs (`src/app/api/pwa/installations/route.ts`, `src/lib/pwa/installations.ts`).

Current views are `admins` (compatibility projection over platform admins and college memberships), `public_feedback_forms` (safe public form projection), and `college_google_status` (Google metadata projection omitting refresh tokens). No direct `.from()` calls to these views were found in `src`; keep them because external consumers and SQL compatibility may exist.

Application RPC calls found include `is_admin`, `is_platform_super_admin`, `record_pwa_installation`, and `get_pwa_install_count`. The public API schema also lists `get_user_college_ids`, `is_college_admin`, super-admin promotion/demotion/sync functions. SQL-defined triggers include super-admin registration and college-mutation enforcement. Live trigger catalog was not available.

### Types, imports, and environment

- Imports use the existing `@/*` alias to `src/*` and route-bound relative imports. No directory move is proposed.
- `AdminRequest`, `AdminTrialEntitlement`, and `PaymentRequest` compatibility types are consumed by current components; they are not dead aliases.
- `.env.local` values were not displayed. Its variable names are Supabase URL/anon/service-role, app URL, super-admin email, and Google OAuth values. `.env.example` additionally documents Apps Script, SMTP, Resend, SendGrid and email-from variables. Code also reads Apps Script, SMTP, Resend, SendGrid and email-from variables. Do not remove or rename environment keys based on one deployment.
- `eslint.config.mjs` and `.eslintrc.json` coexist. The former is ESLint flat config with Next presets and unused-variable warnings; `package.json` invokes `next lint`. Treat the second config as possibly unused, not safe to delete without checking CI/editor invocations.

## Findings and classifications

| Classification | Finding | Evidence / action |
| --- | --- | --- |
| SAFE TO REFACTOR | Four UI component files have no references outside their own definitions across the repository: `src/components/ui/BranchSelect.tsx`, `LoadingButton.tsx`, `InteractiveButton.tsx`, and `src/components/public/HeroSection.tsx`. | Full hidden-file-excluding `rg` search found only declarations in those files; no route, component, script, test, barrel or docs reference exists. Remove these four only. This changes no rendered route because none is imported or auto-routed. |
| KEEP | `SearchableSelect`, `PaginationControl`, other used shared controls, and domain components. | Preserve all referenced components. Similar button names alone do not prove equivalent behavior. |
| KEEP | Analytics calculations, normalizers, reporting/PDF generation, feedback flow, Google integrations, tenant/session/security code, service-worker and tenant branding. | High behavior/security impact; no calculations or client boundaries will be edited. |
| REQUIRED LEGACY | `supabase/migrations_legacy_bce/`, current `admins` compatibility view, legacy type aliases still used by components, and historical architecture notes. | Keep; source history and compatibility consumers are not safe to infer unused. |
| POSSIBLY UNUSED | `.eslintrc.json`; no test folder or test runner; several old verification scripts. | Inspect tool/CI references before removing or changing. No package scripts are declared for the individual scripts. |
| POSSIBLY UNUSED | Components `BranchSelect`, `LoadingButton`, `InteractiveButton`, `HeroSection` before removal. | Verified no repository references; removal is limited to these four isolated files. |
| POSSIBLY UNUSED | No other file/function/type is proven dead by this scan. `use-hydrated` date helpers, analytics helpers, OAuth linking and normalizer files have call sites. | Keep when reference evidence or dynamic behavior is uncertain. |
| REQUIRES LIVE DATABASE VERIFICATION | Actual RLS policies, indexes and definitions, FK catalog, triggers, physical presence of unexposed legacy tables, migration ledger, and index usage. | PostgREST schema provides deployed exposed columns/FK annotations and RPC names, but not `pg_indexes`, `pg_constraint`, `pg_stat_user_indexes`, policies or triggers. Pooler password was unavailable; linked CLI migration listing returned 401. Do not remove database objects. |
| REQUIRES LIVE DATABASE VERIFICATION | `feedback_response_records` does not expose the exclusion columns in the deployed schema. | A service-role `limit=0` query for `is_excluded`, `excluded_at`, `excluded_by`, `exclusion_reason`, `included_at`, `included_by` returned PostgreSQL `42703` (`is_excluded` does not exist). Those columns/policy are in `20260927000001_response_exclusion_and_duplicates.sql` and application code in `src/app/admin/results/responses/actions.ts` / `src/lib/analytics/service.ts` expects them. Verify migration status and feature behavior; do not mutate DB as part of cleanup. |
| REQUIRES LIVE DATABASE VERIFICATION | Legacy-only objects `admin_requests`, `admin_billing_accounts`, `payment_requests`, `admin_trial_entitlements`, `google_oauth_tokens`. | No current application `.from()` references were found, but they were not exposed by the live API. API absence does not prove physical absence or no retained data. Verify catalog, migration ledger and backups before any decommission plan. |
| DO NOT TOUCH | Tables/views/RPCs/functions/triggers/columns/RLS policies/indexes and any production data. | No SQL/DB changes are in scope. |
| DO NOT TOUCH | Two migration filenames share prefix `20260923000001`. | `20260923000001_institution_logos_and_rls.sql` and `20260923000001_super_admin_promotion_system.sql` are distinct behavior. Preserve both. Reconcile deployed migration ledger and environment history before deciding a forward-only strategy; never rename or rewrite an already-applied file. |
| DO NOT TOUCH | Legacy BCE tables that have current tenant-aware versions with the same names (`academic_years`, `branches`, `semesters`, `faculties`, `subjects`, `faculty_subject_assignments`, `feedback_forms`, `feedback_form_items`, `feedback_response_records`, `audit_logs`). | Same logical relation evolved with `college_id`; not duplicate current tables. Keep historical migrations. |

### Database index review

The following are **migration-level redundancy candidates only**. They are not removal recommendations until compared with live `pg_indexes`, `pg_constraint`, `pg_stat_user_indexes`, FK access patterns and actual query plans:

- `idx_colleges_slug` / `idx_colleges_code` alongside unique `slug` / `code` constraints (`20260922000001`, lines 17–42).
- `idx_platform_admins_user` alongside unique `user_id` (`20260922000001`, lines 48–59).
- `idx_memberships_college` alongside unique `(college_id,user_id)` (`20260922000001`, lines 66–78).
- `idx_academic_years_college`, `idx_branches_college`, `idx_subjects_college` alongside unique constraints whose leading key is `college_id`; `idx_semesters_college` matches the unique `(college_id,semester_number)` key (`20260922000002`, lines 13–107).
- `idx_feedback_forms_college` alongside unique `(college_id,slug)` (`20260922000003`, lines 12–51).
- `idx_billing_plans_slug` alongside unique `slug`, `idx_billing_accounts_college` alongside unique `college_id` (`20260922000005`, lines 12–72).
- `idx_google_connections_college` alongside unique `college_id` (`20260922000004`, lines 13–28).

No index is dropped, renamed, or modified. Some composite indexes may serve ordering, filtering or FK workloads that are not captured by migration text alone.

### Duplicate/reference checks

- No exact duplicate current tables were found in the deployed API schema. `admins` is a view in the current migration, not a second current admin table.
- Historical `CREATE OR REPLACE VIEW public_feedback_forms` statements evolve the same view. They are not duplicate tables and remain in the historical tree.
- `LoadingButton` and `InteractiveButton` have overlapping button roles but were not proven behaviorally identical. They are both unreferenced and will be removed as dead files, not merged.
- No duplicate type cleanup is safe: compatibility types have usages. No unused imports were selected for edits; lint will be rerun.
- One source/schema mismatch exists: `src/app/api/feedback/response/download/route.ts:103` queries `college_admins`, which is not in the deployed REST schema or current migrations (current membership code uses `college_memberships`). This auth-path finding is reported only; do not change it in a structural cleanup.

### Tenant/security spot-check

- Current table definitions carry tenant `college_id` on institution-owned academic, form, response, billing, audit and PWA records. Current RLS declarations are in `20260922000006_phase6_audit_and_rls.sql:35-54` and policies follow at lines 64–346. Google connection RLS/grants are in `20260922000004_phase4_google_connections.sql:35-63`; PWA RLS/RPCs are in `20260929000001_pwa_installations.sql:14-47`.
- Server code uses `getAdminSession`, resolved active college, and tenant-scoped query predicates in admin/actions, forms, results and billing paths. No auth or tenant code is changed.
- Runtime cross-tenant/RLS tests were not run because the available scripts create/update/delete live DB rows and some delete Google Drive files. Use a staging project for those tests.

## Test inventory and execution safety

There is no `tests/` directory and `package.json` has no `test` script. Existing verification assets include four root `test-*.ts` files, `scripts/test-*.ts`, `scripts/verify-*.ts`/`.mjs`, and `scratch/test_phase2b_auth.mjs`.

Several are production-mutating integration scripts: examples include `scripts/test-billing-matrix.ts` (updates/deletes billing rows), `scripts/test-feedback-form-experience.ts` (creates forms/sheets and deletes them), `scripts/verify-admin-requests-lifecycle.ts` (creates/deletes auth users and rows), `scripts/verify-phase5-billing.mjs` (updates billing/trial data), and `scripts/verify-real-db-rls.ts` (creates/deletes DB and Google artifacts). They must not be run against production as part of this cleanup. Run these only with explicit staging credentials and disposable test accounts.

## Migration prefix strategy

Preserve both `20260923000001_*` files unchanged. First obtain each environment's Supabase migration ledger and compare actual objects to both SQL files. Then use the supported Supabase migration workflow to reconcile applied/unapplied state without replaying or renaming applied history. If forward SQL is needed, add a new uniquely versioned migration after the ledger is reconciled; it should be narrowly idempotent and must not repeat already-applied schema changes. Validate the plan in staging before production. Do not choose which existing migration to rename based only on filenames.

## Proposed target structure

Keep the existing architecture. App Router routes/actions stay under `src/app`; shared and feature UI stay under `src/components`; reusable domain/server modules stay under `src/lib`; types stay under `src/types`; static/PWA assets stay under `public`; migration history and scripts stay at their current executable paths. Avoid a broad `features/` conversion because current route, action, auth, tenant and client/server boundaries are already functional and tightly coupled.

## Pre-cleanup status

- Worktree initially contained the untracked architecture note `docs/architecture/codebase-structure.md`, created during the preceding organization task; preserve it.
- A checkpoint commit exists at `3150f61` (`checkpoint before codebase cleanup`).
- Current source remains unchanged at this point. The four unreferenced component removals described above are the only planned low-risk code edits.
