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
      .filter(r => r.cat === 'vlees' || r.cat === 'vis')
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
    if (r.cat !== 'vlees' && r.cat !== 'vis') return false;
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
  // Pas instellingen toe
  if (appSettings.smallPlates) smallPlatesDefault = appSettings.smallPlates;
});
