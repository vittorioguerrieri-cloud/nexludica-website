/**
 * Export del report di una sessione in vari formati.
 *
 * GET /api/playtest/sessions/:id/report-export?format=md      → markdown
 * POST /api/playtest/sessions/:id/report-export?target=drive  → upload su Drive
 *      del gioco
 *
 * Il contenuto è generato server-side aggregando tutti i dati della sessione
 * (turni, fasi, checklist, OMNI, sempre sottocchio, report data).
 */
import type { APIRoute } from "astro";
import { getDb, getEnv } from "../../../../../server/db";
import { loadUserFromContext } from "../../../../../server/auth";
import {
  getSession, getGameById, listPlayers, listTurns, listPhaseTimes,
  listChecklistInstances, listChecklistItems, listChecklistResponses,
  listObservations, listOmniComments, listSessionCollaborators,
  mergeTurns, updateGame,
  type Player, type Turn,
} from "../../../../../server/playtest";
import { ensureFolder, uploadFile } from "../../../../../server/drive";

export const prerender = false;

function fmtSec(s: number): string {
  const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
function dateStr(d?: string | null): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("it-IT"); } catch { return d; }
}

async function buildMarkdown(db: D1Database, sessionId: string): Promise<{ md: string; filename: string } | null> {
  const session = await getSession(db, sessionId);
  if (!session) return null;
  const game = await getGameById(db, session.gameId);
  if (!game) return null;

  const players = await listPlayers(db, session.id);
  const turns = await listTurns(db, session.id);
  const phaseTimes = await listPhaseTimes(db, session.id);
  const instances = await listChecklistInstances(db, session.id);
  const obsItems = await listChecklistItems(db, "observation", game.id);
  const observations = await listObservations(db, session.id);
  const omniComments = await listOmniComments(db, session.id);
  const collaborators = await listSessionCollaborators(db, session.id);
  const mergedTurns = mergeTurns(turns);
  const hasMultiUserData = mergedTurns.some((m) => m.recordersCount > 1) || collaborators.length > 1;

  const teams = session.teamsOverride && session.teamsOverride.length > 0
    ? session.teamsOverride
    : (game.procedureConfig.teams ?? []);
  const isTeamGame = !!game.procedureConfig.is_team_game;
  const report = session.reportData ?? { criticita: [], cose_poco_chiare: [], narrative_summary: "" };

  // === KPI (su turni MERGED — niente double-counting multi-osservatore) ===
  const totalSec = mergedTurns.reduce((a, m) => a + m.avgDurationSeconds, 0);
  const totalMinutes = totalSec / 60;
  const phaseTotalMin = phaseTimes.reduce((a, p) => a + p.minutes, 0);
  const grandTotalMin = totalMinutes + phaseTotalMin;
  const avgTurnSec = mergedTurns.length > 0 ? totalSec / mergedTurns.length : 0;

  // === Player aggregates ===
  function playerAgg(p: Player) {
    const my = mergedTurns.filter((m) => m.playerId === p.id);
    const playSec = my.reduce((a, m) => a + m.avgDurationSeconds, 0);
    const downtimeSec = totalSec - playSec;
    const points = my.reduce((a, m) => a + (Number(m.avgPoints1) || 0), 0);
    return { p, playSec, downtimeSec, points, turns: my.length };
  }
  const playerStats = players.map(playerAgg).sort((a, b) => b.points - a.points);

  function teamTotal(idx: number): number {
    return mergedTurns.reduce((acc, m) => {
      if (m.avgTeamPoints && m.avgTeamPoints.length > idx) return acc + (Number(m.avgTeamPoints[idx]) || 0);
      if (teams.length === 2) return acc + (idx === 0 ? Number(m.avgPoints1) || 0 : Number(m.avgPoints2) || 0);
      return acc;
    }, 0);
  }
  const teamStats = teams.map((t, i) => ({ team: t, total: teamTotal(i), players: players.filter((p) => p.teamIndex === i) }));

  // === Checklist aggregates ===
  const allResponses: { instance: typeof instances[number]; itemId: string; score: number | null; comment: string | null }[] = [];
  for (const inst of instances) {
    const rs = await listChecklistResponses(db, inst.id);
    for (const r of rs) allResponses.push({ instance: inst, itemId: r.itemId, score: r.score, comment: r.comment });
  }
  const itemAvgs: Record<string, { item: typeof obsItems[number]; n: number; sum: number; comments: { phase: string; text: string }[] }> = {};
  for (const it of obsItems) itemAvgs[it.id] = { item: it, n: 0, sum: 0, comments: [] };
  for (const r of allResponses) {
    if (r.instance.phase === "setup") continue;
    if (itemAvgs[r.itemId]) {
      if (r.score != null) { itemAvgs[r.itemId].n += 1; itemAvgs[r.itemId].sum += r.score; }
      if (r.comment) itemAvgs[r.itemId].comments.push({ phase: r.instance.phase, text: r.comment });
    }
  }
  const itemAvgList = Object.values(itemAvgs).filter((x) => x.n > 0 || x.comments.length > 0).sort((a, b) => a.item.position - b.item.position);
  const byCatAvg: Record<string, number[]> = {};
  for (const x of itemAvgList) {
    if (x.n > 0) {
      byCatAvg[x.item.category] = byCatAvg[x.item.category] || [];
      byCatAvg[x.item.category].push(x.sum / x.n);
    }
  }
  const categoryAvgs = Object.entries(byCatAvg).map(([cat, vals]) => ({ cat, avg: vals.reduce((a, b) => a + b, 0) / vals.length }));

  // === Grouping ===
  const omniByCat: Record<string, typeof omniComments> = { ottimo: [], modificare: [], non_chiaro: [], idee_nuove: [] };
  for (const o of omniComments) omniByCat[o.category]?.push(o);
  const obsByCat: Record<string, typeof observations> = { variabili_visibili: [], variabili_invisibili: [], equita: [], lamentele: [] };
  for (const o of observations) obsByCat[o.category]?.push(o);
  const mergedByRound = new Map<number, typeof mergedTurns>();
  for (const m of mergedTurns) {
    if (!mergedByRound.has(m.round)) mergedByRound.set(m.round, []);
    mergedByRound.get(m.round)!.push(m);
  }

  // === MARKDOWN BUILD ===
  const lines: string[] = [];
  const omniLabels: Record<string, string> = { ottimo: "Ottimo", modificare: "Modificare", non_chiaro: "Non chiaro", idee_nuove: "Idee nuove" };
  const obsLabels: Record<string, string> = { variabili_visibili: "Variabili visibili", variabili_invisibili: "Variabili invisibili", equita: "Equità", lamentele: "Lamentele" };

  lines.push(`# Report sessione — ${session.label}`);
  lines.push("");
  lines.push(`**Gioco:** ${game.name}`);
  if (session.playedAt) lines.push(`**Data:** ${dateStr(session.playedAt)}`);
  if (session.location) lines.push(`**Luogo:** ${session.location}`);
  lines.push(`**Stato:** ${session.status}`);
  lines.push(`**Giocatori:** ${players.length}`);
  if (collaborators.length > 0) {
    lines.push(`**${collaborators.length > 1 ? "Osservatori" : "Osservatore"}:** ${collaborators.map((c) => c.name).join(", ")}`);
  }
  if (hasMultiUserData) {
    lines.push("");
    lines.push("> ℹ️ *Dati multi-osservatore unificati: i tempi e i punteggi di turni cronometrati indipendentemente da più osservatori sono mediati.*");
  }
  lines.push("");

  // KPI
  lines.push("## Metriche chiave");
  lines.push("");
  lines.push("| Metrica | Valore |");
  lines.push("|---|---|");
  lines.push(`| Tempo turni | ${totalMinutes.toFixed(1)} min |`);
  lines.push(`| Tempo totale (incl. set-up) | ${grandTotalMin.toFixed(1)} min |`);
  lines.push(`| Turni totali | ${turns.length} (media ${fmtSec(avgTurnSec)}) |`);
  if (session.flowScore != null) lines.push(`| Flow score | ${session.flowScore.toFixed(2)} |`);
  if (session.gradimentoMean != null) lines.push(`| Gradimento (media) | ${session.gradimentoMean.toFixed(2)}${session.gradimentoSd != null ? ` ± ${session.gradimentoSd.toFixed(2)}` : ""} |`);
  lines.push("");

  // Sintesi
  if (report.narrative_summary) {
    lines.push("## Sintesi narrativa");
    lines.push("");
    lines.push(report.narrative_summary);
    lines.push("");
  }

  // Criticità
  if (report.criticita && report.criticita.length > 0) {
    lines.push("## Criticità → Soluzioni proposte");
    lines.push("");
    lines.push("| Problema | Soluzione |");
    lines.push("|---|---|");
    for (const e of report.criticita) lines.push(`| ${(e.problema || "").replace(/\|/g, "\\|")} | ${(e.soluzione || "—").replace(/\|/g, "\\|")} |`);
    lines.push("");
  }

  // Cose poco chiare
  if (report.cose_poco_chiare && report.cose_poco_chiare.length > 0) {
    lines.push("## Cose poco chiare → Soluzioni proposte");
    lines.push("");
    lines.push("| Questione | Soluzione |");
    lines.push("|---|---|");
    for (const e of report.cose_poco_chiare) lines.push(`| ${(e.problema || "").replace(/\|/g, "\\|")} | ${(e.soluzione || "—").replace(/\|/g, "\\|")} |`);
    lines.push("");
  }

  // Squadre o Giocatori
  if (isTeamGame && teamStats.length > 0) {
    lines.push("## Punteggio squadre");
    lines.push("");
    lines.push("| Squadra | Punti | Giocatori |");
    lines.push("|---|---|---|");
    for (const ts of teamStats) lines.push(`| ${ts.team.name} | ${ts.total} | ${ts.players.map((p) => p.displayName).join(", ") || "—"} |`);
    lines.push("");
  } else if (playerStats.length > 0) {
    lines.push("## Classifica giocatori");
    lines.push("");
    lines.push("| # | Giocatore | Punti | Turni | Tempo giocato | Downtime |");
    lines.push("|---|---|---|---|---|---|");
    playerStats.forEach((s, i) => {
      const name = s.p.displayName + (s.p.role ? ` (${s.p.role})` : "");
      lines.push(`| ${i + 1} | ${name} | ${s.points} | ${s.turns} | ${fmtSec(s.playSec)} | ${fmtSec(s.downtimeSec)} |`);
    });
    lines.push("");
  }

  // Checklist medie
  if (categoryAvgs.length > 0) {
    lines.push("## Checklist osservativa — medie");
    lines.push("");
    lines.push("| Categoria | Media (0-10) |");
    lines.push("|---|---|");
    for (const c of categoryAvgs) lines.push(`| ${c.cat} | ${c.avg.toFixed(1)} |`);
    lines.push("");
    lines.push("### Dettaglio per item");
    lines.push("");
    lines.push("| Categoria | Item | Media | Commenti |");
    lines.push("|---|---|---|---|");
    for (const x of itemAvgList) {
      const cat = x.item.category + (x.item.subcategory ? ` · ${x.item.subcategory}` : "");
      const avg = x.n > 0 ? (x.sum / x.n).toFixed(1) : "—";
      const cmts = x.comments.map((c) => `[${c.phase}] ${c.text}`).join(" — ") || "—";
      lines.push(`| ${cat} | ${x.item.text.replace(/\|/g, "\\|")} | ${avg} | ${cmts.replace(/\|/g, "\\|")} |`);
    }
    lines.push("");
  }

  // OMNI
  if (omniComments.length > 0) {
    lines.push("## Tavola OMNI");
    lines.push("");
    for (const cat of ["ottimo", "modificare", "non_chiaro", "idee_nuove"] as const) {
      if (omniByCat[cat].length === 0) continue;
      lines.push(`### ${omniLabels[cat]}`);
      lines.push("");
      for (const o of omniByCat[cat]) {
        lines.push(`- ${o.text}${o.authorName ? ` *(— ${o.authorName})*` : ""}`);
      }
      lines.push("");
    }
  }

  // Sempre sottocchio
  if (observations.length > 0) {
    lines.push("## Sempre sottocchio");
    lines.push("");
    for (const cat of ["variabili_visibili", "variabili_invisibili", "equita", "lamentele"] as const) {
      if (obsByCat[cat].length === 0) continue;
      lines.push(`### ${obsLabels[cat]}`);
      lines.push("");
      for (const o of obsByCat[cat]) lines.push(`- ${o.text}`);
      lines.push("");
    }
  }

  // Fasi speciali
  if (phaseTimes.length > 0) {
    lines.push("## Fasi speciali");
    lines.push("");
    for (const p of phaseTimes) lines.push(`- **${p.name}**: ${p.minutes} min`);
    lines.push("");
  }

  // Storico turni (merged)
  if (mergedTurns.length > 0) {
    lines.push("## Storico turni (consenso multi-osservatore)");
    lines.push("");
    for (const [round, list] of mergedByRound) {
      lines.push(`### Round ${round}`);
      lines.push("");
      lines.push("| Giocatore | Durata (media) | Punti (media) | Evento | Osserv. |");
      lines.push("|---|---|---|---|---|");
      for (const m of list) {
        const p = players.find((pp) => pp.id === m.playerId);
        let pts = "";
        if (isTeamGame && m.avgTeamPoints) {
          pts = m.avgTeamPoints.map((v, i) => `${teams[i]?.name ?? "S" + (i + 1)}:${v.toFixed(1)}`).join(" · ");
        } else if (m.avgPoints1 != null || m.avgPoints2 != null) {
          const d = m.recordersCount > 1 ? 1 : 0;
          pts = `${(m.avgPoints1 ?? 0).toFixed(d)}${m.avgPoints2 != null ? " / " + (m.avgPoints2 ?? 0).toFixed(d) : ""}`;
        }
        lines.push(`| ${p?.displayName ?? "?"} | ${fmtSec(m.avgDurationSeconds)} | ${pts || "—"} | ${m.events.join("; ").replace(/\|/g, "\\|")} | ${m.recordersCount}× |`);
      }
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push(`*Report generato il ${new Date().toLocaleString("it-IT")} · NexLudica APS · playtest.nexludica.org*`);

  const md = lines.join("\n");
  const safeLabel = session.label.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "");
  const filename = `Report_${game.slug}_${safeLabel}.md`;
  return { md, filename };
}

export const GET: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);
  const built = await buildMarkdown(db, ctx.params.id as string);
  if (!built) return j({ ok: false, error: "not found" }, 404);
  return new Response(built.md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${built.filename}"`,
    },
  });
};

export const POST: APIRoute = async (ctx) => {
  const env = (await getEnv()) as Env;
  const db = getDb(env);
  if (!db) return j({ ok: false, error: "backend" }, 503);
  const user = await loadUserFromContext(ctx);
  if (!user) return j({ ok: false, error: "unauthorized" }, 401);

  const target = ctx.url.searchParams.get("target") ?? "drive";
  if (target !== "drive") return j({ ok: false, error: "target non supportato" }, 400);

  const root = env.DRIVE_ROOT_FOLDER_ID;
  if (!root) return j({ ok: false, error: "drive non configurato" }, 503);

  const built = await buildMarkdown(db, ctx.params.id as string);
  if (!built) return j({ ok: false, error: "not found" }, 404);

  const session = await getSession(db, ctx.params.id as string);
  if (!session) return j({ ok: false, error: "not found" }, 404);
  const game = await getGameById(db, session.gameId);
  if (!game) return j({ ok: false, error: "game not found" }, 404);

  // Folder del gioco (lazy)
  let folderId = game.driveFolderId;
  if (!folderId) {
    const folder = await ensureFolder(env, root, `Playtest — ${game.name}`);
    if (!folder) return j({ ok: false, error: "drive folder create failed" }, 500);
    folderId = folder.id;
    await updateGame(db, game.id, { driveFolderId: folderId });
  }

  // Sub-folder "Reports"
  const reportsFolder = await ensureFolder(env, folderId, "Reports");
  if (!reportsFolder) return j({ ok: false, error: "drive reports folder failed" }, 500);

  // Upload del .md
  const encoder = new TextEncoder();
  const buf = encoder.encode(built.md);
  const file = await uploadFile(env, reportsFolder.id, {
    name: built.filename,
    type: "text/markdown",
    arrayBuffer: () => Promise.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer),
  });
  if (!file) return j({ ok: false, error: "upload failed" }, 500);

  return j({ ok: true, file: { id: file.id, name: file.name, webViewLink: file.webViewLink } });
};

function j(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });
}
