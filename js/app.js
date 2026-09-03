// app.js — bootstrap-ul aplicatiei: verifica daca exista date de baza
// (sofer/auto/depozit), ruleaza wizard-ul de configurare daca e nevoie,
// apoi deschide ecranul principal. Inregistreaza si service worker-ul
// pentru functionare offline / instalare ca PWA.

import { el } from './utils.js';
import { DriverRepo, CarRepo, DepotRepo } from './db.js';
import { runSetupWizard } from './screens-setup.js';
import { openMainSelector } from './screens-home.js';
import { runLoginGate } from './screens-login.js';
import { getTodayBirthdays } from './auth.js';
import { openModal } from './components.js';

// Mesaj general de zi de nastere: NU e legat de soferul logat momentan —
// arata numele oricarui sofer activ a carui zi e chiar azi (data nasterii se
// seteaza doar din panoul de admin), vazut de ORICINE deschide aplicatia in
// acea zi. Fire-and-forget: nu blocheaza pornirea aplicatiei, iar fara
// internet getTodayBirthdays() intoarce pur si simplu o lista goala.
async function checkBirthdays() {
  const names = await getTodayBirthdays();
  if (!names.length) return;
  const message = names.length === 1 ? `La multi ani, ${names[0]}! 🎉` : `La multi ani, ${names.join(' si ')}! 🎉`;
  await openModal({
    title: '🎂 Zi de nastere',
    bodyNode: el('div', { style: 'text-align:center;font-size:16px;font-weight:700;padding:6px 0' }, [message]),
    actions: [{ label: 'Multumesc!', value: true, primary: true }],
  });
}

// Incercam sa blocam orientarea pe portret cat mai devreme posibil, in
// completarea "orientation" din manifest.json (care se aplica abia dupa ce
// Chrome regenereaza in fundal WebAPK-ul deja instalat pe telefon — poate
// dura si sa nu se intample instant dupa un update). Blocarea prin JS are
// efect imediat pe telefoanele unde e suportata. Ecranul de semnatura
// (captureSignatureScreen din components.js) NU depinde totusi de reusita
// acestui apel — chenarul ramane ingust/vertical prin CSS (vmin/vmax)
// indiferent de orientare, iar la salvare rotim intotdeauna neconditionat —
// asta e doar un bonus care evita reflow-ul intregii pagini cand soferul
// intoarce telefonul. Esueaza silentios acolo unde API-ul lipseste sau
// contextul nu permite blocarea (ex: nu ruleaza ca PWA instalata).
if (screen.orientation && screen.orientation.lock) {
  screen.orientation.lock('portrait').catch(() => {});
}

async function boot() {
  // Poarta de login: blocheaza pana la autentificare + (la prima utilizare)
  // setarea semnaturii. Sincronizeaza si profilul/masinile/produsele din
  // panoul de admin in baza de date locala, ca restul aplicatiei sa
  // functioneze neschimbat, inclusiv offline.
  await runLoginGate();

  // Nu asteptam acest apel — vezi comentariul de la checkBirthdays().
  checkBirthdays();

  const [drivers, cars, depots] = await Promise.all([DriverRepo.getAll(), CarRepo.getAll(), DepotRepo.getAll()]);
  if (!drivers.length || !cars.length || !depots.length) {
    // Sofer si masina vin acum din login/sincronizare — de regula doar
    // depozitul mai lipseste la prima rulare pe un telefon nou.
    await runSetupWizard();
  }
  await openMainSelector();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js')
      .then((reg) => {
        // Cerem activ o verificare de versiune noua la fiecare pornire —
        // un WebAPK Android instalat nu pare sa re-verifice sw.js la fel
        // de des ca un tab obisnuit de Chrome, asa ca soferul putea ramane
        // blocat pe o versiune veche mult timp fara asta.
        reg.update().catch(() => {});
      })
      .catch(() => {});
    // Cand un service worker nou preia controlul (dupa skipWaiting() +
    // clients.claim() din sw.js), pagina curenta ruleaza in continuare cu
    // codul vechi deja incarcat in memorie. Reincarcam o singura data ca sa
    // preluam automat tot codul nou, fara sa mai fie nevoie ca soferul sa
    // apese manual pe "Forteaza actualizarea" (utils.js) de fiecare data.
    let reloadedForUpdate = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadedForUpdate) return;
      reloadedForUpdate = true;
      location.reload();
    });
  });
}

boot();
