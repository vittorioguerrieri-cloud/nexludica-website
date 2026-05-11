/**
 * Export CSV delle risposte di uno studio (o di un questionario specifico).
 * Solo admin. Query string:
 *   ?studyId=...
 *   &questionnaireId=...    (opzionale)
 *
 * Le colonne sono: created_at, anonymous_code, completion_code, schema_version,
 * + tutte le chiavi del payload incontrate (union dei campi di tutte le righe).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { getQuestionnaireById, getStudyById, listResponses } from "../../../../server/research";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response("backend", { status: 503 });
  const u = await loadUserFromContext(ctx);
  if (!u || u.role !== "admin") return new Response("forbidden", { status: 403 });

  const studyId = ctx.url.searchParams.get("studyId");
  const questionnaireId = ctx.url.searchParams.get("questionnaireId");
  if (!studyId) return new Response("studyId richiesto", { status: 400 });

  const study = await getStudyById(db, studyId);
  if (!study) return new Response("studio non trovato", { status: 404 });
  const q = questionnaireId ? await getQuestionnaireById(db, questionnaireId) : null;

  const responses = await listResponses(db, studyId, { questionnaireId: questionnaireId ?? undefined, limit: 5000 });

  // Decodifica tutti i payload e calcola le colonne union.
  const decoded = responses.map((r) => {
    let p: Record<string, unknown> = {};
    try { p = JSON.parse(r.payloadJson) ?? {}; } catch {}
    return { ...r, payload: p };
  });
  const fieldsSet = new Set<string>();
  for (const r of decoded) Object.keys(r.payload).forEach((k) => fieldsSet.add(k));
  const fields = Array.from(fieldsSet).sort();

  const headers = ["timestamp", "anonymous_code", "completion_code", "schema_version", ...fields];

  const rows = [headers.map(csvCell).join(",")];
  for (const r of decoded) {
    const row = [
      new Date(r.createdAt).toISOString(),
      r.anonymousCode ?? "",
      r.completionCode,
      String(r.schemaVersion),
      ...fields.map((f) => csvCell(formatValue(r.payload[f]))),
    ];
    rows.push(row.join(","));
  }
  const csv = "﻿" + rows.join("\r\n");  // BOM per Excel

  const safeSlug = study.slug + (q ? "-" + q.slug : "");
  const filename = `responses-${safeSlug}-${new Date().toISOString().split("T")[0]}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
};

function formatValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
function csvCell(s: string): string {
  if (s == null) return "";
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
