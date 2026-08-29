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
// telefonul trece fortat pe orizontala, ca zona de semnat sa fie cat mai
// lata. Incercam DOAR lock() direct — functioneaza fara Fullscreen API cand
// aplicatia ruleaza instalata ca PWA (mod "standalone", cazul real de
// utilizare pe telefoanele soferilor). Am renuntat deliberat la fallback-ul
// prin Fullscreen API (folosit anterior cand lock() direct esua, ex: in tab
// obisnuit de Chrome, neinstalat): pe langa faptul ca declansa un banner
// nativ ("ai intrat in ecran complet") care nu poate fi inlaturat din cod,
// tranzitia efectiva spre fullscreen putea intra in coliziune cu gesturile
// de desenat, facand semnatura sa nu se salveze corect chiar in acele prime
// momente. Daca lock() esueaza (iOS Safari nu implementeaza deloc API-ul,
// sau tab obisnuit neinstalat), esuam silentios — soferul poate roti manual.
async function lockLandscape() {
  try {
    await screen.orientation.lock('landscape');
  } catch (e) {
    // ok, nu blocam semnarea — vezi comentariul de mai sus
  }
}

// Vibratie scurta la apasarea butoanelor de confirmare/stergere semnatura —
// acelasi feedback tactil ca in aplicatia veche (APK). Vibration API nu e
// suportata pe iOS Safari, deci esuam silentios acolo.
function hapticTap() {
  try {
    if (navigator.vibrate) navigator.vibrate(20);
  } catch (e) {}
}

function unlockOrientation() {
  try {
    if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
  } catch (e) {}
  try {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch (e) {}
}

// ------------------------------------------------------------------
// Signature pad (canvas) — ecran complet, folosit prin pushScreen()
// ------------------------------------------------------------------
export async function captureSignature({ title = 'Semnatura' } = {}) {
  await lockLandscape();
  try {
    return await captureSignatureScreen(title);
  } finally {
    unlockOrientation();
  }
}

function captureSignatureScreen(title) {
  // Referinta ridicata in afara builder-ului lui pushScreen(), ca sa putem
  // opri urmarirea dimensiunii containerului cand ecranul se inchide,
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
    const row = el('div', { class: 'signature-row' }, [clearBtn, canvasWrap, okBtn]);
    screen.appendChild(topBar);
    screen.appendChild(row);
    screen.appendChild(el('div', { class: 'signature-hint' }, ['Semneaza in chenar folosind degetul sau stylus-ul.']));

    const ctx = canvas.getContext('2d');
    let drawing = false;
    let hasStrokes = false;
    let last = null;
    // Bounding box (in pixeli CSS, adica acelasi sistem de coordonate ca
    // pointFromEvent) al cernelii desenate efectiv — folosit la export ca
    // semnatura sa fie decupata stans pe conturul ei, nu pe tot canvas-ul
    // (mult mai lat, gol in cea mai mare parte, dupa blocarea landscape).
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

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
      const rect = canvasWrap.getBoundingClientRect();
      if (!rect.width || !rect.height) return; // containerul inca nu are dimensiuni (ecran in tranzitie)
      if (Math.abs(rect.width - lastW) < 0.5 && Math.abs(rect.height - lastH) < 0.5) return;
      lastW = rect.width;
      lastH = rect.height;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1B2F6B';
    }
    // Urmarim CONTINUU dimensiunea reala a zonei de desenat, nu doar o
    // singura data la montare: rotatia in landscape (lockLandscape) se poate
    // finaliza asincron, dupa ce ecranul e deja montat, iar un singur
    // resize() facut la inceput ar putea prinde dimensiunile vechi
    // (portret) — asta facea ca desenul sa iasa in afara canvas-ului real
    // sau ca semnatura sa nu se salveze corect. ResizeObserver reactioneaza
    // de fiecare data cand containerul isi schimba efectiv marimea, oricat
    // ar dura tranzitia pe telefonul respectiv. Facem resize() DOAR daca
    // soferul nu a inceput deja sa semneze — altfel am sterge semnatura in curs.
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
    function start(e) {
      e.preventDefault();
      drawing = true;
      last = pointFromEvent(e);
      extendBounds(last);
    }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      const p = pointFromEvent(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      hasStrokes = true;
      extendBounds(p);
    }
    function end(e) {
      drawing = false;
    }
    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);

    function clear() {
      const rect = canvasWrap.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      hasStrokes = false;
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
      // in loc sa exportam tot canvas-ul lat/gol — ca imaginea rezultata sa
      // aiba proportia semnaturii reale si sa umple bine chenarul alocat in
      // documentul PV (care are o forma/dimensiune similara, de tip landscape).
      const ratio = window.devicePixelRatio || 1;
      const PAD = 14; // padding, in pixeli CSS
      const cssW = canvas.width / ratio;
      const cssH = canvas.height / ratio;
      const cropX = Math.max(0, minX - PAD);
      const cropY = Math.max(0, minY - PAD);
      const cropW = Math.min(cssW, maxX + PAD) - cropX;
      const cropH = Math.min(cssH, maxY + PAD) - cropY;

      if (!(cropW > 0) || !(cropH > 0)) {
        canvas.toBlob((blob) => pop(blob), 'image/png');
        return;
      }

      const out = document.createElement('canvas');
      out.width = Math.round(cropW * ratio);
      out.height = Math.round(cropH * ratio);
      const outCtx = out.getContext('2d');
      outCtx.drawImage(
        canvas,
        Math.round(cropX * ratio), Math.round(cropY * ratio),
        Math.round(cropW * ratio), Math.round(cropH * ratio),
        0, 0,
        out.width, out.height
      );
      out.toBlob((blob) => pop(blob), 'image/png');
    }

    return screen;
  });
  return promise.finally(() => {
    if (resizeObserver) resizeObserver.disconnect();
  });
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
    const status = el('div', { class: 'gps-status' }, ['Se cauta semnal GPS...']);
    const actionBtn = el('button', { class: 'btn btn-block gps-action-btn', disabled: true }, ['Asteptam precizie GPS...']);
    const skipBtn = el('button', { class: 'btn btn-text gps-skip' }, ['Sari peste verificare GPS']);
    skipBtn.addEventListener('click', () => pop('skip'));

    screen.appendChild(topBar);
    const content = el('div', { class: 'gps-content' }, [ring, coordsBox, status, el('div', { class: 'gps-spacer' }), actionBtn, skipBtn]);
    screen.appendChild(content);

    let watchId = null;
    let bestPosition = null;

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
