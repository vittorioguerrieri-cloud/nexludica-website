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
  meetingDate: string;
  abstract: string;
  tags: string[];
  documentUrl: string | null; // URL pubblico (proxy via /r2/articles/...)
  videoUrl: string | null;
  authorName: string;
  createdAt: number;
}

export interface MyArticle extends PublicArticle {
  status: "draft" | "published" | "archived";
  documentFilename: string | null;
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
  }));
}

function rowToPublic(r: ArticleRow & { author_name: string }): PublicArticle {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    speaker: r.speaker,
    meetingDate: r.meeting_date,
    abstract: r.abstract,
    tags: r.tags ? r.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    documentUrl: r.document_key ? `/r2/${r.document_key}` : null,
    videoUrl: r.video_url,
    authorName: r.author_name,
    createdAt: r.created_at,
  };
}

export interface CreateArticleInput {
  title: string;
  speaker: string;
  meetingDate: string; // YYYY-MM-DD
  abstract: string;
  tags?: string[];
  documentKey?: string;
  documentFilename?: string;
  videoUrl?: string;
  status?: "draft" | "published";
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
  await db
    .prepare(
      `INSERT INTO meetludica_articles
        (id, slug, user_id, title, speaker, meeting_date, abstract, tags,
         document_key, document_filename, video_url, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      slug,
      userId,
      input.title.trim().slice(0, 200),
      input.speaker.trim().slice(0, 200),
      input.meetingDate,
      input.abstract.trim().slice(0, 5000),
      tagsCsv || null,
      input.documentKey ?? null,
      input.documentFilename ?? null,
      input.videoUrl?.trim() || null,
      input.status ?? "published",
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
