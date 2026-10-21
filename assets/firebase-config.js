/* ══════════════════════════════════════════
   firebase-config.js — instellingen voor de gedeelde gegevens

   Zolang `config` op null staat, werkt de app precies zoals voorheen
   (alles enkel in de browser van dit toestel). Zie FIREBASE_INSTELLEN.md
   voor de stappen om dit in te vullen.

   Deze waarden zijn GEEN geheimen: ze staan in elke Firebase-webapp. De
   beveiliging zit in de aanmelding en in de regels in firestore.rules.
   ══════════════════════════════════════════ */
window.HVW_FIREBASE = {
  config: null,
  // Enkel dit e-mailadres mag wijzigen (Excel uploaden, instellingen aanpassen).
  adminEmail: 'jelle@hvw.be',
  // Overige toegelaten e-mailadressen (enkel uitvoeren en afdrukken).
  viewerEmails: [],
};
