import type { APIRoute } from "astro";
import { getDb } from "../../server/db";
import { listPublicMembers } from "../../server/profiles";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  // @ts-expect-error
  const env: Env | undefined = ctx.locals?.runtime?.env;
  const db = env ? getDb(env) : null;
  if (!db) return new Response(JSON.stringify({ members: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
  const members = await listPublicMembers(db);
  return new Response(JSON.stringify({ members }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
  });
};
