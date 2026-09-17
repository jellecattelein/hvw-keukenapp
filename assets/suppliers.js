/* ══════════════════════════════════════════
   suppliers.js — Leveranciers & Instellingen
   ══════════════════════════════════════════ */

/* ── State ── */
let suppliers    = [];   // [{ id, name, email, color }]
let assignments  = {};   // { 'baseName': supplierId }
let appSettings  = {};   // algemene instellingen

const SUPPLIER_COLORS = [
  '#2D6A4F','#1A3F6F','#8B2500','#6B3A7D',
  '#8B6A00','#1D6A6A','#7A3B1E','#3D5A80','#C2185B','#455A64'
];

/* ── Storage ── */
function saveSuppliers() {
  localStorage.setItem('mmm-suppliers',   JSON.stringify(suppliers));
  localStorage.setItem('mmm-assignments', JSON.stringify(assignments));
  localStorage.setItem('mmm-settings',    JSON.stringify(appSettings));
}

function loadSuppliers() {
  try {
    suppliers   = JSON.parse(localStorage.getItem('mmm-suppliers')  || '[]');
    assignments = JSON.parse(localStorage.getItem('mmm-assignments')|| '{}');
    appSettings = JSON.parse(localStorage.getItem('mmm-settings')   || '{}');
  } catch(e) {
    suppliers = []; assignments = {}; appSettings = {};
  }
}

function supplierById(id) { return suppliers.find(s => s.id === id); }

/* ── Instellingen pagina renderen ── */
function renderSettings() {
  renderSupplierList();
  renderAssignmentList();
  renderGeneralSettings();
}

function renderSupplierList() {
  const el = document.getElementById('supplier-list');
  if (!el) return;
  if (!suppliers.length) {
    el.innerHTML = '<p class="settings-empty">Nog geen leveranciers toegevoegd.</p>';
    return;
  }
  el.innerHTML = suppliers.map(s => `
    <div class="supplier-card" style="border-left:4px solid ${s.color}">
      <div class="supplier-info">
        <span class="supplier-dot" style="background:${s.color}"></span>
        <div>
          <div class="supplier-name">${s.name}</div>
          <div class="supplier-email">${s.email || 'Geen emailadres'}</div>
        </div>
      </div>
      <div class="supplier-actions">
        <button class="btn-icon" onclick="editSupplier('${s.id}')" title="Bewerken">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon btn-icon-danger" onclick="deleteSupplier('${s.id}')" title="Verwijderen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>`).join('');
}

function renderAssignmentList() {
  const el = document.getElementById('assignment-list');
  if (!el) return;

  // Verzamel unieke basisnamen uit vlees en vis
  const safeRows = (typeof allRows !== 'undefined') ? allRows : [];
  const bases = [...new Set(
    safeRows
      .filter(r => r.tabId === 'vlees' || r.tabId === 'vis')
      .map(r => r.base)
  )].sort();

  if (!bases.length) {
    el.innerHTML = `<div class="settings-empty-hint">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-faint);margin-bottom:8px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <p>Upload eerst een Excel-bestand via de <strong>Calculator</strong> tab.</p>
      <p>Daarna verschijnen hier alle vlees- en visproducten om toe te wijzen.</p>
      <button class="btn btn-upload" style="margin-top:12px" onclick="switchMode('calculator')">Naar Calculator</button>
    </div>`;
    return;
  }

  const supplierOptions = suppliers.map(s =>
    `<option value="${s.id}">${s.name}</option>`
  ).join('');

  el.innerHTML = bases.map(base => {
    const assignedId = assignments[base] || '';
    const sup = supplierById(assignedId);
    return `
    <div class="assignment-row">
      <div class="assignment-name">
        ${sup ? `<span class="assignment-dot" style="background:${sup.color}"></span>` : '<span class="assignment-dot-empty"></span>'}
        <span>${base}</span>
      </div>
      <select class="assignment-select" onchange="assignSupplier('${base.replace(/'/g,"\\'")}', this.value)">
        <option value="">— Geen leverancier —</option>
        ${supplierOptions}
      </select>
    </div>`;
  }).join('');

  // Zet huidige waarden
  bases.forEach(base => {
    const sel = el.querySelectorAll('.assignment-select');
    // Gebruik index
  });

  // Zet geselecteerde waarden
  el.querySelectorAll('.assignment-row').forEach((row, i) => {
    const base = bases[i];
    const sel  = row.querySelector('select');
    if (assignments[base]) sel.value = assignments[base];
  });
}

function renderGeneralSettings() {
  const el = document.getElementById('general-settings');
  if (!el) return;
  el.innerHTML = `
    <div class="settings-field">
      <label>Bedrijfsnaam in emails</label>
      <input type="text" id="set-company" value="${appSettings.company||'Meesters in Mooie Momenten'}" oninput="saveGeneralSetting('company',this.value)">
    </div>
    <div class="settings-field">
      <label>Standaard gewicht VG Warm (gr/p)</label>
      <input type="number" id="set-vgwarm" value="${appSettings.vgWarm||120}" min="0" step="10" oninput="saveGeneralSetting('vgWarm',parseInt(this.value)||120)">
    </div>
    <div class="settings-field">
      <label>Standaard gewicht Small Plates (gr/p)</label>
      <input type="number" id="set-smallplates" value="${appSettings.smallPlates||50}" min="0" step="5" oninput="saveGeneralSetting('smallPlates',parseInt(this.value)||50)">
    </div>`;
  renderSeizoensgroentenSettings();
  renderSamengesteldSettings();
}

/* ══════════════════════════════
   SEIZOENSGROENTEN ASSORTIMENT
   Twee aparte, instelbare assortimenten:
   - 'standaard'    → wekelijks wisselend (chef's keuze)
   - 'rouwmaaltijd' → apart, meestal vast assortiment voor Rouwmaaltijd
   Per groente: naam, eenheid (stuk/gram), portiegrootte per plateau.
   Gedeeld met Portie-Etiketten via localStorage. Elke variant heeft
   zijn eigen sleutel zodat ze nooit door elkaar lopen.
   ══════════════════════════════ */
const GROENTEN_VARIANTEN = [
  {
    key: 'standaard',
    storageKey: 'hvw-groenten-assortiment',
    label: 'Seizoensgroenten — assortiment van deze week',
    hint: 'Wisselt wekelijks (keuze van de chef). Wat je hier instelt, verschijnt automatisch als keuze bij "Seizoensgroenten" in Portie-Etiketten.'
  },
  {
    key: 'rouwmaaltijd',
    storageKey: 'hvw-groenten-assortiment-rouwmaaltijd',
    label: 'Seizoensgroenten — Rouwmaaltijd',
    hint: 'Apart assortiment, los van de wekelijkse keuze hierboven. Verschijnt bij "Seizoensgroenten (Rouwmaaltijd)" in Portie-Etiketten.'
  }
];

let groentenAssortimenten = { standaard: [], rouwmaaltijd: [] }; // { [variant]: [{ id, naam, eenheid: 'stuk'|'gram', perPlateau }] }

function variantConfig(variant) {
  return GROENTEN_VARIANTEN.find(v => v.key === variant) || GROENTEN_VARIANTEN[0];
}

function loadGroentenAssortiment() {
  GROENTEN_VARIANTEN.forEach(v => {
    try {
      groentenAssortimenten[v.key] = JSON.parse(localStorage.getItem(v.storageKey) || '[]');
    } catch(e) { groentenAssortimenten[v.key] = []; }
  });
}

function saveGroentenAssortiment(variant) {
  const cfg = variantConfig(variant);
  try { localStorage.setItem(cfg.storageKey, JSON.stringify(groentenAssortimenten[variant] || [])); } catch(e) {}
}

function renderSeizoensgroentenSettings() {
  const wrap = document.getElementById('general-settings');
  if (!wrap) return;

  GROENTEN_VARIANTEN.forEach(cfg => {
    const el = document.createElement('div');
    el.className = 'settings-field';
    el.id = `seizoensgroenten-assortiment-wrap-${cfg.key}`;
    el.innerHTML = `
      <label>${cfg.label}</label>
      <div class="settings-hint" style="margin-top:-2px;margin-bottom:10px">
        ${cfg.hint}
      </div>
      <div id="groenten-lijst-${cfg.key}"></div>
      <div class="groente-actionrow">
        <button type="button" class="btn-add-groente" onclick="openAddGroente('${cfg.key}')">+ Groente toevoegen</button>
        <button type="button" class="btn-groente-export" onclick="exportGroentenAssortiment('${cfg.key}')" title="Download als JSON-bestand">⬇ Exporteren</button>
        <button type="button" class="btn-groente-import" onclick="document.getElementById('groenten-import-file-${cfg.key}').click()" title="JSON-bestand terug inladen">⬆ Importeren</button>
        <input type="file" id="groenten-import-file-${cfg.key}" accept="application/json" style="display:none" onchange="importGroentenAssortiment(event, '${cfg.key}')">
      </div>
    `;
    wrap.appendChild(el);
    renderGroentenLijst(cfg.key);
  });
}

function renderGroentenLijst(variant) {
  const el = document.getElementById(`groenten-lijst-${variant}`);
  if (!el) return;
  const lijst = groentenAssortimenten[variant] || [];
  if (!lijst.length) {
    el.innerHTML = '<p class="settings-empty">Nog geen groenten in dit assortiment.</p>';
    return;
  }
  el.innerHTML = lijst.map(g => `
    <div class="groente-card">
      <div class="groente-info">
        <div class="groente-naam">${g.naam}</div>
        <div class="groente-meta">${g.eenheid === 'gram' ? `${g.perPlateau} g per persoon` : `${g.perPlateau} st. per plateau`}</div>
      </div>
      <div class="groente-actions">
        <button class="btn-icon" onclick="editGroente('${variant}', '${g.id}')" title="Bewerken">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon btn-icon-danger" onclick="deleteGroente('${variant}', '${g.id}')" title="Verwijderen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>`).join('');
}

function openAddGroente(variant) {
  document.getElementById('groente-variant').value = variant;
  document.getElementById('groente-form-title').textContent = 'Groente toevoegen — ' + variantConfig(variant).label;
  document.getElementById('groente-id').value = '';
  document.getElementById('groente-naam').value = '';
  document.getElementById('groente-eenheid').value = 'stuk';
  document.getElementById('groente-perplateau').value = '';
  window._updateGroentePerLabel();
  document.getElementById('groente-modal').style.display = 'flex';
}

function editGroente(variant, id) {
  const g = (groentenAssortimenten[variant] || []).find(g => g.id === id);
  if (!g) return;
  document.getElementById('groente-variant').value = variant;
  document.getElementById('groente-form-title').textContent = 'Groente bewerken — ' + variantConfig(variant).label;
  document.getElementById('groente-id').value = g.id;
  document.getElementById('groente-naam').value = g.naam;
  document.getElementById('groente-eenheid').value = g.eenheid;
  document.getElementById('groente-perplateau').value = g.perPlateau;
  window._updateGroentePerLabel();
  document.getElementById('groente-modal').style.display = 'flex';
}

window._updateGroentePerLabel = function () {
  const eenheid = document.getElementById('groente-eenheid').value;
  const label = document.getElementById('groente-perplateau-label');
  const hint = document.getElementById('groente-perplateau-hint');
  const input = document.getElementById('groente-perplateau');
  if (eenheid === 'gram') {
    label.textContent = 'Gram per persoon';
    input.placeholder = 'bv. 20';
    hint.style.display = 'block';
  } else {
    label.textContent = 'Aantal per plateau';
    input.placeholder = 'bv. 50';
    hint.style.display = 'none';
  }
};

function saveGroenteForm() {
  const variant = document.getElementById('groente-variant').value || 'standaard';
  const id = document.getElementById('groente-id').value;
  const naam = document.getElementById('groente-naam').value.trim();
  const eenheid = document.getElementById('groente-eenheid').value;
  const perPlateau = parseFloat(document.getElementById('groente-perplateau').value);

  if (!naam) { alert('Vul een naam in.'); return; }
  if (!perPlateau || perPlateau <= 0) { alert('Vul een geldig aantal in.'); return; }

  const lijst = groentenAssortimenten[variant] || (groentenAssortimenten[variant] = []);
  if (id) {
    const g = lijst.find(g => g.id === id);
    if (g) { g.naam = naam; g.eenheid = eenheid; g.perPlateau = perPlateau; }
  } else {
    lijst.push({ id: Date.now().toString(), naam, eenheid, perPlateau });
  }
  saveGroentenAssortiment(variant);
  closeGroenteModal();
  renderGroentenLijst(variant);
}

function deleteGroente(variant, id) {
  if (!confirm('Deze groente uit het assortiment verwijderen?')) return;
  groentenAssortimenten[variant] = (groentenAssortimenten[variant] || []).filter(g => g.id !== id);
  saveGroentenAssortiment(variant);
  renderGroentenLijst(variant);
}

function closeGroenteModal() {
  document.getElementById('groente-modal').style.display = 'none';
}

/* ── Export/Import groenten-assortiment (JSON-bestand) ──
   Dit is de enige manier om een assortiment mee te nemen naar een
   ander toestel/browser: het staat NIET in de code op GitHub, enkel
   lokaal in de localStorage van het toestel waar het is ingevoerd.
   Elke variant (Standaard / Rouwmaaltijd) wordt apart geëxporteerd
   en geïmporteerd, zodat ze nooit door elkaar lopen. */
function exportGroentenAssortiment(variant) {
  const lijst = groentenAssortimenten[variant] || [];
  if (!lijst.length) { alert('Nog geen groenten om te exporteren.'); return; }
  const data = JSON.stringify(lijst, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  const naamDeel = variant === 'rouwmaaltijd' ? 'Rouwmaaltijd' : 'Standaard';
  a.href = url;
  a.download = `HVW_Seizoensgroenten_${naamDeel}_${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importGroentenAssortiment(event, variant) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    let imported;
    try {
      imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('Geen lijst');
    } catch (err) {
      alert('Kon dit bestand niet lezen. Is het een geldig geëxporteerd groenten-JSON-bestand?');
      event.target.value = '';
      return;
    }

    // Basale validatie per item
    const valid = imported.every(g => g && typeof g.naam === 'string' && (g.eenheid === 'stuk' || g.eenheid === 'gram'));
    if (!valid) {
      alert('Het bestand bevat geen geldige groenten-data.');
      event.target.value = '';
      return;
    }

    const bestaande = groentenAssortimenten[variant] || (groentenAssortimenten[variant] = []);
    const doMerge = bestaande.length > 0
      ? confirm(`Er staan al ${bestaande.length} groente(n) in dit assortiment.\n\nOK = samenvoegen met bestaande lijst\nAnnuleren = volledig vervangen door het geïmporteerde bestand`)
      : true;

    if (doMerge && bestaande.length > 0) {
      // Samenvoegen: bestaande namen niet dupliceren, nieuwe id's voor geïmporteerde items
      const bestaandeNamen = bestaande.map(g => g.naam.toLowerCase());
      imported.forEach(g => {
        if (!bestaandeNamen.includes(g.naam.toLowerCase())) {
          bestaande.push({ id: Date.now().toString() + Math.random().toString(36).slice(2, 6), naam: g.naam, eenheid: g.eenheid, perPlateau: g.perPlateau });
        }
      });
    } else {
      groentenAssortimenten[variant] = imported.map(g => ({ id: Date.now().toString() + Math.random().toString(36).slice(2, 6), naam: g.naam, eenheid: g.eenheid, perPlateau: g.perPlateau }));
    }

    saveGroentenAssortiment(variant);
    renderGroentenLijst(variant);
    if (typeof window._peRefreshOnShow === 'function') window._peRefreshOnShow();
    alert(`${imported.length} groente(n) geïmporteerd.`);
    event.target.value = '';
  };
  reader.readAsText(file);
}

/* ══════════════════════════════
   SAMENGESTELDE GERECHTEN
   Voor gerechten waarvan de onderdelen al letterlijk in de productnaam
   staan (bv. "Groene asperge met parmezaankorst, Bimi, Tartelette met
   crème van erwtjes en jonge kruidensalade"). In tegenstelling tot
   Seizoensgroenten (één wisselend assortiment) beheer je hier een
   groeiende lijst van eigen, exacte gerechten — elk met zijn eigen vaste
   onderdelen, en per onderdeel dezelfde stuk/gram-verdeling als bij
   Seizoensgroenten (bv. "40 p/plateau"). Gedeeld met Portie-Etiketten
   via localStorage.
   ══════════════════════════════ */
const SAMENGESTELD_STORAGE_KEY = 'hvw-samengestelde-gerechten';
let samengesteldeGerechten = []; // [{ id, productNaam, onderdelen: [{id, naam, eenheid, perPlateau}, ...] }]
let samengesteldModalOnderdelen = []; // werkkopie tijdens het bewerken in de modal

function loadSamengesteldeGerechten() {
  try {
    samengesteldeGerechten = JSON.parse(localStorage.getItem(SAMENGESTELD_STORAGE_KEY) || '[]');
    if (!Array.isArray(samengesteldeGerechten)) samengesteldeGerechten = [];
  } catch (e) { samengesteldeGerechten = []; }
}

function saveSamengesteldeGerechten() {
  try { localStorage.setItem(SAMENGESTELD_STORAGE_KEY, JSON.stringify(samengesteldeGerechten)); } catch (e) {}
}

function renderSamengesteldSettings() {
  const wrap = document.getElementById('general-settings');
  if (!wrap) return;

  const el = document.createElement('div');
  el.className = 'settings-field';
  el.id = 'samengesteld-gerechten-wrap';
  el.innerHTML = `
    <label>Samengestelde gerechten</label>
    <div class="settings-hint" style="margin-top:-2px;margin-bottom:10px">
      Voor gerechten waarvan de onderdelen al in de productnaam staan (bv. "Groene asperge met parmezaankorst, Bimi, Tartelette..."). Elk onderdeel dat je hier instelt, kan je in Portie-Etiketten → Per categorie apart aanvinken en afdrukken — met een eigen stuk/gram-verdeling, net als bij Seizoensgroenten.
    </div>
    <div id="samengesteld-lijst"></div>
    <button type="button" class="btn-add-groente" onclick="openAddSamengesteld()">+ Samengesteld gerecht toevoegen</button>
  `;
  wrap.appendChild(el);
  renderSamengesteldLijst();
  vulSamengesteldProductnaamLijst();
}

function renderSamengesteldLijst() {
  const el = document.getElementById('samengesteld-lijst');
  if (!el) return;
  if (!samengesteldeGerechten.length) {
    el.innerHTML = '<p class="settings-empty">Nog geen samengestelde gerechten ingesteld.</p>';
    return;
  }
  el.innerHTML = samengesteldeGerechten.map(g => `
    <div class="groente-card">
      <div class="groente-info">
        <div class="groente-naam">${escapeHtmlSuppliers(g.productNaam)}</div>
        <div class="groente-meta">${g.onderdelen.map(o => `${escapeHtmlSuppliers(o.naam)} (${o.eenheid === 'gram' ? o.perPlateau + 'g/p' : o.perPlateau + 'p/plateau'})`).join(' · ')}</div>
      </div>
      <div class="groente-actions">
        <button class="btn-icon" onclick="editSamengesteld('${g.id}')" title="Bewerken">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon btn-icon-danger" onclick="deleteSamengesteld('${g.id}')" title="Verwijderen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    </div>`).join('');
}

function escapeHtmlSuppliers(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// Vult de datalist met unieke productnamen uit de laatst geladen Excel-data,
// zodat je bij het toevoegen kan kiezen i.p.v. exact moeten overtypen.
function vulSamengesteldProductnaamLijst() {
  const dl = document.getElementById('samengesteld-productnaam-lijst');
  if (!dl) return;
  if (typeof allRows === 'undefined' || !allRows.length) { dl.innerHTML = ''; return; }
  const namen = [...new Set(allRows.map(r => r.name || r.base).filter(Boolean))].sort();
  dl.innerHTML = namen.map(n => `<option value="${escapeHtmlSuppliers(n)}">`).join('');
}

function renderSamengesteldOnderdelenLijst() {
  const el = document.getElementById('samengesteld-onderdelen-lijst');
  if (!el) return;
  if (!samengesteldModalOnderdelen.length) {
    el.innerHTML = '<p class="settings-empty">Nog geen onderdelen toegevoegd.</p>';
    return;
  }
  el.innerHTML = samengesteldModalOnderdelen.map((o, i) => `
    <div class="sgo-row">
      <input type="text" placeholder="Naam onderdeel" value="${escapeHtmlSuppliers(o.naam)}"
             onchange="window._sgoUpdate(${i}, 'naam', this.value)">
      <select onchange="window._sgoUpdate(${i}, 'eenheid', this.value)">
        <option value="stuk" ${o.eenheid==='stuk'?'selected':''}>Per plateau</option>
        <option value="gram" ${o.eenheid==='gram'?'selected':''}>Per gram</option>
      </select>
      <input type="number" min="1" placeholder="${o.eenheid==='gram'?'g/pers':'p/plateau'}" value="${o.perPlateau || ''}"
             onchange="window._sgoUpdate(${i}, 'perPlateau', this.value)">
      <button type="button" class="sgo-remove" onclick="window._sgoRemove(${i})" title="Verwijderen">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`).join('');
}

window._sgoUpdate = function (i, field, value) {
  if (!samengesteldModalOnderdelen[i]) return;
  samengesteldModalOnderdelen[i][field] = field === 'perPlateau' ? (parseFloat(value) || '') : value;
};

window._sgoRemove = function (i) {
  samengesteldModalOnderdelen.splice(i, 1);
  renderSamengesteldOnderdelenLijst();
};

function addSamengesteldOnderdeelRow() {
  samengesteldModalOnderdelen.push({ id: Date.now().toString() + Math.random().toString(36).slice(2, 6), naam: '', eenheid: 'stuk', perPlateau: '' });
  renderSamengesteldOnderdelenLijst();
}

function openAddSamengesteld() {
  document.getElementById('samengesteld-form-title').textContent = 'Samengesteld gerecht toevoegen';
  document.getElementById('samengesteld-id').value = '';
  document.getElementById('samengesteld-productnaam').value = '';
  samengesteldModalOnderdelen = [];
  renderSamengesteldOnderdelenLijst();
  vulSamengesteldProductnaamLijst();
  document.getElementById('samengesteld-modal').style.display = 'flex';
}

function editSamengesteld(id) {
  const g = samengesteldeGerechten.find(g => g.id === id);
  if (!g) return;
  document.getElementById('samengesteld-form-title').textContent = 'Samengesteld gerecht bewerken';
  document.getElementById('samengesteld-id').value = g.id;
  document.getElementById('samengesteld-productnaam').value = g.productNaam;
  samengesteldModalOnderdelen = g.onderdelen.map(o => ({ ...o }));
  renderSamengesteldOnderdelenLijst();
  vulSamengesteldProductnaamLijst();
  document.getElementById('samengesteld-modal').style.display = 'flex';
}

function saveSamengesteldForm() {
  const id = document.getElementById('samengesteld-id').value;
  const productNaam = document.getElementById('samengesteld-productnaam').value.trim();
  const onderdelen = samengesteldModalOnderdelen
    .map(o => ({ id: o.id, naam: (o.naam || '').trim(), eenheid: o.eenheid === 'gram' ? 'gram' : 'stuk', perPlateau: parseFloat(o.perPlateau) }))
    .filter(o => o.naam && o.perPlateau > 0);

  if (!productNaam) { alert('Vul de exacte productnaam in.'); return; }
  if (!onderdelen.length) { alert('Vul minstens één geldig onderdeel in (naam + aantal).'); return; }

  if (id) {
    const g = samengesteldeGerechten.find(g => g.id === id);
    if (g) { g.productNaam = productNaam; g.onderdelen = onderdelen; }
  } else {
    samengesteldeGerechten.push({ id: Date.now().toString(), productNaam, onderdelen });
  }
  saveSamengesteldeGerechten();
  closeSamengesteldModal();
  renderSamengesteldLijst();
  if (typeof window._peRefreshOnShow === 'function') window._peRefreshOnShow();
}

function deleteSamengesteld(id) {
  if (!confirm('Dit samengesteld gerecht verwijderen?')) return;
  samengesteldeGerechten = samengesteldeGerechten.filter(g => g.id !== id);
  saveSamengesteldeGerechten();
  renderSamengesteldLijst();
  if (typeof window._peRefreshOnShow === 'function') window._peRefreshOnShow();
}

function closeSamengesteldModal() {
  document.getElementById('samengesteld-modal').style.display = 'none';
}

function saveGeneralSetting(key, val) {
  appSettings[key] = val;
  saveSuppliers();
  // Pas smallPlatesDefault aan in app.js state
  if (key === 'smallPlates') { smallPlatesDefault = val; render(); }
}

/* ── Leverancier toevoegen/bewerken ── */
function openAddSupplier() {
  document.getElementById('sup-form-title').textContent = 'Nieuwe leverancier';
  document.getElementById('sup-id').value    = '';
  document.getElementById('sup-name').value  = '';
  document.getElementById('sup-email').value = '';
  document.getElementById('sup-color').value = SUPPLIER_COLORS[suppliers.length % SUPPLIER_COLORS.length];
  document.getElementById('supplier-modal').style.display = 'flex';
}

function editSupplier(id) {
  const s = supplierById(id);
  if (!s) return;
  document.getElementById('sup-form-title').textContent = 'Leverancier bewerken';
  document.getElementById('sup-id').value    = s.id;
  document.getElementById('sup-name').value  = s.name;
  document.getElementById('sup-email').value = s.email || '';
  document.getElementById('sup-color').value = s.color;
  document.getElementById('supplier-modal').style.display = 'flex';
}

function saveSupplierForm() {
  const id    = document.getElementById('sup-id').value;
  const name  = document.getElementById('sup-name').value.trim();
  const email = document.getElementById('sup-email').value.trim();
  const color = document.getElementById('sup-color').value;
  if (!name) { alert('Vul een naam in.'); return; }
  if (id) {
    const s = supplierById(id);
    if (s) { s.name = name; s.email = email; s.color = color; }
  } else {
    suppliers.push({ id: Date.now().toString(), name, email, color });
  }
  saveSuppliers();
  closeModal();
  renderSettings();
}

function deleteSupplier(id) {
  if (!confirm('Leverancier verwijderen?')) return;
  suppliers = suppliers.filter(s => s.id !== id);
  // Verwijder toewijzingen
  Object.keys(assignments).forEach(k => { if (assignments[k] === id) delete assignments[k]; });
  saveSuppliers();
  renderSettings();
}

function closeModal() {
  document.getElementById('supplier-modal').style.display = 'none';
}

function assignSupplier(base, supplierId) {
  if (supplierId) assignments[base] = supplierId;
  else delete assignments[base];
  saveSuppliers();
  renderAssignmentList();
}

/* ══════════════════════════════
   EMAIL GENERATIE
   ══════════════════════════════ */
function buildOrderEmails(weekKeyFilter) {
  // Groepeer per leverancier
  const ordersBySupplier = {};

  // Filter rijen: vlees + vis, voor de geselecteerde week
  const safeRows2 = (typeof allRows !== 'undefined') ? allRows : [];
  const filtered = safeRows2.filter(r => {
    if (r.tabId !== 'vlees' && r.tabId !== 'vis') return false;
    if (weekKeyFilter && r.weekKey !== weekKeyFilter) return false;
    return true;
  });

  // Groepeer per basisnaam, dan per leverancier
  const byBase = {};
  filtered.forEach(r => {
    if (!byBase[r.base]) byBase[r.base] = [];
    byBase[r.base].push(r);
  });

  Object.entries(byBase).forEach(([base, rows]) => {
    const suppId = assignments[base];
    if (!suppId) return; // geen leverancier → overslaan
    const supp = supplierById(suppId);
    if (!supp) return;

    if (!ordersBySupplier[suppId]) {
      ordersBySupplier[suppId] = { supp, lines: [] };
    }

    // Bereken totaal gewicht
    const totalKg = rows.reduce((sum, r) => {
      const g = getGrams(r);
      return sum + (g > 0 ? r.persons * g / 1000 : 0);
    }, 0);
    const totalPersons = rows.reduce((s, r) => s + r.persons, 0);

    if (totalKg > 0) {
      ordersBySupplier[suppId].lines.push(`- ${base}: ${totalKg.toFixed(2)} kg (${totalPersons} pers.)`);
    }
  });

  return ordersBySupplier;
}

function openOrderEmails() {
  // Bepaal actieve week uit filter
  const weekSel = document.getElementById('f-week');
  const weekFilter = weekSel?.value || '';
  const weekText = weekFilter
    ? allRows.find(r => r.weekKey === weekFilter)?.weekLabel || weekFilter
    : 'alle weken';

  const orders = buildOrderEmails(weekFilter);

  if (!suppliers.length) {
    alert('Stap 1: Voeg eerst leveranciers toe via de Instellingen tab.');
    return;
  }
  const assigned = Object.keys(assignments);
  if (!assigned.length) {
    if (confirm('Er zijn nog geen producten toegewezen aan leveranciers.\n\nGa naar Instellingen → Producten → Leverancier om dit in te stellen.\n\nNu naar Instellingen gaan?')) {
      switchMode('settings');
    }
    return;
  }
  if (!Object.keys(orders).length) {
    alert('Geen producten gevonden voor de geselecteerde week met een leverancierstoewijzing.');
    return;
  }

  // Toon preview modal
  renderEmailPreview(orders, weekText);
  document.getElementById('email-modal').style.display = 'flex';
}

function renderEmailPreview(orders, weekText) {
  const company = appSettings.company || 'Meesters in Mooie Momenten';
  const container = document.getElementById('email-preview');
  container.innerHTML = Object.values(orders).map(({ supp, lines }) => {
    const subject = encodeURIComponent(`Bestelling ${weekText} — ${company}`);
    const body = encodeURIComponent(
      `Geachte ${supp.name},\n\nHierbij onze bestelling voor ${weekText}:\n\n${lines.join('\n')}\n\nMet vriendelijke groeten,\n${company}`
    );
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(supp.email)}&su=${subject}&body=${body}`;

    return `
    <div class="email-card" style="border-left:4px solid ${supp.color}">
      <div class="email-card-header">
        <div>
          <div class="email-supplier-name" style="color:${supp.color}">${supp.name}</div>
          <div class="email-supplier-addr">${supp.email}</div>
        </div>
        <a href="${gmailUrl}" target="_blank" class="btn-gmail">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Openen in Gmail
        </a>
      </div>
      <div class="email-body">
        <div class="email-subject">Onderwerp: Bestelling ${weekText} — ${company}</div>
        <pre class="email-text">Geachte ${supp.name},

Hierbij onze bestelling voor ${weekText}:

${lines.join('\n')}

Met vriendelijke groeten,
${company}</pre>
      </div>
    </div>`;
  }).join('');
}

function closeEmailModal() {
  document.getElementById('email-modal').style.display = 'none';
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  loadSuppliers();
  loadGroentenAssortiment();
  loadSamengesteldeGerechten();
  // Pas instellingen toe
  if (appSettings.smallPlates) smallPlatesDefault = appSettings.smallPlates;

  document.addEventListener('dataLoaded', () => {
    vulSamengesteldProductnaamLijst();
  });
});
