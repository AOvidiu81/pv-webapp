// screens-home.js — selector sofer/auto/depozit, meniul principal si
// selectia tipului de proces verbal. Port simplificat din
// main_selector_screen.dart / home_selection_screen.dart / process_screen.dart.

import { el, formatDateRo, weekdayLabelRo, vechimeLabel, APP_VERSION, forceUpdateApp } from './utils.js';
import { pushScreen } from './router.js';
import { DriverRepo, CarRepo, DepotRepo } from './db.js';
import { selectField, sectionCard, primaryButton, showToast, tile } from './components.js';
import { openSettingsScreen } from './screens-setup.js';
import { PROCESS_TYPES, COMPANY_INFO } from './catalog-defaults.js';
import { openProcessVerbalForm } from './screens-pv-form.js';
import { openHistoryScreen } from './screens-history.js';
import { openCereriMenu } from './screens-cereri.js';

export async function openMainSelector() {
  return pushScreen(({ pop }) => {
    const screen = el('div', { class: 'screen' });
    const topBar = el('div', { class: 'topbar' }, [
      el('div', { class: 'topbar-title' }, ['']),
      el('button', { class: 'icon-btn', onclick: async () => { await openSettingsScreen(); load(); } }, ['⚙']),
    ]);
    screen.appendChild(topBar);

    const logo = el('img', { class: 'brand-logo', src: 'assets/logo/euro_ecologic_logo.png', alt: 'Euro Ecologic' });
    const versionTag = el('div', { class: 'app-version-tag' }, [`Versiune aplicatie: ${APP_VERSION}`]);
    const updateBtn = el(
      'button',
      {
        class: 'btn btn-text',
        style: 'display:block;margin:0 auto 4px;font-size:12px;padding:2px 8px;min-height:0',
        onclick: async () => {
          updateBtn.disabled = true;
          updateBtn.textContent = 'Se actualizeaza...';
          await forceUpdateApp();
        },
      },
      ['⟳ Forteaza actualizarea']
    );
    const form = el('div', {});
    const infoCard = el('div', { class: 'section-card', style: 'font-size:13px;color:var(--ink-soft)' });
    const continueBtn = primaryButton('Continua', () => {}, { disabled: true });

    let drivers = [];
    let cars = [];
    let depots = [];
    let selectedDriver = null;
    let selectedCar = null;
    let selectedDepot = null;

    function renderInfoCard() {
      const today = new Date();
      infoCard.innerHTML = '';
      infoCard.appendChild(el('div', { style: 'margin-bottom:4px' }, [`CI: ${selectedDriver?.ci || '-'}`]));
      if (selectedDriver?.nrContract) {
        infoCard.appendChild(el('div', { style: 'margin-bottom:4px' }, [`Nr. contract: ${selectedDriver.nrContract}`]));
      }
      if (selectedDriver?.dataAngajare) {
        const [y, m, d] = selectedDriver.dataAngajare.split('-');
        const angajareLabel = d && m && y ? `${d}.${m}.${y}` : selectedDriver.dataAngajare;
        const vechime = vechimeLabel(selectedDriver.dataAngajare);
        infoCard.appendChild(
          el('div', { style: 'margin-bottom:4px' }, [`Data angajarii: ${angajareLabel}${vechime ? ` (vechime: ${vechime})` : ''}`])
        );
      }
      infoCard.appendChild(el('div', { style: 'margin-bottom:4px' }, [`Data: ${weekdayLabelRo(today)} ${formatDateRo(today)}`]));
      infoCard.appendChild(el('div', {}, [`Adresa: ${selectedDepot?.address || '-'}`]));
      if (selectedDriver?.signatureDataUrl) {
        infoCard.appendChild(el('img', { src: selectedDriver.signatureDataUrl, style: 'height:48px;object-fit:contain;margin-top:10px;display:block' }));
      }
    }

    function renderForm() {
      form.innerHTML = '';
      if (!drivers.length || !cars.length || !depots.length) {
        form.appendChild(el('div', { class: 'empty-state' }, ['Nu exista date suficiente. Adauga cel putin un sofer, o masina si un depozit din Setari.']));
        continueBtn.disabled = true;
        return;
      }
      const driverSelect = selectField({
        label: 'Sofer',
        value: selectedDriver?.id,
        options: drivers.map((d) => ({ value: d.id, label: d.name })),
        onChange: (val) => {
          selectedDriver = drivers.find((d) => String(d.id) === String(val));
          renderInfoCard();
        },
      });
      const carSelect = selectField({
        label: 'Auto',
        value: selectedCar?.id,
        options: cars.map((c) => ({ value: c.id, label: `${c.marca} - ${c.numar}` })),
        onChange: (val) => {
          selectedCar = cars.find((c) => String(c.id) === String(val));
        },
      });
      const depotSelect = selectField({
        label: 'Depozit',
        value: selectedDepot?.id,
        options: depots.map((d) => ({ value: d.id, label: d.name })),
        onChange: (val) => {
          selectedDepot = depots.find((d) => String(d.id) === String(val));
          renderInfoCard();
        },
      });
      form.appendChild(driverSelect);
      form.appendChild(carSelect);
      form.appendChild(depotSelect);
      continueBtn.disabled = false;
    }

    async function load() {
      [drivers, cars, depots] = await Promise.all([DriverRepo.getAll(), CarRepo.getAll(), DepotRepo.getAll()]);
      selectedDriver = drivers.find((d) => d.id === selectedDriver?.id) || drivers[0] || null;
      selectedCar = cars.find((c) => c.id === selectedCar?.id) || cars[0] || null;
      selectedDepot = depots.find((d) => d.id === selectedDepot?.id) || depots[0] || null;
      renderForm();
      renderInfoCard();
    }
    load();

    continueBtn.onclick = () => {
      if (!selectedDriver || !selectedCar || !selectedDepot) return;
      openHomeSelection({ driver: selectedDriver, car: selectedCar, depot: selectedDepot });
    };

    const scroll = el('div', { class: 'screen-scroll' }, [logo, versionTag, updateBtn, form, infoCard]);
    screen.appendChild(scroll);
    screen.appendChild(el('div', { class: 'bottom-actions' }, [continueBtn]));
    return screen;
  });
}


async function openHomeSelection({ driver, car, depot }) {
  return pushScreen(({ pop }) => {
    const screen = el('div', { class: 'screen' });
    screen.appendChild(el('div', { class: 'topbar' }, [
      el('button', { class: 'icon-btn', onclick: () => pop(undefined) }, ['←']),
      el('div', { class: 'topbar-title' }, ['Selecteaza modul']),
      el('div', { class: 'topbar-spacer' }),
    ]));

    const infoToggle = el('button', { class: 'btn btn-text', style: 'align-self:center' }, ['ℹ Date societate / depozit']);
    const infoBox = el('div', { class: 'info-box', style: 'display:none;flex-direction:column;gap:4px' });
    let infoMode = 'company';
    function renderInfo() {
      infoBox.innerHTML = '';
      if (infoMode === 'company') {
        [
          COMPANY_INFO.name,
          `Sediu: ${COMPANY_INFO.address}`,
          `Reg. Com.: ${COMPANY_INFO.regCom}`,
          `CUI: ${COMPANY_INFO.cui}`,
          `Telefon: ${COMPANY_INFO.phone}`,
          `Email: ${COMPANY_INFO.email}`,
          `Website: ${COMPANY_INFO.website}`,
        ].forEach((line) => infoBox.appendChild(el('div', {}, [line])));
      } else {
        [
          `Nume: ${depot.name}`,
          `Adresa: ${depot.address || '-'}`,
          `Reprezentant: ${depot.representativeName || '-'}`,
          `Functia: ${depot.representativeFunction || '-'}`,
          `Telefon: ${depot.representativePhone || '-'}`,
          `Email: ${depot.representativeEmail || '-'}`,
        ].forEach((line) => infoBox.appendChild(el('div', {}, [line])));
      }
    }
    infoToggle.addEventListener('click', () => {
      if (infoBox.style.display === 'none') {
        infoBox.style.display = 'flex';
        infoMode = 'company';
      } else if (infoMode === 'company') {
        infoMode = 'depot';
      } else {
        infoBox.style.display = 'none';
      }
      renderInfo();
    });

    const tiles = el('div', { style: 'display:flex;flex-direction:column;gap:12px;margin-top:16px' }, [
      tile({
        label: 'PROCESE VERBALE',
        sub: 'Amplasare, ridicare, servisare, vanzare',
        icon: '📄',
        accent: '#0D5AA7',
        badge: '#E7F1FF',
        onClick: () => openProcessTypeSelection({ driver, car, depot }),
      }),
      tile({
        label: 'CERERI / DOCUMENTE',
        sub: 'Concediu, demisie, invoire',
        icon: '📁',
        accent: '#2D4D7A',
        badge: '#EEF3FA',
        onClick: () => openCereriMenu({ driver, car, depot }),
      }),
    ]);

    const scroll = el('div', { class: 'screen-scroll' }, [tiles, el('div', { style: 'height:14px' }), infoToggle, infoBox]);
    screen.appendChild(scroll);
    return screen;
  });
}

const PROCESS_ICONS = { pin: '📍', truck: '🚚', wrench: '🔧', block: '⛔', invoice: '🧾' };

async function openProcessTypeSelection({ driver, car, depot }) {
  return pushScreen(({ pop }) => {
    const screen = el('div', { class: 'screen' });
    screen.appendChild(el('div', { class: 'topbar' }, [
      el('button', { class: 'icon-btn', onclick: () => pop(undefined) }, ['←']),
      el('div', { class: 'topbar-title' }, ['Alege Tipul de P.V.']),
      el('div', { class: 'topbar-spacer' }),
    ]));

    const tiles = el('div', { style: 'display:flex;flex-direction:column;gap:12px;margin-top:6px' });
    PROCESS_TYPES.forEach((pt) => {
      tiles.appendChild(
        tile({
          label: pt.title,
          sub: pt.subtitle,
          icon: PROCESS_ICONS[pt.icon] || '📄',
          accent: pt.accent,
          badge: pt.accent + '1a',
          onClick: () => openProcessVerbalForm({ driver, car, depot, processType: pt.type }),
        })
      );
    });

    const historyBtn = el('button', { class: 'btn btn-outline btn-block', onclick: () => openHistoryScreen() }, ['📂 Istoric documente']);

    const scroll = el('div', { class: 'screen-scroll' }, [tiles, el('div', { style: 'height:16px' }), historyBtn]);
    screen.appendChild(scroll);
    return screen;
  });
}
