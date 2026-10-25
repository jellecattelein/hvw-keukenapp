/* ══════════════════════════════════════════
   etiketten-modus.js — aparte werkruimte voor de koks

   Hoofdpagina: Portie-Etiketten "Per categorie". Daarnaast Snelle en
   Karren-Etiketten, en onder "Meer": Per zaal, Los toevoegen, Broodjes,
   Recepten. Geactiveerd via de link
     …/index.html?modus=etiketten
   en daarna per toestel onthouden. Terug naar de volledige app:
     …/index.html?modus=volledig   (of de link "Alle schermen" rechtsboven)
   De klasse op <html> (m-etiket) en de manifest-keuze gebeuren al in <head>.
   ══════════════════════════════════════════ */
(function () {
  'use strict';

  const root = document.documentElement;
  if (!root.classList.contains('m-etiket')) return;

  const ICO = {
    tag: '<path d="M3 12.5V4a1 1 0 0 1 1-1h8.5a1 1 0 0 1 .7.3l8 8a1 1 0 0 1 0 1.4l-8.5 8.5a1 1 0 0 1-1.4 0l-8-8a1 1 0 0 1-.3-.7z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    cart: '<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H6.2M9 20.5h.01M17 20.5h.01"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    room: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    bread: '<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>',
    book: '<path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2zM12 6.5v13"/>',
  };

  // Hoofdtabs (altijd zichtbaar) en het "Meer"-menu
  const ITEMS = {
    cat:      { page: 'portie-etiketten', modus: 'categorie', label: 'Per categorie',    icon: ICO.grid },
    snel:     { page: 'snel-etiketten',                      label: 'Snelle Etiketten', icon: ICO.bolt },
    karren:   { page: 'etiketten',                           label: 'Karren-Etiketten', icon: ICO.tag },
    zaal:     { page: 'portie-etiketten', modus: 'zaal',      label: 'Per zaal',         icon: ICO.room },
    los:      { page: 'portie-etiketten', modus: 'los',       label: 'Los toevoegen',    icon: ICO.plus },
    broodjes: { page: 'broodjes',                            label: 'Broodjes',         icon: ICO.bread },
    recepten: { page: 'recepten',                            label: 'Recepten',         icon: ICO.book },
  };
  const MAIN = ['cat', 'snel', 'karren', 'broodjes', 'recepten'];
  const MORE = ['zaal', 'los'];
  const svg = inner => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

  function peModus() {
    return ['los', 'categorie', 'zaal'].find(m => {
      const el = document.getElementById('pe-modus-' + m);
      return el && el.style.display !== 'none';
    }) || 'categorie';
  }
  function currentKey() {
    const page = document.querySelector('.sb-item.active')?.dataset.page;
    if (page === 'portie-etiketten') return { categorie: 'cat', zaal: 'zaal', los: 'los' }[peModus()];
    return Object.keys(ITEMS).find(k => ITEMS[k].page === page && !ITEMS[k].modus) || null;
  }

  function build() {
    if (document.getElementById('et-nav')) return;
    const nav = document.createElement('header');
    nav.id = 'et-nav';
    nav.innerHTML = `
      <div class="et-brand">
        <img src="assets/logo.png" alt="">
        <div><b>Etiketten</b><span>Huis van Wonterghem</span></div>
      </div>
      <div class="et-tabs-wrap" id="et-tabs">
        ${MAIN.map(k => `<button type="button" class="et-tab" data-key="${k}" onclick="window._etGo('${k}')">${svg(ITEMS[k].icon)}<span>${ITEMS[k].label}</span></button>`).join('')}
        <div class="et-more-wrap">
          <button type="button" class="et-tab et-more" id="et-more" data-key="more" onclick="window._etMenu(event)" aria-haspopup="true">${svg(ICO.more)}<span>Meer</span></button>
          <div class="et-menu" id="et-menu" role="menu">
            ${MORE.map(k => `<button type="button" role="menuitem" data-key="${k}" onclick="window._etGo('${k}')">${svg(ITEMS[k].icon)}<span>${ITEMS[k].label}</span></button>`).join('')}
          </div>
        </div>
        <i class="et-tab-ind" id="et-tab-ind"></i>
      </div>
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

  function markActive() {
    const key = currentKey();
    const tabs = document.getElementById('et-tabs');
    if (!tabs) return;
    const inMore = MORE.includes(key);
    let found = null;
    tabs.querySelectorAll('.et-tab').forEach(b => {
      const on = b.dataset.key === key || (b.dataset.key === 'more' && inMore);
      b.classList.toggle('active', on);
      if (on) found = b;
    });
    document.querySelectorAll('#et-menu button').forEach(b => b.classList.toggle('active', b.dataset.key === key));
    // het "Meer"-knopje toont de naam van het gekozen scherm
    const moreLbl = document.querySelector('#et-more span');
    if (moreLbl) moreLbl.textContent = inMore ? ITEMS[key].label : 'Meer';
    const ind = document.getElementById('et-tab-ind');
    if (ind) {
      if (found) {
        ind.style.opacity = '1';
        // positie t.o.v. de tabbalk (het "Meer"-knopje zit in een eigen wrapper)
        const fr = found.getBoundingClientRect(), tr = tabs.getBoundingClientRect();
        ind.style.width = fr.width + 'px';
        ind.style.transform = `translateX(${fr.left - tr.left}px)`;
      } else ind.style.opacity = '0';
    }
  }

  function refresh() {
    const wk = document.getElementById('et-week');
    const has = typeof allRows !== 'undefined' && allRows && allRows.length > 0;
    if (wk) { wk.textContent = weekText(); wk.style.display = has ? '' : 'none'; }
    root.classList.toggle('et-leeg', !has);
    markActive();
  }

  function closeMenu() { document.getElementById('et-menu')?.classList.remove('open'); }
  window._etMenu = function (ev) {
    ev.stopPropagation();
    document.getElementById('et-menu')?.classList.toggle('open');
  };

  window._etGo = function (key) {
    const it = ITEMS[key];
    if (!it) return;
    closeMenu();
    if (typeof window.sbShow === 'function') window.sbShow(it.page);
    if (it.modus && typeof window._peSwitchModus === 'function') window._peSwitchModus(it.modus);
    refresh();
  };

  window._etSync = function () {
    if (typeof window.hvwSyncNow === 'function') window.hvwSyncNow();
    else location.reload();
  };

  document.addEventListener('DOMContentLoaded', () => {
    build();
    refresh();
    document.addEventListener('dataLoaded', refresh);
    document.addEventListener('click', closeMenu);
    // zijbalk-markering volgen (sbShow zet de actieve klasse), en de modus van Portie-Etiketten
    const sb = document.getElementById('sidebar');
    if (sb) new MutationObserver(refresh).observe(sb, { subtree: true, attributes: true, attributeFilter: ['class'] });
    if (typeof window._peSwitchModus === 'function') {
      const orig = window._peSwitchModus;
      window._peSwitchModus = function (m) { orig.apply(this, arguments); refresh(); };
    }
    window.addEventListener('resize', refresh);
  });

  // Starten op de hoofdpagina (Per categorie), na alle andere opstartcode
  window.addEventListener('load', () => {
    setTimeout(() => {
      const cur = currentKey();
      window._etGo(cur && ITEMS[cur] ? cur : 'cat');
    }, 120);
  });
})();
