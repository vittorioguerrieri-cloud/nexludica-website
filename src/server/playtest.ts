/**
 * Playtest Platform: CRUD + helpers per giochi, sessioni, dati raccolti.
 *
 * Modello (vedi migration 0021):
 *   Game -> Sessions -> { Players, Turns, PhaseTimes, ChecklistInstances,
 *                         Observations, Distractions, OmniComments }
 *
 * Le query mirror il pattern di src/server/research.ts: row-to-object
 * converter, list/get/create/update/delete + helper per dati aggregati.
 */
import { now, uuid } from "./db";

export type GameStatus = "active" | "archived";
export type SessionStatus = "planned" | "in_progress" | "completed" | "archived";
export type ChecklistPhase = "setup" | "inizio" | "fine" | "partecipata";
export type ChecklistApplies = "observation" | "setup";
export type ObservationCategory =
  | "variabili_visibili"
  | "variabili_invisibili"
  | "equita"
  | "lamentele";
export type OmniCategory = "ottimo" | "modificare" | "non_chiaro" | "idee_nuove";

export interface TeamConfig {
  name: string;
}

export interface ProcedureConfig {
  /** Quali fasi di checklist osservazionale sono abilitate (Inizio/Fine/Partecipata/Set-up). */
  phases?: ChecklistPhase[];
  /** Label personalizzati per i 2 score per turno (modalità individuale). */
  points_label_1?: string;
  points_label_2?: string;
  /** Se true mostra il tag esperienza Nuovo/Esperto. */
  track_experience?: boolean;
  /** Moduli abilitati nella v1: timer, checklist, omni, observations. */
  modules?: Array<"timer" | "checklist" | "omni" | "observations" | "scales">;
  /**
   * Se true, il gioco è a squadre: i punti vanno alle squadre invece che ai
   * singoli giocatori. Default false (= modalità individuale).
   */
  is_team_game?: boolean;
  /**
   * Squadre (rilevante solo se is_team_game=true).
   * Lunghezza variabile: minimo 2, massimo 12 (limite UI).
   * I giocatori possono essere distribuiti in modo non uniforme — non c'è
   * vincolo di "squadre con stesso numero di membri".
   */
  teams?: TeamConfig[];
}

export const DEFAULT_PROCEDURE: ProcedureConfig = {
  phases: ["setup", "inizio", "fine", "partecipata"],
  points_label_1: "Punti 1",
  points_label_2: "Punti 2",
  track_experience: true,
  modules: ["timer", "checklist", "omni", "observations"],
  is_team_game: false,
  teams: [{ name: "Squadra A" }, { name: "Squadra B" }],
};

export interface Game {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  designers: string | null;
  playersMin: number | null;
  playersMax: number | null;
  durationMinMinutes: number | null;
  durationMaxMinutes: number | null;
  minAge: number | null;
  coverUrl: string | null;
  procedureConfig: ProcedureConfig;
  accessibilityCheck: Record<string, unknown> | null;
  status: GameStatus;
  driveFolderId: string | null;
  createdAt: number;
  updatedAt: number;
  createdBy: string | null;
}

export type GameFileKind = "rules" | "design_doc" | "asset" | "other";

export interface GameFile {
  id: string;
  gameId: string;
  driveFileId: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  webViewLink: string | null;
  kind: GameFileKind;
  description: string | null;
  uploadedAt: number;
  uploadedBy: string | null;
}

export interface ReportEntry {
  problema: string;
  soluzione: string;
}
export interface ReportData {
  criticita?: ReportEntry[];
  cose_poco_chiare?: ReportEntry[];
  narrative_summary?: string;
}

export interface Session {
  id: string;
  gameId: string;
  label: string;
  playedAt: string | null;
  location: string | null;
  notes: string | null;
  status: SessionStatus;
  totalMinutes: number | null;
  perceivedMinutes: number | null;
  flowScore: number | null;
  gradimentoMean: number | null;
  gradimentoSd: number | null;
  /** Override dei nomi squadre per questa sessione (vs. cfg.teams del gioco). */
  teamsOverride: TeamConfig[] | null;
  /** Dati del report finale compilato in fase di debriefing. */
  reportData: ReportData | null;
  createdAt: number;
  updatedAt: number;
  createdBy: string | null;
}

export interface ReportSuggestion {
  id: string;
  category: "criticita" | "cose_poco_chiare";
  problema: string;
  soluzione: string;
  tags: string[];
  position: number;
}

export interface Player {
  id: string;
  sessionId: string;
  displayName: string;
  role: string | null;
  experience: string | null;
  realName: string | null;
  notes: string | null;
  position: number;
  /** Indice squadra (0/1) per giochi a squadre; NULL per individuali. */
  teamIndex: number | null;
}

export interface PhaseTime {
  id: string;
  sessionId: string;
  name: string;
  minutes: number;
  position: number;
  createdAt: number;
}

export interface Turn {
  id: string;
  sessionId: string;
  round: number;
  playerId: string | null;
  durationSeconds: number;
  /** Punti primari del turno (giocatore di turno in modalità individuale, o delta squadra 0 in team mode legacy a 2 squadre). */
  points1: number | null;
  /** Punti secondari (individuale) o delta squadra 1 (team mode legacy a 2 squadre). */
  points2: number | null;
  /**
   * Per giochi a N squadre: array dei delta per ogni squadra, indicizzato 0..N-1.
   * Quando presente prevale su points1/points2 in team mode.
   */
  teamPoints: number[] | null;
  event: string | null;
  recordedAt: number;
  /** ID utente che ha registrato il turno (null per record storici importati). */
  recordedBy: string | null;
}

export interface ChecklistItem {
  id: string;
  gameId: string | null;
  category: string;
  subcategory: string | null;
  text: string;
  appliesTo: ChecklistApplies;
  position: number;
  active: boolean;
}

export interface ChecklistInstance {
  id: string;
  sessionId: string;
  phase: ChecklistPhase;
  observerUserId: string | null;
  observerName: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ChecklistResponse {
  id: string;
  instanceId: string;
  itemId: string;
  score: number | null;
  comment: string | null;
}

export interface Observation {
  id: string;
  sessionId: string;
  category: ObservationCategory;
  text: string;
  recordedAt: number;
  recordedBy: string | null;
}

export interface Distraction {
  id: string;
  sessionId: string;
  type: string;
  count: number;
}

export interface OmniComment {
  id: string;
  sessionId: string;
  category: OmniCategory;
  text: string;
  authorName: string | null;
  recordedAt: number;
  recordedBy: string | null;
}

// ----- Row converters -----

function parseJson<T>(v: unknown, fallback: T): T {
  if (!v) return fallback;
  try {
    return JSON.parse(String(v)) as T;
  } catch {
    return fallback;
  }
}

function rowToGame(r: Record<string, unknown>): Game {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    shortDescription: (r.short_description as string) ?? null,
    description: (r.description as string) ?? null,
    designers: (r.designers as string) ?? null,
    playersMin: r.players_min != null ? Number(r.players_min) : null,
    playersMax: r.players_max != null ? Number(r.players_max) : null,
    durationMinMinutes: r.duration_min_minutes != null ? Number(r.duration_min_minutes) : null,
    durationMaxMinutes: r.duration_max_minutes != null ? Number(r.duration_max_minutes) : null,
    minAge: r.min_age != null ? Number(r.min_age) : null,
    coverUrl: (r.cover_url as string) ?? null,
    procedureConfig: { ...DEFAULT_PROCEDURE, ...parseJson<ProcedureConfig>(r.procedure_config, {}) },
    accessibilityCheck: parseJson<Record<string, unknown> | null>(r.accessibility_check, null),
    status: r.status as GameStatus,
    driveFolderId: (r.drive_folder_id as string) ?? null,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    createdBy: (r.created_by as string) ?? null,
  };
}

function rowToGameFile(r: Record<string, unknown>): GameFile {
  return {
    id: String(r.id),
    gameId: String(r.game_id),
    driveFileId: String(r.drive_file_id),
    name: String(r.name),
    mimeType: (r.mime_type as string) ?? null,
    sizeBytes: r.size_bytes != null ? Number(r.size_bytes) : null,
    webViewLink: (r.web_view_link as string) ?? null,
    kind: (r.kind as GameFileKind) ?? "other",
    description: (r.description as string) ?? null,
    uploadedAt: Number(r.uploaded_at),
    uploadedBy: (r.uploaded_by as string) ?? null,
  };
}

function rowToSession(r: Record<string, unknown>): Session {
  return {
    id: String(r.id),
    gameId: String(r.game_id),
    label: String(r.label),
    playedAt: (r.played_at as string) ?? null,
    location: (r.location as string) ?? null,
    notes: (r.notes as string) ?? null,
    status: r.status as SessionStatus,
    totalMinutes: r.total_minutes != null ? Number(r.total_minutes) : null,
    perceivedMinutes: r.perceived_minutes != null ? Number(r.perceived_minutes) : null,
    flowScore: r.flow_score != null ? Number(r.flow_score) : null,
    gradimentoMean: r.gradimento_mean != null ? Number(r.gradimento_mean) : null,
    gradimentoSd: r.gradimento_sd != null ? Number(r.gradimento_sd) : null,
    teamsOverride: parseJson<TeamConfig[] | null>(r.teams_override_json, null),
    reportData: parseJson<ReportData | null>(r.report_data_json, null),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    createdBy: (r.created_by as string) ?? null,
  };
}

function rowToPlayer(r: Record<string, unknown>): Player {
  return {
    id: String(r.id),
    sessionId: String(r.session_id),
    displayName: String(r.display_name),
    role: (r.role as string) ?? null,
    experience: (r.experience as string) ?? null,
    realName: (r.real_name as string) ?? null,
    notes: (r.notes as string) ?? null,
    position: Number(r.position ?? 0),
    teamIndex: r.team_index != null ? Number(r.team_index) : null,
  };
}

function rowToTurn(r: Record<string, unknown>): Turn {
  let teamPoints: number[] | null = null;
  if (r.team_points_json) {
    try {
      const arr = JSON.parse(String(r.team_points_json));
      if (Array.isArray(arr)) teamPoints = arr.map((v) => Number(v) || 0);
    } catch { teamPoints = null; }
  }
  return {
    id: String(r.id),
    sessionId: String(r.session_id),
    round: Number(r.round),
    playerId: (r.player_id as string) ?? null,
    durationSeconds: Number(r.duration_seconds),
    points1: r.points_1 != null ? Number(r.points_1) : null,
    points2: r.points_2 != null ? Number(r.points_2) : null,
    teamPoints,
    event: (r.event as string) ?? null,
    recordedAt: Number(r.recorded_at),
    recordedBy: (r.recorded_by as string) ?? null,
  };
}

function rowToPhaseTime(r: Record<string, unknown>): PhaseTime {
  return {
    id: String(r.id),
    sessionId: String(r.session_id),
    name: String(r.name),
    minutes: Number(r.minutes),
    position: Number(r.position ?? 0),
    createdAt: Number(r.created_at),
  };
}

function rowToChecklistItem(r: Record<string, unknown>): ChecklistItem {
  return {
    id: String(r.id),
    gameId: (r.game_id as string) ?? null,
    category: String(r.category),
    subcategory: (r.subcategory as string) ?? null,
    text: String(r.text),
    appliesTo: r.applies_to as ChecklistApplies,
    position: Number(r.position ?? 0),
    active: Boolean(r.active),
  };
}

function rowToChecklistInstance(r: Record<string, unknown>): ChecklistInstance {
  return {
    id: String(r.id),
    sessionId: String(r.session_id),
    phase: r.phase as ChecklistPhase,
    observerUserId: (r.observer_user_id as string) ?? null,
    observerName: (r.observer_name as string) ?? null,
    notes: (r.notes as string) ?? null,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

function rowToChecklistResponse(r: Record<string, unknown>): ChecklistResponse {
  return {
    id: String(r.id),
    instanceId: String(r.instance_id),
    itemId: String(r.item_id),
    score: r.score != null ? Number(r.score) : null,
    comment: (r.comment as string) ?? null,
  };
}

function rowToObservation(r: Record<string, unknown>): Observation {
  return {
    id: String(r.id),
    sessionId: String(r.session_id),
    category: r.category as ObservationCategory,
    text: String(r.text),
    recordedAt: Number(r.recorded_at),
    recordedBy: (r.recorded_by as string) ?? null,
  };
}

function rowToOmniComment(r: Record<string, unknown>): OmniComment {
  return {
    id: String(r.id),
    sessionId: String(r.session_id),
    category: r.category as OmniCategory,
    text: String(r.text),
    authorName: (r.author_name as string) ?? null,
    recordedAt: Number(r.recorded_at),
    recordedBy: (r.recorded_by as string) ?? null,
  };
}

// ----- GAMES -----

export function slugifyGameName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function listGames(
  db: D1Database,
  opts: { onlyActive?: boolean } = {},
): Promise<Game[]> {
  const sql = opts.onlyActive
    ? "SELECT * FROM playtest_games WHERE status = 'active' ORDER BY updated_at DESC"
    : "SELECT * FROM playtest_games ORDER BY status ASC, updated_at DESC";
  const { results } = await db.prepare(sql).all();
  return (results ?? []).map((r) => rowToGame(r as Record<string, unknown>));
}

export async function getGameBySlug(db: D1Database, slug: string): Promise<Game | null> {
  const r = await db.prepare("SELECT * FROM playtest_games WHERE slug = ?").bind(slug).first();
  return r ? rowToGame(r as Record<string, unknown>) : null;
}

export async function getGameById(db: D1Database, id: string): Promise<Game | null> {
  const r = await db.prepare("SELECT * FROM playtest_games WHERE id = ?").bind(id).first();
  return r ? rowToGame(r as Record<string, unknown>) : null;
}

export async function createGame(
  db: D1Database,
  data: {
    slug: string;
    name: string;
    shortDescription?: string | null;
    description?: string | null;
    designers?: string | null;
    playersMin?: number | null;
    playersMax?: number | null;
    durationMinMinutes?: number | null;
    durationMaxMinutes?: number | null;
    minAge?: number | null;
    procedureConfig?: ProcedureConfig;
    createdBy?: string | null;
  },
): Promise<Game> {
  const id = uuid();
  const ts = now();
  const cfg = JSON.stringify({ ...DEFAULT_PROCEDURE, ...(data.procedureConfig ?? {}) });
  await db
    .prepare(
      `INSERT INTO playtest_games (id, slug, name, short_description, description, designers,
         players_min, players_max, duration_min_minutes, duration_max_minutes, min_age,
         procedure_config, status, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    )
    .bind(
      id,
      data.slug,
      data.name,
      data.shortDescription ?? null,
      data.description ?? null,
      data.designers ?? null,
      data.playersMin ?? null,
      data.playersMax ?? null,
      data.durationMinMinutes ?? null,
      data.durationMaxMinutes ?? null,
      data.minAge ?? null,
      cfg,
      ts,
      ts,
      data.createdBy ?? null,
    )
    .run();
  const game = await getGameById(db, id);
  if (!game) throw new Error("createGame: failed to read back");
  return game;
}

export async function updateGame(
  db: D1Database,
  id: string,
  patch: Partial<{
    name: string;
    shortDescription: string | null;
    description: string | null;
    designers: string | null;
    playersMin: number | null;
    playersMax: number | null;
    durationMinMinutes: number | null;
    durationMaxMinutes: number | null;
    minAge: number | null;
    procedureConfig: ProcedureConfig;
    status: GameStatus;
    driveFolderId: string | null;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const args: unknown[] = [];
  if (patch.name !== undefined) { sets.push("name = ?"); args.push(patch.name); }
  if (patch.shortDescription !== undefined) { sets.push("short_description = ?"); args.push(patch.shortDescription); }
  if (patch.description !== undefined) { sets.push("description = ?"); args.push(patch.description); }
  if (patch.designers !== undefined) { sets.push("designers = ?"); args.push(patch.designers); }
  if (patch.playersMin !== undefined) { sets.push("players_min = ?"); args.push(patch.playersMin); }
  if (patch.playersMax !== undefined) { sets.push("players_max = ?"); args.push(patch.playersMax); }
  if (patch.durationMinMinutes !== undefined) { sets.push("duration_min_minutes = ?"); args.push(patch.durationMinMinutes); }
  if (patch.durationMaxMinutes !== undefined) { sets.push("duration_max_minutes = ?"); args.push(patch.durationMaxMinutes); }
  if (patch.minAge !== undefined) { sets.push("min_age = ?"); args.push(patch.minAge); }
  if (patch.procedureConfig !== undefined) {
    sets.push("procedure_config = ?");
    args.push(JSON.stringify(patch.procedureConfig));
  }
  if (patch.status !== undefined) { sets.push("status = ?"); args.push(patch.status); }
  if (patch.driveFolderId !== undefined) { sets.push("drive_folder_id = ?"); args.push(patch.driveFolderId); }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  args.push(now());
  args.push(id);
  await db.prepare(`UPDATE playtest_games SET ${sets.join(", ")} WHERE id = ?`).bind(...args).run();
}

// ----- GAME FILES -----

export async function listGameFiles(db: D1Database, gameId: string): Promise<GameFile[]> {
  const { results } = await db
    .prepare("SELECT * FROM playtest_game_files WHERE game_id = ? ORDER BY uploaded_at DESC")
    .bind(gameId)
    .all();
  return (results ?? []).map((r) => rowToGameFile(r as Record<string, unknown>));
}

export async function addGameFile(
  db: D1Database,
  data: {
    gameId: string;
    driveFileId: string;
    name: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    webViewLink?: string | null;
    kind?: GameFileKind;
    description?: string | null;
    uploadedBy?: string | null;
  },
): Promise<GameFile> {
  const id = uuid();
  const ts = now();
  await db
    .prepare(
      `INSERT INTO playtest_game_files (id, game_id, drive_file_id, name, mime_type, size_bytes,
         web_view_link, kind, description, uploaded_at, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      data.gameId,
      data.driveFileId,
      data.name,
      data.mimeType ?? null,
      data.sizeBytes ?? null,
      data.webViewLink ?? null,
      data.kind ?? "other",
      data.description ?? null,
      ts,
      data.uploadedBy ?? null,
    )
    .run();
  const r = await db.prepare("SELECT * FROM playtest_game_files WHERE id = ?").bind(id).first();
  if (!r) throw new Error("addGameFile failed");
  return rowToGameFile(r as Record<string, unknown>);
}

export async function getGameFileById(db: D1Database, id: string): Promise<GameFile | null> {
  const r = await db.prepare("SELECT * FROM playtest_game_files WHERE id = ?").bind(id).first();
  return r ? rowToGameFile(r as Record<string, unknown>) : null;
}

export async function deleteGameFile(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM playtest_game_files WHERE id = ?").bind(id).run();
}

// ----- SESSIONS -----

export async function listSessions(db: D1Database, gameId: string): Promise<Session[]> {
  const { results } = await db
    .prepare(
      "SELECT * FROM playtest_sessions WHERE game_id = ? ORDER BY COALESCE(played_at, '') DESC, created_at DESC",
    )
    .bind(gameId)
    .all();
  return (results ?? []).map((r) => rowToSession(r as Record<string, unknown>));
}

export async function getSession(db: D1Database, id: string): Promise<Session | null> {
  const r = await db.prepare("SELECT * FROM playtest_sessions WHERE id = ?").bind(id).first();
  return r ? rowToSession(r as Record<string, unknown>) : null;
}

export async function createSession(
  db: D1Database,
  data: {
    gameId: string;
    label: string;
    playedAt?: string | null;
    location?: string | null;
    notes?: string | null;
    createdBy?: string | null;
  },
): Promise<Session> {
  const id = uuid();
  const ts = now();
  await db
    .prepare(
      `INSERT INTO playtest_sessions (id, game_id, label, played_at, location, notes,
         status, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?)`,
    )
    .bind(
      id,
      data.gameId,
      data.label,
      data.playedAt ?? null,
      data.location ?? null,
      data.notes ?? null,
      ts,
      ts,
      data.createdBy ?? null,
    )
    .run();
  const s = await getSession(db, id);
  if (!s) throw new Error("createSession: failed to read back");
  return s;
}

export async function updateSession(
  db: D1Database,
  id: string,
  patch: Partial<{
    label: string;
    playedAt: string | null;
    location: string | null;
    notes: string | null;
    status: SessionStatus;
    teamsOverride: TeamConfig[] | null;
    reportData: ReportData | null;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const args: unknown[] = [];
  if (patch.label !== undefined) { sets.push("label = ?"); args.push(patch.label); }
  if (patch.playedAt !== undefined) { sets.push("played_at = ?"); args.push(patch.playedAt); }
  if (patch.location !== undefined) { sets.push("location = ?"); args.push(patch.location); }
  if (patch.notes !== undefined) { sets.push("notes = ?"); args.push(patch.notes); }
  if (patch.status !== undefined) { sets.push("status = ?"); args.push(patch.status); }
  if (patch.teamsOverride !== undefined) {
    sets.push("teams_override_json = ?");
    args.push(patch.teamsOverride && patch.teamsOverride.length > 0 ? JSON.stringify(patch.teamsOverride) : null);
  }
  if (patch.reportData !== undefined) {
    sets.push("report_data_json = ?");
    args.push(patch.reportData ? JSON.stringify(patch.reportData) : null);
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  args.push(now());
  args.push(id);
  await db.prepare(`UPDATE playtest_sessions SET ${sets.join(", ")} WHERE id = ?`).bind(...args).run();
}

// ----- REPORT SUGGESTIONS -----

function rowToSuggestion(r: Record<string, unknown>): ReportSuggestion {
  return {
    id: String(r.id),
    category: r.category as "criticita" | "cose_poco_chiare",
    problema: String(r.problema),
    soluzione: String(r.soluzione),
    tags: r.tags ? String(r.tags).split(",").map((s) => s.trim()).filter(Boolean) : [],
    position: Number(r.position ?? 0),
  };
}

export async function listReportSuggestions(db: D1Database): Promise<ReportSuggestion[]> {
  const { results } = await db
    .prepare("SELECT * FROM playtest_report_suggestions WHERE active = 1 ORDER BY category, position ASC")
    .all();
  return (results ?? []).map((r) => rowToSuggestion(r as Record<string, unknown>));
}

export async function deleteSession(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM playtest_sessions WHERE id = ?").bind(id).run();
}

// ----- PLAYERS -----

export async function listPlayers(db: D1Database, sessionId: string): Promise<Player[]> {
  const { results } = await db
    .prepare(
      "SELECT * FROM playtest_players WHERE session_id = ? ORDER BY position ASC, rowid ASC",
    )
    .bind(sessionId)
    .all();
  return (results ?? []).map((r) => rowToPlayer(r as Record<string, unknown>));
}

export async function addPlayer(
  db: D1Database,
  data: {
    sessionId: string;
    displayName: string;
    role?: string | null;
    experience?: string | null;
    realName?: string | null;
    notes?: string | null;
    position?: number;
    teamIndex?: number | null;
  },
): Promise<Player> {
  const id = uuid();
  await db
    .prepare(
      `INSERT INTO playtest_players (id, session_id, display_name, role, experience, real_name, notes, position, team_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      data.sessionId,
      data.displayName,
      data.role ?? null,
      data.experience ?? null,
      data.realName ?? null,
      data.notes ?? null,
      data.position ?? 0,
      data.teamIndex ?? null,
    )
    .run();
  const r = await db.prepare("SELECT * FROM playtest_players WHERE id = ?").bind(id).first();
  if (!r) throw new Error("addPlayer failed");
  return rowToPlayer(r as Record<string, unknown>);
}

export async function deletePlayer(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM playtest_players WHERE id = ?").bind(id).run();
}

// ----- TURNS -----

export async function listTurns(db: D1Database, sessionId: string): Promise<Turn[]> {
  const { results } = await db
    .prepare(
      "SELECT * FROM playtest_turns WHERE session_id = ? ORDER BY round ASC, recorded_at ASC",
    )
    .bind(sessionId)
    .all();
  return (results ?? []).map((r) => rowToTurn(r as Record<string, unknown>));
}

export async function addTurn(
  db: D1Database,
  data: {
    sessionId: string;
    round: number;
    playerId: string | null;
    durationSeconds: number;
    points1?: number | null;
    points2?: number | null;
    teamPoints?: number[] | null;
    event?: string | null;
    recordedBy?: string | null;
  },
): Promise<Turn> {
  const id = uuid();
  const ts = now();
  // Per backward-compat con N=2 team / individuale, scriviamo anche points_1/2
  // come "spaccato" del team_points_json (i primi due elementi).
  let p1 = data.points1 ?? null;
  let p2 = data.points2 ?? null;
  if (data.teamPoints && data.teamPoints.length > 0) {
    if (p1 == null && data.teamPoints[0] != null) p1 = data.teamPoints[0];
    if (p2 == null && data.teamPoints[1] != null) p2 = data.teamPoints[1];
  }
  await db
    .prepare(
      `INSERT INTO playtest_turns (id, session_id, round, player_id, duration_seconds, points_1, points_2, team_points_json, event, recorded_at, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      data.sessionId,
      data.round,
      data.playerId,
      Math.max(0, Math.round(data.durationSeconds)),
      p1,
      p2,
      data.teamPoints && data.teamPoints.length > 0 ? JSON.stringify(data.teamPoints) : null,
      data.event ?? null,
      ts,
      data.recordedBy ?? null,
    )
    .run();
  const r = await db.prepare("SELECT * FROM playtest_turns WHERE id = ?").bind(id).first();
  if (!r) throw new Error("addTurn failed");
  return rowToTurn(r as Record<string, unknown>);
}

export async function deleteTurn(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM playtest_turns WHERE id = ?").bind(id).run();
}

export async function getTurn(db: D1Database, id: string): Promise<Turn | null> {
  const r = await db.prepare("SELECT * FROM playtest_turns WHERE id = ?").bind(id).first();
  return r ? rowToTurn(r as Record<string, unknown>) : null;
}

export async function updateTurn(
  db: D1Database,
  id: string,
  patch: Partial<{
    round: number;
    playerId: string | null;
    durationSeconds: number;
    points1: number | null;
    points2: number | null;
    teamPoints: number[] | null;
    event: string | null;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const args: unknown[] = [];
  if (patch.round !== undefined) { sets.push("round = ?"); args.push(patch.round); }
  if (patch.playerId !== undefined) { sets.push("player_id = ?"); args.push(patch.playerId); }
  if (patch.durationSeconds !== undefined) { sets.push("duration_seconds = ?"); args.push(Math.max(0, Math.round(patch.durationSeconds))); }
  if (patch.points1 !== undefined) { sets.push("points_1 = ?"); args.push(patch.points1); }
  if (patch.points2 !== undefined) { sets.push("points_2 = ?"); args.push(patch.points2); }
  if (patch.teamPoints !== undefined) {
    sets.push("team_points_json = ?");
    args.push(patch.teamPoints && patch.teamPoints.length > 0 ? JSON.stringify(patch.teamPoints) : null);
    // Sincronizza anche points_1/2 con i primi 2 valori (se non già patchati esplicitamente)
    if (patch.teamPoints && patch.points1 === undefined) {
      sets.push("points_1 = ?");
      args.push(patch.teamPoints[0] ?? null);
    }
    if (patch.teamPoints && patch.points2 === undefined) {
      sets.push("points_2 = ?");
      args.push(patch.teamPoints[1] ?? null);
    }
  }
  if (patch.event !== undefined) { sets.push("event = ?"); args.push(patch.event); }
  if (sets.length === 0) return;
  args.push(id);
  await db.prepare(`UPDATE playtest_turns SET ${sets.join(", ")} WHERE id = ?`).bind(...args).run();
}

export async function updatePlayer(
  db: D1Database,
  id: string,
  patch: Partial<{
    displayName: string;
    role: string | null;
    experience: string | null;
    realName: string | null;
    notes: string | null;
    position: number;
    teamIndex: number | null;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const args: unknown[] = [];
  if (patch.displayName !== undefined) { sets.push("display_name = ?"); args.push(patch.displayName); }
  if (patch.role !== undefined) { sets.push("role = ?"); args.push(patch.role); }
  if (patch.experience !== undefined) { sets.push("experience = ?"); args.push(patch.experience); }
  if (patch.realName !== undefined) { sets.push("real_name = ?"); args.push(patch.realName); }
  if (patch.notes !== undefined) { sets.push("notes = ?"); args.push(patch.notes); }
  if (patch.position !== undefined) { sets.push("position = ?"); args.push(patch.position); }
  if (patch.teamIndex !== undefined) { sets.push("team_index = ?"); args.push(patch.teamIndex); }
  if (sets.length === 0) return;
  args.push(id);
  await db.prepare(`UPDATE playtest_players SET ${sets.join(", ")} WHERE id = ?`).bind(...args).run();
}

// ----- PHASE TIMES -----

export async function listPhaseTimes(db: D1Database, sessionId: string): Promise<PhaseTime[]> {
  const { results } = await db
    .prepare("SELECT * FROM playtest_phase_times WHERE session_id = ? ORDER BY position ASC, created_at ASC")
    .bind(sessionId)
    .all();
  return (results ?? []).map((r) => rowToPhaseTime(r as Record<string, unknown>));
}

export async function addPhaseTime(
  db: D1Database,
  data: { sessionId: string; name: string; minutes: number; position?: number },
): Promise<PhaseTime> {
  const id = uuid();
  await db
    .prepare(
      `INSERT INTO playtest_phase_times (id, session_id, name, minutes, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, data.sessionId, data.name, data.minutes, data.position ?? 0, now())
    .run();
  const r = await db.prepare("SELECT * FROM playtest_phase_times WHERE id = ?").bind(id).first();
  if (!r) throw new Error("addPhaseTime failed");
  return rowToPhaseTime(r as Record<string, unknown>);
}

export async function deletePhaseTime(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM playtest_phase_times WHERE id = ?").bind(id).run();
}

// ----- CHECKLIST -----

export async function listChecklistItems(
  db: D1Database,
  appliesTo: ChecklistApplies,
  gameId?: string | null,
): Promise<ChecklistItem[]> {
  // Logica: se esistono item specifici per il gioco, usali; altrimenti
  // usa i template di sistema (game_id IS NULL).
  let sql: string;
  let args: unknown[];
  if (gameId) {
    const { results: ov } = await db
      .prepare(
        "SELECT * FROM playtest_checklist_items WHERE game_id = ? AND applies_to = ? AND active = 1 ORDER BY position ASC",
      )
      .bind(gameId, appliesTo)
      .all();
    if ((ov ?? []).length > 0) {
      return (ov ?? []).map((r) => rowToChecklistItem(r as Record<string, unknown>));
    }
  }
  sql = "SELECT * FROM playtest_checklist_items WHERE game_id IS NULL AND applies_to = ? AND active = 1 ORDER BY position ASC";
  args = [appliesTo];
  const { results } = await db.prepare(sql).bind(...args).all();
  return (results ?? []).map((r) => rowToChecklistItem(r as Record<string, unknown>));
}

/**
 * Restituisce true se il gioco ha item checklist custom (per appliesTo dato).
 * Utile per la UI per decidere se mostrare "personalizza" vs "modifica".
 */
export async function hasCustomChecklistItems(
  db: D1Database,
  gameId: string,
  appliesTo: ChecklistApplies,
): Promise<boolean> {
  const r = await db
    .prepare(
      "SELECT COUNT(*) as n FROM playtest_checklist_items WHERE game_id = ? AND applies_to = ?",
    )
    .bind(gameId, appliesTo)
    .first<{ n: number }>();
  return !!r && Number(r.n) > 0;
}

export async function getChecklistItem(db: D1Database, id: string): Promise<ChecklistItem | null> {
  const r = await db.prepare("SELECT * FROM playtest_checklist_items WHERE id = ?").bind(id).first();
  return r ? rowToChecklistItem(r as Record<string, unknown>) : null;
}

export async function createChecklistItem(
  db: D1Database,
  data: {
    gameId: string;
    category: string;
    subcategory?: string | null;
    text: string;
    appliesTo: ChecklistApplies;
    position?: number;
  },
): Promise<ChecklistItem> {
  const id = uuid();
  await db
    .prepare(
      `INSERT INTO playtest_checklist_items (id, game_id, category, subcategory, text, applies_to, position, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    )
    .bind(
      id,
      data.gameId,
      data.category,
      data.subcategory ?? null,
      data.text,
      data.appliesTo,
      data.position ?? 0,
    )
    .run();
  const item = await getChecklistItem(db, id);
  if (!item) throw new Error("createChecklistItem failed");
  return item;
}

export async function updateChecklistItem(
  db: D1Database,
  id: string,
  patch: Partial<{
    category: string;
    subcategory: string | null;
    text: string;
    position: number;
    active: boolean;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const args: unknown[] = [];
  if (patch.category !== undefined) { sets.push("category = ?"); args.push(patch.category); }
  if (patch.subcategory !== undefined) { sets.push("subcategory = ?"); args.push(patch.subcategory); }
  if (patch.text !== undefined) { sets.push("text = ?"); args.push(patch.text); }
  if (patch.position !== undefined) { sets.push("position = ?"); args.push(patch.position); }
  if (patch.active !== undefined) { sets.push("active = ?"); args.push(patch.active ? 1 : 0); }
  if (sets.length === 0) return;
  args.push(id);
  await db.prepare(`UPDATE playtest_checklist_items SET ${sets.join(", ")} WHERE id = ?`).bind(...args).run();
}

export async function deleteChecklistItem(db: D1Database, id: string): Promise<void> {
  // Tutti gli item sono ora eliminabili (anche i template di sistema con
  // game_id NULL): siamo ancora in fase di testing.
  await db.prepare("DELETE FROM playtest_checklist_items WHERE id = ?").bind(id).run();
}

/**
 * Clona tutti gli item di sistema (game_id NULL) come item custom per il gioco
 * dato. Idempotente: se ci sono già item custom per quel (gameId, appliesTo),
 * non clona nulla.
 */
export async function cloneSystemChecklistToGame(
  db: D1Database,
  gameId: string,
  appliesTo: ChecklistApplies,
): Promise<number> {
  if (await hasCustomChecklistItems(db, gameId, appliesTo)) return 0;
  const systemItems = await listChecklistItems(db, appliesTo, null);
  let n = 0;
  for (const it of systemItems) {
    await createChecklistItem(db, {
      gameId,
      category: it.category,
      subcategory: it.subcategory,
      text: it.text,
      appliesTo: it.appliesTo,
      position: it.position,
    });
    n += 1;
  }
  return n;
}

/**
 * Cancella tutti gli item custom per (gameId, appliesTo). Le sessioni
 * torneranno a usare il template di sistema.
 */
export async function resetGameChecklist(
  db: D1Database,
  gameId: string,
  appliesTo: ChecklistApplies,
): Promise<void> {
  await db
    .prepare("DELETE FROM playtest_checklist_items WHERE game_id = ? AND applies_to = ?")
    .bind(gameId, appliesTo)
    .run();
}

export async function listChecklistInstances(
  db: D1Database,
  sessionId: string,
): Promise<ChecklistInstance[]> {
  const { results } = await db
    .prepare(
      "SELECT * FROM playtest_checklist_instances WHERE session_id = ? ORDER BY created_at DESC",
    )
    .bind(sessionId)
    .all();
  return (results ?? []).map((r) => rowToChecklistInstance(r as Record<string, unknown>));
}

export async function getChecklistInstance(
  db: D1Database,
  id: string,
): Promise<ChecklistInstance | null> {
  const r = await db.prepare("SELECT * FROM playtest_checklist_instances WHERE id = ?").bind(id).first();
  return r ? rowToChecklistInstance(r as Record<string, unknown>) : null;
}

export async function createChecklistInstance(
  db: D1Database,
  data: {
    sessionId: string;
    phase: ChecklistPhase;
    observerUserId?: string | null;
    observerName?: string | null;
    notes?: string | null;
  },
): Promise<ChecklistInstance> {
  const id = uuid();
  const ts = now();
  await db
    .prepare(
      `INSERT INTO playtest_checklist_instances (id, session_id, phase, observer_user_id, observer_name, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      data.sessionId,
      data.phase,
      data.observerUserId ?? null,
      data.observerName ?? null,
      data.notes ?? null,
      ts,
      ts,
    )
    .run();
  const i = await getChecklistInstance(db, id);
  if (!i) throw new Error("createChecklistInstance failed");
  return i;
}

export async function deleteChecklistInstance(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM playtest_checklist_instances WHERE id = ?").bind(id).run();
}

export async function listChecklistResponses(
  db: D1Database,
  instanceId: string,
): Promise<ChecklistResponse[]> {
  const { results } = await db
    .prepare("SELECT * FROM playtest_checklist_responses WHERE instance_id = ?")
    .bind(instanceId)
    .all();
  return (results ?? []).map((r) => rowToChecklistResponse(r as Record<string, unknown>));
}

/**
 * Upsert atomico di una singola risposta. Usa UNIQUE (instance_id, item_id)
 * → INSERT OR REPLACE garantisce idempotenza.
 */
export async function upsertChecklistResponse(
  db: D1Database,
  data: { instanceId: string; itemId: string; score: number | null; comment: string | null },
): Promise<void> {
  // Trovo l'id esistente per preservare lo stesso uuid (utile per debug)
  const existing = await db
    .prepare("SELECT id FROM playtest_checklist_responses WHERE instance_id = ? AND item_id = ?")
    .bind(data.instanceId, data.itemId)
    .first();
  if (existing?.id) {
    await db
      .prepare("UPDATE playtest_checklist_responses SET score = ?, comment = ? WHERE id = ?")
      .bind(data.score, data.comment, String(existing.id))
      .run();
    // Aggiorna updated_at dell'istanza
    await db
      .prepare("UPDATE playtest_checklist_instances SET updated_at = ? WHERE id = ?")
      .bind(now(), data.instanceId)
      .run();
    return;
  }
  const id = uuid();
  await db
    .prepare(
      `INSERT INTO playtest_checklist_responses (id, instance_id, item_id, score, comment)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, data.instanceId, data.itemId, data.score, data.comment)
    .run();
  await db
    .prepare("UPDATE playtest_checklist_instances SET updated_at = ? WHERE id = ?")
    .bind(now(), data.instanceId)
    .run();
}

// ----- OBSERVATIONS (Sempre sottocchio) -----

export async function listObservations(db: D1Database, sessionId: string): Promise<Observation[]> {
  const { results } = await db
    .prepare("SELECT * FROM playtest_observations WHERE session_id = ? ORDER BY recorded_at ASC")
    .bind(sessionId)
    .all();
  return (results ?? []).map((r) => rowToObservation(r as Record<string, unknown>));
}

export async function addObservation(
  db: D1Database,
  data: { sessionId: string; category: ObservationCategory; text: string; recordedBy?: string | null },
): Promise<Observation> {
  const id = uuid();
  const ts = now();
  await db
    .prepare(
      `INSERT INTO playtest_observations (id, session_id, category, text, recorded_at, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, data.sessionId, data.category, data.text, ts, data.recordedBy ?? null)
    .run();
  return { id, sessionId: data.sessionId, category: data.category, text: data.text, recordedAt: ts, recordedBy: data.recordedBy ?? null };
}

export async function deleteObservation(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM playtest_observations WHERE id = ?").bind(id).run();
}

// ----- OMNI -----

export async function listOmniComments(db: D1Database, sessionId: string): Promise<OmniComment[]> {
  const { results } = await db
    .prepare("SELECT * FROM playtest_omni_comments WHERE session_id = ? ORDER BY recorded_at ASC")
    .bind(sessionId)
    .all();
  return (results ?? []).map((r) => rowToOmniComment(r as Record<string, unknown>));
}

export async function addOmniComment(
  db: D1Database,
  data: { sessionId: string; category: OmniCategory; text: string; authorName?: string | null; recordedBy?: string | null },
): Promise<OmniComment> {
  const id = uuid();
  const ts = now();
  await db
    .prepare(
      `INSERT INTO playtest_omni_comments (id, session_id, category, text, author_name, recorded_at, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, data.sessionId, data.category, data.text, data.authorName ?? null, ts, data.recordedBy ?? null)
    .run();
  return {
    id,
    sessionId: data.sessionId,
    category: data.category,
    text: data.text,
    authorName: data.authorName ?? null,
    recordedAt: ts,
    recordedBy: data.recordedBy ?? null,
  };
}

export async function deleteOmniComment(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM playtest_omni_comments WHERE id = ?").bind(id).run();
}

// ----- FORMATTERS -----

// ----- COLLABORATORS (multi-utente sulla sessione) -----

export interface Collaborator {
  id: string;
  name: string;
  email: string | null;
  contributions: {
    turns: number;
    observations: number;
    omni: number;
    checklists: number;
  };
}

/**
 * Restituisce tutti gli utenti che hanno contribuito a una sessione
 * (turni, osservazioni, OMNI, istanze checklist, oppure creatori).
 */
export async function listSessionCollaborators(
  db: D1Database,
  sessionId: string,
): Promise<Collaborator[]> {
  const sql = `
    SELECT
      u.id, u.name, u.email,
      COALESCE(t.n, 0) AS turns,
      COALESCE(o.n, 0) AS observations,
      COALESCE(m.n, 0) AS omni,
      COALESCE(c.n, 0) AS checklists
    FROM users u
    LEFT JOIN (SELECT recorded_by AS uid, COUNT(*) AS n FROM playtest_turns WHERE session_id = ? AND recorded_by IS NOT NULL GROUP BY recorded_by) t ON t.uid = u.id
    LEFT JOIN (SELECT recorded_by AS uid, COUNT(*) AS n FROM playtest_observations WHERE session_id = ? AND recorded_by IS NOT NULL GROUP BY recorded_by) o ON o.uid = u.id
    LEFT JOIN (SELECT recorded_by AS uid, COUNT(*) AS n FROM playtest_omni_comments WHERE session_id = ? AND recorded_by IS NOT NULL GROUP BY recorded_by) m ON m.uid = u.id
    LEFT JOIN (SELECT observer_user_id AS uid, COUNT(*) AS n FROM playtest_checklist_instances WHERE session_id = ? AND observer_user_id IS NOT NULL GROUP BY observer_user_id) c ON c.uid = u.id
    WHERE COALESCE(t.n, 0) + COALESCE(o.n, 0) + COALESCE(m.n, 0) + COALESCE(c.n, 0) > 0
       OR u.id IN (SELECT created_by FROM playtest_sessions WHERE id = ? AND created_by IS NOT NULL)
    ORDER BY (COALESCE(t.n,0) + COALESCE(o.n,0) + COALESCE(m.n,0) + COALESCE(c.n,0)) DESC, u.name`;
  const { results } = await db.prepare(sql)
    .bind(sessionId, sessionId, sessionId, sessionId, sessionId)
    .all();
  return (results ?? []).map((r) => ({
    id: String((r as any).id),
    name: String((r as any).name),
    email: ((r as any).email as string) ?? null,
    contributions: {
      turns: Number((r as any).turns ?? 0),
      observations: Number((r as any).observations ?? 0),
      omni: Number((r as any).omni ?? 0),
      checklists: Number((r as any).checklists ?? 0),
    },
  }));
}

// ----- TURN MERGING (multi-utente) -----

export interface MergedTurn {
  /** Chiave canonica: round + playerId. */
  round: number;
  playerId: string | null;
  /** Durata media (sec) attraverso tutti gli osservatori che hanno cronometrato lo stesso turno. */
  avgDurationSeconds: number;
  /** Punti medi. */
  avgPoints1: number | null;
  avgPoints2: number | null;
  /** Per N squadre: media element-wise sui teamPoints di ogni recorder. */
  avgTeamPoints: number[] | null;
  /** Tutti gli eventi annotati (uniti). */
  events: string[];
  /** Numero di osservatori che hanno registrato questo turno (>=1). */
  recordersCount: number;
  /** ID utenti che hanno registrato (distinti). */
  recorderIds: string[];
  /** Tutti i turni grezzi (per drill-down). */
  rawTurns: Turn[];
}

/**
 * Aggrega i turni di una sessione raggruppandoli per (round, playerId) e
 * mediando durata e punti quando più osservatori hanno cronometrato lo
 * stesso giocatore nello stesso round.
 *
 * Logica:
 *   - Stessa coppia (round, playerId) → un unico MergedTurn
 *   - Durata: media aritmetica
 *   - Punti: media (ignora null)
 *   - teamPoints: media element-wise
 *   - Event: concatenati (separatore "; ")
 *
 * Se un solo osservatore ha registrato → MergedTurn ha esattamente quella entry.
 */
export function mergeTurns(turns: Turn[]): MergedTurn[] {
  // Chiave: `${round}|${playerId ?? "NONE"}`
  const groups = new Map<string, Turn[]>();
  for (const t of turns) {
    const k = `${t.round}|${t.playerId ?? "NONE"}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  const out: MergedTurn[] = [];
  for (const [key, group] of groups) {
    const round = Number(key.split("|")[0]);
    const playerId = group[0].playerId;
    const avgDuration = group.reduce((a, t) => a + t.durationSeconds, 0) / group.length;
    // Media dei punti ignorando null
    function avgN(getter: (t: Turn) => number | null): number | null {
      const vals = group.map(getter).filter((v): v is number => v != null);
      if (vals.length === 0) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    const p1 = avgN((t) => t.points1);
    const p2 = avgN((t) => t.points2);
    // teamPoints: trova il massimo numero di squadre e fa la media element-wise
    let avgTeamPoints: number[] | null = null;
    const tpRecorders = group.filter((t) => Array.isArray(t.teamPoints) && (t.teamPoints as number[]).length > 0);
    if (tpRecorders.length > 0) {
      const maxLen = tpRecorders.reduce((m, t) => Math.max(m, (t.teamPoints as number[]).length), 0);
      avgTeamPoints = new Array(maxLen).fill(0);
      for (let i = 0; i < maxLen; i++) {
        const vals = tpRecorders.map((t) => Number((t.teamPoints as number[])[i] ?? 0));
        avgTeamPoints[i] = vals.reduce((a, b) => a + b, 0) / tpRecorders.length;
      }
    }
    const events = group.map((t) => t.event).filter((e): e is string => !!e && e.trim().length > 0);
    const recorderIds = Array.from(new Set(group.map((t) => t.recordedBy).filter((x): x is string => !!x)));
    out.push({
      round,
      playerId,
      avgDurationSeconds: avgDuration,
      avgPoints1: p1,
      avgPoints2: p2,
      avgTeamPoints,
      events,
      recordersCount: Math.max(1, recorderIds.length),
      recorderIds,
      rawTurns: group,
    });
  }
  out.sort((a, b) => a.round - b.round);
  return out;
}

// ----- GRADIMENTO AGGREGATION -----

const GRADIMENTO_STUDY_SLUG = "playtest-gradimento";
const GRADIMENTO_REVERSE_ITEMS = new Set(["g02_r", "g03_r", "g05_r", "g07_r", "g10_r"]);
const GRADIMENTO_ALL_ITEMS = [
  "g01", "g02_r", "g03_r", "g04", "g05_r",
  "g06", "g07_r", "g08", "g09", "g10_r",
];
const GRADIMENTO_LIKERT_MAX = 7;

export interface GradimentoStats {
  n: number;
  mean: number | null;
  sd: number | null;
  perItem: Record<string, { mean: number; n: number }>;
  perceivedMinutes: { mean: number | null; n: number };
  /** Responses raw count (also = n if all valid) */
  responseCount: number;
}

/**
 * Aggrega le risposte Gradimento di una specifica sessione.
 *
 * Cerca research_responses dello studio "playtest-gradimento" con
 * payload.session_id = <sessionId>. Score di ogni item: applica reverse
 * coding sugli item _r (val = 8 - val per scala 1-7). Media e SD calcolate
 * sull'aggregato di tutti gli item × tutti i partecipanti.
 */
export async function computeGradimentoStats(
  db: D1Database,
  sessionId: string,
): Promise<GradimentoStats> {
  // Trova lo studio
  const studyRow = await db
    .prepare("SELECT id FROM research_studies WHERE slug = ?")
    .bind(GRADIMENTO_STUDY_SLUG)
    .first<{ id: string }>();
  if (!studyRow) return { n: 0, mean: null, sd: null, perItem: {}, perceivedMinutes: { mean: null, n: 0 }, responseCount: 0 };

  // Recupera tutte le response dello studio (sono tipicamente poche per sessione)
  // e filtra in JS per session_id nel payload (D1 supporta json_extract ma
  // siamo conservativi per portabilità).
  const { results } = await db
    .prepare("SELECT payload_json FROM research_responses WHERE study_id = ?")
    .bind(studyRow.id)
    .all();

  const matched: Array<{ data: Record<string, any> }> = [];
  for (const row of results ?? []) {
    let data: Record<string, any> = {};
    try { data = JSON.parse(String((row as any).payload_json)); } catch { continue; }
    if (data.session_id === sessionId) matched.push({ data });
  }

  const responseCount = matched.length;
  if (responseCount === 0) {
    return { n: 0, mean: null, sd: null, perItem: {}, perceivedMinutes: { mean: null, n: 0 }, responseCount: 0 };
  }

  // Per item: somma e count
  const perItemStats: Record<string, { sum: number; n: number }> = {};
  for (const k of GRADIMENTO_ALL_ITEMS) perItemStats[k] = { sum: 0, n: 0 };

  // Score per respondent (media degli item compilati, post-reverse)
  const respScores: number[] = [];
  const perceived: number[] = [];

  for (const m of matched) {
    const grad = m.data.gradimento;
    if (!grad || typeof grad !== "object") continue;
    let sum = 0, n = 0;
    for (const item of GRADIMENTO_ALL_ITEMS) {
      const v = Number(grad[item]);
      if (!Number.isFinite(v) || v < 1 || v > GRADIMENTO_LIKERT_MAX) continue;
      const corrected = GRADIMENTO_REVERSE_ITEMS.has(item) ? (GRADIMENTO_LIKERT_MAX + 1 - v) : v;
      perItemStats[item].sum += corrected;
      perItemStats[item].n += 1;
      sum += corrected;
      n += 1;
    }
    if (n > 0) respScores.push(sum / n);
    const pm = Number(m.data.perceived_minutes);
    if (Number.isFinite(pm) && pm > 0) perceived.push(pm);
  }

  const n = respScores.length;
  let mean: number | null = null, sd: number | null = null;
  if (n > 0) {
    mean = respScores.reduce((a, b) => a + b, 0) / n;
    if (n > 1) {
      const variance = respScores.reduce((a, b) => a + (b - (mean as number)) ** 2, 0) / (n - 1);
      sd = Math.sqrt(variance);
    } else sd = 0;
  }
  const perItem: Record<string, { mean: number; n: number }> = {};
  for (const [k, v] of Object.entries(perItemStats)) {
    if (v.n > 0) perItem[k] = { mean: v.sum / v.n, n: v.n };
  }
  const perceivedMean = perceived.length > 0 ? perceived.reduce((a, b) => a + b, 0) / perceived.length : null;

  return {
    n,
    mean,
    sd,
    perItem,
    perceivedMinutes: { mean: perceivedMean, n: perceived.length },
    responseCount,
  };
}

export function secondsToHuman(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const min = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function secondsToDecimalMinutes(s: number): number {
  return Math.round((s / 60) * 100) / 100;
}
