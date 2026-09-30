/**
 * Admin: dettaglio + update socio.
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import { getMemberById, updateMemberAsAdmin, type UpdateMemberInput } from "../../../../server/admin";
import { setEmailNexludica } from "../../../../server/profiles";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.role !== "admin") return json({ error: "forbidden" }, 403);
  const id = ctx.params.id as string;
  const member = await getMemberById(db, id);
  if (!member) return json({ error: "not_found" }, 404);
  return json({ member });
};

export const PUT: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.role !== "admin") return json({ error: "forbidden" }, 403);
  const id = ctx.params.id as string;
  const body = (await ctx.request.json()) as Record<string, unknown>;

  // Whitelist + parse
  const input: UpdateMemberInput = {};
  if (body.role) input.role = body.role as "admin" | "member" | "collaborator";
  if (body.active !== undefined) input.active = Boolean(body.active);
  if (body.boardRole !== undefined) {
    const v = body.boardRole;
    if (v === null || v === "" || v === "none") input.boardRole = null;
    else if (typeof v === "string" && ["presidente","vice_presidente","segretario","tesoriere","consigliere"].includes(v)) {
      input.boardRole = v as any;
    }
  }
  if (body.roleLabel !== undefined) input.roleLabel = String(body.roleLabel);
  // Toggle visibilità: la pagina invia "0"/"1" come stringhe.
  const truthy = (v: unknown) => v === true || v === "1" || v === 1 || v === "true";
  if (body.publicVisible !== undefined) input.publicVisible = truthy(body.publicVisible);
  if (body.emailPublic !== undefined) input.emailPublic = truthy(body.emailPublic);
  // Whitelist completa di campi editabili dall'admin sulla pagina dettaglio
  for (const k of [
    "fiscalCode", "birthDate", "birthPlace", "phone",
    "address", "city", "postalCode", "province", "country",
    "membershipDate", "membershipStatus",
    "lastPaymentDate", "paymentNotes", "internalNotes",
    // GDPR / CTS estesi
    "citizenship", "terminationDate", "terminationReason",
    // Profilo pubblico (admin override delle preferenze del socio)
    "displayName", "bio", "skills", "website", "instagram", "photoUrl",
  ] as const) {
    if (body[k] !== undefined) (input as Record<string, unknown>)[k] = String(body[k] ?? "");
  }
  if (body.lastPaymentAmount !== undefined) {
    const n = Number(body.lastPaymentAmount);
    input.lastPaymentAmount = Number.isFinite(n) ? n : null;
  }
  // Timestamps consensi: accetta sia boolean ("set now") sia numero (ts esplicito)
  const setConsentTs = (v: unknown): number | undefined => {
    if (v === undefined) return undefined;
    if (v === null || v === "" || v === "0" || v === false) return undefined; // no-op
    if (typeof v === "number") return v;
    if (truthy(v)) return Date.now();
    return undefined;
  };
  for (const k of [
    "consentPrivacyAt", "consentStatuteAt",
    "consentPhotoPublicationAt", "consentMarketingAt",
  ] as const) {
    const ts = setConsentTs(body[k]);
    if (ts !== undefined) (input as Record<string, number>)[k] = ts;
  }
  // Email ufficiale @nexludica.org (campo su users, gestito a parte)
  if (body.emailNexludica !== undefined) {
    const r = await setEmailNexludica(db, id, body.emailNexludica == null ? null : String(body.emailNexludica));
    if (!r.ok) return json({ error: r.error }, 400);
  }

  // IBAN (member_data) — upsert dedicato
  if (body.iban !== undefined) {
    const iban = body.iban == null ? null : String(body.iban).replace(/\s+/g, "").toUpperCase().slice(0, 34) || null;
    await db
      .prepare(
        `INSERT INTO member_data (user_id, iban, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET iban = excluded.iban, updated_at = excluded.updated_at`,
      )
      .bind(id, iban, Date.now())
      .run();
  }

  await updateMemberAsAdmin(db, user.id, id, input, env);
  const member = await getMemberById(db, id);
  return json({ ok: true, member });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
