// Brand House admin panel enhancements — favicon/title only.
(function () {
  'use strict';

  if (window.__BH_ADMIN_ENHANCEMENTS__) return;
  window.__BH_ADMIN_ENHANCEMENTS__ = true;

  function addFavicons() {
    const links = [
      ['icon', 'image/png', 'logo.png?v=admin8'],
      ['shortcut icon', 'image/png', 'logo.png?v=admin8'],
      ['apple-touch-icon', '', 'logo.png?v=admin8']
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addFavicons);
  } else {
    addFavicons();
  }
})();
