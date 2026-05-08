/**
 * Admin: dettaglio + update socio.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { getMemberById, updateMemberAsAdmin, type UpdateMemberInput } from "../../../../server/admin";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.role !== "admin") return json({ error: "forbidden" }, 403);
  const id = ctx.params.id as string;
  const member = await getMemberById(db, id);
  if (!member) return json({ error: "not_found" }, 404);
  return json({ member });
};

export const PUT: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.role !== "admin") return json({ error: "forbidden" }, 403);
  const id = ctx.params.id as string;
  const body = (await ctx.request.json()) as Record<string, unknown>;

  // Whitelist + parse
  const input: UpdateMemberInput = {};
  if (body.role) input.role = body.role as "admin" | "member" | "collaborator";
  if (body.active !== undefined) input.active = Boolean(body.active);
  if (body.roleLabel !== undefined) input.roleLabel = String(body.roleLabel);
  // Toggle visibilità: la pagina invia "0"/"1" come stringhe.
  const truthy = (v: unknown) => v === true || v === "1" || v === 1 || v === "true";
  if (body.publicVisible !== undefined) input.publicVisible = truthy(body.publicVisible);
  if (body.emailPublic !== undefined) input.emailPublic = truthy(body.emailPublic);
  for (const k of [
    "fiscalCode", "birthDate", "birthPlace", "phone",
    "address", "city", "postalCode", "province", "country",
    "membershipDate", "membershipStatus",
    "lastPaymentDate", "paymentNotes", "internalNotes",
  ] as const) {
    if (body[k] !== undefined) (input as Record<string, unknown>)[k] = String(body[k] ?? "");
  }
  if (body.lastPaymentAmount !== undefined) {
    const n = Number(body.lastPaymentAmount);
    input.lastPaymentAmount = Number.isFinite(n) ? n : null;
  }
  await updateMemberAsAdmin(db, user.id, id, input, env);
  const member = await getMemberById(db, id);
  return json({ ok: true, member });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
