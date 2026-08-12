/* ══════════════════════════════════════════
   portie-etiketten.js — Portie-Etiketten Maker
   Productselectie uit de CCM-Excel data, met
   instelbare portieregels (bv. 1 etiket per
   100p) en automatische etikettenberekening.
   Manueel aanpasbaar vóór het printen.
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Zelfde etiket-afmetingen als de andere etiketten-modules ── */
  const LABEL_W  = 65;
  const LABEL_H  = 37;
  const MARGIN_L = 2;
  const MARGIN_T = 1;
  const GAP_X    = 5;
  const GAP_Y    = 0;
  const COLS     = 3;
  const ROWS     = 7;

  const PAK_FORMATEN = ['1/1 emmer', '2/3 emmer', '1/2 emmer', '1/3 emmer', 'GN 1/1', 'GN 1/2', 'Bak', 'Fles', 'Los'];

  const LOC_LABELS = { TRA:'Traiteur', MAE:'Maelstede', HVW:'Huis van Wonterghem', BIE:'Bierkasteel', AFH:'Afhaal' };
  const LOC_COLORS_RGB = {
    TRA: [26, 63, 111], MAE: [45, 106, 79], HVW: [139, 37, 0], BIE: [107, 58, 125], AFH: [139, 106, 0]
  };
  const DEFAULT_COLOR = [184, 150, 90]; // goud

  /* ── State ── */
  let portieRegels = {};   // { productBase: personenPerEtiket }
  let queue = [];          // [{ id, product, zaal, opmerking, aantalEtiketten, personen, pakformaat }]
  let idCounter = 1;

  /* ── Storage ── */
  function saveRegels() {
    try { localStorage.setItem('hvw-portie-regels', JSON.stringify(portieRegels)); } catch(e) {}
  }
  function loadRegels() {
    try { portieRegels = JSON.parse(localStorage.getItem('hvw-portie-regels') || '{}'); } catch(e) { portieRegels = {}; }
  }

  /* ── CSS ── */
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      #portie-etiketten-content { display: none; padding: 26px 28px; }

      .pe-layout { display: grid; grid-template-columns: 400px 1fr; gap: 24px; align-items: start; }
      @media (max-width: 960px) { .pe-layout { grid-template-columns: 1fr; } }

      .pe-card {
        background: #fff; border: 1px solid #E8E5E0; border-radius: 14px;
        padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      }
      .pe-card + .pe-card { margin-top: 20px; }
      .pe-card h3 { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #1A1917; }
      .pe-card-sub { font-size: 12px; color: #9A9590; margin-bottom: 16px; }

      .pe-no-data {
        text-align: center; padding: 30px 20px; color: #9A9590;
      }
      .pe-no-data svg { margin-bottom: 10px; color: #C8C2B8; }
      .pe-no-data-title { font-size: 13px; font-weight: 600; color: #1A1917; margin-bottom: 4px; }
      .pe-no-data-sub { font-size: 12px; margin-bottom: 14px; }

      .pe-field { margin-bottom: 14px; position: relative; }
      .pe-field label { display: block; font-size: 11px; font-weight: 600; color: #9A9590; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
      .pe-field input, .pe-field select, .pe-field textarea {
        font-family: 'Outfit', sans-serif; font-size: 14px; padding: 9px 12px;
        border: 1.5px solid #DEDAD4; border-radius: 8px; background: #fff; outline: none;
        width: 100%; box-sizing: border-box;
      }
      .pe-field input:focus, .pe-field select:focus, .pe-field textarea:focus { border-color: #1A1917; }
      .pe-field textarea { min-height: 56px; resize: vertical; font-family: 'Outfit', sans-serif; }

      .pe-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

      .pe-autocomplete-list {
        position: absolute; top: 100%; left: 0; right: 0; z-index: 20;
        background: #fff; border: 1px solid #DEDAD4; border-radius: 8px;
        margin-top: 4px; max-height: 220px; overflow-y: auto;
        box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      }
      .pe-autocomplete-item { padding: 9px 12px; font-size: 13px; cursor: pointer; display: flex; justify-content: space-between; gap: 8px; }
      .pe-autocomplete-item:hover, .pe-autocomplete-item.active { background: #F4F3F0; }
      .pe-autocomplete-item .pe-ac-name { font-weight: 500; color: #1A1917; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pe-autocomplete-item .pe-ac-meta { font-size: 11px; color: #9A9590; flex-shrink: 0; }
      .pe-autocomplete-empty { padding: 14px 12px; font-size: 12px; color: #9A9590; text-align: center; }

      .pe-portie-hint {
        display: flex; align-items: center; gap: 8px; padding: 10px 12px;
        background: #FDF9F2; border: 1px solid #EFE2CC; border-radius: 8px;
        font-size: 12px; color: #6B5A38; margin-bottom: 14px;
      }
      .pe-portie-hint input {
        width: 60px; padding: 5px 8px; font-size: 12px; border: 1px solid #DEDAD4; border-radius: 6px;
        font-family: 'DM Mono', monospace; text-align: center;
      }
      .pe-portie-calc { margin-left: auto; font-weight: 600; color: #1A1917; white-space: nowrap; }

      .pe-add-btn {
        width: 100%; padding: 11px; background: #1A1917; color: #fff; border: none;
        border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer;
        transition: opacity 0.15s; margin-top: 4px;
      }
      .pe-add-btn:hover { opacity: 0.85; }
      .pe-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      .pe-feest-picker { display: flex; gap: 8px; margin-bottom: 14px; }
      .pe-feest-picker select { flex: 1; }
      .pe-feest-chip {
        display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px;
        background: #F4F3F0; border: 1px solid #E8E5E0; border-radius: 20px; font-size: 12px; margin-bottom: 14px;
      }
      .pe-feest-chip button { border: none; background: none; cursor: pointer; color: #9A9590; padding: 0; display: flex; }

      .pe-list-title { font-size: 11px; font-weight: 600; color: #9A9590; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center; }
      .pe-list-clear { font-size: 11px; color: #B03A2E; cursor: pointer; text-transform: none; letter-spacing: 0; font-weight: 500; }
      .pe-list-clear:hover { text-decoration: underline; }

      .pe-empty { text-align: center; padding: 60px 20px; color: #9A9590; }
      .pe-empty svg { margin-bottom: 12px; color: #C8C2B8; }
      .pe-empty-title { font-size: 14px; font-weight: 600; color: #1A1917; margin-bottom: 4px; }
      .pe-empty-sub { font-size: 12px; }

      .pe-items { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
      .pe-item {
        display: grid; grid-template-columns: 4px 1fr auto auto; align-items: center; gap: 12px;
        padding: 12px 14px; background: #fff; border: 1px solid #E8E5E0; border-radius: 10px;
      }
      .pe-item-bar { align-self: stretch; border-radius: 3px; background: #B8965A; }
      .pe-item-main { min-width: 0; }
      .pe-item-name { font-weight: 600; font-size: 13px; color: #1A1917; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pe-item-meta { font-size: 11px; color: #9A9590; margin-top: 2px; display: flex; gap: 6px; flex-wrap: wrap; }
      .pe-item-meta span { white-space: nowrap; }
      .pe-item-opm { font-size: 11px; color: #6B655E; margin-top: 3px; font-style: italic; }
      .pe-item-etik { font-family: 'DM Mono', monospace; font-size: 12px; color: #1A1917; padding: 5px 10px; background: #F4F3F0; border-radius: 6px; flex-shrink: 0; font-weight: 600; }
      .pe-item-del {
        width: 26px; height: 26px; border-radius: 6px; border: none; background: transparent;
        color: #C8C2B8; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        transition: all 0.12s;
      }
      .pe-item-del:hover { background: #FBEAE8; color: #B03A2E; }
      .pe-item-edit-btn {
        width: 26px; height: 26px; border-radius: 6px; border: none; background: transparent;
        color: #C8C2B8; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        transition: all 0.12s;
      }
      .pe-item-edit-btn:hover { background: #F4F3F0; color: #1A1917; }

      .pe-edit-panel {
        grid-column: 1 / -1; margin-top: 10px; padding-top: 10px; border-top: 1px solid #F0EDE8;
        display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
      }
      .pe-edit-panel .pe-field { margin-bottom: 0; grid-column: span 1; }
      .pe-edit-panel .pe-field.pe-full { grid-column: 1 / -1; }

      .pe-summary { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #6B655E; margin-bottom: 14px; flex-wrap: wrap; }
      .pe-summary b { color: #1A1917; }

      .pe-pdf-btn {
        display: inline-flex; align-items: center; gap: 7px; padding: 11px 22px;
        background: #B8965A; color: #fff; border: none; border-radius: 8px;
        font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; width: 100%;
        justify-content: center;
      }
      .pe-pdf-btn:hover { opacity: 0.88; }
      .pe-pdf-btn:disabled { opacity: 0.4; cursor: not-allowed; }

      @media (max-width: 768px) {
        #portie-etiketten-content { padding: 14px !important; }
        .pe-card { padding: 18px; }
        .pe-edit-panel { grid-template-columns: 1fr; }
      }

      /* ── Modus tabs ── */
      .pe-mode-tabs { display: flex; gap: 4px; margin-bottom: 18px; background: #EAE8E3; border-radius: 10px; padding: 4px; width: fit-content; }
      .pe-mode-tab {
        padding: 8px 16px; border: none; background: transparent; border-radius: 7px;
        font-size: 12.5px; font-weight: 600; color: #6B655E; cursor: pointer; transition: all 0.15s;
      }
      .pe-mode-tab.active { background: #fff; color: #1A1917; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }

      /* ── Categorie-kiezer ── */
      .pe-cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; margin-bottom: 4px; }
      .pe-cat-btn {
        display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-radius: 10px;
        border: 1.5px solid #E8E5E0; background: #fff; cursor: pointer; transition: all 0.15s; text-align: left;
      }
      .pe-cat-btn:hover { border-color: #C8C2B8; }
      .pe-cat-btn.active { border-color: #1A1917; background: #1A1917; }
      .pe-cat-btn.active .pe-cat-label { color: #fff; }
      .pe-cat-btn.active .pe-cat-count { color: rgba(255,255,255,0.6); }
      .pe-cat-icon { font-size: 17px; flex-shrink: 0; }
      .pe-cat-label { font-size: 12.5px; font-weight: 600; color: #1A1917; }
      .pe-cat-count { font-size: 10.5px; color: #9A9590; }

      /* ── Product-groep in categorie-view ── */
      .pe-group { margin-bottom: 22px; }
      .pe-group:last-child { margin-bottom: 0; }
      .pe-group-head {
        display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding-bottom: 8px;
        border-bottom: 1px solid #F0EDE8;
      }
      .pe-group-name { font-size: 14px; font-weight: 700; color: #1A1917; flex: 1; }
      .pe-group-select-all { font-size: 11px; color: #6B655E; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
      .pe-group-per {
        display: flex; align-items: center; gap: 6px; font-size: 11px; color: #6B5A38;
        background: #FDF9F2; border: 1px solid #EFE2CC; border-radius: 7px; padding: 5px 9px;
      }
      .pe-group-per input {
        width: 44px; padding: 3px 5px; font-size: 11px; border: 1px solid #DEDAD4; border-radius: 5px;
        font-family: 'DM Mono', monospace; text-align: center;
      }

      .pe-row-check {
        display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 10px;
        padding: 9px 10px; border-radius: 8px; transition: background 0.1s;
      }
      .pe-row-check:hover { background: #FAF9F7; }
      .pe-row-check input[type=checkbox] { width: 16px; height: 16px; accent-color: #1A1917; cursor: pointer; }
      .pe-row-check-main { min-width: 0; }
      .pe-row-check-event { font-size: 12.5px; font-weight: 600; color: #1A1917; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pe-row-check-meta { font-size: 11px; color: #9A9590; margin-top: 1px; }
      .pe-row-check-date { color: #B8965A; font-weight: 600; }
      .pe-row-check-pak select {
        font-size: 11px; padding: 4px 6px; border: 1px solid #DEDAD4; border-radius: 6px; font-family: 'Outfit', sans-serif;
      }
      .pe-row-check-etik { font-family: 'DM Mono', monospace; font-size: 11.5px; color: #1A1917; font-weight: 600; white-space: nowrap; min-width: 50px; text-align: right; }

      .pe-cat-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 18px; padding-top: 16px; border-top: 1px solid #F0EDE8; }
      .pe-cat-selected-count { font-size: 12px; color: #6B655E; }
      .pe-cat-add-btn {
        padding: 10px 20px; background: #1A1917; color: #fff; border: none; border-radius: 8px;
        font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.15s;
      }
      .pe-cat-add-btn:hover { opacity: 0.85; }
      .pe-cat-add-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    `;
    document.head.appendChild(s);
  }

  /* ── UI skelet ── */
  let currentModus = 'los'; // 'los' | 'categorie'

  function injectUI() {
    const wrap = document.createElement('div');
    wrap.id = 'portie-etiketten-content';
    wrap.innerHTML = `
      <div class="pe-mode-tabs">
        <button class="pe-mode-tab active" id="pe-mode-los" onclick="window._peSwitchModus('los')">Los toevoegen</button>
        <button class="pe-mode-tab" id="pe-mode-cat" onclick="window._peSwitchModus('categorie')">Per categorie</button>
      </div>
      <div id="pe-modus-los">
        <div class="pe-layout">
          <div id="pe-left-col"></div>
          <div id="pe-right-col"></div>
        </div>
      </div>
      <div id="pe-modus-categorie" style="display:none">
        <div id="pe-cat-picker-wrap"></div>
        <div id="pe-cat-groups-wrap"></div>
      </div>
      <div id="pe-right-col-cat" style="margin-top:20px"></div>`;
    const appWrap = document.getElementById('app-wrap') || document.body;
    appWrap.appendChild(wrap);

    renderLeftColumn();
    renderList();

    document.addEventListener('dataLoaded', () => {
      renderLeftColumn();
      if (currentModus === 'categorie') renderCategoriePicker();
    });
  }

  window._peSwitchModus = function (modus) {
    currentModus = modus;
    document.getElementById('pe-mode-los').classList.toggle('active', modus === 'los');
    document.getElementById('pe-mode-cat').classList.toggle('active', modus === 'categorie');
    document.getElementById('pe-modus-los').style.display = modus === 'los' ? 'block' : 'none';
    document.getElementById('pe-modus-categorie').style.display = modus === 'categorie' ? 'block' : 'none';
    document.getElementById('pe-right-col-cat').style.display = modus === 'categorie' ? 'block' : 'none';
    document.getElementById('pe-right-col').parentElement.style.display = modus === 'los' ? 'grid' : 'none';
    if (modus === 'categorie') {
      renderCategoriePicker();
      renderListInto('pe-right-col-cat');
    } else {
      renderListInto('pe-right-col');
    }
  };

  /* ══════════════════════════════
     LINKERKOLOM: formulier
     ══════════════════════════════ */
  let selectedProduct = null; // { base, tabId, name }
  let selectedFeest = null;   // allEvents entry of null
  let acIndex = -1;

  function hasData() {
    return typeof allRows !== 'undefined' && allRows.length > 0;
  }

  function renderLeftColumn() {
    const col = document.getElementById('pe-left-col');
    if (!col) return;

    if (!hasData()) {
      col.innerHTML = `
        <div class="pe-card pe-no-data">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div class="pe-no-data-title">Nog geen Excel-data geladen</div>
          <div class="pe-no-data-sub">Upload eerst een CCM-export via de Calculator tab. Daarna verschijnen hier alle producten.</div>
          <button class="btn btn-upload" onclick="switchMode('calculator')">Naar Calculator</button>
        </div>`;
      return;
    }

    col.innerHTML = `
      <div class="pe-card">
        <h3>Product & hoeveelheid</h3>
        <div class="pe-card-sub">Zoek een product uit de geladen Excel-data.</div>

        <div class="pe-field">
          <label>Product</label>
          <input type="text" id="pe-product-search" placeholder="Bijv. Pepersaus" autocomplete="off"
                 oninput="window._peSearchProduct(this.value)"
                 onkeydown="window._peSearchKeydown(event)"
                 onfocus="window._peSearchProduct(this.value)">
          <div id="pe-ac-list"></div>
        </div>

        <div id="pe-portie-hint-wrap"></div>

        <div class="pe-row-2">
          <div class="pe-field">
            <label>Aantal personen</label>
            <input type="number" id="pe-personen" min="1" step="1" placeholder="0" oninput="window._peRecalc()">
          </div>
          <div class="pe-field">
            <label>Verpakkingsformaat</label>
            <select id="pe-pakformaat">
              ${PAK_FORMATEN.map(p => `<option value="${p}">${p}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="pe-field">
          <label>Zaal / locatie</label>
          <div id="pe-feest-picker-wrap"></div>
          <input type="text" id="pe-zaal" placeholder="Bijv. Traiteur 1, of typ zelf een zaal">
        </div>

        <div class="pe-field" style="margin-bottom:0">
          <label>Opmerking (optioneel)</label>
          <textarea id="pe-opmerking" placeholder="Bijv. zonder look, apart voor allergie-tafel..."></textarea>
        </div>

        <button class="pe-add-btn" onclick="window._peAdd()">+ Toevoegen aan lijst</button>
      </div>`;

    renderFeestPicker();
  }

  function renderFeestPicker() {
    const wrap = document.getElementById('pe-feest-picker-wrap');
    if (!wrap) return;
    const events = (typeof allEvents !== 'undefined') ? allEvents : [];

    if (selectedFeest) {
      const label = `${selectedFeest.room} · ${fmtEventDate(selectedFeest)} · ${selectedFeest.persons}p`;
      wrap.innerHTML = `
        <div class="pe-feest-chip">
          <span>${escapeHtml(label)}</span>
          <button onclick="window._peClearFeest()" title="Loskoppelen">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>`;
      return;
    }

    if (!events.length) { wrap.innerHTML = ''; return; }

    const sorted = [...events].sort((a,b) => (a.date||'').localeCompare(b.date||''));
    wrap.innerHTML = `
      <div class="pe-feest-picker">
        <select id="pe-feest-select" onchange="window._pePickFeest(this.value)">
          <option value="">— Koppel aan feest (optioneel) —</option>
          ${sorted.map(e => `<option value="${e.bookingId}">${escapeHtml(e.room)} · ${fmtEventDate(e)} · ${e.persons}p</option>`).join('')}
        </select>
      </div>`;
  }

  function fmtEventDate(e) {
    if (!e.date) return '';
    const [y,m,d] = e.date.split('-');
    return `${d}/${m}`;
  }

  window._pePickFeest = function (bookingId) {
    const events = (typeof allEvents !== 'undefined') ? allEvents : [];
    const ev = events.find(e => e.bookingId === bookingId);
    if (!ev) return;
    selectedFeest = ev;
    document.getElementById('pe-zaal').value = ev.room;
    document.getElementById('pe-personen').value = ev.persons;
    renderFeestPicker();
    window._peRecalc();
  };

  window._peClearFeest = function () {
    selectedFeest = null;
    renderFeestPicker();
  };

  /* ── Product autocomplete ── */
  function uniqueProducts() {
    if (!hasData()) return [];
    const map = new Map();
    allRows.forEach(r => {
      const base = r.base || r.name;
      if (!map.has(base)) map.set(base, { base, tabId: r.tabId, count: 0 });
      map.get(base).count++;
    });
    return [...map.values()].sort((a,b) => a.base.localeCompare(b.base));
  }

  window._peSearchProduct = function (query) {
    const list = document.getElementById('pe-ac-list');
    if (!list) return;
    const q = (query || '').trim().toLowerCase();
    const all = uniqueProducts();
    const filtered = q ? all.filter(p => p.base.toLowerCase().includes(q)) : all.slice(0, 30);
    acIndex = -1;

    if (!filtered.length) {
      list.innerHTML = `<div class="pe-autocomplete-list"><div class="pe-autocomplete-empty">Geen producten gevonden</div></div>`;
      return;
    }
    list.innerHTML = `<div class="pe-autocomplete-list">
      ${filtered.slice(0, 40).map(p => `
        <div class="pe-autocomplete-item" onmousedown="window._peSelectProduct('${escAttr(p.base)}')">
          <span class="pe-ac-name">${escapeHtml(p.base)}</span>
          <span class="pe-ac-meta">${TAB_LABELS[p.tabId] || p.tabId || ''}</span>
        </div>`).join('')}
    </div>`;
  };

  window._peSearchKeydown = function (ev) {
    const list = document.querySelector('#pe-ac-list .pe-autocomplete-list');
    if (!list) return;
    const items = [...list.querySelectorAll('.pe-autocomplete-item')];
    if (!items.length) return;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); acIndex = Math.min(acIndex+1, items.length-1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); acIndex = Math.max(acIndex-1, 0); }
    else if (ev.key === 'Enter') { ev.preventDefault(); if (acIndex>=0) items[acIndex].dispatchEvent(new MouseEvent('mousedown')); return; }
    else return;
    items.forEach((it,i) => it.classList.toggle('active', i===acIndex));
    items[acIndex]?.scrollIntoView({ block: 'nearest' });
  };

  window._peSelectProduct = function (base) {
    selectedProduct = { base };
    document.getElementById('pe-product-search').value = base;
    document.getElementById('pe-ac-list').innerHTML = '';
    renderPortieHint();
    window._peRecalc();
  };

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.pe-field')) {
      const list = document.getElementById('pe-ac-list');
      if (list) list.innerHTML = '';
    }
  });

  /* ── Portieregel hint + instelbaar veld ── */
  function renderPortieHint() {
    const wrap = document.getElementById('pe-portie-hint-wrap');
    if (!wrap) return;
    if (!selectedProduct) { wrap.innerHTML = ''; return; }

    const current = portieRegels[selectedProduct.base] || 100;
    wrap.innerHTML = `
      <div class="pe-portie-hint">
        <span>1 etiket per</span>
        <input type="number" id="pe-portie-per" min="1" step="1" value="${current}" onchange="window._peSetPortieRegel(this.value)">
        <span>personen</span>
        <span class="pe-portie-calc" id="pe-portie-calc"></span>
      </div>`;
    updatePortieCalc();
  }

  window._peSetPortieRegel = function (val) {
    if (!selectedProduct) return;
    const n = Math.max(1, parseInt(val, 10) || 100);
    portieRegels[selectedProduct.base] = n;
    saveRegels();
    updatePortieCalc();
  };

  function updatePortieCalc() {
    const calcEl = document.getElementById('pe-portie-calc');
    if (!calcEl) return;
    const persons = parseInt(document.getElementById('pe-personen')?.value, 10) || 0;
    const per = selectedProduct ? (portieRegels[selectedProduct.base] || 100) : 100;
    const n = persons > 0 ? Math.ceil(persons / per) : 0;
    calcEl.textContent = n > 0 ? `→ ${n} etiket${n===1?'':'ten'}` : '';
  }

  window._peRecalc = function () { updatePortieCalc(); };

  const TAB_LABELS = {
    vlees:'Vlees', vis:'Vis', small_plates:'Small plates', hg_veggie:'HG Veggie',
    groenten:'Groenten', hapjes:'Hapjes', streetfood:'Streetfood', dessert:'Dessert',
    dessertbuffet:'Dessertbuffet', sausen:'Sausen', broodjes:'Broodjes', soepen:'Soepen',
    latenight:'Late night', kids:'Kids'
  };

  /* ── Toevoegen aan lijst ── */
  window._peAdd = function () {
    const productInput = document.getElementById('pe-product-search');
    const productVal = (productInput?.value || '').trim();
    if (!productVal) { productInput?.focus(); return; }

    const persons = parseInt(document.getElementById('pe-personen')?.value, 10) || 0;
    const pakformaat = document.getElementById('pe-pakformaat')?.value || '';
    const zaal = (document.getElementById('pe-zaal')?.value || '').trim();
    const opmerking = (document.getElementById('pe-opmerking')?.value || '').trim();

    const per = portieRegels[productVal] || (selectedProduct && selectedProduct.base === productVal ? portieRegels[selectedProduct.base] : null) || 100;
    const aantalEtiketten = persons > 0 ? Math.ceil(persons / per) : 1;

    const locCode = selectedFeest ? selectedFeest.location : null;
    const dateStr = selectedFeest ? (selectedFeest.date || '') : '';

    queue.push({
      id: idCounter++,
      product: productVal,
      persons,
      per,
      aantalEtiketten,
      pakformaat,
      zaal,
      opmerking,
      locCode,
      dateStr,
      editing: false
    });

    // Reset formulier (behalve zaal/feest, handig bij meerdere producten voor 1 feest)
    productInput.value = '';
    document.getElementById('pe-personen').value = '';
    document.getElementById('pe-opmerking').value = '';
    selectedProduct = null;
    document.getElementById('pe-portie-hint-wrap').innerHTML = '';
    productInput.focus();

    renderList();
  };

  window._peRemove = function (id) {
    queue = queue.filter(it => it.id !== id);
    renderList();
  };

  window._peClearAll = function () {
    if (!queue.length) return;
    if (!confirm('Alle etiketten uit de lijst verwijderen?')) return;
    queue = [];
    renderList();
  };

  window._peToggleEdit = function (id) {
    queue = queue.map(it => it.id === id ? { ...it, editing: !it.editing } : it);
    renderList();
  };

  window._peUpdateField = function (id, field, value) {
    const it = queue.find(it => it.id === id);
    if (!it) return;
    if (field === 'persons') {
      it.persons = parseInt(value, 10) || 0;
      it.aantalEtiketten = it.persons > 0 ? Math.ceil(it.persons / it.per) : it.aantalEtiketten;
    } else if (field === 'per') {
      it.per = Math.max(1, parseInt(value, 10) || 100);
      it.aantalEtiketten = it.persons > 0 ? Math.ceil(it.persons / it.per) : it.aantalEtiketten;
    } else if (field === 'aantalEtiketten') {
      it.aantalEtiketten = Math.max(1, parseInt(value, 10) || 1);
    } else {
      it[field] = value;
    }
    renderList(true);
  };

  /* ══════════════════════════════
     CATEGORIE-MODUS
     ══════════════════════════════ */
  const CATEGORIES = [
    { id:'vlees',        label:'Vlees',            icon:'🥩' },
    { id:'vis',          label:'Vis',              icon:'🐟' },
    { id:'small_plates', label:'Small Plates',     icon:'🍽️' },
    { id:'hg_veggie',    label:'HG Veggie',        icon:'🌿' },
    { id:'groenten',     label:'Groenten',         icon:'🥦' },
    { id:'hapjes',       label:'Hapjes',           icon:'🍢' },
    { id:'streetfood',   label:'Streetfood',       icon:'🌮' },
    { id:'dessert',      label:'Dessert',          icon:'🍮' },
    { id:'dessertbuffet',label:'Dessertbuffet',    icon:'🎂' },
    { id:'sausen',       label:'Sausen',           icon:'🫙' },
    { id:'broodjes',     label:'Broodjes',         icon:'🥪' },
    { id:'soepen',       label:'Soepen & Dranken', icon:'🍵' },
    { id:'latenight',    label:'Late Night',       icon:'🌙' },
    { id:'kids',         label:'Kids',             icon:'🧒' },
  ];

  let activeCatId = null;
  let catChecked = {};   // { rowKey: true }
  let catPerOverride = {}; // { productBase: per } — sessie-override binnen categorie-view

  function categoryRowCounts() {
    const counts = {};
    if (!hasData()) return counts;
    allRows.forEach(r => { counts[r.tabId] = (counts[r.tabId]||0) + 1; });
    return counts;
  }

  function renderCategoriePicker() {
    const wrap = document.getElementById('pe-cat-picker-wrap');
    if (!wrap) return;

    if (!hasData()) {
      wrap.innerHTML = `
        <div class="pe-card pe-no-data">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <div class="pe-no-data-title">Nog geen Excel-data geladen</div>
          <div class="pe-no-data-sub">Upload eerst een CCM-export via de Calculator tab.</div>
          <button class="btn btn-upload" onclick="switchMode('calculator')">Naar Calculator</button>
        </div>`;
      document.getElementById('pe-cat-groups-wrap').innerHTML = '';
      return;
    }

    const counts = categoryRowCounts();
    wrap.innerHTML = `
      <div class="pe-card">
        <h3>Kies een categorie</h3>
        <div class="pe-card-sub">Alle producten van deze categorie, over alle feesten heen deze week.</div>
        <div class="pe-cat-grid">
          ${CATEGORIES.map(c => {
            const n = counts[c.id] || 0;
            return `<button class="pe-cat-btn ${c.id===activeCatId?'active':''}" ${n?'':'disabled style="opacity:.35;cursor:not-allowed"'} onclick="window._peSelectCategory('${c.id}')">
              <span class="pe-cat-icon">${c.icon}</span>
              <span>
                <div class="pe-cat-label">${c.label}</div>
                <div class="pe-cat-count">${n} product${n===1?'':'en'}</div>
              </span>
            </button>`;
          }).join('')}
        </div>
      </div>`;

    if (activeCatId) renderCategoryGroups(activeCatId);
  }

  window._peSelectCategory = function (catId) {
    activeCatId = catId;
    catChecked = {};
    renderCategoriePicker();
  };

  function rowKey(r, idx) { return r.tabId + '::' + r.base + '::' + idx; }

  function renderCategoryGroups(catId) {
    const wrap = document.getElementById('pe-cat-groups-wrap');
    if (!wrap) return;

    const rows = allRows
      .map((r, idx) => ({ r, key: rowKey(r, idx) }))
      .filter(({r}) => r.tabId === catId && r.persons > 0);

    if (!rows.length) {
      wrap.innerHTML = `<div class="pe-card pe-empty"><div class="pe-empty-title">Geen producten in deze categorie</div></div>`;
      return;
    }

    // Groepeer per productnaam (base)
    const groups = new Map();
    rows.forEach(({r, key}) => {
      if (!groups.has(r.base)) groups.set(r.base, []);
      groups.get(r.base).push({ r, key });
    });
    // Sorteer binnen elke groep chronologisch op datum (dan op zaal, voor stabiele volgorde)
    groups.forEach(entries => {
      entries.sort((a, b) => {
        const dA = a.r.dateStr || '', dB = b.r.dateStr || '';
        if (dA !== dB) return dA.localeCompare(dB);
        return (a.r.room || '').localeCompare(b.r.room || '');
      });
    });
    const sortedBases = [...groups.keys()].sort((a,b) => a.localeCompare(b));

    wrap.innerHTML = `
      <div class="pe-card">
        ${sortedBases.map(base => renderProductGroup(base, groups.get(base))).join('')}

        <div class="pe-cat-actions">
          <span class="pe-cat-selected-count" id="pe-cat-selected-count">${countChecked()} rij(en) geselecteerd</span>
          <button class="pe-cat-add-btn" id="pe-cat-add-btn" onclick="window._peBulkAdd()" ${countChecked()?'':'disabled'}>
            + Toevoegen aan lijst
          </button>
        </div>
      </div>`;
  }

  function countChecked() {
    return Object.values(catChecked).filter(Boolean).length;
  }

  function renderProductGroup(base, entries) {
    const per = catPerOverride[base] || portieRegels[base] || 100;
    const allChecked = entries.every(({key}) => catChecked[key]);

    return `
      <div class="pe-group">
        <div class="pe-group-head">
          <span class="pe-group-name">${escapeHtml(base)}</span>
          <span class="pe-group-select-all" onclick="window._peToggleGroupAll('${escAttr(base)}', ${allChecked ? 'false' : 'true'})">${allChecked ? 'Alles uitvinken' : 'Alles aanvinken'}</span>
          <div class="pe-group-per">
            <span>1 emmer =</span>
            <input type="number" min="1" value="${per}" onchange="window._peSetGroupPer('${escAttr(base)}', this.value)">
            <span>p</span>
          </div>
        </div>
        ${entries.map(({r, key}) => renderCheckRow(r, key, per)).join('')}
      </div>`;
  }

  function fmtRowDate(dateStr) {
    if (!dateStr) return '';
    // dateStr verwacht formaat YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    const DAG_KORT = ['zo','ma','di','wo','do','vr','za'];
    const dt = new Date(Number(y), Number(m)-1, Number(d));
    const dagLabel = isNaN(dt.getTime()) ? '' : DAG_KORT[dt.getDay()] + ' ';
    return `${dagLabel}${d}/${m}`;
  }
  const fmtLabelDate = fmtRowDate;

  function renderCheckRow(r, key, per) {
    const checked = !!catChecked[key];
    const aantalEtiketten = Math.ceil(r.persons / per);
    const locCode = guessLocFromRoom(r.room);
    const dateLabel = fmtRowDate(r.dateStr);
    return `
      <label class="pe-row-check">
        <input type="checkbox" ${checked?'checked':''} onchange="window._peToggleRow('${key}', this.checked)">
        <div class="pe-row-check-main">
          <div class="pe-row-check-event">${escapeHtml(r.event || r.room)}</div>
          <div class="pe-row-check-meta">${dateLabel ? `<span class="pe-row-check-date">${escapeHtml(dateLabel)}</span> · ` : ''}${escapeHtml(r.room)} · ${r.persons}p</div>
        </div>
        <div class="pe-row-check-pak">
          <select onchange="window._peSetRowPak('${key}', this.value)" id="pe-pak-${key.replace(/[^a-zA-Z0-9]/g,'_')}">
            ${PAK_FORMATEN.map(p => `<option value="${p}" ${p==='1/1 emmer'?'selected':''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="pe-row-check-etik">${aantalEtiketten}× emmer</div>
      </label>`;
  }

  function guessLocFromRoom(room) {
    // Zaal-namen bevatten vaak geen locatiecode direct; probeer via allEvents te matchen
    if (typeof allEvents === 'undefined') return null;
    const ev = allEvents.find(e => e.room && room && (e.room === room || e.room.includes(room) || room.includes(e.room)));
    return ev ? ev.location : null;
  }

  window._peToggleRow = function (key, checked) {
    catChecked[key] = checked;
    document.getElementById('pe-cat-selected-count').textContent = `${countChecked()} rij(en) geselecteerd`;
    document.getElementById('pe-cat-add-btn').disabled = countChecked() === 0;
  };

  window._peToggleGroupAll = function (base, setTo) {
    allRows.forEach((r, idx) => {
      if (r.base !== base || r.tabId !== activeCatId || r.persons <= 0) return;
      catChecked[rowKey(r, idx)] = setTo;
    });
    renderCategoryGroups(activeCatId);
  };

  window._peSetGroupPer = function (base, val) {
    const n = Math.max(1, parseInt(val, 10) || 100);
    catPerOverride[base] = n;
    portieRegels[base] = n; // meteen ook globaal onthouden
    saveRegels();
    renderCategoryGroups(activeCatId);
  };

  let rowPakOverride = {}; // { key: pakformaat }
  window._peSetRowPak = function (key, val) {
    rowPakOverride[key] = val;
  };

  window._peBulkAdd = function () {
    if (!countChecked()) return;
    const selectedKeys = Object.keys(catChecked).filter(k => catChecked[k]);

    allRows.forEach((r, idx) => {
      const key = rowKey(r, idx);
      if (!selectedKeys.includes(key)) return;
      const base = r.base;
      const per = catPerOverride[base] || portieRegels[base] || 100;
      const aantalEtiketten = Math.ceil(r.persons / per);
      const pakformaat = rowPakOverride[key] || '1/1 emmer';
      const locCode = guessLocFromRoom(r.room);

      queue.push({
        id: idCounter++,
        product: base,
        persons: r.persons,
        per,
        aantalEtiketten,
        pakformaat,
        zaal: r.room,
        opmerking: r.event && r.event !== r.room ? r.event : '',
        locCode,
        dateStr: r.dateStr || '',
        editing: false
      });
    });

    // Reset selectie na toevoegen
    catChecked = {};
    rowPakOverride = {};
    renderCategoryGroups(activeCatId);
    renderListInto('pe-right-col-cat');
  };

  /* ══════════════════════════════
     RECHTERKOLOM: lijst + output
     ══════════════════════════════ */
  function renderList() {
    renderListInto(currentModus === 'categorie' ? 'pe-right-col-cat' : 'pe-right-col');
  }

  function renderListInto(targetId) {
    const col = document.getElementById(targetId);
    if (!col) return;

    if (!queue.length) {
      col.innerHTML = `
        <div class="pe-card pe-empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="7" width="18" height="10" rx="2"/><line x1="3" y1="11" x2="21" y2="11"/></svg>
          <div class="pe-empty-title">Nog geen etiketten</div>
          <div class="pe-empty-sub">Kies links een product en aantal, en voeg toe.</div>
        </div>`;
      return;
    }

    const totalLabels = queue.reduce((s, it) => s + it.aantalEtiketten, 0);
    const totalPages = Math.ceil(totalLabels / (COLS * ROWS));

    col.innerHTML = `
      <div class="pe-card">
        <div class="pe-list-title">
          <span>${queue.length} product${queue.length===1?'':'en'} in lijst</span>
          <span class="pe-list-clear" onclick="window._peClearAll()">Alles wissen</span>
        </div>
        <div class="pe-items">
          ${queue.map(it => renderItem(it)).join('')}
        </div>

        <div class="pe-summary">
          <span><b>${totalLabels}</b> etiket${totalLabels===1?'':'ten'}</span>
          <span>·</span>
          <span><b>${totalPages}</b> pagina${totalPages===1?'':"'s"} A4</span>
        </div>

        <button class="pe-pdf-btn" id="pe-pdf-btn" onclick="window._pePdfGenerate()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          PDF genereren &amp; afdrukken
        </button>
      </div>`;
  }

  function renderItem(it) {
    const locLabel = it.locCode ? (LOC_LABELS[it.locCode] || it.locCode) : null;
    const dateLabel = fmtRowDate(it.dateStr);
    return `
      <div class="pe-item">
        <div class="pe-item-bar"></div>
        <div class="pe-item-main">
          <div class="pe-item-name">${escapeHtml(it.product)}</div>
          <div class="pe-item-meta">
            ${dateLabel ? `<span class="pe-row-check-date">${escapeHtml(dateLabel)}</span>` : ''}
            ${it.persons ? `<span>${it.persons}p</span>` : ''}
            ${it.per ? `<span>· 1/${it.per}p</span>` : ''}
            ${it.pakformaat ? `<span>· ${escapeHtml(it.pakformaat)}</span>` : ''}
            ${it.zaal ? `<span>· ${escapeHtml(it.zaal)}</span>` : ''}
            ${locLabel ? `<span>· ${escapeHtml(locLabel)}</span>` : ''}
          </div>
          ${it.opmerking ? `<div class="pe-item-opm">${escapeHtml(it.opmerking)}</div>` : ''}
        </div>
        <div class="pe-item-etik">${it.aantalEtiketten}×</div>
        <div style="display:flex;gap:2px">
          <button class="pe-item-edit-btn" onclick="window._peToggleEdit(${it.id})" title="Bewerken">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="pe-item-del" onclick="window._peRemove(${it.id})" title="Verwijderen">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        ${it.editing ? renderEditPanel(it) : ''}
      </div>`;
  }

  function renderEditPanel(it) {
    return `
      <div class="pe-edit-panel">
        <div class="pe-field pe-full">
          <label>Product</label>
          <input type="text" value="${escAttr(it.product)}" onchange="window._peUpdateField(${it.id},'product',this.value)">
        </div>
        <div class="pe-field">
          <label>Personen</label>
          <input type="number" min="0" value="${it.persons}" onchange="window._peUpdateField(${it.id},'persons',this.value)">
        </div>
        <div class="pe-field">
          <label>Per hoeveel personen 1 etiket</label>
          <input type="number" min="1" value="${it.per}" onchange="window._peUpdateField(${it.id},'per',this.value)">
        </div>
        <div class="pe-field">
          <label>Aantal etiketten (overschrijven)</label>
          <input type="number" min="1" value="${it.aantalEtiketten}" onchange="window._peUpdateField(${it.id},'aantalEtiketten',this.value)">
        </div>
        <div class="pe-field">
          <label>Verpakkingsformaat</label>
          <select onchange="window._peUpdateField(${it.id},'pakformaat',this.value)">
            ${PAK_FORMATEN.map(p => `<option value="${p}" ${p===it.pakformaat?'selected':''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="pe-field">
          <label>Zaal</label>
          <input type="text" value="${escAttr(it.zaal)}" onchange="window._peUpdateField(${it.id},'zaal',this.value)">
        </div>
        <div class="pe-field pe-full">
          <label>Opmerking</label>
          <input type="text" value="${escAttr(it.opmerking)}" onchange="window._peUpdateField(${it.id},'opmerking',this.value)">
        </div>
      </div>`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }
  function escAttr(str) {
    return escapeHtml(str).replace(/"/g, '&quot;');
  }

  /* ══════════════════════════════
     PDF GENERATIE via jsPDF
     (zelfde grid als etiketten.js / snelle-etiketten.js)
     ══════════════════════════════ */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  window._pePdfGenerate = async function () {
    if (!queue.length) return;
    const btn = document.getElementById('pe-pdf-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'PDF genereren…'; }

    try {
      if (!window.jspdf) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const labels = [];
      queue.forEach(it => {
        for (let k = 1; k <= it.aantalEtiketten; k++) {
          labels.push({ ...it, karNr: k });
        }
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
      doc.save(`portie_etiketten_${stamp}.pdf`);
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

    const rgbColor = label.locCode ? (LOC_COLORS_RGB[label.locCode] || DEFAULT_COLOR) : DEFAULT_COLOR;
    doc.setFillColor(...rgbColor);
    doc.rect(x, y, 5, h, 'F');

    const tx = x + 5 + pad;
    const tw = w - 4 - pad - pad;

    // Product naam (groot, vet)
    doc.setFontSize(11.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(28, 28, 26);
    const nameWrapped = doc.splitTextToSize(label.product || '', tw);
    doc.text(nameWrapped[0] || '', tx, y + pad + 7);
    if (nameWrapped[1]) doc.text(nameWrapped[1], tx, y + pad + 12.5);
    const nameLines = nameWrapped.length > 1 ? 2 : 1;

    // Verpakkingsformaat
    let cursorY = y + pad + (nameLines === 2 ? 18.5 : 13.5);
    if (label.pakformaat) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(110, 106, 100);
      doc.text(label.pakformaat, tx, cursorY);
      cursorY += 5;
    }

    // Zaal + datum (zelfde regel: zaal links, datum rechts uitgelijnd)
    if (label.zaal || label.dateStr) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(28, 28, 26);
      if (label.zaal) {
        const zaalWrapped = doc.splitTextToSize(label.zaal, tw * 0.62);
        doc.text(zaalWrapped[0] || '', tx, cursorY);
      }
      const dateLabel = fmtLabelDate(label.dateStr);
      if (dateLabel) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(184, 150, 90);
        doc.text(dateLabel, x + w - pad, cursorY, { align: 'right' });
      }
      cursorY += 5;
    }

    // Opmerking
    if (label.opmerking) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 116, 112);
      const opmWrapped = doc.splitTextToSize(label.opmerking, tw);
      opmWrapped.slice(0, 2).forEach(line => {
        if (cursorY < y + h - pad) { doc.text(line, tx, cursorY); cursorY += 4.2; }
      });
    }

    // Personen (rechtsonder)
    if (label.persons) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(28, 28, 26);
      doc.text(`${label.persons} pers.`, x + w - pad, y + h - pad - 1, { align: 'right' });
    }

    // Etiket nr (als meer dan 1)
    if (label.aantalEtiketten > 1) {
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...rgbColor);
      doc.text(`${label.karNr}/${label.aantalEtiketten}`, x + w - pad, y + pad + 4, { align: 'right' });
    }
  }

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', () => {
    loadRegels();
    injectCSS();
    injectUI();
  });

})();
