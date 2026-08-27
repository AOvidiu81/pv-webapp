// app.js — bootstrap-ul aplicatiei: verifica daca exista date de baza
// (sofer/auto/depozit), ruleaza wizard-ul de configurare daca e nevoie,
// apoi deschide ecranul principal. Inregistreaza si service worker-ul
// pentru functionare offline / instalare ca PWA.

import { DriverRepo, CarRepo, DepotRepo } from './db.js';
import { runSetupWizard } from './screens-setup.js';
import { openMainSelector } from './screens-home.js';
import { runLoginGate } from './screens-login.js';

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
