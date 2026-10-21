/* ══════════════════════════════════════════
   ai-split.js — gerechten opdelen in onderdelen (vis, garnituur, saus)

   window.hvwSplitGerecht(naam) → { bron: 'ai' | 'regels', onderdelen: [...] }

   - 'ai': Gemini via Firebase AI Logic (gebruikt het Firebase-project uit
     firebase-config.js; geen eigen API-sleutel nodig).
   - 'regels': eenvoudige opdeling op komma's en "met", als fallback
     wanneer de AI niet bereikbaar is.
   Het resultaat is altijd een VOORSTEL: de gebruiker controleert het in
   het scherm "Samengesteld gerecht" voor het wordt opgeslagen.
   ══════════════════════════════════════════ */
(function () {
  'use strict';

  const SDK = 'https://www.gstatic.com/firebasejs/12.0.0/';
  // "-latest" volgt automatisch het nieuwste flash-model (oude modellen worden
  // door Google na verloop van tijd uitgeschakeld). Aanpasbaar via `aiModel`
  // in firebase-config.js.
  const STANDAARD_MODEL = 'gemini-flash-latest';
  // Startwaarden; de gebruiker past ze aan bij het controleren
  const STANDAARD_STUK = 12;      // personen per plateau
  const STANDAARD_SAUS_GRAM = 30; // gram per persoon

  let modelPromise = null;

  function getModel() {
    if (modelPromise) return modelPromise;
    modelPromise = (async () => {
      const cfg = window.HVW_FIREBASE;
      if (!cfg || !cfg.config) throw new Error('Firebase niet ingesteld');
      const [{ initializeApp, getApps, getApp }, { getAI, getGenerativeModel, GoogleAIBackend }] = await Promise.all([
        import(SDK + 'firebase-app.js'),
        import(SDK + 'firebase-ai.js'),
      ]);
      const app = getApps().some(a => a.name === 'hvw-ai') ? getApp('hvw-ai') : initializeApp(cfg.config, 'hvw-ai');
      const ai = getAI(app, { backend: new GoogleAIBackend() });
      return getGenerativeModel(ai, {
        model: cfg.aiModel || STANDAARD_MODEL,
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      });
    })();
    modelPromise.catch(() => { modelPromise = null; });
    return modelPromise;
  }

  function nieuwId() { return Date.now().toString() + Math.random().toString(36).slice(2, 6); }

  function maakOnderdeel(naam, soort) {
    const lijktOpSaus = /\b(saus|jus|espuma|dressing|vinaigrette|mayonaise|emulsie|olie|dip|puree|coulis|beurre blanc|fond|bouillon)\b/i.test(naam);
    const saus = soort === 'saus' || (lijktOpSaus && soort !== 'hoofd');
    return saus
      ? { id: nieuwId(), naam, eenheid: 'gram', perPlateau: STANDAARD_SAUS_GRAM }
      : { id: nieuwId(), naam, eenheid: 'stuk', perPlateau: STANDAARD_STUK };
  }

  // Eenvoudige opdeling: komma's, en "met" enkel in het eerste stuk
  function splitRegels(naam) {
    const delen = String(naam || '').split(',').map(s => s.trim()).filter(Boolean);
    const uit = [];
    delen.forEach((d, i) => {
      if (i === 0) {
        const m = d.split(/\s+met\s+/i);
        m.forEach(x => x.trim() && uit.push(x.trim()));
      } else uit.push(d.replace(/^met\s+/i, ''));
    });
    const gezien = new Set();
    return uit.filter(x => {
      const k = x.toLowerCase();
      if (gezien.has(k)) return false;
      gezien.add(k); return true;
    }).map((n, i) => maakOnderdeel(n.charAt(0).toUpperCase() + n.slice(1), i === 0 ? 'hoofd' : ''));
  }

  function prompt(naam) {
    return `Je helpt de keuken van een traiteur. Hieronder staat de naam van een gerecht uit de bestelling.
Verdeel het gerecht in de onderdelen die elk een apart etiket krijgen: het hoofdbestanddeel (bv. vis of vlees), de garnituren en de sauzen.

Regels:
- Gebruik de Nederlandse benamingen uit de tekst; verzin niets bij.
- Een onderdeel dat zelf uit "met ..." bestaat (bv. "Tartelette met crème van erwtjes en jonge kruidensalade") blijft één onderdeel.
- Behoud de naam van elk onderdeel zoals in de tekst (bv. "Gebakken zeebaars").
- Geef elk onderdeel een soort: "hoofd", "garnituur" of "saus".

Antwoord enkel met JSON in dit formaat: [{"naam": "...", "soort": "hoofd"}]

Gerecht: ${naam}`;
  }

  async function splitAi(naam) {
    const model = await getModel();
    const result = await Promise.race([
      model.generateContent(prompt(naam)),
      new Promise((_, rej) => setTimeout(() => rej(new Error('time-out')), 20000)),
    ]);
    let tekst = result.response.text().trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const lijst = JSON.parse(tekst);
    if (!Array.isArray(lijst) || !lijst.length) throw new Error('leeg antwoord');
    const uit = lijst
      .filter(x => x && typeof x.naam === 'string' && x.naam.trim())
      .map(x => maakOnderdeel(x.naam.trim(), x.soort));
    if (!uit.length) throw new Error('geen onderdelen');
    return uit;
  }

  window.hvwSplitGerecht = async function (naam) {
    naam = String(naam || '').trim();
    if (!naam) return { bron: 'regels', onderdelen: [] };
    try {
      return { bron: 'ai', onderdelen: await splitAi(naam) };
    } catch (err) {
      const msg = String(err && err.message || err);
      console.warn('[ai-split] AI niet gelukt, regels gebruikt:', msg);
      // Gratis niveau: beperkt aantal aanvragen per minuut, en soms is het model druk
      const reden = /429|quota/i.test(msg) ? 'limiet' : /500|503|high demand|overload/i.test(msg) ? 'druk' : 'andere';
      return { bron: 'regels', onderdelen: splitRegels(naam), fout: msg, reden };
    }
  };
  window.hvwSplitGerechtRegels = splitRegels;
})();
