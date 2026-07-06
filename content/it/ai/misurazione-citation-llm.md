---
title: "Misurazione delle citazioni LLM — Il vostro nuovo set di metriche SEO"
description: "Come tracciare il tasso di citazione del vostro brand su Perplexity, ChatGPT e Gemini? Metriche di visibilità dei motori generativi e architettura di misurazione."
publishedAt: 2026-07-06
modifiedAt: 2026-07-06
category: ai
i18nKey: ai-002-2026-07
tags: [llm-citation, geo-metrics, ai-search, generative-seo, brand-visibility]
readingTime: 9
author: Roibase
---

Il traffico proveniente dalla SERP di Google è calato del 40%, ma il vostro brand è stato citato 3 volte nella risposta di ChatGPT. È un guadagno o una perdita? Le metriche SEO tradizionali — impressioni, CTR, posizione — non sono più sufficienti. Gli utenti pongono le loro domande ai LLM e Google Analytics non sa se il vostro brand è stato citato. Nel 2026, per i team di marketing della performance: **citation rate, inference share, source attribution** sono le nuove metriche di realtà. Se non le misurate, siete invisibili.

## La cecità della metrica SERP

Google Search Console vi dice che siete in posizione 10 con 5.000 impressioni. Ma lo stesso utente che fa la ricerca su Perplexity vede il vostro contenuto citato nella risposta e visita direttamente il vostro sito — GSC lo registra come "direct". Il vostro brand è stato fonte in un riassunto sintetizzato via Claude API — questo traffico Search Console non lo vede. Questa cecità opera su 3 livelli:

**Attribuzione del traffico:** Gli LLM non inviano header referrer, non utilizzano parametri utm. Il visitatore che arriva da una citazione viene registrato come "organic search" o "direct". L'origine reale scompare — non potete fare A/B test, non potete calcolare il ROI.

**Consapevolezza del brand:** L'utente potrebbe non visitare il vostro sito ma scopre il vostro brand. Se ChatGPT cita il vostro sito come "fonte affidabile" in una risposta di 500 parole, questo crea brand lift. I tool SEO tradizionali non catturano questo effetto.

**Posizionamento competitivo:** Il vostro competitor è citato 5 volte nella stessa risposta, voi 0 volte — eppure Search Console mostra che siete entrambi in posizione 3. La frequenza di citazione è il nuovo "tasso di acquisizione di featured snippet", ma ancora non esiste una dashboard per misurarla.

## Definire le metriche di citazione

Per misurare la visibilità LLM, servono 4 metriche core:

**Citation rate:** La frequenza con cui il vostro brand o il vostro contenuto vengono referenziati nelle risposte LLM. Formula: `(numero di risposte in cui il vostro brand è citato) / (numero totale di query pertinenti eseguite)`. Esempio: nella categoria "headless commerce", ChatGPT vi cita in 120 risposte su 1.000 query — il vostro citation rate è del 12%. Questa metrica è indicatore diretto dell'autorità del brand.

**Source position:** In che posizione della lista di citazioni siete. Perplexity generalmente mostra 3-6 fonti — essere in primo posto genera il 60% di click-through in più (dati di test interno Roibase, Q4 2025). Senza tracciare la posizione, non conoscete il valore reale del vostro citation rate.

**Inference share:** La percentuale del contenuto della risposta che proviene dai vostri articoli. Se ChatGPT genera una risposta di 300 parole e 80 di queste vengono dal vostro articolo? Si misura con l'algoritmo di somiglianza semantica (cosine similarity >0,85 è la soglia). Un inference share elevato = il modello utilizza il vostro tono, il vostro framing — questa è propagazione della brand voice.

**Prompt coverage:** Per quali tipi di query siete citati. Siete citati nei query informativi "Cos'è una CDP" ma non in quelli commerciali "Confronto vendor CDP"? L'analisi della coverage guida la vostra strategia editoriale — quali gap di intent dovete colmare?

### Frequenza di misurazione

Queste metriche non sono in tempo reale — gli LLM non sono deterministici, lo stesso prompt può generare risposte diverse. Una misurazione batch settimanale è sufficiente: attivate automaticamente 100-200 seed prompt, parse le risposte ed estraete le citazioni. Le fluttuazioni giornaliere sono rumore, il trend settimanale è il segnale.

## Architettura di raccolta dati

Per il tracking delle citazioni servono 3 componenti: **prompt pipeline, response parser, attribution engine**.

**Prompt pipeline:** Prendete il vostro set di keyword seed (i 50-100 query con il maggior numero di impressioni da GSC) e li inviate in parallelo a ogni API di modello. Potete usare un workflow n8n o un DAG Airflow attivato una volta a settimana. I parametri del modello devono essere fissi per ogni prompt — temperature=0,3, top_p=0,9 — altrimenti i risultati non saranno riproducibili.

Calcolo dei costi API: ChatGPT-4o API ~$0,005/query (500 token input + 1.500 token output in media), Gemini Pro ~$0,003, Claude Sonnet ~$0,006. 100 prompt × 3 modelli × 4 settimane = 1.200 request = $6-7/mese. Questo budget non è sufficiente per il tracking in tempo reale ma è adatto a uno snapshot settimanale.

**Response parser:** Dovete convertire l'output LLM in dati strutturati. Il formato delle citazioni varia per modello — ChatGPT usa `[1]`, Perplexity usa `[^1]`, Claude utilizza footnote markdown. Una combinazione di regex + NER (Named Entity Recognition): estraete prima i marker di citazione, poi fate match con i domain/brand name. Esempio Python:

```python
import re
from urllib.parse import urlparse

def extract_citations(response_text):
    # Citation pattern: [1], [^2], etc.
    pattern = r'\[(\^?\d+)\]'
    markers = re.findall(pattern, response_text)
    
    # Source URL extraction (model-specific)
    sources = re.findall(r'https?://[^\s\)]+', response_text)
    
    citations = []
    for idx, url in enumerate(sources):
        domain = urlparse(url).netloc
        citations.append({
            'position': idx + 1,
            'domain': domain,
            'is_own_brand': 'roibase.com.tr' in domain
        })
    
    return citations
```

Questo parser semplice raggiunge l'85% di accuratezza — i casi limite (link incorporati, fonti con paywall) richiedono QA manuale periodico.

**Attribution engine:** Prendete le citazioni estratte, le scrivete nel warehouse e calcolate le metriche aggregate. Schema della tabella BigQuery o Snowflake:

| Column | Type | Description |
|---|---|---|
| query_text | STRING | Seed prompt |
| model_name | STRING | chatgpt-4o, gemini-pro, claude-sonnet |
| response_id | STRING | Identificatore univoco |
| citation_domain | STRING | Domain citato |
| citation_position | INTEGER | Ordine nella lista delle fonti |
| inference_similarity | FLOAT | Sovrapposizione semantica (0-1) |
| measured_at | TIMESTAMP | Data della misurazione |

View di aggregazione settimanale sulla tabella:

```sql
SELECT 
  model_name,
  COUNT(DISTINCT query_text) AS total_queries,
  SUM(CASE WHEN citation_domain LIKE '%roibase%' THEN 1 ELSE 0 END) AS own_citations,
  AVG(CASE WHEN citation_domain LIKE '%roibase%' THEN citation_position ELSE NULL END) AS avg_position
FROM citation_log
WHERE measured_at >= CURRENT_DATE() - 7
GROUP BY model_name;
```

Output: 14% citation rate su ChatGPT, 8% su Gemini, 19% su Claude — queste differenze sono legate alla data di cut-off dei dati di training del modello e alla strategia di retrieval. Con questo insight potete ottimizzare la vostra strategia [Generative Engine Optimization](https://www.roibase.com.tr/it/geo) per ogni modello.

## Calcolo dell'inference share

Il citation rate misura la vostra visibilità, l'inference share misura **quanto del vostro contenuto viene utilizzato**. Il metodo: somiglianza semantica degli embedding.

**Procedura:**

1. Dividete il vostro contenuto di origine (articolo blog, whitepaper) in chunk di frasi/paragrafi
2. Dividete la risposta LLM allo stesso modo
3. Per ogni chunk della risposta, trovate il chunk di origine con la similarità più alta (cosine similarity)
4. Contate i match sopra la soglia (>0,85 è tipico)
5. Inference share = (numero di chunk della risposta con match) / (numero totale di chunk della risposta)

Implementazione Python (con sentence-transformers):

```python
from sentence_transformers import SentenceTransformer, util

model = SentenceTransformer('all-MiniLM-L6-v2')

source_chunks = ["Una CDP raccoglie dati first-party...", "La finestra di attribuzione dura 7 giorni..."]
response_chunks = ["Una CDP raccoglie i dati degli utenti...", "La finestra di conversione è generalmente di 7 giorni..."]

source_embeddings = model.encode(source_chunks)
response_embeddings = model.encode(response_chunks)

matched = 0
for resp_emb in response_embeddings:
    similarities = util.cos_sim(resp_emb, source_embeddings)
    if similarities.max() > 0.85:
        matched += 1

inference_share = matched / len(response_chunks)
```

Un inference share superiore al 60% significa che l'LLM sta rielaborando gran parte del vostro contenuto. Questo è sia positivo (autorità del brand) che negativo (perdita di traffico diretto) — dovete mostrare questo trade-off nel vostro executive dashboard.

## Analisi della prompt coverage

Come si comporta il vostro citation rate per diversi tipi di intent? Misurate separatamente le query informative ("Cos'è una CDP"), navigazionali ("Integrazione Shopify CDP"), commerciali ("Miglior vendor CDP"), transazionali ("Richiedi demo CDP").

Esempio di gap di coverage: Nel vostro settore e-commerce, siete citati nel 18% delle query informative ma solo nel 3% di quelle commerciali. Questo gap suggerisce che dovreste aggiungere contenuti come "confronto vendor", "breakdown dei prezzi", "checklist di implementazione".

Esempio di tabella di segmentazione:

| Intent Type | Query Count | Citation Rate | Avg Position |
|---|---|---|---|
| Informational | 120 | 18% | 2.1 |
| Commercial | 80 | 3% | 4.5 |
| Navigational | 40 | 25% | 1.8 |
| Transactional | 20 | 0% | N/A |

Un citation rate del 0% nelle query transazionali è normale — gli LLM non possono effettuare vendite dirette, quindi una query "richiedi demo" non genera citazioni di fonti. Ma il basso tasso nelle query commerciali è un insight operativo.

## Dashboard e sistema di alert

Se raccogliete le metriche ma non le trasformate in report, non create valore operativo. Template di report settimanale sulle citazioni:

**Executive Summary (una slide):**
- Trend del citation rate complessivo (ultimi 12 settimane)
- Suddivisione per modello (grafico a barre ChatGPT/Gemini/Claude)
- Top 5 contenuti più citati
- Gap di coverage (in quali intent siete deboli)

**Regole di alert (Slack/email):**
- Se il citation rate scende sotto il 20% → il team editoriale esegue una review
- Se il citation rate di un competitor supera il vostro → attivate un piano di risposta strategica
- Se viene identificato un nuovo cluster di keyword ad alte prestazioni → la produzione di contenuti viene prioritizzata

Questi alert rientrano nell'ambito della [Analisi dati e ingegneria degli insight](https://www.roibase.com.tr/it/verianalizi) — trasformare una metrica grezza in segnale operativo richiede ingegneria dei dati.

## Connessione con la strategia GEO

La misurazione delle citazioni non è solo reporting, è input per l'ottimizzazione. Se l'inference share è basso, rendete i vostri contenuti LLM-friendly: paragrafi chunckizzabili, gerarchia di header chiara, aumentate la densità di statement fattuali. Se la position di citazione è bassa, rafforzate i segnali di autorevolezza: ottimizzate la qualità dei backlink, l'age del dominio, la freschezza dei contenuti.

La differenza tra GEO e SEO classico: in SEO ottimizzavate la keyword density, in GEO ottimizzate la copertura di cluster semantici. Gli LLM non guardano alla corrispondenza n-gram ma alla sovrapposizione di concetti — non si tratta di ripetere la stessa keyword 10 volte, ma di coprire i concetti correlati.

---

Il tracking delle citazioni LLM nel 2026 non è facoltativo, è obbligatorio. Se il vostro brand non è visibile nei motori generativi, è escluso dal processo decisionale della nuova generazione di utenti. Citation rate, inference share, prompt coverage — se queste 3 metriche non sono nella vostra dashboard, la vostra strategia SEO è incompleta. Scegliete ora i 50 keyword per il primo batch, costruite la pipeline e acquisite il primo snapshot settimanale — tra 3 mesi, mentre i vostri competitor continuano a guardare Google Analytics, voi leggerete il grafico di attribuzione con segnali reali.