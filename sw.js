const CACHE = 'brandhouse-v1';
const ASSETS = [
  '/Brand_House/scan.html',
  '/Brand_House/logo.png',
  '/Brand_House/manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap'
];

// ინსტალაცია — ყველა ფაილი cache-ში
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// გააქტიურება — ძველი cache-ის წაშლა
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// მოთხოვნა — cache პირველი, შემდეგ ქსელი
self.addEventListener('fetch', e => {
  // Apps Script მოთხოვნები — ყოველთვის ქსელიდან
  if (e.request.url.includes('script.google.com')) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // HTML და static ფაილები cache-ში შეინახე
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
