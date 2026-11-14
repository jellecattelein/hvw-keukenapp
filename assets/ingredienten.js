/* ══════════════════════════════════════════
   ingredienten.js — alle onderdelen van de gerechten in één lijst

   Splitst elke gerechtnaam uit de Excel in zijn onderdelen
   ("Krielaardappelen met fleur de sel en tijm" → krielaardappelen,
   fleur de sel, tijm) en toont die als checklist, zodat je bij het
   bestellen niets vergeet. Alles gebeurt lokaal, zonder AI.
   ══════════════════════════════════════════ */
(function () {
  'use strict';

  const KEY = 'hvw-ingredienten-afgevinkt';
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

  let weekKey = '', view = 'ingredient', cat = '', zoek = '', afgevinkt = {};

  function load() { try { afgevinkt = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { afgevinkt = {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(afgevinkt)); } catch (e) {} }

  /* ── gerechtnaam → onderdelen ── */
  const BEREIDING = /^(gebakken|gegrilde?|gegrild|geschroeide?|geschroeid|gestoofde?|gestoofd|gebraden|gepocheerde?|gepocheerd|gebrande?|gebrand|gesmoorde?|gesmoord)\s+/i;
  function opschonen(naam) {
    let s = String(naam || '');
    s = s.replace(/\([^)]*\)/g, ' ');                                        // (180gr), (rouwmaaltijd), (Rouwtafel)
    for (let i = 0; i < 3; i++) s = s.replace(/^\s*(zoutloos|voorgerecht|small\s+plate|repasse)\s+/i, '');
    return s.replace(/\s+/g, ' ').trim();
  }
  const hoofdletter = s => s.charAt(0).toUpperCase() + s.slice(1);
  function onderdelen(naam) {
    const s = opschonen(naam);
    const delen = s.split(/\s*,\s*|\s*;\s*|\s+\+\s+|\s+&\s+|\s+en\s+|\s+met\s+/i)
      .map(x => x.trim().replace(/[.:]+$/, '').trim())
      .filter(x => x && !/^(zonder|lactosevrij|glutenvrij|vegetarisch|vegan)\b/i.test(x));
    return delen.map((x, i) => {
      if (i === 0) { const y = x.replace(BEREIDING, ''); if (y) x = y; }
      return hoofdletter(x);
    });
  }

  /* ── data per week ── */
  function weken() {
    if (typeof allRows === 'undefined' || !allRows.length) return [];
    return [...new Map(allRows.filter(r => r.weekKey).map(r => [r.weekKey, r.weekLabel || r.weekKey])).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }
  const tabLabel = id => ((typeof TABS !== 'undefined' ? TABS : []).find(t => t.id === id) || {}).label || id;
  function dagLabel(ds) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ds || '');
    return m ? `${DAGEN[new Date(+m[1], +m[2] - 1, +m[3]).getDay()]} ${+m[3]}/${+m[2]}` : 'datum onbekend';
  }
  function verzamel() {
    // gerechten: zelfde gerecht op dezelfde dag samengenomen
    const gerechten = new Map();
    if (typeof allRows !== 'undefined') allRows.forEach(r => {
      if (r.persons <= 0 || r.weekKey !== weekKey || !r.name) return;
      if (cat && r.tabId !== cat) return;
      const naam = opschonen(r.name);
      const sleutel = naam.toLowerCase() + '|' + (r.dateStr || '');
      if (!gerechten.has(sleutel)) gerechten.set(sleutel, { naam, dateStr: r.dateStr || '', persons: 0, tabs: new Set(), delen: onderdelen(r.name) });
      const g = gerechten.get(sleutel); g.persons += r.persons; g.tabs.add(r.tabId);
    });
    const lijst = [...gerechten.values()];
    // ingrediënten
    const ing = new Map();
    lijst.forEach(g => g.delen.forEach(d => {
      const k = d.toLowerCase();
      if (!ing.has(k)) ing.set(k, { key: k, naam: d, gerechten: [], persons: 0 });
      const o = ing.get(k); o.gerechten.push(g); o.persons += g.persons;
    }));
    return { gerechten: lijst, ingredienten: [...ing.values()].sort((a, b) => a.naam.localeCompare(b.naam, 'nl')) };
  }
  const gefilterd = (l, f) => { const q = zoek.trim().toLowerCase(); return q ? l.filter(f(q)) : l; };

  /* ── CSS ── */
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      #page-ingredienten { --i-ink3:#8B90A0; --i-line:rgba(20,21,26,.09); --i-acc:#8B6A00; }
      .ig-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px; }
      .ig-head h2 { margin:0; font:700 22px 'Inter',sans-serif; letter-spacing:-.02em; }
      .ig-head select, .ig-head input[type=search] { padding:8px 10px; border:1px solid rgba(20,21,26,.15); border-radius:10px; font:14px 'Inter',sans-serif; background:#fff; }
      .ig-head input[type=search] { min-width:170px; }
      .ig-tabs { display:inline-flex; background:rgba(20,21,26,.06); border-radius:11px; padding:3px; gap:2px; }
      .ig-tabs button { border:0; background:transparent; padding:7px 14px; border-radius:9px; font:600 13px 'Inter',sans-serif; cursor:pointer; color:#6B655E; }
      .ig-tabs button.act { background:#fff; color:#14151A; box-shadow:0 1px 3px rgba(20,21,26,.12); }
      .ig-card { background:#fff; border-radius:16px; box-shadow:0 1px 2px rgba(20,21,26,.05),0 0 0 1px rgba(20,21,26,.04); padding:8px 18px; margin-bottom:14px; }
      .ig-info { font-size:13px; color:#3A4764; background:rgba(26,63,111,.07); border-radius:10px; padding:9px 12px; margin-bottom:12px; display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
      .ig-info .sp { flex:1; }
      .ig-row { display:grid; grid-template-columns:26px minmax(0,1fr) auto; gap:10px; align-items:start; padding:9px 0; border-top:1px solid var(--i-line); }
      .ig-row:first-child { border-top:0; }
      .ig-row input[type=checkbox] { width:19px; height:19px; margin-top:2px; accent-color:#2D6A4F; cursor:pointer; }
      .ig-naam { font:600 14.5px 'Inter',sans-serif; }
      .ig-row.klaar .ig-naam { text-decoration:line-through; color:var(--i-ink3); font-weight:500; }
      .ig-meta { font-size:12px; color:var(--i-ink3); text-align:right; white-space:nowrap; padding-top:2px; }
      .ig-gerechten { font-size:12px; color:#5B6075; margin-top:3px; line-height:1.5; }
      .ig-gerechten b { font-weight:600; color:#3A3F55; }
      .ig-dag { font:700 12px 'Inter',sans-serif; text-transform:uppercase; letter-spacing:.5px; color:var(--i-acc); margin:14px 0 4px; }
      .ig-g { padding:8px 0; border-top:1px solid var(--i-line); }
      .ig-g:first-of-type { border-top:0; }
      .ig-g .t { font:600 14px 'Inter',sans-serif; }
      .ig-g .t span { font-weight:500; font-size:12px; color:var(--i-ink3); margin-left:8px; }
      .ig-chips { display:flex; flex-wrap:wrap; gap:5px; margin-top:5px; }
      .ig-chip { font-size:12px; font-weight:600; background:#FDF6E3; color:#6B5300; border-radius:99px; padding:2px 10px; }
      .ig-leeg { color:var(--i-ink3); font-size:13px; padding:12px 0; }
    `;
    document.head.appendChild(s);
  }

  /* ── scherm ── */
  function render() {
    const root = document.getElementById('page-ingredienten');
    if (!root) return;
    const wk = weken();
    if (!wk.some(([k]) => k === weekKey)) weekKey = wk.length ? wk[0][0] : '';
    if (!wk.length) {
      root.innerHTML = `<div class="ig-head"><h2>Ingrediëntenlijst</h2></div><div class="ig-card"><div class="ig-leeg">Upload eerst de Excel van de week. Daarna staat hier elk onderdeel van elk gerecht in één lijst.</div></div>`;
      return;
    }
    const tabs = [...new Set(allRows.filter(r => r.weekKey === weekKey).map(r => r.tabId))];
    const D = verzamel();
    const ings = gefilterd(D.ingredienten, q => i => i.key.includes(q) || i.gerechten.some(g => g.naam.toLowerCase().includes(q)));
    const gers = gefilterd(D.gerechten, q => g => g.naam.toLowerCase().includes(q) || g.delen.some(d => d.toLowerCase().includes(q)));
    const klaar = D.ingredienten.filter(i => afgevinkt[weekKey + '|' + i.key]).length;

    let body = '';
    if (view === 'ingredient') {
      body = ings.length ? ings.map(i => {
        const k = weekKey + '|' + i.key, aan = !!afgevinkt[k];
        const lijst = i.gerechten.slice(0, 4).map(g => `<b>${esc(g.naam.length > 60 ? g.naam.slice(0, 59) + '…' : g.naam)}</b> (${esc(dagLabel(g.dateStr))})`).join(' · ') + (i.gerechten.length > 4 ? ` · +${i.gerechten.length - 4} andere` : '');
        return `<div class="ig-row ${aan ? 'klaar' : ''}">
          <input type="checkbox" ${aan ? 'checked' : ''} onchange="window._igCheck('${esc(i.key).replace(/'/g, '&#39;')}',this.checked)">
          <div><div class="ig-naam">${esc(i.naam)}</div><div class="ig-gerechten">${lijst}</div></div>
          <div class="ig-meta">${i.gerechten.length} gerecht${i.gerechten.length === 1 ? '' : 'en'}<br>${i.persons} p</div>
        </div>`;
      }).join('') : `<div class="ig-leeg">Niets gevonden.</div>`;
    } else {
      const perDag = new Map();
      gers.forEach(g => { if (!perDag.has(g.dateStr)) perDag.set(g.dateStr, []); perDag.get(g.dateStr).push(g); });
      body = [...perDag.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([ds, l]) =>
        `<div class="ig-dag">${esc(dagLabel(ds))}</div>` + l.sort((a, b) => a.naam.localeCompare(b.naam, 'nl')).map(g =>
          `<div class="ig-g"><div class="t">${esc(g.naam)}<span>${g.persons} p · ${esc([...g.tabs].map(tabLabel).join(', '))}</span></div>
           <div class="ig-chips">${g.delen.map(d => `<span class="ig-chip">${esc(d)}</span>`).join('')}</div></div>`).join('')
      ).join('') || `<div class="ig-leeg">Niets gevonden.</div>`;
    }

    root.innerHTML = `
      <div class="ig-head">
        <h2>Ingrediëntenlijst</h2>
        <select onchange="window._igWeek(this.value)">${wk.map(([k, l]) => `<option value="${esc(k)}" ${k === weekKey ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <select onchange="window._igCat(this.value)"><option value="">Alle categorieën</option>${tabs.map(t => `<option value="${esc(t)}" ${t === cat ? 'selected' : ''}>${esc(tabLabel(t))}</option>`).join('')}</select>
        <div class="ig-tabs">
          <button class="${view === 'ingredient' ? 'act' : ''}" onclick="window._igView('ingredient')">Per ingrediënt</button>
          <button class="${view === 'gerecht' ? 'act' : ''}" onclick="window._igView('gerecht')">Per gerecht</button>
        </div>
        <input type="search" id="ig-zoek" placeholder="Zoeken…" value="${esc(zoek)}" oninput="window._igZoek(this.value)">
      </div>
      <div class="ig-info">
        <span><b>${D.ingredienten.length}</b> onderdelen in <b>${D.gerechten.length}</b> gerechten</span>
        ${view === 'ingredient' ? `<span>${klaar} afgevinkt</span>` : ''}
        <span class="sp"></span>
        <button class="btn" onclick="window._igKopieer()">Kopieer lijst</button>
        <button class="btn" onclick="window._igPrint()">Afdrukken</button>
        ${klaar ? `<button class="btn" onclick="window._igWis()">Vinkjes wissen</button>` : ''}
        <span id="ig-ok" style="font-size:12.5px;font-weight:600;color:#1F7A5A;opacity:0;transition:opacity .3s">Gekopieerd ✓</span>
      </div>
      <div class="ig-card" id="ig-body">${body}</div>`;
    if (zoek) { const z = document.getElementById('ig-zoek'); if (z) { z.focus(); z.setSelectionRange(zoek.length, zoek.length); } }
  }

  window._igWeek = function (k) { weekKey = k; render(); };
  window._igCat = function (v) { cat = v; render(); };
  window._igView = function (v) { view = v; render(); };
  window._igZoek = function (v) { zoek = v; render(); };
  window._igCheck = function (key, aan) {
    const k = weekKey + '|' + key;
    if (aan) afgevinkt[k] = 1; else delete afgevinkt[k];
    save(); render();
  };
  window._igWis = function () {
    Object.keys(afgevinkt).forEach(k => { if (k.startsWith(weekKey + '|')) delete afgevinkt[k]; });
    save(); render();
  };

  function tekstLijst() {
    const D = verzamel();
    const wl = (weken().find(([k]) => k === weekKey) || [])[1] || '';
    if (view === 'ingredient') return `Ingrediënten — ${wl}\n\n` + D.ingredienten.map(i => `${afgevinkt[weekKey + '|' + i.key] ? '[x]' : '[ ]'} ${i.naam}  (${i.gerechten.length}× · ${i.persons} p)`).join('\n');
    const perDag = new Map();
    D.gerechten.forEach(g => { if (!perDag.has(g.dateStr)) perDag.set(g.dateStr, []); perDag.get(g.dateStr).push(g); });
    return `Gerechten en onderdelen — ${wl}\n\n` + [...perDag.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([ds, l]) =>
      dagLabel(ds).toUpperCase() + '\n' + l.map(g => `- ${g.naam} (${g.persons} p): ${g.delen.join(', ')}`).join('\n')).join('\n\n');
  }
  window._igKopieer = async function () {
    const t = tekstLijst();
    try { await navigator.clipboard.writeText(t); } catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); }
    const ok = document.getElementById('ig-ok'); if (ok) { ok.style.opacity = 1; setTimeout(() => ok.style.opacity = 0, 2200); }
  };
  window._igPrint = function () {
    const w = window.open('', '_blank'); if (!w) { alert('Sta pop-ups toe om af te drukken.'); return; }
    w.document.write(`<!doctype html><meta charset="utf-8"><title>Ingrediëntenlijst</title><style>body{font:13px/1.5 Arial,sans-serif;margin:18mm;color:#111}pre{white-space:pre-wrap;font:13px/1.55 Arial,sans-serif}</style><pre>${esc(tekstLijst())}</pre>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 250);
  };

  window._renderIngredienten = render;
  document.addEventListener('DOMContentLoaded', () => {
    injectCSS(); load();
    if (typeof PAGE_TITLES !== 'undefined') PAGE_TITLES.ingredienten = 'Ingrediëntenlijst';
  });
  document.addEventListener('dataLoaded', () => { weekKey = ''; if (document.getElementById('page-ingredienten')?.classList.contains('active')) render(); });

  window._igTest = { onderdelen, verzamel, setWeek(k) { weekKey = k; } };
})();
