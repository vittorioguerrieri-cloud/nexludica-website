/**
 * Admin meetludica subscribers:
 *  - GET    /api/admin/meetludica/subscribers          → lista
 *  - POST   /api/admin/meetludica/subscribers/bulk     → bulk insert (vedi bulk.ts)
 *  - DELETE /api/admin/meetludica/subscribers?id=ID    → cancella iscritto
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { canManageMeetludica } from "../../../../server/permissions";
import { listSubscribers, deleteSubscriber } from "../../../../server/meetludica";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return json({ ok: false, error: "forbidden" }, 403);
  const subs = await listSubscribers(db);
  return json({ ok: true, subscribers: subs });
};

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return json({ ok: false, error: "forbidden" }, 403);
  const id = new URL(ctx.request.url).searchParams.get("id");
  if (!id) return json({ ok: false, error: "id mancante" }, 400);
  const ok = await deleteSubscriber(db, id);
  return json({ ok });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
