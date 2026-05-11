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
}

export interface SubmitResponseResult {
  id: string;
  completionCode: string;
  anonymousCode: string | null;
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

function generateCompletionCode(): string {
  // GR-XXXX-YYYY (8 char esadecimali in 2 gruppi)
  const a = secureToken(2).replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase().padEnd(4, "0");
  const b = secureToken(2).replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase().padEnd(4, "0");
  return `NX-${a}-${b}`;
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

  const anonymousCode = buildAnonymousCode(
    study.anonymousCodeTemplate,
    study.identityFields,
    input.payload,
  );
  const completionCode = generateCompletionCode();
  const id = uuid();
  const t = now();
  await db
    .prepare(
      `INSERT INTO research_responses
        (id, questionnaire_id, study_id, schema_version,
         anonymous_code, completion_code, payload_json,
         user_agent, ip_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id, q.id, study.id, q.version,
      anonymousCode, completionCode,
      JSON.stringify(input.payload),
      input.userAgent ?? null,
      input.ipHash ?? null,
      t,
    )
    .run();
  return { id, completionCode, anonymousCode };
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
    .prepare(`SELECT * FROM research_responses WHERE ${conds.join(" AND ")} ORDER BY created_at DESC LIMIT ?`)
    .bind(...vals, limit)
    .all<Record<string, unknown>>();
  return rs.results.map((r) => ({
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
  }));
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

/**
 * Calcola SHA-256 di una stringa (per hash IP).
 */
export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
