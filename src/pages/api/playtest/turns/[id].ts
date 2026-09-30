/**
 * PATCH  /api/playtest/turns/:id — modifica un turno esistente
 *   body { round?, playerId?, durationSeconds?, points1?, points2?, event? }
 * DELETE /api/playtest/turns/:id
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { deleteTurn, getTurn, updateTurn } from "../../../../server/playtest";

export const prerender = false;

export const PATCH: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  const id = ctx.params.id as string;
  const t = await getTurn(db, id);
  if (!t) return j({ ok: false, error: "not found" }, 404);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Parameters<typeof updateTurn>[2] = {};
  if (body.round !== undefined) {
    const n = Number(body.round);
    if (Number.isFinite(n) && n >= 1 && n <= 99) patch.round = Math.round(n);
  }
  if (body.playerId !== undefined) patch.playerId = body.playerId == null ? null : String(body.playerId);
  if (body.durationSeconds !== undefined) {
    const n = Number(body.durationSeconds);
    if (Number.isFinite(n) && n >= 0) patch.durationSeconds = Math.round(n);
  }
  if (body.points1 !== undefined) patch.points1 = body.points1 == null || body.points1 === "" ? null : Number(body.points1);
  if (body.points2 !== undefined) patch.points2 = body.points2 == null || body.points2 === "" ? null : Number(body.points2);
  if (body.teamPoints !== undefined) {
    if (body.teamPoints === null) patch.teamPoints = null;
    else if (Array.isArray(body.teamPoints)) {
      patch.teamPoints = body.teamPoints.slice(0, 12).map((v) => Number(v) || 0);
    }
  }
  if (body.event !== undefined) patch.event = body.event == null ? null : String(body.event).trim().slice(0, 100) || null;

  await updateTurn(db, id, patch);
  const updated = await getTurn(db, id);
  return j({ ok: true, turn: updated });
};

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  await deleteTurn(db, ctx.params.id as string);
  return j({ ok: true });
};

function j(d: unknown, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } }); }
