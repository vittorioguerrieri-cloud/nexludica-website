const fs = require("fs");
const path = require("path");
const os = require("os");

const raw = fs.readFileSync(path.join(os.tmpdir(), "tumi_v8_raw.json"), "utf-8").replace(/^﻿/, "");
const arr = JSON.parse(raw.slice(raw.indexOf("[")));
const schema = JSON.parse(arr[0].results[0].schema_json);

const items = [];
for (const page of schema.pages) {
  for (const el of page.elements || []) {
    if (el.type === "matrix") {
      for (const r of el.rows || []) {
        const code = typeof r === "object" ? r.value : r;
        const text = typeof r === "object" ? (r.text || r.value) : r;
        items.push({ code, text, matrix: el.name });
      }
    }
  }
}

// Group by prefix
const byPrefix = {};
for (const it of items) {
  const prefix = it.code.replace(/\d+$/, "");
  if (!byPrefix[prefix]) byPrefix[prefix] = [];
  byPrefix[prefix].push(it);
}

// Output as JSON for R
const constructs = Object.entries(byPrefix)
  .filter(([p]) => !p.startsWith("bg"))
  .sort((a, b) => b[1].length - a[1].length)
  .map(([prefix, its]) => ({
    prefix,
    n: its.length,
    codes: its.map(i => i.code),
    sample_texts: its.slice(0, 3).map(i => i.text)
  }));

const outDir = path.join(__dirname, "..", "analysis");
fs.writeFileSync(path.join(outDir, "tumi_constructs.json"), JSON.stringify(constructs, null, 2), "utf-8");

console.log("Theoretical constructs (by item prefix):\n");
for (const c of constructs) {
  console.log(`  ${c.prefix} (${c.n} items): ${c.sample_texts[0].substring(0, 60)}...`);
}
console.log(`\nTotal: ${constructs.length} constructs, ${constructs.reduce((s, c) => s + c.n, 0)} substantive items`);
