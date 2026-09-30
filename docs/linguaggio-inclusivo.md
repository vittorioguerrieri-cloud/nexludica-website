# Linguaggio inclusivo — guida per il sito NexLudica

Strategia adottata: **riformulazione neutra prima, schwa solo dove serve davvero**.

Lo schwa (`ə`, `ɜ`) è uno strumento espressivo ma ha costi di accessibilità (screen reader incoerenti) e SEO (motori non lo riconoscono). Quindi lo usiamo con parsimonia, preferendo formulazioni che siano naturalmente neutre.

---

## Regola 1 — Riformulare neutralmente (default)

Sostituire le forme con genere grammaticale con **persone + aggettivo** o con **chi + verbo**:

| Termine con genere | Riformulazione neutra |
|---|---|
| i soci, i soci e le socie | **le persone socie**, **chi è sociə** |
| il socio (singolare) | **la persona socia**, **chi si iscrive** |
| collaboratori | **persone collaboratrici**, **chi collabora** |
| volontari | **persone volontarie**, **chi fa volontariato** |
| ricercatori | **chi fa ricerca**, **persone che fanno ricerca** |
| appassionati | **persone appassionate** |
| amministratori | **chi amministra**, **admin** (resta) |
| fondatori | **chi ha fondato l'associazione** |
| associati | **persone iscritte**, **chi e' iscrittə** |
| benvenuto/a | **ti diamo il benvenuto**, **che bello vederti qui** |
| cari soci (apertura email) | **ciao**, **salve** |
| tutti i [maschile] | **tutte le [neutro plurale]**, **chiunque**, **ognunə** |

### Esempi di riscrittura

- ❌ "Diventa socio di NexLudica" → ✅ "Iscriviti a NexLudica"
- ❌ "Sei un socio?" → ✅ "Fai parte di NexLudica?"
- ❌ "Il socio puo' modificare il profilo" → ✅ "Chi e' iscrittə puo' modificare il profilo"
- ❌ "Tutti gli iscritti ricevono una mail" → ✅ "Chi si iscrive riceve una mail"
- ❌ "Gruppo di appassionati e ricercatori" → ✅ "Gruppo di persone appassionate — chi fa ricerca, chi disegna giochi..."
- ❌ "Un membro del consiglio" → ✅ "Il consiglio direttivo" (di solito basta)

---

## Regola 2 — Schwa solo se la riformulazione e' goffa

Casi in cui la riformulazione neutra appesantisce molto la frase o crea ambiguita': usiamo schwa.

**Schwa singolare** `ə` (U+0259): per soggetto/oggetto individuale.
**Schwa lunga** `ɜ` (U+025C): per plurale, per distinguerlo dal singolare.

Esempi accettabili:
- Badge / etichette di sistema corti: `Sociə`, `Collaboratorə`, `Ex sociə`
- Microcopy form: "Ti sei appena iscrittə?", "Confermato/a → Confermatə"
- Concatenazioni dove "persona X" suona artificioso e ripetitivo: "tuttɜ sono in regola"

**Quando NON usare schwa:**
- Testi lunghi descrittivi → meglio riformulazione neutra
- SEO-critical pages (title, meta description, h1 principali) → riformulazione neutra
- Email transazionali (i client la rendono in modi diversi) → riformulazione neutra

---

## Regola 3 — Termini legali tecnici restano invariati

Sono **nomi propri** di documenti / strumenti previsti dalla legge:

- ✅ **Libro soci** (D.Lgs. 117/2017 art. 15) — non si cambia
- ✅ **Registro volontari** (CTS art. 17) — il REGISTRO mantiene il nome, ma il link del menu puo' essere "Registro volontariato" (azione, non persone)
- ✅ **Codice del Terzo Settore**, **Codice Fiscale** — nomi propri
- ✅ **Statuto associativo** — termine giuridico, neutro per fortuna
- ✅ **Consiglio direttivo** — termine giuridico, neutro

---

## Regola 4 — Area soci, "soci" nei path URL

I path URL `/area-soci`, `/area-soci/admin/libro-soci` sono **identificatori tecnici** e restano cosi'. L'utente non li vede direttamente, e cambiarli rompe link esistenti.

Le **label visibili** nel menu / nei titoli pagina seguono la riformulazione neutra:
- Path: `/area-soci` → Label visibile: "Area soci" (accettabile come nome dell'area, non descrive persone)
- Path: `/area-soci/admin` → Label: "**Persone iscritte**" (era "Soci e collaboratori")
- Path: `/area-soci/admin/libro-soci` → Label: "**Libro soci**" (resta, termine legale)

---

## Regola 5 — Frasi con destinatario al singolare (form, microcopy)

Italiano femminile/maschile concordato → preferire forme verbali, infiniti, sostantivi neutri.

- ❌ "Inserisci il tuo nome" → in realta' "il tuo" e' neutro grammaticalmente, va bene
- ❌ "Sei sicuro/a?" → ✅ "Vuoi davvero procedere?" oppure "Sei certə?" (schwa)
- ❌ "Sei stato disconnesso" → ✅ "Hai effettuato il logout"

---

## File toccati in questo round (riferimento)

- `src/pages/chi-siamo.astro`
- `src/pages/meetludica.astro`
- `src/pages/progetti.astro`
- `src/pages/iscrizione/index.astro` + `grazie.astro`
- `src/pages/supportaci.astro`
- `src/pages/login.astro`
- `src/layouts/AreaSociLayout.astro`
- `src/pages/area-soci/admin/index.astro` + `nuovo.astro` + `[id].astro` + `quote.astro`

---

## Quando aggiungi testi nuovi

1. Prova prima la **riformulazione neutra**.
2. Se non funziona naturalmente, usa lo **schwa**.
3. Mai mischiare schwa e barra "/" o "*" nello stesso pezzo di testo.
4. Per i **termini legali** consulta lo Statuto / CTS prima di cambiare nomi.
