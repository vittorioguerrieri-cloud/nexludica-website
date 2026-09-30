/**
 * Helper per gestione MeetLudica:
 *  - Mailing list (subscribers)
 *  - Proposte di talk
 *  - Broadcast email (storico + send)
 *
 * Schemas: vedi migrations/0019 e 0020.
 */
import { now } from "./db";

// ===========================================================================
// SUBSCRIBERS
// ===========================================================================

export interface SubscriberRow {
  id: string;
  name: string;
  email: string;
  motivation: string | null;
  ip_hash: string | null;
  created_at: number;
}

export interface SubscriberView {
  id: string;
  name: string;
  email: string;
  motivation: string | null;
  createdAt: number;
}

function rowToSub(r: SubscriberRow): SubscriberView {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    motivation: r.motivation,
    createdAt: r.created_at,
  };
}

export async function listSubscribers(db: D1Database): Promise<SubscriberView[]> {
  const rs = await db
    .prepare(
      "SELECT * FROM meetludica_subscribers ORDER BY created_at DESC LIMIT 500",
    )
    .all<SubscriberRow>();
  return (rs.results ?? []).map(rowToSub);
}

/** Bulk insert: ritorna { added, skipped (duplicati), invalid } */
export async function addSubscribersBulk(
  db: D1Database,
  entries: Array<{ name?: string; email: string; motivation?: string }>,
): Promise<{ added: number; skipped: number; invalid: number }> {
  let added = 0;
  let skipped = 0;
  let invalid = 0;
  const ts = now();
  for (const entry of entries) {
    const email = (entry.email ?? "").trim().toLowerCase();
    if (!email || !/.+@.+\..+/.test(email)) {
      invalid++;
      continue;
    }
    // Default name = parte locale dell'email se non fornito
    const name = (entry.name ?? "").trim() || email.split("@")[0];
    const motivation = (entry.motivation ?? "").trim() || null;
    try {
      await db
        .prepare(
          `INSERT INTO meetludica_subscribers (id, name, email, motivation, ip_hash, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), name.slice(0, 100), email.slice(0, 200), motivation?.slice(0, 1000) ?? null, null, ts)
        .run();
      added++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/UNIQUE/i.test(msg)) skipped++;
      else throw e;
    }
  }
  return { added, skipped, invalid };
}

export async function deleteSubscriber(db: D1Database, id: string): Promise<boolean> {
  const res = await db
    .prepare("DELETE FROM meetludica_subscribers WHERE id = ?")
    .bind(id)
    .run();
  return !!res.meta && res.meta.changes > 0;
}

// ===========================================================================
// PROPOSALS
// ===========================================================================

export type ProposalStatus = "pending" | "accepted" | "rejected" | "archived";
export type AvailabilityStatus = "none" | "asked" | "confirmed" | "declined";
export const AVAILABILITY_STATUSES: AvailabilityStatus[] = ["none", "asked", "confirmed", "declined"];

export interface ProposalRow {
  id: string;
  name: string;
  email: string;
  talk_title: string | null;
  abstract: string;
  ip_hash: string | null;
  status: ProposalStatus;
  created_at: number;
  event_id: string | null;
  availability_status: AvailabilityStatus;
  availability_contacted_at: number | null;
  availability_notes: string | null;
  done_at: number | null;
  article_id: string | null;
}

export interface ProposalView {
  id: string;
  name: string;
  email: string;
  talkTitle: string | null;
  abstract: string;
  status: ProposalStatus;
  createdAt: number;
  eventId: string | null;
  availabilityStatus: AvailabilityStatus;
  availabilityContactedAt: number | null;
  availabilityNotes: string | null;
  doneAt: number | null;
  articleId: string | null;
}

function rowToProposal(r: ProposalRow): ProposalView {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    talkTitle: r.talk_title,
    abstract: r.abstract,
    status: r.status,
    createdAt: r.created_at,
    eventId: r.event_id,
    availabilityStatus: r.availability_status ?? "none",
    availabilityContactedAt: r.availability_contacted_at,
    availabilityNotes: r.availability_notes,
    doneAt: r.done_at ?? null,
    articleId: r.article_id ?? null,
  };
}

/** Collega (o scollega, articleId=null) una proposta a un articolo. */
export async function updateProposalArticle(
  db: D1Database,
  id: string,
  articleId: string | null,
): Promise<boolean> {
  const res = await db
    .prepare("UPDATE meetludica_proposals SET article_id = ? WHERE id = ?")
    .bind(articleId, id)
    .run();
  return !!res.meta && res.meta.changes > 0;
}

/** Segna una proposta come "fatta": done_at + status archived + articolo collegato. */
export async function markProposalDone(
  db: D1Database,
  id: string,
  articleId: string,
): Promise<boolean> {
  const res = await db
    .prepare(
      "UPDATE meetludica_proposals SET done_at = ?, status = 'archived', article_id = ? WHERE id = ?",
    )
    .bind(now(), articleId, id)
    .run();
  return !!res.meta && res.meta.changes > 0;
}

export async function listProposals(db: D1Database): Promise<ProposalView[]> {
  const rs = await db
    .prepare(
      "SELECT * FROM meetludica_proposals ORDER BY status = 'pending' DESC, created_at DESC LIMIT 500",
    )
    .all<ProposalRow>();
  return (rs.results ?? []).map(rowToProposal);
}

export async function getProposal(db: D1Database, id: string): Promise<ProposalView | null> {
  const r = await db
    .prepare("SELECT * FROM meetludica_proposals WHERE id = ?")
    .bind(id)
    .first<ProposalRow>();
  return r ? rowToProposal(r) : null;
}

export async function addProposal(
  db: D1Database,
  input: { name: string; email: string; talkTitle?: string | null; abstract: string; ipHash?: string },
): Promise<ProposalView> {
  const id = crypto.randomUUID();
  const trim = (s: string | null | undefined, max: number) =>
    s == null ? null : (s.trim().slice(0, max) || null);
  const name = trim(input.name, 100);
  const email = trim(input.email, 200)?.toLowerCase();
  const talkTitle = trim(input.talkTitle ?? null, 300);
  const abstract = trim(input.abstract, 4000);
  if (!name || !email || !abstract) throw new Error("Campi obbligatori mancanti");
  const ts = now();
  await db
    .prepare(
      `INSERT INTO meetludica_proposals (id, name, email, talk_title, abstract, ip_hash, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .bind(id, name, email, talkTitle, abstract, input.ipHash ?? null, ts)
    .run();
  return {
    id, name, email, talkTitle, abstract,
    status: "pending", createdAt: ts,
    eventId: null, availabilityStatus: "none",
    availabilityContactedAt: null, availabilityNotes: null,
  };
}

export async function updateProposalStatus(
  db: D1Database,
  id: string,
  status: ProposalStatus,
): Promise<boolean> {
  const res = await db
    .prepare("UPDATE meetludica_proposals SET status = ? WHERE id = ?")
    .bind(status, id)
    .run();
  return !!res.meta && res.meta.changes > 0;
}

/** Assegna o rimuove (eventId=null) una proposta a una serata. */
export async function updateProposalEvent(
  db: D1Database,
  id: string,
  eventId: string | null,
): Promise<boolean> {
  const res = await db
    .prepare("UPDATE meetludica_proposals SET event_id = ? WHERE id = ?")
    .bind(eventId, id)
    .run();
  return !!res.meta && res.meta.changes > 0;
}

/** Aggiorna lo stato di disponibilita' (manualmente: per es. confermata/rifiutata). */
export async function updateProposalAvailability(
  db: D1Database,
  id: string,
  fields: { status?: AvailabilityStatus; notes?: string | null },
): Promise<boolean> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (fields.status !== undefined) {
    sets.push("availability_status = ?");
    vals.push(fields.status);
  }
  if (fields.notes !== undefined) {
    sets.push("availability_notes = ?");
    vals.push(fields.notes?.slice(0, 1000) ?? null);
  }
  if (sets.length === 0) return false;
  vals.push(id);
  const res = await db
    .prepare(`UPDATE meetludica_proposals SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...vals)
    .run();
  return !!res.meta && res.meta.changes > 0;
}

// ===========================================================================
// EVENTS (serate MeetLudica)
// ===========================================================================

export interface EventRow {
  id: string;
  title: string;
  event_date: number;
  location: string | null;
  notes: string | null;
  description: string | null;
  meeting_url: string | null;
  created_at: number;
  created_by: string | null;
}

export interface EventView {
  id: string;
  title: string;
  eventDate: number;
  location: string | null;
  notes: string | null;
  description: string | null;
  /** Link della videochiamata (Meet), mostrato sul sito. */
  meetingUrl: string | null;
  createdAt: number;
}

function rowToEvent(r: EventRow): EventView {
  return {
    id: r.id,
    title: r.title,
    eventDate: r.event_date,
    location: r.location,
    notes: r.notes,
    description: r.description ?? null,
    meetingUrl: r.meeting_url ?? null,
    createdAt: r.created_at,
  };
}

export async function listEvents(db: D1Database): Promise<EventView[]> {
  const rs = await db
    .prepare("SELECT * FROM meetludica_events ORDER BY event_date DESC LIMIT 200")
    .all<EventRow>();
  return (rs.results ?? []).map(rowToEvent);
}

/** Serate future (event_date >= now), in ordine cronologico — per il calendario pubblico. */
/** Mezzanotte di oggi, ora di Roma, in millisecondi. */
function inizioGiornoRoma(t = Date.now()): number {
  const parti = (d: Date, conOra: boolean) => {
    const f = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit",
      ...(conOra ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
    }).formatToParts(d);
    const g = (k: string) => Number(f.find((x) => x.type === k)?.value ?? 0);
    return { y: g("year"), m: g("month"), d: g("day"), h: g("hour"), mi: g("minute") };
  };
  const oggi = parti(new Date(t), false);
  const obiettivo = Date.UTC(oggi.y, oggi.m - 1, oggi.d);
  let ts = obiettivo;
  for (let i = 0; i < 3; i++) {
    const v = parti(new Date(ts), true);
    const scarto = Date.UTC(v.y, v.m - 1, v.d, v.h, v.mi) - obiettivo;
    if (scarto === 0) break;
    ts -= scarto;
  }
  return ts;
}

/**
 * Serate da oggi in poi. Una serata resta in calendario per tutto il suo giorno
 * e sparisce da quello dopo: chi arriva in ritardo trova ancora il link.
 */
export async function listUpcomingEvents(db: D1Database, limit = 6): Promise<EventView[]> {
  const rs = await db
    .prepare("SELECT * FROM meetludica_events WHERE event_date >= ? ORDER BY event_date ASC LIMIT ?")
    .bind(inizioGiornoRoma(), limit)
    .all<EventRow>();
  return (rs.results ?? []).map(rowToEvent);
}

export async function getEvent(db: D1Database, id: string): Promise<EventView | null> {
  const r = await db
    .prepare("SELECT * FROM meetludica_events WHERE id = ?")
    .bind(id)
    .first<EventRow>();
  return r ? rowToEvent(r) : null;
}

/** Solo link https: il campo finisce in un href pubblico. */
function normalizzaLinkCall(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : "https://" + t);
    return u.protocol === "https:" ? u.toString().slice(0, 300) : null;
  } catch {
    return null;
  }
}

export async function addEvent(
  db: D1Database,
  input: { title: string; eventDate: number; location?: string | null; notes?: string | null; description?: string | null; meetingUrl?: string | null },
  createdBy: string,
): Promise<EventView> {
  const id = crypto.randomUUID();
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new Error("Titolo obbligatorio");
  if (!Number.isFinite(input.eventDate)) throw new Error("Data obbligatoria");
  const location = input.location?.trim().slice(0, 300) || null;
  const notes = input.notes?.trim().slice(0, 2000) || null;
  const description = input.description?.trim().slice(0, 5000) || null;
  // Se il link non arriva, la serata eredita quello dell'ultima in calendario.
  let meetingUrl = normalizzaLinkCall(input.meetingUrl);
  if (input.meetingUrl === undefined) {
    const ultimo = await db
      .prepare("SELECT meeting_url FROM meetludica_events WHERE meeting_url IS NOT NULL ORDER BY event_date DESC LIMIT 1")
      .first<{ meeting_url: string }>();
    meetingUrl = ultimo?.meeting_url ?? null;
  }
  const ts = now();
  await db
    .prepare(
      `INSERT INTO meetludica_events (id, title, event_date, location, notes, description, meeting_url, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, title, input.eventDate, location, notes, description, meetingUrl, ts, createdBy)
    .run();
  return { id, title, eventDate: input.eventDate, location, notes, description, meetingUrl, createdAt: ts };
}

export async function updateEvent(
  db: D1Database,
  id: string,
  fields: { title?: string; eventDate?: number; location?: string | null; notes?: string | null; description?: string | null; meetingUrl?: string | null },
): Promise<boolean> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (fields.title !== undefined) {
    const t = fields.title.trim().slice(0, 200);
    if (!t) throw new Error("Titolo obbligatorio");
    sets.push("title = ?"); vals.push(t);
  }
  if (fields.eventDate !== undefined) {
    if (!Number.isFinite(fields.eventDate)) throw new Error("Data non valida");
    sets.push("event_date = ?"); vals.push(fields.eventDate);
  }
  if (fields.location !== undefined) {
    sets.push("location = ?"); vals.push(fields.location?.trim().slice(0, 300) || null);
  }
  if (fields.notes !== undefined) {
    sets.push("notes = ?"); vals.push(fields.notes?.trim().slice(0, 2000) || null);
  }
  if (fields.description !== undefined) {
    sets.push("description = ?"); vals.push(fields.description?.trim().slice(0, 5000) || null);
  }
  if (fields.meetingUrl !== undefined) {
    sets.push("meeting_url = ?"); vals.push(normalizzaLinkCall(fields.meetingUrl));
  }
  if (sets.length === 0) return false;
  vals.push(id);
  const res = await db
    .prepare(`UPDATE meetludica_events SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...vals)
    .run();
  return !!res.meta && res.meta.changes > 0;
}

export async function deleteEvent(db: D1Database, id: string): Promise<boolean> {
  const res = await db
    .prepare("DELETE FROM meetludica_events WHERE id = ?")
    .bind(id)
    .run();
  return !!res.meta && res.meta.changes > 0;
}

// ===========================================================================
// SPEAKER PHOTOS (foto relatori caricate via admin UI, salvate su Drive)
// ===========================================================================

export interface SpeakerPhotoRow {
  id: string;
  drive_file_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: number;
  uploaded_by: string | null;
}

export interface SpeakerPhotoView {
  id: string;
  driveFileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: number;
}

function rowToSpeakerPhoto(r: SpeakerPhotoRow): SpeakerPhotoView {
  return {
    id: r.id,
    driveFileId: r.drive_file_id,
    filename: r.filename,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    uploadedAt: r.uploaded_at,
  };
}

export async function addSpeakerPhoto(
  db: D1Database,
  input: {
    driveFileId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    uploadedBy: string;
  },
): Promise<SpeakerPhotoView> {
  const id = crypto.randomUUID();
  const ts = now();
  await db
    .prepare(
      `INSERT INTO meetludica_speaker_photos (id, drive_file_id, filename, mime_type, size_bytes, uploaded_at, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.driveFileId,
      input.filename.slice(0, 200),
      input.mimeType.slice(0, 100),
      input.sizeBytes,
      ts,
      input.uploadedBy,
    )
    .run();
  return {
    id,
    driveFileId: input.driveFileId,
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    uploadedAt: ts,
  };
}

export async function getSpeakerPhoto(
  db: D1Database,
  id: string,
): Promise<SpeakerPhotoView | null> {
  const r = await db
    .prepare("SELECT * FROM meetludica_speaker_photos WHERE id = ?")
    .bind(id)
    .first<SpeakerPhotoRow>();
  return r ? rowToSpeakerPhoto(r) : null;
}

export async function listSpeakerPhotos(
  db: D1Database,
): Promise<SpeakerPhotoView[]> {
  const rs = await db
    .prepare(
      "SELECT * FROM meetludica_speaker_photos ORDER BY uploaded_at DESC LIMIT 100",
    )
    .all<SpeakerPhotoRow>();
  return (rs.results ?? []).map(rowToSpeakerPhoto);
}

// ===========================================================================
// OUTREACH (audit log delle email mandate ai responsabili dei talk)
// ===========================================================================

export interface OutreachRow {
  id: string;
  proposal_id: string;
  event_id: string | null;
  recipient_email: string;
  subject: string;
  body: string;
  sent_at: number;
  sent_by: string | null;
}

export interface OutreachView {
  id: string;
  proposalId: string;
  eventId: string | null;
  recipientEmail: string;
  subject: string;
  body: string;
  sentAt: number;
  sentBy: string | null;
}

function rowToOutreach(r: OutreachRow): OutreachView {
  return {
    id: r.id,
    proposalId: r.proposal_id,
    eventId: r.event_id,
    recipientEmail: r.recipient_email,
    subject: r.subject,
    body: r.body,
    sentAt: r.sent_at,
    sentBy: r.sent_by,
  };
}

export async function listOutreachForProposal(
  db: D1Database,
  proposalId: string,
): Promise<OutreachView[]> {
  const rs = await db
    .prepare(
      "SELECT * FROM meetludica_outreach WHERE proposal_id = ? ORDER BY sent_at DESC LIMIT 50",
    )
    .bind(proposalId)
    .all<OutreachRow>();
  return (rs.results ?? []).map(rowToOutreach);
}

export async function listAllOutreach(db: D1Database): Promise<OutreachView[]> {
  const rs = await db
    .prepare("SELECT * FROM meetludica_outreach ORDER BY sent_at DESC LIMIT 500")
    .all<OutreachRow>();
  return (rs.results ?? []).map(rowToOutreach);
}

/**
 * Registra un outreach e aggiorna lo stato di disponibilita' della proposta a 'asked'.
 * Da chiamare DOPO che l'email e' stata effettivamente inviata via Resend.
 */
export async function recordOutreach(
  db: D1Database,
  input: {
    proposalId: string;
    eventId: string | null;
    recipientEmail: string;
    subject: string;
    body: string;
    sentBy: string;
  },
): Promise<OutreachView> {
  const id = crypto.randomUUID();
  const ts = now();
  await db.batch([
    db
      .prepare(
        `INSERT INTO meetludica_outreach (id, proposal_id, event_id, recipient_email, subject, body, sent_at, sent_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, input.proposalId, input.eventId, input.recipientEmail, input.subject, input.body, ts, input.sentBy),
    db
      .prepare(
        `UPDATE meetludica_proposals
         SET availability_status = CASE WHEN availability_status IN ('confirmed','declined') THEN availability_status ELSE 'asked' END,
             availability_contacted_at = ?
         WHERE id = ?`,
      )
      .bind(ts, input.proposalId),
  ]);
  return {
    id,
    proposalId: input.proposalId,
    eventId: input.eventId,
    recipientEmail: input.recipientEmail,
    subject: input.subject,
    body: input.body,
    sentAt: ts,
    sentBy: input.sentBy,
  };
}

// ===========================================================================
// BROADCASTS
// ===========================================================================

export interface BroadcastRow {
  id: string;
  subject: string;
  body: string;
  sent_count: number;
  sent_by: string | null;
  sent_at: number;
}

export interface BroadcastView {
  id: string;
  subject: string;
  body: string;
  sentCount: number;
  sentBy: string | null;
  sentAt: number;
  /** Riepilogo consegna aggregato dai webhook Resend (se disponibili). */
  delivery?: {
    delivered: number;
    bounced: number;
    complained: number;
    pending: number;     // sent ma nessun evento ancora
    opened: number;
    tracked: number;     // totale destinatari tracciati
  };
}

export async function listBroadcasts(db: D1Database): Promise<BroadcastView[]> {
  const rs = await db
    .prepare("SELECT * FROM meetludica_broadcasts ORDER BY sent_at DESC LIMIT 50")
    .all<BroadcastRow>();
  const broadcasts = rs.results ?? [];

  // Aggregazione consegna per broadcast (una sola query su tutti i destinatari).
  const stats = await db
    .prepare(
      `SELECT broadcast_id,
              COUNT(*) AS tracked,
              SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
              SUM(CASE WHEN status='bounced' THEN 1 ELSE 0 END) AS bounced,
              SUM(CASE WHEN status='complained' THEN 1 ELSE 0 END) AS complained,
              SUM(CASE WHEN status='sent' OR status='delivery_delayed' THEN 1 ELSE 0 END) AS pending,
              SUM(opened) AS opened
         FROM meetludica_broadcast_recipients
        GROUP BY broadcast_id`,
    )
    .all<{ broadcast_id: string; tracked: number; delivered: number; bounced: number; complained: number; pending: number; opened: number }>();
  const byId = new Map((stats.results ?? []).map((s) => [s.broadcast_id, s]));

  return broadcasts.map((r) => {
    const s = byId.get(r.id);
    return {
      id: r.id,
      subject: r.subject,
      body: r.body,
      sentCount: r.sent_count,
      sentBy: r.sent_by,
      sentAt: r.sent_at,
      delivery: s
        ? {
            delivered: Number(s.delivered) || 0,
            bounced: Number(s.bounced) || 0,
            complained: Number(s.complained) || 0,
            pending: Number(s.pending) || 0,
            opened: Number(s.opened) || 0,
            tracked: Number(s.tracked) || 0,
          }
        : undefined,
    };
  });
}

/** Indirizzi con problemi (bounce/complaint) per un broadcast. */
export async function listBroadcastProblems(
  db: D1Database,
  broadcastId: string,
): Promise<Array<{ email: string; status: string; detail: string | null }>> {
  const rs = await db
    .prepare(
      `SELECT email, status, detail FROM meetludica_broadcast_recipients
        WHERE broadcast_id = ? AND status IN ('bounced','complained')
        ORDER BY status, email`,
    )
    .bind(broadcastId)
    .all<{ email: string; status: string; detail: string | null }>();
  return rs.results ?? [];
}

/** Tutti gli indirizzi con problemi (bounce/complaint), per raggruppamento in pagina. */
export async function listAllBroadcastProblems(
  db: D1Database,
): Promise<Array<{ broadcastId: string; email: string; status: string; detail: string | null }>> {
  const rs = await db
    .prepare(
      `SELECT broadcast_id, email, status, detail FROM meetludica_broadcast_recipients
        WHERE status IN ('bounced','complained') ORDER BY status, email LIMIT 1000`,
    )
    .all<{ broadcast_id: string; email: string; status: string; detail: string | null }>();
  return (rs.results ?? []).map((r) => ({
    broadcastId: r.broadcast_id, email: r.email, status: r.status, detail: r.detail,
  }));
}

/** Inserisce il broadcast e ritorna il suo id (per collegare i destinatari). */
export async function recordBroadcast(
  db: D1Database,
  subject: string,
  body: string,
  sentCount: number,
  sentBy: string,
): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO meetludica_broadcasts (id, subject, body, sent_count, sent_by, sent_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, subject, body, sentCount, sentBy, now())
    .run();
  return id;
}

/** Salva i destinatari di un broadcast con l'id messaggio Resend (stato iniziale 'sent'). */
export async function recordBroadcastRecipients(
  db: D1Database,
  broadcastId: string,
  items: Array<{ email: string; resendId: string | null }>,
): Promise<void> {
  const ts = now();
  // Batch di statement (D1 supporta db.batch).
  const stmts = items.map((it) =>
    db
      .prepare(
        `INSERT INTO meetludica_broadcast_recipients
          (id, broadcast_id, email, resend_id, status, created_at)
         VALUES (?, ?, ?, ?, 'sent', ?)`,
      )
      .bind(crypto.randomUUID(), broadcastId, it.email, it.resendId, ts),
  );
  if (stmts.length > 0) await db.batch(stmts);
}

/** Aggiorna lo stato di un destinatario dato l'id messaggio Resend (dai webhook). */
export async function updateRecipientByResendId(
  db: D1Database,
  resendId: string,
  patch: { status?: string; bounceType?: string | null; detail?: string | null; opened?: boolean },
): Promise<boolean> {
  const sets: string[] = ["last_event_at = ?"];
  const vals: unknown[] = [now()];
  if (patch.status !== undefined) { sets.push("status = ?"); vals.push(patch.status); }
  if (patch.bounceType !== undefined) { sets.push("bounce_type = ?"); vals.push(patch.bounceType); }
  if (patch.detail !== undefined) { sets.push("detail = ?"); vals.push(patch.detail); }
  if (patch.opened) { sets.push("opened = 1"); }
  vals.push(resendId);
  const res = await db
    .prepare(`UPDATE meetludica_broadcast_recipients SET ${sets.join(", ")} WHERE resend_id = ?`)
    .bind(...vals)
    .run();
  return !!res.meta && res.meta.changes > 0;
}

// ===========================================================================
// MONITORAGGIO MAILING LIST
// ===========================================================================

export interface DeliveryHealth {
  /** Totale iscritti in lista. */
  subscribers: number;
  /** Broadcast con tracciamento attivo. */
  trackedBroadcasts: number;
  /** Righe destinatario tracciate in totale. */
  tracked: number;
  delivered: number;
  bounced: number;
  complained: number;
  failed: number;
  pending: number;
  opened: number;
  /** delivered / (tracked - pending), in percentuale; null se non calcolabile. */
  deliveryRate: number | null;
  lastEventAt: number | null;
}

export async function getDeliveryHealth(db: D1Database): Promise<DeliveryHealth> {
  const subs = await db
    .prepare("SELECT COUNT(*) AS n FROM meetludica_subscribers")
    .first<{ n: number }>();
  const r = await db
    .prepare(
      `SELECT COUNT(*) AS tracked,
              COUNT(DISTINCT broadcast_id) AS bc,
              SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
              SUM(CASE WHEN status='bounced' THEN 1 ELSE 0 END) AS bounced,
              SUM(CASE WHEN status='complained' THEN 1 ELSE 0 END) AS complained,
              SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
              SUM(CASE WHEN status IN ('sent','delivery_delayed') THEN 1 ELSE 0 END) AS pending,
              SUM(opened) AS opened,
              MAX(last_event_at) AS last_ev
         FROM meetludica_broadcast_recipients`,
    )
    .first<Record<string, number | null>>();

  const n = (k: string) => Number(r?.[k] ?? 0) || 0;
  const tracked = n("tracked");
  const pending = n("pending");
  const delivered = n("delivered");
  const risolti = tracked - pending;
  return {
    subscribers: Number(subs?.n ?? 0),
    trackedBroadcasts: n("bc"),
    tracked,
    delivered,
    bounced: n("bounced"),
    complained: n("complained"),
    failed: n("failed"),
    pending,
    opened: n("opened"),
    deliveryRate: risolti > 0 ? Math.round((delivered / risolti) * 1000) / 10 : null,
    lastEventAt: r?.last_ev != null ? Number(r.last_ev) : null,
  };
}

export interface SubscriberHealth {
  email: string;
  name: string | null;
  inLista: boolean;
  inviate: number;
  delivered: number;
  bounced: number;
  complained: number;
  pending: number;
  opened: number;
  lastStatus: string | null;
  lastDetail: string | null;
  /** ok | attesa | problema */
  salute: "ok" | "attesa" | "problema";
}

/** Stato di recapito per ciascun indirizzo della lista. */
export async function getSubscriberHealth(db: D1Database): Promise<SubscriberHealth[]> {
  const rs = await db
    .prepare(
      `SELECT LOWER(r.email) AS email,
              COUNT(*) AS inviate,
              SUM(CASE WHEN r.status='delivered' THEN 1 ELSE 0 END) AS delivered,
              SUM(CASE WHEN r.status='bounced' THEN 1 ELSE 0 END) AS bounced,
              SUM(CASE WHEN r.status='complained' THEN 1 ELSE 0 END) AS complained,
              SUM(CASE WHEN r.status IN ('sent','delivery_delayed') THEN 1 ELSE 0 END) AS pending,
              SUM(r.opened) AS opened
         FROM meetludica_broadcast_recipients r
        GROUP BY LOWER(r.email)`,
    )
    .all<Record<string, string | number>>();

  // ultimo esito per indirizzo
  const last = await db
    .prepare(
      `SELECT LOWER(email) AS email, status, detail FROM meetludica_broadcast_recipients r1
        WHERE created_at = (SELECT MAX(created_at) FROM meetludica_broadcast_recipients r2
                             WHERE LOWER(r2.email) = LOWER(r1.email))`,
    )
    .all<{ email: string; status: string; detail: string | null }>();
  const lastBy = new Map((last.results ?? []).map((x) => [x.email, x]));

  const subs = await db
    .prepare("SELECT LOWER(email) AS email, name FROM meetludica_subscribers")
    .all<{ email: string; name: string }>();
  const subBy = new Map((subs.results ?? []).map((x) => [x.email, x.name]));

  const out: SubscriberHealth[] = [];
  const seen = new Set<string>();
  for (const row of rs.results ?? []) {
    const email = String(row.email);
    seen.add(email);
    const num = (k: string) => Number(row[k] ?? 0) || 0;
    const bounced = num("bounced");
    const complained = num("complained");
    const pending = num("pending");
    const l = lastBy.get(email);
    out.push({
      email,
      name: subBy.get(email) ?? null,
      inLista: subBy.has(email),
      inviate: num("inviate"),
      delivered: num("delivered"),
      bounced,
      complained,
      pending,
      opened: num("opened"),
      lastStatus: l?.status ?? null,
      lastDetail: l?.detail ?? null,
      salute: bounced > 0 || complained > 0 ? "problema" : pending > 0 ? "attesa" : "ok",
    });
  }
  // iscritti che non hanno mai ricevuto un broadcast tracciato
  for (const [email, name] of subBy) {
    if (seen.has(email)) continue;
    out.push({
      email, name, inLista: true, inviate: 0, delivered: 0, bounced: 0,
      complained: 0, pending: 0, opened: 0, lastStatus: null, lastDetail: null,
      salute: "attesa",
    });
  }
  const rank = { problema: 0, attesa: 1, ok: 2 } as const;
  out.sort((a, b) => rank[a.salute] - rank[b.salute] || a.email.localeCompare(b.email));
  return out;
}

/**
 * Interroga Resend sullo stato dei destinatari ancora senza esito e aggiorna il
 * DB. Serve sia a recuperare i broadcast inviati prima che i webhook fossero
 * configurati, sia come rete di sicurezza se un webhook non arriva.
 *
 * Resend limita le richieste (~2/s): le eseguiamo in sequenza con una breve
 * pausa e ci fermiamo al primo 429, ripartendo alla chiamata successiva.
 */
export async function refreshDeliveryStatuses(
  env: Env,
  db: D1Database,
  opts: { limit?: number } = {},
): Promise<{ checked: number; updated: number; rateLimited: boolean; byStatus: Record<string, number> }> {
  const apiKey = env.RESEND_API_KEY;
  const out = { checked: 0, updated: 0, rateLimited: false, byStatus: {} as Record<string, number> };
  if (!apiKey) return out;

  const limit = Math.min(opts.limit ?? 100, 200);
  const rs = await db
    .prepare(
      `SELECT resend_id FROM meetludica_broadcast_recipients
        WHERE resend_id IS NOT NULL AND status IN ('sent','delivery_delayed')
        ORDER BY created_at DESC LIMIT ?`,
    )
    .bind(limit)
    .all<{ resend_id: string }>();
  const pending = rs.results ?? [];

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (const row of pending) {
    if (out.checked > 0) await sleep(120);
    let res: Response;
    try {
      res = await fetch(`https://api.resend.com/emails/${row.resend_id}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
    } catch {
      continue;
    }
    out.checked++;
    if (res.status === 429) { out.rateLimited = true; break; }
    if (!res.ok) continue;

    const data = await res.json<{ last_event?: string }>().catch(() => ({} as { last_event?: string }));
    const ev = String(data.last_event ?? "").toLowerCase();
    out.byStatus[ev || "sconosciuto"] = (out.byStatus[ev || "sconosciuto"] ?? 0) + 1;

    // "sent"/"queued" = ancora in transito: lasciamo lo stato invariato.
    let status: string | null = null;
    if (ev === "delivered") status = "delivered";
    else if (ev === "bounced") status = "bounced";
    else if (ev === "complained") status = "complained";
    else if (ev === "delivery_delayed") status = "delivery_delayed";

    if (status) {
      const ok = await updateRecipientByResendId(db, row.resend_id, { status });
      if (ok) out.updated++;
    }
  }
  return out;
}
