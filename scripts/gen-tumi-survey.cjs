/**
 * Genera la migration SQL per lo studio "TUMI Validation".
 *
 * Caratteristiche v4:
 * - Tutta la UI (consenso, demographics, sezioni, completion) in INGLESE
 *   (gli item TUMI sono in inglese → coerenza)
 * - 6 bogus items validati (Curran & Hauser 2019)
 * - 5 board-game-player proxy items per indice composito di "board gamer"
 *   (utile reclutando da popolazione generale via Prolific)
 * - Colonne Likert formattate come "1\nStrongly disagree" → renderer
 *   client-side fa rendering split (numero grande sopra, label sotto)
 * - Pre-shuffle build-time + shuffle cross-participant via seed reversibile
 * - Consenso bloccante
 */
const fs = require("fs");
const path = require("path");

const items = JSON.parse(fs.readFileSync("C:\\Users\\vitto\\Desktop\\tumi-items.json", "utf-8"));
console.log(`Loaded ${items.length} TUMI items`);

// === BOGUS ITEMS — Curran & Hauser (2019), best-performing ===
const bogusItems = [
  { code: "BG01", text: "I work fourteen months in a year.",                  construct: "BOGUS", expected_value: 1 },
  { code: "BG02", text: "I have never used a computer.",                       construct: "BOGUS", expected_value: 1 },
  { code: "BG03", text: "I am paid biweekly by leprechauns.",                  construct: "BOGUS", expected_value: 1 },
  { code: "BG04", text: "I have been to every country in the world.",          construct: "BOGUS", expected_value: 1 },
  { code: "BG05", text: "I have the power to cast spells on others.",          construct: "BOGUS", expected_value: 1 },
  { code: "BG06", text: "Oranges are fruit.",                                  construct: "BOGUS", expected_value: 7 },
];

const allItems = items.concat(bogusItems);

// === BUILD-TIME SHUFFLE (deterministic) ===
const BUILD_SEED = 20260521;
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffleSeeded(arr, seed) {
  const rng = mulberry32(seed);
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const shuffled = shuffleSeeded(allItems, BUILD_SEED);

const PAGES = 6;
const chunkSize = Math.ceil(shuffled.length / PAGES);
const chunks = [];
for (let i = 0; i < shuffled.length; i += chunkSize) {
  chunks.push(shuffled.slice(i, i + chunkSize));
}
console.log(`Split into ${chunks.length} pages`);

// === Likert columns: numero + newline + label, renderer fa rendering 2-line ===
const likertCols = [
  { value: 1, text: "1\nStrongly disagree" },
  { value: 2, text: "2" },
  { value: 3, text: "3" },
  { value: 4, text: "4\nNeutral" },
  { value: 5, text: "5" },
  { value: 6, text: "6" },
  { value: 7, text: "7\nStrongly agree" },
];

// 7-point Likert for the player-profile proxy items (same scale as TUMI for consistency)
const playerProxyCols = likertCols;

const consentHtml = `
<div style="background:#FFFFFF;padding:18px 22px;border-radius:10px;margin:4px 0 16px;box-shadow:0 1px 4px rgba(0,0,0,.06); line-height:1.55; color:#1b2528;">
  <h3 style="margin:0 0 12px;color:#05abc4;">Informed consent</h3>
  <p><strong>Study:</strong> International validation of the TUMI (Tabletop User Motivation Inventory).</p>
  <p><strong>Promoted by:</strong> NexLudica APS — <a href="https://nexludica.org" style="color:#05abc4;">nexludica.org</a></p>
  <p><strong>Principal Investigator:</strong> Vittorio Guerrieri (<a href="mailto:vittorio.guerrieri@nexludica.org" style="color:#05abc4;">vittorio.guerrieri@nexludica.org</a>)</p>
  <h4 style="margin:16px 0 6px;color:#1b2528;">Purpose</h4>
  <p>To validate a psychometric tool measuring the motivations of people who play tabletop games (TUMI). Findings will contribute to the scientific literature on board gaming.</p>
  <h4 style="margin:16px 0 6px;color:#1b2528;">What we ask you to do</h4>
  <p>Complete a questionnaire of roughly 20–25 minutes, organised into sections of statements. For each statement you indicate how much you agree on a 1–7 scale. There are no right or wrong answers, with the exception of a handful of trasparent attention-check items drawn from the methodological literature (Curran &amp; Hauser, 2019).</p>
  <h4 style="margin:16px 0 6px;color:#1b2528;">Data handling</h4>
  <ul style="margin:6px 0 6px 22px; padding:0;">
    <li>Responses are <strong>anonymous</strong>: we do not collect name, email, or identifiable IP address (only an anti-spam hash).</li>
    <li>You will generate an <strong>anonymous code</strong> by answering 4 short questions, so that — should you wish — you can take part in a future follow-up without identifying yourself.</li>
    <li>We store the <strong>item presentation order</strong> (via a deterministic seed unique to your session) to allow methodological analyses.</li>
    <li>Aggregate data may be used for psychometric analyses and published in scientific journals, always in aggregate form.</li>
    <li>Retention: data is stored on NexLudica APS servers (EU) for as long as needed for the research, then permanently anonymised or deleted.</li>
    <li>Legal basis: GDPR art. 6.1.a (consent) and art. 89 (scientific research).</li>
  </ul>
  <h4 style="margin:16px 0 6px;color:#1b2528;">Your rights</h4>
  <p>You may stop the questionnaire at any time without explanation. To exercise GDPR rights (access, deletion, etc.), write to the principal investigator above, providing the anonymous code you will generate on the next page.</p>
  <h4 style="margin:16px 0 6px;color:#1b2528;">Confirmation</h4>
  <p>You must be at least 18 years old to take part. <strong>Without explicit "Yes" to both items below you will not be able to proceed</strong>.</p>
</div>`;

const schema = {
  title: "TUMI Validation Study",
  description: "Tabletop User Motivation Inventory — validation study by NexLudica APS",
  showProgressBar: "top",
  progressBarType: "pages",
  showQuestionNumbers: "off",
  requiredText: "*",
  locale: "en",
  // Cross-participant shuffle attivato (vedi renderer)
  nx_shuffle_across_pages: true,
  completedHtml:
    '<div style="padding:32px;text-align:center;"><h2 style="color:#05abc4;">Thank you!</h2><p>Your contribution helps validate the TUMI. If you wish, save your anonymous code for a possible future follow-up.</p></div>',
  pages: [],
};

// === Page 1: Consent ===
schema.pages.push({
  name: "consent",
  title: "Informed consent",
  elements: [
    { type: "html", name: "consent_html", html: consentHtml },
    {
      type: "boolean",
      name: "consent_age",
      title: "I confirm I am at least 18 years old",
      isRequired: true,
      labelTrue: "Yes",
      labelFalse: "No",
      validators: [
        { type: "expression", expression: "{consent_age} = true", text: "You must be at least 18 to take part." },
      ],
    },
    {
      type: "boolean",
      name: "consent_data",
      title: "I have read the information sheet and I consent to the processing of my data for the research purposes described",
      isRequired: true,
      labelTrue: "Yes",
      labelFalse: "No",
      validators: [
        { type: "expression", expression: "{consent_data} = true", text: "Consent is required to proceed." },
      ],
    },
  ],
});

// === Page 2: Anonymous code ===
schema.pages.push({
  name: "anonymous_code",
  title: "Anonymous code",
  description:
    "To link your responses to possible future questionnaires without identifying yourself, create a personal code by answering these 4 questions. Remember your answers: you will need them to regenerate the same code in the future.",
  elements: [
    {
      type: "text",
      name: "anon_madre",
      title: "First letter of your mother's name",
      description: "Example: if your mother's name is Maria, write M",
      isRequired: true,
      maxLength: 1,
      validators: [{ type: "regex", regexp: "^[a-zA-Z\\u00C0-\\u017F]$", text: "Enter a single letter" }],
    },
    {
      type: "text",
      name: "anon_giorno",
      title: "Day of your birthday (1-31)",
      description: "Just the day. Example: if you were born on March 15, write 15",
      isRequired: true,
      inputType: "number",
      min: 1,
      max: 31,
      validators: [{ type: "regex", regexp: "^([1-9]|[12][0-9]|3[01])$", text: "Enter a number 1–31" }],
    },
    {
      type: "text",
      name: "anon_nome",
      title: "First letter of your first name",
      description: "Example: if your name is Vittorio, write V",
      isRequired: true,
      maxLength: 1,
      validators: [{ type: "regex", regexp: "^[a-zA-Z\\u00C0-\\u017F]$", text: "Enter a single letter" }],
    },
    {
      type: "text",
      name: "anon_telefono",
      title: "First two digits of your phone number",
      description: "Example: if your number starts with 34..., write 34",
      isRequired: true,
      inputType: "number",
      min: 0,
      max: 99,
      validators: [{ type: "regex", regexp: "^[0-9]{1,2}$", text: "Enter two digits (00-99)" }],
    },
  ],
});

// === Page 3: Demographics ===
schema.pages.push({
  name: "demographics",
  title: "About you",
  description: "A few basic anonymous questions to help us analyse the data.",
  elements: [
    { type: "text", name: "age", title: "Age", isRequired: true, inputType: "number", min: 18, max: 99 },
    {
      type: "radiogroup",
      name: "gender",
      title: "Gender",
      isRequired: true,
      choices: [
        { value: "f", text: "Female" },
        { value: "m", text: "Male" },
        { value: "nb", text: "Non-binary / other" },
        { value: "na", text: "Prefer not to say" },
      ],
    },
    { type: "text", name: "country", title: "Country of residence", isRequired: true, placeholder: "e.g. Italy, USA, …" },
    {
      type: "text",
      name: "first_language",
      title: "First language",
      isRequired: true,
      placeholder: "e.g. English, Italian, …",
    },
  ],
});

// === Page 4: Player profile (board-gamer composite proxy) ===
// 5 items → composite index "how much of a board gamer is this respondent".
// 1 rating 1-10 + 4 Likert 1-7 same scale as TUMI for consistency.
schema.pages.push({
  name: "player_profile",
  title: "Your relationship with board games",
  description:
    "These questions help us understand how strongly you identify as a board gamer. There are no right or wrong answers — we expect a wide range of profiles.",
  elements: [
    {
      type: "rating",
      name: "bg_liking",
      title: "Overall, how much do you like board games?",
      isRequired: true,
      rateMin: 1,
      rateMax: 10,
      minRateDescription: "Not at all",
      maxRateDescription: "Love them",
    },
    {
      type: "matrix",
      name: "bg_proxy",
      title: "How much do you agree with each statement?",
      isAllRowRequired: true,
      columns: playerProxyCols,
      rows: [
        { value: "bg_p1", text: "In the past year I have bought at least one board game." },
        { value: "bg_p2", text: "I currently own more than 10 board games." },
        { value: "bg_p3", text: "In the past month I have played a board game at least once." },
        { value: "bg_p4", text: "I follow content creators (YouTubers, podcasts, blogs) about board games." },
      ],
    },
    {
      type: "radiogroup",
      name: "bg_expertise",
      title: "How would you describe your experience with board games?",
      isRequired: true,
      choices: [
        { value: "novice", text: "Novice — I rarely play, mostly party / family classics" },
        { value: "casual", text: "Casual — I play occasionally, I know a few modern games" },
        { value: "regular", text: "Regular — I play frequently and know many modern games" },
        { value: "enthusiast", text: "Enthusiast — board games are a serious hobby of mine" },
        { value: "expert", text: "Expert — I design, review, or actively follow the industry" },
      ],
    },
  ],
});

// === Pages 5-10: TUMI items (6 pages, randomised in renderer) ===
chunks.forEach((chunk, pi) => {
  schema.pages.push({
    name: `tumi_${pi + 1}`,
    title: `Section ${pi + 1} of ${chunks.length}`,
    description:
      pi === 0
        ? "For each statement, indicate how much you agree on a 1–7 scale. Order is randomised for your session."
        : "Continue indicating how much you agree with each statement.",
    elements: [
      {
        type: "matrix",
        name: `tumi_matrix_${pi + 1}`,
        title: "How much do you agree with each statement?",
        isAllRowRequired: false,
        columns: likertCols,
        rows: chunk.map((it) => ({ value: it.code, text: it.text })),
      },
    ],
  });
});

const schemaJson = JSON.stringify(schema);
const sqlEscaped = schemaJson.replace(/'/g, "''");

const studyId = "00000000-0000-4000-8000-300000000001";
const qId = "00000000-0000-4000-8000-300000000010";

const sql = `-- TUMI Validation Study (v4):
-- - All UI text in English (consistent with the English items)
-- - 6 attention-check bogus items (Curran & Hauser 2019, best-performing)
-- - 5-item composite proxy for "board gamer profile" (Prolific-friendly)
-- - Likert columns split into "number\\nlabel" → renderer styles number prominently
-- - Cross-participant shuffle with reversible seed (nx_shuffle_across_pages)
-- - Blocking informed consent
-- Principal Investigator: V. Guerrieri. Promoted by NexLudica APS.

INSERT OR REPLACE INTO research_studies
  (id, slug, title, description, status, public_listing,
   anonymous_code_template, identity_fields, theme_json,
   prolific_completion_url,
   created_at, updated_at, created_by)
VALUES (
  '${studyId}',
  'tumi-validation',
  'TUMI Validation Study',
  'International validation of the TUMI (Tabletop User Motivation Inventory), a psychometric tool that measures the motivations of people who play tabletop games. Promoted by NexLudica APS. Principal Investigator: Vittorio Guerrieri. Completion time: about 20-25 minutes.',
  'active',
  1,
  '{anon_madre}{anon_giorno}{anon_nome}{anon_telefono}',
  'anon_madre,anon_giorno,anon_nome,anon_telefono',
  NULL,
  'https://app.prolific.com/submissions/complete?cc=REPLACE_ME',
  unixepoch()*1000,
  unixepoch()*1000,
  NULL
);

INSERT OR REPLACE INTO research_questionnaires
  (id, study_id, slug, title, description, schema_json,
   position, status, version, created_at, updated_at)
VALUES (
  '${qId}',
  '${studyId}',
  'tumi',
  'TUMI — full questionnaire',
  'TUMI items rated on a 1–7 scale. Completion time: about 20-25 minutes.',
  '${sqlEscaped}',
  0,
  'active',
  4,
  unixepoch()*1000,
  unixepoch()*1000
);
`;

const outPath = path.join(__dirname, "..", "migrations", "0033_tumi_v4_english_proxies.sql");
fs.writeFileSync(outPath, sql, "utf-8");
console.log(`Wrote ${outPath} (${sql.length} bytes)`);
