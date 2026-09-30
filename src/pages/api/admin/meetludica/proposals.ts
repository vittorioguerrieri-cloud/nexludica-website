/**
 * Admin proposte di talk:
 *  - GET   /api/admin/meetludica/proposals          → lista
 *  - PATCH /api/admin/meetludica/proposals?id=ID    → aggiorna campi:
 *      { status?, eventId?, availabilityStatus?, availabilityNotes? }
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { canManageMeetludica } from "../../../../server/permissions";
import {
  listProposals,
  updateProposalStatus,
  updateProposalEvent,
  updateProposalAvailability,
  updateProposalArticle,
  AVAILABILITY_STATUSES,
  type ProposalStatus,
  type AvailabilityStatus,
} from "../../../../server/meetludica";

export const prerender = false;

const VALID_STATUS: ProposalStatus[] = ["pending", "accepted", "rejected", "archived"];

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return json({ ok: false, error: "forbidden" }, 403);
  const proposals = await listProposals(db);
  return json({ ok: true, proposals });
};

export const PATCH: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return json({ ok: false, error: "forbidden" }, 403);
  const id = new URL(ctx.request.url).searchParams.get("id");
  if (!id) return json({ ok: false, error: "id mancante" }, 400);
  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;

  let touched = false;

  if (body.status !== undefined) {
    const status = String(body.status) as ProposalStatus;
    if (!VALID_STATUS.includes(status)) {
      return json({ ok: false, error: `status deve essere uno di: ${VALID_STATUS.join(", ")}` }, 400);
    }
    await updateProposalStatus(db, id, status);
    touched = true;
  }

  if (body.eventId !== undefined) {
    const eventId = body.eventId == null || body.eventId === "" ? null : String(body.eventId);
    await updateProposalEvent(db, id, eventId);
    touched = true;
  }

  if (body.articleId !== undefined) {
    const articleId = body.articleId == null || body.articleId === "" ? null : String(body.articleId);
    await updateProposalArticle(db, id, articleId);
    touched = true;
  }

  if (body.availabilityStatus !== undefined || body.availabilityNotes !== undefined) {
    const availFields: Parameters<typeof updateProposalAvailability>[2] = {};
    if (body.availabilityStatus !== undefined) {
      const s = String(body.availabilityStatus) as AvailabilityStatus;
      if (!AVAILABILITY_STATUSES.includes(s)) {
        return json({ ok: false, error: `availabilityStatus deve essere uno di: ${AVAILABILITY_STATUSES.join(", ")}` }, 400);
      }
      availFields.status = s;
    }
    if (body.availabilityNotes !== undefined) {
      availFields.notes = body.availabilityNotes == null ? null : String(body.availabilityNotes);
    }
    await updateProposalAvailability(db, id, availFields);
    touched = true;
  }

  if (!touched) return json({ ok: false, error: "nessun campo da aggiornare" }, 400);
  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
