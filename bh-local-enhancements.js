// Brand House scanner local enhancements — offline comfort without sound/keyboard blocking.
(function () {
  'use strict';

  if (window.__BH_LOCAL_ENHANCEMENTS__) return;
  window.__BH_LOCAL_ENHANCEMENTS__ = true;

  const SESSION_PREFIX = 'bh_session_';
  const BACKUP_KEY = 'bh_session_backup';
  const OP_KEY = 'bh_last_op';
  const UI_KEY = 'bh_local_ui_settings';
  const MAX_UNDO = 20;

  let previousSessionText = '';
  let undoStack = [];
  let lastCount = -1;
  let lastPromotedBarcode = '';
  let deferredPrompt = null;

  const settings = readJson(UI_KEY, {
    manualOpen: false,
    paused: false
  });

  // Sound/vibration is intentionally disabled.
  settings.sound = false;
  settings.vibration = false;
  saveUi();

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

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
    return op ? SESSION_PREFIX + op : BACKUP_KEY;
  }

  function getCurrentSessionText() {
    return localStorage.getItem(getSessionKey()) || localStorage.getItem(BACKUP_KEY) || '';
  }

  function getCurrentSession() {
    const text = getCurrentSessionText();
    try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
  }

  function getCountFromPage() {
    const el = document.getElementById('scanCount');
    const n = el ? Number(String(el.textContent || '').replace(/[^0-9.-]/g, '')) : 0;
    return isNaN(n) ? 0 : n;
  }

  function saveUi() {
    writeJson(UI_KEY, settings);
  }

  function injectStyles() {
    if (document.getElementById('bhLocalStyles')) return;
    const style = document.createElement('style');
    style.id = 'bhLocalStyles';
    style.textContent = `
      .qty-editor{display:grid!important;grid-template-columns:58px minmax(82px,1fr) 58px!important;align-items:stretch!important;overflow:hidden!important}
      .qty-editor .qty-btn{width:58px!important;min-width:58px!important;height:54px!important;display:flex!important;align-items:center!important;justify-content:center!important;font-size:28px!important;line-height:1!important;opacity:1!important;visibility:visible!important;color:#1A1A18!important}
      .qty-editor .qty-input{width:100%!important;min-width:0!important;height:54px!important;display:block!important;text-align:center!important}
      .bh-tools{background:#fff;border-bottom:1px solid #E4E2DC;padding:8px 10px;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;position:relative;z-index:30}
      .bh-tool-btn{border:1px solid #E4E2DC;background:#F7F6F2;color:#1A1A18;border-radius:10px;padding:8px 4px;font-size:11px;font-family:inherit;font-weight:600;line-height:1.15;min-height:38px}
      .bh-tool-btn.active{background:#1B4332;color:#fff;border-color:#1B4332}
      .bh-status{background:#F7F6F2;border-bottom:1px solid #E4E2DC;padding:6px 12px;font-size:11px;color:#7A7870;display:flex;justify-content:space-between;gap:8px;align-items:center}
      .bh-status b{color:#1B4332;font-weight:700}
      .bh-manual-box{display:none;background:#fff;border-bottom:1px solid #E4E2DC;padding:10px;gap:8px}
      .bh-manual-box.show{display:flex}
      .bh-manual-input{flex:1;border:1.5px solid #E4E2DC;border-radius:10px;padding:11px 12px;font-size:15px;font-family:'DM Mono',monospace;outline:none}
      .bh-manual-send{border:0;background:#1B4332;color:#fff;border-radius:10px;padding:0 14px;font-family:inherit;font-weight:700}
      .bh-pause-cover{display:none;position:fixed;inset:0;background:rgba(27,67,50,.96);color:#fff;z-index:3000;align-items:center;justify-content:center;text-align:center;padding:24px}
      .bh-pause-cover.show{display:flex}
      .bh-pause-card{max-width:330px;width:100%}
      .bh-pause-card h2{font-size:22px;margin-bottom:8px}
      .bh-pause-card p{font-size:13px;opacity:.86;margin-bottom:18px;line-height:1.45}
      .bh-continue-btn{width:100%;border:0;background:#fff;color:#1B4332;border-radius:14px;padding:15px;font-family:inherit;font-weight:800;font-size:15px}
      .item-card.bh-promoted{box-shadow:0 0 0 2px rgba(27,67,50,.18);animation:bhPromoteFlash .55s ease}
      @keyframes bhPromoteFlash{0%{transform:scale(1.015);background:#D8F3DC}100%{transform:scale(1);}}
      #bhInstallBox{position:fixed;left:14px;right:14px;bottom:82px;z-index:2000;background:#1B4332;color:#fff;border-radius:16px;padding:13px 14px;box-shadow:0 12px 30px rgba(0,0,0,.28);font-family:inherit}
    `;
    document.head.appendChild(style);
  }

  function buildUi() {
    if (!document.getElementById('screenScan') || document.getElementById('bhTools')) return;
    const filterBar = document.querySelector('.filter-bar');
    if (!filterBar) return;

    const tools = document.createElement('div');
    tools.id = 'bhTools';
    tools.className = 'bh-tools';
    tools.innerHTML = `
      <button class="bh-tool-btn" id="bhUndoBtn">↩ ბოლო</button>
      <button class="bh-tool-btn" id="bhManualBtn">⌨ ხელით</button>
      <button class="bh-tool-btn" id="bhPauseBtn">⏸ პაუზა</button>
    `;

    const status = document.createElement('div');
    status.id = 'bhStatus';
    status.className = 'bh-status';
    status.innerHTML = '<span>ტელეფონში შენახვა</span><b id="bhStatusText">მზადაა</b>';

    const manual = document.createElement('div');
    manual.id = 'bhManualBox';
    manual.className = 'bh-manual-box';
    manual.innerHTML = '<input id="bhManualInput" class="bh-manual-input" placeholder="ბარკოდი ხელით" inputmode="text"><button id="bhManualSend" class="bh-manual-send">დამატება</button>';

    filterBar.parentNode.insertBefore(tools, filterBar.nextSibling);
    filterBar.parentNode.insertBefore(status, tools.nextSibling);
    filterBar.parentNode.insertBefore(manual, status.nextSibling);

    const pause = document.createElement('div');
    pause.id = 'bhPauseCover';
    pause.className = 'bh-pause-cover';
    pause.innerHTML = '<div class="bh-pause-card"><h2>პაუზაა</h2><p>ყველაფერი შენახულია ტელეფონში. შეგიძლია ეკრანი ჩაკეტო და მერე გააგრძელო.</p><button id="bhContinueBtn" class="bh-continue-btn">გაგრძელება</button></div>';
    document.body.appendChild(pause);

    document.getElementById('bhUndoBtn').addEventListener('click', undoLast);
    document.getElementById('bhManualBtn').addEventListener('click', toggleManual);
    document.getElementById('bhPauseBtn').addEventListener('click', pauseWork);
    document.getElementById('bhContinueBtn').addEventListener('click', continueWork);
    document.getElementById('bhManualSend').addEventListener('click', submitManual);
    document.getElementById('bhManualInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submitManual();
    });

    syncUi();
  }

  function syncUi() {
    const manualBtn = document.getElementById('bhManualBtn');
    const manualBox = document.getElementById('bhManualBox');
    const pauseCover = document.getElementById('bhPauseCover');
    const undoBtn = document.getElementById('bhUndoBtn');

    if (manualBtn) manualBtn.classList.toggle('active', settings.manualOpen);
    if (manualBox) manualBox.classList.toggle('show', settings.manualOpen);
    if (pauseCover) pauseCover.classList.toggle('show', settings.paused);
    if (undoBtn) {
      undoBtn.disabled = undoStack.length === 0;
      undoBtn.style.opacity = undoStack.length ? '1' : '.45';
    }
  }

  function updateStatus(text, good) {
    buildUi();
    const el = document.getElementById('bhStatusText');
    if (!el) return;
    el.textContent = text;
    el.style.color = good === false ? '#C1121F' : '#1B4332';
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

  function toggleManual() {
    settings.manualOpen = !settings.manualOpen;
    saveUi();
    syncUi();
    const input = document.getElementById('bhManualInput');
    if (settings.manualOpen && input) setTimeout(function () { input.focus(); }, 50);
  }

  function submitManual() {
    const manual = document.getElementById('bhManualInput');
    const scan = document.getElementById('barcodeInput');
    if (!manual || !scan) return;
    const code = manual.value.trim();
    if (!code) return;
    manual.value = '';
    pushCurrentSessionToUndo();
    scan.removeAttribute('readonly');
    scan.value = code;
    scan.dispatchEvent(new Event('input', { bubbles: true }));
    scan.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true }));
    scan.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true }));
    setTimeout(function () {
      scan.value = '';
      manual.focus();
    }, 40);
  }

  function pauseWork() {
    settings.paused = true;
    saveUi();
    pushCurrentSessionToUndo(false);
    updateStatus('პაუზა — შენახულია', true);
    syncUi();
  }

  function continueWork() {
    settings.paused = false;
    saveUi();
    updateStatus('გაგრძელდა', true);
    syncUi();
  }

  function pushCurrentSessionToUndo(showButton) {
    const text = getCurrentSessionText();
    if (!text || text === previousSessionText) return;
    previousSessionText = text;
    undoStack.push(text);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    if (showButton !== false) syncUi();
  }

  function undoLast() {
    const text = undoStack.pop();
    if (!text) {
      updateStatus('გასაუქმებელი არ არის', false);
      return;
    }
    const key = getSessionKey();
    localStorage.setItem(key, text);
    localStorage.setItem(BACKUP_KEY, text);
    updateStatus('ბოლო სკანი გაუქმდა — იხსნება თავიდან', true);
    syncUi();
    setTimeout(function () { location.reload(); }, 350);
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
    }, true);
  }

  function watchLocalSession() {
    const text = getCurrentSessionText();
    if (text && previousSessionText && text !== previousSessionText) {
      undoStack.push(previousSessionText);
      if (undoStack.length > MAX_UNDO) undoStack.shift();
    }
    if (text) previousSessionText = text;

    const session = getCurrentSession();
    const count = getCountFromPage();
    if (count !== lastCount) lastCount = count;

    const lastBarcode = getLastBarcode(session);
    if (lastBarcode && lastBarcode !== lastPromotedBarcode) {
      lastPromotedBarcode = lastBarcode;
      setTimeout(function () { promoteBarcode(lastBarcode, true); }, 120);
    }

    const savedCount = session && typeof session.scannedCount !== 'undefined' ? session.scannedCount : count;
    updateStatus('შენახულია ' + savedCount, true);
    syncUi();
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
    buildUi();
    restoreKeyboardMode();
    setupCardPromoteOnClick();
    setupInstallPrompt();
    previousSessionText = getCurrentSessionText();
    lastCount = getCountFromPage();
    if (settings.paused) syncUi();
    watchLocalSession();

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        buildUi();
        restoreKeyboardMode();
        watchLocalSession();
      }
    });
    window.addEventListener('focus', function () { buildUi(); restoreKeyboardMode(); watchLocalSession(); });
    window.addEventListener('pageshow', function () { buildUi(); restoreKeyboardMode(); watchLocalSession(); });
    document.addEventListener('click', function () { setTimeout(function () { buildUi(); restoreKeyboardMode(); watchLocalSession(); }, 60); }, true);

    setInterval(function () {
      buildUi();
      restoreKeyboardMode();
      watchLocalSession();
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
