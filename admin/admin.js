// admin.js — panou de administrare pentru Euro Ecologic PV: gestioneaza
// soferi (creare/activare-dezactivare/reset parola), masini si produsele
// din catalog. Se conecteaza la acelasi proiect Supabase pe care il
// foloseste si aplicatia soferilor (PWA-ul din radacina proiectului).
//
// Cheia "anon" de mai jos e sigura de expus public: toate tabelele au Row
// Level Security activat, iar operatiile sensibile (creare cont, activare/
// dezactivare, reset parola) trec printr-un Edge Function separat care
// verifica server-side ca cel ce cere are rol de admin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://vvhvxshwmhiakuxnmckg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2aHZ4c2h3bWhpYWt1eG5tY2tnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTM3NDAsImV4cCI6MjEwMzQyOTc0MH0.HqAlewj-VmntfOraM-Ps0joimGaUVB0mvUoHQgsVCfg';
const FUNCTIONS_URL = SUPABASE_URL + '/functions/v1/admin-manage-users';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function usernameToEmail(username) {
  const clean = String(username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return `pv-sofer-${clean}@eurowc.ro`;
}

// ---------- format data: DD-MM-YYYY in interfata, YYYY-MM-DD (ISO) in baza
// de date. Input-ul nativ <input type="date"> afiseaza formatul impus de
// browser/regiune (mm/dd/yyyy pe multe telefoane si pe Chrome din Windows),
// nu il putem forta din HTML — de-aia folosim un camp text cu formatare
// automata si validare proprie.
function isoToDmy(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  if (!y || !m || !d) return '';
  return `${d}-${m}-${y}`;
}

function dmyToIso(dmy) {
  const clean = String(dmy || '').trim();
  if (!clean) return { value: '' };
  const match = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!match) return { error: 'Data trebuie scrisa in formatul ZZ-LL-AAAA (ex: 04-02-2025).' };
  const [, dStr, mStr, yStr] = match;
  const d = Number(dStr);
  const m = Number(mStr);
  const y = Number(yStr);
  const check = new Date(y, m - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) {
    return { error: 'Data nu este valida.' };
  }
  return { value: `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` };
}

/** Ataseaza pe un input text formatarea automata cu cratime pe masura ce
 * se tasteaza cifre: "04022025" -> "04-02-2025". */
function attachDmyAutoformat(input) {
  input.addEventListener('input', () => {
    const digits = input.value.replace(/\D/g, '').slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    input.value = out;
  });
}

async function callAdminFn(action, extra) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const res = await fetch(FUNCTIONS_URL, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token || ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...extra }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Cerere esuata');
  return data;
}

// ---------- toast ----------
const toastHost = document.getElementById('toast-host');
function showToast(message, { danger = false } = {}) {
  const el = document.createElement('div');
  el.className = 'toast' + (danger ? ' toast-danger' : '');
  el.textContent = message;
  toastHost.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ---------- elemente ----------
const loginScreen = document.getElementById('login-screen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');
const topbarUser = document.getElementById('topbar-user');
const changePasswordBtn = document.getElementById('change-password-btn');
const logoutBtn = document.getElementById('logout-btn');
const modalHost = document.getElementById('modal-host');

let currentAdmin = null; // { id, username, full_name }

// ---------- login / sesiune ----------
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Se autentifica...';
  try {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const email = usernameToEmail(username);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Utilizator sau parola gresita');
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, username, full_name, role, active')
      .eq('id', data.user.id)
      .single();
    if (profileErr || !profile) throw new Error('Nu am gasit profilul acestui cont');
    if (profile.role !== 'admin') {
      await supabase.auth.signOut();
      throw new Error('Acest cont nu are drepturi de administrator');
    }
    if (!profile.active) {
      await supabase.auth.signOut();
      throw new Error('Acest cont e dezactivat');
    }
    currentAdmin = profile;
    enterDashboard();
  } catch (err) {
    loginError.textContent = err.message;
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Intra in cont';
  }
});

changePasswordBtn.addEventListener('click', async () => {
  await openModal({
    title: 'Schimba parola',
    bodyHtml: `
      <div class="field"><label>Parola noua</label><input id="cp-pass1" type="password" autocomplete="new-password" /></div>
      <div class="field"><label>Confirma parola noua</label><input id="cp-pass2" type="password" autocomplete="new-password" /></div>
      <div class="error-text" id="cp-error"></div>
    `,
    actions: [
      { label: 'Anuleaza', className: 'btn-outline' },
      {
        label: 'Salveaza',
        className: 'btn-primary',
        onClick: async (backdrop) => {
          const p1 = backdrop.querySelector('#cp-pass1').value;
          const p2 = backdrop.querySelector('#cp-pass2').value;
          const errEl = backdrop.querySelector('#cp-error');
          if (!p1) {
            errEl.textContent = 'Introdu parola noua.';
            return false;
          }
          if (p1 !== p2) {
            errEl.textContent = 'Parolele nu coincid.';
            return false;
          }
          const { error } = await supabase.auth.updateUser({ password: p1 });
          if (error) {
            errEl.textContent = error.message;
            return false;
          }
          showToast('Parola a fost schimbata.');
        },
      },
    ],
  });
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  currentAdmin = null;
  dashboard.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  loginForm.reset();
});

async function tryRestoreSession() {
  const { data } = await supabase.auth.getSession();
  const session = data?.session;
  if (!session) return;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, full_name, role, active')
    .eq('id', session.user.id)
    .single();
  if (profile && profile.role === 'admin' && profile.active) {
    currentAdmin = profile;
    enterDashboard();
  } else {
    await supabase.auth.signOut();
  }
}

function enterDashboard() {
  loginScreen.classList.add('hidden');
  dashboard.classList.remove('hidden');
  topbarUser.textContent = currentAdmin.full_name || currentAdmin.username;
  loadDrivers();
  loadVehicles();
  loadProducts();
}

// ---------- tabs ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
  });
});

// ---------- modal helper ----------
function openModal({ title, bodyHtml, onMount, actions }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-card">
        <h3 class="modal-title">${title}</h3>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-actions"></div>
      </div>`;
    const actionsHost = backdrop.querySelector('.modal-actions');
    actions.forEach((a) => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (a.className || 'btn-outline');
      btn.textContent = a.label;
      btn.addEventListener('click', async () => {
        if (a.onClick) {
          const result = await a.onClick(backdrop);
          if (result === false) return; // ramane deschis (ex: eroare de validare)
        }
        backdrop.remove();
        resolve(a.value !== undefined ? a.value : null);
      });
      actionsHost.appendChild(btn);
    });
    modalHost.appendChild(backdrop);
    if (onMount) onMount(backdrop);
  });
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ================= SOFERI =================
async function loadDrivers() {
  const tbody = document.getElementById('drivers-tbody');
  tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Se incarca...</td></tr>`;
  // RPC (POST) in loc de .from().select() (GET): unele CDN-uri cachuiesc
  // raspunsurile GET dupa URL, ignorand contul autentificat — un sofer nou
  // adaugat sau o dezactivare puteau ramane invizibile in tabel mult timp.
  // POST-ul unei functii RPC nu e cachuit, deci datele sunt mereu proaspete.
  const { data, error } = await supabase.rpc('list_drivers');
  if (error) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Eroare: ${esc(error.message)}</td></tr>`;
    return;
  }
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Niciun sofer adaugat inca.</td></tr>`;
    return;
  }
  tbody.innerHTML = data
    .map(
      (d) => `
    <tr data-id="${d.id}">
      <td data-label="Utilizator"><strong>${esc(d.username)}</strong></td>
      <td data-label="Nume">${esc(d.full_name)}</td>
      <td data-label="Masina">${esc(d.car_number || '-')}</td>
      <td data-label="Acces"><span class="badge ${d.active ? 'badge-active' : 'badge-inactive'}">${d.active ? 'Activ' : 'Dezactivat'}</span></td>
      <td data-label="Semnatura"><span class="badge ${d.signature_set ? 'badge-yes' : 'badge-no'}">${d.signature_set ? 'Setata' : 'Neseta'}</span></td>
      <td data-label="Actiuni">
        <div class="row-actions">
          <button class="btn btn-sm btn-outline" data-act="edit">Editeaza</button>
          <button class="btn btn-sm ${d.active ? 'btn-danger-outline' : 'btn-outline'}" data-act="toggle">${d.active ? 'Dezactiveaza' : 'Activeaza'}</button>
          <button class="btn btn-sm btn-outline" data-act="reset">Reset parola</button>
          <button class="btn btn-sm btn-danger-outline" data-act="delete">Sterge</button>
        </div>
      </td>
    </tr>`
    )
    .join('');

  tbody.querySelectorAll('tr').forEach((tr) => {
    const id = tr.dataset.id;
    const row = data.find((d) => d.id === id);
    tr.querySelector('[data-act="edit"]').addEventListener('click', () => editDriver(row));
    tr.querySelector('[data-act="toggle"]').addEventListener('click', () => toggleDriver(row));
    tr.querySelector('[data-act="reset"]').addEventListener('click', () => resetDriverPassword(row));
    tr.querySelector('[data-act="delete"]').addEventListener('click', () => deleteDriver(row));
  });
}

document.getElementById('add-driver-btn').addEventListener('click', async () => {
  await openModal({
    title: 'Adauga sofer',
    bodyHtml: `
      <div class="field"><label>Nume utilizator (login)</label><input id="m-username" placeholder="ex: ion.popescu" /></div>
      <div class="field"><label>Nume complet</label><input id="m-fullname" placeholder="Ion Popescu" /></div>
      <div class="field"><label>Numar masina (optional)</label><input id="m-car" placeholder="HR 28 ECC" /></div>
      <div class="field"><label>Parola initiala</label><input id="m-password" type="text" placeholder="minim 6 caractere" /></div>
      <div class="hint-text">Soferul se va loga cu acest nume de utilizator si parola. La prima intrare i se va cere sa-si seteze semnatura.</div>
      <div class="error-text" id="m-error"></div>
    `,
    actions: [
      { label: 'Anuleaza', className: 'btn-outline' },
      {
        label: 'Adauga',
        className: 'btn-primary',
        onClick: async (backdrop) => {
          const username = backdrop.querySelector('#m-username').value.trim();
          const full_name = backdrop.querySelector('#m-fullname').value.trim();
          const car_number = backdrop.querySelector('#m-car').value.trim();
          const password = backdrop.querySelector('#m-password').value;
          const errEl = backdrop.querySelector('#m-error');
          if (!username || !full_name || !password) {
            errEl.textContent = 'Completeaza utilizator, nume si parola.';
            return false;
          }
          if (password.length < 6) {
            errEl.textContent = 'Parola trebuie sa aiba minim 6 caractere.';
            return false;
          }
          try {
            await callAdminFn('create_driver', { username, password, full_name, car_number });
            showToast('Sofer adaugat.');
            loadDrivers();
          } catch (e) {
            errEl.textContent = e.message;
            return false;
          }
        },
      },
    ],
  });
});

async function editDriver(row) {
  await openModal({
    title: 'Editeaza sofer',
    bodyHtml: `
      <div class="field"><label>Nume utilizator (login)</label><input id="m-username" value="${esc(row.username)}" /></div>
      <div class="field"><label>Nume complet</label><input id="m-fullname" value="${esc(row.full_name)}" /></div>
      <div class="field"><label>CI — serie</label><input id="m-ci-serie" value="${esc(row.ci_serie || '')}" placeholder="ex: HR" /></div>
      <div class="field"><label>CI — numar</label><input id="m-ci-numar" value="${esc(row.ci_numar || '')}" placeholder="ex: 123456" /></div>
      <div class="field"><label>Numar contract</label><input id="m-contract" value="${esc(row.nr_contract || '')}" /></div>
      <div class="field"><label>Data angajarii</label><input id="m-angajare" type="text" inputmode="numeric" maxlength="10" placeholder="ZZ-LL-AAAA" value="${esc(isoToDmy(row.data_angajare))}" /></div>
      <div class="hint-text">Schimbarea numelui de utilizator schimba si datele de login ale soferului — anunta-l inainte.</div>
      <div class="error-text" id="m-error"></div>
    `,
    onMount: (backdrop) => attachDmyAutoformat(backdrop.querySelector('#m-angajare')),
    actions: [
      { label: 'Anuleaza', className: 'btn-outline' },
      {
        label: 'Salveaza',
        className: 'btn-primary',
        onClick: async (backdrop) => {
          const username = backdrop.querySelector('#m-username').value.trim();
          const full_name = backdrop.querySelector('#m-fullname').value.trim();
          const ci_serie = backdrop.querySelector('#m-ci-serie').value.trim();
          const ci_numar = backdrop.querySelector('#m-ci-numar').value.trim();
          const nr_contract = backdrop.querySelector('#m-contract').value.trim();
          const errEl = backdrop.querySelector('#m-error');
          if (!username || !full_name) {
            errEl.textContent = 'Utilizatorul si numele nu pot fi goale.';
            return false;
          }
          const angajareResult = dmyToIso(backdrop.querySelector('#m-angajare').value);
          if (angajareResult.error) {
            errEl.textContent = angajareResult.error;
            return false;
          }
          try {
            await callAdminFn('update_driver', {
              user_id: row.id,
              username: username !== row.username ? username : undefined,
              full_name,
              car_number: row.car_number || '',
              ci_serie,
              ci_numar,
              nr_contract,
              data_angajare: angajareResult.value,
            });
            showToast('Sofer actualizat.');
            loadDrivers();
          } catch (e) {
            errEl.textContent = e.message;
            return false;
          }
        },
      },
    ],
  });
}

async function toggleDriver(row) {
  const nextActive = !row.active;
  const label = nextActive ? 'activezi' : 'dezactivezi';
  await openModal({
    title: nextActive ? 'Activeaza soferul' : 'Dezactiveaza soferul',
    bodyHtml: `<p>Sigur vrei sa ${label} accesul lui <strong>${esc(row.full_name)}</strong>?</p><div class="error-text" id="m-error"></div>`,
    actions: [
      { label: 'Anuleaza', className: 'btn-outline' },
      {
        label: nextActive ? 'Activeaza' : 'Dezactiveaza',
        className: nextActive ? 'btn-primary' : 'btn-danger',
        onClick: async (backdrop) => {
          try {
            await callAdminFn('set_active', { user_id: row.id, active: nextActive });
            showToast(nextActive ? 'Sofer activat.' : 'Sofer dezactivat.');
            loadDrivers();
          } catch (e) {
            backdrop.querySelector('#m-error').textContent = e.message;
            return false;
          }
        },
      },
    ],
  });
}

async function resetDriverPassword(row) {
  await openModal({
    title: 'Reseteaza parola',
    bodyHtml: `
      <p>Parola noua pentru <strong>${esc(row.full_name)}</strong> (${esc(row.username)}):</p>
      <div class="field"><input id="m-password" type="text" placeholder="minim 6 caractere" /></div>
      <div class="error-text" id="m-error"></div>
    `,
    actions: [
      { label: 'Anuleaza', className: 'btn-outline' },
      {
        label: 'Reseteaza',
        className: 'btn-primary',
        onClick: async (backdrop) => {
          const password = backdrop.querySelector('#m-password').value;
          const errEl = backdrop.querySelector('#m-error');
          if (!password || password.length < 6) {
            errEl.textContent = 'Parola trebuie sa aiba minim 6 caractere.';
            return false;
          }
          try {
            await callAdminFn('reset_password', { user_id: row.id, password });
            showToast('Parola a fost resetata.');
          } catch (e) {
            errEl.textContent = e.message;
            return false;
          }
        },
      },
    ],
  });
}

async function deleteDriver(row) {
  await openModal({
    title: 'Sterge sofer',
    bodyHtml: `<p>Aceasta actiune e ireversibila. Stergi definitiv contul lui <strong>${esc(row.full_name)}</strong>?</p><div class="error-text" id="m-error"></div>`,
    actions: [
      { label: 'Anuleaza', className: 'btn-outline' },
      {
        label: 'Sterge definitiv',
        className: 'btn-danger',
        onClick: async (backdrop) => {
          try {
            await callAdminFn('delete_driver', { user_id: row.id });
            showToast('Sofer sters.');
            loadDrivers();
          } catch (e) {
            backdrop.querySelector('#m-error').textContent = e.message;
            return false;
          }
        },
      },
    ],
  });
}

// ================= MASINI =================
async function loadVehicles() {
  const tbody = document.getElementById('vehicles-tbody');
  tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Se incarca...</td></tr>`;
  // RPC (POST), nu GET — vezi comentariul din loadDrivers().
  const { data, error } = await supabase.rpc('list_vehicles');
  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Eroare: ${esc(error.message)}</td></tr>`;
    return;
  }
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Nicio masina adaugata inca.</td></tr>`;
    return;
  }
  tbody.innerHTML = data
    .map(
      (v) => `
    <tr data-id="${v.id}">
      <td data-label="Marca">${esc(v.brand)}</td>
      <td data-label="Numar">${esc(v.plate_number)}</td>
      <td data-label="Stare"><span class="badge ${v.active ? 'badge-active' : 'badge-inactive'}">${v.active ? 'Activa' : 'Inactiva'}</span></td>
      <td data-label="Actiuni">
        <div class="row-actions">
          <button class="btn btn-sm btn-outline" data-act="toggle">${v.active ? 'Dezactiveaza' : 'Activeaza'}</button>
          <button class="btn btn-sm btn-danger-outline" data-act="delete">Sterge</button>
        </div>
      </td>
    </tr>`
    )
    .join('');
  tbody.querySelectorAll('tr').forEach((tr) => {
    const id = tr.dataset.id;
    const row = data.find((v) => v.id === id);
    tr.querySelector('[data-act="toggle"]').addEventListener('click', async () => {
      const { error } = await supabase.from('vehicles').update({ active: !row.active }).eq('id', id);
      if (error) showToast(error.message, { danger: true });
      else loadVehicles();
    });
    tr.querySelector('[data-act="delete"]').addEventListener('click', async () => {
      await openModal({
        title: 'Sterge masina',
        bodyHtml: `<p>Stergi <strong>${esc(row.brand)} — ${esc(row.plate_number)}</strong>?</p>`,
        actions: [
          { label: 'Anuleaza', className: 'btn-outline' },
          {
            label: 'Sterge',
            className: 'btn-danger',
            onClick: async () => {
              const { error } = await supabase.from('vehicles').delete().eq('id', id);
              if (error) showToast(error.message, { danger: true });
              else { showToast('Masina stearsa.'); loadVehicles(); }
            },
          },
        ],
      });
    });
  });
}

document.getElementById('add-vehicle-btn').addEventListener('click', async () => {
  await openModal({
    title: 'Adauga masina',
    bodyHtml: `
      <div class="field"><label>Marca</label><input id="m-brand" placeholder="MERCEDES" /></div>
      <div class="field"><label>Numar inmatriculare</label><input id="m-plate" placeholder="HR 28 ECC" /></div>
      <div class="error-text" id="m-error"></div>
    `,
    actions: [
      { label: 'Anuleaza', className: 'btn-outline' },
      {
        label: 'Adauga',
        className: 'btn-primary',
        onClick: async (backdrop) => {
          const brand = backdrop.querySelector('#m-brand').value.trim();
          const plate_number = backdrop.querySelector('#m-plate').value.trim();
          const errEl = backdrop.querySelector('#m-error');
          if (!brand || !plate_number) {
            errEl.textContent = 'Completeaza marca si numarul.';
            return false;
          }
          const { error } = await supabase.from('vehicles').insert({ brand, plate_number });
          if (error) {
            errEl.textContent = error.message;
            return false;
          }
          showToast('Masina adaugata.');
          loadVehicles();
        },
      },
    ],
  });
});

// ================= PRODUSE =================
async function loadProducts() {
  const tbody = document.getElementById('products-tbody');
  tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Se incarca...</td></tr>`;
  // RPC (POST), nu GET — vezi comentariul din loadDrivers().
  const { data, error } = await supabase.rpc('list_products');
  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Eroare: ${esc(error.message)}</td></tr>`;
    return;
  }
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Niciun produs adaugat inca.</td></tr>`;
    return;
  }
  tbody.innerHTML = data
    .map(
      (p) => `
    <tr data-id="${p.id}">
      <td data-label="Model">${esc(p.model)}</td>
      <td data-label="Tip">${esc(p.type || '-')}</td>
      <td data-label="Stare"><span class="badge ${p.active ? 'badge-active' : 'badge-inactive'}">${p.active ? 'Activ' : 'Inactiv'}</span></td>
      <td data-label="Actiuni">
        <div class="row-actions">
          <button class="btn btn-sm btn-outline" data-act="toggle">${p.active ? 'Dezactiveaza' : 'Activeaza'}</button>
          <button class="btn btn-sm btn-danger-outline" data-act="delete">Sterge</button>
        </div>
      </td>
    </tr>`
    )
    .join('');
  tbody.querySelectorAll('tr').forEach((tr) => {
    const id = tr.dataset.id;
    const row = data.find((p) => p.id === id);
    tr.querySelector('[data-act="toggle"]').addEventListener('click', async () => {
      const { error } = await supabase.from('products').update({ active: !row.active }).eq('id', id);
      if (error) showToast(error.message, { danger: true });
      else loadProducts();
    });
    tr.querySelector('[data-act="delete"]').addEventListener('click', async () => {
      await openModal({
        title: 'Sterge produs',
        bodyHtml: `<p>Stergi <strong>${esc(row.model)} ${esc(row.type || '')}</strong>?</p>`,
        actions: [
          { label: 'Anuleaza', className: 'btn-outline' },
          {
            label: 'Sterge',
            className: 'btn-danger',
            onClick: async () => {
              const { error } = await supabase.from('products').delete().eq('id', id);
              if (error) showToast(error.message, { danger: true });
              else { showToast('Produs sters.'); loadProducts(); }
            },
          },
        ],
      });
    });
  });
}

document.getElementById('add-product-btn').addEventListener('click', async () => {
  await openModal({
    title: 'Adauga produs',
    bodyHtml: `
      <div class="field"><label>Model</label><input id="m-model" placeholder="ex: TOALETA" /></div>
      <div class="field"><label>Tip</label><input id="m-type" placeholder="ex: CLASIC" /></div>
      <div class="error-text" id="m-error"></div>
    `,
    actions: [
      { label: 'Anuleaza', className: 'btn-outline' },
      {
        label: 'Adauga',
        className: 'btn-primary',
        onClick: async (backdrop) => {
          const model = backdrop.querySelector('#m-model').value.trim().toUpperCase();
          const type = backdrop.querySelector('#m-type').value.trim().toUpperCase();
          const errEl = backdrop.querySelector('#m-error');
          if (!model) {
            errEl.textContent = 'Modelul e obligatoriu.';
            return false;
          }
          const { error } = await supabase.from('products').insert({ model, type: type || null });
          if (error) {
            errEl.textContent = error.message;
            return false;
          }
          showToast('Produs adaugat.');
          loadProducts();
        },
      },
    ],
  });
});

// ---------- start ----------
tryRestoreSession();
