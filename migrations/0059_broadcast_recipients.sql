-- Tracciamento per-destinatario dei broadcast MeetLudica: ad ogni invio si
-- salva, per ciascun iscritto, l'id del messaggio Resend e poi lo stato di
-- consegna aggiornato dai webhook Resend (delivered/bounced/complained/...).

CREATE TABLE IF NOT EXISTS meetludica_broadcast_recipients (
  id TEXT PRIMARY KEY,
  broadcast_id TEXT NOT NULL,
  email TEXT NOT NULL,
  resend_id TEXT,                         -- id del messaggio su Resend
  status TEXT NOT NULL DEFAULT 'sent',    -- sent|delivered|bounced|complained|delivery_delayed
  bounce_type TEXT,                       -- tipo di bounce (hard/soft) se presente
  detail TEXT,                            -- messaggio diagnostico (bounce/complaint)
  opened INTEGER NOT NULL DEFAULT 0,
  last_event_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS mbr_broadcast_idx ON meetludica_broadcast_recipients(broadcast_id);
CREATE INDEX IF NOT EXISTS mbr_resend_idx ON meetludica_broadcast_recipients(resend_id);
