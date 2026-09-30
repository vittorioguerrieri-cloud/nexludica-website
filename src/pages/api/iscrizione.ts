/**
 * Endpoint pubblico per l'iscrizione self-service di un nuovo socio,
 * accessibile solo con un token di invito valido.
 *
 * - GET  /api/iscrizione?token=XXX  → valida il token (per il client che
 *                                      vuole sapere se mostrare il form)
 * - POST /api/iscrizione            → submit multipart con tutti i campi
 *                                      e (opzionale) foto. Crea l'utente
 *                                      con membership_status='pending' e
 *                                      consuma il token.
 *
 * Sicurezza:
 *   - Niente sessione/login: si usa SOLO il token come autorizzazione
 *   - Token single-use: dopo l'invio, marcato used_at
 *   - Email duplicata → errore 409 (nessun side effect)
 *   - Foto: salvata in R2 con key profiles/{newUserId}/{ts}.{ext}
 */
import type { APIRoute } from "astro";
import { getDb, getEnv, now } from "../../server/db";
import { validateInvitation, consumeInvitation } from "../../server/invitations";
import { createMember, updateMemberAsAdmin, normalizeSkills, type UpdateMemberInput } from "../../server/admin";
import { isValidFiscalCode, normalizeFiscalCode } from "../../server/fiscal-code";
import { validateFileMagic } from "../../server/file-magic";

export const prerender = false;

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return json({ ok: false, error: "backend" }, 503);
  const token = new URL(ctx.request.url).searchParams.get("token") ?? "";
  if (!token) return json({ ok: false, error: "Token mancante" }, 400);
  const r = await validateInvitation(db, token);
  if (!r.ok) return json({ ok: false, error: r.error }, 410);
  return json({
    ok: true,
    intendedName: r.invitation.intendedName,
    intendedEmail: r.invitation.intendedEmail,
    expiresAt: r.invitation.expiresAt,
  });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  const storage = env?.STORAGE;
  if (!db) return json({ ok: false, error: "backend" }, 503);

  const contentType = ctx.request.headers.get("content-type") ?? "";
  let body: Record<string, string> = {};
  let photoFile: File | null = null;
  if (contentType.includes("multipart/form-data")) {
    const fd = await ctx.request.formData();
    for (const [k, v] of fd.entries()) {
      if (k === "photo") {
        if (v instanceof File && v.size > 0) photoFile = v;
      } else {
        body[k] = String(v);
      }
    }
  } else {
    // JSON fallback senza foto
    body = (await ctx.request.json().catch(() => ({}))) as Record<string, string>;
  }

  const token = body.token ?? "";
  if (!token) return json({ ok: false, error: "Token mancante" }, 400);

  const inv = await validateInvitation(db, token);
  if (!inv.ok) return json({ ok: false, error: inv.error }, 410);

  // Validazione campi obbligatori
  const required = [
    ["name", "Nome e cognome"],
    ["email", "Email"],
    ["fiscalCode", "Codice fiscale"],
    ["birthDate", "Data di nascita"],
    ["birthPlace", "Luogo di nascita"],
    ["address", "Indirizzo"],
    ["city", "Comune"],
    ["postalCode", "CAP"],
    ["province", "Provincia"],
  ] as const;
  for (const [k, label] of required) {
    if (!String(body[k] ?? "").trim()) {
      return json({ ok: false, error: `Campo obbligatorio mancante: ${label}` }, 400);
    }
  }
  if (!/.+@.+\..+/.test(body.email)) {
    return json({ ok: false, error: "Email non valida" }, 400);
  }
  if (!isValidFiscalCode(body.fiscalCode)) {
    return json({ ok: false, error: "Codice fiscale non valido (checksum errato)" }, 400);
  }
  // Consensi obbligatori
  const truthy = (v: unknown) => v === true || v === "1" || v === 1 || v === "true";
  if (!truthy(body.consentPrivacyAt)) {
    return json({ ok: false, error: "Consenso privacy obbligatorio" }, 400);
  }
  if (!truthy(body.consentStatuteAt)) {
    return json({ ok: false, error: "Presa visione statuto obbligatoria" }, 400);
  }

  // Crea utente (role sempre 'member', status forzato a 'pending')
  let created;
  try {
    created = await createMember(db, body.email.trim().toLowerCase(), body.name.trim(), "member", env);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/UNIQUE/i.test(msg) && /email/i.test(msg)) {
      return json({ ok: false, error: "Esiste gia' un'iscrizione con questa email. Contatta l'associazione." }, 409);
    }
    return json({ ok: false, error: "Errore creazione utente: " + msg }, 500);
  }

  // Volonta' del socio di apparire sul sito pubblico (checkbox dedicato
  // "Voglio comparire sul sito"). Importante: NON impostiamo publicVisible
  // qui — anche se l'utente ha scelto di apparire pubblicamente, il profilo
  // NON deve comparire su /chi-siamo prima dell'approvazione admin (cioe'
  // prima che membership_status passi da 'pending' a 'active'). La volonta'
  // del socio viene comunque registrata via consent_photo_publication_at,
  // cosi' l'admin sa che ha gia' acconsentito e puo' attivare il toggle.
  const wantsPublic = truthy(body.wantPublicProfile);

  // Applica i campi anagrafici/residenza/consensi/profilo
  const input: UpdateMemberInput = {
    fiscalCode: normalizeFiscalCode(body.fiscalCode) ?? undefined,
    birthDate: body.birthDate,
    birthPlace: body.birthPlace,
    citizenship: body.citizenship || undefined,
    phone: body.phone || undefined,
    address: body.address,
    city: body.city,
    postalCode: body.postalCode,
    province: body.province,
    country: body.country || "IT",
    membershipDate: new Date().toISOString().slice(0, 10),
    membershipStatus: "pending", // SEMPRE pending da self-service
    bio: body.bio || undefined,
    skills: body.skills ? normalizeSkills(body.skills) : undefined,
    website: body.website || undefined,
    instagram: body.instagram || body.linkedin || undefined, // legacy alias
    // NB: publicVisible deliberatamente false per pending — l'admin lo
    // abiliterà dopo approvazione. La preferenza del socio rimane
    // registrata via consent_photo_publication_at.
    publicVisible: false,
    emailPublic: false,
    consentPrivacyAt: Date.now(),
    consentStatuteAt: Date.now(),
    consentPhotoPublicationAt: wantsPublic ? Date.now() : null,
    consentMarketingAt: truthy(body.consentMarketingAt) ? Date.now() : null,
  };
  // Per updateMemberAsAdmin serve un admin user id; usa l'admin che ha
  // generato l'invito come "creatore" per audit trail.
  // Try/catch: se updateMemberAsAdmin fallisce, cancelliamo il record user
  // appena creato per evitare di lasciare un utente "mezzo-creato" senza
  // dati legali. L'utente puo' ri-cliccare lo stesso link e riprovare.
  try {
    await updateMemberAsAdmin(db, inv.invitation.createdBy, created.id, input, env);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[iscrizione] updateMemberAsAdmin failed:", msg);
    // Rollback: cancella user (cascade su profiles via FK ON DELETE CASCADE)
    try { await db.prepare("DELETE FROM users WHERE id = ?").bind(created.id).run(); } catch {}
    return json({ ok: false, error: "Errore salvataggio dati: " + msg }, 500);
  }

  // Consuma il token SUBITO dopo l'update riuscito, prima dell'upload foto.
  // Cosi' se il request muore durante l'upload, il token non resta
  // utilizzabile per ricreare un utente con la stessa email (UNIQUE error).
  // La foto e' un bonus: se fallisce, l'iscrizione e' comunque andata a buon
  // fine (l'utente potra' caricare la foto piu' tardi dall'area soci).
  try {
    await consumeInvitation(db, token, created.id);
  } catch (e) {
    console.error("[iscrizione] consumeInvitation failed (non-blocking):", e);
  }

  // Upload foto se presente
  if (photoFile && storage) {
    if (photoFile.size > MAX_PHOTO_BYTES) {
      // L'utente e' gia' creato; la foto viene saltata ma segnaliamo
      return json({
        ok: true,
        userId: created.id,
        warning: "Foto troppo grande (max 5 MB). Iscrizione completata senza foto.",
      });
    }
    const photoMime = await validateFileMagic(photoFile, ["image/jpeg", "image/png", "image/webp"]);
    if (!photoMime.ok) {
      return json({
        ok: true,
        userId: created.id,
        warning: "Tipo file foto non supportato. Iscrizione completata senza foto.",
      });
    }
    const ext = photoMime.mime === "image/png" ? "png" : photoMime.mime === "image/webp" ? "webp" : "jpg";
    const key = `profiles/${created.id}/${Date.now()}.${ext}`;
    await storage.put(key, photoFile.stream(), {
      httpMetadata: {
        contentType: photoMime.mime,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
    await db
      .prepare(
        `UPDATE profiles SET photo_url = ?, updated_at = ? WHERE user_id = ?`,
      )
      .bind(`/r2/${key}`, now(), created.id)
      .run();
  }

  return json({ ok: true, userId: created.id });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
