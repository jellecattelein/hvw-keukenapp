/* ══════════════════════════════════════════
   etiketten-modus.js — aparte werkruimte voor de koks

   Alleen de etiketten-schermen (Portie, Snel, Karren), met een bovenmenu
   i.p.v. de zijbalk. Geactiveerd via de link
     …/index.html?modus=etiketten
   en daarna per toestel onthouden. Terug naar de volledige app:
     …/index.html?modus=volledig   (of de link "Alle schermen" rechtsboven)
   De klasse op <html> (m-etiket) en de manifest-keuze gebeuren al in <head>.
   ══════════════════════════════════════════ */
(function () {
  'use strict';

  const root = document.documentElement;
  if (!root.classList.contains('m-etiket')) return;
  // bij het openen via de normale app: toestel blijft in deze modus tot ?modus=volledig

  const TABS = [
    { page: 'portie-etiketten', label: 'Portie-Etiketten',
      icon: '<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 21V3c-2.5 1.5-4 4.5-4 8h4"/>' },
    { page: 'snel-etiketten', label: 'Snelle Etiketten',
      icon: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>' },
    { page: 'etiketten', label: 'Karren-Etiketten',
      icon: '<path d="M3 12.5V4a1 1 0 0 1 1-1h8.5a1 1 0 0 1 .7.3l8 8a1 1 0 0 1 0 1.4l-8.5 8.5a1 1 0 0 1-1.4 0l-8-8a1 1 0 0 1-.3-.7z"/><circle cx="7.5" cy="7.5" r="1.2"/>' },
    { page: 'broodjes', label: 'Broodjes',
      icon: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>' },
    { page: 'recepten', label: 'Recepten',
      icon: '<path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2zM12 6.5v13"/>' },
  ];
  const svg = inner => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

  function build() {
    if (document.getElementById('et-nav')) return;
    const nav = document.createElement('header');
    nav.id = 'et-nav';
    nav.innerHTML = `
      <div class="et-brand">
        <img src="assets/logo.png" alt="">
        <div><b>Etiketten</b><span>Huis van Wonterghem</span></div>
      </div>
      <nav class="et-tabs" id="et-tabs">
        ${TABS.map(t => `<button type="button" class="et-tab" data-page="${t.page}" onclick="window._etGo('${t.page}')">${svg(t.icon)}<span>${t.label}</span></button>`).join('')}
        <i class="et-tab-ind" id="et-tab-ind"></i>
      </nav>
      <div class="et-right">
        <div class="et-week" id="et-week" title="Week uit de laatst geüploade Excel"></div>
        <button type="button" class="et-sync" id="et-sync" title="Nu synchroniseren" onclick="window._etSync()">${svg('<path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"/>')}</button>
        <a class="et-full" id="et-full" href="?modus=volledig" title="Terug naar de volledige app">Alle schermen</a>
      </div>`;
    document.body.insertBefore(nav, document.body.firstChild);

    // melding als er (nog) geen week is
    const banner = document.createElement('div');
    banner.id = 'et-banner';
    banner.innerHTML = `
      <div class="et-banner-box">
        <div class="et-banner-ico">${svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>')}</div>
        <div class="et-banner-txt"><b>Nog geen week geladen</b>
          <span class="et-banner-viewer">De beheerder moet eerst de Excel van de week uploaden. Daarna verschijnt alles hier vanzelf.</span>
          <span class="et-banner-admin">Upload eerst de Excel van de week (CCM-export).</span></div>
        <button type="button" class="btn btn-gold et-banner-admin" onclick="document.getElementById('xl-input').click()">Excel uploaden</button>
        <button type="button" class="btn et-banner-viewer" onclick="window._etSync()">Opnieuw proberen</button>
      </div>`;
    const wrap = document.getElementById('app-wrap');
    if (wrap) wrap.insertBefore(banner, wrap.firstChild);
  }

  function weekText() {
    if (typeof allRows === 'undefined' || !allRows || !allRows.length) return '';
    const weeks = [...new Set(allRows.map(r => r.weekLabel).filter(Boolean))];
    const n = typeof allEvents !== 'undefined' && allEvents ? allEvents.length : 0;
    return `${weeks[0] || ''}${weeks.length > 1 ? ` +${weeks.length - 1}` : ''}${n ? ` · ${n} feesten` : ''}`;
  }

  function refresh() {
    const wk = document.getElementById('et-week');
    const has = typeof allRows !== 'undefined' && allRows && allRows.length > 0;
    if (wk) { wk.textContent = weekText(); wk.style.display = has ? '' : 'none'; }
    root.classList.toggle('et-leeg', !has);
    markActive(document.querySelector('.sb-item.active')?.dataset.page);
  }

  function markActive(page) {
    const tabs = document.getElementById('et-tabs');
    if (!tabs) return;
    let found = null;
    tabs.querySelectorAll('.et-tab').forEach(b => {
      const on = b.dataset.page === page;
      b.classList.toggle('active', on);
      if (on) found = b;
    });
    const ind = document.getElementById('et-tab-ind');
    if (ind) {
      if (found) {
        ind.style.opacity = '1';
        ind.style.width = found.offsetWidth + 'px';
        ind.style.transform = `translateX(${found.offsetLeft}px)`;
      } else ind.style.opacity = '0';
    }
  }

  window._etGo = function (page) {
    if (typeof window.sbShow === 'function') window.sbShow(page);
    markActive(page);
  };

  window._etSync = function () {
    if (typeof window.hvwSyncNow === 'function') window.hvwSyncNow();
    else location.reload();
  };

  document.addEventListener('DOMContentLoaded', () => {
    build();
    refresh();
    document.addEventListener('dataLoaded', refresh);
    // zijbalk-markering volgen: zodra sbShow een pagina activeert, tabs bijwerken
    const sb = document.getElementById('sidebar');
    if (sb) new MutationObserver(refresh).observe(sb, { subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', refresh);
  });

  // Starten in het eerste etiketten-scherm (na alle andere opstartcode)
  window.addEventListener('load', () => {
    setTimeout(() => {
      const cur = document.querySelector('.sb-item.active')?.dataset.page;
      const toegelaten = TABS.some(t => t.page === cur);
      window._etGo(toegelaten ? cur : TABS[0].page);
      refresh();
    }, 120);
  });
})();
