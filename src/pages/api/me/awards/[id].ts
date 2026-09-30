/**
 * PUT    /api/me/awards/:id   → aggiorna premio
 * DELETE /api/me/awards/:id   → elimina premio
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { updateAward, deleteAward, type AwardInput } from "../../../../server/awards";

export const prerender = false;

export const PUT: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  const id = ctx.params.id as string;
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
    const updated = await updateAward(db, user.id, id, input);
    if (!updated) return json({ ok: false, error: "Premio non trovato" }, 404);
    return json({ ok: true, award: updated });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
};

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  const id = ctx.params.id as string;
  const ok = await deleteAward(db, user.id, id);
  if (!ok) return json({ ok: false, error: "Premio non trovato" }, 404);
  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
