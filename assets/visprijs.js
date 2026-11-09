/* ══════════════════════════════════════════
   visprijs.js — wekelijkse prijsaanvraag vis bij de leverancier

   Zoekt de vis in de Excel (tab Vis + vis uit Small Plates), rekent de
   hoeveelheid per soort uit, en maakt daarvan een tekst (te kopiëren
   naar een e-mail) of een PDF voor Lobsterfish, Vanhauwaert of een
   andere leverancier.
   ══════════════════════════════════════════ */
(function () {
  'use strict';

  const KEY = 'hvw-vis-instellingen';

  // De vaste lijst van het huis (naam zoals je hem aan de leverancier vraagt) + herkenning in de Excel
  const VIS = [
    { id: 'zalm',      naam: 'Zalmfilet',                    re: /zalm/i },
    { id: 'griet',     naam: 'Grietfilet',                   re: /griet/i },
    { id: 'zeebaars',  naam: 'Zeebaars V-cut',               re: /zeebaars/i, eenheid: 'stuk' },
    { id: 'lotte',     naam: 'Lottefilet',                   re: /\blotte/i },
    { id: 'kabeljauw', naam: 'Kabeljauwhaasje 400+',         re: /kabeljauw/i },
    { id: 'dorade',    naam: 'Doradefilet V-cut',            re: /dorade/i, eenheid: 'stuk' },
    { id: 'leng',      naam: 'Lenghaasje',                   re: /\bleng(e|haas\w*|filet)?\b/i },
    { id: 'mosselen',  naam: 'Mosselen',                     re: /mossel/i },
    { id: 'garnalen',  naam: 'Garnalen',                     re: /garna(al|len)|scampi/i },
    { id: 'pladijs',   naam: 'Pladijsfilet',                 re: /pladijs|schol/i },
    { id: 'noordzee',  naam: 'Noordzeevis (koolvishaasje)',  re: /noordzeevis|koolvis/i },
    { id: 'tong',      naam: 'Tongfilet',                    re: /\btong(filet|etjes)?\b/i },
    { id: 'keila',     naam: 'Keila',                        re: /keila/i },
  ];
  // Wat er verder in de Excel kan staan maar niet in je vaste lijst: wordt apart aangeboden
  const EXTRA = [
    { id: 'x-coquille',    naam: 'Coquilles',    re: /coquille/i },
    { id: 'x-langoustine', naam: 'Langoustines', re: /langoustine/i },
    { id: 'x-kreeft',      naam: 'Kreeft',       re: /kreeft|lobster/i },
    { id: 'x-tonijn',      naam: 'Tonijn',       re: /tonijn/i },
    { id: 'x-oester',      naam: 'Oesters',      re: /oester/i },
    { id: 'x-inktvis',     naam: 'Inktvis',      re: /inktvis|calamar/i },
    { id: 'x-forel',       naam: 'Forel',        re: /forel/i },
    { id: 'x-heilbot',     naam: 'Heilbot',      re: /heilbot/i },
    { id: 'x-tarbot',      naam: 'Tarbot',       re: /tarbot/i },
    { id: 'x-zeeduivel',   naam: 'Zeeduivel',    re: /zeeduivel/i },
    { id: 'x-rog',         naam: 'Rog',          re: /\brog(ge|vleugel)?\b/i },
    { id: 'x-paling',      naam: 'Paling',       re: /paling/i },
    { id: 'x-kaviaar',     naam: 'Kaviaar',      re: /kaviaar/i },
  ];

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const num = (v, def) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) && n > 0 ? n : def; };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let inst = null;
  let weekKey = '';
  let lastBerekend = { items: [], extras: [] };

  function standaard() {
    return {
      leveranciers: [{ id: 'lobsterfish', naam: 'Lobsterfish', email: '' }, { id: 'vanhauwaert', naam: 'Vanhauwaert', email: '' }],
      gekozen: 'lobsterfish',
      handtekening: 'Huis van Wonterghem',
      metHoeveelheid: true,
      gVG: 110,         // gram vis per portie bij een voorgerecht (VG)
      gSP: 55,          // gram vis per portie bij small plates
      eenheid: {},      // { visId: 'kg' | 'stuk' } eigen keuze per soort
      aan: {},          // { 'weekKey|visId': true/false } eigen keuze; zonder keuze: mee als de vis die week in de Excel staat
      namen: {},        // { visId: 'aangepaste naam' }
      kg: {},           // { 'weekKey|visId': aantal } handmatig aangepast
      eigen: [],        // [{ id, naam, kg }]
      metDagen: true,   // per product vermelden voor welke dag(en) het nodig is
      tab: 'vraag',     // 'vraag' = prijsaanvraag · 'prijzen' = prijzen invoeren en bestellen
      prijzen: {},      // { weekKey: { leverancierId: { productId: prijs per kg of per stuk } } }
      keuze: {},        // { 'weekKey|productId': leverancierId } eigen keuze; zonder keuze wint de goedkoopste
    };
  }
  function load() {
    inst = standaard();
    try { Object.assign(inst, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
    if (!Array.isArray(inst.leveranciers) || !inst.leveranciers.length) inst.leveranciers = standaard().leveranciers;
    if (!inst.leveranciers.some(l => l.id === inst.gekozen)) inst.gekozen = inst.leveranciers[0].id;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(inst)); } catch (e) {} }

  /* ── hoeveelheden uit de Excel ── */
  function weken() {
    if (typeof allRows === 'undefined' || !allRows.length) return [];
    return [...new Map(allRows.filter(r => r.weekKey).map(r => [r.weekKey, r.weekLabel || r.weekKey])).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }
  function bereken() {
    const items = VIS.map(v => ({ id: v.id, naam: v.naam, eenheid: v.eenheid || 'kg', kg: 0, p: 0, bronnen: new Set(), n: 0, dagen: new Map() }));
    const addDag = (o, r, kg) => { const k = r.dateStr || ''; const d = o.dagen.get(k) || { kg: 0, p: 0 }; d.kg += kg; d.p += r.persons; o.dagen.set(k, d); };
    const extra = new Map();
    if (typeof allRows !== 'undefined') {
      allRows.forEach(r => {
        if (r.persons <= 0 || !r.name) return;
        if (r.tabId !== 'vis' && r.tabId !== 'small_plates') return;
        if (weekKey && r.weekKey !== weekKey) return;
        // Portiegrootte voor de visaanvraag: staat er een gewicht in de naam, dan geldt dat;
        // anders voorgerecht (VG) en small plates volgens de instelling op deze pagina
        const g = r.nameGrams ? r.nameGrams
          : r.sub === 'vg_warm' ? num(inst.gVG, 110)
          : r.tabId === 'small_plates' ? num(inst.gSP, 55)
          : (typeof getGrams === 'function' ? getGrams(r) : (r.defaultGrams || 0));
        const kg = r.persons * g / 1000;
        const hit = VIS.find(v => v.re.test(r.name));
        if (hit) {
          const it = items.find(i => i.id === hit.id);
          it.kg += kg; it.p += r.persons; it.n++; it.bronnen.add(r.base || r.name); addDag(it, r, kg);
          return;
        }
        // geen vaste vis: apart aanbieden (enkel vis-tab, of herkenbare extra's in small plates)
        const ex = EXTRA.find(e => e.re.test(r.name));
        if (!ex && r.tabId !== 'vis') return;
        const id = ex ? ex.id : 'x-' + (r.base || r.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
        const naam = ex ? ex.naam : (r.base || r.name).split(/\s+met\s+|,/i)[0].trim();
        if (!extra.has(id)) extra.set(id, { id, naam, eenheid: 'kg', kg: 0, p: 0, bronnen: new Set(), n: 0, dagen: new Map() });
        const e = extra.get(id); e.kg += kg; e.p += r.persons; e.n++; e.bronnen.add(r.base || r.name); addDag(e, r, kg);
      });
    }
    return { items, extras: [...extra.values()] };
  }
  // standaard afronden naar boven op een halve kilo; handmatig aangepaste waarden winnen
  const afronden = kg => Math.ceil(kg * 2 - 1e-9) / 2;
  // Standaard komt enkel de vis mee die deze week in de Excel staat; de rest kun je zelf aanvinken
  function isAan(it, isExtra) {
    const k = inst.aan[weekKey + '|' + it.id];
    if (k != null) return !!k;
    return !isExtra && it.n > 0;
  }
  const eenheidVan = it => inst.eenheid[it.id] || it.eenheid || 'kg';
  // per stuk = één portie/filet per gast (aantal porties); per kg = gewicht. Handmatige waarde geldt per eenheid.
  function kgVan(it) {
    const e = eenheidVan(it);
    const man = inst.kg[weekKey + '|' + it.id + '|' + e];
    if (man != null) return man;
    return e === 'stuk' ? (it.p > 0 ? it.p : 0) : (it.kg > 0 ? afronden(it.kg) : 0);
  }
  const naamVan = it => inst.namen[it.id] || it.naam;

  // Wat er effectief in de aanvraag komt
  const DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  function dagLabel(ds) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ds || '');
    if (!m) return ds ? String(ds) : 'datum onbekend';
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return `${DAGEN[d.getDay()]} ${+m[3]}/${+m[2]}`;
  }
  // per dag: hoeveel er nodig is (in dezelfde eenheid als het product), chronologisch
  function dagenVan(it) {
    const stuk = eenheidVan(it) === 'stuk';
    return [...it.dagen.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([ds, v]) => ({ ds, label: dagLabel(ds), hoev: stuk ? v.p : Math.round(v.kg * 10) / 10 }));
  }
  function lijst() {
    const uit = [];
    const voeg = (it, isExtra) => { if (isAan(it, isExtra)) uit.push({ id: it.id, naam: naamVan(it), kg: kgVan(it), eenheid: eenheidVan(it), dagen: dagenVan(it) }); };
    lastBerekend.items.forEach(it => voeg(it, false));
    lastBerekend.extras.forEach(it => voeg(it, true));
    inst.eigen.forEach(e => uit.push({ id: 'e-' + e.id, naam: e.naam, kg: e.kg || 0, eenheid: e.eenheid || 'kg', dagen: [] }));
    return uit.filter(x => (x.naam || '').trim());
  }

  /* ── prijzen en automatische keuze van de leverancier ── */
  const eur = n => '€ ' + n.toLocaleString('nl-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function prijsVan(levId, id) {
    const v = ((inst.prijzen[weekKey] || {})[levId] || {})[id];
    return v > 0 ? v : 0;
  }
  // eigen keuze, anders de goedkoopste leverancier die een prijs gaf (bij gelijke prijs de eerste in de lijst)
  function gekozenLev(p) {
    const man = inst.keuze[weekKey + '|' + p.id];
    if (man && inst.leveranciers.some(l => l.id === man)) return man;
    let best = null, bp = Infinity;
    inst.leveranciers.forEach(l => { const pr = prijsVan(l.id, p.id); if (pr > 0 && pr < bp - 1e-9) { bp = pr; best = l.id; } });
    return best;
  }
  function keuzes() {
    return lijst().map(p => { const lev = gekozenLev(p); const prijs = lev ? prijsVan(lev, p.id) : 0; return { p, lev, prijs, totaal: prijs * (p.kg || 0) }; });
  }

  const levNaam = () => (inst.leveranciers.find(l => l.id === inst.gekozen) || {}).naam || '';
  // "Week 45 · 02/11 – 08/11" → "week 45 (02/11 – 08/11)" voor in de tekst
  const weekLabel = () => {
    const l = ((weken().find(([k]) => k === weekKey) || [])[1] || '').replace(/\s+/g, ' ').trim();
    const m = /^week\s*(\d+)\s*[·\-]\s*(.+)$/i.exec(l);
    return m ? `week ${m[1]} (${m[2]})` : l.replace(/^Week/, 'week');
  };
  const fmtKg = kg => (kg % 1 === 0 ? String(kg) : kg.toLocaleString('nl-BE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const fmtHoev = r => `${fmtKg(r.kg)} ${r.eenheid === 'stuk' ? (r.kg === 1 ? 'stuk' : 'stuks') : 'kg'}`;

  const dagTxt = (d, eenheid) => inst.metHoeveelheid && d.hoev ? `${d.label} (${fmtKg(d.hoev)}${eenheid === 'stuk' ? ' st.' : ' kg'})` : d.label;
  const dagRegel = r => (inst.metDagen && r.dagen && r.dagen.length) ? [`  Nodig voor: ${r.dagen.map(d => dagTxt(d, r.eenheid)).join(' · ')}`] : [];

  function maakTekst() {
    const rijen = lijst();
    const wk = weekLabel();
    const regels = [];
    rijen.forEach(r => { regels.push(`- ${r.naam}${inst.metHoeveelheid && r.kg ? ` — ± ${fmtHoev(r)}` : ''}`); regels.push(...dagRegel(r)); });
    return [
      `Beste ${levNaam() || 'leverancier'},`,
      '',
      `Kunnen jullie ons de prijzen bezorgen voor ${wk || 'volgende week'}?`,
      '',
      ...(regels.length ? regels : ['(geen producten geselecteerd)']),
      '',
      'Graag de prijs per kg of per stuk (zoals hierboven vermeld), met vermelding van de herkomst en de levermogelijkheden.',
      '',
      'Alvast bedankt,',
      inst.handtekening || '',
    ].join('\n');
  }

  // Bestelling per leverancier: enkel de producten waar die de beste prijs (of je eigen keuze) heeft
  function bestelRijen(levId) {
    return keuzes().filter(k => k.lev === levId).map(k => ({ ...k.p, prijs: k.prijs }));
  }
  function maakBestelTekst(lev) {
    const rijen = bestelRijen(lev.id);
    const regels = [];
    rijen.forEach(r => {
      let s = `- ${r.naam}`;
      if (r.kg) s += ` — ${fmtHoev(r)}`;
      if (r.prijs) s += ` à ${eur(r.prijs)}/${r.eenheid === 'stuk' ? 'stuk' : 'kg'}`;
      regels.push(s, ...dagRegel(r));
    });
    return [
      `Beste ${lev.naam || 'leverancier'},`,
      '',
      `Bedankt voor jullie prijzen. Graag bestellen we voor ${weekLabel() || 'volgende week'}:`,
      '',
      ...(regels.length ? regels : ['(niets te bestellen)']),
      '',
      'Kunnen jullie de bestelling bevestigen?',
      '',
      'Alvast bedankt,',
      inst.handtekening || '',
    ].join('\n');
  }

  /* ── CSS ── */
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      .vp-tabs { display:inline-flex; background:rgba(20,21,26,.06); border-radius:11px; padding:3px; gap:2px; }
      .vp-tabs button { border:0; background:transparent; padding:7px 14px; border-radius:9px; font:600 13px 'Inter',sans-serif; cursor:pointer; color:#6B655E; }
      .vp-tabs button.act { background:#fff; color:#14151A; box-shadow:0 1px 3px rgba(20,21,26,.12); }
      .vp-dagen { grid-column:2 / 5; display:flex; flex-wrap:wrap; gap:5px; margin-top:-3px; }
      .vp-dag { font-size:11.5px; font-weight:600; background:var(--v-soft); color:var(--v-acc); border-radius:99px; padding:2px 9px; }
      .vp-tw { overflow-x:auto; }
      table.vp-tb { width:100%; border-collapse:collapse; font:13.5px 'Inter',sans-serif; }
      .vp-tb th { text-align:left; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; color:var(--v-ink3); padding:6px 8px; border-bottom:1px solid var(--v-line); white-space:nowrap; }
      .vp-tb td { padding:8px; border-top:1px solid var(--v-line); vertical-align:middle; }
      .vp-tb tr:first-child td { border-top:0; }
      .vp-tb td small { display:block; color:var(--v-ink3); font-size:11.5px; margin-top:1px; }
      .vp-tb input[type=number] { width:88px; box-sizing:border-box; padding:7px 8px; border:1px solid rgba(20,21,26,.15); border-radius:9px; font:14px 'Inter',sans-serif; text-align:right; }
      .vp-tb select { padding:7px 8px; border:1px solid rgba(20,21,26,.15); border-radius:9px; font:13px 'Inter',sans-serif; background:#fff; max-width:170px; }
      .vp-tb td.best input { border-color:#1F7A5A; background:#EAF6F0; font-weight:700; }
      .vp-tb td.num { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
      .vp-tb tfoot td { font-weight:700; border-top:2px solid var(--v-line); }
      .vp-sum { font-size:13.5px; margin-top:12px; padding:11px 14px; border-radius:11px; background:#EAF6F0; color:#14573F; }
      .vp-sum.neutraal { background:rgba(26,63,111,.07); color:#3A4764; }
      .vp-ord { border:1px solid var(--v-line); border-radius:13px; padding:12px 14px; margin-top:12px; }
      .vp-ord h4 { margin:0 0 8px; font:650 14px 'Inter',sans-serif; display:flex; gap:10px; align-items:baseline; flex-wrap:wrap; }
      .vp-ord h4 span { font-size:12px; font-weight:500; color:var(--v-ink3); }
      .vp-ord .vp-tekst { min-height:200px; }
      .vp-linkbtn { border:0; background:transparent; color:var(--v-acc); font:600 12px 'Inter',sans-serif; cursor:pointer; padding:0; text-decoration:underline; }
      #page-visprijs { --v-ink:#14151A; --v-ink3:#8B90A0; --v-line:rgba(20,21,26,.09); --v-acc:#1A3F6F; --v-soft:#EDF3FB; }
      .vp-head { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
      .vp-head h2 { margin:0; font:700 22px 'Inter',sans-serif; letter-spacing:-.02em; }
      .vp-head select { padding:9px 12px; border:1px solid rgba(20,21,26,.15); border-radius:10px; font:14px 'Inter',sans-serif; background:#fff; }
      .vp-sup { display:flex; gap:6px; flex-wrap:wrap; margin-left:auto; align-items:center; }
      .vp-chip { padding:8px 15px; border-radius:99px; border:0; background:#fff; box-shadow:0 1px 2px rgba(20,21,26,.06),0 0 0 1px rgba(20,21,26,.05); font:600 13.5px 'Inter',sans-serif; cursor:pointer; transition:all .2s; }
      .vp-chip:hover { transform:translateY(-1px); }
      .vp-chip.act { background:var(--v-acc); color:#fff; box-shadow:0 6px 14px -6px var(--v-acc); }
      .vp-chip.add { background:transparent; box-shadow:none; border:1.5px dashed rgba(20,21,26,.25); color:#6B655E; }
      .vp-grid { display:grid; grid-template-columns:minmax(0,1.15fr) minmax(0,1fr); gap:16px; align-items:start; }
      @media (max-width: 980px) { .vp-grid { grid-template-columns:1fr; } }
      .vp-card { background:#fff; border-radius:16px; box-shadow:0 1px 2px rgba(20,21,26,.05),0 0 0 1px rgba(20,21,26,.04); padding:16px 18px; margin-bottom:14px; }
      .vp-card h3 { margin:0 0 4px; font:650 15px 'Inter',sans-serif; display:flex; align-items:baseline; gap:10px; }
      .vp-card h3 span { font-size:12px; font-weight:500; color:var(--v-ink3); }
      .vp-row { display:grid; grid-template-columns:24px 1fr 96px 84px; gap:10px; align-items:center; padding:8px 0; border-top:1px solid var(--v-line); }
      .vp-row:first-of-type { border-top:0; }
      .vp-row input[type=text], .vp-row input[type=number] { width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid rgba(20,21,26,.15); border-radius:9px; font:14px 'Inter',sans-serif; }
      .vp-row input[type=number] { text-align:right; }
      .vp-row input[type=checkbox] { width:18px; height:18px; accent-color:var(--v-acc); cursor:pointer; }
      .vp-row.uit input[type=text], .vp-row.uit input[type=number] { opacity:.4; }
      .vp-bron { grid-column:2 / 4; font-size:11.5px; color:var(--v-ink3); margin-top:-4px; }
      .vp-leeg { color:var(--v-ink3); font-size:13px; padding:6px 0; }
      .vp-x { border:0; background:transparent; cursor:pointer; color:#B8B3AD; font-size:17px; border-radius:6px; }
      .vp-x:hover { background:#FDF1ED; color:#C0392B; }
      .vp-add { display:grid; grid-template-columns:1fr 90px 84px auto; gap:8px; margin-top:10px; }
      .vp-add input { padding:8px 10px; border:1px solid rgba(20,21,26,.15); border-radius:9px; font:14px 'Inter',sans-serif; min-width:0; }
      .vp-opt { display:flex; gap:14px; flex-wrap:wrap; align-items:center; font-size:13px; margin-top:10px; }
      .vp-opt input[type=text] { padding:7px 10px; border:1px solid rgba(20,21,26,.15); border-radius:9px; font:13px 'Inter',sans-serif; }
      .vp-tekst { width:100%; box-sizing:border-box; min-height:330px; padding:14px; border:1px solid rgba(20,21,26,.15); border-radius:12px; font:13.5px/1.55 'Inter',sans-serif; resize:vertical; background:#FBFBFC; }
      .vp-acts { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; }
      .vp-ok { font-size:12.5px; font-weight:600; color:#1F7A5A; margin-left:6px; opacity:0; transition:opacity .3s; } .vp-ok.on { opacity:1; }
      .vp-note { font-size:12.5px; color:#6B655E; background:rgba(26,63,111,.07); border-radius:10px; padding:9px 12px; margin-bottom:12px; }
    `;
    document.head.appendChild(s);
  }

  /* ── scherm ── */
  function render() {
    const root = document.getElementById('page-visprijs');
    if (!root) return;
    if (!inst) load();
    const wk = weken();
    if (!wk.some(([k]) => k === weekKey)) weekKey = wk.length ? wk[0][0] : '';
    lastBerekend = bereken();

    if (!wk.length) {
      root.innerHTML = `<div class="vp-head"><h2>Vis prijsaanvraag</h2></div>
        <div class="vp-card"><div class="vp-leeg">Upload eerst de Excel van de week. Daarna staat hier alle vis die nodig is, klaar om aan de leverancier te vragen.</div></div>`;
      return;
    }

    const items = [...lastBerekend.items].sort((a, b) => (b.n > 0) - (a.n > 0));   // eerst wat deze week nodig is
    root.innerHTML = `
      <div class="vp-head">
        <h2>Vis prijsaanvraag</h2>
        <select onchange="window._vpWeek(this.value)">${wk.map(([k, l]) => `<option value="${esc(k)}" ${k === weekKey ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <div class="vp-tabs">
          <button class="${inst.tab !== 'prijzen' ? 'act' : ''}" onclick="window._vpTab('vraag')">1 · Prijzen vragen</button>
          <button class="${inst.tab === 'prijzen' ? 'act' : ''}" onclick="window._vpTab('prijzen')">2 · Prijzen &amp; bestellen</button>
        </div>
        <div class="vp-sup">
          ${inst.tab === 'prijzen' ? '' : inst.leveranciers.map(l => `<button class="vp-chip ${l.id === inst.gekozen ? 'act' : ''}" onclick="window._vpLev('${l.id}')">${esc(l.naam)}</button>`).join('')}
          <button class="vp-chip add" onclick="window._vpLevAdd()">+ leverancier</button>
        </div>
      </div>
      ${inst.tab === 'prijzen' ? prijzenHtml() : `
      <div class="vp-grid">
        <div>
          <div class="vp-card">
            <h3>Vis voor deze week <span>enkel wat in de Excel staat is aangevinkt · vink zelf meer aan</span></h3>
            <div class="vp-opt" style="margin:6px 0 8px">
              <label>Gram per portie · VG <input type="number" min="1" step="5" value="${inst.gVG}" style="width:64px;text-align:right" onchange="window._vpGram('gVG',this.value)"></label>
              <label>Small plates <input type="number" min="1" step="5" value="${inst.gSP}" style="width:64px;text-align:right" onchange="window._vpGram('gSP',this.value)"></label>
              <span style="font-size:11.5px;color:#8B90A0">Staat er een gewicht in de gerechtnaam, dan geldt dat.</span>
            </div>
            ${items.map(it => rij(it, false)).join('')}
            ${lastBerekend.extras.length ? `<div style="margin:14px 0 2px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#8B90A0">Ook in de Excel gevonden (niet in je vaste lijst)</div>${lastBerekend.extras.map(it => rij(it, true)).join('')}` : ''}
          </div>
          <div class="vp-card">
            <h3>Eigen product <span>iets dat niet in de Excel staat</span></h3>
            ${inst.eigen.map(e => `<div class="vp-row"><span></span><input type="text" value="${esc(e.naam)}" onchange="window._vpEigen('${e.id}','naam',this.value)"><input type="number" step="0.5" min="0" value="${e.kg || ''}" placeholder="hoeveelheid" onchange="window._vpEigen('${e.id}','kg',this.value)"><select onchange="window._vpEigen('${e.id}','eenheid',this.value)"><option value="kg" ${(e.eenheid || 'kg') === 'kg' ? 'selected' : ''}>kg</option><option value="stuk" ${e.eenheid === 'stuk' ? 'selected' : ''}>stuks</option></select><button class="vp-x" title="Verwijderen" onclick="window._vpEigenDel('${e.id}')">×</button></div>`).join('')}
            <div class="vp-add"><input id="vp-nieuw-naam" placeholder="bv. Tarbot" onkeydown="if(event.key==='Enter')window._vpEigenAdd()"><input id="vp-nieuw-kg" type="number" step="0.5" min="0" placeholder="aantal"><select id="vp-nieuw-eenheid" style="padding:8px;border:1px solid rgba(20,21,26,.15);border-radius:9px;font:14px Inter,sans-serif"><option value="kg">kg</option><option value="stuk">stuks</option></select><button class="btn" onclick="window._vpEigenAdd()">+ Toevoegen</button></div>
          </div>
        </div>

        <div>
          <div class="vp-card">
            <h3>Aanvraag voor ${esc(levNaam())} <span>${lijst().length} producten</span></h3>
            <div class="vp-opt">
              <label><input type="checkbox" ${inst.metHoeveelheid ? 'checked' : ''} onchange="window._vpOpt('metHoeveelheid',this.checked)"> Hoeveelheden vermelden</label>
              <label><input type="checkbox" ${inst.metDagen ? 'checked' : ''} onchange="window._vpOpt('metDagen',this.checked)"> Dagen vermelden</label>
              <label>Afsluiting: <input type="text" value="${esc(inst.handtekening)}" onchange="window._vpOpt('handtekening',this.value)"></label>
            </div>
            <textarea id="vp-tekst" class="vp-tekst" style="margin-top:12px">${esc(maakTekst())}</textarea>
            <div class="vp-acts">
              <button class="btn btn-gold" onclick="window._vpKopieer()">Kopieer tekst</button>
              <button class="btn btn-primary" onclick="window._vpPdf()">PDF downloaden</button>
              <button class="btn" onclick="window._vpMail()">E-mail openen</button>
              <span id="vp-ok" class="vp-ok">Gekopieerd ✓</span>
            </div>
          </div>
        </div>
      </div>`}`;
    prijzenUpdate();
  }

  /* ── tab 2: prijzen invoeren, automatisch de goedkoopste kiezen, bestellen ── */
  const unitTxt = e => e === 'stuk' ? 'stuk' : 'kg';

  /* ── prijzen uit de tekst van een mail halen ── */
  let inleesMelding = '', inleesLev = '';
  const getalVan = s => { s = String(s).replace(/\s/g, ''); s = (/,/.test(s) && /\./.test(s)) ? s.replace(/\./g, '').replace(',', '.') : s.replace(',', '.'); return parseFloat(s); };
  // de prijs op één regel: eerst een getal bij een €-teken, anders een los getal dat geen gewicht/aantal/maat is
  function prijsOpRegel(l) {
    const m = /(?:€|eur(?:o)?\b)\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:€|eur(?:o)?\b)/i.exec(l);
    if (m) { const n = getalVan(m[1] || m[2]); if (n > 0) return n; }
    const kand = []; const re = /\d+(?:[.,]\d+)?/g; let x;
    while ((x = re.exec(l))) {
      const voor = l.slice(Math.max(0, x.index - 2), x.index), na = l.slice(x.index + x[0].length);
      if (/^\s*(kg|g\b|gr\b|gram|stuks?\b|st\b|cm|%|\+|x\b|-\s*\d|\/\s*\d)/i.test(na)) continue;   // gewicht, aantal, maat (400+, 300-400 g)
      if (/\d\s*-\s*$|v-?$/i.test(voor)) continue;
      const n = getalVan(x[0]); if (n > 0 && n < 1000) kand.push({ n, dec: /[.,]/.test(x[0]) });
    }
    const metDec = kand.filter(k => k.dec);
    return (metDec.length ? metDec : kand).length ? (metDec.length ? metDec : kand).slice(-1)[0].n : 0;
  }
  function leesPrijzen(tekst, ps) {
    const zoek = ps.map(p => { const v = VIS.find(z => z.id === p.id) || EXTRA.find(z => z.id === p.id); const naam = p.naam.toLowerCase(); return { p, test: l => (v && v.re.test(l)) || l.toLowerCase().includes(naam) }; });
    const gevonden = new Map(), onbekend = [];
    let wacht = null;
    String(tekst).split(/\r?\n/).forEach(raw => {
      const l = raw.replace(/^[\s>\-–•*]+/, '').trim(); if (!l) return;
      const z = zoek.find(s => s.test(l));
      const pr = prijsOpRegel(l);
      if (z) { if (pr) { gevonden.set(z.p.id, { p: z.p, pr }); wacht = null; } else wacht = z.p; }
      else if (wacht && pr) { gevonden.set(wacht.id, { p: wacht, pr }); wacht = null; }
      else if (pr && /€|eur/i.test(l) && /[a-z]{4,}/i.test(l)) onbekend.push(l.length > 60 ? l.slice(0, 59) + '…' : l);
    });
    return { gevonden, onbekend };
  }
  window._vpInlezen = function () {
    const tekst = document.getElementById('vp-mail')?.value || '';
    const levId = document.getElementById('vp-mail-lev')?.value || inst.gekozen;
    inleesLev = levId;
    const lev = inst.leveranciers.find(l => l.id === levId) || {};
    if (!tekst.trim()) { inleesMelding = 'Plak eerst de tekst van de mail.'; render(); return; }
    const ps = lijst();
    const { gevonden, onbekend } = leesPrijzen(tekst, ps);
    const w = (inst.prijzen[weekKey] = inst.prijzen[weekKey] || {}), l = (w[levId] = w[levId] || {});
    gevonden.forEach(({ p, pr }, id) => { l[id] = pr; });
    save();
    const mist = ps.filter(p => !gevonden.has(p.id));
    inleesMelding = gevonden.size
      ? `<b>${gevonden.size === 1 ? '1 prijs' : gevonden.size + ' prijzen'} ingelezen voor ${esc(lev.naam || '')}:</b> ${[...gevonden.values()].map(({ p, pr }) => `${esc(p.naam)} ${eur(pr)}/${unitTxt(p.eenheid)}`).join(' · ')}.`
        + (mist.length ? `<br>Geen prijs gevonden voor: ${mist.map(p => esc(p.naam)).join(', ')}.` : '')
        + (onbekend.length ? `<br>Regels met een prijs maar zonder herkende vis: ${onbekend.map(esc).join(' | ')}` : '')
        + '<br>Controleer de prijzen in de tabel hieronder en pas aan waar nodig.'
      : `Geen prijzen herkend.${onbekend.length ? ' Regels met een prijs maar zonder herkende vis: ' + onbekend.map(esc).join(' | ') : ' Staat de naam van de vis in de tekst?'}`;
    render();
  };
  function prijzenHtml() {
    const ps = lijst();
    const levs = inst.leveranciers;
    if (!ps.length) return `<div class="vp-card"><div class="vp-leeg">Er is voor deze week nog geen vis geselecteerd. Vink eerst op tab 1 aan wat je nodig hebt.</div></div>`;
    return `
      <div class="vp-card">
        <h3>Prijzen uit een mail inlezen <span>plak de tekst van het antwoord · de app zoekt de prijs bij elke vis</span></h3>
        <div class="vp-opt" style="margin:8px 0">
          <label>Van welke leverancier? <select id="vp-mail-lev" style="padding:7px 8px;border:1px solid rgba(20,21,26,.15);border-radius:9px;font:13px Inter,sans-serif">${levs.map(l => `<option value="${l.id}" ${l.id === (inleesLev || inst.gekozen) ? 'selected' : ''}>${esc(l.naam)}</option>`).join('')}</select></label>
        </div>
        <textarea id="vp-mail" class="vp-tekst" style="min-height:110px" placeholder="Plak hier de mail, bv.&#10;Zalmfilet 24,50 €/kg&#10;Kabeljauwhaasje 400+ € 18,90&#10;Zeebaars V-cut 6,80 per stuk"></textarea>
        <div class="vp-acts"><button class="btn btn-primary" onclick="window._vpInlezen()">Prijzen inlezen</button></div>
        ${inleesMelding ? `<div class="vp-sum neutraal" style="margin-top:10px">${inleesMelding}</div>` : ''}
      </div>
      <div class="vp-card">
        <h3>Prijzen van de leveranciers<span>vul de prijs per kg (of per stuk) in · de goedkoopste wordt automatisch gekozen</span></h3>
        <div class="vp-tw"><table class="vp-tb">
          <thead><tr><th>Product</th>${levs.map(l => `<th>${esc(l.naam)}</th>`).join('')}<th>Bestellen bij</th><th style="text-align:right">Kost</th></tr></thead>
          <tbody>
            ${ps.map(p => `<tr data-pid="${esc(p.id)}">
              <td>${esc(p.naam)}<small>${p.kg ? esc(fmtHoev(p)) : ''}${p.dagen.length ? (p.kg ? ' · ' : '') + esc(p.dagen.map(d => d.label).join(', ')) : ''}</small></td>
              ${levs.map(l => `<td data-lid="${l.id}"><input type="number" class="vp-pi" step="0.01" min="0" value="${prijsVan(l.id, p.id) || ''}" placeholder="€/${unitTxt(p.eenheid)}" onchange="window._vpPrijs('${l.id}','${esc(p.id)}',this.value)"></td>`).join('')}
              <td><select class="vp-keuze" onchange="window._vpKeuze('${esc(p.id)}',this.value)"></select></td>
              <td class="num vp-kost"></td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr><td>Totaal van de bestelling</td>${levs.map(l => `<td class="num" data-tot="${l.id}"></td>`).join('')}<td></td><td class="num" id="vp-grand"></td></tr></tfoot>
        </table></div>
        <div id="vp-sum"></div>
      </div>
      <div id="vp-orders"></div>`;
  }
  // enkel de afhankelijke stukken bijwerken (zodat je gewoon door de prijsvelden kunt tabben)
  function prijzenUpdate() {
    if (inst.tab !== 'prijzen') return;
    const ks = keuzes();
    const levs = inst.leveranciers;
    const tot = {}; let grand = 0, zonder = 0;
    ks.forEach(k => {
      const tr = document.querySelector(`#page-visprijs tr[data-pid="${CSS.escape(k.p.id)}"]`); if (!tr) return;
      tr.querySelectorAll('td[data-lid]').forEach(td => td.classList.toggle('best', td.dataset.lid === k.lev && k.prijs > 0));
      const man = inst.keuze[weekKey + '|' + k.p.id] || '';
      const auto = (() => { let b = null, bp = Infinity; levs.forEach(l => { const pr = prijsVan(l.id, k.p.id); if (pr > 0 && pr < bp - 1e-9) { bp = pr; b = l; } }); return b; })();
      tr.querySelector('.vp-keuze').innerHTML = `<option value="">Automatisch${auto ? ' · ' + esc(auto.naam) : ' · nog geen prijs'}</option>` + levs.map(l => `<option value="${l.id}" ${man === l.id ? 'selected' : ''}>${esc(l.naam)}</option>`).join('');
      tr.querySelector('.vp-kost').textContent = k.totaal ? eur(k.totaal) : '';
      if (k.lev) { tot[k.lev] = (tot[k.lev] || 0) + k.totaal; grand += k.totaal; }
      if (!k.lev || !k.prijs) zonder++;
    });
    levs.forEach(l => { const td = document.querySelector(`#page-visprijs td[data-tot="${l.id}"]`); if (td) td.textContent = tot[l.id] ? eur(tot[l.id]) : ''; });
    const g = document.getElementById('vp-grand'); if (g) g.textContent = grand ? eur(grand) : '';

    // vergelijking met alles bij één leverancier bestellen
    let alle = null;
    levs.forEach(l => { if (ks.every(k => prijsVan(l.id, k.p.id) > 0)) { const t = ks.reduce((s, k) => s + prijsVan(l.id, k.p.id) * (k.p.kg || 0), 0); if (!alle || t < alle.t) alle = { l, t }; } });
    const s = document.getElementById('vp-sum');
    if (s) {
      if (zonder) s.innerHTML = `<div class="vp-sum neutraal">Nog voor ${zonder} product${zonder === 1 ? '' : 'en'} geen prijs of leverancier. Die staan niet in de bestellingen hieronder.</div>`;
      else if (alle && alle.t - grand > 0.005 && Object.keys(tot).length > 1) s.innerHTML = `<div class="vp-sum">Door per product de goedkoopste te kiezen betaal je <b>${eur(grand)}</b>. Alles bij ${esc(alle.l.naam)} zou ${eur(alle.t)} kosten: je bespaart <b>${eur(alle.t - grand)}</b>.</div>`;
      else s.innerHTML = grand ? `<div class="vp-sum neutraal">Totaal van de bestelling: <b>${eur(grand)}</b>.</div>` : '';
    }

    // bestelling per leverancier (met tekst, PDF en mail)
    const o = document.getElementById('vp-orders');
    if (o) {
      o.innerHTML = levs.map(l => {
        const rijen = bestelRijen(l.id); if (!rijen.length) return '';
        const som = rijen.reduce((a, r) => a + (r.prijs || 0) * (r.kg || 0), 0);
        return `<div class="vp-card"><h3>Bestelling bij ${esc(l.naam)} <span>${rijen.length} product${rijen.length === 1 ? '' : 'en'}${som ? ' · ' + eur(som) : ''}</span></h3>
          <textarea id="vp-bt-${l.id}" class="vp-tekst" style="min-height:210px">${esc(maakBestelTekst(l))}</textarea>
          <div class="vp-acts">
            <button class="btn btn-gold" onclick="window._vpBestelKopieer('${l.id}')">Kopieer tekst</button>
            <button class="btn btn-primary" onclick="window._vpBestelPdf('${l.id}')">PDF downloaden</button>
            <button class="btn" onclick="window._vpBestelMail('${l.id}')">E-mail openen</button>
            <button class="vp-linkbtn" onclick="window._vpLevMail('${l.id}')">${l.email ? esc(l.email) + ' · wijzigen' : 'e-mailadres instellen'}</button>
            <span id="vp-ok-${l.id}" class="vp-ok">Gekopieerd ✓</span>
          </div></div>`;
      }).join('') || `<div class="vp-card"><div class="vp-leeg">Vul prijzen in en de bestellingen per leverancier verschijnen hier.</div></div>`;
    }
  }

  function rij(it, isExtra) {
    const aan = isAan(it, isExtra);
    const kg = kgVan(it);
    const bron = [...it.bronnen];
    return `<div class="vp-row ${aan ? '' : 'uit'}">
      <input type="checkbox" ${aan ? 'checked' : ''} onchange="window._vpAan('${it.id}', this.checked, ${isExtra})">
      <input type="text" value="${esc(naamVan(it))}" onchange="window._vpNaam('${it.id}', this.value)">
      <input type="number" step="${eenheidVan(it) === 'stuk' ? 1 : 0.5}" min="0" value="${kg || ''}" placeholder="${eenheidVan(it) === 'stuk' ? 'stuks' : 'kg'}" onchange="window._vpKg('${it.id}', this.value)">
      <select onchange="window._vpEenheid('${it.id}', this.value)"><option value="kg" ${eenheidVan(it) === 'kg' ? 'selected' : ''}>kg</option><option value="stuk" ${eenheidVan(it) === 'stuk' ? 'selected' : ''}>stuks</option></select>
      ${it.n ? `<div class="vp-bron">${it.p} porties · ${it.n} gerecht${it.n === 1 ? '' : 'en'} · ${esc(bron.slice(0, 2).map(b => b.length > 46 ? b.slice(0, 45) + '…' : b).join(' · '))}${bron.length > 2 ? ' …' : ''}</div>` : `<div class="vp-bron">Niet nodig deze week — vink aan om toch mee te vragen</div>`}
      ${it.dagen.size ? `<div class="vp-dagen">${dagenVan(it).map(d => `<span class="vp-dag">${esc(d.label)} · ${fmtKg(d.hoev)} ${eenheidVan(it) === 'stuk' ? 'st.' : 'kg'}</span>`).join('')}</div>` : ''}
    </div>`;
  }

  function herteken() { const t = document.getElementById('vp-tekst'); if (t) t.value = maakTekst(); const h = document.querySelector('.vp-card h3 span'); }

  window._vpWeek = function (k) { weekKey = k; render(); };
  window._vpTab = function (t) { inst.tab = t; save(); render(); };
  window._vpPrijs = function (levId, id, v) {
    const n = parseFloat(String(v).replace(',', '.'));
    const w = (inst.prijzen[weekKey] = inst.prijzen[weekKey] || {}), l = (w[levId] = w[levId] || {});
    if (isFinite(n) && n > 0) l[id] = n; else delete l[id];
    save(); prijzenUpdate();
  };
  window._vpKeuze = function (id, levId) {
    if (levId) inst.keuze[weekKey + '|' + id] = levId; else delete inst.keuze[weekKey + '|' + id];
    save(); prijzenUpdate();
  };
  window._vpLevMail = function (id) {
    const l = inst.leveranciers.find(x => x.id === id); if (!l) return;
    const e = prompt(`E-mailadres van ${l.naam}?`, l.email || ''); if (e == null) return;
    l.email = e.trim(); save(); prijzenUpdate();
  };
  window._vpBestelKopieer = async function (id) {
    const t = document.getElementById('vp-bt-' + id); if (!t) return;
    try { await navigator.clipboard.writeText(t.value); } catch (e) { t.select(); document.execCommand('copy'); }
    const ok = document.getElementById('vp-ok-' + id); if (ok) { ok.classList.add('on'); setTimeout(() => ok.classList.remove('on'), 2200); }
  };
  window._vpBestelMail = function (id) {
    const l = inst.leveranciers.find(x => x.id === id) || {};
    const t = document.getElementById('vp-bt-' + id)?.value || maakBestelTekst(l);
    location.href = `mailto:${encodeURIComponent(l.email || '')}?subject=${encodeURIComponent(`Bestelling vis ${weekLabel() ? '— ' + weekLabel() : ''}`.trim())}&body=${encodeURIComponent(t)}`;
  };
  window._vpBestelPdf = function (id) {
    const l = inst.leveranciers.find(x => x.id === id); if (!l) return;
    pdfMaak({ titel: 'Bestelling vis', lev: l.naam, rijen: bestelRijen(id), bestelling: true });
  };
  window._vpLev = function (id) { inst.gekozen = id; save(); render(); };
  window._vpLevAdd = function () {
    const naam = (prompt('Naam van de leverancier?') || '').trim(); if (!naam) return;
    const email = (prompt('E-mailadres (optioneel, voor de knop "E-mail openen")?') || '').trim();
    const l = { id: uid(), naam, email }; inst.leveranciers.push(l); inst.gekozen = l.id; save(); render();
  };
  window._vpAan = function (id, aan) { inst.aan[weekKey + '|' + id] = !!aan; save(); render(); };
  window._vpNaam = function (id, v) { inst.namen[id] = v.trim(); save(); render(); };
  window._vpKg = function (id, v) {
    const n = parseFloat(String(v).replace(',', '.'));
    const it = lastBerekend.items.concat(lastBerekend.extras).find(x => x.id === id);
    const sleutel = weekKey + '|' + id + '|' + (it ? eenheidVan(it) : 'kg');
    if (isFinite(n) && n >= 0) inst.kg[sleutel] = n; else delete inst.kg[sleutel];
    save(); render();
  };
  window._vpEenheid = function (id, v) { inst.eenheid[id] = v; save(); render(); };
  window._vpOpt = function (k, v) { inst[k] = v; save(); herteken(); };
  window._vpGram = function (k, v) { inst[k] = num(v, k === 'gVG' ? 110 : 55); save(); render(); };
  window._vpEigenAdd = function () {
    const naam = (document.getElementById('vp-nieuw-naam')?.value || '').trim(); if (!naam) { document.getElementById('vp-nieuw-naam')?.focus(); return; }
    const kg = parseFloat(String(document.getElementById('vp-nieuw-kg')?.value || '').replace(',', '.')) || 0;
    inst.eigen.push({ id: uid(), naam, kg, eenheid: document.getElementById('vp-nieuw-eenheid')?.value || 'kg' }); save(); render();
  };
  window._vpEigen = function (id, f, v) { const e = inst.eigen.find(x => x.id === id); if (!e) return; e[f] = f === 'kg' ? (parseFloat(String(v).replace(',', '.')) || 0) : (f === 'eenheid' ? v : v.trim()); save(); render(); };
  window._vpEigenDel = function (id) { inst.eigen = inst.eigen.filter(x => x.id !== id); save(); render(); };

  /* ── uitvoer ── */
  window._vpKopieer = async function () {
    const tekst = document.getElementById('vp-tekst')?.value || maakTekst();
    try { await navigator.clipboard.writeText(tekst); }
    catch (e) { const t = document.getElementById('vp-tekst'); t.select(); document.execCommand('copy'); }
    const ok = document.getElementById('vp-ok'); if (ok) { ok.classList.add('on'); setTimeout(() => ok.classList.remove('on'), 2200); }
  };
  window._vpMail = function () {
    const l = inst.leveranciers.find(x => x.id === inst.gekozen) || {};
    const onderwerp = `Prijsaanvraag vis ${weekLabel() ? '— ' + weekLabel() : ''}`.trim();
    const tekst = document.getElementById('vp-tekst')?.value || maakTekst();
    location.href = `mailto:${encodeURIComponent(l.email || '')}?subject=${encodeURIComponent(onderwerp)}&body=${encodeURIComponent(tekst)}`;
  };
  window._vpPdf = function () {
    pdfMaak({ titel: 'Prijsaanvraag vis', lev: levNaam(), rijen: lijst(), bestelling: false });
  };
  // Eén PDF-opmaak voor de prijsaanvraag (met lege prijsvakjes) én de bestelling (met prijs)
  async function pdfMaak(o) {
    try {
      if (!window.jspdf) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      const { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const M = 16, W = 210; let y = 20;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(20, 21, 26); doc.text(o.titel, M, y); y += 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(110, 115, 130);
      doc.text(`${o.lev}${weekLabel() ? '  ·  ' + weekLabel() : ''}`, M, y); y += 4;
      doc.setDrawColor(26, 63, 111); doc.setLineWidth(0.6); doc.line(M, y, W - M, y); y += 9;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(139, 144, 160);
      doc.text('PRODUCT', M, y);
      if (inst.metHoeveelheid || o.bestelling) doc.text(o.bestelling ? 'HOEVEELHEID' : '± HOEVEELHEID', 118, y, { align: 'right' });
      doc.text(o.bestelling ? 'PRIJS (€)' : 'PRIJS (€) PER KG / STUK', W - M, y, { align: 'right' }); y += 3;
      doc.setDrawColor(220); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 7;
      o.rijen.forEach(r => {
        const dagen = (inst.metDagen && r.dagen && r.dagen.length) ? 'Nodig voor: ' + r.dagen.map(d => dagTxt(d, r.eenheid)).join(' · ') : '';
        if (y > 266) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20, 21, 26); doc.text(r.naam, M, y);
        if ((inst.metHoeveelheid || o.bestelling) && r.kg) { doc.setFont('helvetica', 'normal'); doc.text(fmtHoev(r), 118, y, { align: 'right' }); }
        if (o.bestelling) { if (r.prijs) { doc.setFont('helvetica', 'normal'); doc.text(`${eur(r.prijs)} / ${r.eenheid === 'stuk' ? 'stuk' : 'kg'}`, W - M, y, { align: 'right' }); } }
        else { doc.setDrawColor(190); doc.line(138, y + 1, W - M, y + 1); }
        if (dagen) { y += 4.8; doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110, 115, 130); doc.text(dagen, M, y, { maxWidth: 160 }); }
        y += 9.5;
      });
      y += 6; if (y > 262) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(90, 95, 110);
      const slot = o.bestelling ? 'Graag een bevestiging van de bestelling.' : 'Graag de prijs per kg of per stuk (zoals vermeld), met de herkomst en de levermogelijkheden.';
      doc.splitTextToSize(slot, W - 2 * M).forEach(l => { doc.text(l, M, y); y += 5; });
      y += 4; doc.text(inst.handtekening || '', M, y);
      const n = doc.getNumberOfPages();
      for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(150); doc.text(`Huis van Wonterghem · ${new Date().toLocaleDateString('nl-BE')}`, M, 290); doc.text(`${i} / ${n}`, W - M, 290, { align: 'right' }); }
      doc.save(`HVW_${o.bestelling ? 'Bestelling' : 'Prijsaanvraag'}-vis_${String(o.lev).replace(/\W+/g, '')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) { alert('PDF maken mislukt: ' + (e.message || e)); console.error(e); }
  }
  window._renderVisprijs = render;
  document.addEventListener('DOMContentLoaded', () => {
    injectCSS(); load();
    if (typeof PAGE_TITLES !== 'undefined') PAGE_TITLES.visprijs = 'Vis prijsaanvraag';
  });
  document.addEventListener('dataLoaded', () => { weekKey = ''; if (document.getElementById('page-visprijs')?.classList.contains('active')) render(); });

  // voor tests
  window._vpTest = { bereken: () => (lastBerekend = bereken()), maakTekst, lijst, keuzes, maakBestelTekst, dagenVan, leesPrijzen, prijsOpRegel, get inst() { return inst; }, setWeek(k) { weekKey = k; } };
})();
