/* ══════════════════════════════════════════
   snelle-etiketten.js — Snelle Etiketten Maker
   Vrije tekst etiketten in hetzelfde 65×37mm
   formaat als de karren-etiketten. Los van de
   Excel-data: gewoon intikken en afdrukken.
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Zelfde afmetingen als etiketten.js (Fridgekar) ── */
  const LABEL_W  = 65;
  const LABEL_H  = 37;
  const MARGIN_L = 2;
  const MARGIN_T = 1;
  const GAP_X    = 5;
  const GAP_Y    = 0;
  const COLS     = 3;
  const ROWS     = 7;

  const COLOR_OPTIONS = [
    { key: 'gold',   label: 'Goud',   rgb: [184, 150, 90] },
    { key: 'blauw',  label: 'Blauw',  rgb: [26, 63, 111] },
    { key: 'groen',  label: 'Groen',  rgb: [45, 106, 79] },
    { key: 'rood',   label: 'Rood',   rgb: [139, 37, 0] },
    { key: 'paars',  label: 'Paars',  rgb: [107, 58, 125] },
    { key: 'amber',  label: 'Amber',  rgb: [139, 106, 0] },
    { key: 'grijs',  label: 'Grijs',  rgb: [90, 88, 84] },
  ];

  let items = []; // { id, lines: [line1, line2, ...], color, copies }
  let idCounter = 1;

  /* ── CSS ── */
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      #snel-etiketten-content { display: none; padding: 26px 28px; }

      .se-layout { display: grid; grid-template-columns: 380px 1fr; gap: 24px; align-items: start; }
      @media (max-width: 900px) { .se-layout { grid-template-columns: 1fr; } }

      .se-card {
        background: #fff; border: 1px solid #E8E5E0; border-radius: 14px;
        padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      }
      .se-card h3 { margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #1A1917; }

      .se-field { margin-bottom: 14px; }
      .se-field label { display: block; font-size: 11px; font-weight: 600; color: #9A9590; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
      .se-field textarea, .se-field input {
        font-family: 'Outfit', sans-serif; font-size: 14px; padding: 9px 12px;
        border: 1.5px solid #DEDAD4; border-radius: 8px; background: #fff; outline: none;
        width: 100%; box-sizing: border-box; resize: vertical;
      }
      .se-field textarea:focus, .se-field input:focus { border-color: #1A1917; }
      .se-field textarea { min-height: 84px; font-family: 'DM Mono', monospace; line-height: 1.5; }
      .se-hint { font-size: 11px; color: #9A9590; margin-top: 4px; }

      .se-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

      .se-colors { display: flex; gap: 8px; flex-wrap: wrap; }
      .se-color-dot {
        width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
        border: 2px solid transparent; transition: all 0.12s; flex-shrink: 0;
      }
      .se-color-dot.active { border-color: #1A1917; transform: scale(1.1); }

      .se-add-btn {
        width: 100%; padding: 11px; background: #1A1917; color: #fff; border: none;
        border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
        transition: opacity 0.15s; margin-top: 4px;
      }
      .se-add-btn:hover { opacity: 0.85; }

      .se-list-title { font-size: 11px; font-weight: 600; color: #9A9590; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center; }
      .se-list-clear { font-size: 11px; color: #B03A2E; cursor: pointer; text-transform: none; letter-spacing: 0; font-weight: 500; }
      .se-list-clear:hover { text-decoration: underline; }

      .se-empty { text-align: center; padding: 60px 20px; color: #9A9590; }
      .se-empty svg { margin-bottom: 12px; color: #C8C2B8; }
      .se-empty-title { font-size: 14px; font-weight: 600; color: #1A1917; margin-bottom: 4px; }
      .se-empty-sub { font-size: 12px; }

      .se-items { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
      .se-item {
        display: flex; align-items: center; gap: 12px; padding: 10px 14px;
        background: #fff; border: 1px solid #E8E5E0; border-radius: 10px;
      }
      .se-item-dot { width: 10px; height: 37px; border-radius: 3px; flex-shrink: 0; }
      .se-item-text { flex: 1; min-width: 0; font-size: 13px; line-height: 1.4; }
      .se-item-text .se-line1 { font-weight: 600; color: #1A1917; }
      .se-item-text .se-line-rest { color: #6B655E; font-size: 12px; }
      .se-item-copies { font-family: 'DM Mono', monospace; font-size: 12px; color: #9A9590; padding: 4px 9px; background: #F4F3F0; border-radius: 6px; flex-shrink: 0; }
      .se-item-del {
        width: 26px; height: 26px; border-radius: 6px; border: none; background: transparent;
        color: #C8C2B8; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        transition: all 0.12s;
      }
      .se-item-del:hover { background: #FBEAE8; color: #B03A2E; }

      .se-summary { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #6B655E; margin-bottom: 14px; }
      .se-summary b { color: #1A1917; }

      .se-pdf-btn {
        display: inline-flex; align-items: center; gap: 7px; padding: 11px 22px;
        background: #B8965A; color: #fff; border: none; border-radius: 8px;
        font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; width: 100%;
        justify-content: center;
      }
      .se-pdf-btn:hover { opacity: 0.88; }
      .se-pdf-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      @media (max-width: 768px) {
        #snel-etiketten-content { padding: 14px !important; }
        .se-card { padding: 18px; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ── UI ── */
  function injectUI() {
    const wrap = document.createElement('div');
    wrap.id = 'snel-etiketten-content';
    wrap.innerHTML = `
      <div class="se-layout">
        <div class="se-card">
          <h3>Nieuw etiket</h3>

          <div class="se-field">
            <label>Tekst op het etiket</label>
            <textarea id="se-text" placeholder="Bijv.&#10;Kip aan het spit&#10;Bereid: 13/07&#10;THT: 16/07"></textarea>
            <div class="se-hint">Elke regel op het etiket = een nieuwe regel hier. Eerste regel wordt groot getoond.</div>
          </div>

          <div class="se-row-2">
            <div class="se-field" style="margin-bottom:0">
              <label>Aantal kopieën</label>
              <input type="number" id="se-copies" min="1" value="1" step="1">
            </div>
          </div>

          <div class="se-field">
            <label>Kleur</label>
            <div class="se-colors" id="se-colors"></div>
          </div>

          <button class="se-add-btn" onclick="window._seAdd()">+ Toevoegen aan lijst</button>
        </div>

        <div>
          <div id="se-list-wrap"></div>
        </div>
      </div>`;

    const appWrap = document.getElementById('app-wrap') || document.body;
    appWrap.appendChild(wrap);

    renderColorPicker();
    renderList();

    // Enter in textarea (met Ctrl/Cmd) voegt snel toe
    document.getElementById('se-text').addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { window._seAdd(); }
    });
  }

  let selectedColor = COLOR_OPTIONS[0].key;

  function renderColorPicker() {
    const wrap = document.getElementById('se-colors');
    wrap.innerHTML = COLOR_OPTIONS.map(c => `
      <div class="se-color-dot ${c.key === selectedColor ? 'active' : ''}"
           style="background: rgb(${c.rgb.join(',')})"
           title="${c.label}"
           onclick="window._seSelectColor('${c.key}')"></div>
    `).join('');
  }

  window._seSelectColor = function (key) {
    selectedColor = key;
    renderColorPicker();
  };

  window._seAdd = function () {
    const textEl = document.getElementById('se-text');
    const copiesEl = document.getElementById('se-copies');
    const raw = textEl.value.trim();
    if (!raw) { textEl.focus(); return; }

    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 5);
    const copies = Math.max(1, parseInt(copiesEl.value, 10) || 1);

    items.push({ id: idCounter++, lines, color: selectedColor, copies });
    textEl.value = '';
    copiesEl.value = '1';
    textEl.focus();

    renderList();
  };

  window._seRemove = function (id) {
    items = items.filter(it => it.id !== id);
    renderList();
  };

  window._seClearAll = function () {
    if (!items.length) return;
    if (!confirm('Alle etiketten uit de lijst verwijderen?')) return;
    items = [];
    renderList();
  };

  function colorRgb(key) {
    const c = COLOR_OPTIONS.find(c => c.key === key);
    return c ? c.rgb : [100, 100, 100];
  }

  function renderList() {
    const wrap = document.getElementById('se-list-wrap');
    if (!items.length) {
      wrap.innerHTML = `
        <div class="se-card se-empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="7" width="18" height="10" rx="2"/><line x1="3" y1="11" x2="21" y2="11"/></svg>
          <div class="se-empty-title">Nog geen etiketten</div>
          <div class="se-empty-sub">Vul links de tekst in en klik op toevoegen.</div>
        </div>`;
      return;
    }

    const totalLabels = items.reduce((s, it) => s + it.copies, 0);
    const totalPages = Math.ceil(totalLabels / (COLS * ROWS));

    wrap.innerHTML = `
      <div class="se-card">
        <div class="se-list-title">
          <span>${items.length} soort${items.length===1?'':'en'} in lijst</span>
          <span class="se-list-clear" onclick="window._seClearAll()">Alles wissen</span>
        </div>
        <div class="se-items">
          ${items.map(it => `
            <div class="se-item">
              <div class="se-item-dot" style="background: rgb(${colorRgb(it.color).join(',')})"></div>
              <div class="se-item-text">
                <div class="se-line1">${escapeHtml(it.lines[0] || '')}</div>
                ${it.lines.slice(1).map(l => `<div class="se-line-rest">${escapeHtml(l)}</div>`).join('')}
              </div>
              <div class="se-item-copies">${it.copies}×</div>
              <button class="se-item-del" onclick="window._seRemove(${it.id})" title="Verwijderen">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          `).join('')}
        </div>

        <div class="se-summary">
          <span><b>${totalLabels}</b> etiket${totalLabels===1?'':'ten'}</span>
          <span>·</span>
          <span><b>${totalPages}</b> pagina${totalPages===1?'':"'s"} A4</span>
        </div>

        <button class="se-pdf-btn" id="se-pdf-btn" onclick="window._seGeneratePDF()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          PDF genereren &amp; afdrukken
        </button>
      </div>`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ══════════════════════════════
     PDF GENERATIE via jsPDF
     (zelfde grid als etiketten.js)
     ══════════════════════════════ */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  window._seGeneratePDF = async function () {
    if (!items.length) return;
    const btn = document.getElementById('se-pdf-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'PDF genereren…'; }

    try {
      if (!window.jspdf) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Expandeer naar individuele labels o.b.v. copies
      const labels = [];
      items.forEach(it => {
        for (let k = 0; k < it.copies; k++) labels.push(it);
      });

      const perPage = COLS * ROWS;
      labels.forEach((label, li) => {
        const pos = li % perPage;
        if (pos === 0 && li > 0) doc.addPage();
        const col = pos % COLS;
        const row = Math.floor(pos / COLS);
        const x = MARGIN_L + col * (LABEL_W + GAP_X);
        const y = MARGIN_T + row * (LABEL_H + GAP_Y);
        drawLabel(doc, x, y, label);
      });

      const stamp = new Date().toISOString().slice(0,10);
      doc.save(`HVW_Snelle-Etiketten_${stamp}.pdf`);
    } catch (err) {
      alert('Fout bij PDF generatie: ' + err.message);
      console.error(err);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> PDF genereren & afdrukken`;
      }
    }
  };

  function drawLabel(doc, x, y, label) {
    const w = LABEL_W, h = LABEL_H, pad = 3;

    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, w, h, 'F');

    const rgbColor = colorRgb(label.color);
    doc.setFillColor(...rgbColor);
    doc.rect(x, y, 5, h, 'F');

    const tx = x + 5 + pad;
    const tw = w - 4 - pad - pad;

    const lines = label.lines.length ? label.lines : [''];

    // Eerste regel: groot, vet
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(28, 28, 26);
    const firstWrapped = doc.splitTextToSize(lines[0], tw);
    let cursorY = y + pad + 8;
    doc.text(firstWrapped[0] || '', tx, cursorY);
    if (firstWrapped[1]) {
      cursorY += 6.5;
      doc.text(firstWrapped[1], tx, cursorY);
    }

    // Overige regels: kleiner, grijzig, onder elkaar
    cursorY += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(90, 87, 83);
    for (let i = 1; i < lines.length && cursorY < y + h - pad; i++) {
      const wrapped = doc.splitTextToSize(lines[i], tw);
      doc.text(wrapped[0] || '', tx, cursorY);
      cursorY += 5.5;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectCSS();
    injectUI();
  });

})();
