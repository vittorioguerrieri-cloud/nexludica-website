import type { APIRoute } from "astro";
import { getDb } from "../../../server/db";
import { createMagicLink, findUserByEmail } from "../../../server/auth";
import { magicLinkEmail, sendEmail } from "../../../server/email";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  // @ts-expect-error
  const env: Env | undefined = ctx.locals?.runtime?.env;
  const db = env ? getDb(env) : null;
  if (!env || !db) {
    return json({ ok: false, error: "Backend non configurato (D1 mancante)" }, 503);
  }

  let email = "";
  try {
    const body = await ctx.request.clone().json<{ email?: string }>();
    email = (body.email ?? "").trim().toLowerCase();
  } catch {
    // form-data fallback
    const fd = await ctx.request.formData();
    email = String(fd.get("email") ?? "").trim().toLowerCase();
  }
  if (!email || !/.+@.+\..+/.test(email)) {
    return json({ ok: false, error: "Email non valida" }, 400);
  }

  // Risposta sempre uguale anche se l'email non e' un socio (anti-enumeration).
  const user = await findUserByEmail(db, email);
  if (!user) {
    // Non riveliamo che l'utente non esiste.
    return json({ ok: true, sent: true, devLink: null });
  }

  const token = await createMagicLink(db, user.id);
  const siteUrl = env.SITE_URL || `https://${ctx.url.host}`;
  const link = `${siteUrl}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const msg = magicLinkEmail({
    toName: user.name,
    link,
    fromName: env.FROM_NAME || "NexLudica",
  });
  msg.to = user.email;
  const result = await sendEmail(env, msg);

  // Se siamo in dev (no API key), ritorna il link nel response per testare.
  return json({
    ok: result.ok,
    sent: result.ok,
    devLink: result.loggedOnly ? link : null,
    error: result.ok ? undefined : result.error,
  });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
