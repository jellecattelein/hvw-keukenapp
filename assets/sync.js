/* ══════════════════════════════════════════
   sync.js — gedeelde gegevens tussen computers (Firebase)

   - De beheerder (adminEmail) kan wijzigen; alle andere aangemelde
     toestellen kunnen enkel uitvoeren en afdrukken.
   - Gedeeld: instellingen (portieregels, groenten, samengestelde gerechten,
     leveranciers, recepten, karren, weekmap) en de laatst geüploade Excel.
   - Per toestel blijft: printmodus, kioskmodus, Drive-token.
   - Zonder ingevulde assets/firebase-config.js doet dit bestand niets.
   ══════════════════════════════════════════ */
(function () {
  'use strict';

  const CFG = window.HVW_FIREBASE;
  if (!CFG || !CFG.config || !CFG.config.apiKey) return;

  const SHARED_KEYS = new Set([
    'hvw-portie-regels',
    'hvw-groenten-assortiment',
    'hvw-groenten-assortiment-rouwmaaltijd',
    'hvw-samengestelde-gerechten',
    'hvw-recepten',
    'hvw-weekmap-secties',
    'mmm-suppliers',
    'mmm-assignments',
    'mmm-settings',
    'mmm-cars',
    'mmm-car-assign',
  ]);
  const MAX_VALUE = 900000;           // Firestore: max ~1 MiB per document
  const WEEK_STAMP = 'hvw-week-stamp';
  const WEEK_CACHE = 'hvw-week-cache';
  const RELOAD_FLAG = 'hvw-sync-reload';
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';

  const rawSet = Storage.prototype.setItem;
  const rawRemove = Storage.prototype.removeItem;
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { rawSet.call(localStorage, k, v); } catch (e) {} },
    del(k) { try { rawRemove.call(localStorage, k); } catch (e) {} },
  };

  let db = null, auth = null;
  let isAdmin = false, signedIn = false;
  let applyingRemote = false;
  let firstSettings = true, firstWeek = true;
  let ownWeekStamp = null;
  const dirty = new Set();
  let flushTimer = null;

  /* ── Schrijven (enkel beheerder) ── */
  Storage.prototype.setItem = function (k, v) {
    // Enkel de beheerder schrijft naar de gedeelde gegevens
    const track = this === localStorage && SHARED_KEYS.has(k) && !applyingRemote && isAdmin;
    const prev = track ? ls.get(k) : null;
    rawSet.call(this, k, v);
    if (track && prev !== String(v)) { dirty.add(k); scheduleFlush(); }
  };

  function scheduleFlush() {
    if (!isAdmin || !db) return;
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, 800);
  }

  function flush() {
    if (!isAdmin || !db || !dirty.size) return;
    const patch = {};
    const keys = [...dirty];
    keys.forEach(k => {
      const v = ls.get(k);
      if (v == null) return;
      if (v.length > MAX_VALUE) { toast(`"${k}" is te groot om te delen`); return; }
      patch[k] = v;
    });
    keys.forEach(k => dirty.delete(k));
    if (!Object.keys(patch).length) return;
    patch._updated = firebase.firestore.FieldValue.serverTimestamp();
    return db.collection('shared').doc('settings').set(patch, { merge: true })
      .then(() => { setChip('ok'); return true; })
      .catch(err => { keys.forEach(k => dirty.add(k)); console.warn('[sync] schrijven mislukt', err); setChip('fout'); return false; });
  }

  /* ── Instellingen binnenhalen ── */
  // force = handmatig "Nu synchroniseren": direct toepassen en herladen bij wijzigingen
  function onSettings(snap, force) {
    if (snap.metadata.hasPendingWrites) return false;
    const data = snap.exists ? snap.data() : {};
    let changed = false;
    SHARED_KEYS.forEach(k => {
      const remote = data[k];
      const local = ls.get(k);
      if (typeof remote === 'string') {
        if (remote !== local && !dirty.has(k)) {
          applyingRemote = true; ls.set(k, remote); applyingRemote = false;
          changed = true;
        }
      } else if (isAdmin && local != null) {
        dirty.add(k);                    // eerste keer: zet de bestaande gegevens van deze pc online
      }
    });
    const eerste = firstSettings; firstSettings = false;
    if (changed) {
      if (force) reloadNow();
      else if (eerste && canAutoReload()) reloadNow();
      else toast('Nieuwe instellingen beschikbaar', 'Vernieuwen', () => location.reload());
    }
    if (dirty.size) scheduleFlush();
    return changed;
  }

  function canAutoReload() {
    const t = +(sessionStorage.getItem(RELOAD_FLAG) || 0);
    return Date.now() - t > 30000;
  }
  function reloadNow() {
    try { sessionStorage.setItem(RELOAD_FLAG, String(Date.now())); } catch (e) {}
    location.reload();
  }

  /* ── Week (Excel) ── */
  function toB64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(b64) {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  async function pack(obj) {
    const json = JSON.stringify(obj);
    if (window.CompressionStream) {
      const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
      return { enc: 'gzip', b64: toB64(await new Response(stream).arrayBuffer()) };
    }
    return { enc: 'json', b64: btoa(unescape(encodeURIComponent(json))) };
  }
  async function unpack(enc, b64) {
    if (enc === 'gzip') {
      const stream = new Blob([fromB64(b64)]).stream().pipeThrough(new DecompressionStream('gzip'));
      return JSON.parse(await new Response(stream).text());
    }
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
  }

  let origProcessData = null;
  function loadRows(rows) {
    if (typeof origProcessData !== 'function' || !Array.isArray(rows)) return;
    applyingRemote = true;
    try { origProcessData(rows); } finally { applyingRemote = false; }
  }

  async function saveWeek(rows) {
    if (!isAdmin || !db) return;
    try {
      const p = await pack(rows);
      if (p.b64.length > MAX_VALUE) { toast('Excel is te groot om te delen'); return; }
      const stamp = String(Date.now());
      ownWeekStamp = stamp;
      await db.collection('shared').doc('week').set({ stamp, enc: p.enc, b64: p.b64, rows: rows.length, by: user().email });
      ls.set(WEEK_STAMP, stamp); ls.set(WEEK_CACHE, p.enc + ':' + p.b64);
      toast('Week gedeeld met de andere computers ✓');
    } catch (err) {
      console.warn('[sync] week opslaan mislukt', err);
      toast('Week delen mislukt — controleer de verbinding');
    }
  }

  async function onWeek(snap, force) {
    if (snap.metadata.hasPendingWrites) return false;
    const eerste = firstWeek || force; firstWeek = false;
    if (!snap.exists) return false;
    const d = snap.data();
    if (d.stamp === ls.get(WEEK_STAMP) || d.stamp === ownWeekStamp) return false;
    const apply = async () => {
      try {
        const rows = await unpack(d.enc, d.b64);
        loadRows(rows);
        ls.set(WEEK_STAMP, d.stamp); ls.set(WEEK_CACHE, d.enc + ':' + d.b64);
      } catch (err) { console.warn('[sync] week lezen mislukt', err); }
    };
    if (eerste) await apply();
    else toast('Nieuwe week beschikbaar', 'Laden', apply);
    return true;
  }

  // Knop "Nu synchroniseren"
  let syncing = false;
  window.hvwSyncNow = async function () {
    if (syncing) return;
    if (!db || !signedIn) { skipLogin = false; showLogin(); return; }
    syncing = true; setChip('bezig');
    try {
      if (isAdmin) {
        // Beheerder: alles van deze pc opnieuw online zetten
        SHARED_KEYS.forEach(k => { if (ls.get(k) != null) dirty.add(k); });
        clearTimeout(flushTimer);
        if (typeof rawData !== 'undefined' && Array.isArray(rawData) && rawData.length) await saveWeek(rawData);
        const ok = await flush();
        setChip(ok === false ? 'fout' : 'ok');
        toast(ok === false ? 'Delen mislukt — controleer de verbinding' : 'Gedeeld met de andere computers ✓');
      } else {
        // Keuken: meteen het nieuwste binnenhalen
        const [s, w] = await Promise.all([
          db.collection('shared').doc('settings').get({ source: 'server' }),
          db.collection('shared').doc('week').get({ source: 'server' }),
        ]);
        const weekNieuw = await onWeek(w, true);
        const wijzigd = onSettings(s, true);   // herlaadt zelf bij wijzigingen
        setChip('ok');
        if (!wijzigd) toast(weekNieuw ? 'Nieuwe week geladen ✓' : 'Alles is up-to-date ✓');
      }
    } catch (err) {
      console.warn('[sync] handmatig synchroniseren mislukt', err);
      setChip('fout');
      toast('Synchroniseren mislukt — controleer de verbinding');
    } finally { syncing = false; }
  };

  // Bij het opstarten: laatst gekende week meteen tonen (ook zonder verbinding)
  async function loadCachedWeek() {
    const c = ls.get(WEEK_CACHE);
    if (!c) return;
    const i = c.indexOf(':');
    try { loadRows(await unpack(c.slice(0, i), c.slice(i + 1))); } catch (e) {}
  }

  /* ── Aanmelden ── */
  function user() { return auth && auth.currentUser || { email: '' }; }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('laden mislukt: ' + src));
      document.head.appendChild(s);
    });
  }

  async function start() {
    try {
      await loadScript(SDK + 'firebase-app-compat.js');
      await Promise.all([loadScript(SDK + 'firebase-auth-compat.js'), loadScript(SDK + 'firebase-firestore-compat.js')]);
    } catch (e) {
      console.warn('[sync] Firebase niet bereikbaar — app werkt lokaal', e);
      setChip('offline');
      return;
    }
    firebase.initializeApp(CFG.config);
    auth = firebase.auth();
    db = firebase.firestore();
    try { await db.enablePersistence({ synchronizeTabs: true }); } catch (e) {}

    auth.onAuthStateChanged(u => {
      if (!u) { signedIn = false; showLogin(); setChip('uit'); return; }
      const mail = (u.email || '').toLowerCase();
      isAdmin = mail === String(CFG.adminEmail || '').toLowerCase();
      signedIn = true;
      document.body.classList.toggle('hvw-viewer', !isAdmin);
      hideLogin();
      setChip('ok');
      db.collection('shared').doc('settings').onSnapshot(onSettings, e => failed(e));
      db.collection('shared').doc('week').onSnapshot(onWeek, e => failed(e));
    });
  }

  function failed(err) {
    console.warn('[sync]', err);
    if (err && err.code === 'permission-denied') {
      toast('Dit e-mailadres heeft geen toegang');
      auth.signOut();
    } else setChip('fout');
  }

  /* ── Interface ── */
  function css() {
    const s = document.createElement('style');
    s.textContent = `
      body.hvw-viewer #btn-reset-sidebar,
      body.hvw-viewer .sb-bottom .sb-item[onclick*="xl-input"] { display: none !important; }
      #hvw-login { position: fixed; inset: 0; z-index: 99999; background: rgba(26,25,23,.92); display: none; align-items: center; justify-content: center; padding: 20px; }
      #hvw-login .box { background: #fff; border-radius: 14px; padding: 28px; width: 100%; max-width: 340px; font-family: 'Outfit', sans-serif; }
      #hvw-login h2 { margin: 0 0 4px; font: 500 22px 'Cormorant Garamond', serif; }
      #hvw-login p { margin: 0 0 16px; font-size: 13px; color: #6B655E; }
      #hvw-login input { width: 100%; box-sizing: border-box; padding: 11px 12px; margin-bottom: 10px; border: 1px solid #DEDAD4; border-radius: 8px; font-size: 15px; font-family: inherit; }
      #hvw-login button.go { width: 100%; padding: 12px; background: #1A1917; color: #fff; border: 0; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; }
      #hvw-login .err { color: #c0392b; font-size: 13px; min-height: 18px; margin-bottom: 6px; }
      #hvw-login .skip { display: block; margin-top: 14px; text-align: center; font-size: 12px; color: #9A9590; cursor: pointer; }
      #hvw-chip { margin: 6px 12px 2px; padding: 7px 10px; border-radius: 8px; background: rgba(255,255,255,.07); color: #C9C4BB; font: 500 11.5px 'Outfit', sans-serif; line-height: 1.35; }
      #hvw-chip b { color: #fff; display: block; }
      #hvw-chip a { color: #B8965A; cursor: pointer; text-decoration: underline; }
      #hvw-chip .sync-btn { display: block; width: 100%; margin-top: 7px; padding: 8px 10px; background: #B8965A; color: #fff; border: 0; border-radius: 7px; font: 600 12.5px 'Outfit', sans-serif; cursor: pointer; }
      #hvw-toast { position: fixed; right: 16px; bottom: 16px; z-index: 99998; background: #1A1917; color: #fff; padding: 12px 16px; border-radius: 10px; font: 500 13px 'Outfit', sans-serif; display: none; align-items: center; gap: 12px; box-shadow: 0 6px 24px rgba(0,0,0,.25); max-width: 340px; }
      #hvw-toast button { background: #B8965A; color: #fff; border: 0; border-radius: 6px; padding: 6px 12px; font-weight: 600; cursor: pointer; }
    `;
    document.head.appendChild(s);
  }

  let skipLogin = false;
  function showLogin() {
    if (skipLogin) return;
    let el = document.getElementById('hvw-login');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hvw-login';
      el.innerHTML = `
        <form class="box" onsubmit="return false">
          <h2>Keukenapp</h2>
          <p>Meld je aan om de gedeelde gegevens te gebruiken.</p>
          <input type="email" id="hvw-mail" placeholder="E-mailadres" autocomplete="username">
          <input type="password" id="hvw-pw" placeholder="Wachtwoord" autocomplete="current-password">
          <div class="err" id="hvw-err"></div>
          <button class="go" id="hvw-go">Aanmelden</button>
          <span class="skip" id="hvw-skip">Zonder synchronisatie verdergaan</span>
        </form>`;
      document.body.appendChild(el);
      const go = () => {
        const mail = document.getElementById('hvw-mail').value.trim();
        const pw = document.getElementById('hvw-pw').value;
        document.getElementById('hvw-err').textContent = '';
        auth.signInWithEmailAndPassword(mail, pw).catch(err => {
          const c = err && err.code || '';
          document.getElementById('hvw-err').textContent =
            /wrong-password|invalid-credential|user-not-found|invalid-email/.test(c) ? 'E-mailadres of wachtwoord klopt niet.'
            : /network/.test(c) ? 'Geen verbinding.' : 'Aanmelden mislukt.';
        });
      };
      document.getElementById('hvw-go').onclick = go;
      el.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      document.getElementById('hvw-skip').onclick = () => { skipLogin = true; hideLogin(); };
    }
    el.style.display = 'flex';
  }
  function hideLogin() {
    const el = document.getElementById('hvw-login');
    if (el) el.style.display = 'none';
  }

  function setChip(state) {
    let chip = document.getElementById('hvw-chip');
    if (!chip) {
      const bottom = document.querySelector('#sidebar .sb-bottom');
      if (!bottom) return;
      chip = document.createElement('div');
      chip.id = 'hvw-chip';
      bottom.parentNode.insertBefore(chip, bottom);
    }
    const out = ' · <a onclick="window.hvwSyncLogout()">afmelden</a>';
    const knop = isAdmin
      ? '<button class="sync-btn" onclick="window.hvwSyncNow()">↻ Nu delen</button>'
      : '<button class="sync-btn" onclick="window.hvwSyncNow()">↻ Nu synchroniseren</button>';
    chip.innerHTML =
      state === 'ok' && isAdmin ? `<b>☁ Beheerder</b>Wijzigingen worden gedeeld${out}${knop}`
      : state === 'ok' ? `<b>☁ Keuken</b>Uitvoeren en afdrukken${out}${knop}`
      : state === 'bezig' ? `<b>☁ Bezig…</b>Even geduld`
      : state === 'fout' ? `<b>☁ Synchronisatie haperde</b>Wordt opnieuw geprobeerd`
      : state === 'offline' ? `<b>☁ Niet bereikbaar</b>Je werkt met de gegevens van dit toestel`
      : `<b>☁ Niet aangemeld</b><a onclick="window.hvwSyncLogin()">aanmelden</a>`;
  }
  window.hvwSyncLogout = () => auth && auth.signOut();
  window.hvwSyncLogin = () => { skipLogin = false; showLogin(); };

  let toastTimer = null;
  function toast(msg, label, action) {
    let el = document.getElementById('hvw-toast');
    if (!el) { el = document.createElement('div'); el.id = 'hvw-toast'; document.body.appendChild(el); }
    el.innerHTML = '';
    const span = document.createElement('span'); span.textContent = msg; el.appendChild(span);
    if (label) {
      const b = document.createElement('button'); b.textContent = label;
      b.onclick = () => { el.style.display = 'none'; action && action(); };
      el.appendChild(b);
    }
    el.style.display = 'flex';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.style.display = 'none'; }, label ? 30000 : 5000);
  }

  /* ── Opstarten ── */
  document.addEventListener('DOMContentLoaded', () => {
    css();
    // Excel uploaden (beheerder) → ook online zetten
    origProcessData = window.processData;
    if (typeof origProcessData === 'function') {
      window.processData = function (data) {
        origProcessData(data);
        if (!applyingRemote && isAdmin) saveWeek(data);
      };
    }
    // "Verwijder Excel" (beheerder) → ook online wissen
    const origReset = window.resetData;
    if (typeof origReset === 'function') {
      window.resetData = function () {
        const voor = typeof allRows !== 'undefined' ? allRows.length : 0;
        origReset.apply(this, arguments);
        // Enkel als er echt gewist is (niet bij "Annuleren")
        if (!voor || (typeof allRows !== 'undefined' && allRows.length)) return;
        ls.del(WEEK_STAMP); ls.del(WEEK_CACHE);
        if (isAdmin && db) db.collection('shared').doc('week').delete().catch(() => {});
      };
    }
    setChip('uit');
    loadCachedWeek();
    start();
  });
})();
