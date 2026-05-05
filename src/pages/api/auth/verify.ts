import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { consumeMagicLink, createSession, setSessionCookie } from "../../../server/auth";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) {
    return redirect("/login?error=backend");
  }

  const token = ctx.url.searchParams.get("token");
  if (!token) return redirect("/login?error=missing-token");

  const userId = await consumeMagicLink(db, token);
  if (!userId) return redirect("/login?error=invalid-token");

  const sid = await createSession(
    db,
    userId,
    ctx.request.headers.get("User-Agent"),
  );
  const headers = new Headers();
  const isHttps = ctx.url.protocol === "https:";
  setSessionCookie(headers, sid, isHttps);
  headers.set("Location", "/area-soci");
  return new Response(null, { status: 302, headers });
};

function redirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}
