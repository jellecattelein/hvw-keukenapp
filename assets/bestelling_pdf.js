/* ══════════════════════════════════════════
   bestelling_pdf.js — Bestelling PDF
   Per categorie, week totaal, met zalen
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  const CAT_ORDER = [
    { tab: 'vlees',       label: 'HG Vlees',              color: [139,37,0]    },
    { tab: 'vis',         label: 'HG Vis / VG Warm',      color: [26,63,111]   },
    { tab: 'small_plates',label: 'Small Plates',          color: [61,90,128]   },
    { tab: 'hg_veggie',   label: 'HG Veggie',             color: [45,106,79]   },
    { tab: 'groenten',    label: 'Groenten & Aardappelen', color: [59,109,17]   },
    { tab: 'hapjes',      label: 'Hapjes',                color: [139,106,0]   },
    { tab: 'streetfood',  label: 'Streetfood',            color: [192,57,43]   },
    { tab: 'dessert',     label: 'Dessert',               color: [107,58,125]  },
    { tab: 'dessertbuffet',label:'Dessertbuffet',         color: [194,24,91]   },
    { tab: 'sausen',      label: 'Sausen',                color: [29,106,106]  },
    { tab: 'broodjes',    label: 'Broodjes',              color: [139,106,0]   },
    { tab: 'soepen',      label: 'Soepen & Dranken',      color: [46,64,87]    },
    { tab: 'latenight',   label: 'Late Night',            color: [69,90,100]   },
    { tab: 'kids',        label: 'Kids',                  color: [122,59,30]   },
  ];

  window.bestellingPDF = async function() {
    if (typeof allRows === 'undefined' || !allRows.length) {
      alert('Upload eerst een Excel-bestand.'); return;
    }
    if (!window.jspdf) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }
    const { jsPDF } = window.jspdf;
    const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W    = 210;
    const ML   = 12; // left margin
    const MR   = 12; // right margin
    const CW   = W - ML - MR; // content width
    let y      = 0;

    // Week filter
    const weekSel   = document.getElementById('f-week');
    const weekVal   = weekSel?.value || '';
    const weekLabel = weekSel?.options[weekSel.selectedIndex]?.text || 'Alle weken';

    // Filter rows
    const rows = allRows.filter(r => !weekVal || r.weekKey === weekVal);
    if (!rows.length) { alert('Geen data voor deze week.'); return; }

    // Bouw pivot: tabId → prod → { persons, kg, zalen: {room: {persons,kg}} }
    const pivot = {};
    rows.forEach(r => {
      const cat  = r.tabId;
      const prod = r.base || r.name || '—';
      const room = (r.room || r.event || '—').split(';')[0].trim();
      const g    = typeof getGrams === 'function' ? getGrams(r) : 0;
      const kg   = g > 0 ? +(r.persons * g / 1000).toFixed(2) : 0;

      if (!pivot[cat]) pivot[cat] = {};
      if (!pivot[cat][prod]) pivot[cat][prod] = { persons: 0, kg: 0, zalen: {} };
      pivot[cat][prod].persons += r.persons;
      pivot[cat][prod].kg     += kg;
      if (!pivot[cat][prod].zalen[room]) pivot[cat][prod].zalen[room] = { persons: 0, kg: 0 };
      pivot[cat][prod].zalen[room].persons += r.persons;
      pivot[cat][prod].zalen[room].kg      += kg;
    });

    // Nieuwe pagina helper
    function newPage() {
      doc.addPage();
      // Mini header
      doc.setFillColor(17,17,16);
      doc.rect(0,0,W,9,'F');
      doc.setFontSize(7); doc.setFont('helvetica','bold');
      doc.setTextColor(184,150,90);
      doc.text('HVW KEUKENAPP — BESTELLING', ML, 6.5);
      doc.setTextColor(255,255,255);
      doc.text(weekLabel, W-MR, 6.5, {align:'right'});
      y = 14;
    }

    function checkY(needed) {
      if (y + needed > 284) newPage();
    }

    // ── HOOFDPAGINA HEADER ──
    doc.setFillColor(17,17,16);
    doc.rect(0,0,W,18,'F');
    doc.setFontSize(9); doc.setFont('helvetica','bold');
    doc.setTextColor(184,150,90);
    doc.text('HUIS VAN WONTERGHEM — KEUKENAPP', ML, 11);
    doc.setTextColor(255,255,255);
    doc.text(`Bestelling — ${weekLabel}`, W-MR, 11, {align:'right'});
    doc.setFontSize(7.5); doc.setFont('helvetica','normal');
    doc.setTextColor(154,144,129);
    doc.text(`Afgedrukt ${new Date().toLocaleDateString('nl-BE')}`, ML, 16);
    y = 24;

    // ── CATEGORIEËN ──
    CAT_ORDER.forEach(cat => {
      const prods = pivot[cat.tab];
      if (!prods) return;

      const prodList = Object.entries(prods)
        .filter(([,v]) => v.persons > 0)
        .sort((a,b) => b[1].persons - a[1].persons);
      if (!prodList.length) return;

      const catTotal = prodList.reduce((s,[,v]) => s + v.persons, 0);
      const catKg    = prodList.reduce((s,[,v]) => s + v.kg, 0);

      checkY(10);

      // Categorie header balk
      doc.setFillColor(...cat.color);
      doc.rect(ML, y, CW, 7, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica','bold');
      doc.setTextColor(255,255,255);
      doc.text(cat.label.toUpperCase(), ML+3, y+5);
      // Totaal rechts
      const catInfo = catKg > 0
        ? `${catTotal} pers. · ${catKg.toFixed(1)} kg`
        : `${catTotal} pers.`;
      doc.text(catInfo, W-MR-2, y+5, {align:'right'});
      y += 9;

      // Producten
      prodList.forEach(([prod, data]) => {
        const zalenLijst = Object.entries(data.zalen)
          .sort((a,b) => b[1].persons - a[1].persons);
        const regels = 1 + zalenLijst.length;
        checkY(regels * 5 + 3);

        // ── Product rij ──
        // Lichtgrijze achtergrond
        doc.setFillColor(248,247,244);
        doc.rect(ML, y, CW, 6, 'F');

        // Productnaam — afkappen op max breedte
        doc.setFontSize(8); doc.setFont('helvetica','bold');
        doc.setTextColor(26,25,23);
        const nameMaxW = CW - 50;
        const nameTxt  = doc.splitTextToSize(prod, nameMaxW)[0];
        doc.text(nameTxt, ML+3, y+4.2);

        // Kg (midden-rechts)
        if (data.kg > 0) {
          doc.setFont('helvetica','normal');
          doc.setTextColor(120,116,112);
          doc.setFontSize(7.5);
          doc.text(`${data.kg.toFixed(1)} kg`, W-MR-22, y+4.2, {align:'right'});
        }

        // Personen (rechts, vet, kleur)
        doc.setFont('helvetica','bold');
        doc.setTextColor(...cat.color);
        doc.setFontSize(9);
        doc.text(String(data.persons), W-MR-2, y+4.5, {align:'right'});

        y += 6.5;

        // ── Zalen ──
        zalenLijst.forEach(([room, zData]) => {
          checkY(5);
          doc.setFontSize(7); doc.setFont('helvetica','normal');
          doc.setTextColor(100,98,95);
          // Zaalinaam ingesprongen
          const roomTxt = doc.splitTextToSize(room, CW - 42)[0];
          doc.text('    · ' + roomTxt, ML+3, y+3.5);
          // Kg zaal
          if (zData.kg > 0) {
            doc.setTextColor(154,144,129);
            doc.text(`${zData.kg.toFixed(1)} kg`, W-MR-22, y+3.5, {align:'right'});
          }
          // Personen zaal
          doc.setFont('helvetica','bold');
          doc.setTextColor(100,98,95);
          doc.text(String(zData.persons), W-MR-2, y+3.5, {align:'right'});

          // Lijn
          doc.setDrawColor(230,227,222); doc.setLineWidth(0.1);
          doc.line(ML+6, y+4.8, W-MR, y+4.8);
          y += 5;
        });

        y += 1.5; // ruimte tussen producten
      });

      y += 3; // ruimte na categorie
    });

    // Paginanummers
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7); doc.setTextColor(180,174,170); doc.setFont('helvetica','normal');
      doc.text(`Huis van Wonterghem — Bestelling ${weekLabel}`, ML, 293);
      doc.text(`${i} / ${pages}`, W-MR, 293, {align:'right'});
    }

    doc.save(`HVW_Bestelling_${weekLabel.replace(/\s/g,'_')}.pdf`);
  };

  /* ── Knop injecteren in week-section filters ── */
  document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver(() => {
      const wf = document.querySelector('#week-section .filters');
      if (wf && !document.getElementById('bestelling-pdf-btn')) {
        const btn = document.createElement('button');
        btn.id        = 'bestelling-pdf-btn';
        btn.className = 'btn btn-primary no-print';
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> Bestelling PDF`;
        btn.onclick   = () => bestellingPDF();
        wf.appendChild(btn);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });

})();
