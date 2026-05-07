/**
 * Sincronizza i permessi Drive: per ogni utente con role='admin' e
 * active=1, assicura che abbia editor permission sulla cartella Drive
 * radice. Solo admin possono eseguirlo (operazione manutenzione).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { loadUserFromContext } from "../../../server/auth";
import { syncAllAdminsToDrive } from "../../../server/admin";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.role !== "admin") return json({ error: "forbidden" }, 403);
  const result = await syncAllAdminsToDrive(db, env);
  return json({ ok: true, ...result });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
