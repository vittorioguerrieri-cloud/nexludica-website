/**
 * Parser markdown condiviso per gli articoli MeetLudica.
 *
 * Un solo parser -> lista di blocchi strutturati, consumati da:
 *  - renderArticleHtml()  per la pagina on-site
 *  - meetludica-pdf.ts    per il PDF brandizzato (legge i blocchi direttamente)
 *
 * Markdown supportato (volutamente sobrio, stile articolo scientifico):
 *  - # / ## / ### titoli
 *  - **grassetto**, *corsivo* / _corsivo_, [testo](url) collegamenti
 *  - > citazione (blockquote)
 *  - - / * elenchi puntati, 1. elenchi numerati
 *  - ![didascalia](url)  immagine con didascalia (su riga propria)
 *  - ---  linea orizzontale
 *  - paragrafi separati da riga vuota
 */

export type InlineRun = { text: string; bold?: boolean; italic?: boolean; href?: string };

export type Block =
  | { type: "h1" | "h2" | "h3" | "p" | "quote"; runs: InlineRun[] }
  | { type: "ul" | "ol"; items: InlineRun[][] }
  | { type: "hr" }
  | { type: "figure"; src: string; caption: string };

// ---------------------------------------------------------------------------
// Inline parsing -> runs (per PDF) e -> HTML (per pagina)
// ---------------------------------------------------------------------------

/** Parsa grassetto, corsivo e collegamenti in una sequenza di run inline. */
export function parseInline(raw: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let i = 0;
  let bold = false;
  let italic = false;
  let buf = "";
  const flush = () => {
    if (buf) {
      runs.push({ text: buf, bold: bold || undefined, italic: italic || undefined });
      buf = "";
    }
  };
  while (i < raw.length) {
    // Collegamento [testo](url)
    if (raw[i] === "[") {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(raw.slice(i));
      if (m) {
        flush();
        runs.push({
          text: m[1],
          href: m[2],
          bold: bold || undefined,
          italic: italic || undefined,
        });
        i += m[0].length;
        continue;
      }
    }
    if (raw.startsWith("**", i)) {
      flush();
      bold = !bold;
      i += 2;
      continue;
    }
    // *italic* o _italic_ (singolo marcatore, non parte di **)
    if ((raw[i] === "*" && raw[i + 1] !== "*") || raw[i] === "_") {
      flush();
      italic = !italic;
      i += 1;
      continue;
    }
    buf += raw[i];
    i += 1;
  }
  flush();
  return runs;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Converte URL nudi in link, dopo l'escape HTML. */
function linkify(html: string): string {
  return html.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-nx-cyan no-underline hover:underline">$1</a>',
  );
}

function runsToHtml(runs: InlineRun[]): string {
  return runs
    .map((r) => {
      let h = r.href ? escapeHtml(r.text) : linkify(escapeHtml(r.text));
      if (r.bold) h = `<strong>${h}</strong>`;
      if (r.italic) h = `<em>${h}</em>`;
      if (r.href) {
        const ext = /^https?:\/\//i.test(r.href);
        h = `<a href="${escapeHtml(r.href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}` +
            ` class="text-nx-cyan underline decoration-nx-cyan/40 underline-offset-2 hover:decoration-nx-cyan">${h}</a>`;
      }
      return h;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Block parsing
// ---------------------------------------------------------------------------

export function parseBlocks(md: string): Block[] {
  const lines = (md ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Immagine su riga propria: ![didascalia](url)
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(trimmed);
    if (img) {
      blocks.push({ type: "figure", src: img[2], caption: img[1].trim() });
      i++;
      continue;
    }

    // HR
    if (/^(---+|\*\*\*+|___+)$/.test(trimmed)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Heading
    const h = /^(#{1,3})\s+(.+?)\s*#*$/.exec(trimmed);
    if (h) {
      const level = h[1].length;
      const type = (["h1", "h2", "h3"] as const)[level - 1];
      blocks.push({ type, runs: parseInline(h[2].trim()) });
      i++;
      continue;
    }

    // Blockquote (righe consecutive con >)
    if (/^>\s?/.test(trimmed)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", runs: parseInline(buf.join(" ")) });
      continue;
    }

    // Lista puntata
    if (/^[-*]\s+/.test(trimmed)) {
      const items: InlineRun[][] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(parseInline(lines[i].trim().replace(/^[-*]\s+/, "")));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Lista numerata
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: InlineRun[][] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(parseInline(lines[i].trim().replace(/^\d+\.\s+/, "")));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Paragrafo: righe consecutive non vuote e non speciali
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|>\s?|[-*]\s|\d+\.\s|---+|\*\*\*+|___+)/.test(lines[i].trim())
    ) {
      buf.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "p", runs: parseInline(buf.join(" ")) });
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// HTML serializer (pagina on-site). Classi Tailwind coerenti col sito.
// ---------------------------------------------------------------------------

export function renderArticleHtml(md: string): string {
  const blocks = parseBlocks(md);
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "h1":
        out.push(`<h2 class="mt-10 mb-3 text-2xl font-bold text-nx-dark">${runsToHtml(b.runs)}</h2>`);
        break;
      case "h2":
        out.push(`<h3 class="mt-8 mb-2 text-xl font-bold text-nx-dark">${runsToHtml(b.runs)}</h3>`);
        break;
      case "h3":
        out.push(`<h4 class="mt-6 mb-2 text-base font-bold text-nx-dark">${runsToHtml(b.runs)}</h4>`);
        break;
      case "p":
        out.push(`<p class="mt-3 leading-relaxed text-nx-gray-dark">${runsToHtml(b.runs)}</p>`);
        break;
      case "quote":
        out.push(
          `<blockquote class="mt-4 border-l-4 border-nx-cyan bg-nx-off-white px-5 py-3 italic text-nx-blue">${runsToHtml(b.runs)}</blockquote>`,
        );
        break;
      case "hr":
        out.push(`<hr class="my-8 border-nx-gray-light/30" />`);
        break;
      case "figure":
        out.push(
          `<figure class="my-7">` +
            `<img src="${escapeHtml(b.src)}" alt="${escapeHtml(b.caption)}" loading="lazy" ` +
            `class="w-full rounded-lg border border-nx-gray-light/30 bg-white" />` +
            (b.caption
              ? `<figcaption class="mt-2 text-center text-xs text-nx-gray-dark">${escapeHtml(b.caption)}</figcaption>`
              : "") +
          `</figure>`,
        );
        break;
      case "ul":
        out.push(
          `<ul class="mt-3 list-disc space-y-1 pl-6 text-nx-gray-dark">${b.items
            .map((it) => `<li class="leading-relaxed">${runsToHtml(it)}</li>`)
            .join("")}</ul>`,
        );
        break;
      case "ol":
        out.push(
          `<ol class="mt-3 list-decimal space-y-1 pl-6 text-nx-gray-dark">${b.items
            .map((it) => `<li class="leading-relaxed">${runsToHtml(it)}</li>`)
            .join("")}</ol>`,
        );
        break;
    }
  }
  return out.join("\n");
}
