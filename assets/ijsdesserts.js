/* ══════════════════════════════════════════
   ijsdesserts.js — IJsdesserts tab module
   Zelfstandig — geen wijzigingen aan bestaande bestanden nodig
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Constanten ── */
  const IJS_COLOR  = '#1D6A6A';
  const IJS_BG     = '#E0F4F4';

  const TYPE_CFG = {
    ijstaart:         { label: 'IJstaart',           color: '#C2185B', bg: '#FCE4EC' },
    ijstaart_buffet:  { label: 'IJstaart (buffet)',  color: '#E91E8C', bg: '#FDE8F5' },
    ijslam:           { label: 'IJslam',             color: '#6B3A7D', bg: '#F3EAF7' },
    ijsmissaal:       { label: 'IJsmissaal',         color: '#1A3F6F', bg: '#EDF3FB' },
  };

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }

  /* ── CSS injecteren ── */
  function injectCSS() {
    const style = document.createElement('style');
    style.textContent = `
      #ijs-content-wrap { display: none; padding: 26px 28px; }

      .ijs-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px,1fr));
        gap: 12px;
        margin-bottom: 22px;
      }
      .ijs-stat {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 16px 20px;
        box-shadow: var(--shadow-sm);
      }
      .ijs-stat-label {
        font-size: 10px; font-weight: 600; color: var(--text-faint);
        text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;
      }
      .ijs-stat-val {
        font-family: 'Playfair Display', serif;
        font-size: 26px; font-weight: 500; color: ${IJS_COLOR}; line-height: 1;
      }

      .ijs-toolbar {
        display: flex; gap: 8px; flex-wrap: wrap;
        margin-bottom: 16px; align-items: center;
      }
      .ijs-toolbar select {
        font-size: 13px; padding: 8px 12px;
        border: 1px solid var(--border); border-radius: var(--radius);
        background: var(--surface); color: var(--text);
        outline: none; box-shadow: var(--shadow-sm);
      }
      .ijs-toolbar select:focus { border-color: ${IJS_COLOR}; }
      .ijs-export-btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 8px 16px; background: ${IJS_COLOR}; color: #fff;
        border: none; border-radius: var(--radius);
        font-size: 13px; font-weight: 600; cursor: pointer;
        transition: opacity 0.15s;
      }
      .ijs-export-btn:hover { opacity: 0.85; }
      .ijs-export-btn:disabled { opacity: 0.4; cursor: not-allowed; }
      .ijs-export-btn:first-of-type { margin-left: auto; }
      .ijs-export-btn-pdf { background: #B8965A; }

      .ijs-cards { display: flex; flex-direction: column; gap: 14px; }

      .ijs-day-card {
        background: var(--surface); border: 1px solid var(--border);
        border-radius: var(--radius-lg); overflow: hidden;
        box-shadow: var(--shadow-sm); transition: box-shadow 0.2s;
      }
      .ijs-day-card:hover { box-shadow: 0 2px 10px rgba(0,0,0,0.08); }

      .ijs-day-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 20px; border-bottom: 1px solid var(--border);
        gap: 12px; flex-wrap: wrap;
      }
      .ijs-day-title {
        font-family: 'Playfair Display', serif;
        font-size: 16px; font-weight: 500; color: var(--text);
      }
      .ijs-day-badges { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .ijs-day-badge {
        font-size: 12px; font-weight: 600; padding: 3px 10px;
        border-radius: 20px; white-space: nowrap;
      }

      .ijs-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .ijs-table th {
        background: var(--surface3, #F4F2EF);
        padding: 8px 14px; text-align: left;
        font-size: 10px; font-weight: 600; color: var(--text-faint);
        text-transform: uppercase; letter-spacing: .8px;
        border-bottom: 1px solid var(--border);
      }
      .ijs-table td {
        padding: 11px 14px; border-bottom: 1px solid var(--border);
        vertical-align: middle;
      }
      .ijs-table tr:last-child td { border-bottom: none; }
      .ijs-table tr:hover td { background: var(--surface2, #FAFAF9); }

      .ijs-type-badge {
        display: inline-block; font-size: 11px; font-weight: 600;
        padding: 3px 9px; border-radius: 4px; white-space: nowrap;
      }
      .ijs-name-cell { font-weight: 600; color: var(--text); }
      .ijs-zaal-cell { font-size: 12px; color: var(--text-muted); }
      .ijs-zaal-naam { margin-bottom: 4px; }
      .ijs-pers-cell { text-align: center; font-family: 'DM Mono', monospace; font-weight: 500; }
      .ijs-bestellen-cell {
        text-align: center;
        font-family: 'DM Mono', monospace;
        font-weight: 700; font-size: 15px;
        color: ${IJS_COLOR};
      }

      .ijs-total-row td {
        background: ${IJS_BG}; font-weight: 700;
        border-top: 2px solid ${IJS_COLOR}33;
        padding: 10px 14px; font-size: 13px;
      }
      .ijs-total-row td:last-child {
        font-size: 16px; font-family: 'DM Mono', monospace;
        color: ${IJS_COLOR}; text-align: center;
      }

      .ijs-loc-pill {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 3px 10px; border-radius: 20px;
        font-size: 11px; font-weight: 600; white-space: nowrap;
      }
      .ijs-loc-code { font-size: 10px; font-weight: 700; opacity: 0.6; font-family: 'DM Mono', monospace; }

      .ijs-empty {
        text-align: center; padding: 3rem;
        color: var(--text-faint); font-size: 13px;
      }

      @media (max-width: 768px) {
        .ijs-table th:nth-child(4),
        .ijs-table td:nth-child(4) { display: none; }
      }
      @media print {
        .no-print, .ijs-toolbar { display: none !important; }
        .ijs-day-card { box-shadow: none; border: 1px solid #ddd; break-inside: avoid; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Type detectie ── */
  function detectType(name) {
    const n = name.trim().toLowerCase();
    if (n.includes('dessertbuffet') && n.includes('ijstaart')) return 'ijstaart_buffet';
    if (n.includes('ijstaart'))   return 'ijstaart';
    if (n.includes('ijsmissaal')) return 'ijsmissaal';
    if (n.includes('ijslam'))     return 'ijslam';
    return null;
  }

  /* ── Naam extraheren uit productnaam ── */
  function extractName(productName, type) {
    const raw = productName.trim();
    // 1. Naam na type-woord, voor "met"
    const typeMatch = raw.match(/^\s*(?:Ijs(?:taart|lam|missaal))\s+"?([\w\s]+?)"?(?:\s+met\b|$)/i);
    if (typeMatch) {
      const candidate = typeMatch[1].trim();
      if (candidate.length > 1) return candidate;
    }
    // 2. Naam tussen speciale aanhalingstekens
    const qMatch = raw.match(/[\u201c\u201d\u201e\u00ab\u00bb"]([^\u201c\u201d\u201e\u00ab\u00bb"\n]{2,})[\u201c\u201d\u201e\u00ab\u00bb"]/);
    if (qMatch) return qMatch[1].trim();
    // 3. Verwijder prefixen en suffixen
    let n = raw
      .replace(/dessertbuffet\s*(deluxe)?\s*(met\s*)?/gi, '')
      .replace(/Ijs(?:taart|lam|missaal)\s*/gi, '')
      .replace(/met\s+chocoladesaus.*$/i, '')
      .replace(/met\s+coulis.*$/i, '')
      .replace(/\(min\s*\d+[^)]*\)/gi, '')
      .replace(/\([^)]{20,}\)/gi, '')
      .trim()
      .replace(/^[\s"'\-\u2013\u2014]+|[\s"'\-\u2013\u2014]+$/g, '')
      .trim();
    return n || raw;
  }

  /* ── Data verzamelen uit allRows ── */
  function getIjsRows() {
    if (typeof allRows === 'undefined' || !allRows.length) return [];

    const result = [];
    allRows.forEach(r => {
      const type = detectType(r.name);
      if (!type) return;
      const cfg = TYPE_CFG[type];
      const naam = extractName(r.name, type);
      // Factor: dessertbuffet ijstaart = personen ÷ 3, rest = personen × 1
      const bestellen = type === 'ijstaart_buffet'
        ? Math.ceil(r.persons / 3)
        : r.persons;

      // Locatie info
      const locCode = (r.location || '').toString().trim();
      const LOC_LABELS_LOCAL = {
        TRA: 'Traiteur', MAE: 'Maelstede',
        HVW: 'Huis van Wonterghem', BIE: 'Bierkasteel', AFH: 'Afhaal'
      };
      const LOC_COLORS_LOCAL = {
        TRA: { bg: '#EDF3FB', color: '#1A3F6F' },
        MAE: { bg: '#D8EEE4', color: '#2D6A4F' },
        HVW: { bg: '#FDF1ED', color: '#8B2500' },
        BIE: { bg: '#F3EAF7', color: '#6B3A7D' },
        AFH: { bg: '#FDF6E3', color: '#8B6A00' },
      };

      // Samenvoegen: gebruik naam + room + dateStr als sleutel
      const mergeKey = `${naam}||${r.room || ''}||${r.dateStr}||${type}`;
      const existing = result.find(x => x.mergeKey === mergeKey);
      if (existing) {
        // Zelfde naam + zaal + dag → personen optellen
        existing.persons   += r.persons;
        existing.bestellen  = type === 'ijstaart_buffet'
          ? Math.ceil(existing.persons / 3)
          : existing.persons;
      } else {
        result.push({
          mergeKey, type, naam, cfg,
          persons:   r.persons,
          bestellen,
          dateStr:   r.dateStr,
          weekKey:   r.weekKey,
          weekLabel: r.weekLabel || (typeof weekLabel === 'function' ? weekLabel(r.dateStr) : r.weekKey),
          room:      r.room || '',
          locCode,
          locLabel:  LOC_LABELS_LOCAL[locCode] || locCode,
          locBg:     (LOC_COLORS_LOCAL[locCode] || { bg: '#f5f5f5' }).bg,
          locColor:  (LOC_COLORS_LOCAL[locCode] || { color: '#666' }).color,
          rawName:   r.name,
        });
      }
    });
    return result;
  }

  /* ── Filters opvullen ── */
  function populateIjsFilters(rows) {
    const weeks = [...new Map(rows.map(r => [r.weekKey, r.weekLabel])).entries()].sort((a,b)=>a[0].localeCompare(b[0]));
    const wsel = document.getElementById('ijs-f-week');
    if (wsel) {
      wsel.innerHTML = '<option value="">Alle weken</option>';
      weeks.forEach(([k,l]) => { const o = document.createElement('option'); o.value=k; o.textContent=l; wsel.appendChild(o); });
    }
    const dates = [...new Set(rows.map(r => r.dateStr).filter(Boolean))].sort();
    const dsel = document.getElementById('ijs-f-date');
    if (dsel) {
      dsel.innerHTML = '<option value="">Alle dagen</option>';
      dates.forEach(d => {
        const o = document.createElement('option'); o.value=d;
        o.textContent = typeof formatDate === 'function' ? formatDate(d) : d;
        dsel.appendChild(o);
      });
    }
  }

  /* ── Renderen ── */
  function renderIjs() {
    const rows = getIjsRows();
    populateIjsFilters(rows);

    const week = document.getElementById('ijs-f-week')?.value || '';
    const date = document.getElementById('ijs-f-date')?.value || '';
    const type = document.getElementById('ijs-f-type')?.value || '';

    const filtered = rows.filter(r => {
      if (week && r.weekKey !== week) return false;
      if (date && r.dateStr !== date) return false;
      if (type && r.type   !== type)  return false;
      return true;
    });

    // Stats
    const stats = { ijstaart: 0, ijstaart_buffet: 0, ijslam: 0, ijsmissaal: 0 };
    filtered.forEach(r => { stats[r.type] += r.bestellen; });
    const totalTaart = stats.ijstaart + stats.ijstaart_buffet;
    const total = totalTaart + stats.ijslam + stats.ijsmissaal;

    document.getElementById('ijs-stat-taart').textContent    = totalTaart;
    document.getElementById('ijs-stat-lam').textContent      = stats.ijslam;
    document.getElementById('ijs-stat-missaal').textContent  = stats.ijsmissaal;
    document.getElementById('ijs-stat-total').textContent    = total;

    // Cards per dag
    const container = document.getElementById('ijs-cards');
    if (!filtered.length) {
      container.innerHTML = '<div class="ijs-empty">Geen IJsdesserts gevonden in de huidige selectie.</div>';
      return;
    }

    const byDate = {};
    filtered.forEach(r => {
      if (!byDate[r.dateStr]) byDate[r.dateStr] = [];
      byDate[r.dateStr].push(r);
    });

    container.innerHTML = Object.entries(byDate).sort(([a],[b]) => a.localeCompare(b)).map(([dateStr, dayRows]) => {
      const dayLabel = typeof formatDate === 'function' ? formatDate(dateStr) : dateStr;

      // Per type subtotalen voor badges
      const dayStats = { ijstaart: 0, ijstaart_buffet: 0, ijslam: 0, ijsmissaal: 0 };
      dayRows.forEach(r => dayStats[r.type] += r.bestellen);
      // Toon ijstaart en ijstaart_buffet apart in badges
      const badges = Object.entries(dayStats)
        .filter(([,v]) => v > 0)
        .map(([t,v]) => {
          const c = TYPE_CFG[t];
          if (!c) return '';
          return `<span class="ijs-day-badge" style="background:${c.bg};color:${c.color}">${c.label}: ${v}</span>`;
        }).join('');

      const dayTotal = dayRows.reduce((s,r) => s + r.bestellen, 0);
      const dayPersons = dayRows.reduce((s,r) => s + r.persons, 0);

      const tableRows = dayRows
        .sort((a,b) => a.type.localeCompare(b.type) || a.naam.localeCompare(b.naam))
        .map(r => `
          <tr>
            <td><span class="ijs-type-badge" style="background:${r.cfg.bg};color:${r.cfg.color}">${r.cfg.label}</span></td>
            <td class="ijs-name-cell">${r.naam}</td>
            <td class="ijs-zaal-cell">
              <div class="ijs-zaal-naam">${r.room.length > 22 ? r.room.slice(0,21)+'…' : r.room}</div>
              <span class="ijs-loc-pill" style="background:${r.locBg};color:${r.locColor}">
                <span class="ijs-loc-code">${r.locCode}</span>${r.locLabel}
              </span>
            </td>
            <td class="ijs-pers-cell">${r.persons}</td>
            <td class="ijs-bestellen-cell">${r.bestellen}</td>
          </tr>`).join('');

      return `
      <div class="ijs-day-card">
        <div class="ijs-day-header">
          <span class="ijs-day-title">${dayLabel}</span>
          <div class="ijs-day-badges">
            ${badges}
            <span class="ijs-day-badge" style="background:${IJS_BG};color:${IJS_COLOR}">${dayPersons} pers · ${dayTotal} stuks</span>
          </div>
        </div>
        <table class="ijs-table">
          <thead>
            <tr>
              <th style="width:14%">Type</th>
              <th style="width:28%">Naam</th>
              <th style="width:34%">Zaal / Locatie</th>
              <th style="width:10%;text-align:center">Pers.</th>
              <th style="width:14%;text-align:center">Te bestellen</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr class="ijs-total-row">
              <td colspan="3">Totaal ${dayLabel}</td>
              <td style="text-align:center;font-family:'DM Mono',monospace;font-weight:700">${dayPersons}</td>
              <td>${dayTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
    }).join('');
  }

  /* ── CSV Export ── */
  function exportCSV() {
    const rows = getIjsRows();
    const week = document.getElementById('ijs-f-week')?.value || '';
    const date = document.getElementById('ijs-f-date')?.value || '';
    const type = document.getElementById('ijs-f-type')?.value || '';
    const filtered = rows.filter(r => {
      if (week && r.weekKey !== week) return false;
      if (date && r.dateStr !== date) return false;
      if (type && r.type   !== type)  return false;
      return true;
    }).sort((a,b) => a.dateStr.localeCompare(b.dateStr) || a.type.localeCompare(b.type) || a.naam.localeCompare(b.naam));

    const DAYS = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
    const toDay = d => { if (!d) return ''; const dt = new Date(d); return DAYS[dt.getDay()]; };

    const header = ['Datum','Dag','Type','Naam','Zaal','Locatie','Personen','Te bestellen'];
    const csvRows = filtered.map(r => [
      r.dateStr,
      toDay(r.dateStr),
      TYPE_CFG[r.type]?.label || r.type,
      r.naam,
      r.room,
      r.locLabel,
      r.persons,
      r.bestellen,
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(';'));

    const BOM = '\uFEFF';
    const csv = BOM + [header.join(';'), ...csvRows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'ijsdesserts.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  /* ── PDF Export ── */
  async function exportPDF() {
    const rows = getIjsRows();
    const week = document.getElementById('ijs-f-week')?.value || '';
    const date = document.getElementById('ijs-f-date')?.value || '';
    const type = document.getElementById('ijs-f-type')?.value || '';
    const filtered = rows.filter(r => {
      if (week && r.weekKey !== week) return false;
      if (date && r.dateStr !== date) return false;
      if (type && r.type   !== type)  return false;
      return true;
    });

    if (!filtered.length) { alert('Geen IJsdesserts gevonden voor de huidige selectie.'); return; }

    const btn = document.getElementById('ijs-export-pdf-btn');
    if (btn) { btn.disabled = true; }

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

      const DAYS = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
      const byDate = {};
      filtered.forEach(r => { (byDate[r.dateStr] = byDate[r.dateStr] || []).push(r); });
      const sortedDates = Object.keys(byDate).sort();

      // Titel op basis van filter
      let titleSuffix = '';
      if (date) titleSuffix = ' — ' + (typeof formatDate === 'function' ? formatDate(date) : date);
      else if (week) {
        const wLabel = filtered.find(r => r.weekKey === week)?.weekLabel;
        if (wLabel) titleSuffix = ' — ' + wLabel;
      }

      let y = MARGIN;
      let isFirstPage = true;

      function ensureSpace(neededMm) {
        if (y + neededMm > PAGE_H - MARGIN) {
          doc.addPage();
          y = MARGIN;
          drawPageHeader(false);
        }
      }

      function drawPageHeader(withTitle) {
        if (withTitle) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(17);
          doc.setTextColor(26, 25, 23);
          doc.text('IJsdesserts' + titleSuffix, MARGIN, y);
          y += 6;
          doc.setDrawColor(184, 150, 90);
          doc.setLineWidth(0.6);
          doc.line(MARGIN, y, PAGE_W - MARGIN, y);
          y += 9;
        }
      }

      drawPageHeader(true);

      sortedDates.forEach(dateStr => {
        const dayRows = byDate[dateStr].sort((a,b) => a.type.localeCompare(b.type) || a.naam.localeCompare(b.naam));
        const dayLabel = typeof formatDate === 'function' ? formatDate(dateStr) : dateStr;
        const dayTotal = dayRows.reduce((s,r) => s + r.bestellen, 0);

        ensureSpace(18);

        // Dag-kop
        doc.setFillColor(244, 243, 240);
        doc.rect(MARGIN, y, PAGE_W - MARGIN*2, 9, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(26, 25, 23);
        doc.text(dayLabel, MARGIN + 3, y + 6.3);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(107, 101, 94);
        doc.text(`${dayTotal} stuks`, PAGE_W - MARGIN - 3, y + 6.3, { align: 'right' });
        y += 9;

        // Tabel-header
        const col = { type: MARGIN+3, naam: MARGIN+30, zaal: MARGIN+95, aantal: PAGE_W-MARGIN-3 };
        ensureSpace(8);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(154, 149, 144);
        doc.text('TYPE', col.type, y + 5);
        doc.text('NAAM', col.naam, y + 5);
        doc.text('ZAAL / LOCATIE', col.zaal, y + 5);
        doc.text('AANTAL', col.aantal, y + 5, { align: 'right' });
        y += 7;
        doc.setDrawColor(232, 229, 224);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, y, PAGE_W - MARGIN, y);
        y += 5;

        dayRows.forEach(r => {
          ensureSpace(9);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(...hexToRgb(TYPE_CFG[r.type]?.color || '#5A5753'));
          doc.text(TYPE_CFG[r.type]?.label || r.type, col.type, y);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(26, 25, 23);
          const naamTrunc = r.naam.length > 32 ? r.naam.slice(0,31)+'…' : r.naam;
          doc.text(naamTrunc, col.naam, y);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(107, 101, 94);
          const zaalTxt = `${r.room}${r.locLabel ? '  ·  ' + r.locLabel : ''}`;
          const zaalTrunc = zaalTxt.length > 46 ? zaalTxt.slice(0,45)+'…' : zaalTxt;
          doc.text(zaalTrunc, col.zaal, y);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.setTextColor(184, 150, 90);
          doc.text(String(r.bestellen), col.aantal, y, { align: 'right' });

          y += 7.2;
        });

        // Totaalregel per dag
        ensureSpace(9);
        doc.setDrawColor(184, 150, 90);
        doc.setLineWidth(0.4);
        doc.line(MARGIN, y, PAGE_W - MARGIN, y);
        y += 5.5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(26, 25, 23);
        doc.text(`Totaal ${dayLabel}`, col.naam, y);
        doc.setFontSize(11.5);
        doc.setTextColor(184, 150, 90);
        doc.text(String(dayTotal), col.aantal, y, { align: 'right' });
        y += 11;
      });

      // Footer met datum op elke pagina
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
      doc.save(`HVW_IJsdesserts_${stamp}.pdf`);
    } catch (err) {
      alert('Fout bij PDF generatie: ' + err.message);
      console.error(err);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ── UI injecteren ── */
  function injectUI() {
    // Content wrapper
    const wrap = document.createElement('div');
    wrap.id = 'ijs-content-wrap';
    wrap.className = 'page';
    wrap.innerHTML = `
      <!-- Stats -->
      <div class="ijs-stats">
        <div class="ijs-stat">
          <div class="ijs-stat-label">IJstaarten (×3)</div>
          <div class="ijs-stat-val" id="ijs-stat-taart">0</div>
        </div>
        <div class="ijs-stat">
          <div class="ijs-stat-label">IJslammers</div>
          <div class="ijs-stat-val" id="ijs-stat-lam">0</div>
        </div>
        <div class="ijs-stat">
          <div class="ijs-stat-label">IJsmissalen</div>
          <div class="ijs-stat-val" id="ijs-stat-missaal">0</div>
        </div>
        <div class="ijs-stat">
          <div class="ijs-stat-label">Totaal te bestellen</div>
          <div class="ijs-stat-val" id="ijs-stat-total">0</div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="ijs-toolbar no-print">
        <select id="ijs-f-week" onchange="window._renderIjs()"><option value="">Alle weken</option></select>
        <select id="ijs-f-date" onchange="window._renderIjs()"><option value="">Alle dagen</option></select>
        <select id="ijs-f-type" onchange="window._renderIjs()">
          <option value="">Alle types</option>
          <option value="ijstaart">IJstaart</option>
          <option value="ijstaart_buffet">IJstaart (dessertbuffet ÷3)</option>
          <option value="ijslam">IJslam</option>
          <option value="ijsmissaal">IJsmissaal</option>
        </select>
        <button class="ijs-export-btn no-print" onclick="window._exportIjsCSV()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Exporteer CSV
        </button>
        <button class="ijs-export-btn ijs-export-btn-pdf no-print" id="ijs-export-pdf-btn" onclick="window._exportIjsPDF()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          Exporteer PDF
        </button>
      </div>

      <!-- Kaarten -->
      <div class="ijs-cards" id="ijs-cards">
        <div class="ijs-empty">Upload eerst een Excel-bestand om IJsdesserts te zien.</div>
      </div>`;

    // Inject in main
    const main = document.getElementById('app-wrap') || document.body;
    main.appendChild(wrap);

    // Tab knop toevoegen
    const modeTabs = null; // sidebar heeft al knoppen
    if (modeTabs) {
      const btn = document.createElement('button');
      btn.className = 'mode-tab';
      btn.dataset.mode = 'ijs';
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
          <line x1="9" y1="9" x2="9.01" y2="9"/>
          <line x1="15" y1="9" x2="15.01" y2="9"/>
        </svg>
        IJsdesserts`;
      btn.onclick = () => switchToIjs();
      modeTabs.appendChild(btn);
    }

    // Patch switchMode
    const origSwitchMode = window.switchMode;
    window.switchMode = function(mode) {
      const ijsWrap = document.getElementById('ijs-content-wrap');
      if (ijsWrap) ijsWrap.style.display = 'none';
      const ijsBtn = document.querySelector('.mode-tab[data-mode="ijs"]');
      if (ijsBtn) ijsBtn.classList.remove('active');
      if (origSwitchMode) origSwitchMode(mode);
    };

    // Globale functies blootstellen
    window._renderIjs  = renderIjs;
    window._exportIjsCSV = exportCSV;
    window._exportIjsPDF = exportPDF;
  }

  function switchToIjs() {
    // Verberg andere content
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // Verberg feest-detail indien open
    const fd = document.getElementById('page-feest-detail');
    if (fd) fd.style.display = 'none';

    // Toon ijs content
    const wrap = document.getElementById('ijs-content-wrap');
    if (wrap) wrap.style.display = 'block';

    // Tab styling
    document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector('.mode-tab[data-mode="ijs"]');
    if (btn) btn.classList.add('active');

    renderIjs();
  }

  /* ── Init ── */
  // Mobile responsive styles
  (function() {
    const ms = document.createElement('style');
    ms.textContent = `
      @media (max-width: 768px) {
        #ijs-content-wrap { padding: 14px !important; }
        #ijs-content-wrap .ijs-stats { grid-template-columns: 1fr 1fr; gap: 8px; }
        #ijs-content-wrap table { font-size: 11px; }
        #ijs-content-wrap th, #ijs-content-wrap td { padding: 6px 8px !important; }
      }`;
    document.head.appendChild(ms);
  })();

  document.addEventListener('DOMContentLoaded', () => {
    injectCSS();
    injectUI();
  });

  // Ook renderen als data al beschikbaar is na upload (hook op processData)
  const _origProcessData = window.processData;
  if (typeof _origProcessData === 'function') {
    // processData is intern — we hooken via MutationObserver op de cards
  }
  // Luister op custom event van app.js (als dat bestaat)
  document.addEventListener('dataLoaded', renderIjs);

})();
