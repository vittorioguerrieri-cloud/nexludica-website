/**
 * PATCH  /api/contatti/:id — aggiorna qualunque campo
 * DELETE /api/contatti/:id — elimina (solo admin)
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { deleteContact, getContact, updateContact, type ContactStatus } from "../../../../server/contacts";

export const prerender = false;

const VALID_STATUS: ContactStatus[] = ["lead", "active", "cold", "closed", "archived"];

export const PATCH: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);

  const id = ctx.params.id as string;
  const c = await getContact(db, id);
  if (!c) return j({ ok: false, error: "not found" }, 404);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Parameters<typeof updateContact>[2] = {};
  if (typeof body.fullName === "string") patch.fullName = body.fullName.trim().slice(0, 120);
  if (body.organization !== undefined) patch.organization = nstr(body.organization, 120);
  if (body.role !== undefined) patch.role = nstr(body.role, 80);
  if (body.email !== undefined) patch.email = nstr(body.email, 200);
  if (body.phone !== undefined) patch.phone = nstr(body.phone, 60);
  if (body.city !== undefined) patch.city = nstr(body.city, 80);
  if (body.website !== undefined) patch.website = nstr(body.website, 300);
  if (body.linkedin !== undefined) patch.linkedin = nstr(body.linkedin, 300);
  if (body.notes !== undefined) patch.notes = nstr(body.notes, 5000);
  if (Array.isArray(body.tags)) {
    patch.tags = (body.tags as unknown[]).map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 20);
  }
  if (body.status !== undefined && VALID_STATUS.includes(body.status as ContactStatus)) {
    patch.status = body.status as ContactStatus;
  }
  if (body.source !== undefined) patch.source = nstr(body.source, 200);
  if (body.followUpAt !== undefined) {
    if (body.followUpAt === null || body.followUpAt === "") patch.followUpAt = null;
    else { const n = Number(body.followUpAt); if (Number.isFinite(n)) patch.followUpAt = n; }
  }
  if (body.ownedBy !== undefined) patch.ownedBy = body.ownedBy == null ? null : String(body.ownedBy);

  await updateContact(db, id, patch);
  const updated = await getContact(db, id);
  return j({ ok: true, contact: updated });
};

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "Solo admin può eliminare contatti" }, 403);
  await deleteContact(db, ctx.params.id as string);
  return j({ ok: true });
};

function nstr(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}
function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
