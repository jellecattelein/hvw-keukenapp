/* ══════════════════════════════════════════
   groenten-bestellen.js — seizoensgroenten bestellen

   Gebruikt hetzelfde assortiment als de etiketten (Instellingen →
   Seizoensgroenten) en rekent met het aantal personen uit de Excel uit
   hoeveel je moet bestellen:
     · gram per persoon         → kg   (champignons 130 g pp)
     · personen per bundel      → bundels (wortelen: 10 p per bundel)
     · stuks per persoon        → stuks
   ══════════════════════════════════════════ */
(function () {
  'use strict';

  const KEY = 'hvw-groenten-bestelling';
  const ASS_KEYS = { standaard: 'hvw-groenten-assortiment', rouwmaaltijd: 'hvw-groenten-assortiment-rouwmaaltijd' };
  const TYPES = {
    gram:   { naam: 'gram per persoon',    kort: 'g p.p.' },
    bundel: { naam: 'personen per bundel', kort: 'p per' },
    stuk:   { naam: 'stuks per persoon',   kort: 'st. p.p.' },
  };

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) && n >= 0 ? n : null; };
  const fmt = (n, d) => n.toLocaleString('nl-BE', { minimumFractionDigits: 0, maximumFractionDigits: d == null ? 1 : d });
  const DAGEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

  let inst = null, weekKey = '', variant = 'standaard';

  function standaard() {
    return {
      spec: {},          // { assortimentId: { type, waarde, naam } }  bestelinstelling per groente
      man: {},           // { 'weekKey|variant|id': aantal }  eigen hoeveelheid
      repassePct: 0,     // % van de repasse-personen dat extra meetelt
      metDagen: true,
      leverancier: '',   // id uit Instellingen → Leveranciers
      handtekening: 'Huis van Wonterghem',
    };
  }
  function load() {
    inst = standaard();
    try { Object.assign(inst, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(inst)); } catch (e) {} }

  /* ── assortiment (zelfde bron als de etiketten) ── */
  function assortiment(v) {
    try { const l = JSON.parse(localStorage.getItem(ASS_KEYS[v]) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; }
  }
  // Staat er voor deze groente nog geen bestelinstelling, dan volgen we de etiketinstelling
  function specVan(g) {
    const s = inst.spec[g.id];
    if (s && TYPES[s.type]) return s;
    if (g.eenheid === 'gram') return { type: 'gram', waarde: g.perPlateau || 0, naam: '' };
    if (g.eenheid === 'aantal') return { type: 'stuk', waarde: g.perPlateau || 0, naam: '' };
    if (g.eenheid === 'stuk') return { type: 'bundel', waarde: g.perPlateau || 0, naam: 'bundel' };
    return { type: 'gram', waarde: 0, naam: '' };
  }

  /* ── personen uit de Excel ── */
  function weken() {
    if (typeof allRows === 'undefined' || !allRows.length) return [];
    return [...new Map(allRows.filter(r => r.weekKey).map(r => [r.weekKey, r.weekLabel || r.weekKey])).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }
  const isRepasse = n => /^repasse\s/i.test(n || '');
  const isSeizoen = n => /seizoensgroenten/i.test(n || '');
  const variantVan = n => /rouwmaaltijd/i.test(n || '') ? 'rouwmaaltijd' : 'standaard';
  function personen() {
    const dagen = new Map(); let hoofd = 0, repasse = 0;
    if (typeof allRows !== 'undefined') allRows.forEach(r => {
      if (r.persons <= 0 || !isSeizoen(r.name) || r.weekKey !== weekKey || variantVan(r.name) !== variant) return;
      const rep = isRepasse(r.name);
      if (rep) repasse += r.persons; else hoofd += r.persons;
      const eff = rep ? r.persons * (inst.repassePct || 0) / 100 : r.persons;
      const k = r.dateStr || '';
      dagen.set(k, (dagen.get(k) || 0) + eff);
    });
    const totaal = hoofd + repasse * (inst.repassePct || 0) / 100;
    return { hoofd, repasse, totaal, dagen };
  }
  function dagLabel(ds) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ds || '');
    if (!m) return 'datum onbekend';
    return `${DAGEN[new Date(+m[1], +m[2] - 1, +m[3]).getDay()]} ${+m[3]}/${+m[2]}`;
  }

  /* ── hoeveelheid uitrekenen ── */
  // geeft { hoev, eenheid, uitleg } voor een aantal personen
  function reken(spec, p, afronden) {
    const w = spec.waarde || 0;
    if (!w || p <= 0) return { hoev: 0, eenheid: eenheidTxt(spec, 0), uitleg: '' };
    if (spec.type === 'gram') {
      const kg = p * w / 1000;
      return { hoev: afronden ? Math.ceil(kg * 2 - 1e-9) / 2 : Math.round(kg * 10) / 10, eenheid: 'kg' };
    }
    if (spec.type === 'bundel') return { hoev: Math.ceil(p / w - 1e-9), eenheid: bundelNaam(spec, Math.ceil(p / w - 1e-9)) };
    return { hoev: Math.ceil(p * w - 1e-9), eenheid: Math.ceil(p * w - 1e-9) === 1 ? 'stuk' : 'stuks' };
  }
  const MEERV = { bundel: 'bundels', kist: 'kisten', bak: 'bakken', doos: 'dozen', krat: 'kratten', bos: 'bossen', tros: 'trossen', zak: 'zakken', net: 'netten', stuk: 'stuks', stronk: 'stronken' };
  const bundelNaam = (spec, n) => { const b = ((spec.naam || 'bundel').trim() || 'bundel').toLowerCase(); return n === 1 ? b : (MEERV[b] || (b.endsWith('s') ? b : b + 's')); };
  const eenheidTxt = (spec, n) => spec.type === 'gram' ? 'kg' : spec.type === 'bundel' ? bundelNaam(spec, n) : (n === 1 ? 'stuk' : 'stuks');
  const specTxt = spec => spec.type === 'gram' ? `${fmt(spec.waarde)} g p.p.` : spec.type === 'bundel' ? `${fmt(spec.waarde)} p per ${(spec.naam || 'bundel').trim() || 'bundel'}` : `${fmt(spec.waarde)} st. p.p.`;

  function regels() {
    const P = personen();
    return assortiment(variant).map(g => {
      const spec = specVan(g);
      const auto = reken(spec, P.totaal, true);
      const manKey = weekKey + '|' + variant + '|' + g.id;
      const man = inst.man[manKey];
      const hoev = man != null ? man : auto.hoev;
      const dagen = [...P.dagen.entries()].filter(([, p]) => p > 0).sort((a, b) => a[0].localeCompare(b[0]))
        .map(([ds, p]) => { const r = reken(spec, p, false); return { ds, label: dagLabel(ds), hoev: r.hoev, eenheid: r.eenheid, p }; });
      return { g, spec, auto, hoev, eenheid: man != null ? eenheidTxt(spec, hoev) : auto.eenheid, handmatig: man != null, dagen };
    });
  }
  const hoevTxt = r => `${fmt(r.hoev)} ${r.eenheid}`;

  const weekLabel = () => {
    const l = ((weken().find(([k]) => k === weekKey) || [])[1] || '').replace(/\s+/g, ' ').trim();
    const m = /^week\s*(\d+)\s*[·\-]\s*(.+)$/i.exec(l);
    return m ? `week ${m[1]} (${m[2]})` : l.replace(/^Week/, 'week');
  };
  const levObj = () => (typeof suppliers !== 'undefined' ? suppliers : []).find(s => s.id === inst.leverancier) || null;

  function maakTekst() {
    const P = personen();
    const lev = levObj();
    const out = [];
    regels().filter(r => r.hoev > 0).forEach(r => {
      out.push(`- ${r.g.naam} — ${hoevTxt(r)}`);
      if (inst.metDagen && r.dagen.length) out.push('  Nodig voor: ' + r.dagen.map(d => `${d.label} (${fmt(d.hoev)} ${d.eenheid})`).join(' · '));
    });
    return [
      lev ? `Beste ${lev.name || lev.naam || ''},`.replace(' ,', ',') : 'Goedendag,',
      '',
      `Graag bestellen we de seizoensgroenten voor ${weekLabel() || 'volgende week'}:`,
      '',
      ...(out.length ? out : ['(nog niets in te vullen: stel per groente de hoeveelheid per persoon in)']),
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
      #page-groentenbestel { --g-ink3:#8B90A0; --g-line:rgba(20,21,26,.09); --g-acc:#2D6A4F; --g-soft:#E9F5EE; }
      .gb-head { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
      .gb-head h2 { margin:0; font:700 22px 'Inter',sans-serif; letter-spacing:-.02em; }
      .gb-head select, .gb-sel { padding:8px 10px; border:1px solid rgba(20,21,26,.15); border-radius:10px; font:14px 'Inter',sans-serif; background:#fff; }
      .gb-tabs { display:inline-flex; background:rgba(20,21,26,.06); border-radius:11px; padding:3px; gap:2px; }
      .gb-tabs button { border:0; background:transparent; padding:7px 14px; border-radius:9px; font:600 13px 'Inter',sans-serif; cursor:pointer; color:#6B655E; }
      .gb-tabs button.act { background:#fff; color:#14151A; box-shadow:0 1px 3px rgba(20,21,26,.12); }
      .gb-grid { display:grid; grid-template-columns:minmax(0,1.3fr) minmax(0,1fr); gap:16px; align-items:start; }
      @media (max-width: 1050px) { .gb-grid { grid-template-columns:1fr; } }
      .gb-card { background:#fff; border-radius:16px; box-shadow:0 1px 2px rgba(20,21,26,.05),0 0 0 1px rgba(20,21,26,.04); padding:16px 18px; margin-bottom:14px; }
      .gb-card h3 { margin:0 0 4px; font:650 15px 'Inter',sans-serif; display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
      .gb-card h3 span { font-size:12px; font-weight:500; color:var(--g-ink3); }
      .gb-info { font-size:13px; color:#3A4764; background:rgba(26,63,111,.07); border-radius:10px; padding:9px 12px; margin:8px 0 10px; display:flex; gap:14px; flex-wrap:wrap; align-items:center; }
      .gb-info input { width:56px; padding:5px 7px; border:1px solid rgba(20,21,26,.15); border-radius:8px; font:13px 'Inter',sans-serif; text-align:right; }
      .gb-row { display:grid; grid-template-columns:minmax(120px,1.2fr) minmax(0,1.6fr) 120px 28px; gap:10px; align-items:center; padding:9px 0; border-top:1px solid var(--g-line); }
      .gb-row:first-of-type { border-top:0; }
      .gb-naam { font:600 14px 'Inter',sans-serif; }
      .gb-spec { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
      .gb-spec input, .gb-add input { width:68px; padding:7px 8px; border:1px solid rgba(20,21,26,.15); border-radius:9px; font:14px 'Inter',sans-serif; text-align:right; box-sizing:border-box; }
      .gb-spec input.nm { width:72px; text-align:left; }
      .gb-spec select, .gb-add select { padding:7px 6px; border:1px solid rgba(20,21,26,.15); border-radius:9px; font:13px 'Inter',sans-serif; background:#fff; }
      .gb-qty { display:flex; flex-direction:column; align-items:flex-end; gap:2px; }
      .gb-qty input { width:84px; padding:7px 8px; border:1px solid rgba(20,21,26,.15); border-radius:9px; font:700 14px 'Inter',sans-serif; text-align:right; box-sizing:border-box; }
      .gb-qty input.man { border-color:#8B6A00; background:#FDF6E3; }
      .gb-qty small { font-size:11px; color:var(--g-ink3); }
      .gb-dagen { grid-column:1 / 4; display:flex; flex-wrap:wrap; gap:5px; margin-top:-3px; }
      .gb-dag { font-size:11.5px; font-weight:600; background:var(--g-soft); color:var(--g-acc); border-radius:99px; padding:2px 9px; }
      .gb-x { border:0; background:transparent; cursor:pointer; color:#B8B3AD; font-size:17px; border-radius:6px; }
      .gb-x:hover { background:#FDF1ED; color:#C0392B; }
      .gb-add { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; align-items:center; }
      .gb-add input.nm { width:150px; text-align:left; }
      .gb-leeg { color:var(--g-ink3); font-size:13px; padding:8px 0; }
      .gb-tekst { width:100%; box-sizing:border-box; min-height:300px; padding:14px; border:1px solid rgba(20,21,26,.15); border-radius:12px; font:13.5px/1.55 'Inter',sans-serif; resize:vertical; background:#FBFBFC; }
      .gb-acts { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; align-items:center; }
      .gb-opt { display:flex; gap:14px; flex-wrap:wrap; align-items:center; font-size:13px; margin:8px 0; }
      .gb-opt input[type=text] { padding:7px 10px; border:1px solid rgba(20,21,26,.15); border-radius:9px; font:13px 'Inter',sans-serif; }
      .gb-ok { font-size:12.5px; font-weight:600; color:#1F7A5A; opacity:0; transition:opacity .3s; } .gb-ok.on { opacity:1; }
    `;
    document.head.appendChild(s);
  }

  /* ── scherm ── */
  function render() {
    const root = document.getElementById('page-groentenbestel');
    if (!root) return;
    if (!inst) load();
    const wk = weken();
    if (!wk.some(([k]) => k === weekKey)) weekKey = wk.length ? wk[0][0] : '';
    if (!wk.length) {
      root.innerHTML = `<div class="gb-head"><h2>Groenten bestellen</h2></div><div class="gb-card"><div class="gb-leeg">Upload eerst de Excel van de week. Daarna reken ik uit hoeveel je van elke seizoensgroente moet bestellen.</div></div>`;
      return;
    }
    const P = personen();
    const rs = regels();
    const lijst = typeof suppliers !== 'undefined' ? suppliers : [];

    root.innerHTML = `
      <div class="gb-head">
        <h2>Groenten bestellen</h2>
        <select onchange="window._gbWeek(this.value)">${wk.map(([k, l]) => `<option value="${esc(k)}" ${k === weekKey ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <div class="gb-tabs">
          <button class="${variant === 'standaard' ? 'act' : ''}" onclick="window._gbVariant('standaard')">Standaard</button>
          <button class="${variant === 'rouwmaaltijd' ? 'act' : ''}" onclick="window._gbVariant('rouwmaaltijd')">Rouwmaaltijd</button>
        </div>
      </div>
      <div class="gb-grid">
        <div>
          <div class="gb-card">
            <h3>Seizoensgroenten ${variant === 'rouwmaaltijd' ? '(rouwmaaltijd)' : '(standaard)'} <span>stel per groente in hoeveel je per persoon of per bundel rekent</span></h3>
            <div class="gb-info">
              <span><b>${fmt(P.hoofd, 0)}</b> personen${P.repasse ? ` + ${fmt(P.repasse, 0)} bij repasse` : ''}</span>
              ${P.repasse ? `<label>Repasse telt mee voor <input type="number" min="0" max="100" step="10" value="${inst.repassePct || 0}" onchange="window._gbRepasse(this.value)"> %</label>` : ''}
              <span>Gerekend met <b>${fmt(P.totaal, 0)}</b> personen</span>
            </div>
            ${P.totaal <= 0 ? `<div class="gb-leeg">Voor ${esc(weekLabel())} staat er geen "Seizoensgroenten ${variant === 'rouwmaaltijd' ? '(Rouwmaaltijd)' : ''}" in de Excel.</div>` : ''}
            ${rs.length ? rs.map(rij).join('') : `<div class="gb-leeg">Er staan nog geen groenten in dit assortiment. Voeg ze hieronder toe: ze komen ook bij de etiketten.</div>`}
            <div class="gb-add">
              <input class="nm" id="gb-n-naam" placeholder="bv. Champignons" onkeydown="if(event.key==='Enter')window._gbAdd()">
              <select id="gb-n-type">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}">${t.naam}</option>`).join('')}</select>
              <input id="gb-n-w" type="number" min="0" step="any" placeholder="bv. 130">
              <button class="btn" onclick="window._gbAdd()">+ Groente toevoegen</button>
            </div>
          </div>
        </div>
        <div>
          <div class="gb-card">
            <h3>Bestelling <span>${rs.filter(r => r.hoev > 0).length} groenten</span></h3>
            <div class="gb-opt">
              <label>Leverancier: <select class="gb-sel" onchange="window._gbLev(this.value)"><option value="">— niet vastgelegd —</option>${lijst.map(s => `<option value="${esc(s.id)}" ${s.id === inst.leverancier ? 'selected' : ''}>${esc(s.name || s.naam)}</option>`).join('')}</select></label>
              <label><input type="checkbox" ${inst.metDagen ? 'checked' : ''} onchange="window._gbOpt('metDagen',this.checked)"> Dagen vermelden</label>
              <label>Afsluiting: <input type="text" value="${esc(inst.handtekening)}" onchange="window._gbOpt('handtekening',this.value)"></label>
            </div>
            <textarea id="gb-tekst" class="gb-tekst">${esc(maakTekst())}</textarea>
            <div class="gb-acts">
              <button class="btn btn-gold" onclick="window._gbKopieer()">Kopieer tekst</button>
              <button class="btn btn-primary" onclick="window._gbPdf()">PDF downloaden</button>
              <button class="btn" onclick="window._gbMail()">E-mail openen in Gmail</button>
              <span id="gb-ok" class="gb-ok">Gekopieerd ✓</span>
            </div>
            ${lijst.length ? '' : '<div class="gb-leeg" style="margin-top:8px">Leveranciers voeg je toe via Instellingen.</div>'}
          </div>
        </div>
      </div>`;
  }

  function rij(r) {
    const s = r.spec, id = esc(r.g.id);
    return `<div class="gb-row">
      <div class="gb-naam">${esc(r.g.naam)}</div>
      <div class="gb-spec">
        <select onchange="window._gbSpec('${id}','type',this.value)">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}" ${s.type === k ? 'selected' : ''}>${t.naam}</option>`).join('')}</select>
        <input type="number" min="0" step="any" value="${s.waarde || ''}" placeholder="${s.type === 'gram' ? '130' : s.type === 'bundel' ? '10' : '1'}" onchange="window._gbSpec('${id}','waarde',this.value)">
        ${s.type === 'bundel' ? `<input class="nm" type="text" value="${esc(s.naam || 'bundel')}" title="Hoe noem je de eenheid? (bundel, kist, bak…)" onchange="window._gbSpec('${id}','naam',this.value)">` : ''}
      </div>
      <div class="gb-qty">
        <input type="number" min="0" step="${r.eenheid === 'kg' ? 0.5 : 1}" class="${r.handmatig ? 'man' : ''}" value="${r.hoev || ''}" placeholder="0" onchange="window._gbMan('${id}',this.value)" title="Pas aan om zelf een hoeveelheid te kiezen">
        <small>${esc(r.eenheid)}${r.handmatig ? ` · <a href="#" onclick="window._gbMan('${id}','');return false">auto</a>` : ''}</small>
      </div>
      <button class="gb-x" title="Groente verwijderen (ook bij de etiketten)" onclick="window._gbDel('${id}')">×</button>
      ${r.dagen.length && r.hoev > 0 ? `<div class="gb-dagen">${r.dagen.map(d => `<span class="gb-dag">${esc(d.label)} · ${fmt(d.hoev)} ${esc(d.eenheid)}</span>`).join('')}</div>` : ''}
    </div>`;
  }

  function herteken() { const t = document.getElementById('gb-tekst'); if (t) t.value = maakTekst(); }

  window._gbWeek = function (k) { weekKey = k; render(); };
  window._gbVariant = function (v) { variant = v; render(); };
  window._gbRepasse = function (v) { inst.repassePct = Math.min(100, Math.max(0, num(v) || 0)); save(); render(); };
  window._gbLev = function (id) { inst.leverancier = id; save(); herteken(); };
  window._gbOpt = function (k, v) { inst[k] = v; save(); herteken(); };
  window._gbSpec = function (id, veld, v) {
    const g = assortiment(variant).find(x => x.id === id); if (!g) return;
    const s = Object.assign({}, specVan(g));
    if (veld === 'type') s.type = v; else if (veld === 'waarde') s.waarde = num(v) || 0; else s.naam = String(v).trim();
    inst.spec[id] = s; save(); render();
  };
  window._gbMan = function (id, v) {
    const k = weekKey + '|' + variant + '|' + id;
    const n = String(v).trim() === '' ? null : num(v);
    if (n == null) delete inst.man[k]; else inst.man[k] = n;
    save(); render();
  };
  // groente toevoegen: komt in hetzelfde assortiment als de etiketten
  window._gbAdd = function () {
    const naam = (document.getElementById('gb-n-naam')?.value || '').trim();
    const type = document.getElementById('gb-n-type')?.value || 'gram';
    const w = num(document.getElementById('gb-n-w')?.value);
    if (!naam) { document.getElementById('gb-n-naam')?.focus(); return; }
    if (!w) { document.getElementById('gb-n-w')?.focus(); return; }
    const id = Date.now().toString();
    const eenheid = type === 'gram' ? 'gram' : type === 'stuk' ? 'aantal' : 'stuk';   // zo komt het ook goed bij de etiketten
    schrijfAssortiment(variant, l => l.concat([{ id, naam, eenheid, perPlateau: w }]));
    inst.spec[id] = { type, waarde: w, naam: type === 'bundel' ? 'bundel' : '' };
    save(); render();
  };
  window._gbDel = function (id) {
    const g = assortiment(variant).find(x => x.id === id);
    if (!g || !confirm(`${g.naam} uit het assortiment verwijderen? Dit verdwijnt ook bij de etiketten.`)) return;
    schrijfAssortiment(variant, l => l.filter(x => x.id !== id));
    delete inst.spec[id]; save(); render();
  };
  // schrijft naar het assortiment dat Instellingen ook gebruikt (en houdt dat scherm mee)
  function schrijfAssortiment(v, fn) {
    const nieuw = fn(assortiment(v));
    try { localStorage.setItem(ASS_KEYS[v], JSON.stringify(nieuw)); } catch (e) {}
    try {
      if (typeof groentenAssortimenten !== 'undefined') { groentenAssortimenten[v] = nieuw; if (typeof renderGroentenLijst === 'function') renderGroentenLijst(v); }
    } catch (e) {}
  }

  /* ── uitvoer ── */
  window._gbKopieer = async function () {
    const t = document.getElementById('gb-tekst'); if (!t) return;
    try { await navigator.clipboard.writeText(t.value); } catch (e) { t.select(); document.execCommand('copy'); }
    const ok = document.getElementById('gb-ok'); if (ok) { ok.classList.add('on'); setTimeout(() => ok.classList.remove('on'), 2200); }
  };
  window._gbMail = function () {
    const lev = levObj();
    let gmail = '';
    try { gmail = (JSON.parse(localStorage.getItem('hvw-vis-instellingen') || '{}').gmail || ''); } catch (e) {}
    const adr = ((lev && lev.email) || '').match(/[^\s<>,;"']+@[^\s<>,;"']+\.[^\s<>,;"']+/g) || [];
    const tekst = document.getElementById('gb-tekst')?.value || maakTekst();
    const q = p => Object.entries(p).filter(([, v]) => v).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
    const basis = { view: 'cm', fs: '1', bcc: adr.join(','), su: `Bestelling seizoensgroenten ${weekLabel() ? '— ' + weekLabel() : ''}`.trim(), authuser: gmail };
    let url = 'https://mail.google.com/mail/?' + q(Object.assign({}, basis, { body: tekst }));
    let kopie = false;
    if (url.length > 7000) { url = 'https://mail.google.com/mail/?' + q(basis); kopie = true; }
    window.open(url, '_blank', 'noopener');
    if (kopie) { try { navigator.clipboard.writeText(tekst); } catch (e) {} alert('De tekst is te lang voor in de link. Ze is gekopieerd: plak ze in de mail met Ctrl+V.'); }
  };
  window._gbPdf = async function () {
    try {
      if (!window.jspdf) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      const { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const M = 16, W = 210; let y = 20;
      const lev = levObj();
      doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(20, 21, 26); doc.text('Bestelling seizoensgroenten', M, y); y += 7;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(110, 115, 130);
      doc.text([lev && (lev.name || lev.naam), weekLabel()].filter(Boolean).join('  ·  '), M, y); y += 4;
      doc.setDrawColor(45, 106, 79); doc.setLineWidth(0.6); doc.line(M, y, W - M, y); y += 9;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(139, 144, 160);
      doc.text('GROENTE', M, y); doc.text('HOEVEELHEID', W - M, y, { align: 'right' }); y += 3;
      doc.setDrawColor(220); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 7;
      regels().filter(r => r.hoev > 0).forEach(r => {
        if (y > 266) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(20, 21, 26); doc.text(r.g.naam, M, y);
        doc.text(hoevTxt(r), W - M, y, { align: 'right' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(110, 115, 130);
        const sub = [specTxt(r.spec), inst.metDagen && r.dagen.length ? 'Nodig voor: ' + r.dagen.map(d => `${d.label} (${fmt(d.hoev)} ${d.eenheid})`).join(' · ') : ''].filter(Boolean).join('   ·   ');
        y += 4.8; doc.text(sub, M, y, { maxWidth: W - 2 * M });
        y += 8;
      });
      y += 6; if (y > 262) { doc.addPage(); y = 20; }
      doc.setFontSize(9.5); doc.setTextColor(90, 95, 110);
      doc.text('Graag een bevestiging van de bestelling.', M, y); y += 9; doc.text(inst.handtekening || '', M, y);
      const n = doc.getNumberOfPages();
      for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(150); doc.text(`Huis van Wonterghem · ${new Date().toLocaleDateString('nl-BE')}`, M, 290); doc.text(`${i} / ${n}`, W - M, 290, { align: 'right' }); }
      doc.save(`HVW_Bestelling-seizoensgroenten_${weekKey}.pdf`);
    } catch (e) { alert('PDF maken mislukt: ' + (e.message || e)); console.error(e); }
  };

  window._renderGroentenBestel = render;
  document.addEventListener('DOMContentLoaded', () => {
    injectCSS(); load();
    if (typeof PAGE_TITLES !== 'undefined') PAGE_TITLES.groentenbestel = 'Groenten bestellen';
  });
  document.addEventListener('dataLoaded', () => { weekKey = ''; if (document.getElementById('page-groentenbestel')?.classList.contains('active')) render(); });

  // voor tests
  window._gbTest = { regels, personen, maakTekst, reken, get inst() { return inst; }, setWeek(k) { weekKey = k; }, setVariant(v) { variant = v; } };
})();
