/**
 * POST /api/contatti/:id/interactions — registra una nuova interazione.
 * Aggiorna automaticamente contact.last_interaction_at.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { addInteraction, getContact, type InteractionKind } from "../../../../../server/contacts";

export const prerender = false;

const VALID: InteractionKind[] = ["email", "call", "meeting", "event", "social", "message", "other"];

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);

  const contactId = ctx.params.id as string;
  const contact = await getContact(db, contactId);
  if (!contact) return j({ ok: false, error: "contact not found" }, 404);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const kindRaw = String(body.kind ?? "other") as InteractionKind;
  const kind: InteractionKind = VALID.includes(kindRaw) ? kindRaw : "other";
  const subject = nstr(body.subject, 200);
  const notes = nstr(body.notes, 5000);

  let happenedAt: number;
  if (typeof body.happenedAt === "number" && Number.isFinite(body.happenedAt)) {
    happenedAt = body.happenedAt;
  } else if (typeof body.happenedAt === "string" && body.happenedAt) {
    const t = Date.parse(body.happenedAt);
    happenedAt = Number.isFinite(t) ? t : Date.now();
  } else {
    happenedAt = Date.now();
  }

  const interaction = await addInteraction(db, {
    contactId,
    kind,
    subject,
    notes,
    happenedAt,
    recordedBy: user.id,
  });
  return j({ ok: true, interaction });
};

function nstr(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}
function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
