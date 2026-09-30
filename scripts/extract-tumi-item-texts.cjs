/**
 * Extract all TUMI item codes + texts from the schema.
 * Outputs analysis/tumi_item_texts.json
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const schemaRaw = fs.readFileSync(path.join(os.tmpdir(), "tumi_schema_v9.json"), "utf-8").replace(/^﻿/, "");
const schemaArr = JSON.parse(schemaRaw.slice(schemaRaw.indexOf("[")));
const schema = JSON.parse(schemaArr[0].results[0].schema_json);

const items = {};

for (const page of schema.pages) {
  for (const el of page.elements || []) {
    if (el.type === "matrix") {
      for (const r of el.rows || []) {
        const code = typeof r === "object" ? r.value : r;
        const text = typeof r === "object" ? (r.text || r.value) : r;
        items[code] = text;
      }
    }
  }
}

// Sort by code
const sorted = Object.entries(items).sort((a, b) => {
  const pa = a[0].replace(/\d+$/, "");
  const pb = b[0].replace(/\d+$/, "");
  if (pa !== pb) return pa.localeCompare(pb);
  const na = parseInt(a[0].replace(/\D/g, "")) || 0;
  const nb = parseInt(b[0].replace(/\D/g, "")) || 0;
  return na - nb;
});

const outDir = path.join(__dirname, "..", "analysis");
fs.writeFileSync(
  path.join(outDir, "tumi_item_texts.json"),
  JSON.stringify(Object.fromEntries(sorted), null, 2),
  "utf-8"
);

console.log(`Extracted ${sorted.length} item texts.`);
console.log("Sample:");
for (const [code, text] of sorted.slice(0, 5)) {
  console.log(`  ${code}: ${text.substring(0, 80)}`);
}
