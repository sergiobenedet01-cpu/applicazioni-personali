# Changelog WIPS

Questo file registra le modifiche intenzionali a WIPS pubblicate o pronte per
la pubblicazione. Usa categorie semplici: `Aggiunto`, `Modificato`, `Corretto`
e `Rimosso`.

## Non pubblicato

### Rimosso

- Posizione completamente disinvestita nel fondo NEF Ethical Global Trends di
  Banca 360 BCC, con relativo prezzo, pannello, tab e riepiloghi visivi.
- Advisor: pagina, navigazione, renderer, stato e stili dedicati.

### Aggiunto

- Selettore persistente Desktop / Mobile: al primo accesso sceglie la vista
  adatta alla viewport, poi conserva sempre la preferenza esplicita.
- Vista Mobile dedicata: sintesi portfolio, card asset espandibili, What-If
  touch, analisi compatta, stato quotazioni e accesso diretto a tutti gli
  strumenti completi senza duplicare dati, formule o persistenza.
- Controllo locale esteso per verificare file, selettore, renderer e stili
  della modalità Mobile.

- Allocation Lab: area separata e simulativa per distribuire una liquidità
  scelta dall'utente senza modificare portfolio, prezzi o funzioni esistenti.
- Mappa di allocazione con score trasparente, importi manuali, semaforo di
  concentrazione, mix Crypto/ETF post-piano e scenari Prudente, Bilanciato e
  Dinamico.
- Matrice opportunità × rischio, obiettivo di capitale storico per posizione e
  piano a 3/4/6 tranche con impatto teorico sul P.M.
- Modulo e foglio di stile Allocation Lab separati dal file principale;
  verificatore locale esteso con controlli di integrazione e invarianti di P.M.
  e concentrazione.
- README operativo con istruzioni locali, aggiornamento prezzi, pubblicazione
  e controlli preliminari.
- Changelog e procedura di release/rollback documentata.
- Verificatore locale in sola lettura per sintassi, file essenziali e dati
  iniziali.
- Export JSON completo e non distruttivo dei dati locali WIPS.
- Ripristino JSON con anteprima, validazione completa, conferma finale e
  rollback del localStorage in caso di errore di scrittura.
- Allocazione riorganizzata come punto unico per ranking Globale, Crypto ed
  ETF, con filtri persistenti e mappa della liquidità raggruppata per categoria.
- Fondo ambientale CSS leggero e discreto, disattivato per preferenza di moto
  ridotto e attenuato su viewport piccole.

## Baseline precedente al changelog

Le modifiche storiche precedenti a questo file sono disponibili nella cronologia
Git. Non vengono ricostruite retroattivamente qui per evitare di attribuire
date, versioni o dettagli non verificati.

Tra le funzionalità già presenti rientrano Portfolio, What-If, Budget,
esportazione CSV, aggiornamento crypto e updater ETF locale manuale.
