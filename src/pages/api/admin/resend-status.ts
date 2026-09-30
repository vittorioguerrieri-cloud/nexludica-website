/**
 * GET /api/admin/resend-status
 *
 * Diagnostica Resend:
 *  - Verifica che RESEND_API_KEY sia configurata
 *  - Lista dei domini configurati + stato verifica DNS (SPF/DKIM)
 *  - Lista degli ultimi N email events se l'API lo supporta
 *
 * Utile quando un broadcast risulta inviato a livello applicativo ma non
 * arriva nelle inbox (= Resend l'ha accettato ma e' bounce-ato/spam).
 */
import type { APIRoute } from "astro";
import { getEnv } from "../../../server/db";
import { loadUserFromContext } from "../../../server/auth";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  if (user.role !== "admin") return j({ ok: false, error: "forbidden" }, 403);

  const apiKey = (env as any).RESEND_API_KEY as string | undefined;
  if (!apiKey) {
    return j({ ok: false, error: "RESEND_API_KEY non configurata" }, 503);
  }

  // Lista domini
  let domains: unknown = null;
  let domainsError: string | null = null;
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      domains = await res.json();
    } else {
      domainsError = `${res.status}: ${await res.text()}`;
    }
  } catch (e) {
    domainsError = String(e);
  }

  // Lista API keys (per capire se siamo su test o production key)
  let apiKeys: unknown = null;
  let apiKeysError: string | null = null;
  try {
    const res = await fetch("https://api.resend.com/api-keys", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      apiKeys = await res.json();
    } else {
      apiKeysError = `${res.status}: ${await res.text()}`;
    }
  } catch (e) {
    apiKeysError = String(e);
  }

  return j({
    ok: true,
    fromEmail: env.FROM_EMAIL,
    fromName: env.FROM_NAME,
    domains,
    domainsError,
    apiKeys,
    apiKeysError,
  });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d, null, 2), {
    status: s,
    headers: { "Content-Type": "application/json" },
  });
}
