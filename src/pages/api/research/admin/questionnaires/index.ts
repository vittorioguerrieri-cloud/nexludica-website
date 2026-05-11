import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { createQuestionnaire } from "../../../../../server/research";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const u = await loadUserFromContext(ctx);
  if (!u || u.role !== "admin") return json({ error: "forbidden" }, 403);
  const body = (await ctx.request.json()) as Record<string, unknown>;
  const studyId = String(body.studyId ?? "").trim();
  const slug = String(body.slug ?? "").trim();
  const title = String(body.title ?? "").trim();
  const schemaJson = String(body.schemaJson ?? "");
  if (!studyId || !slug || !title || !schemaJson) {
    return json({ error: "Campi obbligatori mancanti" }, 400);
  }
  if (!/^[a-z0-9-]+$/.test(slug)) return json({ error: "slug invalido" }, 400);
  try {
    JSON.parse(schemaJson);
  } catch {
    return json({ error: "schemaJson non e' JSON valido" }, 400);
  }
  try {
    const questionnaire = await createQuestionnaire(db, {
      studyId, slug, title, schemaJson,
      description: body.description ? String(body.description) : undefined,
      position: typeof body.position === "number" ? body.position : 0,
      status: (body.status as any) ?? "draft",
    });
    return json({ ok: true, questionnaire });
  } catch (e: any) {
    if (String(e?.message ?? e).includes("UNIQUE")) return json({ error: "slug gia' usato in questo studio" }, 409);
    return json({ error: String(e) }, 500);
  }
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
