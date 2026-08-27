// app.js — bootstrap-ul aplicatiei: verifica daca exista date de baza
// (sofer/auto/depozit), ruleaza wizard-ul de configurare daca e nevoie,
// apoi deschide ecranul principal. Inregistreaza si service worker-ul
// pentru functionare offline / instalare ca PWA.

import { DriverRepo, CarRepo, DepotRepo } from './db.js';
import { runSetupWizard } from './screens-setup.js';
import { openMainSelector } from './screens-home.js';

async function boot() {
  const [drivers, cars, depots] = await Promise.all([DriverRepo.getAll(), CarRepo.getAll(), DepotRepo.getAll()]);
  if (!drivers.length || !cars.length || !depots.length) {
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
