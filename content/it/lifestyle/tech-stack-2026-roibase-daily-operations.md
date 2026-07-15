---
title: "Stack Tecnologico 2026: Le Operazioni Quotidiane del Team Roibase"
description: "Linear, Notion, Slack, Figma, Granola — pattern di integrazione e come abbiamo costruito la disciplina async-first del nostro team."
publishedAt: 2026-07-15
modifiedAt: 2026-07-15
category: lifestyle
i18nKey: lifestyle-004-2026-07
tags: [tech-stack, async-workflow, linear, notion, team-operations]
readingTime: 9
author: Roibase
---

Nel 2026, la scelta dello stack tecnologico non è più semplicemente "quale app usi". La vera domanda è: come le integri, come riduci il costo del context switching, come costruisci la disciplina async-first. Nel team di Roibase — 12 persone multidisciplinari tra marketing, data, headless commerce, brand strategy — tutti operano su un unico stack operazionale. In questo articolo condividiamo i 5 strumenti core che utilizziamo e i nostri pattern di integrazione. Metriche concrete: media 2,3 ore di riunioni al giorno, tempo di risposta async sotto le 4 ore, prevedibilità della velocity al 87%.

## Linear: Non Backlog, Ma Disciplina di Sprint

Usiamo Linear dal 2024. Motivo della migrazione da Jira: velocità e obbligo di consenso. In Linear, ogni issue è obbligatoriamente legato a un cycle (sprint) — non puoi gonfiare il backlog. Il nostro cycle è di 2 settimane, inizia il lunedì. A inizio cycle, fissiamo il target di velocity: 40-45 story point per team member. Questo numero non è una stima, è una misura basata sulla media degli ultimi 6 cycle.

La struttura più forte di Linear è la gerarchia project-issue. La usiamo così: ogni campaign client è un project, dentro ci sono epic (es. "Q3 brand refresh"), e sotto gli epic ci sono i task. I task finiscono automaticamente su Slack — con il comando `/linear create` puoi aprire un issue direttamente da un thread Slack. Non esiste la frazione "portiamo questa conversazione su Linear". La conversazione rimane linkata, il contesto non si perde.

Un'altra regola: assignee è sempre una sola persona. Se il lavoro è "lo facciamo insieme", apriamo un parent issue con 2 sub-task al suo interno. Questa chiarezza di accountability elimina l'ambiguità. Nel retrospective di sprint, manteniamo una percentuale di completamento della velocity dell'87% — media degli ultimi 12 cycle. Questo tasso rimane stabile grazie alla enforcement del due date e della stima in Linear.

## Notion: Un Unico Registro, Due Scopi

In Notion lavoriamo su due livelli: documentation e decision log. Documentation è tradizionale — onboarding, SOP, runbook. Ma il decision log è critico. Ogni decisione strategica (cambio tool, revisione del processo di onboarding client, nuova JD per una hire) apre una pagina in Notion. Template: context, options (table), decision, rationale. Così, tra 6 mesi, puoi tornare indietro e capire "perché avevamo scelto questo tool".

L'integrazione Notion-Linear non è ancora nativa, l'abbiamo costruita con Zapier. Quando un epic si completa in Linear, un tag "completed" scende automaticamente sulla pagina del progetto in Notion. È un dettaglio piccolo ma importante: i PM vivono in Linear, gli stakeholder vivono in Notion. Entrambi devono restare aggiornati.

Il punto debole di Notion è la ricerca. Dopo 400+ pagine, la qualità dei risultati cala. Per questo abbiamo imposto una disciplina di tagging: ogni pagina ha minimo 3 tag (team, tipo di progetto, status). Invece di cercare, usiamo i filter — così il problema di allucinazione del search engine diminuisce.

### Knowledge Base vs. Chat Memory

Non colleghiamo Notion al team chat (Slack). Il chat è ephemeral, Notion è persistent. Se una decisione viene presa in Slack, qualcuno la sposta manualmente in Notion. Questo attrito è voluto — non vogliamo che tutto finisca in Notion. Solo l'informazione riusabile entra in Notion. La retention su Slack è 90 giorni — dopo, i thread senza star vengono archiviati automaticamente. Con questa regola, Notion rimane veramente il "registro unico".

## Slack: Async-First, Meeting-Last

Abbiamo 42 channel su Slack. Regola: un channel per ogni client, un channel per ogni funzione interna (es. #data-ops, #brand-strategy). Niente channel privati — la trasparenza è il default. Solo le cose HR in DM. Così la velocità di onboarding è alta — il nuovo hire al primo giorno legge la history dei channel e ha già il contesto.

La cultura async-first funziona grazie alla disciplina dei thread. Regola: ogni messaggio riceve risposta nel thread o una reaction. Se un messaggio non riceve una reaction entro 2 ore, è il segnale che "nessuno ha proprietà di questo topic". Il tempo medio di risposta nei thread è 4,2 ore (ultimi 30 giorni). Questo riduce drasticamente la necessità di sync meeting.

L'integrazione Slack-Linear è bidirezionale: da Slack puoi aprire issue con `/linear`, e quando un issue si aggiorna in Linear, la notifica scende su Slack. Così i PM vivono in Linear, gli engineer in Slack — ma entrambi rimangono aggiornati. C'è il problema del rumore di notification? Sì. Lo risolviamo così: ogni user si definisce una keyword personale (es. "@marco-urgent"), riceve push notification solo su quel keyword. Le altre notification finiscono in un channel "Updates" che si legge async.

## Figma: Design Handoff, Nessun Litigio

Figma non è solo per UI/UX, lo usiamo per la gestione degli asset di brand. Ogni client ha un Figma workspace — logo variant, color palette, typography system, template di slide. Il handoff al developer passa da Figma inspect mode — "che hex è questo blu" non è più una discussione.

L'integrazione Figma-Notion è manuale. Quando il design è finalizzato, il link Figma va embed nella pagina del progetto su Notion. Lo stakeholder vede il design senza uscire da Notion. Non usiamo i comment su Figma — il comment rimane su Figma, non scende su Slack. Tutto il feedback si raccoglie nel thread Slack, poi il designer lo porta su Figma.

Il version control di Figma è potente, ma dipende dalla tua disciplina di naming. Da noi: ogni major revision è "v1.0", "v2.0". Iteration minori sono "v1.1", "v1.2". Così puoi dire al client "avete approvato v2.3" — non c'è ambiguità su quale file.

## Granola: Trasformare la Riunione in Artifact Async

Abbiamo aggiunto Granola alla fine del 2025. È un AI meeting note tool — ma il nostro use case è diverso. Granola non è solo transcript, estrae action item. Al termine della riunione, Granola apre automaticamente issue in Linear e assegna l'assignee. Non esiste la frazione "la cosa discussa in riunione è finita in Linear?". È già lì.

La feature migliore di Granola: invia il meeting summary su Slack con webhook. Chi non era in riunione legge il riassunto in #meeting-notes 5 minuti dopo. Questa trasparenza async riduce il FOMO, riduce la partecipazione inutile alle riunioni.

Granola non ha ancora integrazione Notion, la facciamo manualmente: i summary di Granola dalle critical client meeting vanno copiati nel decision log di Notion. Questo attrito è voluto — non vogliamo portare ogni riunione su Notion. Solo le decisioni strategiche.

## Pattern di Integrazione: Dove Mettere l'Attrito

Il successo di uno stack tecnologico non sta nel quale tool scegli, ma dove metti l'attrito consapevolmente. Abbiamo 3 punti di attrito voluto:

1. **Slack → Notion:** Non è automatico. Le decisioni dalla chat vanno spostate manualmente. Così Notion rimane senza rumore.
2. **Figma → Linear:** Nessuna integrazione di comment. Il feedback si raccoglie su Slack. Così il feedback è centralizzato.
3. **Granola → Notion:** Non è automatico. Le riunioni critiche vanno spostate manualmente. Così il decision log di Notion rimane di qualità.

Questi attrito vanno contro la logica "tutto deve essere automatico", ma sono intenzionali. Perché l'automazione ha un costo: perdi il senso di dove vive l'informazione. Noi mettiamo l'attrito per costruire una gerarchia dell'informazione: Slack è ephemeral, Linear è scope-di-sprint, Notion è strategico.

## Risultato Numerico: Efficienza Operazionale

Dati Q2 2026:
- Tempo medio di riunioni al giorno: 2,3 ore (Q2 2024: 4,1 ore)
- Tempo di risposta async: 4,2 ore (target: sotto le 4)
- Prevedibilità della sprint velocity: 87% (ultimi 12 cycle)
- Median time da apertura a chiusura issue in Linear: 3,8 giorni
- Pagine Notion: 412 (attive), utilizzo filter vs search: 78%

Questi numeri non vengono dalla scelta del tool, ma dalla disciplina di integrazione. Se Linear, Notion, Slack vivessero come silos — "il migliore tool per quello" — il costo del context switching sarebbe il doppio. Noi disegniamo consapevolmente i pattern di integrazione — soprattutto i punti di attrito — e manteniamo la velocità operazionale.

Uno stack tecnologico non è una lista di software. È disciplina del team, naming convention, cultura async, regole di accountability — tutto insieme. Come nel nostro lavoro su [Branding & Brand Identity](https://www.roibase.com.tr/it/branding), l'identità operazionale ha bisogno di pattern coerente. Gli strumenti cambiano, il pattern rimane.