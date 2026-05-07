/**
 * Admin: lista soci e creazione nuovo socio.
 * Solo admin (users.role='admin') possono accedere.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { listAllMembers, createMember } from "../../../../server/admin";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.role !== "admin") return json({ error: "forbidden" }, 403);
  const members = await listAllMembers(db);
  return json({ members });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.role !== "admin") return json({ error: "forbidden" }, 403);
  const body = (await ctx.request.json()) as Record<string, string>;
  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const role = (body.role as "admin" | "member" | "collaborator") ?? "member";
  if (!email || !name) return json({ error: "missing fields" }, 400);
  if (!/.+@.+\..+/.test(email)) return json({ error: "invalid email" }, 400);
  if (!["admin", "member", "collaborator"].includes(role)) {
    return json({ error: "invalid role" }, 400);
  }
  const created = await createMember(db, email, name, role, env);
  return json({ ok: true, user: created });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
