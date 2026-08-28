// pdf-print.js — genereaza documentul "PDF" (Proces Verbal + Aviz de
// insotire + anexe foto) ca pagini HTML/CSS formatate pentru tipar A4, apoi
// declanseaza fereastra de printare a browserului ("Salveaza ca PDF").
// Continutul text/legal este pastrat identic cu versiunea Flutter
// (process_verbal_pdf.dart); layout-ul vizual este recreat de la zero,
// mai "premium" (tipografie, culori, spatiere).

import {
  countyAbbreviation,
  extractCountyFromAddress,
  extractLocationFromAddress,
  formatDateRo,
  shortDriverName,
  weekdayLabelRo,
  displayOrNa,
  withoutDiacritics,
  fileToken,
} from './utils.js';
import { CONDITIONS_BY_TYPE, COMPANY_INFO, confirmationBanner } from './catalog-defaults.js';
import { displayPvNumber, displayAvizNumber } from './pv-numbering.js';
import { pushScreen } from './router.js';
import { el } from './utils.js';
import { showToast } from './components.js';
import { generateDocumentPdfBlob } from './pdf-generate.js';

const NA = 'N/A';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function splitModelType(combined) {
  const value = (combined || '').trim();
  if (!value) return { model: '', type: '' };
  const extraMatch = /^(.+?)\s*(?:\|\s*(.+))?$/.exec(value);
  const withoutExtra = (extraMatch && extraMatch[1] ? extraMatch[1] : value).trim();
  const extras = (extraMatch && extraMatch[2]) || '';
  const baseMatch = /^(.*?)\s*\((.*?)\)\s*$/.exec(withoutExtra);
  const modelName = baseMatch ? (baseMatch[1] || '').trim() : withoutExtra;
  const typeBase = baseMatch ? (baseMatch[2] || '').trim() : '';
  if (!extras.trim()) return { model: modelName, type: typeBase };
  const typeWithExtras = typeBase ? `${typeBase} | ${extras.trim()}` : extras.trim();
  return { model: modelName, type: typeWithExtras };
}

// Prefix fix pentru orice serie afisata in document — soferul tasteaza doar
// partea variabila (vezi seriesField() din screens-pv-form.js), care poate
// veni deja fara sau (din date vechi) cu "EE-" pus manual; nu il dublam.
function withSeriesPrefix(raw) {
  const clean = String(raw || '').trim();
  if (!clean) return '';
  return /^EE-/i.test(clean) ? clean : `EE-${clean}`;
}

/** Randeaza lista de serii ale unui produs ca text cu delimitator "; ",
 * maxim 6 serii pe linie — grupele suplimentare de 6 trec pe randul urmator
 * (in interiorul aceleiasi celule din tabel). */
function formatSeriesCell(seriesList) {
  if (!seriesList.length) return '-';
  const withPrefix = seriesList.map(withSeriesPrefix);
  const lines = [];
  for (let i = 0; i < withPrefix.length; i += 6) {
    lines.push(withPrefix.slice(i, i + 6).map(esc).join('; '));
  }
  return lines.join('<br>');
}

function productRows(model) {
  const modelEntries = (model.productModel || '').split(';').map((e) => e.trim()).filter(Boolean);
  const seriesGroups = (model.productSeries || '').split(';').map((e) => e.trim());
  const qty = parseInt(String(model.field3 || '').replace(/[^0-9-]/g, ''), 10);
  const hasNoSeriesData = seriesGroups.every((g) => !g);
  const activeRows = modelEntries.length > seriesGroups.length ? modelEntries.length : modelEntries.length || 1;
  const rows = [];
  for (let i = 0; i < activeRows; i++) {
    const combined = i < modelEntries.length ? modelEntries[i] : '';
    const split = splitModelType(combined);
    const seriesGroup = i < seriesGroups.length ? seriesGroups[i] : '';
    const seriesList = seriesGroup.split(',').map((s) => s.trim()).filter(Boolean);
    const bucCount = seriesList.length
      ? seriesList.length
      : hasNoSeriesData && i === 0 && !isNaN(qty) && qty !== 0
      ? Math.abs(qty)
      : 1;
    rows.push({ buc: bucCount, model: split.model, type: split.type, seriesList });
  }
  return rows;
}

function avizRows(model) {
  const modelEntries = (model.productModel || '').split(';').map((e) => e.trim()).filter(Boolean);
  const seriesGroups = (model.productSeries || '').split(';').map((e) => e.trim());
  const qty = parseInt(String(model.field3 || '').replace(/[^0-9-]/g, ''), 10);
  const rows = [];
  modelEntries.forEach((combined, i) => {
    const split = splitModelType(combined);
    const seriesGroup = i < seriesGroups.length ? seriesGroups[i] : '';
    const seriesFormatted = seriesGroup.split(',').map((s) => s.trim()).filter(Boolean).join(', ');
    const baseDenumire = split.type ? `${split.model} - ${split.type}` : split.model;
    const denumire = seriesFormatted ? `${baseDenumire} | ${seriesFormatted}` : baseDenumire;
    const cant = seriesFormatted
      ? seriesGroup.split(',').filter((s) => s.trim()).length
      : i === 0 && !isNaN(qty) && qty !== 0
      ? Math.abs(qty)
      : 1;
    rows.push([String(i + 1), denumire, 'BUC', String(cant)]);
  });
  if (!rows.length) rows.push(['1', '-', 'BUC', '1']);
  return rows;
}

function anexaFotoTitle(model, index) {
  const client = (model.clientName || '').trim() || 'BENEFICIAR';
  const locationRaw = extractLocationFromAddress(model.field1);
  const location = locationRaw || 'LOCATIE NECUNOSCUTA';
  const countyRaw = extractCountyFromAddress(model.field1);
  const countyShort = countyAbbreviation(countyRaw || model.depotName);
  return `ANEXA FOTO ${index} : ${withoutDiacritics(client).toUpperCase()}, ${withoutDiacritics(location).toUpperCase()}, [${countyShort}]`;
}

function docDateTime(iso) {
  const dt = iso ? new Date(iso) : new Date();
  return {
    date: `${weekdayLabelRo(dt, true)} _ ${formatDateRo(dt)}`,
    hour: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`,
    short: `${String(dt.getDate()).padStart(2, '0')} - ${String(dt.getMonth() + 1).padStart(2, '0')} - ${dt.getFullYear()}`,
  };
}

function runningFooter(model, depotEmail, depotPhone, pageIndex, pageTotal) {
  const pageLabel = pageIndex && pageTotal ? `<div class="doc-footer-sep"></div><div class="doc-footer-page">Pagina ${pageIndex} din ${pageTotal}</div>` : '';
  return `
    <div class="doc-footer">
      <div class="doc-footer-rule"></div>
      <div class="doc-footer-row">
        <img class="doc-footer-logo" src="assets/logo/euro_ecologic_logo.png" alt="" />
        <div class="doc-footer-sep"></div>
        <div class="doc-footer-text">
          <div><strong>${esc(COMPANY_INFO.name)}</strong> | Sediu social: ${esc(COMPANY_INFO.address)}.</div>
          <div>${esc(COMPANY_INFO.phone)} | Nr. Reg. Com.: ${esc(COMPANY_INFO.regCom)} | CUI: ${esc(COMPANY_INFO.cui)} | Website: ${esc(COMPANY_INFO.website)}</div>
          <div>Punct de lucru <strong>${esc((model.depotName || '').toUpperCase())}</strong>: ${esc(depotEmail)} / <strong>${esc(depotPhone)}</strong>
            &nbsp;|&nbsp; <strong>${esc((model.depotRepresentativeName || 'RESPONSABIL DEPOZIT').toUpperCase())}</strong></div>
        </div>
        ${pageLabel}
      </div>
    </div>`;
}

function conditionsBox(processTypeUpper) {
  const lines = CONDITIONS_BY_TYPE[processTypeUpper] || CONDITIONS_BY_TYPE.VANZARE;
  return `
    <div class="doc-box doc-conditions">
      <div class="doc-conditions-title">${esc(lines[0])}</div>
      <ul class="doc-conditions-list">
        ${lines.slice(1).map((l) => `<li>${esc(l)}</li>`).join('')}
      </ul>
    </div>`;
}

function productsTableHtml(model) {
  const rows = productRows(model);
  return `
    <table class="doc-table doc-products-table">
      <thead><tr><th class="col-buc">BUC.</th><th class="col-model">MODEL PRODUS</th><th class="col-tip">TIP PRODUS</th><th class="col-serii">SERII</th></tr></thead>
      <tbody>
        ${rows.map((r) => `<tr><td class="col-buc center">${r.buc}</td><td class="col-model">${esc(r.model)}</td><td class="col-tip">${esc(r.type)}</td><td class="col-serii">${formatSeriesCell(r.seriesList)}</td></tr>`).join('')}
      </tbody>
    </table>`;
}

function pageOnePv({ model, driver, isPreview, depotEmail, depotPhone, beneficiarySignatureUrl, driverSignatureUrl, stampAvailable, pageIndex, pageTotal }) {
  const processTypeUpper = (model.processType || '').trim().toUpperCase();
  const needsAviz = ['AMPLASARE', 'RIDICARE', 'VANZARE'].includes(processTypeUpper);
  const dt = docDateTime(model.createdAt);
  const ciSeries = (model.beneficiaryCiSeries || '').trim().toUpperCase();
  const ciNumber = (model.beneficiaryCiNumber || '').trim().toUpperCase();
  const ciInactive = (!ciSeries && !ciNumber) || ciSeries === NA || ciNumber === NA;
  const showMissingPersonnelNote = ciInactive && !beneficiarySignatureUrl;
  const valueClass = (v) => {
    const n = (v || '').trim().toUpperCase();
    return n === '' || n === NA ? 'doc-value-missing' : '';
  };
  const contractRef = (model.contractReference || '').trim() || '__________';
  const soferObservations = (model.observatii || '').trim();
  const locationLabel = processTypeUpper === 'LIPSA ACCES' ? 'Locatia de Constatare Lipsa Acces' : `Locatia ceruta de <strong>${esc(model.processType)}</strong>`;

  return `
  <section class="doc-page">
    <div class="doc-header">
      <img class="doc-header-img" src="assets/docs/header.png" alt="" />
      <div class="doc-header-rule"></div>
    </div>
    ${isPreview ? '<div class="doc-preview-badge">PREVIEW</div>' : ''}
    <h1 class="doc-title">PROCES VERBAL DE: ${esc(processTypeUpper)}</h1>
    <div class="doc-subtitle">Emis de depozit ${esc(model.depotName)}</div>
    <div class="doc-meta-line">Nr. document: <strong>${esc(displayPvNumber(model.pvNumber))}</strong>&nbsp;&nbsp;&nbsp;Data: <strong>${esc(dt.date)}</strong>&nbsp;&nbsp;&nbsp;Ora: <strong>${esc(dt.hour)}</strong></div>

    <div class="doc-label">PRESTATOR</div>
    <div class="doc-text"><strong>${esc(COMPANY_INFO.name)}</strong>, cu sediul in Vlahita, Str M. Eminescu, Nr. A, Jud. HR, inregistrata la Reg.Com. sub Nr. ${esc(COMPANY_INFO.regCom)}, Cod Fiscal ${esc(COMPANY_INFO.cui)}</div>

    <div class="doc-label">BENEFICIAR</div>
    <div class="doc-beneficiar-line">- <strong>${esc(model.clientName || '-')}</strong></div>

    <div class="doc-row-2">
      <div class="doc-box doc-box-signer">
        <div class="doc-box-title center">Persoana Responsabila Preluare/Semnare</div>
        <div class="doc-signer-grid">
          <div class="doc-signer-info">
            <div>Nume: <strong>${esc(model.field2 || '-')}</strong></div>
            <div>CI Serie: <strong class="${valueClass(model.beneficiaryCiSeries)}">${esc(displayOrNa(model.beneficiaryCiSeries))}</strong>
              &nbsp;&nbsp;NR: <strong class="${valueClass(model.beneficiaryCiNumber)}">${esc(displayOrNa(model.beneficiaryCiNumber))}</strong></div>
            <div>Telefon: <strong class="${valueClass(model.beneficiaryPhone)}">${esc(displayOrNa(model.beneficiaryPhone))}</strong></div>
          </div>
          <div class="doc-signature-box">
            ${beneficiarySignatureUrl ? `<img src="${beneficiarySignatureUrl}" alt="semnatura" />` : '<span class="doc-signature-placeholder">Semnatura</span>'}
          </div>
        </div>
      </div>
      <div class="doc-box doc-box-obs">
        <div class="doc-box-title center">Observatii:</div>
        ${showMissingPersonnelNote ? '<div class="doc-value-missing doc-bold">LIPSA PERSONAL</div>' : '<div>-</div>'}
      </div>
    </div>

    <div class="doc-row-2">
      <div class="doc-box">
        <div>In data de: <strong>${esc(dt.date)}</strong></div>
        <div>A intervenit urmatorul PV de: <strong>${esc(model.processType)}</strong></div>
        ${needsAviz ? `<div>La Contract: <strong>${esc(contractRef.toUpperCase())}</strong></div>` : ''}
      </div>
      <div class="doc-box">
        <div>Punct de lucru: <strong>${esc((model.depotName || '').toUpperCase())}</strong></div>
        <div>Nume Sofer: <strong>${esc(shortDriverName(model.userName))}</strong></div>
        <div>Numar Masina: <strong>${esc((model.carNumar || '').toUpperCase())}</strong></div>
      </div>
    </div>

    <div class="doc-box doc-location-bar">${locationLabel} : <strong>${esc(model.field1 ? model.field1.toUpperCase() : '-')}</strong></div>

    ${productsTableHtml(model)}

    <div class="doc-box doc-confirmation-banner">${esc(confirmationBanner(model.processType))}</div>

    ${conditionsBox(processTypeUpper)}

    ${
      soferObservations
        ? `<div class="doc-box doc-observatii-sofer">
            ${
              processTypeUpper === 'LIPSA ACCES'
                ? `<div class="doc-bold">Observatii discutie:</div><div>Soferul ${esc(shortDriverName(model.userName))} a discutat si a constatat urmatoarele:</div><div>${esc(soferObservations)}</div>`
                : `<div class="doc-bold">OBSERVATII SOFER:</div><div>${esc(soferObservations)}</div>`
            }
          </div>`
        : ''
    }

    <table class="doc-table doc-parties-table">
      <tr><td>PRESTATOR</td><td class="right">BENEFICIAR</td></tr>
      <tr>
        <td>
          <div class="doc-parties-prestator">
            <strong>${esc(COMPANY_INFO.name)}</strong>
            <div class="doc-stamp-slot doc-stamp-slot-sm">
              ${driverSignatureUrl ? `<img class="doc-stamp-signature" src="${driverSignatureUrl}" alt="" />` : ''}
              ${stampAvailable ? `<img class="doc-stamp-img" src="assets/docs/stampila_euro_ecologic.png" alt="" />` : ''}
            </div>
          </div>
        </td>
        <td class="right"><strong>${esc((model.clientName || 'DENUMIRE BENEFICIAR').toUpperCase())}</strong></td>
      </tr>
    </table>

    ${runningFooter(model, depotEmail, depotPhone, pageIndex, pageTotal)}
  </section>`;
}

function pageTwoAviz({ model, depotEmail, depotPhone, driverSignatureUrl, stampAvailable, pageIndex, pageTotal }) {
  const processTypeUpper = (model.processType || '').trim().toUpperCase();
  const avizNumber = displayAvizNumber(model.avizNumber);
  const clientName = (model.clientName || '').trim().toUpperCase() || 'BENEFICIAR';
  const rows = avizRows(model);
  const dt = docDateTime(model.createdAt);
  const returnMessage = `VA ROG SA RETRIMITETI ACEST P.V. DE ${processTypeUpper || 'AMPLASARE'}, SEMNAT SI STAMPILAT LA ADRESA DE EMAIL: ${depotEmail}`;

  return `
  <section class="doc-page">
    <div class="doc-header">
      <img class="doc-header-img" src="assets/docs/header.png" alt="" />
      <div class="doc-header-rule"></div>
    </div>

    <div class="doc-row-2 doc-aviz-parties">
      <div class="doc-box doc-furnizor">
        <div class="doc-box-title">Furnizor</div>
        <div class="doc-divider"></div>
        <div><strong>${esc(COMPANY_INFO.name)}</strong></div>
        <div>${esc(COMPANY_INFO.regCom.replace('J 2007', 'J 2007 ').replace('000205', '000205 '))}</div>
        <div>${esc(COMPANY_INFO.cui)}</div>
        <div>Vlahita, Str. M. Eminescu Nr 9A / HR</div>
        <div>Telefon: ${esc(COMPANY_INFO.phone)}</div>
        <div><strong>Pct. Lucru depozit ${esc((model.depotName || '').toUpperCase())}</strong></div>
        <div>${esc(model.depotAddress || '')}</div>
        <div>Telefon: ${esc(depotPhone)}</div>
      </div>
      <div class="doc-box doc-beneficiar-box">
        <div class="doc-box-title">Beneficiar</div>
        <div class="doc-divider"></div>
        <div class="doc-beneficiar-grid">
          <div>
            <div><strong>${esc(clientName)}</strong></div>
            <div>Reprezentant: ${esc(model.field2 ? model.field2.toUpperCase() : '-')}</div>
            <div>Serie CI - Nr: ${esc(model.beneficiaryCiSeries || 'N/A')} - ${esc(model.beneficiaryCiNumber || 'N/A')}</div>
            <div>Telefon: ${esc(model.beneficiaryPhone || 'N/A')}</div>
          </div>
          <div class="doc-beneficiar-stamp-slot"></div>
        </div>
      </div>
    </div>

    <h1 class="doc-title">AVIZ DE INSOTIRE A MARFII</h1>
    <div class="doc-subtitle center doc-bold">pentru ${esc(model.processType || '-')}</div>

    <div class="doc-aviz-meta-row">
      <div>
        <div>Emis de depozit: ${esc(model.depotName)}</div>
        <div>Nr. document: ${esc(avizNumber)}</div>
      </div>
      <div>Data: ${esc(dt.date)}</div>
      <div>Ora: ${esc(dt.hour)}</div>
    </div>

    <table class="doc-table doc-aviz-table">
      <thead><tr><th class="col-nr">Nr.</th><th>Denumire produs</th><th class="col-um">U.M.</th><th class="col-cant">Cantitate</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td class="center">${esc(r[0])}</td><td>${esc(r[1])}</td><td class="center">${esc(r[2])}</td><td class="center">${esc(r[3])}</td></tr>`).join('')}</tbody>
    </table>

    <div class="doc-box doc-no-transport">PRODUSELE TRANSPORTATE SUNT FARA VALOARE DE TRANSPORT (NU SE FACTUREAZA).</div>

    <div class="doc-box doc-location-bar">Locatia ceruta de <strong>${esc(processTypeUpper)}</strong> : <strong>${esc(model.field1 ? model.field1.toUpperCase() : '-')}</strong></div>

    <div class="doc-aviz-spacer"></div>
    <div class="doc-return-message">${esc(returnMessage)}</div>

    <table class="doc-table doc-signature-table">
      <thead>
        <tr>
          <th>Semnatura si stampila Prestator</th>
          <th>Date Privind Expeditia</th>
          <th>Semnatura si stampila Beneficiar</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${esc(COMPANY_INFO.name)}</strong></td>
          <td></td>
          <td><strong>${esc(clientName)}</strong></td>
        </tr>
        <tr class="doc-signature-row">
          <td class="center">
            <div class="doc-stamp-slot">
              ${driverSignatureUrl ? `<img class="doc-stamp-signature" src="${driverSignatureUrl}" alt="" />` : ''}
              ${stampAvailable ? `<img class="doc-stamp-img" src="assets/docs/stampila_euro_ecologic.png" alt="" />` : '<div class="doc-stamp-missing">STAMPILA<br/>LIPSA</div>'}
            </div>
          </td>
          <td>
            <div class="doc-expeditie-grid">
              <div>Delegat:</div><div>${esc(model.userName || '-')}</div>
              <div>BI / CI</div><div>${esc(model.userCi || '-')}</div>
              <div>Nr. Auto</div><div>${esc(model.carNumar || '-')}</div>
              <div>Data:</div><div>${esc(dt.short)}</div>
            </div>
            <div class="doc-driver-sign-row">
              <span>Semnatura SOFER</span>
              ${driverSignatureUrl ? `<img src="${driverSignatureUrl}" alt="" />` : '<span class="doc-sign-line"></span>'}
            </div>
          </td>
          <td></td>
        </tr>
      </tbody>
    </table>

    ${runningFooter(model, depotEmail, depotPhone, pageIndex, pageTotal)}
  </section>`;
}

function photoPage({ model, index, photoUrl, depotEmail, depotPhone, pageIndex, pageTotal }) {
  return `
  <section class="doc-page">
    <div class="doc-header">
      <img class="doc-header-img" src="assets/docs/header.png" alt="" />
      <div class="doc-header-rule"></div>
    </div>
    <div class="doc-annex-title">${esc(anexaFotoTitle(model, index))}</div>
    <div class="doc-annex-photo-frame">
      ${
        photoUrl
          ? `<img src="${photoUrl}" alt="" />`
          : `<div class="doc-annex-placeholder"><div class="doc-bold doc-value-missing">ZONA SECURIZATA | FOTO INTERZIS</div><div>Conform observatiilor soferului, captura foto nu a putut fi realizata.</div></div>`
      }
    </div>
    ${runningFooter(model, depotEmail, depotPhone, pageIndex, pageTotal)}
  </section>`;
}

/**
 * Construieste HTML-ul complet al documentului (toate paginile) pentru un PV.
 * @param {object} params
 * @param {object} params.model  ProcessVerbalModel-like plain object
 * @param {object} params.driver driver curent (pentru semnatura implicita, neutilizata direct aici)
 * @param {boolean} params.isPreview
 * @param {string[]} params.photoUrls  object URLs pentru pozele adnotate
 * @param {string} params.beneficiarySignatureUrl
 * @param {string} params.driverSignatureUrl
 * @param {boolean} params.stampAvailable
 */
export function buildDocumentHtml(params) {
  const { model, isPreview = false, photoUrls = [] } = params;
  const processTypeUpper = (model.processType || '').trim().toUpperCase();
  const needsAviz = ['AMPLASARE', 'RIDICARE', 'VANZARE'].includes(processTypeUpper);
  const depotEmail = (model.depotRepresentativeEmail || '').trim() || `${withoutDiacritics(model.depotName || '').toLowerCase().replace(/[^a-z0-9]+/g, '')}@eurowc.ro`;
  const depotPhone = (model.depotRepresentativePhone || '').trim() || '0735 214 762';

  const soferObservations = (model.observatii || '').trim();
  const showSecurePlaceholder = photoUrls.length === 0 && processTypeUpper !== 'LIPSA ACCES' && soferObservations.length > 0;
  const annexUrls = photoUrls.length ? photoUrls : showSecurePlaceholder ? [null] : [];
  const pageTotal = 1 + (needsAviz ? 1 : 0) + annexUrls.length;
  let pageIndex = 0;

  let html = '';
  pageIndex += 1;
  html += pageOnePv({ ...params, depotEmail, depotPhone, isPreview, pageIndex, pageTotal });
  if (needsAviz) {
    pageIndex += 1;
    html += pageTwoAviz({ ...params, depotEmail, depotPhone, pageIndex, pageTotal });
  }

  annexUrls.forEach((url, i) => {
    pageIndex += 1;
    html += photoPage({ model, index: i + 1, photoUrl: url, depotEmail, depotPhone, pageIndex, pageTotal });
  });

  return html;
}

/**
 * Deschide fereastra de tiparire a browserului cu documentul dat, afisand
 * dialogul nativ de "Salveaza ca PDF" (Chrome pe Android).
 */
export function printDocument(html, suggestedTitle) {
  const printRoot = document.getElementById('print-root');
  printRoot.innerHTML = html;
  const previousTitle = document.title;
  if (suggestedTitle) document.title = suggestedTitle;
  const restore = () => {
    document.title = previousTitle;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  setTimeout(() => {
    window.print();
    setTimeout(restore, 1500);
  }, 60);
}

/**
 * Ecran de previzualizare in-app a documentului, scalat sa incapa pe
 * telefon, cu buton pentru a deschide dialogul de tiparire/salvare PDF.
 */
export async function openPrintPreview({ html, title = 'Previzualizare document', suggestedFileName, showBadge = false, onConfirmPrint }) {
  return pushScreen(({ pop }) => {
    const screen = el('div', { class: 'preview-screen' });
    const topBar = el('div', { class: 'topbar' }, [
      el('button', { class: 'icon-btn', onclick: () => pop(undefined) }, ['←']),
      el('div', { class: 'topbar-title' }, [title]),
    ]);
    screen.appendChild(topBar);
    if (showBadge) screen.appendChild(el('div', { class: 'preview-badge' }, ['PREVIEW']));

    const pagesHost = el('div', { class: 'preview-pages' });
    // Fiecare .doc-page e mutata intr-un "frame" care primeste dimensiunile
    // FINALE (scalate) prin JS, ca layout-ul normal (centrare, spatiere) sa
    // functioneze corect indiferent de transform-ul aplicat paginii interioare.
    const measureHost = el('div', { style: 'position:absolute;visibility:hidden;pointer-events:none;left:-9999px;top:0' });
    measureHost.innerHTML = html;
    document.body.appendChild(measureHost);
    const sourcePages = Array.from(measureHost.querySelectorAll('.doc-page'));
    const frames = sourcePages.map((page) => {
      const naturalWidth = page.offsetWidth;
      const naturalHeight = page.offsetHeight;
      const frame = el('div', { class: 'preview-page-frame' });
      page.style.transformOrigin = 'top left';
      frame.appendChild(page);
      pagesHost.appendChild(frame);
      return { frame, naturalWidth, naturalHeight, page };
    });
    measureHost.remove();

    const scroller = el('div', { class: 'preview-scroller' }, [pagesHost]);
    screen.appendChild(scroller);

    function applyScale() {
      const containerWidth = scroller.clientWidth - 24;
      frames.forEach(({ frame, naturalWidth, naturalHeight, page }) => {
        const scale = containerWidth / naturalWidth;
        page.style.transform = `scale(${scale})`;
        frame.style.width = `${containerWidth}px`;
        frame.style.height = `${naturalHeight * scale}px`;
      });
    }
    requestAnimationFrame(applyScale);
    window.addEventListener('resize', applyScale);

    const fileNameBase = suggestedFileName || fileToken(title) || 'Proces-Verbal';
    const shareBtn = el(
      'button',
      { class: 'btn btn-block btn-outline' },
      ['📄  Deschide PDF']
    );
    let shareBusy = false;
    shareBtn.addEventListener('click', async () => {
      if (shareBusy) return;
      shareBusy = true;
      const originalLabel = shareBtn.textContent;
      shareBtn.textContent = 'Se pregateste PDF-ul...';
      shareBtn.disabled = true;
      // Deschidem fereastra IMEDIAT, in acelasi gest de click (sincron), ca
      // browserul sa nu o blocheze ca popup — o umplem cu PDF-ul de indata
      // ce e gata. Asa se deschide direct pagina PDF-ului generat, cu
      // vizualizatorul nativ al telefonului (Chrome), care are propriile
      // butoane de trimitere/partajare — nu mai trecem noi prin meniul de
      // distribuire al sistemului (unde putea aparea Samsung Notes etc.).
      const win = window.open('', '_blank');
      try {
        const blob = await generateDocumentPdfBlob(html);
        const safeName = /\.pdf$/i.test(fileNameBase) ? fileNameBase : `${fileNameBase}.pdf`;
        const url = URL.createObjectURL(blob);
        if (win && !win.closed) {
          win.location.href = url;
        } else {
          // popup blocat -> descarcam direct fisierul ca rezerva
          const a = document.createElement('a');
          a.href = url;
          a.download = safeName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          showToast('PDF descarcat — il poti trimite din Fisiere.');
        }
      } catch (e) {
        console.error(e);
        if (win && !win.closed) win.close();
        showToast('Nu am putut genera PDF-ul: ' + e.message, { danger: true });
      } finally {
        shareBusy = false;
        shareBtn.textContent = originalLabel;
        shareBtn.disabled = false;
      }
    });

    const bottomBar = el('div', { class: 'preview-bottom-bar' }, [
      el(
        'button',
        {
          class: 'btn btn-block btn-primary',
          onclick: () => {
            if (onConfirmPrint) onConfirmPrint();
            printDocument(html, suggestedFileName);
          },
        },
        ['🖨  Printeaza / Salveaza ca PDF']
      ),
      shareBtn,
    ]);
    screen.appendChild(bottomBar);

    return screen;
  });
}
