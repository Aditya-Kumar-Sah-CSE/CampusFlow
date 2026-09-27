# Multi-Tenant PWA & Mobile Isolation Architecture

## Overview
The Institutional Feedback Management System (FMS) is engineered to deliver a native-grade Progressive Web App (PWA) and responsive mobile experience for multiple independent colleges (e.g., **BCE Bhagalpur** and **GEC Gaya**) served from a single application codebase and platform deployment.

This document details the multi-tenant PWA identity architecture, service worker cache partitioning, dynamic manifest and icon pipeline, security constraints, and mobile responsive layout foundations.

---

## 1. Browser Installation Identity & Origin Constraints

### The Single Origin vs. Subdomain Browser Boundary
A core requirement of multi-tenant PWA design is ensuring institutions have distinct app identities on student and administrator homescreens.

#### W3C Web App Manifest Specification & Chromium 96+
Chromium-based browsers (Google Chrome, Microsoft Edge, Brave, Samsung Internet on Android, Windows, macOS, and Linux) resolve web application identity using the `id` member in the Web App Manifest (W3C Manifest spec §2.1):
```json
{
  "id": "/bce-bgp/",
  "scope": "/bce-bgp/",
  "start_url": "/bce-bgp"
}
```
and for GEC-GAYA:
```json
{
  "id": "/gec-gaya/",
  "scope": "/gec-gaya/",
  "start_url": "/gec-gaya"
}
```
Because the `id` and `scope` members are strictly partitioned by college slug, Chromium allows a user to install **both** "BCE-BGP Feedback" and "GEC-GAYA Feedback" simultaneously as standalone, distinct applications from the same root origin.

#### iOS Safari (WebKit) Homescreen Limitations
iOS Safari / WebKit does not honor the `id` member for origin partitioning:
- Adding to Home Screen on iOS uses the origin (`window.location.origin`) to partition `localStorage`, `IndexedDB`, and service worker caches.
- If two colleges share the exact same root origin (e.g. `feedback.domain.com/bce-bgp` and `feedback.domain.com/gec-gaya`), Safari treats them under the same origin storage sandbox.

#### Production Origin Strategy (Path-Slug + Subdomain Support)
To guarantee strict origin-level sandboxing in production across all operating systems and browsers, the architecture supports two deployment topologies:

1. **Path-Scoped Multi-Tenant (Default Unified Deployment):**
   - Routes: `https://domain.com/bce-bgp` vs `https://domain.com/gec-gaya`
   - Dynamically generated manifests: `/api/manifest/bce-bgp` vs `/api/manifest/gec-gaya`
   - Partitioned by W3C `id` and `scope`.
2. **Subdomain-Isolated Multi-Tenant (Full Origin Partitioning):**
   - Routes: `https://bce.feedback.edu` vs `https://gec-gaya.feedback.edu`
   - Complete origin-level sandboxing of storage, cookies, caches, and iOS WebKit application slots.

---

## 2. Dynamic PWA Metadata & Head Configuration

Next.js 15 App Router dynamic metadata and viewport generation are decoupled to guarantee accurate runtime values:

### Dynamic Manifest Resolution
- Every college route (`/[tenant]/layout.tsx`) dynamically registers its specific manifest:
  ```typescript
  manifest: `/manifest.webmanifest?college=${tenant.slug}`
  ```
- The route `/manifest.webmanifest` and `/api/manifest/[slug]` return dynamically tailored JSON:
  - `name`: `${collegeName} Feedback` (e.g. "Bhagalpur College of Engineering Feedback")
  - `short_name`: `${shortName} Feedback` (e.g. "BCE-BGP Feedback")
  - `theme_color` & `background_color`: institutional palette (`#0B192C` for BCE, `#1a5276` for GEC)
  - `icons`: Dynamic PNG and SVG icon suite generated per college

### Dynamic Viewport & Theme Color
Under Next.js App Router rules, `themeColor` is exported via `generateViewport()`:
```typescript
export async function generateViewport(): Promise<Viewport> {
  const tenant = await resolveTenantOrNotFound(rawSlug);
  return {
    themeColor: tenant.primaryColor || '#0B192C',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    viewportFit: 'cover',
  };
}
```

---

## 3. High-Fidelity Dynamic Icon Pipeline

To satisfy PWA installation criteria without requiring manual graphic design for every college:
1. Dynamic PNG endpoint: `/api/tenant/[slug]/icon?size=192|512|180&maskable=true|false`
2. Uses Next.js built-in `@vercel/og` (`ImageResponse`) to generate rasterized PNGs on the fly.
3. Automatically embeds the approved college logo inside a high-contrast circular badge, or renders institutional typography with college initials.
4. Includes safe-zone padding (10% on all sides) for `maskable` 512x512 icons to ensure Android adaptive icons do not clip institutional emblems.
5. Provides a zero-dependency SVG fallback route (`format=svg`).

---

## 4. Service Worker & Cache Isolation Hygiene

Service worker caching is strictly regulated to prevent cross-college data leaks:

### Partitioned Cache Namespaces
- `fms-feedback-shell-v5`: Application shell scripts, CSS bundles, static platform fonts.
- `fms-tenant-assets-v5`: Tenant-scoped logos, icons, and college manifest files.

### Critical Cache Policies
1. **Never Cache Authenticated Responses:** Admin queries, student submissions, and analytics APIs use `network-only` and are never stored in service worker caches.
2. **Never Cache Global Manifests:** Generic `/manifest.webmanifest` or `/api/manifest` requests without an explicit `?college=` parameter bypass cache entirely, ensuring Super Admin switching never serves a stale manifest.
3. **Tenant Switch Invalidation:** When a Super Admin switches colleges:
   - The UI broadcasts an `FMS_TENANT_SWITCH` postMessage to `navigator.serviceWorker`.
   - The service worker purges `fms-tenant-assets-v5` and all tenant-tagged entries.
   - The browser window reloads with a cleared slate.

---

## 5. Security & Authorization Boundary

- **Never Trust Client-Supplied College IDs:** The client PWA manifest or slug is treated strictly as public UI metadata.
- **Server-Side Authorized College Resolver:** All authenticated database actions (Supabase RLS, `getAdminSession()`) verify institutional authorization directly from the server-side session and cookie vault.
- College admins cannot access or view another institution's data regardless of the URL slug or manifest requested.

---

## 6. Mobile Responsive Design Standards

Audited across standard viewports (320px, 375px, 390px, 430px, 768px, and desktop):
1. **Zero Horizontal Page Overflow:** Base containers enforce `max-w-full overflow-x-hidden min-w-0`.
2. **Responsive Data Displays:** Complex tables with 6+ columns (Academic Structure, Student Responses, Results Analytics, Audit Logs) feature:
   - Dedicated mobile card views (`md:hidden`) with stacked information.
   - Controlled horizontal scrolling containers (`hidden md:block overflow-x-auto` or `min-w-[500px..650px]`) that prevent table crushing.
3. **Form & Modal Viewports:** All administrative modal dialogs use `max-h-[90vh] overflow-y-auto` with flex layouts so confirmation and action buttons remain reachable.
4. **Touch Ergonomics:** All buttons maintain a minimum tap target of 44x44px or padding `px-3.5 py-2` on touchscreens.
