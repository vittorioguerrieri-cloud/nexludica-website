import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { deleteQuestionnaire, getQuestionnaireById, updateQuestionnaire } from "../../../../../server/research";

export const prerender = false;

export const PUT: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const u = await loadUserFromContext(ctx);
  if (!u || u.role !== "admin") return json({ error: "forbidden" }, 403);
  const body = (await ctx.request.json()) as Record<string, unknown>;
  const input: any = {};
  for (const k of ["slug", "title", "description", "schemaJson", "status"] as const) {
    if (body[k] !== undefined) input[k] = String(body[k] ?? "");
  }
  if (body.position !== undefined) input.position = Number(body.position);
  if (input.schemaJson) {
    try { JSON.parse(input.schemaJson); }
    catch { return json({ error: "schemaJson non valido" }, 400); }
  }
  try {
    const questionnaire = await updateQuestionnaire(db, ctx.params.id as string, input);
    return questionnaire ? json({ ok: true, questionnaire }) : json({ error: "not_found" }, 404);
  } catch (e: any) {
    if (String(e?.message ?? e).includes("UNIQUE")) return json({ error: "slug gia' usato" }, 409);
    return json({ error: String(e) }, 500);
  }
};

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const u = await loadUserFromContext(ctx);
  if (!u || u.role !== "admin") return json({ error: "forbidden" }, 403);
  await deleteQuestionnaire(db, ctx.params.id as string);
  return json({ ok: true });
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
