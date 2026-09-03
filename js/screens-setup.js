// screens-setup.js — asistent de prima configurare (soferi/masini/depozite)
// si ecranele de gestiune ulterioara (Setari). Versiune restransa fata de
// v5.x (fara depozite de colaborare, fara parola de depozit) - suficienta
// pentru fluxul principal de Procese Verbale.

import { el } from './utils.js';
import { pushScreen } from './router.js';
import { DriverRepo, CarRepo, DepotRepo } from './db.js';
import { textField, primaryButton, outlineButton, sectionCard, confirmDialog, showToast, captureSignature } from './components.js';
import { DEFAULT_DEPOT } from './catalog-defaults.js';
import { blobToDataUrl } from './utils.js';
import { getCurrentProfile, signOut } from './auth.js';

function topBar(title, onBack) {
  return el('div', { class: 'topbar' }, [
    onBack ? el('button', { class: 'icon-btn', onclick: onBack }, ['←']) : el('div', { class: 'topbar-spacer' }),
    el('div', { class: 'topbar-title' }, [title]),
    el('div', { class: 'topbar-spacer' }),
  ]);
}

// ------------------------------------------------------------------
// Editor sofer
// ------------------------------------------------------------------
async function openDriverEditor(existing) {
  return pushScreen(({ pop }) => {
    const screen = el('div', { class: 'screen' });
    let signatureBlob = null;
    let signatureDataUrl = existing?.signatureDataUrl || null;

    const isSyncedDriver = existing?.id === 'synced-driver';

    const nameField = textField({ label: 'Nume complet', value: existing?.name || '', required: true });
    const ciField = textField({ label: 'CI (serie + numar)', value: existing?.ci || '' });
    const functiaField = textField({ label: 'Functie (optional)', value: existing?.functia || '', readOnly: isSyncedDriver });

    const sigPreview = el('div', { class: 'signature-box-preview' });
    function renderSigPreview() {
      sigPreview.innerHTML = '';
      if (signatureDataUrl) {
        sigPreview.appendChild(el('img', { src: signatureDataUrl, style: 'max-height:64px;max-width:100%;object-fit:contain' }));
      } else {
        sigPreview.appendChild(el('div', { style: 'color:var(--ink-soft);font-size:13px' }, ['Fara semnatura salvata']));
      }
    }
    renderSigPreview();

    const sigBtn = outlineButton('Captureaza semnatura sofer', async () => {
      const blob = await captureSignature({ title: 'Semnatura sofer' });
      if (!blob) return;
      signatureBlob = blob;
      signatureDataUrl = await blobToDataUrl(blob);
      renderSigPreview();
    });

    const card = sectionCard('Date sofer', [
      nameField,
      ciField,
      functiaField,
      isSyncedDriver
        ? el('div', { style: 'font-size:12px;color:var(--ink-soft);margin-top:-8px' }, ['Functia e gestionata de administrator si se actualizeaza automat la login.'])
        : null,
      el('div', { class: 'field-label' }, ['Semnatura']),
      sigPreview,
      el('div', { style: 'height:8px' }),
      sigBtn,
    ]);

    const scroll = el('div', { class: 'screen-scroll' }, [card]);
    const bottom = el('div', { class: 'bottom-actions' }, [
      primaryButton('Salveaza sofer', async () => {
        const name = nameField.input.value.trim();
        if (!name) {
          showToast('Numele soferului este obligatoriu.');
          return;
        }
        const record = {
          ...(existing || {}),
          name,
          ci: ciField.input.value.trim(),
          functia: functiaField.input.value.trim(),
          signatureDataUrl: signatureDataUrl || '',
          sortOrder: existing?.sortOrder ?? Date.now(),
        };
        const id = await DriverRepo.save(record);
        pop({ ...record, id: existing?.id ?? id });
      }),
    ]);

    screen.appendChild(topBar(existing ? 'Editeaza sofer' : 'Sofer nou', () => pop(undefined)));
    screen.appendChild(scroll);
    screen.appendChild(bottom);
    return screen;
  });
}

// ------------------------------------------------------------------
// Editor masina
// ------------------------------------------------------------------
async function openCarEditor(existing) {
  return pushScreen(({ pop }) => {
    const screen = el('div', { class: 'screen' });
    const marcaField = textField({ label: 'Marca', value: existing?.marca || '', required: true });
    const numarField = textField({ label: 'Numar inmatriculare', value: existing?.numar || '', required: true });
    const card = sectionCard('Date auto', [marcaField, numarField]);
    const scroll = el('div', { class: 'screen-scroll' }, [card]);
    const bottom = el('div', { class: 'bottom-actions' }, [
      primaryButton('Salveaza auto', async () => {
        const marca = marcaField.input.value.trim();
        const numar = numarField.input.value.trim();
        if (!marca || !numar) {
          showToast('Completeaza marca si numarul.');
          return;
        }
        const record = { ...(existing || {}), marca, numar, sortOrder: existing?.sortOrder ?? Date.now() };
        const id = await CarRepo.save(record);
        pop({ ...record, id: existing?.id ?? id });
      }),
    ]);
    screen.appendChild(topBar(existing ? 'Editeaza auto' : 'Auto nou', () => pop(undefined)));
    screen.appendChild(scroll);
    screen.appendChild(bottom);
    return screen;
  });
}

// ------------------------------------------------------------------
// Editor depozit
// ------------------------------------------------------------------
async function openDepotEditor(existing) {
  const base = existing || DEFAULT_DEPOT;
  return pushScreen(({ pop }) => {
    const screen = el('div', { class: 'screen' });
    const nameField = textField({ label: 'Nume depozit', value: base.name || '', required: true });
    const addressField = textField({ label: 'Adresa', value: base.address || '' });
    const repNameField = textField({ label: 'Reprezentant', value: base.representativeName || '' });
    const repFunctionField = textField({ label: 'Functie reprezentant', value: base.representativeFunction || '' });
    const repPhoneField = textField({ label: 'Telefon depozit', value: base.representativePhone || '' });
    const repEmailField = textField({ label: 'Email depozit', value: base.representativeEmail || '' });
    const accessCodeField = textField({
      label: 'Parola acces — Cerere de Demisie (optional)',
      value: base.representativeAccessCode || '',
      placeholder: 'lasa gol = fara verificare parola',
    });
    const card = sectionCard('Date depozit', [
      nameField,
      addressField,
      repNameField,
      repFunctionField,
      repPhoneField,
      repEmailField,
      accessCodeField,
      el('div', { style: 'font-size:12px;color:var(--ink-soft);margin-top:-4px' }, [
        'Aceasta parola e ceruta soferului inainte de a genera o Cerere de Demisie, ca reprezentantul depozitului sa fie de fata la solicitare.',
      ]),
    ]);
    const scroll = el('div', { class: 'screen-scroll' }, [card]);
    const bottom = el('div', { class: 'bottom-actions' }, [
      primaryButton('Salveaza depozit', async () => {
        const name = nameField.input.value.trim();
        if (!name) {
          showToast('Numele depozitului este obligatoriu.');
          return;
        }
        const record = {
          ...(existing || {}),
          name,
          address: addressField.input.value.trim(),
          representativeName: repNameField.input.value.trim(),
          representativeFunction: repFunctionField.input.value.trim(),
          representativePhone: repPhoneField.input.value.trim(),
          representativeEmail: repEmailField.input.value.trim(),
          representativeAccessCode: accessCodeField.input.value.trim(),
          sortOrder: existing?.sortOrder ?? Date.now(),
        };
        const id = await DepotRepo.save(record);
        pop({ ...record, id: existing?.id ?? id });
      }),
    ]);
    screen.appendChild(topBar(existing ? 'Editeaza depozit' : 'Depozit nou', () => pop(undefined)));
    screen.appendChild(scroll);
    screen.appendChild(bottom);
    return screen;
  });
}

// ------------------------------------------------------------------
// Lista generica cu Adauga / Editeaza / Sterge — folosita si in wizard,
// si in ecranul de Setari.
// ------------------------------------------------------------------
function renderEntityList({ items, renderMain, renderSub, onEdit, onDelete }) {
  const list = el('div', {});
  if (!items.length) {
    list.appendChild(el('div', { class: 'empty-state', style: 'padding:24px 4px' }, ['Nimic adaugat inca.']));
    return list;
  }
  items.forEach((item) => {
    const row = el('div', { class: 'list-item' });
    const main = el('div', {}, [el('div', { class: 'list-item-main' }, [renderMain(item)]), renderSub ? el('div', { class: 'list-item-sub' }, [renderSub(item)]) : null]);
    const actions = el('div', { class: 'list-item-actions' }, [
      el('button', { onclick: () => onEdit(item) }, ['✎']),
      el('button', { class: 'danger', onclick: () => onDelete(item) }, ['🗑']),
    ]);
    row.appendChild(main);
    row.appendChild(actions);
    list.appendChild(row);
  });
  return list;
}

async function setupStepScreen({ title, subtitle, stepIndex, totalSteps, load, editor, remove, renderMain, renderSub, addLabel }) {
  return pushScreen(({ pop }) => {
    const screen = el('div', { class: 'screen' });
    screen.appendChild(topBar(title, stepIndex > 0 ? () => pop('back') : undefined));

    const progress = el('div', { class: 'setup-progress' });
    for (let i = 0; i < totalSteps; i++) {
      progress.appendChild(el('div', { class: `setup-progress-dot ${i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}` }));
    }

    const listHost = el('div', {});
    const continueBtn = primaryButton('Continua', () => pop('next'), { disabled: true });

    async function refresh() {
      const items = await load();
      listHost.innerHTML = '';
      listHost.appendChild(
        renderEntityList({
          items,
          renderMain,
          renderSub,
          onEdit: async (item) => {
            await editor(item);
            refresh();
          },
          onDelete: async (item) => {
            const ok = await confirmDialog({ title: 'Sterge?', message: 'Confirma stergerea acestei intrari.', danger: true, okLabel: 'Sterge' });
            if (!ok) return;
            await remove(item.id);
            refresh();
          },
        })
      );
      continueBtn.disabled = items.length === 0;
    }
    refresh();

    const addBtn = outlineButton(addLabel, async () => {
      await editor(null);
      refresh();
    });

    const scroll = el('div', { class: 'screen-scroll' }, [progress, el('p', { style: 'color:var(--ink-soft);font-size:13.5px;margin:0 0 14px' }, [subtitle]), addBtn, el('div', { style: 'height:14px' }), listHost]);
    screen.appendChild(scroll);
    screen.appendChild(el('div', { class: 'bottom-actions' }, [continueBtn]));
    return screen;
  });
}

/** Ruleaza wizard-ul de configurare initiala (soferi -> masini -> depozite). */
export async function runSetupWizard() {
  let step = 0;
  const steps = [
    () =>
      setupStepScreen({
        title: 'Configurare — Soferi',
        subtitle: 'Adauga cel putin un sofer inainte de a continua.',
        stepIndex: 0,
        totalSteps: 3,
        load: DriverRepo.getAll,
        editor: openDriverEditor,
        remove: DriverRepo.remove,
        renderMain: (d) => d.name,
        renderSub: (d) => d.ci || '',
        addLabel: '+ Adauga sofer',
      }),
    () =>
      setupStepScreen({
        title: 'Configurare — Masini',
        subtitle: 'Adauga cel putin o masina de companie.',
        stepIndex: 1,
        totalSteps: 3,
        load: CarRepo.getAll,
        editor: openCarEditor,
        remove: CarRepo.remove,
        renderMain: (c) => `${c.marca} — ${c.numar}`,
        renderSub: () => '',
        addLabel: '+ Adauga auto',
      }),
    () =>
      setupStepScreen({
        title: 'Configurare — Depozite',
        subtitle: 'Adauga punctul de lucru principal (poti edita mai tarziu).',
        stepIndex: 2,
        totalSteps: 3,
        load: DepotRepo.getAll,
        editor: openDepotEditor,
        remove: DepotRepo.remove,
        renderMain: (d) => d.name,
        renderSub: (d) => d.address || '',
        addLabel: '+ Adauga depozit',
      }),
  ];

  while (step < steps.length) {
    const result = await steps[step]();
    if (result === 'next') step += 1;
    else if (result === 'back') step = Math.max(0, step - 1);
    // orice alt rezultat (back de pe primul pas / undefined) mentine pasul curent
  }
}

/** Ecranul de Setari, accesibil din selectorul principal. */
export async function openSettingsScreen() {
  return pushScreen(({ pop }) => {
    const screen = el('div', { class: 'screen' });
    screen.appendChild(topBar('Setari', () => pop(undefined)));

    const driversHost = el('div', {});
    const carsHost = el('div', {});
    const depotsHost = el('div', {});

    async function refreshDrivers() {
      const items = await DriverRepo.getAll();
      driversHost.innerHTML = '';
      driversHost.appendChild(
        renderEntityList({
          items,
          renderMain: (d) => d.name,
          renderSub: (d) => d.ci || '',
          onEdit: async (item) => {
            await openDriverEditor(item);
            refreshDrivers();
          },
          onDelete: async (item) => {
            if (!(await confirmDialog({ title: 'Sterge sofer?', message: item.name, danger: true, okLabel: 'Sterge' }))) return;
            await DriverRepo.remove(item.id);
            refreshDrivers();
          },
        })
      );
    }
    async function refreshCars() {
      const items = await CarRepo.getAll();
      carsHost.innerHTML = '';
      carsHost.appendChild(
        renderEntityList({
          items,
          renderMain: (c) => `${c.marca} — ${c.numar}`,
          onEdit: async (item) => {
            await openCarEditor(item);
            refreshCars();
          },
          onDelete: async (item) => {
            if (!(await confirmDialog({ title: 'Sterge auto?', message: `${item.marca} ${item.numar}`, danger: true, okLabel: 'Sterge' }))) return;
            await CarRepo.remove(item.id);
            refreshCars();
          },
        })
      );
    }
    async function refreshDepots() {
      const items = await DepotRepo.getAll();
      depotsHost.innerHTML = '';
      depotsHost.appendChild(
        renderEntityList({
          items,
          renderMain: (d) => d.name,
          renderSub: (d) => d.address || '',
          onEdit: async (item) => {
            await openDepotEditor(item);
            refreshDepots();
          },
          onDelete: async (item) => {
            if (!(await confirmDialog({ title: 'Sterge depozit?', message: item.name, danger: true, okLabel: 'Sterge' }))) return;
            await DepotRepo.remove(item.id);
            refreshDepots();
          },
        })
      );
    }
    refreshDrivers();
    refreshCars();
    refreshDepots();

    const accountHost = el('div', {});
    (async () => {
      const profile = await getCurrentProfile();
      if (!profile) return; // aplicatie fara login configurat (versiune veche/offline la prima rulare)
      accountHost.appendChild(
        sectionCard('Cont', [
          el('div', { style: 'margin-bottom:10px;color:var(--ink-soft);font-size:13.5px' }, [
            `Autentificat ca `, el('strong', {}, [profile.full_name || profile.username]),
          ]),
          outlineButton('Deconectare', async () => {
            if (!(await confirmDialog({ title: 'Deconectare', message: 'Iesi din cont pe acest telefon?', okLabel: 'Deconecteaza-ma' }))) return;
            await signOut();
            location.reload();
          }),
        ])
      );
    })();

    const scroll = el('div', { class: 'screen-scroll' }, [
      accountHost,
      sectionCard('Soferi', [driversHost, outlineButton('+ Adauga sofer', async () => { await openDriverEditor(null); refreshDrivers(); })]),
      sectionCard('Masini', [carsHost, outlineButton('+ Adauga auto', async () => { await openCarEditor(null); refreshCars(); })]),
      sectionCard('Depozite', [depotsHost, outlineButton('+ Adauga depozit', async () => { await openDepotEditor(null); refreshDepots(); })]),
    ]);
    screen.appendChild(scroll);
    return screen;
  });
}

export { openDriverEditor, openCarEditor, openDepotEditor };
