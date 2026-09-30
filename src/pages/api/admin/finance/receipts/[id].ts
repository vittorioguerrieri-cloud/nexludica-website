/**
 * GET    /api/admin/finance/receipts/:id   mostra la ricevuta (solo amministratori)
 * DELETE /api/admin/finance/receipts/:id   la elimina da R2 e dal database
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { deleteReceipt, getReceipt } from "../../../../../server/finance-receipts";

export const prerender = false;

async function guard(ctx: Parameters<APIRoute>[0]) {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db || !env.STORAGE) return { error: new Response("backend", { status: 503 }) };
  const user = await loadUserFromContext(ctx);
  if (!user || user.role !== "admin") return { error: new Response("not found", { status: 404 }) };
  return { env, db, storage: env.STORAGE };
}

export const GET: APIRoute = async (ctx) => {
  const g = await guard(ctx);
  if ("error" in g) return g.error;
  const r = await getReceipt(g.db, String(ctx.params.id));
  if (!r) return new Response("not found", { status: 404 });
  const obj = await g.storage.get(r.r2Key);
  if (!obj) return new Response("file mancante", { status: 404 });
  const safe = r.filename.replace(/["\\r\n]/g, "_");
  return new Response(obj.body, {
    headers: {
      "Content-Type": r.mimeType,
      "Content-Disposition": `inline; filename="${safe}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
};

export const DELETE: APIRoute = async (ctx) => {
  const g = await guard(ctx);
  if ("error" in g) return g.error;
  const ok = await deleteReceipt(g.db, g.storage, String(ctx.params.id));
  return new Response(JSON.stringify({ ok }), { status: ok ? 200 : 404, headers: { "Content-Type": "application/json" } });
};
