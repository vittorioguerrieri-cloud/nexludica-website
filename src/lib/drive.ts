/**
 * Categorie di documenti dell'associazione visibili nell'area soci.
 *
 * I link puntano a cartelle Google Drive condivise. Quando si vorra' fare
 * il listing automatico dei file, si potra' integrare con Google Drive API
 * usando un service account.
 *
 * Per ora: cartelle con accesso "chiunque con link" o ristretto al gruppo
 * Google dei soci.
 */

export interface DriveFolder {
  key: string;
  title: string;
  description: string;
  url: string | null; // null = "in arrivo"
  icon: string;
}

export const driveFolders: DriveFolder[] = [
  {
    key: "verbali",
    title: "Verbali assemblee",
    description: "Verbali di assemblea ordinaria e straordinaria, decisioni del consiglio direttivo.",
    url: null,
    icon: "▤",
  },
  {
    key: "statuto",
    title: "Statuto e atto costitutivo",
    description: "Documenti fondativi dell'associazione, modifiche statutarie e regolamenti interni.",
    url: null,
    icon: "📜",
  },
  {
    key: "bilanci",
    title: "Bilanci e rendicontazione",
    description: "Bilanci annuali, rendicontazioni progetti, documenti contabili condivisi.",
    url: null,
    icon: "₿",
  },
  {
    key: "modulistica",
    title: "Modulistica soci",
    description: "Moduli di adesione, dimissioni, autocertificazioni, deleghe.",
    url: null,
    icon: "✎",
  },
  {
    key: "comunicazione",
    title: "Materiali di comunicazione",
    description: "Loghi, brand book, template grafici, presentazioni istituzionali.",
    url: null,
    icon: "♦",
  },
  {
    key: "progetti",
    title: "Documentazione progetti",
    description: "Materiali interni dei progetti attivi (Wanderer's Quest, Giochi al Pesto, MeetLudica).",
    url: null,
    icon: "▴",
  },
];
