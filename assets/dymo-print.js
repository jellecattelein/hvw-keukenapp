/* ══════════════════════════════════════════
   dymo-print.js — Print naar Dymo LabelWriter 450 Turbo
   Labelrol: S0722370 — Standard Address, 28×89mm
   (= DYMO "30252 Address" preset, 1-1/8" × 3-1/2")

   TWEE MANIEREN VAN PRINTEN:

   1) DIRECT (stil, geen dialoog) — via de DYMO Connect
      Web Service die lokaal draait op de PC waar de Dymo
      op is aangesloten (DYMO Connect software moet daar
      geïnstalleerd + actief zijn). Dit is de standaardweg
      op de PC.

   2) FALLBACK (via browser printdialoog) — wanneer de
      DYMO Connect-service niet gevonden wordt (bv. op een
      iPad, of een toestel zonder DYMO Connect). Er wordt
      dan een printvenster geopend op exact 89×28mm; je
      kiest zelf de Dymo-printer in de systeemdialoog.

   Gebruik vanuit een module (ongewijzigd t.o.v. voorheen):
     window.hvwDymoPrint([
       {
         heading: 'Wortelen',
         sub: '1/1 emmer',
         badge: 'ma 12/08',
         footerRight: '32 pers.',
         note: 'Extra kruiden',
         color: [184,150,90],
       },
       ...
     ]);
   ══════════════════════════════════════════ */

(function () {
  'use strict';

  const LABEL_W_MM = 89;
  const LABEL_H_MM = 28;

  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function escXml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function rgbCss(rgb) {
    if (!Array.isArray(rgb) || rgb.length !== 3) return 'rgb(184,150,90)';
    return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
  }

  /* ══════════════════════════════
     1) DIRECT PRINTEN via DYMO Connect SDK
     ══════════════════════════════ */

  let sdkLoadPromise = null;
  function ensureSdkLoaded() {
    if (window.dymo && window.dymo.label && window.dymo.label.framework) {
      return Promise.resolve(true);
    }
    if (sdkLoadPromise) return sdkLoadPromise;
    sdkLoadPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'assets/dymo.connect.framework.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
      // Vangnet: als script na 4s nog niet geladen is, geef op (val terug op printdialoog)
      setTimeout(() => resolve(!!(window.dymo && window.dymo.label && window.dymo.label.framework)), 4000);
    });
    return sdkLoadPromise;
  }

  function dymoInit() {
    return new Promise((resolve) => {
      try {
        window.dymo.label.framework.init(() => resolve(true));
        // Vangnet indien de callback nooit vuurt
        setTimeout(() => resolve(true), 2500);
      } catch (e) {
        resolve(false);
      }
    });
  }

  function dymoCheckEnvironment() {
    return new Promise((resolve) => {
      try {
        window.dymo.label.framework.checkEnvironment(
          (result) => resolve(result),
          () => resolve({ isWebServicePresent: false })
        );
        setTimeout(() => resolve({ isWebServicePresent: false }), 3000);
      } catch (e) {
        resolve({ isWebServicePresent: false });
      }
    });
  }

  function findLabelWriterPrinterName() {
    try {
      const printers = window.dymo.label.framework.getPrinters();
      for (let i = 0; i < printers.length; i++) {
        if (printers[i].printerType === 'LabelWriterPrinter') {
          return printers[i].name;
        }
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  // Bouwt één DYMO Label XML (DieCutLabel, preset "30252 Address" = S0722370 28×89mm)
  // met tot 4 tekstvelden. Canvas: X 0–5040 twips (breedte), Y 0–1620 twips (hoogte).
  function buildDymoLabelXml(label) {
    const hasBadge = !!label.badge;
    const headingWidth = hasBadge ? 3150 : 4750;

    function textObject(name, text, x, y, w, h, opts) {
      opts = opts || {};
      const size = opts.size || 10;
      const bold = opts.bold ? 'True' : 'False';
      const italic = opts.italic ? 'True' : 'False';
      const align = opts.align || 'Left';
      const c = opts.color || [26, 25, 23];
      return `<ObjectInfo>
    <TextObject>
      <Name>${name}</Name>
      <ForeColor Alpha="255" Red="${c[0]}" Green="${c[1]}" Blue="${c[2]}" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>${align}</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>False</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        <Element>
          <String>${escXml(text)}</String>
          <Attributes>
            <Font Family="Arial" Size="${size}" Bold="${bold}" Italic="${italic}" Underline="False" Strikeout="False" />
            <ForeColor Alpha="255" Red="${c[0]}" Green="${c[1]}" Blue="${c[2]}" />
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="${x}" Y="${y}" Width="${w}" Height="${h}" />
  </ObjectInfo>`;
    }

    const objs = [];
    if (hasBadge) {
      objs.push(textObject('BADGE', label.badge, 3350, 60, 1600, 360, { size: 7, align: 'Right', color: [154, 144, 129] }));
    }
    objs.push(textObject('HEADING', label.heading || '', 150, 60, headingWidth, 640, { size: 12, bold: true }));
    if (label.sub) {
      objs.push(textObject('SUB', label.sub, 150, 720, 4750, 380, { size: 8, bold: true, color: [90, 87, 83] }));
    }
    if (label.note) {
      objs.push(textObject('NOTE', label.note, 150, 1130, 3150, 380, { size: 6.5, italic: true, color: [120, 116, 112] }));
    }
    if (label.footerRight) {
      objs.push(textObject('FOOTER', label.footerRight, 3350, 1110, 1600, 400, { size: 10, bold: true, align: 'Right' }));
    }

    return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>Address</Id>
  <PaperName>30252 Address</PaperName>
  <DrawCommands/>
  ${objs.join('\n  ')}
</DieCutLabel>`;
  }

  // Probeert alle labels stil te printen via DYMO Connect. Geeft true terug bij
  // succes, false als er teruggevallen moet worden op de browser-printdialoog.
  async function tryDirectPrint(labels) {
    try {
      const loaded = await ensureSdkLoaded();
      if (!loaded) return false;

      await dymoInit();
      const env = await dymoCheckEnvironment();
      if (!env || !env.isWebServicePresent) return false;

      const printerName = findLabelWriterPrinterName();
      if (!printerName) return false;

      for (const label of labels) {
        const xml = buildDymoLabelXml(label);
        const labelObj = window.dymo.label.framework.openLabelXml(xml);
        labelObj.print(printerName);
      }
      return true;
    } catch (e) {
      console.error('Dymo direct print mislukt, val terug op printdialoog:', e);
      return false;
    }
  }

  /* ══════════════════════════════
     2) FALLBACK: printen via browser printdialoog
     ══════════════════════════════ */

  function buildLabelHTML(label) {
    const barColor = rgbCss(label.color);
    return `
      <div class="dymo-label">
        <div class="dymo-bar" style="background:${barColor}"></div>
        <div class="dymo-content">
          ${label.badge ? `<div class="dymo-badge">${esc(label.badge)}</div>` : ''}
          <div class="dymo-heading">${esc(label.heading || '')}</div>
          ${label.sub ? `<div class="dymo-sub">${esc(label.sub)}</div>` : ''}
          ${label.note ? `<div class="dymo-note">${esc(label.note)}</div>` : ''}
          ${label.footerRight ? `<div class="dymo-footer-right">${esc(label.footerRight)}</div>` : ''}
        </div>
      </div>`;
  }

  function buildDocument(labels) {
    const body = labels.map(buildLabelHTML).join('\n');
    return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>HVW — Dymo etiketten</title>
<style>
  @page { size: ${LABEL_W_MM}mm ${LABEL_H_MM}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Helvetica, Arial, sans-serif; }

  .dymo-label {
    position: relative;
    width: ${LABEL_W_MM}mm;
    height: ${LABEL_H_MM}mm;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
  }
  .dymo-label:last-child { page-break-after: auto; break-after: auto; }

  .dymo-bar {
    position: absolute; left: 0; top: 0; bottom: 0; width: 3.2mm;
  }

  .dymo-content {
    position: absolute;
    left: 5.5mm; right: 3mm; top: 1.6mm; bottom: 1.4mm;
  }

  .dymo-badge {
    position: absolute; top: 0; right: 0;
    font-size: 7pt; color: #B8965A; font-weight: 400;
  }

  .dymo-heading {
    font-size: 12.5pt;
    font-weight: 700;
    color: #1A1917;
    line-height: 1.15;
    max-height: 8.5mm;
    overflow: hidden;
    padding-right: 14mm;
  }

  .dymo-sub {
    font-size: 8.5pt;
    font-weight: 700;
    color: #5A5753;
    margin-top: 0.8mm;
  }

  .dymo-note {
    font-size: 7pt;
    font-style: italic;
    color: #78746E;
    margin-top: 0.6mm;
    max-height: 5mm;
    overflow: hidden;
  }

  .dymo-footer-right {
    position: absolute;
    bottom: 0; right: 0;
    font-size: 9.5pt;
    font-weight: 700;
    color: #1A1917;
  }
</style>
</head>
<body>
${body}
<script>
  window.onload = function () {
    setTimeout(function () {
      window.focus();
      window.print();
    }, 150);
  };
  window.onafterprint = function () { window.close(); };
</script>
</body>
</html>`;
  }

  function printViaDialog(labels) {
    const w = window.open('', '_blank', 'width=420,height=220');
    if (!w) {
      alert('Kon geen printvenster openen. Controleer of pop-ups zijn toegestaan voor deze pagina.');
      return;
    }
    w.document.open();
    w.document.write(buildDocument(labels));
    w.document.close();
  }

  /* ══════════════════════════════
     Publieke functie
     ══════════════════════════════ */

  /**
   * Print de opgegeven etiketten. Probeert eerst stil te printen via de
   * lokale DYMO Connect-service (geen dialoog); lukt dat niet (bv. geen
   * DYMO Connect op dit toestel, zoals op een iPad), dan valt het terug
   * op de browser-printdialoog op exact 89×28mm.
   * @param {Array<Object>} labels - zie kopcommentaar voor het formaat.
   */
  window.hvwDymoPrint = async function (labels) {
    if (!labels || !labels.length) {
      alert('Geen etiketten om te printen.');
      return;
    }
    const directOk = await tryDirectPrint(labels);
    if (directOk) return;
    printViaDialog(labels);
  };

})();
