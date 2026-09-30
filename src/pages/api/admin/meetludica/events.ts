/**
 * Admin serate MeetLudica:
 *  - GET    /api/admin/meetludica/events       → lista serate
 *  - POST   /api/admin/meetludica/events       → crea serata
 *  - PATCH  /api/admin/meetludica/events?id=ID → modifica
 *  - DELETE /api/admin/meetludica/events?id=ID → elimina (proposte rimangono, event_id → NULL)
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { canManageMeetludica } from "../../../../server/permissions";
import {
  listEvents,
  addEvent,
  updateEvent,
  deleteEvent,
} from "../../../../server/meetludica";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return json({ ok: false, error: "forbidden" }, 403);
  const events = await listEvents(db);
  return json({ ok: true, events });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return json({ ok: false, error: "forbidden" }, 403);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const title = String(body.title ?? "").trim();
  const eventDate = Number(body.eventDate);
  const location = body.location != null ? String(body.location) : null;
  const notes = body.notes != null ? String(body.notes) : null;
  const description = body.description != null ? String(body.description) : null;
  const meetingUrl = body.meetingUrl === undefined ? undefined : body.meetingUrl == null ? null : String(body.meetingUrl);
  if (!title || !Number.isFinite(eventDate)) {
    return json({ ok: false, error: "Titolo e data obbligatori" }, 400);
  }
  try {
    const ev = await addEvent(db, { title, eventDate, location, notes, description, meetingUrl }, user.id);
    return json({ ok: true, event: ev });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "errore" }, 500);
  }
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
  const fields: Parameters<typeof updateEvent>[2] = {};
  if (typeof body.title === "string") fields.title = body.title;
  if (body.eventDate !== undefined) {
    const d = Number(body.eventDate);
    if (!Number.isFinite(d)) return json({ ok: false, error: "Data non valida" }, 400);
    fields.eventDate = d;
  }
  if (body.location !== undefined) fields.location = body.location == null ? null : String(body.location);
  if (body.notes !== undefined) fields.notes = body.notes == null ? null : String(body.notes);
  if (body.description !== undefined) fields.description = body.description == null ? null : String(body.description);
  if (body.meetingUrl !== undefined) fields.meetingUrl = body.meetingUrl == null ? null : String(body.meetingUrl);
  try {
    const ok = await updateEvent(db, id, fields);
    return json({ ok });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "errore" }, 500);
  }
};

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  if (!canManageMeetludica(user)) return json({ ok: false, error: "forbidden" }, 403);
  const id = new URL(ctx.request.url).searchParams.get("id");
  if (!id) return json({ ok: false, error: "id mancante" }, 400);
  const ok = await deleteEvent(db, id);
  return json({ ok });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
