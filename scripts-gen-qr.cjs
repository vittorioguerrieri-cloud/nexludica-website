const QR = require('qrcode');
const fs = require('fs');
const path = require('path');

const CYAN = '#05abc4';
const MS = 10;
const PADDING = 4;

const targets = [
  { slug: 'marco-monteverde',    name: 'Marco Monteverde' },
  { slug: 'simone-glogowschek',  name: 'Simone Glogowschek' },
  { slug: 'gregorio-alfano',     name: 'Gregorio Alfano' },
  { slug: 'vittorio-guerrieri',  name: 'Vittorio Guerrieri' },
  { slug: 'letizia-vaccarella',  name: 'Letizia Vaccarella' },
];

function inFinder(row, col, size) {
  if (row < 7 && col < 7) return true;
  if (row < 7 && col >= size - 7) return true;
  if (row >= size - 7 && col < 7) return true;
  return false;
}

function renderFinder(x, y) {
  // 7×7 finder: outer rounded "frame" + central dot
  // Outer: rounded square 7×7 modules with 5×5 "hole" (evenodd fill)
  const r = MS * 0.9; // outer corner radius
  const ri = MS * 0.4; // inner hole corner radius
  const outerW = 7 * MS;
  const innerInset = MS;
  const innerW = 5 * MS;
  // Path: outer rounded rect (clockwise) + inner rounded rect (counter-clockwise) for even-odd hole
  const outer = `M${x + r} ${y} L${x + outerW - r} ${y} A${r} ${r} 0 0 1 ${x + outerW} ${y + r} L${x + outerW} ${y + outerW - r} A${r} ${r} 0 0 1 ${x + outerW - r} ${y + outerW} L${x + r} ${y + outerW} A${r} ${r} 0 0 1 ${x} ${y + outerW - r} L${x} ${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`;
  const ix = x + innerInset, iy = y + innerInset;
  const hole = `M${ix + ri} ${iy} L${ix + innerW - ri} ${iy} A${ri} ${ri} 0 0 1 ${ix + innerW} ${iy + ri} L${ix + innerW} ${iy + innerW - ri} A${ri} ${ri} 0 0 1 ${ix + innerW - ri} ${iy + innerW} L${ix + ri} ${iy + innerW} A${ri} ${ri} 0 0 1 ${ix} ${iy + innerW - ri} L${ix} ${iy + ri} A${ri} ${ri} 0 0 1 ${ix + ri} ${iy} Z`;
  // Inner solid 3×3 as circle
  const dotR = MS * 1.5;
  const cx = x + 3.5 * MS, cy = y + 3.5 * MS;
  return `<path d="${outer} ${hole}" fill="${CYAN}" fill-rule="evenodd"/>` +
         `<circle cx="${cx}" cy="${cy}" r="${dotR}" fill="${CYAN}"/>`;
}

function generate(text) {
  const qr = QR.create(text, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;
  const totalSize = (size + PADDING * 2) * MS;
  const offset = PADDING * MS;

  let body = '';
  // 3 finder corners
  body += renderFinder(offset, offset);
  body += renderFinder(offset + (size - 7) * MS, offset);
  body += renderFinder(offset, offset + (size - 7) * MS);

  // Data modules → circoletti
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (inFinder(r, c, size)) continue;
      const filled = qr.modules.get(r, c);
      if (filled) {
        const cx = offset + c * MS + MS * 0.5;
        const cy = offset + r * MS + MS * 0.5;
        body += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(MS * 0.42).toFixed(2)}" fill="${CYAN}"/>`;
      }
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="512" height="512" shape-rendering="geometricPrecision">${body}</svg>`;
}

const outDir = path.join(__dirname, '..', 'public', 'qr');
fs.mkdirSync(outDir, { recursive: true });
for (const t of targets) {
  const url = `https://nexludica.org/chi-siamo/${t.slug}`;
  const svg = generate(url);
  const out = path.join(outDir, `${t.slug}.svg`);
  fs.writeFileSync(out, svg);
  console.log(`✓ ${t.name.padEnd(22)} → ${out} (${(svg.length / 1024).toFixed(1)} KB)`);
}
