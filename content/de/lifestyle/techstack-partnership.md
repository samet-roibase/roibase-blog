---
title: "Tool Stack 2026: Tägliche Abläufe des Roibase Teams"
description: "Linear, Notion, Slack, Figma, Granola — Integrationsmuster und messbare Produktivitätsdisziplin in einem 12-köpfigen Wachstumsteam."
publishedAt: 2026-05-30
modifiedAt: 2026-05-30
category: techstack-partnership
i18nKey: lifestyle-004-2026-05
tags: [tool-stack, async-workflow, linear, notion, team-operations]
readingTime: 8
author: Roibase
---

Tool-Stack-Diskussionen enden meistens in einer Katalogliste: „Wir nutzen diese Apps." Das eigentliche Problem ist aber nicht das einzelne Tool — es sind die Integrationsmuster, die Kosten des Context Switching, die Async-First-Disziplin. Das Roibase-Team arbeitet seit 2018 zu zwölft remote-first. 2026 prägen fünf Tools unsere tägliche Operation: Linear, Notion, Slack, Figma, Granola. Dieser Artikel listet die Tools nicht auf — stattdessen dekodieren wir die Integrationenschicht: Wo lebt welches Datum, welcher Workflow triggert was, welche Benachrichtigungsschicht ist abgeschaltet.

## Linear: Nicht Sprint, sondern Flow-Metriken

Linear wird als Projektmanagement-Tool verkauft, bei Roibase funktioniert es aber als „Work-in-Progress-Sichtbarkeitslayer". Wir planen keine Sprints — nutzen keine Zyklen oder Milestones. Stattdessen bekommt jedes Issue eine **Priority (P0/P1/P2)** und ein **Estimate (1-3-5-8)**. Die Priority setzt das System, nicht die Person: P0 = Deployment wird heute blockiert, P1 = muss im Zyklus erledigt sein, P2 = Backlog.

**Flow-Metriken:**
- **Cycle Time:** Von Issue-Eröffnung bis Abschluss durchschnittlich 2,3 Tage (Q4 2025 Daten). Issues über 5 Tage eskalieren automatisch auf P0.
- **Work-in-Progress-Limit:** Maximum 3 offene Issues pro Person. Ein 4. Issue kann nur angenommen werden, wenn eines davon geschlossen oder abgegeben wird.
- **Merge-to-Close-Zeit:** Vom PR-Merge bis zum Linear-Abschluss — Ziel <30 Minuten (CI/CD + QA Automation).

Die Slack-Integration von Linear ist abgeschaltet. Statt Benachrichtigungsbombardement nutzen wir ein **Digest-System**: Jeden Morgen 09:00 Uhr geht eine tägliche Zusammenfassung in den Slack-Channel (P0-Issue-Anzahl, Cycle-Time-Durchschnitt, WIP-Verteilung). Niemand erwähnt Linear in Slack — alle lesen morgens das Digest.

### Linear → Notion Synchronisierung

Abgeschlossene Linear-Issues werden wöchentlich in Notion archiviert (Zapier Workflow). Notion hat eine „Retrospective Database" — jedes geschlossene Issue wird nach zugehörigem Service getaggt. Beispiel: Issues zum Projekt `branding` werden unter dem Service [Markenconsulting & Brand Identity](https://www.roibase.com.tr/de/branding) rapportiert. Diese Daten nutzen wir vierteljährlich zur Capacity-Planung: Wie viel Engineering-Zeit steckt in welchem Service?

## Notion: Source of Truth, Keine Wiki

Notion nutzen wir nicht als Wiki — sondern als „Decision Log". Jede strategische Entscheidung (z.B. „Server-Side oder Client-Side Tracking für Kampagne X?") wird in Notion als **RFC (Request for Comments)** dokumentiert. RFC-Template:

```
## Entscheidung
[Ein Satz — was tun wir]

## Kontext
[Warum ist das jetzt nötig]

## Alternativen
[Mindestens 2 Optionen + Tradeoff-Tabelle]

## Messung
[Wie prüfen wir in 4 Wochen, ob die Entscheidung richtig war]

## Verantwortung
[Wer trägt die Verantwortung]
```

Nach RFC-Eröffnung gibt es 48 Stunden async Comment-Zeit. Niemand ruft eine Besprechung ein — alle lesen asynchron, schreiben Kommentare. Nach 48 Stunden schreibt der Decision Owner die endgültige Entscheidung, die Arbeit wandert in Linear.

**Datenschichten in Notion:**
1. **RFC Database** — alle Entscheidungen
2. **Retrospective Database** — erledigte Arbeiten aus Linear
3. **Client Playbook** — Operationsnoten pro Klient (wo ist welches Dashboard, welcher API-Key)
4. **Brand Assets** — Figma-Links, Tone-of-Voice-Dokument

Notion-Suche funktioniert nicht optimal, sagen Leute. Aber wir suchen gar nicht — jede Database ist filterbar und getaggt. Wenn jemand suchen möchte, bedeutet das meist: „Ich habe das Datum am falschen Ort abgelegt."

## Slack: Async-First, Real-Time-Second

Die Notification-Logik von Slack ist teamweit deaktiviert. Nur `@channel` und `@here` sind aktiviert — und es gibt eine Regel dafür: außer P0 Incidents verboten. Messaging ist auf 3 Kanäle aufgeteilt:

1. **#daily-digest:** Linear/Notion-Zusammenfassungen, CI/CD Deploy-Logs
2. **#async-questions:** Fragen, wo sofortige Antwort nicht erwartet wird (Antwort innerhalb 24 Stunden ausreichend)
3. **#sync-now:** Echtzeitkoordination nötig (z.B. Production Incident, Live-Kampagnen-Optimierung)

**Response-Time-Erwartungen:**
- `#sync-now` → 15 Minuten
- `#async-questions` → 24 Stunden
- DM → 48 Stunden (es gibt keine DM-Kultur, Kanäle werden genutzt)

Slack-Threads sind obligatorisch. Direkte Kanalnachrichten sind untersagt — jede Nachricht eröffnet einen Thread. So vermischen sich parallele Gespräche nicht.

### Slack → Granola Integration

Granola ist ein Meeting-Notes-Tool — bei Roibase nutzen wir es aber nur für Client Calls. Interne Meetings gibt es nicht (0–1 Sync Calls pro Woche). Nach dem Client Call sendet Granola sein AI-Transcript in Slack, das Team liest async. Action Items werden automatisch in Linear-Issues umgewandelt (Zapier Trigger).

Granolas Killer-Feature: Grenzenlose numerische Commitments im Transcript werden highlighted („In 2 Wochen A/B-Test-Ergebnisse", „CTR muss um 15 % steigen"). Dafür gibt es automatische Reminders — niemand vergisst.

## Figma: Nicht Design Handoff, sondern Living Spec

Figma ist nicht nur ein Design-Tool — sondern die „Frontend-Spec"-Schicht. Jede UI Component ist in Figma als Variant definiert. Developer kopiert keinen Code aus Figma (keine Copy-CSS-Aktivitäten) — aber liest das Component-Behaviour davon. Zum Beispiel: Ein Button hat in Figma `hover`, `active`, `disabled` States als Frames. Der Code implementiert dieselbe State-Logik.

**Figma → Linear Verbindung:**
In jeder Figma-Datei ist das Plugin „Linear Issue" installiert. Nach Design-Genehmigung eröffnet der Designer direkt ein Linear Issue, pastet den Figma-Link in die Issue-Beschreibung. Der Developer nimmt sich das Issue — er kennt bereits das Design, fragt nicht nach.

Figma-Kommentare fließen nicht in Slack (sonst Benachrichtigungschaos). Stattdessen ein wöchentliches „Figma Digest" — offene Kommentare werden in Linear-Issues konvertiert.

## Integrationsmuster: Wo lebt das Datum?

Tool-Stack-Diskussionen starten meist mit „Welches Tool nutzt du?" Die eigentliche Frage sollte aber sein: „Wo ist das Datum canonical?" Bei Roibase ist Data Ownership so verteilt:

| Datentyp | Source of Truth | Synchronisiert zu |
|---|---|---|
| Aktive Arbeit (WIP) | Linear | Slack Daily Digest |
| Erledigte Arbeit (Retrospektiv) | Notion | Linear (archiviert) |
| Strategische Entscheidungen | Notion (RFC) | Linear (Action Items) |
| Client Meeting Notes | Granola | Slack Thread |
| UI Spec | Figma | Linear Issue-Beschreibung |
| Brand Assets | Notion | Figma (Embed Link) |

Kein duales Source-of-Truth. Falls ein Datum an zwei Stellen canonical aussieht, stimmt eins nicht.

## Benachrichtigungsdisziplin: Wann stumm, wann Lärm

Die größte Gefahr bei modernem Tool-Stack ist Notification Creep. Bei Roibase sieht die Benachrichtigungsstrategie so aus:

**Vollständig abgeschaltet:**
- Linear Mentions (stattdessen Slack Thread)
- Figma-Kommentare (wöchentliches Digest)
- Notion Page Updates (niemand watched)

**Als Digest:**
- Linear Daily Summary (morgens 09:00 Uhr)
- Figma Open Comments Summary (Freitag 17:00 Uhr)
- CI/CD Deploy Log (nach jedem Deploy Slack-Zusammenfassung)

**Echtzeit:**
- `@channel` (nur P0 Incident)
- Granola Client Call Summary (5 Minuten nach Call-Ende)
- Production Error (Sentry → Slack, aber nur in `#sync-now`)

Bei jedem neuen Tool ist die erste Frage: „Sollte das Echtzeit oder als Digest laufen?" Default-Antwort: Digest.

## Was tun wir jetzt?

Statt in Tool-Stack-Gesprächen „Lasst uns auch das verwenden" zu reflexartig zu kopieren, sollte man fragen: „Wo sollte das Datum canonical sein?" Roibases 2026-Stack läuft auf Linear/Notion/Slack/Figma/Granola, aber diese Tools sind austauschbar — wichtig ist das Integrationsmuster, die Benachrichtigungsdisziplin, die Async-First-Kultur. Falls im Team noch jemand sagt „Tool X sendet mir keine Benachrichtigungen," ist das Problem nicht das Tool — es ist: Data Ownership ist unklar.