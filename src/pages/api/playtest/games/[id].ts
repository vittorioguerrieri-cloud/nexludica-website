/**
 * PATCH /api/playtest/games/:id   — aggiorna campi del gioco
 *   body può contenere: procedureConfig, status, name, ecc.
 *
 * Auth: soci loggati.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { getGameById, updateGame, type ProcedureConfig } from "../../../../server/playtest";

export const prerender = false;

export const PATCH: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  const id = ctx.params.id as string;
  const game = await getGameById(db, id);
  if (!game) return json({ ok: false, error: "not found" }, 404);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Parameters<typeof updateGame>[2] = {};
  if (typeof body.name === "string") patch.name = body.name.trim().slice(0, 80);
  if (body.shortDescription !== undefined)
    patch.shortDescription = body.shortDescription == null ? null : String(body.shortDescription).slice(0, 200);
  if (body.description !== undefined)
    patch.description = body.description == null ? null : String(body.description);
  if (body.designers !== undefined)
    patch.designers = body.designers == null ? null : String(body.designers).slice(0, 200);
  if (body.playersMin !== undefined) patch.playersMin = nullableInt(body.playersMin);
  if (body.playersMax !== undefined) patch.playersMax = nullableInt(body.playersMax);
  if (body.durationMinMinutes !== undefined) patch.durationMinMinutes = nullableInt(body.durationMinMinutes);
  if (body.durationMaxMinutes !== undefined) patch.durationMaxMinutes = nullableInt(body.durationMaxMinutes);
  if (body.minAge !== undefined) patch.minAge = nullableInt(body.minAge);
  if (body.procedureConfig && typeof body.procedureConfig === "object") {
    patch.procedureConfig = body.procedureConfig as ProcedureConfig;
  }
  if (body.status === "active" || body.status === "archived") {
    patch.status = body.status;
  }

  await updateGame(db, id, patch);
  const updated = await getGameById(db, id);
  return json({ ok: true, game: updated });
};

function nullableInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
