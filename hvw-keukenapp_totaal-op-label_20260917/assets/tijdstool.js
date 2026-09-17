/* ══════════════════════════════════════════
   tijdstool.js — Tijd per persoon calculator
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      #tijdstool-content { display: none; padding: 26px 28px; }

      .tijds-card {
        background: #fff;
        border: 1px solid #E8E5E0;
        border-radius: 14px;
        padding: 28px 32px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        max-width: 560px;
      }

      .tijds-inputs {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-bottom: 32px;
      }

      .tijds-field label {
        display: block;
        font-size: 11px;
        font-weight: 600;
        color: #9A9590;
        text-transform: uppercase;
        letter-spacing: .6px;
        margin-bottom: 8px;
      }

      .tijds-input-row {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .tijds-input-row input {
        flex: 1;
        font-family: 'DM Mono', monospace;
        font-size: 22px;
        font-weight: 500;
        padding: 10px 14px;
        border: 1.5px solid #DEDAD4;
        border-radius: 10px;
        background: #fff;
        color: #1A1917;
        outline: none;
        transition: border-color 0.15s;
        min-width: 0;
      }
      .tijds-input-row input:focus { border-color: #1A1917; }

      .tijds-input-row select {
        font-family: 'Outfit', sans-serif;
        font-size: 14px;
        padding: 10px 12px;
        border: 1.5px solid #DEDAD4;
        border-radius: 10px;
        background: #fff;
        color: #1A1917;
        outline: none;
        cursor: pointer;
        flex-shrink: 0;
      }
      .tijds-input-row select:focus { border-color: #1A1917; }

      .tijds-result {
        border-top: 1px solid #F0EDE8;
        padding-top: 24px;
      }

      .tijds-result-label {
        font-size: 11px;
        font-weight: 600;
        color: #9A9590;
        text-transform: uppercase;
        letter-spacing: .6px;
        margin-bottom: 16px;
      }

      .tijds-blocks {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 20px;
      }

      .tijds-block {
        background: #F4F3F0;
        border: 1px solid #E8E5E0;
        border-radius: 12px;
        padding: 16px;
        text-align: center;
        position: relative;
        overflow: hidden;
        transition: background 0.2s;
      }
      .tijds-block.has-value {
        background: #1A1917;
        border-color: #1A1917;
      }
      .tijds-block.has-value .tijds-block-val { color: #fff; }
      .tijds-block.has-value .tijds-block-unit { color: rgba(255,255,255,0.5); }

      .tijds-block-val {
        font-family: 'Cormorant Garamond', serif;
        font-size: 42px;
        font-weight: 500;
        color: #C8C2B8;
        line-height: 1;
        margin-bottom: 6px;
        transition: color 0.2s;
      }

      .tijds-block-unit {
        font-size: 11px;
        font-weight: 600;
        color: #BBB5AF;
        text-transform: uppercase;
        letter-spacing: 1px;
        transition: color 0.2s;
      }

      .tijds-summary {
        font-family: 'DM Mono', monospace;
        font-size: 15px;
        font-weight: 500;
        color: #1A1917;
        background: #F4F3F0;
        border: 1px solid #E8E5E0;
        border-radius: 10px;
        padding: 12px 16px;
        text-align: center;
      }

      .tijds-summary.empty {
        color: #C8C2B8;
      }

      @media (max-width: 480px) {
        .tijds-blocks { grid-template-columns: repeat(3,1fr); gap: 8px; }
        .tijds-block-val { font-size: 32px; }
        .tijds-card { padding: 20px; }
      }
    `;
    document.head.appendChild(s);
  }

  function injectUI() {
    const wrap = document.createElement('div');
    wrap.id = 'tijdstool-content';
    wrap.innerHTML = `
      <div class="tijds-card">
        <div class="tijds-inputs">
          <div class="tijds-field">
            <label>Totale tijd</label>
            <div class="tijds-input-row">
              <input type="number" id="tijds-total" min="0" step="1" value="" placeholder="0" oninput="calcTijds()">
              <select id="tijds-unit" onchange="calcTijds()">
                <option value="uur">uur</option>
                <option value="min" selected>minuten</option>
                <option value="sec">seconden</option>
              </select>
            </div>
          </div>
          <div class="tijds-field">
            <label>Aantal personen</label>
            <div class="tijds-input-row">
              <input type="number" id="tijds-persons" min="1" step="1" value="" placeholder="0" oninput="calcTijds()">
            </div>
          </div>
        </div>

        <div class="tijds-result">
          <div class="tijds-result-label">Tijd per persoon</div>
          <div class="tijds-blocks">
            <div class="tijds-block" id="tijds-blok-uur">
              <div class="tijds-block-val" id="tijds-val-uur">0</div>
              <div class="tijds-block-unit">uur</div>
            </div>
            <div class="tijds-block" id="tijds-blok-min">
              <div class="tijds-block-val" id="tijds-val-min">0</div>
              <div class="tijds-block-unit">min</div>
            </div>
            <div class="tijds-block" id="tijds-blok-sec">
              <div class="tijds-block-val" id="tijds-val-sec">0</div>
              <div class="tijds-block-unit">sec</div>
            </div>
          </div>
          <div class="tijds-summary empty" id="tijds-summary">Vul hierboven in om te berekenen</div>
        </div>
      </div>`;

    const appWrap = document.getElementById('app-wrap') || document.body;
    appWrap.appendChild(wrap);
  }

  window.calcTijds = function() {
    const totalVal = parseFloat(document.getElementById('tijds-total')?.value) || 0;
    const unit     = document.getElementById('tijds-unit')?.value || 'min';
    const persons  = parseInt(document.getElementById('tijds-persons')?.value) || 0;

    // Omzetten naar seconden
    let totalSec = 0;
    if      (unit === 'uur') totalSec = totalVal * 3600;
    else if (unit === 'min') totalSec = totalVal * 60;
    else                     totalSec = totalVal;

    const sumEl = document.getElementById('tijds-summary');

    if (!totalVal || !persons) {
      ['uur','min','sec'].forEach(u => {
        document.getElementById('tijds-val-' + u).textContent = '0';
        document.getElementById('tijds-blok-' + u).classList.remove('has-value');
      });
      sumEl.textContent = 'Vul hierboven in om te berekenen';
      sumEl.className = 'tijds-summary empty';
      return;
    }

    const perPerson = totalSec / persons;
    const uur = Math.floor(perPerson / 3600);
    const min = Math.floor((perPerson % 3600) / 60);
    const sec = Math.round(perPerson % 60);

    document.getElementById('tijds-val-uur').textContent = uur;
    document.getElementById('tijds-val-min').textContent = min;
    document.getElementById('tijds-val-sec').textContent = sec;

    document.getElementById('tijds-blok-uur').classList.toggle('has-value', uur > 0);
    document.getElementById('tijds-blok-min').classList.toggle('has-value', min > 0);
    document.getElementById('tijds-blok-sec').classList.toggle('has-value', sec > 0);

    // Samenvatting
    const parts = [];
    if (uur > 0) parts.push(`${uur} uur`);
    if (min > 0) parts.push(`${min} min`);
    if (sec > 0 || !parts.length) parts.push(`${sec} sec`);
    sumEl.textContent = `Per persoon: ${parts.join(' ')}`;
    sumEl.className = 'tijds-summary';
  };

  // Mobile responsive styles
  (function() {
    const ms = document.createElement('style');
    ms.textContent = `
      @media (max-width: 768px) {
        #tijdstool-content { padding: 14px !important; }
        .tijds-card { padding: 16px; }
        .tijds-blocks { gap: 8px; }
        .tijds-block-val { font-size: 28px; }
      }`;
    document.head.appendChild(ms);
  })();

  document.addEventListener('DOMContentLoaded', () => {
    injectCSS();
    injectUI();
  });

})();
