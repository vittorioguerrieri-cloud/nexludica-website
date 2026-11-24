/**
 * Bozza del broadcast MeetLudica (una sola, condivisa fra gli admin):
 *  - GET    → { ok, draft: { subject, body, updatedAt, updatedBy } | null }
 *  - PUT    { subject, body } → salva
 *  - DELETE → svuota (chiamato dopo un invio riuscito)
 */
import type { APIRoute } from "astro";
import { getDb, getEnv, now } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { canManageMeetludica } from "../../../../server/permissions";

export const prerender = false;

async function guard(ctx: Parameters<APIRoute>[0]) {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return { error: json({ ok: false, error: "backend" }, 503) };
  const user = await loadUserFromContext(ctx);
  if (!user) return { error: json({ ok: false, error: "unauthorized" }, 401) };
  if (!canManageMeetludica(user)) return { error: json({ ok: false, error: "forbidden" }, 403) };
  return { db, user };
}

export const GET: APIRoute = async (ctx) => {
  const g = await guard(ctx);
  if (g.error) return g.error;
  const r = await g.db
    .prepare(
      `SELECT d.subject, d.body, d.updated_at, u.name AS updated_by_name
       FROM meetludica_broadcast_draft d LEFT JOIN users u ON u.id = d.updated_by
       WHERE d.id = 'current'`,
    )
    .first<{ subject: string; body: string; updated_at: number; updated_by_name: string | null }>();
  if (!r || (!r.subject && !r.body)) return json({ ok: true, draft: null });
  return json({
    ok: true,
    draft: { subject: r.subject, body: r.body, updatedAt: r.updated_at, updatedBy: r.updated_by_name },
  });
};

export const PUT: APIRoute = async (ctx) => {
  const g = await guard(ctx);
  if (g.error) return g.error;
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const subject = String(body.subject ?? "").slice(0, 200);
  const text = String(body.body ?? "").slice(0, 20000);
  const ts = now();
  await g.db
    .prepare(
      `INSERT INTO meetludica_broadcast_draft (id, subject, body, updated_at, updated_by)
       VALUES ('current', ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET subject = excluded.subject, body = excluded.body,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    )
    .bind(subject, text, ts, g.user.id)
    .run();
  return json({ ok: true, updatedAt: ts });
};

export const DELETE: APIRoute = async (ctx) => {
  const g = await guard(ctx);
  if (g.error) return g.error;
  await g.db.prepare("DELETE FROM meetludica_broadcast_draft WHERE id = 'current'").run();
  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
