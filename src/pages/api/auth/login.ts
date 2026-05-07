/**
 * Login con email + password. Crea sessione e setta cookie.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { createSession, loginWithPassword, setSessionCookie } from "../../../server/auth";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);

  let email = "", password = "";
  try {
    const body = await ctx.request.json<{ email?: string; password?: string }>();
    email = (body.email ?? "").trim().toLowerCase();
    password = body.password ?? "";
  } catch {
    return json({ ok: false, error: "Body non valido" }, 400);
  }
  if (!email || !password) return json({ ok: false, error: "Email e password obbligatori" }, 400);

  const userId = await loginWithPassword(db, email, password);
  if (!userId) {
    return json({ ok: false, error: "Credenziali non valide o password non impostata. Prova col magic link." }, 401);
  }
  const sid = await createSession(db, userId, ctx.request.headers.get("User-Agent"));
  const headers = new Headers({ "Content-Type": "application/json" });
  const isHttps = ctx.url.protocol === "https:";
  setSessionCookie(headers, sid, isHttps);
  return new Response(JSON.stringify({ ok: true, redirect: "/area-soci" }), {
    status: 200,
    headers,
  });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
