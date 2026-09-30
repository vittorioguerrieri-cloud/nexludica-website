/**
 * GET /api/meetludica/articles/:slug/pdf
 *   PDF brandizzato MeetLudica. Pubblico per gli articoli pubblicati; per le
 *   bozze serve essere gestori di MeetLudica o possedere il link di modifica
 *   (?preview=<edit_token>).
 *
 *   Il PDF viene generato UNA VOLTA e conservato su R2, con l'istante di ultima
 *   modifica dell'articolo come marcatore di versione: finche' l'articolo non
 *   cambia, le richieste successive restituiscono il file salvato senza
 *   rigenerarlo. Generarlo a ogni richiesta era costoso e, con le immagini,
 *   arrivava a superare i limiti di CPU del Worker.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { getArticleBySlugAnyStatus } from "../../../../../server/articles";
import { loadUserFromContext } from "../../../../../server/auth";
import { canManageMeetludica } from "../../../../../server/permissions";
import { renderMeetLudicaPdf } from "../../../../../server/meetludica-pdf";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response("backend", { status: 503 });
  const slug = ctx.params.slug as string;
  const article = await getArticleBySlugAnyStatus(db, slug);
  if (!article) return new Response("not found", { status: 404 });
  if (!article.body) return new Response("articolo senza corpo", { status: 409 });

  // Bozze: gestori MeetLudica oppure possesso del token di modifica.
  if (article.status !== "published") {
    const previewToken = ctx.url.searchParams.get("preview");
    const okToken = !!previewToken && !!article.editToken && previewToken === article.editToken;
    if (!okToken) {
      const user = await loadUserFromContext(ctx);
      if (!canManageMeetludica(user)) return new Response("not found", { status: 404 });
    }
  }

  const safeName = (slug || "meetludica").replace(/[^a-z0-9-]+/gi, "-").slice(0, 80);
  const cacheKey = `article-pdf/${article.id}.pdf`;
  const version = String(article.updatedAt || 0);
  const storage = env?.STORAGE;

  const headers = (extra: Record<string, string> = {}) => ({
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="MeetLudica-${safeName}.pdf"`,
    // Le bozze cambiano spesso: niente cache di edge finche' non sono pubbliche.
    "Cache-Control": article.status === "published" ? "public, max-age=300" : "no-store",
    ...extra,
  });

  // 1) Copia gia' pronta e allineata all'ultima modifica?
  if (storage) {
    try {
      const cached = await storage.get(cacheKey);
      if (cached && cached.customMetadata?.v === version) {
        return new Response(cached.body, { headers: headers({ "X-Pdf-Cache": "hit" }) });
      }
    } catch (e) {
      console.error("[meetludica-pdf] lettura cache fallita:", e);
    }
  }

  // 2) Altrimenti genera, conserva e restituisci.
  try {
    const bytes = await renderMeetLudicaPdf(env as Env, {
      title: article.title,
      speaker: article.speaker,
      editor: article.editor,
      meetingDate: article.meetingDate,
      abstract: article.abstract,
      body: article.body,
    });
    if (storage) {
      try {
        await storage.put(cacheKey, bytes, {
          httpMetadata: { contentType: "application/pdf" },
          customMetadata: { v: version },
        });
      } catch (e) {
        console.error("[meetludica-pdf] salvataggio cache fallito:", e);
      }
    }
    return new Response(bytes, { headers: headers({ "X-Pdf-Cache": "miss" }) });
  } catch (e) {
    console.error("[meetludica-pdf] generazione fallita:", e);
    return new Response("errore generazione PDF", { status: 500 });
  }
};
