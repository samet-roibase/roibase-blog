---
title: "App Store Optimization: Architettura delle Keyword nel Mercato Turco"
description: "In Turchia, l'ASO non è solo traduzione. Struttura voice-market, differenziazione lingua-cultura e mapping dell'intent: come costruire la crescita organica."
publishedAt: 2026-07-26
modifiedAt: 2026-07-26
category: gaming
i18nKey: gaming-004-2026-07
tags: [aso, mobile-gaming, keyword-research, mercato-turco, localizzazione]
readingTime: 9
author: Roibase
---

Nel mercato turco dell'App Store, ogni mese 8 milioni di utenti attivi eseguono ricerche. Ma il 73% di queste ricerche segue il formato "termine inglese + modificatore turco" (dati App Annie 2026). "Battle royale oyun", "strategy game oyna", "idle game indir" — nessuno completamente locale, nessuno completamente globale. Questa struttura ibrida trasforma l'ASO da esercizio di traduzione a problema di ingegneria culturale. La maggior parte degli studi crede di fare localizzazione traducendo soltanto gli string dell'interfaccia. In realtà, nel mercato turco l'architettura delle keyword deve operare a un livello diverso: mapping dell'intent, comportamento di voice search, weighting specifico della piattaforma ed effetti dei vincoli normativi sui metadati.

## Perché il Mercato Turco Non è Solo Lingua

La Turchia nel gaming mobile è un mercato tier-2 ma con comportamenti tier-1. L'ARPPU è il 40% dell'Europa, ma la session frequency è il 15% più alta (Sensor Tower Q1 2026). Questo significa: l'utente gioca gratis ma accede quotidianamente, prova un nuovo gioco ogni settimana. L'ASO deve bilanciare questi due vettori — mantenere l'enfasi su "gratuito" senza nascondere le feature premium.

La ricerca di keyword turchi funziona su tre livelli. Il primo è traduzione diretta: "puzzle game" → "bulmaca oyunu". Il secondo è equivalente culturale: "idle game" non è "boş zaman oyunu" ma "tıkla kazan oyunu" (il modello mentale radicato dell'utente). Il terzo è specifico del voice-market: "Türkçe savaş oyunu" — qui "Türkçe" non indica la lingua dell'interfaccia ma la ricerca di contenuto locale. Nel 60% delle ricerche con il modificatore "Türkçe", l'utente cerca la locuzione "Turco", non il linguaggio dell'UI. Aggiungere "Türkçe" ai metadati ha un impatto sul CPI del 12-18% (dai dati di test Roibase 2025-2026).

La seconda differenza è la distribuzione dell'intent. In inglese "strategy game" è un termine generico che comprende 4X, tower defense, auto-battler. In turco "strateji oyunu" si restringe — comprende solo giochi tattici turn-based. "Kale savunma", "kart oyunu", "savaş simülasyonu" sono cluster di intent separati. Per lo stesso gioco è necessario testare tre set di keyword diversi. Esempio: abbiamo inserito "strateji" nel sottotitolo di un tower defense, CVR 3,2%. Cambiandolo in "kale savunma", CVR è salito al 5,8%. La precisione dell'intent ha fatto la differenza.

### Weighting della Piattaforma: App Store vs Google Play

L'algoritmo di keyword density di App Store in Turchia è il 30% più sensibile rispetto a Google Play (osservazione aggiornata 2026). Con tre keyword nel titolo, ognuno riceve un weight separato. Google Play è più basato su permutazioni — "savaş strateji oyunu" e "strateji savaş oyunu" sono equiparati. Su App Store l'ordine è critico. Nei dati di test c'è una differenza di impression del 18% tra "aksiyon macera oyunu" (azione prima) e "macera aksiyon oyunu" (avventura prima). Metti il keyword prioritario all'inizio.

## Workflow di Ricerca Keyword: Mapping dell'Intent

Nel mercato turco, la ricerca di keyword per l'[ASO](https://www.roibase.com.tr/it/aso) funziona così: per prima cosa identifica i core term in inglese (genere, meccanica, tema), poi non cercare le loro corrispondenze turche — bensì i loro **equivalenti nel modello mentale dell'utente turco**. Per farlo sono necessarie 3 fonti di dati:

| Fonte | Utilizzo | Affidabilità |
|-------|----------|--------------|
| Suggerimenti ricerca App Store | Completamento query real-time | 85% |
| Google Trends (filtro mobile) | Modello stagionale/culturale | 70% |
| Reverse engineering keyword competitor | Scraping dei set di keyword pagati | 60% |

I suggerimenti di ricerca dell'App Store sono la fonte più affidabile perché si basano sul log di query interno di Apple. Esempio: digita "oyun" e aspetta — il dropdown mostra "oyun indir", "oyun oyna online", "oyun hileleri". Nota il modificatore "hileleri" — l'utente turco ricerca spesso trucchi e mod; è un segnale di aggiungere termini come "bonus" e "potenziamento" ai metadati. Ma non usare direttamente la parola "hile" — rischio di rigetto dall'App Store.

Con il filtro mobile di Google Trends vedi i pattern stagionali. "Ramazan oyunu" cresce del 400% tra marzo e aprile (per i giochi casual a tema speciale). "Yaz oyunu" ha il picco a giugno. Se il gioco è indipendente dalla stagione, annota questi keyword per la rotazione dei sottotitoli — puoi aggiornare i metadati sincronizzandoli con il live ops (Apple consente un aggiornamento di metadati al mese; il timing è critico).

Per il reverse engineering dei keyword competitor, utilizza i dati di paid search. Non puoi vedere su quali keyword fanno bid i competitor in Apple Search Ads, ma nel tuo campaign, la lista "suggested keywords" mostra overlap. Se un competitor pesa su "kart dövüş oyunu", testalo anche tu. Ma non copiare — usalo per validation. Costruisci il tuo semantic field autonomamente.

### Costruzione del Semantic Field

Nel mercato turco, il semantic field si costruisce su 4 strati:

1. **Descrittore core:** Termine base di genere/meccanica ("puzzle", "aksiyon", "strateji")
2. **Modificatore culturale:** Motivo radicato nella mente dell'utente turco ("Türkçe", "yerli yapım", "Osmanlı temalı")
3. **Segnale di intent:** Cosa cerca l'utente ("ücretsiz", "çevrimdışı", "reklamsız")
4. **Aggancio emotivo:** Attrattore emotivo ("eğlenceli", "sürükleyici", "rekabetçi")

Esempio di metadati:

```
Title: Kale Savunma: Türk Savaşçılar
Subtitle: Strateji | Çevrimdışı Oyun | Ücretsiz
```

Bilancia i 4 strati. Nel titolo: core + culturale (kale savunma + Türk), nel sottotitolo: intent + genere (çevrimdışı + strateji). L'aggancio emotivo va nella description — manca lo spazio nel titolo.

## Voice Search e Effetto della Struttura Linguistica

La penetrazione di voice search mobile in Turchia è al 23% (media mondiale 18%, Statista 2026). Quando si dice a Siri "oyun öner", i risultati usano un weighting di keyword diverso dalla ricerca testuale. Le query vocali sono più lunghe (media 5,2 parole vs 2,8 in testo) e in formato linguaggio naturale ("bana iyi bir strateji oyunu öner" vs "strateji oyun").

L'impatto dei metadati ASO su voice search è indiretto — i risultati Siri di Apple provengono da metadati + curation editoriale + metriche di engagement. Due punti sono però essenziali:

1. **Keyword long-tail:** Keyword come "İyi strateji oyunu" (3+ parole) allineano le query vocali. Inseriscile nel sottotitolo.
2. **Frase naturale:** Qualificatori come "En iyi", "popüler", "yeni" sono frequenti nelle query vocali. Aggiungili al promotional text (App Store offre 170 caratteri per il testo promozionale, aggiornabile ogni 4 mesi).

La struttura della lingua turca entra in gioco qui. Il turco è SOV (soggetto-oggetto-verbo), l'inglese è SVO. Nelle query vocali l'ordine cambia: non "strateji oyunu oyna" ma "oyna strateji oyunu" (comando prima). I metadati non devono seguire questa sequenza — l'algoritmo di App Store fa permutazioni n-gram e la query "oyna strateji oyunu" cattura il keyword "strateji oyunu". Ma nella description usa frasi naturali per la leggibilità.

## Vincoli Normativi e Limiti dei Metadati

In Turchia i metadati dei giochi sono soggetti a 2 framework normativi: i principi di trasmissione RTÜK (applicati anche ai contenuti digitali) e le linee guida dell'App Store di Apple. RTÜK pone restrizioni su violenza e sessualità nei contenuti ma non interviene direttamente sui metadati. Apple ha linee guida rigorose: la parola "ücretsiz" con IAP presenti può essere considerata ingannevole, le affermazioni "migliore" richiedono prove.

Punti di attenzione nell'ASO turca:

- **"Bedava" vs "Ücretsiz":** Entrambi sono usati ma "bedava" è più informale e funziona nei casual game. Nei giochi hardcore/strategia "ücretsiz" è più professionale.
- **Termine "Premium":** L'utente turco interpreta "premium" come IAP, non come ad-free. Se il gioco ha modello ad-free, usa "reklamsız", non "premium".
- **Uso di numeri:** Metriche come "1 milione di download" non sono verificate da Apple ma importanti per la fiducia dell'utente. Usa solo numeri verificabili da app analytics (es. "500K+ giocatori" è verificabile).

Limiti di caratteri per i metadati:

| Campo | Limite | Strategia |
|-------|--------|-----------|
| Titolo | 30 caratteri | Keyword core + brand |
| Sottotitolo | 30 caratteri | Keyword intent + genere |
| Campo keyword | 100 caratteri | Long-tail + termini competitor |
| Testo promozionale | 170 caratteri | Aggiornamento stagionale, aggancio emotivo |

Il campo keyword va scritto senza virgole — Apple separa con spazi. Il formato "strateji kale savunma türk oyun" è corretto. Elimina keyword ripetuti — se "oyun" è già nel titolo, non aggiungerlo al campo keyword, spreca spazio.

## A/B Test e Iterazione

Apple ha aperto la funzione Custom Product Page (CPP) al mercato turco dal 2025. Con CPP puoi testare set di metadati diversi, ma solo screenshot/video/testo promozionale cambiano; titolo e sottotitolo rimangono fissi. Comunque è sufficiente — ad esempio, per un gioco RPG:

- **CPP A:** Enfasi sulla mitologia turca, screenshot con dettagli dei personaggi
- **CPP B:** Enfasi sul gameplay offline, screenshot con icona offline

Dopo 6 settimane di test, CPP B ha dato CVR il 22% superiore — l'utente turco prioritizza la feature offline sulla mitologia (il costo dei dati rimane un fattore determinante).

Il test dei metadati è più limitato — Apple consente 1 modifica al mese; raccogliere sample sufficienti richiede 3-4 settimane. La nostra metodologia: prima testa la hypothesis con CPP (veloce, reversibile), poi sposta il variant vincente ai metadati core. Esempio: testa il keyword "savaş" vs "strateji" nel promotional text di CPP, poi sposta il vincente nel sottotitolo.

Non guardare solo impression/CVR come metrica di test — guarda la retention. Alcuni keyword danno CVR elevato ma retention D1 bassa perché creano aspettative sbagliate. Il keyword "Hızlı tempolu aksiyon" aumenta CVR per un RPG casual ma abbassa D1 del 8% perché l'utente non si aspetta la meccanica idle. Nel processo di [App Store Optimization](https://www.roibase.com.tr/it/aso), la coerenza di retention determina il ROI a lungo termine dei metadati.

## Scelta della Categoria e Effetto della Cross-Promotion

Su App Store Turchia ci sono 23 sottocategorie nella categoria "Giochi". La categoria primaria del gioco non può cambiare (post-pubblicazione) ma la categoria secondaria può cambiare 1 volta al mese. È uno strumento strategico — ad esempio un tower defense può avere categoria primaria "Strategia" e secondaria "Azione". Ruota la categoria secondaria stagionalmente: "Avventura" in estate, "Strategia" in inverno — il comportamento dell'utente turco cambia con le stagioni (in estate la preferenza per casual game aumenta del 18%).

La scelta della categoria influenza il weight del keyword. Per un gioco in categoria "Strategia", il keyword "strateji" è altamente competitivo — tutti lo usano. Usa invece keyword di nicchia: "turn-based strateji", "hex grid savaş". La categoria stabilisce già l'intent generale; i metadati devono essere specifici.

La cross-promotion ha un effetto indiretto sui metadati. Se lo sviluppatore ha più giochi, Apple mostra un bundle nella "Pagina dello sviluppatore". L'utente passa da un gioco all'altro. Qui la coerenza dei metadati è importante — tutti i giochi devono usare un linguaggio tonale condiviso (descriptor core come "Türkçe", "ücretsiz" devono essere coerenti). Attenzione però alla cannibalizzazione di keyword: se due giochi si ottimizzano sullo stesso keyword, si mangiano le impression a vicenda. Uno usi "kale savunma", l'altro "tower defense" — cattura diversi intent.

## Conclusione: Ingegneria dei Metadati

Nel mercato turco, l'ASO è più di una localizzazione — è ingegneria dei metadati. Inizia con mapping dell'intent: cosa cerca l'utente, perché lo cerca, in quale contesto. Arricchisci il semantic field con modificatori culturali ma conosci i limiti legali e della piattaforma. Aggiungi keyword long-tail per voice search ma mantieni la leggibilità delle frasi naturali. Valida le hypothesis con A/B test, usa CPP per iterazione veloce, ottimizza i metadati core sulla coerenza di retention. Costruisci strategia a livello di ecosystem con scelta di categoria e cross-promotion. La Turchia è un mercato tier-2 ma con complessità tier-1 — costru