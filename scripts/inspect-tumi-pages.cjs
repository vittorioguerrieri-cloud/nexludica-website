const fs = require("fs");
const path = require("path");
const os = require("os");

const raw = fs.readFileSync(path.join(os.tmpdir(), "tumi_v8_raw.json"), "utf-8").replace(/^﻿/, "");
// Extract JSON array from wrangler output (skip non-JSON header lines)
const jsonStart = raw.indexOf("[");
const jsonStr = raw.slice(jsonStart);
const wranglerOut = JSON.parse(jsonStr);
const schema = JSON.parse(wranglerOut[0].results[0].schema_json);

console.log(`Total pages: ${schema.pages.length}\n`);
schema.pages.forEach((p, i) => {
  const elNames = (p.elements || []).map(e => e.name).join(", ");
  console.log(`[${i}] "${p.name}" — title: "${p.title || "(none)"}"`);
  console.log(`    elements (${(p.elements || []).length}): ${elNames}`);
  // Show element types
  (p.elements || []).forEach(e => {
    const extra = e.type === "matrix" ? ` (${(e.rows||[]).length} rows)` : "";
    console.log(`      - ${e.name}: ${e.type}${extra}`);
  });
  console.log();
});
