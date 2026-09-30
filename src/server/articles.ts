/**
 * Helper per articoli MeetLudica: lista pubblica, CRUD per autori,
 * upload PDF su R2.
 */
import { now, secureToken, uuid, type ArticleRow } from "./db";

export interface PublicArticle {
  id: string;
  slug: string;
  title: string;
  speaker: string;
  /** Chi ha curato il resoconto, distinto dal relatore. */
  editor: string | null;
  meetingDate: string;
  abstract: string;
  tags: string[];
  documentUrl: string | null; // URL pubblico (proxy via /r2/articles/...)
  videoUrl: string | null;
  authorName: string;
  /** Articolo formattato in markdown (generato dal transcript). */
  body: string | null;
  /** Transcript integrale corretto della registrazione. */
  transcript: string | null;
  createdAt: number;
}

export interface MyArticle extends PublicArticle {
  status: "draft" | "published" | "archived";
  documentFilename: string | null;
  editToken: string | null;
}

/** Vista completa per l'editor dell'autore (accesso via edit_token). */
export interface EditableArticle {
  id: string;
  slug: string;
  title: string;
  speaker: string;
  editor: string | null;
  meetingDate: string;
  abstract: string;
  body: string | null;
  transcript: string | null;
  tags: string[];
  videoUrl: string | null;
  status: "draft" | "published" | "archived";
  authorName: string;
  editToken: string;
}

/** Slugify italiano-friendly. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function listPublishedArticles(db: D1Database): Promise<PublicArticle[]> {
  const rs = await db
    .prepare(
      `SELECT a.*, u.name as author_name
       FROM meetludica_articles a JOIN users u ON u.id = a.user_id
       WHERE a.status = 'published'
       ORDER BY a.meeting_date DESC, a.created_at DESC`,
    )
    .all();
  return (rs.results as Array<ArticleRow & { author_name: string }>).map(rowToPublic);
}

export async function getPublishedArticleBySlug(
  db: D1Database,
  slug: string,
): Promise<PublicArticle | null> {
  const r = await db
    .prepare(
      `SELECT a.*, u.name as author_name
       FROM meetludica_articles a JOIN users u ON u.id = a.user_id
       WHERE a.status = 'published' AND a.slug = ?`,
    )
    .bind(slug)
    .first<ArticleRow & { author_name: string }>();
  return r ? rowToPublic(r) : null;
}

/**
 * Come getPublishedArticleBySlug ma senza filtro di stato: serve all'anteprima
 * delle bozze da parte di chi gestisce MeetLudica. Restituisce anche lo stato,
 * cosi' il chiamante puo' decidere se e come mostrarlo.
 */
export async function getArticleBySlugAnyStatus(
  db: D1Database,
  slug: string,
): Promise<
  | (PublicArticle & {
      status: "draft" | "published" | "archived";
      editToken: string | null;
      updatedAt: number;
    })
  | null
> {
  const r = await db
    .prepare(
      `SELECT a.*, u.name as author_name
       FROM meetludica_articles a JOIN users u ON u.id = a.user_id
       WHERE a.slug = ?`,
    )
    .bind(slug)
    .first<ArticleRow & { author_name: string }>();
  return r
    ? {
        ...rowToPublic(r),
        status: r.status,
        editToken: r.edit_token ?? null,
        updatedAt: Number(r.updated_at ?? 0),
      }
    : null;
}

export async function listMyArticles(
  db: D1Database,
  userId: string,
): Promise<MyArticle[]> {
  const rs = await db
    .prepare(
      `SELECT a.*, u.name as author_name
       FROM meetludica_articles a JOIN users u ON u.id = a.user_id
       WHERE a.user_id = ?
       ORDER BY a.meeting_date DESC, a.created_at DESC`,
    )
    .bind(userId)
    .all();
  return (rs.results as Array<ArticleRow & { author_name: string }>).map((r) => ({
    ...rowToPublic(r),
    status: r.status,
    documentFilename: r.document_filename,
    editToken: r.edit_token,
  }));
}

/** Lista TUTTI gli articoli (ogni stato) per l'approvazione staff. Solo admin. */
export async function listAllArticles(db: D1Database): Promise<Array<MyArticle>> {
  const rs = await db
    .prepare(
      `SELECT a.*, u.name as author_name
       FROM meetludica_articles a JOIN users u ON u.id = a.user_id
       ORDER BY a.status = 'draft' DESC, a.meeting_date DESC, a.created_at DESC
       LIMIT 500`,
    )
    .all();
  return (rs.results as Array<ArticleRow & { author_name: string }>).map((r) => ({
    ...rowToPublic(r),
    status: r.status,
    documentFilename: r.document_filename,
    editToken: r.edit_token,
  }));
}

/** Cambia lo status di un articolo SENZA owner-check (uso staff/admin). */
export async function setArticleStatus(
  db: D1Database,
  id: string,
  status: "draft" | "published" | "archived",
): Promise<boolean> {
  const res = await db
    .prepare("UPDATE meetludica_articles SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, now(), id)
    .run();
  return !!res.meta && res.meta.changes > 0;
}

/** Info per costruire il link di modifica di un articolo dato il suo id. */
export async function getArticleLinkInfo(
  db: D1Database,
  id: string,
): Promise<{ slug: string; editToken: string | null; title: string; status: string } | null> {
  const r = await db
    .prepare("SELECT slug, edit_token, title, status FROM meetludica_articles WHERE id = ?")
    .bind(id)
    .first<{ slug: string; edit_token: string | null; title: string; status: string }>();
  if (!r) return null;
  return { slug: r.slug, editToken: r.edit_token, title: r.title, status: r.status };
}

/** Carica un articolo (qualsiasi stato) tramite il suo edit_token segreto. */
export async function getArticleByEditToken(
  db: D1Database,
  token: string,
): Promise<EditableArticle | null> {
  if (!token) return null;
  const r = await db
    .prepare(
      `SELECT a.*, u.name as author_name
       FROM meetludica_articles a JOIN users u ON u.id = a.user_id
       WHERE a.edit_token = ?`,
    )
    .bind(token)
    .first<ArticleRow & { author_name: string }>();
  if (!r) return null;
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    speaker: r.speaker,
    editor: r.editor ?? null,
    meetingDate: r.meeting_date,
    abstract: r.abstract,
    body: r.body ?? null,
    transcript: r.transcript ?? null,
    tags: r.tags ? r.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    videoUrl: r.video_url,
    status: r.status,
    authorName: r.author_name,
    editToken: r.edit_token as string,
  };
}

/**
 * Aggiorna un articolo tramite edit_token (no owner check: il token È
 * l'autorizzazione). Campi consentiti all'autore: title, speaker, meetingDate,
 * abstract, body, transcript, tags, videoUrl. Lo status NON è modificabile da qui.
 */
export async function updateArticleByToken(
  db: D1Database,
  token: string,
  input: {
    title?: string;
    speaker?: string;
    editor?: string | null;
    meetingDate?: string;
    abstract?: string;
    body?: string | null;
    transcript?: string | null;
    tags?: string[];
    videoUrl?: string | null;
    /** L'autore può pubblicare/ritirare dal proprio link (solo draft/published). */
    status?: "draft" | "published";
  },
): Promise<boolean> {
  const existing = await db
    .prepare("SELECT id FROM meetludica_articles WHERE edit_token = ?")
    .bind(token)
    .first<{ id: string }>();
  if (!existing) return false;

  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, val: unknown) => {
    sets.push(`${col} = ?`);
    vals.push(val);
  };
  if (input.title != null) set("title", input.title.trim().slice(0, 200));
  if (input.speaker != null) set("speaker", input.speaker.trim().slice(0, 200));
  if (input.editor !== undefined) set("editor", input.editor?.trim().slice(0, 200) || null);
  if (input.meetingDate != null) set("meeting_date", input.meetingDate);
  if (input.abstract != null) set("abstract", input.abstract.trim().slice(0, 5000));
  if (input.body !== undefined) set("body", input.body?.slice(0, 100000) || null);
  if (input.transcript !== undefined) set("transcript", input.transcript?.slice(0, 200000) || null);
  if (input.tags != null) {
    const csv = input.tags.map((t) => t.trim()).filter(Boolean).join(",");
    set("tags", csv || null);
  }
  if (input.videoUrl !== undefined) set("video_url", input.videoUrl?.trim() || null);
  if (input.status === "draft" || input.status === "published") set("status", input.status);
  if (sets.length === 0) return true;
  set("updated_at", now());
  vals.push(token);
  await db
    .prepare(`UPDATE meetludica_articles SET ${sets.join(", ")} WHERE edit_token = ?`)
    .bind(...vals)
    .run();
  return true;
}

function rowToPublic(r: ArticleRow & { author_name: string }): PublicArticle {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    speaker: r.speaker,
    editor: r.editor ?? null,
    meetingDate: r.meeting_date,
    abstract: r.abstract,
    tags: r.tags ? r.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    documentUrl: r.document_key ? `/r2/${r.document_key}` : null,
    videoUrl: r.video_url,
    authorName: r.author_name,
    body: r.body ?? null,
    transcript: r.transcript ?? null,
    createdAt: r.created_at,
  };
}

export interface CreateArticleInput {
  title: string;
  speaker: string;
  editor?: string | null;
  meetingDate: string; // YYYY-MM-DD
  abstract: string;
  tags?: string[];
  documentKey?: string;
  documentFilename?: string;
  videoUrl?: string;
  status?: "draft" | "published";
  body?: string | null;
  transcript?: string | null;
}

export async function createArticle(
  db: D1Database,
  userId: string,
  input: CreateArticleInput,
): Promise<string> {
  const id = uuid();
  // Slug univoco: base slug + 6 caratteri random per evitare collisioni.
  const baseSlug = slugify(input.title) || "articolo";
  const suffix = secureToken(4).toLowerCase().replace(/[_-]/g, "").slice(0, 6);
  const slug = `${baseSlug}-${suffix}`;
  const tagsCsv = (input.tags ?? []).map((t) => t.trim()).filter(Boolean).join(",");
  const editToken = secureToken(24);
  await db
    .prepare(
      `INSERT INTO meetludica_articles
        (id, slug, user_id, title, speaker, editor, meeting_date, abstract, tags,
         document_key, document_filename, video_url, status, transcript, body, edit_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      slug,
      userId,
      input.title.trim().slice(0, 200),
      input.speaker.trim().slice(0, 200),
      input.editor?.trim().slice(0, 200) || null,
      input.meetingDate,
      input.abstract.trim().slice(0, 5000),
      tagsCsv || null,
      input.documentKey ?? null,
      input.documentFilename ?? null,
      input.videoUrl?.trim() || null,
      input.status ?? "draft",
      input.transcript?.slice(0, 200000) ?? null,
      input.body?.slice(0, 100000) ?? null,
      editToken,
      now(),
      now(),
    )
    .run();
  return id;
}

export async function updateArticle(
  db: D1Database,
  userId: string,
  id: string,
  input: Partial<CreateArticleInput> & { status?: "draft" | "published" | "archived" },
): Promise<boolean> {
  // Owner check
  const existing = await db
    .prepare("SELECT user_id FROM meetludica_articles WHERE id = ?")
    .bind(id)
    .first<{ user_id: string }>();
  if (!existing || existing.user_id !== userId) return false;

  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, val: unknown) => {
    sets.push(`${col} = ?`);
    vals.push(val);
  };
  if (input.title != null) set("title", input.title.trim().slice(0, 200));
  if (input.speaker != null) set("speaker", input.speaker.trim().slice(0, 200));
  if (input.editor !== undefined) set("editor", input.editor?.trim().slice(0, 200) || null);
  if (input.meetingDate != null) set("meeting_date", input.meetingDate);
  if (input.abstract != null) set("abstract", input.abstract.trim().slice(0, 5000));
  if (input.tags != null) {
    const csv = input.tags.map((t) => t.trim()).filter(Boolean).join(",");
    set("tags", csv || null);
  }
  if (input.documentKey !== undefined) set("document_key", input.documentKey || null);
  if (input.documentFilename !== undefined)
    set("document_filename", input.documentFilename || null);
  if (input.videoUrl !== undefined) set("video_url", input.videoUrl?.trim() || null);
  if (input.status != null) set("status", input.status);
  if (input.body !== undefined) set("body", input.body?.slice(0, 100000) || null);
  if (input.transcript !== undefined) set("transcript", input.transcript?.slice(0, 200000) || null);
  if (sets.length === 0) return true;
  set("updated_at", now());
  vals.push(id);
  await db
    .prepare(`UPDATE meetludica_articles SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...vals)
    .run();
  return true;
}

export async function deleteArticle(
  db: D1Database,
  userId: string,
  id: string,
): Promise<{ ok: boolean; documentKey?: string }> {
  const r = await db
    .prepare("SELECT user_id, document_key FROM meetludica_articles WHERE id = ?")
    .bind(id)
    .first<{ user_id: string; document_key: string | null }>();
  if (!r || r.user_id !== userId) return { ok: false };
  await db.prepare("DELETE FROM meetludica_articles WHERE id = ?").bind(id).run();
  return { ok: true, documentKey: r.document_key ?? undefined };
}

/**
 * Upload del PDF su R2 e ritorna la chiave (path-like).
 */
export async function uploadArticleDocument(
  storage: R2Bucket,
  userId: string,
  file: File,
): Promise<{ key: string; filename: string }> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 100);
  const key = `articles/${userId}/${Date.now()}-${safeName}`;
  await storage.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type || "application/pdf",
      contentDisposition: `inline; filename="${safeName}"`,
    },
  });
  return { key, filename: file.name };
}
