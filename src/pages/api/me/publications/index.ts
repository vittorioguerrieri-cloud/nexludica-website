/**
 * GET  /api/me/publications        → lista pubblicazioni dell'utente loggato
 * POST /api/me/publications        → aggiunge una pubblicazione
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import {
  listPublicationsByUser,
  addPublication,
  type PublicationInput,
} from "../../../../server/publications";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  const items = await listPublicationsByUser(db, user.id);
  return json({ ok: true, publications: items });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const input: PublicationInput = {
    title: String(body.title ?? ""),
    authors: body.authors == null ? null : String(body.authors),
    venue: body.venue == null ? null : String(body.venue),
    year: body.year == null ? null : Number(body.year),
    doi: body.doi == null ? null : String(body.doi),
    url: body.url == null ? null : String(body.url),
    abstract: body.abstract == null ? null : String(body.abstract),
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 100,
  };
  if (!input.title.trim()) return json({ ok: false, error: "Titolo obbligatorio" }, 400);
  try {
    const pub = await addPublication(db, user.id, input);
    return json({ ok: true, publication: pub });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/UNIQUE/i.test(msg)) {
      return json({ ok: false, error: "Hai gia' aggiunto una pubblicazione con questo DOI" }, 409);
    }
    return json({ ok: false, error: msg }, 500);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
