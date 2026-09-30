import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { loadUserFromContext } from "../../../server/auth";
import {
  createArticle,
  getArticleLinkInfo,
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

  const contentType = ctx.request.headers.get("content-type") ?? "";

  // -------- Flusso markdown (JSON): titolo/relatore/data + corpo markdown.
  // È il flusso principale: l'articolo nasce come bozza, poi l'autore lo
  // rifinisce e pubblica dall'editor markdown (link di modifica).
  if (contentType.includes("application/json")) {
    const b = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = String(b.title ?? "").trim();
    const speaker = String(b.speaker ?? "").trim();
    const meetingDate = String(b.meetingDate ?? b.date ?? "").trim();
    const abstract = String(b.abstract ?? "").trim();
    const tagsRaw = String(b.tags ?? "").trim();
    const videoUrl = String(b.videoUrl ?? "").trim();
    const body = b.body != null ? String(b.body) : null;
    const status = (b.status === "published" ? "published" : "draft") as "draft" | "published";

    if (!title || !speaker || !meetingDate) {
      return json({ error: "Campi obbligatori mancanti (title, speaker, meetingDate)" }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) {
      return json({ error: "meetingDate deve essere YYYY-MM-DD" }, 400);
    }
    try {
      const id = await createArticle(db, user.id, {
        title, speaker, meetingDate, abstract,
        tags: tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [],
        videoUrl: videoUrl || undefined,
        body,
        status,
      });
      const link = await getArticleLinkInfo(db, id);
      return json({ ok: true, id, editToken: link?.editToken ?? null, slug: link?.slug ?? null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return json({ error: "Errore creazione articolo: " + msg }, 500);
    }
  }

  // -------- Flusso legacy (multipart con PDF allegato), mantenuto per compat.
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

  // Se l'INSERT in DB fallisce dopo l'upload R2, cancelliamo il PDF caricato
  // per non lasciare file orfani su R2 senza riferimento DB.
  try {
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
    const link = await getArticleLinkInfo(db, id);
    return json({ ok: true, id, editToken: link?.editToken ?? null, slug: link?.slug ?? null });
  } catch (e) {
    if (documentKey) {
      try { await storage.delete(documentKey); } catch (cleanupErr) {
        console.error("[articles] R2 orphan cleanup failed:", cleanupErr);
      }
    }
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: "Errore creazione articolo: " + msg }, 500);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
