/**
 * Research Platform: CRUD + helpers per studi, questionari, risposte.
 *
 * Modello generico: ogni studio raggruppa N questionari, ogni questionario
 * ha uno schema SurveyJS salvato come JSON e raccoglie risposte come JSON.
 * Riusabile per qualsiasi ricerca futura, non solo Game Research.
 */
import { now, secureToken, uuid } from "./db";

export type StudyStatus = "draft" | "active" | "closed";
export type QuestionnaireStatus = "draft" | "active" | "closed";

export interface Study {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: StudyStatus;
  publicListing: boolean;
  anonymousCodeTemplate: string | null;
  identityFields: string[];          // splittato da CSV
  themeJson: string | null;
  /** URL Prolific a cui rimandare il partecipante a fine compilazione, se reclutato via Prolific. */
  prolificCompletionUrl: string | null;
  createdAt: number;
  updatedAt: number;
  createdBy: string | null;
}

export interface Questionnaire {
  id: string;
  studyId: string;
  slug: string;
  title: string;
  description: string | null;
  schemaJson: string;
  position: number;
  status: QuestionnaireStatus;
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface Response {
  id: string;
  questionnaireId: string;
  studyId: string;
  schemaVersion: number;
  anonymousCode: string | null;
  completionCode: string;
  payloadJson: string;
  userAgent: string | null;
  ipHash: string | null;
  createdAt: number;
}

// ----- STUDIES -----

function rowToStudy(r: Record<string, unknown>): Study {
  return {
    id: String(r.id),
    slug: String(r.slug),
    title: String(r.title),
    description: (r.description as string) ?? null,
    status: r.status as StudyStatus,
    publicListing: Boolean(r.public_listing),
    anonymousCodeTemplate: (r.anonymous_code_template as string) ?? null,
    identityFields: r.identity_fields
      ? String(r.identity_fields).split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    themeJson: (r.theme_json as string) ?? null,
    prolificCompletionUrl: (r.prolific_completion_url as string) ?? null,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    createdBy: (r.created_by as string) ?? null,
  };
}

export async function listStudies(
  db: D1Database,
  opts: { onlyPublic?: boolean; onlyActive?: boolean } = {},
): Promise<Study[]> {
  const conds: string[] = [];
  if (opts.onlyPublic) conds.push("public_listing = 1");
  if (opts.onlyActive) conds.push("status = 'active'");
  const where = conds.length ? "WHERE " + conds.join(" AND ") : "";
  const rs = await db
    .prepare(`SELECT * FROM research_studies ${where} ORDER BY updated_at DESC`)
    .all<Record<string, unknown>>();
  return rs.results.map(rowToStudy);
}

export async function getStudyById(db: D1Database, id: string): Promise<Study | null> {
  const r = await db.prepare("SELECT * FROM research_studies WHERE id = ?").bind(id).first<Record<string, unknown>>();
  return r ? rowToStudy(r) : null;
}

export async function getStudyBySlug(db: D1Database, slug: string): Promise<Study | null> {
  const r = await db.prepare("SELECT * FROM research_studies WHERE slug = ?").bind(slug).first<Record<string, unknown>>();
  return r ? rowToStudy(r) : null;
}

export interface CreateStudyInput {
  slug: string;
  title: string;
  description?: string;
  status?: StudyStatus;
  publicListing?: boolean;
  anonymousCodeTemplate?: string;
  identityFields?: string[];
  themeJson?: string;
}

export async function createStudy(
  db: D1Database,
  input: CreateStudyInput,
  createdBy: string | null,
): Promise<Study> {
  const id = uuid();
  const t = now();
  await db
    .prepare(
      `INSERT INTO research_studies
        (id, slug, title, description, status, public_listing,
         anonymous_code_template, identity_fields, theme_json,
         created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.slug.toLowerCase().trim(),
      input.title.trim(),
      input.description ?? null,
      input.status ?? "draft",
      input.publicListing === false ? 0 : 1,
      input.anonymousCodeTemplate ?? null,
      input.identityFields?.join(",") ?? null,
      input.themeJson ?? null,
      t, t, createdBy,
    )
    .run();
  return (await getStudyById(db, id))!;
}

export interface UpdateStudyInput extends Partial<CreateStudyInput> {}

export async function updateStudy(
  db: D1Database,
  id: string,
  input: UpdateStudyInput,
): Promise<Study | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (input.slug !== undefined) { sets.push("slug = ?"); vals.push(input.slug.toLowerCase().trim()); }
  if (input.title !== undefined) { sets.push("title = ?"); vals.push(input.title.trim()); }
  if (input.description !== undefined) { sets.push("description = ?"); vals.push(input.description); }
  if (input.status !== undefined) { sets.push("status = ?"); vals.push(input.status); }
  if (input.publicListing !== undefined) { sets.push("public_listing = ?"); vals.push(input.publicListing ? 1 : 0); }
  if (input.anonymousCodeTemplate !== undefined) { sets.push("anonymous_code_template = ?"); vals.push(input.anonymousCodeTemplate || null); }
  if (input.identityFields !== undefined) { sets.push("identity_fields = ?"); vals.push(input.identityFields.join(",") || null); }
  if (input.themeJson !== undefined) { sets.push("theme_json = ?"); vals.push(input.themeJson || null); }
  if (sets.length === 0) return getStudyById(db, id);
  sets.push("updated_at = ?");
  vals.push(now());
  vals.push(id);
  await db.prepare(`UPDATE research_studies SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
  return getStudyById(db, id);
}

export async function deleteStudy(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM research_studies WHERE id = ?").bind(id).run();
}

// ----- QUESTIONNAIRES -----

function rowToQuestionnaire(r: Record<string, unknown>): Questionnaire {
  return {
    id: String(r.id),
    studyId: String(r.study_id),
    slug: String(r.slug),
    title: String(r.title),
    description: (r.description as string) ?? null,
    schemaJson: String(r.schema_json),
    position: Number(r.position ?? 0),
    status: r.status as QuestionnaireStatus,
    version: Number(r.version ?? 1),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

export async function listQuestionnaires(
  db: D1Database,
  studyId: string,
  opts: { onlyActive?: boolean } = {},
): Promise<Questionnaire[]> {
  const conds = ["study_id = ?"];
  const vals: unknown[] = [studyId];
  if (opts.onlyActive) conds.push("status = 'active'");
  const rs = await db
    .prepare(`SELECT * FROM research_questionnaires WHERE ${conds.join(" AND ")} ORDER BY position ASC, created_at ASC`)
    .bind(...vals)
    .all<Record<string, unknown>>();
  return rs.results.map(rowToQuestionnaire);
}

export async function getQuestionnaireById(db: D1Database, id: string): Promise<Questionnaire | null> {
  const r = await db.prepare("SELECT * FROM research_questionnaires WHERE id = ?").bind(id).first<Record<string, unknown>>();
  return r ? rowToQuestionnaire(r) : null;
}

export async function getQuestionnaireBySlugs(
  db: D1Database,
  studySlug: string,
  questionnaireSlug: string,
): Promise<{ study: Study; questionnaire: Questionnaire } | null> {
  const study = await getStudyBySlug(db, studySlug);
  if (!study) return null;
  const r = await db
    .prepare("SELECT * FROM research_questionnaires WHERE study_id = ? AND slug = ?")
    .bind(study.id, questionnaireSlug)
    .first<Record<string, unknown>>();
  return r ? { study, questionnaire: rowToQuestionnaire(r) } : null;
}

export interface CreateQuestionnaireInput {
  studyId: string;
  slug: string;
  title: string;
  description?: string;
  schemaJson: string;
  position?: number;
  status?: QuestionnaireStatus;
}

export async function createQuestionnaire(
  db: D1Database,
  input: CreateQuestionnaireInput,
): Promise<Questionnaire> {
  const id = uuid();
  const t = now();
  await db
    .prepare(
      `INSERT INTO research_questionnaires
        (id, study_id, slug, title, description, schema_json,
         position, status, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(
      id,
      input.studyId,
      input.slug.toLowerCase().trim(),
      input.title.trim(),
      input.description ?? null,
      input.schemaJson,
      input.position ?? 0,
      input.status ?? "draft",
      t, t,
    )
    .run();
  return (await getQuestionnaireById(db, id))!;
}

export interface UpdateQuestionnaireInput extends Partial<Omit<CreateQuestionnaireInput, "studyId">> {}

export async function updateQuestionnaire(
  db: D1Database,
  id: string,
  input: UpdateQuestionnaireInput,
): Promise<Questionnaire | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (input.slug !== undefined) { sets.push("slug = ?"); vals.push(input.slug.toLowerCase().trim()); }
  if (input.title !== undefined) { sets.push("title = ?"); vals.push(input.title.trim()); }
  if (input.description !== undefined) { sets.push("description = ?"); vals.push(input.description); }
  if (input.schemaJson !== undefined) {
    sets.push("schema_json = ?", "version = version + 1");
    vals.push(input.schemaJson);
  }
  if (input.position !== undefined) { sets.push("position = ?"); vals.push(input.position); }
  if (input.status !== undefined) { sets.push("status = ?"); vals.push(input.status); }
  if (sets.length === 0) return getQuestionnaireById(db, id);
  sets.push("updated_at = ?");
  vals.push(now());
  vals.push(id);
  await db.prepare(`UPDATE research_questionnaires SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
  return getQuestionnaireById(db, id);
}

export async function deleteQuestionnaire(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM research_questionnaires WHERE id = ?").bind(id).run();
}

// ----- RESPONSES -----

export interface SubmitResponseInput {
  questionnaireId: string;
  payload: Record<string, unknown>;
  userAgent?: string;
  ipHash?: string;
  /** Chiave segreta per l'impronta HMAC del codice (secret RESEARCH_CODE_KEY). */
  codeKey?: string;
}

export interface SubmitResponseResult {
  id: string;
  completionCode: string;
  anonymousCode: string | null;
  /** true se il codice di completamento è salvato a parte, senza legami con la risposta. */
  unlinked: boolean;
}

/**
 * Opzioni di anonimato lette dallo schema del questionario:
 * - nx_no_client_meta: niente user agent né hash dell'IP;
 * - nx_code_hmac: il codice di abbinamento si salva solo come impronta HMAC-SHA256 con
 *   la chiave segreta del server (16 caratteri esadecimali), più in `_code_parziali` le
 *   impronte con un elemento alla volta mascherato (abbinamento con un errore); i campi
 *   identitari dello studio non si salvano;
 * - nx_drop_fields: altri campi del payload da non salvare;
 * - nx_unlinked_completion_code: il codice di completamento va in research_completion_codes
 *   (solo codice, studio, questionario e classe), la risposta ha completion_code vuoto;
 * - nx_coarse_timestamp: created_at troncato al giorno (UTC).
 */
interface PrivacyOptions {
  noClientMeta: boolean;
  codeHmac: boolean;
  dropFields: string[];
  unlinkedCompletion: boolean;
  coarseTimestamp: boolean;
}

function privacyOptions(schemaJson: string): PrivacyOptions {
  let sch: Record<string, unknown> = {};
  try { sch = JSON.parse(schemaJson) ?? {}; } catch {}
  return {
    noClientMeta: sch.nx_no_client_meta === true,
    codeHmac: sch.nx_code_hmac === true,
    dropFields: Array.isArray(sch.nx_drop_fields) ? sch.nx_drop_fields.map(String) : [],
    unlinkedCompletion: sch.nx_unlinked_completion_code === true,
    coarseTimestamp: sch.nx_coarse_timestamp === true,
  };
}

async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Genera un anonymous code dal template e dai valori dei campi identitari.
 * Esempio: template "M{birthDay}V{phoneFirst2}", payload {birthDay: "15", phoneFirst2: "34"}
 *   -> "M15V34"
 */
function buildAnonymousCode(
  template: string | null,
  identityFields: string[],
  payload: Record<string, unknown>,
): string | null {
  if (!template) return null;
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = payload[k];
    return v == null ? "" : String(v);
  });
}

// Alfabeto Crockford base32 senza ambigui (no I/L/O/U), case insensitive.
// 8 caratteri = 32^8 = 2^40 ≈ 10^12 valori → collisione trascurabile.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

function generateCompletionCode(): string {
  // NX-XXXX-YYYY usando 8 caratteri random dal nostro alfabeto.
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `NX-${out.slice(0, 4)}-${out.slice(4, 8)}`;
}

export async function submitResponse(
  db: D1Database,
  input: SubmitResponseInput,
): Promise<SubmitResponseResult | { error: string }> {
  // Carica questionario + studio
  const q = await getQuestionnaireById(db, input.questionnaireId);
  if (!q) return { error: "Questionario non trovato" };
  if (q.status !== "active") return { error: "Questionario non attivo" };
  const study = await getStudyById(db, q.studyId);
  if (!study) return { error: "Studio non trovato" };
  if (study.status !== "active") return { error: "Studio non attivo" };

  const opts = privacyOptions(q.schemaJson);
  const payload: Record<string, unknown> = { ...input.payload };

  let anonymousCode: string | null;
  if (opts.codeHmac) {
    const key = input.codeKey;
    if (!key) return { error: "Configurazione incompleta: manca la chiave del codice" };
    const parts = study.identityFields.map((f) => String(payload[f] ?? "").trim().toUpperCase());
    const msg = (xs: string[]) => study.id + "|" + xs.join("|");
    anonymousCode = (await hmacHex(key, msg(parts))).slice(0, 16);
    payload._code_parziali = await Promise.all(
      parts.map(async (_, i) =>
        (await hmacHex(key, msg(parts.map((x, j) => (j === i ? "*" : x))))).slice(0, 12),
      ),
    );
    for (const f of study.identityFields) delete payload[f];
  } else {
    anonymousCode = buildAnonymousCode(study.anonymousCodeTemplate, study.identityFields, payload);
  }
  for (const f of opts.dropFields) delete payload[f];

  const completionCode = generateCompletionCode();
  const id = uuid();
  const t = opts.coarseTimestamp ? Math.floor(now() / 86_400_000) * 86_400_000 : now();
  const insertResponse = db
    .prepare(
      `INSERT INTO research_responses
        (id, questionnaire_id, study_id, schema_version,
         anonymous_code, completion_code, payload_json,
         user_agent, ip_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id, q.id, study.id, q.version,
      anonymousCode, opts.unlinkedCompletion ? "" : completionCode,
      JSON.stringify(payload),
      opts.noClientMeta ? null : input.userAgent ?? null,
      opts.noClientMeta ? null : input.ipHash ?? null,
      t,
    );
  if (opts.unlinkedCompletion) {
    const context = typeof payload.context === "string" ? payload.context.slice(0, 64) : null;
    await db.batch([
      insertResponse,
      db.prepare(
        "INSERT INTO research_completion_codes (code, study_id, questionnaire_id, context) VALUES (?, ?, ?, ?)",
      ).bind(completionCode, study.id, q.id, context),
    ]);
  } else {
    await insertResponse.run();
  }
  return { id, completionCode, anonymousCode, unlinked: opts.unlinkedCompletion };
}

export async function listResponses(
  db: D1Database,
  studyId: string,
  opts: { questionnaireId?: string; limit?: number } = {},
): Promise<Response[]> {
  const conds = ["study_id = ?"];
  const vals: unknown[] = [studyId];
  if (opts.questionnaireId) { conds.push("questionnaire_id = ?"); vals.push(opts.questionnaireId); }
  const limit = Math.min(opts.limit ?? 1000, 5000);
  const rs = await db
    // id come secondo criterio: a parità di data (nx_coarse_timestamp) l'ordine è casuale,
    // non quello di arrivo.
    .prepare(`SELECT * FROM research_responses WHERE ${conds.join(" AND ")} ORDER BY created_at DESC, id LIMIT ?`)
    .bind(...vals, limit)
    .all<Record<string, unknown>>();
  return rs.results.map(rowToResponse);
}

function rowToResponse(r: Record<string, unknown>): Response {
  return {
    id: String(r.id),
    questionnaireId: String(r.questionnaire_id),
    studyId: String(r.study_id),
    schemaVersion: Number(r.schema_version),
    anonymousCode: (r.anonymous_code as string) ?? null,
    completionCode: String(r.completion_code),
    payloadJson: String(r.payload_json),
    userAgent: (r.user_agent as string) ?? null,
    ipHash: (r.ip_hash as string) ?? null,
    createdAt: Number(r.created_at),
  };
}

export async function countResponses(
  db: D1Database,
  studyId: string,
): Promise<Array<{ questionnaireId: string; count: number }>> {
  const rs = await db
    .prepare(
      `SELECT questionnaire_id, COUNT(*) as c FROM research_responses
       WHERE study_id = ? GROUP BY questionnaire_id`,
    )
    .bind(studyId)
    .all<{ questionnaire_id: string; c: number }>();
  return rs.results.map((r) => ({ questionnaireId: r.questionnaire_id, count: r.c }));
}

export async function getResponseById(
  db: D1Database,
  studyId: string,
  id: string,
): Promise<Response | null> {
  const r = await db
    .prepare("SELECT * FROM research_responses WHERE study_id = ? AND id = ?")
    .bind(studyId, id)
    .first<Record<string, unknown>>();
  return r ? rowToResponse(r) : null;
}

export async function getResponseByCompletionCode(
  db: D1Database,
  studyId: string,
  code: string,
): Promise<Response | null> {
  const r = await db
    .prepare("SELECT * FROM research_responses WHERE study_id = ? AND completion_code = ?")
    .bind(studyId, code)
    .first<Record<string, unknown>>();
  return r ? rowToResponse(r) : null;
}

/** Codice di completamento salvato a parte (nx_unlinked_completion_code). */
export async function getUnlinkedCompletionCode(
  db: D1Database,
  studyId: string,
  code: string,
): Promise<{ questionnaireId: string; context: string | null } | null> {
  const r = await db
    .prepare("SELECT questionnaire_id, context FROM research_completion_codes WHERE study_id = ? AND code = ?")
    .bind(studyId, code)
    .first<{ questionnaire_id: string; context: string | null }>();
  return r ? { questionnaireId: r.questionnaire_id, context: r.context } : null;
}

// ----- ACCESSO IN LETTURA (committenti) -----
// Gli admin vedono tutti gli studi; gli altri soci solo quelli elencati in
// research_study_viewers (migrazione 0066), a uno di due livelli:
// - "aggregati": conteggi per classe e verifica dei codici di completamento;
// - "risposte": anche le singole risposte e il CSV.

export type StudyAccess = "admin" | "risposte" | "aggregati";

export async function studyAccess(
  db: D1Database,
  user: { id: string; role: string } | null,
  studyId: string,
): Promise<StudyAccess | null> {
  if (!user) return null;
  if (user.role === "admin") return "admin";
  const r = await db
    .prepare("SELECT access_level FROM research_study_viewers WHERE study_id = ? AND user_id = ?")
    .bind(studyId, user.id)
    .first<{ access_level: string }>();
  if (!r) return null;
  return r.access_level === "risposte" ? "risposte" : "aggregati";
}

export async function listViewerStudies(db: D1Database, userId: string): Promise<Study[]> {
  const rs = await db
    .prepare(
      `SELECT s.* FROM research_studies s
       JOIN research_study_viewers v ON v.study_id = s.id
       WHERE v.user_id = ? ORDER BY s.updated_at DESC`,
    )
    .bind(userId)
    .all<Record<string, unknown>>();
  return rs.results.map(rowToStudy);
}

/**
 * Calcola SHA-256 di una stringa (per hash IP).
 */
export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
