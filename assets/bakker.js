/* ══════════════════════════════════════════
   bakker.js — Bakker Bestelformulier
   Verzamelt alles wat de bakker moet leveren:
   Dessert, Desserthapjes (mini-gebak), Dessert
   kids en Dessertbuffet — in één PDF, per dag
   en zaal gegroepeerd. Handmatige regels kunnen
   worden toegevoegd (bv. een aparte afspraak
   die niet uit de Excel komt).
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  const BAKKER_COLOR = '#8B5A2B';
  const BAKKER_BG    = '#F5EBE0';

  // Categorieën uit app.js die bij de bakker horen (zie TABS in app.js)
  const BAKKER_SUB_IDS = ['dessert', 'desserthapjes', 'dessert_kids', 'dessertbuffet'];

  const SUB_LABELS = {
    dessert: 'Dessert', desserthapjes: 'Mini-gebak', dessert_kids: 'Dessert kids', dessertbuffet: 'Dessertbuffet'
  };
  const SUB_COLORS = {
    dessert:        '#6B3A7D',
    desserthapjes:  '#B8965A',
    dessert_kids:   '#2D8CA8',
    dessertbuffet:  '#C2185B',
  };

  const LOC_LABELS = { TRA: 'Traiteur', MAE: 'Maelstede', HVW: 'Huis van Wonterghem', BIE: 'Bierkasteel', AFH: 'Afhaal' };

  let manualRows = []; // handmatig toegevoegde regels: [{ id, naam, sub, dateStr, room, aantal }]
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

      .bak-zaal-block { padding: 14px 18px; border-bottom: 1px solid #F4F1EC; }
      .bak-zaal-block:last-child { border-bottom: none; }
      .bak-zaal-title { font-size: 12.5px; font-weight: 700; color: #1A1917; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
      .bak-loc-pill {
        font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
      }

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
  // Herkent "Dessert 'to share' met ..." — dit type dessert wordt altijd
  // vergezeld van mini-gebakjes bij de bakker, 1 stuk per persoon, ook al
  // staat dat niet apart als aparte regel in de Excel.
  function needsAutoMiniGebak(naam, sub) {
    if (sub !== 'dessert') return false;
    return naam.toLowerCase().includes('to share');
  }

  function getBakkerRows() {
    if (typeof allRows === 'undefined' || !allRows.length) return [];
    const result = [];

    allRows.forEach(r => {
      // Filter op sub-categorie i.p.v. naam-trefwoord: robuuster voor
      // wisselende productnamen zoals "mini gebak", "petit fours", enz.
      if (!r.sub || !BAKKER_SUB_IDS.includes(r.sub)) return;
      if (r.persons <= 0) return;

      const locCode = (r.location || '').toString().trim();
      const mergeKey = `${r.name}||${r.room || ''}||${r.dateStr}||${r.sub}`;
      const existing = result.find(x => x.mergeKey === mergeKey);
      if (existing) {
        existing.persons += r.persons;
      } else {
        result.push({
          mergeKey,
          sub: r.sub,
          naam: r.name,
          persons: r.persons,
          dateStr: r.dateStr,
          weekKey: r.weekKey,
          weekLabel: r.weekLabel,
          room: r.room || '',
          locCode,
          locLabel: LOC_LABELS[locCode] || locCode,
          isManual: false,
        });
      }

      // "To share"-desserts hebben altijd mini-gebakjes nodig, 1 per persoon,
      // voor hetzelfde feest/zaal/dag — automatisch toegevoegd als eigen regel.
      if (needsAutoMiniGebak(r.name, r.sub)) {
        const autoKey = `AUTO-minigebak||${r.room || ''}||${r.dateStr}`;
        const existingAuto = result.find(x => x.mergeKey === autoKey);
        if (existingAuto) {
          existingAuto.persons += r.persons;
        } else {
          result.push({
            mergeKey: autoKey,
            sub: 'desserthapjes',
            naam: 'Mini-gebak (bij dessert to share)',
            persons: r.persons,
            dateStr: r.dateStr,
            weekKey: r.weekKey,
            weekLabel: r.weekLabel,
            room: r.room || '',
            locCode,
            locLabel: LOC_LABELS[locCode] || locCode,
            isManual: false,
            isAuto: true,
          });
        }
      }
    });

    // Handmatige regels toevoegen
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

      const byRoom = {};
      dayRows.forEach(r => { (byRoom[r.room || 'Geen zaal'] = byRoom[r.room || 'Geen zaal'] || []).push(r); });
      const sortedRooms = Object.keys(byRoom).sort();

      return `
        <div class="bak-day-card">
          <div class="bak-day-header">
            <span class="bak-day-title">${dayLabel}</span>
            <span class="bak-day-total">${dayTotal} pers. totaal</span>
          </div>
          ${sortedRooms.map(room => {
            const roomRows = byRoom[room].sort((a,b) => a.sub.localeCompare(b.sub) || a.naam.localeCompare(b.naam));
            const locSample = roomRows.find(r => r.locLabel);
            return `
              <div class="bak-zaal-block">
                <div class="bak-zaal-title">
                  ${escapeHtml(room)}
                  ${locSample ? `<span class="bak-loc-pill" style="background:#F4F3F0;color:#6B655E">${escapeHtml(locSample.locLabel)}</span>` : ''}
                </div>
                ${roomRows.map(r => `
                  <div class="bak-item-row">
                    <span class="bak-item-sub" style="background:${SUB_COLORS[r.sub]}22;color:${SUB_COLORS[r.sub]}">${SUB_LABELS[r.sub] || r.sub}</span>
                    <span class="bak-item-naam">${escapeHtml(r.naam)}${r.isManual ? ' <span style="color:#B8965A;font-size:10px">· handmatig</span>' : ''}${r.isAuto ? ' <span style="color:#8B5A2B;font-size:10px">· automatisch bij \'to share\'</span>' : ''}</span>
                    <span class="bak-item-aantal">${r.persons}${r.isManual ? '' : ' p'}</span>
                  </div>`).join('')}
              </div>`;
          }).join('')}
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
    const sub = document.getElementById('bak-add-sub')?.value || 'dessert';
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
        y += 9 + 6; // 9mm voor de kopbalk zelf + 6mm ademruimte erna

        const byRoom = {};
        dayRows.forEach(r => { (byRoom[r.room || 'Geen zaal'] = byRoom[r.room || 'Geen zaal'] || []).push(r); });
        const sortedRooms = Object.keys(byRoom).sort();

        sortedRooms.forEach(room => {
          const roomRows = byRoom[room].sort((a,b) => a.sub.localeCompare(b.sub) || a.naam.localeCompare(b.naam));

          ensureSpace(9);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(26, 25, 23);
          const locSample = roomRows.find(r => r.locLabel);
          const roomTxt = room + (locSample ? `  ·  ${locSample.locLabel}` : '');
          doc.text(roomTxt, MARGIN + 3, y);
          y += 7.5;

          const col = { sub: MARGIN+5, naam: MARGIN+32, aantal: PAGE_W-MARGIN-3 };

          roomRows.forEach(r => {
            ensureSpace(7);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(...hexToRgb(SUB_COLORS[r.sub] || '#5A5753'));
            doc.text(SUB_LABELS[r.sub] || r.sub, col.sub, y);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(26, 25, 23);
            const naamTxt = r.naam + (r.isManual ? ' (handmatig)' : '') + (r.isAuto ? ' (auto)' : '');
            const naamTrunc = naamTxt.length > 45 ? naamTxt.slice(0,44)+'…' : naamTxt;
            doc.text(naamTrunc, col.naam, y);

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(...hexToRgb(BAKKER_COLOR));
            doc.text(String(r.persons), col.aantal, y, { align: 'right' });

            y += 6.2;
          });
          y += 3;
        });

        ensureSpace(9);
        doc.setDrawColor(...hexToRgb(BAKKER_COLOR));
        doc.setLineWidth(0.4);
        doc.line(MARGIN, y, PAGE_W - MARGIN, y);
        y += 5.5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(26, 25, 23);
        doc.text(`Totaal ${dayLabel}`, MARGIN+32, y);
        doc.setFontSize(11.5);
        doc.setTextColor(...hexToRgb(BAKKER_COLOR));
        doc.text(String(dayTotal), PAGE_W-MARGIN-3, y, { align: 'right' });
        y += 11;
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
          <option value="dessert">Dessert</option>
          <option value="desserthapjes">Mini-gebak</option>
          <option value="dessert_kids">Dessert kids</option>
          <option value="dessertbuffet">Dessertbuffet</option>
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
              <option value="dessert">Dessert</option>
              <option value="desserthapjes">Mini-gebak</option>
              <option value="dessert_kids">Dessert kids</option>
              <option value="dessertbuffet">Dessertbuffet</option>
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
