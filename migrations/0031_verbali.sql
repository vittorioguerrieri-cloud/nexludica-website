-- Sistema di creazione e firma dei verbali NexLudica.
--
-- Due tabelle:
--   - verbali_templates: template riusabili per tipo (assemblea ordinaria, ecc.)
--     con corpo precompilato e firmatari di default
--   - verbali: i verbali reali, con metadata + stato firma (draft → sent → signed)
--
-- Storage del PDF firmato: cartella "Verbali" su Google Drive (campo
-- drive_file_id/drive_file_url) + il bytes finale può essere mirrorato in R2
-- via pdf_r2_key se serve un backup.
--
-- Workflow:
--   1. Crea verbale (status=draft) compilando i campi
--   2. Preview PDF (genera al volo da pdf-lib senza salvare)
--   3. "Invia in firma" → genera PDF, upload a SignWell, status=sent_for_signature
--   4. SignWell invia email ai firmatari, raccoglie firme
--   5. Webhook SignWell → scarica PDF firmato, upload su Drive, status=signed

CREATE TABLE IF NOT EXISTS verbali_templates (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'assemblea_ordinaria',
    'assemblea_straordinaria',
    'consiglio_direttivo',
    'riunione_operativa'
  )),
  -- Corpo del verbale come Markdown con placeholder {{nome_campo}}.
  -- Placeholder supportati: meeting_date, meeting_time, location, president_name,
  -- secretary_name, attendees_present_list, attendees_absent_list, agenda_md,
  -- body_extra.
  body_template TEXT NOT NULL,
  -- Default signers: JSON array di {name, email}.
  -- Se NULL, viene usato il fallback hardcoded (Vittorio + Raluca).
  default_signers TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verbali (
  id TEXT PRIMARY KEY,
  template_id TEXT,
  -- Tipo (può differire dal template se modificato manualmente)
  type TEXT NOT NULL CHECK (type IN (
    'assemblea_ordinaria',
    'assemblea_straordinaria',
    'consiglio_direttivo',
    'riunione_operativa'
  )),
  title TEXT NOT NULL,                  -- es. "Verbale Assemblea Ordinaria 15/06/2026"
  meeting_date TEXT NOT NULL,           -- ISO date YYYY-MM-DD
  meeting_time TEXT,                    -- HH:MM (opzionale)
  location TEXT,                        -- "Sede legale, Vico Barnabiti 10 — Genova"
  president_name TEXT,                  -- Presidente dell'assemblea/riunione
  secretary_name TEXT,                  -- Segretario verbalizzante
  attendees_present TEXT,               -- JSON array di {name, role?}
  attendees_absent TEXT,                -- JSON array di {name, justified?}
  -- Ordine del giorno + discussione: JSON array di {title, discussion, decision}
  agenda_items TEXT,
  body_extra TEXT,                      -- testo libero ulteriore (markdown)
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'generated', 'sent_for_signature', 'signed', 'archived', 'voided'
  )),
  -- Firmatari: JSON array di {name, email, signed_at?, signature_url?}
  signers TEXT,
  -- SignWell tracking
  signwell_document_id TEXT,
  signwell_subject TEXT,
  -- Storage del PDF finale firmato
  drive_file_id TEXT,
  drive_file_url TEXT,
  pdf_r2_key TEXT,                      -- nullable, per backup
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT,
  sent_at INTEGER,                      -- quando inviato a SignWell
  signed_at INTEGER,                    -- quando tutti hanno firmato
  FOREIGN KEY (template_id) REFERENCES verbali_templates(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS verbali_status_idx ON verbali(status, meeting_date DESC);
CREATE INDEX IF NOT EXISTS verbali_swid_idx ON verbali(signwell_document_id) WHERE signwell_document_id IS NOT NULL;

-- Seed dei 4 template di default con corpo precompilato.
-- I placeholder {{...}} vengono sostituiti al momento della generazione.

INSERT OR IGNORE INTO verbali_templates (id, slug, name, type, body_template, default_signers, created_at, updated_at) VALUES
(
  'vtpl_assemblea_ord',
  'assemblea-ordinaria',
  'Assemblea Ordinaria dei Soci',
  'assemblea_ordinaria',
  '# Verbale Assemblea Ordinaria dei Soci

In data {{meeting_date}}{{#meeting_time}}, alle ore {{meeting_time}}{{/meeting_time}}, presso {{location}}, si è regolarmente riunita l''Assemblea Ordinaria dei Soci di NexLudica APS.

Presiede la seduta {{president_name}}; verbalizza {{secretary_name}}.

## Presenti
{{attendees_present_list}}

## Assenti
{{attendees_absent_list}}

Constatata la regolarità della convocazione e la validità della seduta, si procede con l''esame dell''ordine del giorno.

## Ordine del giorno e deliberazioni
{{agenda_md}}

{{body_extra}}

La seduta è tolta alle ore _____.',
  NULL,
  unixepoch()*1000, unixepoch()*1000
),
(
  'vtpl_assemblea_str',
  'assemblea-straordinaria',
  'Assemblea Straordinaria dei Soci',
  'assemblea_straordinaria',
  '# Verbale Assemblea Straordinaria dei Soci

In data {{meeting_date}}{{#meeting_time}}, alle ore {{meeting_time}}{{/meeting_time}}, presso {{location}}, si è regolarmente riunita l''Assemblea Straordinaria dei Soci di NexLudica APS, convocata per le materie indicate nell''ordine del giorno.

Presiede la seduta {{president_name}}; verbalizza {{secretary_name}}.

## Presenti
{{attendees_present_list}}

## Assenti
{{attendees_absent_list}}

Constatata la regolarità della convocazione e la validità della seduta ai sensi dello Statuto, si procede con l''esame dell''ordine del giorno.

## Ordine del giorno e deliberazioni
{{agenda_md}}

{{body_extra}}

La seduta è tolta alle ore _____.',
  NULL,
  unixepoch()*1000, unixepoch()*1000
),
(
  'vtpl_consiglio',
  'consiglio-direttivo',
  'Consiglio Direttivo',
  'consiglio_direttivo',
  '# Verbale Consiglio Direttivo

In data {{meeting_date}}{{#meeting_time}}, alle ore {{meeting_time}}{{/meeting_time}}, presso {{location}}, si è riunito il Consiglio Direttivo di NexLudica APS.

Presiede {{president_name}}; verbalizza {{secretary_name}}.

## Presenti
{{attendees_present_list}}

## Assenti
{{attendees_absent_list}}

Si procede con l''esame dei punti all''ordine del giorno.

## Ordine del giorno e decisioni
{{agenda_md}}

{{body_extra}}

La riunione è tolta alle ore _____.',
  NULL,
  unixepoch()*1000, unixepoch()*1000
),
(
  'vtpl_operativa',
  'riunione-operativa',
  'Riunione operativa / team',
  'riunione_operativa',
  '# Verbale Riunione operativa

In data {{meeting_date}}{{#meeting_time}}, alle ore {{meeting_time}}{{/meeting_time}}{{#location}}, presso {{location}}{{/location}}, si è tenuta una riunione operativa del team NexLudica.

Coordinamento: {{president_name}} · Note prese da: {{secretary_name}}.

## Partecipanti
{{attendees_present_list}}

## Argomenti e decisioni
{{agenda_md}}

{{body_extra}}',
  NULL,
  unixepoch()*1000, unixepoch()*1000
);
