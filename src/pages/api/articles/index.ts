import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { loadUserFromContext } from "../../../server/auth";
import {
  createArticle,
  listMyArticles,
  listPublishedArticles,
  uploadArticleDocument,
} from "../../../server/articles";

export const prerender = false;

const MAX_PDF_BYTES = 10 * 1024 * 1024; // 10 MB

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ articles: [] });
  const onlyMine = ctx.url.searchParams.get("mine") === "1";
  if (onlyMine) {
    const user = await loadUserFromContext(ctx);
    if (!user) return json({ error: "unauthorized" }, 401);
    return json({ articles: await listMyArticles(db, user.id) });
  }
  return json({ articles: await listPublishedArticles(db) });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  const storage = env?.STORAGE ?? null;
  if (!db || !storage) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);

  // Atteso multipart/form-data per supportare file upload.
  const fd = await ctx.request.formData();
  const title = String(fd.get("title") ?? "").trim();
  const speaker = String(fd.get("speaker") ?? "").trim();
  const meetingDate = String(fd.get("meetingDate") ?? fd.get("date") ?? "").trim();
  const abstract = String(fd.get("abstract") ?? "").trim();
  const tagsRaw = String(fd.get("tags") ?? "").trim();
  const videoUrl = String(fd.get("videoUrl") ?? "").trim();
  const status = (String(fd.get("status") ?? "published") as "draft" | "published");

  if (!title || !speaker || !meetingDate || !abstract) {
    return json({ error: "Campi obbligatori mancanti (title, speaker, meetingDate, abstract)" }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) {
    return json({ error: "meetingDate deve essere YYYY-MM-DD" }, 400);
  }

  const file = fd.get("document");
  let documentKey: string | undefined;
  let documentFilename: string | undefined;
  if (file && file instanceof File && file.size > 0) {
    if (file.size > MAX_PDF_BYTES) {
      return json({ error: `File troppo grande (max ${MAX_PDF_BYTES / 1024 / 1024} MB)` }, 413);
    }
    if (file.type && !["application/pdf", "application/octet-stream"].includes(file.type)) {
      return json({ error: "Tipo file non supportato (solo PDF)" }, 415);
    }
    const r = await uploadArticleDocument(storage, user.id, file);
    documentKey = r.key;
    documentFilename = r.filename;
  }

  const id = await createArticle(db, user.id, {
    title,
    speaker,
    meetingDate,
    abstract,
    tags: tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [],
    documentKey,
    documentFilename,
    videoUrl: videoUrl || undefined,
    status,
  });
  return json({ ok: true, id });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
