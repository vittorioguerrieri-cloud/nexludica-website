/**
 * GET /api/me/publications/lookup?doi=<doi>
 *
 * Estrae metadati da un DOI usando l'API CrossRef. Ritorna:
 *   { ok: true, metadata: { title, authors, venue, year, doi, url, abstract } }
 * Oppure { ok: false, error: "..." } se il DOI non e' trovato.
 *
 * Endpoint autenticato (solo utenti loggati possono fare lookup).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { fetchCrossrefMetadata, normalizeDoi } from "../../../../server/publications";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  const rawDoi = new URL(ctx.request.url).searchParams.get("doi") ?? "";
  const doi = normalizeDoi(rawDoi);
  if (!doi) return json({ ok: false, error: "DOI non valido (formato atteso: 10.NNNN/...)" }, 400);

  const meta = await fetchCrossrefMetadata(
    doi,
    env.FROM_EMAIL ?? "info@nexludica.org",
  );
  if (!meta) return json({ ok: false, error: "DOI non trovato su CrossRef" }, 404);
  return json({ ok: true, metadata: meta });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
