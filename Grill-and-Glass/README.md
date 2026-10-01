# Feast Mode — Party Planner

Planner statico per organizzare un evento: invitati, profili Food e Bevande, menu modulare, cocktail, budget e lista della spesa. Funziona senza account, build, backend o dipendenze esterne.

## Cosa include

- Tipi evento: grigliata, cena elegante, apericena, pranzo/cena informale e buffet.
- Categorie Food selezionabili e accordion; le ricette già scelte restano salvate quando cambia il tipo di evento.
- Catalogo ricette ricercabile, con categoria, tag, compatibilità evento e ingredienti.
- Profili Food modificabili: quote per persona, ripartizione tra portate ed esclusioni per categoria. Sono inclusi anche profili vegetariano e vegano, modificabili come tutti gli altri.
- Profili Bevande modificabili: totale stimato per persona e preferenze per analcolici, birra, vino, cocktail e altre bevande.
- Mixer Bevande: cambia soltanto le percentuali, le mantiene sempre al 100% e lascia invariato il totale calcolato dai profili.
- Lista base barbecue conservata integralmente; gli ingredienti delle ricette sono righe derivate e aggregate, senza duplicare o alterare i prodotti originali.
- Quantità/prezzi delle stime ricetta modificabili nella lista della spesa, oltre ai prodotti base già personalizzabili.
- Backup JSON, importazione con copia di sicurezza, ripristino dell’ultimo backup ed esportazione Word.
- Scheda evento locale con nome, data, luogo, note, budget obiettivo e costo stimato per ospite.
- RSVP per invitato (confermato, forse, invitato, assente), gruppi facoltativi e scelta esplicita se includere i “forse” nei calcoli.
- Controllo di completezza, spesa sul campo mobile-first, fogli operativi stampabili, piano avanzi e libreria locale di eventi/template.

Le stime Food e Bevande sono uno strumento di organizzazione, non raccomandazioni nutrizionali o di consumo.

## Avvio locale

Per una consultazione rapida si può aprire `index.html` direttamente in un browser moderno. Per usare IndexedDB e provare la stessa modalità prevista per una futura pubblicazione, avvia un normale server statico dalla cartella del progetto:

```sh
cd Grill-and-Glass
python3 -m http.server 4173
```

Poi visita `http://127.0.0.1:4173`.

Non c’è una fase di build: questa stessa cartella è pronta per un hosting statico quando sarà il momento.

## Verifiche

Non sono necessari pacchetti aggiuntivi:

```sh
cd Grill-and-Glass
node scripts/verify.mjs
node --test tests/calculations.test.mjs
```

La verifica statica controlla file collegati, percorsi relativi e sintassi. I test verificano la regressione barbecue, la migrazione dello stato, il mixer al 100%, ricette derivate/aggregate, esclusioni Food e l’impatto di RSVP/budget sui calcoli.

## Struttura

```text
Grill-and-Glass/
├── index.html                 # Pagina, navigazione e accessibilità di base
├── css/app.css                # Design condiviso e breakpoint responsive
├── data/
│   ├── defaults.js             # Lista base, cocktail, bottiglie e chiavi legacy
│   └── food-drinks.js          # Profili, tipi evento, categorie e catalogo ricette
├── js/
│   ├── formatters.js           # Numeri sicuri, valuta, escape HTML e ID
│   ├── state.js                # Stato iniziale e importazione legacy
│   ├── storage.js              # IndexedDB, JSON, backup e migrazioni
│   ├── calculations.js         # Quantità, budget, mix e ingredienti derivati
│   ├── render/ui.js            # Rendering delle viste Evento, Food, Catalogo e Bar
│   └── app.js                  # Azioni dell’interfaccia e navigazione
├── scripts/verify.mjs          # Controllo statico senza dipendenze
└── tests/calculations.test.mjs # Regressioni di calcolo e migrazione
```

Le cartelle per build, asset o dipendenze non sono state create perché non servono alla versione attuale.

## Dati locali e compatibilità

Lo stato dell’evento usa `EVENT_SCHEMA = 5`; gli store IndexedDB esistenti rimangono allo schema `3`, quindi non vengono ricreati né cancellati. Restano supportate le chiavi `localStorage` esistenti:

- `party-planner-unified-v1`
- `grigliata-rauscedo-control-v1`
- `partyPlannerState`

La migrazione conserva partecipanti, prodotti manuali, quantità, acquisti, prezzi, bottiglie, cocktail e filtri. Gli invitati esistenti vengono mantenuti come **confermati**, così i risultati precedenti restano invariati; le nuove informazioni RSVP, scheda evento e piano avanzi sono opzionali. I vecchi pesi dei cocktail diventano percentuali; se erano presenti cocktail selezionati senza mixer, l’intenzione precedente viene mantenuta assegnando loro il 100% della sola quota cocktail. Da quel momento il totale Bevande deriva soltanto dai profili partecipanti pianificati.

I dati del browser sono legati all’origine. Se in futuro l’app passa a un dominio diverso, usa **↓ JSON** sul vecchio indirizzo e **↑ Importa** sul nuovo: l’importazione crea prima un backup recuperabile.

## Pubblicazione futura

Il progetto è una web app statica: GitHub Pages, Netlify, Cloudflare Pages e Vercel sono compatibili senza adattamenti al codice. Per una prima pubblicazione senza backend, GitHub Pages è l’opzione più lineare da valutare.
