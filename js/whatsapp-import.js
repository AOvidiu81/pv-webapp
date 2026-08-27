// whatsapp-import.js — import rapid al unei comenzi copiate din WhatsApp:
// extrage din textul liber (client, adresa, persoana de contact, contract,
// produs) si pre-completeaza formularul, tolerant la variatii de format
// (etichete cu/fara punct, cu/fara ":", ordine diferita).

import { el } from './utils.js';
import { openModal, textAreaField } from './components.js';

// WhatsApp foloseste *bold*, _italic_ si ~tăiat~ ca marcaje simple in jurul
// cuvintelor/frazelor — cand soferul copiaza un mesaj formatat (fie doar
// valoarea, fie linia intreaga, eticheta inclusiv: "*NUME CL*: *valoare*"),
// aceste caractere ajung altfel in campurile formularului (si pe documentul
// final). Datele procesate aici (nume, adrese, telefoane) nu contin
// niciodata legitim aceste caractere, asa ca le eliminam peste tot in linie,
// nu doar la capete — altfel o eticheta ingrosata integral tot ramane
// nerecunoscuta de regex-ul de etichete.
function stripWaFormatting(value) {
  return String(value || '')
    .replace(/[*_~]+/g, '')
    .trim();
}

function matchLabel(lines, labelPattern) {
  const re = new RegExp(`^\\s*(?:${labelPattern})\\s*\\.?\\s*:?\\s*[:\\-]?\\s*(.+)$`, 'i');
  for (const line of lines) {
    const m = re.exec(line);
    if (m && m[1] && m[1].trim()) return stripWaFormatting(m[1]);
  }
  return '';
}

/** Extrage campurile cunoscute dintr-un text liber de tip comanda WhatsApp.
 * Intoarce un obiect cu proprietati goale ("") pentru ce nu s-a gasit —
 * apelantul decide ce campuri suprascrie in formular. */
export function parseWhatsAppOrderText(rawText) {
  const lines = String(rawText || '')
    .split(/\r?\n/)
    .map((l) => stripWaFormatting(l))
    .filter(Boolean);

  const clientName = matchLabel(lines, 'NUME\\s*CL(?:IENT)?');
  const jud = matchLabel(lines, 'JUD(?:ET)?');
  const loc = matchLabel(lines, 'LOC(?:ALITATE)?');
  const str = matchLabel(lines, 'STR(?:ADA)?');
  const persRes = matchLabel(lines, 'PERS\\.?\\s*RES(?:PONSABILA)?|RESPONSABIL');
  const tel = matchLabel(lines, 'TEL(?:EFON)?');
  const ctr = matchLabel(lines, 'CTR|CONTRACT');
  const servisare = matchLabel(lines, 'SERVISARE');
  const dep = matchLabel(lines, 'DEP(?:OZIT)?');

  let productQty = 0;
  let productText = '';
  for (const line of lines) {
    const m = /^(\d{1,3})\s+([A-Za-zĂÂÎȘȚăâîșțŞŢ][A-Za-zĂÂÎȘȚăâîșțŞŢ0-9 \-]{2,60})$/.exec(line);
    if (m) {
      productQty = parseInt(m[1], 10);
      productText = stripWaFormatting(m[2]);
      break;
    }
  }

  return { clientName, jud, loc, str, persRes, tel, ctr, servisare, dep, productQty, productText };
}

/** Deschide un dialog cu o zona de text unde soferul lipeste mesajul de
 * WhatsApp; la confirmare intoarce campurile extrase (sau null la anulare). */
export async function openWhatsAppImportDialog() {
  const area = textAreaField({
    label: 'Lipeste aici textul comenzii din WhatsApp',
    rows: 10,
    placeholder: 'NUME CL: ...\nJUD. : ...\nLOC. : ...\nSTR ...\nPERS. RES. : ...\nTEL. : ...',
  });

  const pasteBtn = el(
    'button',
    {
      class: 'btn btn-text',
      style: 'padding-left:0',
      onclick: async () => {
        try {
          const clip = await navigator.clipboard.readText();
          if (clip && clip.trim()) {
            area.input.value = clip;
          }
        } catch (e) {
          // clipboard indisponibil / permisiune refuzata — soferul lipeste manual
        }
      },
    },
    ['📋 Lipeste din clipboard']
  );

  const hint = el('div', { class: 'hint-text', style: 'margin-top:2px' }, [
    'Completeaza dupa import ce lipseste — nu toate mesajele au acelasi format.',
  ]);

  const body = el('div', {}, [pasteBtn, area, hint]);

  const result = await openModal({
    title: '📋 Importa din WhatsApp',
    bodyNode: body,
    actions: [
      { label: 'Anuleaza', value: null },
      { label: 'Importa', value: 'import', primary: true },
    ],
  });

  if (result !== 'import') return null;
  const text = area.input.value;
  if (!text || !text.trim()) return null;
  return parseWhatsAppOrderText(text);
}
