# Codebase Structure and Trust Boundaries

This document describes the existing production architecture. It is a guide to
finding code, not a mandate to move route handlers or domain logic. The Next.js
App Router paths under `src/app` define the public URL surface and should remain
the source of truth for routes.

## Application map

| Area | Location | Responsibility |
| --- | --- | --- |
| App Router and UI shells | `src/app` | Public and tenant pages, admin pages, layouts, route handlers, server actions, manifest routes, and global styling. |
| Shared and feature UI | `src/components` | Admin screens and tabs, public discovery/feedback UI, tenant context, PWA UI, and reusable controls. |
| Domain/server utilities | `src/lib` | Auth/session checks, tenant resolution and branding, Supabase clients/cache, feedback tokens, billing, analytics/PDF generation, Google integrations, validation, email, and PWA installation helpers. |
| Middleware and shared types | `src/middleware.ts`, `src/types` | Request/session gate and shared database, auth, and tenant types. |
| Database source history | `supabase/migrations`, `supabase/migrations_legacy_bce` | Current platform migration directory and preserved earlier BCE migration history. Keep every migration file and its contents intact. |
| Static assets and worker | `public` | Icons, institution artwork, verification asset, and `sw.js`. |
| Operational scripts | `scripts`, root `test-*.ts`, `scratch` | Verification, maintenance, and historical test scripts. The project has no `tests/` directory; do not relocate scripts without checking callers and CI/deployment use. |
| Docs and external integration source | `docs`, `google-apps-script` | Architecture/phase notes and Google Apps Script source. |

## Route inventory

These paths are implemented by the current App Router tree. Dynamic segments
are shown literally; tenant resolution and route behavior remain in their
existing files.

### Public and tenant pages

- `/`
- `/[tenant]`
- `/[tenant]/feedback`
- `/[tenant]/feedback/[id]`
- `/[tenant]/admin/login`
- `/feedback`
- `/feedback/[id]`
- `/feedback/confirmation`
- `/privacy-policy`
- `/terms-of-service`
- `/offline`

### Admin and institution pages

- `/admin/login`, `/admin/signup`, `/admin/pending`
- `/admin/forgot-password`, `/admin/reset-password`
- `/admin/dashboard`
- `/admin/dashboard/forms`, `/admin/dashboard/forms/create`, `/admin/dashboard/forms/[id]`
- `/admin/dashboard/results`, `/admin/dashboard/results/[id]`, `/admin/dashboard/results/[id]/responses`
- `/admin/institutions`

### API and framework routes

- `/auth/callback`
- `/api/admin/forms/stream-generate`, `/api/admin/forms/[id]/sync`
- `/api/admin/request-access`, `/api/admin/verify-session`
- `/api/admin/results/export-pdf`, `/api/admin/results/[id]/pdf`, `/api/admin/results/[id]/responses/[responseId]/pdf`
- `/api/auth/google`, `/api/auth/google/callback`
- `/api/feedback/response/download`
- `/api/manifest`, `/api/manifest/[slug]`
- `/api/pwa/installations`
- `/api/tenant/[slug]/icon`
- `/manifest.webmanifest`

## Request, data, and trust boundaries

- `src/middleware.ts` handles the existing request/session gate. Page-level and
  server-action authorization remains in `src/lib/auth` and the corresponding
  route/action code. Middleware is not a substitute for those checks.
- `src/lib/tenant/resolver.ts` resolves the institution from the request; tenant
  branding is in `src/lib/tenant/branding.ts`. Tenant context/UI is in
  `src/components/tenant`. Preserve the resolved `activeCollegeId` flow and do
  not accept a browser-supplied college ID as authorization.
- `src/lib/supabase/client.ts`, `server.ts`, and `admin.ts` have distinct browser,
  request/server, and privileged responsibilities. Keep the service-role client
  server-only and do not consolidate these clients.
- Database RLS and SQL functions are part of the authorization boundary. SQL
  migrations are historical source artifacts; application refactors must not
  rewrite or reorder them.
- Feedback page/action code stores submissions and response metadata. Analytics
  calculations and normalizers live in `src/lib/analytics`; PDF/report
  generation is in `src/lib/analytics/pdf-generator.ts` and API route handlers.
  Keep calculation and output logic stable when changing organization.
- Google OAuth, Forms, Sheets, linking, and synchronization helpers live in
  `src/lib/google`, with callbacks and API entry points in `src/app/api`.
- PWA UI is in `src/components/pwa`, installation support in `src/lib/pwa`,
  request endpoints under `src/app/api/pwa` and `src/app/api/manifest`, and the
  service worker in `public/sw.js`. Tenant metadata/icon behavior is tenant
  aware and must remain so.

## Migration inventory status

No migration files were changed as part of this organization pass. The active
directory contains the platform/tenant, academic, feedback, Google, billing,
audit/RLS, institution, duplicate-response, and PWA migration files. The
`migrations_legacy_bce` directory contains the earlier BCE foundation, Google,
student portal, multi-faculty/response, billing, trial, and token migrations.
The earlier set is retained as legacy/potentially required history; this
repository inventory alone cannot prove which files were applied to each
database, so none are classified as confirmed unused.

The active directory currently has two files beginning with
`20260923000001` (`institution_logos_and_rls` and
`super_admin_promotion_system`). Their identical migration version prefix may
need reconciliation against the deployed Supabase migration ledger before any
future migration operation. This documentation does not rename, reorder, or
change either file.

## Organization guidance

The current incremental boundaries are already discoverable: keep URL-bound
pages, route handlers, and server actions under `src/app`; shared or feature UI
under `src/components`; and reusable domain/server utilities under `src/lib`.
When a future change moves code, first search the whole repository, update only
imports, preserve `use client` / server-only boundaries, and run the project
checks. Larger server-action modules are intentionally left in place because
splitting them can affect server-action exports, authorization ordering, and
tenant scoping.
