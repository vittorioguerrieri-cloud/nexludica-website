/**
 * POST /api/playtest/checklist-instances/:id/responses
 *   Upsert di una singola risposta (score + commento per item).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { getChecklistInstance, upsertChecklistResponse } from "../../../../../server/playtest";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);

  const instId = ctx.params.id as string;
  const inst = await getChecklistInstance(db, instId);
  if (!inst) return j({ ok: false, error: "checklist not found" }, 404);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const itemId = typeof body.itemId === "string" ? body.itemId : "";
  if (!itemId) return j({ ok: false, error: "itemId mancante" }, 400);
  const scoreRaw = body.score;
  let score: number | null = null;
  if (scoreRaw != null && scoreRaw !== "") {
    const n = Number(scoreRaw);
    if (!Number.isFinite(n) || n < 0 || n > 10) return j({ ok: false, error: "score deve essere 0-10" }, 400);
    score = n;
  }
  const comment = typeof body.comment === "string" && body.comment.trim() ? body.comment.trim().slice(0, 1000) : null;

  await upsertChecklistResponse(db, { instanceId: instId, itemId, score, comment });
  return j({ ok: true });
};

function j(d: unknown, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } }); }
