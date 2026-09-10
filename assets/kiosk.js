/* ══════════════════════════════════════════
   kiosk.js — Kioskmodus voor keukenpersoneel
   Vereenvoudigd startscherm met grote tegels:
   Recepten / Etiketten / Besteltools.
   Instelling ("start dit toestel altijd op in
   kioskmodus") wordt per toestel bewaard in
   localStorage — verandert niets aan andere
   toestellen/browsers.
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  const STORAGE_KEY = 'hvw-kiosk-mode';

  /* ── Tegel-definities ──
     target: pageId voor sbShow()
     view:   optionele sub-view (bv. 'week' in Calculator)
     scrollTo: optioneel element-id om naartoe te scrollen + te markeren
  ── */
  const MAIN_TILES = [
    { key: 'recepten',    label: 'Recepten',     icon: '📖', sub: false, target: 'recepten' },
    { key: 'etiketten',   label: 'Etiketten',    icon: '🏷️', sub: true },
    { key: 'besteltools', label: 'Besteltools',  icon: '📋', sub: true },
  ];

  const SUB_TILES = {
    etiketten: [
      { label: 'Portie-Etiketten', icon: '🍽️', target: 'portie-etiketten' },
      { label: 'Snelle Etiketten', icon: '⚡',  target: 'snel-etiketten' },
      { label: 'Karren-Etiketten', icon: '🧊', target: 'etiketten' },
      { label: 'Broodjes',         icon: '🥪', target: 'broodjes' },
    ],
    besteltools: [
      { label: 'Bakker Bestelformulier', icon: '🥐', target: 'bakker' },
      { label: 'Broodjes calculator',    icon: '🥪', target: 'broodjes' },
      { label: 'Bestelling PDF',         icon: '📄', target: 'calculator', view: 'week', scrollTo: 'bestelling-pdf-btn' },
      { label: 'Wagenpark',              icon: '🚐', target: 'settings', scrollTo: 'settings-card-wagenpark' },
    ],
  };

  /* ── CSS ── */
  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      #kiosk-home {
        position: fixed; inset: 0; z-index: 9999;
        background: #F4F3F0;
        display: none;
        flex-direction: column;
        overflow-y: auto;
      }
      .kiosk-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 22px 26px 8px;
      }
      .kiosk-header img { height: 34px; }
      .kiosk-exit-btn {
        width: 40px; height: 40px; border-radius: 50%; border: none;
        background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        font-size: 17px; cursor: pointer; color: #C8C2B8;
        display: flex; align-items: center; justify-content: center;
      }
      .kiosk-exit-btn:hover { color: #1A1917; }

      .kiosk-tiles-wrap {
        flex: 1; display: flex; flex-direction: column; justify-content: center;
        padding: 20px 26px 40px;
        max-width: 960px; margin: 0 auto; width: 100%;
        box-sizing: border-box;
      }
      .kiosk-title {
        font-family: 'Cormorant Garamond', serif; font-size: 30px; font-weight: 600;
        color: #1A1917; text-align: center; margin: 0 0 30px;
      }

      .kiosk-grid {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
      }
      .kiosk-grid.kiosk-grid-4 { grid-template-columns: repeat(2, 1fr); }
      @media (max-width: 720px) {
        .kiosk-grid, .kiosk-grid.kiosk-grid-4 { grid-template-columns: 1fr; }
      }

      .kiosk-tile {
        background: #fff; border: 1.5px solid #E8E5E0; border-radius: 20px;
        padding: 36px 20px; display: flex; flex-direction: column; align-items: center;
        gap: 14px; cursor: pointer; transition: all 0.15s;
        box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        min-height: 160px; justify-content: center;
      }
      .kiosk-tile:active { transform: scale(0.97); background: #F4F3F0; }
      .kiosk-tile-icon { font-size: 46px; line-height: 1; }
      .kiosk-tile-label { font-size: 18px; font-weight: 700; color: #1A1917; text-align: center; }

      .kiosk-back-btn {
        display: inline-flex; align-items: center; gap: 6px;
        background: none; border: none; color: #9A9590; font-size: 14px; font-weight: 600;
        cursor: pointer; padding: 8px 0; margin-bottom: 14px;
      }
      .kiosk-back-btn:hover { color: #1A1917; }

      @keyframes kioskPulse {
        0%   { box-shadow: 0 0 0 0 rgba(184,150,90,0.55); }
        70%  { box-shadow: 0 0 0 14px rgba(184,150,90,0); }
        100% { box-shadow: 0 0 0 0 rgba(184,150,90,0); }
      }
      .kiosk-highlight { animation: kioskPulse 1.1s ease-out 2; border-radius: 8px; }
    `;
    document.head.appendChild(s);
  }

  /* ── Markup ── */
  function injectUI() {
    const wrap = document.createElement('div');
    wrap.id = 'kiosk-home';
    wrap.innerHTML = `
      <div class="kiosk-header">
        <img src="assets/logo.png" alt="Huis van Wonterghem">
        <button class="kiosk-exit-btn" onclick="window._kioskExit()" title="Volledige app (admin)">⚙️</button>
      </div>
      <div class="kiosk-tiles-wrap">
        <div class="kiosk-title">Waarmee wil je aan de slag?</div>
        <div class="kiosk-grid" id="kiosk-main-grid"></div>
        <div id="kiosk-sub-wrap" style="display:none">
          <button class="kiosk-back-btn" onclick="window._kioskShowMain()">← Terug</button>
          <div class="kiosk-grid kiosk-grid-4" id="kiosk-sub-grid"></div>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    document.getElementById('kiosk-main-grid').innerHTML = MAIN_TILES.map((t, i) => `
      <div class="kiosk-tile" onclick="window._kioskTileClick(${i})">
        <div class="kiosk-tile-icon">${t.icon}</div>
        <div class="kiosk-tile-label">${t.label}</div>
      </div>`).join('');
  }

  window._kioskTileClick = function (i) {
    const tile = MAIN_TILES[i];
    if (!tile) return;
    if (tile.sub) {
      window._kioskShowSub(tile.key);
    } else {
      window._kioskGo(tile);
    }
  };

  window._kioskShowSub = function (key) {
    const items = SUB_TILES[key] || [];
    document.getElementById('kiosk-sub-grid').innerHTML = items.map((t, i) => `
      <div class="kiosk-tile" onclick="window._kioskSubTileClick('${key}', ${i})">
        <div class="kiosk-tile-icon">${t.icon}</div>
        <div class="kiosk-tile-label">${t.label}</div>
      </div>`).join('');
    document.getElementById('kiosk-main-grid').style.display = 'none';
    document.getElementById('kiosk-sub-wrap').style.display = 'block';
  };

  window._kioskShowMain = function () {
    document.getElementById('kiosk-sub-wrap').style.display = 'none';
    document.getElementById('kiosk-main-grid').style.display = 'grid';
  };

  window._kioskSubTileClick = function (key, i) {
    const tile = (SUB_TILES[key] || [])[i];
    if (tile) window._kioskGo(tile);
  };

  // Navigeert naar de opgegeven bestemming en verlaat het kiosk-startscherm.
  window._kioskGo = function (tile) {
    const appWrap = document.getElementById('app-wrap');
    const kioskHome = document.getElementById('kiosk-home');
    if (kioskHome) kioskHome.style.display = 'none';
    if (appWrap) appWrap.style.display = '';

    if (typeof window.sbShow === 'function' && tile.target) {
      window.sbShow(tile.target);
    }
    if (tile.view && typeof window.switchView === 'function') {
      setTimeout(() => window.switchView(tile.view), 50);
    }
    if (tile.scrollTo) {
      setTimeout(() => {
        const el = document.getElementById(tile.scrollTo);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('kiosk-highlight');
          setTimeout(() => el.classList.remove('kiosk-highlight'), 2400);
        }
      }, 250);
    }
    // Terugkeerknop naar kiosk-startscherm tonen (indien nog niet aanwezig)
    ensureReturnButton();
  };

  // Klein, discreet knopje om vanuit de volledige app terug naar het
  // kiosk-startscherm te gaan (voor als een kok per ongeluk in de gewone
  // app terechtkomt, of na het afronden van een taak).
  function ensureReturnButton() {
    if (document.getElementById('kiosk-return-btn')) return;
    if (localStorage.getItem(STORAGE_KEY) !== 'on') return;
    const btn = document.createElement('button');
    btn.id = 'kiosk-return-btn';
    btn.textContent = '← Startscherm';
    btn.style.cssText = `
      position: fixed; bottom: 18px; left: 18px; z-index: 9998;
      background: #1A1917; color: #fff; border: none; border-radius: 999px;
      padding: 11px 18px; font-size: 13px; font-weight: 600; cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,0.18);
    `;
    btn.onclick = window._kioskEnter;
    document.body.appendChild(btn);
  }

  // Toont het kiosk-startscherm (admin-testknop + automatische opstart).
  window._kioskEnter = function () {
    const appWrap = document.getElementById('app-wrap');
    const kioskHome = document.getElementById('kiosk-home');
    if (appWrap) appWrap.style.display = 'none';
    if (kioskHome) kioskHome.style.display = 'flex';
    window._kioskShowMain();
  };

  // Verlaat kioskmodus voor deze sessie (admin-toegang via het tandwiel-icoon).
  // Verandert de opgeslagen toestel-instelling niet.
  window._kioskExit = function () {
    const appWrap = document.getElementById('app-wrap');
    const kioskHome = document.getElementById('kiosk-home');
    if (kioskHome) kioskHome.style.display = 'none';
    if (appWrap) appWrap.style.display = '';
    if (typeof window.sbShow === 'function') window.sbShow('dashboard');
    const returnBtn = document.getElementById('kiosk-return-btn');
    if (returnBtn) returnBtn.remove();
  };

  // Aan/uit-schakelaar in Instellingen: bepaalt of dit toestel voortaan
  // altijd in kioskmodus opstart.
  window._kioskToggle = function (checked) {
    localStorage.setItem(STORAGE_KEY, checked ? 'on' : 'off');
  };

  function initToggleCheckbox() {
    const cb = document.getElementById('kiosk-toggle');
    if (cb) cb.checked = localStorage.getItem(STORAGE_KEY) === 'on';
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectCSS();
    injectUI();
    initToggleCheckbox();

    // Automatisch opstarten in kioskmodus indien dit toestel zo is ingesteld.
    if (localStorage.getItem(STORAGE_KEY) === 'on') {
      window._kioskEnter();
    }
  });

})();
