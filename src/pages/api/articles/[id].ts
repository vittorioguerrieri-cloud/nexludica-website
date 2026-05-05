import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { loadUserFromContext } from "../../../server/auth";
import { deleteArticle, updateArticle } from "../../../server/articles";

export const prerender = false;

export const PATCH: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);
  const id = ctx.params.id as string;
  const body = await ctx.request.json<Record<string, unknown>>();
  const ok = await updateArticle(db, user.id, id, {
    title: optStr(body.title),
    speaker: optStr(body.speaker),
    meetingDate: optStr(body.meetingDate),
    abstract: optStr(body.abstract),
    tags: Array.isArray(body.tags) ? (body.tags as string[]) : undefined,
    videoUrl: optStr(body.videoUrl),
    status: optStr(body.status) as "draft" | "published" | "archived" | undefined,
  });
  return ok ? json({ ok: true }) : json({ error: "not_found_or_forbidden" }, 404);
};

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);
  const id = ctx.params.id as string;
  const r = await deleteArticle(db, user.id, id);
  if (!r.ok) return json({ error: "not_found_or_forbidden" }, 404);
  // Best-effort R2 cleanup
  if (r.documentKey && env?.STORAGE) {
    try {
      await env.STORAGE.delete(r.documentKey);
    } catch {}
  }
  return json({ ok: true });
};

function optStr(v: unknown): string | undefined {
  return v == null ? undefined : String(v);
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
