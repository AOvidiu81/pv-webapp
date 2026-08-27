// screens-login.js — poarta de autentificare a aplicatiei: login cu user +
// parola (contul e creat de administrator din panoul separat de admin),
// urmat la prima utilizare de setarea obligatorie a semnaturii proprii.
// Dupa asta, restul aplicatiei functioneaza neschimbat (si offline).

import { el, blobToDataUrl } from './utils.js';
import { replaceRoot } from './router.js';
import { textField, primaryButton, showToast, captureSignature } from './components.js';
import { getCurrentProfile, signIn, signOut, saveOwnSignature, syncMasterData } from './auth.js';

/** Blocheaza pornirea aplicatiei pana cand exista un profil autentificat,
 * activ si cu semnatura setata. Intoarce acel profil. */
export async function runLoginGate() {
  let profile = await getCurrentProfile();

  if (!profile || !profile.active) {
    profile = await runLoginScreen();
  }

  if (!profile.signature_set) {
    profile = await runSignatureSetup(profile);
  }

  await syncMasterData(profile);
  return profile;
}

function runLoginScreen() {
  return new Promise((resolve) => {
    replaceRoot(() => {
      const screen = el('div', { class: 'screen' });
      const logo = el('img', { class: 'brand-logo', src: 'assets/logo/euro_ecologic_logo.png', alt: 'Euro Ecologic' });

      const userField = textField({ label: 'Utilizator', required: true });
      const passField = textField({ label: 'Parola', type: 'password', required: true });
      const errorBox = el('div', { style: 'color:var(--danger);font-size:13px;text-align:center;min-height:18px;margin-top:2px' }, []);

      const loginBtn = primaryButton('Intra in cont', async () => {
        const username = userField.input.value.trim();
        const password = passField.input.value;
        errorBox.textContent = '';
        if (!username || !password) {
          errorBox.textContent = 'Completeaza utilizatorul si parola.';
          return;
        }
        loginBtn.disabled = true;
        loginBtn.textContent = 'Se autentifica...';
        const result = await signIn(username, password);
        loginBtn.disabled = false;
        loginBtn.textContent = 'Intra in cont';
        if (result.error) {
          errorBox.textContent = result.error;
          return;
        }
        resolve(result.profile);
      });
      passField.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') loginBtn.click();
      });

      const card = el('div', { class: 'section-card' }, [
        el('h3', { class: 'section-title', style: 'text-align:center' }, ['Autentificare']),
        el('div', { style: 'text-align:center;color:var(--ink-soft);font-size:13px;margin-bottom:14px' }, [
          'Foloseste utilizatorul si parola primite de la administrator.',
        ]),
        userField,
        passField,
        errorBox,
        el('div', { style: 'height:4px' }),
        loginBtn,
      ]);

      const scroll = el('div', { class: 'screen-scroll', style: 'display:flex;flex-direction:column;justify-content:center;min-height:100%' }, [logo, card]);
      screen.appendChild(scroll);
      return screen;
    });
  });
}

function runSignatureSetup(profile) {
  return new Promise((resolve) => {
    replaceRoot(() => {
      const screen = el('div', { class: 'screen' });
      const card = el('div', { class: 'section-card' }, [
        el('h3', { class: 'section-title' }, [`Bine ai venit, ${profile.full_name || profile.username}!`]),
        el('div', { style: 'color:var(--ink-soft);font-size:13.5px;margin-bottom:16px' }, [
          'Inainte sa incepi, seteaza-ti semnatura — va aparea automat pe fiecare Proces Verbal pe care il generezi de acum inainte.',
        ]),
      ]);
      const sigBtn = primaryButton('✍️ Seteaza semnatura', async () => {
        const blob = await captureSignature({ title: 'Semnatura ta' });
        if (!blob) return;
        sigBtn.disabled = true;
        sigBtn.textContent = 'Se salveaza...';
        try {
          const dataUrl = await blobToDataUrl(blob);
          const updated = await saveOwnSignature(dataUrl);
          showToast('Semnatura salvata.');
          resolve(updated || { ...profile, signature_url: dataUrl, signature_set: true });
        } catch (e) {
          showToast('Nu am putut salva semnatura: ' + e.message, { danger: true });
          sigBtn.disabled = false;
          sigBtn.textContent = '✍️ Seteaza semnatura';
        }
      });

      const logoutLink = el(
        'button',
        {
          class: 'btn btn-text',
          style: 'display:block;margin:14px auto 0',
          onclick: async () => {
            await signOut();
            location.reload();
          },
        },
        ['Deconectare']
      );

      const scroll = el('div', { class: 'screen-scroll' }, [card, sigBtn, logoutLink]);
      screen.appendChild(scroll);
      return screen;
    });
  });
}
