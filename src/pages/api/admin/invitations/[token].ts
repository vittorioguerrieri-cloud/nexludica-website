/**
 * Admin: revoca un invito.
 * - DELETE /api/admin/invitations/:token  → marca revoked_at
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { revokeInvitation } from "../../../../server/invitations";

export const prerender = false;

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.role !== "admin") return json({ error: "forbidden" }, 403);
  const token = ctx.params.token as string;
  if (!token) return json({ error: "missing token" }, 400);
  await revokeInvitation(db, token);
  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
