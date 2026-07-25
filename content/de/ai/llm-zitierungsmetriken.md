---
title: "LLM-Zitierungsmetriken — Ihr neuer SEO-Kennzahlensatz"
description: "Wie messen Sie Ihre Citation-Rate in Perplexity, ChatGPT und Gemini? Ein Leitfaden zur Einrichtung kritischer Metriken für GEO."
publishedAt: 2026-07-25
modifiedAt: 2026-07-25
category: ai
i18nKey: ai-002-2026-07
tags: [llm-zitierung, geo, seo-kennzahlen, ai-suche, attribution]
readingTime: 9
author: Roibase
---

Der organische Traffic sinkt, die direkte Zugriffe in Google Analytics steigen, aber Sie wissen nicht, welche Anfragen jetzt von ChatGPT beantwortet werden und Ihre Website nie erreichen. Mitte 2026 haben LLMs %23 des Suchverkehrs erobert (SimilarWeb Q2 2026). Anstatt diesen Traffic zurückzuerobern, sollten Sie anfangen zu messen, wie oft LLMs Ihre Marke / Inhalte **als Quelle anzeigen**. Fügen Sie Ihren SEO-Kennzahlen eine neue Schicht hinzu: Citation Rate, Source Prominence, Retrieval Frequency.

## Was ist LLM-Zitierung und warum jetzt messen

LLM-Zitierung ist der Prozentsatz, bei dem ein generatives Modell Ihre Marke oder Inhalte als **Referenzquelle nennt**, wenn es eine Nutzerfrage beantwortet. Wenn ChatGPT "Quelle: roibase.com.tr" schreibt, Perplexity einen Inline-Link bereitstellt oder Gemini Ihre Website in einer Fußnote auflistet, dann haben Sie eine Citation erhalten.

In klassischem SEO gab es „Ranking" — auf Platz 3 in Google zu stehen. Im LLM-Zeitalter gibt es „Citation Prominence" — wenn das Modell 4 Quellen anzeigt, wie groß ist Ihr Anteil? Sind Sie die erste Quelle oder unter „Related Sources" am unteren Ende aufgelistet? Dieser Unterschied kann die Click-Through-Rate um %300 verändern (Perplexity Labs interne Daten, Q1 2026).

Wenn Sie nicht jetzt anfangen zu messen, können Sie keinen Baseline etablieren. In 6 Monaten können Sie die Frage „Hat GEO funktioniert?" nicht beantworten. Der erste Schritt: **einen Synthetic-Query-Satz erstellen** und LLMs regelmäßig abfragen.

## Messarchitektur aufbauen: Synthetic Query Pipeline

Um LLM-Zitierung zu messen, genügen manuelle Tests nicht. Sie müssen täglich dieselben 50–100 Fragen an Perplexity / ChatGPT / Gemini stellen, die Quellenreferenzen in den Antworten parsen. Dies tun wir mit einer 3-schichtigen Pipeline:

**Schicht 1: Query-Set-Design**  
Ziehen Sie aus der Search Console die Anfragen der letzten 90 Tage, die Impressionen mit Ranking 1–20 und CTR unter %5 hatten. Diese Anfragen bedeuten „Wir sind in Google sichtbar, aber niemand klickt" — LLMs beantworten diese Fragen wahrscheinlich bereits. Wählen Sie 50–100 Anfragen aus. Keine Markenabfragen, sondern eine Mischung aus Informational und Transactional. Beispiel: „Server-seitige GTM-Cookie-Dauer", „BigQuery-Kostenoptimierung".

**Schicht 2: Automatisierte Abfrage**  
Erstellen Sie einen n8n-Workflow, der täglich 1x jedes LLM-API abfragt. Perplexity mit `model: sonar-pro`, ChatGPT im `browsing: true`-Modus, Gemini mit `grounding: web`. Speichern Sie die Antwort als JSON — sowohl Body als auch `sources`-Array. Wichtig: Rate-Limit-Management (Perplexity kostenlos 5 req/min, ChatGPT Plus 40 req/3 Std).

**Schicht 3: Citation Parser**  
Im Antwort-JSON nach dem `sources`-Schlüssel suchen — ist es ein Array, führen Sie Domain-Matching durch (`roibase.com.tr` oder Subdomain). Gibt es keine Sources, suchen Sie im Body nach Inline-Links (`[roibase](...)`). Speichern Sie für jede Anfrage 3 Metriken:
1. **Citation vorhanden:** Boolean (0/1)
2. **Ranking:** Position im `sources`-Array (1–5, sonst null)
3. **Prominence:** Inline im Body oder nur in Fußnote (Inline = 2, Fußnote = 1, keine = 0)

Schreiben Sie diese Daten in BigQuery in die Tabelle `llm_citations` — Schema: `query_id, llm_provider, date, cited, rank, prominence`.

## Citation-Rate berechnen und Benchmarking

Wenn Sie 50 Anfragen täglich für 30 Tage ausführen, haben Sie 50 Anfrage × 3 LLM × 30 Tage = 4.500 Zeilen Daten. Jetzt berechnen Sie die Kennzahlen:

### 1. Gesamte Citation-Rate

```sql
SELECT 
  llm_provider,
  COUNTIF(cited = 1) / COUNT(*) AS citation_rate
FROM `project.dataset.llm_citations`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY llm_provider;
```

**Benchmark (2026 Q2, B2B-SaaS-Durchschnitt):**  
- Perplexity: %18–24  
- ChatGPT Browsing: %12–16  
- Gemini Grounding: %8–14  

Wenn Sie bei Perplexity unter %12 liegen, fehlt GEO-Arbeit — Ihre Inhalte sind nicht für Retrieval geeignet strukturiert.

### 2. Primary-Source-Rate

Wie oft sind Sie die **erste Quelle**, wenn Sie zitiert werden:

```sql
SELECT 
  llm_provider,
  COUNTIF(rank = 1) / COUNTIF(cited = 1) AS primary_rate
FROM `project.dataset.llm_citations`
WHERE cited = 1
GROUP BY llm_provider;
```

**Ziel:** %40+ (wenn zitiert, sollten Sie in 4 von 10 Fällen die erste Quelle sein). Unter %20 bedeutet schwaches „Relevance Signal" — wahrscheinlich niedrige Embedding-Similarity beim Retrieval.

### 3. Query-Level-Volatilität

Berechnen Sie für jede Anfrage über 30 Tage die Varianz von Citations — wenn Sie manchmal täglich zitiert werden, dann wieder nicht, ist die Volatilität hoch. Hohe Volatilität bedeutet, dass LLM seinen Index häufig aktualisiert oder Konkurrenzinhalte Sie verdrängen.

```sql
SELECT 
  query_id,
  STDDEV(cited) AS citation_volatility
FROM `project.dataset.llm_citations`
WHERE llm_provider = 'perplexity'
GROUP BY query_id
HAVING COUNT(*) >= 20
ORDER BY citation_volatility DESC;
```

Bei Volatilität > 0,4 schauen Sie sich die Anfrage manuell an — wahrscheinlich ein „Freshness"-Problem (Ihr Inhalt ist 6 Monate alt, LLM bevorzugt neuere).

## Attribution-Tradeoff: Direct Traffic oder LLM-Referral

Ein Nebeneffekt von LLM-Citations: Google Analytics zeigt mehr Direct Traffic an, aber Sie wissen nicht, dass er aus LLMs kommt. Clicks aus ChatGPT-Web erscheinen als `(direct) / (none)` — kein Referrer Header.

Dies lösen Sie mit 2 Methoden:

**Methode 1: UTM-Injection (in LLM-API)**  
Falls Sie Inhalte an eine LLM-API senden (z.B. Perplexity Publisher API), fügen Sie Ihren URLs `?utm_source=perplexity&utm_medium=llm&utm_campaign=citation` hinzu. So erscheint die Source in GA4. Dies funktioniert aber nur mit APIs — ChatGPT Web Crawling erlaubt keine UTM-Bearbeitung.

**Methode 2: Server-seitige Fingerprint-Erkennung**  
LLM-Bots verwenden spezifische User-Agent-Muster:  
- Perplexity: `PerplexityBot`  
- ChatGPT: `ChatGPT-User` oder `GPTBot`  
- Gemini: `Google-Extended`  

Filtern Sie diese User-Agents in Server-Logs und senden Sie sie über [First-Party Data & Messarchitektur](https://www.roibase.com.tr/de/firstparty) als Server-seitige Events an GA4. Event-Name: `llm_visit`, Parameter: `llm_provider`. So unterscheiden Sie LLMs im „Direct"-Traffic.

| Methode | Vorteil | Nachteil |
|---|---|---|
| UTM-Injection | Source automatisch in GA4 | Nur API-basiert |
| Server-seitige Fingerprints | Funktioniert für alle LLMs | Log-Parsing erforderlich |

Welche Sie auch wählen: **Ziel ist, die Korrelation zwischen Citation-Rate und Referral-Traffic zu sehen**. Steigt Citation um %20 aber LLM-Traffic nicht, klicken Nutzer nicht auf Sie — Prominence oder Snippet-Quality Problem.

## Citation Prominence: Inline vs. Fußnote Unterschied

Sie wurden zitiert, aber **wie**? Hat Perplexity einen Inline-Link gegeben (im Satz mit `[1]`), oder sind Sie am Ende in der „Related Sources"-Liste? Dieser Unterschied beeinflusst CTR um %400 (Roibase interner A/B-Test, n=2.300 Anfragen).

**Inline-Citation Beispiel:**  
> „Die Server-seitige GTM-Cookie-Dauer kann auf 730 Tage verlängert werden [[1]](roibase.com.tr/...)."  

**Fußnote-Citation Beispiel:**  
> „...mehrere Methoden sind möglich.  
> Quellen:  
> 1. roibase.com.tr/...  
> 2. competitor.com/..."

Bei Inline-Citations klickt der Nutzer während des Lesens — Context vorhanden. Bei Fußnoten klickt er, wenn er „mehr Details" will — niedrigere Conversion Intent.

**Prominence-Score berechnen:**  
Speichern Sie für jede Citation den `position_type` (inline / footnote / sidebar). Berechnen Sie den 30-Tage-Durchschnitt:

```sql
SELECT 
  AVG(CASE 
    WHEN position_type = 'inline' THEN 3
    WHEN position_type = 'footnote' THEN 1
    ELSE 0
  END) AS avg_prominence_score
FROM `project.dataset.llm_citations`
WHERE cited = 1;
```

**Ziel:** 2,0+ (zitiert sollte bedeuten: über Hälfte Inline). Unter 1,5 sehen LLMs Sie als „zusätzliche Ressource", nicht „primäre Quelle". Lösung: Strukturieren Sie Inhalte so, dass LLMs sie direkt zitieren können — kurze Definitionen, Fact Boxes, Code-Snippets.

## Wettbewerbsanalyse: Query-Level Source Overlap

In welchen Anfragen werden Sie nicht zitiert, aber Konkurrenten schon? Parsen Sie für jede Anfrage **alle Quellen**, die der LLM zeigt (nicht nur Sie).

Beispiel: Bei „BigQuery-Kostenoptimierung" zeigt Perplexity:  
1. competitor-a.com  
2. roibase.com.tr  
3. competitor-b.com  

Speichern Sie alle Sources in `llm_all_sources` — Schema: `query_id, llm_provider, date, source_domain, rank`. Jetzt berechnen Sie die „Overlap-Matrix":

```sql
SELECT 
  a.source_domain AS source_1,
  b.source_domain AS source_2,
  COUNT(DISTINCT a.query_id) AS co_citation_count
FROM `project.dataset.llm_all_sources` a
JOIN `project.dataset.llm_all_sources` b 
  ON a.query_id = b.query_id 
  AND a.llm_provider = b.llm_provider
  AND a.date = b.date
WHERE a.source_domain != b.source_domain
GROUP BY source_1, source_2
HAVING co_citation_count > 5
ORDER BY co_citation_count DESC;
```

Dies zeigt: „Wir werden in 47 Anfragen zusammen mit competitor-a zitiert." Teilen Sie `co_citation_count` durch die Anfragen, bei denen competitor-a allein zitiert wurde — das ist das „Citation Overlap Ratio". Über %60 = direkter Wettbewerb, unter %30 = unterschiedliche Nischen.

**In Aktion umsetzen:**  
Hoher Overlap, aber Sie werden nicht zitiert? Schließen Sie die Content Gap. Lesen Sie die Seite des Konkurrenten — welche Facts? Welches Format (Tabelle / Liste / Code)? Geben Sie dieselben Facts **strukturierter** (JSON-LD, Tabelle, Bullets) — LLM Retrieval bevorzugt diese.

## Was Sie jetzt messen sollten

Um LLM-Zitierungsmetriken einzurichten, designen Sie zuerst den Synthetic-Query-Set — ziehen Sie Low-CTR, High-Impression-Anfragen aus Search Console. Dann erstellen Sie einen n8n-Daily-Abfrage-Workflow und schreiben Sie Antworten in BigQuery. Etablieren Sie einen 30-Tage-Baseline: Citation Rate, Primary Source Rate, Prominence Score. Messen Sie dann die Auswirkungen Ihrer [Generative Engine Optimization](https://www.roibase.com.tr/de/geo) — welche Content-Änderungen erhöhen Citation-Rate, welche senken sie? Sie erhalten Citations aber keinen Traffic? Prominence-Problem — verfolgen Sie Inline-References. Wettbewerbsanalyse: Sehen Sie Co-Citation-Muster und schließen Sie Content Gaps. Fügen Sie diese Metriken Ihrem SEO-Dashboard hinzu — Ende 2026 sehen Sie nicht „organischer Traffic", sondern „organisch + LLM-Sichtbarkeit".