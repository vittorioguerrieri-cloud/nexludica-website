/**
 * POST /api/contatti — crea un nuovo contatto.
 * Auth: tutti i soci loggati.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { loadUserFromContext } from "../../../server/auth";
import { createContact, type ContactStatus } from "../../../server/contacts";

export const prerender = false;

const VALID_STATUS: ContactStatus[] = ["lead", "active", "cold", "closed", "archived"];

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const fullName = String(body.fullName ?? "").trim().slice(0, 120);
  if (!fullName) return j({ ok: false, error: "Nome obbligatorio" }, 400);

  const statusRaw = String(body.status ?? "active") as ContactStatus;
  const status = VALID_STATUS.includes(statusRaw) ? statusRaw : "active";

  const tags = Array.isArray(body.tags)
    ? (body.tags as unknown[]).map((t) => String(t).trim().slice(0, 40)).filter(Boolean).slice(0, 20)
    : [];

  const followUpAt = body.followUpAt != null && body.followUpAt !== ""
    ? Number(body.followUpAt) || null
    : null;

  const contact = await createContact(db, {
    fullName,
    organization: nstr(body.organization, 120),
    role: nstr(body.role, 80),
    email: nstr(body.email, 200),
    phone: nstr(body.phone, 60),
    city: nstr(body.city, 80),
    website: nstr(body.website, 300),
    linkedin: nstr(body.linkedin, 300),
    notes: nstr(body.notes, 5000),
    tags,
    status,
    source: nstr(body.source, 200),
    followUpAt,
    ownedBy: typeof body.ownedBy === "string" && body.ownedBy ? body.ownedBy : user.id,
    createdBy: user.id,
  });
  return j({ ok: true, contact });
};

function nstr(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}
function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
