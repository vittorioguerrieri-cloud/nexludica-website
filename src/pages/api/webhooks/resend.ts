/**
 * Webhook Resend: riceve gli eventi di consegna (delivered/bounced/complained/
 * opened/...) e aggiorna lo stato per-destinatario dei broadcast MeetLudica.
 *
 * Sicurezza: gli eventi sono firmati (schema Svix). Verifichiamo la firma con
 * RESEND_WEBHOOK_SECRET (whsec_...). Senza secret configurato l'endpoint
 * rifiuta tutto (per non accettare eventi non autenticati).
 *
 * Configurazione (una tantum) lato Resend:
 *   Dashboard Resend -> Webhooks -> Add Endpoint
 *   URL: https://www.nexludica.org/api/webhooks/resend
 *   Eventi: email.delivered, email.bounced, email.complained,
 *           email.delivery_delayed, email.opened
 *   Copia il "Signing Secret" e impostalo:
 *     wrangler secret put RESEND_WEBHOOK_SECRET
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { updateRecipientByResendId } from "../../../server/meetludica";

export const prerender = false;

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Verifica la firma Svix (Resend). */
async function verifySignature(
  secret: string,
  svixId: string,
  svixTs: string,
  body: string,
  sigHeader: string,
): Promise<boolean> {
  const keyB64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try { keyBytes = b64ToBytes(keyB64); } catch { return false; }
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signed = `${svixId}.${svixTs}.${body}`;
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(signed));
  const expected = bytesToB64(new Uint8Array(sigBuf));
  // Header: "v1,<sig> v1,<sig2> ..."
  const provided = sigHeader.split(" ").map((p) => (p.includes(",") ? p.split(",")[1] : p));
  return provided.some((p) => timingSafeEq(p, expected));
}

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return new Response("backend", { status: 503 });

  const secret = env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("webhook secret non configurato", { status: 503 });

  const raw = await ctx.request.text();
  const h = ctx.request.headers;
  const svixId = h.get("svix-id") ?? h.get("webhook-id") ?? "";
  const svixTs = h.get("svix-timestamp") ?? h.get("webhook-timestamp") ?? "";
  const svixSig = h.get("svix-signature") ?? h.get("webhook-signature") ?? "";
  if (!svixId || !svixTs || !svixSig) return new Response("missing signature headers", { status: 400 });

  const valid = await verifySignature(secret, svixId, svixTs, raw, svixSig).catch(() => false);
  if (!valid) return new Response("invalid signature", { status: 401 });

  let evt: { type?: string; data?: Record<string, unknown> };
  try { evt = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }

  const type = String(evt.type ?? "");
  const data = (evt.data ?? {}) as Record<string, unknown>;
  const emailId = String((data.email_id ?? data.id ?? "") as string);
  if (!emailId) return new Response("ok (no email_id)", { status: 200 });

  try {
    switch (type) {
      case "email.delivered":
        await updateRecipientByResendId(db, emailId, { status: "delivered" });
        break;
      case "email.bounced": {
        const b = (data.bounce ?? {}) as Record<string, unknown>;
        await updateRecipientByResendId(db, emailId, {
          status: "bounced",
          bounceType: (b.type as string) ?? (b.subType as string) ?? null,
          detail: (b.message as string) ?? null,
        });
        break;
      }
      case "email.complained":
        await updateRecipientByResendId(db, emailId, { status: "complained", detail: "Segnalata come spam" });
        break;
      case "email.failed": {
        const f = (data.failed ?? {}) as Record<string, unknown>;
        await updateRecipientByResendId(db, emailId, {
          status: "failed",
          detail: (f.reason as string) ?? "Invio fallito",
        });
        break;
      }
      case "email.delivery_delayed":
        await updateRecipientByResendId(db, emailId, { status: "delivery_delayed" });
        break;
      case "email.opened":
      case "email.clicked":
        await updateRecipientByResendId(db, emailId, { opened: true });
        break;
      default:
        // email.sent e altri: nessun aggiornamento necessario.
        break;
    }
  } catch (e) {
    console.error("[resend-webhook] update failed:", e);
    // Rispondiamo 200 comunque per evitare retry infiniti su errori applicativi.
  }

  return new Response("ok", { status: 200 });
};
