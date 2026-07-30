const CACHE_NAME = 'dealivra-static-assets-v3';
const RETIRED_CACHE_NAMES = new Set([
  'dealivra-shell-v2',
  'dealivra-shell-v1',
  'dealsafe-shell-v1',
]);
const IMMUTABLE_ASSET_PATH = /^\/assets\/[A-Za-z0-9_.-]+\.(?:css|js|woff|woff2)$/;

function isImmutableAsset(request) {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  return url.origin === self.location.origin
    && url.search === ''
    && IMMUTABLE_ASSET_PATH.test(url.pathname);
}

function isCacheableAssetResponse(response) {
  if (!response || !response.ok || response.status !== 200) return false;
  if (response.type !== 'basic' && response.type !== 'default') return false;

  const contentType = response.headers.get('content-type') || '';
  return /(?:javascript|text\/css|font\/|application\/font)/i.test(contentType);
}

async function respondWithImmutableAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheableAssetResponse(response)) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter(name => name !== CACHE_NAME && (
        RETIRED_CACHE_NAMES.has(name)
        || name.startsWith('dealivra-')
        || name.startsWith('dealsafe-')
      ))
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  // Navigations, API/Auth calls, media, evidence, and every non-versioned
  // resource stay on the network path. Private responses are never cached.
  if (!isImmutableAsset(event.request)) return;
  event.respondWith(respondWithImmutableAsset(event.request));
});
