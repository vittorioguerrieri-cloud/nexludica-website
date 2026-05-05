import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { clearSessionCookie, destroySession, readSessionCookie } from "../../../server/auth";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  const sid = readSessionCookie(ctx.request);
  if (db && sid) await destroySession(db, sid);

  const headers = new Headers();
  const isHttps = ctx.url.protocol === "https:";
  clearSessionCookie(headers, isHttps);
  headers.set("Location", "/");
  return new Response(null, { status: 302, headers });
};

export const GET = POST;
