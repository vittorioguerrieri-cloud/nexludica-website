/**
 * POST /api/verbali — crea un nuovo verbale.
 * Auth: solo admin.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { loadUserFromContext } from "../../../server/auth";
import {
  createVerbale, getTemplate, DEFAULT_SIGNERS,
  type VerbaleType, type VerbaleAttendee, type VerbaleAgendaItem, type VerbaleSigner,
} from "../../../server/verbali";

export const prerender = false;

const VALID_TYPES: VerbaleType[] = [
  "assemblea_ordinaria", "assemblea_straordinaria", "consiglio_direttivo", "riunione_operativa",
];

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const type = String(body.type ?? "") as VerbaleType;
  if (!VALID_TYPES.includes(type)) return j({ ok: false, error: "type invalido" }, 400);

  const meetingDate = String(body.meetingDate ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) return j({ ok: false, error: "Data non valida (YYYY-MM-DD)" }, 400);

  const title = String(body.title ?? "").trim().slice(0, 200);
  if (!title) return j({ ok: false, error: "Titolo obbligatorio" }, 400);

  // Template default per tipo (può essere overridato passando templateId)
  let templateId = body.templateId as string | undefined;
  if (!templateId) {
    const slug = type.replace(/_/g, "-");
    const tpl = await db.prepare("SELECT id FROM verbali_templates WHERE slug = ?").bind(slug).first<{ id: string }>();
    templateId = tpl?.id;
  }

  const verbale = await createVerbale(db, {
    templateId: templateId ?? null,
    type,
    title,
    meetingDate,
    meetingTime: nstr(body.meetingTime, 10),
    meetingEndTime: nstr(body.meetingEndTime, 10),
    location: nstr(body.location, 200),
    presidentName: nstr(body.presidentName, 80),
    secretaryName: nstr(body.secretaryName, 80),
    attendeesPresent: (body.attendeesPresent as VerbaleAttendee[]) ?? [],
    attendeesAbsent: (body.attendeesAbsent as VerbaleAttendee[]) ?? [],
    agendaItems: (body.agendaItems as VerbaleAgendaItem[]) ?? [],
    agendaMarkdown: nstr(body.agendaMarkdown, 20000),
    bodyExtra: nstr(body.bodyExtra, 10000),
    signers: Array.isArray(body.signers) && body.signers.length > 0
      ? (body.signers as VerbaleSigner[])
      : DEFAULT_SIGNERS,
    createdBy: user.id,
  });
  return j({ ok: true, verbale });
};

function nstr(v: unknown, max: number): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}
function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
