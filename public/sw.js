// FMS Faculty Feedback Portal — Tenant-Isolated Progressive Web App Service Worker (v5)
// STRICT Cache Isolation: Partitions static bundles from tenant-specific assets.
// Prevents cross-college branding and manifest leaks.
// NEVER caches /admin/, /api/ (except tenant-specific manifest/icon), /auth/, or student responses.

const SHELL_CACHE = 'fms-feedback-shell-v5';
const TENANT_CACHE = 'fms-tenant-assets-v5';
const OFFLINE_URL = '/offline';

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      for (const asset of PRECACHE_ASSETS) {
        try {
          const res = await fetch(asset, { cache: 'no-cache' });
          if (res && res.status === 200) {
            await cache.put(asset, res);
          }
        } catch (err) {
          console.warn(`[PWA SW] Precache skipped for ${asset}:`, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== SHELL_CACHE && name !== TENANT_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Comprehensive Tenant Switch Cache Purge Listener
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FMS_TENANT_SWITCH') {
    event.waitUntil(
      Promise.all([
        // 1. Wipe the entire tenant-specific cache partition
        caches.delete(TENANT_CACHE),
        // 2. Clear any lingering tenant manifest/icon URLs from the shell cache
        caches.open(SHELL_CACHE).then((cache) => {
          return cache.keys().then((keys) => {
            return Promise.all(
              keys
                .filter((req) => {
                  const u = new URL(req.url);
                  return (
                    u.pathname.startsWith('/api/manifest') ||
                    u.pathname.startsWith('/api/tenant') ||
                    u.pathname.endsWith('.webmanifest') ||
                    u.search.includes('college=') ||
                    u.search.includes('tenant=')
                  );
                })
                .map((req) => cache.delete(req))
            );
          });
        }),
      ]).then(() => {
        if (event.source && 'postMessage' in event.source) {
          event.source.postMessage({ type: 'FMS_TENANT_SWITCH_COMPLETE' });
        }
      })
    );
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Only process GET requests. Mutations (POST, PUT, DELETE, PATCH) pass directly.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 2. Cross-origin requests (Supabase, Google APIs, Google Forms, Sheets, CDNs)
  // NEVER intercept or cache them.
  if (url.origin !== self.location.origin) {
    return;
  }

  const pathname = url.pathname;

  // 3. Security Exclusion: NEVER cache admin console, internal APIs, or auth endpoints.
  // Note: Explicit tenant manifests and icons are exempted below with strict tenant isolation
  if (
    pathname.startsWith('/admin') ||
    (pathname.startsWith('/api') && !pathname.startsWith('/api/manifest') && !pathname.startsWith('/api/tenant')) ||
    pathname.startsWith('/auth') ||
    pathname.includes('/response/') ||
    pathname.includes('token')
  ) {
    return;
  }

  // 4. Tenant-Specific Assets (/api/manifest/..., /api/tenant/..., /manifest.webmanifest?college=...)
  const isTenantManifest =
    pathname.startsWith('/api/manifest/') ||
    (pathname === '/manifest.webmanifest' && (url.searchParams.has('college') || url.searchParams.has('tenant'))) ||
    (pathname === '/api/manifest' && (url.searchParams.has('college') || url.searchParams.has('tenant')));

  const isTenantIcon = pathname.startsWith('/api/tenant/');

  if (isTenantManifest || isTenantIcon) {
    event.respondWith(
      caches.open(TENANT_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          // Stale-While-Revalidate scoped strictly to TENANT_CACHE
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Generic root manifest without college query parameter should NOT be cached with SWR
  // to avoid cross-tenant poisoning when Super Admin switches institutions.
  if (pathname === '/manifest.webmanifest' || pathname === '/api/manifest') {
    event.respondWith(fetch(request));
    return;
  }

  // 5. Static immutable Next.js assets (_next/static, public static fonts, images)
  if (
    pathname.startsWith('/_next/static/') ||
    pathname.match(/\.(png|jpe?g|svg|ico|woff2?|webp)$/i)
  ) {
    event.respondWith(
      caches.open(SHELL_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            fetch(request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
            }).catch(() => {});
            return cachedResponse;
          }

          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // 6. Navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(OFFLINE_URL).then((offlineResponse) => {
          return (
            offlineResponse ||
            new Response(
              '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline - Feedback Portal</title><style>body{font-family:system-ui,sans-serif;background:#0B192C;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:20px;text-align:center;}a{color:#F59E0B;}</style></head><body><div><h2>You are currently offline</h2><p>Please reconnect to the internet to access live feedback forms and portal records.</p><p><a href="/">Retry Connection</a></p></div></body></html>',
              {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
              }
            )
          );
        });
      })
    );
  }
});
