import type { APIRoute } from "astro";
import { getDb } from "../../../server/db";
import { clearSessionCookie, destroySession, readSessionCookie } from "../../../server/auth";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  // @ts-expect-error
  const env: Env | undefined = ctx.locals?.runtime?.env;
  const db = env ? getDb(env) : null;
  const sid = readSessionCookie(ctx.request);
  if (db && sid) await destroySession(db, sid);

  const headers = new Headers();
  const isHttps = ctx.url.protocol === "https:";
  clearSessionCookie(headers, isHttps);
  headers.set("Location", "/");
  return new Response(null, { status: 302, headers });
};

export const GET = POST;
