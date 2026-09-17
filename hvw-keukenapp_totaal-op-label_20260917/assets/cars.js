/* ══════════════════════════════════════════
   cars.js — Wagenpark beheer + feest toewijzing
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── State ── */
  let cars = [];           // [{ id, name, plate, color, seats }]
  let carAssignments = {}; // { bookingId: [carId, carId, ...] }

  const CAR_COLORS = ['#1A3F6F','#2D6A4F','#8B2500','#6B3A7D','#1D6A6A','#8B6A00','#455A64','#C2185B'];

  /* ── Storage ── */
  function saveCars() {
    localStorage.setItem('mmm-cars',        JSON.stringify(cars));
    localStorage.setItem('mmm-car-assign',  JSON.stringify(carAssignments));
  }
  function loadCars() {
    try {
      cars           = JSON.parse(localStorage.getItem('mmm-cars')       || '[]');
      carAssignments = JSON.parse(localStorage.getItem('mmm-car-assign') || '{}');
    } catch(e) { cars = []; carAssignments = {}; }
  }
  function carById(id) { return cars.find(c => c.id === id); }

  /* ══════════════════════════════
     INSTELLINGEN: wagenpark beheer
     ══════════════════════════════ */
  function renderCarSettings() {
    const el = document.getElementById('car-settings-list');
    if (!el) return;
    if (!cars.length) {
      el.innerHTML = '<p class="settings-empty">Nog geen voertuigen toegevoegd.</p>';
      return;
    }
    el.innerHTML = cars.map(c => {
      const logo = getCarLogo(c.name);
      return `
      <div class="car-card">
        <div class="car-card-left">
          ${logo
            ? `<img src="${logo}" class="car-logo-img" style="background:${c.color}15">`
            : `<span class="car-color-dot" style="background:${c.color}"></span>`}
          <div>
            <div class="car-name">${c.name}</div>
            <div class="car-plate">${c.plate || 'Geen nummerplaat'}</div>
          </div>
        </div>
        <div class="car-card-right">
          ${c.seats ? `<span class="car-seats">${c.seats} zitpl.</span>` : ''}
          <button class="btn-icon" onclick="openEditCar('${c.id}')" title="Bewerken">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon btn-icon-danger" onclick="deleteCar('${c.id}')" title="Verwijderen">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>`;
    }).join('');
  }

  /* ── Auto aanmaken/bewerken ── */
  window.openAddCar = function() {
    document.getElementById('car-form-title').textContent = 'Nieuw voertuig';
    document.getElementById('car-id-input').value  = '';
    document.getElementById('car-name-input').value  = '';
    document.getElementById('car-plate-input').value = '';
    document.getElementById('car-seats-input').value = '';
    document.getElementById('car-color-input').value = CAR_COLORS[cars.length % CAR_COLORS.length];
    document.getElementById('car-modal').style.display = 'flex';
  };

  window.openEditCar = function(id) {
    const c = carById(id);
    if (!c) return;
    document.getElementById('car-form-title').textContent = 'Voertuig bewerken';
    document.getElementById('car-id-input').value   = c.id;
    document.getElementById('car-name-input').value   = c.name;
    document.getElementById('car-plate-input').value  = c.plate || '';
    document.getElementById('car-seats-input').value  = c.seats || '';
    document.getElementById('car-color-input').value  = c.color;
    document.getElementById('car-modal').style.display = 'flex';
  };

  window.saveCarForm = function() {
    const id    = document.getElementById('car-id-input').value;
    const name  = document.getElementById('car-name-input').value.trim();
    const plate = document.getElementById('car-plate-input').value.trim().toUpperCase();
    const seats = parseInt(document.getElementById('car-seats-input').value) || 0;
    const color = document.getElementById('car-color-input').value;
    if (!name) { alert('Vul een naam in.'); return; }
    if (id) {
      const c = carById(id);
      if (c) { c.name = name; c.plate = plate; c.seats = seats; c.color = color; }
    } else {
      cars.push({ id: Date.now().toString(), name, plate, seats, color });
    }
    saveCars();
    closeCarModal();
    renderCarSettings();
    // Refresh feestenoverzicht als open
    if (typeof renderFeesten === 'function') renderFeesten();
  };

  window.deleteCar = function(id) {
    if (!confirm('Voertuig verwijderen?')) return;
    cars = cars.filter(c => c.id !== id);
    // Verwijder toewijzingen
    Object.keys(carAssignments).forEach(bk => {
      carAssignments[bk] = carAssignments[bk].filter(cid => cid !== id);
      if (!carAssignments[bk].length) delete carAssignments[bk];
    });
    saveCars();
    renderCarSettings();
    if (typeof renderFeesten === 'function') renderFeesten();
  };

  window.closeCarModal = function() {
    document.getElementById('car-modal').style.display = 'none';
  };

  /* ══════════════════════════════
     FEESTENOVERZICHT: auto in tabelrij
     ══════════════════════════════ */

  /* ── Merkdetectie en logo ── */
  const BRAND_LOGOS = {
    'mercedes': 'https://cdn.brandfetch.io/idpLaEqV-9/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'ford':     'https://cdn.brandfetch.io/id_PkSHPLW/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'peugeot':  'https://cdn.brandfetch.io/ido8IovDDm/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'renault':  'https://cdn.brandfetch.io/idJjKqMfHy/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'volkswagen': 'https://cdn.brandfetch.io/idmH3bWH2U/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'vw':       'https://cdn.brandfetch.io/idmH3bWH2U/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'volvo':    'https://cdn.brandfetch.io/idLwOm1GGh/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'bmw':      'https://cdn.brandfetch.io/idSuClbDDm/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'audi':     'https://cdn.brandfetch.io/id1z3FLOi4/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'opel':     'https://cdn.brandfetch.io/idFCJRhBJq/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'toyota':   'https://cdn.brandfetch.io/idpNNS6gCb/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'citroen':  'https://cdn.brandfetch.io/idCIWixWW5/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'iveco':    'https://cdn.brandfetch.io/id1djkbvYZ/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'fiat':     'https://cdn.brandfetch.io/idw5SxDNFG/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'nissan':   'https://cdn.brandfetch.io/id4xDEm4-E/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'hyundai':  'https://cdn.brandfetch.io/idT5UVHa7b/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'byd':      'https://cdn.brandfetch.io/idxHe6YBHF/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'kia':      'https://cdn.brandfetch.io/idwUFPf9Vy/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'seat':     'https://cdn.brandfetch.io/idS0xnmzBm/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'skoda':    'https://cdn.brandfetch.io/idj00xJlJM/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
    'tesla':    'https://cdn.brandfetch.io/id2C7bELlM/w/400/h/400/theme/dark/icon.png?c=1dxbfHSJFAPEwi1',
  };

  function getCarLogo(name) {
    if (!name) return null;
    const n = name.toLowerCase();
    for (const [brand, url] of Object.entries(BRAND_LOGOS)) {
      if (n.includes(brand)) return url;
    }
    return null;
  }

  /* Geef alle auto's die al gebruikt zijn op een bepaalde dag */
  function usedCarsOnDate(date, excludeBookingId) {
    if (typeof allEvents === 'undefined') return [];
    const bookingsOnDate = allEvents
      .filter(e => e.date === date && e.bookingId !== excludeBookingId)
      .map(e => e.bookingId);
    const used = [];
    bookingsOnDate.forEach(bid => {
      (carAssignments[bid] || []).forEach(cid => { if (!used.includes(cid)) used.push(cid); });
    });
    return used;
  }

  /* Auto kolom: dropdown + geselecteerde auto als badge */
  window.renderCarCell = function(bookingId, date) {
    if (!cars.length) return '<span style="font-size:11px;color:#C8C2B8">—</span>';
    const assigned = (carAssignments[bookingId] || [])[0] || ''; // max 1 auto
    const used     = usedCarsOnDate(date, bookingId);
    const car      = assigned ? carById(assigned) : null;

    const options  = cars.map(c => {
      const busy = used.includes(c.id) && c.id !== assigned;
      return `<option value="${c.id}" ${c.id === assigned ? 'selected' : ''} ${busy ? 'disabled' : ''}>
        ${c.name}${c.plate ? ' · '+c.plate : ''}${busy ? ' (bezet)' : ''}
      </option>`;
    }).join('');

    const logo = car ? getCarLogo(car.name) : null;
    const badgeContent = car ? (logo
      ? `<img src="${logo}" style="width:18px;height:18px;object-fit:contain;border-radius:2px"> ${car.name}`
      : `<span style="width:7px;height:7px;border-radius:50%;background:${car.color};display:inline-block;flex-shrink:0"></span> ${car.name}`) : '';

    return `<select class="car-inline-select" onchange="setCarAssign('${bookingId}', this.value)">
      <option value="">— Geen auto —</option>
      ${options}
    </select>
    ${car ? `<div class="car-inline-badge" style="background:${car.color}18;color:${car.color};border-color:${car.color}35">
      ${badgeContent}
    </div>` : ''}`;
  };

  /* Stel 1 auto in per feest */
  window.setCarAssign = function(bookingId, carId) {
    if (carId) carAssignments[bookingId] = [carId];
    else delete carAssignments[bookingId];
    saveCars();
    // Herrender enkel de feestenoverzicht
    if (typeof renderFeesten === 'function') renderFeesten();
  };

  /* Toon toegewezen auto's als inline badges (ook in print) */
  window.renderCarBadges = function(bookingId) {
    const assigned = carAssignments[bookingId] || [];
    if (!assigned.length) return '';
    return assigned.map(cid => {
      const c = carById(cid);
      if (!c) return '';
      return `<span class="car-badge" style="background:${c.color}20;color:${c.color};border-color:${c.color}40">
        <span class="car-badge-dot" style="background:${c.color}"></span>${c.name}${c.plate ? ' · '+c.plate : ''}
      </span>`;
    }).join('');
  };

  /* Kleine toewijzingsknop (enkel zichtbaar op scherm, niet in print) */
  window.renderCarAssignBtn = function(bookingId) {
    const assigned = carAssignments[bookingId] || [];
    const count = assigned.length;
    return `<button class="feest-car-btn" onclick="toggleCarSelect('${bookingId}')" title="Auto toewijzen">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v5a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
      ${count > 0 ? count + ' auto' : 'Auto'}
    </button>`;
  };

  /* Legacy — bewaard voor compatibiliteit */
  window.renderCarRow = function(bookingId) {
    if (!cars.length) return '';
    const assigned = carAssignments[bookingId] || [];

    const carOptions = cars.map(c =>
      `<option value="${c.id}" ${assigned.includes(c.id) ? 'selected' : ''}>${c.name}${c.plate ? ' · '+c.plate : ''}</option>`
    ).join('');

    const carBadges = assigned.map(cid => {
      const c = carById(cid);
      if (!c) return '';
      return `<span class="car-badge" style="background:${c.color}20;color:${c.color};border-color:${c.color}40">
        <span class="car-badge-dot" style="background:${c.color}"></span>
        ${c.name}${c.plate ? ' · '+c.plate : ''}
      </span>`;
    }).join('');

    return `
    <div class="feest-car-row">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#9A9590;flex-shrink:0">
        <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v5a2 2 0 0 1-2 2h-2"/>
        <circle cx="7.5" cy="17.5" r="2.5"/>
        <circle cx="17.5" cy="17.5" r="2.5"/>
      </svg>
      <div class="feest-car-badges">${carBadges || '<span style="font-size:12px;color:#BBB5AF">Geen auto toegewezen</span>'}</div>
      <select class="feest-car-select" onchange="assignCar('${bookingId}', this)" multiple size="1"
        title="Selecteer auto('s)" style="display:none" id="car-sel-${bookingId}">
        ${carOptions}
      </select>
      <button class="feest-car-btn" onclick="toggleCarSelect('${bookingId}')" title="Auto toewijzen">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
        Auto
      </button>
    </div>`;
  };

  window.toggleCarSelect = function(bookingId) {
    // Toon een kleine dropdown popup
    const existing = document.getElementById('car-popup-' + bookingId);
    if (existing) { existing.remove(); return; }

    // Sluit andere popups
    document.querySelectorAll('.car-popup').forEach(p => p.remove());

    const assigned = carAssignments[bookingId] || [];
    const btn = document.querySelector(`[onclick="toggleCarSelect('${bookingId}')"]`);
    if (!btn) return;

    const popup = document.createElement('div');
    popup.className = 'car-popup';
    popup.id = 'car-popup-' + bookingId;
    popup.innerHTML = `
      <div class="car-popup-title">Auto toewijzen</div>
      ${cars.map(c => `
        <label class="car-popup-item">
          <input type="checkbox" value="${c.id}" ${assigned.includes(c.id) ? 'checked' : ''}
            onchange="toggleCarAssign('${bookingId}', '${c.id}', this.checked)">
          <span class="car-popup-dot" style="background:${c.color}"></span>
          <span class="car-popup-name">${c.name}</span>
          ${c.plate ? `<span class="car-popup-plate">${c.plate}</span>` : ''}
        </label>`).join('')}
      <button class="car-popup-close" onclick="document.getElementById('car-popup-${bookingId}').remove()">Sluiten</button>`;

    // Positioneer popup
    const rect = btn.getBoundingClientRect();
    popup.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
    popup.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px';
    document.body.appendChild(popup);

    // Sluit popup bij klik buiten
    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!popup.contains(e.target) && e.target !== btn) {
          popup.remove();
          document.removeEventListener('click', handler);
        }
      });
    }, 100);
  };

  window.toggleCarAssign = function(bookingId, carId, checked) {
    if (!carAssignments[bookingId]) carAssignments[bookingId] = [];
    if (checked) {
      if (!carAssignments[bookingId].includes(carId)) carAssignments[bookingId].push(carId);
    } else {
      carAssignments[bookingId] = carAssignments[bookingId].filter(id => id !== carId);
    }
    saveCars();
    // Update badges in de rij zonder hele feestenoverzicht te herschrijven
    const row = document.querySelector(`.feest-car-row[data-booking="${bookingId}"]`);
    if (row) {
      const badgeEl = row.querySelector('.feest-car-badges');
      if (badgeEl) {
        const assigned = carAssignments[bookingId] || [];
        badgeEl.innerHTML = assigned.map(cid => {
          const c = carById(cid);
          if (!c) return '';
          return `<span class="car-badge" style="background:${c.color}20;color:${c.color};border-color:${c.color}40">
            <span class="car-badge-dot" style="background:${c.color}"></span>
            ${c.name}${c.plate ? ' · '+c.plate : ''}
          </span>`;
        }).join('') || '<span style="font-size:12px;color:#BBB5AF">Geen auto toegewezen</span>';
      }
    }
  };

  /* ── Renderfunctie voor instellingen ── */
  window.renderCarSettings = renderCarSettings;

  /* ── CSS injecteren ── */
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      /* ── Wagenpark instellingen ── */
      .car-card {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 12px; margin-bottom: 8px;
        background: #fff; border: 1px solid #E8E5E0; border-radius: 8px; gap: 10px;
      }
      .car-card-left { display: flex; align-items: center; gap: 10px; }
      .car-card-right { display: flex; align-items: center; gap: 8px; }
      .car-logo-img { width: 32px; height: 32px; object-fit: contain; border-radius: 6px; padding: 3px; flex-shrink: 0; }
      .car-color-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
      .car-name  { font-size: 14px; font-weight: 600; color: #1A1917; }
      .car-plate { font-size: 11px; color: #9A9590; font-family: 'DM Mono', monospace; margin-top: 1px; }
      .car-seats { font-size: 11px; color: #9A9590; background: #F4F3F0; border: 1px solid #E8E5E0; border-radius: 20px; padding: 2px 8px; }

      /* ── Auto kolom ── */
      .feest-car-col { vertical-align: middle; padding: 8px 12px !important; }
      .car-inline-select {
        font-family: 'Outfit', sans-serif; font-size: 12px;
        padding: 5px 8px; border: 1px solid #DEDAD4; border-radius: 8px;
        background: #fff; color: #1A1917; outline: none; cursor: pointer;
        width: 100%; max-width: 200px; display: block;
      }
      .car-inline-select:focus { border-color: #1A1917; }
      .car-inline-badge {
        display: inline-flex; align-items: center; gap: 5px;
        margin-top: 5px; padding: 3px 9px; border-radius: 20px;
        border: 1px solid; font-size: 11px; font-weight: 600;
      }
      @media print {
        .car-inline-select { display: none !important; }
        .car-inline-badge  { margin-top: 0; }
      }

      /* ── Auto inline in locatie kolom (legacy) ── */
      .feest-car-inline {
        display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px;
      }
      .feest-car-assign {
        text-align: right; vertical-align: middle; padding: 8px 10px !important;
      }
      @media print {
        .feest-car-assign { display: none !important; }
        .feest-car-inline { margin-top: 4px; }
      }

      /* ── Auto rij in feestenoverzicht (legacy) ── */
      .feest-car-row {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 14px; background: #FAFAF8;
        border-top: 1px solid #F0EDE8;
        flex-wrap: wrap;
      }
      .feest-car-badges { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; align-items: center; }
      .car-badge {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 3px 10px; border-radius: 20px; border: 1px solid;
        font-size: 11px; font-weight: 600; white-space: nowrap;
      }
      .car-badge-dot { width: 6px; height: 6px; border-radius: 50%; }
      .feest-car-btn {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 4px 10px; border: 1px solid #DEDAD4;
        border-radius: 20px; background: #fff; cursor: pointer;
        font-size: 11px; font-weight: 500; color: #7A7570;
        transition: all 0.15s; white-space: nowrap;
      }
      .feest-car-btn:hover { border-color: #1A1917; color: #1A1917; background: #F4F3F0; }

      /* ── Auto popup ── */
      .car-popup {
        position: fixed; z-index: 300;
        background: #fff; border: 1px solid #E8E5E0;
        border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);
        padding: 12px; min-width: 200px; max-width: 260px;
      }
      .car-popup-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #9A9590; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid #F0EDE8; }
      .car-popup-item { display: flex; align-items: center; gap: 8px; padding: 7px 4px; cursor: pointer; border-radius: 6px; }
      .car-popup-item:hover { background: #F4F3F0; }
      .car-popup-item input { cursor: pointer; accent-color: #1A1917; }
      .car-popup-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
      .car-popup-name { font-size: 13px; font-weight: 500; flex: 1; }
      .car-popup-plate { font-family: 'DM Mono', monospace; font-size: 10px; color: #9A9590; }
      .car-popup-close { margin-top: 8px; width: 100%; padding: 6px; border: 1px solid #E8E5E0; border-radius: 8px; background: #F4F3F0; cursor: pointer; font-size: 12px; font-weight: 500; color: #7A7570; }
      .car-popup-close:hover { background: #EDEAE5; }
    `;
    document.head.appendChild(s);
  }

  /* ── Init ── */
  document.addEventListener('DOMContentLoaded', () => {
    loadCars();
    injectCSS();
  });

  window._loadCars = loadCars;

})();
