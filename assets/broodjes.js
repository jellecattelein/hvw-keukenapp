/* ══════════════════════════════════════════
   broodjes.js — Broodjesberekening per feest
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── CSS ── */
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      #broodjes-content { display: none; padding: 26px 28px; }

      .broodjes-topbar {
        display: flex; align-items: center; gap: 10px;
        margin-bottom: 20px; flex-wrap: wrap;
      }
      .broodjes-topbar select {
        font-family: 'Outfit', sans-serif; font-size: 13px;
        padding: 8px 12px; border: 1px solid #DEDAD4;
        border-radius: 8px; background: #fff; outline: none;
      }

      .broodjes-card {
        background: #fff; border: 1px solid #E8E5E0;
        border-radius: 14px; overflow: hidden;
        box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        margin-bottom: 14px;
      }
      .broodjes-day-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 13px 20px; background: #FAFAF8;
        border-bottom: 1px solid #E8E5E0; flex-wrap: wrap; gap: 10px;
      }
      .broodjes-day-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: 17px; font-weight: 500;
      }
      .broodjes-day-total {
        font-family: 'DM Mono', monospace; font-size: 13px;
        font-weight: 600; color: #B8965A;
        background: #F7F0E4; border: 1px solid rgba(184,150,90,0.3);
        border-radius: 20px; padding: 3px 12px;
      }

      .broodjes-table {
        width: 100%; border-collapse: collapse; font-size: 13px;
      }
      .broodjes-table th {
        background: #F4F3F0; padding: 8px 16px;
        text-align: left; font-size: 10px; font-weight: 700;
        text-transform: uppercase; letter-spacing: .7px; color: #9A9590;
        border-bottom: 1px solid #E8E5E0;
      }
      .broodjes-table th:last-child,
      .broodjes-table td:last-child { text-align: right; }
      .broodjes-table td {
        padding: 10px 16px; border-bottom: 1px solid #F4F3F0;
        vertical-align: middle;
      }
      .broodjes-table tr:last-child td { border-bottom: none; }
      .broodjes-table tr:hover td { background: #FAFAF8; }

      .broodjes-room { font-weight: 600; font-size: 13px; }
      .broodjes-sub  { font-size: 11px; color: #9A9590; margin-top: 2px; }
      .broodjes-pers { font-family: 'DM Mono', monospace; font-size: 13px; color: #9A9590; }
      .broodjes-num  {
        font-family: 'DM Mono', monospace; font-weight: 700;
        font-size: 16px; color: #1A1917;
      }
      .broodjes-num.zero { color: #C8C2B8; font-weight: 400; }
      .broodjes-tag {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 10px; font-weight: 600; padding: 2px 7px;
        border-radius: 10px; margin-right: 4px;
      }
      .tag-soep { background: #EDF3FB; color: #1A3F6F; }
      .tag-hg   { background: #FDF1ED; color: #8B2500; }
      .tag-geen { background: #F4F3F0; color: #9A9590; }

      .broodjes-empty {
        text-align: center; padding: 3rem;
        color: #C8C2B8; font-size: 13px;
      }

      @media (max-width: 768px) {
        #broodjes-content { padding: 14px; }
        .broodjes-table th:nth-child(2),
        .broodjes-table td:nth-child(2) { display: none; }
      }
      @media print {
        #broodjes-content { padding: 0; display: block !important; }
        .broodjes-topbar  { display: none !important; }
        .no-print         { display: none !important; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ── Bereken broodjes per feest via rawData + Booking ID ── */
  function berekenBroodjes(event) {
    if (!event) return { hg: false, soep: false, aantal: 0, persons: 0 };
    const persons   = event.persons || 0;
    const bookingId = event.bookingId || '';

    // Gebruik rawData — die heeft Booking ID + Category name
    const bron = (typeof rawData !== 'undefined' && rawData.length) ? rawData : null;
    if (!bron || !bookingId) return { hg: false, soep: false, aantal: 0, persons };

    // Filter alle rijen van dit feest
    const feestRijen = bron.filter(r =>
      (r['Booking ID'] || '').toString().trim() === bookingId
    );

    if (!feestRijen.length) return { hg: false, soep: false, aantal: 0, persons };

    // Controleer categorieën
    const cats = feestRijen.map(r => (r['Category name'] || '').toString().trim().toLowerCase());

    const heeftVlees = cats.some(c => c === 'hg vlees');
    const heeftVis   = cats.some(c => c === 'hg vis');
    const heeftHG    = heeftVlees || heeftVis;
    const heeftSoep  = cats.some(c => c === 'soepen');

    if (!heeftHG) return { hg: false, soep: false, aantal: 0, persons };

    const perPersoon = heeftSoep ? 2 : 1.25;
    const aantal     = Math.ceil(persons * perPersoon);

    return { hg: heeftHG, soep: heeftSoep, aantal, persons, perPersoon };
  }

  /* ── Render ── */
  window.renderBroodjes = function(weekFilter) {
    const el = document.getElementById('broodjes-content');
    if (!el) return;

    if (typeof allEvents === 'undefined' || !allEvents.length) {
      el.innerHTML = `
        <div class="broodjes-empty">
          Upload eerst een Excel-bestand om de broodjesberekening te zien.
        </div>`;
      return;
    }

    // Week filter
    const wk = weekFilter !== undefined ? weekFilter
      : el.querySelector('#broodjes-week')?.value || '';

    const weeks = [...new Map(allEvents.map(e => [e.weekKey, e.weekLabel])).entries()]
      .sort((a, b) => a[0].localeCompare(b[0]));

    const weekOpties = weeks.map(([k, l]) =>
      `<option value="${k}" ${k === wk ? 'selected' : ''}>${l}</option>`
    ).join('');

    // Groepeer per dag
    const events = allEvents
      .filter(e => !wk || e.weekKey === wk)
      .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : (a.time||'').localeCompare(b.time||''));
    const byDate = {};
    events.forEach(e => {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e);
    });

    let totalBroodjes = 0;
    let dagHtml = '';

    Object.keys(byDate).sort().forEach(date => {
      const dagEvents = byDate[date].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      let dagTotal = 0;

      const rows = dagEvents.map(e => {
        const { hg, soep, aantal, persons, perPersoon } = berekenBroodjes(e);
        dagTotal += aantal;

        const rooms = (e.room || '').split(';').map(r => r.trim()).join(', ');
        const tagHtml = hg
          ? `<span class="broodjes-tag tag-hg">🍽 HG</span>${soep ? '<span class="broodjes-tag tag-soep">🍵 Soep</span>' : ''}`
          : `<span class="broodjes-tag tag-geen">— geen HG</span>`;

        const subTxt = hg
          ? `${perPersoon} p/p${soep ? ' (incl. soep)' : ''}`
          : '';

        return `
          <tr>
            <td>
              <div class="broodjes-room">${rooms}</div>
              <div class="broodjes-sub">${e.time || '—'} &nbsp;·&nbsp; ${tagHtml}</div>
            </td>
            <td class="broodjes-pers">${persons}</td>
            <td><div class="broodjes-sub" style="text-align:right">${subTxt}</div></td>
            <td><span class="broodjes-num ${aantal === 0 ? 'zero' : ''}">${aantal || '—'}</span></td>
          </tr>`;
      }).join('');

      totalBroodjes += dagTotal;

      const fmt = typeof formatDate === 'function' ? formatDate(date) : date;
      dagHtml += `
        <div class="broodjes-card">
          <div class="broodjes-day-header">
            <span class="broodjes-day-title">${fmt}</span>
            <span class="broodjes-day-total">${dagTotal} broodjes</span>
          </div>
          <table class="broodjes-table">
            <thead>
              <tr>
                <th>Feest</th>
                <th style="width:80px">Pers.</th>
                <th style="width:120px">Berekening</th>
                <th style="width:100px">Broodjes</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    });

    if (!dagHtml) {
      dagHtml = '<div class="broodjes-empty">Geen feesten gevonden voor deze week.</div>';
    }

    el.innerHTML = `
      <div class="broodjes-topbar no-print">
        <select id="broodjes-week" onchange="renderBroodjes(this.value)">
          <option value="">Alle weken</option>${weekOpties}
        </select>
        <div style="margin-left:auto;display:flex;align-items:center;gap:10px">
          <span style="font-family:'DM Mono',monospace;font-size:13px;color:#9A9590">
            Totaal: <strong style="color:#1A1917">${totalBroodjes} broodjes</strong>
          </span>
          <button class="btn btn-primary no-print" onclick="broodjesPDF()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            PDF weekoverzicht
          </button>
          <button class="btn no-print" onclick="broodjesPlateauPDF()" title="Plateaukaartjes — 25 st/plateau">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Plateaukaartjes
          </button>
        </div>
      </div>
      ${dagHtml}`;
  };

  /* ── PDF export ── */
  window.broodjesPDF = async function() {
    if (!window.jspdf) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210; const margin = 16;
    let y = 0;

    const wk  = document.getElementById('broodjes-week')?.value || '';
    const events = (typeof allEvents !== 'undefined' ? allEvents : [])
      .filter(e => !wk || e.weekKey === wk)
      .sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : (a.time||'').localeCompare(b.time||''));

    const byDate = {};
    events.forEach(e => {
      if (!byDate[e.date]) byDate[e.date] = [];
      byDate[e.date].push(e);
    });

    // Header
    doc.setFillColor(17, 17, 16);
    doc.rect(0, 0, W, 16, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.setTextColor(184, 150, 90);
    doc.text('HUIS VAN WONTERGHEM — KEUKENAPP', margin, 10);
    doc.setTextColor(255, 255, 255);
    const weekLabel = document.getElementById('broodjes-week')?.options[document.getElementById('broodjes-week')?.selectedIndex]?.text || 'Alle weken';
    doc.text('Broodjesoverzicht — ' + weekLabel, W - margin, 10, { align: 'right' });
    y = 24;

    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 25, 23);
    doc.text('Broodjesoverzicht per feest', margin, y); y += 12;

    let grandTotal = 0;

    Object.keys(byDate).sort().forEach(date => {
      const dagEvents = byDate[date].sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      let dagTotal = 0;

      // Dag header
      if (y > 260) { doc.addPage(); y = 16; }
      const fmt = typeof formatDate === 'function' ? formatDate(date) : date;
      doc.setFillColor(244, 243, 240);
      doc.rect(margin, y - 5, W - margin * 2, 9, 'F');
      doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 25, 23);
      doc.text(fmt, margin + 2, y);
      y += 6;

      // Tabel header
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(154, 144, 129);
      doc.text('FEEST', margin + 2, y);
      doc.text('PERS.', 130, y);
      doc.text('P/P', 155, y);
      doc.text('BROODJES', W - margin - 2, y, { align: 'right' });
      doc.setDrawColor(232, 229, 224); doc.setLineWidth(0.3);
      doc.line(margin, y + 2, W - margin, y + 2);
      y += 7;

      dagEvents.forEach(e => {
        const { hg, soep, aantal, persons, perPersoon } = berekenBroodjes(e);
        dagTotal += aantal;

        if (y > 274) { doc.addPage(); y = 16; }

        const rooms = (e.room || '').split(';').map(r => r.trim()).join(', ');
        const roomLines = doc.splitTextToSize(`${e.time || '—'}  ${rooms}`, 108);

        doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(26, 25, 23);
        doc.text(roomLines, margin + 2, y);

        doc.setTextColor(154, 144, 129);
        doc.text(String(persons), 130, y);
        doc.text(hg ? String(perPersoon) : '—', 155, y);

        if (aantal > 0) {
          doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 25, 23);
        } else {
          doc.setFont('helvetica', 'normal'); doc.setTextColor(200, 194, 184);
        }
        doc.text(aantal > 0 ? String(aantal) : '—', W - margin - 2, y, { align: 'right' });

        // Soep label
        if (soep) {
          doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(26, 63, 111);
          doc.text('incl. soep', W - margin - 2, y + 4, { align: 'right' });
        }

        y += roomLines.length * 5 + 3;
        // geen lijn — was overlapte met tekst
      });

      // Dag totaal
      grandTotal += dagTotal;
      doc.setFillColor(247, 240, 228);
      doc.rect(margin, y, W - margin * 2, 7, 'F');
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 25, 23);
      doc.text('Totaal ' + fmt, margin + 2, y + 5);
      doc.setTextColor(184, 150, 90);
      doc.text(dagTotal + ' broodjes', W - margin - 2, y + 5, { align: 'right' });
      y += 14;
    });

    // Grand total
    if (y > 274) { doc.addPage(); y = 16; }
    doc.setFillColor(17, 17, 16);
    doc.rect(margin, y, W - margin * 2, 10, 'F');
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text('TOTAAL WEEK', margin + 4, y + 7);
    doc.setTextColor(184, 150, 90);
    doc.text(grandTotal + ' broodjes', W - margin - 4, y + 7, { align: 'right' });

    // Footer
    doc.setFontSize(8); doc.setTextColor(180, 174, 170);
    doc.text('Huis van Wonterghem — Keukenapp', margin, 292);
    doc.text(new Date().toLocaleDateString('nl-BE'), W - margin, 292, { align: 'right' });

    doc.save(`HVW_Broodjes_${new Date().toLocaleDateString('nl-BE').replace(/\//g, '-')}.pdf`);
  };

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', () => {
    injectCSS();
    // Injecteer container
    const wrap = document.createElement('div');
    wrap.id = 'broodjes-content';
    const appWrap = document.getElementById('app-wrap') || document.body;
    appWrap.appendChild(wrap);
  });

  /* ══════════════════════════════
     PLATEAU PDF — zelfde stijl als etiketten
     25 broodjes per plateau
     ══════════════════════════════ */
  window.broodjesPlateauPDF = async function() {
    if (!window.jspdf) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    const { jsPDF } = window.jspdf;

    // Per plateau afhankelijk van locatie
    function getPerPlateau(locCode) {
      return ['MAE','HVW'].includes(locCode) ? 50 : 25;
    }

    // Etiket afmetingen (mm) — exact zelfde als karren-etiketten
    const LABEL_W  = 65;
    const LABEL_H  = 37;
    const COLS     = 3;
    const ROWS     = 7;
    const MARGIN_L = 2;
    const MARGIN_T = 1;
    const GAP_X    = 5;
    const GAP_Y    = 0;

    // Locatie kleuren RGB
    const LOC_RGB = {
      TRA: [26,63,111],  MAE: [45,106,79],
      HVW: [139,37,0],   BIE: [107,58,125], AFH: [139,106,0]
    };
    const LOC_LBL = {
      TRA:'Traiteur', MAE:'Maelstede', HVW:'Huis van Wonterghem',
      BIE:'Bierkasteel', AFH:'Afhaal'
    };

    // Verzamel alle plateau-kaartjes — gesorteerd op datum dan tijd
    const wk = document.getElementById('broodjes-week')?.value || '';
    const events = (typeof allEvents !== 'undefined' ? allEvents : [])
      .filter(e => !wk || e.weekKey === wk)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || '').localeCompare(b.time || '');
      });

    const labels = [];
    events.forEach(e => {
      const { hg, aantal, persons } = berekenBroodjes(e);
      if (!hg || aantal <= 0) return;

      const perPlateau = getPerPlateau(e.location || '');
      const plateaus = Math.ceil(aantal / perPlateau);
      for (let p = 1; p <= plateaus; p++) {
        const stuks = p < plateaus ? perPlateau : (aantal - (plateaus - 1) * perPlateau);
        labels.push({
          room:      (e.room || '').split(';')[0].trim(),
          date:      e.date,
          time:      e.time || '',
          persons,
          locCode:   e.location || '',
          broodjes:  aantal,
          plateau:   p,
          plateaus,
          stuks,
          perPlateau
        });
      }
    });

    if (!labels.length) {
      alert('Geen feesten met broodjes gevonden.');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const perPage = COLS * ROWS;

    labels.forEach((lbl, li) => {
      if (li > 0 && li % perPage === 0) doc.addPage();
      const pos = li % perPage;
      const col = pos % COLS;
      const row = Math.floor(pos / COLS);
      const x   = MARGIN_L + col * (LABEL_W + GAP_X);
      const y   = MARGIN_T + row * (LABEL_H + GAP_Y);

      drawPlateauLabel(doc, x, y, lbl, LABEL_W, LABEL_H, LOC_RGB, LOC_LBL);
    });

    doc.save(`HVW_Broodjes_Plateaus_${new Date().toLocaleDateString('nl-BE').replace(/\//g,'-')}.pdf`);
  };

  function drawPlateauLabel(doc, x, y, lbl, w, h, LOC_RGB, LOC_LBL) {
    const pad = 2.5;

    // Achtergrond crème
    doc.setFillColor(251, 250, 246);
    doc.rect(x, y, w, h, 'F');

    // Kleurrand links op basis van locatie
    const rgb = LOC_RGB[lbl.locCode] || [100,100,100];
    doc.setFillColor(...rgb);
    doc.rect(x, y, 4, h, 'F');

    // Locatie naam rechts bovenaan
    doc.setFontSize(6.5); doc.setFont('helvetica','bold');
    doc.setTextColor(...rgb);
    doc.text((LOC_LBL[lbl.locCode] || lbl.locCode).toUpperCase(), x + w - pad, y + pad + 3.5, { align:'right' });

    // Datum + tijd
    const [yr, mo, da] = (lbl.date || '--').split('-');
    const DAGEN = ['zo','ma','di','wo','do','vr','za'];
    const dagNr = new Date(lbl.date).getDay();
    const dateStr = `${DAGEN[dagNr] || ''} ${da}/${mo}`;
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(60,58,55);
    doc.text(dateStr, x + 6, y + pad + 3.5);

    // Zaal
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(26,25,23);
    const roomLines = doc.splitTextToSize(lbl.room, w - 14);
    doc.text(roomLines[0], x + 6, y + pad + 10);
    if (roomLines[1]) doc.text(roomLines[1], x + 6, y + pad + 15);

    // Tijd rechts
    if (lbl.time) {
      doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(100,98,95);
      doc.text(lbl.time, x + w - pad, y + pad + 10, { align:'right' });
    }

    // Scheidingslijn
    doc.setDrawColor(201,193,176); doc.setLineWidth(0.2);
    doc.line(x + 6, y + h - 12, x + w - pad, y + h - 12);

    // Broodjes info onderaan
    doc.setFontSize(7); doc.setFont('helvetica','normal'); doc.setTextColor(100,98,95);
    doc.text(`${lbl.persons} pers.`, x + 6, y + h - pad - 5);

    // Groot: stuks op plateau
    doc.setFontSize(11); doc.setFont('helvetica','bold'); doc.setTextColor(...rgb);
    doc.text(`${lbl.stuks} st.`, x + w - pad, y + h - pad - 5, { align:'right' });

    // Plateau nummer
    doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(154,144,129);
    doc.text(`plateau ${lbl.plateau}/${lbl.plateaus} · ${lbl.perPlateau} st/pl · ${lbl.broodjes} totaal`, x + 6, y + h - pad - 1);

    // Rand
    doc.setDrawColor(201,193,176); doc.setLineWidth(0.3);
    doc.rect(x, y, w, h, 'S');
  }

  document.addEventListener('dataLoaded', () => {
    if (document.getElementById('broodjes-content')?.style.display === 'block') {
      renderBroodjes();
    }
  });

})();
