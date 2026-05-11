import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import { createStudy, listStudies } from "../../../../../server/research";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const u = await loadUserFromContext(ctx);
  if (!u || u.role !== "admin") return json({ error: "forbidden" }, 403);
  return json({ studies: await listStudies(db) });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const u = await loadUserFromContext(ctx);
  if (!u || u.role !== "admin") return json({ error: "forbidden" }, 403);
  const body = (await ctx.request.json()) as Record<string, unknown>;
  const slug = String(body.slug ?? "").trim();
  const title = String(body.title ?? "").trim();
  if (!slug || !title) return json({ error: "slug e title obbligatori" }, 400);
  if (!/^[a-z0-9-]+$/.test(slug)) return json({ error: "slug invalido" }, 400);
  try {
    const study = await createStudy(db, {
      slug, title,
      description: body.description ? String(body.description) : undefined,
      status: (body.status as any) ?? "draft",
      publicListing: body.publicListing !== false,
      anonymousCodeTemplate: body.anonymousCodeTemplate ? String(body.anonymousCodeTemplate) : undefined,
      identityFields: Array.isArray(body.identityFields) ? body.identityFields as string[] : undefined,
      themeJson: body.themeJson ? String(body.themeJson) : undefined,
    }, u.id);
    return json({ ok: true, study });
  } catch (e: any) {
    if (String(e?.message ?? e).includes("UNIQUE")) return json({ error: "slug gia' usato" }, 409);
    return json({ error: String(e) }, 500);
  }
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
