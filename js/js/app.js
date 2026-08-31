// app.js — bootstrap-ul aplicatiei: verifica daca exista date de baza
// (sofer/auto/depozit), ruleaza wizard-ul de configurare daca e nevoie,
// apoi deschide ecranul principal. Inregistreaza si service worker-ul
// pentru functionare offline / instalare ca PWA.

import { DriverRepo, CarRepo, DepotRepo } from './db.js';
import { runSetupWizard } from './screens-setup.js';
import { openMainSelector } from './screens-home.js';
import { runLoginGate } from './screens-login.js';

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
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

boot();
