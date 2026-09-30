/**
 * Gestione inviti di iscrizione per nuovi soci.
 *
 * Vedi migrations/0014_membership_invitations.sql per il rationale.
 */
import { now } from "./db";

const DEFAULT_TTL_DAYS = 14;
const TOKEN_BYTES = 32;

export interface InvitationRow {
  token: string;
  created_by: string;
  intended_name: string | null;
  intended_email: string | null;
  note: string | null;
  created_at: number;
  expires_at: number;
  used_at: number | null;
  used_by_user_id: string | null;
  revoked_at: number | null;
}

export interface InvitationView {
  token: string;
  createdBy: string;
  intendedName: string | null;
  intendedEmail: string | null;
  note: string | null;
  createdAt: number;
  expiresAt: number;
  usedAt: number | null;
  usedByUserId: string | null;
  revokedAt: number | null;
  status: "active" | "used" | "expired" | "revoked";
}

function toView(r: InvitationRow): InvitationView {
  let status: InvitationView["status"] = "active";
  if (r.revoked_at) status = "revoked";
  else if (r.used_at) status = "used";
  else if (r.expires_at < now()) status = "expired";
  return {
    token: r.token,
    createdBy: r.created_by,
    intendedName: r.intended_name,
    intendedEmail: r.intended_email,
    note: r.note,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    usedAt: r.used_at,
    usedByUserId: r.used_by_user_id,
    revokedAt: r.revoked_at,
    status,
  };
}

/**
 * Genera un token sicuro: 32 byte random → 64 caratteri hex.
 * Su Workers usiamo crypto.getRandomValues.
 */
function generateToken(): string {
  const buf = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createInvitation(
  db: D1Database,
  adminUserId: string,
  opts: {
    intendedName?: string;
    intendedEmail?: string;
    note?: string;
    ttlDays?: number;
  } = {},
): Promise<InvitationView> {
  const token = generateToken();
  const createdAt = now();
  const ttlMs = (opts.ttlDays ?? DEFAULT_TTL_DAYS) * 24 * 60 * 60 * 1000;
  const expiresAt = createdAt + ttlMs;
  const trim = (s: string | undefined, max: number) =>
    s == null ? null : (s.trim().slice(0, max) || null);
  await db
    .prepare(
      `INSERT INTO membership_invitations
        (token, created_by, intended_name, intended_email, note, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      token,
      adminUserId,
      trim(opts.intendedName, 100),
      trim(opts.intendedEmail, 200)?.toLowerCase() ?? null,
      trim(opts.note, 500),
      createdAt,
      expiresAt,
    )
    .run();
  const row = await getInvitationRow(db, token);
  return toView(row!);
}

async function getInvitationRow(
  db: D1Database,
  token: string,
): Promise<InvitationRow | null> {
  const r = await db
    .prepare("SELECT * FROM membership_invitations WHERE token = ?")
    .bind(token)
    .first<InvitationRow>();
  return r ?? null;
}

export async function getInvitation(
  db: D1Database,
  token: string,
): Promise<InvitationView | null> {
  const r = await getInvitationRow(db, token);
  return r ? toView(r) : null;
}

/**
 * Verifica che il token sia utilizzabile (esiste, non scaduto, non usato,
 * non revocato). Ritorna l'invito o null + un messaggio d'errore.
 */
export async function validateInvitation(
  db: D1Database,
  token: string,
): Promise<{ ok: true; invitation: InvitationView } | { ok: false; error: string }> {
  const inv = await getInvitation(db, token);
  if (!inv) return { ok: false, error: "Link di iscrizione non valido" };
  if (inv.status === "used") return { ok: false, error: "Questo link e' gia' stato usato" };
  if (inv.status === "revoked") return { ok: false, error: "Questo link e' stato revocato" };
  if (inv.status === "expired") return { ok: false, error: "Questo link e' scaduto. Chiedi all'associazione di generarne uno nuovo." };
  return { ok: true, invitation: inv };
}

export async function consumeInvitation(
  db: D1Database,
  token: string,
  userId: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE membership_invitations
         SET used_at = ?, used_by_user_id = ?
       WHERE token = ? AND used_at IS NULL AND revoked_at IS NULL`,
    )
    .bind(now(), userId, token)
    .run();
}

export async function revokeInvitation(
  db: D1Database,
  token: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE membership_invitations
         SET revoked_at = ?
       WHERE token = ? AND used_at IS NULL AND revoked_at IS NULL`,
    )
    .bind(now(), token)
    .run();
}

export async function listInvitations(
  db: D1Database,
  opts: { onlyActive?: boolean } = {},
): Promise<InvitationView[]> {
  // Usiamo prepared statement con .bind() per evitare di interpolare valori
  // nello SQL (anti-pattern anche se now() ritorna un intero JS).
  if (opts.onlyActive) {
    const rs = await db
      .prepare(
        "SELECT * FROM membership_invitations WHERE used_at IS NULL AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 200",
      )
      .bind(now())
      .all<InvitationRow>();
    return (rs.results ?? []).map(toView);
  }
  const rs = await db
    .prepare("SELECT * FROM membership_invitations ORDER BY created_at DESC LIMIT 200")
    .all<InvitationRow>();
  return (rs.results ?? []).map(toView);
}
