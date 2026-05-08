const CACHE = 'brandhouse-v2-20260508';
const APP_SCOPE = '/Brand_House/';
const ASSETS = [
  '/Brand_House/scan.html',
  '/Brand_House/index.html',
  '/Brand_House/logo.png',
  '/Brand_House/manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap'
];

// ახალი ვერსიის დაყენებისას ძველს აღარ ვაცდით.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' }))))
      .catch(() => null)
      .then(() => self.skipWaiting())
  );
});

// ყველა ძველი cache იშლება, რომ Chrome-ში ძველი საიტი აღარ დარჩეს.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function shouldBypassCache(request) {
  const url = new URL(request.url);

  // Google Apps Script მონაცემები ყოველთვის ახალი უნდა წამოვიდეს.
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) return true;

  // POST/PUT/DELETE და სხვა მოქმედებები არასდროს cache-ში.
  if (request.method !== 'GET') return true;

  return false;
}

function isHtmlRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
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
    .then(response => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
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

  // HTML გვერდებზე ყოველთვის ჯერ ქსელს ვამოწმებთ — ეს აგვარებს Chrome-ში ძველი ვერსიის დარჩენას.
  if (isHtmlRequest(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // static ფაილები სწრაფად იხსნება, მაგრამ ფონზე ახლდება.
  event.respondWith(staleWhileRevalidate(request));
});
