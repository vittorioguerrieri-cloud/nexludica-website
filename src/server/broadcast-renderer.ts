/**
 * Renderer markdown per i broadcast email di MeetLudica.
 *
 * Markdown supportato (classico, sintassi standard):
 *  - Titoli: `# H1`, `## H2`, `### H3`, `#### H4`
 *  - Grassetto: `**testo**`
 *  - Corsivo: `*testo*` o `_testo_`
 *  - Codice inline: `` `codice` ``
 *  - Link: `[testo](https://...)` + URL nudi
 *  - Liste non ordinate: `- item`, `* item` (anche `.item` per retro-compat)
 *  - Liste ordinate: `1. item`
 *  - Blockquote: `> testo`
 *  - Linea orizzontale: `---`
 *
 * Estensione "speaker box" (riquadro azzurro con foto + abstract):
 *
 *     :::speaker photo="https://example.com/foto.jpg"
 *     **Mario Rossi** — *Titolo del talk*
 *
 *     Abstract del talk con eventuali **grassetti**, link e bullet.
 *     :::
 *
 * Il rendering produce HTML inline-styled compatibile con i principali
 * client email (Gmail, Apple Mail, Outlook, Thunderbird). Layout a tabella
 * per il riquadro speaker, niente flexbox.
 */

const COLORS = {
  cyan: "#05abc4",
  cyanLight: "#e0f7fa",
  blue: "#286181",
  blueDeep: "#1a3d5c",
  dark: "#1b2528",
  grayDark: "#657179",
  grayLight: "#b4b4b4",
  offWhite: "#f8fafb",
};

export function renderBroadcastMarkdown(text: string): string {
  // 1) Estrai blocchi :::speaker e sostituiscili con segnaposto
  const speakerBlocks: string[] = [];
  const placeholdered = text.replace(
    /(^|\n):::speaker([^\n]*)\n([\s\S]*?)\n:::[ \t]*(?=\n|$)/g,
    (_m, prefix: string, attrs: string, content: string) => {
      const html = renderSpeakerBlock(attrs, content);
      speakerBlocks.push(html);
      return `${prefix}\n@@SPEAKER_BLOCK_${speakerBlocks.length - 1}@@\n`;
    },
  );

  // 2) Renderizza markdown
  let html = renderMarkdownBlocks(placeholdered);

  // 3) Sostituisci i segnaposto con l'HTML dei riquadri speaker.
  //    Possono finire dentro un <p>...</p> se isolati: rimuovi il wrapping.
  html = html.replace(
    /<p[^>]*>\s*@@SPEAKER_BLOCK_(\d+)@@\s*<\/p>/g,
    (_m, i) => speakerBlocks[Number(i)] ?? "",
  );
  html = html.replace(
    /@@SPEAKER_BLOCK_(\d+)@@/g,
    (_m, i) => speakerBlocks[Number(i)] ?? "",
  );
  return html;
}

// =============================================================================
// Block-level renderer
// =============================================================================

function renderMarkdownBlocks(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }

    // Segnaposto speaker → passa attraverso
    if (/^@@SPEAKER_BLOCK_\d+@@$/.test(line.trim())) {
      out.push(line.trim());
      i++;
      continue;
    }

    // HR
    if (/^(---+|\*\*\*+|___+)\s*$/.test(line)) {
      out.push(
        `<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;">`,
      );
      i++;
      continue;
    }

    // Heading
    const h = /^(#{1,4})\s+(.+?)\s*#*\s*$/.exec(line);
    if (h) {
      const level = h[1].length;
      const inner = renderInline(h[2].trim());
      out.push(renderHeading(level, inner));
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(
        `<blockquote style="border-left:3px solid ${COLORS.cyan};background:${COLORS.offWhite};margin:16px 0;padding:8px 16px;color:${COLORS.blue};font-style:italic;">${renderInline(
          buf.join(" "),
        )}</blockquote>`,
      );
      continue;
    }

    // Lista non ordinata (- / * / . retrocompat)
    if (/^([-*]|\.)\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^([-*]|\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^([-*]|\.)\s+/, ""));
        i++;
      }
      out.push(
        `<ul style="margin:8px 0 16px 24px;padding:0;color:${COLORS.dark};">${items
          .map(
            (it) =>
              `<li style="margin:4px 0;line-height:1.55;">${renderInline(it)}</li>`,
          )
          .join("")}</ul>`,
      );
      continue;
    }

    // Lista ordinata
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      out.push(
        `<ol style="margin:8px 0 16px 24px;padding:0;color:${COLORS.dark};">${items
          .map(
            (it) =>
              `<li style="margin:4px 0;line-height:1.55;">${renderInline(it)}</li>`,
          )
          .join("")}</ol>`,
      );
      continue;
    }

    // Paragrafo
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|>\s|[-*]\s|\.\s|\d+\.\s|---+|\*\*\*+|___+|@@SPEAKER_BLOCK_)/.test(
        lines[i],
      )
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push(
      `<p style="margin:8px 0;line-height:1.6;color:${COLORS.dark};">${renderInline(
        buf.join(" "),
      )}</p>`,
    );
  }
  return out.join("");
}

function renderHeading(level: number, inner: string): string {
  switch (level) {
    case 1:
      return `<h2 style="font-size:22px;font-weight:700;color:${COLORS.dark};margin:28px 0 12px;line-height:1.3;">${inner}</h2>`;
    case 2:
      return `<h3 style="font-size:18px;font-weight:700;color:${COLORS.dark};margin:24px 0 10px;line-height:1.3;">${inner}</h3>`;
    case 3:
      return `<h4 style="font-size:16px;font-weight:700;color:${COLORS.dark};margin:20px 0 8px;line-height:1.3;">${inner}</h4>`;
    default:
      return `<h5 style="font-size:13px;font-weight:700;color:${COLORS.grayDark};margin:16px 0 6px;text-transform:uppercase;letter-spacing:0.05em;">${inner}</h5>`;
  }
}

// =============================================================================
// Inline renderer
// =============================================================================

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderInline(raw: string): string {
  let s = escapeHtml(raw);
  const tokens: string[] = [];
  const push = (html: string): string => {
    tokens.push(html);
    return `@@TOK_${tokens.length - 1}@@`;
  };

  // Codice inline `code`
  s = s.replace(
    /`([^`]+)`/g,
    (_m, c: string) =>
      push(
        `<code style="background:${COLORS.offWhite};padding:2px 6px;border-radius:4px;font-family:'Courier New',monospace;font-size:13px;color:${COLORS.blueDeep};">${c}</code>`,
      ),
  );

  // Link [testo](https://...)
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, t: string, u: string) =>
      push(
        `<a href="${u}" style="color:${COLORS.cyan};text-decoration:underline;">${t}</a>`,
      ),
  );

  // URL nudi http(s)://...
  s = s.replace(/(https?:\/\/[^\s<]+?)(?=[.,;:!?'")\]]?(?:\s|$))/g, (m) =>
    push(
      `<a href="${m}" style="color:${COLORS.cyan};text-decoration:underline;">${m}</a>`,
    ),
  );

  // Email: foo@bar.com → mailto link
  s = s.replace(
    /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
    (m) =>
      push(
        `<a href="mailto:${m}" style="color:${COLORS.cyan};text-decoration:underline;">${m}</a>`,
      ),
  );

  // Bold **testo**
  s = s.replace(
    /\*\*(.+?)\*\*/g,
    `<strong style="color:${COLORS.dark};">$1</strong>`,
  );

  // Italic *testo*
  s = s.replace(
    /(^|[^*\w])\*([^*\n]+?)\*(?=[^*\w]|$)/g,
    "$1<em>$2</em>",
  );
  // Italic _testo_
  s = s.replace(
    /(^|[^_\w])_([^_\n]+?)_(?=[^_\w]|$)/g,
    "$1<em>$2</em>",
  );

  // Restore tokens
  s = s.replace(/@@TOK_(\d+)@@/g, (_m, i) => tokens[Number(i)] ?? "");
  return s;
}

// =============================================================================
// Speaker box
// =============================================================================

function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return out;
}

function safeUrl(u: string): string | null {
  if (!u) return null;
  // Solo http(s) per le foto
  if (!/^https?:\/\//i.test(u)) return null;
  return escapeHtml(u);
}

function renderSpeakerBlock(attrsRaw: string, content: string): string {
  const attrs = parseAttrs(attrsRaw);
  const photo = safeUrl(attrs.photo || attrs.foto || attrs.img || "");
  const alt = escapeHtml((attrs.name || attrs.alt || "Speaker").slice(0, 80));

  const innerHtml = renderMarkdownBlocks(content.trim());

  // Cella foto: 100x100 con fallback a placeholder se URL mancante
  const photoCell = photo
    ? `<img src="${photo}" alt="${alt}" width="100" height="100" style="display:block;width:100px;height:100px;border-radius:50%;object-fit:cover;background-color:#ffffff;border:2px solid ${COLORS.cyan};" />`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100" height="100" style="width:100px;height:100px;border-radius:50%;background-color:#ffffff;border:2px dashed ${COLORS.cyan};">
         <tr><td align="center" valign="middle" style="color:${COLORS.cyan};font-size:36px;font-weight:700;font-family:Montserrat,system-ui,sans-serif;">?</td></tr>
       </table>`;

  // Tabella per compatibilita' Outlook: niente flexbox, tutto inline
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:20px 0;background-color:${COLORS.cyanLight};border:1px solid ${COLORS.cyan};border-radius:12px;border-collapse:separate;">
  <tr>
    <td width="132" valign="top" style="padding:18px 0 18px 18px;width:132px;">
      ${photoCell}
    </td>
    <td valign="top" style="padding:14px 18px 14px 14px;color:${COLORS.dark};font-size:14px;line-height:1.55;">
      <div style="font-size:14px;color:${COLORS.dark};">${innerHtml}</div>
    </td>
  </tr>
</table>`;
}
