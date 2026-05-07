/**
 * Gestione password dell'utente loggato.
 * - PUT: imposta o aggiorna la password
 * - DELETE: rimuove la password (login solo via magic link)
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { loadUserFromContext, removePassword, setPassword } from "../../../server/auth";
import { validatePasswordStrength } from "../../../server/password";

export const prerender = false;

export const PUT: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  const body = await ctx.request.json<{ password?: string }>();
  const password = (body.password ?? "").trim();
  const err = validatePasswordStrength(password);
  if (err) return json({ ok: false, error: err }, 400);
  await setPassword(db, user.id, password);
  return json({ ok: true });
};

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  await removePassword(db, user.id);
  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
