/**
 * Migration 0039: per-item required flag on TUMI matrix rows.
 *
 * Modifiche:
 *  - bg_proxy: rimuove isAllRowRequired (ora la required-ness è per-riga)
 *  - bg_proxy.rows[bg_p1..bg_p4]: aggiunge required: true
 *  - tutte le altre matrici (tumi_matrix_1..6): nessuna riga è required
 *    (il probing giallo gestisce gli skip)
 *
 * Il renderer è già stato aggiornato per:
 *  - preservare row.required attraverso lo shuffle cross-participant
 *  - bloccare la navigazione finché tutte le righe required sono compilate
 *    (banner rosso bloccante)
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const tempPath = path.join(os.tmpdir(), "tumi_schema_v6.json");
const raw = fs.readFileSync(tempPath, "utf-8").replace(/^﻿/, "");
const wranglerOut = JSON.parse(raw);
const schema = JSON.parse(wranglerOut[0].results[0].schema_json);

// Trova player_profile page → bg_proxy matrix
const playerProfile = schema.pages.find((p) => p.name === "player_profile");
if (!playerProfile) throw new Error("player_profile page not found");
const bgProxy = playerProfile.elements.find((e) => e.name === "bg_proxy");
if (!bgProxy) throw new Error("bg_proxy element not found");

// Rimuovo isAllRowRequired
delete bgProxy.isAllRowRequired;

// Aggiungo required: true a tutte le righe (sono i 4 item screening)
const requiredScreeningCodes = new Set(["bg_p1", "bg_p2", "bg_p3", "bg_p4"]);
let modifiedCount = 0;
bgProxy.rows = bgProxy.rows.map((r) => {
  if (typeof r === "string") {
    if (requiredScreeningCodes.has(r)) {
      modifiedCount++;
      return { value: r, text: r, required: true };
    }
    return r;
  }
  if (requiredScreeningCodes.has(r.value)) {
    modifiedCount++;
    return { ...r, required: true };
  }
  return r;
});

console.log(`Modified ${modifiedCount} rows in bg_proxy to required: true`);
if (modifiedCount !== 4) {
  console.warn("WARNING: expected to modify exactly 4 rows (bg_p1..bg_p4)");
}

// Defensive: assicuro che NESSUNA matrice TUMI abbia isAllRowRequired
for (const page of schema.pages) {
  for (const el of page.elements || []) {
    if (el.type === "matrix" && el.name !== "bg_proxy" && el.isAllRowRequired === true) {
      console.log(`Removing isAllRowRequired from ${el.name}`);
      delete el.isAllRowRequired;
    }
  }
}

// Build SQL
const questionnaireId = "00000000-0000-4000-8000-300000000010";
const schemaStr = JSON.stringify(schema).replace(/'/g, "''");

const sql = `-- 0039: TUMI — per-item required flag on bg_proxy screening items

UPDATE research_questionnaires
SET schema_json = '${schemaStr}',
    version = version + 1,
    updated_at = unixepoch()
WHERE id = '${questionnaireId}';
`;

const outPath = path.join(__dirname, "..", "migrations", "0039_tumi_per_item_required.sql");
fs.writeFileSync(outPath, sql, "utf-8");
console.log(`Written: ${outPath}`);
