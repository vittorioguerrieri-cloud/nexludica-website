/**
 * Endpoint pubblico del sondaggio orari MeetLudica 2027.
 * POST con { name, email, slots: string[], notes?, company? (honeypot) }
 *
 * - Honeypot + rate-limit best-effort (10 invii/ora per IP)
 * - Una risposta per email: un secondo invio aggiorna la precedente
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../server/db";
import { cleanSlots, saveOrariRisposta } from "../../../server/meetludica-orari";

export const prerender = false;

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);

  const body = (await ctx.request.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim().slice(0, 100);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const notes = String(body.notes ?? "").trim().slice(0, 1000) || null;
  const slots = cleanSlots(body.slots);
  const honeypot = String(body.company ?? "").trim();

  if (honeypot) return json({ ok: true, updated: false });

  if (!name || !email) return json({ ok: false, error: "Nome ed email sono obbligatori" }, 400);
  if (!/.+@.+\..+/.test(email)) return json({ ok: false, error: "Email non valida" }, 400);
  if (slots.length === 0 && !notes) {
    return json({ ok: false, error: "Indica almeno una fascia oraria, oppure scrivici nelle note" }, 400);
  }

  const ip = ctx.request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";
  const ipHash = await sha256Hex("meetludica-orari:" + ip);
  try {
    const hourAgo = Date.now() - 60 * 60 * 1000;
    const r = await db
      .prepare("SELECT COUNT(*) as n FROM meetludica_orari_2027 WHERE ip_hash = ? AND updated_at > ?")
      .bind(ipHash, hourAgo)
      .first<{ n: number }>();
    if (r && r.n >= 10) {
      return json({ ok: false, error: "Troppe risposte recenti da questa rete. Riprova fra un'ora." }, 429);
    }
  } catch { /* fail-open */ }

  try {
    const updated = await saveOrariRisposta(db, { name, email, slots, notes, ipHash });
    return json({ ok: true, updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: "Errore database: " + msg }, 500);
  }
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
