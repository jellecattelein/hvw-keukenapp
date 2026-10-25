/* ══════════════════════════════════════════
   modern.js — gedrag bij het moderne ontwerp

   - Wisselen tussen "Modern" en "Klassiek" ontwerp (per toestel)
   - Animaties rustiger zetten (per toestel)
   - Glijdende markering in de zijbalk
   - Cijfers in de dashboard-tegels tellen op
   Het eerste (klasse op <html>) gebeurt al in <head> om flikkeren te voorkomen.
   ══════════════════════════════════════════ */
(function () {
  'use strict';

  const UI_KEY = 'hvw-ui';          // 'modern' | 'klassiek'
  const CALM_KEY = 'hvw-ui-calm';   // 'on' | 'off'
  const root = document.documentElement;
  const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  function applyClasses() {
    // de Etiketten-modus (m-etiket) bestaat enkel in het moderne ontwerp
    root.classList.toggle('ui-modern', get(UI_KEY) !== 'klassiek' || root.classList.contains('m-etiket'));
    root.classList.toggle('m-calm', get(CALM_KEY) === 'on');
    syncIndicator();
  }

  window._uiGet = () => (get(UI_KEY) === 'klassiek' ? 'klassiek' : 'modern');
  window._uiSet = v => { set(UI_KEY, v === 'klassiek' ? 'klassiek' : 'modern'); applyClasses(); };
  window._uiCalmGet = () => get(CALM_KEY) === 'on';
  window._uiCalmSet = on => { set(CALM_KEY, on ? 'on' : 'off'); applyClasses(); };

  /* ── Glijdende markering in de zijbalk ── */
  let indicator = null;
  function syncIndicator() {
    const nav = document.querySelector('#sidebar .sb-nav');
    if (!nav) return;
    const modern = root.classList.contains('ui-modern');
    if (!modern) {
      if (indicator) indicator.style.opacity = '0';
      root.classList.remove('m-ind');
      return;
    }
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'sb-indicator';
      nav.insertBefore(indicator, nav.firstChild);
    }
    const active = nav.querySelector('.sb-item.active');
    if (!active) { indicator.style.opacity = '0'; root.classList.remove('m-ind'); return; }
    indicator.style.opacity = '1';
    indicator.style.height = active.offsetHeight + 'px';
    indicator.style.transform = `translateY(${active.offsetTop}px)`;
    root.classList.add('m-ind');
    // actief item in beeld houden in de (scrollbare) zijbalk
    const top = active.offsetTop, bottom = top + active.offsetHeight;
    if (top < nav.scrollTop || bottom > nav.scrollTop + nav.clientHeight) {
      nav.scrollTo({ top: Math.max(0, top - nav.clientHeight / 2), behavior: root.classList.contains('m-calm') ? 'auto' : 'smooth' });
    }
  }

  /* ── Cijfers laten oplopen ── */
  function countUp(el) {
    if (root.classList.contains('m-calm') || !root.classList.contains('ui-modern')) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const node = [...el.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.nodeValue));
    if (!node) return;
    const m = node.nodeValue.match(/^(\s*)([\d.,]+)(.*)$/s);
    if (!m) return;
    const [, pre, numTxt, post] = m;
    const decimals = (numTxt.match(/[.,](\d{1,2})$/) || [])[1] ? (numTxt.match(/[.,](\d{1,2})$/)[1].length) : 0;
    // "1.498" = duizendtal (nl), "159.8" = decimaal
    const isThousands = /^\d{1,3}(\.\d{3})+$/.test(numTxt);
    const target = isThousands ? parseInt(numTxt.replace(/\./g, ''), 10) : parseFloat(numTxt.replace(',', '.'));
    if (!isFinite(target) || target === 0) return;
    const fmt = v => isThousands ? Math.round(v).toLocaleString('nl-BE')
      : (decimals ? v.toFixed(decimals) : String(Math.round(v)));
    const t0 = performance.now(), dur = 900;
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      node.nodeValue = pre + fmt(target * e) + post;
      if (p < 1) requestAnimationFrame(tick); else node.nodeValue = pre + numTxt + post;
    };
    requestAnimationFrame(tick);
  }

  function watchKpis() {
    const box = document.getElementById('dash-kpis');
    if (!box) return;
    new MutationObserver(() => {
      box.querySelectorAll('.kpi-val').forEach(countUp);
    }).observe(box, { childList: true });
  }

  /* ── Instellingen-kaart "Weergave" ── */
  function initSettingsCard() {
    const uiRadios = document.querySelectorAll('input[name="ui-modus"]');
    uiRadios.forEach(r => { r.checked = r.value === window._uiGet(); });
    const calm = document.getElementById('ui-calm');
    if (calm) calm.checked = window._uiCalmGet();
  }

  applyClasses();
  document.addEventListener('DOMContentLoaded', () => {
    applyClasses();
    watchKpis();
    initSettingsCard();
    // markering volgen bij paginawissel en venstergrootte
    const nav = document.querySelector('#sidebar .sb-nav');
    if (nav) new MutationObserver(syncIndicator).observe(nav, { subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', syncIndicator);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncIndicator);
    setTimeout(syncIndicator, 150);
  });
})();
