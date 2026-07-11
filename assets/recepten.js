/* ══════════════════════════════════════════
   recepten.js — Recepten module met Google Drive
   Map ID: 1bnE72nIYqqtAftUytuj3qyS_Vx-NCBij
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  const DRIVE_FOLDER_ID = '1bnE72nIYqqtAftUytuj3qyS_Vx-NCBij';
  const DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1bnE72nIYqqtAftUytuj3qyS_Vx-NCBij';

  /* ── State ── */
  let recepten = [];
  let filterQ  = '';
  let currentRecept = null;
  let driveToken = null;

  /* ══════════════════════════════
     GOOGLE DRIVE API
     ══════════════════════════════ */

  async function getDriveToken() {
    // Gebruik gapi of oauth2 token van de ingelogde gebruiker
    // Token wordt opgehaald via de Anthropic connector proxy
    return null; // wordt ingesteld via setDriveToken
  }

  async function driveRequest(url, options = {}) {
    const token = localStorage.getItem('hvw-drive-token');
    if (!token) throw new Error('Geen Drive toegang. Koppel Google Drive in de instellingen.');
    const res = await fetch(url, {
      ...options,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    if (!res.ok) throw new Error(`Drive fout: ${res.status}`);
    return res.json();
  }

  async function saveReceptToDrive(recept) {
    // Lokaal opslaan — export naar Drive via knop
    saveReceptLocaal(recept);
  }

  async function loadReceptenFromDrive() {
    loadReceptenLocaal();
  }

  async function deleteReceptFromDrive(receptId) {
    recepten = recepten.filter(r => r.id !== receptId);
    saveReceptenLocaal();
  }

  /* ── Exporteer alle recepten als JSON backup ── */
  window.exporteerJSON = function() {
    if (!recepten.length) { alert('Geen recepten om te exporteren.'); return; }
    const data = {
      versie: 1,
      exportDatum: new Date().toISOString(),
      aantalRecepten: recepten.length,
      recepten: recepten
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/octet-stream' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `HVW_Recepten_${new Date().toLocaleDateString('nl-BE').replace(/\//g,'-')}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
  };

  /* ── Exporteer alle recepten als PDF ── */
  /* ── Fine-dining PDF — Cormorant Garamond stijl ── */
  async function maakReceptPDF(r) {
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
    const W = 210; const H = 297;
    const cx = W / 2; // center x

    // Kleuren
    const INK    = [35, 33, 28];
    const SAND   = [154, 144, 129];
    const HAIR   = [201, 193, 176];
    const CREAM  = [251, 250, 246];

    // Achtergrond crème
    doc.setFillColor(...CREAM);
    doc.rect(0, 0, W, H, 'F');

    let y = 28; // bovenmarge ~28mm

    // 1. Restaurantnaam — klein, uppercase, gespatieerd
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SAND);
    // Simuleer letter-spacing door tekst met spaties
    const restNaam = 'H U I S  V A N  W O N T E R G H E M';
    doc.text(restNaam, cx, y, { align: 'center' });
    y += 7;

    // 2. Eerste streepje
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.3);
    doc.line(cx - 10, y, cx + 10, y);
    y += 8;

    // 3. Categorie + gang cursief
    const catGang = [r.categorie, r.ccmCode].filter(Boolean).join(' · ') ||
                    (r.porties ? `${r.porties} porties` : '');
    if (catGang) {
      doc.setFontSize(11);
      doc.setFont('times', 'italic');
      doc.setTextColor(...SAND);
      doc.text(catGang.toLowerCase(), cx, y, { align: 'center' });
      y += 14;
    } else { y += 4; }

    // 4. Gerechtnaam groot
    doc.setTextColor(...INK);
    const naam = r.naam || '';
    const naamFs = naam.length > 24 ? 28 : naam.length > 18 ? 34 : naam.length > 12 ? 40 : 48;
    doc.setFontSize(naamFs);
    doc.setFont('times', 'bold');
    const naamW = 160;
    const naamLines = doc.splitTextToSize(naam, naamW);
    naamLines.forEach(line => {
      doc.text(line, cx, y, { align: 'center' });
      y += naamFs * 0.45;
    });
    y += 8;

    // 5. Tweede streepje
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.3);
    doc.line(cx - 10, y, cx + 10, y);
    y += 14;

    // 6. Ingrediënten
    if (r.ingredienten?.length) {
      // Label
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...SAND);
      doc.text('I N G R E D I Ë N T E N', cx, y, { align: 'center' });
      y += 9;

      // Lijst gecentreerd, serif
      doc.setFont('times', 'normal');
      doc.setTextColor(...INK);
      r.ingredienten.forEach(ing => {
        if (y > 260) return; // overflow bescherming
        const fs = r.ingredienten.length > 12 ? 10 : r.ingredienten.length > 8 ? 11 : 12;
        doc.setFontSize(fs);
        doc.text(ing, cx, y, { align: 'center' });
        y += fs * 0.55 + 2.5;
      });
      y += 8;
    }

    // 7. Bereiding
    if (r.bereiding) {
      if (y > 240) { doc.addPage(); doc.setFillColor(...CREAM); doc.rect(0,0,W,H,'F'); y = 28; }

      // Label
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...SAND);
      doc.text('B E R E I D I N G', cx, y, { align: 'center' });
      y += 9;

      // Tekst cursief, gecentreerd, max 110mm breed
      doc.setFontSize(11);
      doc.setFont('times', 'italic');
      doc.setTextColor(...INK);
      const berW = 110;
      const berLines = doc.splitTextToSize(r.bereiding, berW);
      berLines.forEach(line => {
        if (y > 278) { doc.addPage(); doc.setFillColor(...CREAM); doc.rect(0,0,W,H,'F'); y = 28; }
        doc.text(line, cx, y, { align: 'center' });
        y += 6.5;
      });
      y += 6;
    }

    // 8. Footer — dunne lijn + werknaam cursief
    const footerY = 283;
    doc.setDrawColor(...HAIR);
    doc.setLineWidth(0.25);
    doc.line(30, footerY, W - 30, footerY);
    doc.setFontSize(9);
    doc.setFont('times', 'italic');
    doc.setTextColor(...SAND);
    const footerTekst = r.naam.toLowerCase();
    doc.text(footerTekst, cx, footerY + 6, { align: 'center' });

    return doc;
  }

  /* ── Download alle recepten als aparte PDFs (met vertraging) ── */
  window.exporteerNaarDrive = async function() {
    if (!recepten.length) { alert('Geen recepten om te exporteren.'); return; }

    const btn = document.querySelector('[onclick="exporteerNaarDrive()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Downloaden...'; }

    for (let i = 0; i < recepten.length; i++) {
      const r = recepten[i];
      const doc = await maakReceptPDF(r);
      const filename = `${r.naam.replace(/ +/g,'-')}.pdf`;
      doc.save(filename);
      // Kleine pauze tussen downloads zodat browser niet blokkeert
      await new Promise(res => setTimeout(res, 600));
      if (btn) btn.textContent = `Downloaden ${i+1}/${recepten.length}...`;
    }

    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Exporteer alle als PDF'; }

    const el = document.getElementById('drive-export-msg');
    if (el) {
      el.style.display = 'flex';
      el.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#2D6A4F;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>
        <span><strong>${recepten.length} PDF${recepten.length!==1?'s':''}</strong> gedownload — sleep naar
        <a href="${DRIVE_FOLDER_URL}" target="_blank" style="color:#1A3F6F;font-weight:600">HVW Recepten in Drive</a></span>`;
      setTimeout(() => { if(el) el.style.display='none'; }, 10000);
    }
  };

  /* ── Importeer JSON vanuit bestand of geplakte tekst ── */
  window.importeerVanDrive = function(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => { verwerkImportJSON(e.target.result); };
    reader.readAsText(file);
    input.value = '';
  };

  function verwerkImportJSON(tekst) {
    try {
      // Zoek JSON object in de tekst (werkt ook als Gemini extra uitleg geeft)
      const match = tekst.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Geen JSON gevonden in de tekst.');
      const data = JSON.parse(match[0]);
      const imported = data.recepten || (Array.isArray(data) ? data : [data]);
      let nieuw = 0, bijgewerkt = 0;
      imported.forEach(r => {
        // Altijd nieuw uniek ID als het een template-ID is ("1") of ontbreekt
        if (!r.id || r.id === '1' || r.id === '0') {
          r.id = Date.now().toString() + Math.random().toString(36).slice(2,7);
        }
        if (!r.aangemaakt) r.aangemaakt = new Date().toISOString();
        const idx = recepten.findIndex(x => x.id === r.id);
        if (idx >= 0) { recepten[idx] = r; bijgewerkt++; }
        else { recepten.push(r); nieuw++; }
      });
      saveReceptenLocaal();
      renderReceptenLijst();
      document.getElementById('plak-modal').style.display = 'none';
      document.getElementById('plak-tekst').value = '';
      // Toon bevestiging
      const el = document.getElementById('drive-export-msg');
      if (el) {
        el.style.display = 'flex';
        el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#2D6A4F;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>
          <span>${nieuw} nieuw recept${nieuw!==1?'en':''} toegevoegd${bijgewerkt?' · '+bijgewerkt+' bijgewerkt':''}.</span>`;
        setTimeout(() => { if(el) el.style.display='none'; }, 5000);
      }
    } catch(err) {
      alert('Fout: ' + err.message + '\n\nZorg dat je de volledige JSON van Gemini plakt.');
    }
  }

  window.plakImporteren = function() {
    const tekst = document.getElementById('plak-tekst').value.trim();
    if (!tekst) { alert('Plak eerst de JSON tekst van Gemini.'); return; }
    verwerkImportJSON(tekst);
  };

  window.kopieerPrompt = function() {
    const ta = document.getElementById('gemini-prompt');
    ta.select();
    navigator.clipboard.writeText(ta.value).then(() => {
      const btn = document.getElementById('kopieer-btn');
      btn.textContent = '✓ Gekopieerd';
      btn.style.background = '#2D6A4F';
      setTimeout(() => { btn.textContent = 'Kopieer'; btn.style.background = '#1A1917'; }, 2000);
    }).catch(() => {
      document.execCommand('copy');
    });
  };

  window.openPlakModal = function() {
    document.getElementById('plak-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('plak-tekst').focus(), 100);
  };

  window.sluitPlakModal = function() {
    document.getElementById('plak-modal').style.display = 'none';
  };

  /* ── Lokale opslag als fallback ── */
  function saveReceptLocaal(recept) {
    const idx = recepten.findIndex(r => r.id === recept.id);
    if (idx >= 0) recepten[idx] = recept;
    else recepten.push(recept);
    saveReceptenLocaal();
  }
  function saveReceptenLocaal() {
    localStorage.setItem('hvw-recepten', JSON.stringify(recepten));
  }
  function loadReceptenLocaal() {
    try { recepten = JSON.parse(localStorage.getItem('hvw-recepten') || '[]'); }
    catch(e) { recepten = []; }
    renderReceptenLijst();
  }

  /* ══════════════════════════════
     UI — RECEPTENLIJST
     ══════════════════════════════ */
  function renderReceptenLijst() {
    const el = document.getElementById('recept-lijst');
    if (!el) return;

    const filtered = recepten.filter(r =>
      !filterQ || r.naam.toLowerCase().includes(filterQ.toLowerCase()) ||
      (r.categorie || '').toLowerCase().includes(filterQ.toLowerCase())
    );

    if (!filtered.length) {
      el.innerHTML = `<div class="recept-empty">
        ${filterQ ? 'Geen recepten gevonden' : 'Nog geen recepten. Klik "+ Recept" om te beginnen.'}
      </div>`;
      return;
    }

    // Groepeer per categorie
    const bycat = {};
    filtered.forEach(r => {
      const cat = r.categorie || 'Overige';
      if (!bycat[cat]) bycat[cat] = [];
      bycat[cat].push(r);
    });

    el.innerHTML = Object.entries(bycat).sort().map(([cat, recs]) => `
      <div class="recept-cat-header">${cat}</div>
      ${recs.map(r => `
        <div class="recept-card" onclick="openRecept('${r.id}')">
          ${r.foto ? `<div class="recept-card-foto" style="background-image:url('${r.foto}')"></div>` : '<div class="recept-card-foto recept-card-foto-empty">🍽️</div>'}
          <div class="recept-card-body">
            <div class="recept-card-naam">${r.naam}</div>
            <div class="recept-card-meta">
              ${r.porties ? `<span>🍽 ${r.porties} porties</span>` : ''}
              ${r.bereidingstijd ? `<span>⏱ ${r.bereidingstijd} min</span>` : ''}
              ${r.ccmCode ? `<span>📋 ${r.ccmCode}</span>` : ''}
            </div>
            ${r.ingredienten?.length ? `<div class="recept-card-ing">${r.ingredienten.length} ingrediënten</div>` : ''}
          </div>
          <div class="recept-card-arrow">›</div>
        </div>`).join('')}
    `).join('');
  }

  /* ══════════════════════════════
     UI — RECEPT DETAIL / BEWERKEN
     ══════════════════════════════ */
  window.openRecept = function(id) {
    const r = recepten.find(x => x.id === id);
    if (!r) return;
    currentRecept = JSON.parse(JSON.stringify(r));
    showReceptDetail(currentRecept);
  };

  window.openNieuwRecept = function() {
    currentRecept = {
      id: Date.now().toString(),
      naam: '',
      categorie: '',
      porties: '',
      bereidingstijd: '',
      ccmCode: '',
      foto: '',
      ingredienten: [],
      bereiding: '',
      aangemaakt: new Date().toISOString()
    };
    showReceptForm(currentRecept);
  };

  function showReceptDetail(r) {
    document.getElementById('recept-lijst-view').style.display = 'none';
    document.getElementById('recept-detail-view').style.display = 'block';
    document.getElementById('recept-form-view').style.display = 'none';

    document.getElementById('recept-detail-content').innerHTML = `
      <div class="recept-detail-hero">
        ${r.foto ? `<img src="${r.foto}" class="recept-detail-foto">` : ''}
        <div class="recept-detail-info">
          <div class="recept-detail-naam">${r.naam}</div>
          <div class="recept-detail-meta">
            ${r.categorie ? `<span class="recept-meta-badge">${r.categorie}</span>` : ''}
            ${r.porties ? `<span class="recept-meta-badge">🍽 ${r.porties} porties</span>` : ''}
            ${r.bereidingstijd ? `<span class="recept-meta-badge">⏱ ${r.bereidingstijd} min</span>` : ''}
            ${r.ccmCode ? `<span class="recept-meta-badge">📋 CCM: ${r.ccmCode}</span>` : ''}
          </div>
        </div>
      </div>

      ${r.ingredienten?.length ? `
      <div class="recept-section">
        <div class="recept-section-title">Ingrediënten</div>
        <ul class="recept-ing-list">
          ${r.ingredienten.map(i => `<li>${i}</li>`).join('')}
        </ul>
      </div>` : ''}

      ${r.bereiding ? `
      <div class="recept-section">
        <div class="recept-section-title">Bereiding</div>
        <div class="recept-bereiding">${r.bereiding.replace(/\n/g,'<br>')}</div>
      </div>` : ''}`;
  }

  function showReceptForm(r) {
    document.getElementById('recept-lijst-view').style.display = 'none';
    document.getElementById('recept-detail-view').style.display = 'none';
    document.getElementById('recept-form-view').style.display = 'block';

    document.getElementById('rf-naam').value = r.naam || '';
    document.getElementById('rf-categorie').value = r.categorie || '';
    document.getElementById('rf-porties').value = r.porties || '';
    document.getElementById('rf-tijd').value = r.bereidingstijd || '';
    document.getElementById('rf-ccm').value = r.ccmCode || '';
    document.getElementById('rf-bereiding').value = r.bereiding || '';

    // Ingrediënten
    document.getElementById('rf-ing-input').value = (r.ingredienten || []).join('\n');

    // Foto preview
    const fotoEl = document.getElementById('rf-foto-preview');
    fotoEl.style.display = r.foto ? 'block' : 'none';
    fotoEl.src = r.foto || '';
  }

  function renderIngredientenForm(list) {
    const el = document.getElementById('rf-ing-list');
    el.innerHTML = list.map((ing, i) => `
      <div class="ing-row">
        <span class="ing-text">${ing}</span>
        <button class="ing-del" onclick="removeIngredient(${i})">×</button>
      </div>`).join('');
  }

  // addIngredient/removeIngredient niet meer nodig — textarea gebruikt

  window.saveRecept = async function() {
    currentRecept.naam          = document.getElementById('rf-naam').value.trim();
    currentRecept.categorie     = document.getElementById('rf-categorie').value.trim();
    currentRecept.porties       = document.getElementById('rf-porties').value;
    currentRecept.bereidingstijd= document.getElementById('rf-tijd').value;
    currentRecept.ccmCode       = document.getElementById('rf-ccm').value.trim();
    currentRecept.bereiding     = document.getElementById('rf-bereiding').value.trim();
    // Ingrediënten: split op newlines, filter lege lijnen
    currentRecept.ingredienten  = document.getElementById('rf-ing-input').value
      .split('\n').map(l => l.trim()).filter(Boolean);
    currentRecept.bijgewerkt    = new Date().toISOString();

    if (!currentRecept.naam) { alert('Vul een naam in.'); return; }

    const btn = document.getElementById('rf-save-btn');
    btn.textContent = 'Opslaan...'; btn.disabled = true;

    await saveReceptToDrive(currentRecept);
    saveReceptLocaal(currentRecept);

    btn.textContent = 'Opgeslagen ✓'; btn.disabled = false;
    setTimeout(() => { btn.textContent = 'Opslaan'; }, 1500);

    renderReceptenLijst();
    showReceptDetail(currentRecept);
  };

  window.deleteRecept = async function() {
    if (!confirm(`"${currentRecept.naam}" verwijderen?`)) return;
    await deleteReceptFromDrive(currentRecept.id);
    currentRecept = null;
    backToLijst();
  };

  window.backToLijst = function() {
    document.getElementById('recept-lijst-view').style.display = 'block';
    document.getElementById('recept-detail-view').style.display = 'none';
    document.getElementById('recept-form-view').style.display = 'none';
  };

  window.editCurrentRecept = function() {
    showReceptForm(currentRecept);
  };

  /* ── Foto upload ── */
  window.handleFotoUpload = function(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      currentRecept.foto = e.target.result;
      const prev = document.getElementById('rf-foto-preview');
      prev.src = e.target.result;
      prev.style.display = 'block';
    };
    reader.readAsDataURL(file);
  };

  /* ══════════════════════════════
     PDF EXPORT
     ══════════════════════════════ */
  /* ── Download huidig recept als PDF ── */
  window.printReceptPDF = async function() {
    if (!currentRecept) return;
    const doc = await maakReceptPDF(currentRecept);
    doc.save(`${currentRecept.naam}.pdf`);
  };

  /* ══════════════════════════════
     CSS INJECTEREN
     ══════════════════════════════ */
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      #recepten-content { display: none; padding: 26px 28px; }

      .recept-topbar {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 20px; gap: 12px; flex-wrap: wrap;
      }
      .recept-search {
        flex: 1; min-width: 200px; max-width: 360px;
        font-family: 'Outfit',sans-serif; font-size: 14px;
        padding: 9px 14px; border: 1px solid #DEDAD4; border-radius: 10px;
        background: #fff; outline: none;
      }
      .recept-search:focus { border-color: #1A1917; }

      .recept-cat-header {
        font-size: 10px; font-weight: 700; text-transform: uppercase;
        letter-spacing: 1px; color: #9A9590; padding: 14px 0 6px; margin-top: 8px;
      }
      .recept-empty { text-align:center; padding:3rem; color:#C8C2B8; font-size:14px; }

      .recept-card {
        display: flex; align-items: center; gap: 14px;
        background: #fff; border: 1px solid #E8E5E0; border-radius: 12px;
        padding: 12px 16px; margin-bottom: 8px; cursor: pointer;
        transition: box-shadow 0.15s, transform 0.1s;
      }
      .recept-card:hover { box-shadow: 0 3px 12px rgba(0,0,0,0.08); transform: translateY(-1px); }
      .recept-card-foto {
        width: 56px; height: 56px; border-radius: 8px; flex-shrink: 0;
        background-size: cover; background-position: center; background-color: #F4F3F0;
      }
      .recept-card-foto-empty { display:flex; align-items:center; justify-content:center; font-size:22px; }
      .recept-card-body { flex: 1; min-width: 0; }
      .recept-card-naam { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
      .recept-card-meta { display:flex; gap:10px; font-size:12px; color:#9A9590; }
      .recept-card-ing  { font-size:11px; color:#BBB5AF; margin-top:3px; }
      .recept-card-arrow { color:#C8C2B8; font-size:20px; flex-shrink:0; }

      /* Detail */
      .recept-detail-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; gap:10px; flex-wrap:wrap; }
      .recept-detail-hero { display:flex; gap:20px; margin-bottom:24px; flex-wrap:wrap; }
      .recept-detail-foto { width:160px; height:160px; object-fit:cover; border-radius:14px; flex-shrink:0; }
      .recept-detail-naam { font-family:'Cormorant Garamond',serif; font-size:28px; font-weight:500; margin-bottom:12px; }
      .recept-detail-meta { display:flex; gap:8px; flex-wrap:wrap; }
      .recept-meta-badge { font-size:12px; font-weight:500; padding:4px 10px; background:#F4F3F0; border:1px solid #E8E5E0; border-radius:20px; }
      .recept-section { margin-bottom:22px; }
      .recept-section-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#9A9590; margin-bottom:10px; }
      .recept-ing-list { list-style:none; display:flex; flex-direction:column; gap:6px; }
      .recept-ing-list li { display:flex; align-items:center; gap:8px; font-size:14px; }
      .recept-ing-list li::before { content:''; width:6px; height:6px; border-radius:50%; background:#B8965A; flex-shrink:0; }
      .recept-bereiding { font-size:14px; line-height:1.8; color:#3A3835; white-space:pre-wrap; }

      /* Form */
      .recept-form { display:flex; flex-direction:column; gap:14px; max-width:640px; }
      .rf-field label { display:block; font-size:11px; font-weight:600; color:#9A9590; text-transform:uppercase; letter-spacing:.5px; margin-bottom:6px; }
      .rf-field input, .rf-field select, .rf-field textarea {
        width:100%; font-family:'Outfit',sans-serif; font-size:14px;
        padding:9px 12px; border:1px solid #DEDAD4; border-radius:10px;
        background:#fff; color:#1A1917; outline:none;
      }
      .rf-field input:focus, .rf-field select:focus, .rf-field textarea:focus { border-color:#1A1917; }
      .rf-field textarea { min-height:140px; resize:vertical; line-height:1.6; }
      .rf-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }

      /* Ingrediënten */
      .ing-input-row { display:flex; gap:8px; }
      .ing-input-row input { flex:1; }
      .ing-input-row button { padding:9px 16px; background:#1A1917; color:#fff; border:none; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap; }
      .ing-row { display:flex; align-items:center; justify-content:space-between; padding:7px 10px; background:#F4F3F0; border-radius:8px; margin-bottom:6px; font-size:13px; }
      .ing-del { background:none; border:none; color:#C8C2B8; font-size:18px; cursor:pointer; padding:0 4px; line-height:1; }
      .ing-del:hover { color:#c0392b; }

      /* Foto */
      .rf-foto-wrap { display:flex; align-items:center; gap:12px; }
      #rf-foto-preview { width:80px; height:80px; object-fit:cover; border-radius:10px; border:1px solid #E8E5E0; }

      /* Drive badge */
      .drive-badge { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:#9A9590; padding:5px 10px; background:#F4F3F0; border-radius:20px; text-decoration:none; }
      .drive-badge:hover { color:#1A1917; }
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════
     UI INJECTEREN
     ══════════════════════════════ */
  function injectUI() {
    const wrap = document.createElement('div');
    wrap.id = 'recepten-content';
    wrap.innerHTML = `
      <!-- LIJST VIEW -->
      <div id="recept-lijst-view">
        <div class="recept-topbar">
          <input class="recept-search" id="recept-zoek" placeholder="Zoek recept..." oninput="filterRecepten(this.value)">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn no-print" onclick="openPlakModal()" title="Plak JSON van Gemini">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
              Plak van Gemini
            </button>
            <label class="btn no-print" style="cursor:pointer" title="Importeer JSON bestand">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Importeer
              <input type="file" accept=".json" style="display:none" onchange="importeerVanDrive(this)">
            </label>
            <button class="btn no-print" onclick="exporteerJSON()" title="Backup als JSON — te importeren op andere pc">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Backup JSON
            </button>
            <button class="btn no-print" onclick="exporteerNaarDrive()" title="Download alle recepten als PDF">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Exporteer alle als PDF
            </button>
            <button class="btn btn-primary" onclick="openNieuwRecept()">+ Recept</button>
          </div>
        </div>
        <div id="drive-export-msg" style="display:none;align-items:center;gap:10px;padding:12px 16px;background:#E8F5E9;border:1px solid #C8E6C9;border-radius:10px;margin-bottom:14px;font-size:13px;color:#2D6A4F"></div>
        <div id="recept-lijst"></div>
      </div>

      <!-- DETAIL VIEW -->
      <div id="recept-detail-view" style="display:none">
        <div class="recept-detail-header no-print">
          <button class="btn" onclick="backToLijst()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            Terug
          </button>
          <div style="display:flex;gap:8px">
            <button class="btn" onclick="printReceptPDF()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              PDF
            </button>
            <button class="btn btn-primary" onclick="editCurrentRecept()">Bewerken</button>
            <button class="btn" onclick="deleteRecept()" style="color:#c0392b;border-color:#e0b0b0">Verwijderen</button>
          </div>
        </div>
        <div id="recept-detail-content"></div>
      </div>

      <!-- FORM VIEW -->
      <div id="recept-form-view" style="display:none">
        <div class="recept-detail-header no-print" style="margin-bottom:24px">
          <button class="btn" onclick="backToLijst()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
            Annuleren
          </button>
          <button class="btn btn-primary" id="rf-save-btn" onclick="saveRecept()">Opslaan</button>
        </div>
        <div class="recept-form">
          <div class="rf-field">
            <label>Naam recept *</label>
            <input type="text" id="rf-naam" placeholder="bv. Kalfsblanquette">
          </div>
          <div class="rf-row">
            <div class="rf-field">
              <label>Categorie</label>
              <input type="text" id="rf-categorie" placeholder="bv. Vlees, Vis, Dessert..." list="categorie-list">
              <datalist id="categorie-list">
                <option value="Vlees"><option value="Vis"><option value="Vegetarisch">
                <option value="Groenten"><option value="Sausen"><option value="Dessert">
                <option value="Soepen"><option value="Hapjes"><option value="Kids">
              </datalist>
            </div>
            <div class="rf-field">
              <label>CCM Code / Feest link</label>
              <input type="text" id="rf-ccm" placeholder="bv. 858737 of zaalcode">
            </div>
          </div>
          <div class="rf-row">
            <div class="rf-field">
              <label>Porties</label>
              <input type="number" id="rf-porties" min="1" placeholder="bv. 10">
            </div>
            <div class="rf-field">
              <label>Bereidingstijd (min)</label>
              <input type="number" id="rf-tijd" min="0" placeholder="bv. 45">
            </div>
          </div>
          <div class="rf-field">
            <label>Foto</label>
            <div class="rf-foto-wrap">
              <img id="rf-foto-preview" style="display:none">
              <label class="btn" style="cursor:pointer">
                📷 Foto kiezen
                <input type="file" accept="image/*" style="display:none" onchange="handleFotoUpload(this)">
              </label>
            </div>
          </div>
          <div class="rf-field">
            <label>Ingrediënten <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#BBB5AF">— 1 per lijn, plakken vanuit Excel werkt ook</span></label>
            <textarea id="rf-ing-input" placeholder="500g kalfsvlees&#10;200ml room&#10;2 uien&#10;..." style="min-height:160px;font-family:'DM Mono',monospace;font-size:13px;line-height:1.7"></textarea>
          </div>
          <div class="rf-field">
            <label>Bereiding</label>
            <textarea id="rf-bereiding" placeholder="Beschrijf de bereiding stap voor stap..."></textarea>
          </div>
        </div>
      </div>`;

    // Plak modal
    const plakModal = document.createElement('div');
    plakModal.id = 'plak-modal';
    plakModal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:300;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px)';
    plakModal.innerHTML = `
      <div style="background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.15);width:100%;max-width:580px;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid #E8E5E0">
          <div style="font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:500">Plak JSON van Gemini</div>
          <button onclick="sluitPlakModal()" style="width:30px;height:30px;border:none;background:transparent;cursor:pointer;font-size:20px;color:#9A9590;border-radius:6px">×</button>
        </div>
        <div style="padding:20px">
          <!-- Stap 1: Prompt kopiëren -->
          <div style="margin-bottom:14px">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#9A9590;margin-bottom:8px">Stap 1 — Kopieer deze prompt naar Gemini</div>
            <div style="position:relative">
              <textarea readonly id="gemini-prompt" style="width:100%;height:130px;font-family:'DM Mono',monospace;font-size:11px;padding:10px 12px;border:1px solid #DEDAD4;border-radius:8px;background:#F4F3F0;color:#5A5750;outline:none;resize:none;line-height:1.5">Extraheer dit recept en geef ALLEEN een geldig JSON object terug, zonder uitleg of markdown:

{ "versie": 1, "exportDatum": "2026-01-01T00:00:00.000Z", "aantalRecepten": 1, "recepten": [{ "id": "1", "naam": "naam", "categorie": "Vlees/Vis/Groenten/Dessert/Soepen/Hapjes/Kids/Vegetarisch/Sausen", "porties": "", "bereidingstijd": "", "ccmCode": "", "foto": "", "ingredienten": ["ingrediënt 1", "ingrediënt 2"], "bereiding": "bereiding als tekst", "aangemaakt": "2026-01-01T00:00:00.000Z" }] }</textarea>
              <button onclick="kopieerPrompt()" id="kopieer-btn" style="position:absolute;top:8px;right:8px;padding:4px 10px;background:#1A1917;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">Kopieer</button>
            </div>
            <div style="font-size:11px;color:#9A9590;margin-top:6px">
              → Ga naar <a href="https://gemini.google.com" target="_blank" style="color:#1A3F6F;font-weight:600">gemini.google.com</a>, plak deze prompt + upload een foto of tekst van het recept.
            </div>
          </div>
          <!-- Stap 2: JSON plakken -->
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#9A9590;margin-bottom:6px">Stap 2 — Plak de JSON die Gemini teruggeeft</div>
          <textarea id="plak-tekst" style="width:100%;min-height:160px;font-family:'DM Mono',monospace;font-size:12px;padding:12px;border:1.5px solid #DEDAD4;border-radius:10px;background:#fff;color:#1A1917;outline:none;resize:vertical;line-height:1.6" placeholder='{ "versie": 1, "recepten": [...] }'></textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;padding:14px 22px;border-top:1px solid #E8E5E0;background:#FAFAF8">
          <button onclick="sluitPlakModal()" style="padding:9px 18px;border:1px solid #DEDAD4;border-radius:8px;background:#fff;font-size:13px;cursor:pointer;color:#9A9590">Annuleren</button>
          <button onclick="plakImporteren()" style="padding:9px 20px;background:#1A1917;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Importeren</button>
        </div>
      </div>`;
    document.body.appendChild(plakModal);

    const appWrap = document.getElementById('app-wrap') || document.body;
    appWrap.appendChild(wrap);
  }

  window.filterRecepten = function(q) {
    filterQ = q;
    renderReceptenLijst();
  };

  /* ── Init ── */
  // Mobile responsive styles
  (function() {
    const ms = document.createElement('style');
    ms.textContent = `
      @media (max-width: 768px) {
        #recepten-content { padding: 14px !important; }
        .recept-topbar { flex-direction: column; align-items: stretch; }
        .recept-search { max-width: 100%; }
        .recept-detail-hero { flex-direction: column; }
        .recept-detail-foto { width: 100%; height: 200px; object-fit: cover; }
        .recept-detail-naam { font-size: 22px; }
        .recept-form { gap: 10px; }
      }`;
    document.head.appendChild(ms);
  })();

  document.addEventListener('DOMContentLoaded', () => {
    injectCSS();
    injectUI();
    loadReceptenLocaal(); // Start met lokale data, Drive laden bij eerste open
  });

  document.addEventListener('dataLoaded', () => {
    // Refresh als nodig
  });

  // Exporteer voor sbShow
  window._openRecepten = function() {
    loadReceptenLocaal();
    renderReceptenLijst();
  };

})();
