/**
 * Playtest session — client logic.
 *
 * Funzionalità chiave v3:
 *  - Ordine di turno drag-and-drop (HTML5 DnD + handle "≡")
 *  - SPACE = "next turn": salva il turno corrente e passa al giocatore successivo
 *  - Punti tracking biforcato in base a cfg.is_team_game:
 *      • individuale → 1-2 colonne punti per il giocatore di turno
 *      • a squadre → 2 box (uno per squadra) con totali running aggregati
 *  - Storico turni cliccabile → modale di edit
 *  - Edit sessione (label, data, luogo, note, stato)
 *  - Fasi speciali nella sidebar del cronometro
 */
(() => {
  const bootEl = document.getElementById("bootstrap");
  if (!bootEl) return;
  const state = JSON.parse(bootEl.textContent || "{}");

  state.players.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  state.currentIdx = 0;

  // Mappa user_id → nome breve (per attribution sui turni/omni/obs)
  const collaboratorMap = {};
  for (const c of state.collaborators || []) {
    collaboratorMap[c.id] = c.name.split(" ")[0]; // primo nome
  }
  function userLabel(uid) {
    if (!uid) return "";
    if (uid === state.currentUserId) return "tu";
    return collaboratorMap[uid] || "?";
  }

  const cfg = state.cfg || {};
  const isTeamGame = !!cfg.is_team_game;
  // Squadre: default 2 se non specificate. Supportiamo N qualsiasi.
  const teams = Array.isArray(cfg.teams) && cfg.teams.length >= 2
    ? cfg.teams
    : [{ name: "Squadra A" }, { name: "Squadra B" }];
  const nTeams = teams.length;
  const pLabel1 = cfg.points_label_1 || "Punti";
  const pLabel2 = cfg.points_label_2 || "Secondari";

  // runningPoints: in team mode è un array di N elementi (uno per squadra).
  // In individuale è [primary, secondary] (2 elementi).
  state.runningPoints = isTeamGame ? new Array(nTeams).fill(0) : [0, 0];

  /** Estrae l'array di delta punti per il turno (lunghezza nTeams in team mode). */
  function turnTeamPoints(t) {
    if (Array.isArray(t.teamPoints)) {
      // Espandi/tronca a nTeams (riempi con 0 se l'array salvato è più corto)
      const out = new Array(nTeams).fill(0);
      for (let i = 0; i < Math.min(t.teamPoints.length, nTeams); i++) out[i] = Number(t.teamPoints[i]) || 0;
      return out;
    }
    // Fallback legacy: usa points_1/points_2 come [team0, team1]
    if (nTeams === 2) return [Number(t.points1) || 0, Number(t.points2) || 0];
    const out = new Array(nTeams).fill(0);
    if (t.points1 != null) out[0] = Number(t.points1) || 0;
    if (t.points2 != null && nTeams > 1) out[1] = Number(t.points2) || 0;
    return out;
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function fmtDur(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  function currentPlayer() { return state.players[state.currentIdx] || null; }

  // ============ TABS ============
  document.querySelectorAll(".nx-tab").forEach((t) => {
    t.addEventListener("click", () => {
      const k = t.dataset.tab;
      document.querySelectorAll(".nx-tab").forEach((x) => x.classList.toggle("nx-tab-active", x === t));
      document.querySelectorAll("[data-panel]").forEach((p) => p.classList.toggle("hidden", p.dataset.panel !== k));
    });
  });

  // ============ PLAYERS (tab gestione) ============
  const playersList = document.getElementById("players-list");
  const playerForm = document.getElementById("player-form");

  function renderPlayers() {
    if (!playersList) return;
    playersList.innerHTML = "";
    if (state.players.length === 0) {
      playersList.innerHTML = `<li class="py-3 text-xs text-nx-gray-dark">Ancora nessun giocatore.</li>`;
      return;
    }
    state.players.forEach((p) => {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between gap-3 py-2 text-sm";
      const exp = p.experience ? ` <span class="ml-1 rounded bg-nx-cyan-light px-1.5 py-0.5 text-[10px] font-bold text-nx-cyan">${esc(p.experience)}</span>` : "";
      const role = p.role ? ` <span class="text-xs text-nx-gray-dark">— ${esc(p.role)}</span>` : "";
      let teamHtml = "";
      if (isTeamGame) {
        const opts = [`<option value="" ${p.teamIndex == null ? "selected" : ""}>—</option>`]
          .concat(teams.map((t, ti) => `<option value="${ti}" ${p.teamIndex === ti ? "selected" : ""}>${esc(t.name)}</option>`));
        teamHtml = `
          <select data-set-team="${p.id}" class="rounded-md border border-nx-gray-light/30 px-2 py-1 text-xs focus:border-nx-cyan focus:outline-none">
            ${opts.join("")}
          </select>`;
      }
      li.innerHTML = `
        <span class="flex-1 truncate"><strong>${esc(p.displayName)}</strong>${role}${exp}</span>
        ${teamHtml}
        <button data-del-player="${p.id}" class="text-xs text-red-500 hover:text-red-700">Rimuovi</button>`;
      playersList.appendChild(li);
    });
  }
  // Handler condiviso fra il form "Giocatori" (tab principale) e il quick-add
  // inline dell'ordine turno (sidebar Cronometro). Riduce il context-switch
  // tra tab durante una sessione live.
  async function submitNewPlayer(form) {
    const fd = new FormData(form);
    const teamRaw = String(fd.get("teamIndex") || "");
    const payload = {
      displayName: String(fd.get("displayName") || "").trim(),
      role: String(fd.get("role") || "").trim() || null,
      experience: String(fd.get("experience") || "").trim() || null,
      teamIndex: teamRaw === "" ? null : Number(teamRaw),
    };
    if (!payload.displayName) return false;
    const r = await fetch(`/api/playtest/sessions/${state.sessionId}/players`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (r.ok && j.ok) {
      j.player.position = state.players.length;
      state.players.push(j.player);
      form.reset();
      renderAll();
      return true;
    }
    alert(j.error || "Errore");
    return false;
  }
  playerForm?.addEventListener("submit", (e) => { e.preventDefault(); submitNewPlayer(playerForm); });
  document.getElementById("quick-player-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    submitNewPlayer(e.target);
  });
  playersList?.addEventListener("click", async (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const id = t.dataset.delPlayer;
    if (!id) return;
    if (!confirm("Rimuovere il giocatore?")) return;
    const r = await fetch(`/api/playtest/players/${id}`, { method: "DELETE" });
    if (r.ok) {
      state.players = state.players.filter((p) => p.id !== id);
      if (state.currentIdx >= state.players.length) state.currentIdx = 0;
      renderAll();
    }
  });
  playersList?.addEventListener("change", async (e) => {
    const sel = e.target;
    if (!(sel instanceof HTMLSelectElement)) return;
    const id = sel.dataset.setTeam;
    if (!id) return;
    const raw = sel.value;
    const teamIndex = raw === "" ? null : Number(raw);
    const p = state.players.find((x) => x.id === id);
    if (p) p.teamIndex = teamIndex;
    await fetch(`/api/playtest/players/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamIndex }),
    });
    renderPointsContainer();  // ricomputa totali team
  });

  // ============ TURN ORDER (drag-and-drop) ============
  const turnOrder = document.getElementById("turn-order");
  const turnOrderEmpty = document.getElementById("turn-order-empty");
  let dragSrcIdx = null;

  function renderTurnOrder() {
    if (!turnOrder) return;
    turnOrder.innerHTML = "";
    if (state.players.length === 0) {
      turnOrder.classList.add("hidden");
      turnOrderEmpty?.classList.remove("hidden");
      return;
    }
    turnOrder.classList.remove("hidden");
    turnOrderEmpty?.classList.add("hidden");
    state.players.forEach((p, i) => {
      const isCur = i === state.currentIdx;
      const li = document.createElement("li");
      li.draggable = true;
      li.dataset.idx = i;
      li.className = `nx-drag-item flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
        isCur ? "border-nx-cyan bg-nx-cyan-light font-bold text-nx-cyan" : "border-nx-gray-light/30 bg-white text-nx-dark"
      }`;
      const teamTag = isTeamGame && p.teamIndex != null
        ? `<span class="ml-1 rounded bg-nx-cyan-light px-1.5 py-0.5 text-[9px] font-bold text-nx-cyan">${esc(teams[p.teamIndex].name)}</span>` : "";
      li.innerHTML = `
        <span class="nx-drag-handle cursor-grab select-none text-nx-gray-dark hover:text-nx-cyan" title="Trascina per riordinare">≡</span>
        <span class="w-5 text-center font-mono">${i + 1}.</span>
        <span class="flex-1 truncate">${esc(p.displayName)}${p.role ? ` <span class="text-nx-gray-dark">· ${esc(p.role)}</span>` : ""}${teamTag}</span>
        <button data-set-current="${i}" title="Imposta come corrente" class="rounded px-1.5 py-0.5 text-[10px] font-bold ${isCur ? "bg-nx-cyan text-white" : "text-nx-gray-dark hover:text-nx-cyan"}">→</button>
      `;
      turnOrder.appendChild(li);
    });
    attachDragHandlers();
  }

  function attachDragHandlers() {
    turnOrder.querySelectorAll(".nx-drag-item").forEach((li) => {
      li.addEventListener("dragstart", (e) => {
        dragSrcIdx = Number(li.dataset.idx);
        li.classList.add("opacity-50");
        e.dataTransfer?.setData("text/plain", String(dragSrcIdx));
        e.dataTransfer.effectAllowed = "move";
      });
      li.addEventListener("dragend", () => {
        li.classList.remove("opacity-50");
        turnOrder.querySelectorAll(".nx-drag-over").forEach((x) => x.classList.remove("nx-drag-over"));
        dragSrcIdx = null;
      });
      li.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragSrcIdx != null && Number(li.dataset.idx) !== dragSrcIdx) {
          li.classList.add("nx-drag-over");
        }
      });
      li.addEventListener("dragleave", () => {
        li.classList.remove("nx-drag-over");
      });
      li.addEventListener("drop", async (e) => {
        e.preventDefault();
        li.classList.remove("nx-drag-over");
        const src = dragSrcIdx;
        const dst = Number(li.dataset.idx);
        if (src == null || src === dst) return;
        // Sposta src in posizione dst
        const moved = state.players.splice(src, 1)[0];
        state.players.splice(dst, 0, moved);
        // Aggiorna position e currentIdx
        const oldCurPlayerId = state.players.find((p, i) => i === state.currentIdx)?.id;
        state.players.forEach((p, k) => (p.position = k));
        // Ricalcola currentIdx (segue il giocatore originalmente corrente)
        const newCur = state.players.findIndex((p) => p.id === oldCurPlayerId);
        if (newCur >= 0) state.currentIdx = newCur;
        renderTurnOrder();
        persistOrder();
      });
    });
  }

  async function persistOrder() {
    await Promise.all(
      state.players.map((p, i) =>
        fetch(`/api/playtest/players/${p.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: i }),
        }),
      ),
    );
  }

  turnOrder?.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.dataset.setCurrent != null) {
      state.currentIdx = Number(t.dataset.setCurrent);
      renderTurnOrder();
      updateTimerDisplay();
    }
  });

  // ============ TIMER ============
  const tDisplay = document.getElementById("timer-display");
  const tNext = document.getElementById("t-next");
  const tNextLabel = document.getElementById("t-next-label");
  const tPause = document.getElementById("t-pause");
  const tStop = document.getElementById("t-stop");
  const tSkip = document.getElementById("t-skip");
  const tReset = document.getElementById("t-reset");
  const tEvent = document.getElementById("t-event");
  const tRound = document.getElementById("t-round");
  const roundDisplay = document.getElementById("round-display");
  const playerDisplay = document.getElementById("player-display");

  let timerStart = 0, timerAccumulated = 0, timerRunning = false, timerInterval = null;
  function elapsedMs() { return timerAccumulated + (timerRunning ? Date.now() - timerStart : 0); }
  function updateTimerDisplay() {
    const sec = Math.floor(elapsedMs() / 1000);
    if (tDisplay) tDisplay.textContent = fmtDur(sec);
    const cur = currentPlayer();
    if (playerDisplay) {
      let lbl = cur ? cur.displayName : "—";
      if (isTeamGame && cur?.teamIndex != null) lbl += ` (${teams[cur.teamIndex].name})`;
      playerDisplay.textContent = lbl;
    }
    if (roundDisplay && tRound) roundDisplay.textContent = tRound.value;
    if (tNextLabel) {
      if (timerRunning) tNextLabel.innerHTML = "→ Prossimo (SPAZIO)";
      else if (elapsedMs() > 0) tNextLabel.innerHTML = "▶ Riprendi";
      else tNextLabel.innerHTML = "▶ Avvia";
    }
    if (tStop) tStop.disabled = elapsedMs() < 1000;
  }
  function startTimer() {
    if (timerRunning) return;
    if (state.players.length === 0) { alert("Aggiungi prima dei giocatori."); return; }
    timerRunning = true;
    timerStart = Date.now();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimerDisplay, 250);
    tPause?.classList.remove("hidden");
    updateTimerDisplay();
  }
  function pauseTimer() {
    if (!timerRunning) return;
    timerAccumulated += Date.now() - timerStart;
    timerRunning = false;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    tPause?.classList.add("hidden");
    updateTimerDisplay();
  }
  function resetTimer() {
    timerRunning = false; timerStart = 0; timerAccumulated = 0;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    tPause?.classList.add("hidden");
    state.runningPoints = [0, 0];
    if (tEvent) tEvent.value = "";
    renderPointsTotals();
    updateTimerDisplay();
  }

  async function saveCurrentTurn({ advance = true } = {}) {
    const cur = currentPlayer();
    const durationSec = Math.round(elapsedMs() / 1000);
    if (durationSec < 1) { alert("Turno troppo breve, riprova."); return false; }
    const payload = {
      round: Number(tRound?.value || 1),
      playerId: cur?.id || null,
      durationSeconds: durationSec,
      event: tEvent?.value?.trim() || null,
    };
    if (isTeamGame) {
      // teamPoints come array di delta per ogni squadra. Il backend mirroring
      // su points_1/points_2 per backward-compat con N=2.
      payload.teamPoints = state.runningPoints.slice(0, nTeams);
      payload.points1 = state.runningPoints[0] || null;
      payload.points2 = nTeams > 1 ? (state.runningPoints[1] || null) : null;
    } else {
      payload.points1 = state.runningPoints[0] || null;
      payload.points2 = state.runningPoints[1] || null;
    }
    const r = await fetch(`/api/playtest/sessions/${state.sessionId}/turns`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok || !j.ok) { alert(j.error || "Errore"); return false; }
    state.turns.push(j.turn);
    renderTurns();

    resetTimer();

    if (advance) {
      const wasLast = state.currentIdx === state.players.length - 1;
      state.currentIdx = (state.currentIdx + 1) % Math.max(1, state.players.length);
      const autoRound = document.getElementById("auto-round");
      if (wasLast && autoRound?.checked) {
        tRound.value = String(Math.min(99, Number(tRound.value || 1) + 1));
      }
      renderTurnOrder();
      updateTimerDisplay();
      // Feedback visivo: flash sul nuovo giocatore corrente nell'ordine turno
      // + sul display nome del giocatore. Aiuta a confermare il "salto" SPACE.
      const curLi = turnOrder?.querySelectorAll("li")[state.currentIdx];
      if (curLi) {
        curLi.classList.add("nx-flash");
        setTimeout(() => curLi.classList.remove("nx-flash"), 700);
      }
      const pd = document.getElementById("player-display");
      if (pd) {
        pd.classList.add("nx-flash-text");
        setTimeout(() => pd.classList.remove("nx-flash-text"), 700);
      }
    }
    return true;
  }

  async function spaceAction() {
    if (state.players.length === 0) { alert("Aggiungi giocatori prima."); return; }
    if (timerRunning || elapsedMs() > 0) {
      const ok = await saveCurrentTurn({ advance: true });
      if (ok) startTimer();
    } else {
      startTimer();
    }
  }

  tNext?.addEventListener("click", spaceAction);
  tPause?.addEventListener("click", () => {
    if (timerRunning) pauseTimer();
    else if (elapsedMs() > 0) startTimer();
  });
  tStop?.addEventListener("click", async () => { await saveCurrentTurn({ advance: false }); });
  tSkip?.addEventListener("click", () => {
    if (!confirm("Salta il giocatore corrente senza salvare il turno?")) return;
    resetTimer();
    state.currentIdx = (state.currentIdx + 1) % Math.max(1, state.players.length);
    renderTurnOrder();
    updateTimerDisplay();
  });
  tReset?.addEventListener("click", () => {
    if (elapsedMs() === 0) return;
    if (confirm("Reset cronometro senza salvare?")) resetTimer();
  });
  tRound?.addEventListener("input", updateTimerDisplay);

  document.addEventListener("keydown", (e) => {
    if (e.code !== "Space") return;
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    e.preventDefault();
    spaceAction();
  });

  // ============ POINTS (biforcato) ============
  const pointsContainer = document.getElementById("points-container");

  // Totali aggregati attraverso lo storico turni:
  //  - team game (N squadre): totale per squadra = somma turn.teamPoints[idx]
  //  - individuale: per giocatore = somma dei suoi points_1
  function computeTeamTotal(teamIdx) {
    return state.turns.reduce((acc, t) => {
      const arr = turnTeamPoints(t);
      return acc + (arr[teamIdx] || 0);
    }, 0);
  }
  function teamPlayerCount(teamIdx) {
    return state.players.filter((p) => p.teamIndex === teamIdx).length;
  }
  function computePlayerTotal(playerId) {
    return state.turns
      .filter((t) => t.playerId === playerId)
      .reduce((acc, t) => acc + (Number(t.points1) || 0), 0);
  }
  function computePlayerSecondaryTotal(playerId) {
    return state.turns
      .filter((t) => t.playerId === playerId)
      .reduce((acc, t) => acc + (Number(t.points2) || 0), 0);
  }

  function renderPointsContainer() {
    if (!pointsContainer) return;
    pointsContainer.innerHTML = "";

    if (isTeamGame) {
      // Adatta il grid a N squadre: 1 col su mobile, 2 su sm, 3 su lg se N>=3
      pointsContainer.className = `grid gap-4 sm:grid-cols-2 ${nTeams >= 3 ? "lg:grid-cols-3" : ""}`;
      teams.forEach((t, idx) => {
        const teamName = t?.name || `Squadra ${idx + 1}`;
        const running = state.runningPoints[idx] || 0;
        const aggregate = computeTeamTotal(idx);
        const players = teamPlayerCount(idx);
        const card = document.createElement("div");
        card.className = "rounded-xl bg-white p-5 shadow-sm";
        card.dataset.points = idx;
        card.innerHTML = `
          <div class="flex items-baseline justify-between gap-2">
            <div class="min-w-0">
              <h3 class="truncate text-sm font-bold uppercase tracking-wider text-nx-dark">${esc(teamName)}</h3>
              <p class="text-[10px] text-nx-gray-dark">
                Totale: <strong class="text-nx-dark">${aggregate}</strong>
                · <strong class="text-nx-dark">${players}</strong> giocator${players === 1 ? "e" : "i"}
              </p>
            </div>
            <span class="text-3xl font-black text-nx-cyan" data-points-total>${running}</span>
          </div>
          <div class="mt-3 flex flex-wrap gap-1.5">
            ${[-1, 1, 2, 3, 5, 10].map((v) => `
              <button type="button" data-add="${v}"
                class="rounded-md px-3 py-2 text-sm font-bold transition hover:-translate-y-0.5 ${v < 0 ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-nx-cyan-light text-nx-cyan hover:bg-nx-cyan hover:text-white"}">
                ${v > 0 ? "+" + v : v}
              </button>`).join("")}
            <button type="button" data-clear class="rounded-md border border-nx-gray-light/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-nx-gray-dark hover:border-red-400 hover:text-red-600">Azzera</button>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <input type="number" step="0.5" data-points-custom class="w-24 rounded-md border border-nx-gray-light/40 px-2 py-1.5 text-sm focus:border-nx-cyan focus:outline-none" placeholder="±n" />
            <button type="button" data-add-custom class="rounded-md bg-nx-dark px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-nx-cyan">Aggiungi</button>
          </div>
        `;
        pointsContainer.appendChild(card);
      });
    } else {
      // Reset grid class for individual
      pointsContainer.className = "grid gap-4 sm:grid-cols-2";
      // Individuale: 1 card per il giocatore corrente con label cfg.points_label_1/_2
      // Plus una mini-classifica sotto.
      const cur = currentPlayer();
      const curLabel = cur ? cur.displayName : "—";
      [0, 1].forEach((idx) => {
        const label = idx === 0 ? pLabel1 : pLabel2;
        if (idx === 1 && !cfg.points_label_2) return; // se nessuna label secondaria, mostra solo 1 box
        const running = state.runningPoints[idx] || 0;
        const aggregate = cur ? (idx === 0 ? computePlayerTotal(cur.id) : computePlayerSecondaryTotal(cur.id)) : 0;
        const card = document.createElement("div");
        card.className = "rounded-xl bg-white p-5 shadow-sm";
        card.dataset.points = idx;
        card.innerHTML = `
          <div class="flex items-baseline justify-between">
            <div>
              <h3 class="text-sm font-bold uppercase tracking-wider text-nx-dark">${esc(label)}</h3>
              <p class="text-[10px] text-nx-gray-dark">Totale di ${esc(curLabel)}: <strong class="text-nx-dark">${aggregate}</strong></p>
            </div>
            <span class="text-3xl font-black text-nx-cyan" data-points-total>${running}</span>
          </div>
          <p class="mt-1 text-[10px] text-nx-gray-dark">Aggiungi al turno corrente.</p>
          <div class="mt-3 flex flex-wrap gap-1.5">
            ${[-1, 1, 2, 3, 5, 10].map((v) => `
              <button type="button" data-add="${v}"
                class="rounded-md px-3 py-2 text-sm font-bold transition hover:-translate-y-0.5 ${v < 0 ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-nx-cyan-light text-nx-cyan hover:bg-nx-cyan hover:text-white"}">
                ${v > 0 ? "+" + v : v}
              </button>`).join("")}
            <button type="button" data-clear class="rounded-md border border-nx-gray-light/40 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-nx-gray-dark hover:border-red-400 hover:text-red-600">Azzera</button>
          </div>
          <div class="mt-3 flex items-center gap-2">
            <input type="number" step="0.5" data-points-custom class="w-24 rounded-md border border-nx-gray-light/40 px-2 py-1.5 text-sm focus:border-nx-cyan focus:outline-none" placeholder="±n" />
            <button type="button" data-add-custom class="rounded-md bg-nx-dark px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-nx-cyan">Aggiungi</button>
          </div>
        `;
        pointsContainer.appendChild(card);
      });

      // Classifica giocatori (sotto, occupa entrambe le colonne)
      if (state.players.length > 0) {
        const standings = document.createElement("div");
        standings.className = "rounded-xl bg-white p-5 shadow-sm sm:col-span-2";
        const rows = state.players
          .map((p) => ({ p, t: computePlayerTotal(p.id), s: computePlayerSecondaryTotal(p.id) }))
          .sort((a, b) => b.t - a.t);
        standings.innerHTML = `
          <h3 class="text-sm font-bold uppercase tracking-wider text-nx-dark">Classifica giocatori</h3>
          <ul class="mt-2 divide-y divide-nx-gray-light/20 text-sm">
            ${rows.map((r, i) => `
              <li class="flex items-center justify-between py-1.5">
                <span class="flex items-center gap-2">
                  <span class="w-5 text-center font-mono text-nx-gray-dark">${i + 1}.</span>
                  <strong>${esc(r.p.displayName)}</strong>
                  ${r.p.role ? `<span class="text-xs text-nx-gray-dark">— ${esc(r.p.role)}</span>` : ""}
                </span>
                <span class="font-mono text-nx-cyan">${r.t}${cfg.points_label_2 ? ` / ${r.s}` : ""}</span>
              </li>`).join("")}
          </ul>
        `;
        pointsContainer.appendChild(standings);
      }
    }

    // Attach listeners ai bottoni
    pointsContainer.querySelectorAll("[data-points]").forEach((wrap) => {
      const idx = Number(wrap.dataset.points);
      wrap.querySelectorAll("[data-add]").forEach((b) => {
        b.addEventListener("click", () => {
          state.runningPoints[idx] = (state.runningPoints[idx] || 0) + Number(b.dataset.add);
          renderPointsTotals();
        });
      });
      wrap.querySelector("[data-clear]")?.addEventListener("click", () => {
        state.runningPoints[idx] = 0;
        renderPointsTotals();
      });
      const customInput = wrap.querySelector("[data-points-custom]");
      wrap.querySelector("[data-add-custom]")?.addEventListener("click", () => {
        const v = Number(customInput.value);
        if (Number.isFinite(v) && v !== 0) {
          state.runningPoints[idx] = (state.runningPoints[idx] || 0) + v;
          customInput.value = "";
          renderPointsTotals();
        }
      });
    });
  }
  function renderPointsTotals() {
    pointsContainer?.querySelectorAll("[data-points]").forEach((wrap) => {
      const idx = Number(wrap.dataset.points);
      const totEl = wrap.querySelector("[data-points-total]");
      if (totEl) totEl.textContent = state.runningPoints[idx] || 0;
    });
  }

  // ============ TURNS LIST + EDIT ============
  const turnsList = document.getElementById("turns-list");
  function renderTurns() {
    if (!turnsList) return;
    turnsList.innerHTML = "";
    const sorted = [...state.turns].sort((a, b) => a.round - b.round || a.recordedAt - b.recordedAt);
    if (sorted.length === 0) {
      turnsList.innerHTML = `<p class="rounded-md border-2 border-dashed border-nx-gray-light/30 p-4 text-center text-nx-gray-dark">Nessun turno ancora.</p>`;
    } else {
      const byRound = new Map();
      for (const t of sorted) {
        if (!byRound.has(t.round)) byRound.set(t.round, []);
        byRound.get(t.round).push(t);
      }
      for (const [round, group] of byRound) {
        const block = document.createElement("div");
        block.innerHTML = `<p class="mt-2 text-[10px] font-bold uppercase tracking-wider text-nx-gray-dark">Round ${round}</p>`;
        for (const t of group) {
          const p = state.players.find((pp) => pp.id === t.playerId);
          const mmss = fmtDur(t.durationSeconds);
          const row = document.createElement("button");
          row.type = "button";
          row.dataset.editTurn = t.id;
          row.className = "mt-1 flex w-full items-center justify-between gap-2 rounded border border-nx-gray-light/20 px-2 py-1.5 text-left text-xs hover:border-nx-cyan hover:bg-nx-off-white";
          let ptsLabel = "";
          if (isTeamGame) {
            const arr = turnTeamPoints(t);
            const nonZero = arr.some((v) => v !== 0);
            if (nonZero) {
              ptsLabel = `<span class="text-nx-cyan">${arr.map((v, i) => `${esc(teams[i]?.name || `S${i + 1}`)}: ${v}`).join(" · ")}</span>`;
            }
          } else if (t.points1 != null || t.points2 != null) {
            ptsLabel = `<span class="text-nx-cyan">${t.points1 ?? 0}${cfg.points_label_2 ? ` / ${t.points2 ?? 0}` : ""}</span>`;
          }
          const evt = t.event ? `<em class="text-nx-gray-dark">${esc(t.event)}</em>` : "";
          const byLabel = t.recordedBy ? userLabel(t.recordedBy) : "";
          const byBadge = byLabel ? `<span class="rounded bg-nx-off-white px-1 py-0.5 text-[9px] font-bold text-nx-gray-dark" title="Registrato da ${esc(byLabel)}">by ${esc(byLabel)}</span>` : "";
          row.innerHTML = `<span class="flex flex-wrap items-center gap-2 truncate"><strong>${esc(p?.displayName || "?")}</strong>${ptsLabel}${evt}${byBadge}</span>
            <span class="font-mono text-nx-dark">${mmss}</span>`;
          block.appendChild(row);
        }
        turnsList.appendChild(block);
      }
    }
    const totalSec = state.turns.reduce((a, t) => a + t.durationSeconds, 0);
    const cnt = state.turns.length;
    const statCount = document.getElementById("stat-count");
    const statTotal = document.getElementById("stat-total");
    const statAvg = document.getElementById("stat-avg");
    if (statCount) statCount.textContent = cnt;
    if (statTotal) statTotal.textContent = (totalSec / 60).toFixed(1);
    if (statAvg) statAvg.textContent = cnt > 0 ? (totalSec / 60 / cnt).toFixed(1) : "—";

    // Aggiorna anche i totali aggregati nei card punti
    renderPointsContainer();
  }

  const turnModal = document.getElementById("turn-modal");
  const turnForm = document.getElementById("turn-form");
  function openTurnModal(turn) {
    turnForm.id.value = turn.id;
    turnForm.round.value = turn.round;
    turnForm.playerId.innerHTML = `<option value="">— nessuno —</option>` +
      state.players.map((p) => `<option value="${p.id}" ${p.id === turn.playerId ? "selected" : ""}>${esc(p.displayName)}${p.role ? " · " + esc(p.role) : ""}</option>`).join("");
    turnForm.durMin.value = Math.floor(turn.durationSeconds / 60);
    turnForm.durSec.value = turn.durationSeconds % 60;
    turnForm.points1.value = turn.points1 ?? "";
    turnForm.points2.value = turn.points2 ?? "";
    turnForm.event.value = turn.event ?? "";
    document.getElementById("turn-err").classList.add("hidden");
    turnModal.classList.remove("hidden"); turnModal.classList.add("flex");
  }
  function closeTurnModal() { turnModal.classList.add("hidden"); turnModal.classList.remove("flex"); }
  document.getElementById("turn-cancel")?.addEventListener("click", closeTurnModal);
  turnModal?.addEventListener("click", (e) => { if (e.target === turnModal) closeTurnModal(); });

  turnsList?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-edit-turn]");
    if (!btn) return;
    const t = state.turns.find((x) => x.id === btn.dataset.editTurn);
    if (t) openTurnModal(t);
  });

  turnForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = turnForm.id.value;
    const durSec = Math.max(0, Math.round(Number(turnForm.durMin.value || 0) * 60 + Number(turnForm.durSec.value || 0)));
    const payload = {
      round: Number(turnForm.round.value),
      playerId: turnForm.playerId.value || null,
      durationSeconds: durSec,
      points1: turnForm.points1.value === "" ? null : Number(turnForm.points1.value),
      points2: turnForm.points2.value === "" ? null : Number(turnForm.points2.value),
      event: turnForm.event.value.trim() || null,
    };
    const errEl = document.getElementById("turn-err");
    errEl.classList.add("hidden");
    try {
      const r = await fetch(`/api/playtest/turns/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Errore");
      const idx = state.turns.findIndex((x) => x.id === id);
      if (idx >= 0) state.turns[idx] = { ...state.turns[idx], ...j.turn };
      closeTurnModal();
      renderTurns();
    } catch (e) { errEl.textContent = e.message; errEl.classList.remove("hidden"); }
  });

  document.getElementById("turn-delete")?.addEventListener("click", async () => {
    const id = turnForm.id.value;
    if (!confirm("Eliminare definitivamente questo turno?")) return;
    const r = await fetch(`/api/playtest/turns/${id}`, { method: "DELETE" });
    if (r.ok) {
      state.turns = state.turns.filter((x) => x.id !== id);
      closeTurnModal();
      renderTurns();
    }
  });

  // ============ PHASE TIMES ============
  const phasesList = document.getElementById("phases-list");
  const phaseForm = document.getElementById("phase-form");
  function renderPhases() {
    if (!phasesList) return;
    phasesList.innerHTML = "";
    if (state.phaseTimes.length === 0) {
      phasesList.innerHTML = `<li class="py-2 text-nx-gray-dark">Nessuna fase ancora.</li>`;
      return;
    }
    state.phaseTimes.forEach((ph) => {
      const li = document.createElement("li");
      li.className = "flex items-center justify-between py-1.5";
      li.innerHTML = `<span><strong>${esc(ph.name)}</strong></span>
        <span class="flex items-center gap-2"><span class="font-mono text-nx-cyan">${ph.minutes} min</span>
        <button data-del-phase="${ph.id}" class="text-red-500 hover:text-red-700">×</button></span>`;
      phasesList.appendChild(li);
    });
  }
  phaseForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(phaseForm);
    const payload = { name: String(fd.get("name") || "").trim(), minutes: Number(fd.get("minutes") || 0) };
    if (!payload.name || payload.minutes <= 0) return;
    const r = await fetch(`/api/playtest/sessions/${state.sessionId}/phase-times`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (r.ok && j.ok) { state.phaseTimes.push(j.phaseTime); phaseForm.reset(); renderPhases(); }
  });
  phasesList?.addEventListener("click", async (e) => {
    const id = e.target?.dataset?.delPhase;
    if (!id) return;
    if (!confirm("Rimuovere la fase?")) return;
    const r = await fetch(`/api/playtest/phase-times/${id}`, { method: "DELETE" });
    if (r.ok) { state.phaseTimes = state.phaseTimes.filter((p) => p.id !== id); renderPhases(); }
  });

  // ============ CHECKLIST ============
  const chkContainer = document.getElementById("chk-instances");
  const phaseLabels = { setup: "Set-up", inizio: "Inizio", fine: "Fine", partecipata: "Partecipata" };
  function itemsForPhase(phase) { return phase === "setup" ? state.setupItems : state.obsItems; }
  function renderChecklist() {
    if (!chkContainer) return;
    chkContainer.innerHTML = "";
    if (state.instances.length === 0) {
      chkContainer.innerHTML = `<p class="text-sm text-nx-gray-dark">Nessuna checklist iniziata. Clicca un bottone sopra (Set-up, Inizio, Fine, Partecipata) per crearne una.</p>`;
      return;
    }
    for (const inst of state.instances) {
      const items = itemsForPhase(inst.phase);
      const responses = state.responsesByInstance[inst.id] || {};
      const card = document.createElement("div");
      card.className = "rounded-lg border border-nx-gray-light/30 bg-nx-off-white p-4";
      const obsName = inst.observerName ? `<span class="ml-2 text-xs text-nx-gray-dark">— ${esc(inst.observerName)}</span>` : "";
      const itemsHtml = items.map((it) => {
        const r = responses[it.id] || { score: null, comment: null };
        const score = r.score != null ? r.score : "";
        const comment = r.comment ? esc(r.comment) : "";
        return `
          <div class="rounded border border-nx-gray-light/20 bg-white p-3" data-item="${it.id}">
            <p class="text-xs font-bold uppercase tracking-wider text-nx-cyan">${esc(it.category)}${it.subcategory ? " · " + esc(it.subcategory) : ""}</p>
            <p class="mt-1 text-sm text-nx-dark">${esc(it.text)}</p>
            <div class="mt-2 flex items-start gap-3">
              <div class="flex items-center gap-2">
                <input type="number" min="0" max="10" step="0.5" value="${score}" data-score
                  class="w-16 rounded-md border border-nx-gray-light/40 px-2 py-1 text-center text-sm font-bold focus:border-nx-cyan focus:outline-none" />
                <span class="text-[10px] text-nx-gray-dark">/10</span>
              </div>
              <textarea rows="1" placeholder="Commento (opzionale)" data-comment
                class="flex-1 rounded-md border border-nx-gray-light/40 px-2 py-1 text-xs focus:border-nx-cyan focus:outline-none">${comment}</textarea>
            </div>
          </div>`;
      }).join("");
      card.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-base font-bold text-nx-dark">Checklist · ${esc(phaseLabels[inst.phase] || inst.phase)}${obsName}</h3>
          <div class="flex items-center gap-2">
            <span class="rounded-full bg-nx-cyan-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-nx-cyan" data-saved>Salvato</span>
            <button data-delete-instance="${inst.id}" class="text-xs text-red-500 hover:text-red-700">Elimina</button>
          </div>
        </div>
        <div class="mt-3 grid gap-2" data-instance="${inst.id}">
          ${itemsHtml}
        </div>`;
      chkContainer.appendChild(card);
    }
    chkContainer.querySelectorAll("[data-instance]").forEach((wrap) => {
      const instId = wrap.dataset.instance;
      const savedTag = wrap.parentElement?.querySelector("[data-saved]");
      wrap.querySelectorAll("[data-item]").forEach((row) => {
        const itemId = row.dataset.item;
        const scoreInput = row.querySelector("[data-score]");
        const commentInput = row.querySelector("[data-comment]");
        let timer = null;
        const flush = async () => {
          if (savedTag) { savedTag.textContent = "Salvando…"; savedTag.className = "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700"; }
          const payload = {
            itemId,
            score: scoreInput.value === "" ? null : Number(scoreInput.value),
            comment: commentInput.value.trim() || null,
          };
          const r = await fetch(`/api/playtest/checklist-instances/${instId}/responses`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (r.ok && savedTag) {
            savedTag.textContent = "Salvato";
            savedTag.className = "rounded-full bg-nx-cyan-light px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-nx-cyan";
            state.responsesByInstance[instId] = state.responsesByInstance[instId] || {};
            state.responsesByInstance[instId][itemId] = { score: payload.score, comment: payload.comment };
          }
        };
        const debounce = () => { if (timer) clearTimeout(timer); timer = setTimeout(flush, 600); };
        scoreInput?.addEventListener("input", debounce);
        scoreInput?.addEventListener("change", flush);
        commentInput?.addEventListener("input", debounce);
        commentInput?.addEventListener("blur", flush);
      });
    });
    chkContainer.querySelectorAll("[data-delete-instance]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.deleteInstance;
        if (!confirm("Eliminare questa checklist e tutte le sue risposte?")) return;
        const r = await fetch(`/api/playtest/checklist-instances/${id}`, { method: "DELETE" });
        if (r.ok) {
          state.instances = state.instances.filter((i) => i.id !== id);
          delete state.responsesByInstance[id];
          renderChecklist();
        }
      });
    });
  }
  // Resolve the current user's first name from collaborators (for auto-fill)
  const currentUserName = (state.collaborators || [])
    .find((c) => c.id === state.currentUserId)?.name?.split(" ")[0] ?? "";

  document.querySelectorAll("[data-create-phase]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const phase = btn.dataset.createPhase;
      // Auto-fill con nome del socio loggato; lascia prompt per cambiare/aggiungere
      const observerName = (prompt(
        "Nome osservatore (chi compila questa checklist):",
        currentUserName,
      ) || "").trim() || null;
      const r = await fetch(`/api/playtest/sessions/${state.sessionId}/checklist-instances`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase, observerName }),
      });
      const j = await r.json();
      if (r.ok && j.ok) {
        state.instances.unshift(j.instance);
        state.responsesByInstance[j.instance.id] = {};
        renderChecklist();
      } else alert(j.error || "Errore");
    });
  });

  // ============ SESSION COMPLETE ============
  document.getElementById("session-complete")?.addEventListener("click", async () => {
    if (!confirm("Marcare la sessione come completata?")) return;
    const r = await fetch(`/api/playtest/sessions/${state.sessionId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    if (r.ok) location.href = `/giochi/${state.gameSlug}`;
  });

  // ============ EDIT SESSION ============
  const sEditModal = document.getElementById("session-edit-modal");
  const sEditForm = document.getElementById("session-edit-form");
  document.getElementById("session-edit")?.addEventListener("click", () => {
    sEditModal.classList.remove("hidden"); sEditModal.classList.add("flex");
  });
  document.getElementById("session-edit-cancel")?.addEventListener("click", () => {
    sEditModal.classList.add("hidden"); sEditModal.classList.remove("flex");
  });
  sEditModal?.addEventListener("click", (e) => { if (e.target === sEditModal) { sEditModal.classList.add("hidden"); sEditModal.classList.remove("flex"); } });
  sEditForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(sEditForm);
    const payload = {
      label: String(fd.get("label") || "").trim(),
      playedAt: String(fd.get("playedAt") || "") || null,
      location: String(fd.get("location") || "").trim() || null,
      notes: String(fd.get("notes") || "").trim() || null,
      status: String(fd.get("status") || ""),
    };
    const errEl = document.getElementById("session-edit-err");
    errEl.classList.add("hidden");
    try {
      const r = await fetch(`/api/playtest/sessions/${state.sessionId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Errore");
      window.location.reload();
    } catch (e) { errEl.textContent = e.message; errEl.classList.remove("hidden"); }
  });

  // ============ OBSERVATIONS (Sempre sottocchio) ============
  function renderObservations() {
    const obsByCat = { variabili_visibili: [], variabili_invisibili: [], equita: [], lamentele: [] };
    for (const o of state.observations || []) {
      if (obsByCat[o.category]) obsByCat[o.category].push(o);
    }
    Object.entries(obsByCat).forEach(([cat, list]) => {
      const el = document.querySelector(`[data-obs-list="${cat}"]`);
      if (!el) return;
      el.innerHTML = list.length === 0
        ? `<li class="text-[11px] italic text-nx-gray-dark">—</li>`
        : list.map((o) => {
            const by = o.recordedBy ? userLabel(o.recordedBy) : "";
            const byBadge = by ? `<span class="ml-1 text-[9px] text-nx-gray-dark">(${esc(by)})</span>` : "";
            return `<li class="flex items-start justify-between gap-1 rounded bg-white px-2 py-1">
              <span class="flex-1 text-nx-dark">${esc(o.text)}${byBadge}</span>
              <button data-del-obs="${o.id}" class="text-red-500 hover:text-red-700">×</button>
            </li>`;
          }).join("");
    });
  }
  // Auto-grow textarea: aggiusta l'altezza in base al contenuto.
  function autosize(ta) {
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }
  document.querySelectorAll("[data-obs-add]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cat = btn.dataset.obsAdd;
      const input = document.querySelector(`[data-obs-input="${cat}"]`);
      const text = input.value.trim();
      if (!text) return;
      const r = await fetch(`/api/playtest/sessions/${state.sessionId}/observations`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat, text }),
      });
      const j = await r.json();
      if (r.ok && j.ok) {
        state.observations = state.observations || [];
        state.observations.push(j.observation);
        input.value = "";
        autosize(input);   // reset altezza dopo aver svuotato
        renderObservations();
      } else alert(j.error || "Errore");
    });
  });
  document.querySelectorAll("[data-obs-input]").forEach((inp) => {
    // Inizializza l'altezza
    autosize(inp);
    // Cresce mentre scrivi
    inp.addEventListener("input", () => autosize(inp));
    // Enter = submit, Shift+Enter = newline
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        document.querySelector(`[data-obs-add="${inp.dataset.obsInput}"]`)?.click();
      }
    });
  });
  document.querySelectorAll("[data-obs-list]").forEach((ul) => {
    ul.addEventListener("click", async (e) => {
      const id = e.target?.dataset?.delObs;
      if (!id) return;
      const r = await fetch(`/api/playtest/observations/${id}`, { method: "DELETE" });
      if (r.ok) {
        state.observations = state.observations.filter((o) => o.id !== id);
        renderObservations();
      }
    });
  });

  // ============ OMNI TABLE EDITOR (Debriefing) ============
  function renderOmni() {
    const byCat = { ottimo: [], modificare: [], non_chiaro: [], idee_nuove: [] };
    for (const o of state.omniComments || []) {
      if (byCat[o.category]) byCat[o.category].push(o);
    }
    Object.entries(byCat).forEach(([cat, list]) => {
      const el = document.querySelector(`[data-omni-list="${cat}"]`);
      if (!el) return;
      el.innerHTML = list.length === 0
        ? `<li class="text-[11px] italic text-nx-gray-dark">—</li>`
        : list.map((o) => {
            const by = o.recordedBy ? userLabel(o.recordedBy) : "";
            const authorBits = [
              o.authorName ? esc(o.authorName) : "",
              by ? `trascritto da ${esc(by)}` : "",
            ].filter(Boolean).join(" · ");
            return `<li class="rounded bg-white px-2 py-1.5 text-nx-dark">
              <div class="flex items-start justify-between gap-2">
                <span class="flex-1">${esc(o.text)}</span>
                <button data-del-omni="${o.id}" class="text-red-500 hover:text-red-700">×</button>
              </div>
              ${authorBits ? `<p class="mt-0.5 text-[10px] text-nx-gray-dark">— ${authorBits}</p>` : ""}
            </li>`;
          }).join("");
    });
  }
  document.querySelectorAll("[data-omni-add]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cat = btn.dataset.omniAdd;
      const input = document.querySelector(`[data-omni-input="${cat}"]`);
      const author = document.querySelector(`[data-omni-author="${cat}"]`);
      const text = input.value.trim();
      if (!text) return;
      const r = await fetch(`/api/playtest/sessions/${state.sessionId}/omni`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat, text, authorName: author.value.trim() || null }),
      });
      const j = await r.json();
      if (r.ok && j.ok) {
        state.omniComments = state.omniComments || [];
        state.omniComments.push(j.omni);
        input.value = "";
        author.value = "";
        renderOmni();
      } else alert(j.error || "Errore");
    });
  });
  document.querySelectorAll("[data-omni-input]").forEach((inp) => {
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        document.querySelector(`[data-omni-add="${inp.dataset.omniInput}"]`)?.click();
      }
    });
  });
  document.querySelectorAll("[data-omni-list]").forEach((ul) => {
    ul.addEventListener("click", async (e) => {
      const id = e.target?.dataset?.delOmni;
      if (!id) return;
      const r = await fetch(`/api/playtest/omni/${id}`, { method: "DELETE" });
      if (r.ok) {
        state.omniComments = state.omniComments.filter((o) => o.id !== id);
        renderOmni();
      }
    });
  });

  // ============ REPORT BUILDER (Debriefing) ============
  state.reportData = state.reportData || { criticita: [], cose_poco_chiare: [], narrative_summary: "" };
  let reportSaveTimer = null;
  async function saveReport() {
    await fetch(`/api/playtest/sessions/${state.sessionId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportData: state.reportData }),
    });
  }
  function debounceSaveReport() {
    if (reportSaveTimer) clearTimeout(reportSaveTimer);
    reportSaveTimer = setTimeout(saveReport, 600);
  }

  function renderReportLists() {
    const c = document.getElementById("rep-criticita");
    const cc = document.getElementById("rep-chiare");
    function renderList(arr, container) {
      if (!container) return;
      container.innerHTML = arr.length === 0
        ? `<li class="rounded-md border-2 border-dashed border-nx-gray-light/30 p-3 text-center text-xs italic text-nx-gray-dark">Nessun elemento ancora.</li>`
        : arr.map((e, i) => `
          <li class="rounded-md border border-nx-gray-light/30 p-3">
            <div class="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
              <div>
                <p class="text-[10px] font-bold uppercase tracking-wider text-nx-gray-dark">Problema</p>
                <p class="mt-0.5 text-sm text-nx-dark" data-rep-edit-prob="${i}" contenteditable="true">${esc(e.problema)}</p>
              </div>
              <div>
                <p class="text-[10px] font-bold uppercase tracking-wider text-nx-cyan">Soluzione</p>
                <p class="mt-0.5 text-sm text-nx-dark" data-rep-edit-sol="${i}" contenteditable="true">${esc(e.soluzione)}</p>
              </div>
              <button data-rep-del="${i}" class="self-start rounded p-1 text-xs text-red-500 hover:bg-red-50">×</button>
            </div>
          </li>`).join("");
    }
    renderList(state.reportData.criticita || [], c);
    renderList(state.reportData.cose_poco_chiare || [], cc);
  }

  function bindReportListEvents(containerId, arrKey) {
    const c = document.getElementById(containerId);
    if (!c) return;
    c.addEventListener("input", (e) => {
      const t = e.target;
      if (t.dataset.repEditProb != null) {
        state.reportData[arrKey][Number(t.dataset.repEditProb)].problema = t.textContent.trim();
        debounceSaveReport();
      } else if (t.dataset.repEditSol != null) {
        state.reportData[arrKey][Number(t.dataset.repEditSol)].soluzione = t.textContent.trim();
        debounceSaveReport();
      }
    });
    c.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-rep-del]");
      if (!btn) return;
      const i = Number(btn.dataset.repDel);
      state.reportData[arrKey].splice(i, 1);
      saveReport();
      renderReportLists();
    });
  }
  bindReportListEvents("rep-criticita", "criticita");
  bindReportListEvents("rep-chiare", "cose_poco_chiare");

  document.getElementById("rep-criticita-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const prob = f.problema.value.trim();
    const sol = f.soluzione.value.trim();
    if (!prob) return;
    state.reportData.criticita = state.reportData.criticita || [];
    state.reportData.criticita.push({ problema: prob, soluzione: sol });
    f.reset();
    saveReport();
    renderReportLists();
  });
  document.getElementById("rep-chiare-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    const prob = f.problema.value.trim();
    const sol = f.soluzione.value.trim();
    if (!prob) return;
    state.reportData.cose_poco_chiare = state.reportData.cose_poco_chiare || [];
    state.reportData.cose_poco_chiare.push({ problema: prob, soluzione: sol });
    f.reset();
    saveReport();
    renderReportLists();
  });

  // Narrative
  const narrativeEl = document.getElementById("rep-narrative");
  if (narrativeEl) {
    narrativeEl.value = state.reportData.narrative_summary || "";
    narrativeEl.addEventListener("input", () => {
      state.reportData.narrative_summary = narrativeEl.value;
      debounceSaveReport();
    });
  }

  // Suggerimenti rapidi
  function renderSuggestions() {
    const crit = (state.reportSuggestions || []).filter((s) => s.category === "criticita");
    const chia = (state.reportSuggestions || []).filter((s) => s.category === "cose_poco_chiare");
    function suggHtml(s) {
      return `<li>
        <button data-sugg-id="${s.id}" class="w-full rounded-md border border-nx-gray-light/30 bg-white px-2 py-2 text-left text-[11px] transition hover:border-nx-cyan hover:bg-nx-cyan-light">
          <strong class="text-nx-dark">${esc(s.problema)}</strong>
          <span class="block text-nx-cyan">→ ${esc(s.soluzione)}</span>
        </button>
      </li>`;
    }
    const c1 = document.getElementById("sugg-criticita");
    const c2 = document.getElementById("sugg-chiare");
    if (c1) c1.innerHTML = crit.map(suggHtml).join("");
    if (c2) c2.innerHTML = chia.map(suggHtml).join("");
  }
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-sugg-id]");
    if (!btn) return;
    const s = (state.reportSuggestions || []).find((x) => x.id === btn.dataset.suggId);
    if (!s) return;
    const key = s.category === "criticita" ? "criticita" : "cose_poco_chiare";
    state.reportData[key] = state.reportData[key] || [];
    // Skip se già presente con stesso problema
    if (state.reportData[key].some((e) => e.problema === s.problema)) {
      alert("Già aggiunto al report.");
      return;
    }
    state.reportData[key].push({ problema: s.problema, soluzione: s.soluzione });
    saveReport();
    renderReportLists();
    // feedback visivo
    btn.classList.add("bg-emerald-50", "border-emerald-300");
    setTimeout(() => btn.classList.remove("bg-emerald-50", "border-emerald-300"), 600);
  });

  // ============ COPY GRADIMENTO URL ============
  document.getElementById("copy-gradimento-url")?.addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const code = document.getElementById("gradimento-url")?.textContent?.trim();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      const orig = btn.textContent;
      btn.textContent = "✓ Copiato";
      setTimeout(() => { btn.textContent = orig; }, 1500);
    } catch {
      // Fallback
      const range = document.createRange();
      range.selectNode(document.getElementById("gradimento-url"));
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      document.execCommand("copy");
      window.getSelection().removeAllRanges();
    }
  });

  // ============ RENAME TEAMS (session-level override) ============
  const renameTeamsBtn = document.getElementById("rename-teams-btn");
  const renameTeamsModal = document.getElementById("rename-teams-modal");
  const renameTeamsForm = document.getElementById("rename-teams-form");
  renameTeamsBtn?.addEventListener("click", () => {
    renameTeamsModal.classList.remove("hidden"); renameTeamsModal.classList.add("flex");
  });
  document.getElementById("rename-teams-cancel")?.addEventListener("click", () => {
    renameTeamsModal.classList.add("hidden"); renameTeamsModal.classList.remove("flex");
  });
  renameTeamsModal?.addEventListener("click", (e) => {
    if (e.target === renameTeamsModal) { renameTeamsModal.classList.add("hidden"); renameTeamsModal.classList.remove("flex"); }
  });
  document.getElementById("rename-teams-reset")?.addEventListener("click", async () => {
    if (!confirm("Ripristinare i nomi default del gioco?")) return;
    await fetch(`/api/playtest/sessions/${state.sessionId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamsOverride: null }),
    });
    window.location.reload();
  });
  renameTeamsForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputs = renameTeamsForm.querySelectorAll("[data-team-name]");
    const teamsNew = Array.from(inputs).map((inp, i) => ({ name: inp.value.trim() || `Squadra ${i + 1}` }));
    await fetch(`/api/playtest/sessions/${state.sessionId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamsOverride: teamsNew }),
    });
    window.location.reload();
  });

  // ============ INITIAL RENDER ============
  function renderAll() {
    renderPlayers();
    renderTurnOrder();
    renderTurns();
    renderPhases();
    renderChecklist();
    renderPointsContainer();
    renderObservations();
    renderOmni();
    renderReportLists();
    renderSuggestions();
    updateTimerDisplay();
  }
  renderAll();
})();
