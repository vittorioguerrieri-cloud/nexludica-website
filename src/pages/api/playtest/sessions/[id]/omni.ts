/**
 * POST /api/playtest/sessions/:id/omni
 *   body { category, text, authorName? } — aggiunge un commento OMNI
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { addOmniComment, getSession, type OmniCategory } from "../../../../../server/playtest";

export const prerender = false;

const VALID: OmniCategory[] = ["ottimo", "modificare", "non_chiaro", "idee_nuove"];

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);

  const sessionId = ctx.params.id as string;
  const s = await getSession(db, sessionId);
  if (!s) return j({ ok: false, error: "session not found" }, 404);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const category = String(body.category ?? "");
  const text = String(body.text ?? "").trim().slice(0, 500);
  const authorName = body.authorName ? String(body.authorName).trim().slice(0, 40) || null : null;
  if (!VALID.includes(category as OmniCategory)) return j({ ok: false, error: "category invalida" }, 400);
  if (!text) return j({ ok: false, error: "Testo obbligatorio" }, 400);

  const omni = await addOmniComment(db, { sessionId, category: category as OmniCategory, text, authorName, recordedBy: user.id });
  return j({ ok: true, omni });
};

function j(d: unknown, s = 200) { return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } }); }
