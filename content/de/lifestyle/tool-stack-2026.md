---
title: "Tool Stack 2026: Die tägliche Operation des Roibase-Teams"
description: "Linear, Notion, Slack, Figma, Granola — Integrationsmuster und reale Zahlen asynchroner Teamverwaltung. Systemische Erkenntnisse aus 8 Jahren Teamleitung."
publishedAt: 2026-08-08
modifiedAt: 2026-08-08
category: lifestyle
i18nKey: lifestyle-004-2026-08
tags: [tool-stack, async-first, linear, notion, team-operations]
readingTime: 9
author: Roibase
---

Der Produktivitätssoftware-Markt erreichte 2026 94 Milliarden Dollar — doch die meisten Teams nutzen ihre Tools „wie sie geliefert werden". Bei Roibase haben wir in 8 Jahren gelernt: nicht die Tool-Auswahl, sondern das Integrationsmuster verändert die Operation. Unsere Linear Sprint Velocity stieg von 2,8 auf 4,1 — weil wir den Tool Stack nach Team-Disziplin neu gestaltet haben. In diesem Artikel zeigen wir die 5 Tools, die unsere tägliche Operation prägen, und wie sie ineinandergreifen.

## Linear: Nicht Aufgabenverwaltung, sondern Entscheidungsprotokoll

Linear nutzen wir nicht nur zur Arbeitsverfolgung — jedes Issue ist die Dokumentation eines Entscheidungspunkts. Im Februar 2025 lag unsere durchschnittliche Cycle Time bei 4,2 Tagen. Im Juli 2026 sank sie auf 2,7 Tage. Der Grund: Wir haben Issue-Templates von „Was wird gemacht" auf „Warum wird es gemacht" ausgerichtet.

Jedes Linear Issue trägt diese Metadaten: `impact` (low/medium/high), `confidence` (0-100%), `effort` (XS-XL). Dieses Tripel bindet Roadmap-Priorisierung an eine messbare Matrix statt an subjektive Schätzungen. Das Wichtige: Diese Daten beim Issue-Erstellen ausfüllen — nachträglich hinzugefügte Metadaten verlieren 80% an Zuverlässigkeit.

Über Linear's API haben wir eine wöchentliche Automation: Jeden Freitag um 17:00 Uhr pushed unser `notion-automation` Bot die geschlossenen Issues der Woche in Notion's „Weekly Digest" Seite. Format: Titel, Closing-Zeit, Zugewiesen zu, Impact-Score. So startet unsere Sprint Retrospektive mit Daten — nicht mit „Was haben wir diese Woche getan?" sondern „Bei welchen Issues lag die Cycle Time über Erwartung?"

### Async Standup Disziplin

Linear Issue-Kommentare sind unser Async-Standup-Mechanismus. Keine täglichen Meetings — stattdessen aktualisiert jedes Team-Mitglied sein Issue zwischen 10:00-11:00 Uhr. Template: „Yesterday: X done, Today: Y planned, Blocker: Z or none". Diese Disziplin senkte unsere Kosten für Kontextwechsel um 40% (nach RescueTime-Daten). Deep-Work-Blöcke bleiben unterbrochen — Slack-Benachrichtigungen nur bei Mentions aktiviert.

## Notion: Single Source of Truth, aber Diszipliniert

Unser Notion Workspace hat 230+ Seiten — aber bewusst. Jede Seite bekommt einen Owner, alle 3 Monate Audit. „Orphan Pages" (6 Monate nicht geöffnet) werden automatisch archiviert. Ohne diese Disziplin wird Notion zur Müllhalde.

Das kritischste Notion-Szenario: Client Briefing. Bei neuen Projekten wird eine `projects/client-slug/brief.md` Seite erstellt. Inhalt: Ziel, Timeline, Success Metric, Assumption Log. Diese Seite ist an Linear gebunden (als Property). Beim Issue-Erstellen ist „Brief Link" ein Pflichtfeld — so ist der „Grund für die Existenz" jeder Aufgabe mit einem Klick sichtbar.

Linear's Database-Feature nutzen wir nicht für Aufgabenverwaltung — Linear existiert bereits. Notion nur für „langfristigen Kontext". Zum Beispiel: eine 12-Monats-[Branding-Strategie](https://www.roibase.com.tr/de/branding) eines Clients lebt in Notion, aber jede Sprint-Deliverable in Linear. Notion = „Warum", Linear = „Was".

## Slack: Integrations-Hub, Asynchrone Kommunikation

Slack nutzen wir nicht als Echtzeit-Chat — sondern als Async-Messaging + Integrations-Hub. Unsere Channel-Kultur: `#linear-updates`, `#figma-comments`, `#github-activity`, `#analytics-alerts`. Diese Channels sind automatische Feeds — keine menschlichen Gespräche. Thread-Disziplin: Nachrichten gehören in Threads, kein Notification-Flood im Main Channel.

Unsere Slack App Integrations sind zahlengesteuert:
- **Linear Bot:** Bei jedem Issue Close wird es an `#linear-updates` gepusht. Benutzerdefinierbares Format — nur High-Impact Issues triggern Mentions.
- **Figma Webhook:** Wenn ein Designer eine Komponente publisht, fällt es in `#figma-comments`. Der Frontend-Dev holt sich den Kontext von dort.
- **GitHub Actions:** Bei PR Merge schreibt es in `#github-activity`, welches Linear Issue geschlossen wurde.

So wird Slack zum passiven Dashboard, das die Frage „Was passiert gerade?" beantwortet. Um aktive Fragen zu stellen, öffnet man Thread statt DM — so ist der Kontext später recherchierbar.

### Response Time SLA

Slack-Nachrichten erfordern keine sofortige Antwort. SLA: Mentions innerhalb 4 Stunden, Threads ohne Mention innerhalb 24 Stunden. Diese Disziplin zeigte sich in RescueTime: Die durchschnittliche Slack-Session sank von 12 auf 6 Minuten. Deep Work bleibt geschützt.

## Figma: Nicht Design, sondern Konsens-Dokumentation

Figma nutzen wir nicht nur für UI-Design — sondern für Konsens-Dokumentation. Beispiel: Nach dem Client Briefing in Notion wird ein Wireframe in Figma skizziert. Die Figma-Datei ist an das Linear Issue gebunden. Beim Implementation fragt der Developer „Warum wurde das so designt?" — die Antwort findet sich in den Figma-Kommentaren.

Figma's Branch-Feature ist lebensrettend: Jede größere Änderung wird in einem Branch getestet, die Main-Datei bleibt sauber. Der Developer implementiert immer gegen die „zuletzt genehmigte Version" in der Main Branch. Diese Disziplin eliminierte den Fehler „Falsche Version codiert".

Unsere Figma-Plugins: `A11y - Color Contrast Checker`, `Stark`. Jedes Design-Publish erfordert einen Accessibility-Audit. Contrast Ratio unter 4,5:1 wird nicht genehmigt. Diese Disziplin ergibt 100% WCAG Compliance in Production.

## Granola: Meeting-Note Automation

Granola kam Ende 2025 in den Team Stack. Einsatz: Client-Calls und interne Sync-Meetings. Granola transkribiert das Meeting, GPT-4 erstellt eine Zusammenfassung. Output wird direkt in Notion gepusht — Format: `meetings/YYYY-MM-DD-client-name`.

Das Wichtigste: Granola's Output wird nicht roh verwendet. Innerhalb von 10 Minuten nach dem Meeting editiert der Owner (meist Meeting Lead) die Notion-Seite: Summary beibehalten, Action Items in Linear Issues konvertiert, irrelevante Teile gelöscht. Ungereinigte Transcripts in Notion erzeugen Garbage Data — Suchergebnisse werden verschmutzt.

Granola's ROI: Aufwand für Meeting-Notes sank um 70%. Vorher: 15-20 Minuten manuelles Cleanup nach jedem Call. Jetzt: Transkription ist automatisch, Cleanup dauert 5-7 Minuten. Bei 120+ Client-Calls jährlich bedeutet das 30+ Stunden Ersparnis.

## Integrationsmuster

Die Kraft des Tool Stack's liegt nicht in den einzelnen Tools, sondern im Integrations-Design. Unsere Muster:

**Linear → Notion Flow:** Nach jedem Linear Cycle werden completed Issues in Notion's Sprint Digest gepusht. Nicht manuell, sondern Zapier Automation. Trigger: Linear Cycle Close. Format: Markdown-Tabelle — Issue Title, Owner, Cycle Time, Impact.

**Figma → Linear Flow:** Wenn eine Figma-Datei das Tag „Ready for Dev" erhält, öffnet sich automatisch ein Linear Issue. Der Issue Body enthält den Figma-File-Link + die letzten Kommentare. So entsteht kein Context Loss für den Developer.

**Slack → Linear Flow:** Wenn jemand im `#requests` Channel eine bestimmte Emoji-Reaktion (`:fire:`) hinzufügt, wird die Nachricht automatisch zu einem Linear Issue. Der Issue-Titel ist die erste Zeile der Nachricht, der Body der ganze Thread. So gehen Ad-hoc-Requests nicht verloren.

**GitHub → Notion Flow:** Bei PR Merge wird das zugehörige Linear Issue mit einem „Completed" Tag in der Brief-Seite des Clients markiert. So bleibt die Client-Brief-Seite live — die Frage „Ist dieses Feature fertig?" wird von Notion beantwortet.

## Systemausfälle und Wiederherstellung

Im Dezember 2025 hatten wir einen Slack-Outage — 6 Stunden kein Messaging. Blieb die Team-Operation stehen? Nein. Weil die echte Arbeitsverfolgung in Linear ist, Dokumentation in Notion. Slack ist nur die Notification-Schicht. Beim Outage wechselte das Team zu Linear-Kommentaren, der Flow lief weiter.

Die Lektion: Im Tool-Stack-Design darf es keinen Single Point of Failure geben. Jedes Tool hat keinen Backup, aber jedes Tool hat eine enge Verantwortung. Fällt Slack weg, nutzen wir Linear-Kommentare; fällt Linear weg, wird Notion zur manuellen Task-Verwaltung. Diese Flexibilität hält das Tool-Abhängigkeits-Risiko niedrig.

---

Tool-Stack-Operation ist nicht ein System, das man einmal aufbaut und vergisst — sondern eine Disziplin, die jedes Quartal auditiert wird, bei der jedes neue Tool vor hinzufügen eine „Integration Cost vs. Benefit" Rechnung bekommt. Roibase's 2026 Stack entstand aus dieser Disziplin. Für Ihr Team kann der richtige Stack anders aussehen — aber ohne fixierte Integrationsmuster wird die Kosten für neuen Tool-Hinzufügung immer hoch sein. Das Tool zu wechseln ist leicht, das System zu wechseln ist schwer.