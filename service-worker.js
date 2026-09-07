/**
 * Iron Log service worker.
 *
 * Strategy:
 *   - Navigations: network-first, falling back to the cached shell offline, so
 *     a deployment is picked up on the next online load rather than being
 *     pinned to a stale cached page.
 *   - Same-origin assets: stale-while-revalidate, so the app starts instantly
 *     from cache while a fresh copy is fetched for next time.
 *   - Cross-origin requests (fonts, the food API, the barcode module): passed
 *     straight through, never cached. Opaque responses cannot be validated and
 *     would silently poison the cache.
 *
 * Bump CACHE_VERSION on every release: the activate handler deletes every cache
 * that does not match, which is what evicts superseded assets.
 */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `ironlog-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './css/app.css',
  './js/main.js',
  './js/config.js',
  './js/utils.js',
  './js/storage.js',
  './js/state.js',
  './js/dom.js',
  './js/ui.js',
  './js/charts.js',
  './js/coaching.js',
  './js/food-api.js',
  './js/workouts.js',
  './js/nutrition.js',
  './js/progress.js',
  './js/targets.js',
];

/**
 * Caches each URL individually.
 *
 * `cache.addAll` is all-or-nothing: a single 404 rejects the whole install and
 * leaves the app with no offline support at all. Failing per URL means one
 * missing asset costs only that asset.
 *
 * @param {Cache} cache
 * @returns {Promise<void>}
 */
async function precache(cache) {
  await Promise.all(
    PRECACHE_URLS.map(async (url) => {
      try {
        await cache.add(new Request(url, { cache: 'reload' }));
      } catch (error) {
        console.warn(`[sw] could not precache ${url}`, error);
      }
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await precache(cache);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

/**
 * Network-first, with the cached shell as the offline fallback.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put('./index.html', response.clone());
    return response;
  } catch {
    const cached = await caches.match('./index.html');
    return cached ?? Response.error();
  }
}

/**
 * Serves from cache immediately and refreshes the entry in the background.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  const response = cached ?? (await network);
  return response ?? Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Let cross-origin traffic go straight to the network.
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(handleAsset(request));
});
