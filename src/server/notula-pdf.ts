/**
 * PDF della notula di prestazione occasionale (ritenuta d'acconto) — NexLudica.
 * Appone la marca da bollo (se fornita) in alto a destra. Firma SES del
 * percipiente se fornita. Il bollo è a carico dell'associazione.
 */
import type { PaymentNoteWithPerson } from "./payments";

const ORG = { name: "NexLudica APS", sede: "Vico Barnabiti 10, 16122 Genova", cf: "95252550108", city: "Genova" };
const MESI = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
function dIt(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${Number(m[3])} ${MESI[Number(m[2]) - 1]} ${m[1]}` : iso;
}
function eur(n: number): string {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export interface NotulaSignature { typed: string; image?: string | null; signedAt: number; ipHash: string | null; }
export interface NotulaBolloImage { bytes: ArrayBuffer | Uint8Array; mime: string; }

export async function renderNotulaPdf(
  env: Env,
  n: PaymentNoteWithPerson,
  opts: { bollo?: NotulaBolloImage | null; signature?: NotulaSignature | null } = {},
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const fontkit = await import("@pdf-lib/fontkit");
  pdf.registerFontkit((fontkit as any).default ?? fontkit);

  const fetchAsset = async (p: string) => {
    const r = await (env as any).ASSETS.fetch(new Request("https://nexludica.local" + p));
    if (!r.ok) throw new Error(`asset ${p} ${r.status}`);
    return r.arrayBuffer();
  };
  let fReg: any, fBold: any, fItalic: any;
  try {
    const [a, b, c] = await Promise.all([
      fetchAsset("/fonts/Montserrat-Regular-subset.ttf"),
      fetchAsset("/fonts/Montserrat-Bold-subset.ttf"),
      fetchAsset("/fonts/Montserrat-Italic-subset.ttf"),
    ]);
    fReg = await pdf.embedFont(a, { subset: false });
    fBold = await pdf.embedFont(b, { subset: false });
    fItalic = await pdf.embedFont(c, { subset: false });
  } catch {
    fReg = await pdf.embedFont(StandardFonts.Helvetica);
    fBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    fItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  }
  let logo: any = null;
  try { logo = await pdf.embedPng(await fetchAsset("/images/branding/logo-pdf.png")); } catch { logo = null; }

  const W = 595, H = 842, M = 64;
  const TEXT = rgb(0.106, 0.145, 0.157), MUTED = rgb(0.4, 0.44, 0.47), cyan = rgb(0.02, 0.67, 0.77);
  const page = pdf.addPage([W, H]);
  let y = H - M;
  const draw = (s: string, x: number, yy: number, size: number, font: any, color: any) => page.drawText(s, { x, y: yy, size, font, color });
  const drawR = (s: string, xr: number, yy: number, size: number, font: any, color: any) => page.drawText(s, { x: xr - font.widthOfTextAtSize(s, size), y: yy, size, font, color });
  function wrap(text: string, x: number, maxW: number, size: number, font: any, color: any, lh: number) {
    const words = text.split(/\s+/); let line = "";
    for (const w of words) { const t = line ? line + " " + w : w; if (font.widthOfTextAtSize(t, size) > maxW && line) { draw(line, x, y, size, font, color); y -= lh; line = w; } else line = t; }
    if (line) { draw(line, x, y, size, font, color); y -= lh; }
  }

  // Intestazione
  if (logo) { const w = 120, h = w / (logo.width / logo.height); page.drawImage(logo, { x: M, y: y - h + 8, width: w, height: h }); }
  else draw(ORG.name, M, y - 8, 16, fBold, TEXT);
  draw(`${ORG.name} · ${ORG.sede} · C.F. ${ORG.cf}`, M, y - 34, 8, fReg, MUTED);

  // Marca da bollo (alto a destra)
  if (opts.bollo) {
    try {
      const buf = opts.bollo.bytes instanceof Uint8Array ? opts.bollo.bytes : new Uint8Array(opts.bollo.bytes);
      const img = opts.bollo.mime.includes("png") ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
      const bw = 86, bh = Math.min(48, bw / (img.width / img.height));
      page.drawImage(img, { x: W - M - bw, y: y - bh + 6, width: bw, height: bh });
      draw("Marca da bollo assolta", W - M - bw, y - bh - 2, 6, fReg, MUTED);
    } catch { /* ignora */ }
  }
  y -= 70;

  const num = n.numero_personale ?? n.numero;
  draw(`Notula n. ${num}/${n.year}`, M, y, 15, fBold, TEXT);
  drawR(`${ORG.city}, ${dIt(n.date)}`, W - M, y, 10, fReg, TEXT);
  y -= 8;
  page.drawRectangle({ x: M, y, width: W - 2 * M, height: 1.5, color: cyan });
  y -= 22;

  // Percipiente
  const nato = [n.birth_place ? `nato/a a ${n.birth_place}` : null, n.birth_date ? `il ${dIt(n.birth_date)}` : null].filter(Boolean).join(" ");
  const resid = [n.address, [n.postal_code, n.city].filter(Boolean).join(" "), n.province].filter(Boolean).join(", ");
  wrap(`Il/La sottoscritto/a ${n.person_name}${nato ? ", " + nato : ""}${n.fiscal_code ? `, C.F. ${n.fiscal_code}` : ""}${resid ? `, residente in ${resid}` : ""},`, M, W - 2 * M, 10.5, fReg, TEXT, 14);
  y -= 4;
  wrap(`in relazione alla prestazione di lavoro autonomo occasionale resa a favore di ${ORG.name} (C.F. ${ORG.cf}), chiede la corresponsione del compenso di seguito indicato.`, M, W - 2 * M, 10.5, fReg, TEXT, 14);

  // Prestazione
  y -= 8;
  draw("Prestazione:", M, y, 10, fBold, TEXT); y -= 14;
  const periodo = n.service_period_start || n.service_period_end
    ? ` (periodo: ${dIt(n.service_period_start)}${n.service_period_end ? " – " + dIt(n.service_period_end) : ""})` : "";
  wrap(n.service_description + periodo + (n.project_code ? ` — ${n.project_code}` : ""), M, W - 2 * M, 10, fReg, TEXT, 13);

  // Tabella importi
  y -= 16;
  const rowsTbl: Array<[string, string, boolean]> = [];
  rowsTbl.push(["Compenso lordo", eur(n.amount_gross), false]);
  if (n.taxable_percentage !== 100) rowsTbl.push([`Imponibile (${n.taxable_percentage}%)`, eur(Math.round(n.amount_gross * n.taxable_percentage) / 100), false]);
  rowsTbl.push([`Ritenuta d'acconto (${n.withholding_percentage}%)`, "- " + eur(n.withholding_amount), false]);
  rowsTbl.push(["Netto a pagare", eur(n.amount_net), true]);
  const tblX = M, tblW = W - 2 * M, valR = W - M - 8;
  for (const [label, val, bold] of rowsTbl) {
    if (bold) { page.drawRectangle({ x: tblX, y: y - 4, width: tblW, height: 20, color: rgb(0.95, 0.98, 0.99) }); }
    draw(label, tblX + 8, y, 10.5, bold ? fBold : fReg, bold ? TEXT : MUTED);
    drawR(val, valR, y, 10.5, bold ? fBold : fReg, bold ? cyan : TEXT);
    y -= 20;
    page.drawLine({ start: { x: tblX, y: y + 4 }, end: { x: tblX + tblW, y: y + 4 }, thickness: 0.4, color: rgb(0.9, 0.9, 0.9) });
  }
  if (n.bollo_required) {
    y -= 4;
    draw(`Imposta di bollo di ${eur(n.bollo_amount)} assolta in modo virtuale, a carico di ${ORG.name}.`, M, y, 8.5, fItalic, MUTED);
    y -= 12;
  }

  // Dichiarazioni fiscali
  y -= 12;
  wrap("Il sottoscritto dichiara che il compenso costituisce reddito diverso ai sensi dell'art. 67, c.1, lett. l) del TUIR, derivante da attività di lavoro autonomo occasionale; non è soggetto a IVA ai sensi dell'art. 5 del D.P.R. 633/72 ed è soggetto a ritenuta d'acconto del 20% ai sensi dell'art. 25 del D.P.R. 600/73. Dichiara inoltre di non svolgere tale attività in forma abituale o professionale.", M, W - 2 * M, 9, fReg, MUTED, 12);

  // Pagamento
  y -= 8;
  draw("Modalità di pagamento: ", M, y, 10, fBold, TEXT);
  draw(n.iban ? `bonifico su IBAN ${n.iban}` : "bonifico bancario (IBAN da comunicare)", M + fBold.widthOfTextAtSize("Modalità di pagamento: ", 10), y, 10, fReg, TEXT);
  y -= 28;

  // Firma percipiente
  draw(`Data: ${dIt(n.date)}`, M, y, 10, fReg, TEXT);
  draw("Firma del percipiente", W - M - 240, y, 10, fReg, MUTED);
  y -= 6;
  if (opts.signature) {
    page.drawRectangle({ x: W - M - 240, y: y - 50, width: 240, height: 46, color: rgb(0.98, 0.99, 0.995), borderColor: rgb(0.85,0.85,0.85), borderWidth: 0.5 });
    if (opts.signature.image && opts.signature.image.startsWith("data:image")) {
      try {
        const b64 = opts.signature.image.split(",")[1];
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const img = opts.signature.image.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        const iw = 150, ih = Math.min(38, iw / (img.width / img.height));
        page.drawImage(img, { x: W - M - 234, y: y - 46, width: iw, height: ih });
      } catch { draw(opts.signature.typed, W - M - 230, y - 28, 13, fItalic, TEXT); }
    } else draw(opts.signature.typed, W - M - 230, y - 28, 13, fItalic, TEXT);
    draw(`Firma SES (eIDAS art. 25) ${new Date(opts.signature.signedAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}`, M, y - 56, 7, fReg, MUTED);
    if (opts.signature.ipHash) draw(`Hash IP: ${opts.signature.ipHash.slice(0, 24)}…`, M, y - 65, 7, fReg, MUTED);
  } else {
    page.drawLine({ start: { x: W - M - 240, y: y - 40 }, end: { x: W - M, y: y - 40 }, thickness: 0.7, color: rgb(0.6,0.6,0.6) });
  }

  draw(`${ORG.name} · ${ORG.sede} · C.F. ${ORG.cf}`, M, M - 18, 7.5, fReg, MUTED);
  return await pdf.save();
}

/** Ricevuta di pagamento di una notula saldata. */
export async function renderRicevutaPdf(
  env: Env,
  n: PaymentNoteWithPerson,
  opts: { legalRepName?: string | null } = {},
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const fontkit = await import("@pdf-lib/fontkit");
  pdf.registerFontkit((fontkit as any).default ?? fontkit);
  const fetchAsset = async (p: string) => {
    const r = await (env as any).ASSETS.fetch(new Request("https://nexludica.local" + p));
    if (!r.ok) throw new Error(`asset ${p} ${r.status}`);
    return r.arrayBuffer();
  };
  let fReg: any, fBold: any, fItalic: any;
  try {
    const [a, b, c] = await Promise.all([
      fetchAsset("/fonts/Montserrat-Regular-subset.ttf"), fetchAsset("/fonts/Montserrat-Bold-subset.ttf"), fetchAsset("/fonts/Montserrat-Italic-subset.ttf"),
    ]);
    fReg = await pdf.embedFont(a, { subset: false }); fBold = await pdf.embedFont(b, { subset: false }); fItalic = await pdf.embedFont(c, { subset: false });
  } catch {
    fReg = await pdf.embedFont(StandardFonts.Helvetica); fBold = await pdf.embedFont(StandardFonts.HelveticaBold); fItalic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  }
  let logo: any = null;
  try { logo = await pdf.embedPng(await fetchAsset("/images/branding/logo-pdf.png")); } catch { logo = null; }

  const W = 595, H = 842, M = 64, TEXT = rgb(0.106, 0.145, 0.157), MUTED = rgb(0.4, 0.44, 0.47), cyan = rgb(0.02, 0.67, 0.77);
  const page = pdf.addPage([W, H]);
  let y = H - M;
  const draw = (s: string, x: number, yy: number, size: number, font: any, color: any) => page.drawText(s, { x, y: yy, size, font, color });
  function wrap(text: string, x: number, maxW: number, size: number, font: any, color: any, lh: number) {
    const words = text.split(/\s+/); let line = "";
    for (const w of words) { const t = line ? line + " " + w : w; if (font.widthOfTextAtSize(t, size) > maxW && line) { draw(line, x, y, size, font, color); y -= lh; line = w; } else line = t; }
    if (line) { draw(line, x, y, size, font, color); y -= lh; }
  }
  if (logo) { const w = 120, h = w / (logo.width / logo.height); page.drawImage(logo, { x: M, y: y - h + 8, width: w, height: h }); }
  else draw(ORG.name, M, y - 8, 16, fBold, TEXT);
  draw(`${ORG.name} · ${ORG.sede} · C.F. ${ORG.cf}`, M, y - 34, 8, fReg, MUTED);
  y -= 70;

  const num = n.numero_personale ?? n.numero;
  draw("Ricevuta di pagamento", M, y, 18, fBold, TEXT); y -= 8;
  page.drawRectangle({ x: M, y, width: W - 2 * M, height: 1.5, color: cyan }); y -= 24;
  draw(`Riferimento: Notula n. ${num}/${n.year} del ${dIt(n.date)}`, M, y, 10.5, fReg, TEXT); y -= 22;

  const resid = [n.address, [n.postal_code, n.city].filter(Boolean).join(" "), n.province].filter(Boolean).join(", ");
  const paidDate = n.paid_person_at ? new Date(n.paid_person_at).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" }) : "—";
  wrap(`${ORG.name} (C.F. ${ORG.cf}) attesta di aver corrisposto a ${n.person_name}${n.fiscal_code ? `, C.F. ${n.fiscal_code}` : ""}${resid ? `, residente in ${resid}` : ""}, la somma netta di ${eur(n.amount_net)} in data ${paidDate}, a mezzo bonifico bancario${n.iban ? ` (IBAN ${n.iban})` : ""}, a saldo della notula sopra indicata relativa a: ${n.service_description}.`, M, W - 2 * M, 10.5, fReg, TEXT, 15);
  y -= 6;
  wrap(`La ritenuta d'acconto di ${eur(n.withholding_amount)} (20%) è stata operata e versata all'Erario tramite modello F24${n.f24_paid_at ? ` in data ${new Date(n.f24_paid_at).toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })}` : ""}. L'imposta di bollo, ove dovuta, è a carico dell'associazione.`, M, W - 2 * M, 10.5, fReg, TEXT, 15);

  // Box riepilogo importi
  y -= 16;
  const box = (label: string, val: string) => {
    draw(label, M + 8, y, 10, fReg, MUTED);
    draw(val, W - M - 8 - fReg.widthOfTextAtSize(val, 10), y, 10, fBold, TEXT); y -= 18;
  };
  page.drawRectangle({ x: M, y: y - 56, width: W - 2 * M, height: 70, color: rgb(0.97, 0.98, 0.985) });
  y -= 4;
  box("Compenso lordo", eur(n.amount_gross));
  box("Ritenuta d'acconto (20%)", eur(n.withholding_amount));
  draw("Netto corrisposto", M + 8, y, 10.5, fBold, TEXT);
  draw(eur(n.amount_net), W - M - 8 - fBold.widthOfTextAtSize(eur(n.amount_net), 10.5), y, 10.5, fBold, cyan); y -= 30;

  // Firma org
  y -= 30;
  draw("Il Legale Rappresentante", W - M - 220, y, 10, fReg, TEXT); y -= 14;
  draw(opts.legalRepName || "", W - M - 220, y, 11, fBold, TEXT); y -= 12;
  draw(ORG.name, W - M - 220, y, 9, fItalic, MUTED);

  draw(`${ORG.name} · ${ORG.sede} · C.F. ${ORG.cf}`, M, M - 18, 7.5, fReg, MUTED);
  return await pdf.save();
}
