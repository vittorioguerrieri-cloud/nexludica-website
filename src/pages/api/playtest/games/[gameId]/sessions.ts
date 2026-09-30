/**
 * POST /api/playtest/games/:gameId/sessions
 *   Crea una sessione di playtest per il gioco.
 *
 * Auth: soci loggati.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { createSession, getGameById } from "../../../../../server/playtest";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  const gameId = ctx.params.gameId as string;
  const game = await getGameById(db, gameId);
  if (!game) return json({ ok: false, error: "game not found" }, 404);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const label = String(body.label ?? "").trim().slice(0, 80);
  if (!label) return json({ ok: false, error: "Etichetta obbligatoria" }, 400);

  const session = await createSession(db, {
    gameId,
    label,
    playedAt: nullableStr(body.playedAt, 20),
    location: nullableStr(body.location, 80),
    notes: nullableStr(body.notes, 1000),
    createdBy: user.id,
  });
  return json({ ok: true, session });
};

function nullableStr(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
