import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../server/db";
import { listPublicMembers } from "../../server/profiles";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response(JSON.stringify({ members: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
  const members = await listPublicMembers(db);
  return new Response(JSON.stringify({ members }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
  });
};
