const CACHE = 'brandhouse-v7-20260508-admin-polish';
const ASSETS = [
  '/Brand_House/scan.html',
  '/Brand_House/index.html',
  '/Brand_House/logo.png',
  '/Brand_House/manifest.json',
  '/Brand_House/bh-local-enhancements.js',
  '/Brand_House/bh-admin-enhancements.js',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap'
];

const LOCAL_SCRIPT_TAG = '<script src="/Brand_House/bh-local-enhancements.js?v=7" data-bh-local-enhancements="v7"><\/script>';
const ADMIN_SCRIPT_TAG = '<script src="/Brand_House/bh-admin-enhancements.js?v=7" data-bh-admin-enhancements="v7"><\/script>';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .catch(() => null)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function shouldBypassCache(request) {
  const url = new URL(request.url);
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) return true;
  if (request.method !== 'GET') return true;
  return false;
}

function isHtmlRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}

function isScanPage(request) {
  const url = new URL(request.url);
  return url.pathname.endsWith('/Brand_House/scan.html') || url.pathname.endsWith('/scan.html');
}

function isAdminPage(request) {
  const url = new URL(request.url);
  return url.pathname.endsWith('/Brand_House/') || url.pathname.endsWith('/Brand_House/index.html') || url.pathname.endsWith('/index.html');
}

function injectEnhancements(html, request) {
  if (!html) return html;
  let updated = html.replace('href="manifest.json"', 'href="manifest.json?v=7"');
  let tag = '';

  if (isScanPage(request) && !updated.includes('data-bh-local-enhancements="v7"')) tag += LOCAL_SCRIPT_TAG + '\n';
  if (isAdminPage(request) && !updated.includes('data-bh-admin-enhancements="v7"')) tag += ADMIN_SCRIPT_TAG + '\n';

  if (!tag) return updated;
  if (updated.includes('</body>')) return updated.replace('</body>', tag + '</body>');
  return updated + tag;
}

async function responseWithEnhancements(response, request) {
  if (!response || !response.ok || (!isScanPage(request) && !isAdminPage(request))) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(injectEnhancements(html, request), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const freshOriginal = await fetch(request, { cache: 'no-store' });
    const fresh = await responseWithEnhancements(freshOriginal.clone(), request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const update = fetch(request, { cache: 'no-store' })
    .then(async response => {
      const finalResponse = await responseWithEnhancements(response.clone(), request);
      if (finalResponse && finalResponse.ok) cache.put(request, finalResponse.clone());
      return finalResponse;
    })
    .catch(() => null);

  return cached || update;
}

self.addEventListener('fetch', event => {
  const request = event.request;

  if (shouldBypassCache(request)) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  if (isHtmlRequest(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
