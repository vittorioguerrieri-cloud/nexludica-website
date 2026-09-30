/**
 * Gestione password dell'utente loggato.
 * - PUT: imposta o aggiorna la password
 * - DELETE: rimuove la password (login solo via magic link)
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { loadUserFromContext, removePassword, setPassword } from "../../../server/auth";
import { validatePasswordStrength, verifyPassword } from "../../../server/password";

export const prerender = false;

/**
 * Ritorna true se l'utente ha gia' una password impostata.
 * (Verifichiamo dal DB perche' SessionUser non lo include.)
 */
async function userHasPassword(db: D1Database, userId: string): Promise<boolean> {
  const r = await db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(userId)
    .first<{ password_hash: string | null }>();
  return !!(r && r.password_hash);
}

async function getPasswordHash(db: D1Database, userId: string): Promise<string | null> {
  const r = await db
    .prepare("SELECT password_hash FROM users WHERE id = ?")
    .bind(userId)
    .first<{ password_hash: string | null }>();
  return r?.password_hash ?? null;
}

export const PUT: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  const body = await ctx.request.json<{ password?: string; oldPassword?: string }>();
  const password = (body.password ?? "").trim();
  const oldPassword = (body.oldPassword ?? "").trim();
  const err = validatePasswordStrength(password);
  if (err) return json({ ok: false, error: err }, 400);

  // Se l'utente ha gia' una password, richiediamo quella vecchia per cambiare.
  // Cosi' un session-hijack non puo' lockare il proprietario fuori dall'account.
  // Se NON c'e' password (primo set), salta il check.
  const currentHash = await getPasswordHash(db, user.id);
  if (currentHash) {
    if (!oldPassword) {
      return json({ ok: false, error: "Per cambiare password serve la password attuale" }, 400);
    }
    const ok = await verifyPassword(oldPassword, currentHash);
    if (!ok) return json({ ok: false, error: "Password attuale errata" }, 400);
  }

  await setPassword(db, user.id, password);
  return json({ ok: true });
};

export const DELETE: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  // Anche per rimuovere serve la password attuale, sempre per evitare
  // hijack -> rimozione password -> takeover via magic link.
  const currentHash = await getPasswordHash(db, user.id);
  if (currentHash) {
    const body = await ctx.request.json<{ password?: string }>().catch(() => ({}));
    const oldPassword = (body.password ?? "").trim();
    if (!oldPassword) return json({ ok: false, error: "Password attuale richiesta" }, 400);
    const ok = await verifyPassword(oldPassword, currentHash);
    if (!ok) return json({ ok: false, error: "Password attuale errata" }, 400);
  }
  await removePassword(db, user.id);
  return json({ ok: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
