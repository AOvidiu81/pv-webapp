// pdf-generate.js — genereaza un fisier PDF REAL, in browser, fara nicio
// librarie externa (nu avem acces la internet ca sa aducem jsPDF etc).
//
// Strategie:
//  1. Fiecare pagina a documentului (".doc-page", acelasi HTML folosit si la
//     print.css) e randata offscreen intr-un <img> care incarca un SVG cu
//     <foreignObject> continand acel HTML — un truc standard pentru "HTML la
//     imagine" fara librarie. Rezultatul e desenat pe un <canvas> si extras
//     ca JPEG.
//  2. Paginile JPEG sunt asamblate manual intr-un fisier PDF minimal (un
//     obiect /XObject /Image per pagina, fara fonturi/text — documentul e
//     deja "compus" vizual ca imagine), scris direct ca octeti conform
//     specificatiei PDF 1.4.
//
// Acest PDF poate fi apoi trimis direct din aplicatie (Web Share API) catre
// WhatsApp sau orice alta aplicatie de pe telefon — vezi shareOrDownloadPdf().

import { blobToDataUrl } from './utils.js';

const A4_PT = { w: 595.28, h: 841.89 }; // 210mm x 297mm, in puncte (1pt = 1/72in)

// ------------------------------------------------------------------
// Pasul 1: randare pagini HTML -> JPEG
// ------------------------------------------------------------------

let printCssCache = null;
async function getPrintCssText() {
  if (printCssCache) return printCssCache;
  const res = await fetch('css/print.css');
  printCssCache = await res.text();
  return printCssCache;
}

const inlineImageCache = new Map();
async function toDataUrlCached(src) {
  if (!src || src.startsWith('data:')) return src;
  if (inlineImageCache.has(src)) return inlineImageCache.get(src);
  const promise = fetch(src)
    .then((res) => res.blob())
    .then((blob) => blobToDataUrl(blob));
  inlineImageCache.set(src, promise);
  return promise;
}

/** Inlocuieste toate <img src="cale/relativa.png"> cu date URL, ca imaginile
 * sa fie vizibile in interiorul unui <foreignObject> incarcat printr-un SVG
 * data URL separat (unde caile relative nu se rezolva sigur). */
async function inlineImages(pageEl) {
  const imgs = Array.from(pageEl.querySelectorAll('img'));
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src') || '';
      if (!src || src.startsWith('data:')) return;
      try {
        img.setAttribute('src', await toDataUrlCached(src));
      } catch (e) {
        // lasam src-ul original; imaginea va lipsi din randare, dar restul paginii ramane ok
      }
    })
  );
}

const xmlSerializer = new XMLSerializer();

function rasterizePageToJpeg(pageEl, naturalWidth, naturalHeight, cssText, scale, quality) {
  return new Promise((resolve, reject) => {
    // IMPORTANT: .outerHTML produce HTML (ex: <img ...> fara "/>"), care nu e
    // XML valid si sparge parsarea SVG-ului de mai jos (foreignObject e in
    // interiorul unui document XML). XMLSerializer inchide corect toate
    // elementele goale ("<img .../>"), asa cum cere XML.
    const outerHtml = xmlSerializer.serializeToString(pageEl);
    const xml =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${naturalWidth}" height="${naturalHeight}">` +
      `<foreignObject width="100%" height="100%">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${naturalWidth}px;height:${naturalHeight}px;background:#ffffff;margin:0;padding:0;">` +
      `<style>${cssText}</style>${outerHtml}</div>` +
      `</foreignObject></svg>`;
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error('Randarea paginii a esuat (canvas.toBlob).'));
            return;
          }
          const buf = await blob.arrayBuffer();
          resolve({ bytes: new Uint8Array(buf), width: canvas.width, height: canvas.height });
        },
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('Randarea paginii a esuat (svg->imagine).'));
    img.src = svgUrl;
  });
}

/** Randeaza toate paginile ".doc-page" dintr-un fragment HTML de document ca
 * o lista de { bytes, width, height } JPEG. */
export async function renderDocPagesToJpegs(html, { scale = 1.6, quality = 0.85 } = {}) {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:-99999px;top:0;';
  host.innerHTML = html;
  document.body.appendChild(host);
  try {
    const pages = Array.from(host.querySelectorAll('.doc-page'));
    const cssText = await getPrintCssText();
    const results = [];
    for (const page of pages) {
      await inlineImages(page);
      const naturalWidth = page.offsetWidth;
      const naturalHeight = page.offsetHeight;
      results.push(await rasterizePageToJpeg(page, naturalWidth, naturalHeight, cssText, scale, quality));
    }
    return results;
  } finally {
    host.remove();
  }
}

// ------------------------------------------------------------------
// Pasul 2: scriere PDF minimal (imagine-per-pagina) din bytes JPEG
// ------------------------------------------------------------------

function concatBytes(parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function buildPdfFromJpegPages(jpegPages) {
  const encoder = new TextEncoder();
  const parts = [];
  const offsets = [];
  let running = 0;

  function push(bytesOrStr) {
    const bytes = typeof bytesOrStr === 'string' ? encoder.encode(bytesOrStr) : bytesOrStr;
    parts.push(bytes);
    running += bytes.length;
  }
  function beginObject(num) {
    offsets[num] = running;
    push(`${num} 0 obj\n`);
  }
  function endObject() {
    push('endobj\n');
  }

  const n = jpegPages.length;
  const pageObjNums = [];
  const imageObjNums = [];
  const contentObjNums = [];
  let nextNum = 3; // 1=Catalog, 2=Pages
  for (let i = 0; i < n; i++) {
    pageObjNums.push(nextNum++);
    imageObjNums.push(nextNum++);
    contentObjNums.push(nextNum++);
  }
  const totalObjects = nextNum - 1;

  push('%PDF-1.4\n');

  beginObject(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\n');
  endObject();

  beginObject(2);
  push(`<< /Type /Pages /Kids [${pageObjNums.map((p) => `${p} 0 R`).join(' ')}] /Count ${n} >>\n`);
  endObject();

  const w = A4_PT.w;
  const h = A4_PT.h;

  for (let i = 0; i < n; i++) {
    const { bytes: jpeg, width, height } = jpegPages[i];

    beginObject(pageObjNums[i]);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w.toFixed(2)} ${h.toFixed(2)}] ` +
        `/Resources << /XObject << /Im0 ${imageObjNums[i]} 0 R >> >> /Contents ${contentObjNums[i]} 0 R >>\n`
    );
    endObject();

    beginObject(imageObjNums[i]);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB ` +
        `/BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
    );
    push(jpeg);
    push('\nendstream\n');
    endObject();

    const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} 0 0 cm /Im0 Do Q`;
    beginObject(contentObjNums[i]);
    push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\n`);
    endObject();
  }

  const xrefOffset = running;
  push(`xref\n0 ${totalObjects + 1}\n`);
  push('0000000000 65535 f \n');
  for (let i = 1; i <= totalObjects; i++) {
    push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return concatBytes(parts);
}

// ------------------------------------------------------------------
// API principal
// ------------------------------------------------------------------

/** Genereaza documentul complet (toate paginile) ca Blob PDF. */
export async function generateDocumentPdfBlob(html, options) {
  const pages = await renderDocPagesToJpegs(html, options);
  if (!pages.length) throw new Error('Documentul nu are nicio pagina de randat.');
  const bytes = buildPdfFromJpegPages(pages);
  return new Blob([bytes], { type: 'application/pdf' });
}

/** Descarca direct PDF-ul (fara meniul de distribuire), cu numele exact dat —
 * cea mai sigura metoda de a garanta numele fisierului salvat: browserul
 * scrie chiar el fisierul in Descarcari, dupa atributul "download" al unui
 * link, fara sa treaca prin nicio alta aplicatie care ar putea sa-l redenumeasca. */
export function downloadPdf(blob, fileName) {
  const safeName = /\.pdf$/i.test(fileName) ? fileName : `${fileName}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return safeName;
}

/** Trimite PDF-ul prin meniul nativ de distribuire al telefonului (WhatsApp
 * apare acolo ca optiune), sau il descarca daca distribuirea nu e posibila.
 * NOTA: cand se alege din meniul de distribuire o optiune de tip "Salveaza in
 * Fisiere/Drive", unele combinatii de Android/Chrome pot ignora numele
 * fisierului nostru si ii pun un nume generat de sistem (ex: un UUID) — o
 * limitare a sistemului de operare, nu a aplicatiei. Pentru un nume garantat
 * corect la SALVARE, foloseste downloadPdf() de mai sus; shareOrDownloadPdf()
 * ramane util pentru TRIMITEREA rapida catre alta aplicatie (WhatsApp etc). */
export async function shareOrDownloadPdf(blob, fileName, { title, text } = {}) {
  const safeName = /\.pdf$/i.test(fileName) ? fileName : `${fileName}.pdf`;
  let file = null;
  try {
    file = new File([blob], safeName, { type: 'application/pdf' });
  } catch (e) {
    file = null;
  }

  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: title || safeName, text: text || '' });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
      // continuam cu descarcarea ca rezerva daca share esueaza dintr-un alt motiv
    }
  }

  downloadPdf(blob, safeName);
  return 'downloaded';
}
