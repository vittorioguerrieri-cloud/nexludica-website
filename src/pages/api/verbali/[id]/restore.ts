/**
 * POST /api/verbali/:id/restore — ripristina un verbale dal cestino. Solo admin.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { getVerbale, restoreVerbale } from "../../../../server/verbali";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);
  const id = ctx.params.id as string;
  const v = await getVerbale(db, id);
  if (!v) return j({ ok: false, error: "not found" }, 404);
  await restoreVerbale(db, id);
  return j({ ok: true });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
