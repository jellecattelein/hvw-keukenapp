/* ══════════════════════════════════════════
   weekmap.js — Weekmap Voorpagina's
   Genereert tabblad-voorpagina's (bv. Groenten,
   Sauzen, Recepten, Broodjes, Bakker) in dezelfde
   stijl als de receptenkaarten (recepten.js), om
   vooraan elke sectie van de wekelijkse etikettenmap
   te steken. Secties zijn zelf te herschikken (op/neer),
   bij te vullen en te verwijderen — bewaard per toestel.
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  const STORAGE_KEY = 'hvw-weekmap-secties';

  // Standaard startlijst — enkel gebruikt als er nog niets bewaard is
  const DEFAULT_SECTIES = [
    { naam: 'Groenten', sub: 'seizoensgroenten & bijgerechten' },
    { naam: 'Sauzen',   sub: 'basis- en begeleidende sauzen' },
    { naam: 'Recepten', sub: 'bereidingen van de keuken' },
    { naam: 'Broodjes', sub: 'dagverse broodjeslijst' },
    { naam: 'Bakker',   sub: 'bestelformulier bakker' },
  ];

  let secties = []; // [{ id, naam, sub }]
  let idCounter = 1;

  function loadSecties() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (Array.isArray(raw) && raw.length) {
        secties = raw;
        idCounter = Math.max(...raw.map(s => s.id || 0)) + 1;
        return;
      }
    } catch (e) {}
    secties = DEFAULT_SECTIES.map(s => ({ id: idCounter++, ...s }));
  }

  function saveSecties() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(secties)); } catch (e) {}
  }

  function isoWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  }

  function defaultWeekLabel() {
    const today = new Date();
    return `Week ${isoWeekNumber(today)}`;
  }

  /* ── CSS ── */
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      #weekmap-content { display: none; padding: 26px 28px; }

      .wm-card {
        background: #fff; border: 1px solid #E8E5E0; border-radius: 14px;
        padding: 28px 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        max-width: 620px;
      }
      .wm-card h3 { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #1A1917; }
      .wm-sub { font-size: 12px; color: #9A9590; margin-bottom: 22px; }

      .wm-field { margin-bottom: 18px; }
      .wm-field label { display: block; font-size: 11px; font-weight: 600; color: #9A9590; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
      .wm-field input {
        font-family: 'Outfit', sans-serif; font-size: 14px; padding: 9px 12px;
        border: 1.5px solid #DEDAD4; border-radius: 8px; background: #fff; outline: none;
        width: 100%; box-sizing: border-box;
      }
      .wm-field input:focus { border-color: #1A1917; }

      .wm-list-title { font-size: 11px; font-weight: 600; color: #9A9590; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 10px; }

      .wm-secties {
        display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px;
      }
      .wm-sectie-row {
        display: flex; align-items: center; gap: 10px; padding: 8px 10px;
        background: #F4F3F0; border: 1px solid #E8E5E0; border-radius: 8px;
      }
      .wm-sectie-nr {
        width: 20px; height: 20px; border-radius: 50%; background: #1A1917; color: #fff;
        font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center;
        flex-shrink: 0; font-family: 'DM Mono', monospace;
      }
      .wm-sectie-fields { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
      .wm-sectie-fields input {
        font-family: 'Outfit', sans-serif; border: 1px solid transparent; border-radius: 6px;
        background: transparent; outline: none; padding: 2px 4px; width: 100%; box-sizing: border-box;
        transition: border-color 0.12s, background 0.12s;
      }
      .wm-sectie-fields input:hover { background: #fff; border-color: #E8E5E0; }
      .wm-sectie-fields input:focus { background: #fff; border-color: #1A1917; }
      .wm-sectie-naam-input { font-size: 13px; font-weight: 600; color: #1A1917; }
      .wm-sectie-sub-input { font-size: 11px; color: #9A9590; }

      .wm-sectie-actions { display: flex; gap: 2px; flex-shrink: 0; }
      .wm-btn-icon {
        width: 24px; height: 24px; border-radius: 6px; border: none; background: transparent;
        color: #9A9590; cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: all 0.12s;
      }
      .wm-btn-icon:hover:not(:disabled) { background: #E8E5E0; color: #1A1917; }
      .wm-btn-icon:disabled { opacity: 0.25; cursor: not-allowed; }
      .wm-btn-icon.wm-danger:hover:not(:disabled) { background: #FBEAE8; color: #B03A2E; }

      .wm-add-btn {
        width: 100%; padding: 10px; background: transparent;
        border: 1.5px dashed #DEDAD4; border-radius: 8px;
        color: #9A9590; font-size: 13px; font-weight: 600; cursor: pointer;
        transition: all 0.15s; margin-bottom: 20px;
      }
      .wm-add-btn:hover { background: #F4F3F0; color: #1A1917; border-color: #1A1917; }

      .wm-pdf-btn {
        display: inline-flex; align-items: center; gap: 7px; padding: 11px 22px;
        background: #B8965A; color: #fff; border: none; border-radius: 8px;
        font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; width: 100%;
        justify-content: center;
      }
      .wm-pdf-btn:hover { opacity: 0.88; }
      .wm-pdf-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      @media (max-width: 768px) {
        #weekmap-content { padding: 14px !important; }
        .wm-card { padding: 18px; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ── UI ── */
  function injectUI() {
    const wrap = document.createElement('div');
    wrap.id = 'weekmap-content';
    wrap.innerHTML = `
      <div class="wm-card">
        <h3>Weekmap Voorpagina's</h3>
        <div class="wm-sub">Tabblad-voorpagina's om vooraan elke sectie van de wekelijkse etikettenmap te steken — in dezelfde stijl als de receptenkaarten. Volgorde en secties zijn vrij aan te passen.</div>

        <div class="wm-field">
          <label>Weeklabel</label>
          <input type="text" id="wm-week" value="${defaultWeekLabel()}" placeholder="bv. Week 35">
        </div>

        <div class="wm-list-title">Secties (volgorde = paginavolgorde in de PDF)</div>
        <div class="wm-secties" id="wm-secties-wrap"></div>
        <button class="wm-add-btn" onclick="window._wmAddSectie()">+ Voorpagina toevoegen</button>

        <button class="wm-pdf-btn" id="wm-pdf-btn" onclick="window._wmGeneratePDF()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          PDF genereren &amp; afdrukken
        </button>
      </div>`;

    const appWrap = document.getElementById('app-wrap') || document.body;
    appWrap.appendChild(wrap);

    loadSecties();
    renderSecties();
  }

  function renderSecties() {
    const wrap = document.getElementById('wm-secties-wrap');
    if (!wrap) return;
    wrap.innerHTML = secties.map((s, i) => `
      <div class="wm-sectie-row">
        <div class="wm-sectie-nr">${i + 1}</div>
        <div class="wm-sectie-fields">
          <input class="wm-sectie-naam-input" type="text" value="${escAttr(s.naam)}" placeholder="Naam"
                 onchange="window._wmUpdateSectie(${s.id}, 'naam', this.value)">
          <input class="wm-sectie-sub-input" type="text" value="${escAttr(s.sub)}" placeholder="Ondertitel (optioneel)"
                 onchange="window._wmUpdateSectie(${s.id}, 'sub', this.value)">
        </div>
        <div class="wm-sectie-actions">
          <button class="wm-btn-icon" onclick="window._wmMove(${s.id}, -1)" ${i === 0 ? 'disabled' : ''} title="Naar boven">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button class="wm-btn-icon" onclick="window._wmMove(${s.id}, 1)" ${i === secties.length - 1 ? 'disabled' : ''} title="Naar beneden">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button class="wm-btn-icon wm-danger" onclick="window._wmRemoveSectie(${s.id})" title="Verwijderen">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>`).join('');
  }

  function escAttr(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  }

  window._wmUpdateSectie = function (id, field, value) {
    const s = secties.find(s => s.id === id);
    if (!s) return;
    s[field] = value;
    saveSecties();
  };

  window._wmMove = function (id, dir) {
    const i = secties.findIndex(s => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= secties.length) return;
    [secties[i], secties[j]] = [secties[j], secties[i]];
    saveSecties();
    renderSecties();
  };

  window._wmRemoveSectie = function (id) {
    if (!confirm('Deze voorpagina verwijderen?')) return;
    secties = secties.filter(s => s.id !== id);
    saveSecties();
    renderSecties();
  };

  window._wmAddSectie = function () {
    secties.push({ id: idCounter++, naam: '', sub: '' });
    saveSecties();
    renderSecties();
    // Focus meteen het nieuwe naamveld
    const rows = document.querySelectorAll('#wm-secties-wrap .wm-sectie-naam-input');
    const last = rows[rows.length - 1];
    if (last) last.focus();
  };

  /* ══════════════════════════════
     PDF GENERATIE via jsPDF
     Zelfde editoriale stijl als de receptenkaarten
     (recepten.js → maakReceptPDF): crème achtergrond,
     gecentreerde Times-typografie, gespatieerde
     kleine kapitalen, dunne haarlijnen.
     ══════════════════════════════ */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Simuleert letter-spacing voor kleine kapitalen, zoals in recepten.js
  function spaced(txt) {
    return txt.toUpperCase().split('').join(' ');
  }

  window._wmGeneratePDF = async function () {
    const geldigeSecties = secties.filter(s => (s.naam || '').trim());
    if (!geldigeSecties.length) { alert('Vul minstens één sectienaam in.'); return; }

    const btn = document.getElementById('wm-pdf-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'PDF genereren…'; }

    try {
      if (!window.jspdf) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = 210, H = 297, cx = W / 2;

      const weekLabel = (document.getElementById('wm-week').value || defaultWeekLabel()).trim();

      const INK   = [35, 33, 28];
      const SAND  = [154, 144, 129];
      const HAIR  = [201, 193, 176];
      const CREAM = [251, 250, 246];

      geldigeSecties.forEach((sectie, i) => {
        if (i > 0) doc.addPage();
        doc.setFillColor(...CREAM);
        doc.rect(0, 0, W, H, 'F');

        let y = 30;

        // Restaurantnaam
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...SAND);
        doc.text(spaced('Huis van Wonterghem').replace(/  +/g, '  '), cx, y, { align: 'center' });
        y += 7;

        // Streepje
        doc.setDrawColor(...HAIR);
        doc.setLineWidth(0.3);
        doc.line(cx - 10, y, cx + 10, y);

        // Grote sectienaam — gecentreerd op de pagina
        y = H / 2 - 20;
        doc.setTextColor(...INK);
        const naamFs = sectie.naam.length > 14 ? 38 : sectie.naam.length > 9 ? 46 : 52;
        doc.setFontSize(naamFs);
        doc.setFont('times', 'bold');
        doc.text(sectie.naam, cx, y, { align: 'center' });
        y += 12;

        // Streepje
        doc.setDrawColor(...HAIR);
        doc.setLineWidth(0.3);
        doc.line(cx - 14, y, cx + 14, y);
        y += 10;

        // Ondertitel cursief (optioneel)
        if ((sectie.sub || '').trim()) {
          doc.setFontSize(11.5);
          doc.setFont('times', 'italic');
          doc.setTextColor(...SAND);
          doc.text(sectie.sub, cx, y, { align: 'center' });
        }

        // Footer — dunne lijn + weeklabel cursief
        const footerY = 265;
        doc.setDrawColor(...HAIR);
        doc.setLineWidth(0.25);
        doc.line(30, footerY, W - 30, footerY);
        doc.setFontSize(9);
        doc.setFont('times', 'italic');
        doc.setTextColor(...SAND);
        doc.text(weekLabel.toLowerCase(), cx, footerY + 6, { align: 'center' });
      });

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`HVW_Weekmap-Voorpaginas_${stamp}.pdf`);
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

  document.addEventListener('DOMContentLoaded', () => {
    injectCSS();
    injectUI();
  });

})();
