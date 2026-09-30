/**
 * PDF della lettera d'incarico NexLudica (intestazione + testo adattato da GaP).
 * Se `signature` è presente, appone la firma SES del collaboratore (fase 2b).
 */
import type { IncaricoWithPerson } from "./incarichi";

const ORG = {
  name: "NexLudica APS",
  sede: "Vico Barnabiti 10, 16122 Genova",
  cf: "95252550108",
  city: "Genova",
};

const MESI = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
function dIt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!m) return iso;
  return `${Number(m[3])} ${MESI[Number(m[2]) - 1]} ${m[1]}`;
}
function eur(n: number): string {
  return n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

export interface IncaricoSignature {
  typed: string;
  image?: string | null;       // data:image/png;base64,...
  signedAt: number;
  ipHash: string | null;
}

export async function renderIncaricoPdf(
  env: Env,
  inc: IncaricoWithPerson,
  signature?: IncaricoSignature | null,
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
  let page = pdf.addPage([W, H]);
  let y = H - M;
  // Piede su ogni pagina; il salto pagina evita che il blocco firma (che da firmato
  // occupa ~90 pt) finisca sotto il piede o fuori dal foglio.
  const piede = () => page.drawText(`${ORG.name} · ${ORG.sede} · C.F. ${ORG.cf}`, { x: M, y: M - 18, size: 7.5, font: fReg, color: MUTED });
  const spazio = (serve: number) => {
    if (y - serve < M + 6) { piede(); page = pdf.addPage([W, H]); y = H - M; }
  };

  const draw = (s: string, x: number, yy: number, size: number, font: any, color: any) =>
    page.drawText(s, { x, y: yy, size, font, color });
  function wrap(text: string, x: number, maxW: number, size: number, font: any, color: any, lh: number) {
    const words = text.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        draw(line, x, y, size, font, color); y -= lh; line = w;
      } else line = test;
    }
    if (line) { draw(line, x, y, size, font, color); y -= lh; }
  }

  // Intestazione: logo + dati org
  let fondoTestata = y - 24;
  if (logo) {
    const w = 120, h = w / (logo.width / logo.height);
    page.drawImage(logo, { x: M, y: y - h + 8, width: w, height: h });
    fondoTestata = y - h + 8;
  } else {
    draw(ORG.name, M, y - 8, 16, fBold, TEXT);
  }
  draw(`${ORG.name} · ${ORG.sede} · C.F. ${ORG.cf}`, M, fondoTestata - 12, 8, fReg, MUTED);
  // Data
  draw(`${ORG.city}, ${dIt(inc.period_from)}`, W - M - 200, y - 8, 10, fReg, TEXT);
  y = fondoTestata - 12 - 30;

  // Destinatario
  draw("Alla cortese attenzione di:", M, y, 10, fReg, MUTED); y -= 15;
  draw(inc.person_name, M, y, 13, fBold, TEXT); y -= 14;
  if (inc.fiscal_code) { draw(`Codice Fiscale: ${inc.fiscal_code}`, M, y, 10, fReg, TEXT); y -= 12; }
  const addr = [inc.address, [inc.postal_code, inc.city].filter(Boolean).join(" "), inc.province].filter(Boolean).join(", ");
  if (addr) { draw(addr, M, y, 10, fReg, TEXT); y -= 12; }

  // Oggetto
  y -= 20;
  draw("Oggetto: ", M, y, 11, fBold, TEXT);
  const rientro = fBold.widthOfTextAtSize("Oggetto: ", 11);
  wrap(`Lettera di incarico — ${inc.project_label}`, M + rientro, W - 2 * M - rientro, 11, fReg, TEXT, 14);
  y -= 12;

  draw(`Gentile ${inc.person_name},`, M, y, 11, fReg, TEXT); y -= 16;
  wrap(`con la presente Le confermiamo l'incarico per la collaborazione nell'ambito di ${inc.project_label}, promosso da ${ORG.name}, secondo i termini e le condizioni di seguito riportate.`,
    M, W - 2 * M, 10.5, fReg, TEXT, 14);

  // Compenso text
  let compensoTxt: string;
  const total = inc.compenso_total ?? (inc.hourly_rate && inc.hours ? Math.round(inc.hourly_rate * inc.hours * 100) / 100 : null);
  if (inc.hourly_rate) {
    compensoTxt = `Il compenso orario lordo è fissato in ${eur(inc.hourly_rate)}/ora` +
      (total ? `, per un totale lordo massimo di ${eur(total)}` : "") +
      `. Il pagamento avverrà a mezzo bonifico bancario entro 30 giorni dalla ricezione della relativa notula con ritenuta d'acconto, previa verifica delle attività effettivamente svolte.`;
  } else if (total) {
    compensoTxt = `Il compenso lordo è fissato in ${eur(total)}. Il pagamento avverrà a mezzo bonifico bancario entro 30 giorni dalla ricezione della relativa notula con ritenuta d'acconto, previa verifica delle attività svolte.`;
  } else {
    compensoTxt = `Il compenso sarà concordato tra le parti e corrisposto a mezzo bonifico bancario dietro presentazione di notula con ritenuta d'acconto.`;
  }

  const sections: Array<{ h: string; p: string }> = [
    { h: "1. Oggetto dell'incarico", p: inc.object_description?.trim() || `La collaborazione consisterà nelle attività connesse a ${inc.project_label}, secondo quanto concordato tra le parti.` },
    { h: "2. Durata", p: `Il presente incarico avrà validità dal ${dIt(inc.period_from)} al ${dIt(inc.period_to)}.` },
  ];
  if (inc.hours) sections.push({ h: "3. Monte ore", p: `L'attività prevede un impegno massimo complessivo di ${inc.hours} ore distribuite nel periodo indicato, secondo un calendario concordato tra le parti.` });
  sections.push({ h: `${inc.hours ? 4 : 3}. Compenso`, p: compensoTxt });
  sections.push({ h: `${inc.hours ? 5 : 4}. Trattamento fiscale e previdenziale`, p: `Il presente incarico rientra nelle prestazioni di lavoro autonomo occasionale ai sensi dell'art. 2222 c.c. Sarà soggetto alla ritenuta d'acconto del 20% e, se dovuta, alla contribuzione previdenziale (Gestione Separata INPS). La marca da bollo, se dovuta, è a carico dell'associazione.` });
  sections.push({ h: `${inc.hours ? 6 : 5}. Accettazione`, p: "La presente dovrà essere restituita firmata per accettazione." });

  for (const s of sections) {
    y -= 12;
    draw(s.h, M, y, 11, fBold, TEXT); y -= 14;
    wrap(s.p, M, W - 2 * M, 10, fReg, TEXT, 13);
  }

  // Firma legale rappresentante (destra)
  spazio(70);
  y -= 28;
  draw(inc.legal_rep_role || "Il Legale Rappresentante", W - M - 220, y, 10, fReg, TEXT); y -= 14;
  draw(inc.legal_rep_name || "", W - M - 220, y, 11, fBold, TEXT); y -= 12;
  draw(ORG.name, W - M - 220, y, 9, fItalic, MUTED);

  // Per accettazione + firma SES collaboratore (con la firma occupa ~170 pt)
  spazio(185);
  y -= 46;
  draw("Per accettazione:", M, y, 10, fBold, TEXT); y -= 16;
  wrap(`Io sottoscritto/a ${inc.person_name}, accetto l'incarico nei termini sopra indicati.`, M, W - 2 * M, 10.5, fReg, TEXT, 14);
  y -= 10;
  const dataAccettazione = signature
    ? new Date(signature.signedAt).toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "long", year: "numeric" })
    : "______________________";
  draw(`Data: ${dataAccettazione}`, M, y, 10, fReg, TEXT);
  y -= 8;

  if (signature) {
    // Firma apposta
    page.drawRectangle({ x: M, y: y - 54, width: 240, height: 50, color: rgb(0.98, 0.99, 0.995), borderColor: rgb(0.85,0.85,0.85), borderWidth: 0.5 });
    if (signature.image && signature.image.startsWith("data:image")) {
      try {
        const b64 = signature.image.split(",")[1];
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const img = signature.image.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
        const iw = 150, ih = Math.min(40, iw / (img.width / img.height));
        page.drawImage(img, { x: M + 8, y: y - 48, width: iw, height: ih });
      } catch { draw(signature.typed, M + 10, y - 30, 14, fItalic, TEXT); }
    } else {
      draw(signature.typed, M + 10, y - 30, 14, fItalic, TEXT);
    }
    draw(`Firmato elettronicamente (SES, eIDAS art. 25) il ${new Date(signature.signedAt).toLocaleString("it-IT", { timeZone: "Europe/Rome" })}`, M, y - 66, 7, fReg, MUTED);
    if (signature.ipHash) draw(`Hash IP: ${signature.ipHash.slice(0, 24)}…`, M, y - 75, 7, fReg, MUTED);
  } else {
    page.drawLine({ start: { x: M, y: y - 40 }, end: { x: M + 240, y: y - 40 }, thickness: 0.7, color: rgb(0.6,0.6,0.6) });
    draw("Firma per accettazione", M, y - 52, 8, fReg, MUTED);
  }

  // Footer
  piede();
  void cyan;
  return await pdf.save();
}
