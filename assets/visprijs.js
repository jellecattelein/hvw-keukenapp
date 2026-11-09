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
      uit: {},          // { visId: true } = niet meenemen
      namen: {},        // { visId: 'aangepaste naam' }
      kg: {},           // { 'weekKey|visId': aantal } handmatig aangepast
      extraAan: {},     // { extraId: true }
      eigen: [],        // [{ id, naam, kg }]
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
    const items = VIS.map(v => ({ id: v.id, naam: v.naam, eenheid: v.eenheid || 'kg', kg: 0, p: 0, bronnen: new Set(), n: 0 }));
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
          it.kg += kg; it.p += r.persons; it.n++; it.bronnen.add(r.base || r.name);
          return;
        }
        // geen vaste vis: apart aanbieden (enkel vis-tab, of herkenbare extra's in small plates)
        const ex = EXTRA.find(e => e.re.test(r.name));
        if (!ex && r.tabId !== 'vis') return;
        const id = ex ? ex.id : 'x-' + (r.base || r.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
        const naam = ex ? ex.naam : (r.base || r.name).split(/\s+met\s+|,/i)[0].trim();
        if (!extra.has(id)) extra.set(id, { id, naam, eenheid: 'kg', kg: 0, p: 0, bronnen: new Set(), n: 0 });
        const e = extra.get(id); e.kg += kg; e.p += r.persons; e.n++; e.bronnen.add(r.base || r.name);
      });
    }
    return { items, extras: [...extra.values()] };
  }
  // standaard afronden naar boven op een halve kilo; handmatig aangepaste waarden winnen
  const afronden = kg => Math.ceil(kg * 2 - 1e-9) / 2;
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
  function lijst() {
    const uit = [];
    lastBerekend.items.forEach(it => { if (!inst.uit[it.id]) uit.push({ naam: naamVan(it), kg: kgVan(it), eenheid: eenheidVan(it) }); });
    lastBerekend.extras.forEach(it => { if (inst.extraAan[it.id]) uit.push({ naam: naamVan(it), kg: kgVan(it), eenheid: eenheidVan(it) }); });
    inst.eigen.forEach(e => uit.push({ naam: e.naam, kg: e.kg || 0, eenheid: e.eenheid || 'kg' }));
    return uit.filter(x => (x.naam || '').trim());
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

  function maakTekst() {
    const rijen = lijst();
    const wk = weekLabel();
    const regels = rijen.map(r => `- ${r.naam}${inst.metHoeveelheid && r.kg ? ` — ± ${fmtHoev(r)}` : ''}`);
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

  /* ── CSS ── */
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
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

    const items = lastBerekend.items.filter(it => it.n > 0 || !inst.uit[it.id] || true);
    root.innerHTML = `
      <div class="vp-head">
        <h2>Vis prijsaanvraag</h2>
        <select onchange="window._vpWeek(this.value)">${wk.map(([k, l]) => `<option value="${esc(k)}" ${k === weekKey ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <div class="vp-sup">
          ${inst.leveranciers.map(l => `<button class="vp-chip ${l.id === inst.gekozen ? 'act' : ''}" onclick="window._vpLev('${l.id}')">${esc(l.naam)}</button>`).join('')}
          <button class="vp-chip add" onclick="window._vpLevAdd()">+ leverancier</button>
        </div>
      </div>

      <div class="vp-grid">
        <div>
          <div class="vp-card">
            <h3>Vis uit de Excel <span>vink aan wat je wil vragen · pas de hoeveelheid zelf aan</span></h3>
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
      </div>`;
  }

  function rij(it, isExtra) {
    const aan = isExtra ? !!inst.extraAan[it.id] : !inst.uit[it.id];
    const kg = kgVan(it);
    const bron = [...it.bronnen];
    return `<div class="vp-row ${aan ? '' : 'uit'}">
      <input type="checkbox" ${aan ? 'checked' : ''} onchange="window._vpAan('${it.id}', this.checked, ${isExtra})">
      <input type="text" value="${esc(naamVan(it))}" onchange="window._vpNaam('${it.id}', this.value)">
      <input type="number" step="${eenheidVan(it) === 'stuk' ? 1 : 0.5}" min="0" value="${kg || ''}" placeholder="${eenheidVan(it) === 'stuk' ? 'stuks' : 'kg'}" onchange="window._vpKg('${it.id}', this.value)">
      <select onchange="window._vpEenheid('${it.id}', this.value)"><option value="kg" ${eenheidVan(it) === 'kg' ? 'selected' : ''}>kg</option><option value="stuk" ${eenheidVan(it) === 'stuk' ? 'selected' : ''}>stuks</option></select>
      ${it.n ? `<div class="vp-bron">${it.p} porties · ${it.n} gerecht${it.n === 1 ? '' : 'en'} · ${esc(bron.slice(0, 2).map(b => b.length > 46 ? b.slice(0, 45) + '…' : b).join(' · '))}${bron.length > 2 ? ' …' : ''}</div>` : `<div class="vp-bron">Niet in de Excel van deze week</div>`}
    </div>`;
  }

  function herteken() { const t = document.getElementById('vp-tekst'); if (t) t.value = maakTekst(); const h = document.querySelector('.vp-card h3 span'); }

  window._vpWeek = function (k) { weekKey = k; render(); };
  window._vpLev = function (id) { inst.gekozen = id; save(); render(); };
  window._vpLevAdd = function () {
    const naam = (prompt('Naam van de leverancier?') || '').trim(); if (!naam) return;
    const email = (prompt('E-mailadres (optioneel, voor de knop "E-mail openen")?') || '').trim();
    const l = { id: uid(), naam, email }; inst.leveranciers.push(l); inst.gekozen = l.id; save(); render();
  };
  window._vpAan = function (id, aan, isExtra) { if (isExtra) inst.extraAan[id] = aan; else inst.uit[id] = !aan; save(); render(); };
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
  window._vpPdf = async function () {
    try {
      if (!window.jspdf) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      const { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const M = 16, W = 210; let y = 20;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(20, 21, 26); doc.text('Prijsaanvraag vis', M, y); y += 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(110, 115, 130);
      doc.text(`${levNaam()}${weekLabel() ? '  ·  ' + weekLabel() : ''}`, M, y); y += 4;
      doc.setDrawColor(26, 63, 111); doc.setLineWidth(0.6); doc.line(M, y, W - M, y); y += 9;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(139, 144, 160);
      doc.text('PRODUCT', M, y); if (inst.metHoeveelheid) doc.text('± HOEVEELHEID', 118, y, { align: 'right' }); doc.text('PRIJS (€) PER KG / STUK', W - M, y, { align: 'right' }); y += 3;
      doc.setDrawColor(220); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 7;
      lijst().forEach(r => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20, 21, 26); doc.text(r.naam, M, y);
        if (inst.metHoeveelheid && r.kg) { doc.setFont('helvetica', 'normal'); doc.text(fmtHoev(r), 118, y, { align: 'right' }); }
        doc.setDrawColor(190); doc.line(138, y + 1, W - M, y + 1);
        y += 9.5;
      });
      y += 6; if (y > 262) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(90, 95, 110);
      doc.splitTextToSize('Graag de prijs per kg of per stuk (zoals vermeld), met de herkomst en de levermogelijkheden.', W - 2 * M).forEach(l => { doc.text(l, M, y); y += 5; });
      y += 4; doc.text(inst.handtekening || '', M, y);
      const n = doc.getNumberOfPages();
      for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(150); doc.text(`Huis van Wonterghem · ${new Date().toLocaleDateString('nl-BE')}`, M, 290); doc.text(`${i} / ${n}`, W - M, 290, { align: 'right' }); }
      doc.save(`HVW_Prijsaanvraag-vis_${levNaam().replace(/\W+/g, '')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) { alert('PDF maken mislukt: ' + (e.message || e)); console.error(e); }
  };

  window._renderVisprijs = render;
  document.addEventListener('DOMContentLoaded', () => {
    injectCSS(); load();
    if (typeof PAGE_TITLES !== 'undefined') PAGE_TITLES.visprijs = 'Vis prijsaanvraag';
  });
  document.addEventListener('dataLoaded', () => { weekKey = ''; if (document.getElementById('page-visprijs')?.classList.contains('active')) render(); });

  // voor tests
  window._vpTest = { bereken: () => (lastBerekend = bereken()), maakTekst, lijst, get inst() { return inst; }, setWeek(k) { weekKey = k; } };
})();
