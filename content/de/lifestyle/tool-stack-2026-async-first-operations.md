---
title: "Tool Stack 2026: Wie Roibase die Meeting-freie Woche umsetzt"
description: "Linear, Notion, Slack, Figma, Granola – bewährte Integrationsmuster aus 8 Jahren und konkrete Kriterien für asynchrone Teamoperationen."
publishedAt: 2026-06-10
modifiedAt: 2026-06-10
category: lifestyle
i18nKey: lifestyle-004-2026-06
tags: [tool-stack, async-first, linear, notion, workflow-design]
readingTime: 9
author: Roibase
---

Das Roibase-Team absolviert 2026 durchschnittlich 2 Stunden Meetings pro Woche – der Rest läuft über Linear-Sprints, Notion-Dokumente und Slack-Threads synchronisiert ab. Im Jahr 2019 waren es noch 18 Stunden. Nicht die Tools selbst haben sich verändert, sondern das Integrationsmuster, mit dem wir sie verbinden. Ein Task, der in Linear geöffnet wird, erstellt automatisch einen Slack-Thread, verlinkt das Notion-Spec-Dokument und ankert sich in einem Figma-Design-Frame. Dieser Artikel legt die Engineering-Seite dieses Integrationssystems offen – welche Tools wir warum gewählt haben, welche Automatisierungsregeln wir warum implementiert haben und welche Metriken wir tracken.

## Linear: Task als Kontextträger, nicht als Aufgabenliste

Linear nutzen wir nicht als Issue Tracker – jede Karte ist ein Mini-Spec. Beim Öffnen eines Tasks sind Felder obligatorisch: Zielmetrik (CTR +5%, TTI <2s), verknüpftes Notion-Dokument, Figma-Frame-Link. Sobald die Karte erstellt wird, öffnet sich automatisch ein Slack-Thread (Zapier-Integration), das Team beginnt mit asynchronen Diskussionen. Das Muster dahinter: es gibt kein "Quick Task" in Linear – jede Karte trägt mindestens 2 externe Kontextreferenzen mit sich.

Wir tracken Sprint Velocity, aber auf einer anderen Ebene: nicht die Anzahl geschlossener Tasks, sondern die **durchschnittliche Task-Durchlaufzeit** (von Eröffnung bis Abschluss). 2025 lag diese bei 38 Stunden, 2026 bei 29 Stunden. Der Grund: Spec-Klarheit. Wenn die Zielmetrik in der Linear-Karte dokumentiert ist, sinkt die Diskussion im Code Review um 60% (eigene Messwerte).

### Linear + Notion Integrationsmuster

Es gibt eine Regel: Jede Linear-Karte muss im Feld `Related Resources` ein Notion-Dokument verlinken – wir enforzen das manuell (nicht automatisiert, weil der Kontext vom Team, nicht vom Bot kommen soll). Das Notion-Dokument folgt meist 3 Abschnitten: Problembeschreibung, vorgeschlagene Lösung, Akzeptanzkriterien. Eine Linear-Karte kann aus Notion abgeleitet werden, aber nicht umgekehrt – das Spec wird zuerst geschrieben, der Task danach eröffnet.

Diese Disziplin hat die Code-Review-Zeit von durchschnittlich 4,2 Stunden (2024) auf 2,7 Stunden gesenkt. Im Review gibt es keine Frage "Warum ist das so?" – die Antwort steht bereits in Notion.

## Slack: Thread-First, nicht kanal-basiert

Slack nutzen wir nicht nach Kanälen organisiert, sondern thread-basiert. In öffentliche Kanäle posten ist verboten – jede Nachricht beginnt entweder in einem Linear-Task-Thread oder in einem Notion-Document-gebundenen Thread. Der Grund für dieses Muster: Suchbarkeit strukturieren. Wenn im Slack nach "Wie funktioniert Feature X?" gesucht wird, erscheint automatisch die Linear-Task-ID, da Zapier beim Thread-Erstellen die Task-ID in den Slack-Text einbettet.

Unser Ziel für asynchrone Antwortzeit: 4 Stunden (während Geschäftszeiten). Wie messen wir das? Median Thread Response Time aus der Slack Analytics API – Q4 2025 waren es 3,2 Stunden, Q1 2026 waren es 2,9 Stunden. Diesen Wert teilen wir in Sprint Retrospectives, aber tracken ihn nicht individuell – es geht um Systemoptimierung, nicht um Einzelleistung.

## Figma: Design Token an Linear gekoppelt

Figma nutzen wir nicht nur als Designwerkzeug – Design Token sind direkt an Linear-Tasks gebunden. Wenn eine Button-Komponente in Figma verändert wird, werden automatisch alle Linear-Karten getaggt, die diese Komponente nutzen (Figma API + Zapier). Das Team sieht innerhalb von 10 Minuten, welche Tasks betroffen sind.

Diese Integration entstand 2024 in einem unternehmensinternen Hackathon. Zuerst hielten wir sie für "über-engineert", aber während eines Brand-Refresh merkten wir, dass wir alle Button-States in 3 Tagen updateten – mit dem alten System hätte das 2 Wochen gedauert. Design-Code-Sync ist in [Branding](<https://www.roibase.com.tr/de/branding>)-Projekten der größte Engpass – diese Integration reduziert ihn um 70%.

### Design Token Versionierung

Design Token in Figma unterliegen nicht Git-Versionskontrolle, aber Linear-Tasks protokollieren Token-Änderungen mit Timestamp. Ein Task notiert etwa "Button-CTA-Farbe von #FF5733 zu #E84C3D gewechselt", dieses Log wird automatisch in das Notion-Design-Changelog eingefügt. So wird die Frage "Welche Farbe hatte das vor 3 Monaten?" in 30 Sekunden beantwortet.

## Granola: Das Meeting-Verbindungswerkzeug

Wir sagten: 2 Stunden Meeting pro Woche – die Hälfte ist Client-Call, die Hälfte Sprint Planning. Nach jedem Meeting erstellt Granola automatisch Transkript + Action Items. Action Items werden zu Linear-Karten konvertiert (manuell, aber mit Template), Transkripte werden in Notion eingebettet. Ein Teamkollege, der nicht im Meeting war, erfasst in 10 Minuten den vollständigen Kontext – wir sparen Zeit für Meeting-Protokolle.

Granolas kritische Funktion: Action Items werden automatisch kategorisiert (Design, Dev, Marketing). Bei der Task-Eröffnung in Linear wird das richtige Label automatisch vorgeschlagen. Dieses kleine Detail verkürzte die Task-Zuweisung nach Client-Calls von 15 auf 3 Minuten.

## Notion: Nicht Wiki, sondern Zustandsmaschine

Notion nutzen wir nicht als Wissensdatenbank, sondern als State Machine. Jedes Dokument hat 3 Zustände: Draft (wird geschrieben), Review (Linear-Task verlinkt, asynchrone Diskussion läuft), Canonical (Quelldokument, unveränderlich). Der Zustandswechsel ist manuell, aber die Regel ist eindeutig: Um von Review zu Canonical zu gehen, braucht es mindestens 2 Team-Approvals ("Thumbs up"-Reactions im Slack-Thread).

Canonical-Dokumente ändern sich nicht – bei Änderungsbedarf wird eine neue Version erstellt, das alte Dokument wird mit "Archived" gekennzeichnet. Diese Disziplin sichert: Die Frage "Warum wurde diese Entscheidung getroffen?" hat immer eine Antwort – das Archive zeigt die alte Fassung, die Linear-Tasks zeigen den Kontext, der Slack-Thread zeigt die Diskussion.

### Database Views und automatisches Tagging

In Notion gibt es 4 Haupt-Datenbanken: Specs, Decisions, Experiments, Changelogs. Jede wird automatisch mit Linear und Slack getaggt (Zapier + Notion API). Ein neues Spec-Dokument erstellt sich selbst ein "related tasks"-Feld – welche Karten referenzieren dieses Spec? Diese Query läuft täglich um 9 Uhr, das Dokument bleibt aktuell.

## 3 Kernregeln der Integrationsmuster

8 Jahre Versuch und Irrtum haben diese Regel gelehrt: Jedes Tool hat **einen** "Source of Truth"-Bereich, andere Tools binden sich daran an.

- **Linear:** Source of Truth für Task-Status und Timeline. Notion kann Specs schreiben, aber nur Linear ändert den Task-Status.
- **Notion:** Source of Truth für Specs und Entscheidungsdokumente. Linear verlinkt Notion, aber Notion aktualisiert Linear nicht.
- **Slack:** Source of Truth für asynchrone Diskussionen. Threads öffnen sich automatisch, aber Thread-Inhalte werden manuell in Notion migriert (kein Auto-Sync, sonst sinkt das Signal-Rausch-Verhältnis).

Zweite Regel: Jede Automatisierung muss rückgängig machbar sein. Zapier-Workflows haben auch Manual-Trigger – das Team kann bei Bedarf "Bei Linear-Task-Eröffnung keinen Slack-Thread erstellen" für einen Sprint deaktivieren (z.B. in intensiven Entwicklungsphasen zur Rauschreduktion). Automatisierung soll Disziplin unterstützen, nicht erzwingen.

Dritte Regel: Metrik-Tracking auf Team-Ebene, nicht individuell. Slack Response Time, Linear Cycle Time, Notion Dokument-Approval-Dauer – alles wird in Sprint Retrospectives geteilt, aber nichts davon fließt in Individual Performance Reviews. Das Ziel: Systemoptimierung, nicht Einzelwettbewerb.

## Warum diese Tools, nicht jene?

Wir nutzen nicht Jira statt Linear, weil Jira Spec-Schreiben nicht fördert – Tasks öffnen sich schnell, Kontext kommt später. Linear erzwingt das Gegenteil: Description ist obligatorisch, nicht leer lassbar. Dieser winzige UX-Unterschied erzeugt Kulturdifferenz.

Wir nutzen nicht Confluence statt Notion, weil Confluence auf Enterprise-Versionskontrolle zielt – für kleine Teams zu komplex. Notion Database Views sind flexibel, Linear- und Slack-Integrationen sind lightweight.

Wir nutzen nicht Discord statt Slack, weil Discord Threads gamifiziert sind, Slack-Threads sich für Business-Kontext klarer anfühlen. Slacks Suchzugriff arbeitet nativ mit Linear-Task-IDs.

Wir nutzen nicht Adobe XD statt Figma, weil Figma API offen ist und Zapier-Integration unterstützt. XDs API ist eingeschränkt.

Wir nutzen nicht Otter.ai statt Granola, weil Granola Action Items nativ extrahiert – Otter erstellt Transkripte, Action Items musst du manuell herauskratzen.

Der Stack bei Roibase ist nicht statisch – 2024 wechselten wir von Loom zu Tella (schnellere Uploads, Linear-Embed-Support). 2025 testeten wir Make.com statt Zapier, kehrten aber zurück (Zapier-Error-Logs sind lesbarer). Tool-Wahl ist variabel, Integrationsmuster ist fix: Jedes Tool hat einen "Source of Truth"-Bereich, andere binden sich an ihn.