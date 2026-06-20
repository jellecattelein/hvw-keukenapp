/* ══════════════════════════════════════════
   etiketten.js — Fridgekar etiketten generator
   70×37mm etiketten op A4 — PDF via jsPDF
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Etiket afmetingen (mm) ── */
  const LABEL_W  = 65;    // breedte etiket (3x65 + 2x2.5 + 2x5 = 210mm)
  const LABEL_H  = 37;    // hoogte etiket
  const MARGIN_L = 2;     // linker marge A4
  const MARGIN_T = 1;     // boven marge A4
  const GAP_X    = 5;   // horizontale ruimte tussen etiketten
  const GAP_Y    = 0;     // verticale ruimte tussen etiketten
  const COLS     = 3;     // kolommen per pagina
  const ROWS     = 7;     // rijen per pagina (7x38 + 5 = 271 < 297mm)

  const DAYS_NL = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
  const MONTHS_NL = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];

  const LOC_LABELS = {
    TRA: 'Traiteur', MAE: 'Maelstede',
    HVW: 'Huis van Wonterghem', BIE: 'Bierkasteel', AFH: 'Afhaal'
  };

  /* ── State ── */
  let etiketData  = [];
  let bulkKarren  = 1;  // [{ bookingId, date, time, room, locCode, locLabel, persons, karren }]

  /* ── CSS injecteren ── */
  function injectCSS() {
    const style = document.createElement('style');
    style.textContent = `
      #etiketten-content { display: none; padding: 26px 28px; }

      .etik-toolbar {
        display: flex; gap: 10px; flex-wrap: wrap;
        margin-bottom: 20px; align-items: center;
      }
      .etik-toolbar select {
        font-size: 13px; padding: 8px 12px;
        border: 1px solid var(--border); border-radius: var(--radius);
        background: var(--surface); color: var(--text); outline: none;
      }
      .etik-pdf-btn {
        display: inline-flex; align-items: center; gap: 7px;
        padding: 9px 20px; background: var(--text); color: #fff;
        border: none; border-radius: var(--radius);
        font-size: 13px; font-weight: 600; cursor: pointer;
        transition: opacity 0.15s; margin-left: auto;
      }
      .etik-pdf-btn:hover { opacity: 0.82; }
      .etik-pdf-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      .etik-list {
        display: flex; flex-direction: column; gap: 10px;
      }
      .etik-day-header {
        font-family: 'Playfair Display', serif;
        font-size: 16px; font-weight: 500;
        color: var(--text); padding: 10px 0 6px;
        border-bottom: 1px solid var(--border);
        margin-bottom: 4px;
      }

      .etik-row {
        display: grid;
        grid-template-columns: 28px 1fr auto auto;
        align-items: center; gap: 12px;
        background: var(--surface); border: 1px solid var(--border);
        border-radius: var(--radius); padding: 10px 16px;
        box-shadow: var(--shadow-sm);
      }
      .etik-row-check { width: 18px; height: 18px; cursor: pointer; accent-color: var(--text); }
      .etik-row-info { min-width: 0; }
      .etik-row-room { font-weight: 600; font-size: 14px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .etik-row-meta { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
      .etik-row-loc {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 3px 10px; border-radius: 20px;
        font-size: 11px; font-weight: 600; white-space: nowrap; flex-shrink: 0;
      }
      .etik-row-loc-code { font-family: 'DM Mono', monospace; font-size: 10px; font-weight: 700; opacity: 0.6; }

      .etik-karren-ctrl {
        display: flex; align-items: center; gap: 6px; flex-shrink: 0;
      }
      .etik-karren-btn {
        width: 28px; height: 28px; border-radius: 6px;
        border: 1px solid var(--border); background: var(--surface);
        cursor: pointer; font-size: 16px; font-weight: 600;
        display: flex; align-items: center; justify-content: center;
        color: var(--text-muted); transition: all 0.1s;
      }
      .etik-karren-btn:hover { background: var(--surface3); border-color: var(--border-strong); color: var(--text); }
      .etik-karren-num {
        font-family: 'DM Mono', monospace; font-size: 16px; font-weight: 700;
        color: var(--text); min-width: 20px; text-align: center;
      }
      .etik-karren-label { font-size: 12px; color: var(--text-muted); }

      .etik-empty { text-align: center; padding: 3rem; color: var(--text-faint); font-size: 13px; }

      .etik-stats-bar {
        display: flex; gap: 16px; align-items: center;
        background: var(--surface); border: 1px solid var(--border);
        border-radius: var(--radius-lg); padding: 12px 20px;
        margin-bottom: 16px; box-shadow: var(--shadow-sm);
        font-size: 13px; flex-wrap: wrap;
      }
      .etik-stat-item { display: flex; gap: 6px; align-items: center; }
      .etik-stat-num { font-family: 'DM Mono', monospace; font-weight: 700; font-size: 16px; color: var(--text); }
      .etik-stat-lbl { color: var(--text-muted); }
      .etik-stat-sep { color: var(--border-strong); }

      @media (max-width: 600px) {
        .etik-row { grid-template-columns: 24px 1fr; }
        .etik-row-loc, .etik-karren-ctrl { grid-column: 2; }
      }
      @media print { .no-print, .etik-toolbar { display: none !important; } }
    `;
    document.head.appendChild(style);
  }

  /* ── Datum formatters ── */
  function formatDateNL(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const dt = new Date(+y, +m - 1, +d);
    return `${DAYS_NL[dt.getDay()]} ${+d} ${MONTHS_NL[+m - 1]} ${y}`;
  }
  function shortDay(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const dt = new Date(+y, +m - 1, +d);
    return DAYS_NL[dt.getDay()].substring(0, 2).toUpperCase();
  }

  /* ── Bouw etiketData vanuit allEvents ── */
  function buildEtiketData(weekFilter) {
    if (typeof allEvents === 'undefined' || !allEvents.length) return [];
    const events = allEvents.filter(e => !weekFilter || e.weekKey === weekFilter);
    return events.map(e => ({
      bookingId: e.bookingId,
      date:      e.date,
      time:      e.time || '',
      room:      e.room || '',
      locCode:   e.location || '',
      locLabel:  LOC_LABELS[e.location] || e.location || '',
      persons:   e.persons,
      karren:    1,
      selected:  true,
    }));
  }

  /* ── Locatie kleuren ── */
  const LOC_COLORS = {
    TRA: { bg: '#EDF3FB', color: '#1A3F6F' },
    MAE: { bg: '#D8EEE4', color: '#2D6A4F' },
    HVW: { bg: '#FDF1ED', color: '#8B2500' },
    BIE: { bg: '#F3EAF7', color: '#6B3A7D' },
    AFH: { bg: '#FDF6E3', color: '#8B6A00' },
  };

  /* ── Render lijst ── */
  function renderEtiketten() {
    const weekSel = document.getElementById('etik-f-week');
    const weekFilter = weekSel?.value || '';

    etiketData = buildEtiketData(weekFilter);

    // Populate week filter
    if (weekSel && !weekSel.options.length || weekSel.options.length <= 1) {
      if (typeof allEvents !== 'undefined') {
        const weeks = [...new Map(allEvents.map(e => [e.weekKey, e.weekLabel])).entries()].sort((a,b)=>a[0].localeCompare(b[0]));
        weekSel.innerHTML = '<option value="">Alle weken</option>';
        weeks.forEach(([k,l]) => { const o=document.createElement('option'); o.value=k; o.textContent=l; weekSel.appendChild(o); });
      }
    }

    const container = document.getElementById('etik-list');
    const statsBar  = document.getElementById('etik-stats');

    if (!etiketData.length) {
      container.innerHTML = '<div class="etik-empty">Upload eerst een Excel-bestand en ga naar Feestenoverzicht om feesten te laden.</div>';
      statsBar.innerHTML = '';
      return;
    }

    // Stats
    const totalFeesten  = etiketData.filter(e => e.selected).length;
    const totalKarren   = etiketData.filter(e => e.selected).reduce((s,e) => s+e.karren, 0);
    const totalPaginas  = Math.ceil(totalKarren / (COLS * ROWS));
    statsBar.innerHTML = `
      <div class="etik-stat-item"><span class="etik-stat-num">${totalFeesten}</span><span class="etik-stat-lbl">feesten</span></div>
      <span class="etik-stat-sep">·</span>
      <div class="etik-stat-item"><span class="etik-stat-num">${totalKarren}</span><span class="etik-stat-lbl">etiketten</span></div>
      <span class="etik-stat-sep">·</span>
      <div class="etik-stat-item"><span class="etik-stat-num">${totalPaginas}</span><span class="etik-stat-lbl">pagina${totalPaginas !== 1 ? "'s" : ""} A4</span></div>`;

    // Groepeer per dag
    const byDate = {};
    etiketData.forEach((e, i) => {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push({ ...e, idx: i });
    });

    container.innerHTML = Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, rows]) => {
      const lc = LOC_COLORS[rows[0]?.locCode] || { bg: '#f5f5f5', color: '#666' };
      return `
        <div class="etik-day-header">${formatDateNL(date)}</div>
        ${rows.map(e => {
          const lce = LOC_COLORS[e.locCode] || { bg: '#f5f5f5', color: '#666' };
          return `
          <div class="etik-row">
            <input type="checkbox" class="etik-row-check" data-idx="${e.idx}" ${e.selected ? 'checked' : ''}
              onchange="window._etikToggle(${e.idx}, this.checked)">
            <div class="etik-row-info">
              <div class="etik-row-room">${e.room}</div>
              <div class="etik-row-meta">${e.time ? e.time + ' · ' : ''}${e.persons} personen</div>
            </div>
            <span class="etik-row-loc" style="background:${lce.bg};color:${lce.color}">
              <span class="etik-row-loc-code">${e.locCode}</span>${e.locLabel}
            </span>
            <div class="etik-karren-ctrl">
              <button class="etik-karren-btn" onclick="window._etikKarren(${e.idx}, -1)">−</button>
              <span class="etik-karren-num">${e.karren}</span>
              <button class="etik-karren-btn" onclick="window._etikKarren(${e.idx}, 1)">+</button>
              <span class="etik-karren-label">kar${e.karren !== 1 ? 'ren' : ''}</span>
            </div>
          </div>`;
        }).join('')}`;
    }).join('');
  }

  /* ── Interactie ── */
  window._etikToggle = function(idx, checked) {
    if (etiketData[idx]) etiketData[idx].selected = checked;
    updateStats();
  };
  window._etikKarren = function(idx, delta) {
    if (!etiketData[idx]) return;
    etiketData[idx].karren = Math.max(1, Math.min(4, etiketData[idx].karren + delta));
    // Update display
    const rows = document.querySelectorAll('.etik-row');
    let globalIdx = 0;
    document.querySelectorAll('.etik-row').forEach(row => {
      // Find karren num in this row
      const nums = row.querySelectorAll('.etik-karren-num');
      const ctrl = row.querySelector('.etik-karren-ctrl');
      if (!ctrl) return;
      const num = ctrl.querySelector('.etik-karren-num');
      const lbl = ctrl.querySelector('.etik-karren-label');
      // Match by index via button onclick
      const btn = ctrl.querySelector('.etik-karren-btn');
      if (btn && btn.getAttribute('onclick') === `window._etikKarren(${idx}, -1)`) {
        if (num) num.textContent = etiketData[idx].karren;
        if (lbl) lbl.textContent = etiketData[idx].karren !== 1 ? 'karren' : 'kar';
      }
    });
    updateStats();
  };

  function updateStats() {
    const totalFeesten = etiketData.filter(e => e.selected).length;
    const totalKarren  = etiketData.filter(e => e.selected).reduce((s,e) => s+e.karren, 0);
    const totalPaginas = Math.ceil(totalKarren / (COLS * ROWS));
    const sb = document.getElementById('etik-stats');
    if (sb) sb.innerHTML = `
      <div class="etik-stat-item"><span class="etik-stat-num">${totalFeesten}</span><span class="etik-stat-lbl">feesten</span></div>
      <span class="etik-stat-sep">·</span>
      <div class="etik-stat-item"><span class="etik-stat-num">${totalKarren}</span><span class="etik-stat-lbl">etiketten</span></div>
      <span class="etik-stat-sep">·</span>
      <div class="etik-stat-item"><span class="etik-stat-num">${totalPaginas}</span><span class="etik-stat-lbl">pagina${totalPaginas !== 1 ? "'s" : ""} A4</span></div>`;
  }

  /* ══════════════════════════════
     PDF GENERATIE via jsPDF
     ══════════════════════════════ */
  async function generatePDF() {
    const selected = etiketData.filter(e => e.selected);
    if (!selected.length) { alert('Selecteer minstens één feest.'); return; }

    const btn = document.getElementById('etik-pdf-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'PDF genereren...'; }

    try {
      // Laad jsPDF dynamisch
      if (!window.jspdf) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      }
      const { jsPDF } = window.jspdf;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Bouw lijst van alle te printen etiketten — gesorteerd per dag, tijd, zaal
      const sorted = [...selected].sort((a,b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.time !== b.time) return (a.time||'').localeCompare(b.time||'');
        return (a.room||'').localeCompare(b.room||'');
      });
      const labels = [];
      sorted.forEach(e => {
        for (let k = 1; k <= e.karren; k++) {
          labels.push({ ...e, karNr: k });
        }
      });

      const perPage = COLS * ROWS;

      labels.forEach((label, li) => {
        const page = Math.floor(li / perPage);
        const pos  = li % perPage;

        if (pos === 0 && li > 0) doc.addPage();

        const col = pos % COLS;
        const row = Math.floor(pos / COLS);

        const x = MARGIN_L + col * (LABEL_W + GAP_X);
        const y = MARGIN_T + row * (LABEL_H + GAP_Y);

        drawLabel(doc, x, y, label);
      });

      const weekSel = document.getElementById('etik-f-week');
      const weekTxt = weekSel?.options[weekSel.selectedIndex]?.text || 'etiketten';
      doc.save(`etiketten_${weekTxt.replace(/[^a-z0-9]/gi,'_')}.pdf`);

    } catch(err) {
      alert('Fout bij PDF generatie: ' + err.message);
      console.error(err);
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg> PDF afdrukken`; }
    }
  }

  function drawLabel(doc, x, y, label) {
    const w = LABEL_W;
    const h = LABEL_H;
    const pad = 3;

    // Witte achtergrond, geen border
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, w, h, 'F');

    // Gekleurde linker balk op basis van locatie
    const locColors = {
      TRA: [26, 63, 111],   // blauw
      MAE: [45, 106, 79],   // groen
      HVW: [139, 37, 0],    // rood
      BIE: [107, 58, 125],  // paars
      AFH: [139, 106, 0],   // amber
    };
    const lc = locColors[label.locCode] || [100, 100, 100];
    // Gekleurde rechthoekige balk links
    doc.setFillColor(...lc);
    doc.rect(x, y, 5, h, 'F');

    const tx = x + 5 + pad; // tekst begint na gekleurde balk
    const tw = w - 4 - pad - pad;

    // Locatie badge rechtsboven
    const locLabel = label.locLabel || label.locCode;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...lc);
    doc.text(locLabel.toUpperCase(), x + w - pad, y + pad + 4, { align: 'right' });

    // Dag + datum
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 116, 112);
    const dayStr = shortDay(label.date);
    const [yr, mo, da] = label.date.split('-');
    const dateStr = `${dayStr}  ${+da}/${+mo}/${yr}`;
    doc.text(dateStr, tx, y + pad + 5);

    // Zaal (groot, vet)
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(28, 28, 26);
    const roomText = doc.splitTextToSize(label.room, tw);
    doc.text(roomText[0], tx, y + pad + 13);
    if (roomText[1]) {
      doc.setFontSize(8);
      doc.text(roomText[1], tx, y + pad + 19);
    }

    // Personen — groter en vet
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(28, 28, 26);
    doc.text(`${label.persons} pers.`, tx, y + h - pad - 7);

    // Starttijd (rechtsonder)
    if (label.time) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(28, 28, 26);
      doc.text(label.time, x + w - pad, y + h - pad - 7, { align: 'right' });
    }

    // Kar nummer (als meer dan 1)
    if (label.karren > 1) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...lc);
      doc.text(`kar ${label.karNr}/${label.karren}`, x + w - pad, y + h - pad - 1, { align: 'right' });
    }

    // Scheidingslijn boven personen
    doc.setDrawColor(230, 226, 221);
    doc.setLineWidth(0.2);
    doc.line(tx, y + h - pad - 11, x + w - pad, y + h - pad - 11);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  /* ── Bulk karren functies ── */
  function etikBulkKarren(delta) {
    bulkKarren = Math.max(1, Math.min(4, bulkKarren + delta));
    const el = document.getElementById('etik-bulk-num');
    if (el) el.textContent = bulkKarren;
  }

  function etikBulkApply() {
    if (!etiketData.length) {
      const weekSel = document.getElementById('etik-f-week');
      etiketData = buildEtiketData(weekSel?.value || '');
    }
    etiketData.forEach(e => { e.karren = bulkKarren; });
    renderEtiketten();
  }

  // Exporteer functies naar window zodat onclick ze kan vinden
  window._renderEtiketten = renderEtiketten;
  window._getEtiketData   = function() { return etiketData; };
  window._updateEtikStats = updateStats;
  window._etikBulkKarren  = etikBulkKarren;
  window._etikBulkApply   = etikBulkApply;
  window._etikToggle      = window._etikToggle || function(){};
  window._etikKarren      = window._etikKarren || function(){};
  window._generateEtiketPDF = generatePDF;

  /* ── UI injecteren ── */
  function injectUI() {
    const wrap = document.createElement('div');
    wrap.id = 'etiketten-content';
    wrap.className = 'page';
    wrap.innerHTML = `
      <div class="etik-toolbar no-print">
        <select id="etik-f-week" onchange="window._renderEtiketten()">
          <option value="">Alle weken</option>
        </select>
        <div class="etik-bulk-ctrl">
          <span class="etik-bulk-label">Alle feesten:</span>
          <input type="number" id="etik-bulk-input" min="1" max="4" value="1"
            class="qty-input" style="width:60px;font-size:15px;"
            onchange="(function(){
              var v = Math.max(1, Math.min(4, parseInt(this.value)||1));
              this.value = v;
              var rows = document.querySelectorAll('.etik-row');
              rows.forEach(function(row, i) {
                var cb = row.querySelector('.etik-row-check');
                if (!cb) return;
                var idx = parseInt(cb.getAttribute('data-idx'));
                if (isNaN(idx)) return;
                var data = window._getEtiketData();
                if (data[idx]) {
                  data[idx].karren = v;
                  var num = row.querySelector('.etik-karren-num');
                  var lbl = row.querySelector('.etik-karren-label');
                  if (num) num.textContent = v;
                  if (lbl) lbl.textContent = v !== 1 ? 'karren' : 'kar';
                }
              });
              window._updateEtikStats();
            }).call(this)">
          <span class="etik-karren-label">karren</span>
        </div>
        <button class="etik-pdf-btn" id="etik-pdf-btn" onclick="window._generateEtiketPDF()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
          PDF afdrukken
        </button>
      </div>
      <div class="etik-stats-bar" id="etik-stats"></div>
      <div class="etik-list" id="etik-list">
        <div class="etik-empty">Upload eerst een Excel-bestand om feesten te laden.</div>
      </div>`;

    const main = document.getElementById('app-wrap') || document.body;
    main.appendChild(wrap);

    // Tab knop toevoegen na IJsdesserts
    const modeTabs = null; // sidebar heeft al knoppen
    if (modeTabs) {
      const btn = document.createElement('button');
      btn.className = 'mode-tab';
      btn.dataset.mode = 'etiketten';
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="7" width="20" height="14" rx="2"/>
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
          <line x1="12" y1="12" x2="12" y2="16"/>
          <line x1="10" y1="14" x2="14" y2="14"/>
        </svg>
        Etiketten`;
      btn.onclick = () => switchToEtiketten();
      modeTabs.appendChild(btn);
    }

    // Patch switchMode
    const origSwitchMode = window.switchMode;
    window.switchMode = function(mode) {
      const w = document.getElementById('etiketten-content');
      if (w) w.style.display = 'none';
      const b = document.querySelector('.mode-tab[data-mode="etiketten"]');
      if (b) b.classList.remove('active');
      if (origSwitchMode) origSwitchMode(mode);
    };

  
    window._generateEtiketPDF = generatePDF;
  }

  function switchToEtiketten() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('etiketten-content').style.display = 'block';
    document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
    document.querySelector('.mode-tab[data-mode="etiketten"]')?.classList.add('active');
    renderEtiketten();
  }

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', () => {
    injectCSS();
    injectUI();
  });

  document.addEventListener('dataLoaded', () => {
    if (document.getElementById('etiketten-content')?.style.display === 'block') {
      renderEtiketten();
    }
  });

})();
