/* ══════════════════════════════════════════
   offertes.js — offertes en menukalkulaties (vervangt de losse Excel)

   - Alle offertes bewaard met CCM-boekingsnummer, verkoper, Apicbase-code
     of -link, extra vermeldingen en status → altijd terug te vinden.
   - Dezelfde berekening als de Excel: AKP → verliesmarge → margefactor → btw.
   - Export naar Excel (met formules) en PDF; opslaan in Google Drive;
     doorsturen per e-mail.
   - Opslag: dit toestel (altijd) + online in de beheerder-only verzameling
     "offertes" (Firebase) zodra aangemeld als beheerder.
   ══════════════════════════════════════════ */
(function () {
  'use strict';

  const KEY = 'hvw-offertes';
  const PAR_KEY = 'hvw-offerte-par';
  const PAR_DEF = { margeFood: 2.5, btwFood: 1.12, verlies: 1.10 };
  const SECTIES_DEF = ['Amuses', 'Voorgerecht', 'Hoofdgerecht', 'Dessert'];
  const STATUSSEN = [
    { id: 'concept', label: 'Concept' },
    { id: 'verstuurd', label: 'Verstuurd' },
    { id: 'bevestigd', label: 'Bevestigd' },
    { id: 'afgewezen', label: 'Afgewezen' },
  ];

  let offertes = [];
  let view = 'lijst';          // 'lijst' | 'editor'
  let cur = null;              // de offerte in de editor
  let filters = { q: '', status: '', verkoper: '' };
  let saveTimer = null;
  let cloudState = 'uit';      // 'uit' | 'ok' | 'regels' | 'fout'
  let unsub = null;

  /* ── hulpfuncties ── */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
  const eur = n => (isFinite(n) ? n : 0).toLocaleString('nl-BE', { style: 'currency', currency: 'EUR' });
  const pct = n => ((isFinite(n) ? n : 0) * 100).toLocaleString('nl-BE', { maximumFractionDigits: 1 }) + ' %';
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const isUrl = s => /^https?:\/\//i.test(String(s || '').trim());
  function datumDeel(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? { d: String(+m[3]), m: MAANDEN[+m[2] - 1], y: m[1] } : { d: '–', m: '', y: '' };
  }
  function datumNl(iso) { const x = datumDeel(iso); return x.m ? `${x.d} ${x.m} ${x.y}` : ''; }

  function newItem(naam) { return { id: uid(), naam: naam || '', akp: 0, kaart: 0 }; }
  function nieuweOfferte() {
    let par = Object.assign({}, PAR_DEF);
    try { par = Object.assign(par, JSON.parse(localStorage.getItem(PAR_KEY) || '{}')); } catch (e) {}
    return {
      id: uid(), createdAt: Date.now(), updatedAt: Date.now(), status: 'concept',
      naam: '', klant: '', ccmId: '', verkoper: '', datum: '', pax: 100, apicbase: '', extra: '',
      par,
      secties: SECTIES_DEF.map(n => ({ id: uid(), naam: n, items: [newItem()] })),
    };
  }

  /* ── berekening (zoals in de Excel) ── */
  function detailAkp(d) {
    const basis = num(d.basis) || 1;
    let som = 0;
    (d.groepen || []).forEach(g => (g.items || []).forEach(i => { som += num(i.akp) * num(i.aantal); }));
    return som / basis;
  }
  function calc(o) {
    const p = o.par, pax = num(o.pax);
    const r = { items: {}, secs: {} };
    const leeg = () => ({ akp: 0, verl: 0, vex: 0, vin: 0, kaart: 0 });
    const food = leeg();
    o.secties.forEach(s => {
      const t = leeg();
      s.items.forEach(it => {
        const akp = it.detail ? detailAkp(it.detail) : num(it.akp);
        const verl = akp * p.verlies, vex = verl * p.margeFood, vin = vex * p.btwFood, kaart = num(it.kaart);
        r.items[it.id] = { akp, verl, vex, vin, kaart };
        Object.keys(t).forEach(k => { t[k] += r.items[it.id][k]; });
      });
      r.secs[s.id] = t;
      Object.keys(food).forEach(k => { food[k] += t[k]; });
    });
    // Enkel food: kostprijs = AKP incl. verliesmarge; de kaartprijs is de prijs die je aan de klant geeft
    const kost = food.verl;
    const kaart = food.kaart;
    const kaartEx = p.btwFood ? kaart / p.btwFood : kaart;          // kaartprijs zonder btw
    r.food = food; r.kost = kost; r.kaart = kaart;
    r.marge = kaart ? kaartEx - kost : 0;                           // marge op de kaartprijs, excl. btw
    r.margePct = kaart ? r.marge / kaartEx : 0;
    r.kostTot = kost * pax; r.kaartTot = kaart * pax;               // totaal voor het hele event
    return r;
  }
  const geldigItem = it => (it.naam || '').trim() || num(it.akp) || it.detail;

  /* ── opslag ── */
  function loadLocal() {
    try { offertes = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { offertes = []; }
    if (!Array.isArray(offertes)) offertes = [];
    // oudere/onvolledige records aanvullen
    offertes.forEach(o => { o.par = Object.assign({}, PAR_DEF, o.par || {}); o.secties = o.secties || []; });
  }
  function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(offertes)); } catch (e) { console.warn('[offertes] lokaal opslaan mislukt', e); } }

  function cloud() { const f = window.hvwFirebase; return f && f.isAdmin && f.db ? f : null; }
  async function pushCloud(o) {
    const f = cloud(); if (!f) return;
    try {
      await f.db.collection('offertes').doc(o.id).set({
        id: o.id, updatedAt: o.updatedAt, naam: o.naam || '', ccmId: o.ccmId || '', verkoper: o.verkoper || '', datum: o.datum || '',
        json: JSON.stringify(o),
      });
      setCloud('ok');
    } catch (e) { setCloud(/permission/i.test(String(e && (e.code || e.message))) ? 'regels' : 'fout'); }
  }
  async function deleteCloud(id) {
    const f = cloud(); if (!f) return;
    try { await f.db.collection('offertes').doc(id).delete(); } catch (e) { /* stil */ }
  }
  function setCloud(s) { cloudState = s; const el = document.getElementById('of-cloud'); if (el) el.outerHTML = cloudHtml(); }
  function cloudHtml() {
    const t = {
      uit: ['Enkel op dit toestel bewaard', 'Meld je aan als beheerder om offertes ook online te bewaren.'],
      ok: ['Online bewaard ✓', 'Beschikbaar op al je toestellen.'],
      regels: ['Online opslag nog niet actief', 'Plak de bijgewerkte regels uit firestore.rules in Firebase (zie FIREBASE_INSTELLEN.md). Intussen blijft alles op dit toestel bewaard.'],
      fout: ['Online opslaan haperde', 'Wordt opnieuw geprobeerd bij je volgende wijziging.'],
    }[cloudState];
    return `<div id="of-cloud" class="of-cloud ${cloudState}" title="${esc(t[1])}"><i></i><span>${esc(t[0])}</span></div>`;
  }
  function subscribeCloud() {
    const f = cloud(); if (!f || unsub) return;
    unsub = f.db.collection('offertes').onSnapshot(snap => {
      let veranderd = false;
      snap.docChanges().forEach(ch => {
        if (ch.type === 'removed') {
          const i = offertes.findIndex(o => o.id === ch.doc.id);
          if (i >= 0 && !(cur && cur.id === ch.doc.id)) { offertes.splice(i, 1); veranderd = true; }
          return;
        }
        try {
          const remote = JSON.parse(ch.doc.data().json);
          const local = offertes.find(o => o.id === remote.id);
          if (!local) { offertes.push(remote); veranderd = true; }
          else if ((remote.updatedAt || 0) > (local.updatedAt || 0) && !(cur && cur.id === remote.id)) { Object.assign(local, remote); veranderd = true; }
        } catch (e) { /* beschadigd document overslaan */ }
      });
      // lokale offertes die online nog ontbreken, alsnog uploaden
      const online = new Set(snap.docs.map(d => d.id));
      offertes.filter(o => !online.has(o.id)).forEach(pushCloud);
      setCloud('ok');
      if (veranderd) { saveLocal(); if (view === 'lijst') render(); }
    }, err => { setCloud(/permission/i.test(String(err && (err.code || err.message))) ? 'regels' : 'fout'); unsub = null; });
  }
  document.addEventListener('hvw-auth', e => {
    if (unsub) { try { unsub(); } catch (x) {} unsub = null; }
    if (e.detail && e.detail.admin) subscribeCloud(); else { cloudState = 'uit'; setCloud('uit'); }
  });

  function scheduleSave() {
    if (!cur) return;
    cur.updatedAt = Date.now();
    clearTimeout(saveTimer);
    setSaved('bezig');
    saveTimer = setTimeout(() => {
      const i = offertes.findIndex(o => o.id === cur.id);
      if (i >= 0) offertes[i] = cur; else offertes.push(cur);
      saveLocal();
      try { localStorage.setItem(PAR_KEY, JSON.stringify(cur.par)); } catch (e) {}
      pushCloud(cur);
      setSaved('ok');
    }, 600);
  }
  function setSaved(s) {
    const el = document.getElementById('of-saved');
    if (el) { el.textContent = s === 'bezig' ? 'Bewaren…' : 'Bewaard ✓'; el.className = 'of-saved ' + s; }
  }

  /* ── CSS ── */
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      #page-offertes { --of-ink:#14151A; --of-ink2:#4A4F5E; --of-ink3:#8B90A0; --of-line:rgba(20,21,26,.09); --of-acc:#B8965A; --of-accsoft:rgba(184,150,90,.14); }
      .of-head { display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-bottom:18px; }
      .of-head h2 { font:700 22px 'Inter',sans-serif; letter-spacing:-.02em; margin:0; }
      .of-count { font-size:12px; font-weight:600; background:rgba(20,21,26,.06); color:var(--of-ink2); padding:3px 10px; border-radius:99px; }
      .of-tools { display:flex; gap:8px; flex-wrap:wrap; margin-left:auto; align-items:center; }
      .of-tools input, .of-tools select { padding:9px 12px; border:1px solid rgba(20,21,26,.15); border-radius:10px; font:14px 'Inter',sans-serif; background:#fff; }
      .of-tools input { min-width:220px; }
      .of-cloud { display:inline-flex; align-items:center; gap:7px; font-size:12px; font-weight:600; color:var(--of-ink3); padding:6px 11px; border-radius:99px; background:rgba(20,21,26,.045); cursor:help; }
      .of-cloud i { width:8px; height:8px; border-radius:50%; background:#9aa0ad; }
      .of-cloud.ok i { background:#1F7A5A; } .of-cloud.ok { color:#1F7A5A; }
      .of-cloud.regels i, .of-cloud.fout i { background:#C0392B; } .of-cloud.regels, .of-cloud.fout { color:#C0392B; }
      .of-list { display:flex; flex-direction:column; gap:10px; }
      .of-card { display:grid; grid-template-columns:64px 1fr auto auto; gap:18px; align-items:center; background:#fff; border-radius:16px; padding:14px 18px; box-shadow:0 1px 2px rgba(20,21,26,.05),0 0 0 1px rgba(20,21,26,.04); cursor:pointer; transition:transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s; }
      .of-card:hover { transform:translateY(-2px); box-shadow:0 12px 28px -12px rgba(20,21,26,.2),0 0 0 1px rgba(20,21,26,.05); }
      .of-date { text-align:center; background:var(--of-accsoft); border-radius:12px; padding:8px 0; }
      .of-date b { display:block; font:700 22px 'Inter',sans-serif; line-height:1; letter-spacing:-.03em; }
      .of-date span { display:block; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.08em; color:#8A6B2F; margin-top:3px; }
      .of-card-main b { display:block; font:650 15.5px 'Inter',sans-serif; letter-spacing:-.01em; }
      .of-card-sub { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
      .of-chip { font-size:11.5px; font-weight:600; padding:3px 9px; border-radius:99px; background:rgba(20,21,26,.06); color:var(--of-ink2); }
      .of-chip.ccm { background:#EDF3FB; color:#1A3F6F; } .of-chip.vk { background:#F3EAF7; color:#6B3A7D; }
      .of-num { text-align:right; font-variant-numeric:tabular-nums; }
      .of-num b { display:block; font:700 16px 'Inter',sans-serif; letter-spacing:-.02em; } .of-num span { font-size:11.5px; color:var(--of-ink3); }
      .of-status { font-size:11.5px; font-weight:700; padding:4px 10px; border-radius:99px; }
      .of-status.concept { background:rgba(20,21,26,.07); color:#4A4F5E; } .of-status.verstuurd { background:#EDF3FB; color:#1A3F6F; }
      .of-status.bevestigd { background:#E0EEE8; color:#1F7A5A; } .of-status.afgewezen { background:#FDF1ED; color:#8B2500; }
      .of-actions { display:flex; gap:4px; }
      .of-ib { width:34px; height:34px; border-radius:10px; border:0; background:transparent; cursor:pointer; color:var(--of-ink3); display:flex; align-items:center; justify-content:center; transition:all .2s; }
      .of-ib:hover { background:rgba(20,21,26,.07); color:var(--of-ink); } .of-ib.del:hover { background:#FDF1ED; color:#C0392B; }
      .of-ib svg { width:17px; height:17px; }
      .of-empty { text-align:center; padding:60px 20px; color:var(--of-ink3); background:#fff; border-radius:16px; box-shadow:0 1px 2px rgba(20,21,26,.05); }
      .of-empty b { display:block; color:var(--of-ink); font-size:17px; margin-bottom:6px; }

      /* editor */
      .of-bar { position:sticky; top:62px; z-index:30; display:flex; align-items:center; gap:12px; flex-wrap:wrap; background:rgba(243,244,247,.9); backdrop-filter:blur(12px); padding:10px 0 12px; margin-bottom:6px; }
      .of-bar .of-back { display:inline-flex; align-items:center; gap:6px; }
      .of-sum { display:flex; gap:8px; margin-left:auto; flex-wrap:wrap; }
      .of-sum div { background:#fff; border-radius:12px; padding:7px 14px; box-shadow:0 1px 2px rgba(20,21,26,.05),0 0 0 1px rgba(20,21,26,.04); font-variant-numeric:tabular-nums; }
      .of-sum span { display:block; font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.07em; color:var(--of-ink3); }
      .of-sum b { font:700 15px 'Inter',sans-serif; letter-spacing:-.02em; }
      .of-saved { font-size:12px; font-weight:600; color:var(--of-ink3); } .of-saved.ok { color:#1F7A5A; }
      .of-sec { background:#fff; border-radius:16px; box-shadow:0 1px 2px rgba(20,21,26,.05),0 0 0 1px rgba(20,21,26,.04); margin-bottom:14px; overflow:hidden; }
      .of-sec-h { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:13px 18px; border-bottom:1px solid var(--of-line); }
      .of-sec-h h3 { margin:0; font:650 15px 'Inter',sans-serif; letter-spacing:-.01em; }
      .of-sec-b { padding:16px 18px; }
      .of-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px 14px; }
      .of-f label { display:block; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--of-ink3); margin-bottom:5px; }
      .of-f input, .of-f select, .of-f textarea { width:100%; box-sizing:border-box; padding:9px 11px; border:1px solid rgba(20,21,26,.15); border-radius:10px; font:14px 'Inter',sans-serif; background:#fff; }
      .of-f textarea { min-height:84px; resize:vertical; } .of-f.wide { grid-column:1/-1; }
      .of-apic { display:flex; gap:6px; } .of-apic a { display:inline-flex; align-items:center; padding:0 11px; border-radius:10px; background:var(--of-accsoft); color:#8A6B2F; text-decoration:none; font-size:12px; font-weight:700; }
      .of-par { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; }
      .of-t { width:100%; border-collapse:collapse; font-size:13.5px; min-width:760px; }
      .of-t th { text-align:right; font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.07em; color:var(--of-ink3); padding:8px 8px; border-bottom:1px solid var(--of-line); white-space:nowrap; }
      .of-t th:first-child { text-align:left; }
      .of-t td { padding:5px 6px; border-bottom:1px solid rgba(20,21,26,.05); vertical-align:middle; text-align:right; font-variant-numeric:tabular-nums; }
      .of-t td:first-child { text-align:left; }
      .of-t input { width:100%; box-sizing:border-box; padding:8px 9px; border:1px solid transparent; border-radius:8px; font:14px 'Inter',sans-serif; background:rgba(184,150,90,.08); transition:border-color .15s, background .15s; }
      .of-t input:hover { background:rgba(184,150,90,.14); } .of-t input:focus { outline:0; border-color:var(--of-acc); background:#fff; }
      .of-t input.n { text-align:right; max-width:104px; } .of-t input[readonly] { background:rgba(20,21,26,.04); color:var(--of-ink2); }
      .of-t .tot td { font-weight:700; border-top:1.5px solid rgba(20,21,26,.15); background:rgba(20,21,26,.025); }
      .of-t .c { color:var(--of-ink2); white-space:nowrap; }
      .of-row-x { opacity:.35; } tr:hover .of-row-x { opacity:1; }
      .of-add { display:inline-flex; align-items:center; gap:6px; margin-top:10px; padding:7px 13px; border:1.5px dashed rgba(20,21,26,.22); border-radius:10px; background:transparent; font:600 13px 'Inter',sans-serif; color:var(--of-ink2); cursor:pointer; transition:all .2s; }
      .of-add:hover { border-color:var(--of-acc); color:#8A6B2F; background:var(--of-accsoft); }
      .of-detail-btn { margin-left:6px; padding:5px 9px; border-radius:8px; border:0; background:rgba(20,21,26,.06); font:600 11.5px 'Inter',sans-serif; color:var(--of-ink2); cursor:pointer; white-space:nowrap; }
      .of-detail-btn.on { background:var(--of-accsoft); color:#8A6B2F; }
      .of-over { display:grid; grid-template-columns:1fr auto; gap:6px 24px; max-width:560px; font-variant-numeric:tabular-nums; }
      .of-over div:nth-child(odd) { color:var(--of-ink2); } .of-over div:nth-child(even) { text-align:right; font-weight:600; }
      .of-over .big { font-size:16px; font-weight:700; color:var(--of-ink) !important; padding-top:8px; border-top:1.5px solid rgba(20,21,26,.15); }
      .of-hint { font-size:12.5px; color:var(--of-ink3); margin-top:8px; }
      .of-acts { display:flex; gap:8px; flex-wrap:wrap; margin:6px 0 40px; }
      .of-note { font-size:12.5px; color:#6B655E; background:rgba(184,150,90,.1); border-radius:10px; padding:9px 12px; margin-bottom:10px; }
      @media (max-width: 800px) { .of-card { grid-template-columns:56px 1fr; } .of-card .of-num, .of-card .of-actions { grid-column:2; text-align:left; } .of-tools { margin-left:0; width:100%; } .of-tools input { flex:1; min-width:0; } .of-sum { margin-left:0; } .of-bar { top:56px; } .of-t-wrap { overflow-x:auto; } }
    `;
    document.head.appendChild(s);
  }

  /* ── pictogrammen ── */
  const IC = {
    open: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
  };
  const svg = (p, w) => `<svg viewBox="0 0 24 24" width="${w || 17}" height="${w || 17}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;

  /* ══════════════════════════════
     LIJST
     ══════════════════════════════ */
  function verkopers() { return [...new Set(offertes.map(o => (o.verkoper || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)); }

  function filtered() {
    const q = filters.q.trim().toLowerCase();
    return offertes.filter(o => {
      if (filters.status && o.status !== filters.status) return false;
      if (filters.verkoper && o.verkoper !== filters.verkoper) return false;
      if (!q) return true;
      return [o.naam, o.klant, o.ccmId, o.verkoper, o.apicbase, o.extra, o.datum].join(' ').toLowerCase().includes(q);
    }).sort((a, b) => (b.datum || '').localeCompare(a.datum || '') || (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function renderLijst() {
    const lijst = filtered();
    const root = document.getElementById('page-offertes');
    root.innerHTML = `
      <div class="of-head">
        <h2>Offertes</h2><span class="of-count">${offertes.length}</span>
        ${cloudHtml()}
        <div class="of-tools">
          <input type="search" id="of-q" placeholder="Zoek op naam, CCM-ID, verkoper, Apicbase…" value="${esc(filters.q)}" oninput="window._ofFilter('q', this.value)">
          <select onchange="window._ofFilter('status', this.value)"><option value="">Alle statussen</option>${STATUSSEN.map(s => `<option value="${s.id}" ${filters.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
          <select onchange="window._ofFilter('verkoper', this.value)"><option value="">Alle verkopers</option>${verkopers().map(v => `<option ${filters.verkoper === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
          <button class="btn btn-gold" onclick="window._ofNieuw()">${svg(IC.plus, 15)} Nieuwe offerte</button>
        </div>
      </div>
      <div class="of-list" id="of-list">${lijstHtml(lijst)}</div>`;
  }

  function lijstHtml(lijst) {
    if (!offertes.length) {
      return `<div class="of-empty"><b>Nog geen offertes</b>Maak je eerste offerte aan. Alles wat je invult blijft bewaard, met CCM-nummer en verkoper, zodat je het later makkelijk terugvindt.</div>`;
    }
    if (!lijst.length) return `<div class="of-empty"><b>Niets gevonden</b>Pas je zoekopdracht of filters aan.</div>`;
    return lijst.map(o => {
      const r = calc(o), d = datumDeel(o.datum), st = STATUSSEN.find(s => s.id === o.status) || STATUSSEN[0];
      return `
      <div class="of-card" onclick="window._ofOpen('${o.id}')">
        <div class="of-date"><b>${d.d}</b><span>${d.m || 'geen datum'}</span></div>
        <div class="of-card-main">
          <b>${esc(o.naam || 'Zonder naam')}${o.klant ? ` <span style="font-weight:500;color:#8B90A0">· ${esc(o.klant)}</span>` : ''}</b>
          <div class="of-card-sub">
            ${o.ccmId ? `<span class="of-chip ccm">CCM ${esc(o.ccmId)}</span>` : ''}
            ${o.verkoper ? `<span class="of-chip vk">${esc(o.verkoper)}</span>` : ''}
            ${o.apicbase ? `<span class="of-chip">Apicbase ${esc(isUrl(o.apicbase) ? 'link' : o.apicbase)}</span>` : ''}
          </div>
        </div>
        <div class="of-num"><b>${r.kaart ? eur(r.kaart) : '—'}</b><span>${num(o.pax)} pax · kost ${eur(r.kost)}${r.kaart ? ' · marge ' + pct(r.margePct) : ''}</span></div>
        <div class="of-actions" onclick="event.stopPropagation()">
          <span class="of-status ${st.id}" style="align-self:center;margin-right:6px">${st.label}</span>
          <button class="of-ib" title="Dupliceren" onclick="window._ofDup('${o.id}')">${svg(IC.copy)}</button>
          <button class="of-ib del" title="Verwijderen" onclick="window._ofDel('${o.id}')">${svg(IC.trash)}</button>
        </div>
      </div>`;
    }).join('');
  }

  window._ofFilter = function (k, v) {
    filters[k] = v;
    if (k === 'q') { const el = document.getElementById('of-list'); if (el) el.innerHTML = lijstHtml(filtered()); }
    else renderLijst();
  };

  /* ══════════════════════════════
     EDITOR
     ══════════════════════════════ */
  function itemRow(s, it) {
    const heeftDetail = !!it.detail;
    return `
    <tr>
      <td><input data-s="${s.id}" data-i="${it.id}" data-f="naam" value="${esc(it.naam)}" placeholder="Gerecht / omschrijving" oninput="window._ofIn(this)"></td>
      <td style="white-space:nowrap">
        <input class="n" type="number" step="0.01" min="0" inputmode="decimal" data-s="${s.id}" data-i="${it.id}" data-f="akp" value="${heeftDetail ? '' : (it.akp || '')}" ${heeftDetail ? 'readonly' : ''} placeholder="${heeftDetail ? '' : '0,00'}" oninput="window._ofIn(this)" data-k="i:${it.id}:akpin">
        <button class="of-detail-btn ${heeftDetail ? 'on' : ''}" title="Gedetailleerde berekening (bv. buffet of hoofdgerecht met keuzes)" onclick="window._ofDetail('${s.id}','${it.id}')">${heeftDetail ? 'Detail ✓' : 'Detail'}</button>
      </td>
      <td class="c" data-k="i:${it.id}:verl"></td>
      <td class="c" data-k="i:${it.id}:vex"></td>
      <td class="c" data-k="i:${it.id}:vin"></td>
      <td><input class="n" type="number" step="0.5" min="0" inputmode="decimal" data-s="${s.id}" data-i="${it.id}" data-f="kaart" value="${it.kaart || ''}" placeholder="€" oninput="window._ofIn(this)"></td>
      <td style="width:34px"><button class="of-ib of-row-x" title="Rij verwijderen" onclick="window._ofRijDel('${s.id}','${it.id}')">${svg(IC.x, 15)}</button></td>
    </tr>`;
  }

  function foodHtml(o) {
    return o.secties.map(s => `
      <div class="of-sec">
        <div class="of-sec-h">
          <h3><input value="${esc(s.naam)}" data-s="${s.id}" data-f="secnaam" oninput="window._ofIn(this)" style="font:650 15px Inter,sans-serif;border:0;background:transparent;width:260px;padding:2px 0"></h3>
          <button class="of-ib del" title="Sectie verwijderen" onclick="window._ofSecDel('${s.id}')">${svg(IC.trash)}</button>
        </div>
        <div class="of-sec-b of-t-wrap" style="padding-top:6px">
          <table class="of-t">
            <thead><tr><th>Omschrijving</th><th>AKP / pax</th><th>Verliesmarge</th><th>VKP excl. btw</th><th>VKP incl. btw</th><th>Kaartprijs incl. btw</th><th></th></tr></thead>
            <tbody>${s.items.map(it => itemRow(s, it)).join('')}
              <tr class="tot"><td>Totaal ${esc(s.naam)}</td><td data-k="s:${s.id}:akp"></td><td data-k="s:${s.id}:verl"></td><td data-k="s:${s.id}:vex"></td><td data-k="s:${s.id}:vin"></td><td data-k="s:${s.id}:kaart"></td><td></td></tr>
            </tbody>
          </table>
          <button class="of-add" onclick="window._ofRijAdd('${s.id}')">${svg(IC.plus, 14)} Gerecht toevoegen</button>
        </div>
      </div>`).join('');
  }

  function renderEditor() {
    const o = cur;
    const st = STATUSSEN;
    document.getElementById('page-offertes').innerHTML = `
      <div class="of-bar">
        <button class="btn of-back" onclick="window._ofTerug()">${svg(IC.back, 15)} Alle offertes</button>
        <span id="of-saved" class="of-saved ok">Bewaard ✓</span>
        ${cloudHtml()}
        <div class="of-sum">
          <div><span>Kostprijs / pax</span><b data-k="sum:kost"></b></div>
          <div><span>Kaartprijs / pax</span><b data-k="sum:kaart"></b></div>
          <div><span>Marge (excl. btw)</span><b data-k="sum:marge"></b></div>
        </div>
      </div>

      <div class="of-sec">
        <div class="of-sec-h"><h3>Gegevens</h3>
          <select data-h="status" onchange="window._ofIn(this)" style="padding:6px 10px;border-radius:99px;border:1px solid rgba(20,21,26,.15);font:600 12.5px Inter,sans-serif">${st.map(s => `<option value="${s.id}" ${o.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
        </div>
        <div class="of-sec-b of-grid">
          <div class="of-f"><label>Offerte / event</label><input data-h="naam" value="${esc(o.naam)}" placeholder="bv. Diedjies NYE" oninput="window._ofIn(this)"></div>
          <div class="of-f"><label>Klant</label><input data-h="klant" value="${esc(o.klant)}" oninput="window._ofIn(this)"></div>
          <div class="of-f"><label>CCM-boekingsnummer</label><input data-h="ccmId" value="${esc(o.ccmId)}" placeholder="ID in CCM" oninput="window._ofIn(this)"></div>
          <div class="of-f"><label>Verkoper</label><input data-h="verkoper" list="of-verkopers" value="${esc(o.verkoper)}" placeholder="Wie vroeg dit aan?" oninput="window._ofIn(this)"><datalist id="of-verkopers">${verkopers().map(v => `<option value="${esc(v)}">`).join('')}</datalist></div>
          <div class="of-f"><label>Datum van het feest</label><input type="date" data-h="datum" value="${esc(o.datum)}" oninput="window._ofIn(this)"></div>
          <div class="of-f"><label>Aantal pax (couverts)</label><input type="number" min="0" inputmode="numeric" data-h="pax" value="${o.pax || ''}" oninput="window._ofIn(this)"></div>
          <div class="of-f"><label>Apicbase-code of link</label><div class="of-apic"><input data-h="apicbase" value="${esc(o.apicbase)}" placeholder="code of https://…" oninput="window._ofIn(this)"><a id="of-apic-link" href="${isUrl(o.apicbase) ? esc(o.apicbase) : '#'}" target="_blank" rel="noopener" style="${isUrl(o.apicbase) ? '' : 'display:none'}">Open ↗</a></div></div>
          <div class="of-f wide"><label>Extra vermeldingen</label><textarea data-h="extra" placeholder="Alles wat je niet wil vergeten: afspraken, allergieën, bedenkingen, wat je hebt uitgevonden…" oninput="window._ofIn(this)">${esc(o.extra)}</textarea></div>
        </div>
      </div>

      <div class="of-sec">
        <div class="of-sec-h"><h3>Rekenfactoren</h3><span class="of-hint" style="margin:0">De waarden worden bij een nieuwe offerte overgenomen</span></div>
        <div class="of-sec-b of-par">
          ${[['margeFood', 'Margefactor food'], ['btwFood', 'BTW-factor food (12%)'], ['verlies', 'Verliesmarge food']]
            .map(([k, l]) => `<div class="of-f"><label>${l}</label><input type="number" step="0.01" inputmode="decimal" data-par="${k}" value="${o.par[k]}" oninput="window._ofIn(this)"></div>`).join('')}
        </div>
      </div>

      ${foodHtml(o)}
      <button class="of-add" style="margin:-4px 0 14px" onclick="window._ofSecAdd()">${svg(IC.plus, 14)} Sectie toevoegen</button>

      <div class="of-sec">
        <div class="of-sec-h"><h3>Food totaal</h3></div>
        <div class="of-sec-b of-t-wrap" style="padding-top:0"><table class="of-t"><tbody><tr class="tot"><td>FOOD TOTAAL</td><td data-k="food:akp"></td><td data-k="food:verl"></td><td data-k="food:vex"></td><td data-k="food:vin"></td><td data-k="food:kaart"></td><td style="width:34px"></td></tr></tbody></table></div>
      </div>

      <div class="of-sec">
        <div class="of-sec-h"><h3>Overzicht</h3></div>
        <div class="of-sec-b">
          <div class="of-over">
            <div>Kostprijs food / pax (incl. verliesmarge, excl. btw)</div><div data-k="kost"></div>
            <div>Verkoopprijs food / pax (excl. btw)</div><div data-k="food:vex"></div>
            <div>Verkoopprijs food / pax (incl. btw)</div><div data-k="food:vin"></div>
            <div class="big">Kaartprijs food / pax (incl. btw)</div><div class="big" data-k="kaart"></div>
          </div>
          <div class="of-over" style="margin-top:14px">
            <div>Marge op de kaartprijs / pax (excl. btw)</div><div data-k="marge"></div>
            <div>Marge %</div><div data-k="margepct"></div>
            <div>Totale kostprijs (hele event)</div><div data-k="kosttot"></div>
            <div class="big">Totale kaartprijs (hele event, incl. btw)</div><div class="big" data-k="kaarttot"></div>
          </div>
          <div class="of-hint">Marge = kaartprijs zonder btw min kostprijs. Vul bij de gerechten de kaartprijs in die je aan de klant geeft.</div>
        </div>
      </div>

      <div class="of-acts">
        <button class="btn btn-gold" onclick="window._ofExport('xlsx')">Excel downloaden</button>
        <button class="btn btn-primary" onclick="window._ofExport('pdf')">PDF downloaden</button>
        <button class="btn" onclick="window._ofDrive('pdf')" title="Slaat de PDF op in Google Drive">Opslaan in Drive (PDF)</button>
        <button class="btn" onclick="window._ofDrive('xlsx')">Opslaan in Drive (Excel)</button>
        <button class="btn" onclick="window._ofMail()">E-mail opstellen</button>
        <button class="btn" onclick="window._ofDup('${o.id}')">Dupliceren</button>
        <span id="of-drive-link"></span>
      </div>`;
    updateComputed();
    renderDriveLink();
  }

  /* ── live berekening in het scherm ── */
  function updateComputed() {
    if (!cur) return;
    const r = calc(cur);
    const m = {};
    const f = (p, o) => Object.keys(o).forEach(k => { m[p + k] = eur(o[k]); });
    Object.entries(r.items).forEach(([id, v]) => { m[`i:${id}:verl`] = eur(v.verl); m[`i:${id}:vex`] = eur(v.vex); m[`i:${id}:vin`] = eur(v.vin); });
    Object.entries(r.secs).forEach(([id, v]) => f(`s:${id}:`, v));
    f('food:', r.food);
    m.kost = eur(r.kost); m.kaart = r.kaart ? eur(r.kaart) : '—';
    m.marge = r.kaart ? eur(r.marge) : '—'; m.margepct = r.kaart ? pct(r.margePct) : '—';
    m.kosttot = eur(r.kostTot); m.kaarttot = eur(r.kaartTot);
    m['sum:kost'] = eur(r.kost); m['sum:kaart'] = r.kaart ? eur(r.kaart) : '—'; m['sum:marge'] = r.kaart ? `${eur(r.marge)} · ${pct(r.margePct)}` : '—';
    document.querySelectorAll('#page-offertes [data-k]').forEach(el => {
      const k = el.dataset.k;
      if (k in m) el.textContent = m[k];
      else if (/^i:.+:akpin$/.test(k) && el.readOnly) el.value = (r.items[k.split(':')[1]] || { akp: 0 }).akp.toFixed(2);
    });
    // detail-items tonen de berekende AKP in het (alleen-lezen) veld
    Object.entries(r.items).forEach(([id, v]) => {
      const inp = document.querySelector(`[data-k="i:${id}:akpin"]`);
      if (inp && inp.readOnly) inp.value = v.akp.toFixed(2);
    });
  }

  function findItem(sid, iid) {
    const s = cur.secties.find(x => x.id === sid);
    return s && s.items.find(i => i.id === iid);
  }

  window._ofIn = function (el) {
    if (!cur) return;
    const d = el.dataset, v = el.value;
    if (d.h) {
      const num_ = d.h === 'pax';
      cur[d.h] = num_ ? num(v) : v;
      if (d.h === 'apicbase') {
        const a = document.getElementById('of-apic-link');
        if (a) { a.style.display = isUrl(v) ? '' : 'none'; a.href = isUrl(v) ? v.trim() : '#'; }
      }
    } else if (d.par) {
      cur.par[d.par] = num(v);
    } else if (d.f === 'secnaam') {
      const s = cur.secties.find(x => x.id === d.s); if (s) s.naam = v;
    } else if (d.i) {
      const it = findItem(d.s, d.i); if (!it) return;
      it[d.f] = ['akp', 'kaart'].includes(d.f) ? num(v) : v;
    }
    updateComputed();
    scheduleSave();
  };

  window._ofRijAdd = function (sid) { const s = cur.secties.find(x => x.id === sid); if (s) { s.items.push(newItem()); scheduleSave(); renderEditor(); } };
  window._ofRijDel = function (sid, iid) {
    const s = cur.secties.find(x => x.id === sid); if (!s) return;
    if (s.items.length > 1) s.items = s.items.filter(i => i.id !== iid); else s.items = [newItem()];
    scheduleSave(); renderEditor();
  };
  window._ofSecAdd = function () { cur.secties.push({ id: uid(), naam: 'Nieuwe sectie', items: [newItem()] }); scheduleSave(); renderEditor(); };
  window._ofSecDel = function (sid) {
    const s = cur.secties.find(x => x.id === sid);
    if (s && s.items.some(geldigItem) && !confirm(`Sectie "${s.naam}" met alle gerechten verwijderen?`)) return;
    cur.secties = cur.secties.filter(x => x.id !== sid); scheduleSave(); renderEditor();
  };
  /* ══════════════════════════════
     DETAILBEREKENING (bv. buffet-hoofdgerecht met keuzes)
     Gemiddelde AKP / pax = Σ (AKP van het onderdeel × aantal pax dat het kiest) / basis-pax.
     ══════════════════════════════ */
  let detCtx = null;
  window._ofDetail = function (sid, iid) {
    const it = findItem(sid, iid); if (!it) return;
    if (!it.detail) it.detail = { basis: 100, groepen: [{ id: uid(), naam: 'Vlees', items: [{ id: uid(), naam: '', akp: 0, aantal: 0 }] }] };
    detCtx = { sid, iid };
    openDetail();
  };
  function openDetail() {
    const it = findItem(detCtx.sid, detCtx.iid), d = it.detail;
    let m = document.getElementById('of-detail-modal');
    if (!m) { m = document.createElement('div'); m.id = 'of-detail-modal'; m.className = 'modal-overlay'; m.onclick = e => { if (e.target === m) window._ofDetailSluit(); }; document.body.appendChild(m); }
    const tot = detailAkp(d);
    m.innerHTML = `
      <div class="modal" style="max-width:760px;max-height:88vh;display:flex;flex-direction:column">
        <div class="modal-header"><span class="modal-title">Detailberekening — ${esc(it.naam || 'gerecht')}</span><button class="modal-close" onclick="window._ofDetailSluit()">×</button></div>
        <div class="modal-body" style="overflow-y:auto">
          <div class="of-note">Vul per onderdeel de AKP per portie in en hoeveel van de pax dit kiest. De gemiddelde AKP / pax = Σ(AKP × aantal) ÷ basis-pax. De verliesmarge en margefactor worden daarna één keer toegepast.</div>
          <div class="of-f" style="max-width:220px;margin-bottom:12px"><label>Basis-pax</label><input type="number" min="1" value="${d.basis}" oninput="window._ofDetailIn('basis',this.value)"></div>
          ${d.groepen.map(g => `
            <div style="margin-bottom:14px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <input value="${esc(g.naam)}" oninput="window._ofDetailIn('gnaam',this.value,'${g.id}')" style="font:650 13px Inter,sans-serif;border:0;background:rgba(20,21,26,.05);border-radius:8px;padding:6px 10px">
                <button class="of-ib del" title="Groep verwijderen" onclick="window._ofDetailGDel('${g.id}')">${svg(IC.trash, 15)}</button>
              </div>
              <table class="of-t" style="min-width:0"><thead><tr><th>Onderdeel</th><th>AKP / portie</th><th>Aantal pax</th><th>Totaal AKP</th><th></th></tr></thead>
                <tbody>${g.items.map(i => `<tr>
                  <td><input value="${esc(i.naam)}" placeholder="bv. Contre filet" oninput="window._ofDetailIn('inaam',this.value,'${g.id}','${i.id}')"></td>
                  <td><input class="n" type="number" step="0.01" min="0" value="${i.akp || ''}" oninput="window._ofDetailIn('iakp',this.value,'${g.id}','${i.id}')"></td>
                  <td><input class="n" type="number" step="1" min="0" value="${i.aantal || ''}" oninput="window._ofDetailIn('iaantal',this.value,'${g.id}','${i.id}')"></td>
                  <td class="c" data-dk="${i.id}">${eur(num(i.akp) * num(i.aantal))}</td>
                  <td style="width:34px"><button class="of-ib of-row-x" onclick="window._ofDetailIDel('${g.id}','${i.id}')">${svg(IC.x, 15)}</button></td></tr>`).join('')}</tbody></table>
              <button class="of-add" onclick="window._ofDetailIAdd('${g.id}')">${svg(IC.plus, 14)} Onderdeel</button>
            </div>`).join('')}
          <button class="of-add" onclick="window._ofDetailGAdd()">${svg(IC.plus, 14)} Groep toevoegen (bv. Sauzen, Koolhydraten, Groenten)</button>
        </div>
        <div class="modal-footer" style="justify-content:space-between">
          <div style="font-size:14px">Gemiddelde AKP / pax: <b id="of-detail-tot">${eur(tot)}</b></div>
          <div style="display:flex;gap:8px"><button class="btn" onclick="window._ofDetailWeg()">Detail verwijderen</button><button class="btn btn-primary" onclick="window._ofDetailSluit()">Klaar</button></div>
        </div>
      </div>`;
    m.style.display = 'flex';
  }
  window._ofDetailIn = function (what, v, gid, iid) {
    const it = findItem(detCtx.sid, detCtx.iid), d = it.detail;
    const g = d.groepen.find(x => x.id === gid), i = g && g.items.find(x => x.id === iid);
    if (what === 'basis') d.basis = Math.max(1, num(v));
    else if (what === 'gnaam' && g) g.naam = v;
    else if (what === 'inaam' && i) i.naam = v;
    else if (what === 'iakp' && i) i.akp = num(v);
    else if (what === 'iaantal' && i) i.aantal = num(v);
    if (i) { const c = document.querySelector(`[data-dk="${iid}"]`); if (c) c.textContent = eur(num(i.akp) * num(i.aantal)); }
    document.getElementById('of-detail-tot').textContent = eur(detailAkp(d));
  };
  window._ofDetailGAdd = function () { const d = findItem(detCtx.sid, detCtx.iid).detail; d.groepen.push({ id: uid(), naam: 'Nieuwe groep', items: [{ id: uid(), naam: '', akp: 0, aantal: 0 }] }); openDetail(); };
  window._ofDetailGDel = function (gid) { const d = findItem(detCtx.sid, detCtx.iid).detail; d.groepen = d.groepen.filter(g => g.id !== gid); if (!d.groepen.length) d.groepen = [{ id: uid(), naam: 'Groep', items: [{ id: uid(), naam: '', akp: 0, aantal: 0 }] }]; openDetail(); };
  window._ofDetailIAdd = function (gid) { const d = findItem(detCtx.sid, detCtx.iid).detail; d.groepen.find(g => g.id === gid).items.push({ id: uid(), naam: '', akp: 0, aantal: 0 }); openDetail(); };
  window._ofDetailIDel = function (gid, iid) { const g = findItem(detCtx.sid, detCtx.iid).detail.groepen.find(g => g.id === gid); g.items = g.items.filter(i => i.id !== iid); if (!g.items.length) g.items = [{ id: uid(), naam: '', akp: 0, aantal: 0 }]; openDetail(); };
  window._ofDetailWeg = function () { const it = findItem(detCtx.sid, detCtx.iid); it.akp = detailAkp(it.detail); delete it.detail; window._ofDetailSluit(); };
  window._ofDetailSluit = function () {
    const m = document.getElementById('of-detail-modal'); if (m) m.style.display = 'none';
    detCtx = null; scheduleSave(); renderEditor();
  };

  /* ══════════════════════════════
     ACTIES: nieuw, open, dupliceren, verwijderen
     ══════════════════════════════ */
  window._ofNieuw = function () { cur = nieuweOfferte(); view = 'editor'; offertes.push(cur); saveLocal(); renderEditor(); window.scrollTo(0, 0); };
  window._ofOpen = function (id) { const o = offertes.find(x => x.id === id); if (!o) return; cur = o; view = 'editor'; renderEditor(); window.scrollTo(0, 0); };
  window._ofTerug = function () {
    clearTimeout(saveTimer);
    if (cur) {
      // volledig lege, nooit ingevulde offertes niet bewaren
      const leeg = !cur.naam && !cur.klant && !cur.ccmId && !cur.verkoper && !cur.extra && !cur.secties.some(s => s.items.some(geldigItem));
      const i = offertes.findIndex(o => o.id === cur.id);
      if (leeg) { if (i >= 0) offertes.splice(i, 1); } else { cur.updatedAt = Date.now(); if (i >= 0) offertes[i] = cur; pushCloud(cur); }
      saveLocal();
    }
    cur = null; view = 'lijst'; renderLijst();
  };
  window._ofDup = function (id) {
    const src = offertes.find(o => o.id === id) || cur; if (!src) return;
    if (cur && src.id === cur.id) { clearTimeout(saveTimer); saveLocal(); }
    const kopie = JSON.parse(JSON.stringify(src));
    kopie.id = uid(); kopie.createdAt = Date.now(); kopie.updatedAt = Date.now(); kopie.status = 'concept';
    kopie.naam = (src.naam || 'Offerte') + ' (kopie)'; kopie.ccmId = ''; delete kopie.driveUrl;
    offertes.push(kopie); saveLocal(); pushCloud(kopie);
    cur = kopie; view = 'editor'; renderEditor(); window.scrollTo(0, 0);
  };
  window._ofDel = function (id) {
    const o = offertes.find(x => x.id === id); if (!o) return;
    if (!confirm(`Offerte "${o.naam || 'zonder naam'}" definitief verwijderen?`)) return;
    offertes = offertes.filter(x => x.id !== id); saveLocal(); deleteCloud(id); renderLijst();
  };

  /* ══════════════════════════════
     EXPORT
     ══════════════════════════════ */
  function bestandsnaam(o, ext) {
    const stuk = [o.naam || 'Offerte', o.datum, o.ccmId ? 'CCM' + o.ccmId : ''].filter(Boolean).join(' ');
    return stuk.replace(/[\\/:*?"<>|]+/g, '-').trim() + '.' + ext;
  }
  function download(blob, naam) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = naam;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  // Excel met echte formules (zelfde opbouw als je sjabloon), zodat het ook buiten de app nog aan te passen is
  function buildXlsx(o) {
    const r = calc(o), p = o.par;
    const aoa = [], cells = {};
    const put = (addr, v, f) => { cells[addr] = f ? { t: 'n', v, f } : (typeof v === 'number' ? { t: 'n', v } : { t: 's', v: String(v == null ? '' : v) }); };
    let row = 1;
    const T = (txt) => { put('A' + row, txt); row++; };
    T(`Offerte — ${o.naam || ''}`); row++;
    [['Klant', o.klant], ['CCM-boekingsnummer', o.ccmId], ['Verkoper', o.verkoper], ['Datum feest', datumNl(o.datum)], ['Status', (STATUSSEN.find(s => s.id === o.status) || {}).label],
     ['Apicbase', o.apicbase], ['Extra vermeldingen', o.extra]].forEach(([k, v]) => { put('A' + row, k); put('B' + row, v || ''); row++; });
    row++; T('PARAMETERS');
    const R = {};
    [['pax', 'Aantal pax (couverts)', num(o.pax)], ['margeFood', 'Margefactor food', p.margeFood], ['btwFood', 'BTW-factor food (12%)', p.btwFood], ['verlies', 'Verliesmarge food', p.verlies]]
      .forEach(([k, l, v]) => { put('A' + row, l); put('B' + row, v); R[k] = '$B$' + row; row++; });
    row++;
    ['Omschrijving', 'AKP / pax', 'Verliesmarge', 'VKP excl. btw / pax', 'VKP incl. btw / pax', 'Kaartprijs incl. btw'].forEach((h, i) => put('ABCDEF'[i] + row, h)); row++;
    const foodStart = row; const detailBladen = [];
    o.secties.forEach(s => {
      const items = s.items.filter(geldigItem); if (!items.length) return;
      put('A' + row, (s.naam || '').toUpperCase()); row++;
      items.forEach(it => {
        const v = r.items[it.id];
        put('A' + row, it.naam || ''); put('B' + row, +v.akp.toFixed(4));
        put('C' + row, v.verl, `B${row}*${R.verlies}`); put('D' + row, v.vex, `C${row}*${R.margeFood}`); put('E' + row, v.vin, `D${row}*${R.btwFood}`);
        if (v.kaart) put('F' + row, v.kaart);
        if (it.detail) detailBladen.push(it);
        row++;
      });
    });
    const foodEnd = row - 1;
    put('A' + row, 'FOOD TOTAAL');
    ['B', 'C', 'D', 'E', 'F'].forEach(c => put(c + row, { B: r.food.akp, C: r.food.verl, D: r.food.vex, E: r.food.vin, F: r.food.kaart }[c], `SUM(${c}${foodStart}:${c}${foodEnd})`));
    const rFood = row; row += 2;
    T('OVERZICHT');
    put('A' + row, 'Kostprijs food / pax (incl. verliesmarge, excl. btw)'); put('F' + row, r.kost, `C${rFood}`); const rKost = row; row++;
    put('A' + row, 'Kaartprijs food / pax (incl. btw)'); put('F' + row, r.kaart, `F${rFood}`); const rKaart = row; row++;
    put('A' + row, 'Kaartprijs food / pax (excl. btw)'); put('F' + row, r.kaart / p.btwFood, `F${rKaart}/${R.btwFood}`); const rEx = row; row++;
    put('A' + row, 'Marge op de kaartprijs / pax (excl. btw)'); put('F' + row, r.marge, `IF(F${rKaart}=0,0,F${rEx}-F${rKost})`); const rMarge = row; row++;
    put('A' + row, 'Marge %'); put('F' + row, r.margePct, `IF(F${rEx}=0,0,F${rMarge}/F${rEx})`); row += 2;
    put('A' + row, 'Totale kostprijs (hele event)'); put('F' + row, r.kostTot, `F${rKost}*${R.pax}`); row++;
    put('A' + row, 'Totale kaartprijs (hele event, incl. btw)'); put('F' + row, r.kaartTot, `F${rKaart}*${R.pax}`);

    const ws = {}; Object.assign(ws, cells); ws['!ref'] = `A1:F${row}`;
    ws['!cols'] = [{ wch: 62 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Offerte');
    detailBladen.forEach((it, n) => {
      const rows = [[`Detailberekening — ${it.naam || ''}`], [], ['Onderdeel', 'AKP / portie', 'Aantal pax', 'Totaal']];
      (it.detail.groepen || []).forEach(g => { rows.push([(g.naam || '').toUpperCase()]); (g.items || []).forEach(i => rows.push([i.naam, num(i.akp), num(i.aantal), num(i.akp) * num(i.aantal)])); });
      rows.push([], ['Basis-pax', num(it.detail.basis)], ['Gemiddelde AKP / pax', detailAkp(it.detail)]);
      const w2 = XLSX.utils.aoa_to_sheet(rows); w2['!cols'] = [{ wch: 50 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, w2, ('Detail ' + (n + 1)).slice(0, 31));
    });
    return wb;
  }

  async function ensureJsPdf() {
    if (window.jspdf) return;
    await new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = res; s.onerror = () => rej(new Error('jsPDF niet geladen')); document.head.appendChild(s);
    });
  }
  async function buildPdf(o) {
    await ensureJsPdf();
    const { jsPDF } = window.jspdf, doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const r = calc(o), W = 210, M = 14; let y = 0;
    const colX = [M, 112, 133, 154, 175, 196]; // omschrijving + 5 rechts-uitgelijnde kolommen
    const E = n => eur(n).replace(/ /g, ' ');
    const newPage = () => { doc.addPage(); y = 16; };
    const need = h => { if (y + h > 282) newPage(); };
    doc.setFillColor(20, 21, 26); doc.rect(0, 0, W, 22, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('Offerte — menukalkulatie', M, 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(212, 180, 131); doc.text('Huis van Wonterghem', M, 16.5);
    y = 31;
    doc.setTextColor(20, 21, 26); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text(o.naam || 'Zonder naam', M, y); y += 7;
    const meta = [['Klant', o.klant], ['CCM-boekingsnr.', o.ccmId], ['Verkoper', o.verkoper], ['Datum feest', datumNl(o.datum)], ['Aantal pax', String(num(o.pax))],
      ['Status', (STATUSSEN.find(s => s.id === o.status) || {}).label], ['Apicbase', o.apicbase]].filter(x => x[1]);
    doc.setFontSize(9);
    meta.forEach(([k, v]) => { need(5); doc.setFont('helvetica', 'bold'); doc.setTextColor(139, 144, 160); doc.text(k.toUpperCase(), M, y); doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 21, 26);
      const lines = doc.splitTextToSize(String(v), 130); doc.text(lines, M + 38, y); y += 4.6 * lines.length; });
    if (o.extra) { y += 2; need(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(139, 144, 160); doc.text('EXTRA VERMELDINGEN', M, y); y += 4.6;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(20, 21, 26); doc.splitTextToSize(o.extra, W - 2 * M).forEach(l => { need(5); doc.text(l, M, y); y += 4.4; }); }
    y += 4;
    const head = (cols) => { need(14); doc.setFillColor(243, 244, 247); doc.rect(M - 1, y - 4, W - 2 * M + 2, 7, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(110, 115, 130);
      cols.forEach((c, i) => doc.text(c, i === 0 ? colX[0] : colX[i], y, i === 0 ? {} : { align: 'right' })); y += 6; };
    const line = (vals, bold) => { need(6); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(8.8); doc.setTextColor(20, 21, 26);
      const naam = doc.splitTextToSize(String(vals[0] || ''), 92); doc.text(naam, colX[0], y);
      vals.slice(1).forEach((v, i) => { if (v !== '' && v != null) doc.text(String(v), colX[i + 1], y, { align: 'right' }); });
      y += 4.7 * Math.max(1, naam.length); if (bold) { doc.setDrawColor(200); doc.line(M, y - 3.4, W - M, y - 3.4); y += 1; } };
    const sectionTitle = t => { need(14); y += 2; doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(138, 107, 47); doc.text(t.toUpperCase(), M, y); y += 5.5; };

    sectionTitle('Gerechten');
    head(['Omschrijving', 'AKP / pax', 'Verliesm.', 'VKP excl.', 'VKP incl.', 'Kaartprijs']);
    o.secties.forEach(s => {
      const items = s.items.filter(geldigItem); if (!items.length) return;
      need(10); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(110, 115, 130); doc.text((s.naam || '').toUpperCase(), M, y); y += 4.6;
      items.forEach(it => { const v = r.items[it.id]; line([it.naam + (it.detail ? '  (detailberekening)' : ''), E(v.akp), E(v.verl), E(v.vex), E(v.vin), v.kaart ? E(v.kaart) : '']); });
    });
    line(['FOOD TOTAAL', E(r.food.akp), E(r.food.verl), E(r.food.vex), E(r.food.vin), r.food.kaart ? E(r.food.kaart) : ''], true);

    sectionTitle('Overzicht');
    const kv = (k, v, b) => { need(6); doc.setFont('helvetica', b ? 'bold' : 'normal'); doc.setFontSize(9); doc.setTextColor(20, 21, 26); doc.text(k, M, y); doc.text(v, colX[5], y, { align: 'right' }); y += 5.2; };
    kv('Kostprijs food / pax (incl. verliesmarge, excl. btw)', E(r.kost));
    kv('Verkoopprijs food / pax (excl. btw)', E(r.food.vex));
    kv('Verkoopprijs food / pax (incl. btw)', E(r.food.vin));
    kv('Kaartprijs food / pax (incl. btw)', r.kaart ? E(r.kaart) : '—', true); y += 2;
    kv('Marge op de kaartprijs / pax (excl. btw)', r.kaart ? E(r.marge) : '—'); kv('Marge %', r.kaart ? pct(r.margePct) : '—'); y += 2;
    kv('Totale kostprijs (hele event)', E(r.kostTot)); kv('Totale kaartprijs (hele event, incl. btw)', E(r.kaartTot), true);

    // detailberekeningen op een eigen pagina
    o.secties.forEach(s => s.items.filter(i => i.detail).forEach(it => {
      newPage(); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(20, 21, 26); doc.text(`Detailberekening — ${it.naam || ''}`, M, y); y += 8;
      head(['Onderdeel', 'AKP / portie', 'Aantal pax', 'Totaal AKP', '', '']);
      it.detail.groepen.forEach(g => { need(8); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(110, 115, 130); doc.text((g.naam || '').toUpperCase(), M, y); y += 4.6;
        g.items.filter(i => i.naam || num(i.akp)).forEach(i => line([i.naam, E(num(i.akp)), String(num(i.aantal)), E(num(i.akp) * num(i.aantal))])); });
      y += 2; kv(`Gemiddelde AKP / pax (basis ${num(it.detail.basis)} pax)`, E(detailAkp(it.detail)), true);
    }));
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(150); doc.text(`Huis van Wonterghem · interne kalkulatie · ${new Date().toLocaleDateString('nl-BE')}`, M, 290); doc.text(`${i} / ${n}`, W - M, 290, { align: 'right' }); }
    return doc;
  }

  async function maakBestand(kind) {
    flushSave();
    if (kind === 'xlsx') {
      const wb = buildXlsx(cur);
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      return { blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), naam: bestandsnaam(cur, 'xlsx'), mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
    }
    const doc = await buildPdf(cur);
    return { blob: doc.output('blob'), naam: bestandsnaam(cur, 'pdf'), mime: 'application/pdf' };
  }
  function flushSave() {
    if (!cur) return; clearTimeout(saveTimer);
    cur.updatedAt = Date.now();
    const i = offertes.findIndex(o => o.id === cur.id); if (i >= 0) offertes[i] = cur; else offertes.push(cur);
    saveLocal(); pushCloud(cur);
  }
  window._ofExport = async function (kind) {
    try { const f = await maakBestand(kind); download(f.blob, f.naam); toast(`${f.naam} gedownload`); }
    catch (e) { console.warn(e); toast('Exporteren mislukt: ' + (e.message || e)); }
  };

  /* ── Google Drive ──
     Vereist een OAuth-client-ID (firebase-config.js → driveClientId). Het script bewaart
     de bestanden in een map "HVW Offertes" die de app zelf aanmaakt (scope drive.file). */
  function loadGis() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = res; s.onerror = () => rej(new Error('Google-aanmelding niet bereikbaar')); document.head.appendChild(s); });
  }
  async function driveToken(clientId) {
    await loadGis();
    return new Promise((res, rej) => {
      window.google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: 'https://www.googleapis.com/auth/drive.file', callback: t => t.error ? rej(new Error(t.error)) : res(t.access_token) }).requestAccessToken();
    });
  }
  async function driveFolder(token) {
    const hdr = { Authorization: 'Bearer ' + token };
    const q = encodeURIComponent("name='HVW Offertes' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    const l = await (await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, { headers: hdr })).json();
    if (l.files && l.files[0]) return l.files[0].id;
    const c = await (await fetch('https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, hdr), body: JSON.stringify({ name: 'HVW Offertes', mimeType: 'application/vnd.google-apps.folder' }) })).json();
    return c.id;
  }
  window._ofDrive = async function (kind) {
    const cfg = window.HVW_FIREBASE || {};
    try {
      const f = await maakBestand(kind);
      if (!cfg.driveClientId) {
        download(f.blob, f.naam);
        toast('Bestand gedownload. Directe Drive-opslag is nog niet ingesteld — sleep het bestand in Drive (zie OFFERTES_DRIVE.md).');
        return;
      }
      const token = await driveToken(cfg.driveClientId);
      const folder = await driveFolder(token);
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify({ name: f.naam, parents: [folder] })], { type: 'application/json' }));
      form.append('file', f.blob);
      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form });
      const j = await res.json();
      if (!res.ok) throw new Error((j.error && j.error.message) || 'Upload mislukt');
      cur.driveUrl = j.webViewLink; flushSave(); renderDriveLink();
      toast('Opgeslagen in Drive (map HVW Offertes) ✓');
    } catch (e) { console.warn(e); toast('Drive-opslag mislukt: ' + (e.message || e)); }
  };
  function renderDriveLink() {
    const el = document.getElementById('of-drive-link'); if (!el) return;
    el.innerHTML = cur && cur.driveUrl ? `<a class="btn" href="${esc(cur.driveUrl)}" target="_blank" rel="noopener">Laatst opgeslagen in Drive ↗</a>` : '';
  }

  window._ofMail = async function () {
    const o = cur, r = calc(o);
    const onderwerp = `Offerte ${o.naam || ''}${o.ccmId ? ' — CCM ' + o.ccmId : ''}${o.datum ? ' — ' + datumNl(o.datum) : ''}`.trim();
    const tekst = [`Hallo ${o.verkoper || ''},`.replace(' ,', ','), '', `Hierbij de kalkulatie voor ${o.naam || 'het event'}${o.datum ? ' op ' + datumNl(o.datum) : ''} (${num(o.pax)} pax).`,
      o.ccmId ? `CCM-boeking: ${o.ccmId}` : '', `Kaartprijs food: ${r.kaart ? eur(r.kaart) + ' per persoon (incl. btw)' : 'nog in te vullen'}`,
      o.extra ? '\n' + o.extra : '', '', 'Groeten'].filter(x => x !== '').join('\n');
    try {
      const f = await maakBestand('pdf');
      const file = new File([f.blob], f.naam, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: onderwerp, text: tekst }); return; }
      download(f.blob, f.naam);
      toast('PDF gedownload — voeg hem toe aan de e-mail die nu opent.');
    } catch (e) { if (e && e.name === 'AbortError') return; console.warn(e); }
    location.href = `mailto:?subject=${encodeURIComponent(onderwerp)}&body=${encodeURIComponent(tekst)}`;
  };

  /* ── melding ── */
  let toastTimer = null;
  function toast(msg) {
    let el = document.getElementById('of-toast');
    if (!el) { el = document.createElement('div'); el.id = 'of-toast'; el.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:99998;background:#14151A;color:#fff;padding:12px 18px;border-radius:12px;font:500 13.5px Inter,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3);max-width:min(560px,92vw)'; document.body.appendChild(el); }
    el.textContent = msg; el.style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.style.display = 'none'; }, 5200);
  }

  /* ── start ── */
  function render() { if (view === 'editor' && cur) renderEditor(); else renderLijst(); }
  window._renderOffertes = function () { render(); };

  document.addEventListener('DOMContentLoaded', () => {
    injectCSS();
    loadLocal();
    if (typeof PAGE_TITLES !== 'undefined') PAGE_TITLES.offertes = 'Offertes';
    if (window.hvwFirebase && window.hvwFirebase.isAdmin) subscribeCloud();
  });

  // voor tests
  window._ofTest = { calc, buildXlsx, buildPdf, get offertes() { return offertes; }, get cur() { return cur; }, nieuweOfferte };
})();
