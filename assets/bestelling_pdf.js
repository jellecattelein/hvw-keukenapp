/* ══════════════════════════════════════════
   bestelling_pdf.js — Compacte bestelling PDF
   Week totaal, per categorie, papier besparend
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  const CAT_ORDER = [
    { tab: 'vlees',    label: 'Vlees',              color: [139,37,0]    },
    { tab: 'vis',      label: 'Vis',                color: [26,63,111]   },
    { tab: 'small_plates', label: 'Small Plates',   color: [61,90,128]   },
    { tab: 'hg_veggie',label: 'HG Veggie',          color: [45,106,79]   },
    { tab: 'groenten', label: 'Groenten & Aardappelen', color: [59,109,17] },
    { tab: 'hapjes',   label: 'Hapjes',             color: [139,106,0]   },
    { tab: 'streetfood',label:'Streetfood',         color: [192,57,43]   },
    { tab: 'dessert',  label: 'Dessert',            color: [107,58,125]  },
    { tab: 'dessertbuffet', label: 'Dessertbuffet', color: [194,24,91]   },
    { tab: 'sausen',   label: 'Sausen',             color: [29,106,106]  },
    { tab: 'broodjes', label: 'Broodjes',           color: [139,106,0]   },
    { tab: 'soepen',   label: 'Soepen & Dranken',   color: [46,64,87]    },
    { tab: 'latenight',label: 'Late Night',         color: [69,90,100]   },
    { tab: 'kids',     label: 'Kids',               color: [122,59,30]   },
  ];

  async function loadJsPDF() {
    if (!window.jspdf) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
  }

  window.bestellingPDF = async function() {
    if (typeof allRows === 'undefined' || !allRows.length) {
      alert('Upload eerst een Excel-bestand.'); return;
    }

    await loadJsPDF();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W = 210; const margin = 14;
    let y = 0;

    // Haal week filter op
    const weekSel = document.getElementById('f-week');
    const weekVal = weekSel?.value || '';
    const weekLabel = weekSel ? weekSel.options[weekSel.selectedIndex]?.text : 'Alle weken';

    // Filter rows op week
    const rows = allRows.filter(r => !weekVal || r.weekKey === weekVal);
    if (!rows.length) { alert('Geen data voor deze week.'); return; }

    // Bouw pivot: tabId → base/name → { persons, grams, kg }
    const pivot = {};
    rows.forEach(r => {
      const cat = r.tabId;
      const prod = r.base || r.name || '—';
      if (!pivot[cat]) pivot[cat] = {};
      if (!pivot[cat][prod]) pivot[cat][prod] = { persons: 0, totalKg: 0 };
      pivot[cat][prod].persons += r.persons;
      const g = typeof getGrams === 'function' ? getGrams(r) : 0;
      if (g > 0) pivot[cat][prod].totalKg += r.persons * g / 1000;
    });

    /* ── HEADER ── */
    doc.setFillColor(17, 17, 16);
    doc.rect(0, 0, W, 16, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.setTextColor(184, 150, 90);
    doc.text('HUIS VAN WONTERGHEM — KEUKENAPP', margin, 10);
    doc.setTextColor(255, 255, 255);
    doc.text(`Bestelling — ${weekLabel}`, W - margin, 10, { align: 'right' });
    y = 22;

    // Datum
    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.setTextColor(154, 144, 129);
    doc.text(`Afgedrukt op ${new Date().toLocaleDateString('nl-BE')}`, margin, y);
    y += 8;

    /* ── TWEE KOLOMMEN LAYOUT ── */
    const colW = (W - margin * 2 - 6) / 2; // breedte per kolom
    const col1X = margin;
    const col2X = margin + colW + 6;
    let col1Y = y;
    let col2Y = y;
    let currentCol = 0; // 0 = links, 1 = rechts

    function getCurX() { return currentCol === 0 ? col1X : col2X; }
    function getCurY() { return currentCol === 0 ? col1Y : col2Y; }
    function setCurY(val) {
      if (currentCol === 0) col1Y = val;
      else col2Y = val;
    }

    function checkPageBreak(needed) {
      const curY = getCurY();
      if (curY + needed > 282) {
        if (currentCol === 0) {
          // Ga naar rechterkolom
          currentCol = 1;
        } else {
          // Nieuwe pagina
          doc.addPage();
          // Header op nieuwe pagina
          doc.setFillColor(17,17,16);
          doc.rect(0,0,W,10,'F');
          doc.setFontSize(7); doc.setFont('helvetica','bold');
          doc.setTextColor(184,150,90);
          doc.text('HUIS VAN WONTERGHEM — BESTELLING', margin, 7);
          doc.setTextColor(255,255,255);
          doc.text(weekLabel, W-margin, 7, {align:'right'});
          col1Y = 14; col2Y = 14;
          currentCol = 0;
        }
      }
    }

    CAT_ORDER.forEach(cat => {
      if (!pivot[cat.tab]) return;
      const prods = Object.entries(pivot[cat.tab]).sort((a,b) => a[0].localeCompare(b[0]));
      if (!prods.length) return;

      const linesNeeded = prods.length * 5.5 + 10;
      checkPageBreak(linesNeeded);

      const x = getCurX();
      let cy = getCurY();

      // Categorie header
      doc.setFillColor(...cat.color);
      doc.rect(x, cy, colW, 6.5, 'F');
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(cat.label.toUpperCase(), x + 2, cy + 4.5);

      // Totaal personen rechts
      const totPers = prods.reduce((s, [, v]) => s + v.persons, 0);
      doc.text(`${totPers} pers.`, x + colW - 2, cy + 4.5, { align: 'right' });
      cy += 7;

      // Producten
      prods.forEach(([prod, data]) => {
        checkPageBreak(6);
        const px = getCurX();
        cy = getCurY();

        doc.setFontSize(8); doc.setFont('helvetica', 'normal');
        doc.setTextColor(26, 25, 23);

        // Productnaam (afkappen als te lang)
        const maxW = colW - 20;
        const prodLines = doc.splitTextToSize(prod, maxW);
        doc.text(prodLines[0], px + 2, cy + 4);

        // Personen rechts
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...cat.color);
        doc.text(String(data.persons), px + colW - 2, cy + 4, { align: 'right' });

        // Kg als beschikbaar
        if (data.totalKg > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(154, 144, 129);
          doc.setFontSize(7);
          doc.text(`${data.totalKg.toFixed(1)} kg`, px + colW - 18, cy + 4, { align: 'right' });
          doc.setFontSize(8);
        }

        // Dunne scheidingslijn
        doc.setDrawColor(232, 229, 224); doc.setLineWidth(0.15);
        doc.line(px + 1, cy + 5.5, px + colW - 1, cy + 5.5);

        cy += 5.5;
        setCurY(cy);
      });

      setCurY(getCurY() + 4); // ruimte na categorie
    });

    // Footer op elke pagina
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(180, 174, 170);
      doc.setFont('helvetica', 'normal');
      doc.text(`Huis van Wonterghem — Bestelling ${weekLabel}`, margin, 293);
      doc.text(`${i}/${pageCount}`, W - margin, 293, { align: 'right' });
    }

    doc.save(`HVW_Bestelling_${weekLabel.replace(/\s/g,'_')}.pdf`);
  };

  /* ── Injecteer knop in calculator ── */
  document.addEventListener('DOMContentLoaded', () => {
    // Voeg knop toe via MutationObserver zodra week-section beschikbaar is
    const observer = new MutationObserver(() => {
      const weekFilters = document.querySelector('#week-section .filters');
      if (weekFilters && !document.getElementById('bestelling-pdf-btn')) {
        const btn = document.createElement('button');
        btn.id = 'bestelling-pdf-btn';
        btn.className = 'btn btn-primary no-print';
        btn.style.marginLeft = 'auto';
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Bestelling PDF`;
        btn.onclick = () => bestellingPDF();
        weekFilters.appendChild(btn);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

  document.addEventListener('dataLoaded', () => {
    // Knop zichtbaar maken
    setTimeout(() => {
      const btn = document.getElementById('bestelling-pdf-btn');
      if (btn) btn.style.display = 'inline-flex';
    }, 500);
  });

})();
