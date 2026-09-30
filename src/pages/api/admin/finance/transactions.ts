/**
 * Transazioni di bilancio.
 *  GET   /api/admin/finance/transactions          → lista
 *  PATCH /api/admin/finance/transactions?id=ID     → { projectId?, excluded?, notes? }
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { listTransactions, updateTransaction } from "../../../../server/finance";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);
  return j({ ok: true, transactions: await listTransactions(db) });
};

export const PATCH: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);
  const id = new URL(ctx.request.url).searchParams.get("id");
  if (!id) return j({ ok: false, error: "id mancante" }, 400);
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const fields: Parameters<typeof updateTransaction>[2] = {};
  if (body.projectId !== undefined) fields.projectId = body.projectId == null || body.projectId === "" ? null : String(body.projectId);
  if (body.missionId !== undefined) fields.missionId = body.missionId == null || body.missionId === "" ? null : String(body.missionId);
  if (body.category !== undefined) fields.category = body.category == null || body.category === "" ? null : String(body.category);
  if (body.excluded !== undefined) fields.excluded = Boolean(body.excluded);
  if (body.notes !== undefined) fields.notes = body.notes == null ? null : String(body.notes);
  const ok = await updateTransaction(db, id, fields);
  return j({ ok });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
