# WIPS

WIPS (What-If Portfolio Simulator) è una dashboard personale statica per
analizzare portfolio, P&L, scenari What-If, Budget e Advisor.

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
verify-wips.js                    Controllo locale in sola lettura
update-wips-crypto-prices.js      Updater locale delle quotazioni crypto
update-wips-etf-prices.js         Updater locale manuale delle quotazioni ETF
```

`WIPS-data.js` contiene solo i valori iniziali. Le modifiche effettuate nella
pagina vivono nel `localStorage` del browser e hanno precedenza al reload.

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
  Trade Republic e Budget.
- Cancellare i dati del sito dal browser può rimuovere le personalizzazioni
  locali. Prima di farlo, attendere l'introduzione del backup JSON prevista
  dalla roadmap oppure annotare/esportare manualmente i dati importanti.
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
2. Portfolio, What-If, Advisor e Budget;
3. salvataggio e reload della pagina;
4. esportazione CSV;
5. aggiornamento crypto o relativo fallback;
6. `git diff --check` e revisione del diff;
7. `git status` per escludere modifiche non correlate.

Uno script di verifica locale dedicato verrà aggiunto nella Fase 3 della
roadmap.

## Limiti intenzionali

WIPS è un'app personale statica. Non include backend, database, login,
sincronizzazione cloud, framework frontend o automazione ETF. Queste scelte
mantengono l'app semplice, gratuita e compatibile con GitHub Pages.
