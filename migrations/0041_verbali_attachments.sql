-- Allegati ai verbali. I file sono caricati su Google Drive (cartella dedicata
-- per verbale), in DB conserviamo solo i metadata + drive_file_id per il link.

CREATE TABLE IF NOT EXISTS verbali_attachments (
  id TEXT PRIMARY KEY,
  verbale_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  drive_file_id TEXT NOT NULL,
  drive_view_url TEXT,
  drive_download_url TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  uploaded_at INTEGER NOT NULL,
  uploaded_by TEXT,
  FOREIGN KEY (verbale_id) REFERENCES verbali(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS verbali_attachments_verbale_idx ON verbali_attachments(verbale_id, position);
