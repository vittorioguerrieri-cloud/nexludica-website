import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../server/db";
import { loadUserFromContext } from "../../server/auth";
import { getMyProfile, upsertProfile } from "../../server/profiles";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);
  const profile = await getMyProfile(db, user.id);
  return json({ user, profile });
};

export const PUT: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown> = {};
  const ct = ctx.request.headers.get("Content-Type") ?? "";
  if (ct.includes("application/json")) {
    body = await ctx.request.json();
  } else {
    const fd = await ctx.request.formData();
    body = Object.fromEntries(fd.entries());
  }

  await upsertProfile(db, user.id, {
    displayName: optStr(body.displayName ?? body.display_name),
    roleLabel: optStr(body.roleLabel ?? body.role_label),
    bio: optStr(body.bio),
    skills: optStr(body.skills),
    photoUrl: optStr(body.photoUrl ?? body.photo_url),
    website: optStr(body.website),
    linkedin: optStr(body.linkedin),
    publicVisible: optBool(body.publicVisible ?? body.public_visible),
  });
  const profile = await getMyProfile(db, user.id);
  return json({ ok: true, profile });
};

function optStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  return String(v);
}
function optBool(v: unknown): boolean | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).toLowerCase();
  if (["1", "true", "on", "yes"].includes(s)) return true;
  if (["0", "false", "off", "no"].includes(s)) return false;
  return undefined;
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
