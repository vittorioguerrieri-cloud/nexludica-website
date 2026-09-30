/**
 * Genera il PDF brandizzato MeetLudica a partire dal corpo markdown di un
 * articolo. Riproduce il template (banda ciano angolata in alto col wordmark
 * "MeetLudica", banda angolata in basso con data + relatore, titolo, sezioni).
 *
 * Font Montserrat gia' ridotti ai glifi latini (~33KB invece di ~450KB) e
 * incorporati senza subsetting: il subsetting a runtime e' l'operazione piu'
 * costosa in CPU e su Worker porta a Error 1102.
 * Riusa il pattern di embed font dei verbali (Montserrat dagli ASSETS, fallback
 * Helvetica). Consuma i blocchi di article-markdown.ts.
 */
import { parseBlocks, type Block, type InlineRun } from "./article-markdown";

export interface MeetLudicaPdfInput {
  title: string;
  speaker: string;
  /** Chi ha curato il resoconto; mostrato sotto il titolo. */
  editor?: string | null;
  meetingDate: string; // YYYY-MM-DD
  abstract: string;
  body: string; // markdown
}

/**
 * Recupera i byte di un'immagine referenziata dal markdown.
 *  - /r2/<key>  -> letta direttamente dal bucket R2 (nessuna subrequest)
 *  - /qualcosa  -> asset statico del sito
 *  - http(s)    -> fetch esterna
 */
async function loadImageBytes(env: Env, src: string): Promise<Uint8Array | null> {
  try {
    if (src.startsWith("/r2/")) {
      const obj = await env.STORAGE?.get(src.slice(4));
      if (!obj) return null;
      return new Uint8Array(await obj.arrayBuffer());
    }
    if (/^https?:\/\//i.test(src)) {
      const r = await fetch(src);
      if (!r.ok) return null;
      return new Uint8Array(await r.arrayBuffer());
    }
    if (src.startsWith("/")) {
      const r = await (env as any).ASSETS?.fetch(new Request("https://nexludica.local" + src));
      if (!r || !r.ok) return null;
      return new Uint8Array(await r.arrayBuffer());
    }
  } catch {
    return null;
  }
  return null;
}

export async function renderMeetLudicaPdf(
  env: Env,
  input: MeetLudicaPdfInput,
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  const fontkit = await import("@pdf-lib/fontkit");
  pdfDoc.registerFontkit((fontkit as any).default ?? fontkit);

  let fReg: Awaited<ReturnType<typeof pdfDoc.embedFont>>;
  let fBold: Awaited<ReturnType<typeof pdfDoc.embedFont>>;
  let fItalic: Awaited<ReturnType<typeof pdfDoc.embedFont>>;
  let fBlack: Awaited<ReturnType<typeof pdfDoc.embedFont>>;
  try {
    if (env && (env as any).ASSETS) {
      const fetchAsset = async (path: string) => {
        const r = await (env as any).ASSETS.fetch(new Request("https://nexludica.local" + path));
        if (!r.ok) throw new Error(`asset ${path} ${r.status}`);
        return r.arrayBuffer();
      };
      const [reg, bold, italic] = await Promise.all([
        fetchAsset("/fonts/Montserrat-Regular-subset.ttf"),
        fetchAsset("/fonts/Montserrat-Bold-subset.ttf"),
        fetchAsset("/fonts/Montserrat-Italic-subset.ttf"),
      ]);
      fReg = await pdfDoc.embedFont(reg, { subset: false });
      fBold = await pdfDoc.embedFont(bold, { subset: false });
      fItalic = await pdfDoc.embedFont(italic, { subset: false });
      // Montserrat Black (900) per il wordmark del logo. Fallback su Bold.
      try {
        const black = await fetchAsset("/fonts/Montserrat-Black-subset.ttf");
        fBlack = await pdfDoc.embedFont(black, { subset: false });
      } catch {
        fBlack = fBold;
      }
    } else {
      throw new Error("ASSETS non disponibile");
    }
  } catch (e) {
    console.warn("[meetludica-pdf] Montserrat embed fallito, fallback Helvetica:", e);
    fReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
    fBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    fItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    fBlack = fBold;
  }

  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN = 64;
  const CONTENT_W = PAGE_W - 2 * MARGIN;
  const TOP_SAFE = PAGE_H - 96;   // sotto la banda superiore
  const BOTTOM_SAFE = 92;          // sopra la banda inferiore

  const cyan = rgb(0.02, 0.67, 0.77);   // #05abc4
  const dark = rgb(0.106, 0.145, 0.157); // #1b2528
  const blueDark = rgb(40 / 255, 97 / 255, 129 / 255); // #286181 (nx-blue) per "Ludica"
  const gray = rgb(0.4, 0.44, 0.47);
  const white = rgb(1, 1, 1);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = TOP_SAFE;

  function drawBands() {
    // Banda superiore ciano con bordo inferiore angolato
    page.drawSvgPath("M 0 0 L 595 0 L 595 58 L 0 82 Z", {
      x: 0,
      y: PAGE_H,
      color: cyan,
    });
    // Wordmark "MeetLudica" in Montserrat Black: Meet (bianco) + Ludica (#286181)
    const wmSize = 23;
    const wmY = PAGE_H - 45;
    const meetW = fBlack.widthOfTextAtSize("Meet", wmSize);
    page.drawText("Meet", { x: MARGIN, y: wmY, size: wmSize, font: fBlack, color: white });
    page.drawText("Ludica", { x: MARGIN + meetW, y: wmY, size: wmSize, font: fBlack, color: blueDark });

    // Banda inferiore ciano con bordo superiore angolato
    page.drawSvgPath("M 0 18 L 595 0 L 595 74 L 0 74 Z", {
      x: 0,
      y: 74,
      color: cyan,
    });
    // Data + relatore allineati a destra nella banda
    const dateStr = formatDate(input.meetingDate);
    const dW = fReg.widthOfTextAtSize(dateStr, 10);
    page.drawText(dateStr, { x: PAGE_W - MARGIN - dW, y: 44, size: 10, font: fReg, color: white });
    const sW = fReg.widthOfTextAtSize(input.speaker, 10);
    page.drawText(input.speaker, { x: PAGE_W - MARGIN - sW, y: 28, size: 10, font: fReg, color: white });
  }

  function newPage() {
    page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawBands();
    y = TOP_SAFE;
  }

  function ensure(space: number) {
    if (y - space < BOTTOM_SAFE) newPage();
  }

  // Selettore font per run
  function fontFor(run: InlineRun) {
    if (run.bold) return fBold;
    if (run.italic) return fItalic;
    return fReg;
  }

  /**
   * Disegna testo con run inline (bold/italic) e word-wrap giustificato a sx.
   * Ritorna lo y finale.
   */
  function drawRuns(runs: InlineRun[], opts: { size: number; lineH: number; color: any; indent?: number; gapAfter?: number }) {
    const indent = opts.indent ?? 0;
    const maxW = CONTENT_W - indent;
    const startX = MARGIN + indent;
    const spaceW = fReg.widthOfTextAtSize(" ", opts.size);

    // 1) Espandi i run in "atomi" (parole) con flag spaceBefore basato sugli
    //    spazi REALI nel testo, non assunto tra parole. Cosi' la punteggiatura
    //    che segue un corsivo/grassetto (es. *Cellulose*.) non prende spazio.
    type Atom = { text: string; font: any; w: number; spaceBefore: boolean; color?: any };
    const atoms: Atom[] = [];
    let pendingSpace = false;
    for (const run of runs) {
      const font = fontFor(run);
      const parts = run.text.split(/(\s+)/);
      for (const part of parts) {
        if (part === "") continue;
        if (/^\s+$/.test(part)) { pendingSpace = true; continue; }
        atoms.push({
          text: part, font, w: font.widthOfTextAtSize(part, opts.size),
          spaceBefore: pendingSpace, color: run.href ? cyan : undefined,
        });
        pendingSpace = false;
      }
    }

    // 2) Layout con wrapping
    let line: Atom[] = [];
    let lineW = 0;
    const flushLine = () => {
      ensure(opts.lineH);
      let x = startX;
      for (let k = 0; k < line.length; k++) {
        if (k > 0 && line[k].spaceBefore) x += spaceW;
        page.drawText(line[k].text, { x, y, size: opts.size, font: line[k].font, color: line[k].color ?? opts.color });
        x += line[k].w;
      }
      y -= opts.lineH;
      line = [];
      lineW = 0;
    };
    for (const a of atoms) {
      const needSpace = line.length > 0 && a.spaceBefore ? spaceW : 0;
      if (line.length > 0 && lineW + needSpace + a.w > maxW) {
        flushLine();
        line.push({ ...a, spaceBefore: false });
        lineW = a.w;
      } else {
        line.push(a);
        lineW += needSpace + a.w;
      }
    }
    if (line.length > 0) flushLine();
    if (opts.gapAfter) y -= opts.gapAfter;
  }

  // === COPERTINA / TITOLO (prima pagina) ===
  drawBands();
  y = TOP_SAFE - 24;
  drawRuns([{ text: input.title, bold: true }], { size: 26, lineH: 32, color: dark, gapAfter: 6 });
  {
    const meta: InlineRun[] = [
      { text: input.speaker, bold: true },
      { text: " - " + formatDate(input.meetingDate) },
    ];
    if (input.editor) meta.push({ text: " - resoconto a cura di " + input.editor, italic: true });
    drawRuns(meta, { size: 10, lineH: 15, color: gray, gapAfter: 16 });
  }

  // Abstract come prima sezione
  ensure(28);
  page.drawText("Abstract", { x: MARGIN, y, size: 16, font: fBold, color: dark });
  y -= 24;
  drawRuns(parseInlineFromText(input.abstract), { size: 11, lineH: 17, color: gray, gapAfter: 10 });
  drawDivider();

  // === CORPO (blocchi markdown) ===
  const blocks = parseBlocks(input.body);

  // Le immagini vanno incorporate prima del loop: drawBlock e' sincrono.
  // Usiamo solo JPEG: pdf-lib li incorpora senza decodificarli (DCTDecode),
  // mentre embedPng decodifica il bitmap e su Worker rischia il limite di CPU.
  const images = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedJpg>>>();
  // Limite prudenziale sui PNG: embedPng decodifica il bitmap ed e' l'operazione
  // piu' costosa in CPU di tutta la generazione. I JPEG vengono invece
  // incorporati grezzi (DCTDecode) e non hanno bisogno di cap.
  const MAX_PNG_BYTES = 1_500_000;
  for (const b of blocks) {
    if (b.type !== "figure" || images.has(b.src)) continue;
    try {
      const isPng = /\.png($|\?)/i.test(b.src);
      const isJpg = /\.jpe?g($|\?)/i.test(b.src);
      if (!isPng && !isJpg) continue;
      const bytes = await loadImageBytes(env, b.src);
      if (!bytes) continue;
      if (isPng) {
        if (bytes.byteLength > MAX_PNG_BYTES) {
          console.warn("[meetludica-pdf] PNG troppo grande, saltato:", b.src, bytes.byteLength);
          continue;
        }
        images.set(b.src, await pdfDoc.embedPng(bytes));
      } else {
        images.set(b.src, await pdfDoc.embedJpg(bytes));
      }
    } catch (e) {
      console.error("[meetludica-pdf] immagine non incorporata:", b.src, e);
    }
  }

  for (const b of blocks) {
    drawBlock(b);
  }



  function drawDivider() {
    ensure(20);
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + CONTENT_W * 0.55, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 16;
  }

  function drawBlock(b: Block) {
    switch (b.type) {
      case "h1":
        ensure(34);
        y -= 8;
        drawRuns(b.runs, { size: 18, lineH: 23, color: dark, gapAfter: 8 });
        break;
      case "h2":
        ensure(28);
        y -= 6;
        drawRuns(b.runs, { size: 14, lineH: 19, color: dark, gapAfter: 6 });
        break;
      case "h3":
        ensure(22);
        y -= 4;
        drawRuns(b.runs, { size: 12, lineH: 16, color: dark, gapAfter: 4 });
        break;
      case "p":
        drawRuns(b.runs, { size: 11, lineH: 17, color: gray, gapAfter: 8 });
        break;
      case "quote": {
        ensure(24);
        const startY = y;
        drawRuns(b.runs, { size: 11, lineH: 17, color: dark, indent: 16, gapAfter: 8 });
        // barra ciano a sinistra del blocco citazione
        page.drawRectangle({
          x: MARGIN,
          y: y + 8,
          width: 3,
          height: startY - y - 4,
          color: cyan,
        });
        break;
      }
      case "hr":
        drawDivider();
        break;
      case "figure": {
        const img = images.get(b.src);
        if (!img) break;
        const maxW = CONTENT_W;
        const scale = maxW / img.width;
        const w = maxW;
        const h = img.height * scale;
        ensure(h + (b.caption ? 26 : 12));
        y -= 6;
        page.drawImage(img, { x: MARGIN, y: y - h, width: w, height: h });
        y -= h + 6;
        if (b.caption) {
          // Didascalia centrata, mandata a capo a mano (drawRuns e' allineato a sinistra).
          const cs = 9;
          const words = b.caption.split(/\s+/);
          const lines: string[] = [];
          let cur = "";
          for (const w2 of words) {
            const test = cur ? cur + " " + w2 : w2;
            if (fItalic.widthOfTextAtSize(test, cs) > CONTENT_W && cur) {
              lines.push(cur);
              cur = w2;
            } else {
              cur = test;
            }
          }
          if (cur) lines.push(cur);
          for (const ln of lines) {
            ensure(13);
            const lw = fItalic.widthOfTextAtSize(ln, cs);
            page.drawText(ln, {
              x: MARGIN + (CONTENT_W - lw) / 2,
              y, size: cs, font: fItalic, color: gray,
            });
            y -= 13;
          }
          y -= 6;
        } else {
          y -= 6;
        }
        break;
      }
      case "ul":
      case "ol":
        for (let idx = 0; idx < b.items.length; idx++) {
          const marker = b.type === "ol" ? `${idx + 1}.` : "•";
          ensure(17);
          page.drawText(marker, { x: MARGIN + 4, y, size: 11, font: fReg, color: cyan });
          drawRuns(b.items[idx], { size: 11, lineH: 17, color: gray, indent: 22, gapAfter: 2 });
        }
        y -= 6;
        break;
    }
  }

  return await pdfDoc.save();

  // helper locale: il PDF tratta l'abstract come testo semplice multi-paragrafo
  function parseInlineFromText(text: string): InlineRun[] {
    // L'abstract puo' contenere **bold**/*italic*: riusa il parser inline
    // tramite un blocco paragrafo unico.
    const blocks = parseBlocks(text);
    const runs: InlineRun[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const blk = blocks[i];
      if ("runs" in blk) {
        runs.push(...blk.runs);
        if (i < blocks.length - 1) runs.push({ text: "  " });
      }
    }
    return runs.length ? runs : [{ text: text }];
  }
}

function formatDate(iso: string): string {
  // YYYY-MM-DD -> DD/MM/YYYY
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
