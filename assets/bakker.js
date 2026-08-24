/* ══════════════════════════════════════════
   bakker.js — Bakker Bestelformulier
   De bakker moet ALLEEN weten:
   1) Dessertbuffet — omgezet naar aantal mini's
      en aantal taarten (van 8p), berekend uit
      personen. De bakker ziet enkel de eind-
      aantallen, niet hoe we eraan komen.
   2) Dessert "to share" — enkel de bijhorende
      mini-gebakjes (1 per persoon)
   3) Elk product waar "mini gebak"/"petit four"
      in de naam staat, in eender welke categorie
      (bv. bij de receptie-hapjes)
   Al de rest van de desserts worden in eigen
   huis gemaakt en horen hier niet thuis.
   Handmatige regels kunnen worden toegevoegd
   voor uitzonderingen (te druk om zelf te maken).
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  const BAKKER_COLOR = '#8B5A2B';
  const BAKKER_BG    = '#F5EBE0';

  // Vaste volgorde van locaties, gebruikt om binnen elke dag te sorteren.
  const LOC_ORDER = ['MAE', 'HVW', 'TRA', 'BIE', 'AFH'];

  // Interne rekenregel voor dessertbuffet — NIET zichtbaar voor de bakker,
  // enkel gebruikt om de eindaantallen (mini's, taarten) te bepalen.
  const DESSERTBUFFET_PERSONS_PER_MINI = 1.5;
  const DESSERTBUFFET_MINIS_PER_TAART  = 8;

  const SUB_LABELS = {
    dessertbuffet_mini:   "Dessertbuffet — mini's",
    dessertbuffet_taart:  'Dessertbuffet — taarten',
    to_share_mini:        'Mini-gebak (to share)',
    mini_gebak:            'Mini-gebak',
  };
  const SUB_COLORS = {
    dessertbuffet_mini:   '#C2185B',
    dessertbuffet_taart:  '#C2185B',
    to_share_mini:        '#6B3A7D',
    mini_gebak:            '#B8965A',
  };

  // Herkent producten met "mini gebak", "minigebak" of "petit four(s)" in de
  // naam, ongeacht categorie — deze horen altijd bij de bakker.
  function isMiniGebakProduct(naam) {
    const n = naam.toLowerCase();
    return n.includes('mini gebak') || n.includes('minigebak') || n.includes('petit four');
  }

  // "Dessert 'to share' met ..." heeft altijd mini-gebakjes nodig, 1 per
  // persoon — maar het dessert zelf (chocolademousse, taart, ...) wordt in
  // eigen huis gemaakt en gaat niet naar de bakker.
  function isToShareDessert(naam, sub) {
    if (sub !== 'dessert') return false;
    return naam.toLowerCase().includes('to share');
  }

  const LOC_LABELS = { TRA: 'Traiteur', MAE: 'Maelstede', HVW: 'Huis van Wonterghem', BIE: 'Bierkasteel', AFH: 'Afhaal' };

  // Sorteert zaalnamen op basis van de vaste locatie-volgorde (LOC_ORDER),
  // met een fallback op alfabetische zaalnaam binnen dezelfde locatie —
  // en zalen zonder herkende locatie helemaal achteraan.
  function sortRoomsByLocation(roomNames, roomLocMap) {
    return [...roomNames].sort((a, b) => {
      const locA = roomLocMap[a] || '';
      const locB = roomLocMap[b] || '';
      const idxA = LOC_ORDER.indexOf(locA);
      const idxB = LOC_ORDER.indexOf(locB);
      const rankA = idxA === -1 ? LOC_ORDER.length : idxA;
      const rankB = idxB === -1 ? LOC_ORDER.length : idxB;
      if (rankA !== rankB) return rankA - rankB;
      return a.localeCompare(b);
    });
  }

  let manualRows = []; // handmatig toegevoegde regels/uitzonderingen: [{ id, naam, sub, dateStr, room, aantal }]
  let idCounter = 1;

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }

  /* ── CSS ── */
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      #bakker-content { display: none; padding: 26px 28px; }

      .bak-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
      .bak-toolbar select {
        font-family: 'Outfit', sans-serif; font-size: 13px; padding: 8px 12px;
        border: 1.5px solid #DEDAD4; border-radius: 8px; background: #fff; outline: none; cursor: pointer;
      }
      .bak-toolbar select:focus { border-color: #1A1917; }

      .bak-export-btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 8px 16px; background: ${BAKKER_COLOR}; color: #fff;
        border: none; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
        transition: opacity 0.15s; margin-left: auto;
      }
      .bak-export-btn:hover { opacity: 0.85; }
      .bak-export-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      .bak-add-card {
        background: #fff; border: 1px solid #E8E5E0; border-radius: 14px;
        padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); margin-bottom: 20px;
      }
      .bak-add-card h3 { margin: 0 0 14px; font-size: 14px; font-weight: 600; color: #1A1917; }
      .bak-add-row { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 10px; align-items: end; }
      .bak-add-field label { display: block; font-size: 11px; font-weight: 600; color: #9A9590; text-transform: uppercase; letter-spacing: .4px; margin-bottom: 6px; }
      .bak-add-field input, .bak-add-field select {
        width: 100%; box-sizing: border-box; font-family: 'Outfit', sans-serif; font-size: 13px;
        padding: 8px 10px; border: 1.5px solid #DEDAD4; border-radius: 8px; background: #fff; outline: none;
      }
      .bak-add-field input:focus, .bak-add-field select:focus { border-color: #1A1917; }
      .bak-add-btn {
        padding: 9px 16px; background: #1A1917; color: #fff; border: none; border-radius: 8px;
        font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; white-space: nowrap;
      }
      .bak-add-btn:hover { opacity: 0.85; }

      .bak-manual-list { margin-top: 14px; display: flex; flex-direction: column; gap: 6px; }
      .bak-manual-item {
        display: flex; align-items: center; gap: 10px; padding: 8px 12px;
        background: #FDF9F5; border: 1px solid #EFE2D3; border-radius: 8px; font-size: 12.5px;
      }
      .bak-manual-item .bak-manual-tag {
        font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px;
        color: ${BAKKER_COLOR}; background: ${BAKKER_BG}; padding: 2px 7px; border-radius: 5px; flex-shrink: 0;
      }
      .bak-manual-item .bak-manual-naam { font-weight: 600; color: #1A1917; flex: 1; }
      .bak-manual-item .bak-manual-meta { color: #9A9590; font-family: 'DM Mono', monospace; font-size: 11px; }
      .bak-manual-del {
        border: none; background: transparent; color: #C8C2B8; cursor: pointer;
        width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
        border-radius: 5px; transition: all 0.12s; flex-shrink: 0;
      }
      .bak-manual-del:hover { background: #FBEAE8; color: #B03A2E; }

      .bak-day-card {
        background: #fff; border: 1px solid #E8E5E0; border-radius: 14px;
        padding: 0; margin-bottom: 18px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      }
      .bak-day-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 18px; background: #FAF8F5; border-bottom: 1px solid #EFEAE3;
      }
      .bak-day-title { font-size: 14px; font-weight: 700; color: #1A1917; }
      .bak-day-total { font-size: 12px; color: #6B655E; font-family: 'DM Mono', monospace; }

      .bak-subhead {
        padding: 12px 18px 4px; font-size: 11px; font-weight: 700; text-transform: uppercase;
        letter-spacing: .4px; color: ${BAKKER_COLOR};
      }
      .bak-db-table { padding: 6px 18px 10px; border-bottom: 1px solid #EFEAE3; }
      .bak-db-row {
        display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px;
        padding: 7px 0; align-items: center; font-size: 13px; border-bottom: 1px solid #F4F1EC;
      }
      .bak-db-row:last-child { border-bottom: none; }
      .bak-db-head { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; color: #9A9590; }
      .bak-db-row span:first-child { font-weight: 700; color: #1A1917; }
      .bak-db-num { font-family: 'DM Mono', monospace; font-weight: 700; color: ${BAKKER_COLOR}; }

      .bak-loc-heading {
        padding: 12px 18px 4px; font-size: 10.5px; font-weight: 700; text-transform: uppercase;
        letter-spacing: .5px; color: ${BAKKER_COLOR};
      }

      .bak-zaal-block { padding: 12px 18px; border-bottom: 1px solid #F4F1EC; }
      .bak-zaal-block:last-child { border-bottom: none; }
      .bak-zaal-title { font-size: 12.5px; font-weight: 700; color: #1A1917; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }

      .bak-item-row {
        display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center;
        padding: 5px 0; font-size: 12.5px;
      }
      .bak-item-sub {
        font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px;
        padding: 2px 7px; border-radius: 5px; white-space: nowrap;
      }
      .bak-item-naam { color: #1A1917; }
      .bak-item-aantal { font-family: 'DM Mono', monospace; font-weight: 700; color: ${BAKKER_COLOR}; }

      .bak-empty { text-align: center; padding: 50px 20px; color: #9A9590; }
      .bak-empty svg { margin-bottom: 12px; color: #C8C2B8; }
      .bak-empty-title { font-size: 14px; font-weight: 600; color: #1A1917; margin-bottom: 4px; }

      @media (max-width: 768px) {
        #bakker-content { padding: 14px !important; }
        .bak-add-row { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ── Data uit allRows ── */
  function getBakkerRows() {
    if (typeof allRows === 'undefined' || !allRows.length) return [];
    const result = [];

    // Groepeer dessertbuffet-personen per feest/zaal/dag: de omrekening naar
    // mini's/taarten gebeurt op het totaal per feest, niet per losse Excel-rij.
    const dessertbuffetByFeest = {};

    allRows.forEach(r => {
      if (r.persons <= 0 || !r.name) return;

      // ── 1) Dessertbuffet: verzamel personen, later omgezet naar mini's + taarten ──
      if (r.sub === 'dessertbuffet') {
        const key = `${r.room || ''}||${r.dateStr}`;
        if (!dessertbuffetByFeest[key]) {
          const locCode = (r.location || '').toString().trim();
          dessertbuffetByFeest[key] = {
            persons: 0, room: r.room || '', dateStr: r.dateStr,
            weekKey: r.weekKey, weekLabel: r.weekLabel,
            locCode, locLabel: LOC_LABELS[locCode] || locCode,
          };
        }
        dessertbuffetByFeest[key].persons += r.persons;
        return;
      }

      // ── 2) Dessert "to share": enkel de bijhorende mini-gebakjes, niet het dessert zelf ──
      if (isToShareDessert(r.name, r.sub)) {
        pushOrMerge(result, r, 'to_share_mini', 'Mini-gebak (bij dessert to share)', r.persons);
        return;
      }

      // ── 3) Los mini-gebak/petit four, in eender welke categorie ──
      if (isMiniGebakProduct(r.name)) {
        pushOrMerge(result, r, 'mini_gebak', r.name, r.persons);
        return;
      }

      // Al de rest (gewoon Dessert, Dessert kids, ...) wordt in eigen huis
      // gemaakt en hoort niet in dit overzicht.
    });

    // Dessertbuffet-totalen omzetten naar mini's + taarten. De bakker ziet
    // enkel deze eindaantallen — geen personen, geen formule, geen "waarom".
    Object.values(dessertbuffetByFeest).forEach(f => {
      const minis = Math.round(f.persons / DESSERTBUFFET_PERSONS_PER_MINI);
      const taarten = Math.ceil(minis / DESSERTBUFFET_MINIS_PER_TAART);
      result.push({
        mergeKey: `dbmini||${f.room}||${f.dateStr}`,
        sub: 'dessertbuffet_mini', naam: 'Mini gebak',
        persons: minis, dateStr: f.dateStr, weekKey: f.weekKey, weekLabel: f.weekLabel,
        room: f.room, locCode: f.locCode, locLabel: f.locLabel, isManual: false,
      });
      result.push({
        mergeKey: `dbtaart||${f.room}||${f.dateStr}`,
        sub: 'dessertbuffet_taart', naam: `Taart (${DESSERTBUFFET_MINIS_PER_TAART}p)`,
        persons: taarten, dateStr: f.dateStr, weekKey: f.weekKey, weekLabel: f.weekLabel,
        room: f.room, locCode: f.locCode, locLabel: f.locLabel, isManual: false,
      });
    });

    // Handmatige regels/uitzonderingen toevoegen
    manualRows.forEach(m => {
      result.push({
        mergeKey: 'manual-' + m.id,
        sub: m.sub,
        naam: m.naam,
        persons: m.aantal,
        dateStr: m.dateStr || '',
        weekKey: m.dateStr ? m.dateStr.slice(0,7) : '',
        weekLabel: '',
        room: m.room || '',
        locCode: '',
        locLabel: '',
        isManual: true,
        manualId: m.id,
      });
    });

    return result;
  }

  // Voegt een rij toe of telt op bij een bestaande rij met dezelfde
  // sleutel (product + zaal + dag), zodat meerdere Excel-rijen die
  // hetzelfde product voor hetzelfde feest bevatten samengevoegd worden.
  function pushOrMerge(result, r, sub, naam, persons) {
    const locCode = (r.location || '').toString().trim();
    const mergeKey = `${sub}||${naam}||${r.room || ''}||${r.dateStr}`;
    const existing = result.find(x => x.mergeKey === mergeKey);
    if (existing) {
      existing.persons += persons;
    } else {
      result.push({
        mergeKey, sub, naam, persons,
        dateStr: r.dateStr, weekKey: r.weekKey, weekLabel: r.weekLabel,
        room: r.room || '', locCode, locLabel: LOC_LABELS[locCode] || locCode,
        isManual: false,
      });
    }
  }

  /* ── Filters ── */
  function populateFilters(rows) {
    const weekSel = document.getElementById('bak-f-week');
    const dateSel = document.getElementById('bak-f-date');
    if (!weekSel || !dateSel) return;

    const weeks = [...new Map(rows.filter(r=>r.weekKey).map(r => [r.weekKey, r.weekLabel || r.weekKey])).entries()].sort((a,b)=>a[0].localeCompare(b[0]));
    const curWeek = weekSel.value;
    weekSel.innerHTML = '<option value="">Alle weken</option>' + weeks.map(([k,l]) => `<option value="${k}">${l}</option>`).join('');
    if (weeks.some(([k]) => k === curWeek)) weekSel.value = curWeek;

    const dates = [...new Set(rows.map(r => r.dateStr).filter(Boolean))].sort();
    const curDate = dateSel.value;
    dateSel.innerHTML = '<option value="">Alle dagen</option>' + dates.map(d => `<option value="${d}">${formatDate(d)}</option>`).join('');
    if (dates.includes(curDate)) dateSel.value = curDate;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y,m,d] = parts;
    const DAG = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
    const MAAND = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
    const dt = new Date(Number(y), Number(m)-1, Number(d));
    if (isNaN(dt.getTime())) return dateStr;
    return `${DAG[dt.getDay()]} ${Number(d)} ${MAAND[Number(m)-1]} ${y}`;
  }

  /* ── Render ── */
  function renderBakker() {
    const rows = getBakkerRows();
    populateFilters(rows);

    const week = document.getElementById('bak-f-week')?.value || '';
    const date = document.getElementById('bak-f-date')?.value || '';
    const sub  = document.getElementById('bak-f-sub')?.value || '';

    const filtered = rows.filter(r => {
      if (week && r.weekKey !== week) return false;
      if (date && r.dateStr !== date) return false;
      if (sub && r.sub !== sub) return false;
      return true;
    });

    const wrap = document.getElementById('bak-days-wrap');
    if (!wrap) return;

    if (!filtered.length) {
      wrap.innerHTML = `
        <div class="bak-day-card bak-empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 11l18-5v12L3 14v-3z"/></svg>
          <div class="bak-empty-title">Nog niets gevonden</div>
          <div>Upload eerst een Excel-bestand via de Calculator, of voeg hieronder een regel toe.</div>
        </div>`;
      renderManualList();
      return;
    }

    const byDate = {};
    filtered.forEach(r => { (byDate[r.dateStr || 'onbekend'] = byDate[r.dateStr || 'onbekend'] || []).push(r); });
    const sortedDates = Object.keys(byDate).sort();

    wrap.innerHTML = sortedDates.map(dateStr => {
      const dayRows = byDate[dateStr];
      const dayLabel = dateStr === 'onbekend' ? 'Geen datum' : formatDate(dateStr);
      const dayTotal = dayRows.reduce((s,r) => s + r.persons, 0);

      const dbRows = dayRows.filter(r => r.sub === 'dessertbuffet_mini' || r.sub === 'dessertbuffet_taart');
      const overigeRows = dayRows.filter(r => r.sub !== 'dessertbuffet_mini' && r.sub !== 'dessertbuffet_taart');

      // Dessertbuffet: mini + taart van dezelfde zaal samen op 1 tabelrij
      const dbByRoom = {};
      const dbRoomLocMap = {};
      dbRows.forEach(r => {
        const roomName = r.room || 'Geen zaal';
        if (!dbByRoom[roomName]) dbByRoom[roomName] = { minis: 0, taarten: 0 };
        if (r.sub === 'dessertbuffet_mini') dbByRoom[roomName].minis += r.persons;
        else dbByRoom[roomName].taarten += r.persons;
        if (r.locCode) dbRoomLocMap[roomName] = r.locCode;
      });
      const sortedDbRooms = sortRoomsByLocation(Object.keys(dbByRoom), dbRoomLocMap);

      // Mini-gebak/to-share: per zaal, gegroepeerd per locatie zoals voorheen
      const byRoom = {};
      const roomLocMap = {};
      overigeRows.forEach(r => {
        const roomName = r.room || 'Geen zaal';
        (byRoom[roomName] = byRoom[roomName] || []).push(r);
        if (r.locCode) roomLocMap[roomName] = r.locCode;
      });
      const sortedRooms = sortRoomsByLocation(Object.keys(byRoom), roomLocMap);
      const roomsByLoc = {};
      sortedRooms.forEach(room => {
        const loc = roomLocMap[room] || '';
        (roomsByLoc[loc] = roomsByLoc[loc] || []).push(room);
      });
      const sortedLocs = Object.keys(roomsByLoc).sort((a,b) => {
        const ia = LOC_ORDER.indexOf(a), ib = LOC_ORDER.indexOf(b);
        return (ia===-1?LOC_ORDER.length:ia) - (ib===-1?LOC_ORDER.length:ib);
      });

      return `
        <div class="bak-day-card">
          <div class="bak-day-header">
            <span class="bak-day-title">${dayLabel}</span>
            <span class="bak-day-total">${dayTotal} pers. totaal</span>
          </div>

          ${sortedDbRooms.length ? `
            <div class="bak-subhead">Dessertbuffet — per zaal</div>
            <div class="bak-db-table">
              <div class="bak-db-row bak-db-head">
                <span>Zaal</span><span>Mini's</span><span>Taarten</span>
              </div>
              ${sortedDbRooms.map(room => {
                const d = dbByRoom[room];
                return `
                  <div class="bak-db-row">
                    <span>${escapeHtml(room)}</span>
                    <span class="bak-db-num">${d.minis}</span>
                    <span class="bak-db-num">${d.taarten}</span>
                  </div>`;
              }).join('')}
            </div>
          ` : ''}

          ${sortedLocs.map(loc => `
            ${sortedLocs.length > 1 ? `<div class="bak-loc-heading">${escapeHtml(LOC_LABELS[loc] || 'Overig')}</div>` : ''}
            ${roomsByLoc[loc].map(room => {
              const roomRows = byRoom[room].sort((a,b) => {
                const order = { to_share_mini: 0, mini_gebak: 1 };
                const oa = order[a.sub] ?? 9, ob = order[b.sub] ?? 9;
                if (oa !== ob) return oa - ob;
                return a.naam.localeCompare(b.naam);
              });
              return `
                <div class="bak-zaal-block">
                  <div class="bak-zaal-title">${escapeHtml(room)}</div>
                  ${roomRows.map(r => `
                    <div class="bak-item-row">
                      <span class="bak-item-sub" style="background:${SUB_COLORS[r.sub]}22;color:${SUB_COLORS[r.sub]}">${SUB_LABELS[r.sub] || r.sub}</span>
                      <span class="bak-item-naam">${escapeHtml(r.naam)}${r.isManual ? ' <span style="color:#B8965A;font-size:10px">· handmatig</span>' : ''}</span>
                      <span class="bak-item-aantal">${r.persons}</span>
                    </div>`).join('')}
                </div>`;
            }).join('')}
          `).join('')}
        </div>`;
    }).join('');

    renderManualList();
  }

  function renderManualList() {
    const el = document.getElementById('bak-manual-list');
    if (!el) return;
    if (!manualRows.length) { el.innerHTML = ''; return; }
    el.innerHTML = manualRows.map(m => `
      <div class="bak-manual-item">
        <span class="bak-manual-tag">${SUB_LABELS[m.sub] || m.sub}</span>
        <span class="bak-manual-naam">${escapeHtml(m.naam)}</span>
        <span class="bak-manual-meta">${m.dateStr ? formatDate(m.dateStr) : ''}${m.room ? ' · ' + escapeHtml(m.room) : ''} · ${m.aantal}</span>
        <button class="bak-manual-del" onclick="window._bakRemoveManual('${m.id}')" title="Verwijderen">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  /* ── Handmatige regel toevoegen ── */
  window._bakAddManual = function () {
    const naam = document.getElementById('bak-add-naam')?.value.trim();
    const sub = document.getElementById('bak-add-sub')?.value || 'mini_gebak';
    const dateStr = document.getElementById('bak-add-date')?.value || '';
    const room = document.getElementById('bak-add-room')?.value.trim() || '';
    const aantal = parseInt(document.getElementById('bak-add-aantal')?.value, 10) || 0;

    if (!naam) { document.getElementById('bak-add-naam')?.focus(); return; }
    if (!aantal || aantal <= 0) { document.getElementById('bak-add-aantal')?.focus(); return; }

    manualRows.push({ id: 'm' + idCounter++, naam, sub, dateStr, room, aantal });

    document.getElementById('bak-add-naam').value = '';
    document.getElementById('bak-add-room').value = '';
    document.getElementById('bak-add-aantal').value = '';

    renderBakker();
  };

  window._bakRemoveManual = function (id) {
    manualRows = manualRows.filter(m => m.id !== id);
    renderBakker();
  };

  /* ── PDF Export ── */
  window._exportBakkerPDF = async function () {
    const rows = getBakkerRows();
    const week = document.getElementById('bak-f-week')?.value || '';
    const date = document.getElementById('bak-f-date')?.value || '';
    const sub  = document.getElementById('bak-f-sub')?.value || '';
    const filtered = rows.filter(r => {
      if (week && r.weekKey !== week) return false;
      if (date && r.dateStr !== date) return false;
      if (sub && r.sub !== sub) return false;
      return true;
    });

    if (!filtered.length) { alert('Geen items gevonden voor de huidige selectie.'); return; }

    const btn = document.getElementById('bak-export-pdf-btn');
    if (btn) btn.disabled = true;

    try {
      if (!window.jspdf) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const PAGE_W = 210, PAGE_H = 297, MARGIN = 16;

      const byDate = {};
      filtered.forEach(r => { (byDate[r.dateStr || 'onbekend'] = byDate[r.dateStr || 'onbekend'] || []).push(r); });
      const sortedDates = Object.keys(byDate).sort();

      let titleSuffix = '';
      if (date) titleSuffix = ' — ' + formatDate(date);
      else if (week) {
        const wLabel = filtered.find(r => r.weekKey === week)?.weekLabel;
        if (wLabel) titleSuffix = ' — ' + wLabel;
      }

      let y = MARGIN;

      function ensureSpace(neededMm) {
        if (y + neededMm > PAGE_H - MARGIN) {
          doc.addPage();
          y = MARGIN;
        }
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.setTextColor(26, 25, 23);
      doc.text('Bakker — Bestelformulier' + titleSuffix, MARGIN, y);
      y += 6;
      doc.setDrawColor(...hexToRgb(BAKKER_COLOR));
      doc.setLineWidth(0.6);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
      y += 9;

      sortedDates.forEach(dateStr => {
        const dayRows = byDate[dateStr];
        const dayLabel = dateStr === 'onbekend' ? 'Geen datum' : formatDate(dateStr);
        const dayTotal = dayRows.reduce((s,r) => s + r.persons, 0);

        ensureSpace(18);
        doc.setFillColor(244, 243, 240);
        doc.rect(MARGIN, y, PAGE_W - MARGIN*2, 9, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(26, 25, 23);
        doc.text(dayLabel, MARGIN + 3, y + 6.3);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(107, 101, 94);
        doc.text(`${dayTotal} pers. totaal`, PAGE_W - MARGIN - 3, y + 6.3, { align: 'right' });
        y += 9 + 6;

        const dbRows = dayRows.filter(r => r.sub === 'dessertbuffet_mini' || r.sub === 'dessertbuffet_taart');
        const overigeRows = dayRows.filter(r => r.sub !== 'dessertbuffet_mini' && r.sub !== 'dessertbuffet_taart');

        // ── Dessertbuffet: tabel per zaal (Zaal · Mini's · Taarten, geen personen) ──
        const dbByRoom = {};
        const dbRoomLocMap = {};
        dbRows.forEach(r => {
          const roomName = r.room || 'Geen zaal';
          if (!dbByRoom[roomName]) dbByRoom[roomName] = { minis: 0, taarten: 0 };
          if (r.sub === 'dessertbuffet_mini') dbByRoom[roomName].minis += r.persons;
          else dbByRoom[roomName].taarten += r.persons;
          if (r.locCode) dbRoomLocMap[roomName] = r.locCode;
        });
        const sortedDbRooms = sortRoomsByLocation(Object.keys(dbByRoom), dbRoomLocMap);

        if (sortedDbRooms.length) {
          ensureSpace(8);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(...hexToRgb(BAKKER_COLOR));
          doc.text('DESSERTBUFFET — PER ZAAL', MARGIN + 3, y);
          y += 6;

          const dbCol = { zaal: MARGIN+3, mini: MARGIN+110, taart: PAGE_W-MARGIN-3 };
          ensureSpace(6);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(154, 149, 144);
          doc.text('ZAAL', dbCol.zaal, y);
          doc.text("MINI'S", dbCol.mini, y);
          doc.text('TAARTEN', dbCol.taart, y, { align: 'right' });
          y += 5.5;
          doc.setDrawColor(232, 229, 224);
          doc.setLineWidth(0.3);
          doc.line(MARGIN, y, PAGE_W - MARGIN, y);
          y += 5;

          sortedDbRooms.forEach(room => {
            const d = dbByRoom[room];
            ensureSpace(6.5);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(26, 25, 23);
            doc.text(room, dbCol.zaal, y);
            doc.setTextColor(...hexToRgb(BAKKER_COLOR));
            doc.text(String(d.minis), dbCol.mini, y);
            doc.text(String(d.taarten), dbCol.taart, y, { align: 'right' });
            y += 6.5;
          });
          y += 6;
        }

        // ── Mini-gebak/to-share: per zaal, gegroepeerd per locatie ──
        const byRoom = {};
        const roomLocMap = {};
        overigeRows.forEach(r => {
          const roomName = r.room || 'Geen zaal';
          (byRoom[roomName] = byRoom[roomName] || []).push(r);
          if (r.locCode) roomLocMap[roomName] = r.locCode;
        });
        const sortedRooms = sortRoomsByLocation(Object.keys(byRoom), roomLocMap);
        const roomsByLoc = {};
        sortedRooms.forEach(room => {
          const loc = roomLocMap[room] || '';
          (roomsByLoc[loc] = roomsByLoc[loc] || []).push(room);
        });
        const sortedLocs = Object.keys(roomsByLoc).sort((a,b) => {
          const ia = LOC_ORDER.indexOf(a), ib = LOC_ORDER.indexOf(b);
          return (ia===-1?LOC_ORDER.length:ia) - (ib===-1?LOC_ORDER.length:ib);
        });

        sortedLocs.forEach(loc => {
          if (sortedLocs.length > 1) {
            ensureSpace(7);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(...hexToRgb(BAKKER_COLOR));
            doc.text((LOC_LABELS[loc] || 'Overig').toUpperCase(), MARGIN + 3, y);
            y += 6;
          }

          roomsByLoc[loc].forEach(room => {
            const roomRows = byRoom[room].sort((a,b) => {
              const order = { to_share_mini: 0, mini_gebak: 1 };
              const oa = order[a.sub] ?? 9, ob = order[b.sub] ?? 9;
              if (oa !== ob) return oa - ob;
              return a.naam.localeCompare(b.naam);
            });

            ensureSpace(9);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(26, 25, 23);
            doc.text(room, MARGIN + 3, y);
            y += 7.5;

            const col = { sub: MARGIN+5, naam: MARGIN+40, aantal: PAGE_W-MARGIN-3 };

            roomRows.forEach(r => {
              ensureSpace(7);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.setTextColor(...hexToRgb(SUB_COLORS[r.sub] || '#5A5753'));
              doc.text(SUB_LABELS[r.sub] || r.sub, col.sub, y);

              doc.setFont('helvetica', 'bold');
              doc.setFontSize(9.5);
              doc.setTextColor(26, 25, 23);
              const naamTxt = r.naam + (r.isManual ? ' (handmatig)' : '');
              const naamTrunc = naamTxt.length > 38 ? naamTxt.slice(0,37)+'…' : naamTxt;
              doc.text(naamTrunc, col.naam, y);

              doc.setFont('helvetica', 'bold');
              doc.setFontSize(10.5);
              doc.setTextColor(...hexToRgb(BAKKER_COLOR));
              doc.text(String(r.persons), col.aantal, y, { align: 'right' });

              y += 6.2;
            });
            y += 3;
          });
        });

        y += 8;
      });

      const pageCount = doc.internal.getNumberOfPages();
      for (let p = 1; p <= pageCount; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(154, 149, 144);
        const stamp = new Date().toLocaleDateString('nl-BE');
        doc.text(`Huis van Wonterghem · Gegenereerd op ${stamp}`, MARGIN, PAGE_H - 10);
        doc.text(`${p} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 10, { align: 'right' });
      }

      const stamp = new Date().toISOString().slice(0,10);
      doc.save(`HVW_Bakker-Bestelformulier_${stamp}.pdf`);
    } catch (err) {
      alert('Fout bij PDF generatie: ' + err.message);
      console.error(err);
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  /* ── UI injecteren ── */
  function injectUI() {
    const wrap = document.createElement('div');
    wrap.id = 'bakker-content';
    wrap.innerHTML = `
      <div class="bak-toolbar">
        <select id="bak-f-week" onchange="window._renderBakker()"><option value="">Alle weken</option></select>
        <select id="bak-f-date" onchange="window._renderBakker()"><option value="">Alle dagen</option></select>
        <select id="bak-f-sub" onchange="window._renderBakker()">
          <option value="">Alle categorieën</option>
          <option value="dessertbuffet_mini">Dessertbuffet — mini's</option>
          <option value="dessertbuffet_taart">Dessertbuffet — taarten</option>
          <option value="to_share_mini">Mini-gebak (to share)</option>
          <option value="mini_gebak">Mini-gebak (los)</option>
        </select>
        <button class="bak-export-btn no-print" id="bak-export-pdf-btn" onclick="window._exportBakkerPDF()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Exporteer PDF voor bakker
        </button>
      </div>

      <div class="bak-add-card">
        <h3>Regel toevoegen</h3>
        <div class="bak-add-row">
          <div class="bak-add-field">
            <label>Naam</label>
            <input type="text" id="bak-add-naam" placeholder="Bijv. Extra petit fours">
          </div>
          <div class="bak-add-field">
            <label>Categorie</label>
            <select id="bak-add-sub">
              <option value="mini_gebak">Mini-gebak</option>
              <option value="dessertbuffet_taart">Taart</option>
              <option value="dessertbuffet_mini">Dessertbuffet — mini gebak</option>
            </select>
          </div>
          <div class="bak-add-field">
            <label>Datum</label>
            <input type="date" id="bak-add-date">
          </div>
          <div class="bak-add-field">
            <label>Zaal (optioneel)</label>
            <input type="text" id="bak-add-room" placeholder="Bijv. Traiteur 1">
          </div>
          <div class="bak-add-field" style="max-width:100px">
            <label>Aantal</label>
            <input type="number" id="bak-add-aantal" min="1" placeholder="0">
          </div>
          <button class="bak-add-btn" onclick="window._bakAddManual()">+ Toevoegen</button>
        </div>
        <div class="bak-manual-list" id="bak-manual-list"></div>
      </div>

      <div id="bak-days-wrap"></div>
    `;
    const appWrap = document.getElementById('app-wrap') || document.body;
    appWrap.appendChild(wrap);

    window._renderBakker = renderBakker;

    renderBakker();
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectCSS();
    injectUI();
  });

  // Herrender wanneer nieuwe Excel-data geladen wordt, en telkens de pagina
  // opnieuw getoond wordt (consistent met hoe Portie-Etiketten dit oplost).
  document.addEventListener('dataLoaded', () => { if (typeof renderBakker === 'function') renderBakker(); });
  window._bakRefreshOnShow = function () { renderBakker(); };

})();
