/**
 * Generates migration 0038 — updates TUMI consent HTML to be GDPR-compliant
 * and aligned with ethics-committee standards (Declaration of Helsinki, BPS code).
 *
 * Reads current schema from temp file (re-fetched from D1), replaces ONLY the
 * consent_html element, bumps version.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const tempPath = path.join(os.tmpdir(), "tumi_schema_v5.json");
const raw = fs.readFileSync(tempPath, "utf-8").replace(/^﻿/, "");
const wranglerOut = JSON.parse(raw);
const schema = JSON.parse(wranglerOut[0].results[0].schema_json);

// New consent HTML — comprehensive, GDPR Art. 13 + Helsinki + BPS-style
const newConsentHtml = `
<div style="background:#FFFFFF;padding:22px 26px;border-radius:10px;margin:4px 0 16px;box-shadow:0 1px 4px rgba(0,0,0,.06);line-height:1.55;color:#1b2528;">

  <h3 style="margin:0 0 10px;color:#05abc4;">Participant Information Sheet & Informed Consent</h3>
  <p style="margin:0 0 14px;color:#5c6b73;font-size:0.9em;">Version 2.0 — Last updated: 26 May 2026</p>

  <h4 style="margin:14px 0 6px;color:#1b2528;">1. Study</h4>
  <p style="margin:4px 0;"><strong>Title:</strong> International validation of the Tabletop User Motivation Inventory (TUMI).</p>
  <p style="margin:4px 0;"><strong>Type:</strong> Online, cross-sectional, anonymous psychometric validation study.</p>
  <p style="margin:4px 0;"><strong>Estimated duration:</strong> 20–25 minutes.</p>
  <p style="margin:4px 0;"><strong>Funding:</strong> Conducted by NexLudica APS using internal resources; no external funding influences design, conduct, analysis, or publication.</p>

  <h4 style="margin:14px 0 6px;color:#1b2528;">2. Data Controller and Research Team</h4>
  <p style="margin:4px 0;"><strong>Data Controller (Titolare del trattamento):</strong></p>
  <ul style="margin:4px 0 4px 22px;padding:0;">
    <li>NexLudica APS</li>
    <li>Vico Barnabiti 10, 16124 Genova (GE), Italy</li>
    <li>Italian Tax Code: 95252550108</li>
    <li>Email: <a href="mailto:info@nexludica.org" style="color:#05abc4;">info@nexludica.org</a></li>
  </ul>
  <p style="margin:8px 0 4px;"><strong>Principal Investigator:</strong> Vittorio Guerrieri — <a href="mailto:vittorio.guerrieri@nexludica.org" style="color:#05abc4;">vittorio.guerrieri@nexludica.org</a></p>
  <p style="margin:4px 0;">No Data Protection Officer is required under Art. 37 GDPR for this study. Data-protection enquiries can be sent to the Data Controller at the address above.</p>

  <h4 style="margin:14px 0 6px;color:#1b2528;">3. Purpose of the Study</h4>
  <p style="margin:4px 0;">To validate the psychometric properties (factor structure, internal consistency, construct validity) of the TUMI, a questionnaire measuring motivations underlying tabletop-gaming behaviour. Findings will contribute to peer-reviewed scientific literature on the psychology of play and tabletop gaming.</p>

  <h4 style="margin:14px 0 6px;color:#1b2528;">4. What You Will Be Asked to Do</h4>
  <p style="margin:4px 0;">After this consent page you will be asked:</p>
  <ul style="margin:4px 0 4px 22px;padding:0;">
    <li>basic anonymous demographics (age range, gender, country of residence, first language);</li>
    <li>brief questions about your relationship with tabletop games;</li>
    <li>statements about your motivations to play, rated on a 1–7 Likert scale.</li>
  </ul>
  <p style="margin:8px 0 4px;"><strong>Attention checks.</strong> Embedded among the statements you will find a small number of validated attention-check items drawn from the methodological literature (Curran &amp; Hauser, 2019). These items have transparently obvious correct answers (e.g., "Oranges are fruit") and are used to detect inattentive responding, in line with standard psychometric practice. Failing one or more attention checks may lead to your data being excluded from analyses but never to any other consequence.</p>

  <h4 style="margin:14px 0 6px;color:#1b2528;">5. Voluntary Participation and Right to Withdraw</h4>
  <p style="margin:4px 0;">Participation is entirely voluntary. You may:</p>
  <ul style="margin:4px 0 4px 22px;padding:0;">
    <li>refuse to take part with no consequence;</li>
    <li>withdraw at any time during the questionnaire by simply closing the browser tab — your incomplete responses will not be stored;</li>
    <li>skip individual non-required items (only the consent items at the start are mandatory);</li>
    <li>request deletion of your submitted data after completion (see Section 8).</li>
  </ul>

  <h4 style="margin:14px 0 6px;color:#1b2528;">6. Risks, Benefits and Compensation</h4>
  <p style="margin:4px 0;"><strong>Risks:</strong> we anticipate no risks beyond those of everyday online activity. Some questions concern personal preferences and habits and may prompt reflection; if any item makes you uncomfortable, you may skip it or end the session.</p>
  <p style="margin:4px 0;"><strong>Benefits:</strong> you will not receive a direct personal benefit, but your contribution will advance scientific understanding of motivation in tabletop gaming.</p>
  <p style="margin:4px 0;"><strong>Compensation:</strong> if you were recruited through Prolific you will receive the compensation agreed on that platform upon submission of a valid response.</p>

  <h4 style="margin:14px 0 6px;color:#1b2528;">7. Personal Data and Legal Basis (Articles 6, 9 and 13 GDPR)</h4>
  <p style="margin:4px 0;"><strong>Data we collect:</strong></p>
  <ul style="margin:4px 0 4px 22px;padding:0;">
    <li>your answers to the questionnaire (demographics + Likert ratings);</li>
    <li>your Prolific participant ID (a pseudonym managed by Prolific Academic Ltd.), if you arrive through that platform — used only to credit your compensation and to prevent duplicate submissions;</li>
    <li>a non-identifying SHA-256 hash of your IP address, kept solely for anti-spam protection;</li>
    <li>technical metadata: timestamp, user-agent string, presentation order of items (deterministic seed for methodological analyses).</li>
  </ul>
  <p style="margin:8px 0 4px;">We do <strong>not</strong> collect your name, surname, email, postal address, date of birth, IP address in plain form, or any direct identifier. We do not collect special categories of personal data within the meaning of Art. 9 GDPR.</p>
  <p style="margin:8px 0 4px;"><strong>Legal basis:</strong></p>
  <ul style="margin:4px 0 4px 22px;padding:0;">
    <li>Art. 6(1)(a) GDPR — your explicit, freely given, informed and unambiguous consent;</li>
    <li>Art. 89(1) GDPR — processing for scientific research purposes with appropriate safeguards (data minimisation, pseudonymisation, no decisions about individuals).</li>
  </ul>

  <h4 style="margin:14px 0 6px;color:#1b2528;">8. Data Storage, Retention and Sharing</h4>
  <p style="margin:4px 0;"><strong>Storage:</strong> data are stored on Cloudflare D1 servers located in the European Union (Milan, Italy). Access is restricted to the research team and protected by authentication.</p>
  <p style="margin:4px 0;"><strong>Retention:</strong> identifiable pseudonymous data (including the Prolific ID) are retained for up to 24 months after the close of data collection, then either fully anonymised (Prolific ID irreversibly removed) or deleted. Fully anonymised, aggregate data may be retained indefinitely.</p>
  <p style="margin:4px 0;"><strong>Sharing and publication:</strong> findings will be published in peer-reviewed venues, conferences and open-science repositories, always in aggregate form. A fully anonymised dataset (with Prolific IDs removed) may be deposited in a public scientific repository (e.g., OSF, Zenodo) to support open science and replicability, in accordance with the FAIR data principles.</p>
  <p style="margin:4px 0;"><strong>Transfers outside the EU:</strong> Cloudflare, Inc. is a US-based provider with EU data-residency guarantees; any incidental transfer occurs under the EU Standard Contractual Clauses (Art. 46 GDPR).</p>

  <h4 style="margin:14px 0 6px;color:#1b2528;">9. Your Rights (Articles 15–22 GDPR)</h4>
  <p style="margin:4px 0;">You have the right to: (a) access your personal data and obtain a copy; (b) rectify inaccurate data; (c) request erasure ("right to be forgotten"); (d) restrict processing; (e) data portability; (f) object to processing; (g) withdraw your consent at any time, without affecting the lawfulness of processing prior to withdrawal.</p>
  <p style="margin:4px 0;">To exercise these rights, please contact the Data Controller at <a href="mailto:info@nexludica.org" style="color:#05abc4;">info@nexludica.org</a> quoting your Prolific ID (or the completion code shown at the end of the survey) so we can locate your record. Requests will be answered within 30 days.</p>
  <p style="margin:4px 0;">You also have the right to lodge a complaint with the Italian Data Protection Authority (Garante per la protezione dei dati personali, <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" style="color:#05abc4;">www.garanteprivacy.it</a>) or with the supervisory authority of your country of residence within the EU.</p>

  <h4 style="margin:14px 0 6px;color:#1b2528;">10. Ethical Standards</h4>
  <p style="margin:4px 0;">This study has been designed in accordance with: (i) the World Medical Association's Declaration of Helsinki (as revised in 2013); (ii) the Code of Human Research Ethics of the British Psychological Society (2021); (iii) Regulation (EU) 2016/679 (GDPR) and the Italian Personal Data Protection Code (D.Lgs. 196/2003 as amended by D.Lgs. 101/2018); (iv) the EU Code of Conduct for Research Integrity (ALLEA, 2023). No automated decision-making (including profiling) under Art. 22 GDPR is performed on your data.</p>

  <h4 style="margin:14px 0 6px;color:#1b2528;">11. Eligibility</h4>
  <p style="margin:4px 0;">To take part you must be at least <strong>18 years old</strong> and able to read and understand English.</p>

  <h4 style="margin:14px 0 6px;color:#1b2528;">12. Consent</h4>
  <p style="margin:4px 0;">Please indicate your agreement to both items below. Without explicit "Yes" to both you will not be able to proceed.</p>

</div>
`.trim();

// Replace consent_html
const consentPage = schema.pages.find(p => p.name === "consent");
if (!consentPage) throw new Error("consent page not found");
const consentHtmlEl = consentPage.elements.find(e => e.name === "consent_html");
if (!consentHtmlEl) throw new Error("consent_html element not found");
consentHtmlEl.html = newConsentHtml;

// Also strengthen the two boolean items with more explicit wording
const consentAgeEl = consentPage.elements.find(e => e.name === "consent_age");
if (consentAgeEl) {
  consentAgeEl.title = "I confirm that I am at least 18 years old.";
}
const consentDataEl = consentPage.elements.find(e => e.name === "consent_data");
if (consentDataEl) {
  consentDataEl.title = "I have read and understood the Participant Information Sheet above, I have had the opportunity to ask questions, and I freely consent to participate in this study and to the processing of my data as described.";
}

// Update consent page title
consentPage.title = "Informed consent";

// Build SQL
const questionnaireId = "00000000-0000-4000-8000-300000000010";
const schemaStr = JSON.stringify(schema).replace(/'/g, "''");

const sql = `-- 0038: TUMI — comprehensive GDPR/ethics-committee-aligned informed consent

UPDATE research_questionnaires
SET schema_json = '${schemaStr}',
    version = version + 1,
    updated_at = unixepoch()
WHERE id = '${questionnaireId}';
`;

const outPath = path.join(__dirname, "..", "migrations", "0038_tumi_consent_v2.sql");
fs.writeFileSync(outPath, sql, "utf-8");
console.log(`Written: ${outPath}`);
console.log(`Schema pages: ${schema.pages.map(p => p.name).join(", ")}`);
console.log(`Consent HTML length: ${newConsentHtml.length} chars`);
