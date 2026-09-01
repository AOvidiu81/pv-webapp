// components.js — elemente UI reutilizabile: toast, modal de confirmare,
// bottom-sheet de selectie, camp de text, semnatura pe canvas, poarta GPS.

import { el } from './utils.js';
import { pushScreen } from './router.js';

// ------------------------------------------------------------------
// Toast
// ------------------------------------------------------------------
let toastTimer = null;
export function showToast(message, { danger = false } = {}) {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = el('div', { id: 'toast-host' });
    document.body.appendChild(host);
  }
  host.innerHTML = '';
  const toast = el('div', { class: `toast${danger ? ' toast-danger' : ''}` }, [message]);
  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

// ------------------------------------------------------------------
// Modal generic (folosit si pentru bottom sheets)
// ------------------------------------------------------------------
export function openModal({ title, bodyNode, actions = [], sheet = false }) {
  return new Promise((resolve) => {
    const overlay = el('div', { class: `modal-overlay${sheet ? ' modal-overlay-sheet' : ''}` });
    const card = el('div', { class: sheet ? 'sheet-card' : 'modal-card' });
    if (title) card.appendChild(el('div', { class: 'modal-title' }, [title]));
    const body = el('div', { class: 'modal-body' }, [bodyNode]);
    card.appendChild(body);
    if (actions.length) {
      const actionsRow = el('div', { class: 'modal-actions' });
      for (const action of actions) {
        const btn = el(
          'button',
          {
            class: `btn ${action.primary ? 'btn-primary' : 'btn-text'}`,
            onclick: () => {
              close(action.value);
            },
          },
          [action.label]
        );
        actionsRow.appendChild(btn);
      }
      card.appendChild(actionsRow);
    }
    overlay.appendChild(card);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(undefined);
    });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('modal-show'));

    function close(result) {
      overlay.classList.remove('modal-show');
      setTimeout(() => overlay.remove(), 180);
      resolve(result);
    }
    overlay.__close = close;
  });
}

export async function confirmDialog({ title, message, okLabel = 'OK', cancelLabel = 'Anuleaza', danger = false }) {
  const body = el('div', { class: 'modal-message' }, [message]);
  return openModal({
    title,
    bodyNode: body,
    actions: [
      { label: cancelLabel, value: false },
      { label: okLabel, value: true, primary: !danger, danger },
    ],
  });
}

export async function pickFromList({ title, values, renderLabel }) {
  const list = el('div', { class: 'pick-list' });
  if (!values.length) {
    list.appendChild(el('div', { class: 'pick-empty' }, ['Nicio optiune disponibila.']));
  }
  return openModal({
    title,
    sheet: true,
    bodyNode: (() => {
      values.forEach((value) => {
        const item = el('button', { class: 'pick-item', onclick: () => overlayClose(value) }, [renderLabel ? renderLabel(value) : String(value)]);
        list.appendChild(item);
      });
      return list;
    })(),
  });

  function overlayClose(value) {
    const overlay = document.querySelector('.modal-overlay-sheet.modal-show');
    if (overlay && overlay.__close) overlay.__close(value);
  }
}

export async function pickMultiFromList({ title, values, selected }) {
  const chosen = new Set(selected);
  const list = el('div', { class: 'pick-list' });
  values.forEach((value) => {
    const row = el('label', { class: 'pick-check-row' });
    const checkbox = el('input', { type: 'checkbox' });
    checkbox.checked = chosen.has(value);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) chosen.add(value);
      else chosen.delete(value);
    });
    row.appendChild(checkbox);
    row.appendChild(el('span', {}, [value]));
    list.appendChild(row);
  });
  const result = await openModal({
    title,
    sheet: true,
    bodyNode: list,
    actions: [
      { label: 'Anuleaza', value: null },
      { label: 'Salveaza', value: 'save', primary: true },
    ],
  });
  return result === 'save' ? Array.from(chosen) : null;
}

// ------------------------------------------------------------------
// Camp de text cu label + mesaj de eroare optional
// ------------------------------------------------------------------
export function textField({ label, value = '', required = false, type = 'text', placeholder, readOnly = false, onInput, errorText }) {
  const wrapper = el('div', { class: 'field' });
  const inputAttrs = { class: `field-input${errorText ? ' field-input-error' : ''}`, type, placeholder: placeholder || '' };
  if (readOnly) inputAttrs.readonly = true;
  const input = el('input', inputAttrs);
  input.value = value;
  if (onInput) input.addEventListener('input', () => onInput(input.value));
  wrapper.appendChild(el('label', { class: 'field-label' }, [label + (required ? ' *' : '')]));
  wrapper.appendChild(input);
  if (errorText) wrapper.appendChild(el('div', { class: 'field-error' }, [errorText]));
  wrapper.input = input;
  return wrapper;
}

export function textAreaField({ label, value = '', placeholder, onInput, rows = 3 }) {
  const wrapper = el('div', { class: 'field' });
  const textarea = el('textarea', { class: 'field-input', rows: String(rows), placeholder: placeholder || '' });
  textarea.value = value;
  if (onInput) textarea.addEventListener('input', () => onInput(textarea.value));
  if (label) wrapper.appendChild(el('label', { class: 'field-label' }, [label]));
  wrapper.appendChild(textarea);
  wrapper.input = textarea;
  return wrapper;
}

export function selectField({ label, value, options, onChange }) {
  const wrapper = el('div', { class: 'field' });
  const select = el('select', { class: 'field-input' });
  options.forEach((opt) => {
    const optionEl = el('option', { value: opt.value || opt }, [opt.label || opt]);
    if ((opt.value || opt) === value) optionEl.selected = true;
    select.appendChild(optionEl);
  });
  if (onChange) select.addEventListener('change', () => onChange(select.value));
  if (label) wrapper.appendChild(el('label', { class: 'field-label' }, [label]));
  wrapper.appendChild(select);
  wrapper.input = select;
  return wrapper;
}

export function sectionCard(titleText, children = []) {
  const card = el('div', { class: 'section-card' });
  if (titleText) card.appendChild(el('h3', { class: 'section-title' }, [titleText]));
  children.forEach((c) => c && card.appendChild(c));
  return card;
}

export function primaryButton(label, onClick, { icon, disabled = false, danger = false } = {}) {
  return el(
    'button',
    {
      class: `btn btn-block ${danger ? 'btn-danger' : 'btn-primary'}`,
      onclick: onClick,
      disabled: disabled || undefined,
    },
    [icon ? el('span', { class: 'btn-icon' }, [icon]) : null, label]
  );
}

export function outlineButton(label, onClick, { icon, disabled = false, error = false } = {}) {
  return el(
    'button',
    {
      class: `btn btn-block btn-outline${error ? ' btn-outline-error' : ''}`,
      onclick: onClick,
      disabled: disabled || undefined,
    },
    [icon ? el('span', { class: 'btn-icon' }, [icon]) : null, label]
  );
}

// ------------------------------------------------------------------
// Blocare orientare landscape — ca in aplicatia veche (APK): la semnat
// (indiferent daca e semnatura proprie a soferului sau a beneficiarului),
// Vibratie scurta la apasarea butoanelor de confirmare/stergere semnatura —
// acelasi feedback tactil ca in aplicatia veche (APK). Vibration API nu e
// suportata pe iOS Safari, deci esuam silentios acolo.
function hapticTap() {
  try {
    if (navigator.vibrate) navigator.vibrate(20);
  } catch (e) {}
}

// ------------------------------------------------------------------
// Signature pad (canvas) — ecran complet, folosit prin pushScreen()
// ------------------------------------------------------------------
// Chenarul de semnat ramane ingust/vertical prin CSS (vezi .signature-screen
// din styles.css) INDIFERENT de orientarea reala a paginii — asta functioneaza
// garantat, pe orice telefon/browser. Problema gasita ulterior: daca telefonul
// are "Rotire automata" PORNITA din setarile Android, cand soferul intoarce
// telefonul fizic, Android roteste si el vizual tot ce se afiseaza (ca sa
// "compenseze" si continutul sa ramana drept din perspectiva soferului) — iar
// asta anuleaza trucul din CSS: chenarul, desenat de noi mereu ingust in
// coordonatele paginii, ajunge sa fie rotit A DOUA OARA de Android, si nu mai
// arata orizontal cand soferul se uita la el rotit. Solutia: cerem explicit
// fullscreen + screen.orientation.lock('portrait') cat timp e deschis ecranul
// de semnat, ca sa oprim Android sa mai roteasca vizual continutul — soferul
// tot intoarce telefonul fizic, dar acum ecranul NU se mai "auto-compenseaza",
// exact ca in aplicatia veche (APK, unde orientarea era blocata la nivel de
// activitate Android). manifest.json seteaza si el "orientation":
// "portrait-primary" la nivel de WebAPK, dar constatat ca nu e mereu suficient
// de unul singur pe toate telefoanele — de-aia blocarea explicita de mai jos,
// ca rezerva. Esueaza silentios acolo unde API-urile lipsesc sau browserul
// refuza (ex: nu ruleaza ca PWA instalata) — chenarul ramane ingust prin CSS
// oricum, deci semnatura tot iese corecta daca soferul are "Rotire automata"
// oprita din telefon.
export function captureSignature({ title = 'Semnatura' } = {}) {
  return captureSignatureScreen(title);
}

async function lockPortraitForSignature() {
  try {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  } catch (e) {}
  try {
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('portrait');
    }
  } catch (e) {}
}

function unlockPortraitForSignature() {
  try {
    if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
  } catch (e) {}
  try {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch (e) {}
}

function captureSignatureScreen(title) {
  // Pornit cat mai devreme (sincron, in continuarea gestului de tap al
  // soferului pe butonul care a deschis acest ecran), ca cererea de
  // fullscreen sa aiba sanse cat mai mari sa fie acceptata de browser.
  lockPortraitForSignature();
  // Referinta ridicata in afara builder-ului lui pushScreen(), ca sa putem
  // opri urmarirea dimensiunii canvas-ului cand ecranul se inchide,
  // indiferent cum iese soferul din el (buton, salvare sau Back hardware) —
  // vezi promise.finally() mai jos.
  let resizeObserver = null;
  const promise = pushScreen(({ pop }) => {
    const canvasWrap = el('div', { class: 'signature-canvas-wrap' });
    const canvas = el('canvas', { class: 'signature-canvas' });
    canvasWrap.appendChild(canvas);

    const screen = el('div', { class: 'signature-screen' });
    const topBar = el('div', { class: 'topbar' }, [
      el('button', { class: 'icon-btn', onclick: () => pop(undefined) }, ['←']),
      el('div', { class: 'topbar-title' }, [title]),
      el('div', { class: 'topbar-spacer' }),
    ]);
    const clearBtn = el('button', { class: 'sig-side-btn sig-clear', onclick: () => { hapticTap(); clear(); } }, ['⟲']);
    const okBtn = el('button', { class: 'sig-side-btn sig-ok', onclick: () => { hapticTap(); save(); } }, ['✓']);
    // Rosu (reset) sus, verde (confirma) jos — chenarul (.signature-row) nu
    // se mai roteste niciodata prin CSS/JS, ramane mereu ingust si "in
    // picioare" (vezi styles.css, unitatile vmin/vmax) — vezi comentariul
    // amplu de acolo pentru motivul intreg.
    const row = el('div', { class: 'signature-row' }, [clearBtn, canvasWrap, okBtn]);
    const rowWrap = el('div', { class: 'signature-row-wrap' }, [row]);
    screen.appendChild(topBar);
    screen.appendChild(rowWrap);
    screen.appendChild(el('div', { class: 'signature-hint' }, ['Semneaza in chenar folosind degetul sau stylus-ul.']));

    const ctx = canvas.getContext('2d');
    let drawing = false;
    let hasStrokes = false;
    let last = null;
    // Bounding box (in pixeli CSS, acelasi sistem de coordonate ca
    // pointFromEvent) al cernelii desenate efectiv — folosit la export ca
    // semnatura sa fie decupata strans pe conturul ei, nu pe tot canvas-ul
    // (mult mai inalt, gol in cea mai mare parte).
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // Simulam un "pix" / stilou real: fiecare trasa continua (de la apasare
    // pana la ridicarea degetului) e afinata la cele doua capete, ca varful
    // unui pix real, nu are grosime constanta pe toata lungimea. Cat timp
    // degetul e pe ecran desenam live la grosimea plina (raspuns instant,
    // fara lag) — abia cand trasa se termina (pointerup) o redesenam din
    // memorie cu grosime variabila (subtire -> plina -> subtire). Pastram
    // TOATE trasele anterioare (nu doar ultima), ca redesenarea sa nu
    // stearga restul semnaturii deja facute.
    const PEN_MAX_WIDTH = 3;
    const PEN_MIN_WIDTH = 1.1;
    const PEN_TAPER_PX = 10; // lungimea (px CSS) portiunii afinate la fiecare capat
    let strokes = [];
    let currentStroke = [];

    // Cauza reala a bug-ului "aluneca in jos": .signature-row si
    // .signature-canvas-wrap nu aveau min-height:0 (vezi styles.css) — fara
    // el, un flex item cu continut care primeste o dimensiune EXPLICITA (ca
    // aici, canvas.style.width/height, setate de noi mai jos) isi poate
    // impinge parintele sa creasca dupa continut, in loc sa fie limitat de
    // spatiul disponibil. La fiecare resize() facut de ResizeObserver,
    // continerul masurat era putin mai mare decat data trecuta, ceea ce
    // facea ca urmatorul resize() sa-l creasca din nou — o bucla care crestea
    // ecranul de semnatura la nesfarsit (de-aia butoanele pareau ca "aluneca
    // in jos" cu fiecare secunda). Fix-ul real e min-height:0 in CSS; ramane
    // aici si o garda (rotunjire + prag) care opreste orice resize() inutil
    // daca dimensiunea masurata nu s-a schimbat cu adevarat.
    let lastW = 0, lastH = 0;
    function resize() {
      // clientWidth/clientHeight = dimensiunea reala de layout a lui
      // canvasWrap, neafectata de padding-ul altor elemente din row.
      const w = canvasWrap.clientWidth;
      const h = canvasWrap.clientHeight;
      if (!w || !h) return; // containerul inca nu are dimensiuni (ecran in tranzitie)
      if (Math.abs(w - lastW) < 0.5 && Math.abs(h - lastH) < 0.5) return;
      lastW = w;
      lastH = h;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = w * ratio;
      canvas.height = h * ratio;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#2454C7';
    }
    // Urmarim CONTINUU dimensiunea reala a zonei de desenat, nu doar o
    // singura data la montare: layout-ul se poate stabiliza asincron (ex.
    // bara de adrese a browserului care se restrange la scroll), iar un
    // singur resize() facut la inceput ar putea prinde dimensiuni vechi —
    // asta facea ca desenul sa iasa in afara canvas-ului real sau ca
    // semnatura sa nu se salveze corect. ResizeObserver reactioneaza de
    // fiecare data cand containerul isi schimba efectiv marimea. Facem
    // resize() DOAR daca soferul nu a inceput deja sa semneze — altfel am
    // sterge semnatura in curs.
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        if (!hasStrokes) resize();
      });
      resizeObserver.observe(canvasWrap);
    } else {
      requestAnimationFrame(resize);
      setTimeout(() => {
        if (!hasStrokes) resize();
      }, 350);
    }

    // Chenarul nu se mai roteste niciodata prin CSS — mapare directa,
    // intotdeauna, intre coordonatele evenimentului (viewport) si canvas.
    function pointFromEvent(e) {
      const rect = canvas.getBoundingClientRect();
      const point = e.touches ? e.touches[0] : e;
      return { x: point.clientX - rect.left, y: point.clientY - rect.top };
    }
    function extendBounds(p) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    // Redeseneaza o singura trasa (array de puncte {x,y}) cu grosime
    // variabila: subtire la cele doua capete, plina in mijloc — ca varful
    // unui pix real. Grosimea fiecarui segment depinde de distanta parcursa
    // (nu de numarul de puncte), ca desenul sa arate la fel indiferent cat
    // de repede/rar a trimis browserul evenimentele pointermove.
    function drawTaperedStroke(pts) {
      if (pts.length < 2) return;
      const dist = [0];
      for (let i = 1; i < pts.length; i++) {
        dist.push(dist[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
      }
      const totalLen = dist[dist.length - 1];
      const taper = Math.min(PEN_TAPER_PX, totalLen / 2.2);
      for (let i = 1; i < pts.length; i++) {
        const midDist = (dist[i - 1] + dist[i]) / 2;
        const factor = taper > 0 ? Math.min(1, Math.min(midDist, totalLen - midDist) / taper) : 1;
        ctx.lineWidth = PEN_MIN_WIDTH + (PEN_MAX_WIDTH - PEN_MIN_WIDTH) * factor;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }
    // Reface tot desenul (toate trasele) din memorie, cu afinare la capete.
    // Apelata doar la finalul fiecarei trase (pointerup) — cat timp degetul
    // e inca pe ecran desenam live, la grosime plina, ca sa nu introducem lag.
    function redrawTapered() {
      ctx.clearRect(0, 0, canvasWrap.clientWidth, canvasWrap.clientHeight);
      strokes.forEach(drawTaperedStroke);
    }
    function start(e) {
      e.preventDefault();
      drawing = true;
      last = pointFromEvent(e);
      extendBounds(last);
      currentStroke = [last];
    }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      const p = pointFromEvent(e);
      ctx.lineWidth = PEN_MAX_WIDTH;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      currentStroke.push(p);
      hasStrokes = true;
      extendBounds(p);
    }
    function end(e) {
      if (!drawing) return;
      drawing = false;
      if (currentStroke.length > 1) {
        strokes.push(currentStroke);
        redrawTapered();
      }
      currentStroke = [];
    }
    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);

    function clear() {
      // La fel ca in resize(): dimensiunea LOCALA (clientWidth/clientHeight),
      // nu dreptunghiul rotit din getBoundingClientRect().
      ctx.clearRect(0, 0, canvasWrap.clientWidth, canvasWrap.clientHeight);
      hasStrokes = false;
      strokes = [];
      currentStroke = [];
      minX = Infinity;
      minY = Infinity;
      maxX = -Infinity;
      maxY = -Infinity;
    }

    function save() {
      if (!hasStrokes) {
        showToast('Semneaza in chenar inainte de validare.');
        return;
      }
      // Decupam semnatura la conturul cernelii desenate (+ un mic padding),
      // in loc sa exportam tot canvas-ul gol in jur — ca imaginea rezultata
      // sa aiba proportia semnaturii reale.
      const ratio = window.devicePixelRatio || 1;
      const PAD = 14; // padding, in pixeli CSS
      const cssW = canvas.width / ratio;
      const cssH = canvas.height / ratio;
      const cropX = Math.max(0, minX - PAD);
      const cropY = Math.max(0, minY - PAD);
      const cropW = Math.min(cssW, maxX + PAD) - cropX;
      const cropH = Math.min(cssH, maxY + PAD) - cropY;

      let out;
      if (!(cropW > 0) || !(cropH > 0)) {
        out = canvas;
      } else {
        const srcX = Math.round(cropX * ratio);
        const srcY = Math.round(cropY * ratio);
        const srcW = Math.round(cropW * ratio);
        const srcH = Math.round(cropH * ratio);
        out = document.createElement('canvas');
        // Chenarul (vezi styles.css) ramane INTOTDEAUNA ingust/vertical pe
        // ecran, indiferent cum tine soferul telefonul — dar soferul
        // intoarce mereu telefonul fizic ca sa semneze confortabil (asa a
        // functionat dintotdeauna aplicatia), deci cerneala bruta e
        // capturata "culcata" pe axa lunga (Y) a canvas-ului. O rotim aici
        // 90°, o SINGURA data, NECONDITIONAT (nu depinde de nicio detectare
        // de orientare in JS) — exact comportamentul original: "dupa
        // salvare, toate semnaturile apareau ... in forma orizontala".
        // Rotatia: sursa (lx,ly) -> destinatie (ly, srcW - lx), adica
        // ctx.translate(0, srcW) + ctx.rotate(-90°) inainte de drawImage.
        out.width = srcH;
        out.height = srcW;
        const outCtx = out.getContext('2d');
        outCtx.translate(0, srcW);
        outCtx.rotate(-Math.PI / 2);
        outCtx.drawImage(canvas, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);
      }
      out.toBlob((blob) => pop(blob), 'image/png');
    }

    return screen;
  });
  return promise.finally(() => {
    if (resizeObserver) resizeObserver.disconnect();
    unlockPortraitForSignature();
  });
}

// Distanta (in metri) intre doua puncte GPS — folosita ca sa nu re-cerem
// adresa la fiecare update minor de pozitie (formula Haversine).
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Traduce coordonatele GPS in judet/localitate/strada, folosind serviciul
// gratuit de reverse-geocoding OpenStreetMap Nominatim (nu necesita cheie
// API). Daca soferul nu are semnal de internet in acel moment, sau
// serviciul e indisponibil, esuam silentios — verificarea de acuratete GPS
// (functia principala a acestui ecran) nu depinde deloc de asta.
// Politica de utilizare Nominatim (operations.osmfoundation.org/policies/
// nominatim) impune maxim 1 cerere/secunda pe TOATA aplicatia (nu per
// utilizator) — pastram momentul ultimei cereri la nivel de modul, ca
// pragul sa fie respectat chiar daca ecranul GPS e deschis/inchis repede.
let lastNominatimRequestAt = 0;
async function reverseGeocodeLabel(lat, lon) {
  const now = Date.now();
  if (now - lastNominatimRequestAt < 1100) return null; // prea devreme, incercam la urmatorul update de pozitie
  lastNominatimRequestAt = now;
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&accept-language=ro`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'ro' } });
  if (!res.ok) throw new Error('reverse geocode http ' + res.status);
  const data = await res.json();
  const a = data.address || {};
  const judet = a.county || a.state || '';
  const localitate = a.city || a.town || a.village || a.municipality || a.suburb || '';
  const strada = [a.road, a.house_number].filter(Boolean).join(' ');
  const parts = [];
  if (judet) parts.push(`Jud. ${judet}`);
  if (localitate) parts.push(localitate);
  if (strada) parts.push(strada);
  return parts.join(', ');
}

// ------------------------------------------------------------------
// Poarta GPS: cere o pozitie precisa inainte de a permite poza de
// confirmare. Port din gps_accuracy_gate_screen.dart.
// ------------------------------------------------------------------
export async function gpsAccuracyGate() {
  const THRESHOLD = 20;
  return pushScreen(({ pop }) => {
    const screen = el('div', { class: 'gps-screen' });
    const topBar = el('div', { class: 'topbar topbar-dark' }, [
      el('button', { class: 'icon-btn icon-btn-light', onclick: () => pop(undefined) }, ['←']),
      el('div', { class: 'topbar-title topbar-title-light' }, ['Verificare Locatie GPS']),
    ]);
    const ring = el('div', { class: 'gps-ring gps-ring-loading' });
    const ringLabel = el('div', { class: 'gps-ring-label' }, ['GPS...']);
    ring.appendChild(ringLabel);
    const coordsBox = el('div', { class: 'gps-coords', style: 'display:none' });
    const locationLine = el('div', { class: 'gps-location', style: 'display:none' });
    const status = el('div', { class: 'gps-status' }, ['Se cauta semnal GPS...']);
    const actionBtn = el('button', { class: 'btn btn-block gps-action-btn', disabled: true }, ['Asteptam precizie GPS...']);
    const skipBtn = el('button', { class: 'btn btn-text gps-skip' }, ['Sari peste verificare GPS']);
    skipBtn.addEventListener('click', () => pop('skip'));

    screen.appendChild(topBar);
    const content = el('div', { class: 'gps-content' }, [ring, coordsBox, locationLine, status, el('div', { class: 'gps-spacer' }), actionBtn, skipBtn]);
    screen.appendChild(content);

    let watchId = null;
    let bestPosition = null;
    // Urmarim ultimul punct pentru care am cerut deja adresa, ca sa nu
    // batem la usa Nominatim la fiecare update minor de pozitie (watchPosition
    // poate emite de multe ori pe secunda) — re-cerem doar daca soferul s-a
    // mutat cu adevarat (>25m) sau la prima pozitie primita.
    let geocoding = false;
    let lastGeocodedAt = null; // {lat, lon}

    async function updateLocationLine(position) {
      const { latitude, longitude } = position.coords;
      if (geocoding) return;
      if (lastGeocodedAt && distanceMeters(lastGeocodedAt.lat, lastGeocodedAt.lon, latitude, longitude) < 25) return;
      geocoding = true;
      try {
        const label = await reverseGeocodeLabel(latitude, longitude);
        if (label === null) return; // throttled — reincercam la urmatorul update
        lastGeocodedAt = { lat: latitude, lon: longitude };
        if (label) {
          locationLine.textContent = `${label} · sursa: OpenStreetMap`;
          locationLine.style.display = '';
        }
      } catch (e) {
        // esuam silentios — vezi comentariul de la reverseGeocodeLabel()
      } finally {
        geocoding = false;
      }
    }

    function colorFor(accuracy) {
      if (accuracy <= THRESHOLD) return '#2E7D32';
      if (accuracy <= 50) return '#F57F17';
      return '#C62828';
    }
    function labelFor(accuracy) {
      if (accuracy <= THRESHOLD) return 'EXCELENT';
      if (accuracy <= 50) return 'MEDIU';
      return 'SLAB';
    }

    function onPosition(position) {
      bestPosition = position;
      const accuracy = position.coords.accuracy;
      const color = colorFor(accuracy);
      ring.classList.remove('gps-ring-loading');
      ring.style.borderColor = color;
      ring.style.background = color + '1a';
      ring.innerHTML = '';
      ring.appendChild(el('div', { class: 'gps-ring-value', style: `color:${color}` }, [`± ${accuracy.toFixed(0)} m`]));
      ring.appendChild(el('div', { class: 'gps-ring-label', style: `color:${color}` }, [labelFor(accuracy)]));

      coordsBox.style.display = '';
      coordsBox.innerHTML = '';
      coordsBox.appendChild(el('div', {}, [`LAT: ${position.coords.latitude.toFixed(6)}`]));
      coordsBox.appendChild(el('div', {}, [`LNG: ${position.coords.longitude.toFixed(6)}`]));
      updateLocationLine(position);

      const goodEnough = accuracy <= THRESHOLD;
      status.textContent =
        accuracy <= THRESHOLD ? 'Locatia este precisa! Poti face poza.' : accuracy <= 50 ? 'Precizie medie. Asteapta imbunatatire...' : 'Semnal slab. Mergi la spatiu deschis...';
      status.style.color = goodEnough ? '#81C784' : '#FFB74D';

      actionBtn.disabled = !goodEnough;
      actionBtn.textContent = goodEnough ? 'ADAUGA FOTO — Locatia este in parametri' : 'Asteptam precizie GPS...';
      actionBtn.classList.toggle('gps-action-ready', goodEnough);
      actionBtn.onclick = goodEnough ? () => stopAndPop(position) : null;
    }

    function onError() {
      status.textContent = 'Eroare GPS. Verifica permisiunile.';
    }

    function stopAndPop(position) {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      pop(position);
    }

    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(onPosition, onError, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      });
    } else {
      status.textContent = 'GPS indisponibil pe acest dispozitiv.';
    }

    return screen;
  });
}

// ------------------------------------------------------------------
// Camera: input file cu capture="environment" — cea mai fiabila metoda
// de a deschide direct camera din Chrome pe Android intr-un PWA.
// ------------------------------------------------------------------
export function captureCameraPhoto() {
  return new Promise((resolve) => {
    const input = el('input', { type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none' });
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      resolve(file || null);
    });
    document.body.appendChild(input);
    input.click();
  });
}
