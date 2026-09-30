/** Helper per il catalogo miniature MyMiniFactory (pagine statiche, noindex). */
export const MMF_BASE = "/catalogo-miniature";

export function fmtSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(bytes >= 1e10 ? 0 : 1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

export const SOURCE_LABEL: Record<string, string> = {
  PURCHASE: "Acquisto",
  DOWNLOAD: "Download",
  TRIBE: "Tribe",
  USER_GROUP: "Abbonamento",
  FRONTIER: "FronTier",
};

export function r2(key?: string | null): string {
  return key ? `/r2/${key}` : "/images/branding/logo-square.svg";
}

export function baseName(p: string): string {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(i + 1) : p;
}

export function dirName(p: string): string {
  const i = p.lastIndexOf("/");
  return i >= 0 ? p.slice(0, i) : "";
}
