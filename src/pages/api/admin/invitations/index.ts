/**
 * Admin: creazione/lista inviti di iscrizione.
 *
 * - POST /api/admin/invitations  → crea invito, ritorna token+URL
 * - GET  /api/admin/invitations  → lista inviti (default: tutti gli ultimi 200)
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { createInvitation, listInvitations } from "../../../../server/invitations";

export const prerender = false;

function siteUrl(env: Env, req: Request): string {
  const fromEnv = (env as unknown as { SITE_URL?: string }).SITE_URL;
  if (fromEnv) return fromEnv;
  try {
    return new URL(req.url).origin;
  } catch {
    return "https://nexludica.org";
  }
}

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.role !== "admin") return json({ error: "forbidden" }, 403);
  const url = new URL(ctx.request.url);
  const onlyActive = url.searchParams.get("active") === "1";
  const items = await listInvitations(db, { onlyActive });
  const base = siteUrl(env, ctx.request);
  return json({
    invitations: items.map((i) => ({ ...i, url: `${base}/iscrizione?token=${i.token}` })),
  });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.role !== "admin") return json({ error: "forbidden" }, 403);
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const ttlDays = body.ttlDays !== undefined ? Number(body.ttlDays) : undefined;
  if (ttlDays !== undefined && (!Number.isFinite(ttlDays) || ttlDays < 1 || ttlDays > 90)) {
    return json({ error: "ttlDays deve essere tra 1 e 90" }, 400);
  }
  const inv = await createInvitation(db, user.id, {
    intendedName: typeof body.intendedName === "string" ? body.intendedName : undefined,
    intendedEmail: typeof body.intendedEmail === "string" ? body.intendedEmail : undefined,
    note: typeof body.note === "string" ? body.note : undefined,
    ttlDays,
  });
  const base = siteUrl(env, ctx.request);
  return json({
    ok: true,
    invitation: { ...inv, url: `${base}/iscrizione?token=${inv.token}` },
  });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
