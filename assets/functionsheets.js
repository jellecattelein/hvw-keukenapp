/* ══════════════════════════════════════════
   functionsheets.js — Functionsheets Boekje
   Upload de wekelijkse functionsheet-PDF, krijg
   een afdrukklaar boekje terug: voorpagina met
   week + periode, witte scheidingspagina per
   feest, en notitiepagina's achteraan.
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  const MAAND_NL = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
  const DAG_NL = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];

  const LOC_LABELS = { TRA:'Traiteur', MAE:'Maelstede', HVW:'Huis van Wonterghem', BIE:'Bierkasteel', AFH:'Afhaal' };
  const LOC_COLORS = {
    TRA: [0.10, 0.25, 0.44], MAE: [0.18, 0.42, 0.31],
    HVW: [0.55, 0.14, 0.00], BIE: [0.42, 0.23, 0.49], AFH: [0.55, 0.42, 0.00]
  };
  const GOLD = [0.722, 0.588, 0.353];
  const BLACK = [0.067, 0.067, 0.063];
  const BORDER = [0.910, 0.898, 0.878];
  const TEXT_FAINT = [0.604, 0.584, 0.564];

  let lastFile = null;
  let libsLoaded = false;

  /* ── CSS ── */
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      #functionsheets-content { display: none; padding: 26px 28px; }

      .fs-card {
        background: #fff; border: 1px solid #E8E5E0; border-radius: 14px;
        padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); max-width: 640px;
      }
      .fs-dropzone {
        border: 2px dashed #DEDAD4; border-radius: 12px; padding: 40px 24px;
        text-align: center; cursor: pointer; transition: all 0.15s; background: #FAF9F7;
      }
      .fs-dropzone:hover, .fs-dropzone.drag { border-color: #B8965A; background: #FDF9F2; }
      .fs-dropzone svg { color: #C8C2B8; margin-bottom: 12px; }
      .fs-dropzone-title { font-size: 14px; font-weight: 600; color: #1A1917; margin-bottom: 4px; }
      .fs-dropzone-sub { font-size: 12px; color: #9A9590; }

      .fs-file-info {
        display: flex; align-items: center; gap: 12px; padding: 14px 16px;
        background: #F4F3F0; border: 1px solid #E8E5E0; border-radius: 10px; margin-top: 16px;
      }
      .fs-file-icon { width: 36px; height: 36px; border-radius: 8px; background: #B8965A; color: #fff;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 14px; font-weight: 600; }
      .fs-file-name { font-weight: 600; font-size: 13px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .fs-file-meta { font-size: 11px; color: #9A9590; }

      .fs-options { margin-top: 20px; display: flex; flex-direction: column; gap: 14px; }
      .fs-field label { display: block; font-size: 11px; font-weight: 600; color: #9A9590; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
      .fs-field select, .fs-field input {
        font-family: 'Outfit', sans-serif; font-size: 14px; padding: 9px 12px;
        border: 1.5px solid #DEDAD4; border-radius: 8px; background: #fff; outline: none; width: 100%;
      }
      .fs-field select:focus, .fs-field input:focus { border-color: #1A1917; }

      .fs-preview-list { margin-top: 20px; }
      .fs-preview-title { font-size: 11px; font-weight: 600; color: #9A9590; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 10px; }
      .fs-ev-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #F0EDE8; font-size: 13px; }
      .fs-ev-row:last-child { border-bottom: none; }
      .fs-ev-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
      .fs-ev-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .fs-ev-meta { font-family: 'DM Mono', monospace; font-size: 11px; color: #9A9590; }

      .fs-actions { margin-top: 24px; display: flex; gap: 10px; }
      .fs-status { margin-top: 14px; font-size: 12px; color: #9A9590; display: flex; align-items: center; gap: 8px; }
      .fs-spinner { width: 14px; height: 14px; border: 2px solid #E8E5E0; border-top-color: #B8965A; border-radius: 50%; animation: fsspin 0.7s linear infinite; }
      @keyframes fsspin { to { transform: rotate(360deg); } }

      @media (max-width: 768px) {
        #functionsheets-content { padding: 14px !important; }
        .fs-card { padding: 20px; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ── UI ── */
  function injectUI() {
    const wrap = document.createElement('div');
    wrap.id = 'functionsheets-content';
    wrap.innerHTML = `
      <div class="fs-card">
        <div class="fs-dropzone" id="fs-dropzone" onclick="document.getElementById('fs-file-input').click()">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <div class="fs-dropzone-title">Sleep de functionsheet-PDF hierheen</div>
          <div class="fs-dropzone-sub">of klik om te bladeren</div>
          <input type="file" id="fs-file-input" accept="application/pdf" style="display:none" onchange="window._fsHandleFile(this.files[0])">
        </div>

        <div id="fs-file-info-wrap" style="display:none"></div>
        <div id="fs-preview-wrap" style="display:none"></div>

        <div id="fs-options-wrap" style="display:none" class="fs-options">
          <div class="fs-field">
            <label>Aantal notitiepagina's achteraan</label>
            <select id="fs-notes-count">
              <option value="1" selected>1 pagina</option>
              <option value="2">2 pagina's</option>
              <option value="0">Geen</option>
            </select>
          </div>
        </div>

        <div class="fs-actions" id="fs-actions-wrap" style="display:none">
          <button class="btn btn-gold" onclick="window._fsGenerate()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Genereer boekje
          </button>
          <button class="btn" onclick="window._fsReset()">Andere PDF kiezen</button>
        </div>

        <div class="fs-status" id="fs-status" style="display:none"></div>
      </div>`;

    const appWrap = document.getElementById('app-wrap') || document.body;
    appWrap.appendChild(wrap);

    // Drag & drop
    const dz = document.getElementById('fs-dropzone');
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); dz.classList.remove('drag');
      const f = e.dataTransfer.files[0];
      if (f) window._fsHandleFile(f);
    });
  }

  /* ── Libs lazy-load (pdf-lib + pdf.js) ── */
  function loadLibs() {
    return new Promise((resolve, reject) => {
      if (libsLoaded) return resolve();
      let toLoad = 2;
      const done = () => { if (--toLoad === 0) { libsLoaded = true; resolve(); } };
      const s1 = document.createElement('script');
      s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
      s1.onload = done; s1.onerror = reject;
      document.head.appendChild(s1);
      const s2 = document.createElement('script');
      s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      s2.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        done();
      };
      s2.onerror = reject;
      document.head.appendChild(s2);
    });
  }

  function setStatus(msg, spinning) {
    const el = document.getElementById('fs-status');
    if (!el) return;
    if (!msg) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = (spinning ? '<span class="fs-spinner"></span>' : '') + `<span>${msg}</span>`;
  }

  /* ── PDF tekst per pagina extraheren ── */
  async function extractPagesText(arrayBuffer) {
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(it => it.str).join(' ');
      pages.push(text);
    }
    return pages;
  }

  /* ── Events detecteren (elke pagina die met 'Functionsheet' start) ── */
  function analyzeEvents(pagesText) {
    const events = [];
    pagesText.forEach((text, i) => {
      const trimmed = text.trim();
      if (trimmed.startsWith('Functionsheet')) {
        const affM = text.match(/Affichage:\s*(.+?)\s+Functietype:/);
        const locM = text.match(/Locatie\s+([A-Z]+)/);
        const datM = text.match(/Datum:\s*(\w+)\s+(\d{1,2})\s+(\w+)\s+(\d{4})/);
        events.push({
          startPage: i,
          affichage: affM ? affM[1].trim() : '(onbekend)',
          loc: locM ? locM[1] : '?',
          dagnum: datM ? parseInt(datM[2], 10) : null,
          maandNaam: datM ? datM[3] : null,
          jaar: datM ? parseInt(datM[4], 10) : null,
        });
      }
    });
    events.forEach((e, idx) => {
      e.endPage = (idx + 1 < events.length) ? events[idx + 1].startPage - 1 : pagesText.length - 1;
      if (e.maandNaam) {
        e.month = MAAND_NL.indexOf(e.maandNaam.toLowerCase());
        e.dateObj = (e.month >= 0 && e.jaar && e.dagnum) ? new Date(e.jaar, e.month, e.dagnum) : null;
      }
    });
    return events;
  }

  function isoWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
    const weekNum = 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    return weekNum;
  }

  function fmtDateLong(d) {
    return `${DAG_NL[d.getDay()]} ${d.getDate()} ${MAAND_NL[d.getMonth()]} ${d.getFullYear()}`;
  }
  function fmtDateShort(d) {
    return `${DAG_NL[d.getDay()].substring(0,2).replace(/^\w/,c=>c.toUpperCase())} ${d.getDate()}/${d.getMonth()+1}`;
  }

  /* ── State ── */
  let currentEvents = [];

  window._fsHandleFile = async function (file) {
    if (!file || file.type !== 'application/pdf') { alert('Kies een PDF-bestand.'); return; }
    lastFile = file;

    document.getElementById('fs-dropzone').style.display = 'none';
    setStatus('PDF wordt geanalyseerd…', true);

    try {
      await loadLibs();
      const buf = await file.arrayBuffer();
      lastFile._buf = buf.slice(0); // bewaar kopie voor later gebruik
      const pagesText = await extractPagesText(buf.slice(0));
      currentEvents = analyzeEvents(pagesText);

      if (!currentEvents.length) {
        setStatus('Geen functionsheets herkend in dit bestand. Controleer of dit de juiste PDF-export is.', false);
        document.getElementById('fs-dropzone').style.display = 'block';
        return;
      }

      renderFileInfo(file, pagesText.length);
      renderPreview(currentEvents);
      document.getElementById('fs-options-wrap').style.display = 'flex';
      document.getElementById('fs-actions-wrap').style.display = 'flex';
      setStatus('', false);
    } catch (err) {
      console.error(err);
      setStatus('Er ging iets mis bij het inlezen van de PDF: ' + err.message, false);
      document.getElementById('fs-dropzone').style.display = 'block';
    }
  };

  function renderFileInfo(file, nPages) {
    const wrap = document.getElementById('fs-file-info-wrap');
    wrap.style.display = 'block';
    wrap.innerHTML = `
      <div class="fs-file-info">
        <div class="fs-file-icon">PDF</div>
        <div style="flex:1;overflow:hidden">
          <div class="fs-file-name">${file.name}</div>
          <div class="fs-file-meta">${nPages} pagina's · ${(file.size/1024).toFixed(0)} KB</div>
        </div>
      </div>`;
  }

  function renderPreview(events) {
    const wrap = document.getElementById('fs-preview-wrap');
    wrap.style.display = 'block';
    wrap.innerHTML = `
      <div class="fs-preview-list">
        <div class="fs-preview-title">${events.length} feest${events.length===1?'':'en'} herkend</div>
        ${events.map(e => {
          const col = LOC_COLORS[e.loc] || GOLD;
          const rgbCss = `rgb(${col.map(v=>Math.round(v*255)).join(',')})`;
          const dateStr = e.dateObj ? fmtDateShort(e.dateObj) : '?';
          return `<div class="fs-ev-row">
            <span class="fs-ev-dot" style="background:${rgbCss}"></span>
            <span class="fs-ev-name">${e.affichage}</span>
            <span class="fs-ev-meta">${dateStr} · ${e.loc}</span>
          </div>`;
        }).join('')}
      </div>`;
  }

  window._fsReset = function () {
    lastFile = null;
    currentEvents = [];
    document.getElementById('fs-dropzone').style.display = 'block';
    document.getElementById('fs-file-info-wrap').style.display = 'none';
    document.getElementById('fs-preview-wrap').style.display = 'none';
    document.getElementById('fs-options-wrap').style.display = 'none';
    document.getElementById('fs-actions-wrap').style.display = 'none';
    document.getElementById('fs-file-input').value = '';
    setStatus('', false);
  };

  /* ══════════════════════════════════════════
     PDF GENERATIE met pdf-lib
     ══════════════════════════════════════════ */
  window._fsGenerate = async function () {
    if (!lastFile || !currentEvents.length) return;
    setStatus('Boekje wordt samengesteld…', true);

    try {
      const { PDFDocument, rgb, StandardFonts } = window.PDFLib;

      const srcBytes = lastFile._buf ? lastFile._buf : await lastFile.arrayBuffer();
      const srcDoc = await PDFDocument.load(srcBytes);
      const outDoc = await PDFDocument.create();

      const fontRegular = await outDoc.embedFont(StandardFonts.Helvetica);
      const fontBold = await outDoc.embedFont(StandardFonts.HelveticaBold);

      const dates = currentEvents.filter(e => e.dateObj).map(e => e.dateObj);
      const minD = new Date(Math.min(...dates));
      const maxD = new Date(Math.max(...dates));
      const weekNrs = [...new Set(dates.map(isoWeekNumber))].sort((a,b)=>a-b);
      const weekLabel = weekNrs.length === 1 ? `Week ${weekNrs[0]}` : `Weken ${weekNrs[0]}\u2013${weekNrs[weekNrs.length-1]}`;
      const periodeLabel = (minD.getTime() === maxD.getTime())
        ? fmtDateLong(minD)
        : `${fmtDateLong(minD)} \u2014 ${fmtDateLong(maxD)}`;

      const PAGE_W = 595.28, PAGE_H = 841.89; // A4 in punten

      function drawNotesPage(page, titleFont, title) {
        page.drawRectangle({ x:0, y:0, width:PAGE_W, height:PAGE_H, color: rgb(1,1,1) });
        page.drawText(title, { x:50, y:PAGE_H-60, size:16, font:titleFont, color: rgb(...GOLD) });
        page.drawLine({ start:{x:50,y:PAGE_H-72}, end:{x:PAGE_W-50,y:PAGE_H-72}, thickness:1, color: rgb(...GOLD) });
        let ny = PAGE_H - 110;
        while (ny > 60) {
          page.drawLine({ start:{x:50,y:ny}, end:{x:PAGE_W-50,y:ny}, thickness:0.5, color: rgb(...BORDER) });
          ny -= 28;
        }
      }

      /* ── Voorpagina (wit) ── */
      const cover = outDoc.addPage([PAGE_W, PAGE_H]);
      cover.drawRectangle({ x:0, y:0, width:PAGE_W, height:PAGE_H, color: rgb(1,1,1) });

      cover.drawText('HUIS VAN WONTERGHEM', {
        x: centerX('HUIS VAN WONTERGHEM', fontBold, 15, PAGE_W), y: PAGE_H - 260,
        size: 15, font: fontBold, color: rgb(...BLACK)
      });
      const subTxt = 'M E E S T E R S   I N   M O O I E   M O M E N T E N';
      cover.drawText(subTxt, {
        x: centerX(subTxt, fontRegular, 9, PAGE_W), y: PAGE_H - 275,
        size: 9, font: fontRegular, color: rgb(...GOLD)
      });

      const label1 = 'F U N C T I O N S H E E T S';
      cover.drawText(label1, {
        x: centerX(label1, fontRegular, 13, PAGE_W), y: PAGE_H - 340,
        size: 13, font: fontRegular, color: rgb(...GOLD)
      });
      cover.drawText(weekLabel, {
        x: centerX(weekLabel, fontBold, 30, PAGE_W), y: PAGE_H - 380,
        size: 30, font: fontBold, color: rgb(...BLACK)
      });
      cover.drawText(periodeLabel, {
        x: centerX(periodeLabel, fontRegular, 15, PAGE_W), y: PAGE_H - 410,
        size: 15, font: fontRegular, color: rgb(0.42, 0.40, 0.37)
      });
      cover.drawLine({ start:{x:PAGE_W/2-80,y:PAGE_H-440}, end:{x:PAGE_W/2+80,y:PAGE_H-440}, thickness:1, color: rgb(...GOLD) });

      let y = PAGE_H - 480;
      cover.drawText('AANTAL FEESTEN', { x:70, y, size:10, font:fontBold, color: rgb(...GOLD) });
      const countTxt = String(currentEvents.length);
      cover.drawText(countTxt, { x: PAGE_W - 70 - fontBold.widthOfTextAtSize(countTxt,10), y, size:10, font:fontBold, color: rgb(...GOLD) });
      y -= 25;
      cover.drawLine({ start:{x:70,y:y+8}, end:{x:PAGE_W-70,y:y+8}, thickness:1, color: rgb(...BORDER) });
      y -= 12;

      for (const e of currentEvents) {
        const col = LOC_COLORS[e.loc] || GOLD;
        cover.drawRectangle({ x:70, y:y-3, width:4, height:12, color: rgb(...col) });
        const naam = e.affichage.length > 55 ? e.affichage.slice(0,55) : e.affichage;
        cover.drawText(naam, { x:80, y, size:10, font:fontBold, color: rgb(...BLACK) });

        const dateStr = e.dateObj ? fmtDateShort(e.dateObj) : '?';
        const metaTxt = `${dateStr}  \u00b7  ${e.loc}`;
        cover.drawText(metaTxt, { x: PAGE_W - 70 - fontRegular.widthOfTextAtSize(metaTxt,9), y, size:9, font:fontRegular, color: rgb(...TEXT_FAINT) });
        y -= 20;
        if (y < 100) break;
      }

      const footTxt = `Huis van Wonterghem  \u00b7  Gegenereerd op ${fmtToday()}`;
      cover.drawText(footTxt, { x: centerX(footTxt, fontRegular, 8, PAGE_W), y: 40, size:8, font:fontRegular, color: rgb(...TEXT_FAINT) });

      /* ── Per feest: witte scheidingspagina + originele pagina's ──
         Elke scheidingspagina moet op een RECHTERpagina (oneven paginanr.) vallen.
         Is de huidige positie even (linkerpagina), voeg dan eerst een
         notitiepagina toe om naar rechts op te schuiven — zo blijft de
         "lege" pagina toch bruikbaar in plaats van kaal wit. */
      for (const e of currentEvents) {
        if ((outDoc.getPageCount() + 1) % 2 === 0) {
          drawNotesPage(outDoc.addPage([PAGE_W, PAGE_H]), fontBold, 'Notities');
        }

        const div = outDoc.addPage([PAGE_W, PAGE_H]);
        div.drawRectangle({ x:0, y:0, width:PAGE_W, height:PAGE_H, color: rgb(1,1,1) });
        const col = LOC_COLORS[e.loc] || GOLD;
        div.drawRectangle({ x:0, y:PAGE_H/2 - 1, width:PAGE_W, height:2, color: rgb(...col) });

        const locLabel = LOC_LABELS[e.loc] || e.loc;
        div.drawText(locLabel, { x: centerX(locLabel, fontRegular, 10, PAGE_W), y: PAGE_H/2 + 20, size:10, font:fontRegular, color: rgb(0.87,0.85,0.83) });

        if (e.dateObj) {
          const dTxt = fmtDateLong(e.dateObj);
          div.drawText(dTxt, { x: centerX(dTxt, fontBold, 14, PAGE_W), y: PAGE_H/2 - 20, size:14, font:fontBold, color: rgb(0.72,0.70,0.66) });
        }

        const copiedPages = await outDoc.copyPages(srcDoc, range(e.startPage, e.endPage));
        copiedPages.forEach(p => outDoc.addPage(p));
      }

      /* ── Notitiepagina's ── */
      const notesCount = parseInt(document.getElementById('fs-notes-count').value, 10) || 0;
      for (let n = 0; n < notesCount; n++) {
        drawNotesPage(outDoc.addPage([PAGE_W, PAGE_H]), fontBold, 'Notities');
      }

      setStatus('PDF wordt gedownload…', true);
      const bytes = await outDoc.save();
      downloadBytes(bytes, buildFilename(weekLabel));
      setStatus('Boekje gedownload — klaar om te printen.', false);
    } catch (err) {
      console.error(err);
      setStatus('Er ging iets mis bij het genereren: ' + err.message, false);
    }
  };

  function range(start, end) {
    const arr = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }

  function centerX(text, font, size, pageW) {
    return (pageW - font.widthOfTextAtSize(text, size)) / 2;
  }

  function fmtToday() {
    const d = new Date();
    return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`;
  }

  function buildFilename(weekLabel) {
    const slug = weekLabel.replace(/\s+/g, '_');
    return `HVW_Functionsheets_${slug}.pdf`;
  }

  function downloadBytes(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectCSS();
    injectUI();
  });

})();
