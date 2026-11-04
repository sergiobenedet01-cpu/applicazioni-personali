# WIPS

WIPS (What-If Portfolio Simulator) è una dashboard personale statica per
analizzare portfolio, P&L, scenari What-If, Budget e Allocazione.

L'app non richiede build, backend, account applicativi o dipendenze npm:
funziona come una pagina HTML statica ed è pubblicata su GitHub Pages.

## Avvio locale

1. Apri `WIPS.html` nel browser.
2. Inserisci o verifica i prezzi nelle sezioni disponibili.
3. Le modifiche al portfolio, ai prezzi e al Budget vengono conservate nel
   browser corrente tramite `localStorage`.

Per eseguire gli script di aggiornamento locali serve Node.js 18 o successivo.
Controlla la versione con:

```sh
node --version
```

Prima di una pubblicazione o dopo una modifica al codice, esegui il controllo
locale in sola lettura:

```sh
node verify-wips.js
```

Il verificatore non modifica file, non usa la rete e non accede ai dati salvati
nel browser. Controlla file essenziali, sintassi e coerenza minima dei dati
iniziali.

## Struttura essenziale

```text
WIPS.html                         Interfaccia e logica dell'app
WIPS-data.js                      Portfolio e prezzi iniziali/fallback
WIPS-allocation-lab.js            Ranking e console simulativa di Allocazione
WIPS-allocation-lab.css           Stili della sezione Allocazione
WIPS-mobile.js                    Renderer della modalità Mobile (stesso stato e calcoli)
WIPS-mobile.css                   Stili touch della modalità Mobile
verify-wips.js                    Controllo locale in sola lettura
update-wips-crypto-prices.js      Updater locale delle quotazioni crypto
update-wips-etf-prices.js         Updater locale manuale delle quotazioni ETF
```

`WIPS-data.js` contiene solo i valori iniziali. Le modifiche effettuate nella
pagina vivono nel `localStorage` del browser e hanno precedenza al reload.

## Modalità Desktop e Mobile

Nel selettore visibile nell'header puoi scegliere **Desktop** o **Mobile**.
La preferenza viene memorizzata soltanto nel browser corrente con la chiave
`wips_layout_mode_v1`: non modifica portfolio, prezzi, backup o file sorgente.
Al primo utilizzo WIPS propone Mobile sotto i 760 px; dopo una scelta esplicita
rispetta sempre quella scelta anche dopo il reload.

La modalità Mobile usa le stesse posizioni, quotazioni, `calc()`, What-If,
copy dei valori e persistenza della vista Desktop. Sostituisce solo la
presentazione: header di sintesi, card espandibili per gli asset, pannelli
Portfolio / What-If / Analisi / Strumenti e controlli touch da almeno 44 px.
Budget, Allocazione, editor, backup e CSV restano tutti
raggiungibili dal pannello **Strumenti** e si aprono nella vista Desktop
completa, evitando di nascondere funzioni o creare una seconda logica.

## Allocazione

Il tab **🧭 Allocazione** è il punto unico per confrontare ranking Globale,
Crypto e ETF e simulare come distribuire una liquidità scelta dall'utente.
Permette di confrontare:

- ranking filtrabile con i criteri WIPS esistenti;
- distanza dal P.M. e impatto stimato sul nuovo P.M.;
- peso attuale e peso dopo il piano;
- limite di concentrazione per singola posizione;
- mix Crypto/ETF post-piano, matrice opportunità × rischio e piano a tranche;
- obiettivo di capitale storico per una posizione.

Il modulo è intenzionalmente separato dal What-If principale: non modifica
posizioni, prezzi, Budget, CSV, backup, Kraken o dati in
`WIPS-data.js`. Salva solo la bozza del piano e le preferenze nel proprio
`localStorage` (`wips_allocation_lab_v1`).

La mappa di liquidità è raggruppata in categorie espandibili. Ogni riepilogo
mostra numero strumenti, peso attuale e post-piano, scostamento e quota
suggerita del piano simulato.

Gli score e i livelli a tranche sono regole trasparenti di simulazione, non
previsioni di mercato, segnali di acquisto né consulenza finanziaria. Ogni
importo resta modificabile e i numeri visualizzati possono essere copiati con
un click, come nelle tabelle del portfolio.

## Backup locale completo

Il pulsante **💾 Backup** nell'header scarica un file JSON con portfolio,
prezzi, metadati crypto, confronti Trade Republic, Budget e importo What-If
attuale. L'export legge soltanto lo stato: non modifica il browser, i dati
iniziali o GitHub.

Conserva il file in un luogo privato: contiene i dati finanziari personali
presenti nel browser.

Il pulsante **📥 Ripristina** apre un'anteprima del file selezionato e abilita
il ripristino solo per backup WIPS compatibili. Portfolio, prezzi, metadata
crypto, confronti Trade Republic e Budget sono validati prima della conferma
finale. Un file corrotto, incompleto o di versione incompatibile non modifica
mai i dati attuali.

## Prezzi crypto

Nella pagina è disponibile il pulsante **Aggiorna Kraken**. Recupera le
quotazioni EUR pubbliche delle crypto e aggiorna lo stato locale della pagina.
In caso di rete assente o risposta non valida, WIPS conserva il prezzo già
presente.

Per aggiornare il fallback nel file sorgente, dalla cartella `WIPS`:

```sh
node update-wips-crypto-prices.js --dry-run
node update-wips-crypto-prices.js
```

Il primo comando mostra le differenze senza scrivere file. Il secondo modifica
solo le quotazioni crypto in `DEFAULT_PRICES`; non modifica quantità, P.M.,
portfolio, GitHub o Git.

## Prezzi ETF: updater locale manuale

L'aggiornamento ETF resta un flusso **manuale e locale**. Non è presente né
prevista alcuna automazione ETF nel browser o su GitHub Pages.

Per simulare o applicare l'aggiornamento dei fallback ETF EUR:

```sh
node update-wips-etf-prices.js --dry-run
node update-wips-etf-prices.js
```

Lo script richiede che tutte le quotazioni Xetra attese siano valide prima di
scrivere. Se anche una sola quotazione non è disponibile o non supera i
controlli, annulla l'operazione e conserva `WIPS-data.js` invariato.

I prezzi possono differire da Trade Republic per mercato, orario, spread e
modalità di esecuzione. Lo script non accede a Trade Republic e non usa
credenziali, token o cookie.

## Dati locali e prudenza

- `localStorage` è separato per portfolio/prezzi, metadata crypto, confronto
  Trade Republic, Budget e Allocation Lab.
- Cancellare i dati del sito dal browser può rimuovere le personalizzazioni
  locali. Prima di farlo, usa **💾 Backup** per esportare un JSON completo.
- Non modificare direttamente `WIPS-data.js` mentre la pagina è aperta se
  desideri confrontare i fallback: il browser può già avere dati locali più
  recenti.

## Pubblicazione GitHub Pages

Il sito pubblico viene servito dalla root del branch `main` del repository
GitHub. Per pubblicare una modifica già verificata:

```sh
git status
git add WIPS/<file-modificato>
git commit -m "Descrizione concisa della modifica"
git push origin main
```

GitHub Pages pubblica normalmente pochi minuti dopo il push. Verifica il sito
in una finestra privata o con un hard refresh se il browser mantiene file in
cache.

Non includere mai nel commit file personali, backup temporanei, credenziali o
dati non correlati a WIPS.

## Release, tag e rollback

Ogni intervento WIPS deve produrre un commit piccolo e con un solo scopo. Prima
di creare il commit, controlla esplicitamente i file coinvolti:

```sh
git status
git diff -- WIPS/
git diff --check
git add WIPS/<file-modificato>
git diff --cached
```

Quando un insieme di commit è stato verificato anche sul sito pubblicato, crea
un tag annotato per avere un punto di ritorno chiaro:

```sh
git tag -a wips-AAAA.MM.GG -m "Release WIPS verificata"
git push origin main --follow-tags
```

Sostituisci `AAAA.MM.GG` con la data effettiva della release. Il tag si crea
solo dopo una verifica riuscita; non è necessario per ogni singolo commit.

Se una modifica già pubblicata causa una regressione, non usare `reset --hard`
e non riscrivere la cronologia pubblicata. Ripristina invece con un commit
reversibile:

```sh
git log --oneline
git revert <hash-del-commit-da-annullare>
git push origin main
```

Per tornare a una release nota, individua prima il tag con `git tag --list` e
verifica il diff. Un rollback deve sempre essere seguito dalla stessa checklist
funzionale usata per la release.

## Verifiche prima della pubblicazione

Controllare almeno:

1. apertura di `WIPS.html` senza errori;
2. Portfolio, What-If, Allocazione e Budget;
3. salvataggio e reload della pagina;
4. esportazione CSV;
5. passaggio Desktop ↔ Mobile, reload e What-If in entrambe le viste;
6. aggiornamento crypto o relativo fallback;
7. `git diff --check` e revisione del diff;
8. `git status` per escludere modifiche non correlate.

Uno script di verifica locale dedicato verrà aggiunto nella Fase 3 della
roadmap.

## Limiti intenzionali

WIPS è un'app personale statica. Non include backend, database, login,
sincronizzazione cloud, framework frontend o automazione ETF. Queste scelte
mantengono l'app semplice, gratuita e compatibile con GitHub Pages.
