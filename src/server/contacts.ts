/**
 * CRM-lite per NexLudica: contatti + log delle interazioni.
 *
 * Accesso (gestito lato API):
 *   - lista/get/aggiungi/edita: tutti i soci loggati
 *   - elimina: solo admin
 */
import { now, uuid } from "./db";

export type ContactStatus = "lead" | "active" | "cold" | "closed" | "archived";
export type InteractionKind = "email" | "call" | "meeting" | "event" | "social" | "message" | "other";

export interface Contact {
  id: string;
  fullName: string;
  organization: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  website: string | null;
  linkedin: string | null;
  notes: string | null;
  tags: string[];
  status: ContactStatus;
  source: string | null;
  lastInteractionAt: number | null;
  followUpAt: number | null;
  ownedBy: string | null;
  createdAt: number;
  updatedAt: number;
  createdBy: string | null;
}

export interface ContactInteraction {
  id: string;
  contactId: string;
  kind: InteractionKind;
  subject: string | null;
  notes: string | null;
  happenedAt: number;
  recordedBy: string | null;
  createdAt: number;
}

function rowToContact(r: Record<string, unknown>): Contact {
  const tagsRaw = (r.tags as string) ?? "";
  const tags = tagsRaw ? tagsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return {
    id: String(r.id),
    fullName: String(r.full_name),
    organization: (r.organization as string) ?? null,
    role: (r.role as string) ?? null,
    email: (r.email as string) ?? null,
    phone: (r.phone as string) ?? null,
    city: (r.city as string) ?? null,
    website: (r.website as string) ?? null,
    linkedin: (r.linkedin as string) ?? null,
    notes: (r.notes as string) ?? null,
    tags,
    status: r.status as ContactStatus,
    source: (r.source as string) ?? null,
    lastInteractionAt: r.last_interaction_at != null ? Number(r.last_interaction_at) : null,
    followUpAt: r.follow_up_at != null ? Number(r.follow_up_at) : null,
    ownedBy: (r.owned_by as string) ?? null,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    createdBy: (r.created_by as string) ?? null,
  };
}

function rowToInteraction(r: Record<string, unknown>): ContactInteraction {
  return {
    id: String(r.id),
    contactId: String(r.contact_id),
    kind: r.kind as InteractionKind,
    subject: (r.subject as string) ?? null,
    notes: (r.notes as string) ?? null,
    happenedAt: Number(r.happened_at),
    recordedBy: (r.recorded_by as string) ?? null,
    createdAt: Number(r.created_at),
  };
}

// ===== CONTACTS CRUD =====

export async function listContacts(db: D1Database): Promise<Contact[]> {
  const { results } = await db
    .prepare("SELECT * FROM contacts ORDER BY status = 'archived' ASC, last_interaction_at DESC, updated_at DESC")
    .all();
  return (results ?? []).map((r) => rowToContact(r as Record<string, unknown>));
}

export async function getContact(db: D1Database, id: string): Promise<Contact | null> {
  const r = await db.prepare("SELECT * FROM contacts WHERE id = ?").bind(id).first();
  return r ? rowToContact(r as Record<string, unknown>) : null;
}

export async function createContact(
  db: D1Database,
  data: {
    fullName: string;
    organization?: string | null;
    role?: string | null;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    website?: string | null;
    linkedin?: string | null;
    notes?: string | null;
    tags?: string[];
    status?: ContactStatus;
    source?: string | null;
    followUpAt?: number | null;
    ownedBy?: string | null;
    createdBy?: string | null;
  },
): Promise<Contact> {
  const id = uuid();
  const ts = now();
  await db
    .prepare(
      `INSERT INTO contacts (id, full_name, organization, role, email, phone, city, website, linkedin,
         notes, tags, status, source, follow_up_at, owned_by,
         created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      data.fullName,
      data.organization ?? null,
      data.role ?? null,
      data.email ?? null,
      data.phone ?? null,
      data.city ?? null,
      data.website ?? null,
      data.linkedin ?? null,
      data.notes ?? null,
      (data.tags ?? []).join(","),
      data.status ?? "active",
      data.source ?? null,
      data.followUpAt ?? null,
      data.ownedBy ?? null,
      ts,
      ts,
      data.createdBy ?? null,
    )
    .run();
  const c = await getContact(db, id);
  if (!c) throw new Error("createContact failed");
  return c;
}

export async function updateContact(
  db: D1Database,
  id: string,
  patch: Partial<{
    fullName: string;
    organization: string | null;
    role: string | null;
    email: string | null;
    phone: string | null;
    city: string | null;
    website: string | null;
    linkedin: string | null;
    notes: string | null;
    tags: string[];
    status: ContactStatus;
    source: string | null;
    followUpAt: number | null;
    ownedBy: string | null;
  }>,
): Promise<void> {
  const map: Record<string, string> = {
    fullName: "full_name", organization: "organization", role: "role",
    email: "email", phone: "phone", city: "city", website: "website", linkedin: "linkedin",
    notes: "notes", status: "status", source: "source",
    followUpAt: "follow_up_at", ownedBy: "owned_by",
  };
  const sets: string[] = [];
  const args: unknown[] = [];
  for (const [k, col] of Object.entries(map)) {
    if ((patch as any)[k] !== undefined) {
      sets.push(`${col} = ?`);
      args.push((patch as any)[k]);
    }
  }
  if (patch.tags !== undefined) {
    sets.push("tags = ?");
    args.push(patch.tags.map((t) => t.trim()).filter(Boolean).join(","));
  }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  args.push(now());
  args.push(id);
  await db.prepare(`UPDATE contacts SET ${sets.join(", ")} WHERE id = ?`).bind(...args).run();
}

export async function deleteContact(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM contacts WHERE id = ?").bind(id).run();
}

// ===== INTERACTIONS =====

export async function listInteractions(db: D1Database, contactId: string): Promise<ContactInteraction[]> {
  const { results } = await db
    .prepare("SELECT * FROM contact_interactions WHERE contact_id = ? ORDER BY happened_at DESC")
    .bind(contactId)
    .all();
  return (results ?? []).map((r) => rowToInteraction(r as Record<string, unknown>));
}

export async function addInteraction(
  db: D1Database,
  data: {
    contactId: string;
    kind: InteractionKind;
    subject?: string | null;
    notes?: string | null;
    happenedAt: number;
    recordedBy?: string | null;
  },
): Promise<ContactInteraction> {
  const id = uuid();
  const ts = now();
  await db
    .prepare(
      `INSERT INTO contact_interactions (id, contact_id, kind, subject, notes, happened_at, recorded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, data.contactId, data.kind, data.subject ?? null, data.notes ?? null, data.happenedAt, data.recordedBy ?? null, ts)
    .run();
  // Aggiorna last_interaction_at del contatto se questa è più recente
  await db
    .prepare(
      `UPDATE contacts SET last_interaction_at = ?, updated_at = ?
       WHERE id = ? AND (last_interaction_at IS NULL OR last_interaction_at < ?)`,
    )
    .bind(data.happenedAt, ts, data.contactId, data.happenedAt)
    .run();
  const r = await db.prepare("SELECT * FROM contact_interactions WHERE id = ?").bind(id).first();
  if (!r) throw new Error("addInteraction failed");
  return rowToInteraction(r as Record<string, unknown>);
}

export async function deleteInteraction(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM contact_interactions WHERE id = ?").bind(id).run();
}

// ===== HELPERS =====

/** Estrae tag distinti su tutti i contatti (per chip filter + suggerimenti). */
export async function listAllTags(db: D1Database): Promise<string[]> {
  const { results } = await db.prepare("SELECT tags FROM contacts WHERE tags IS NOT NULL AND tags != ''").all();
  const set = new Set<string>();
  for (const r of results ?? []) {
    const tags = String((r as any).tags ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    for (const t of tags) set.add(t);
  }
  return Array.from(set).sort();
}

export function statusLabel(s: ContactStatus): string {
  switch (s) {
    case "lead": return "Lead";
    case "active": return "Attivo";
    case "cold": return "Freddo";
    case "closed": return "Chiuso";
    case "archived": return "Archiviato";
  }
}

export function kindLabel(k: InteractionKind): string {
  switch (k) {
    case "email": return "Email";
    case "call": return "Telefonata";
    case "meeting": return "Incontro";
    case "event": return "Evento";
    case "social": return "Social";
    case "message": return "Messaggio";
    case "other": return "Altro";
  }
}
