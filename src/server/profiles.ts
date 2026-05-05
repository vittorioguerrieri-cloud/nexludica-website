/**
 * Helper per la gestione dei profili soci.
 */
import { now, type ProfileRow } from "./db";

export interface PublicMember {
  userId: string;
  name: string;
  roleLabel: string | null;
  bio: string | null;
  skills: string | null;
  photoUrl: string | null;
  website: string | null;
  linkedin: string | null;
  sortOrder: number;
}

export interface MyProfile extends PublicMember {
  email: string;
  publicVisible: boolean;
  updatedAt: number;
}

export async function listPublicMembers(db: D1Database): Promise<PublicMember[]> {
  const rs = await db
    .prepare(
      `SELECT u.id as user_id, u.name as user_name, u.email as email,
              p.display_name, p.role_label, p.bio, p.skills, p.photo_url,
              p.website, p.linkedin, p.sort_order
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.active = 1 AND COALESCE(p.public_visible, 1) = 1
       ORDER BY COALESCE(p.sort_order, 100) ASC, u.name ASC`,
    )
    .all();
  // SQLite restituisce le colonne in lower-case con i nostri alias.
  return (rs.results as Array<Record<string, unknown>>).map((r) => ({
    userId: String(r.user_id),
    name: String(r.display_name ?? r.user_name ?? ""),
    roleLabel: (r.role_label as string) ?? null,
    bio: (r.bio as string) ?? null,
    skills: (r.skills as string) ?? null,
    photoUrl: (r.photo_url as string) ?? null,
    website: (r.website as string) ?? null,
    linkedin: (r.linkedin as string) ?? null,
    sortOrder: (r.sort_order as number) ?? 100,
  }));
}

export async function getMyProfile(
  db: D1Database,
  userId: string,
): Promise<MyProfile | null> {
  const r = await db
    .prepare(
      `SELECT u.id as user_id, u.name as user_name, u.email as email,
              p.display_name, p.role_label, p.bio, p.skills, p.photo_url,
              p.website, p.linkedin, p.public_visible, p.sort_order, p.updated_at
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ? AND u.active = 1`,
    )
    .bind(userId)
    .first<Record<string, unknown>>();
  if (!r) return null;
  return {
    userId: String(r.user_id),
    name: String(r.display_name ?? r.user_name ?? ""),
    email: String(r.email),
    roleLabel: (r.role_label as string) ?? null,
    bio: (r.bio as string) ?? null,
    skills: (r.skills as string) ?? null,
    photoUrl: (r.photo_url as string) ?? null,
    website: (r.website as string) ?? null,
    linkedin: (r.linkedin as string) ?? null,
    publicVisible: Boolean((r.public_visible as number) ?? 1),
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
  linkedin?: string;
  publicVisible?: boolean;
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
    skills: trim(input.skills, 200),
    photoUrl: trim(input.photoUrl, 500),
    website: trim(input.website, 200),
    linkedin: trim(input.linkedin, 200),
    publicVisible: input.publicVisible ?? true,
  };

  // INSERT ... ON CONFLICT(user_id) DO UPDATE per upsert.
  await db
    .prepare(
      `INSERT INTO profiles
        (user_id, display_name, role_label, bio, skills, photo_url, website, linkedin, public_visible, sort_order, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT sort_order FROM profiles WHERE user_id = ?), 100), ?)
       ON CONFLICT(user_id) DO UPDATE SET
         display_name = excluded.display_name,
         role_label = excluded.role_label,
         bio = excluded.bio,
         skills = excluded.skills,
         photo_url = excluded.photo_url,
         website = excluded.website,
         linkedin = excluded.linkedin,
         public_visible = excluded.public_visible,
         updated_at = excluded.updated_at`,
    )
    .bind(
      userId,
      data.displayName,
      data.roleLabel,
      data.bio,
      data.skills,
      data.photoUrl,
      data.website,
      data.linkedin,
      data.publicVisible ? 1 : 0,
      userId,
      now(),
    )
    .run();
}
