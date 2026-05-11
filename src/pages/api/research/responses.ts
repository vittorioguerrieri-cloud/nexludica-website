/**
 * POST /api/research/responses
 * Endpoint pubblico (no auth) per ricevere le risposte ai questionari.
 *
 * Body: { questionnaireId: string, payload: object }
 * Risposta: { ok: true, completionCode, anonymousCode }
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { sha256Hex, submitResponse } from "../../../server/research";

export const prerender = false;

const MAX_PAYLOAD_BYTES = 1 * 1024 * 1024; // 1 MB

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);

  // Body size limit
  const lengthHeader = ctx.request.headers.get("Content-Length");
  if (lengthHeader && Number(lengthHeader) > MAX_PAYLOAD_BYTES) {
    return json({ ok: false, error: "Payload troppo grande" }, 413);
  }

  let body: { questionnaireId?: string; payload?: Record<string, unknown> };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ ok: false, error: "Body JSON non valido" }, 400);
  }
  const questionnaireId = body?.questionnaireId;
  const payload = body?.payload;
  if (!questionnaireId || typeof questionnaireId !== "string") {
    return json({ ok: false, error: "questionnaireId obbligatorio" }, 400);
  }
  if (!payload || typeof payload !== "object") {
    return json({ ok: false, error: "payload obbligatorio" }, 400);
  }

  // Hash anonimo dell'IP per anti-spam / contatori senza tracciare
  const ip =
    ctx.request.headers.get("CF-Connecting-IP") ??
    ctx.request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "";
  const ipHash = ip ? await sha256Hex(ip) : null;

  const result = await submitResponse(db, {
    questionnaireId,
    payload,
    userAgent: ctx.request.headers.get("User-Agent") ?? undefined,
    ipHash: ipHash ?? undefined,
  });
  if ("error" in result) return json({ ok: false, error: result.error }, 400);

  return json({
    ok: true,
    id: result.id,
    completionCode: result.completionCode,
    anonymousCode: result.anonymousCode,
  });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
