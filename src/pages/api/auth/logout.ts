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
  clearSessionCookie(headers, isHttps, ctx.url.hostname);
  headers.set("Location", "/");
  return new Response(null, { status: 302, headers });
};

// Niente GET: il logout deve avvenire solo via POST. Cosi' un attaccante
// non puo' deslogarmi via <img src="/api/auth/logout"> o redirect dal suo
// dominio. Frontend usa fetch POST o <form method="post">.
