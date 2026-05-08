const CACHE = 'brandhouse-v5-20260508-keyboard-fix';
const ASSETS = [
  '/Brand_House/scan.html',
  '/Brand_House/index.html',
  '/Brand_House/logo.png',
  '/Brand_House/manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap'
];

const SCANNER_FIX_INJECTION = `
<script data-bh-scanner-fix="v5">
(function () {
  if (window.__BH_SCANNER_FIX_V5__) return;
  window.__BH_SCANNER_FIX_V5__ = true;

  let scannerBuffer = '';
  let scannerTimer = null;
  let deferredPrompt = null;

  function injectStyles() {
    if (document.getElementById('bhScannerFixStyles')) return;
    const style = document.createElement('style');
    style.id = 'bhScannerFixStyles';
    style.textContent = [
      '.qty-editor{display:grid!important;grid-template-columns:58px minmax(80px,1fr) 58px!important;align-items:stretch!important;overflow:hidden!important}',
      '.qty-editor .qty-btn{width:58px!important;min-width:58px!important;height:54px!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:28px!important;line-height:1!important;opacity:1!important;visibility:visible!important;color:#1A1A18!important}',
      '.qty-editor .qty-input{width:100%!important;min-width:0!important;height:54px!important;display:block!important;text-align:center!important}',
      '#barcodeInput.bh-no-keyboard{caret-color:transparent!important}',
      '.bh-keyboard-hint{margin-top:6px;font-size:10px;color:#7A7870}',
      '#bhInstallBox{position:fixed;left:14px;right:14px;bottom:82px;z-index:2000;background:#1B4332;color:#fff;border-radius:16px;padding:13px 14px;box-shadow:0 12px 30px rgba(0,0,0,.28);font-family:inherit}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function isScannerScreenActive() {
    const screen = document.getElementById('screenScan');
    return screen && screen.classList.contains('active');
  }

  function applyNoKeyboardMode() {
    injectStyles();
    const input = document.getElementById('barcodeInput');
    if (!input) return;

    input.classList.add('bh-no-keyboard');
    input.setAttribute('readonly', 'readonly');
    input.setAttribute('inputmode', 'none');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    input.placeholder = 'დაასკანერე ბარკოდი';

    input.addEventListener('focus', function () {
      if (isScannerScreenActive()) setTimeout(function () { try { input.blur(); } catch (e) {} }, 0);
    });

    const wrap = input.closest('.scan-input-wrap');
    if (wrap && !document.getElementById('bhKeyboardHint')) {
      const hint = document.createElement('div');
      hint.id = 'bhKeyboardHint';
      hint.className = 'bh-keyboard-hint';
      hint.textContent = 'კლავიატურა გამორთულია — დაასკანერე აპარატით.';
      wrap.appendChild(hint);
    }
  }

  function dispatchBarcodeToExistingApp(code) {
    const input = document.getElementById('barcodeInput');
    if (!input || !code) return;

    input.readOnly = false;
    input.value = code;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    setTimeout(function () {
      input.value = '';
      input.readOnly = true;
      try { input.blur(); } catch (e) {}
    }, 40);
  }

  function setupScannerKeyboardCatcher() {
    if (window.__BH_HARDWARE_SCANNER_CATCHER__) return;
    window.__BH_HARDWARE_SCANNER_CATCHER__ = true;

    document.addEventListener('keydown', function (e) {
      const active = document.activeElement;
      const modalOpen = document.getElementById('detailModal') && document.getElementById('detailModal').classList.contains('show');
      const isQtyInput = active && active.classList && active.classList.contains('qty-input');
      const isLoginInput = active && (active.id === 'empNameInput' || active.id === 'opIdInput');

      if (!isScannerScreenActive() || modalOpen || isQtyInput || isLoginInput) return;

      if (e.key === 'Enter') {
        if (scannerBuffer.trim()) {
          e.preventDefault();
          e.stopPropagation();
          const code = scannerBuffer.trim();
          scannerBuffer = '';
          dispatchBarcodeToExistingApp(code);
        }
        return;
      }

      if (e.key === 'Backspace') {
        scannerBuffer = scannerBuffer.slice(0, -1);
        return;
      }

      if (e.key && e.key.length === 1) {
        scannerBuffer += e.key;
        clearTimeout(scannerTimer);
        scannerTimer = setTimeout(function () { scannerBuffer = ''; }, 600);
      }
    }, true);
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function setupInstallPrompt() {
    if (isStandalone() || document.getElementById('bhInstallBox')) return;

    const box = document.createElement('div');
    box.id = 'bhInstallBox';
    box.innerHTML = '<div style="font-weight:600;font-size:13px;margin-bottom:3px;">📲 აპად დაყენება</div><div style="font-size:11px;opacity:.82;line-height:1.35;">დააყენე ტელეფონში, რომ ბრაუზერის გარეშე გაიხსნას.</div><div style="display:flex;gap:8px;margin-top:9px;"><button id="bhInstallBtn" style="flex:1;border:0;background:#fff;color:#1B4332;border-radius:10px;padding:10px;font-weight:700;font-family:inherit;">დაყენება</button><button id="bhInstallClose" style="width:42px;border:1px solid rgba(255,255,255,.3);background:transparent;color:#fff;border-radius:10px;font-weight:700;">✕</button></div><div id="bhInstallHelp" style="display:none;font-size:11px;opacity:.85;margin-top:8px;line-height:1.35;">თუ ღილაკმა არ იმუშავა: Chrome ⋮ → Add to Home screen / Install app.</div>';
    document.body.appendChild(box);

    const btn = document.getElementById('bhInstallBtn');
    const close = document.getElementById('bhInstallClose');
    const help = document.getElementById('bhInstallHelp');

    close.addEventListener('click', function () { box.remove(); });
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

    setTimeout(function () { if (!deferredPrompt && help) help.style.display = 'block'; }, 2500);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });

  window.addEventListener('appinstalled', function () {
    const box = document.getElementById('bhInstallBox');
    if (box) box.remove();
  });

  function setup() {
    injectStyles();
    applyNoKeyboardMode();
    setupScannerKeyboardCatcher();
    setupInstallPrompt();
    setInterval(applyNoKeyboardMode, 1000);
    document.addEventListener('click', function () { setTimeout(applyNoKeyboardMode, 50); }, true);
    window.addEventListener('focus', applyNoKeyboardMode);
    window.addEventListener('pageshow', applyNoKeyboardMode);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
<\/script>`;

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

function injectFix(html) {
  if (!html || html.includes('data-bh-scanner-fix="v5"')) return html;
  const updated = html.replace('href="manifest.json"', 'href="manifest.json?v=5"');
  if (updated.includes('</body>')) return updated.replace('</body>', SCANNER_FIX_INJECTION + '\n</body>');
  return updated + SCANNER_FIX_INJECTION;
}

async function responseWithFix(response, request) {
  if (!response || !response.ok || !isScanPage(request)) return response;
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;

  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/html; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(injectFix(html), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const freshOriginal = await fetch(request, { cache: 'no-store' });
    const fresh = await responseWithFix(freshOriginal.clone(), request);
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
      const finalResponse = await responseWithFix(response.clone(), request);
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
