/* ══════════════════════════════════════════
   Bestelcalculator — app.js  v5
   Tabbladen: Vlees · Vis · HG Veggie · Groenten ·
              Hapjes · Dessert · Aardappelen · Sausen ·
              Standen · Kids · Food To Share
   ══════════════════════════════════════════ */

/* ── State ── */
let allRows     = [];
let overrides   = {};
let currentView = 'dag';
let activeTab   = 'vlees';
let smallPlatesDefault = 50;
let allEvents   = [];   // ruwe event-data voor feestenoverzicht
let rawData     = [];   // volledige ruwe Excel data
let currentMode = 'calculator'; // 'calculator' | 'feesten'

/* ── Locatie labels ── */
const LOC_LABELS = {
  'TRA': 'Traiteur',
  'MAE': 'Maelstede',
  'HVW': 'Huis van Wonterghem',
  'BIE': 'Bierkasteel',
  'AFH': 'Afhaal',
};
const LOC_COLORS = {
  'TRA': { bg:'#EDF3FB', color:'#1A3F6F' },
  'MAE': { bg:'#D8EEE4', color:'#2D6A4F' },
  'HVW': { bg:'#FDF1ED', color:'#8B2500' },
  'BIE': { bg:'#F3EAF7', color:'#6B3A7D' },
  'AFH': { bg:'#FDF6E3', color:'#8B6A00' },
};

/* ══════════════════════════════
   TAB DEFINITIES
   Elke tab heeft: id, label, icon, description, subcats[]
   Elke subcat heeft: excelName, sub, defaultGrams
   ══════════════════════════════ */
const TABS = [
  {
    id: 'vlees', label: 'Vlees', icon: '🥩', color: '#8B2500', bg: '#FDF0EC',
    desc: 'HG Vlees',
    subcats: [
      { excel: 'HG Vlees',  sub: 'hg_vlees',  defaultGrams: 0 },
    ]
  },
  {
    id: 'vis', label: 'Vis', icon: '🐟', color: '#1A3F6F', bg: '#EBF2FA',
    desc: 'HG Vis · VG Warm',
    subcats: [
      { excel: 'HG Vis',  sub: 'hg_vis',  defaultGrams: 0   },
      { excel: 'VG Warm', sub: 'vg_warm', defaultGrams: 120 },
    ]
  },
  {
    id: 'small_plates', label: 'Small Plates', icon: '🍽️', color: '#3D5A80', bg: '#E8EFF6',
    desc: 'Small Plates',
    subcats: [
      { excel: 'Small Plates', sub: 'small_plates', defaultGrams: 50 },
    ]
  },
  {
    id: 'hg_veggie', label: 'HG Veggie', icon: '🌿', color: '#2D6A4F', bg: '#D8EEE4',
    desc: 'HG Veggie · VG Veggie',
    subcats: [
      { excel: 'HG Veggie', sub: 'hg_veggie', defaultGrams: 0 },
      { excel: 'VG Veggie', sub: 'vg_veggie', defaultGrams: 0 },
    ]
  },
  {
    id: 'groenten', label: 'Groenten', icon: '🥦', color: '#3B6D11', bg: '#EAF3DE',
    desc: 'Groenten & salades · Aardappelen',
    subcats: [
      { excel: 'Groenten & salades',   sub: 'groenten',    defaultGrams: 0 },
      { excel: 'Aardappelbereidingen', sub: 'aardappelen', defaultGrams: 0 },
    ]
  },
  {
    id: 'hapjes', label: 'Hapjes', icon: '🍢', color: '#8B6A00', bg: '#FDF6E3',
    desc: 'Hapje warm · Hapje Koud · Food To Share · Standen',
    subcats: [
      { excel: 'Hapje warm',   sub: 'hapje_warm', defaultGrams: 0 },
      { excel: 'Hapje Koud',   sub: 'hapje_koud', defaultGrams: 0 },
      { excel: 'Food To Share',sub: 'food_share',  defaultGrams: 0 },
      { excel: 'Standen',      sub: 'standen',     defaultGrams: 0 },
    ]
  },
  {
    id: 'streetfood', label: 'Streetfood', icon: '🌮', color: '#C0392B', bg: '#FDECEA',
    desc: 'Streetfood',
    subcats: [
      { excel: 'Streetfood', sub: 'streetfood', defaultGrams: 0 },
    ]
  },
  {
    id: 'dessert', label: 'Dessert', icon: '🍮', color: '#6B3A7D', bg: '#F3EAF7',
    desc: 'Dessert · Desserthapjes',
    subcats: [
      { excel: 'Dessert',       sub: 'dessert',       defaultGrams: 0 },
      { excel: 'Desserthapjes', sub: 'desserthapjes',  defaultGrams: 0 },
      { excel: 'Dessert kids',  sub: 'dessert_kids',   defaultGrams: 0 },
    ]
  },
  {
    id: 'dessertbuffet', label: 'Dessertbuffet', icon: '🎂', color: '#C2185B', bg: '#FCE4EC',
    desc: 'Bakker-bestelling: mini gebakjes & taarten',
    subcats: []
  },
  {
    id: 'sausen', label: 'Sausen', icon: '🫙', color: '#1D6A6A', bg: '#E0F4F4',
    desc: 'Sausen',
    subcats: [
      { excel: 'Sausen', sub: 'sausen', defaultGrams: 0 },
    ]
  },
  {
    id: 'broodjes', label: 'Broodjes', icon: '🥪', color: '#8B6A00', bg: '#FDF6E3',
    desc: 'Broodjes',
    subcats: [
      { excel: 'Broodjes', sub: 'broodjes', defaultGrams: 0 },
    ]
  },
  {
    id: 'soepen', label: 'Soepen & Dranken', icon: '🍵', color: '#2E4057', bg: '#E4ECF4',
    desc: 'Soepen · Warme dranken · Bubbels',
    subcats: [
      { excel: 'Soepen',        sub: 'soepen',        defaultGrams: 0 },
      { excel: 'Warme dranken', sub: 'warme_dranken', defaultGrams: 0 },
      { excel: 'Bubbels',       sub: 'bubbels',       defaultGrams: 0 },
    ]
  },
  {
    id: 'latenight', label: 'Late Night', icon: '🌙', color: '#455A64', bg: '#ECEFF1',
    desc: 'Late Night Snack · Hapje Bordje · VG Koud',
    subcats: [
      { excel: 'Late Night Snack', sub: 'late_night',  defaultGrams: 0 },
      { excel: 'Hapje Bordje',     sub: 'hapje_bordje',defaultGrams: 0 },
      { excel: 'VG Koud',          sub: 'vg_koud',     defaultGrams: 0 },
    ]
  },
  {
    id: 'kids', label: 'Kids', icon: '🧒', color: '#7A3B1E', bg: '#F9EDE8',
    desc: 'HG kids · VG Kids · Kids',
    subcats: [
      { excel: 'HG kids',  sub: 'hg_kids',  defaultGrams: 0 },
      { excel: 'VG Kids',  sub: 'vg_kids',  defaultGrams: 0 },
      { excel: 'Kids',     sub: 'kids',     defaultGrams: 0 },
    ]
  },
];

/* Bouw snelle lookup: excel-categorienaam → { tabId, sub, defaultGrams } */
const EXCEL_TO_TAB = {};
TABS.forEach(tab => {
  tab.subcats.forEach(sc => {
    EXCEL_TO_TAB[sc.excel.toLowerCase()] = { tabId: tab.id, sub: sc.sub, defaultGrams: sc.defaultGrams };
  });
});

const SUBCAT_LABELS = {
  hg_vlees:'HG Vlees', hg_vis:'HG Vis', vg_warm:'VG Warm', small_plates:'Small Plates',
  hg_veggie:'HG Veggie', vg_veggie:'VG Veggie', groenten:'Groenten & salades',
  aardappelen:'Aardappelbereidingen', hapje_warm:'Hapje warm', hapje_koud:'Hapje koud',
  food_share:'Food To Share', streetfood:'Streetfood', standen:'Standen',
  dessert:'Dessert', desserthapjes:'Desserthapjes', dessert_kids:'Dessert kids', dessertbuffet:'Dessertbuffet',
  sausen:'Sausen',
  broodjes:'Broodjes', soepen:'Soepen', warme_dranken:'Warme dranken',
  bubbels:'Bubbels', late_night:'Late Night Snack', hapje_bordje:'Hapje Bordje',
  vg_koud:'VG Koud', hg_kids:'HG Kids', vg_kids:'VG Kids', kids:'Kids',
};

/* ── Naam-opschoning ── */
function baseName(name) {
  return name
    .replace(/\(\d+\s*gr?\)/gi, '')
    .replace(/,?\s*ZONDER\b[^,()]*/gi, '')
    .replace(/^(ZOUTLOOS|VOORGERECHT|SMALL\s+PLATE|REPASSE\s+)\s*/gi, '')
    .replace(/\s+/g, ' ').trim().replace(/[,;]+$/, '').trim()
    || name.trim();
}

function extractGrams(name) {
  const m = name.match(/\((\d+)\s*gr?\)/i);
  return m ? parseInt(m[1]) : null;
}

/* ── Datum ── */
function parseDate(val) {
  if (!val) return '';
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  return val.toString().substring(0, 10);
}

function weekKey(dateStr) {
  if (!dateStr) return 'onbekend';
  const d   = new Date(dateStr);
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const year = tmp.getUTCFullYear();
  const ys   = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil((((tmp - ys) / 86400000) + 1) / 7);
  return `${year}-W${String(week).padStart(2,'0')}`;
}

function weekLabel(dateStr) {
  if (!dateStr) return 'Onbekend';
  const d   = new Date(dateStr);
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const ys   = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((tmp - ys) / 86400000) + 1) / 7);
  const day  = d.getDay() === 0 ? 7 : d.getDay();
  const mon  = new Date(d); mon.setDate(d.getDate() - day + 1);
  const sun  = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt  = dt => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
  return `Week ${week}  ·  ${fmt(mon)} – ${fmt(sun)}`;
}

function dayShort(dateStr) {
  if (!dateStr) return '';
  const DAYS = ['zo','ma','di','wo','do','vr','za'];
  const [y,m,d] = dateStr.split('-');
  const dt = new Date(+y, +m-1, +d);
  return DAYS[dt.getDay()];
}

function formatDate(dateStr) {
  if (!dateStr) return 'Onbekend';
  const [y, m, d] = dateStr.split('-');
  const DAYS   = ['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
  const MONTHS = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
  const dt = new Date(+y, +m-1, +d);
  return `${DAYS[dt.getDay()]} ${+d} ${MONTHS[+m-1]} ${y}`;
}

/* ── File laden ── */
function loadFile(inp) {
  const file = inp.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb   = XLSX.read(e.target.result, { type:'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval:'' });
      processData(data);
    } catch(err) {
      alert('Fout bij het lezen. Controleer of het een geldig Excel-bestand is.');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function processData(data) {
  allRows   = [];
  overrides = {};
  data.forEach((r, i) => {
    const excelCat = (r['Category name'] || '').toString().trim();
    const info     = EXCEL_TO_TAB[excelCat.toLowerCase()];
    if (!info) return;
    const name    = (r['Resource name'] || '').toString().trim();
    if (!name) return;
    const persons = parseInt(r['Number of items']) || 0;
    if (persons <= 0) return;
    const nameGrams   = extractGrams(name);
    const defGrams    = info.sub === 'small_plates' && !nameGrams ? smallPlatesDefault
                      : info.sub === 'vg_warm'      && !nameGrams ? 120
                      : nameGrams || info.defaultGrams;
    const dateStr     = parseDate(r['Event start date']);
    // Dessertbuffet rijen krijgen eigen tabId zodat ze niet in Dessert verschijnen
    const isBuffet = info.tabId === 'dessert' && name.toLowerCase().includes('dessertbuffet');
    allRows.push({
      id: i, name, base: baseName(name),
      tabId: isBuffet ? 'dessertbuffet' : info.tabId,
      sub:   isBuffet ? 'dessertbuffet' : info.sub,
      persons, nameGrams, defaultGrams: defGrams,
      dateStr, weekKey: weekKey(dateStr), weekLabel: weekLabel(dateStr),
      room:  (r['Room name']  || '').toString().trim(),
      rooms: (r['Room name']  || '').toString().trim().split(';').map(s=>s.trim()).filter(Boolean),
      event: (r['Event name'] || '').toString().trim(),
    });
  });
  rawData = data;
  if (typeof loadSuppliers === 'function') loadSuppliers();
  populateFilters();
  updateTabBadges();
  extractEvents(data);
  const resetSidebar = document.getElementById('btn-reset-sidebar');
  if (resetSidebar) resetSidebar.style.display = 'flex';
  render();
  // Refresh productenlijst in instellingen na nieuwe upload
  if (typeof renderAssignmentList === 'function') {
    setTimeout(renderAssignmentList, 50);
  }
  // Notificeer andere modules dat data geladen is
  document.dispatchEvent(new CustomEvent('dataLoaded'));
}

/* ── Gram helpers ── */
function setAllGramsInSubcat(sub, periodKey, val) {
  const g = Math.max(0, parseInt(val) || 0);
  allRows.forEach(r => {
    if (r.sub !== sub) return;
    // In weekoverzicht: filter op weekKey, in dagoverzicht op dateStr
    if (currentView === 'week' && r.weekKey !== periodKey) return;
    if (currentView === 'dag'  && r.dateStr !== periodKey) return;
    overrides[r.id] = g;
  });
  render();
}


function getGrams(row) {
  if (overrides[row.id] !== undefined) return overrides[row.id];
  if (row.sub === 'small_plates' && !row.nameGrams) return smallPlatesDefault;
  if (row.sub === 'vg_warm'      && !row.nameGrams) return 120;
  return row.defaultGrams;
}
function changeG(id, delta) {
  const row = allRows.find(r => r.id === id);
  overrides[id] = Math.max(0, getGrams(row) + delta);
  render();
}
function setG(id, val) {
  overrides[id] = Math.max(0, parseInt(val) || 0);
  render();
}
function setSmallPlatesDefault(val) {
  smallPlatesDefault = Math.max(0, parseInt(val) || 50);
  render();
}

/* ── Filters opvullen ── */
function populateFilters() {
  const dates = [...new Set(allRows.map(r => r.dateStr).filter(Boolean))].sort();
  ['f-date','f-date-week'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<option value="">Alle datums</option>';
    dates.forEach(d => { const o=document.createElement('option'); o.value=d; o.textContent=d; el.appendChild(o); });
  });

  const weeks = [...new Map(allRows.map(r => [r.weekKey, r.weekLabel])).entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  const wsel  = document.getElementById('f-week');
  if (wsel) {
    wsel.innerHTML = '<option value="">Alle weken</option>';
    weeks.forEach(([k,l]) => { const o=document.createElement('option'); o.value=k; o.textContent=l; wsel.appendChild(o); });
  }

  const rooms = [...new Set(allRows.map(r => r.room).filter(Boolean))].sort();
  ['f-room','f-room-week'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<option value="">Alle zalen</option>';
    rooms.forEach(r => { const o=document.createElement('option'); o.value=r; o.textContent=r.length>32?r.slice(0,31)+'…':r; el.appendChild(o); });
  });
}

/* ── Tab badges bijwerken ── */
function updateTabBadges() {
  TABS.forEach(tab => {
    const count = allRows.filter(r => r.tabId === tab.id).length;
    const badge = document.getElementById(`badge-${tab.id}`);
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  });
  // Dessertbuffet badge
  const dbBadge = document.getElementById('badge-dessertbuffet');
  if (dbBadge) {
    const count = allRows.filter(r => r.tabId === 'dessertbuffet').length;
    dbBadge.textContent = count;
    dbBadge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
}

/* ── Tab wisselen ── */
function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.cat-tab').forEach(b => {
    const isActive = b.dataset.tab === tabId;
    b.classList.toggle('active', isActive);
  });
  const spCtrl = document.getElementById('small-plates-ctrl');
  if (spCtrl) spCtrl.style.display = tabId === 'small_plates' ? 'flex' : 'none';
  render();
}

/* ── Draaitabel overzicht ── */
let _ovWk = '', _ovQ = '';
function renderOverzicht(wk, q) {
  const el = document.getElementById('overzicht-content');
  if (!el) return;
  if (!allRows.length) {
    el.innerHTML = '<div class="empty-state">Upload eerst een Excel-bestand.</div>';
    return;
  }

  // Bewaar filterwaarden in module variabelen
  if (wk !== undefined) _ovWk = wk;
  if (q  !== undefined) _ovQ  = q;
  // Lees ook uit DOM als al aanwezig
  const domWk = document.getElementById('ov-week')?.value;
  const domQ  = document.getElementById('ov-search')?.value;
  if (domWk !== undefined && domWk !== null) _ovWk = domWk;
  if (domQ  !== undefined && domQ  !== null) _ovQ  = domQ;

  // Filters
  const weeks = [...new Map(allRows.map(r=>[r.weekKey,r.weekLabel])).entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  const selWk  = _ovWk;
  const selQ   = _ovQ.toLowerCase();

  // Gebruik echte CCM subcategorie labels
  const SUB_LABELS = {
    hg_vlees:'HG Vlees', hg_vis:'HG Vis', vg_warm:'VG Warm', small_plates:'Small Plates',
    hg_veggie:'HG Veggie', vg_veggie:'VG Veggie', groenten:'Groenten & Salades',
    aardappelen:'Aardappelbereidingen', hapje_warm:'Hapje Warm', hapje_koud:'Hapje Koud',
    food_share:'Food To Share', streetfood:'Streetfood', standen:'Standen',
    dessert:'Dessert', desserthapjes:'Desserthapjes', dessert_kids:'Dessert Kids',
    dessertbuffet:'Dessertbuffet', sausen:'Sausen', broodjes:'Broodjes',
    soepen:'Soepen', warme_dranken:'Warme Dranken', bubbels:'Bubbels',
    late_night:'Late Night Snack', hapje_bordje:'Hapje Bordje',
    vg_koud:'VG Koud', hg_kids:'HG Kids', vg_kids:'VG Kids', kids:'Kids',
  };
  const SUB_ORDER = [
    'hg_vlees','hg_vis','vg_warm','small_plates','hg_veggie','vg_veggie',
    'groenten','aardappelen','hapje_warm','hapje_koud','hapje_bordje',
    'food_share','streetfood','standen',
    'dessert','desserthapjes','dessert_kids','dessertbuffet',
    'sausen','broodjes','soepen','warme_dranken','bubbels',
    'late_night','vg_koud','hg_kids','vg_kids','kids'
  ];

  // Filter rijen
  const rows = allRows.filter(r => {
    if (selWk && r.weekKey !== selWk) return false;
    if (selQ && !r.name.toLowerCase().includes(selQ) && !r.base.toLowerCase().includes(selQ)) return false;
    return true;
  });

  // Bouw pivot op basis van sub (echte CCM categorie)
  const pivot = {};
  rows.forEach(r => {
    const sub = r.sub || r.tabId;
    if (!pivot[sub]) pivot[sub] = {};
    const base = r.base || r.name;
    if (!pivot[sub][base]) pivot[sub][base] = 0;
    pivot[sub][base] += r.persons;
  });

  const grandTotal = rows.reduce((s,r)=>s+r.persons,0);

  // Bouw HTML
  const weekOpties = weeks.map(([k,l])=>`<option value="${k}" ${k===selWk?'selected':''}>${l}</option>`).join('');

  let html = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap" class="no-print">
      <select id="ov-week" onchange="renderOverzicht(this.value, undefined)" style="font-family:'Outfit',sans-serif;font-size:13px;padding:7px 11px;border:1px solid #DEDAD4;border-radius:8px;background:#fff;outline:none">
        <option value="">Alle weken</option>${weekOpties}
      </select>
      <input id="ov-search" type="text" placeholder="Zoek product..." oninput="renderOverzicht(undefined, this.value)"
        value="${selQ}" style="font-family:'Outfit',sans-serif;font-size:13px;padding:7px 11px;border:1px solid #DEDAD4;border-radius:8px;background:#fff;outline:none;flex:1;min-width:160px">
      <button class="btn btn-primary no-print" onclick="exportOverzichtPDF()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        PDF
      </button>
    </div>
    <div style="background:#fff;border:1px solid #E8E5E0;border-radius:14px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.05)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #E8E5E0;background:#FAFAF8">
        <span style="font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:500">Productoverzicht per categorie</span>
        <span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:600;color:#B8965A">${grandTotal.toLocaleString('nl-BE')} totaal</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#F4F3F0">
            <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#9A9590;border-bottom:1px solid #E8E5E0">Product</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#9A9590;border-bottom:1px solid #E8E5E0;width:120px">Aantal pers.</th>
          </tr>
        </thead>
        <tbody>`;

  // Toon eerst gesorteerde bekende subs, dan eventuele onbekende
  const allSubs = [...new Set([...SUB_ORDER, ...Object.keys(pivot)])];
  allSubs.forEach(catId => {
    if (!pivot[catId]) return;
    const catRows = Object.entries(pivot[catId]).sort((a,b)=>a[0].localeCompare(b[0]));
    const catTotal = catRows.reduce((s,[,v])=>s+v,0);
    if (!catTotal) return;

    html += `
          <tr style="background:#F4F3F0">
            <td colspan="2" style="padding:8px 16px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#5A5550;border-bottom:1px solid #E8E5E0;border-top:2px solid #DEDAD4">
              ${SUB_LABELS[catId]||catId}
              <span style="font-family:'DM Mono',monospace;font-weight:400;font-size:11px;color:#9A9590;margin-left:8px">${catTotal.toLocaleString('nl-BE')}</span>
            </td>
          </tr>`;

    catRows.forEach(([base, pers]) => {
      html += `
          <tr style="border-bottom:1px solid #F4F3F0" onmouseover="this.style.background='#FAFAF8'" onmouseout="this.style.background=''">
            <td style="padding:9px 16px 9px 28px;color:#1A1917">${base}</td>
            <td style="padding:9px 16px;text-align:right;font-family:'DM Mono',monospace;font-weight:600;font-size:14px">${pers.toLocaleString('nl-BE')}</td>
          </tr>`;
    });
  });

  html += `
        </tbody>
      </table>
    </div>`;

  el.innerHTML = html;
}

/* ── PDF export draaitabel ── */
async function exportOverzichtPDF() {
  if (!window.jspdf) {
    await new Promise((res,rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 16; let y = 0;

  const SUB_LABELS = {
    hg_vlees:'HG Vlees', hg_vis:'HG Vis', vg_warm:'VG Warm', small_plates:'Small Plates',
    hg_veggie:'HG Veggie', vg_veggie:'VG Veggie', groenten:'Groenten & Salades',
    aardappelen:'Aardappelbereidingen', hapje_warm:'Hapje Warm', hapje_koud:'Hapje Koud',
    food_share:'Food To Share', streetfood:'Streetfood', standen:'Standen',
    dessert:'Dessert', desserthapjes:'Desserthapjes', dessert_kids:'Dessert Kids',
    dessertbuffet:'Dessertbuffet', sausen:'Sausen', broodjes:'Broodjes',
    soepen:'Soepen', warme_dranken:'Warme Dranken', bubbels:'Bubbels',
    late_night:'Late Night Snack', hapje_bordje:'Hapje Bordje',
    vg_koud:'VG Koud', hg_kids:'HG Kids', vg_kids:'VG Kids', kids:'Kids',
  };
  const SUB_ORDER = [
    'hg_vlees','hg_vis','vg_warm','small_plates','hg_veggie','vg_veggie',
    'groenten','aardappelen','hapje_warm','hapje_koud','hapje_bordje',
    'food_share','streetfood','standen',
    'dessert','desserthapjes','dessert_kids','dessertbuffet',
    'sausen','broodjes','soepen','warme_dranken','bubbels',
    'late_night','vg_koud','hg_kids','vg_kids','kids'
  ];

  const selWk = document.getElementById('ov-week')?.value || '';
  const rows  = allRows.filter(r => !selWk || r.weekKey === selWk);
  const pivot = {};
  rows.forEach(r => {
    const sub = r.sub || r.tabId;
    if (!pivot[sub]) pivot[sub] = {};
    const base = r.base || r.name;
    if (!pivot[sub][base]) pivot[sub][base] = 0;
    pivot[sub][base] += r.persons;
  });

  // Header
  doc.setFillColor(17,17,16); doc.rect(0,0,210,16,'F');
  doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(184,150,90);
  doc.text('HUIS VAN WONTERGHEM — KEUKENAPP', margin, 10);
  doc.setTextColor(255,255,255);
  doc.text('Productoverzicht', 210-margin, 10, {align:'right'});
  y = 24;

  doc.setFontSize(16); doc.setFont('helvetica','bold'); doc.setTextColor(26,25,23);
  doc.text('Productoverzicht per categorie', margin, y); y += 10;

  const allSubsPDF = [...new Set([...SUB_ORDER, ...Object.keys(pivot)])];
  allSubsPDF.forEach(catId => {
    if (!pivot[catId]) return;
    const catRows = Object.entries(pivot[catId]).sort((a,b)=>a[0].localeCompare(b[0]));
    const catTotal = catRows.reduce((s,[,v])=>s+v,0);
    if (!catTotal) return;

    if (y > 270) { doc.addPage(); y = 16; }

    // Categorie header
    doc.setFillColor(244,243,240); doc.rect(margin, y-4, 210-margin*2, 8, 'F');
    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(90,85,80);
    doc.text((SUB_LABELS[catId]||catId).toUpperCase(), margin+2, y+0.5);
    doc.setTextColor(154,144,129);
    doc.text(catTotal.toLocaleString('nl-BE'), 210-margin-2, y+0.5, {align:'right'});
    y += 8;

    catRows.forEach(([base, pers]) => {
      if (y > 280) { doc.addPage(); y = 16; }
      doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(26,25,23);
      const baseLines = doc.splitTextToSize(base, 145);
      doc.text(baseLines, margin+8, y);
      doc.setFont('helvetica','bold');
      doc.text(pers.toLocaleString('nl-BE'), 210-margin-2, y, {align:'right'});
      y += baseLines.length * 5 + 1.5;
    });
    y += 3;
  });

  // Footer
  doc.setFontSize(8); doc.setTextColor(180,174,170);
  doc.text('Huis van Wonterghem — Keukenapp', margin, 292);
  doc.text(new Date().toLocaleDateString('nl-BE'), 210-margin, 292, {align:'right'});

  doc.save(`HVW_Productoverzicht_${new Date().toLocaleDateString('nl-BE').replace(/\//g,'-')}.pdf`);
}

/* ── Injecteer overzicht module container ── */
document.addEventListener('DOMContentLoaded', function() {
  const wrap = document.createElement('div');
  wrap.id = 'overzicht-content';
  wrap.style.cssText = 'display:none;padding:26px 28px;';
  const appWrap = document.getElementById('app-wrap') || document.body;
  appWrap.appendChild(wrap);
});

/* ── View wisselen dag/week ── */
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view-tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));
  const _d = document.getElementById('dag-section');  if(_d)  _d.style.display  = view==='dag'  ? 'block' : 'none';
  const _w = document.getElementById('week-section'); if(_w) _w.style.display = view==='week' ? 'block' : 'none';
  render();
}

/* ── Filteren ── */
function getFiltered(mode) {
  const date = document.getElementById(mode==='dag'?'f-date':'f-date-week')?.value || '';
  const week = mode==='week' ? (document.getElementById('f-week')?.value||'') : '';
  const room = document.getElementById(mode==='dag'?'f-room':'f-room-week')?.value || '';
  const q    = (document.getElementById(mode==='dag'?'f-search':'f-search-week')?.value||'').toLowerCase();
  return allRows.filter(r => {
    if (r.tabId !== activeTab) return false;
    if (date && r.dateStr !== date) return false;
    if (week && r.weekKey !== week) return false;
    if (room && r.room   !== room)  return false;
    if (q && !r.name.toLowerCase().includes(q) && !r.base.toLowerCase().includes(q)) return false;
    return true;
  });
}

/* ── Dessertbuffet helpers ── */
function isDessertbuffet(name) {
  return name.toLowerCase().includes('dessertbuffet');
}

function calcBakker(persons) {
  const miniGebakjes = persons / 1.5;
  const taarten      = Math.ceil(miniGebakjes / 8);
  return { miniGebakjes: Math.round(miniGebakjes), taarten };
}

/* ── Speciale render voor dessertbuffet tab ── */
function renderDessertbuffet(mode) {
  const date  = document.getElementById(mode==='dag'?'f-date':'f-date-week')?.value || '';
  const week  = mode==='week' ? (document.getElementById('f-week')?.value||'') : '';
  const room  = document.getElementById(mode==='dag'?'f-room':'f-room-week')?.value || '';
  const q     = (document.getElementById(mode==='dag'?'f-search':'f-search-week')?.value||'').toLowerCase();

  // Filter: rijen met tabId 'dessertbuffet'
  const filtered = allRows.filter(r => {
    if (r.tabId !== 'dessertbuffet') return false;
    if (date && r.dateStr !== date) return false;
    if (week && r.weekKey !== week) return false;
    if (room && r.room   !== room)  return false;
    if (q && !r.name.toLowerCase().includes(q)) return false;
    return true;
  });

  const container = document.getElementById(mode==='dag' ? 'dag-cards' : 'week-cards');
  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state">Geen dessertbuffetten gevonden.</div>';
    renderDessertStats([]);
    return;
  }

  // Groepeer per dag of week
  const groupKey = mode==='dag' ? (r => r.dateStr) : (r => r.weekKey);
  const groupLabel = mode==='dag' ? (r => formatDate(r.dateStr)) : (r => r.weekLabel);
  const byPeriod = groupBy(filtered, groupKey);

  container.innerHTML = Object.entries(byPeriod).sort(([a],[b])=>a.localeCompare(b)).map(([key, rows]) => {
    const title = groupLabel(rows[0]);

    // Per zaal: gebruik de room van de dessertbuffet-rij zelf (niet splitsen)
    const zaalMap = {};
    rows.forEach(r => {
      const zaal = r.room || 'Onbekend';
      if (!zaalMap[zaal]) zaalMap[zaal] = 0;
      zaalMap[zaal] += r.persons;
    });
    let totalPersonsDay = rows.reduce((s,r) => s+r.persons, 0);
    let zaalRows = '';

    Object.entries(zaalMap).sort(([a],[b])=>a.localeCompare(b)).forEach(([room, persons]) => {
      const { miniGebakjes, taarten } = calcBakker(persons);
      zaalRows += `
      <tr class="buffet-zaal-row">
        <td class="buffet-zaal-name">${room}</td>
        <td class="buffet-num">${persons}</td>
        <td class="buffet-num buffet-mini">${miniGebakjes}</td>
        <td class="buffet-num buffet-taart">${taarten} <span class="buffet-taart-label">taarten</span></td>
      </tr>`;
    });

    const dayCalc = calcBakker(totalPersonsDay);

    return `
    <div class="period-card" style="--tab-color:#C2185B">
      <div class="period-header" onclick="toggleCard(this)">
        <span class="period-title">${title}</span>
        <span class="period-badges">
          <span class="badge" style="background:#FCE4EC;color:#C2185B;border:1px solid #C2185B44">
            ${totalPersonsDay} pers · ${dayCalc.miniGebakjes} mini's · ${dayCalc.taarten} taarten
          </span>
        </span>
        <span class="period-toggle open">&#8964;</span>
      </div>
      <div class="period-body">
        <div class="subcat-section-header" style="border-left:4px solid #C2185B;background:#FCE4EC">
          <span class="subcat-section-title" style="color:#C2185B">Per zaal</span>
        </div>
        <table class="prod-table buffet-table">
          <thead>
            <tr>
              <th style="width:40%">Zaal</th>
              <th style="width:15%;text-align:center">Personen</th>
              <th style="width:20%;text-align:center">Mini gebakjes</th>
              <th style="width:25%;text-align:center">Taarten (÷8)</th>
            </tr>
          </thead>
          <tbody>
            ${zaalRows}
            <tr class="buffet-day-total">
              <td>Totaal ${mode==='dag'?formatDate(key):rows[0].weekLabel}</td>
              <td class="buffet-num">${totalPersonsDay}</td>
              <td class="buffet-num buffet-mini">${dayCalc.miniGebakjes}</td>
              <td class="buffet-num buffet-taart">${dayCalc.taarten} <span class="buffet-taart-label">taarten</span></td>
            </tr>
          </tbody>
        </table>
        <div class="buffet-formula-note">
          Formule: personen ÷ 1.5 = mini gebakjes &nbsp;·&nbsp; mini gebakjes ÷ 8 = taarten (afgerond naar boven)
        </div>
      </div>
    </div>`;
  }).join('');

  renderDessertStats(filtered);
}

function renderDessertStats(filtered) {
  const totalPersons   = filtered.reduce((s,r) => s+r.persons, 0);
  const totalMini      = Math.round(totalPersons / 1.5);
  const totalTaarten   = Math.ceil(totalMini / 8);
  document.getElementById('stats').innerHTML = `
    <div class="stat"><div class="stat-label">Buffetten</div><div class="stat-val" style="color:#C2185B">${filtered.length}</div></div>
    <div class="stat"><div class="stat-label">Personen totaal</div><div class="stat-val" style="color:#C2185B">${totalPersons}</div></div>
    <div class="stat"><div class="stat-label">Mini gebakjes</div><div class="stat-val" style="color:#C2185B">${totalMini}</div></div>
    <div class="stat"><div class="stat-label">Taarten (bakker)</div><div class="stat-val" style="color:#C2185B">${totalTaarten}</div></div>
  `;
}

/* ══════════════════════════════ RENDER ══════════════════════════════ */
function render() {
  const tab = TABS.find(t => t.id === activeTab);

  // Small Plates instelling tonen/verbergen
  const ctrl = document.getElementById('small-plates-ctrl');
  if (ctrl) {
    const hasSmallPlates = activeTab === 'small_plates';
    ctrl.style.display = hasSmallPlates ? 'flex' : 'none';
  }

  // Actieve tab kleur toepassen op header-lijn
  const indicator = document.getElementById('tab-indicator');
  if (indicator && tab) indicator.style.background = tab.color;

  if (activeTab === 'dessertbuffet') {
    if (currentView === 'dag') renderDessertbuffet('dag');
    else renderDessertbuffet('week');
  } else if (activeTab === 'dessert') {
    if (currentView === 'dag') renderDessertSimple('dag');
    else renderDessertSimple('week');
    renderStats();
  } else {
    if (currentView === 'dag') renderDag();
    else renderWeek();
    renderStats();
  }
}

function renderDag() {
  const filtered  = getFiltered('dag');
  const container = document.getElementById('dag-cards');
  if (!filtered.length) { container.innerHTML='<div class="empty-state">Geen producten gevonden voor deze categorie.</div>'; return; }
  const byDate = groupBy(filtered, r => r.dateStr||'Onbekend');
  container.innerHTML = Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b))
    .map(([date,rows]) => buildPeriodCard(date, formatDate(date), rows)).join('');
}

function renderWeek() {
  const filtered  = getFiltered('week');
  const container = document.getElementById('week-cards');
  if (!filtered.length) { container.innerHTML='<div class="empty-state">Geen producten gevonden voor deze categorie.</div>'; return; }
  const byWeek = groupBy(filtered, r => r.weekKey);
  container.innerHTML = Object.entries(byWeek).sort(([a],[b])=>a.localeCompare(b))
    .map(([wk,rows]) => buildPeriodCard(wk, rows[0].weekLabel, rows)).join('');
}

function renderStats() {
  const tab      = TABS.find(t => t.id === activeTab);
  const filtered = getFiltered(currentView);
  const subcatTots = {};
  let grandKg = 0;
  filtered.forEach(r => {
    const g = getGrams(r);
    if (!subcatTots[r.sub]) subcatTots[r.sub] = 0;
    if (g > 0) { subcatTots[r.sub] += r.persons*g/1000; grandKg += r.persons*g/1000; }
  });

  let items = [{ label:'Producten', val: filtered.length, color: '#666' }];
  // Subcat uitsplitsing (alleen als tab meerdere subcats heeft met gewichten)
  if (tab && tab.subcats.length > 1) {
    tab.subcats.forEach(sc => {
      if (subcatTots[sc.sub] > 0)
        items.push({ label: SUBCAT_LABELS[sc.sub], val: subcatTots[sc.sub].toFixed(1)+' kg', color: tab.color });
    });
  }
  if (grandKg > 0)
    items.push({ label: `${tab?.label || ''} totaal`, val: grandKg.toFixed(1)+' kg', color: tab?.color || '#666' });

  document.getElementById('stats').innerHTML = items.map(i =>
    `<div class="stat">
      <div class="stat-label">${i.label}</div>
      <div class="stat-val" style="color:${i.color}">${i.val}</div>
    </div>`
  ).join('');
}

/* ══════════════════════════════ DESSERT EENVOUDIGE RENDER (geen gewichten) ══════════════════════════════ */
function renderDessertSimple(mode) {
  const filtered  = getFiltered(mode);
  const container = document.getElementById(mode==='dag' ? 'dag-cards' : 'week-cards');
  if (!filtered.length) { container.innerHTML='<div class="empty-state">Geen desserts gevonden.</div>'; return; }
  const byPeriod  = mode==='dag'
    ? groupBy(filtered, r => r.dateStr||'Onbekend')
    : groupBy(filtered, r => r.weekKey);
  const titleFn   = mode==='dag'
    ? ([date]) => formatDate(date)
    : ([wk, rows]) => rows[0].weekLabel;

  container.innerHTML = Object.entries(byPeriod).sort(([a],[b])=>a.localeCompare(b)).map(([key, rows]) => {
    const tab         = TABS.find(t => t.id === 'dessert');
    const totalPers   = rows.reduce((s,r) => s+r.persons, 0);
    const title       = mode==='dag' ? formatDate(key) : rows[0].weekLabel;

    // Groepeer per subcat, dan per basisnaam
    const subcatOrder = tab.subcats.map(sc => sc.sub);
    let blocks = '';

    subcatOrder.forEach(sub => {
      const subRows = rows.filter(r => r.sub === sub);
      if (!subRows.length) return;
      const tabColor = tab.color;
      const byBase   = groupBy(subRows, r => r.base);
      let bodies = '';
      let subcatPersons = 0;

      Object.entries(byBase).sort(([a],[b])=>a.localeCompare(b)).forEach(([base, variants], colorIdx) => {
        const color      = PRODUCT_COLORS[colorIdx % PRODUCT_COLORS.length];
        let basePersons  = 0;
        let variantRows  = '';

        variants.forEach(r => {
          basePersons += r.persons;
          const roomShort = r.room.length>22 ? r.room.slice(0,21)+'…' : r.room;
          variantRows += `
          <tr class="variant-row" style="border-left:3px solid ${color.stripe}">
            <td style="padding-left:22px;color:var(--text-muted);font-size:12px" title="${r.name.replace(/"/g,'&quot;')}">${r.name.length>55?r.name.slice(0,54)+'…':r.name}</td>
            <td style="color:var(--text-muted);font-size:11px" title="${r.room}">${roomShort}</td>
            <td style="text-align:center;font-family:'DM Mono',monospace;font-weight:500">${r.persons}</td>
          </tr>`;
        });

        subcatPersons += basePersons;

        bodies += `
        <tbody class="product-group" data-idx="${colorIdx}">
          <tr class="product-name-row" style="background:${color.bg};border-left:4px solid ${color.stripe}">
            <td colspan="3" style="padding:7px 14px;font-weight:600;font-size:13px;color:${color.text}">${base}</td>
          </tr>
          ${variantRows}
          <tr class="subtotal-row" style="border-left:4px solid ${color.stripe}">
            <td style="padding-left:22px;color:var(--text-muted);font-size:12px">Totaal ${base}</td>
            <td></td>
            <td style="text-align:center;font-family:'DM Mono',monospace;font-weight:600;color:${color.text}">${basePersons} p</td>
          </tr>
          <tr class="group-spacer"><td colspan="3"></td></tr>
        </tbody>`;
      });

      blocks += `
      <div class="cat-block">
        <div class="subcat-section-header" style="border-left:4px solid ${tabColor};background:${tab.bg}">
          <span class="subcat-section-title" style="color:${tabColor}">${SUBCAT_LABELS[sub]||sub}</span>
          <span class="subcat-section-total" style="color:${tabColor}">${subcatPersons} pers</span>
        </div>
        <table class="prod-table">
          <thead>
            <tr>
              <th style="width:60%">Product</th>
              <th style="width:22%">Zaal</th>
              <th style="width:18%;text-align:center">Personen</th>
            </tr>
          </thead>
          ${bodies}
          <tbody>
            <tr class="cat-total-row">
              <td>Totaal ${SUBCAT_LABELS[sub]||sub}</td>
              <td></td>
              <td style="text-align:center;font-family:'DM Mono',monospace;font-weight:700;color:${tabColor}">${subcatPersons} p</td>
            </tr>
          </tbody>
        </table>
      </div>`;
    });

    return `
    <div class="period-card" style="--tab-color:${tab.color}">
      <div class="period-header" onclick="toggleCard(this)">
        <span class="period-title">${title}</span>
        <span class="period-badges">
          <span class="badge" style="background:${tab.bg};color:${tab.color};border:1px solid ${tab.color}44">${totalPers} personen</span>
        </span>
        <span class="period-toggle open">&#8964;</span>
      </div>
      <div class="period-body">${blocks}</div>
    </div>`;
  }).join('');
}

/* ══════════════════════════════ PERIOD CARD ══════════════════════════════ */
function buildPeriodCard(key, title, rows) {
  const tab = TABS.find(t => t.id === activeTab);
  // Gebruik altijd de volgorde uit de TABS-definitie → subcats nooit door elkaar
  const subcatOrder = tab ? tab.subcats.map(sc => sc.sub) : [...new Set(rows.map(r => r.sub))];
  let blocks = '';
  let grandTotal = 0;
  subcatOrder.forEach(sub => {
    const subRows = rows.filter(r => r.sub === sub);
    if (!subRows.length) return;
    const { html, total } = buildSubcatBlock(sub, subRows, key);
    blocks += html;
    grandTotal += total;
  });

  const totalStr = grandTotal > 0 ? `${tab?.label}: ${grandTotal.toFixed(1)} kg` : tab?.label || '';

  return `
  <div class="period-card" style="--tab-color:${tab?.color||'#666'}">
    <div class="period-header" onclick="toggleCard(this)">
      <span class="period-title">${title}</span>
      <span class="period-badges">
        ${grandTotal > 0 ? `<span class="badge" style="background:${tab?.bg};color:${tab?.color};border:1px solid ${tab?.color}44">${totalStr}</span>` : ''}
      </span>
      <span class="period-toggle open">&#8964;</span>
    </div>
    <div class="period-body">${blocks}</div>
  </div>`;
}

/* ══════════════════════════════ SUBCAT BLOK ══════════════════════════════ */
const PRODUCT_COLORS = [
  { stripe:'#8B2500', bg:'#FDF0EC', text:'#8B2500' },
  { stripe:'#1A3F6F', bg:'#EBF2FA', text:'#1A3F6F' },
  { stripe:'#2D6A4F', bg:'#D8EEE4', text:'#2D6A4F' },
  { stripe:'#6B3A7D', bg:'#F3EAF7', text:'#6B3A7D' },
  { stripe:'#8B6A00', bg:'#FDF6E3', text:'#8B6A00' },
  { stripe:'#1D6A6A', bg:'#E0F4F4', text:'#1D6A6A' },
  { stripe:'#7A3B1E', bg:'#F9EDE8', text:'#7A3B1E' },
  { stripe:'#3D5A80', bg:'#E8EFF6', text:'#3D5A80' },
  { stripe:'#5C4A1E', bg:'#F5EFE0', text:'#5C4A1E' },
  { stripe:'#2E4057', bg:'#E4ECF4', text:'#2E4057' },
];

function buildSubcatBlock(sub, rows, periodKey='') {
  const tab      = TABS.find(t => t.id === activeTab);
  const tabColor = tab?.color || '#666';
  const byBase   = groupBy(rows, r => r.base);
  const baseEntries = Object.entries(byBase).sort(([a],[b]) => a.localeCompare(b));
  let bodies = '';
  let subcatTotal = 0;
  let subcatPersons = 0;

  baseEntries.forEach(([base, variants], colorIdx) => {
    const color = PRODUCT_COLORS[colorIdx % PRODUCT_COLORS.length];
    let baseTotal = 0;
    let basePersons = 0;
    let variantRows = '';

    variants.forEach(r => {
      const g  = getGrams(r);
      const kg = g > 0 ? r.persons*g/1000 : 0;
      baseTotal   += kg;
      basePersons += r.persons;

      let variantLabel;
      if (r.nameGrams)              variantLabel = `${r.nameGrams} gr`;
      else if (sub==='vg_warm')     variantLabel = `${g} gr (VG std)`;
      else if (sub==='small_plates') variantLabel = `${g} gr (SP std)`;
      else                          variantLabel = r.name.length>50 ? r.name.slice(0,49)+'…' : r.name;

      const dagLabel = currentView === 'week' ? `<span class="day-tag">${dayShort(r.dateStr)}</span>` : '';
      variantRows += `
      <tr class="variant-row" style="border-left:3px solid ${color.stripe}">
        <td style="padding-left:22px;color:var(--text-muted);font-size:12px" title="${r.name.replace(/"/g,'&quot;')}">${variantLabel}</td>
        <td style="color:var(--text-muted);font-size:11px" title="${r.room}">${dagLabel}${r.room.length>18?r.room.slice(0,17)+'…':r.room}</td>
        <td style="text-align:center;font-family:'DM Mono',monospace">${r.persons}</td>
        <td>
          <div class="qty-cell no-print">
            <button class="qty-btn" onclick="changeG(${r.id},-10)">−</button>
            <input class="qty-input" type="number" min="0" step="10" value="${g}" onchange="setG(${r.id},this.value)">
            <span class="unit-label">gr</span>
            <button class="qty-btn" onclick="changeG(${r.id},10)">+</button>
          </div>
          <span class="print-only" style="display:none;font-family:'DM Mono',monospace;font-size:12px">${g}gr</span>
        </td>
        <td class="weight-val" style="text-align:right">${kg>0 ? kg.toFixed(2)+' kg':'—'}</td>
      </tr>`;
    });

    subcatTotal   += baseTotal;
    subcatPersons += basePersons;

    bodies += `
    <tbody class="product-group" data-idx="${colorIdx}">
      <tr class="product-name-row" style="background:${color.bg};border-left:4px solid ${color.stripe}">
        <td colspan="5" style="padding:10px 14px;font-weight:600;font-size:14px;color:${color.text}">${base}</td>
      </tr>
      ${variantRows}
      <tr class="subtotal-row" style="border-left:4px solid ${color.stripe};background:${color.bg}">
        <td style="color:${color.text}">↳ Totaal ${base}</td>
        <td></td>
        <td style="text-align:center;color:${color.text}">${basePersons} p</td>
        <td></td>
        <td style="color:${color.text};text-align:right">${baseTotal>0 ? baseTotal.toFixed(2)+' kg':'—'}</td>
      </tr>
    </tbody>
    <tbody class="group-spacer-body"><tr><td colspan="5" style="height:16px;background:var(--bg);border:none;padding:0"></td></tr></tbody>`;
  });

  // Bepaal de meest voorkomende gram-waarde in deze subcat als suggestie
  const gramValues = baseEntries.flatMap(([,variants]) => variants.map(r => getGrams(r))).filter(g => g > 0);
  const suggestGram = gramValues.length ? Math.round(gramValues.reduce((a,b)=>a+b,0)/gramValues.length) : 0;

  return {
    html: `
    <div class="cat-block">
      <div class="subcat-section-header" style="border-left:4px solid ${tabColor};background:${tab?.bg||'#f5f5f5'}">
        <span class="subcat-section-title" style="color:${tabColor}">${SUBCAT_LABELS[sub]||sub}</span>
        <div class="bulk-gram-ctrl no-print">
          <span class="bulk-gram-label" style="color:${tabColor}">Alles instellen op:</span>
          <div class="bulk-gram-inputs">
            <button class="bulk-gram-btn" style="border-color:${tabColor};color:${tabColor}" onclick="setAllGramsInSubcat('${sub}','${periodKey}',document.getElementById('bulk-${sub}-${periodKey}').value-10)">−</button>
            <input class="bulk-gram-input" id="bulk-${sub}-${periodKey}" type="number" min="0" step="10" value="${suggestGram}" placeholder="gr" style="border-color:${tabColor}20;outline-color:${tabColor}">
            <button class="bulk-gram-btn" style="border-color:${tabColor};color:${tabColor}" onclick="setAllGramsInSubcat('${sub}','${periodKey}',parseInt(document.getElementById('bulk-${sub}-${periodKey}').value||0)+10)">+</button>
            <button class="bulk-gram-apply" style="background:${tabColor};color:#fff" onclick="setAllGramsInSubcat('${sub}','${periodKey}',document.getElementById('bulk-${sub}-${periodKey}').value)">Toepassen</button>
          </div>
        </div>
        ${subcatTotal > 0 ? `<span class="subcat-section-total" style="color:${tabColor}">${subcatPersons} pers · ${subcatTotal.toFixed(2)} kg</span>` : ''}
      </div>
      <table class="prod-table">
        <thead>
          <tr>
            <th style="width:28%">Product</th>
            <th style="width:22%">Zaal</th>
            <th style="width:9%;text-align:center">Pers.</th>
            <th style="width:24%">Gewicht/p</th>
            <th style="width:17%;text-align:right">Totaal</th>
          </tr>
        </thead>
        ${bodies}
        <tbody>
          <tr class="cat-total-row">
            <td>Totaal ${SUBCAT_LABELS[sub]||sub}</td>
            <td></td>
            <td style="text-align:center;font-family:'DM Mono',monospace;font-weight:700;color:${tabColor}">${subcatPersons} p</td>
            <td></td>
            <td class="weight-val" style="color:${tabColor};text-align:right">${subcatTotal > 0 ? subcatTotal.toFixed(2)+' kg' : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>`,
    total: subcatTotal
  };
}

/* ── Hulpfuncties ── */
function groupBy(arr, fn) {
  return arr.reduce((acc, item) => {
    const key = fn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function toggleCard(header) {
  const body   = header.nextElementSibling;
  const toggle = header.querySelector('.period-toggle');
  body.classList.toggle('collapsed');
  toggle.classList.toggle('open', !body.classList.contains('collapsed'));
}

function doPrint() {
  document.querySelectorAll('.no-print').forEach(el => el.style.visibility='hidden');
  document.querySelectorAll('.print-only').forEach(el => el.style.display='inline');
  window.print();
  document.querySelectorAll('.no-print').forEach(el => el.style.visibility='');
  document.querySelectorAll('.print-only').forEach(el => el.style.display='none');
}

/* ══════════════════════════════
   FEESTENOVERZICHT
   ══════════════════════════════ */

function extractEvents(data) {
  // Groepeer per Booking ID → 1 rij per feest (zelfde booking = zelfde feest)
  const eventMap = {};
  data.forEach(r => {
    const bookingId = (r['Booking ID'] || '').toString().trim();
    const room      = (r['Room name']  || '').toString().trim();
    const date      = parseDate(r['Event start date']);
    if (!bookingId || !room || !date) return;

    const time     = (r['Event start time'] || '').toString().trim();
    const persons  = parseInt(r['Number of items']) || 0;
    const location = (r['Location'] || '').toString().trim();

    if (!eventMap[bookingId]) {
      eventMap[bookingId] = {
        bookingId,
        date,
        time,
        persons,
        location,
        room,
        weekKey:   weekKey(date),
        weekLabel: weekLabel(date),
      };
    } else {
      // Bewaar vroegste tijdstip
      if (time && (!eventMap[bookingId].time || time < eventMap[bookingId].time)) {
        eventMap[bookingId].time = time;
      }
      // Neem hoogste personen
      if (persons > eventMap[bookingId].persons) {
        eventMap[bookingId].persons = persons;
      }
      // Voeg nieuwe zalen toe (vermijd duplicaten)
      const existingRooms = eventMap[bookingId].room.split(';').map(s=>s.trim());
      const newRooms = room.split(';').map(s=>s.trim()).filter(s => s && !existingRooms.includes(s));
      if (newRooms.length) {
        eventMap[bookingId].room = [...existingRooms, ...newRooms].join('; ');
      }
    }
  });
  allEvents = Object.values(eventMap);
  populateFeestenFilters();
}

function populateFeestenFilters() {
  const weeks = [...new Map(allEvents.map(e => [e.weekKey, e.weekLabel])).entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  const wsel = document.getElementById('ff-week');
  if (wsel) {
    wsel.innerHTML = '<option value="">Alle weken</option>';
    weeks.forEach(([k,l]) => { const o=document.createElement('option'); o.value=k; o.textContent=l; wsel.appendChild(o); });
  }
  const dates = [...new Set(allEvents.map(e => e.date).filter(Boolean))].sort();
  const dsel = document.getElementById('ff-date');
  if (dsel) {
    dsel.innerHTML = '<option value="">Alle dagen</option>';
    dates.forEach(d => { const o=document.createElement('option'); o.value=d; o.textContent=formatDate(d); dsel.appendChild(o); });
  }
  const locs = [...new Set(allEvents.map(e => e.location).filter(Boolean))].sort();
  const lsel = document.getElementById('ff-loc');
  if (lsel) {
    lsel.innerHTML = '<option value="">Alle locaties</option>';
    locs.forEach(l => { const o=document.createElement('option'); o.value=l; o.textContent=LOC_LABELS[l]||l; lsel.appendChild(o); });
  }
}

function switchMode(mode) {
  currentMode = mode;
  if (typeof sbShow === 'function') sbShow(mode);
}

function renderFeesten() {
  const week = document.getElementById('ff-week')?.value || '';
  const loc  = document.getElementById('ff-loc')?.value  || '';
  const q    = (document.getElementById('ff-search')?.value || '').toLowerCase();

  const date = document.getElementById('ff-date')?.value || '';
  const sort = document.getElementById('ff-sort')?.value || 'time';

  let filtered = allEvents.filter(e => {
    if (week && e.weekKey  !== week) return false;
    if (date && e.date     !== date) return false;
    if (loc  && e.location !== loc)  return false;
    if (q    && !e.room.toLowerCase().includes(q) && !(LOC_LABELS[e.location]||'').toLowerCase().includes(q)) return false;
    return true;
  });

  const container = document.getElementById('feesten-cards');
  if (!filtered.length) { container.innerHTML = '<div class="empty-state">Geen feesten gevonden.</div>'; return; }

  // Groepeer per dag
  const byDate = groupBy(filtered, e => e.date || 'Onbekend');

  container.innerHTML = Object.entries(byDate).sort(([a],[b])=>a.localeCompare(b)).map(([date, events]) => {
    const dayPersons = events.reduce((s,e) => s + e.persons, 0);
    // Uitsplitsing per locatie
    const locTotals = {};
    events.forEach(e => {
      const key = e.location || '?';
      if (!locTotals[key]) locTotals[key] = 0;
      locTotals[key] += e.persons;
    });
    const locBadges = Object.entries(locTotals)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([loc, pers]) => {
        const lc = LOC_COLORS[loc] || { bg:'#f5f5f5', color:'#666' };
        return `<span class="feest-loc-total" style="background:${lc.bg};color:${lc.color}">
          <span class="loc-code">${loc}</span> ${LOC_LABELS[loc]||loc}: <strong>${pers}</strong>
        </span>`;
      }).join('');

    const sortFn = sort === 'room_asc'      ? (a,b) => a.room.localeCompare(b.room)
                 : sort === 'room_desc'     ? (a,b) => b.room.localeCompare(a.room)
                 : sort === 'persons_asc'   ? (a,b) => a.persons - b.persons
                 : sort === 'persons_desc'  ? (a,b) => b.persons - a.persons
                 : sort === 'loc_asc'       ? (a,b) => (a.location||'').localeCompare(b.location||'')
                 : sort === 'loc_desc'      ? (a,b) => (b.location||'').localeCompare(a.location||'')
                 : sort === 'time_desc'     ? (a,b) => (b.time||'').localeCompare(a.time||'')
                 : (a,b) => (a.time||'').localeCompare(b.time||'');
    const rows = events
      .sort(sortFn)
      .map(e => {
        const locLabel = LOC_LABELS[e.location] || e.location || '—';
        const rooms    = e.room.split(';').map(r => r.trim()).filter(Boolean);
        const roomStr  = rooms.join(', ') || '—';
        const lc       = LOC_COLORS[e.location] || { bg:'#f5f5f5', color:'#666' };
        // Auto badges voor dit feest
        const carCell  = (typeof window.renderCarCell === 'function')
          ? window.renderCarCell(e.bookingId, date)
          : '';
        return `
        <tr class="feest-row feest-row-clickable" onclick="openDetail('${e.bookingId}')" title="Klik voor details">
          <td class="feest-time">${e.time || '—'}</td>
          <td class="feest-name"><span class="feest-room-main">${roomStr}</span></td>
          <td class="feest-persons">${e.persons}</td>
          <td class="feest-loc">
            <span class="loc-pill" style="background:${lc.bg};color:${lc.color}">
              <span class="loc-code">${e.location}</span>${locLabel}
            </span>
          </td>
          <td class="feest-car-col" onclick="event.stopPropagation()">${carCell}</td>
        </tr>`;
      }).join('');

    return `
    <div class="feest-card">
      <div class="feest-day-header">
        <div class="feest-day-title">
          <span class="feest-date">${formatDate(date)}</span>
        </div>
        <div class="feest-day-meta">
          <span class="feest-count">${events.length} feest${events.length !== 1 ? 'en' : ''}</span>
          ${locBadges}
          <span class="feest-total-pers">${dayPersons} totaal</span>
        </div>
      </div>
      <table class="feest-table">
        <thead>
          <tr>
            <th style="width:8%;cursor:pointer" onclick="cycleSortFeesten('time')">Start <span class="sort-arrow" id="sort-arr-time"></span></th>
            <th style="width:30%;cursor:pointer" onclick="cycleSortFeesten('room')">Zaal <span class="sort-arrow" id="sort-arr-room"></span></th>
            <th style="width:8%;text-align:center;cursor:pointer" onclick="cycleSortFeesten('persons')">Pers. <span class="sort-arrow" id="sort-arr-persons"></span></th>
            <th style="width:25%;cursor:pointer" onclick="cycleSortFeesten('loc')">Locatie <span class="sort-arrow" id="sort-arr-loc"></span></th>
            <th style="width:22%">Auto</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join('');
}

/* ══════════════════════════════
   FEEST DETAIL
   ══════════════════════════════ */

const CAT_ORDER_DETAIL = [
  { cats: ['HG Vlees'],                          label: 'Vlees',       color: '#8B2500', bg: '#FDF1ED' },
  { cats: ['HG Vis'],                            label: 'Vis',         color: '#1A3F6F', bg: '#EDF3FB' },
  { cats: ['VG Warm'],                           label: 'VG Warm',     color: '#1A3F6F', bg: '#EDF3FB' },
  { cats: ['Small Plates'],                      label: 'Small Plates',color: '#3D5A80', bg: '#E8EFF6' },
  { cats: ['HG Veggie','VG Veggie'],             label: 'Veggie',      color: '#2D6A4F', bg: '#D8EEE4' },
  { cats: ['Groenten & salades'],                label: 'Groenten',    color: '#3B6D11', bg: '#EAF3DE' },
  { cats: ['Aardappelbereidingen'],              label: 'Aardappelen', color: '#3B6D11', bg: '#EAF3DE' },
  { cats: ['Hapje warm','Hapje Koud'],           label: 'Hapjes',      color: '#8B6A00', bg: '#FDF6E3' },
  { cats: ['Food To Share','Streetfood','Standen'], label: 'Food To Share / Standen', color: '#8B6A00', bg: '#FDF6E3' },
  { cats: ['Dessert'],                           label: 'Dessert',     color: '#6B3A7D', bg: '#F3EAF7' },
  { cats: ['Desserthapjes'],                     label: 'Desserthapjes',color:'#6B3A7D', bg: '#F3EAF7' },
  { cats: ['Sausen'],                            label: 'Sausen',      color: '#1D6A6A', bg: '#E0F4F4' },
  { cats: ['HG kids','VG Kids','Kids'],          label: 'Kids',        color: '#7A3B1E', bg: '#F9EDE8' },
];

function openDetail(bookingId) {
  const event = allEvents.find(e => e.bookingId === bookingId);
  if (!event) return;

  // Haal alle producten op voor dit booking ID
  const products = rawData.filter(r => (r['Booking ID']||'').toString().trim() === bookingId);

  // Groepeer per categorie
  const byCat = {};
  products.forEach(r => {
    const cat = (r['Category name']||'').toString().trim();
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push({
      name:    (r['Resource name']||'').toString().trim(),
      persons: parseInt(r['Number of items'])||0,
    });
  });

  // Bouw HTML
  const rooms   = event.room.split(';').map(s=>s.trim()).filter(Boolean).join(', ');
  const lc      = LOC_COLORS[event.location] || { bg:'#f5f5f5', color:'#666' };
  const locName = LOC_LABELS[event.location] || event.location;
  const persons = event.persons;

  let blocksHtml = '';
  CAT_ORDER_DETAIL.forEach(group => {
    const rows = [];
    group.cats.forEach(cat => {
      (byCat[cat]||[]).forEach(p => {
        // Vermijd dubbels
        if (!rows.find(r => r.name === p.name)) rows.push(p);
      });
    });
    if (!rows.length) return;

    const rowsHtml = rows.map(p => `
      <tr>
        <td class="detail-prod-name">${p.name}</td>
        <td class="detail-prod-persons">${p.persons}</td>
      </tr>`).join('');

    blocksHtml += `
    <div class="detail-cat-block">
      <div class="detail-cat-header" style="border-left:4px solid ${group.color};background:${group.bg}">
        <span class="detail-cat-title" style="color:${group.color}">${group.label}</span>
        <span class="detail-cat-count" style="color:${group.color}">${rows.length} product${rows.length!==1?'en':''}</span>
      </div>
      <table class="detail-table">
        <thead>
          <tr>
            <th>Product</th>
            <th style="width:100px;text-align:center">Personen</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
  });

  document.getElementById('detail-content').innerHTML = `
    <div class="detail-hero">
      <div class="detail-hero-left">
        <div class="detail-rooms">${rooms}</div>
        <div class="detail-meta">
          <span class="loc-pill" style="background:${lc.bg};color:${lc.color}">
            <span class="loc-code">${event.location}</span>${locName}
          </span>
          <span class="detail-date">${formatDate(event.date)}</span>
          ${event.time ? `<span class="detail-time">· ${event.time}</span>` : ''}
        </div>
      </div>
      <div class="detail-persons-big">${persons}<span>pers.</span></div>
    </div>
    <div class="detail-blocks">${blocksHtml}</div>`;

  // Wissel views
  if (typeof sbShow === 'function') sbShow('feest-detail');
  else {
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    const dd = document.getElementById('page-feest-detail'); if(dd) dd.classList.add('active');
  }
  window.scrollTo(0, 0);
}

function closeDetail() {
  if (typeof sbShow === 'function') sbShow('feesten');
}

function cycleSortFeesten(col) {
  const sel = document.getElementById('ff-sort');
  const cur = sel.value;
  // Toggle richting: als al gesorteerd op deze kolom, wissel richting
  if (cur === col+'_asc')       sel.value = col+'_desc';
  else if (cur === col+'_desc') sel.value = col+'_asc';
  else                          sel.value = col+'_asc';
  // Update pijl-iconen
  ['time','room','persons','loc'].forEach(c => {
    const el = document.getElementById('sort-arr-'+c);
    if (!el) return;
    if (sel.value === c+'_asc')  el.textContent = '↑';
    else if (sel.value === c+'_desc') el.textContent = '↓';
    else el.textContent = '';
  });
  renderFeesten();
}

function resetData() {
  if (!confirm('Huidig Excel-bestand verwijderen? De gewichten en filters worden gewist.')) return;
  allRows   = [];
  overrides = {};
  rawData   = [];
  allEvents = [];
  // Reset UI
  const resetSb = document.getElementById('btn-reset-sidebar'); if(resetSb) resetSb.style.display='none';
  ['ijs-content-wrap','etiketten-content'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
  const vt=document.getElementById('view-tabs'); if(vt) vt.style.display='none';
  // Reset file input
  document.getElementById('xl-input').value = '';
  // Reset mode tabs
  document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
  document.querySelector('.mode-tab[data-mode="calculator"]')?.classList.add('active');
  currentMode = 'calculator';
  // Reset fab
  const fab = document.getElementById('settings-fab-btn');
  if (fab) fab.classList.remove('active');
  // Refresh instellingen productenlijst
  if (typeof renderAssignmentList === 'function') renderAssignmentList();
  if (typeof window._renderIjs === 'function') window._renderIjs();
}

function initDragDrop() {
  const zone = document.getElementById('dash-welcome');
  if (!zone) return;
  if (zone) zone.addEventListener('dragover', e => { e.preventDefault(); });
  if (zone) zone.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const dt = new DataTransfer(); dt.items.add(file);
      document.getElementById('xl-input').files = dt.files;
      loadFile(document.getElementById('xl-input'));
    }
  });
}

document.addEventListener('DOMContentLoaded', initDragDrop);
