// Brand House admin panel enhancements — lightweight UI only.
(function () {
  'use strict';

  if (window.__BH_ADMIN_ENHANCEMENTS__) return;
  window.__BH_ADMIN_ENHANCEMENTS__ = true;

  const SCAN_URL = '/Brand_House/scan.html';

  function addFavicons() {
    const links = [
      ['icon', 'image/png', 'logo.png?v=admin7'],
      ['shortcut icon', 'image/png', 'logo.png?v=admin7'],
      ['apple-touch-icon', '', 'logo.png?v=admin7']
    ];

    links.forEach(function (item) {
      const rel = item[0];
      if (document.querySelector('link[rel="' + rel + '"]')) return;
      const link = document.createElement('link');
      link.rel = rel;
      if (item[1]) link.type = item[1];
      link.href = item[2];
      document.head.appendChild(link);
    });

    document.title = 'BH Admin · Brand House';
  }

  function injectStyles() {
    if (document.getElementById('bhAdminStyles')) return;
    const style = document.createElement('style');
    style.id = 'bhAdminStyles';
    style.textContent = `
      header{box-shadow:0 8px 22px rgba(27,67,50,.18)}
      header img{box-shadow:0 2px 10px rgba(0,0,0,.18)}
      .bh-admin-top{display:grid;grid-template-columns:1.2fr repeat(3, minmax(120px,.7fr));gap:12px;margin-bottom:20px}
      .bh-admin-hero{background:linear-gradient(135deg,#1B4332,#2D6A4F);color:#fff;border-radius:16px;padding:18px 20px;min-height:98px;display:flex;align-items:center;gap:14px;box-shadow:0 14px 32px rgba(27,67,50,.18)}
      .bh-admin-logo{width:58px;height:58px;border-radius:14px;background:#fff;padding:7px;object-fit:contain;flex-shrink:0}
      .bh-admin-hero h2{font-size:20px;font-weight:700;margin:0 0 4px}
      .bh-admin-hero p{font-size:12px;opacity:.75;margin:0}
      .bh-admin-card{background:#fff;border:1px solid #E4E2DC;border-radius:16px;padding:14px 16px;min-height:98px;display:flex;flex-direction:column;justify-content:center;box-shadow:0 8px 22px rgba(0,0,0,.035)}
      .bh-admin-card .label{font-size:11px;color:#7A7870;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em}
      .bh-admin-card .value{font-family:'DM Mono',monospace;font-size:25px;font-weight:700;color:#1A1A18}
      .bh-admin-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .bh-admin-action{border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.14);color:#fff;border-radius:10px;padding:8px 11px;font-size:12px;font-family:inherit;font-weight:700;text-decoration:none;cursor:pointer}
      .bh-admin-action.light{background:#fff;color:#1B4332;border-color:#fff}
      .bh-admin-mini{display:flex;gap:8px;align-items:center;color:rgba(255,255,255,.72);font-size:11px;margin-top:4px}
      .bh-admin-pulse{width:8px;height:8px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 5px rgba(74,222,128,.16)}
      .bh-admin-empty-note{background:#FFF3CD;color:#7a4b00;border:1px solid #FFE5A3;border-radius:12px;padding:10px 12px;font-size:12px;margin-bottom:14px;display:none}
      @media(max-width:900px){.bh-admin-top{grid-template-columns:1fr}.bh-admin-hero{min-height:auto}.main{padding:18px}.sidebar{width:260px}}
    `;
    document.head.appendChild(style);
  }

  function makeCard(label, value, id) {
    return '<div class="bh-admin-card"><div class="label">' + label + '</div><div class="value" id="' + id + '">' + value + '</div></div>';
  }

  function buildDashboard() {
    if (document.getElementById('bhAdminTop')) return;
    const main = document.querySelector('.main');
    if (!main) return;

    const wrap = document.createElement('div');
    wrap.id = 'bhAdminTop';
    wrap.className = 'bh-admin-top';
    wrap.innerHTML = `
      <div class="bh-admin-hero">
        <img class="bh-admin-logo" src="logo.png?v=admin7" alt="BH" onerror="this.style.display='none'">
        <div>
          <h2>Brand House Admin</h2>
          <p>საწყობის ოპერაციების მართვა და შედეგების კონტროლი</p>
          <div class="bh-admin-mini"><span class="bh-admin-pulse"></span><span id="bhAdminLiveText">სისტემა აქტიურია</span></div>
          <div class="bh-admin-actions">
            <a class="bh-admin-action light" href="${SCAN_URL}" target="_blank" rel="noopener">📱 სკანერის გახსნა</a>
            <button class="bh-admin-action" id="bhAdminCopyScan">🔗 ლინკის კოპირება</button>
            <button class="bh-admin-action" id="bhAdminHardRefresh">↻ სრული განახლება</button>
          </div>
        </div>
      </div>
      ${makeCard('სულ ოპერაცია', '—', 'bhAdminTotal')}
      ${makeCard('მიმდინარე', '—', 'bhAdminActive')}
      ${makeCard('დასრულებული', '—', 'bhAdminDone')}
    `;

    main.insertBefore(wrap, main.firstChild);

    const note = document.createElement('div');
    note.id = 'bhAdminNote';
    note.className = 'bh-admin-empty-note';
    note.textContent = 'ოპერაციები ჯერ არ ჩანს — ატვირთე Excel ფაილი ან დააჭირე განახლებას.';
    main.insertBefore(note, wrap.nextSibling);

    document.getElementById('bhAdminCopyScan').addEventListener('click', copyScanLink);
    document.getElementById('bhAdminHardRefresh').addEventListener('click', hardRefresh);
  }

  function copyScanLink() {
    const url = location.origin + SCAN_URL;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        toast('სკანერის ლინკი დაკოპირდა');
      }).catch(function () {
        prompt('სკანერის ლინკი:', url);
      });
    } else {
      prompt('სკანერის ლინკი:', url);
    }
  }

  function hardRefresh() {
    try {
      Object.keys(localStorage).forEach(function (key) {
        if (key.indexOf('bh_admin_ops') === 0 || key.indexOf('bh_results_') === 0) localStorage.removeItem(key);
      });
    } catch (e) {}
    location.reload();
  }

  function toast(text) {
    if (typeof window.showToast === 'function') {
      window.showToast(text);
      return;
    }
    const t = document.createElement('div');
    t.textContent = text;
    t.style.cssText = 'position:fixed;right:18px;bottom:18px;background:#1A1A18;color:#fff;padding:11px 16px;border-radius:10px;font-size:13px;z-index:99999;';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2200);
  }

  function updateDashboard() {
    buildDashboard();
    const ops = Array.isArray(window.allOps) ? window.allOps : [];
    const total = ops.length;
    const done = ops.filter(function (op) { return op.status === 'დასრულებული'; }).length;
    const active = ops.filter(function (op) { return op.status !== 'დასრულებული'; }).length;

    setText('bhAdminTotal', total || '0');
    setText('bhAdminActive', active || '0');
    setText('bhAdminDone', done || '0');
    setText('bhAdminLiveText', total ? ('ბოლო განახლება: ' + new Date().toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit' })) : 'ოპერაციები ჯერ არ არის');

    const note = document.getElementById('bhAdminNote');
    if (note) note.style.display = total ? 'none' : 'block';
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function wrapRenderOps() {
    if (typeof window.renderOpsList !== 'function' || window.renderOpsList.__bhWrapped) return;
    const original = window.renderOpsList;
    window.renderOpsList = function () {
      const result = original.apply(this, arguments);
      setTimeout(updateDashboard, 30);
      return result;
    };
    window.renderOpsList.__bhWrapped = true;
  }

  function setup() {
    addFavicons();
    injectStyles();
    buildDashboard();
    wrapRenderOps();
    updateDashboard();
    setInterval(function () {
      wrapRenderOps();
      updateDashboard();
    }, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup);
  else setup();
})();
