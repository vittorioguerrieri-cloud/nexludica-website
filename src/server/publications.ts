/**
 * Gestione pubblicazioni accademiche dei profili soci.
 *
 * Schema: vedi migrations/0017_member_publications.sql
 *
 * CrossRef lookup: estrae metadati da un DOI via API pubblica
 *   https://api.crossref.org/works/<doi>
 * No auth richiesta. Aggiungiamo mailto in User-Agent per polite usage.
 */
import { now } from "./db";

export interface PublicationRow {
  id: string;
  user_id: string;
  title: string;
  authors: string | null;
  venue: string | null;
  year: number | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface PublicationView {
  id: string;
  userId: string;
  title: string;
  authors: string | null;
  venue: string | null;
  year: number | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

function toView(r: PublicationRow): PublicationView {
  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    authors: r.authors,
    venue: r.venue,
    year: r.year,
    doi: r.doi,
    url: r.url,
    abstract: r.abstract,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Pulisce un DOI rimuovendo eventuali prefissi http(s) e spazi.
 * "https://doi.org/10.1234/abc" → "10.1234/abc"
 * "doi:10.1234/abc" → "10.1234/abc"
 */
export function normalizeDoi(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = String(input).trim();
  if (!d) return null;
  d = d.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  d = d.replace(/^doi:\s*/i, "");
  d = d.replace(/\s+/g, "");
  // Format minimo: deve iniziare con "10." seguito da un prefisso e uno slash
  if (!/^10\.\d{4,9}\//.test(d)) return null;
  return d;
}

export async function listPublicationsByUser(
  db: D1Database,
  userId: string,
): Promise<PublicationView[]> {
  // Ordinamento:
  //  1. Pubblicazioni con DOI in cima (sono "ufficiali")
  //  2. Poi per anno DESC
  //  3. Poi sort_order custom
  //  4. Poi data di creazione
  const rs = await db
    .prepare(
      `SELECT * FROM member_publications
       WHERE user_id = ?
       ORDER BY (doi IS NOT NULL) DESC,
                COALESCE(year, 0) DESC,
                sort_order ASC,
                created_at DESC`,
    )
    .bind(userId)
    .all<PublicationRow>();
  return (rs.results ?? []).map(toView);
}

export interface PublicationInput {
  title: string;
  authors?: string | null;
  venue?: string | null;
  year?: number | null;
  doi?: string | null;
  url?: string | null;
  abstract?: string | null;
  sortOrder?: number;
}

function sanitize(input: PublicationInput) {
  const trim = (s: string | null | undefined, max: number) =>
    s == null ? null : (String(s).trim().slice(0, max) || null);
  let year: number | null = null;
  if (input.year != null) {
    const n = Number(input.year);
    if (Number.isFinite(n) && n > 1500 && n < 2200) year = Math.round(n);
  }
  return {
    title: trim(input.title, 500) ?? "",
    authors: trim(input.authors, 1000),
    venue: trim(input.venue, 500),
    year,
    doi: normalizeDoi(input.doi),
    url: trim(input.url, 500),
    abstract: trim(input.abstract, 4000),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 100,
  };
}

export async function addPublication(
  db: D1Database,
  userId: string,
  input: PublicationInput,
): Promise<PublicationView> {
  const id = crypto.randomUUID();
  const data = sanitize(input);
  if (!data.title) throw new Error("Il titolo e' obbligatorio");
  const ts = now();
  await db
    .prepare(
      `INSERT INTO member_publications
        (id, user_id, title, authors, venue, year, doi, url, abstract, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id, userId, data.title, data.authors, data.venue, data.year,
      data.doi, data.url, data.abstract, data.sortOrder, ts, ts,
    )
    .run();
  return {
    id, userId, title: data.title, authors: data.authors, venue: data.venue,
    year: data.year, doi: data.doi, url: data.url, abstract: data.abstract,
    sortOrder: data.sortOrder, createdAt: ts, updatedAt: ts,
  };
}

export async function updatePublication(
  db: D1Database,
  userId: string,
  id: string,
  input: PublicationInput,
): Promise<PublicationView | null> {
  const data = sanitize(input);
  if (!data.title) throw new Error("Il titolo e' obbligatorio");
  const res = await db
    .prepare(
      `UPDATE member_publications
       SET title = ?, authors = ?, venue = ?, year = ?, doi = ?, url = ?,
           abstract = ?, sort_order = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
    )
    .bind(
      data.title, data.authors, data.venue, data.year, data.doi, data.url,
      data.abstract, data.sortOrder, now(), id, userId,
    )
    .run();
  if (!res.meta || res.meta.changes === 0) return null;
  const row = await db
    .prepare("SELECT * FROM member_publications WHERE id = ?")
    .bind(id)
    .first<PublicationRow>();
  return row ? toView(row) : null;
}

export async function deletePublication(
  db: D1Database,
  userId: string,
  id: string,
): Promise<boolean> {
  const res = await db
    .prepare("DELETE FROM member_publications WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return !!res.meta && res.meta.changes > 0;
}

// ===========================================================================
// CrossRef API
// ===========================================================================

export interface CrossrefMetadata {
  doi: string;
  title: string | null;
  authors: string | null;
  venue: string | null;
  year: number | null;
  url: string | null;
  abstract: string | null;
}

/**
 * Estrae metadati da un DOI usando l'API pubblica di CrossRef.
 * Aggiunge mailto in User-Agent ("polite pool") per rate limit migliori.
 *
 * Ritorna null se il DOI non esiste o se la risposta non e' valida.
 */
export async function fetchCrossrefMetadata(
  doi: string,
  mailto = "info@nexludica.org",
): Promise<CrossrefMetadata | null> {
  const normalized = normalizeDoi(doi);
  if (!normalized) return null;
  const url = `https://api.crossref.org/works/${encodeURIComponent(normalized)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": `NexLudica/1.0 (https://nexludica.org; mailto:${mailto})`,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: Record<string, unknown> };
    const m = data?.message;
    if (!m) return null;

    // title: array di stringhe → prendiamo il primo elemento
    const titleArr = Array.isArray(m.title) ? (m.title as string[]) : null;
    const title = titleArr && titleArr.length > 0 ? String(titleArr[0]) : null;

    // authors: array di {given, family} → format "Cognome, N."
    let authors: string | null = null;
    if (Array.isArray(m.author)) {
      const arr = (m.author as Array<{ given?: string; family?: string; name?: string }>);
      const parts = arr.map((a) => {
        if (a.family) {
          const initial = a.given ? a.given.charAt(0).toUpperCase() + "." : "";
          return initial ? `${a.family}, ${initial}` : a.family;
        }
        return a.name ?? "";
      }).filter(Boolean);
      if (parts.length > 0) authors = parts.join("; ");
    }

    // venue: container-title (journal/book) → primo elemento
    const venueArr = Array.isArray(m["container-title"]) ? (m["container-title"] as string[]) : null;
    const venue = venueArr && venueArr.length > 0 ? String(venueArr[0]) : null;

    // year: published.date-parts[0][0] o issued.date-parts[0][0]
    let year: number | null = null;
    const dateSrc = (m.published ?? m.issued ?? m["published-online"] ?? m["published-print"]) as
      | { "date-parts"?: number[][] }
      | undefined;
    if (dateSrc?.["date-parts"]?.[0]?.[0]) {
      year = Number(dateSrc["date-parts"][0][0]);
      if (!Number.isFinite(year) || year < 1500 || year > 2200) year = null;
    }

    // url: CrossRef ritorna "URL" come stringa (link doi.org canonico)
    const docUrl = typeof m.URL === "string" ? (m.URL as string) : `https://doi.org/${normalized}`;

    // abstract: arriva in JATS XML (es. "<jats:p>...</jats:p>"). Lo
    // ripuliamo per renderlo testo leggibile.
    let abstract: string | null = null;
    if (typeof m.abstract === "string") {
      abstract = (m.abstract as string)
        // rimuove tag JATS (jats:p, jats:italic, jats:title, etc.)
        .replace(/<\/?jats:[a-z][^>]*>/gi, " ")
        // rimuove eventuali tag HTML rimasti
        .replace(/<\/?[a-z][^>]*>/gi, " ")
        // decodifica entita' HTML comuni
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, " ")
        // normalizza whitespace
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 4000);
      if (!abstract) abstract = null;
      // Spesso il primo "termine" e' "Abstract" — lo togliamo se ridondante
      if (abstract && /^Abstract[:\s]/i.test(abstract)) {
        abstract = abstract.replace(/^Abstract[:\s]+/i, "");
      }
    }

    return {
      doi: normalized,
      title,
      authors,
      venue,
      year,
      url: docUrl,
      abstract,
    };
  } catch (e) {
    console.error("[crossref] fetch error:", e);
    return null;
  }
}
