const CACHE = 'brandhouse-v4-20260508-install';
const APP_SCOPE = '/Brand_House/';
const ASSETS = [
  '/Brand_House/scan.html',
  '/Brand_House/index.html',
  '/Brand_House/logo.png',
  '/Brand_House/manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap'
];

const AUTOSAVE_INJECTION = `
<script data-bh-autosave="v4">
(function () {
  if (window.__BH_STRONG_AUTOSAVE__) return;
  window.__BH_STRONG_AUTOSAVE__ = true;

  const SESSION_PREFIX = 'bh_session_';
  const BACKUP_KEY = 'bh_session_backup';
  const EMP_KEY = 'bh_employee';
  const OP_KEY = 'bh_last_op';
  let saveTimer = null;
  let badgeReady = false;

  function safeEvalGetter(name, fallback) {
    try {
      const value = (0, eval)(name);
      return value === undefined ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function safeEvalSetter(name, value) {
    try {
      window.__bh_restore_value = value;
      (0, eval)(name + ' = window.__bh_restore_value');
      delete window.__bh_restore_value;
      return true;
    } catch (e) {
      delete window.__bh_restore_value;
      return false;
    }
  }

  function getCurrentOp() {
    const fromState = safeEvalGetter('operationId', null);
    const fromStorage = localStorage.getItem(OP_KEY);
    const fromInput = document.getElementById('opIdInput') ? document.getElementById('opIdInput').value.trim() : '';
    return String(fromState || fromStorage || fromInput || '').trim();
  }

  function getCurrentEmployee() {
    const fromState = safeEvalGetter('employeeName', null);
    const fromStorage = localStorage.getItem(EMP_KEY);
    const fromInput = document.getElementById('empNameInput') ? document.getElementById('empNameInput').value.trim() : '';
    return String(fromState || fromStorage || fromInput || '').trim();
  }

  function getItemsCount(itemsObj) {
    try {
      return Object.values(itemsObj || {}).reduce((sum, item) => sum + Number(item.scannedQty || 0), 0);
    } catch (e) {
      return 0;
    }
  }

  function ensureBadge() {
    if (badgeReady || document.getElementById('bhAutosaveBadge')) return;
    const header = document.querySelector('.scan-header');
    if (!header) return;

    const badge = document.createElement('span');
    badge.id = 'bhAutosaveBadge';
    badge.textContent = 'შენახულია';
    badge.style.cssText = 'font-size:10px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.20);padding:3px 7px;border-radius:999px;margin-left:6px;white-space:nowrap;opacity:.85;';
    header.appendChild(badge);
    badgeReady = true;
  }

  function setBadge(text) {
    ensureBadge();
    const badge = document.getElementById('bhAutosaveBadge');
    if (badge) badge.textContent = text;
  }

  function strongSave(reason) {
    try {
      const op = getCurrentOp();
      if (!op) return false;

      const emp = getCurrentEmployee();
      const itemsObj = safeEvalGetter('items', {});
      const log = safeEvalGetter('scanLog', []);
      const unknown = safeEvalGetter('unknownBarcodes', {});
      const filter = safeEvalGetter('currentFilter', 'all');

      const payload = {
        operationId: op,
        employeeName: emp,
        items: itemsObj || {},
        scanLog: Array.isArray(log) ? log : [],
        unknownBarcodes: unknown || {},
        currentFilter: filter || 'all',
        scannedCount: getItemsCount(itemsObj),
        savedAt: Date.now(),
        savedAtText: new Date().toLocaleString('ka-GE'),
        reason: reason || 'auto'
      };

      localStorage.setItem(SESSION_PREFIX + op, JSON.stringify(payload));
      localStorage.setItem(BACKUP_KEY, JSON.stringify(payload));
      localStorage.setItem(OP_KEY, op);
      if (emp) localStorage.setItem(EMP_KEY, emp);

      setBadge('შენახულია ' + payload.scannedCount);
      return true;
    } catch (e) {
      setBadge('შენახვის შეცდომა');
      return false;
    }
  }

  function scheduleSave(reason, delay) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      strongSave(reason);
    }, delay == null ? 120 : delay);
  }

  function restoreFromSavedSession() {
    try {
      const op = getCurrentOp();
      const saved = op ? localStorage.getItem(SESSION_PREFIX + op) : localStorage.getItem(BACKUP_KEY);
      if (!saved) return false;

      const data = JSON.parse(saved);
      if (!data || !data.items || !Object.keys(data.items).length) return false;

      const currentItems = safeEvalGetter('items', {});
      const currentCount = currentItems && Object.keys(currentItems).length ? getItemsCount(currentItems) : 0;
      const savedCount = getItemsCount(data.items);

      if (savedCount >= currentCount) {
        safeEvalSetter('items', data.items || {});
        safeEvalSetter('scanLog', data.scanLog || []);
        safeEvalSetter('unknownBarcodes', data.unknownBarcodes || {});
        safeEvalSetter('currentFilter', data.currentFilter || 'all');
        if (data.operationId) safeEvalSetter('operationId', String(data.operationId));
        if (data.employeeName) safeEvalSetter('employeeName', String(data.employeeName));

        if (typeof updateCounts === 'function') updateCounts();
        if (typeof renderItems === 'function') renderItems();
        if (typeof startScan === 'function' && document.getElementById('screenWelcome') && document.getElementById('screenWelcome').classList.contains('active')) {
          startScan(data.employeeName || getCurrentEmployee(), data.operationId || op);
        }
        setBadge('აღდგა ' + savedCount);
        return true;
      }
    } catch (e) {}
    return false;
  }

  function wrapAction(name) {
    const original = window[name];
    if (typeof original !== 'function' || original.__bhWrapped) return;
    const wrapped = function () {
      const result = original.apply(this, arguments);
      Promise.resolve(result).catch(function () {}).then(function () {
        scheduleSave(name, 50);
      });
      return result;
    };
    wrapped.__bhWrapped = true;
    window[name] = wrapped;
  }

  function setupAutosave() {
    ensureBadge();
    restoreFromSavedSession();

    ['loadOperation','startScan','clearInput','setFilter','saveQty','resetQty','closeDetail','showSummary','closeSummary','sendResults','renderItems','updateCounts','addScan','processScan','handleBarcode','scanBarcode'].forEach(wrapAction);

    document.addEventListener('input', function () { scheduleSave('input', 150); }, true);
    document.addEventListener('change', function () { scheduleSave('change', 100); }, true);
    document.addEventListener('keyup', function () { scheduleSave('keyup', 80); }, true);
    document.addEventListener('click', function () { scheduleSave('click', 180); }, true);

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') strongSave('hidden');
      else {
        restoreFromSavedSession();
        scheduleSave('visible', 200);
      }
    });

    window.addEventListener('pagehide', function () { strongSave('pagehide'); });
    window.addEventListener('beforeunload', function () { strongSave('beforeunload'); });
    window.addEventListener('blur', function () { strongSave('blur'); });
    window.addEventListener('focus', function () {
      restoreFromSavedSession();
      scheduleSave('focus', 200);
    });
    window.addEventListener('pageshow', function () {
      restoreFromSavedSession();
      scheduleSave('pageshow', 200);
    });

    setInterval(function () { strongSave('interval'); }, 1000);
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function setupInstallPrompt() {
    if (isStandalone()) return;
    if (document.getElementById('bhInstallBox')) return;

    let deferredPrompt = null;

    const box = document.createElement('div');
    box.id = 'bhInstallBox';
    box.innerHTML = '<div style="font-weight:600;font-size:13px;margin-bottom:3px;">📲 აპად დაყენება</div><div style="font-size:11px;opacity:.82;line-height:1.35;">დააყენე ტელეფონში, რომ ბრაუზერის გარეშე გაიხსნას.</div><div style="display:flex;gap:8px;margin-top:9px;"><button id="bhInstallBtn" style="flex:1;border:0;background:#fff;color:#1B4332;border-radius:10px;padding:10px;font-weight:700;font-family:inherit;">დაყენება</button><button id="bhInstallClose" style="width:42px;border:1px solid rgba(255,255,255,.3);background:transparent;color:#fff;border-radius:10px;font-weight:700;">✕</button></div><div id="bhInstallHelp" style="display:none;font-size:11px;opacity:.85;margin-top:8px;line-height:1.35;">თუ ღილაკმა არ იმუშავა: Chrome ⋮ → Add to Home screen / Install app.</div>';
    box.style.cssText = 'position:fixed;left:14px;right:14px;bottom:82px;z-index:2000;background:#1B4332;color:#fff;border-radius:16px;padding:13px 14px;box-shadow:0 12px 30px rgba(0,0,0,.28);font-family:inherit;';

    document.body.appendChild(box);

    const btn = document.getElementById('bhInstallBtn');
    const close = document.getElementById('bhInstallClose');
    const help = document.getElementById('bhInstallHelp');

    close.addEventListener('click', function () {
      box.remove();
      localStorage.setItem('bh_install_closed', Date.now().toString());
    });

    btn.addEventListener('click', async function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        try { await deferredPrompt.userChoice; } catch (e) {}
        deferredPrompt = null;
        box.remove();
      } else {
        help.style.display = 'block';
      }
    });

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      btn.textContent = 'დაყენება';
    });

    window.addEventListener('appinstalled', function () {
      localStorage.setItem('bh_app_installed', '1');
      box.remove();
    });

    setTimeout(function () {
      if (!deferredPrompt && help) help.style.display = 'block';
    }, 2500);
  }

  function setup() {
    setupAutosave();
    setupInstallPrompt();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
<\/script>`;

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

function isScanPage(request) {
  const url = new URL(request.url);
  return url.pathname.endsWith('/Brand_House/scan.html') || url.pathname.endsWith('/scan.html');
}

function injectAutosave(html) {
  if (!html || html.includes('data-bh-autosave="v4"')) return html;
  const withManifestVersion = html.replace('href="manifest.json"', 'href="manifest.json?v=4"');
  if (withManifestVersion.includes('</body>')) return withManifestVersion.replace('</body>', AUTOSAVE_INJECTION + '\n</body>');
  return withManifestVersion + AUTOSAVE_INJECTION;
}

async function responseWithAutosave(response, request) {
  if (!response || !response.ok || !isScanPage(request)) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(injectAutosave(html), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const freshOriginal = await fetch(request, { cache: 'no-store' });
    const fresh = await responseWithAutosave(freshOriginal.clone(), request);
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
      const finalResponse = await responseWithAutosave(response.clone(), request);
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

  // HTML გვერდებზე ყოველთვის ჯერ ქსელს ვამოწმებთ — ეს აგვარებს Chrome-ში ძველი ვერსიის დარჩენას.
  if (isHtmlRequest(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // static ფაილები სწრაფად იხსნება, მაგრამ ფონზე ახლდება.
  event.respondWith(staleWhileRevalidate(request));
});
