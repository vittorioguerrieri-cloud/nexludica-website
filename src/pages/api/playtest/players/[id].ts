/**
 * PATCH  /api/playtest/players/:id — modifica (incluso position per ordine turno)
 * DELETE /api/playtest/players/:id — rimuove un giocatore dalla sessione.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { deletePlayer, updatePlayer } from "../../../../server/playtest";

export const prerender = false;

export const PATCH: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  const id = ctx.params.id as string;
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Parameters<typeof updatePlayer>[2] = {};
  if (typeof body.displayName === "string") patch.displayName = body.displayName.trim().slice(0, 40);
  if (body.role !== undefined) patch.role = body.role == null ? null : String(body.role).trim().slice(0, 40) || null;
  if (body.experience !== undefined) patch.experience = body.experience == null ? null : String(body.experience).trim().slice(0, 20) || null;
  if (body.position !== undefined) {
    const n = Number(body.position);
    if (Number.isFinite(n)) patch.position = Math.round(n);
  }
  if (body.teamIndex !== undefined) {
    if (body.teamIndex === null) patch.teamIndex = null;
    else {
      const n = Number(body.teamIndex);
      if (Number.isFinite(n) && n >= 0 && n < 12) patch.teamIndex = Math.round(n);
    }
  }
  await updatePlayer(db, id, patch);
  return j({ ok: true });
};

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  await deletePlayer(db, ctx.params.id as string);
  return j({ ok: true });
};

function j(d: unknown, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } }); }
