// Brand House scanner local enhancements — quiet helper only.
(function () {
  'use strict';

  if (window.__BH_LOCAL_ENHANCEMENTS__) return;
  window.__BH_LOCAL_ENHANCEMENTS__ = true;

  const SESSION_PREFIX = 'bh_session_';
  const BACKUP_KEY = 'bh_session_backup';
  const OP_KEY = 'bh_last_op';
  const UI_KEY = 'bh_local_ui_settings';
  const KEEPALIVE_KEY = 'bh_last_alive_session';

  let lastPromotedBarcode = '';
  let deferredPrompt = null;

  writeJson(UI_KEY, {
    sound: false,
    vibration: false,
    manualOpen: false,
    paused: false
  });

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function getOpId() {
    const input = document.getElementById('opIdInput');
    const header = document.getElementById('headerOpId');
    const fromHeader = header ? header.textContent.replace('#', '').trim() : '';
    return String(fromHeader || localStorage.getItem(OP_KEY) || (input ? input.value : '') || '').trim();
  }

  function getSessionKey() {
    const op = getOpId();
    return op ? SESSION_PREFIX + op : '';
  }

  function getCurrentSessionText() {
    const key = getSessionKey();
    return key ? (localStorage.getItem(key) || '') : '';
  }

  function getCurrentSession() {
    const text = getCurrentSessionText();
    try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
  }

  function forceSaveSession() {
    try {
      if (typeof window.saveSession === 'function') window.saveSession();
    } catch (e) {}

    const key = getSessionKey();
    if (!key) return;

    const text = localStorage.getItem(key);
    if (!text) return;

    try {
      const data = JSON.parse(text);
      data.savedAt = new Date().toISOString();
      data.operationId = data.operationId || getOpId();
      data.employeeName = data.employeeName || localStorage.getItem('bh_employee') || '';
      const nextText = JSON.stringify(data);
      localStorage.setItem(key, nextText);
      localStorage.setItem(BACKUP_KEY, nextText);
      localStorage.setItem(KEEPALIVE_KEY, JSON.stringify({ key: key, op: getOpId(), ts: Date.now() }));
    } catch (e) {
      localStorage.setItem(BACKUP_KEY, text);
      localStorage.setItem(KEEPALIVE_KEY, JSON.stringify({ key: key, op: getOpId(), ts: Date.now() }));
    }
  }

  function restoreBackupIfNeeded() {
    const op = getOpId();
    const key = getSessionKey();
    if (!op || !key || localStorage.getItem(key)) return;

    try {
      const alive = JSON.parse(localStorage.getItem(KEEPALIVE_KEY) || '{}');
      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup && alive && String(alive.op) === String(op)) {
        localStorage.setItem(key, backup);
      }
    } catch (e) {}
  }

  function injectStyles() {
    if (document.getElementById('bhLocalStyles')) return;
    const style = document.createElement('style');
    style.id = 'bhLocalStyles';
    style.textContent = `
      .qty-editor{display:grid!important;grid-template-columns:58px minmax(82px,1fr) 58px!important;align-items:stretch!important;overflow:hidden!important}
      .qty-editor .qty-btn{width:58px!important;min-width:58px!important;height:54px!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:28px!important;line-height:1!important;opacity:1!important;visibility:visible!important;color:#1A1A18!important}
      .qty-editor .qty-input{width:100%!important;min-width:0!important;height:54px!important;display:block!important;text-align:center!important}
      .item-card.bh-promoted{box-shadow:0 0 0 2px rgba(27,67,50,.18);animation:bhPromoteFlash .55s ease}
      @keyframes bhPromoteFlash{0%{transform:scale(1.015);background:#D8F3DC}100%{transform:scale(1);}}
      #bhInstallBox{position:fixed;left:14px;right:14px;bottom:82px;z-index:2000;background:#1B4332;color:#fff;border-radius:16px;padding:13px 14px;box-shadow:0 12px 30px rgba(0,0,0,.28);font-family:inherit}
    `;
    document.head.appendChild(style);
  }

  function removeExtraControls() {
    ['bhTools', 'bhStatus', 'bhManualBox', 'bhPauseCover', 'bhLastStrip'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }

  function restoreKeyboardMode() {
    const input = document.getElementById('barcodeInput');
    if (!input) return;
    input.classList.remove('bh-no-keyboard');
    input.removeAttribute('readonly');
    input.setAttribute('inputmode', 'text');
    input.placeholder = 'სკანერი ან ხელით';
    const hint = document.getElementById('bhKeyboardHint');
    if (hint) hint.remove();
  }

  function getLastBarcode(session) {
    if (!session || !Array.isArray(session.scanLog) || !session.scanLog.length) return '';
    const last = session.scanLog[session.scanLog.length - 1];
    return String(last.barcode || last.code || last.value || '').trim();
  }

  function normalize(value) {
    return String(value || '').replace(/\s+/g, '').trim();
  }

  function getCardBarcode(card) {
    const barcodeEl = card ? card.querySelector('.item-barcode') : null;
    return barcodeEl ? normalize(barcodeEl.textContent) : '';
  }

  function promoteBarcode(barcode, smooth) {
    const list = document.getElementById('itemsList');
    if (!list || !barcode) return;
    const target = normalize(barcode);
    const cards = Array.from(list.querySelectorAll('.item-card'));
    const card = cards.find(function (item) { return getCardBarcode(item) === target; });
    if (!card) return;

    const label = card.previousElementSibling;
    if (label && label.classList && label.classList.contains('section-label')) {
      list.prepend(label);
      label.after(card);
    } else {
      list.prepend(card);
    }

    card.classList.remove('bh-promoted');
    void card.offsetWidth;
    card.classList.add('bh-promoted');
    setTimeout(function () { card.classList.remove('bh-promoted'); }, 700);

    if (smooth !== false) {
      try { list.scrollTo({ top: 0, behavior: 'smooth' }); }
      catch (e) { list.scrollTop = 0; }
    }
  }

  function setupCardPromoteOnClick() {
    if (document.__bhPromoteClickAttached) return;
    document.__bhPromoteClickAttached = true;
    document.addEventListener('click', function (event) {
      const card = event.target.closest ? event.target.closest('.item-card') : null;
      if (!card) return;
      const barcode = getCardBarcode(card);
      if (barcode) setTimeout(function () { promoteBarcode(barcode, true); }, 40);
      forceSaveSession();
    }, true);
  }

  function watchLastScan() {
    restoreBackupIfNeeded();
    forceSaveSession();

    const session = getCurrentSession();
    const lastBarcode = getLastBarcode(session);
    if (lastBarcode && lastBarcode !== lastPromotedBarcode) {
      lastPromotedBarcode = lastBarcode;
      setTimeout(function () { promoteBarcode(lastBarcode, true); }, 120);
    }
  }

  function setupPersistenceGuards() {
    if (window.__BH_PERSISTENCE_GUARDS__) return;
    window.__BH_PERSISTENCE_GUARDS__ = true;

    ['pagehide', 'beforeunload', 'blur'].forEach(function (eventName) {
      window.addEventListener(eventName, forceSaveSession, { capture: true });
    });

    document.addEventListener('visibilitychange', function () {
      forceSaveSession();
      if (document.visibilityState === 'visible') restoreBackupIfNeeded();
    }, true);

    document.addEventListener('input', function () { setTimeout(forceSaveSession, 30); }, true);
    document.addEventListener('keydown', function () { setTimeout(forceSaveSession, 80); }, true);
  }

  function setupInstallPrompt() {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) return;
    if (document.getElementById('bhInstallBox')) return;

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
    removeExtraControls();
    restoreBackupIfNeeded();
    restoreKeyboardMode();
    setupCardPromoteOnClick();
    setupPersistenceGuards();
    setupInstallPrompt();
    watchLastScan();

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        removeExtraControls();
        restoreKeyboardMode();
        watchLastScan();
      }
    });
    window.addEventListener('focus', function () { removeExtraControls(); restoreKeyboardMode(); watchLastScan(); });
    window.addEventListener('pageshow', function () { removeExtraControls(); restoreKeyboardMode(); watchLastScan(); });
    document.addEventListener('click', function () { setTimeout(function () { removeExtraControls(); restoreKeyboardMode(); watchLastScan(); }, 60); }, true);

    setInterval(function () {
      removeExtraControls();
      restoreKeyboardMode();
      watchLastScan();
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
