/**
 * Helper amministrativi: solo admin possono leggere/scrivere
 * questi dati. Il check del ruolo viene fatto negli endpoint che
 * usano queste funzioni.
 */
import { now, type UserRow } from "./db";
import { grantEditor, revokeAccess } from "./drive";

export type Role = "admin" | "member" | "collaborator";
export type MembershipStatus = "active" | "pending" | "suspended" | "former";

export interface MemberDataRow {
  user_id: string;
  fiscal_code: string | null;
  birth_date: string | null;
  birth_place: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  province: string | null;
  country: string | null;
  membership_date: string | null;
  membership_status: MembershipStatus;
  last_payment_date: string | null;
  last_payment_amount: number | null;
  payment_notes: string | null;
  internal_notes: string | null;
  citizenship: string | null;
  termination_date: string | null;
  termination_reason: string | null;
  consent_privacy_at: number | null;
  consent_statute_at: number | null;
  consent_photo_publication_at: number | null;
  consent_marketing_at: number | null;
  updated_at: number;
  updated_by: string | null;
}

export interface AdminMemberView {
  // dati base
  id: string;
  email: string;
  emailNexludica: string | null;
  iban: string | null;
  name: string;
  role: Role;
  active: boolean;
  createdAt: number;
  lastLoginAt: number | null;
  // profilo
  displayName: string | null;
  roleLabel: string | null;
  bio: string | null;
  skills: string | null;
  photoUrl: string | null;
  publicVisible: boolean;
  emailPublic: boolean;
  // member_data
  fiscalCode: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  province: string | null;
  country: string | null;
  membershipDate: string | null;
  membershipStatus: MembershipStatus;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  paymentNotes: string | null;
  internalNotes: string | null;
  citizenship: string | null;
  terminationDate: string | null;
  terminationReason: string | null;
  consentPrivacyAt: number | null;
  consentStatuteAt: number | null;
  consentPhotoPublicationAt: number | null;
  consentMarketingAt: number | null;
  /** Ruolo nel Consiglio Direttivo (NULL = non in direttivo). */
  boardRole: "presidente" | "vice_presidente" | "segretario" | "tesoriere" | "consigliere" | null;
}

/**
 * Normalizza la stringa "competenze" inviata da un form: accetta una lista
 * separata da virgole (input naturale, "Psicometria, Game design"), pulisce
 * gli spazi e produce la forma di storage standardizzata con separatore " · "
 * (lo stesso usato sulla pagina pubblica "Chi siamo").
 *
 * Accetta anche input gia' nella forma " · " (idempotente).
 *
 * Esempi:
 *   "Psicometria, Game design, Lavoro sociale" → "Psicometria · Game design · Lavoro sociale"
 *   "Psicometria , , Game design"              → "Psicometria · Game design"
 *   "Psicometria · Game design"                → "Psicometria · Game design"
 *   ""                                          → ""
 */
export function normalizeSkills(input: string | undefined | null): string {
  if (input == null) return "";
  return input
    .replace(/·|•/g, ",") // bullet/middot → virgola, poi ri-split
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" · ");
}

export async function listAllMembers(db: D1Database): Promise<AdminMemberView[]> {
  const rs = await db
    .prepare(
      `SELECT
        u.id, u.email, u.name, u.role, u.active, u.board_role, u.created_at, u.last_login_at,
        p.display_name, p.role_label, p.bio, p.skills, p.photo_url,
        p.public_visible, p.email_public,
        m.fiscal_code, m.birth_date, m.birth_place, m.phone,
        m.address, m.city, m.postal_code, m.province, m.country,
        m.membership_date,
        COALESCE(m.membership_status, 'active') as membership_status,
        m.last_payment_date, m.last_payment_amount, m.payment_notes,
        m.internal_notes,
        m.citizenship, m.termination_date, m.termination_reason,
        m.consent_privacy_at, m.consent_statute_at,
        m.consent_photo_publication_at, m.consent_marketing_at
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN member_data m ON m.user_id = u.id
       ORDER BY u.role = 'admin' DESC, u.name ASC`,
    )
    .all();
  return (rs.results as Array<Record<string, unknown>>).map(rowToMember);
}

export async function getMemberById(
  db: D1Database,
  userId: string,
): Promise<AdminMemberView | null> {
  const r = await db
    .prepare(
      `SELECT
        u.id, u.email, u.name, u.role, u.active, u.board_role, u.created_at, u.last_login_at,
        u.email_nexludica,
        p.display_name, p.role_label, p.bio, p.skills, p.photo_url,
        p.public_visible, p.email_public,
        m.fiscal_code, m.birth_date, m.birth_place, m.phone,
        m.address, m.city, m.postal_code, m.province, m.country, m.iban,
        m.membership_date,
        COALESCE(m.membership_status, 'active') as membership_status,
        m.last_payment_date, m.last_payment_amount, m.payment_notes,
        m.internal_notes,
        m.citizenship, m.termination_date, m.termination_reason,
        m.consent_privacy_at, m.consent_statute_at,
        m.consent_photo_publication_at, m.consent_marketing_at
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN member_data m ON m.user_id = u.id
       WHERE u.id = ?`,
    )
    .bind(userId)
    .first<Record<string, unknown>>();
  return r ? rowToMember(r) : null;
}

function rowToMember(r: Record<string, unknown>): AdminMemberView {
  const num = (k: string) => (r[k] != null ? Number(r[k]) : 0);
  const str = (k: string) => (r[k] != null ? String(r[k]) : null);
  return {
    id: String(r.id),
    email: String(r.email),
    emailNexludica: str("email_nexludica"),
    iban: str("iban"),
    name: String(r.name),
    role: (r.role as Role) ?? "member",
    active: Boolean(r.active),
    createdAt: num("created_at"),
    lastLoginAt: r.last_login_at != null ? num("last_login_at") : null,
    displayName: str("display_name"),
    roleLabel: str("role_label"),
    bio: str("bio"),
    skills: str("skills"),
    photoUrl: str("photo_url"),
    publicVisible: Boolean(r.public_visible ?? 1),
    emailPublic: Boolean(r.email_public ?? 0),
    fiscalCode: str("fiscal_code"),
    birthDate: str("birth_date"),
    birthPlace: str("birth_place"),
    phone: str("phone"),
    address: str("address"),
    city: str("city"),
    postalCode: str("postal_code"),
    province: str("province"),
    country: str("country") ?? "IT",
    membershipDate: str("membership_date"),
    membershipStatus: (r.membership_status as MembershipStatus) ?? "active",
    lastPaymentDate: str("last_payment_date"),
    lastPaymentAmount: r.last_payment_amount != null ? Number(r.last_payment_amount) : null,
    paymentNotes: str("payment_notes"),
    internalNotes: str("internal_notes"),
    citizenship: str("citizenship"),
    terminationDate: str("termination_date"),
    terminationReason: str("termination_reason"),
    consentPrivacyAt: r.consent_privacy_at != null ? Number(r.consent_privacy_at) : null,
    consentStatuteAt: r.consent_statute_at != null ? Number(r.consent_statute_at) : null,
    consentPhotoPublicationAt: r.consent_photo_publication_at != null ? Number(r.consent_photo_publication_at) : null,
    consentMarketingAt: r.consent_marketing_at != null ? Number(r.consent_marketing_at) : null,
    boardRole: (r.board_role as AdminMemberView["boardRole"]) ?? null,
  };
}

export interface UpdateMemberInput {
  // user
  role?: Role;
  active?: boolean;
  /** Ruolo nel Consiglio Direttivo (NULL = non in direttivo). */
  boardRole?: "presidente" | "vice_presidente" | "segretario" | "tesoriere" | "consigliere" | null;
  // profile
  roleLabel?: string;
  publicVisible?: boolean;
  emailPublic?: boolean;
  // member_data
  fiscalCode?: string;
  birthDate?: string;
  birthPlace?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
  membershipDate?: string;
  membershipStatus?: MembershipStatus;
  lastPaymentDate?: string;
  lastPaymentAmount?: number | null;
  paymentNotes?: string;
  internalNotes?: string;
  // GDPR / CTS estesi
  citizenship?: string;
  terminationDate?: string;
  terminationReason?: string;
  consentPrivacyAt?: number | null;
  consentStatuteAt?: number | null;
  consentPhotoPublicationAt?: number | null;
  consentMarketingAt?: number | null;
  // profilo pubblico
  displayName?: string;
  bio?: string;
  skills?: string;
  photoUrl?: string;
  website?: string;
  instagram?: string;
}

export async function updateMemberAsAdmin(
  db: D1Database,
  adminUserId: string,
  userId: string,
  input: UpdateMemberInput,
  env?: Env,
): Promise<void> {
  const trim = (s: string | undefined, max: number) =>
    s == null ? null : (s.trim().slice(0, max) || null);

  // Carica il record corrente per sapere il vecchio role / email (necessario
  // per sincronizzare i permessi Drive quando il role cambia).
  const before = await db
    .prepare("SELECT role, email FROM users WHERE id = ?")
    .bind(userId)
    .first<{ role: Role; email: string }>();

  // 1) Update users.role + active se forniti
  const userSets: string[] = [];
  const userVals: unknown[] = [];
  if (input.role) {
    userSets.push("role = ?");
    userVals.push(input.role);
  }
  if (input.active !== undefined) {
    userSets.push("active = ?");
    userVals.push(input.active ? 1 : 0);
  }
  if (input.boardRole !== undefined) {
    userSets.push("board_role = ?");
    userVals.push(input.boardRole);
  }
  if (userSets.length > 0) {
    userVals.push(userId);
    await db
      .prepare(`UPDATE users SET ${userSets.join(", ")} WHERE id = ?`)
      .bind(...userVals)
      .run();
  }

  // Sync permessi Drive sulla cartella radice se il ruolo e' cambiato.
  if (env && before && input.role && input.role !== before.role) {
    await syncDriveEditorPermission(env, before.email, before.role, input.role);
  }

  // 2) Update campi profilo che l'admin puo' settare:
  //    role_label, public_visible, email_public.
  const profileSets: string[] = [];
  const profileVals: unknown[] = [];
  if (input.roleLabel !== undefined) {
    profileSets.push("role_label = ?");
    profileVals.push(trim(input.roleLabel, 80));
  }
  if (input.publicVisible !== undefined) {
    profileSets.push("public_visible = ?");
    profileVals.push(input.publicVisible ? 1 : 0);
  }
  if (input.emailPublic !== undefined) {
    profileSets.push("email_public = ?");
    profileVals.push(input.emailPublic ? 1 : 0);
  }
  if (profileSets.length > 0) {
    // Se la riga profile non esiste ancora, inserimento di base
    await db
      .prepare(
        `INSERT INTO profiles (user_id, display_name, public_visible, email_public, sort_order, updated_at)
         VALUES (?, (SELECT name FROM users WHERE id = ?), 1, 0, 100, ?)
         ON CONFLICT(user_id) DO NOTHING`,
      )
      .bind(userId, userId, now())
      .run();
    profileSets.push("updated_at = ?");
    profileVals.push(now());
    profileVals.push(userId);
    await db
      .prepare(`UPDATE profiles SET ${profileSets.join(", ")} WHERE user_id = ?`)
      .bind(...profileVals)
      .run();
  }

  // 2b) Update altri campi profilo opzionali (displayName, bio, skills,
  //     photoUrl, website, instagram)
  const profileExtra: Array<{ col: string; val: unknown }> = [];
  if (input.displayName !== undefined) profileExtra.push({ col: "display_name", val: trim(input.displayName, 80) });
  if (input.bio !== undefined) profileExtra.push({ col: "bio", val: trim(input.bio, 1000) });
  if (input.skills !== undefined) profileExtra.push({ col: "skills", val: trim(input.skills, 400) });
  if (input.photoUrl !== undefined) profileExtra.push({ col: "photo_url", val: trim(input.photoUrl, 500) });
  if (input.website !== undefined) profileExtra.push({ col: "website", val: trim(input.website, 300) });
  if (input.instagram !== undefined) profileExtra.push({ col: "instagram", val: trim(input.instagram, 300) });
  if (profileExtra.length > 0) {
    await db
      .prepare(
        `INSERT INTO profiles (user_id, display_name, public_visible, email_public, sort_order, updated_at)
         VALUES (?, (SELECT name FROM users WHERE id = ?), 1, 0, 100, ?)
         ON CONFLICT(user_id) DO NOTHING`,
      )
      .bind(userId, userId, now())
      .run();
    const sets = profileExtra.map((p) => `${p.col} = ?`).join(", ");
    const vals = profileExtra.map((p) => p.val);
    vals.push(now(), userId);
    await db
      .prepare(`UPDATE profiles SET ${sets}, updated_at = ? WHERE user_id = ?`)
      .bind(...vals)
      .run();
  }

  // 3) Upsert member_data se almeno un campo e' fornito
  const mdKeys: Array<keyof UpdateMemberInput> = [
    "fiscalCode", "birthDate", "birthPlace", "phone",
    "address", "city", "postalCode", "province", "country",
    "membershipDate", "membershipStatus",
    "lastPaymentDate", "lastPaymentAmount", "paymentNotes", "internalNotes",
    "citizenship", "terminationDate", "terminationReason",
    "consentPrivacyAt", "consentStatuteAt",
    "consentPhotoPublicationAt", "consentMarketingAt",
  ];
  const hasMd = mdKeys.some((k) => input[k] !== undefined);
  if (hasMd) {
    await db
      .prepare(
        `INSERT INTO member_data
          (user_id, fiscal_code, birth_date, birth_place, phone,
           address, city, postal_code, province, country,
           membership_date, membership_status,
           last_payment_date, last_payment_amount, payment_notes,
           internal_notes,
           citizenship, termination_date, termination_reason,
           consent_privacy_at, consent_statute_at,
           consent_photo_publication_at, consent_marketing_at,
           updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           fiscal_code = COALESCE(excluded.fiscal_code, fiscal_code),
           birth_date = COALESCE(excluded.birth_date, birth_date),
           birth_place = COALESCE(excluded.birth_place, birth_place),
           phone = COALESCE(excluded.phone, phone),
           address = COALESCE(excluded.address, address),
           city = COALESCE(excluded.city, city),
           postal_code = COALESCE(excluded.postal_code, postal_code),
           province = COALESCE(excluded.province, province),
           country = COALESCE(excluded.country, country),
           membership_date = COALESCE(excluded.membership_date, membership_date),
           membership_status = COALESCE(excluded.membership_status, membership_status),
           last_payment_date = COALESCE(excluded.last_payment_date, last_payment_date),
           last_payment_amount = COALESCE(excluded.last_payment_amount, last_payment_amount),
           payment_notes = COALESCE(excluded.payment_notes, payment_notes),
           internal_notes = COALESCE(excluded.internal_notes, internal_notes),
           citizenship = COALESCE(excluded.citizenship, citizenship),
           termination_date = COALESCE(excluded.termination_date, termination_date),
           termination_reason = COALESCE(excluded.termination_reason, termination_reason),
           consent_privacy_at = COALESCE(excluded.consent_privacy_at, consent_privacy_at),
           consent_statute_at = COALESCE(excluded.consent_statute_at, consent_statute_at),
           consent_photo_publication_at = COALESCE(excluded.consent_photo_publication_at, consent_photo_publication_at),
           consent_marketing_at = COALESCE(excluded.consent_marketing_at, consent_marketing_at),
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`,
      )
      .bind(
        userId,
        trim(input.fiscalCode, 32),
        trim(input.birthDate, 10),
        trim(input.birthPlace, 100),
        trim(input.phone, 32),
        trim(input.address, 200),
        trim(input.city, 100),
        trim(input.postalCode, 16),
        trim(input.province, 4),
        trim(input.country, 4) ?? "IT",
        trim(input.membershipDate, 10),
        input.membershipStatus ?? null,
        trim(input.lastPaymentDate, 10),
        input.lastPaymentAmount ?? null,
        trim(input.paymentNotes, 500),
        trim(input.internalNotes, 1000),
        trim(input.citizenship, 60),
        trim(input.terminationDate, 10),
        trim(input.terminationReason, 300),
        input.consentPrivacyAt ?? null,
        input.consentStatuteAt ?? null,
        input.consentPhotoPublicationAt ?? null,
        input.consentMarketingAt ?? null,
        now(),
        adminUserId,
      )
      .run();
  }
}

export async function createMember(
  db: D1Database,
  email: string,
  name: string,
  role: Role,
  env?: Env,
): Promise<UserRow> {
  const id = crypto.randomUUID();
  const cleanEmail = email.toLowerCase().trim();
  await db
    .prepare(
      "INSERT INTO users (id, email, name, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
    )
    .bind(id, cleanEmail, name.trim(), role, now())
    .run();
  await db
    .prepare(
      `INSERT INTO profiles (user_id, display_name, public_visible, email_public, sort_order, updated_at)
       VALUES (?, ?, 1, 0, 100, ?)`,
    )
    .bind(id, name.trim(), now())
    .run();
  // Se il nuovo utente e' admin, dagli accesso editor alla cartella Drive.
  if (env && role === "admin") {
    await syncDriveEditorPermission(env, cleanEmail, "member", "admin");
  }
  return {
    id,
    email: cleanEmail,
    name: name.trim(),
    role,
    active: 1,
    created_at: now(),
    last_login_at: null,
  };
}

/**
 * Sincronizza il permesso editor sulla cartella Drive radice in base al
 * ruolo. Quando un utente diventa admin -> grant editor; quando smette di
 * essere admin -> revoke. Email .invalid (placeholder seed) sono skippate.
 */
async function syncDriveEditorPermission(
  env: Env,
  email: string,
  oldRole: Role,
  newRole: Role,
): Promise<void> {
  const root = env.DRIVE_ROOT_FOLDER_ID;
  if (!root) return;
  if (!email || email.endsWith(".invalid")) return;
  try {
    if (newRole === "admin" && oldRole !== "admin") {
      const r = await grantEditor(env, root, email);
      if (!r.ok) console.error("[admin] grantEditor failed for", email, r.error);
    } else if (oldRole === "admin" && newRole !== "admin") {
      await revokeAccess(env, root, email);
    }
  } catch (e) {
    console.error("[admin] syncDriveEditorPermission error:", e);
  }
}

/**
 * Sincronizzazione bulk: per tutti gli utenti admin attivi con email reale,
 * assicura che abbiano permesso editor sulla cartella Drive radice.
 * Idempotente: skippa quelli gia' editor.
 */
export async function syncAllAdminsToDrive(
  db: D1Database,
  env: Env,
): Promise<{ granted: string[]; skipped: string[]; errors: string[] }> {
  const granted: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  const root = env.DRIVE_ROOT_FOLDER_ID;
  if (!root) return { granted, skipped, errors: ["DRIVE_ROOT_FOLDER_ID not set"] };

  const rs = await db
    .prepare("SELECT email FROM users WHERE role = 'admin' AND active = 1")
    .all<{ email: string }>();
  for (const row of rs.results) {
    if (!row.email || row.email.endsWith(".invalid")) {
      skipped.push(row.email);
      continue;
    }
    const r = await grantEditor(env, root, row.email);
    if (r.alreadyExists) skipped.push(row.email);
    else if (r.ok) granted.push(row.email);
    else errors.push(`${row.email}: ${r.error ?? "unknown"}`);
  }
  return { granted, skipped, errors };
}
