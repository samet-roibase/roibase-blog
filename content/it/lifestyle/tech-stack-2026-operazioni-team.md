---
title: "Tech Stack 2026: Le Operazioni Quotidiane del Team Roibase"
description: "Linear, Notion, Slack, Figma, Granola — pattern di integrazione e disciplina misurabile della produttività in un team di 12 persone orientato alla crescita."
publishedAt: 2026-05-30
modifiedAt: 2026-05-30
category: lifestyle
i18nKey: lifestyle-004-2026-05
tags: [tech-stack, async-workflow, linear, notion, team-operations]
readingTime: 8
author: Roibase
---

Le conversazioni sullo tech stack tendono a trasformarsi in cataloghi di "usiamo questa app". Ma il vero problema non è lo strumento isolato — è il pattern di integrazione, il costo del context switching, la disciplina async-first. A Roibase, un team di 12 persone lavora da remoto dal 2018. Nel 2026, cinque tool hanno plasmato le nostre operazioni quotidiane: Linear, Notion, Slack, Figma, Granola. Questo articolo non elenca gli strumenti — espone il layer di integrazione: dove vivono i dati, quali workflow sono innescati, quale strato di notifiche è disabilitato.

## Linear: Non Sprint, ma Flow Metrics

Linear viene venduto come strumento di project management, ma a Roibase funziona come "visibility layer di work-in-progress". Non facciamo sprint planning — non usiamo cicli o milestone. Invece, ogni issue riceve **priority (P0/P1/P2)** e **estimate (1-3-5-8)**. La priorità non è una decisione personale, è una decisione del sistema: P0 = il deploy è bloccato oggi, P1 = deve finire entro lo sprint, P2 = backlog.

**Flow metrics:**
- **Cycle time:** media 2,3 giorni dal'apertura della issue alla chiusura (dato Q4 2025). Qualsiasi issue che supera 5 giorni viene automaticamente promossa a P0.
- **Work-in-progress limit:** massimo 3 issue aperte per persona. Per prendere un 4° issue, bisogna chiuderne una o delegarla.
- **Merge-to-close time:** tempo tra il merge di una PR e la chiusura della issue su Linear — target <30 minuti (automazione CI/CD + QA).

L'integrazione Slack di Linear è disabilitata. Invece di un bombardamento di notifiche, usiamo un **digest system**: ogni mattina alle 09:00, uno snapshot viene inviato al canale Slack (numero di issue P0, cycle time medio, distribuzione WIP). Nessuno mention su Linear — già tutti leggono il digest mattutino.

### Linear → Notion Sync

Le issue completate su Linear vengono archiviate su Notion una volta alla settimana (workflow Zapier). Su Notion esiste un "Retrospective Database" — ogni issue completata è taggata con il servizio a cui appartiene. Per esempio, le issue sotto il progetto `branding` vengono reportate sotto il servizio [Markalaşma & Brand Identity](https://www.roibase.com.tr/it/branding). Questi dati vengono usati ogni tre mesi per il capacity planning: quanto tempo di engineering viene speso su quale servizio?

## Notion: Source of Truth, Non un Wiki

Non usiamo Notion come wiki — è un "decision log". Ogni decisione strategica (per esempio "in questa campagna usiamo server-side tracking o client-side?") viene scritta su Notion in formato **RFC (Request for Comments)**. Il template RFC è:

```
## Decisione
[Una sola frase — cosa facciamo]

## Contesto
[Perché serve ora]

## Alternativi
[Almeno 2 opzioni + tabella tradeoff]

## Misurazione
[Come sapremo se la decisione era giusta tra 4 settimane]

## Responsabilità
[Chi ne è owner]
```

Dopo l'apertura dell'RFC, c'è una finestra di 48 ore per commenti async. Nessuno organizza riunioni — ognuno legge nel suo tempo, commenta. Dopo 48 ore, il decision owner scrive la decisione finale e la issue viene spostata su Linear.

**Layer di dati dentro Notion:**
1. **RFC Database** — tutte le decisioni
2. **Retrospective Database** — lavori completati provenienti da Linear
3. **Client Playbook** — note di operazione client-by-client (dove è la dashboard, dove sta l'API key)
4. **Brand Assets** — link Figma, tone-of-voice doc

Su Notion la ricerca non funziona bene, e questo è un lamento comune. Ma noi non cerchiamo — ogni database è filtrabile e taggato. Se senti il bisogno di usare la ricerca, di solito significa che hai messo i dati nel posto sbagliato.

## Slack: Async-First, Real-Time-Second

Il sistema di notifiche Slack è disabilitato in tutto il team. Solo `@channel` e `@here` sono abilitati — e c'è una regola: vietato usarli al di fuori di un incident P0. La messaggistica è divisa in tre canali:

1. **#daily-digest:** sommari Linear/Notion, log deploy CI/CD
2. **#async-questions:** domande dove non aspetti una risposta immediata (24 ore sono sufficienti)
3. **#sync-now:** coordinamento real-time (incident production, ottimizzazione campagna live)

**Response time expectations:**
- `#sync-now` → 15 minuti
- `#async-questions` → 24 ore
- DM → 48 ore (non ha cultura dei DM, si usa il canale)

L'uso di Slack thread è obbligatorio. Rispondere nel canale principale è vietato — ogni messaggio apre un thread. Così le conversazioni parallele non si mischiano.

### Slack → Granola Integration

Granola è uno strumento di note per meeting — ma a Roibase lo usiamo solo per client call. Non facciamo meeting interni (0-1 sync call alla settimana). Dopo una client call, Granola invia il transcript AI su Slack, il team legge async. Gli action item si trasformano automaticamente in issue Linear (trigger Zapier).

La killer feature di Granola: nel transcript evidenzia i commitment numerici ("risultati A/B test in 2 settimane", "CTR deve aumentare del 15%"). Ognuno riceve reminder automatici — nessuno dimentica.

## Figma: Non Design Handoff, ma Living Spec

Figma non è solo uno strumento di design — è il layer di "frontend spec". Ogni componente UI è definito come variant su Figma. Lo developer non estrae codice da Figma (non copiamo CSS) — ma legge il comportamento del componente da lì. Per esempio, gli state di un button (`hover`, `active`, `disabled`) sono frame su Figma. Il codice implementa la stessa logica di state.

**Connessione Figma → Linear:**
Ogni file Figma ha il plugin `Linear Issue`. Quando il design è approvato, il designer apre direttamente una issue Linear, incolla il link Figma nella descrizione. Quando lo developer prende la issue, già conosce il design — implementa senza fare domande.

I commenti Figma non vanno su Slack (per evitare il bombardamento di notifiche). Invece, ogni settimana esce un "Figma Digest" — i commenti aperti si trasformano in issue Linear.

## Pattern di Integrazione: Dove Vivono i Dati?

Le conversazioni sullo tech stack partono di solito da "quale tool usi?" Ma la vera domanda è "quale dato è canonical dove?" A Roibase, l'ownership dei dati è così:

| Tipo di dato | Source of truth | Sincronizzato dove |
|---|---|---|
| Lavoro attivo (WIP) | Linear | Slack daily digest |
| Lavoro completato (retrospective) | Notion | Linear (archived) |
| Decisioni strategiche | Notion (RFC) | Linear (action items) |
| Note client call | Granola | Slack thread |
| UI spec | Figma | Linear issue description |
| Brand assets | Notion | Figma (embed link) |

Non c'è doppio source-of-truth. Se un dato appare canonical in due posti, uno è sbagliato.

## Notification Discipline: Quando Silenzio, Quando Rumore

Il rischio più grande di uno stack tool moderno è la notification creep. A Roibase, la strategia delle notifiche è così:

**Completamente disabilitato:**
- Linear mention (si usa il thread Slack invece di commentare su issue)
- Figma comment (digest settimanale)
- Notion page update (nessuno guarda)

**Come digest:**
- Linear daily summary (09:00 mattina)
- Figma open comment summary (venerdì 17:00)
- CI/CD deploy log (dopo ogni deploy, summario su Slack)

**Real-time:**
- `@channel` (solo incident P0)
- Granola client call summary (5 minuti dopo la fine della call)
- Production error (Sentry → Slack, solo al canale `#sync-now`)

Quando si installa uno strumento, la prima domanda è: "Questa notifica deve essere real-time, o va in un digest?" Default: digest.

## Cosa Fare Ora?

Nelle conversazioni sullo tech stack, il riflesso è spesso "adottiamo questo tool anche noi". Invece, chiedi: "Dove dovrebbe vivere canonical questo dato?" Lo stack Roibase 2026 è costruito su Linear/Notion/Slack/Figma/Granola, ma questi tool possono cambiare — quello che importa è il pattern di integrazione, la disciplina delle notifiche, la cultura async-first. Se nel tuo team ancora senti "non ricevo le notifiche di X tool", il problema non è lo strumento — è che l'ownership dei dati non è chiaro.