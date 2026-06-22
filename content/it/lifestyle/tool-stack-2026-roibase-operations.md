---
title: "Tool Stack 2026: Operazioni Quotidiane del Team Roibase"
description: "Linear, Notion, Slack, Figma, Granola — pattern d'integrazione in team async-first, economia delle riunioni e disciplina della produttività misurabile."
publishedAt: 2026-06-22
modifiedAt: 2026-06-22
category: lifestyle
i18nKey: lifestyle-004-2026-06
tags: [tool-stack, async-first, workflow, produttività, linear]
readingTime: 9
author: Roibase
---

Roibase opera con un team di 12 persone distribuito su 8+ fusi orari. Economia zero-riunioni — mediamente 4-5 ore di Zoom al mese, il resto in flusso async. Questa disciplina si riflette nelle scelte degli strumenti. In Linear, la velocity di sprint è passata da 8.2 a 12.1; in Notion, il tempo task-to-completion da 3.7 giorni a 1.9 giorni; in Slack, il tempo mediano di risposta è 47 minuti. Dati raccolti tra Q2 2024 e Q2 2026. I pattern d'integrazione nascono prima dal comportamento sistemico che dalla tecnologia — lo stack è solo una cornice, il lavoro vero è la disciplina organizzativa.

## Linear: Disciplina degli Sprint e Ritmo dei Cicli

Linear è stato adottato in metà 2023, migrando da Jira. Il cambiamento non riguarda solo l'interfaccia — il ritmo di lavoro è stato completamente ricombinato. Cicli di 2 settimane, con disciplina di "scope lock" all'inizio di ogni ciclo. Scope lock significa: nessun nuovo task entra nel ciclo, solo aggiunto al backlog; la riordinazione per priorità avviene a fine ciclo. Questo pattern ha reso la velocity prevedibile — il tasso di completamento dei cicli è salito dal 62% in Q3 2024 all'89% in Q2 2026.

Ogni task in Linear porta tre metriche: story point (complessità), priority (P0-P3), due date. Gli story point seguono Fibonacci (1, 2, 3, 5, 8), con split automatico per task oltre 8. I criteri di priorità: P0 = production down, P1 = blocco client, P2 = critico per roadmap, P3 = nice-to-have. La due date non è quella di ciclo, ma specifica per task — questa distinzione riduce il costo dello context switching.

### Integrazione Linear ↔ Notion

Quando un'issue è creata in Linear, un trigger Zapier aggiunge una row al database Notion. La row contiene quattro campi: issue ID, title, assignee, status. I cambiamenti di status in Linear attivano un webhook che aggiorna Notion. Dalla parte Notion, questo database viene usato nella retrospettiva di sprint — le issue chiuse sono embed nei riepiloghi di ciclo, la velocity è calcolata automaticamente. Questo flusso ha risparmiato 14 minuti per riunione (bye bye copy-paste manuale).

## Notion: Hub di Documentazione e Contesto Async

Notion è usato in tre livelli: company wiki, project pages, meeting notes. Il wiki contiene 47 pagine in 18 categorie — documentazione onboarding, guide d'accesso ai tool, SOP client, processi interni (HR, finance, tech stack). La lunghezza media di una pagina è 820 parole, ogni pagina ha almeno 1 link di cross-reference interno. Questa densità di link accelera il discovery — un nuovo team member nella prima settimana legge 38 pagine, il tempo di completamento dell'onboarding è sceso da 9.2 giorni a 6.1 giorni.

Le project page sono client-specific. Per ogni cliente: 1 workspace con roadmap, note settimanali, asset condivisi (link Figma, GA property ID, API key). Il template di roadmap: objectives (trimestrali), key results (mensili), task breakdown (con link Linear). Le note settimanali sono scritte async — inviate venerdì EOD al cliente tramite Notion PDF export. Il cliente non accede direttamente a Notion, riceve l'export. Questo ha eliminato il caos dei thread email — trovare note passate ora impiega 2 secondi (Notion search) invece di 4 minuti (mail search).

Il template per meeting notes: agenda, attendees, decisions, action items (con link Linear). La sezione action items è in formato checklist; quando si spunta una casella, un webhook attiva Slack postando un summary nel canale correlato. Questa automazione ha ridotto del 83% le azioni dimenticate — nel sistema precedente il 34% degli action item si perdevano nei primi 3 giorni.

## Slack: Strategia dei Canali e Disciplina delle Notifiche

Slack ospita 24 canali — 12 project, 4 interni (engineering, design, ops, random), 8 topic-based (seo-insights, data-pipeline, client-alerts). La convenzione di naming: `prj-{client}` (progetti), `int-{department}` (interni), `top-{subject}` (topic). Questa coerenza aumenta l'accuracy della ricerca — raggiungi il canale giusto in 3 tasti.

Ogni canale ha un messaggio pinned con: purpose, key link (Linear project, Notion page, shared drive), expectation di response time. Questa è critica: canali `prj-` hanno SLA 2 ore, canali `int-` 8 ore, canali `top-` best-effort. Questo rende il flusso async prevedibile — un issue P0 non viene aperto in Slack ma in Linear, non usiamo urgent notification.

### Slack ↔ Linear Bot

Il bot Linear supporta 3 comandi: `/linear create`, `/linear list`, `/linear close`. Create apre una task da un thread Slack, description contiene il permalink del thread. List mostra le task aperte per assignee. Close chiude l'issue in Linear e aggiunge emoji reaction al thread (✅). Questo bot ha ridotto di 1.4 giorni il engineering cycle time — il context switch Slack → Linear accumulava costi.

## Figma: Design Handoff e Version Control

Figma ha 3 workspace: Client Projects, Internal Brand, Experiments. Nel workspace Client Projects, ogni progetto ha 1 file, ogni file organizzato per page (Homepage, Product Page, Checkout Flow). Ogni page usa una library di component — Roibase costruisce un design system client-specific basato sulle [linee guida di marca](https://www.roibase.com.tr/it/branding).

L'handoff di design avviene tramite link Figma embed nel commento dell'issue Linear. Il link è dinamico — rimanda alla history di versione di Figma. Quando il developer clicca, vede il commit più recente in inspect mode. Questo ha ridotto il tempo di handoff da 2.1 giorni a 0.8 giorni — nel processo precedente il developer chiedeva "qual è l'ultima versione?", il designer mandava screenshot, il loop di feedback si allungava.

Plugin Figma usati: Stark (accessibility check), Content Reel (placeholder text), Autoflow (user flow diagram). Stark gira a ogni design review; se c'è non-conformità WCAG AA, si apre un'issue Linear. Content Reel rende i placeholder realistici — copy specifica per il prodotto, non "Lorem ipsum", migliora la chiarezza nel review con i client.

## Granola: Meeting Intelligence e Summary Async

Granola è stato aggiunto allo stack in Q4 2025 — tool di AI per note di riunione. Trascrive le call Zoom, genera summary, estrae action item. Nel processo precedente le note erano prese manualmente; una call di 30 minuti richiedeva 15 minuti di pulizia. Granola crea summary automatici postati in Notion, gli action item diventano issue in Linear.

Il valore async di Granola sta qui: chi non può partecipare alla call per fuso orario legge il summary di 8 minuti (invece di registrazione di 60). Il formato del summary: key decisions, open questions, next steps. Le open question vengono postate come thread in Slack, le risposte arrivano async, vengono marcate come resolved nella riunione successiva. Questo ha ridotto la frequenza delle riunioni del 40% — il sync call che era ogni 2 settimane è diventato ogni 3 settimane.

### Pipeline Granola ↔ Notion

Granola invia il summary tramite webhook a Zapier, che fa POST al Notion API. Nel database meeting notes di Notion viene creata una row con 5 campi: date, attendees (multiselect), summary (rich text), recording link, related project (relation). Nel summary gli action item includono mention `@{assignee}`, la persona menzionata riceve DM Slack. Questa pipeline elimina il follow-up manuale — chi conduceva la riunione non deve riscrivere gli action in Slack; nel sistema precedente il 22% veniva dimenticato.

## Pattern d'Integrazione e Tradeoff

Le 5 tool ruotano su 12 webhook e 6 Zapier zap. Failure rate webhook: 0.7% mensile (3-4 errori), tempo mediano di esecuzione Zapier: 4.2 secondi. Costi: Zapier Professional $240/anno, Linear Business $480/anno (12 seat), Notion Team $192/anno, Figma Professional $180/seat/anno (3 designer = $540), Granola Business $360/anno. Totale $1.812/anno, per persona $151. Questo costo è coperto dal time saving del flusso async — calcolo: 12 persone × 2 ore/settimana risparmiate dalle riunioni × $50/ora × 52 settimane = $62.400/anno.

Primo tradeoff: la complessità d'integrazione allunga l'onboarding. Un nuovo team member impara 5 tool + 12 integrazioni, la prima settimana di doc richiede 6 ore. Un'alternativa (all-in-one come ClickUp) accorcia l'onboarding ma riduce la flessibilità del workflow — il ritmo di ciclo di Linear, il version control di Figma, il riassunto AI di Granola non esistono (o sono limitati) in ClickUp.

Secondo tradeoff: rischio di vendor lock-in. Cinque tool, cinque vendor. Mitigation: i dati critici rimangono in Notion (export JSON è semplice), Linear è backed up con export SQL settimanale, i file Figma sono mirrorati in Git LFS. Questa disciplina di backup riduce il costo di migrazione — se necessario, il passaggio a nuovi tool richiede 2 settimane.

Un flusso async-first richiede disciplina organizzativa prima che stack tecnologico — disciplina di notifiche, SLA di response time, qualità della documentazione. Lo stack la misura, non la crea. Roibase revisionare questi metriche ogni trimestre: velocity di Linear, densità di link interni di Notion, frequenza di riunioni. In Q2 2026: completion rate 89%, densità link 3.2, response time mediano 47 minuti. Questi numeri indicano che la disciplina async è sostenibile.