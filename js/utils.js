// utils.js — helpere text/data comune, portate din aplicatia Flutter
// (text_utils.dart, logica din process_verbal_pdf.dart).

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
