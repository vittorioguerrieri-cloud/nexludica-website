/**
 * Helper per la gestione dei profili soci.
 */
import { now, type ProfileRow } from "./db";

export interface CustomField {
  label: string;
  value: string;
}

export interface PublicMember {
  userId: string;
  name: string;
  slug: string; // derivato da name, per /chi-siamo/<slug>
  roleLabel: string | null;
  bio: string | null;
  skills: string | null;
  photoUrl: string | null;
  website: string | null;
  instagram: string | null;
  email: string | null; // popolato solo se email_public = 1
  cvAcademic: string | null;
  cvOther: string | null;
  customFields: CustomField[];
  sortOrder: number;
}

/**
 * Genera uno slug URL-safe da un nome.
 *   "Vittorio Guerrieri" → "vittorio-guerrieri"
 *   "Raluca Fulgu" → "raluca-fulgu"
 *   "Letizia D'Aurelio" → "letizia-daurelio"
 */
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseCustomFields(raw: unknown): CustomField[] {
  if (!raw) return [];
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === "object" && typeof x.label === "string")
      .map((x) => ({ label: String(x.label), value: String(x.value ?? "") }));
  } catch {
    return [];
  }
}

function rowToMember(r: Record<string, unknown>): PublicMember {
  const name = String(r.display_name ?? r.user_name ?? "");
  return {
    userId: String(r.user_id),
    name,
    slug: slugifyName(name),
    roleLabel: (r.role_label as string) ?? null,
    bio: (r.bio as string) ?? null,
    skills: (r.skills as string) ?? null,
    photoUrl: (r.photo_url as string) ?? null,
    website: (r.website as string) ?? null,
    instagram: (r.instagram as string) ?? null,
    email: (r.email_public as number) ? (r.email as string) : null,
    cvAcademic: (r.cv_academic as string) ?? null,
    cvOther: (r.cv_other as string) ?? null,
    customFields: parseCustomFields(r.custom_fields),
    sortOrder: (r.sort_order as number) ?? 100,
  };
}

export interface MyProfile extends PublicMember {
  email: string;
  emailNexludica: string | null;
  publicVisible: boolean;
  emailPublic: boolean;
  updatedAt: number;
}

/**
 * Imposta (o azzera con null) l'email ufficiale @nexludica.org di un utente.
 * Ritorna { ok } oppure { ok:false, error } se il dominio non è valido.
 */
export async function setEmailNexludica(
  db: D1Database,
  userId: string,
  value: string | null,
): Promise<{ ok: boolean; error?: string }> {
  let v: string | null = (value ?? "").trim().toLowerCase() || null;
  if (v && !/^[a-z0-9._%+-]+@nexludica\.org$/.test(v)) {
    return { ok: false, error: "L'email ufficiale deve finire con @nexludica.org" };
  }
  await db
    .prepare("UPDATE users SET email_nexludica = ? WHERE id = ?")
    .bind(v, userId)
    .run();
  return { ok: true };
}

/**
 * Serializza una lista di custom fields per lo storage. Filtra entries
 * con label vuota, taglia gli stringhe ai limiti, ritorna null se vuoto.
 */
export function serializeCustomFields(input: unknown): string | null {
  if (!Array.isArray(input)) return null;
  const cleaned = input
    .filter((x) => x && typeof x === "object" && typeof x.label === "string" && x.label.trim().length > 0)
    .map((x) => ({
      label: String(x.label).trim().slice(0, 80),
      value: String(x.value ?? "").trim().slice(0, 800),
    }))
    .slice(0, 20); // max 20 custom fields
  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

const PUBLIC_MEMBER_SELECT = `
  u.id as user_id, u.name as user_name, u.email as email,
  p.display_name, p.role_label, p.bio, p.skills, p.photo_url,
  p.website, p.instagram, p.sort_order, p.email_public,
  p.cv_academic, p.cv_other, p.custom_fields
`;

export async function listPublicMembers(db: D1Database): Promise<PublicMember[]> {
  // Mostriamo SOLO soci con:
  //  - u.active = 1
  //  - profile.public_visible = 1 (default 1 se nessun profile)
  //  - member_data.membership_status = 'active' (default 'active' se nessun record)
  // Cosi' i soci 'pending' / 'suspended' / 'former' non appaiono su /chi-siamo
  // nemmeno se durante la self-iscrizione hanno scelto "voglio comparire".
  const rs = await db
    .prepare(
      `SELECT ${PUBLIC_MEMBER_SELECT}
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN member_data md ON md.user_id = u.id
       WHERE u.active = 1
         AND COALESCE(p.public_visible, 1) = 1
         AND COALESCE(md.membership_status, 'active') = 'active'
       ORDER BY COALESCE(p.sort_order, 100) ASC, u.name ASC`,
    )
    .all();
  return (rs.results as Array<Record<string, unknown>>).map(rowToMember);
}

/**
 * Trova un membro pubblico tramite slug derivato dal nome.
 * Confronta lo slug con quello generato da display_name (o users.name).
 */
export async function getPublicMemberBySlug(
  db: D1Database,
  slug: string,
): Promise<PublicMember | null> {
  // Carica tutti i membri pubblici e filtra in-memory: ok per ~10-30 soci.
  // Se la lista cresce molto si puo' aggiungere una colonna slug indicizzata.
  const all = await listPublicMembers(db);
  return all.find((m) => m.slug === slug) ?? null;
}

/**
 * Versione "admin" che cerca anche fra i soci non-pubblici.
 * Usata internamente dall'endpoint contatto (admin puo' essere contattato
 * anche se il profilo non e' pubblico).
 */
export async function getMemberByUserId(
  db: D1Database,
  userId: string,
): Promise<{ name: string; email: string } | null> {
  const r = await db
    .prepare("SELECT name, email FROM users WHERE id = ? AND active = 1")
    .bind(userId)
    .first<{ name: string; email: string }>();
  return r ?? null;
}

export async function getMyProfile(
  db: D1Database,
  userId: string,
): Promise<MyProfile | null> {
  const r = await db
    .prepare(
      `SELECT u.id as user_id, u.name as user_name, u.email as email,
              u.email_nexludica as email_nexludica,
              p.display_name, p.role_label, p.bio, p.skills, p.photo_url,
              p.website, p.instagram, p.public_visible, p.email_public,
              p.sort_order, p.updated_at,
              p.cv_academic, p.cv_other, p.custom_fields
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ? AND u.active = 1`,
    )
    .bind(userId)
    .first<Record<string, unknown>>();
  if (!r) return null;
  const name = String(r.display_name ?? r.user_name ?? "");
  return {
    userId: String(r.user_id),
    name,
    slug: slugifyName(name),
    email: String(r.email),
    emailNexludica: (r.email_nexludica as string) ?? null,
    roleLabel: (r.role_label as string) ?? null,
    bio: (r.bio as string) ?? null,
    skills: (r.skills as string) ?? null,
    photoUrl: (r.photo_url as string) ?? null,
    website: (r.website as string) ?? null,
    instagram: (r.instagram as string) ?? null,
    publicVisible: Boolean((r.public_visible as number) ?? 1),
    emailPublic: Boolean((r.email_public as number) ?? 0),
    cvAcademic: (r.cv_academic as string) ?? null,
    cvOther: (r.cv_other as string) ?? null,
    customFields: parseCustomFields(r.custom_fields),
    sortOrder: (r.sort_order as number) ?? 100,
    updatedAt: (r.updated_at as number) ?? 0,
  };
}

export interface UpdateProfileInput {
  displayName?: string;
  roleLabel?: string;
  bio?: string;
  skills?: string;
  photoUrl?: string;
  website?: string;
  instagram?: string;
  publicVisible?: boolean;
  emailPublic?: boolean;
  cvAcademic?: string;
  cvOther?: string;
  customFields?: unknown; // array di {label,value}
}

export async function upsertProfile(
  db: D1Database,
  userId: string,
  input: UpdateProfileInput,
): Promise<void> {
  // Sanitize input lato server (limiti di lunghezza).
  const trim = (s: string | undefined, max: number) =>
    s == null ? null : s.trim().slice(0, max) || null;
  const data = {
    displayName: trim(input.displayName, 80),
    roleLabel: trim(input.roleLabel, 80),
    bio: trim(input.bio, 1000),
    skills: trim(input.skills, 400),
    photoUrl: trim(input.photoUrl, 500),
    website: trim(input.website, 300),
    instagram: trim(input.instagram, 300),
    publicVisible: input.publicVisible ?? true,
    emailPublic: input.emailPublic ?? false,
    cvAcademic: trim(input.cvAcademic, 8000),
    cvOther: trim(input.cvOther, 8000),
    customFields: input.customFields !== undefined ? serializeCustomFields(input.customFields) : undefined,
  };

  // INSERT ... ON CONFLICT(user_id) DO UPDATE per upsert.
  // photo_url usa COALESCE: salvataggio profilo non azzera la foto
  // se il chiamante non la include esplicitamente.
  // custom_fields: se l'input e' undefined (cioe' il chiamante non l'ha
  // inviato), preserviamo il valore esistente; se e' un array vuoto/
  // null normalizzato, sovrascriviamo con NULL.
  // Patch semantics: i campi NON inviati (input.X === undefined) NON devono
  // azzerare il valore esistente. Solo i campi esplicitamente inviati vengono
  // sovrascritti. Usiamo COALESCE con i flag "should overwrite" passati come
  // parametri binari.
  const ovr = {
    displayName: input.displayName !== undefined ? 1 : 0,
    roleLabel: input.roleLabel !== undefined ? 1 : 0,
    bio: input.bio !== undefined ? 1 : 0,
    skills: input.skills !== undefined ? 1 : 0,
    photoUrl: input.photoUrl !== undefined ? 1 : 0,
    website: input.website !== undefined ? 1 : 0,
    instagram: input.instagram !== undefined ? 1 : 0,
    publicVisible: input.publicVisible !== undefined ? 1 : 0,
    emailPublic: input.emailPublic !== undefined ? 1 : 0,
    cvAcademic: input.cvAcademic !== undefined ? 1 : 0,
    cvOther: input.cvOther !== undefined ? 1 : 0,
    customFields: input.customFields !== undefined ? 1 : 0,
  };

  await db
    .prepare(
      `INSERT INTO profiles
        (user_id, display_name, role_label, bio, skills, photo_url, website, instagram, public_visible, email_public, sort_order, updated_at, cv_academic, cv_other, custom_fields)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT sort_order FROM profiles WHERE user_id = ?), 100), ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         display_name   = CASE WHEN ? = 1 THEN excluded.display_name   ELSE display_name   END,
         role_label     = CASE WHEN ? = 1 THEN excluded.role_label     ELSE role_label     END,
         bio            = CASE WHEN ? = 1 THEN excluded.bio            ELSE bio            END,
         skills         = CASE WHEN ? = 1 THEN excluded.skills         ELSE skills         END,
         photo_url      = CASE WHEN ? = 1 THEN excluded.photo_url      ELSE photo_url      END,
         website        = CASE WHEN ? = 1 THEN excluded.website        ELSE website        END,
         instagram      = CASE WHEN ? = 1 THEN excluded.instagram      ELSE instagram      END,
         public_visible = CASE WHEN ? = 1 THEN excluded.public_visible ELSE public_visible END,
         email_public   = CASE WHEN ? = 1 THEN excluded.email_public   ELSE email_public   END,
         cv_academic    = CASE WHEN ? = 1 THEN excluded.cv_academic    ELSE cv_academic    END,
         cv_other       = CASE WHEN ? = 1 THEN excluded.cv_other       ELSE cv_other       END,
         custom_fields  = CASE WHEN ? = 1 THEN excluded.custom_fields  ELSE custom_fields  END,
         updated_at     = excluded.updated_at`,
    )
    .bind(
      // VALUES
      userId,
      data.displayName,
      data.roleLabel,
      data.bio,
      data.skills,
      data.photoUrl,
      data.website,
      data.instagram,
      data.publicVisible ? 1 : 0,
      data.emailPublic ? 1 : 0,
      userId,
      now(),
      data.cvAcademic,
      data.cvOther,
      data.customFields ?? null,
      // CASE flags (12)
      ovr.displayName, ovr.roleLabel, ovr.bio, ovr.skills,
      ovr.photoUrl, ovr.website, ovr.instagram,
      ovr.publicVisible, ovr.emailPublic,
      ovr.cvAcademic, ovr.cvOther, ovr.customFields,
    )
    .run();
}
