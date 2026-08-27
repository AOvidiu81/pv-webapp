// photo-annotate.js — arde pe poza de confirmare un banner cu metadate
// (client, cantitate, produse, data/ora, GPS, adresa, sofer/auto, nr PV/AVZ),
// echivalent cu photo_annotation.dart (_annotatePhotoWithMetadataInBackground).

function wrapLine(line, maxChars) {
  const normalized = line.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];
  const words = normalized.split(' ');
  const wrapped = [];
  let current = '';
  for (let word of words) {
    while (word.length > maxChars) {
      if (current) {
        wrapped.push(current);
        current = '';
      }
      wrapped.push(word.substring(0, maxChars - 1) + '-');
      word = word.substring(maxChars - 1);
    }
    const probe = current ? `${current} ${word}` : word;
    if (probe.length <= maxChars) {
      current = probe;
    } else {
      if (current) wrapped.push(current);
      current = word;
    }
  }
  if (current) wrapped.push(current);
  return wrapped;
}

/**
 * @param {Blob} sourceBlob poza originala
 * @param {string[]} lines liniile de metadate
 * @param {string} depotName numele depozitului (titlu banner)
 * @param {HTMLImageElement|null} logoImg logo optional pentru banner
 * @returns {Promise<Blob>} poza adnotata (JPEG)
 */
export async function annotatePhotoWithMetadata(sourceBlob, lines, depotName, logoImg) {
  const img = await blobToImage(sourceBlob);
  const maxWidth = 1600;
  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  const width = Math.round(img.width * scale);
  const height = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const cleanLines = lines.map((l) => l.trim()).filter(Boolean);
  const margin = Math.min(24, Math.max(10, Math.round(width * 0.016)));
  const logoH = logoImg ? 40 : 0;
  const headerHeight = Math.min(90, Math.max(50, logoH + 16));
  const lineHeight = 22;
  const fontSize = 15;
  const titleFontSize = 20;

  ctx.font = `600 ${fontSize}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  const maxBannerWidth = width - 2 * margin;
  let maxCharsPerLine = 60;
  // estimam nr de caractere pe baza masuratorii medii a fontului
  const avgCharWidth = ctx.measureText('ABCDEFGHIJ0123456789').width / 21;
  maxCharsPerLine = Math.max(18, Math.min(120, Math.floor((maxBannerWidth - 24) / avgCharWidth)));

  const wrapped = [];
  cleanLines.forEach((line) => wrapped.push(...wrapLine(line, maxCharsPerLine)));

  const maxBannerHeight = height - 2 * margin;
  const maxContentLines = Math.max(1, Math.floor((maxBannerHeight - headerHeight - 18) / lineHeight));
  const visibleLines = wrapped.length > maxContentLines ? wrapped.slice(0, maxContentLines) : wrapped;
  if (wrapped.length > maxContentLines && visibleLines.length) {
    const idx = visibleLines.length - 1;
    if (visibleLines[idx].length > maxCharsPerLine - 3) {
      visibleLines[idx] = visibleLines[idx].substring(0, maxCharsPerLine - 3) + '...';
    } else {
      visibleLines[idx] += '...';
    }
  }

  const bannerHeight = headerHeight + 8 + visibleLines.length * lineHeight + 10;
  const bannerWidth = Math.min(maxBannerWidth, width - 2 * margin);
  const startX = margin;
  const startY = Math.max(0, height - bannerHeight - margin);

  ctx.fillStyle = 'rgba(0,0,0,0.66)';
  roundRect(ctx, startX, startY, bannerWidth, bannerHeight, 10);
  ctx.fill();

  let titleX = startX + 14;
  if (logoImg) {
    const logoW = (logoH / logoImg.height) * logoImg.width;
    ctx.drawImage(logoImg, startX + 10, startY + 8, logoW, logoH);
    titleX = startX + 10 + logoW + 14;
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${titleFontSize}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(depotName, titleX, startY + headerHeight / 2 + 4);

  ctx.font = `${fontSize}px -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
  let textY = startY + headerHeight + 8 + lineHeight / 2;
  for (const line of visibleLines) {
    ctx.fillText(line, startX + 12, textY);
    textY += lineHeight;
  }

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.87));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}
