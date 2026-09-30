/**
 * Sistema di bilancio NexLudica.
 *
 *  - Import dell'export bancario (.zip con 2 CSV: movimenti conto + carta).
 *  - Dedup per re-import idempotente (conteggio surplus per chiave).
 *  - Le righe "Contabilizzazione carta" sul conto vengono marcate `excluded`
 *    per non contare due volte la spesa (il dettaglio è nel CSV carta).
 *  - Progetti/ambiti a cui attribuire ogni transazione.
 *  - Aggregazioni per dashboard (saldo, entrate/uscite, residui per progetto).
 */
import { uuid, now } from "./db";

// ===========================================================================
// CSV PARSING
// ===========================================================================

/** Parser CSV RFC4180-ish: gestisce campi tra virgolette e virgole interne. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  let i = 0;
  // Rimuovi BOM iniziale
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function toIso(d: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((d ?? "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/** Converte un importo testuale in numero. Gestisce formati con . o , decimale. */
function num(s: string | undefined): number | null {
  if (s == null) return null;
  let t = String(s).trim();
  if (!t) return null;
  if (t.includes(".") && t.includes(",")) {
    // 1.234,56 → formato italiano: . migliaia, , decimale
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (t.includes(",") && !t.includes(".")) {
    t = t.replace(",", ".");
  }
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

export interface ParsedTxn {
  source: "conto" | "carta";
  opDate: string;        // YYYY-MM-DD
  valueDate: string | null;
  description: string;
  counterparty: string;
  method: string;
  amount: number;        // con segno
  currency: string;
  mcc: string | null;
  cardAlias: string | null;
  excluded: boolean;
  dedupKey: string;
}

function headerIndex(headers: string[], name: string): number {
  const norm = (s: string) => s.trim().toLowerCase();
  return headers.findIndex((h) => norm(h) === norm(name));
}

function baseKey(t: Omit<ParsedTxn, "dedupKey">): string {
  return [t.source, t.opDate, t.amount.toFixed(2), t.description.trim().toLowerCase(), t.counterparty.trim().toLowerCase()].join("|");
}

/** Parsifica il CSV "movimenti conto". Ritorna anche il saldo dichiarato se presente. */
export function parseAccountCsv(text: string): { txns: ParsedTxn[]; declaredBalance: number | null } {
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0) return { txns: [], declaredBalance: null };
  const h = rows[0];
  const iOp = headerIndex(h, "Data operazione");
  const iVal = headerIndex(h, "Data valuta");
  const iDesc = headerIndex(h, "Descrizione");
  const iCp = headerIndex(h, "Controparte");
  const iMet = headerIndex(h, "Metodo");
  const iDiv = headerIndex(h, "Divisa");
  const iTot = headerIndex(h, "Importo totale EUR");
  const txns: ParsedTxn[] = [];
  let declaredBalance: number | null = null;
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const desc = (row[iDesc] ?? "").trim();
    const opIso = toIso(row[iOp] ?? "");
    // Riga di saldo finale: "Saldo al gg/mm/aaaa"
    if (/^saldo al/i.test(desc)) {
      declaredBalance = num(row[iTot]);
      continue;
    }
    if (!opIso) continue; // salta righe senza data operazione
    const amount = num(row[iTot]);
    if (amount == null) continue;
    const counterparty = (row[iCp] ?? "").trim();
    const method = (row[iMet] ?? "").trim();
    // Esclusi dal conteggio i movimenti che non sono spese ne' entrate: gli
    // addebiti del saldo carta (le spese sono gia' contate una per una) e i
    // giroconti fra conto e carte aggiuntive, che compaiono su entrambi i lati.
    // Escludendo entrambi i lati il saldo calcolato non cambia.
    const excluded = /carta.*contabilizzazione|contabilizzazione.*carta|ricarica carte aggiuntive|rimborso saldo carta/i.test(desc);
    const t: Omit<ParsedTxn, "dedupKey"> = {
      source: "conto",
      opDate: opIso,
      valueDate: toIso(row[iVal] ?? ""),
      description: desc,
      counterparty,
      method,
      amount,
      currency: (row[iDiv] ?? "EUR").trim() || "EUR",
      mcc: null,
      cardAlias: null,
      excluded,
    };
    txns.push({ ...t, dedupKey: baseKey(t) });
  }
  return { txns, declaredBalance };
}

/** Parsifica il CSV "carta di credito". */
export function parseCardCsv(text: string): ParsedTxn[] {
  const rows = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length === 0) return [];
  const h = rows[0];
  const iOp = headerIndex(h, "Data operazione");
  const iVal = headerIndex(h, "Data valuta");
  const iMet = headerIndex(h, "Metodo");
  const iMcc = headerIndex(h, "MCC");
  const iAlias = headerIndex(h, "Alias carta");
  const iCp = headerIndex(h, "Controparte");
  const iDesc = headerIndex(h, "Descrizione");
  const iDiv = headerIndex(h, "Divisa");
  const iTot = headerIndex(h, "Importo totale EUR");
  const txns: ParsedTxn[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const opIso = toIso(row[iOp] ?? "");
    if (!opIso) continue;
    const amount = num(row[iTot]);
    if (amount == null) continue;
    const counterparty = (row[iCp] ?? "").trim();
    const descRaw = (row[iDesc] ?? "").trim();
    const description = descRaw || counterparty; // per la carta il merchant è in Controparte
    const t: Omit<ParsedTxn, "dedupKey"> = {
      source: "carta",
      opDate: opIso,
      valueDate: toIso(row[iVal] ?? ""),
      description,
      counterparty,
      method: (row[iMet] ?? "").trim(),
      amount,
      currency: (row[iDiv] ?? "EUR").trim() || "EUR",
      mcc: (row[iMcc] ?? "").trim() || null,
      cardAlias: (row[iAlias] ?? "").trim() || null,
      excluded: false,
    };
    txns.push({ ...t, dedupKey: baseKey(t) });
  }
  return txns;
}

// ===========================================================================
// IMPORT (zip → parse → dedup → insert)
// ===========================================================================

export interface ImportResult {
  added: number;
  skipped: number;
  addedConto: number;
  addedCarta: number;
  declaredBalance: number | null;
  computedBalance: number;
  errors: string[];
}

export async function importBankZip(db: D1Database, zipBytes: Uint8Array): Promise<ImportResult> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const errors: string[] = [];
  let files: Record<string, Uint8Array>;
  try {
    // Decomprime i soli CSV: gli allegati (foto dei giustificativi, anche
    // decine di MB) verrebbero comunque ignorati, e inflazionarli costa
    // memoria e CPU al Worker.
    files = unzipSync(zipBytes, { filter: (f) => /\.csv$/i.test(f.name) });
  } catch (e) {
    throw new Error("Impossibile leggere lo zip: " + (e instanceof Error ? e.message : String(e)));
  }

  let parsed: ParsedTxn[] = [];
  let declaredBalance: number | null = null;
  for (const [name, bytes] of Object.entries(files)) {
    if (!/\.csv$/i.test(name)) continue;
    const text = strFromU8(bytes);
    if (/movimenti|conto/i.test(name)) {
      const res = parseAccountCsv(text);
      parsed = parsed.concat(res.txns);
      if (res.declaredBalance != null) declaredBalance = res.declaredBalance;
    } else if (/carta|credito/i.test(name)) {
      parsed = parsed.concat(parseCardCsv(text));
    } else {
      // Fallback: prova a riconoscere dall'header
      const firstLine = text.split("\n")[0] ?? "";
      if (/alias carta|numero carta/i.test(firstLine)) parsed = parsed.concat(parseCardCsv(text));
      else { const res = parseAccountCsv(text); parsed = parsed.concat(res.txns); if (res.declaredBalance != null) declaredBalance = res.declaredBalance; }
    }
  }

  // Dedup "conteggio surplus": inserisce solo le occorrenze in piu' rispetto
  // a quelle gia' presenti per la stessa dedup_key.
  const byKey = new Map<string, ParsedTxn[]>();
  for (const t of parsed) {
    if (!byKey.has(t.dedupKey)) byKey.set(t.dedupKey, []);
    byKey.get(t.dedupKey)!.push(t);
  }

  let added = 0, skipped = 0, addedConto = 0, addedCarta = 0;
  const ts = now();
  for (const [key, list] of byKey) {
    const existing = await db
      .prepare("SELECT COUNT(*) as n FROM finance_transactions WHERE dedup_key = ?")
      .bind(key)
      .first<{ n: number }>();
    const have = existing?.n ?? 0;
    const toInsert = list.slice(have);
    skipped += list.length - toInsert.length;
    for (const t of toInsert) {
      await db
        .prepare(
          `INSERT INTO finance_transactions
            (id, source, op_date, value_date, description, counterparty, method,
             amount_eur, currency, mcc, card_alias, project_id, excluded, notes, dedup_key, imported_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?)`,
        )
        .bind(
          uuid(), t.source, t.opDate, t.valueDate, t.description.slice(0, 500),
          t.counterparty.slice(0, 300), t.method.slice(0, 100), t.amount,
          t.currency, t.mcc, t.cardAlias, t.excluded ? 1 : 0, key, ts,
        )
        .run();
      added++;
      if (t.source === "conto") addedConto++; else addedCarta++;
    }
  }

  const computedBalance = await computeBalance(db);
  return { added, skipped, addedConto, addedCarta, declaredBalance, computedBalance, errors };
}

async function computeBalance(db: D1Database): Promise<number> {
  const r = await db
    .prepare("SELECT COALESCE(SUM(amount_eur), 0) as bal FROM finance_transactions WHERE excluded = 0")
    .first<{ bal: number }>();
  return Math.round((r?.bal ?? 0) * 100) / 100;
}

// ===========================================================================
// PROJECTS
// ===========================================================================

export interface FinanceProject {
  id: string;
  name: string;
  kind: "progetto" | "ambito" | "iniziativa";
  color: string | null;
  notes: string | null;
  archived: boolean;
  createdAt: number;
}

function rowToProject(r: Record<string, unknown>): FinanceProject {
  return {
    id: String(r.id),
    name: String(r.name),
    kind: (r.kind as FinanceProject["kind"]) ?? "progetto",
    color: (r.color as string) ?? null,
    notes: (r.notes as string) ?? null,
    archived: Boolean(r.archived),
    createdAt: Number(r.created_at),
  };
}

export async function listProjects(db: D1Database): Promise<FinanceProject[]> {
  const rs = await db.prepare("SELECT * FROM finance_projects ORDER BY archived ASC, name ASC").all();
  return (rs.results as Record<string, unknown>[]).map(rowToProject);
}

export async function addProject(
  db: D1Database,
  input: { name: string; kind?: string; color?: string | null; notes?: string | null },
): Promise<FinanceProject> {
  const id = uuid();
  const kind = ["progetto", "ambito", "iniziativa"].includes(input.kind ?? "") ? input.kind! : "progetto";
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error("Nome obbligatorio");
  await db
    .prepare("INSERT INTO finance_projects (id, name, kind, color, notes, archived, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)")
    .bind(id, name, kind, input.color?.trim() || null, input.notes?.trim() || null, now())
    .run();
  return { id, name, kind: kind as FinanceProject["kind"], color: input.color ?? null, notes: input.notes ?? null, archived: false, createdAt: now() };
}

export async function updateProject(
  db: D1Database,
  id: string,
  fields: { name?: string; kind?: string; color?: string | null; notes?: string | null; archived?: boolean },
): Promise<boolean> {
  const sets: string[] = []; const vals: unknown[] = [];
  if (fields.name !== undefined) { sets.push("name = ?"); vals.push(fields.name.trim().slice(0, 120)); }
  if (fields.kind !== undefined && ["progetto", "ambito", "iniziativa"].includes(fields.kind)) { sets.push("kind = ?"); vals.push(fields.kind); }
  if (fields.color !== undefined) { sets.push("color = ?"); vals.push(fields.color?.trim() || null); }
  if (fields.notes !== undefined) { sets.push("notes = ?"); vals.push(fields.notes?.trim() || null); }
  if (fields.archived !== undefined) { sets.push("archived = ?"); vals.push(fields.archived ? 1 : 0); }
  if (sets.length === 0) return false;
  vals.push(id);
  const res = await db.prepare(`UPDATE finance_projects SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
  return !!res.meta && res.meta.changes > 0;
}

export async function deleteProject(db: D1Database, id: string): Promise<boolean> {
  // Le transazioni collegate tornano "non attribuite" (ON DELETE SET NULL)
  const res = await db.prepare("DELETE FROM finance_projects WHERE id = ?").bind(id).run();
  return !!res.meta && res.meta.changes > 0;
}

// ===========================================================================
// TRANSACTIONS
// ===========================================================================

export interface FinanceTxn {
  id: string;
  source: "conto" | "carta";
  opDate: string;
  valueDate: string | null;
  description: string;
  counterparty: string;
  method: string;
  amount: number;
  currency: string;
  mcc: string | null;
  cardAlias: string | null;
  projectId: string | null;
  missionId: string | null;
  category: string | null;
  excluded: boolean;
  notes: string | null;
}

function rowToTxn(r: Record<string, unknown>): FinanceTxn {
  return {
    id: String(r.id),
    source: r.source as "conto" | "carta",
    opDate: String(r.op_date),
    valueDate: (r.value_date as string) ?? null,
    description: (r.description as string) ?? "",
    counterparty: (r.counterparty as string) ?? "",
    method: (r.method as string) ?? "",
    amount: Number(r.amount_eur),
    currency: (r.currency as string) ?? "EUR",
    mcc: (r.mcc as string) ?? null,
    cardAlias: (r.card_alias as string) ?? null,
    projectId: (r.project_id as string) ?? null,
    missionId: (r.mission_id as string) ?? null,
    category: (r.category as string) ?? null,
    excluded: Boolean(r.excluded),
    notes: (r.notes as string) ?? null,
  };
}

export async function listTransactions(
  db: D1Database,
  opts: { limit?: number } = {},
): Promise<FinanceTxn[]> {
  const limit = Math.min(opts.limit ?? 1000, 5000);
  const rs = await db
    .prepare("SELECT * FROM finance_transactions ORDER BY op_date DESC, rowid DESC LIMIT ?")
    .bind(limit)
    .all();
  return (rs.results as Record<string, unknown>[]).map(rowToTxn);
}

export async function updateTransaction(
  db: D1Database,
  id: string,
  fields: { projectId?: string | null; missionId?: string | null; category?: string | null; excluded?: boolean; notes?: string | null },
): Promise<boolean> {
  const sets: string[] = []; const vals: unknown[] = [];
  if (fields.projectId !== undefined) { sets.push("project_id = ?"); vals.push(fields.projectId || null); }
  if (fields.missionId !== undefined) { sets.push("mission_id = ?"); vals.push(fields.missionId || null); }
  if (fields.category !== undefined) { sets.push("category = ?"); vals.push(fields.category?.slice(0, 40) || null); }
  if (fields.excluded !== undefined) { sets.push("excluded = ?"); vals.push(fields.excluded ? 1 : 0); }
  if (fields.notes !== undefined) { sets.push("notes = ?"); vals.push(fields.notes?.slice(0, 500) || null); }
  if (sets.length === 0) return false;
  vals.push(id);
  const res = await db.prepare(`UPDATE finance_transactions SET ${sets.join(", ")} WHERE id = ?`).bind(...vals).run();
  return !!res.meta && res.meta.changes > 0;
}

// ===========================================================================
// DASHBOARD
// ===========================================================================

export interface DashboardData {
  totalIn: number;
  totalOut: number;
  balance: number;
  txnCount: number;
  unattributedCount: number;
  perProject: Array<{ project: FinanceProject | null; in: number; out: number; net: number; count: number }>;
}

export async function getDashboard(db: D1Database): Promise<DashboardData> {
  const projects = await listProjects(db);
  const projById = new Map(projects.map((p) => [p.id, p]));

  const totals = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN amount_eur > 0 THEN amount_eur ELSE 0 END), 0) as tin,
         COALESCE(SUM(CASE WHEN amount_eur < 0 THEN amount_eur ELSE 0 END), 0) as tout,
         COUNT(*) as cnt,
         COALESCE(SUM(CASE WHEN project_id IS NULL THEN 1 ELSE 0 END), 0) as unattr
       FROM finance_transactions WHERE excluded = 0`,
    )
    .first<{ tin: number; tout: number; cnt: number; unattr: number }>();

  const perRows = await db
    .prepare(
      `SELECT project_id,
         COALESCE(SUM(CASE WHEN amount_eur > 0 THEN amount_eur ELSE 0 END), 0) as tin,
         COALESCE(SUM(CASE WHEN amount_eur < 0 THEN amount_eur ELSE 0 END), 0) as tout,
         COUNT(*) as cnt
       FROM finance_transactions WHERE excluded = 0
       GROUP BY project_id`,
    )
    .all<{ project_id: string | null; tin: number; tout: number; cnt: number }>();

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const perProject = (perRows.results ?? []).map((row) => ({
    project: row.project_id ? (projById.get(row.project_id) ?? null) : null,
    in: r2(row.tin),
    out: r2(row.tout),
    net: r2(row.tin + row.tout),
    count: row.cnt,
  }));
  // Ordina: progetti con piu' movimento prima, "non attribuito" in fondo
  perProject.sort((a, b) => {
    if (!a.project) return 1;
    if (!b.project) return -1;
    return (Math.abs(b.in) + Math.abs(b.out)) - (Math.abs(a.in) + Math.abs(a.out));
  });

  return {
    totalIn: r2(totals?.tin ?? 0),
    totalOut: r2(totals?.tout ?? 0),
    balance: r2((totals?.tin ?? 0) + (totals?.tout ?? 0)),
    txnCount: totals?.cnt ?? 0,
    unattributedCount: totals?.unattr ?? 0,
    perProject,
  };
}

/** Dati per il report PDF (riepilogo + per-progetto, senza singole transazioni). */
export async function getReportData(db: D1Database) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const dash = await getDashboard(db);
  const period = await db
    .prepare("SELECT MIN(op_date) as a, MAX(op_date) as b FROM finance_transactions WHERE excluded = 0")
    .first<{ a: string | null; b: string | null }>();
  const bank = await db
    .prepare("SELECT COALESCE(SUM(amount_eur), 0) as b FROM finance_transactions WHERE source = 'conto'")
    .first<{ b: number }>();
  const excl = await db
    .prepare("SELECT COUNT(*) as n FROM finance_transactions WHERE excluded = 1")
    .first<{ n: number }>();
  const bankBalance = r2(bank?.b ?? 0);
  const available = dash.balance;
  return {
    periodStart: period?.a ?? null,
    periodEnd: period?.b ?? null,
    bankBalance,
    available,
    pendingCard: r2(available - bankBalance),
    totalIn: dash.totalIn,
    totalOut: dash.totalOut,
    txnCount: dash.txnCount,
    excludedCount: excl?.n ?? 0,
    unattributedCount: dash.unattributedCount,
    perProject: dash.perProject.map((p) => ({
      name: p.project?.name ?? "Non attribuito",
      kind: p.project?.kind ?? "progetto",
      in: p.in,
      out: p.out,
      net: p.net,
      count: p.count,
    })),
  };
}
