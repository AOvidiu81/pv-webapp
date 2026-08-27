# PV Euro Ecologic — WebApp (PWA)

Recreare a fluxului principal de Procese Verbale din aplicația Flutter
(`pv_euro_ecologic_v2`) ca aplicație web instalabilă (PWA), în HTML/CSS/JS
simplu, fără framework și fără dependențe externe — funcționează 100% offline
după prima încărcare.

## Ce este inclus (faza 1 — MVP)

- Configurare inițială: șoferi, mașini, depozite (stocate local, pe telefon).
- Selector sofer / auto / depozit → alegere tip P.V. (AMPLASARE, RIDICARE,
  SERVISARE, LIPSA ACCES, VANZARE).
- Formularul complet de proces verbal: date client/beneficiar, catalog de
  produse (model/tip/serii/elemente auxiliare), secțiune financiară pentru
  VANZARE, observații, poartă GPS + poză de confirmare (cu banner de metadate
  ars pe poză), semnătura beneficiarului (canvas).
- Generare document: Proces Verbal + Aviz de însoțire (când e cazul) + anexe
  foto, cu conținutul legal păstrat identic cu aplicația Flutter, dar cu un
  aspect vizual nou, mai premium.
- Numerotare automată PV / Aviz (contoare persistente, ca în aplicația veche).
- Istoric documente: redeschidere și retipărire a oricărui PV salvat.
- Instalabilă pe Android ca aplicație (Add to Home Screen) și funcțională
  offline (service worker).

## Ce NU este inclus încă (rămâne pentru o etapă viitoare)

- Modulul „Cereri / Documente" (concediu, demisie, învoire) — buton prezent,
  dar dezactivat.
- Ecran de gestiune a catalogului de produse (momentan se editează direct în
  `js/catalog-defaults.js`).
- Istoric locații client / hartă.
- Import text din WhatsApp.
- Depozite de colaborare, parolă de depozit.
- Sincronizare/cont — datele rămân locale pe fiecare telefon (ai ales această
  variantă în locul unei baze de date centralizate).

## Cum genereză „PDF"-ul

Nu am putut aduce o librărie PDF (jsPDF etc.) pentru că acest mediu de lucru
nu are acces la internet. În loc de asta, am folosit funcția nativă de
printare a browserului: la Preview / Salvare se deschide dialogul de
printare din Chrome, unde alegi „Salvează ca PDF". Este de fapt o soluție mai
robustă pentru o aplicație 100% offline decât o librărie externă — și permite
un aspect vizual mult mai elaborat (tabele, tipografie) decât API-ul de
desenat al unei librării PDF.

## Cum o testezi local pe calculator

Ai nevoie de un mic server local (nu poți deschide `index.html` direct cu
dublu-click, din cauza modulelor JS și a service worker-ului). Cel mai simplu,
din acest folder:

```
npx serve .
```

sau, dacă ai Python instalat:

```
python -m http.server 8080
```

apoi deschizi `http://localhost:8080` în Chrome.

## Cum o instalezi pe telefonul Android (pas următor)

Un PWA poate fi instalat („Add to Home Screen") și poate funcționa offline
doar dacă este servit prin HTTPS (sau `localhost`). Cel mai simplu mod, gratuit:

1. Creezi un cont pe [Netlify](https://app.netlify.com) (sau GitHub Pages,
   Vercel — oricare merge).
2. Tragi acest folder întreg (`PV-WEBAPP`) în Netlify Drop
   (https://app.netlify.com/drop) — primești un link `https://ceva.netlify.app`.
3. Deschizi acel link pe telefonul Android, în Chrome → meniul „⋮" →
   „Adaugă pe ecranul de start" (sau apare automat un banner de instalare).

Spune-mi când ești gata pentru acest pas și te ajut să alegi și să configurezi
o găzduire — sau, dacă preferi, putem încerca alt mod de hosting.

## Structura proiectului

```
index.html          — pagina principală (shell-ul aplicației)
manifest.json        — configurare PWA (nume, icoane, culori)
sw.js                — service worker (cache offline)
css/styles.css        — interfața aplicației
css/print.css         — aspectul documentului generat (PV/Aviz/Anexe foto)
js/db.js              — persistență locală (IndexedDB)
js/app.js              — pornirea aplicației
js/screens-*.js        — ecranele aplicației
js/pdf-print.js         — construirea documentului + previzualizare + print
js/photo-annotate.js     — banner cu metadate ars pe poza de confirmare
js/catalog-defaults.js    — catalogul de produse implicit + info companie
assets/, icons/          — logo, imagini document, iconițe PWA
```

## Date implicite

Depozitul „HUNEDOARA" este pre-completat cu datele tale, ca în aplicația
veche. Șoferii și mașinile nu sunt pre-completate — le adaugi din Setări
(⚙ din ecranul principal) sau la prima pornire.
