# Report di ergonomia cognitiva — Piattaforma di playtest NexLudica

**Versione:** 1.0 · **Data:** 2026-05-23
**Autori:** Audit interno NexLudica APS · Vittorio Guerrieri
**Scope:** `playtest.nexludica.org`, in particolare la procedura di playtest live

---

## 1. Cornice teorica

L'analisi adotta la prospettiva dell'**ergonomia cognitiva**: progettare l'interazione
per ridurre il carico cognitivo non-essenziale, ridistribuire l'attenzione verso
ciò che conta davvero, e supportare l'osservatore *in situazione*. Quattro
costrutti guidano la valutazione:

1. **Cognitive load theory** (Sweller). Distinguiamo:
   - *Intrinsic load* — complessità irriducibile del compito (es. cronometrare,
     valutare item Likert, tenere a mente lo stato del gioco).
   - *Extraneous load* — costo aggiunto dalla UI (navigazione, ricerca di
     funzioni, label ambigue).
   - *Germane load* — fatica produttiva che costruisce schemi (es. imparare
     che SPAZIO = prossimo turno).
   Obiettivo del design: **minimizzare l'extraneous, scaricare l'intrinsic
   sul sistema, lasciare spazio al germane.**

2. **Hick's law**. Il tempo di scelta cresce logaritmicamente col numero di
   opzioni; pochi pulsanti significativi battono molti pulsanti generici.

3. **Working memory** (Baddeley/Miller). Capacità ~4-7 chunk in parallelo.
   Tutto ciò che il sistema *visualizza in modo persistente* sgrava la memoria
   di lavoro.

4. **Norman's seven stages of action**. Goal → Plan → Specify → Perform →
   Perceive → Interpret → Compare. I "gulf of execution" (cosa devo fare per
   ottenere X?) e "gulf of evaluation" (è successo X?) sono i punti di attrito
   tipici.

---

## 2. Profilo del compito: la sessione di playtest dal vivo

Durante una sessione di playtest l'osservatore svolge **in parallelo** queste
attività:

| Sotto-compito | Frequenza | Modalità sensoriale |
|---|---|---|
| Osservare il gioco fisico sul tavolo | continuo | visuale + uditivo |
| Cronometrare i turni | discreto (uno per giocatore) | manuale |
| Tracciare i punti | discreto (per turno o evento) | manuale + cognitivo |
| Annotare osservazioni libere | sporadico | manuale + verbale |
| Compilare checklist osservative | una volta per fase (Inizio/Fine/Partecipata) | manuale + cognitivo |
| Coordinarsi con altri osservatori | sporadico | sociale |

L'osservatore è in **multitasking sequenziale rapido**: gli switch costano
attenzione. La UI deve **minimizzare la durata e il numero degli switch**.

---

## 3. Audit: criticità identificate

Audit condotto su `playtest.nexludica.org/sessioni/<id>` con i due giochi in
sviluppo (Monk-y Business in modalità individuale; WarFables in modalità a
squadre).

### 3.1 Frammentazione spaziale del compito

**Problema.** Le funzionalità della sessione sono distribuite su 5 tab:
*Cronometro*, *Sempre sottocchio*, *Checklist*, *Debriefing*, *Giocatori*.
Durante la partita l'osservatore deve cambiare tab per:
- aggiungere un giocatore arrivato in ritardo (→ tab Giocatori)
- annotare una variabile invisibile (→ tab Sempre sottocchio)
- iniziare una checklist a metà partita (→ tab Checklist)

Ogni cambio costa ~1 secondo di motion + ~3 secondi di re-orientamento visivo
e perdita potenziale di un evento osservativo.

**Diagnosi cognitiva.** *Extraneous load* da context-switch + interruzione del
filo osservativo (Salvucci & Taatgen, threaded cognition).

### 3.2 Scorrimento e perdita del riferimento temporale

**Problema.** Sulla tab Cronometro, scorrendo verso il basso per controllare
lo storico turni, il **display del timer scompare**. Il tempo passa ma
l'osservatore non lo vede.

**Diagnosi cognitiva.** Violazione del principio di *visibility of system
status* (Nielsen). L'osservatore deve scrollare su per verificare il tempo,
operazione che interrompe l'attenzione visiva sul tavolo di gioco.

### 3.3 Hot-keys nascoste

**Problema.** La barra spaziatrice esegue l'azione più frequente (salva turno
+ avanza al prossimo giocatore). La hint è scritta in piccolo sotto il timer.
Esiste, ma non è scopribile passivamente.

**Diagnosi cognitiva.** *Hidden affordance*. Una funzione critica è
"raccontata" ma non "mostrata". Inoltre dopo SPAZIO non c'è feedback visivo
chiaro del "salto" — solo il nome del giocatore corrente cambia silenziosamente.

### 3.4 Hick's law sui punti

**Problema.** I bottoni rapidi per i punti sono 6 (`-1`, `+1`, `+2`, `+3`,
`+5`, `+10`) più un campo custom. Per giochi semplici questo è **sovra-
fornito**; per giochi complessi è **sotto-configurabile** (es. WarFables ha
punti che variano per categoria di azione).

**Diagnosi cognitiva.** Le scelte sono troppe quando non servono, e non
configurabili per gioco. Effetto: ogni assegnazione punto costa più tempo
del necessario.

### 3.5 Discoverability del drag-and-drop

**Problema.** L'ordine di turno è riordinabile via drag-and-drop usando il
manico "≡" a sinistra di ogni riga. Senza tooltip / cursor change esplicito
l'utente nuovo non sa di poterlo fare.

**Diagnosi cognitiva.** Il *signifier* (Norman) è debole. L'icona "≡" è
convenzionalmente associata al drag in mobile/web design moderno, ma non c'è
garanzia che l'osservatore lo conosca.

### 3.6 Identità degli osservatori (multi-utente)

**Problema.** Quando 2+ soci collaborano sulla stessa sessione, i loro dati
si mescolano nelle liste (turni, OMNI, osservazioni). Da poco è stata aggiunta
l'attribuzione "by <nome>" ma è discreta.

**Diagnosi cognitiva.** Bassa *salience* dell'attribuzione. Difficile capire
"chi ha visto cosa" durante la sessione.

### 3.7 Ambiguità Stop/Skip/Reset

**Problema.** Sotto il timer ci sono 5 bottoni: ▶ Prossimo · ⏸ Pausa ·
⏹ Stop & salva · Salta · Reset. La differenza tra Skip e Stop&Save non è
ovvia (uno salta senza salvare, l'altro salva senza avanzare).

**Diagnosi cognitiva.** Gulf of execution: l'utente sa cosa vuole ("non
voglio più cronometrare Marco") ma non sa quale bottone realizzi
esattamente l'intento. Rischio di errore con conseguenze (perdere il turno
o duplicarlo).

### 3.8 Prompt browser-modal "Nome osservatore"

**Problema.** Per creare un'istanza di checklist appare un `prompt()` del
browser che chiede il nome osservatore. Brutale visivamente, non auto-fillato.

**Diagnosi cognitiva.** Interrompe il flusso e richiede digitazione su un
campo prevedibile. Una *smart default* eliminerebbe lo step.

### 3.9 Sempre sottocchio nascosto

**Problema.** Il pannello "Sempre sottocchio" — proprio quello pensato per
l'osservazione continua — è dietro una tab dedicata che richiede di lasciare
il timer. Paradosso: lo strumento per *non staccare gli occhi dal tavolo*
costringe a staccarli dalla UI principale.

**Diagnosi cognitiva.** Mismatch fra **scopo dichiarato** della funzione e
**collocazione spaziale**. (Già segnalato dall'utente nelle iterazioni
precedenti.)

### 3.10 Gulf of evaluation post-firma

**Problema.** Dopo aver salvato un turno con SPAZIO, l'osservatore non vede
una conferma chiara: il timer si azzera, i punti tornano a 0, il giocatore
nell'header cambia. Sono tre micro-eventi simultanei senza ancoraggio
visivo dominante.

**Diagnosi cognitiva.** Violazione del *feedback principle*. Domanda
inconscia: "è andato a buon fine? è il giocatore giusto?".

### 3.11 Round counter manuale ma con autoavanzamento

**Problema.** Il round è un campo numerico modificabile. C'è anche una
checkbox "avanza round automaticamente a fine giro". L'utente può
*disabilitare* l'auto-advance e dimenticarsi di incrementare manualmente.

**Diagnosi cognitiva.** *Configuration overhead* — una scelta che la
maggior parte degli utenti non avrà mai bisogno di rivisitare.

---

## 4. Interventi implementati in questa iterazione

Tutti gli interventi sono già live su `playtest.nexludica.org`.

### 4.1 Timer sticky in alto durante lo scroll *(criticità 3.2)*

Su viewport ≥ 1024px il card del cronometro resta agganciato in alto
(`position: sticky; top: 12px`) mentre l'osservatore scrolla per consultare
storico turni o classifica. Il **system status** (tempo, giocatore corrente,
round) è ora **sempre visibile**.

**Costo cognitivo eliminato**: 1 scroll-up ogni controllo del tempo (~2-4
volte al minuto in fasi attive). Su una sessione di 60 minuti → ~120
movimenti oculari + motori risparmiati.

### 4.2 Feedback visivo dopo SPAZIO *(criticità 3.10, 3.3)*

Al passaggio di turno, due animazioni convergenti:
- Il nuovo giocatore corrente nell'ordine turno fa flash con sfondo ciano
  per 700ms (animazione `nx-flash-bg`).
- Il nome del giocatore corrente sotto il timer riceve uno shadow ciano
  + colore bianco temporaneo (`nx-flash-color`).

Conseguenza: il sistema risponde alla pressione di SPAZIO con un evento
*pre-attentivo* che chiude il gulf of evaluation senza richiedere
attenzione focale.

### 4.3 Quick-add giocatore inline *(criticità 3.1)*

Nella sidebar dell'Ordine turno è stato aggiunto un `<details>` collassato
"+ Aggiungi giocatore". Espandendolo si apre un form minimal con nome +
ruolo + (se team game) squadra. Niente tab-switch.

Conseguenza: il caso più frequente di context-switch *durante la sessione*
(giocatore in ritardo, sostituzione, errore di immissione iniziale) viene
risolto **in place**.

### 4.4 Auto-fill nome osservatore checklist *(criticità 3.8)*

Il prompt() del browser ora pre-compila il nome del socio loggato (`Vittorio`,
`Raluca`, ecc.) leggendolo dalla lista `state.collaborators`. L'osservatore
può confermare con Enter o modificare se compila per conto terzi.

### 4.5 "Report" sempre raggiungibile in header *(criticità 3.1 minore)*

Il bottone "Report ↗" è stato spostato dalla tab Debriefing all'**header
della sessione**, accanto a "Stampa OMNI" e "Concludi". Disponibile da
qualunque tab senza navigazione.

### 4.6 Cursor `grab` sul drag handle *(criticità 3.5)*

Il manico "≡" ora cambia cursore in `grab` su hover e `grabbing` durante
il drag. *Affordance* visiva esplicita che comunica la possibilità di
trascinamento.

### 4.7 Microscopia: hint SPAZIO inline nella sidebar *(criticità 3.3)*

L'hint nell'Ordine turno ora dice esplicitamente:
> "Trascina per riordinare. `SPAZIO` = prossimo. Quando completa il giro, il
> round avanza."

Tutto in un'unica frase, accanto alla lista. Il signifier `<kbd>` rende
visibile che SPAZIO è una scorciatoia.

---

## 5. Criticità residue (priorità per le prossime iterazioni)

### 5.1 Sempre sottocchio come pannello flottante *(criticità 3.9)*

**Intervento proposto.** Replicare il pannello "Sempre sottocchio" come
*floating sidebar* o *bottom drawer* sempre visibile sopra qualunque tab,
con stato collassabile. L'osservatore può annotare una variabile invisibile
o una lamentela *senza lasciare la tab Cronometro*.

**Rischio.** Occupa spazio orizzontale e richiede CSS responsive accurato.
Su mobile va trattato come sheet bottom collassabile.

### 5.2 Configurabilità dei bottoni punti *(criticità 3.4)*

**Intervento proposto.** Spostare l'array dei valori rapidi dei punti
(`[-1, +1, +2, +3, +5, +10]`) nella `procedure_config` del gioco. Il game
designer setta i valori che ha senso per il suo gioco (es. per WarFables:
`[+1, +3, +5, +10, +15]`; per Monk-y: `[+1, +2, +3]`).

### 5.3 Differenziazione visuale Skip/Stop/Reset *(criticità 3.7)*

**Intervento proposto.**
- **Stop & salva** → primario verde (a destra del Prossimo)
- **Salta** → secondario, separato, e con tooltip "Avanza senza salvare
  il turno corrente"
- **Reset** → grigio piccolo, in fondo, con conferma più aggressiva

Pattern di gerarchia visiva *primario / secondario / tertiary*.

### 5.4 Attribuzione multi-osservatore più visibile *(criticità 3.6)*

**Intervento proposto.** Codifica colore stabile per ogni osservatore
attivo nella sessione (es. Vittorio = ciano, Raluca = viola). Il colore
appare come *border-left* sui turni, sulle OMNI e sulle osservazioni
registrate. La timeline diventa leggibile in un colpo d'occhio.

### 5.5 Round automatico di default *(criticità 3.11)*

**Intervento proposto.** Rimuovere la checkbox "Avanza round automaticamente
a fine giro". Il comportamento di default è auto-advance; l'override manuale
si fa cliccando sul numero del round e modificandolo (rarissimo). Riduce
configuration overhead.

### 5.6 Smart-defaults sulla pagina sessione vuota

**Intervento proposto.** Al primo caricamento di una sessione senza giocatori,
mostrare un **wizard breve a 3 step**:
1. Aggiungi i giocatori (con import "Stesso roster dell'ultima sessione di
   questo gioco?")
2. Conferma ordine turno
3. Pronto al gioco

Riduce *gulf of execution* sul primo utilizzo.

### 5.7 Debriefing OMNI: input multi-author più ergonomico

**Intervento proposto.** Sulla tab Debriefing, la trascrizione delle tavole
OMNI dei giocatori beneficerebbe di:
- *Autore default* nel browser session storage (chi sta trascrivendo)
- *Tab-key navigation* fluida tra le 4 colonne (Ottimo / Modificare /
  Non chiaro / Idee nuove)
- *Bulk paste*: incollare una lista di commenti separati da newline e
  far creare un'entry per ciascuno

### 5.8 Stato sessione esplicito

**Intervento proposto.** Aggiungere un bottone primario "▶ Inizia
sessione" prominente sull'header quando lo stato è `planned`. Avvia il
timer della prima fase + setta `status = in_progress`. La pipeline
diventa: planned → in_progress → completed (e tutte le UI riflettono
questo stato esplicitamente).

---

## 6. Indicatori da monitorare

Per validare empiricamente gli interventi, suggeriamo di raccogliere:

| Indicatore | Metodo | Soglia di soddisfazione |
|---|---|---|
| Tempo medio per turno cronometrato | Server-side (delta tra turni successivi) | < tempo intrinseco del gioco × 1.05 |
| N. cambi-tab per minuto durante sessione | Client telemetria (opt-in) | < 1 / minuto |
| % turni con punti `null` | Aggregato sui turni | < 5% (indice di "menate") |
| Tempo da SPAZIO a "salvataggio confermato" percepito | Test con thinking-aloud (3 osservatori) | < 800ms percepiti come "istantaneo" |
| N. errori di attribuzione punti (Skip vs Stop) | Self-report osservatori a fine sessione | 0 per sessione |
| Soddisfazione System Usability Scale (SUS) | Questionario a fine sessione | > 75 (above-average) |

---

## 7. Conclusione

La piattaforma di playtest NexLudica nasce dall'unione di una pratica
empirica già consolidata (le tavole OMNI cartacee, i fogli Excel di
cronometraggio, le checklist osservative) con un'infrastruttura digitale
che cerca di **non sostituire l'osservatore ma scaricarne la memoria di
lavoro**.

Gli interventi descritti nella sezione 4 hanno ridotto significativamente
l'extraneous load del compito principale (cronometrare + annotare). Le
criticità della sezione 5 rappresentano la prossima generazione di
miglioramenti, con focus su:

- **persistenza visiva del system status** (timer, current player, sempre
  sottocchio);
- **configurabilità per gioco** (punti, fasi, ordine);
- **flussi multi-osservatore** chiari e tracciabili.

L'obiettivo a tendere è una piattaforma in cui l'osservatore, dopo 10
minuti di familiarizzazione, possa **dimenticarsi della UI** e tornare a
guardare il tavolo di gioco — che è il vero strumento di ricerca.

---

*Documento interno NexLudica APS · v1.0 · 2026-05-23*
*Game · Research · Equity*
