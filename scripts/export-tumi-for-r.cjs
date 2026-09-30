/**
 * Exports TUMI response data to CSV files for R analysis.
 * Handles cross-participant shuffle: each participant may have different
 * items in each matrix, so we collect ALL tumi item responses from ALL
 * matrices per participant.
 *
 * Produces:
 *   - tumi_responses.csv: wide format, one row per participant, one col per item
 *   - tumi_meta.csv: participant metadata
 *   - tumi_long.csv: long format (participant × item × value) for R analysis
 *   - tumi_schema_info.json: schema metadata
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

// --- Load responses ---
const respRaw = fs.readFileSync(path.join(os.tmpdir(), "tumi_responses_raw.json"), "utf-8").replace(/^﻿/, "");
const respArr = JSON.parse(respRaw.slice(respRaw.indexOf("[")));
const responses = respArr[0].results;

// --- Load schema ---
const schemaRaw = fs.readFileSync(path.join(os.tmpdir(), "tumi_schema_v9.json"), "utf-8").replace(/^﻿/, "");
const schemaArr = JSON.parse(schemaRaw.slice(schemaRaw.indexOf("[")));
const schema = JSON.parse(schemaArr[0].results[0].schema_json);

// --- Collect ALL unique TUMI item codes across all participants ---
const allItemCodes = new Set();
const participantData = [];

for (const resp of responses) {
  const payload = JSON.parse(resp.payload_json);
  const pid = payload.prolific_pid || resp.completion_code || resp.id.slice(0, 8);

  // Collect TUMI responses from all matrices
  const items = {};
  for (const key of Object.keys(payload)) {
    if (key.startsWith("tumi_matrix_") && typeof payload[key] === "object") {
      for (const [itemCode, value] of Object.entries(payload[key])) {
        items[itemCode] = Number(value); // scale values are already 1-7
        allItemCodes.add(itemCode);
      }
    }
  }

  // bg_proxy
  const bgProxy = payload.bg_proxy || {};
  const bgItems = {};
  for (const [k, v] of Object.entries(bgProxy)) {
    bgItems[k] = Number(v);
  }

  // Randomization meta
  const randMeta = payload._randomization_meta || null;

  participantData.push({
    pid,
    completionCode: resp.completion_code,
    prolificPid: payload.prolific_pid || "",
    prolificStudyId: payload.prolific_study_id || "",
    prolificSessionId: payload.prolific_session_id || "",
    createdAt: resp.created_at,
    bgLiking: payload.bg_liking || "",
    bgExpertise: payload.bg_expertise || "",
    bgItems,
    tumiItems: items,
    nAnswered: Object.keys(items).length,
    randSeed: payload._randomization_seed || "",
    randMeta,
    consentAge: payload.consent_age,
    consentData: payload.consent_data,
  });
}

// Sort item codes for consistent column ordering
const sortedItems = [...allItemCodes].sort((a, b) => {
  // Natural sort: tumi_01 < tumi_02 < ... < tumi_254
  const na = parseInt(a.replace(/\D/g, "")) || 0;
  const nb = parseInt(b.replace(/\D/g, "")) || 0;
  return na - nb || a.localeCompare(b);
});

// Filter: only Prolific participants (exclude test/preview)
const allCount = participantData.length;
const filtered = participantData.filter(p =>
  p.prolificPid && !p.prolificPid.includes("{") && p.prolificPid.length > 5
);
participantData.length = 0;
participantData.push(...filtered);

console.log(`Total responses: ${allCount} — Prolific only: ${participantData.length} (excluded ${allCount - filtered.length} test/preview)`);
console.log(`Unique TUMI item codes: ${sortedItems.length}`);
console.log(`Item code sample: ${sortedItems.slice(0, 5).join(", ")} ... ${sortedItems.slice(-3).join(", ")}`);

// --- Schema info: extract column labels ---
let columnLabels = [];
for (const page of schema.pages) {
  for (const el of page.elements || []) {
    if (el.type === "matrix" && el.name.startsWith("tumi_matrix_")) {
      const cols = (el.columns || []).map(c => {
        if (typeof c === "object") return { value: c.value, text: c.text || c.value };
        return { value: String(c), text: String(c) };
      });
      if (cols.length > columnLabels.length) columnLabels = cols;
    }
  }
}

// bg_proxy rows from schema
let bgProxyRows = [];
for (const page of schema.pages) {
  for (const el of page.elements || []) {
    if (el.name === "bg_proxy") {
      bgProxyRows = (el.rows || []).map(r => typeof r === "string" ? r : r.value);
    }
  }
}

// --- WIDE CSV ---
const wideHeader = ["participant_id", ...sortedItems];
const wideRows = [wideHeader.join(",")];
for (const p of participantData) {
  const row = [JSON.stringify(p.pid)];
  for (const item of sortedItems) {
    row.push(p.tumiItems[item] !== undefined ? p.tumiItems[item] : "");
  }
  wideRows.push(row.join(","));
}

// --- LONG CSV (for R: easy ggplot, psych, etc.) ---
const longHeader = "participant_id,item_code,value";
const longRows = [longHeader];
for (const p of participantData) {
  for (const [item, val] of Object.entries(p.tumiItems)) {
    longRows.push(`${JSON.stringify(p.pid)},${item},${val}`);
  }
}

// --- META CSV ---
const metaHeader = [
  "participant_id", "completion_code", "prolific_pid",
  "created_at_epoch_ms", "bg_liking", "bg_expertise",
  ...bgProxyRows.map(r => `bg_${r}`),
  "n_tumi_answered", "n_tumi_total", "pct_complete",
  "randomization_seed", "consent_age", "consent_data"
];
const metaRows = [metaHeader.join(",")];
for (const p of participantData) {
  const bgVals = bgProxyRows.map(r => p.bgItems[r] !== undefined ? p.bgItems[r] : "");
  const row = [
    JSON.stringify(p.pid),
    JSON.stringify(p.completionCode),
    JSON.stringify(p.prolificPid),
    p.createdAt,
    p.bgLiking,
    JSON.stringify(p.bgExpertise),
    ...bgVals,
    p.nAnswered,
    sortedItems.length,
    p.nAnswered > 0 ? (p.nAnswered / sortedItems.length * 100).toFixed(1) : "0.0",
    p.randSeed,
    p.consentAge === true ? 1 : 0,
    p.consentData === true ? 1 : 0
  ];
  metaRows.push(row.join(","));
}

// --- Write files ---
const outDir = path.join(__dirname, "..", "analysis");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, "tumi_responses.csv"), wideRows.join("\n"), "utf-8");
fs.writeFileSync(path.join(outDir, "tumi_long.csv"), longRows.join("\n"), "utf-8");
fs.writeFileSync(path.join(outDir, "tumi_meta.csv"), metaRows.join("\n"), "utf-8");

const schemaInfo = {
  columnLabels,
  nItems: sortedItems.length,
  nMatrices: 6,
  itemCodes: sortedItems,
  bgProxyRows,
  nParticipants: participantData.length
};
fs.writeFileSync(path.join(outDir, "tumi_schema_info.json"), JSON.stringify(schemaInfo, null, 2), "utf-8");

console.log(`\nWritten to ${outDir}/:`);
console.log(`  tumi_responses.csv  (${participantData.length} × ${sortedItems.length})`);
console.log(`  tumi_long.csv       (${longRows.length - 1} rows)`);
console.log(`  tumi_meta.csv       (${participantData.length} rows)`);
console.log(`  tumi_schema_info.json`);

// Quick data quality summary
const prolific = participantData.filter(p => p.prolificPid && !p.prolificPid.includes("{"));
console.log(`\n--- Quick summary ---`);
console.log(`Prolific participants: ${prolific.length}`);
console.log(`Test/preview: ${participantData.length - prolific.length}`);
if (prolific.length > 0) {
  const pcts = prolific.map(p => p.nAnswered / sortedItems.length * 100);
  console.log(`Completion %: min=${Math.min(...pcts).toFixed(1)}, max=${Math.max(...pcts).toFixed(1)}, mean=${(pcts.reduce((a, b) => a + b, 0) / pcts.length).toFixed(1)}`);
}
