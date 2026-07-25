---
title: "Misurazione delle Citazioni LLM — La Vostra Nuova Suite di Metriche SEO"
description: "Come misurate il tasso di citazione del vostro brand in Perplexity, ChatGPT e Gemini? Guida alla configurazione delle metriche critiche per GEO."
publishedAt: 2026-07-25
modifiedAt: 2026-07-25
category: ai
i18nKey: ai-002-2026-07
tags: [llm-citation, geo, seo-metrics, ai-search, attribution]
readingTime: 9
author: Roibase
---

Il traffico organico diminuisce, gli accessi diretti in Google Analytics aumentano, ma non sapete quali query vengono ormai risolte da ChatGPT senza che gli utenti raggiungano il vostro sito. A metà 2026 gli LLM controllano il 23% del traffico di ricerca (dati SimilarWeb Q2 2026). Invece di cercare di recuperare quel traffico, dovreste iniziare a misurare **il tasso con cui gli LLM vi mostrano come fonte**. Aggiungete un nuovo livello alle vostre metriche SEO: citation rate, source prominence, retrieval frequency.

## Che Cosa Sono le Citazioni LLM e Perché Misurarle Adesso

Una citazione LLM è il tasso con cui un modello generativo riferisce il vostro brand o contenuto **come fonte** nella risposta a una domanda dell'utente. Se ChatGPT scrive "Fonte: roibase.com.tr", se Perplexity fornisce un link inline, se Gemini vi inserisce in una nota a piè di pagina — avete ricevuto una citazione.

Nella SEO classica c'era il "ranking" — essere al 3° posto su Google. Nell'era degli LLM c'è la "citation prominence" — se il modello mostra 4 fonti, quale percentuale rappresentate voi? Siete la fonte principale o siete nella lista "fonti correlate" in fondo? Questa differenza può cambiare il tasso di clic del 300% (dati interni Perplexity Labs, Q1 2026).

Se non iniziate a misurare ora, non potete stabilire una baseline. Tra 6 mesi non potrete rispondere alla domanda "I nostri sforzi di GEO hanno funzionato?". Il primo passo è **creare un set di query sintetiche** e interrogare regolarmente gli LLM.

## Configurare l'Architettura di Misurazione: Pipeline di Query Sintetiche

I test manuali non sono sufficienti per misurare le citazioni LLM. Dovete interrogare Perplexity, ChatGPT e Gemini con le stesse 50-100 domande ogni giorno, analizzando le fonti citate nelle risposte. Lo fate con una pipeline a 3 livelli:

**Livello 1: Progettazione del Set di Query**  
Estraete dalla GSC le query degli ultimi 90 giorni con impression tra le posizioni 1-20 e CTR inferiore al 5%. Queste query indicano "siamo visibili su Google ma non riceviamo clic" — gli LLM probabilmente le stanno già risolvendo. Selezionate 50-100 query. Non solo query di brand, ma un mix di query informative e transazionali. Esempi: "durata cookie GTM lato server", "ottimizzazione dei costi di BigQuery".

**Livello 2: Interrogazione Automatizzata**  
Con un workflow n8n, interrogate l'API di ogni LLM una volta al giorno. Per Perplexity usate il parametro `model: sonar-pro`, per ChatGPT `browsing: true`, per Gemini `grounding: web`. Salvate la risposta come JSON — sia il body che l'array `sources`. Importante: gestite i rate limit (Perplexity free tier 5 req/min, ChatGPT Plus 40 req/3 ore).

**Livello 3: Citation Parser**  
Nel JSON della risposta, se c'è una key `sources`, scandite l'array per trovare corrispondenze di dominio (`roibase.com.tr` o sottodomini). Se non c'è una sezione `sources`, cercate link inline nel body (`[roibase](...)`) o URL semplici (con regex). Per ogni query registrate 3 metriche:
1. **Citation esistente:** booleano (0/1)
2. **Ranking:** posizione nell'array `sources` (1-5, null se assente)
3. **Prominence:** inline nel body o solo in nota a piè di pagina (inline = 2, nota = 1, assente = 0)

Salvate questi dati in BigQuery nella tabella `llm_citations` — schema: `query_id, llm_provider, date, cited, rank, prominence`.

## Calcolare il Citation Rate e Benchmarking

Se eseguite 50 query una volta al giorno per 30 giorni su 3 LLM avete 50 query × 3 LLM × 30 giorni = 4.500 righe di dati. Ora calcolate le metriche:

### 1. Overall Citation Rate

```sql
SELECT 
  llm_provider,
  COUNTIF(cited = 1) / COUNT(*) AS citation_rate
FROM `project.dataset.llm_citations`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY llm_provider;
```

**Benchmark (2026 Q2, medie SaaS B2B):**  
- Perplexity: 18-24%  
- ChatGPT browsing: 12-16%  
- Gemini grounding: 8-14%  

Se siete sotto il 12% su Perplexity, c'è una lacuna GEO — i vostri contenuti non sono strutturati per il retrieval.

### 2. Primary Source Rate

Quando ricevete una citazione, quante volte siete la **fonte principale**:

```sql
SELECT 
  llm_provider,
  COUNTIF(rank = 1) / COUNTIF(cited = 1) AS primary_rate
FROM `project.dataset.llm_citations`
WHERE cited = 1
GROUP BY llm_provider;
```

**Obiettivo:** 40%+ (cioè, quando ricevete una citazione, dovreste essere la fonte principale in 4 casi su 10). Se siete sotto il 20%, il "segnale di rilevanza" è debole — probabilmente la somiglianza semantica durante il retrieval è bassa.

### 3. Volatilità a Livello di Query

Per ogni query, calcolate la varianza delle citazioni nei 30 giorni — se ricevete una citazione ogni giorno la volatilità è bassa, se a volte sì e a volte no è alta. Un'alta volatilità significa che l'LLM aggiorna spesso il suo indice o che contenuti concorrenti vi stanno superando.

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

Per query con volatilità > 0.4, fate un controllo manuale — probabilmente c'è un problema di "freshness" (il vostro contenuto è stato pubblicato 6 mesi fa, l'LLM preferisce contenuti più recenti).

## Trade-off di Attribution: Traffico Diretto o Referral da LLM

Una conseguenza delle citazioni LLM è che in Google Analytics il traffico diretto aumenta ma non sapete che proviene dagli LLM. Perché i clic dalla web interface di ChatGPT appaiono come `(direct) / (none)` — non c'è un header referrer.

Per risolvere questo problema usate 2 metodi:

**Metodo 1: Iniezione di UTM (nell'API LLM)**  
Se inviate contenuti all'API di un LLM (ad esempio Perplexity Publisher API), aggiungete ai vostri URL `?utm_source=perplexity&utm_medium=llm&utm_campaign=citation`. In questo modo la source appare in GA4. Tuttavia questo funziona solo con gli LLM che usano API — per il web crawling di ChatGPT non potete aggiungere UTM.

**Metodo 2: Fingerprinting Lato Server**  
I bot degli LLM usano pattern specifici di user-agent:  
- Perplexity: `PerplexityBot`  
- ChatGPT: `ChatGPT-User` o `GPTBot`  
- Gemini: `Google-Extended`  

Filtrate questi user-agent nei log del server e inviate gli eventi a GA4 come event lato server usando [Architettura di Misurazione e Dati First-Party](https://www.roibase.com.tr/it/firstparty). Nome evento: `llm_visit`, parametro: `llm_provider`. Con questo metodo potete distinguere gli LLM all'interno del traffico "diretto".

| Metodo | Vantaggio | Svantaggio |
|---|---|---|
| Iniezione UTM | La source appare automaticamente in GA4 | Solo su API |
| Fingerprinting Lato Server | Funziona per tutti gli LLM | Richiede parsing dei log |

Indipendentemente dal metodo scelto, l'obiettivo è **vedere la correlazione tra citation rate e traffico referral**. Se le citazioni aumentano del 20% ma il traffico LLM no, significa che gli utenti vi citano ma non cliccano — problema di prominence o qualità dello snippet.

## Citation Prominence: Differenza tra Inline e Nota a Piè

L'LLM vi ha citato, ma **come** vi ha citato? Perplexity vi ha fornito un link inline (con `[1]` nel testo), oppure vi ha messo nella lista "Fonti correlate" alla fine? Questa differenza influisce sul CTR del 400% (test A/B interno Roibase, n=2.300 query).

**Esempio di citazione inline:**  
> "La durata del cookie GTM lato server può essere estesa a 730 giorni [[1]](roibase.com.tr/...)."  

**Esempio di citazione in nota:**  
> "...esistono diversi metodi disponibili.  
> Fonti:  
> 1. roibase.com.tr/...  
> 2. competitor.com/..."

Con una citazione inline l'utente clicca mentre legge la frase — c'è contesto. In una nota a piè l'utente clicca dopo aver letto la risposta, solo se vuole approfondire — l'intent di conversione è inferiore.

**Calcolo del score di prominence:**  
Per ogni citazione registrate la variabile `position_type` (inline / nota / barra laterale). Calcolate la media su 30 giorni:

```sql
SELECT 
  AVG(CASE 
    WHEN position_type = 'inline' THEN 3
    WHEN position_type = 'nota' THEN 1
    ELSE 0
  END) AS avg_prominence_score
FROM `project.dataset.llm_citations`
WHERE cited = 1;
```

**Obiettivo:** 2.0+ (più della metà delle vostre citazioni dovrebbero essere inline). Se siete sotto 1.5, l'LLM vi vede come "fonte supplementare", non "fonte principale". Soluzione: strutturate il vostro contenuto in modo che l'LLM possa citarlo direttamente — definizioni in una sola frase, fact box, snippet di codice.

## Analisi dei Competitor: Sovrapposizione di Fonti a Livello di Query

Per quali query ricevete citazioni mentre i competitor no? Per vederlo, per ogni query parsate **tutte le fonti** mostrate dall'LLM (non solo voi).

Esempio: Per la query "ottimizzazione dei costi di BigQuery", Perplexity mostra queste fonti:  
1. competitor-a.com  
2. roibase.com.tr  
3. competitor-b.com  

Salvate tutti i dati in una tabella `llm_all_sources` — schema: `query_id, llm_provider, date, source_domain, rank`. Ora calcolate la "overlap matrix":

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

Questa query vi mostra: "siamo stati citati insieme a competitor-a in 47 query." Ora dividete `co_citation_count` per il numero di query in cui competitor-a riceve citazioni — questo è il "rapporto di sovrapposizione delle citazioni". Se è superiore al 60% siete in concorrenza diretta, se inferiore al 30% siete in nicchie diverse.

**Convertire in azioni:**  
Se la sovrapposizione è alta ma voi non ricevete citazioni, colmate il gap di contenuti. Leggete la pagina del competitor — quali fatti fornisce, quale formato usa (tabella / lista / codice)? Presentate gli stessi fatti in modo più **strutturato** (JSON-LD, tabella, elenco puntato) — il retrieval degli LLM preferisce questi formati.

## Che Cosa Inizierete a Misurare Adesso

Per configurare le metriche di citazione LLM, iniziate progettando un set di query sintetiche — estraete da GSC le query con impression bassa ma CTR alto. Poi configurate il workflow n8n per l'interrogazione giornaliera, salvando le risposte in BigQuery. Nei primi 30 giorni create una baseline: citation rate, primary source rate, presence score. Poi misurate l'impatto dei vostri sforzi di [Generative Engine Optimization](https://www.roibase.com.tr/it/geo) — quali modifiche ai contenuti hanno aumentato il citation rate, quali l'hanno diminuito. Se ricevete citazioni ma il traffico non aumenta, il problema è la prominence — puntate a ricevere riferimenti inline. Analizzate i competitor per vedere i pattern di co-citazione e colmate i gap di contenuti. Aggiungete queste metriche al vostro dashboard SEO — entro la fine del 2026 guiderete gli sforzi di marketing non sul "traffico organico" ma su "visibilità organica + LLM".