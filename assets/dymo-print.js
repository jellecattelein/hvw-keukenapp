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
    // Canvas: X 0–5040 twips (breedte, 89mm), Y 0–1620 twips (hoogte, 28mm).
    // Layout: links een tekstkolom (heading/sub/note), rechts één samengevoegd
    // blok met datum+plateau ÉN personen — vlak bij elkaar, verticaal
    // gecentreerd, zodat er geen geïsoleerde elementen in de hoeken hangen.
    const hasBadge = !!label.badge;
    const rightColX = 3280;
    const rightColW = 1660;
    const leftColW = hasBadge ? 3020 : 4750;

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

    // ── Linkerkolom: beschrijvende tekst ──
    objs.push(textObject('HEADING', label.heading || '', 150, 90, leftColW, 620, { size: 13.5, bold: true }));
    if (label.sub) {
      objs.push(textObject('SUB', label.sub, 150, 760, leftColW, 360, { size: 9.5, bold: true, color: [90, 87, 83] }));
    }
    if (label.note) {
      objs.push(textObject('NOTE', label.note, 150, 1180, leftColW, 380, { size: 7.5, italic: true, color: [120, 116, 112] }));
    }

    // ── Rechterkolom: datum/plateau + personen, samen als één blok ──
    if (hasBadge) {
      objs.push(textObject('BADGE', label.badge, rightColX, 420, rightColW, 340, { size: 9, align: 'Right', bold: true, color: [154, 128, 74] }));
    }
    if (label.footerRight) {
      const hasSub = !!label.footerSub;
      const badgeOffset = hasBadge ? 800 : 560;
      const footerH = hasSub ? 340 : 500;
      objs.push(textObject('FOOTER', label.footerRight, rightColX, badgeOffset, rightColW, footerH, { size: 16, bold: true, align: 'Right' }));
      if (hasSub) {
        objs.push(textObject('FOOTERSUB', label.footerSub, rightColX, badgeOffset + 350, rightColW, 260, { size: 7.5, align: 'Right', color: [140, 136, 130] }));
      }
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
  // xmlBuilder(label) bouwt de DYMO Label XML voor één label — zo kan deze
  // functie hergebruikt worden voor verschillende etiket-ontwerpen.
  async function tryDirectPrint(labels, xmlBuilder) {
    try {
      const loaded = await ensureSdkLoaded();
      if (!loaded) return false;

      await dymoInit();
      const env = await dymoCheckEnvironment();
      if (!env || !env.isWebServicePresent) return false;

      const printerName = findLabelWriterPrinterName();
      if (!printerName) return false;

      for (const label of labels) {
        const xml = xmlBuilder(label);
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
          <div class="dymo-left">
            <div class="dymo-heading">${esc(label.heading || '')}</div>
            ${label.sub ? `<div class="dymo-sub">${esc(label.sub)}</div>` : ''}
            ${label.note ? `<div class="dymo-note">${esc(label.note)}</div>` : ''}
          </div>
          <div class="dymo-right">
            ${label.badge ? `<div class="dymo-badge">${esc(label.badge)}</div>` : ''}
            ${label.footerRight ? `<div class="dymo-footer-right">${esc(label.footerRight)}</div>` : ''}
            ${label.footerSub ? `<div class="dymo-footer-sub">${esc(label.footerSub)}</div>` : ''}
          </div>
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
    left: 5.5mm; right: 3mm; top: 1.4mm; bottom: 1.4mm;
    display: flex; flex-direction: row; align-items: stretch; gap: 2.5mm;
  }

  .dymo-left {
    flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;
  }

  .dymo-right {
    flex: 0 0 21mm; display: flex; flex-direction: column; justify-content: center;
    align-items: flex-end; gap: 1.2mm; text-align: right;
  }

  .dymo-badge {
    font-size: 8.5pt; font-weight: 700; color: #B8965A;
  }

  .dymo-heading {
    font-size: 13.5pt;
    font-weight: 700;
    color: #1A1917;
    line-height: 1.15;
    max-height: 9mm;
    overflow: hidden;
  }

  .dymo-sub {
    font-size: 9.5pt;
    font-weight: 700;
    color: #5A5753;
    margin-top: 0.9mm;
  }

  .dymo-note {
    font-size: 7.5pt;
    font-style: italic;
    color: #78746E;
    margin-top: 0.7mm;
    max-height: 5.5mm;
    overflow: hidden;
  }

  .dymo-footer-right {
    font-size: 15pt;
    font-weight: 700;
    color: #1A1917;
    line-height: 1;
  }

  .dymo-footer-sub {
    font-size: 7.5pt;
    font-weight: 400;
    color: #8C8882;
    margin-top: 0.6mm;
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

  // docBuilder(labels) bouwt het volledige HTML-printdocument — zo kan deze
  // functie hergebruikt worden voor verschillende etiket-ontwerpen.
  function printViaDialog(labels, docBuilder) {
    const w = window.open('', '_blank', 'width=420,height=220');
    if (!w) {
      alert('Kon geen printvenster openen. Controleer of pop-ups zijn toegestaan voor deze pagina.');
      return;
    }
    w.document.open();
    w.document.write(docBuilder(labels));
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
    const directOk = await tryDirectPrint(labels, buildDymoLabelXml);
    if (directOk) return;
    printViaDialog(labels, buildDocument);
  };

  /* ══════════════════════════════════════════
     3) KEUKENETIKET "1B — Zijkolom" (Portie-Etiketten)
     Dymo 99010, 89×28mm. Ontwerp: design_handoff_dymo_99010_label
     (variant 1B). Enkel gebruikt door portie-etiketten.js — de andere
     modules (Karren-, Snelle Etiketten, Broodjes) gebruiken het generieke
     hvwDymoPrint hierboven en blijven ongewijzigd.

     Datamodel per etiket (KitchenLabel), zie de handoff-README:
       dishName, portions, location, moment, prodDate, thtDate, dayDate,
       seq, pieces, unit ('st'|'g'|'kg'), totalGuests, splitNote
     ══════════════════════════════════════════ */

  const KL_INK = [0, 0, 0];
  const KL_INK_SECONDARY = [51, 51, 51];

  // Combineert portions/location/moment tot de metaregel, met " · " tussen
  // de aanwezige velden — ontbrekende velden worden gewoon overgeslagen.
  function klMetaText(label) {
    return [label.portions, label.location, label.moment].filter(Boolean).join(' · ');
  }
  function klDaySeqText(label) {
    return [label.dayDate, label.seq].filter(Boolean).join(' · ');
  }

  /* ── 3a) DYMO Label XML (direct printen) ──
     Canvas 5040×1620 twips (89×28mm, zelfde "30252 Address" preset als
     hierboven). Font-groottes zijn overgenomen uit de mm→pt-equivalenten
     die de handoff-README zelf al aangeeft (bv. 4.3mm ≈ 12.2pt). DYMO XML
     kent geen tussenliggende font-weights (enkel Bold true/false) en geen
     flexbox — de rechterkolom wordt daarom in JS verticaal gecentreerd
     berekend op basis van welke regels aanwezig zijn, net zoals de
     bestaande buildDymoLabelXml hierboven al deed voor de optionele badge. */
  function buildKitchenLabelXml(label) {
    const CANVAS_W = 5040, CANVAS_H = 1620;
    const RIGHT_W = 1360, RIGHT_X = CANVAS_W - RIGHT_W; // 3680
    const LEFT_X = 159, LEFT_W = RIGHT_X - 136 - LEFT_X; // padding-left 2.8mm, inset 2.4mm voor de scheidingslijn

    function textObject(name, text, x, y, w, h, opts) {
      opts = opts || {};
      const size = opts.size || 10;
      const bold = opts.bold ? 'True' : 'False';
      const align = opts.align || 'Left';
      const c = opts.color || KL_INK;
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
            <Font Family="Arial" Size="${size}" Bold="${bold}" Italic="False" Underline="False" Strikeout="False" />
            <ForeColor Alpha="255" Red="${c[0]}" Green="${c[1]}" Blue="${c[2]}" />
          </Attributes>
        </Element>
      </StyledText>
    </TextObject>
    <Bounds X="${x}" Y="${y}" Width="${w}" Height="${h}" />
  </ObjectInfo>`;
    }

    // Cijfer + eenheid (bv. "45" + " st") als twee tekst-runs binnen 1
    // tekstobject, zodat ze — net als in het ontwerp — op dezelfde
    // basislijn naast elkaar staan i.p.v. twee apart gepositioneerde objecten.
    function multiRunTextObject(name, runs, x, y, w, h, align) {
      const elements = runs.map(r => {
        const c = r.color || KL_INK;
        return `<Element>
          <String>${escXml(r.text)}</String>
          <Attributes>
            <Font Family="Arial" Size="${r.size}" Bold="${r.bold ? 'True' : 'False'}" Italic="False" Underline="False" Strikeout="False" />
            <ForeColor Alpha="255" Red="${c[0]}" Green="${c[1]}" Blue="${c[2]}" />
          </Attributes>
        </Element>`;
      }).join('\n        ');
      return `<ObjectInfo>
    <TextObject>
      <Name>${name}</Name>
      <ForeColor Alpha="255" Red="0" Green="0" Blue="0" />
      <BackColor Alpha="0" Red="255" Green="255" Blue="255" />
      <LinkedObjectName></LinkedObjectName>
      <Rotation>Rotation0</Rotation>
      <IsMirrored>False</IsMirrored>
      <IsVariable>False</IsVariable>
      <HorizontalAlignment>${align || 'Center'}</HorizontalAlignment>
      <VerticalAlignment>Middle</VerticalAlignment>
      <TextFitMode>ShrinkToFit</TextFitMode>
      <UseFullFontHeight>False</UseFullFontHeight>
      <Verticalized>False</Verticalized>
      <StyledText>
        ${elements}
      </StyledText>
    </TextObject>
    <Bounds X="${x}" Y="${y}" Width="${w}" Height="${h}" />
  </ObjectInfo>`;
    }

    const objs = [];

    // ── Linkerkolom: gerechtnaam, metaregel, productie/THT ──
    objs.push(textObject('DISHNAME', label.dishName || '', LEFT_X, 127, LEFT_W, 538, { size: 12.2, bold: true }));
    const metaText = klMetaText(label);
    if (metaText) {
      objs.push(textObject('META', metaText, LEFT_X, 711, LEFT_W, 202, { size: 8.2, color: KL_INK_SECONDARY }));
    }
    if (label.prodDate) {
      objs.push(textObject('PROD', `Geprod ${label.prodDate}`, LEFT_X, 1313, 1700, 194, { size: 7.9, color: KL_INK_SECONDARY }));
    }
    if (label.thtDate) {
      objs.push(textObject('THT', `THT ${label.thtDate}`, LEFT_X + 1870, 1313, 1500, 194, { size: 7.9, bold: true }));
    }

    // ── Rechterkolom: aantallen, verticaal gecentreerd op basis van welke
    //    regels effectief aanwezig zijn (pieces + totalGuests altijd; split
    //    en dag/volgnummer enkel indien van toepassing). ──
    const daySeqText = klDaySeqText(label);
    const ROW_GAP = 35; // 0.6mm
    const rows = [{ key: 'pieces', h: 410 }, { key: 'totalGuests', h: 170 }];
    if (label.splitNote) rows.push({ key: 'split', h: 155 });
    if (daySeqText) rows.push({ key: 'dayseq', h: 190 });
    const contentH = rows.reduce((s, r) => s + r.h, 0) + ROW_GAP * (rows.length - 1);
    const padT = 81; // 1.4mm
    let y = padT + Math.max(0, (CANVAS_H - padT * 2 - contentH) / 2);
    const rowX = RIGHT_X + 57, rowW = RIGHT_W - 114; // padding 1mm links/rechts

    rows.forEach(row => {
      if (row.key === 'pieces') {
        const piecesStr = String(label.pieces ?? '');
        const bigSize = piecesStr.replace('.', '').length >= 4 ? 16.4 : 21; // "grote getallen"-regel uit de handoff
        objs.push(multiRunTextObject('PIECES', [
          { text: piecesStr, size: bigSize, bold: true },
          { text: ' ' + (label.unit || 'st'), size: 8.5, bold: true },
        ], rowX, row.y ?? y, rowW, row.h, 'Center'));
      } else if (row.key === 'totalGuests') {
        objs.push(textObject('TOTALGUESTS', `van ${label.totalGuests ?? ''} p.`, rowX, y, rowW, row.h, { size: 7.4, bold: true, align: 'Center' }));
      } else if (row.key === 'split') {
        objs.push(textObject('SPLIT', label.splitNote, rowX, y, rowW, row.h, { size: 6.8, align: 'Center', color: KL_INK_SECONDARY }));
      } else if (row.key === 'dayseq') {
        objs.push(textObject('DAYSEQ', daySeqText, rowX, y, rowW, row.h, { size: 7.65, bold: true, align: 'Center' }));
      }
      y += row.h + ROW_GAP;
    });

    return `<?xml version="1.0" encoding="utf-8"?>
<DieCutLabel Version="8.0" Units="twips">
  <PaperOrientation>Landscape</PaperOrientation>
  <Id>Address</Id>
  <PaperName>30252 Address</PaperName>
  <DrawCommands/>
  ${objs.join('\n  ')}
</DieCutLabel>`;
  }

  /* ── 3b) Browser-printdialoog fallback — HTML/CSS, maatvast (1 CSS-mm = 1mm) ── */
  function buildKitchenLabelHTML(label) {
    const metaText = klMetaText(label);
    const daySeqText = klDaySeqText(label);
    const piecesLen = String(label.pieces ?? '').replace('.', '').length;
    return `
      <div class="kl-label">
        <div class="kl-left">
          <div class="kl-top">
            <div class="kl-dishname">${esc(label.dishName || '')}</div>
            ${metaText ? `<div class="kl-meta">${esc(metaText)}</div>` : ''}
          </div>
          <div class="kl-datesrow">
            ${label.prodDate ? `<span>Geprod ${esc(label.prodDate)}</span>` : ''}
            ${label.thtDate ? `<span class="kl-tht">THT ${esc(label.thtDate)}</span>` : ''}
          </div>
        </div>
        <div class="kl-right">
          <div class="kl-pieces-row">
            <div class="kl-pieces-num${piecesLen >= 4 ? ' kl-pieces-num-lg' : ''}">${esc(String(label.pieces ?? ''))}</div>
            <div class="kl-pieces-unit">${esc(label.unit || 'st')}</div>
          </div>
          <div class="kl-totalguests">van ${esc(String(label.totalGuests ?? ''))} p.</div>
          ${label.splitNote ? `<div class="kl-splitnote">${esc(label.splitNote)}</div>` : ''}
          ${daySeqText ? `<div class="kl-dayseq">${esc(daySeqText)}</div>` : ''}
        </div>
      </div>`;
  }

  function buildKitchenDocument(labels) {
    const body = labels.map(buildKitchenLabelHTML).join('\n');
    return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<title>HVW — Keukenetiketten</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: ${LABEL_W_MM}mm ${LABEL_H_MM}mm; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Archivo Narrow', 'Roboto Condensed', sans-serif; }

  .kl-label {
    position: relative;
    width: ${LABEL_W_MM}mm; height: ${LABEL_H_MM}mm;
    overflow: hidden; display: flex; color: #000;
    page-break-after: always; break-after: page;
  }
  .kl-label:last-child { page-break-after: auto; break-after: auto; }

  .kl-left {
    flex: 1; min-width: 0; padding: 2.2mm 2.4mm 2mm 2.8mm;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .kl-top { display: flex; flex-direction: column; gap: 0.8mm; }
  .kl-dishname {
    font-size: 4.3mm; font-weight: 700; line-height: 1.08; letter-spacing: -0.01em;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .kl-dishname.kl-shrink { font-size: 3.9mm; }
  .kl-meta {
    font-size: 2.9mm; font-weight: 500; color: #333;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .kl-datesrow { display: flex; gap: 3mm; font-size: 2.8mm; color: #333; }
  .kl-tht { font-weight: 700; color: #000; }

  .kl-right {
    width: 24mm; flex: none; border-left: 0.3mm dashed #000;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.6mm;
    padding: 1.4mm 1mm;
  }
  .kl-pieces-row { display: flex; align-items: baseline; gap: 0.8mm; }
  .kl-pieces-num { font-size: 7.4mm; font-weight: 700; line-height: 0.95; }
  .kl-pieces-num-lg { font-size: 5.8mm; }
  .kl-pieces-unit { font-size: 3mm; font-weight: 600; }
  .kl-totalguests { font-size: 2.6mm; font-weight: 600; letter-spacing: 0.04em; text-align: center; line-height: 1.1; }
  .kl-splitnote { font-size: 2.4mm; color: #333; text-align: center; line-height: 1.1; }
  .kl-dayseq { margin-top: 0.8mm; font-size: 2.7mm; font-weight: 700; }
</style>
</head>
<body>
${body}
<script>
  function fitDishNames() {
    document.querySelectorAll('.kl-dishname').forEach(function (el) {
      var clone = el.cloneNode(true);
      clone.style.webkitLineClamp = 'unset';
      clone.style.display = 'block';
      clone.style.visibility = 'hidden';
      clone.style.position = 'absolute';
      clone.style.width = el.clientWidth + 'px';
      el.parentNode.appendChild(clone);
      var lh = parseFloat(getComputedStyle(el).lineHeight) || (el.clientHeight / 2);
      if (clone.scrollHeight > lh * 2 + 1) el.classList.add('kl-shrink');
      clone.remove();
    });
  }
  function go() {
    fitDishNames();
    setTimeout(function () { window.focus(); window.print(); }, 150);
  }
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(go).catch(go); }
  else { window.onload = go; }
  window.onafterprint = function () { window.close(); };
</script>
</body>
</html>`;
  }

  /**
   * Print de opgegeven Keukenetiketten (Portie-Etiketten, ontwerp 1B).
   * Zelfde direct/fallback-strategie als hvwDymoPrint, maar met het nieuwe
   * ontwerp. @param {Array<Object>} labels - zie KitchenLabel hierboven.
   */
  window.hvwDymoPrintKitchenLabel = async function (labels) {
    if (!labels || !labels.length) {
      alert('Geen etiketten om te printen.');
      return;
    }
    const directOk = await tryDirectPrint(labels, buildKitchenLabelXml);
    if (directOk) return;
    printViaDialog(labels, buildKitchenDocument);
  };

})();
