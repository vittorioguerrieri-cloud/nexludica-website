import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { createMagicLink, findUserByEmail } from "../../../server/auth";
import { magicLinkEmail, sendEmail } from "../../../server/email";
import { checkAndRecordAttempt } from "../../../server/rate-limit";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) {
    return json({ ok: false, error: "Backend non configurato (D1 mancante)" }, 503);
  }

  // Rate limit: max 8 magic link richiesti/ora per IP. Protegge contro:
  //  - email spam (l'attaccante fa partire 100 email a indirizzi a caso)
  //  - enumeration via timing oracle
  const rl = await checkAndRecordAttempt(db, ctx.request, "magic-link", { max: 8 });
  if (!rl.ok) {
    return json({ ok: false, error: "Troppe richieste di magic link. Riprova fra un'ora." }, 429);
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

  // Espone devLink SOLO se siamo esplicitamente in dev mode.
  // In produzione, anche se RESEND_API_KEY mancasse per errore, MAI esporre
  // il link nel response (sarebbe takeover account).
  const isDev =
    (env as unknown as { ENVIRONMENT?: string }).ENVIRONMENT === "development" ||
    ctx.url.hostname === "localhost" ||
    ctx.url.hostname.endsWith(".workers.dev");
  return json({
    ok: result.ok,
    sent: result.ok,
    devLink: result.loggedOnly && isDev ? link : null,
    error: result.ok ? undefined : result.error,
  });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
