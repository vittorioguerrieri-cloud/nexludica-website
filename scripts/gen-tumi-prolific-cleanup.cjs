/**
 * Genera migration 0037: prepara lo studio TUMI per Prolific.
 *
 * Modifiche:
 * - Rimuove pagina anonymous_code (4 campi identita')
 * - Aggiunge pagina intro prima del consent
 * - Aggiorna consent HTML: toglie riferimenti al codice anonimo
 * - Aggiorna completedHtml: toglie menzione codice anonimo
 * - UPDATE studio: null-ifica anonymous_code_template/identity_fields,
 *   setta prolific_completion_url corretto, public_listing=0
 */
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(process.env.TEMP || "/tmp", "tumi_schema_parsed.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

// 1. Remove anonymous_code page
schema.pages = schema.pages.filter(p => p.name !== "anonymous_code");

// 2. Add intro page at the beginning (before consent)
const introPage = {
  name: "intro",
  title: "Welcome",
  elements: [
    {
      type: "html",
      name: "intro_html",
      html: [
        '<div style="background:#FFFFFF;padding:24px 28px;border-radius:10px;margin:4px 0 16px;box-shadow:0 1px 4px rgba(0,0,0,.06);line-height:1.65;color:#1b2528;">',
        '  <h3 style="margin:0 0 16px;color:#05abc4;">About this study</h3>',
        '  <p>In this study you will be asked to answer questions on board games.</p>',
        '  <p>If you ever played Monopoly or any other board game, card game, etc., think about that while you are compiling.</p>',
        '  <p style="margin-top:16px;color:#5c6b73;font-size:0.92em;">Click <strong>Next</strong> to proceed to the informed consent.</p>',
        '</div>',
      ].join("\n"),
    },
  ],
};
schema.pages.unshift(introPage);

// 3. Update consent HTML: remove references to anonymous code
const consentPage = schema.pages.find(p => p.name === "consent");
if (consentPage) {
  const htmlEl = consentPage.elements.find(e => e.name === "consent_html");
  if (htmlEl) {
    // Remove the bullet about anonymous code generation
    htmlEl.html = htmlEl.html.replace(
      /<li>You will generate an <strong>anonymous code<\/strong>[^<]*<\/li>\s*/,
      ""
    );
    // Remove the sentence about providing anonymous code for GDPR rights
    htmlEl.html = htmlEl.html.replace(
      /, providing the anonymous code you will generate on the next page/,
      ""
    );
  }
}

// 4. Update completedHtml: remove anonymous code mention
schema.completedHtml =
  '<div style="padding:32px;text-align:center;">' +
  '<h2 style="color:#05abc4;">Thank you!</h2>' +
  '<p>Your contribution helps validate the TUMI.</p>' +
  '</div>';

// 5. Build SQL
const studyId = "00000000-0000-4000-8000-300000000001";
const questionnaireId = "00000000-0000-4000-8000-300000000010";
const prolificUrl = "https://app.prolific.com/submissions/complete?cc=C18I2RVU";

const schemaStr = JSON.stringify(schema).replace(/'/g, "''");

const sql = `-- 0037: prepare TUMI for Prolific (remove identification, add intro, set completion URL)

-- Update study: remove anonymous code, set Prolific URL, hide from public listing
UPDATE research_studies
SET anonymous_code_template = NULL,
    identity_fields = NULL,
    prolific_completion_url = '${prolificUrl}',
    public_listing = 0,
    updated_at = unixepoch()
WHERE id = '${studyId}';

-- Update questionnaire schema: remove anonymous_code page, add intro page, bump version
UPDATE research_questionnaires
SET schema_json = '${schemaStr}',
    version = version + 1,
    updated_at = unixepoch()
WHERE id = '${questionnaireId}';
`;

const outPath = path.join(__dirname, "..", "migrations", "0037_tumi_prolific_prep.sql");
fs.writeFileSync(outPath, sql, "utf-8");
console.log(`Written: ${outPath}`);
console.log(`Schema pages: ${schema.pages.map(p => p.name).join(", ")}`);
console.log(`Total pages: ${schema.pages.length}`);
