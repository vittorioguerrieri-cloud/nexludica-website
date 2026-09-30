/**
 * Genera versioni ottimizzate del logo "NexLudica - Game | Research | Equity"
 * a partire dalla PNG originale (199KB).
 *
 * Output:
 *   - logo-horizontal-equity.png       (per header sito, ~30-50KB, 480px)
 *   - logo-horizontal-equity@2x.png    (retina, ~60-80KB, 960px)
 *   - logo-equity-tagline.png          (OG image, replace col file resized, ~80KB, 1200px)
 *   - logo-pdf.png                      (per embedding PDF, ~20KB, 360px)
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SRC = path.join(__dirname, "..", "public", "images", "branding", "logo-equity-tagline.png");
const OUT_DIR = path.join(__dirname, "..", "public", "images", "branding");

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source not found: ${SRC}`);
    process.exit(1);
  }
  const meta = await sharp(SRC).metadata();
  console.log(`Source: ${SRC} ${meta.width}×${meta.height} ${(fs.statSync(SRC).size / 1024).toFixed(1)}KB`);

  const targets = [
    { name: "logo-horizontal-equity.png",    width: 480,  q: 90 },
    { name: "logo-horizontal-equity@2x.png", width: 960,  q: 88 },
    { name: "logo-pdf.png",                  width: 360,  q: 85 },
    // og:image: 1200px è size canonical OG; sostituisce il file sorgente
    // se più piccolo dell'originale lo compatta
    { name: "logo-equity-og.png",            width: 1200, q: 88 },
  ];

  for (const t of targets) {
    const outPath = path.join(OUT_DIR, t.name);
    await sharp(SRC)
      .resize({ width: t.width, withoutEnlargement: false })
      .png({ quality: t.q, compressionLevel: 9, adaptiveFiltering: true, palette: false })
      .toFile(outPath);
    const sz = (fs.statSync(outPath).size / 1024).toFixed(1);
    console.log(`  ✓ ${t.name.padEnd(36)} ${t.width.toString().padStart(4)}px  ${sz.padStart(6)}KB`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
