---
title: "Tech Stack 2026: Tägliche Abläufe des Roibase-Teams"
description: "Linear, Notion, Slack, Figma, Granola — Integrationsmuster in async-first Teams, Meeting-Ökonomie und messbare Produktivitätsdisziplin."
publishedAt: 2026-06-22
modifiedAt: 2026-06-22
category: lifestyle
i18nKey: lifestyle-004-2026-06
tags: [tech-stack, async-first, workflow, produktivitaet, linear]
readingTime: 9
author: Roibase
---

Das Roibase-Team ist 12 Personen stark und über 8+ Zeitzonen verteilt. Meeting-Ökonomie gibt es nicht — 4–5 Stunden Zoom pro Monat, der Rest läuft asynchron. Diese Disziplin bestimmt die Tool-Auswahl bis ins Detail. Sprint Velocity in Linear stieg von 8,2 auf 12,1, die Task-Completion-Zeit in Notion sank von 3,7 auf 1,9 Tage, die mittlere Response-Time in Slack liegt bei 47 Minuten. Diese Zahlen stammen aus Q2 2024 – Q2 2026. Integrationsmuster entstehen vor der Software — Kulturelle Disziplin kommt zuerst. Der Tech Stack ist nur der Rahmen; das Substanzielle ist systemisches Verhalten.

## Linear: Sprint-Disziplin und Cycle-Rhythmus

Linear kam Mitte 2023 rein, Jira raus. Die Veränderung war nicht nur UI — der Workflow-Rhythmus wurde komplett neu konstruiert. Zwei-Wochen-Zyklen, Scope-Lock-Disziplin am Cycle-Start. Scope Lock bedeutet: Neue Tasks treten nicht während des Zyklus hinzu, sie gehen ins Backlog, Priorisierung findet am Zyklus-Ende statt. Dieses Muster machte Sprint Velocity vorhersehbar — die Cycle Completion Rate stieg von 62 % (Q3 2024) auf 89 % (Q2 2026).

Jeder Task in Linear trägt 3 Metriken: Story Points (Komplexität), Priority (P0–P3), Due Date. Story Points werden in Fibonacci geschätzt (1, 2, 3, 5, 8); alles über 8 wird automatisch aufgesplittet. Priorität folgt Kriterien: P0 = Production Down, P1 = Client-Blocking, P2 = Roadmap-Critical, P3 = Nice-to-Have. Das Due Date ist task-spezifisch, nicht auf den Zyklus-Ende gebunden — diese Unterscheidung senkt die Kosten für Context-Switching.

### Linear ↔ Notion Integration

Wenn ein Issue in Linear erstellt wird, triggert ein Zapier-Webhook eine neue Row in der Notion-Datenbank. Diese Row trägt 4 Felder: Issue ID, Title, Assignee, Status. Bei Status-Änderungen in Linear aktualisiert ein Webhook Notion. Auf Notion-Seite wird diese Datenbank in Sprint-Retrospektiven verwendet — geschlossene Issues werden in Cycle-Notizen eingebettet, Velocity-Charts werden automatisch berechnet. Dieser Flow spart 14 Minuten pro Meeting (weg vom manuellen Copy-Paste).

## Notion: Documentation Hub und Async Context

Notion wird in 3 Schichten genutzt: Company Wiki, Project Pages, Meeting Notes. Das Wiki hat 47 Seiten in 18 Kategorien — Onboarding-Dokumentation, Tool-Zugangsanleitungen, Client-SOPs, interne Prozesse (HR, Finance, Tech Stack). Durchschnittliche Seitenlänge: 820 Wörter; jede Seite enthält mindestens 1 interne Cross-Referenz. Diese Interlink-Dichte erhöht Discovery-Geschwindigkeit — ein neues Team-Mitglied liest in den ersten 2 Wochen 38 Seiten, die Onboarding-Dauer sank von 9,2 auf 6,1 Tage.

Project Pages sind Client-spezifisch. Für jeden Client 1 Workspace mit Roadmap, Weekly-Check-In-Notizen, freigegebenen Assets (Figma-Links, GA Property ID, API Key). Roadmap-Template: Objectives (quarterly), Key Results (monthly), Task Breakdown (mit Linear-Link). Weekly Check-In-Notizen werden asynchron geschrieben — Freitagabend wird ein Notion-Link per Mail an den Client geschickt. Der Client hat keinen direkten Zugriff auf Notion; wir exportieren als PDF. Dieses Muster beendete Mail-Thread-Chaos — alte Notizen zu finden dauert 2 Sekunden (Notion-Suche) statt 4 Minuten (Mail-Suche).

Meeting-Notes-Template: Agenda, Attendees, Decisions, Action Items (mit Linear-Issue-Link). Der Action-Items-Abschnitt ist Checklist-Format; wenn eine Box angehakt wird, triggert ein Slack-Webhook einen Summary-Post im relevanten Channel. Diese Automatisierung reduzierte übersehene Action Items um 83 % — im alten System wurden 34 % der Action Items in 3 Tagen vergessen.

## Slack: Channel-Strategie und Notification-Disziplin

Slack hat 24 Channels — 12 für Projekte, 4 intern (Engineering, Design, Ops, Random), 8 thematisch (seo-insights, data-pipeline, client-alerts). Naming Convention: `prj-{client}` (Projekte), `int-{department}` (Intern), `top-{subject}` (Thematisch). Diese Konsistenz erhöht Slack-Suche-Genauigkeit — man findet seinen Channel in 3 Tastenanschlägen.

Jeder Channel hat eine gepinnte Nachricht: Channel Purpose, Key Links (Linear Project, Notion Page, Shared Drive), Response Time Expectation. Response Time ist kritisch: `prj-`-Channels = 2 Stunden, `int-`-Channels = 8 Stunden, `top-`-Channels = Best-Effort. Diese SLA macht async Flow vorhersehbar — P0-Issues öffnet man in Linear, nicht in Slack. Urgente Benachrichtigungen verwenden wir nicht.

### Slack ↔ Linear Bot

Der Linear Bot unterstützt 3 Befehle: `/linear create`, `/linear list`, `/linear close`. Create erzeugt einen Task aus dem Slack-Thread, die Description enthält automatisch einen Thread-Permalink. List zeigt offene Tasks des Assignees. Close schließt das Issue in Linear und setzt ein ✅-Emoji auf den Thread. Dieser Bot sparte 1,4 Tage im Engineering Cycle Time — Context-Switch-Kosten (Slack → Linear) addieren sich.

## Figma: Design Handoff und Versionskontrolle

3 Figma-Workspaces: Client Projects, Internal Brand, Experiments. Jedes Projekt hat 1 File mit Pages (Homepage, Product Page, Checkout Flow). Jede Page nutzt Component Libraries — bei Roibase ist [Markenpositionierung](https://www.roibase.com.tr/de/branding) eine Disziplin, weshalb wir Client-spezifische Design Systems aus Brand Guidelines erzeugen.

Design Handoff passiert durch Figma-Links in Linear-Issue-Kommentaren. Der Link ist nicht statisch — er ist an Figma Version History gebunden. Wenn ein Developer den Link anklickt, sieht er den neuesten Commit, Inspect Mode öffnet automatisch. Dieser Flow reduzierte Design-Dev-Handoff von 2,1 auf 0,8 Tage — vorher fragte der Developer "Welche ist die neueste Version?", der Designer schickte einen Screenshot, Feedback-Schleifen verlängerten sich.

Figma-Plugins: Stark (Accessibility Checks), Content Reel (Placeholder-Texte), Autoflow (User Flow Diagramme). Stark läuft bei jedem Design Review; WCAG-AA-Verstöße triggern Linear Issues. Content Reel macht Placeholder-Text realistisch — statt "Lorem ipsum" product-spezifischer Dummy-Text, das gibt Client Reviews besseren Kontext.

## Granola: Meeting Intelligence und Async Summary

Granola kam Q4 2025 ins Stack — KI-gestützte Meeting-Notes. Transkribiert Zoom Calls, erzeugt Summaries, extracted Action Items. Früher wurden Notes manuell notiert; 30 Minuten Call = 15 Minuten Note-Cleanup. Granola pusht automatische Summaries zu Notion, Action Items werden als Linear Issues angelegt.

Der async Wert von Granola ist hier: Wegen Zeitzone-Unterschiede können Leute einen Call nicht besuchen; statt 60 Minuten Recording lesen sie 8 Minuten Summary. Summary-Format: Key Decisions, Open Questions, Next Steps. Open Questions werden ins Slack-Thread gepostet, async Antworten kommen herein, nächste Meeting kennzeichnet sie als resolved. Dieses Muster senkte Meeting-Frequency um 40 % — vorher alle 2 Wochen Sync Call, jetzt alle 3 Wochen.

### Granola ↔ Notion Pipeline

Granola sendet Summary an Webhook, Zapier POSTet zur Notion API. Neue Row in Meeting-Notes-Datenbank, 5 Felder: Date, Attendees (Multiselect), Summary (Rich Text), Recording Link, Related Project (Relation). Summary enthält Action Items mit `@{assignee}` Mentions, die erwähnte Person erhält Slack DM. Diese Pipeline eliminiert manuelles Follow-Up — vorher schrieb der Meeting-Host manuell Action Items ins Slack, 22 % wurden vergessen.

## Integrationsmuster und Tradeoffs

5 Tools werden über 12 Webhooks und 6 Zapier Zaps integriert. Webhook Failure Rate: 0,7 % (3–4 Fehler/Monat), Zapier Execution Time Median: 4,2 Sekunden. Integrations-Kosten: Zapier Professional $240/Jahr, Linear Business $480/Jahr (12 Seats), Notion Team $192/Jahr, Figma Professional $180/Seat/Jahr (3 Designer = $540), Granola Business $360/Jahr. Gesamt $1812/Jahr, pro Kopf $151. Diese Kosten werden durch zeitsparende async Flows amortisiert — Rechnung: 12 Personen × 2 Stunden/Woche Meeting-Einsparung × $50/Stunde × 52 Wochen = $62.400/Jahr.

Tradeoff 1: Integrations-Komplexität verlangsamt Onboarding. Ein neues Team-Mitglied lernt 5 Tools + 12 Integrationen, erste Woche Documentation = 6 Stunden. Eine All-in-One-Alternative (z.B. ClickUp) onboardet schneller, aber Workflow-Flexibilität sinkt — Linear's Cycle Ritmus, Figma's Versionskontrolle, Granola's KI-Summary existieren dort nicht oder sind limitiert.

Tradeoff 2: Vendor Lock-In-Risiko. 5 Tools = 5 Vendoren, jeder kann Pricing erhöhen oder Features streichen. Mitigation: Kritische Daten liegen in Notion (JSON-Export leicht), Linear-Data wird wöchentlich SQL-exportiert (Backup), Figma-Files werden zu Git LFS gespiegelt (Version History bleibt). Diese Backup-Disziplin senkt Migration-Kosten — im Notfall braucht es 2 Wochen zum neuen Tool.

Async-first Workflows brauchen vor dem Tech Stack Kultur-Disziplin — Notification Discipline, Response-Time-SLAs, Documentation Quality. Der Tech Stack macht diese Disziplin messbar, erzeugt sie aber nicht. Bei Roibase reviewen wir Quarterly: Sprint Velocity, Cycle Completion Rate, Meeting Frequency. Wenn Trends sich umkehren, revidi­eren wir Workflow-Regeln. Q2 2026: Linear Cycle Completion 89 %, Notion Page Interlink Density 3,2, Slack Median Response Time 47 Minuten — diese Zahlen zeigen, dass async Disziplin nachhaltig ist.