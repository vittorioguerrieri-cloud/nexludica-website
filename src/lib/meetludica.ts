/**
 * Dati della pagina MeetLudica.
 *
 * Calendario: gli incontri si svolgono ogni ultimo giovedì del mese alle 20:30.
 * Le date vengono generate automaticamente a build-time.
 *
 * Articoli: per ora hard-coded qui. In futuro potranno arrivare da una API
 * (Cloudflare D1 o R2) popolata dall'area soci.
 */

export interface MeetingDate {
  date: Date;
  isoDate: string;
  label: string;
}

export interface Article {
  slug: string;
  title: string;
  speaker: string;
  date: string;
  abstract: string;
  documentUrl?: string;
  videoUrl?: string;
  tags?: string[];
}

/** Restituisce l'ultimo giovedì del mese specificato. */
function lastThursdayOfMonth(year: number, month: number): Date {
  const lastDay = new Date(year, month + 1, 0);
  const dayOfWeek = lastDay.getDay();
  const offset = (dayOfWeek - 4 + 7) % 7;
  return new Date(year, month, lastDay.getDate() - offset, 20, 30);
}

/**
 * Genera i prossimi N appuntamenti MeetLudica (ultimo giovedì alle 20:30)
 * a partire da `from` (default: oggi).
 */
export function upcomingMeetings(count = 6, from: Date = new Date()): MeetingDate[] {
  const meetings: MeetingDate[] = [];
  let year = from.getFullYear();
  let month = from.getMonth();
  while (meetings.length < count) {
    const candidate = lastThursdayOfMonth(year, month);
    if (candidate >= from) {
      meetings.push({
        date: candidate,
        isoDate: candidate.toISOString(),
        label: formatItalianDate(candidate),
      });
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return meetings;
}

const MESI_IT = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];
const GIORNI_IT = [
  "domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato",
];

export function formatItalianDate(d: Date): string {
  const giorno = GIORNI_IT[d.getDay()];
  const num = d.getDate();
  const mese = MESI_IT[d.getMonth()];
  const anno = d.getFullYear();
  const ora = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${giorno} ${num} ${mese} ${anno} · ${ora}:${min}`;
}

/**
 * Archivio articoli/resoconti dei MeetLudica passati.
 * In futuro questo array sara' popolato dinamicamente dall'area soci.
 */
export const articles: Article[] = [
  // Esempio di entry pronta:
  // {
  //   slug: "tabletop-science-gioco-e-ricerca",
  //   title: "Tabletop Science: gioco e ricerca",
  //   speaker: "Dott.ssa Esempio",
  //   date: "2025-09-25",
  //   abstract: "Resoconto del primo MeetLudica dedicato al rapporto tra evidenze scientifiche e design ludico.",
  //   documentUrl: "/meetludica/articles/2025-09-tabletop-science.pdf",
  //   tags: ["ricerca", "design"],
  // },
];
