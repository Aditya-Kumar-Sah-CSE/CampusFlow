// CampusFlow — Campus Management Platform
// Progressive Web App (PWA) & Trusted Web Activity (TWA) Service Worker (v6)
// STRICT Privacy, Security, & Tenant Isolation Guard:
// - NEVER caches /admin/, /auth/, private student/faculty records, or OAuth tokens.
// - Online-only operations (event registration, payments, feedback submissions, Google Sheets sync) require active connectivity.
// - Public event & program schedules are cached for offline access with stale-while-revalidate / network-first.

const CACHE_VERSION = 'v6';
const SHELL_CACHE = `campusflow-shell-${CACHE_VERSION}`;
const TENANT_CACHE = `campusflow-tenant-${CACHE_VERSION}`;
const PUBLIC_DATA_CACHE = `campusflow-public-data-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline';

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png',
  '/apple-touch-icon.png',
  '/manifest.webmanifest',
];

// 1. INSTALL LIFECYCLE
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
          console.warn(`[CampusFlow PWA] Precache skipped for ${asset}:`, err);
        }
      }
    }).then(() => self.skipWaiting())
  );
});

// 2. ACTIVATE LIFECYCLE: Safe cache versioning & migration
self.addEventListener('activate', (event) => {
  const currentCaches = [SHELL_CACHE, TENANT_CACHE, PUBLIC_DATA_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !currentCaches.includes(name))
          .map((obsoleteName) => {
            console.info(`[CampusFlow PWA] Purging obsolete cache: ${obsoleteName}`);
            return caches.delete(obsoleteName);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. TENANT SWITCH PURGE LISTENER (Multi-tenant security)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FMS_TENANT_SWITCH') {
    event.waitUntil(
      Promise.all([
        caches.delete(TENANT_CACHE),
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

// 4. FETCH EVENT LISTENER
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // A. Only process GET requests. Mutations (POST, PUT, DELETE, PATCH) pass directly to network.
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // B. Cross-origin requests (Supabase, Google APIs, Google Forms, Sheets, CDNs)
  // NEVER intercept or cache them.
  if (url.origin !== self.location.origin) {
    return;
  }

  const pathname = url.pathname;

  // C. Security Exclusion: NEVER cache admin console, internal APIs, or auth endpoints.
  if (
    pathname.startsWith('/admin') ||
    (pathname.startsWith('/api') && !pathname.startsWith('/api/manifest') && !pathname.startsWith('/api/tenant')) ||
    pathname.startsWith('/auth') ||
    pathname.includes('/response/') ||
    pathname.includes('token')
  ) {
    return;
  }

  // D. Online-Only Operations: Registration, team management, and invitations
  // These routes MUST fail-closed when offline to prevent fake or duplicate submissions.
  const isOnlineOnlyRoute =
    pathname.includes('/register') ||
    pathname.includes('/my-registrations') ||
    pathname.includes('/invitations');

  if (isOnlineOnlyRoute) {
    if (request.mode === 'navigate') {
      event.respondWith(
        fetch(request).catch(() => {
          return caches.match(OFFLINE_URL).then((offlineRes) => {
            return offlineRes || getOfflineFallbackResponse();
          });
        })
      );
    }
    return;
  }

  // E. Tenant-Specific Assets (/api/manifest/..., /api/tenant/..., /manifest.webmanifest?college=...)
  const isTenantManifest =
    pathname.startsWith('/api/manifest/') ||
    (pathname === '/manifest.webmanifest' && (url.searchParams.has('college') || url.searchParams.has('tenant'))) ||
    (pathname === '/api/manifest' && (url.searchParams.has('college') || url.searchParams.has('tenant')));

  const isTenantIcon = pathname.startsWith('/api/tenant/');

  if (isTenantManifest || isTenantIcon) {
    event.respondWith(
      caches.open(TENANT_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
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

  // Generic root manifest without college query parameter
  if (pathname === '/manifest.webmanifest' || pathname === '/api/manifest') {
    event.respondWith(
      caches.open(SHELL_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
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

  // F. Static immutable Next.js assets (_next/static, public static fonts, images, icons)
  if (
    pathname.startsWith('/_next/static/') ||
    pathname.match(/\.(png|jpe?g|svg|ico|woff2?|webp|webmanifest|json)$/i)
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

  // G. Public Event & Program Information (Network-First with Public Cache Fallback)
  // Supports offline access to previously visited event overviews, schedules, guidelines, and programs.
  const isPublicEventRoute =
    pathname === '/events' ||
    pathname.startsWith('/events/') ||
    pathname.includes('/events') ||
    pathname === '/' ||
    pathname === '/terms-of-service' ||
    pathname === '/privacy-policy';

  if (isPublicEventRoute) {
    // Both HTML navigation and Next.js RSC client transitions
    const isNavigation = request.mode === 'navigate';
    const isRsc = url.searchParams.has('_rsc') || request.headers.get('RSC') === '1';

    if (isNavigation || isRsc) {
      event.respondWith(
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const resClone = networkResponse.clone();
              caches.open(PUBLIC_DATA_CACHE).then((cache) => {
                cache.put(request, resClone);
              });
            }
            return networkResponse;
          })
          .catch(async () => {
            // Offline fallback: check public event cache first
            const cachedPublicData = await caches.match(request);
            if (cachedPublicData) {
              return cachedPublicData;
            }

            // If navigating to an un-cached page, show offline page
            if (isNavigation) {
              const offlinePage = await caches.match(OFFLINE_URL);
              return offlinePage || getOfflineFallbackResponse();
            }

            return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
          })
      );
      return;
    }
  }

  // H. Generic navigation requests fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(OFFLINE_URL).then((offlineResponse) => {
          return offlineResponse || getOfflineFallbackResponse();
        });
      })
    );
  }
});

function getOfflineFallbackResponse() {
  return new Response(
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline — CampusFlow</title><style>body{font-family:system-ui,-apple-system,sans-serif;background:#0B192C;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;padding:24px;text-align:center;box-sizing:border-box;}h1{font-size:24px;margin-bottom:8px;}p{color:#94a3b8;font-size:14px;line-height:1.5;margin-bottom:20px;max-width:400px;}a{display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:12px;font-weight:600;font-size:14px;}</style></head><body><div><h1>You are offline</h1><p>You can still view previously loaded CampusFlow information. Registration, payments, and live actions require an active internet connection.</p><a href="/">Return to Home</a></div></body></html>',
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  );
}
