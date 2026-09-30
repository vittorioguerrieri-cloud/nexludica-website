/**
 * Allegati ai verbali. File caricati su Drive nella cartella
 *   "Allegati verbali / <verbale title>"
 * (creata lazy alla prima upload). In DB conserviamo solo i metadata.
 */
import { now, uuid } from "./db";

export interface VerbaleAttachment {
  id: string;
  verbaleId: string;
  filename: string;
  mimeType: string | null;
  sizeBytes: number | null;
  driveFileId: string;
  driveViewUrl: string | null;
  driveDownloadUrl: string | null;
  position: number;
  notes: string | null;
  uploadedAt: number;
  uploadedBy: string | null;
}

function rowToAttachment(r: Record<string, unknown>): VerbaleAttachment {
  return {
    id: String(r.id),
    verbaleId: String(r.verbale_id),
    filename: String(r.filename),
    mimeType: (r.mime_type as string) ?? null,
    sizeBytes: r.size_bytes != null ? Number(r.size_bytes) : null,
    driveFileId: String(r.drive_file_id),
    driveViewUrl: (r.drive_view_url as string) ?? null,
    driveDownloadUrl: (r.drive_download_url as string) ?? null,
    position: Number(r.position ?? 0),
    notes: (r.notes as string) ?? null,
    uploadedAt: Number(r.uploaded_at),
    uploadedBy: (r.uploaded_by as string) ?? null,
  };
}

export async function listAttachments(db: D1Database, verbaleId: string): Promise<VerbaleAttachment[]> {
  const { results } = await db
    .prepare("SELECT * FROM verbali_attachments WHERE verbale_id = ? ORDER BY position, uploaded_at")
    .bind(verbaleId)
    .all();
  return (results ?? []).map((r) => rowToAttachment(r as Record<string, unknown>));
}

export async function getAttachment(db: D1Database, id: string): Promise<VerbaleAttachment | null> {
  const r = await db.prepare("SELECT * FROM verbali_attachments WHERE id = ?").bind(id).first();
  return r ? rowToAttachment(r as Record<string, unknown>) : null;
}

export async function addAttachment(
  db: D1Database,
  data: {
    verbaleId: string;
    filename: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    driveFileId: string;
    driveViewUrl?: string | null;
    driveDownloadUrl?: string | null;
    notes?: string | null;
    uploadedBy?: string | null;
  },
): Promise<VerbaleAttachment> {
  const id = uuid();
  const ts = now();
  // Posizione = prossimo indice
  const lastPos = await db
    .prepare("SELECT COALESCE(MAX(position), -1) AS p FROM verbali_attachments WHERE verbale_id = ?")
    .bind(data.verbaleId)
    .first<{ p: number }>();
  const position = (lastPos?.p ?? -1) + 1;

  await db
    .prepare(
      `INSERT INTO verbali_attachments
        (id, verbale_id, filename, mime_type, size_bytes, drive_file_id,
         drive_view_url, drive_download_url, position, notes, uploaded_at, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id, data.verbaleId, data.filename, data.mimeType ?? null, data.sizeBytes ?? null,
      data.driveFileId, data.driveViewUrl ?? null, data.driveDownloadUrl ?? null,
      position, data.notes ?? null, ts, data.uploadedBy ?? null,
    )
    .run();
  const r = await getAttachment(db, id);
  if (!r) throw new Error("addAttachment failed");
  return r;
}

export async function deleteAttachment(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM verbali_attachments WHERE id = ?").bind(id).run();
}

/** Format size in human-readable (es. "1.4 MB"). */
export function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
