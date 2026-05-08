// Brand House scanner local enhancements — offline first.
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
  let audioCtx = null;
  let deferredPrompt = null;

  const settings = readJson(UI_KEY, {
    sound: true,
    vibration: true,
    manualOpen: false,
    paused: false
  });

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
      #barcodeInput.bh-no-keyboard{caret-color:transparent!important}
      .bh-keyboard-hint{margin-top:6px;font-size:10px;color:#7A7870}
      .bh-tools{background:#fff;border-bottom:1px solid #E4E2DC;padding:8px 10px;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;position:relative;z-index:30}
      .bh-tool-btn{border:1px solid #E4E2DC;background:#F7F6F2;color:#1A1A18;border-radius:10px;padding:8px 4px;font-size:11px;font-family:inherit;font-weight:600;line-height:1.15;min-height:38px}
      .bh-tool-btn.active{background:#1B4332;color:#fff;border-color:#1B4332}
      .bh-status{background:#F7F6F2;border-bottom:1px solid #E4E2DC;padding:6px 12px;font-size:11px;color:#7A7870;display:flex;justify-content:space-between;gap:8px;align-items:center}
      .bh-status b{color:#1B4332;font-weight:700}
      .bh-last-strip{background:#fff;border-bottom:1px solid #E4E2DC;padding:7px 10px;display:flex;gap:6px;overflow-x:auto;white-space:nowrap;scrollbar-width:none}
      .bh-last-strip::-webkit-scrollbar{display:none}
      .bh-chip{font-family:'DM Mono',monospace;font-size:10px;border-radius:999px;padding:5px 8px;border:1px solid #E4E2DC;background:#F7F6F2;color:#1A1A18;max-width:150px;overflow:hidden;text-overflow:ellipsis;flex:0 0 auto}
      .bh-chip.ok{background:#D8F3DC;color:#2D6A4F;border-color:#D8F3DC}
      .bh-chip.bad{background:#FFE8E9;color:#C1121F;border-color:#FFE8E9}
      .bh-chip.over{background:#FFF3CD;color:#CA6702;border-color:#FFF3CD}
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
      <button class="bh-tool-btn" id="bhSoundBtn">🔊 ხმა</button>
    `;

    const status = document.createElement('div');
    status.id = 'bhStatus';
    status.className = 'bh-status';
    status.innerHTML = '<span>ტელეფონში შენახვა</span><b id="bhStatusText">მზადაა</b>';

    const last = document.createElement('div');
    last.id = 'bhLastStrip';
    last.className = 'bh-last-strip';
    last.innerHTML = '<span class="bh-chip">ბოლო სკანები</span>';

    const manual = document.createElement('div');
    manual.id = 'bhManualBox';
    manual.className = 'bh-manual-box';
    manual.innerHTML = '<input id="bhManualInput" class="bh-manual-input" placeholder="ბარკოდი ხელით" inputmode="text"><button id="bhManualSend" class="bh-manual-send">დამატება</button>';

    filterBar.parentNode.insertBefore(tools, filterBar.nextSibling);
    filterBar.parentNode.insertBefore(status, tools.nextSibling);
    filterBar.parentNode.insertBefore(last, status.nextSibling);
    filterBar.parentNode.insertBefore(manual, last.nextSibling);

    const pause = document.createElement('div');
    pause.id = 'bhPauseCover';
    pause.className = 'bh-pause-cover';
    pause.innerHTML = '<div class="bh-pause-card"><h2>პაუზაა</h2><p>ყველაფერი შენახულია ტელეფონში. შეგიძლია ეკრანი ჩაკეტო და მერე გააგრძელო.</p><button id="bhContinueBtn" class="bh-continue-btn">გაგრძელება</button></div>';
    document.body.appendChild(pause);

    document.getElementById('bhUndoBtn').addEventListener('click', undoLast);
    document.getElementById('bhManualBtn').addEventListener('click', toggleManual);
    document.getElementById('bhPauseBtn').addEventListener('click', pauseWork);
    document.getElementById('bhSoundBtn').addEventListener('click', toggleSound);
    document.getElementById('bhContinueBtn').addEventListener('click', continueWork);
    document.getElementById('bhManualSend').addEventListener('click', submitManual);
    document.getElementById('bhManualInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') submitManual();
    });

    syncUi();
  }

  function syncUi() {
    const soundBtn = document.getElementById('bhSoundBtn');
    const manualBtn = document.getElementById('bhManualBtn');
    const manualBox = document.getElementById('bhManualBox');
    const pauseCover = document.getElementById('bhPauseCover');
    const undoBtn = document.getElementById('bhUndoBtn');

    if (soundBtn) {
      soundBtn.textContent = settings.sound || settings.vibration ? '🔊 ხმა' : '🔇 უხმო';
      soundBtn.classList.toggle('active', settings.sound || settings.vibration);
    }
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

  function applyNoKeyboardMode() {
    const input = document.getElementById('barcodeInput');
    if (!input) return;
    input.classList.add('bh-no-keyboard');
    input.setAttribute('readonly', 'readonly');
    input.setAttribute('inputmode', 'none');
    input.placeholder = 'დაასკანერე ბარკოდი';

    if (!input.__bhNoKeyboard) {
      input.__bhNoKeyboard = true;
      input.addEventListener('focus', function () {
        if (document.getElementById('screenScan') && document.getElementById('screenScan').classList.contains('active')) {
          setTimeout(function () { input.blur(); }, 0);
        }
      });
    }

    const wrap = input.closest('.scan-input-wrap');
    if (wrap && !document.getElementById('bhKeyboardHint')) {
      const hint = document.createElement('div');
      hint.id = 'bhKeyboardHint';
      hint.className = 'bh-keyboard-hint';
      hint.textContent = 'კლავიატურა გამორთულია — სკანერი იმუშავებს. ხელით შეყვანა ღილაკით.';
      wrap.appendChild(hint);
    }
  }

  function toggleSound() {
    const next = !(settings.sound || settings.vibration);
    settings.sound = next;
    settings.vibration = next;
    saveUi();
    syncUi();
    feedback('ok');
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
    scan.readOnly = false;
    scan.value = code;
    scan.dispatchEvent(new Event('input', { bubbles: true }));
    scan.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true }));
    scan.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', which: 13, keyCode: 13, bubbles: true }));
    setTimeout(function () {
      scan.value = '';
      scan.readOnly = true;
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
    feedback('undo');
    syncUi();
    setTimeout(function () { location.reload(); }, 350);
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
    if (count !== lastCount) {
      if (lastCount >= 0 && count > lastCount) feedback('ok');
      lastCount = count;
    }

    renderLast(session);
    const savedCount = session && typeof session.scannedCount !== 'undefined' ? session.scannedCount : count;
    updateStatus('შენახულია ' + savedCount, true);
    syncUi();
  }

  function renderLast(session) {
    buildUi();
    const strip = document.getElementById('bhLastStrip');
    if (!strip) return;
    const log = session && Array.isArray(session.scanLog) ? session.scanLog.slice(-10).reverse() : [];
    if (!log.length) {
      strip.innerHTML = '<span class="bh-chip">ბოლო სკანები</span>';
      return;
    }
    strip.innerHTML = log.map(function (entry) {
      const code = escapeHtml(String(entry.barcode || entry.code || entry.value || '—'));
      const status = String(entry.status || 'ok');
      const cls = status.includes('უც') || status.includes('unknown') ? 'bad' : status.includes('მეტ') || status.includes('over') ? 'over' : 'ok';
      return '<span class="bh-chip ' + cls + '">' + code + '</span>';
    }).join('');
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function feedback(type) {
    if (settings.vibration && navigator.vibrate) {
      if (type === 'undo') navigator.vibrate(40);
      else navigator.vibrate(25);
    }
    if (!settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(type === 'undo' ? 520 : 880, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.07, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
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
    applyNoKeyboardMode();
    setupInstallPrompt();
    previousSessionText = getCurrentSessionText();
    lastCount = getCountFromPage();
    if (settings.paused) syncUi();
    watchLocalSession();

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        buildUi();
        applyNoKeyboardMode();
        watchLocalSession();
      }
    });
    window.addEventListener('focus', function () { buildUi(); applyNoKeyboardMode(); watchLocalSession(); });
    window.addEventListener('pageshow', function () { buildUi(); applyNoKeyboardMode(); watchLocalSession(); });
    document.addEventListener('click', function () { setTimeout(function () { buildUi(); applyNoKeyboardMode(); watchLocalSession(); }, 60); }, true);

    setInterval(function () {
      buildUi();
      applyNoKeyboardMode();
      watchLocalSession();
    }, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
