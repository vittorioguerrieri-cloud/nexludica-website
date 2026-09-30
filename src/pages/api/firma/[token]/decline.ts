/**
 * POST /api/firma/:token/decline
 * Body: { reason?: string }
 * Il firmatario rifiuta di firmare. Pubblico (no auth).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { getSignatureByToken, recordDecline } from "../../../../server/verbali-signatures";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const token = ctx.params.token as string;
  const sig = await getSignatureByToken(db, token);
  if (!sig) return j({ ok: false, error: "not found" }, 404);
  if (sig.status === "signed") return j({ ok: false, error: "Già firmato" }, 400);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const reason = body.reason ? String(body.reason).trim().slice(0, 500) : null;
  await recordDecline(db, token, reason);
  return j({ ok: true });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
