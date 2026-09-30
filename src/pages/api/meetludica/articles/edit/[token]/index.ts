/**
 * Modifica di un articolo MeetLudica da parte dell'autore, via edit_token
 * segreto. NESSUN login richiesto: il possesso del token È l'autorizzazione.
 *
 * POST /api/meetludica/articles/edit/:token
 *   { action: "preview", body }            -> { ok, html }  (non salva)
 *   { action: "save", title, speaker, editor, meetingDate, abstract, body,
 *             transcript, tags, videoUrl }  -> { ok, slug }  (salva)
 *
 * Non modifica lo status (pubblicazione/archiviazione restano agli admin).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../../server/db";
import {
  getArticleByEditToken,
  updateArticleByToken,
} from "../../../../../../server/articles";
import { renderArticleHtml } from "../../../../../../server/article-markdown";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const token = ctx.params.token as string;

  const article = await getArticleByEditToken(db, token);
  if (!article) return j({ ok: false, error: "Link non valido o articolo rimosso" }, 404);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action ?? "save");

  if (action === "preview") {
    const md = String(body.body ?? "");
    return j({ ok: true, html: renderArticleHtml(md) });
  }

  // save
  const tags = typeof body.tags === "string"
    ? String(body.tags).split(",").map((t) => t.trim()).filter(Boolean)
    : Array.isArray(body.tags) ? (body.tags as string[]) : undefined;

  const statusIn = String(body.status ?? "");
  const status = statusIn === "published" || statusIn === "draft" ? statusIn : undefined;

  const ok = await updateArticleByToken(db, token, {
    title: optStr(body.title),
    speaker: optStr(body.speaker),
    editor: body.editor === undefined ? undefined : optStr(body.editor) ?? null,
    meetingDate: optStr(body.meetingDate),
    abstract: optStr(body.abstract),
    body: body.body === undefined ? undefined : String(body.body ?? ""),
    transcript: body.transcript === undefined ? undefined : String(body.transcript ?? ""),
    tags,
    videoUrl: body.videoUrl === undefined ? undefined : String(body.videoUrl ?? ""),
    status,
  });
  if (!ok) return j({ ok: false, error: "Salvataggio fallito" }, 500);

  // Rileggi lo slug aggiornato (il titolo non cambia lo slug, ma per sicurezza)
  const updated = await getArticleByEditToken(db, token);
  return j({ ok: true, slug: updated?.slug ?? article.slug, status: updated?.status });
};

function optStr(v: unknown): string | undefined {
  return v == null ? undefined : String(v);
}
function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), {
    status: s,
    headers: { "Content-Type": "application/json" },
  });
}
