/**
 * PATCH  /api/verbali/:id — aggiorna campi del verbale (solo se draft)
 * DELETE /api/verbali/:id — elimina (solo se draft)
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { deleteVerbale, softDeleteVerbale, getVerbale, updateVerbale } from "../../../../server/verbali";

export const prerender = false;

export const PATCH: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);

  const id = ctx.params.id as string;
  const v = await getVerbale(db, id);
  if (!v) return j({ ok: false, error: "not found" }, 404);
  if (v.status !== "draft") return j({ ok: false, error: "Verbale già inviato in firma o archiviato: non modificabile" }, 400);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Parameters<typeof updateVerbale>[2] = {};
  if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 200);
  if (typeof body.meetingDate === "string") patch.meetingDate = body.meetingDate.trim();
  if (body.meetingTime !== undefined) patch.meetingTime = body.meetingTime == null ? null : String(body.meetingTime).slice(0, 10);
  if (body.meetingEndTime !== undefined) patch.meetingEndTime = body.meetingEndTime == null ? null : String(body.meetingEndTime).slice(0, 10);
  if (body.location !== undefined) patch.location = body.location == null ? null : String(body.location).slice(0, 200);
  if (body.presidentName !== undefined) patch.presidentName = body.presidentName == null ? null : String(body.presidentName).slice(0, 80);
  if (body.secretaryName !== undefined) patch.secretaryName = body.secretaryName == null ? null : String(body.secretaryName).slice(0, 80);
  if (Array.isArray(body.attendeesPresent)) patch.attendeesPresent = body.attendeesPresent as any;
  if (Array.isArray(body.attendeesAbsent)) patch.attendeesAbsent = body.attendeesAbsent as any;
  if (Array.isArray(body.agendaItems)) patch.agendaItems = body.agendaItems as any;
  if (body.agendaMarkdown !== undefined) patch.agendaMarkdown = body.agendaMarkdown == null ? null : String(body.agendaMarkdown).slice(0, 20000);
  if (body.bodyExtra !== undefined) patch.bodyExtra = body.bodyExtra == null ? null : String(body.bodyExtra).slice(0, 10000);
  if (Array.isArray(body.signers) && body.signers.length > 0) patch.signers = body.signers as any;

  await updateVerbale(db, id, patch);
  const updated = await getVerbale(db, id);
  return j({ ok: true, verbale: updated });
};

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);

  const id = ctx.params.id as string;
  const v = await getVerbale(db, id);
  if (!v) return j({ ok: false, error: "not found" }, 404);
  const permanent = new URL(ctx.request.url).searchParams.get("permanent") === "1";
  if (permanent) {
    // Eliminazione DEFINITIVA: pulisce firme, allegati e file su Drive.
    await deleteVerbale(db, id, env as Env);
    return j({ ok: true, permanent: true });
  }
  // Default: sposta nel cestino (soft-delete, recuperabile).
  await softDeleteVerbale(db, id);
  return j({ ok: true, permanent: false });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
