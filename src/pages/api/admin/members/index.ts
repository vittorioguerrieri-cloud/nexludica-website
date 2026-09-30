/**
 * Admin: lista soci e creazione nuovo socio.
 *
 * - GET   /api/admin/members            → lista
 * - POST  /api/admin/members            → crea socio (payload "ridotto":
 *                                          name+email+role) per il modal
 *                                          legacy in admin/index.astro
 * - POST  /api/admin/members?full=1     → crea socio con TUTTI i campi
 *                                          (anagrafica, residenza, consensi,
 *                                          profilo pubblico). Usato dalla
 *                                          pagina /area-soci/admin/nuovo.
 *
 * Solo admin (users.role='admin').
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../server/db";
import { loadUserFromContext } from "../../../../server/auth";
import {
  listAllMembers,
  createMember,
  updateMemberAsAdmin,
  normalizeSkills,
  type Role,
  type MembershipStatus,
  type UpdateMemberInput,
} from "../../../../server/admin";
import { isValidFiscalCode, normalizeFiscalCode } from "../../../../server/fiscal-code";

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.role !== "admin") return json({ error: "forbidden" }, 403);
  const members = await listAllMembers(db);
  return json({ members });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.role !== "admin") return json({ error: "forbidden" }, 403);

  const url = new URL(ctx.request.url);
  const full = url.searchParams.get("full") === "1";
  const body = (await ctx.request.json()) as Record<string, unknown>;

  // Campi base sempre richiesti
  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const role = (body.role as Role) ?? "member";
  if (!email || !name) return json({ error: "Nome ed email sono obbligatori" }, 400);
  if (!/.+@.+\..+/.test(email)) return json({ error: "Email non valida" }, 400);
  if (!["admin", "member", "collaborator"].includes(role)) {
    return json({ error: "Ruolo non valido" }, 400);
  }

  // Validazioni full
  if (full) {
    const fc = String(body.fiscalCode ?? "").trim();
    if (!fc) {
      return json({ error: "Codice fiscale obbligatorio (libro soci, art. 15 D.Lgs. 117/2017)" }, 400);
    }
    if (!isValidFiscalCode(fc)) {
      return json({ error: "Codice fiscale non valido (checksum errato)" }, 400);
    }
    // Anagrafica minima obbligatoria per il libro soci
    const minRequired = [
      ["birthDate", "Data di nascita"],
      ["birthPlace", "Luogo di nascita"],
      ["address", "Indirizzo di residenza"],
      ["city", "Comune di residenza"],
      ["postalCode", "CAP"],
      ["province", "Provincia"],
    ] as const;
    for (const [k, label] of minRequired) {
      if (!String(body[k] ?? "").trim()) {
        return json({ error: `Campo obbligatorio mancante: ${label}` }, 400);
      }
    }
    // Consensi GDPR obbligatori per legge: privacy + statuto
    if (!body.consentPrivacyAt) {
      return json({ error: "Consenso privacy mancante" }, 400);
    }
    if (!body.consentStatuteAt) {
      return json({ error: "Presa visione statuto mancante" }, 400);
    }
  }

  // Crea l'utente base (users + profiles)
  let created;
  try {
    created = await createMember(db, email, name, role, env);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/UNIQUE/i.test(msg) && /email/i.test(msg)) {
      return json({ error: "Email gia' registrata" }, 409);
    }
    return json({ error: "Errore creazione utente: " + msg }, 500);
  }

  // Se full, applica tutti gli altri campi via updateMemberAsAdmin
  if (full) {
    const input: UpdateMemberInput = {};
    const truthy = (v: unknown) => v === true || v === "1" || v === 1 || v === "true";
    // Profilo pubblico
    if (body.displayName !== undefined) input.displayName = String(body.displayName);
    if (body.roleLabel !== undefined) input.roleLabel = String(body.roleLabel);
    if (body.bio !== undefined) input.bio = String(body.bio);
    if (body.skills !== undefined) input.skills = normalizeSkills(String(body.skills));
    if (body.website !== undefined) input.website = String(body.website);
    if (body.instagram !== undefined) input.instagram = String(body.instagram);
    else if (body.linkedin !== undefined) input.instagram = String(body.linkedin); // legacy alias
    if (body.publicVisible !== undefined) input.publicVisible = truthy(body.publicVisible);
    if (body.emailPublic !== undefined) input.emailPublic = truthy(body.emailPublic);
    // Anagrafica
    const fcNorm = normalizeFiscalCode(String(body.fiscalCode ?? ""));
    if (fcNorm) input.fiscalCode = fcNorm;
    if (body.birthDate) input.birthDate = String(body.birthDate);
    if (body.birthPlace !== undefined) input.birthPlace = String(body.birthPlace);
    if (body.citizenship !== undefined) input.citizenship = String(body.citizenship);
    if (body.phone !== undefined) input.phone = String(body.phone);
    // Residenza
    if (body.address !== undefined) input.address = String(body.address);
    if (body.city !== undefined) input.city = String(body.city);
    if (body.postalCode !== undefined) input.postalCode = String(body.postalCode);
    if (body.province !== undefined) input.province = String(body.province);
    if (body.country !== undefined) input.country = String(body.country);
    // Iscrizione
    if (body.membershipDate) input.membershipDate = String(body.membershipDate);
    if (body.membershipStatus) input.membershipStatus = body.membershipStatus as MembershipStatus;
    if (body.lastPaymentDate) input.lastPaymentDate = String(body.lastPaymentDate);
    if (body.lastPaymentAmount !== undefined && body.lastPaymentAmount !== "") {
      const n = Number(body.lastPaymentAmount);
      input.lastPaymentAmount = Number.isFinite(n) ? n : null;
    }
    if (body.paymentNotes !== undefined) input.paymentNotes = String(body.paymentNotes);
    if (body.internalNotes !== undefined) input.internalNotes = String(body.internalNotes);
    // Consensi (i checkbox arrivano come truthy → registriamo timestamp now())
    const ts = Date.now();
    if (truthy(body.consentPrivacyAt)) input.consentPrivacyAt = ts;
    if (truthy(body.consentStatuteAt)) input.consentStatuteAt = ts;
    if (truthy(body.consentPhotoPublicationAt)) input.consentPhotoPublicationAt = ts;
    if (truthy(body.consentMarketingAt)) input.consentMarketingAt = ts;
    // Rollback: se l'update fallisce, cancella l'user appena creato per
    // evitare di lasciare record orfani senza dati anagrafici.
    try {
      await updateMemberAsAdmin(db, user.id, created.id, input, env);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[admin/members POST full] updateMemberAsAdmin failed:", msg);
      try { await db.prepare("DELETE FROM users WHERE id = ?").bind(created.id).run(); } catch {}
      return json({ ok: false, error: "Errore salvataggio dati: " + msg }, 500);
    }
  }

  return json({ ok: true, user: created });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
