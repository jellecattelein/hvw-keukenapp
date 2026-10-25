/* ══════════════════════════════════════════
   kiosk.js — de oude kioskmodus is vervangen door de Etiketten-modus
   (zie etiketten-modus.js). Dit bestand ruimt enkel de vroegere
   toestel-instelling op, zodat het oude startscherm ("Waarmee wil je aan
   de slag?") niet meer verschijnt.
   ══════════════════════════════════════════ */
(function () {
  'use strict';
  try { localStorage.removeItem('hvw-kiosk-mode'); } catch (e) {}
})();
