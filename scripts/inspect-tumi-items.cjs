const fs = require("fs");
const path = require("path");
const os = require("os");

const raw = fs.readFileSync(path.join(os.tmpdir(), "tumi_v8_raw.json"), "utf-8").replace(/^﻿/, "");
const arr = JSON.parse(raw.slice(raw.indexOf("[")));
const schema = JSON.parse(arr[0].results[0].schema_json);

// Show bg_proxy details
for (const page of schema.pages) {
  for (const el of page.elements || []) {
    if (el.name === "bg_proxy") {
      console.log("=== bg_proxy (player_profile page) ===");
      console.log("Title:", el.title);
      console.log("Columns:");
      (el.columns || []).forEach(c => {
        const val = typeof c === "object" ? c.value : c;
        const txt = typeof c === "object" ? c.text : c;
        console.log(`  ${val}: "${txt}"`);
      });
      console.log("\nRows:");
      (el.rows || []).forEach(r => {
        const val = typeof r === "object" ? r.value : r;
        const txt = typeof r === "object" ? (r.text || r.value) : r;
        const req = typeof r === "object" ? r.required : false;
        console.log(`  ${val}: "${txt}" (required: ${req})`);
      });
    }
  }
}

// Show ALL unique item codes with their text labels
console.log("\n=== ALL TUMI item codes ===");
for (const page of schema.pages) {
  for (const el of page.elements || []) {
    if (el.type === "matrix" && el.name.startsWith("tumi_matrix_")) {
      console.log(`\n--- ${el.name} (${page.name}) ---`);
      console.log("Title:", el.title);
      console.log("Columns:");
      (el.columns || []).forEach(c => {
        const val = typeof c === "object" ? c.value : c;
        const txt = typeof c === "object" ? c.text : c;
        console.log(`  ${val}: "${txt}"`);
      });
      console.log("Rows (first 5):");
      (el.rows || []).slice(0, 5).forEach(r => {
        const val = typeof r === "object" ? r.value : r;
        const txt = typeof r === "object" ? (r.text || r.value) : r;
        console.log(`  ${val}: "${txt}"`);
      });
      console.log(`  ... (${(el.rows || []).length} total)`);
    }
  }
}

// Find bogus items - items with "bogus" or known bogus codes
console.log("\n=== Looking for bogus item patterns ===");
const allItems = [];
for (const page of schema.pages) {
  for (const el of page.elements || []) {
    if (el.type === "matrix") {
      (el.rows || []).forEach(r => {
        const val = typeof r === "object" ? r.value : r;
        const txt = typeof r === "object" ? (r.text || r.value) : r;
        allItems.push({ matrix: el.name, code: val, text: txt });
      });
    }
  }
}

// Print items with codes starting with BG or bg_
const bgItems = allItems.filter(i => i.code.toLowerCase().startsWith("bg"));
console.log("Items with 'bg' prefix:");
bgItems.forEach(i => console.log(`  [${i.matrix}] ${i.code}: "${i.text}"`));

// Print items with codes containing "bogus" or "check" or "trap"
const suspectItems = allItems.filter(i =>
  /bogus|check|trap|attn|screen/i.test(i.code) || /bogus|check|trap|attn|screen/i.test(i.text)
);
console.log("\nItems with bogus/check/trap/attn/screen:");
suspectItems.forEach(i => console.log(`  [${i.matrix}] ${i.code}: "${i.text}"`));

// Print all unique 2-letter prefixes and counts
const prefixes = {};
allItems.forEach(i => {
  const p = i.code.replace(/\d+$/, '');
  prefixes[p] = (prefixes[p] || 0) + 1;
});
console.log("\nItem code prefixes:");
Object.entries(prefixes).sort((a,b) => b[1]-a[1]).forEach(([p, n]) => {
  console.log(`  ${p}: ${n} items`);
});
