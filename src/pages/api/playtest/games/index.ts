/**
 * Crea un nuovo gioco di playtest.
 *
 * POST /api/playtest/games
 *   body { name, shortDescription?, designers?, playersMin?, playersMax?,
 *          durationMinMinutes?, durationMaxMinutes?, minAge? }
 *
 * Auth: soci loggati.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { createGame, getGameBySlug, slugifyGameName } from "../../../../server/playtest";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim().slice(0, 80);
  if (!name) return json({ ok: false, error: "Nome obbligatorio" }, 400);

  // Slug univoco
  let baseSlug = slugifyGameName(name);
  if (!baseSlug) baseSlug = "gioco";
  let slug = baseSlug;
  let n = 2;
  while (await getGameBySlug(db, slug)) {
    slug = `${baseSlug}-${n}`;
    n += 1;
    if (n > 50) break;
  }

  const game = await createGame(db, {
    slug,
    name,
    shortDescription: nullableStr(body.shortDescription, 200),
    designers: nullableStr(body.designers, 200),
    playersMin: nullableInt(body.playersMin),
    playersMax: nullableInt(body.playersMax),
    durationMinMinutes: nullableInt(body.durationMinMinutes),
    durationMaxMinutes: nullableInt(body.durationMaxMinutes),
    minAge: nullableInt(body.minAge),
    createdBy: user.id,
  });

  return json({ ok: true, game });
};

function nullableStr(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}
function nullableInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
