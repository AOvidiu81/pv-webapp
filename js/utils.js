// utils.js — helpere text/data comune, portate din aplicatia Flutter
// (text_utils.dart, logica din process_verbal_pdf.dart).

// Trebuie tinut manual sincron cu CACHE_VERSION din sw.js la fiecare
// modificare — afisat pe ecranul de login/acasa ca soferul sa poata
// confirma dintr-o privire ce versiune ruleaza pe telefon.
export const APP_VERSION = 'v35';

const DIACRITICS_MAP = {
  'ă': 'a', 'â': 'a', 'î': 'i', 'ș': 's', 'ş': 's', 'ț': 't', 'ţ': 't',
  'Ă': 'A', 'Â': 'A', 'Î': 'I', 'Ș': 'S', 'Ş': 'S', 'Ț': 'T', 'Ţ': 'T',
};

export function withoutDiacritics(value) {
  if (!value) return '';
  return String(value).replace(/[ăâîșşțţĂÂÎȘŞȚŢ]/g, (c) => DIACRITICS_MAP[c] || c);
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function formatDateRo(date = new Date()) {
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
}

export function formatDateTimeRo(date = new Date()) {
  return `${formatDateRo(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

const WEEKDAYS_RO = ['Luni', 'Marti', 'Miercuri', 'Joi', 'Vineri', 'Sambata', 'Duminica'];
const WEEKDAYS_RO_UPPER = ['LUNI', 'MARTI', 'MIERCURI', 'JOI', 'VINERI', 'SAMBATA', 'DUMINICA'];

export function weekdayLabelRo(date = new Date(), upper = false) {
  const idx = (date.getDay() + 6) % 7; // JS: 0=Duminica -> aliniem la Luni=0
  return (upper ? WEEKDAYS_RO_UPPER : WEEKDAYS_RO)[idx];
}

export function formatUserName(name) {
  return (name || '').trim();
}

/** Calculeaza vechimea (in ani si luni) de la o data de angajare
 * ("YYYY-MM-DD", cum vine din baza de date) pana azi. Intoarce null daca
 * data lipseste sau e invalida. */
export function vechimeLabel(dataAngajareStr) {
  if (!dataAngajareStr) return null;
  const start = new Date(dataAngajareStr);
  if (isNaN(start.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years <= 0 && months <= 0) return 'sub 1 luna';
  const parts = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'an' : 'ani'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'luna' : 'luni'}`);
  return parts.join(' si ');
}

/** "Ovidiu Anitoiu" -> "O. ANITOIU" (port din _shortDriverName). */
export function shortDriverName(value) {
  const parts = (value || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '-';
  if (parts.length === 1) return parts[0].toUpperCase();
  const first = parts[0].charAt(0).toUpperCase();
  const tail = parts.slice(1).join(' ').toUpperCase();
  return `${first}. ${tail}`;
}

const COUNTY_CODES = {
  ALBA: 'AB', ARAD: 'AR', ARGES: 'AG', BACAU: 'BC', BIHOR: 'BH',
  'BISTRITA NASAUD': 'BN', BOTOSANI: 'BT', BRAILA: 'BR', BRASOV: 'BV',
  BUCURESTI: 'B', BUZAU: 'BZ', CALARASI: 'CL', 'CARAS SEVERIN': 'CS',
  CLUJ: 'CJ', CONSTANTA: 'CT', COVASNA: 'CV', DAMBOVITA: 'DB',
  DOLJ: 'DJ', GALATI: 'GL', GIURGIU: 'GR', GORJ: 'GJ', HARGHITA: 'HR',
  HUNEDOARA: 'HD', IALOMITA: 'IL', IASI: 'IS', ILFOV: 'IF',
  MARAMURES: 'MM', MEHEDINTI: 'MH', MURES: 'MS', NEAMT: 'NT', OLT: 'OT',
  PRAHOVA: 'PH', SALAJ: 'SJ', 'SATU MARE': 'SM', SIBIU: 'SB', SUCEAVA: 'SV',
  TELEORMAN: 'TR', TIMIS: 'TM', TULCEA: 'TL', VALCEA: 'VL', VASLUI: 'VS',
  VRANCEA: 'VN',
};

export function countyAbbreviation(countyName) {
  const normalized = withoutDiacritics(countyName || '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (COUNTY_CODES[normalized]) return COUNTY_CODES[normalized];
  const compact = normalized.replace(/ /g, '');
  if (compact.length >= 2) return compact.substring(0, 2);
  return 'HD';
}

export function extractCountyFromAddress(address) {
  const cleaned = (address || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const match = /\bjud(?:et)?\.?\s*([A-Za-z\-\s]+)/i.exec(cleaned);
  if (!match) return '';
  return (match[1] || '').split(',')[0].trim();
}

/** Cauta, intr-un text liber (ex: campul "La Contract" completat din
 * comanda), un cod de judet cunoscut (HD, SB, CT, B, ...) — fie ca abreviere
 * scrisa ca atare ("... HD"), fie ca numele intreg al judetului ("Hunedoara").
 * Foloseste aceeasi lista COUNTY_CODES ca countyAbbreviation(), ca cele doua
 * sa ramana mereu in sincron. Intoarce '' daca nu gaseste nimic. */
export function matchCountyCodeInText(text) {
  const norm = withoutDiacritics(text || '').toUpperCase();
  if (!norm) return '';
  const codeSet = new Set(Object.values(COUNTY_CODES));
  const words = norm.match(/[A-Z]+/g) || [];
  for (const w of words) {
    if (codeSet.has(w)) return w;
  }
  const compact = norm.replace(/[^A-Z]/g, '');
  for (const [name, code] of Object.entries(COUNTY_CODES)) {
    if (compact.includes(name.replace(/[^A-Z]/g, ''))) return code;
  }
  return '';
}

export function extractLocationFromAddress(address) {
  const parts = (address || '').split(',').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (withoutDiacritics(part).toUpperCase().startsWith('JUD')) continue;
    return part;
  }
  return (address || '').trim();
}

export function fileToken(value) {
  return withoutDiacritics(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function displayOrNa(value, na = 'N/A') {
  const trimmed = (value || '').trim();
  return trimmed === '' ? na : trimmed;
}

export function debounce(fn, delay = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Micsoreaza font-size-ul unui element (deja "white-space: nowrap" din CSS)
 * pas cu pas, pana cand incape pe UN singur rand in latimea disponibila —
 * folosit pentru textul rosu "va rog sa retrimiteti..." din documentul PV,
 * a carui lungime variaza (tip proces + adresa de email pot fi mai lungi
 * sau mai scurte). Element-ul trebuie sa fie deja montat in DOM (are
 * clientWidth/scrollWidth valide) — safe de apelat de mai multe ori (ex.
 * daca fontul de baza s-a schimbat intre timp), reporneste mereu de la
 * dimensiunea CSS originala.
 */
/**
 * Asteapta ca toate imaginile (<img>) din interiorul lui "root" sa fie
 * incarcate (sau esuate) inainte de a continua — folosit inaintea oricarei
 * masuratori de layout (ex. shrinkProductsTableToFit), pentru ca un <img>
 * fara width/height explicit (ex. antetul ".doc-header-img") are inaltime 0
 * cat timp nu s-a incarcat, ceea ce ar duce la o estimare gresita a
 * spatiului disponibil pentru tabelul de produse — si, dupa ce imaginea se
 * incarca in cele din urma, la o pagina care depaseste totusi cele 297mm
 * (randuri taiate silentios), desi tabelul parea sa incapa la masuratoare.
 * Sigur de apelat oricand — daca imaginea e deja incarcata (des cazul, fiind
 * in cache-ul browserului dupa prima folosire a aplicatiei), se rezolva
 * aproape instant.
 */
export async function waitForImagesLoaded(root) {
  if (!root) return;
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map((img) => {
      if (img.complete) {
        // "complete" e true si pentru o imagine care a esuat la incarcare —
        // in ambele cazuri layoutul e deja stabil, nu mai asteptam nimic.
        return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
      }
      return new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    })
  );
}

export function shrinkTextToFitOneLine(el, { minFontSizePx = 9, stepPx = 0.5 } = {}) {
  if (!el) return;
  const computed = window.getComputedStyle(el);
  const originalFontSize = el.style.fontSize || computed.fontSize;
  let fontSizePx = parseFloat(computed.fontSize);
  if (!fontSizePx || !isFinite(fontSizePx)) return;
  el.style.fontSize = fontSizePx + 'px';
  let guard = 0;
  while (el.scrollWidth > el.clientWidth && fontSizePx > minFontSizePx && guard < 200) {
    fontSizePx -= stepPx;
    el.style.fontSize = fontSizePx + 'px';
    guard += 1;
  }
  if (guard === 0) el.style.fontSize = originalFontSize; // nu a fost nevoie sa micsoram, pastram CSS-ul original
}

/**
 * Micsoreaza tabelul de produse (".doc-table-frame" de pe pagina PV) pas cu
 * pas — font-size + padding pe randuri — pana cand TOATA pagina incape in
 * inaltimea fixa de tiparire (297mm, A4), daca beneficiarul are multe
 * categorii de produse. Fara asta, motorul de tiparire/export (care
 * forteaza fiecare ".doc-page" la o inaltime FIXA de 297mm) taia silentios
 * randurile care nu incap — soferul nu vede nicio eroare, produsele pur si
 * simplu lipsesc din PDF-ul salvat/trimis (desc doperit empiric).
 *
 * Foloseste o inaltime de proba de 297mm (aceeasi ca in css/print.css sub
 * @media print si ca in pdf-generate.js) — 1mm inseamna mereu acelasi numar
 * de pixeli in CSS, indiferent de contextul de randare (ecran real, host
 * ascuns offscreen etc.), asa ca verificarea functioneaza identic peste
 * tot. Restauram inaltimea originala a paginii dupa masuratoare, ca sa nu
 * lasam un stil inline care ar strica randarea normala (ne-tiparita).
 */
export function shrinkProductsTableToFit(root, { minFontSizePx = 7.6, minPaddingVMm = 0.3, minLineHeight = 1, stepPx = 0.1 } = {}) {
  if (!root) return;
  root.querySelectorAll('.doc-page').forEach((pageEl) => {
    const frame = pageEl.querySelector('.doc-table-frame');
    const table = frame ? frame.querySelector('table') : null;
    if (!frame || !table) return;

    const cells = table.querySelectorAll('th, td');
    // Repornim mereu de la dimensiunea CSS originala (tabelul poate fi
    // remasurat de mai multe ori — ex. preview redeschis dupa o corectie).
    table.style.fontSize = '';
    table.style.lineHeight = '';
    cells.forEach((cell) => { cell.style.padding = ''; });

    const originalHeight = pageEl.style.height;
    const originalOverflow = pageEl.style.overflow;
    pageEl.style.height = '297mm';
    pageEl.style.overflow = 'hidden';

    // IMPORTANT: NU verificam pageEl.scrollHeight > pageEl.clientHeight —
    // ".doc-page" e flex-column, iar ".doc-table-frame" (chenarul verde,
    // are deja "overflow:hidden" din CSS pentru colturile rotunjite) e un
    // flex item obisnuit, care se poate MICSORA sub inaltimea lui naturala
    // ca sa incapa restul continutului in cele 297mm — motorul de layout
    // "rezolva" astfel overflow-ul paginii silentios, taind randurile din
    // tabel INTERN, fara ca ".doc-page" insusi sa mai raporteze vreun
    // overflow (scrollHeight == clientHeight acolo, desi tabelul e taiat!).
    // De-asta verificam direct chenarul tabelului: daca CONTINUTUL lui
    // (randurile) e mai inalt decat SPATIUL pe care i l-a dat efectiv
    // layout-ul, inseamna ca randuri intregi sunt invizibile in acest
    // moment — de aici stim sigur cand trebuie sa micsoram.
    const basePaddingVMm = 1.4; // vezi ".doc-table th, .doc-table td" in print.css
    const baseFontSizePx = parseFloat(window.getComputedStyle(table).fontSize);
    const basePaddingH = '2mm';

    // Pasul 1: reducem intai spatiul gol (padding pe randuri + line-height),
    // pastrand fontul la marimea originala — asta afecteaza legibilitatea
    // cel mai putin. Testam la fiecare pas daca a inceput sa incapa.
    let paddingVMm = basePaddingVMm;
    let lineHeight = 1.32; // vezi ".doc-page" in print.css (mostenit de tabel)
    let guard = 0;
    while (frame.scrollHeight > frame.clientHeight && (paddingVMm > minPaddingVMm || lineHeight > minLineHeight) && guard < 100) {
      paddingVMm = Math.max(minPaddingVMm, paddingVMm - 0.05);
      lineHeight = Math.max(minLineHeight, lineHeight - 0.015);
      cells.forEach((cell) => { cell.style.padding = `${paddingVMm}mm ${basePaddingH}`; });
      table.style.lineHeight = String(lineHeight);
      guard += 1;
    }

    // Pasul 2: daca tot nu incape (multe randuri + liste lungi de conditii
    // pe aceeasi pagina), reducem si fontul, pastrand padding-ul si
    // line-height-ul deja la minim de mai sus.
    let fontSizePx = baseFontSizePx;
    guard = 0;
    while (frame.scrollHeight > frame.clientHeight && fontSizePx > minFontSizePx && guard < 100) {
      fontSizePx -= stepPx;
      table.style.fontSize = fontSizePx + 'px';
      guard += 1;
    }

    pageEl.style.height = originalHeight;
    pageEl.style.overflow = originalOverflow;
  });
}

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.substring(2).toLowerCase(), v);
    else if (v !== undefined && v !== null && v !== false) node.setAttribute(k, v === true ? '' : v);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBlob(dataUrl) {
  const [meta, data] = dataUrl.split(',');
  const mime = /data:(.*?);base64/.exec(meta)[1];
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
