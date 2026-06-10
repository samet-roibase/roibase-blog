---
title: "Stack Strumentale 2026: Come Funziona la Settimana senza Riunioni in Roibase"
description: "Linear, Notion, Slack, Figma, Granola — pattern di integrazione testati per 8 anni e criteri concreti per operazioni di team async-first."
publishedAt: 2026-06-10
modifiedAt: 2026-06-10
category: lifestyle
i18nKey: lifestyle-004-2026-06
tags: [strumento-stack, async-first, linear, notion, workflow-design]
readingTime: 8
author: Roibase
---

Nel 2026, il team di Roibase tiene circa 2 ore di riunioni alla settimana — il resto della sincronizzazione avviene tramite sprint di Linear, documenti Notion e thread Slack. Questo numero era 18 ore nel 2019. Non sono cambiati gli strumenti, ma il pattern che li collega. Un task aperto in Linear crea automaticamente un thread Slack, rimanda al documento spec su Notion, si ancora al frame progettuale in Figma. Questo articolo descrive il lato ingegneristico di quel sistema di integrazione — quali strumenti abbiamo scelto e perché, quali regole di automazione abbiamo implementato, quali metriche monitoriamo.

## Linear: Non Un Tracker, Ma Un Vettore di Contesto

Non usiamo Linear come semplice issue tracker — ogni card è una mini-spec. Quando si apre un task, i campi obbligatori sono: metrica target (CTR +5%, TTI <2s), documento Notion correlato, link al frame Figma. Non appena la card viene creata, un thread Slack si apre automaticamente (integrazione Zapier), e il team inizia la discussione async. Il principio che emerge: in Linear non esiste il concetto di "quick task" — ogni card porta almeno 2 contesti esterni con sé.

Monitoriamo la velocity dello sprint, ma a un livello diverso: non il numero di task completati, ma il **cycle time medio** di ogni task (dalle ore di apertura a quelle di chiusura). Nel 2025 era 38 ore, nel 2026 è sceso a 29 ore. La ragione: chiarezza delle spec — se la metrica target è scritta nella card di Linear, le discussioni in code review si riducono del 60% (dai nostri dati interni).

### Pattern di Integrazione Linear + Notion

Esiste una regola consolidata: ogni card di Linear ha nel campo `Related Resources` il link al documento Notion — questa regola è stata mantenuta manualmente fin dall'inizio del team (non facciamo enforcement automatico perché il contesto deve essere determinato dal team, non da un bot). Il documento Notion generalmente contiene 3 sezioni: definizione del problema, soluzione proposta, criteri di accettazione. La card di Linear può derivare da Notion, ma non il contrario — la spec viene sempre scritta per prima, il task dopo.

Questa disciplina ha ridotto il tempo medio di code review da 4,2 ore nel 2024 a 2,7 ore. Non emerge mai la domanda "ma perché è così?" durante la review — la risposta è già in Notion.

## Slack: Thread-First, Non Canali

Non usiamo Slack per canali, ma per thread. È vietato scrivere messaggi nei canali generali — ogni messaggio inizia o in un thread di task Linear oppure legato a un documento Notion. La ragione di questo pattern: rendere strutturata la ricerca. Se cerchi su Slack "come funziona questa feature?", l'ID del task Linear appare automaticamente, perché Zapier ha incorporato l'ID della card nel testo del thread quando l'ha creato.

Il nostro obiettivo per il tempo di risposta async è: 4 ore (nell'orario lavorativo). Come lo misuriamo? Dall'API di Slack Analytics, estrai il tempo mediano di risposta nei thread — nel Q4 2025 era 3,2 ore, nel Q1 2026 è 2,9 ore. Condividiamo questa metrica nella retrospettiva dello sprint, ma non la usiamo per il monitoraggio individuale — lo scopo è l'ottimizzazione del sistema, non la competizione personale.

## Figma: Design Token Collegati ai Task di Linear

Non usiamo Figma solo come strumento di progettazione — i design token sono direttamente collegati ai task di Linear. Quando un componente button cambia in Figma, tutti i task di Linear che lo utilizzano vengono etichettati automaticamente (Figma API + Zapier). Il team vede quali task sono interessati entro 10 minuti.

Questa integrazione è nata durante un hackathon interno nel 2024. Inizialmente l'abbiamo definita "over-engineering", poi durante il refresh del brand abbiamo aggiornato tutti gli stati dei button in 3 giorni — nel vecchio sistema sarebbero stati 2 settimane. La sincronizzazione design-code è il collo di bottiglia più grande nei progetti di [branding](<https://www.roibase.com.tr/it/branding>) — questa integrazione lo ha ridotto del 70%.

### Versionamento dei Design Token

I design token in Figma non sono sotto controllo versione come Git, ma i task di Linear registrano il cambio di token con timestamp. Un task annota "il colore del Button CTA è cambiato da #FF5733 a #E84C3D", questo log viene aggiunto automaticamente al changelog di Notion. Di conseguenza, la domanda "qual era il colore 3 mesi fa?" riceve risposta in 30 secondi.

## Granola: Lo Strumento Che Incolla le Riunioni al Contesto

Abbiamo detto: 2 ore di riunioni a settimana — metà sono call client, metà planning di sprint. Dopo ogni riunione, Granola estrae automaticamente la trascrizione + gli action item. Gli action item diventano card di Linear (manuale, ma con template), la trascrizione viene embedded in Notion. Un membro del team che non ha partecipato cattura tutto il contesto in 10 minuti — non scriviamo meeting notes.

La caratteristica critica di Granola: categorizza automaticamente gli action item (design, dev, marketing). Quando apri una card di Linear dopo la call, il label corretto viene suggerito automaticamente. Questo piccolo dettaglio ha ridotto il tempo di assegnazione dei task da 15 minuti a 3 minuti dopo una call client.

## Notion: Un'Unica Fonte, Più Strati

Non usiamo Notion come wiki, ma come state machine. Ogni documento si trova in uno di 3 stati: Draft (in scrittura), Review (collegato a un task di Linear, discussione async in corso), Canonical (documento source, immutabile). Il cambio di stato è manuale, ma la regola è netta: per passare da Review a Canonical occorrono almeno 2 reaction di "approvazione" da membri del team nel thread Slack.

I documenti Canonical non cambiano — se occorre una modifica, si crea una nuova versione, il vecchio documento viene archiviato con l'etichetta "Archived". Questa disciplina assicura che la domanda "perché abbiamo preso questa decisione?" ha sempre una risposta — si consulta l'archivio, si guardano i task di Linear di quel periodo, si rilegge il thread Slack.

### Database View e Tagging Automatico

In Notion ci sono 4 database principali: Specs, Decisions, Experiments, Changelogs. Ogni database viene etichettato automaticamente con Linear e Slack (Zapier + Notion API). Quando viene creato un documento Spec, Notion estrae automaticamente dal Notion API i "related tasks" — quali card di Linear fanno riferimento a questa spec? Questa query esegue ogni mattina alle 9, il documento rimane aggiornato.

## 3 Regole Fondamentali dei Pattern di Integrazione

In 8 anni di sperimentazione, abbiamo appreso questo pattern: ogni strumento ha un unico campo "source of truth", gli altri strumenti vi si collegano.

- **Linear:** È la source per lo stato del task e la timeline. Notion può scrivere spec, ma lo stato del task lo cambia solo Linear.
- **Notion:** È la source per le spec e i documenti di decisione. Un task di Linear rimanda a Notion, ma il documento Notion non aggiorna mai la card Linear.
- **Slack:** È la source per la discussione async. I thread si aprono automaticamente, ma il contenuto del thread viene migrato manualmente a Notion (nessuna sync automatica, perché il rapporto signal/noise si corromperebbe).

La seconda regola: ogni automazione deve essere reversibile. I workflow Zapier sono aperti anche al trigger manuale — il team può sospendere una regola per uno sprint se necessario (per esempio, durante i periodi di sviluppo intenso per ridurre il rumore). L'automazione deve supportare la disciplina culturale, non imporla.

La terza regola: il tracking delle metriche è a livello di team, non individuale. Tempo di risposta Slack, cycle time di Linear, tempo di approvazione dei documenti Notion — tutto viene condiviso nella retrospettiva dello sprint, ma nessuna di queste metriche viene usata nella valutazione individuale delle performance. L'obiettivo è ottimizzare il sistema, non creare competizione tra persone.

## Perché Questi Strumenti, Non Gli Altri

Non abbiamo usato Jira al posto di Linear perché Jira non incoraggia la scrittura di spec — un task si apre velocemente, il contesto si aggiunge dopo. Linear fa il contrario: quando apri un task la descrizione è obbligatoria, non puoi lasciarla vuota. Questa piccola differenza di UX crea una differenza culturale.

Non abbiamo usato Confluence al posto di Notion perché Confluence si focalizza su versionamento enterprise — per i piccoli team è troppo complesso. Le database view di Notion sono flessibili, e le integrazioni con Linear e Slack sono lightweight.

Non abbiamo usato Discord al posto di Slack perché la struttura dei thread di Discord è gamificata, mentre i thread di Slack sono più chiari nel contesto professionale. L'API di ricerca di Slack funziona nativamente con gli ID dei task di Linear.

Non abbiamo usato Adobe XD al posto di Figma perché l'API di Figma è aperta e si integra con Zapier, mentre l'API di XD è limitata.

Non abbiamo usato Otter.ai al posto di Granola perché Granola estrae gli action item in modo nativo — Otter produce trascrizioni ma devi estrarre manualmente gli action item.

Lo stack degli strumenti in Roibase non è fisso — nel 2024 abbiamo spostato da Loom a Tella (upload più veloce, supporto embed in Linear). Nel 2025 abbiamo provato Make.com al posto di Zapier, ma siamo tornati indietro (i log di errore di Zapier sono più leggibili). La scelta degli strumenti non è statica, ma il pattern di integrazione rimane: ogni strumento ha un unico campo "source of truth", gli altri si collegano a esso.