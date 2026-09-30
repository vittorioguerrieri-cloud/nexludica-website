# NexLudica Research — Linee guida per la creazione dei questionari

Standard di design **obbligatori** per ogni nuovo questionario sulla Research
Platform di nexludica.org. Servono a:

- Mantenere validità psicometrica delle misure
- Garantire UX coerente fra studi
- Minimizzare i bias indotti dall'interfaccia (mobile in particolare)

> Quando crei o modifichi un questionario, verifica che lo schema SurveyJS
> rispetti tutto quanto segue. Se qualcosa non e' compatibile con il rendering
> automatico, aggiungere il fix lato CSS/JS in
> `src/pages/research/[study]/[questionnaire].astro`.

---

## 1. Scale Likert / matrici — niente scroll orizzontale

**Regola assoluta**: nessuna scala Likert deve richiedere scroll orizzontale
su mobile. Lo scroll orizzontale induce **left-anchor bias** (l'utente sceglie
fra le opzioni visibili senza confrontare l'intera scala).

### Cosa fa la piattaforma automaticamente

Per ogni `matrix`, `matrixdropdown`, `matrixdynamic`:

- Desktop (>768px): tabella standard, riga = item, colonne = scala
- Mobile (≤768px): ogni riga diventa una **card stackata verticalmente**, con:
  - prompt dell'item come label della card
  - ogni opzione della scala come riga separata con etichetta inline
    (es. "◯ Per nulla", "◯ Poco", "◯ Abbastanza", "◯ Molto")

L'iniezione delle etichette di colonna avviene via JS (`setupMobileMatrix`) +
CSS (`[data-col-label]::before`).

### Cosa fare quando crei una matrice

- Usa SEMPRE il tipo `matrix` (non `matrixdropdown` per Likert semplici).
- `columns` puo' essere array di stringhe oppure di `{value, text}`. Entrambi
  vengono letti correttamente dal codice di responsive.
- Mantieni un numero di colonne **fra 4 e 7** (best practice psicometrica).
- Mai piu' di ~15 righe per matrice (altrimenti spezza in piu' matrici).

---

## 2. Progress bar non navigabile

La progress bar mostra l'avanzamento ma **NON e' cliccabile**.
Motivazione: vogliamo che l'utente passi attraverso tutte le pagine in ordine,
senza saltare avanti (cosa che altererebbe la sequenza temporale delle
risposte, fondamentale per misure di carryover/contesto).

Implementazione (gia' attiva nella pagina questionario):

- CSS: `pointer-events: none` su `.sd-progress-buttons*`
- JS: `survey.onCurrentPageChanging` blocca delta > 1 pagina

### Cosa fare quando crei un questionario

- Imposta `progressBarType: "buttons"` se vuoi che si vedano le tappe (la
  navigazione resta bloccata).
- Imposta `showProgressBar: "top"` o `"bottom"`.
- Non aggiungere triggers che permettono jump arbitrari fra pagine.

---

## 3. Sistema di probing per risposte mancate (non obbligatorie)

Quando l'utente clicca "Completa", se ci sono domande **non obbligatorie**
senza risposta:

1. Ogni domanda mancata viene **evidenziata in giallo** (background +
   border-left ambra)
2. Sopra ogni domanda mancata appare un ribbon:
   *"⚠ Non hai fornito una risposta a questa domanda. Vuoi proseguire comunque?"*
3. Compare un banner sticky in fondo viewport con il **count totale** e due
   bottoni:
   - **Sì, invia comunque** → completa il questionario
   - **No, torno indietro** → chiude il banner ma lascia gli highlight visibili
4. Auto-scroll alla prima domanda mancata
5. Se l'utente compila una domanda evidenziata, l'highlight si rimuove
   automaticamente (`onValueChanged`)

### Cosa fare quando crei un questionario

- Imposta `isRequired: true` SOLO sulle domande davvero obbligatorie
  (codice anonimo, consenso). Tutte le altre devono essere skippabili
  consapevolmente: il probing si occupa di rendere consapevole lo skip.
- Evita pattern come "obbligatorio se …" complessi: la presenza/assenza
  di risposta deve essere semanticamente significativa.

---

## 4. Codice anonimo

Ogni studio definisce un `anonymous_code_template` che combina campi identita'
dei rispondenti (es. `{anon_madre}{anon_giorno}{anon_nome}{anon_telefono}`).

### Cosa fare in OGNI questionario di uno studio con codice anonimo

- Prima pagina = **Codice Anonimo** con i campi identita' marcati
  `isRequired: true` (e con i nomi esatti che il template attende).
- Stessi campi, stesso ordine, stesso formato in TUTTI i questionari dello
  studio (T1, T2, T3, T4...). Anche piccole variazioni (lettera vs. cifra,
  trim, lowercase) rompono il matching fra rilevazioni.
- La conversione del codice avviene server-side in
  `src/server/research.ts > buildAnonymousCode()`. Non normalizzare lato client.

---

## 5. Lunghezza, fatica, abbandono

- **Tempo di compilazione target**: 8-15 minuti. Oltre i 20', drop rate >40%.
- Spezza in piu' pagine logiche (una scala = una pagina), non un page-flow
  unico.
- Stima il tempo nel `description` dello studio (es. "circa 10 minuti").
- Per follow-up (T3, T4), accorcia: solo misure variabili nel tempo, mai
  ri-somministrare trait stabili.

---

## 6. Cosa NON includere

- **Scale di orientamento sociale (SVO)** in versione slider/allocazione punti:
  la versione standard richiede 6+ allocazioni di punti che su mobile sono
  inusabili. Se serve misurare l'orientamento sociale, usa la versione a
  scelta forzata (4 items, una colonna) o adatta come Likert.
- **Captcha** o anti-bot: l'IP hash + completion code servono gia' come
  rate-limit lato server.
- **Domande aperte multiple all'inizio**: l'attenzione cala, mettile in fondo
  (es. pagina "Riflessioni" alla fine come fa T2 Game Research).

---

## 7. Workflow per aggiungere/modificare un questionario

1. **Disegna lo schema SurveyJS** rispettando i punti 1-6.
2. **Carica nello studio**:
   - via UI Admin: `nexludica.org/area-soci/research/<studyId>/questionnaires/new`
   - o via SQL/seed file nella cartella `migrations/`.
3. **Verifica responsive su mobile reale** (non solo devtools): apri
   `research.nexludica.org/<studyslug>/<qslug>` su telefono e prova ogni
   pagina, in particolare le matrici.
4. **Test probing**: clicca "Completa" senza rispondere a una domanda
   non-obbligatoria, verifica banner + highlight.
5. **Test invio**: completa una volta end-to-end, verifica che il completion
   code sia generato e la riga sia in `research_responses`.

---

## 8. Modifiche al CSS/JS di base

Se servono cambi di rendering che valgono per TUTTI i questionari,
modificare:

- `src/pages/research/[study]/[questionnaire].astro` — pagina rendering
  (CSS globali sotto `<style is:global>`, JS sotto lo `<script is:inline>`)
- `src/layouts/ResearchLayout.astro` — header/footer comune
- `src/server/research.ts` — logica server (codice anonimo, validazione,
  storage risposte)

**Mai** mettere fix specifici di un singolo questionario nello schema JSON:
se ne hanno bisogno piu' questionari, vanno in piattaforma; se serve solo a
uno e' un segnale di disegno sbagliato.
