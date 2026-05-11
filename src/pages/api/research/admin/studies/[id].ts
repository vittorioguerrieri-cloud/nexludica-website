import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { deleteStudy, getStudyById, updateStudy } from "../../../../../server/research";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const u = await loadUserFromContext(ctx);
  if (!u || u.role !== "admin") return json({ error: "forbidden" }, 403);
  const study = await getStudyById(db, ctx.params.id as string);
  return study ? json({ study }) : json({ error: "not_found" }, 404);
};

export const PUT: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const u = await loadUserFromContext(ctx);
  if (!u || u.role !== "admin") return json({ error: "forbidden" }, 403);
  const body = (await ctx.request.json()) as Record<string, unknown>;
  const input: any = {};
  for (const k of ["slug", "title", "description", "status", "anonymousCodeTemplate", "themeJson"] as const) {
    if (body[k] !== undefined) input[k] = String(body[k] ?? "");
  }
  if (body.publicListing !== undefined) input.publicListing = Boolean(body.publicListing);
  if (body.identityFields !== undefined && Array.isArray(body.identityFields)) {
    input.identityFields = body.identityFields as string[];
  }
  try {
    const study = await updateStudy(db, ctx.params.id as string, input);
    return study ? json({ ok: true, study }) : json({ error: "not_found" }, 404);
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
  await deleteStudy(db, ctx.params.id as string);
  return json({ ok: true });
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
