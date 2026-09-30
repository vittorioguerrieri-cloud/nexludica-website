/**
 * GET  /api/me/awards   → lista premi dell'utente loggato
 * POST /api/me/awards   → aggiunge un premio
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { listAwardsByUser, addAward, type AwardInput } from "../../../../server/awards";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  const items = await listAwardsByUser(db, user.id);
  return json({ ok: true, awards: items });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const input: AwardInput = {
    title: String(body.title ?? ""),
    issuer: body.issuer == null ? null : String(body.issuer),
    year: body.year == null ? null : Number(body.year),
    url: body.url == null ? null : String(body.url),
    description: body.description == null ? null : String(body.description),
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 100,
  };
  if (!input.title.trim()) return json({ ok: false, error: "Titolo obbligatorio" }, 400);
  try {
    const award = await addAward(db, user.id, input);
    return json({ ok: true, award });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
