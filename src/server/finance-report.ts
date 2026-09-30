/**
 * Genera il PDF "Report di bilancio" di NexLudica: riepilogo (saldo, entrate,
 * uscite) + tabella fondi per progetto/ambito. NON include l'elenco delle
 * singole transazioni. Riusa Montserrat + logo dagli ASSETS (fallback Helvetica).
 */

export interface FinanceReportData {
  generatedAt: number;
  periodStart: string | null; // YYYY-MM-DD
  periodEnd: string | null;
  bankBalance: number;        // saldo conto (incl. contabilizzazioni)
  available: number;          // saldo disponibile (spese carta incluse)
  pendingCard: number;        // spese carta non ancora addebitate (<= 0)
  totalIn: number;
  totalOut: number;
  txnCount: number;
  excludedCount: number;
  unattributedCount: number;
  perProject: Array<{ name: string; kind: string; in: number; out: number; net: number; count: number }>;
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: "always" }).format(n);
}
function fmtDateIso(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}
function fmtTs(ts: number): string {
  return new Date(ts).toLocaleString("it-IT", {
    timeZone: "Europe/Rome", day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Disegna il report di bilancio dentro un PDFDocument GIA' esistente, riusando
 * i font (e il logo) gia' incorporati. Serve per accodare il report a un altro
 * documento (es. verbale) senza incorporare di nuovo i font: incorporare e
 * riserializzare font Montserrat da ~450KB piu' volte sforava il limite CPU
 * del Worker ("Error 1102"). Aggiunge pagine, non tocca quelle esistenti.
 */
export async function renderFinanceReportInto(
  pdfDoc: any,
  fReg: any,
  fBold: any,
  logo: any,
  data: FinanceReportData,
): Promise<void> {
  const { rgb } = await import("pdf-lib");

  const PAGE_W = 595, PAGE_H = 842, MARGIN = 56;
  const cyan = rgb(0.02, 0.67, 0.77), dark = rgb(0.106, 0.145, 0.157);
  const gray = rgb(0.4, 0.44, 0.47), green = rgb(0.06, 0.5, 0.32), red = rgb(0.75, 0.12, 0.12);
  const lightBg = rgb(0.97, 0.98, 0.985), rule = rgb(0.85, 0.85, 0.85);

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const text = (s: string, x: number, yy: number, size: number, font: any, color: any) =>
    page.drawText(s, { x, y: yy, size, font, color });
  const textR = (s: string, xRight: number, yy: number, size: number, font: any, color: any) => {
    const w = font.widthOfTextAtSize(s, size);
    page.drawText(s, { x: xRight - w, y: yy, size, font, color });
  };
  function ensure(space: number) {
    if (y - space < MARGIN + 30) { page = pdfDoc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; }
  }

  // Header: logo + titolo
  if (logo) {
    const w = 120, h = w / (logo.width / logo.height);
    page.drawImage(logo, { x: MARGIN, y: y - h + 8, width: w, height: h });
  } else {
    text("NexLudica APS", MARGIN, y - 10, 16, fBold, dark);
  }
  y -= 56;
  text("Report di bilancio", MARGIN, y, 22, fBold, dark);
  y -= 18;
  const periodo = `Periodo: ${fmtDateIso(data.periodStart)} – ${fmtDateIso(data.periodEnd)}`;
  text(`${periodo} · generato il ${fmtTs(data.generatedAt)}`, MARGIN, y, 9, fReg, gray);
  y -= 12;
  page.drawRectangle({ x: MARGIN, y, width: PAGE_W - 2 * MARGIN, height: 2, color: cyan });
  y -= 26;

  // Riepilogo
  text("Riepilogo", MARGIN, y, 14, fBold, dark);
  y -= 20;
  const line = (label: string, value: string, color: any, bold = false) => {
    ensure(18);
    text(label, MARGIN + 4, y, 11, fReg, gray);
    textR(value, PAGE_W - MARGIN, y, 11, bold ? fBold : fReg, color);
    y -= 17;
  };
  line("Saldo conto (estratto banca)", fmtEur(data.bankBalance), dark);
  line("Spese carta da addebitare", fmtEur(data.pendingCard), data.pendingCard < 0 ? red : dark);
  // separatore leggero
  page.drawLine({ start: { x: MARGIN + 4, y: y + 6 }, end: { x: PAGE_W - MARGIN, y: y + 6 }, thickness: 0.5, color: rule });
  y -= 4;
  line("Saldo disponibile", fmtEur(data.available), data.available >= 0 ? cyan : red, true);
  y -= 8;
  line("Entrate totali", fmtEur(data.totalIn), green);
  line("Uscite totali", fmtEur(data.totalOut), red);
  line("Transazioni conteggiate", `${data.txnCount}  (${data.unattributedCount} da attribuire, ${data.excludedCount} escluse)`, dark);
  y -= 14;

  // Tabella per progetto
  ensure(40);
  text("Fondi per progetto / ambito", MARGIN, y, 14, fBold, dark);
  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rule });
  y -= 16;

  // Colonne (right edges)
  const cX = { name: MARGIN, in: 330, out: 410, net: 500, mov: PAGE_W - MARGIN };
  const headRow = () => {
    text("PROGETTO / AMBITO", cX.name, y, 8, fBold, gray);
    textR("ENTRATE", cX.in, y, 8, fBold, gray);
    textR("USCITE", cX.out, y, 8, fBold, gray);
    textR("RESIDUO", cX.net, y, 8, fBold, gray);
    textR("MOV.", cX.mov, y, 8, fBold, gray);
    y -= 14;
  };
  headRow();

  const rows = [...data.perProject];
  for (const r of rows) {
    ensure(18);
    if (y < MARGIN + 60) { /* nuova pagina: ripeti intestazione */ headRow(); }
    let name = r.name;
    const kindTag = r.kind === "ambito" ? " (ambito)" : r.kind === "iniziativa" ? " (iniziativa)" : "";
    const maxNameW = cX.in - 70 - cX.name;
    while (fReg.widthOfTextAtSize(name + kindTag, 10) > maxNameW && name.length > 4) name = name.slice(0, -2);
    text(name + kindTag, cX.name, y, 10, fReg, dark);
    textR(fmtEur(r.in), cX.in, y, 10, fReg, green);
    textR(fmtEur(r.out), cX.out, y, 10, fReg, red);
    textR(fmtEur(r.net), cX.net, y, 10, fBold, r.net >= 0 ? dark : red);
    textR(String(r.count), cX.mov, y, 10, fReg, gray);
    y -= 8;
    page.drawLine({ start: { x: MARGIN, y: y + 2 }, end: { x: PAGE_W - MARGIN, y: y + 2 }, thickness: 0.4, color: rgb(0.92, 0.92, 0.92) });
    y -= 10;
  }

  // Totali
  ensure(24);
  y -= 2;
  page.drawRectangle({ x: MARGIN, y: y - 4, width: PAGE_W - 2 * MARGIN, height: 22, color: lightBg });
  const totIn = rows.reduce((a, r) => a + r.in, 0);
  const totOut = rows.reduce((a, r) => a + r.out, 0);
  const totNet = rows.reduce((a, r) => a + r.net, 0);
  const totMov = rows.reduce((a, r) => a + r.count, 0);
  text("TOTALE", cX.name, y + 4, 10, fBold, dark);
  textR(fmtEur(totIn), cX.in, y + 4, 10, fBold, green);
  textR(fmtEur(totOut), cX.out, y + 4, 10, fBold, red);
  textR(fmtEur(totNet), cX.net, y + 4, 10, fBold, dark);
  textR(String(totMov), cX.mov, y + 4, 10, fBold, gray);
  y -= 30;

  // Footer
  text(
    "NexLudica APS · Report generato automaticamente dal sistema di bilancio · I dati riflettono l'ultimo import dell'estratto bancario.",
    MARGIN, MARGIN - 14, 8, fReg, gray,
  );
}

/**
 * Genera il PDF "Report di bilancio" come documento autonomo (endpoint report).
 * Incorpora font + logo e delega il disegno a renderFinanceReportInto.
 */
export async function renderFinanceReportPdf(env: Env, data: FinanceReportData): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.create();
  const fontkit = await import("@pdf-lib/fontkit");
  pdfDoc.registerFontkit((fontkit as any).default ?? fontkit);

  const fetchAsset = async (path: string) => {
    const r = await (env as any).ASSETS.fetch(new Request("https://nexludica.local" + path));
    if (!r.ok) throw new Error(`asset ${path} ${r.status}`);
    return r.arrayBuffer();
  };

  let fReg: any, fBold: any;
  try {
    // Font gia' ridotti ai glifi latini (~33KB): incorporamento leggero in CPU.
    const [reg, bold] = await Promise.all([
      fetchAsset("/fonts/Montserrat-Regular-subset.ttf"),
      fetchAsset("/fonts/Montserrat-Bold-subset.ttf"),
    ]);
    fReg = await pdfDoc.embedFont(reg, { subset: false });
    fBold = await pdfDoc.embedFont(bold, { subset: false });
  } catch {
    fReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
    fBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  let logo: any = null;
  try {
    logo = await pdfDoc.embedPng(await fetchAsset("/images/branding/logo-pdf.png"));
  } catch { logo = null; }

  await renderFinanceReportInto(pdfDoc, fReg, fBold, logo, data);
  return await pdfDoc.save();
}
