/**
 * Verbali: CRUD + rendering PDF + SignWell integration.
 *
 * Modello:
 *   verbali_templates (1 riga per tipo, riusabile) → verbali (istanze concrete)
 *
 * Flusso:
 *   1. createVerbale → stato 'draft'
 *   2. renderVerbalePdf → bytes PDF (chiamato per preview + per send)
 *   3. sendForSigning → upload a SignWell + stato 'sent_for_signature'
 *   4. webhook signature_completed → download PDF firmato → upload Drive → stato 'signed'
 */
import { now, uuid } from "./db";

export type VerbaleType =
  | "assemblea_ordinaria"
  | "assemblea_straordinaria"
  | "consiglio_direttivo"
  | "riunione_operativa";

export type VerbaleStatus =
  | "draft"
  | "generated"
  | "sent_for_signature"
  | "signed"
  | "archived"
  | "voided";

export interface VerbaleTemplate {
  id: string;
  slug: string;
  name: string;
  type: VerbaleType;
  bodyTemplate: string;
  defaultSigners: Array<{ name: string; email: string }> | null;
  createdAt: number;
  updatedAt: number;
}

export interface VerbaleAttendee {
  name: string;
  role?: string;
  justified?: boolean;
}

export interface VerbaleAgendaItem {
  title: string;
  discussion?: string;
  decision?: string;
}

export interface VerbaleSigner {
  name: string;
  email: string;
  signed_at?: number;
  signature_url?: string;
  signwell_recipient_id?: string;
}

export interface Verbale {
  id: string;
  templateId: string | null;
  type: VerbaleType;
  title: string;
  meetingDate: string;
  meetingTime: string | null;
  meetingEndTime: string | null;
  location: string | null;
  presidentName: string | null;
  secretaryName: string | null;
  attendeesPresent: VerbaleAttendee[];
  attendeesAbsent: VerbaleAttendee[];
  agendaItems: VerbaleAgendaItem[];
  /** Se non null, sostituisce `agendaItems` nel rendering del PDF/markdown.
   *  Permette all'utente di scrivere l'ordine del giorno come markdown libero. */
  agendaMarkdown: string | null;
  bodyExtra: string | null;
  status: VerbaleStatus;
  signers: VerbaleSigner[];
  signwellDocumentId: string | null;
  signwellSubject: string | null;
  driveFileId: string | null;
  driveFileUrl: string | null;
  pdfR2Key: string | null;
  createdAt: number;
  updatedAt: number;
  createdBy: string | null;
  sentAt: number | null;
  signedAt: number | null;
}

/** Firmatari di fallback se né l'utente né il template ne specificano. */
export const DEFAULT_SIGNERS: VerbaleSigner[] = [
  { name: "Vittorio Guerrieri", email: "vittorio.guerrieri@nexludica.org" },
  { name: "Raluca Fulgu", email: "raluca.fulgu@nexludica.org" },
];

function parseJson<T>(v: unknown, fallback: T): T {
  if (!v) return fallback;
  try { return JSON.parse(String(v)) as T; } catch { return fallback; }
}

function rowToTemplate(r: Record<string, unknown>): VerbaleTemplate {
  return {
    id: String(r.id),
    slug: String(r.slug),
    name: String(r.name),
    type: r.type as VerbaleType,
    bodyTemplate: String(r.body_template),
    defaultSigners: parseJson<Array<{ name: string; email: string }> | null>(r.default_signers, null),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

function rowToVerbale(r: Record<string, unknown>): Verbale {
  return {
    id: String(r.id),
    templateId: (r.template_id as string) ?? null,
    type: r.type as VerbaleType,
    title: String(r.title),
    meetingDate: String(r.meeting_date),
    meetingTime: (r.meeting_time as string) ?? null,
    meetingEndTime: (r.meeting_end_time as string) ?? null,
    location: (r.location as string) ?? null,
    presidentName: (r.president_name as string) ?? null,
    secretaryName: (r.secretary_name as string) ?? null,
    attendeesPresent: parseJson<VerbaleAttendee[]>(r.attendees_present, []),
    attendeesAbsent: parseJson<VerbaleAttendee[]>(r.attendees_absent, []),
    agendaItems: parseJson<VerbaleAgendaItem[]>(r.agenda_items, []),
    agendaMarkdown: (r.agenda_markdown as string) ?? null,
    bodyExtra: (r.body_extra as string) ?? null,
    status: r.status as VerbaleStatus,
    signers: parseJson<VerbaleSigner[]>(r.signers, []),
    signwellDocumentId: (r.signwell_document_id as string) ?? null,
    signwellSubject: (r.signwell_subject as string) ?? null,
    driveFileId: (r.drive_file_id as string) ?? null,
    driveFileUrl: (r.drive_file_url as string) ?? null,
    pdfR2Key: (r.pdf_r2_key as string) ?? null,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    createdBy: (r.created_by as string) ?? null,
    sentAt: r.sent_at != null ? Number(r.sent_at) : null,
    signedAt: r.signed_at != null ? Number(r.signed_at) : null,
  };
}

// ===== TEMPLATES =====

export async function listTemplates(db: D1Database): Promise<VerbaleTemplate[]> {
  const { results } = await db
    .prepare("SELECT * FROM verbali_templates ORDER BY type, name")
    .all();
  return (results ?? []).map((r) => rowToTemplate(r as Record<string, unknown>));
}

export async function getTemplate(db: D1Database, id: string): Promise<VerbaleTemplate | null> {
  const r = await db.prepare("SELECT * FROM verbali_templates WHERE id = ?").bind(id).first();
  return r ? rowToTemplate(r as Record<string, unknown>) : null;
}

// ===== VERBALI =====

export async function listVerbali(db: D1Database): Promise<Verbale[]> {
  const { results } = await db
    .prepare("SELECT * FROM verbali WHERE deleted_at IS NULL ORDER BY meeting_date DESC, created_at DESC")
    .all();
  return (results ?? []).map((r) => rowToVerbale(r as Record<string, unknown>));
}

/** Verbali nel cestino (soft-deleted), dal più recente. */
export async function listTrashedVerbali(db: D1Database): Promise<Array<Verbale & { deletedAt: number }>> {
  const { results } = await db
    .prepare("SELECT * FROM verbali WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
    .all();
  return (results ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return { ...rowToVerbale(row), deletedAt: Number(row.deleted_at) };
  });
}

export async function getVerbale(db: D1Database, id: string): Promise<Verbale | null> {
  const r = await db.prepare("SELECT * FROM verbali WHERE id = ?").bind(id).first();
  return r ? rowToVerbale(r as Record<string, unknown>) : null;
}

/** Sposta nel cestino (soft-delete). */
export async function softDeleteVerbale(db: D1Database, id: string): Promise<void> {
  await db.prepare("UPDATE verbali SET deleted_at = ? WHERE id = ?").bind(now(), id).run();
}

/** Ripristina dal cestino. */
export async function restoreVerbale(db: D1Database, id: string): Promise<void> {
  await db.prepare("UPDATE verbali SET deleted_at = NULL WHERE id = ?").bind(id).run();
}

export async function createVerbale(
  db: D1Database,
  data: {
    templateId?: string | null;
    type: VerbaleType;
    title: string;
    meetingDate: string;
    meetingTime?: string | null;
    meetingEndTime?: string | null;
    location?: string | null;
    presidentName?: string | null;
    secretaryName?: string | null;
    attendeesPresent?: VerbaleAttendee[];
    attendeesAbsent?: VerbaleAttendee[];
    agendaItems?: VerbaleAgendaItem[];
    agendaMarkdown?: string | null;
    bodyExtra?: string | null;
    signers?: VerbaleSigner[];
    createdBy?: string | null;
  },
): Promise<Verbale> {
  const id = uuid();
  const ts = now();
  const signers = data.signers && data.signers.length > 0 ? data.signers : DEFAULT_SIGNERS;
  await db
    .prepare(
      `INSERT INTO verbali (id, template_id, type, title, meeting_date, meeting_time, meeting_end_time, location,
         president_name, secretary_name, attendees_present, attendees_absent, agenda_items, agenda_markdown,
         body_extra, status, signers, created_at, updated_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
    )
    .bind(
      id,
      data.templateId ?? null,
      data.type,
      data.title,
      data.meetingDate,
      data.meetingTime ?? null,
      data.meetingEndTime ?? null,
      data.location ?? null,
      data.presidentName ?? null,
      data.secretaryName ?? null,
      JSON.stringify(data.attendeesPresent ?? []),
      JSON.stringify(data.attendeesAbsent ?? []),
      JSON.stringify(data.agendaItems ?? []),
      data.agendaMarkdown ?? null,
      data.bodyExtra ?? null,
      JSON.stringify(signers),
      ts,
      ts,
      data.createdBy ?? null,
    )
    .run();
  const v = await getVerbale(db, id);
  if (!v) throw new Error("createVerbale failed");
  return v;
}

export async function updateVerbale(
  db: D1Database,
  id: string,
  patch: Partial<{
    title: string;
    meetingDate: string;
    meetingTime: string | null;
    meetingEndTime: string | null;
    location: string | null;
    presidentName: string | null;
    secretaryName: string | null;
    attendeesPresent: VerbaleAttendee[];
    attendeesAbsent: VerbaleAttendee[];
    agendaItems: VerbaleAgendaItem[];
    agendaMarkdown: string | null;
    bodyExtra: string | null;
    signers: VerbaleSigner[];
    status: VerbaleStatus;
    signwellDocumentId: string | null;
    signwellSubject: string | null;
    driveFileId: string | null;
    driveFileUrl: string | null;
    pdfR2Key: string | null;
    sentAt: number | null;
    signedAt: number | null;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const args: unknown[] = [];
  const map: Record<string, string> = {
    title: "title", meetingDate: "meeting_date", meetingTime: "meeting_time", meetingEndTime: "meeting_end_time",
    location: "location", presidentName: "president_name", secretaryName: "secretary_name",
    bodyExtra: "body_extra", status: "status",
    signwellDocumentId: "signwell_document_id", signwellSubject: "signwell_subject",
    driveFileId: "drive_file_id", driveFileUrl: "drive_file_url", pdfR2Key: "pdf_r2_key",
    sentAt: "sent_at", signedAt: "signed_at",
  };
  for (const [k, col] of Object.entries(map)) {
    if ((patch as any)[k] !== undefined) {
      sets.push(`${col} = ?`);
      args.push((patch as any)[k]);
    }
  }
  if (patch.attendeesPresent !== undefined) { sets.push("attendees_present = ?"); args.push(JSON.stringify(patch.attendeesPresent)); }
  if (patch.attendeesAbsent !== undefined) { sets.push("attendees_absent = ?"); args.push(JSON.stringify(patch.attendeesAbsent)); }
  if (patch.agendaItems !== undefined) { sets.push("agenda_items = ?"); args.push(JSON.stringify(patch.agendaItems)); }
  if (patch.agendaMarkdown !== undefined) { sets.push("agenda_markdown = ?"); args.push(patch.agendaMarkdown); }
  if (patch.signers !== undefined) { sets.push("signers = ?"); args.push(JSON.stringify(patch.signers)); }
  if (sets.length === 0) return;
  sets.push("updated_at = ?");
  args.push(now());
  args.push(id);
  await db.prepare(`UPDATE verbali SET ${sets.join(", ")} WHERE id = ?`).bind(...args).run();
}

/**
 * Elimina un verbale e tutti i dati collegati: firme, allegati (record DB) e,
 * best-effort, i relativi file su Google Drive. Passare `env` per pulire Drive.
 */
export async function deleteVerbale(db: D1Database, id: string, env?: Env): Promise<void> {
  // 1) File allegati su Drive (best-effort, non blocca l'eliminazione)
  if (env) {
    try {
      const { results } = await db
        .prepare("SELECT drive_file_id FROM verbali_attachments WHERE verbale_id = ?")
        .bind(id)
        .all<{ drive_file_id: string }>();
      const { deleteFile } = await import("./drive");
      for (const r of results ?? []) {
        if (r.drive_file_id) {
          try { await deleteFile(env, r.drive_file_id); } catch { /* ignora */ }
        }
      }
    } catch { /* ignora errori Drive */ }
  }
  // 2) Record collegati + verbale
  await db.batch([
    db.prepare("DELETE FROM verbali_attachments WHERE verbale_id = ?").bind(id),
    db.prepare("DELETE FROM verbali_signatures WHERE verbale_id = ?").bind(id),
    db.prepare("DELETE FROM verbali WHERE id = ?").bind(id),
  ]);
}

export async function findBySignwellId(db: D1Database, swid: string): Promise<Verbale | null> {
  const r = await db.prepare("SELECT * FROM verbali WHERE signwell_document_id = ?").bind(swid).first();
  return r ? rowToVerbale(r as Record<string, unknown>) : null;
}

// ===== TEMPLATE RENDERING (markdown text) =====

/**
 * Sostituisce i placeholder {{nome}} nel body_template del template.
 * Supporta:
 *   - {{nome}}: sostituzione semplice
 *   - {{#nome}}testo{{/nome}}: blocco condizionale (se nome è truthy)
 */
function renderMarkdown(template: string, vars: Record<string, string | null>): string {
  let out = template;
  // Blocchi NEGATIVI {{^name}}...{{/name}} (renderizza se variabile vuota/null)
  out = out.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    return vars[key] ? "" : content;
  });
  // Blocchi POSITIVI {{#name}}...{{/name}} (renderizza se variabile presente)
  out = out.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    return vars[key] ? content : "";
  });
  // Sostituzioni semplici
  out = out.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return vars[key] ?? "";
  });
  return out;
}

/** Renderizza il contenuto del verbale come markdown (per preview/debug). */
export function renderVerbaleMarkdown(v: Verbale, template: VerbaleTemplate | null): string {
  const tmpl = template?.bodyTemplate ?? "# {{title}}\n\n{{agenda_md}}";

  const presentList = (v.attendeesPresent || [])
    .map((a) => `- **${a.name}**${a.role ? ` (${a.role})` : ""}`)
    .join("\n") || "_(nessuno indicato)_";

  const absentList = (v.attendeesAbsent || [])
    .map((a) => `- ${a.name}${a.justified ? " — _giustificato_" : ""}`)
    .join("\n") || "_(nessuno)_";

  // Se l'utente ha scritto il markdown libero, usalo direttamente;
  // altrimenti compone da agendaItems strutturati.
  const agendaMd = (v.agendaMarkdown && v.agendaMarkdown.trim())
    ? v.agendaMarkdown
    : ((v.agendaItems || [])
        .map((it, i) => {
          const lines = [`### ${i + 1}. ${it.title}`];
          if (it.discussion) lines.push("", it.discussion);
          if (it.decision) lines.push("", `**Decisione:** ${it.decision}`);
          return lines.join("\n");
        })
        .join("\n\n") || "_(nessun punto all'ordine del giorno)_");

  const vars: Record<string, string | null> = {
    title: v.title,
    meeting_date: formatDate(v.meetingDate),
    meeting_time: v.meetingTime,
    meeting_end_time: v.meetingEndTime,
    location: v.location,
    president_name: v.presidentName,
    secretary_name: v.secretaryName,
    attendees_present_list: presentList,
    attendees_absent_list: absentList,
    agenda_md: agendaMd,
    body_extra: v.bodyExtra ?? "",
  };
  return renderMarkdown(tmpl, vars);
}

function formatDate(d: string): string {
  try {
    const [y, m, day] = d.split("-").map(Number);
    const months = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
    return `${day} ${months[m - 1]} ${y}`;
  } catch { return d; }
}

// ===== PDF GENERATION (pdf-lib) =====

/**
 * Genera il PDF del verbale usando pdf-lib.
 *
 * Layout:
 *   - A4 portrait, margini 60pt (~2cm)
 *   - Font Helvetica (Normal + Bold)
 *   - Header con logo testuale "NexLudica APS" + tipo verbale
 *   - Body multi-page con wrapping automatico
 *   - Sezione firme in fondo (riserviamo ~150pt sull'ultima pagina)
 *
 * Ritorna anche le coordinate delle aree firma per la posizionatura
 * dei campi firma SignWell.
 */
export async function renderVerbalePdf(
  v: Verbale,
  template: VerbaleTemplate | null,
  env?: Env,
  signatures?: Array<{
    signerName: string;
    signerEmail: string;
    typedSignature: string | null;
    imageSignatureData?: string | null;        // data URL PNG (firma disegnata / caricata)
    signedAt: number | null;
    signerIpHash: string | null;
    // Campi opzionali usati solo per la pagina audit trail
    sentAt?: number;
    signerUserAgent?: string | null;
    signerLocale?: string | null;
    signatureMethod?: "typed" | "drawn" | "uploaded" | null;
    consentGivenAt?: number | null;
    documentHash?: string | null;
    status?: string;
  }>,
  attachments?: Array<{
    filename: string;
    mimeType: string | null;
    sizeBytes: number | null;
    notes: string | null;
  }>,
  opts?: {
    /**
     * Hook eseguito DOPO il disegno del verbale e PRIMA del save finale.
     * Permette di accodare altre pagine (allegati, report di bilancio)
     * nello stesso documento, riusando i font gia' incorporati: cosi' si
     * evita di creare/salvare/ri-caricare PDF separati (causa "Error 1102
     * Worker exceeded CPU limit" al download).
     */
    extend?: (ctx: {
      pdfDoc: any;
      regular: any;
      bold: any;
      italic: any;
      logo: any;
      rgb: any;
    }) => Promise<void>;
  },
): Promise<{
  pdfBytes: Uint8Array;
  signatureFields: Array<{
    recipient_index: number;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
    name: string;
  }>;
}> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  // pdf-lib supporta font custom solo con `fontkit` registrato.
  const fontkit = await import("@pdf-lib/fontkit");
  pdfDoc.registerFontkit((fontkit as any).default ?? fontkit);

  // Carica Montserrat dagli asset. Fallback su Helvetica se la fetch fallisce
  // o il Worker scoppia per CPU. Subset: true riduce a soli i glifi usati.
  let fontRegular: Awaited<ReturnType<typeof pdfDoc.embedFont>>;
  let fontBold: Awaited<ReturnType<typeof pdfDoc.embedFont>>;
  let fontItalic: Awaited<ReturnType<typeof pdfDoc.embedFont>>;
  let usingMontserrat = false;
  try {
    if (env && (env as any).ASSETS) {
      const fetchAsset = async (path: string) => {
        const r = await (env as any).ASSETS.fetch(new Request("https://nexludica.local" + path));
        if (!r.ok) throw new Error(`asset ${path} ${r.status}`);
        return r.arrayBuffer();
      };
      // Font GIA' ridotti ai glifi latini (~33KB invece di ~450KB): con
      // subset:false l'incorporamento e il save sono molto leggeri in CPU.
      // I font interi sforavano il limite CPU del Worker ("Error 1102"),
      // sia da soli sia (peggio) al download con allegati + bilancio.
      const [reg, bold, italic] = await Promise.all([
        fetchAsset("/fonts/Montserrat-Regular-subset.ttf"),
        fetchAsset("/fonts/Montserrat-Bold-subset.ttf"),
        fetchAsset("/fonts/Montserrat-Italic-subset.ttf"),
      ]);
      fontRegular = await pdfDoc.embedFont(reg, { subset: false });
      fontBold    = await pdfDoc.embedFont(bold, { subset: false });
      fontItalic  = await pdfDoc.embedFont(italic, { subset: false });
      usingMontserrat = true;
    } else {
      throw new Error("ASSETS binding non disponibile");
    }
  } catch (e) {
    console.warn("[verbali] Montserrat embed failed, fallback to Helvetica:", e);
    fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    fontBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    fontItalic  = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  }
  // Alias per ridurre cambi nel codice esistente
  const helv = fontRegular;
  const helvBold = fontBold;
  const helvOblique = fontItalic;
  void usingMontserrat;

  // Embed del logo PDF compresso (360px, ~30KB). Se l'embed fallisce per
  // qualsiasi ragione, la letterhead testuale (drawCoverHeader) fa da
  // fallback automatico.
  let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  try {
    if (env && (env as any).ASSETS) {
      const r = await (env as any).ASSETS.fetch(
        new Request("https://nexludica.local/images/branding/logo-pdf.png"),
      );
      if (r.ok) {
        const buf = await r.arrayBuffer();
        logoImage = await pdfDoc.embedPng(buf);
      }
    }
  } catch (e) {
    console.warn("[verbali] logo embed failed, using text letterhead:", e);
    logoImage = null;
  }

  // A4 in points (72 dpi): 595 × 842
  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN = 56;
  const TOP_HEADER_H = 90;        // letterhead prima pagina (logo più compatto)
  const TOP_HEADER_H_OTHER = 50;  // header compatto pagine successive
  const BODY_SIZE = 11;
  const LINE_H = 16;               // line-height ~1.45 (più aria, leggibilità)
  const CONTENT_W = PAGE_W - 2 * MARGIN;
  // Ascender e descender approssimati per Montserrat/Helvetica
  const ASC_RATIO = 0.78;
  const DESC_RATIO = 0.22;
  function ascender(size: number) { return size * ASC_RATIO; }
  function descender(size: number) { return size * DESC_RATIO; }

  const cyan = rgb(0.02, 0.67, 0.77);   // #05abc4 NexLudica primary
  const dark = rgb(0.106, 0.145, 0.157); // #1b2528 NexLudica dark
  const gray = rgb(0.45, 0.45, 0.45);
  const lightGray = rgb(0.86, 0.86, 0.86);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let cursorY = PAGE_H - MARGIN;
  let pageIndex = 0;

  /** Letterhead prima pagina: logo PNG embeddato (se disponibile) +
   *  accent rule. Fallback testuale se l'embed del PNG fallisce. */
  function drawCoverHeader() {
    const centerX = PAGE_W / 2;

    if (logoImage) {
      // Logo PNG centrato, più compatto (140pt, ~33% pagina A4)
      const maxW = 140;
      const ratio = logoImage.width / logoImage.height;
      const w = maxW;
      const h = w / ratio;
      const x = centerX - w / 2;
      const y = PAGE_H - 22 - h;
      page.drawImage(logoImage, { x, y, width: w, height: h });
    } else {
      // Fallback testuale: 3 quadrati ciano + wordmark "Nex/Ludica"
      const topY = PAGE_H - 40;
      const sqSize = 14, sqGap = 6;
      const sqTotalW = sqSize * 3 + sqGap * 2;
      const sqStartX = centerX - sqTotalW / 2;
      for (let i = 0; i < 3; i++) {
        page.drawRectangle({
          x: sqStartX + i * (sqSize + sqGap), y: topY - sqSize,
          width: sqSize, height: sqSize, color: cyan,
        });
      }
      const wordY = topY - sqSize - 28;
      const nexSize = 30;
      const nexW = helvBold.widthOfTextAtSize("Nex", nexSize);
      const ludicaW = helvBold.widthOfTextAtSize("Ludica", nexSize);
      const wordStartX = centerX - (nexW + ludicaW) / 2;
      page.drawText("Nex", { x: wordStartX, y: wordY, size: nexSize, font: helvBold, color: dark });
      page.drawText("Ludica", { x: wordStartX + nexW, y: wordY, size: nexSize, font: helvBold, color: cyan });
      const tagline = "Game  |  Research  |  Equity";
      const taglineSize = 9.5;
      const taglineW = helv.widthOfTextAtSize(tagline, taglineSize);
      page.drawText(tagline, { x: centerX - taglineW / 2, y: wordY - 14, size: taglineSize, font: helv, color: gray });
    }

    // Accent rules sotto la letterhead (2pt ciano + 0.5pt lightGray)
    page.drawLine({
      start: { x: MARGIN, y: PAGE_H - TOP_HEADER_H - 4 },
      end:   { x: PAGE_W - MARGIN, y: PAGE_H - TOP_HEADER_H - 4 },
      thickness: 2,
      color: cyan,
    });
    page.drawLine({
      start: { x: MARGIN, y: PAGE_H - TOP_HEADER_H - 7 },
      end:   { x: PAGE_W - MARGIN, y: PAGE_H - TOP_HEADER_H - 7 },
      thickness: 0.5,
      color: lightGray,
    });
    cursorY = PAGE_H - TOP_HEADER_H - 24;
  }

  /** Header compatto pagine successive: solo "NexLudica APS" + rule fine. */
  function drawCompactHeader() {
    page.drawText("NexLudica APS", { x: MARGIN, y: PAGE_H - 30, size: 9, font: helvBold, color: cyan });
    page.drawText("Game · Research · Equity", { x: MARGIN + 84, y: PAGE_H - 30, size: 7.5, font: helv, color: gray });
    page.drawText(`${pageIndex + 1}`, { x: PAGE_W - MARGIN - 6, y: PAGE_H - 30, size: 9, font: helv, color: gray });
    page.drawLine({
      start: { x: MARGIN, y: PAGE_H - 38 },
      end:   { x: PAGE_W - MARGIN, y: PAGE_H - 38 },
      thickness: 0.5,
      color: lightGray,
    });
    cursorY = PAGE_H - TOP_HEADER_H_OTHER - 6;
  }

  function drawFooter() {
    const footY = MARGIN - 22;
    page.drawLine({
      start: { x: MARGIN, y: footY + 14 },
      end:   { x: PAGE_W - MARGIN, y: footY + 14 },
      thickness: 0.5,
      color: lightGray,
    });
    page.drawText(
      "NexLudica APS · Vico Barnabiti 10, 16122 Genova · C.F. 95252550108 · nexludica.org",
      { x: MARGIN, y: footY, size: 7.5, font: helv, color: gray },
    );
    page.drawText(`pag. ${pageIndex + 1}`, {
      x: PAGE_W - MARGIN - 24, y: footY, size: 7.5, font: helv, color: gray,
    });
  }

  function newPage() {
    drawFooter();
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pageIndex += 1;
    drawCompactHeader();
  }

  drawCoverHeader();

  function ensureSpace(needed: number) {
    if (cursorY - needed < MARGIN + 10) newPage();
  }

  function wrapWords(text: string, font: any, size: number, maxWidth: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      const w = font.widthOfTextAtSize(test, size);
      if (w > maxWidth && current) { lines.push(current); current = word; }
      else current = test;
    }
    if (current) lines.push(current);
    return lines;
  }

  function drawText(text: string, opts: { font?: any; size?: number; color?: any; indent?: number; italic?: boolean; bold?: boolean } = {}) {
    const font = opts.italic ? helvOblique : (opts.bold ? helvBold : (opts.font ?? helv));
    const size = opts.size ?? BODY_SIZE;
    const color = opts.color ?? dark;
    const indent = opts.indent ?? 0;
    const x = MARGIN + indent;
    const maxW = CONTENT_W - indent;
    const paragraphs = text.split(/\n/);
    for (let pi = 0; pi < paragraphs.length; pi++) {
      const para = paragraphs[pi];
      if (!para.trim()) { cursorY -= LINE_H * 0.4; continue; }
      const lines = wrapWords(para, font, size, maxW);
      for (const line of lines) {
        // Convenzione cursorY = top della prossima riga.
        // baseline = top - ascender(size). Reserva LINE_H di spazio.
        ensureSpace(LINE_H);
        const baselineY = cursorY - ascender(size);
        page.drawText(line, { x, y: baselineY, size, font, color });
        cursorY -= LINE_H;
      }
    }
  }

  /** Heading con spaziatura ASCENDER-aware: niente più righe orfane che
   *  coprono testo. Convenzione: cursorY traccia il baseline-target della
   *  prossima riga; quando disegno text size=sz lo metto a (cursorY - ascender)
   *  così l'ascender top arriva esattamente a cursorY, e il prossimo line
   *  parte da (cursorY - ascender - descender - gap). */
  function drawHeading(text: string, level: 1 | 2 | 3) {
    const sizes = { 1: 19, 2: 12.5, 3: 11 };
    const sz = sizes[level];
    // Spazio verticale "before" misurato sopra l'ascender del heading
    const spaceBefore = level === 1 ? 22 : (level === 2 ? 18 : 10);
    // Spazio verticale "after" misurato sotto il descender del heading
    const spaceAfter  = level === 1 ? 10 : (level === 2 ? 8 : 4);

    const totalH = spaceBefore + ascender(sz) + descender(sz) + spaceAfter;
    ensureSpace(totalH);

    // Sposta cursor sotto al gap "before"
    cursorY -= spaceBefore;
    const baselineY = cursorY - ascender(sz);

    if (level === 2) {
      // Sezione: maiuscolo ciano, senza rule (rule eliminata: era arbitraria
      // e in alcuni casi sovrapponeva la prima riga di body sottostante)
      page.drawText(text.toUpperCase(), {
        x: MARGIN, y: baselineY, size: sz, font: helvBold, color: cyan,
      });
    } else if (level === 3) {
      page.drawText(text, {
        x: MARGIN, y: baselineY, size: sz, font: helvBold, color: dark,
      });
    } else {
      page.drawText(text, {
        x: MARGIN, y: baselineY, size: sz, font: helvBold, color: dark,
      });
    }
    // Cursor pronto per la prossima riga: sotto descender + spaceAfter
    cursorY = baselineY - descender(sz) - spaceAfter;
  }

  // === COVER TITLE BLOCK (allineato a sinistra, con spazio sopra) ===
  cursorY -= 24;  // abbassa il titolo rispetto alla letterhead
  ensureSpace(60);
  const titleSize = 18;
  const titleBaseY = cursorY - ascender(titleSize);
  page.drawText(v.title, {
    x: MARGIN,
    y: titleBaseY,
    size: titleSize,
    font: helvBold,
    color: dark,
  });
  cursorY = titleBaseY - descender(titleSize) - 8;
  const subSize = 10.5;
  let subtitle = `${typeLabel(v.type)} — ${formatDate(v.meetingDate)}`;
  if (v.meetingTime) {
    subtitle += ` · ore ${v.meetingTime}`;
    if (v.meetingEndTime) subtitle += `–${v.meetingEndTime}`;
  }
  const subBaseY = cursorY - ascender(subSize);
  page.drawText(subtitle, {
    x: MARGIN,
    y: subBaseY,
    size: subSize,
    font: helvOblique,
    color: gray,
  });
  cursorY = subBaseY - descender(subSize) - 24;

  // === BODY: parser markdown minimale dal template ===
  const markdown = renderVerbaleMarkdown(v, template);
  const lines = markdown.split(/\n/);
  let skippedFirstH1 = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) { cursorY -= LINE_H * 0.5; continue; }
    if (line.startsWith("# ")) {
      if (!skippedFirstH1) { skippedFirstH1 = true; continue; }  // primo H1 = title già stampato
      drawHeading(line.slice(2), 1);
      continue;
    }
    if (line.startsWith("## ")) { drawHeading(line.slice(3), 2); continue; }
    if (line.startsWith("### ")) { drawHeading(line.slice(4), 3); continue; }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      // Bullet dot + body inline. Disegno entrambi sulla stessa baseline.
      ensureSpace(LINE_H);
      const baselineY = cursorY - ascender(BODY_SIZE);
      page.drawText("•", { x: MARGIN + 4, y: baselineY, size: BODY_SIZE, font: helvBold, color: cyan });
      // Drawing del testo con indent 16 (manualmente, evitando doppia decrement)
      const bulletText = stripFormatting(line.slice(2));
      const indent = 16;
      const maxW = CONTENT_W - indent;
      const wrapped = wrapWords(bulletText, helv, BODY_SIZE, maxW);
      for (let li = 0; li < wrapped.length; li++) {
        if (li > 0) { ensureSpace(LINE_H); }
        const bY = cursorY - ascender(BODY_SIZE);
        page.drawText(wrapped[li], { x: MARGIN + indent, y: bY, size: BODY_SIZE, font: helv, color: dark });
        cursorY -= LINE_H;
      }
      continue;
    }
    const italicOnly = line.match(/^\_(.+)\_$/);
    if (italicOnly) { drawText(italicOnly[1], { italic: true, color: gray }); continue; }
    // Bold-leading: gestisce le frasi che iniziano con "**Decisione:** ..."
    const boldLead = line.match(/^\*\*([^*]+)\*\*(.*)$/);
    if (boldLead) {
      ensureSpace(LINE_H);
      const lead = boldLead[1];
      const rest = boldLead[2].trim();
      const leadW = helvBold.widthOfTextAtSize(lead, BODY_SIZE);
      const baselineY = cursorY - ascender(BODY_SIZE);
      page.drawText(lead, { x: MARGIN, y: baselineY, size: BODY_SIZE, font: helvBold, color: dark });
      if (rest) {
        const restLines = wrapWords(rest, helv, BODY_SIZE, CONTENT_W - leadW - 4);
        if (restLines.length > 0) {
          page.drawText(restLines[0], { x: MARGIN + leadW + 4, y: baselineY, size: BODY_SIZE, font: helv, color: dark });
          cursorY -= LINE_H;
          for (let i = 1; i < restLines.length; i++) {
            ensureSpace(LINE_H);
            const bY = cursorY - ascender(BODY_SIZE);
            page.drawText(restLines[i], { x: MARGIN, y: bY, size: BODY_SIZE, font: helv, color: dark });
            cursorY -= LINE_H;
          }
        } else { cursorY -= LINE_H; }
      } else { cursorY -= LINE_H; }
      continue;
    }
    drawText(stripFormatting(line));
  }

  // === SIGNATURE BLOCKS (cleaner: linea + nome) ===
  const signers = v.signers.length > 0 ? v.signers : DEFAULT_SIGNERS;
  const rows = Math.ceil(signers.length / 2);
  const SIG_BLOCK_H = 30 + rows * 70;  // stima conservativa

  if (cursorY - SIG_BLOCK_H < MARGIN + 30) {
    newPage();
  } else {
    cursorY -= 24;
  }

  drawHeading("Firme", 2);
  cursorY -= 6;

  const SIG_W = (CONTENT_W - 30) / 2;
  const SIG_H = 50;          // altezza area firma (per SignWell)
  const SIG_ROW_GAP = 24;

  const signatureFields: Array<{
    recipient_index: number; page: number; x: number; y: number; width: number; height: number; name: string;
  }> = [];

  for (let i = 0; i < signers.length; i++) {
    const col = i % 2;
    const rowIdx = Math.floor(i / 2);
    if (col === 0 && rowIdx > 0) cursorY -= SIG_H + SIG_ROW_GAP + 22;
    ensureSpace(SIG_H + 36);
    const xBox = MARGIN + col * (SIG_W + 30);
    const yBoxTop = cursorY;

    // Recupera la firma dal DB (se presente per questo signer)
    const sig = signatures?.find(
      (s) => s.signerEmail.toLowerCase() === signers[i].email.toLowerCase(),
    );

    // Se firmato → disegna:
    //   - firma immagine (drawn/uploaded) se imageSignatureData presente, OPPURE
    //   - typed signature in italico sopra la linea
    if (sig?.signedAt) {
      if (sig.imageSignatureData) {
        // Embed PNG della firma (canvas drawn o file caricato)
        try {
          // data URL format: "data:image/png;base64,<base64>"
          const m = sig.imageSignatureData.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
          if (m) {
            const mime = m[1];
            const b64 = m[2];
            // Decode base64 → Uint8Array
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let bi = 0; bi < bin.length; bi++) bytes[bi] = bin.charCodeAt(bi);
            const img = mime === "png"
              ? await pdfDoc.embedPng(bytes)
              : await pdfDoc.embedJpg(bytes);
            // Scala l'immagine per stare nel box firma (max 75% larghezza, 90% altezza)
            const maxW = SIG_W * 0.75;
            const maxH = SIG_H * 0.9;
            const imgRatio = img.width / img.height;
            let w = maxW;
            let h = w / imgRatio;
            if (h > maxH) { h = maxH; w = h * imgRatio; }
            const xImg = xBox + (SIG_W - w) / 2;
            const yImg = yBoxTop - SIG_H + 4;  // 4pt sopra la linea
            page.drawImage(img, { x: xImg, y: yImg, width: w, height: h });
          }
        } catch (e) {
          console.error("[verbali] embed signature image failed, fallback to typed:", e);
          // Fallback testuale
          if (sig.typedSignature) {
            const sigSize = 18;
            const sigW = helvOblique.widthOfTextAtSize(sig.typedSignature, sigSize);
            page.drawText(sig.typedSignature, {
              x: xBox + Math.max(0, (SIG_W - sigW) / 2),
              y: yBoxTop - SIG_H + 8,
              size: sigSize, font: helvOblique, color: dark,
            });
          }
        }
      } else if (sig.typedSignature) {
        // Solo firma digitata (no immagine)
        const sigSize = 18;
        const sigW = helvOblique.widthOfTextAtSize(sig.typedSignature, sigSize);
        page.drawText(sig.typedSignature, {
          x: xBox + Math.max(0, (SIG_W - sigW) / 2),
          y: yBoxTop - SIG_H + 8,
          size: sigSize, font: helvOblique, color: dark,
        });
      }
    }

    // Linea della firma
    page.drawLine({
      start: { x: xBox, y: yBoxTop - SIG_H },
      end:   { x: xBox + SIG_W, y: yBoxTop - SIG_H },
      thickness: 0.7,
      color: sig?.signedAt ? dark : gray,
    });

    // Nome + email sotto la linea
    page.drawText(signers[i].name, {
      x: xBox, y: yBoxTop - SIG_H - 12, size: 10, font: helvBold, color: dark,
    });
    page.drawText(signers[i].email, {
      x: xBox, y: yBoxTop - SIG_H - 24, size: 8, font: helv, color: gray,
    });

    // Stato firma: data + hash IP parziale (se firmato)
    if (sig?.signedAt) {
      const dt = new Date(sig.signedAt);
      const dtStr = `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}`;
      const ipShort = sig.signerIpHash ? sig.signerIpHash.slice(0, 8) : "—";
      page.drawText(`Firmato il ${dtStr} · IP ${ipShort}`, {
        x: xBox, y: yBoxTop - SIG_H - 34, size: 7, font: helv, color: cyan,
      });
    } else {
      page.drawText("In attesa di firma", {
        x: xBox, y: yBoxTop - SIG_H - 34, size: 7, font: helvOblique, color: gray,
      });
    }

    // Campo SignWell (coordinata bottom-left) — manteniamo per back-compat
    // anche se ora il flusso è interno
    signatureFields.push({
      recipient_index: i,
      page: pageIndex,
      x: xBox,
      y: yBoxTop - SIG_H,
      width: SIG_W,
      height: SIG_H,
      name: signers[i].name,
    });
  }

  // Sposta il cursore sotto l'ultima riga di firme: i box firma partono da
  // yBoxTop e il contenuto (linea + nome + email + stato) scende fino a
  // ~yBoxTop - SIG_H - 34. Senza questo, le sezioni successive (Allegati)
  // si sovrappongono ai box firma.
  cursorY -= SIG_H + 44;

  // === ALLEGATI: lista (sotto le firme, prima della pagina audit) ===
  if (attachments && attachments.length > 0) {
    // Spazio + heading
    cursorY -= 28;
    ensureSpace(LINE_H * 3);
    drawHeading("Allegati", 2);
    cursorY -= 4;
    function fmtBytes(n: number | null): string {
      if (n == null) return "—";
      if (n < 1024) return `${n} B`;
      if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
      return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    }
    for (let ai = 0; ai < attachments.length; ai++) {
      const a = attachments[ai];
      ensureSpace(LINE_H + 4);
      // Pallino ciano
      const baselineY = cursorY - ascender(BODY_SIZE);
      page.drawText("•", { x: MARGIN + 4, y: baselineY, size: BODY_SIZE, font: helvBold, color: cyan });
      // Nome file in bold + dettagli in regular accanto
      page.drawText(a.filename, {
        x: MARGIN + 16, y: baselineY, size: BODY_SIZE, font: helvBold, color: dark,
      });
      cursorY -= LINE_H;
      // Riga sotto: tipo + dimensione + note
      const metaPieces: string[] = [];
      if (a.mimeType) metaPieces.push(a.mimeType);
      if (a.sizeBytes != null) metaPieces.push(fmtBytes(a.sizeBytes));
      if (a.notes) metaPieces.push(a.notes);
      if (metaPieces.length > 0) {
        ensureSpace(LINE_H);
        const metaBaseY = cursorY - ascender(9);
        page.drawText(metaPieces.join(" · "), {
          x: MARGIN + 16, y: metaBaseY, size: 9, font: helvOblique, color: gray,
        });
        cursorY -= LINE_H * 0.9;
      }
      cursorY -= 4;
    }
    cursorY -= 6;
    // Hint
    const hint = "I file sopra elencati sono parte integrante del presente verbale e sono stati condivisi separatamente con i firmatari.";
    drawText(hint, { italic: true, color: gray, size: 9 });
  }

  // Footer ultima pagina del corpo verbale
  drawFooter();

  // === AUDIT TRAIL: pagina aggiuntiva con dettagli SES per ogni firmatario ===
  // Inseriamo questa pagina solo se ci sono signature objects (anche pending),
  // così il documento auto-documenta il processo di firma elettronica.
  if (signatures && signatures.length > 0) {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    pageIndex += 1;
    drawCompactHeader();

    // Titolo "Audit trail firma elettronica"
    cursorY -= 12;
    const auditTitleSize = 16;
    const aBaseY = cursorY - ascender(auditTitleSize);
    page.drawText("Audit trail firma elettronica", {
      x: MARGIN, y: aBaseY, size: auditTitleSize, font: helvBold, color: dark,
    });
    cursorY = aBaseY - descender(auditTitleSize) - 6;

    // Sottotitolo
    const auditSubSize = 9.5;
    const aSubBaseY = cursorY - ascender(auditSubSize);
    page.drawText(
      "Firma elettronica semplice (SES) ex art. 25 Reg. (UE) 910/2014 — NexLudica APS",
      { x: MARGIN, y: aSubBaseY, size: auditSubSize, font: helvOblique, color: gray },
    );
    cursorY = aSubBaseY - descender(auditSubSize) - 18;

    // Riga descrittiva del documento firmato
    function drawAuditRow(label: string, value: string, opts: { mono?: boolean } = {}) {
      ensureSpace(LINE_H);
      const labelW = 130;
      const labelBaseY = cursorY - ascender(9);
      page.drawText(label, {
        x: MARGIN, y: labelBaseY, size: 9, font: helvBold, color: gray,
      });
      const valFont = opts.mono ? helv : helv;
      const valSize = 9.5;
      const valBaseY = cursorY - ascender(valSize);
      const valLines = wrapWords(value, valFont, valSize, CONTENT_W - labelW);
      for (let i = 0; i < valLines.length; i++) {
        if (i > 0) { cursorY -= LINE_H; ensureSpace(LINE_H); }
        const bY = cursorY - ascender(valSize);
        page.drawText(valLines[i], {
          x: MARGIN + labelW, y: bY, size: valSize, font: valFont, color: dark,
        });
      }
      cursorY -= LINE_H;
    }

    drawAuditRow("Documento", v.title);
    drawAuditRow("Tipo", typeLabel(v.type));
    drawAuditRow("Data seduta", formatDate(v.meetingDate) + (v.meetingTime ? ` ore ${v.meetingTime}` : ""));
    cursorY -= 6;

    // Sezione per ogni firmatario
    for (let si = 0; si < signatures.length; si++) {
      const s = signatures[si];
      // Spazio + heading "Firmatario N"
      cursorY -= 8;
      ensureSpace(80);
      // Rule sottile sopra ogni firmatario
      page.drawLine({
        start: { x: MARGIN, y: cursorY },
        end:   { x: PAGE_W - MARGIN, y: cursorY },
        thickness: 0.5,
        color: lightGray,
      });
      cursorY -= 14;

      const headSize = 11;
      const headBaseY = cursorY - ascender(headSize);
      page.drawText(`Firmatario ${si + 1}`, {
        x: MARGIN, y: headBaseY, size: headSize, font: helvBold, color: cyan,
      });
      cursorY = headBaseY - descender(headSize) - 6;

      drawAuditRow("Nome", s.signerName);
      drawAuditRow("Email", s.signerEmail);

      // Trova il record completo (passiamo solo subset al renderer)
      // Le info forensiche (UA, locale, hash, method) le prendiamo dal subset
      // espandendo l'interfaccia esposta.
      const ext = s as typeof s & {
        sentAt?: number; signedAt?: number | null;
        signerUserAgent?: string | null; signerLocale?: string | null;
        signatureMethod?: string | null; status?: string;
        consentGivenAt?: number | null; documentHash?: string | null;
      };

      if (ext.signedAt) {
        const dt = new Date(ext.signedAt);
        drawAuditRow("Stato", "FIRMATO");
        drawAuditRow(
          "Data firma",
          `${String(dt.getDate()).padStart(2,"0")}/${String(dt.getMonth()+1).padStart(2,"0")}/${dt.getFullYear()} ` +
          `${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}:${String(dt.getSeconds()).padStart(2,"0")}`
        );
      } else {
        drawAuditRow("Stato", "In attesa di firma");
      }

      if (ext.signatureMethod) {
        const methodLabel = {
          typed: "Nome digitato",
          drawn: "Firma disegnata (canvas)",
          uploaded: "Immagine caricata",
        }[ext.signatureMethod] ?? ext.signatureMethod;
        drawAuditRow("Modalità", methodLabel);
      }

      if (s.typedSignature) drawAuditRow("Nome registrato", s.typedSignature);
      if (s.signerIpHash) drawAuditRow("IP hash (SHA-256)", s.signerIpHash);
      if (ext.signerUserAgent) drawAuditRow("User agent", ext.signerUserAgent);
      if (ext.signerLocale) drawAuditRow("Locale", ext.signerLocale);
      if (ext.documentHash) drawAuditRow("Hash documento", ext.documentHash);
      if (ext.consentGivenAt) {
        drawAuditRow("Consenso", "Accettato esplicitamente");
      }
    }

    // Box note legali in fondo
    cursorY -= 18;
    ensureSpace(60);
    page.drawLine({
      start: { x: MARGIN, y: cursorY },
      end:   { x: PAGE_W - MARGIN, y: cursorY },
      thickness: 0.5,
      color: lightGray,
    });
    cursorY -= 14;

    const noteText =
      "Questo audit trail attesta il processo di firma elettronica semplice eseguito tramite il sistema " +
      "NexLudica APS. Conformemente al Regolamento (UE) 910/2014 (eIDAS) art. 25, alla firma elettronica " +
      "semplice non possono essere negati gli effetti giuridici e l'ammissibilità come prova in giudizio " +
      "per il solo motivo della sua forma elettronica. La validità giuridica della firma è subordinata " +
      "alla riconducibilità della stessa al firmatario e all'integrità del documento, garantite " +
      "rispettivamente dall'audit trail sopra riportato e dall'hash SHA-256 del documento.";
    const noteSize = 8.5;
    const noteLines = wrapWords(noteText, helvOblique, noteSize, CONTENT_W);
    for (const ln of noteLines) {
      ensureSpace(LINE_H * 0.9);
      const bY = cursorY - ascender(noteSize);
      page.drawText(ln, { x: MARGIN, y: bY, size: noteSize, font: helvOblique, color: gray });
      cursorY -= LINE_H * 0.9;
    }

    drawFooter();
  }

  // Hook per accodare pagine extra (allegati, bilancio) nello stesso doc,
  // riusando font e logo gia' incorporati. Eseguito prima del save finale.
  if (opts?.extend) {
    await opts.extend({
      pdfDoc,
      regular: fontRegular,
      bold: fontBold,
      italic: fontItalic,
      logo: logoImage,
      rgb,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return { pdfBytes, signatureFields };
}

/** Rimuove markdown inline (**bold**, _italic_) per il PDF (semplificato). */
function stripFormatting(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

export function typeLabel(t: VerbaleType): string {
  switch (t) {
    case "assemblea_ordinaria": return "Assemblea Ordinaria dei Soci";
    case "assemblea_straordinaria": return "Assemblea Straordinaria dei Soci";
    case "consiglio_direttivo": return "Consiglio Direttivo";
    case "riunione_operativa": return "Riunione operativa";
  }
}
