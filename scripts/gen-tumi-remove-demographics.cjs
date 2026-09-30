/**
 * Migration 0040: Remove demographics page from TUMI questionnaire.
 * Prolific already collects age, gender, country, language — no need to duplicate.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const raw = fs.readFileSync(path.join(os.tmpdir(), "tumi_v8_raw.json"), "utf-8").replace(/^﻿/, "");
const jsonStart = raw.indexOf("[");
const wranglerOut = JSON.parse(raw.slice(jsonStart));
const schema = JSON.parse(wranglerOut[0].results[0].schema_json);

const before = schema.pages.length;
schema.pages = schema.pages.filter(p => p.name !== "demographics");
const after = schema.pages.length;

console.log(`Pages: ${before} → ${after} (removed ${before - after})`);
if (before === after) {
  console.error("ERROR: demographics page not found!");
  process.exit(1);
}

const questionnaireId = "00000000-0000-4000-8000-300000000010";
const schemaStr = JSON.stringify(schema).replace(/'/g, "''");

const sql = `-- 0040: Remove demographics page (Prolific provides these data)

UPDATE research_questionnaires
SET schema_json = '${schemaStr}',
    version = version + 1,
    updated_at = unixepoch()
WHERE id = '${questionnaireId}';
`;

const outPath = path.join(__dirname, "..", "migrations", "0040_tumi_remove_demographics.sql");
fs.writeFileSync(outPath, sql, "utf-8");
console.log(`Written: ${outPath}`);
