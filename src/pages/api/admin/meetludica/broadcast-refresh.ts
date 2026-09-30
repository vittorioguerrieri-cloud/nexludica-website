/**
 * POST /api/admin/meetludica/broadcast-refresh
 * Interroga Resend sullo stato dei destinatari ancora "in attesa" e aggiorna
 * il DB. Utile quando i webhook non sono (ancora) configurati o non arrivano.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { canManageMeetludica } from "../../../../server/permissions";
import { refreshDeliveryStatuses } from "../../../../server/meetludica";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return json({ ok: false, error: "forbidden" }, 403);
  if (!env.RESEND_API_KEY) return json({ ok: false, error: "RESEND_API_KEY non configurata" }, 503);

  try {
    const r = await refreshDeliveryStatuses(env, db);
    return json({ ok: true, ...r });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "errore" }, 500);
  }
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
