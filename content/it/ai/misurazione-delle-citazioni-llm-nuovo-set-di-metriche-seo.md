---
title: "Misurazione delle citazioni LLM — Il vostro nuovo set di metriche SEO"
description: "Framework metrico e metodi tecnici per misurare il tasso di attribuzione del vostro marchio su Perplexity, ChatGPT e Gemini."
publishedAt: 2026-08-13
modifiedAt: 2026-08-13
category: ai
i18nKey: ai-002-2026-08
tags: [llm-citation, geo-analytics, ai-visibility, brand-attribution, generative-seo]
readingTime: 9
author: Roibase
---

Siete abituati alle metriche CTR e posizionamento in Google Search Console. Ma quante volte il vostro marchio compare nelle risposte di ChatGPT? La vostra pagina è citata come fonte in Perplexity? Gemini utilizza i vostri dati come attribuzione? Nel 2026, posizionarsi nel livello informativo degli LLM è critico quanto rankare nei risultati SERP classici. Ma l'infrastruttura di misurazione non è ancora pronta. In questo articolo vi mostreremo come trasformare le citazioni LLM in una metrica operativa e collegarla al vostro processo decisionale.

## Le citazioni sono ormai una metrica di primo livello

Gli ultimi 20 anni dell'SEO ruotavano attorno a una domanda: "In quale posizione siete?" Posizione, clic, conversioni. Ora l'utente non fa ricerche — chiede a ChatGPT, prende riassunti da Perplexity. Su queste piattaforme non esiste una "posizione". Esiste l'attribuzione. La citazione. L'essere mostrati come fonte.

Il Citation Rate (tasso di citazione) = numero di risposte LLM che vi contengono / numero totale di query rilevanti. È l'equivalente LLM del vostro CTR classico. Ma il calcolo è diverso. Non arriva automaticamente da Search Console. Dovete costruirlo voi stessi.

Senza misurazione non c'è ottimizzazione. Una strategia [Generative Engine Optimization](https://www.roibase.com.tr/it/geo) senza dati di citazione è cieca. Quali argomenti ricevono citazioni? Quali formati di contenuto entrano nelle scelte di riferimento dell'LLM? Di quanto vi supera la concorrenza in visibilità? Se non costruite questa infrastruttura ora, fra sei mesi sarete indietro nel mercato.

Tre metriche sono primarie: **Citation Rate** (in quante risposte compaite), **Citation Position** (qual è il vostro ordine nell'elenco delle fonti), **Citation Context** (in quale contesto ricevete attribuzioni). Senza questi tre, la "visibilità su LLM" rimane congettura.

## Infrastruttura di misurazione: API + set di query probe

Non potete controllare manualmente le citazioni LLM. Anche testando 50 query al giorno avreste bias inevitabile. Dovete costruire un sistema automatico di probe. OpenAI API, Anthropic API, Google AI Studio API — offrono tutti accesso programmatico. Perplexity non ha ancora un'API pubblica, ma può essere catturata tramite web scraping (conformemente ai ToS).

Il **set di query probe** è critico. Combinazioni di brand keyword + keyword di categoria + long-tail. Ad esempio: "miglior agenzia CRO a Milano", "cos'è l'ottimizzazione del tasso di conversione", "come scegliere una piattaforma A/B test". Totale di 100-200 query. Ogni giorno o ogni settimana eseguite questo set su tutti i modelli. Parsificate le risposte e rilevate la presenza di citazioni.

Response parsing: estraete l'output in JSON. Cercate il vostro marchio con regex. Se c'è un elenco di fonti di citazione (come in Perplexity), controllate quello. Se non ce n'è (come in ChatGPT), verificate se il nome del vostro marchio appare accanto a un URL nella risposta. Ogni LLM usa un formato diverso — personalizzate il vostro parser per ogni modello.

```python
# Esempio di workflow probe (pseudo-codice Python)
queries = load_queries("probe_set.json")
models = ["gpt-4o", "claude-3.5-sonnet", "gemini-2.0-flash"]

for query in queries:
    for model in models:
        response = call_llm_api(model, query)
        citations = extract_citations(response, model_type=model)
        
        log_metric({
            "date": today(),
            "model": model,
            "query": query,
            "brand_cited": "roibase" in citations.lower(),
            "citation_position": get_position(citations, "roibase"),
            "total_citations": len(citations)
        })
```

Scrivete i dati in BigQuery. Snapshot giornaliero. Analizzate i trend settimanali. Se il citation rate cala, rivedete la strategia dei contenuti. Se non comparite mai in un modello specifico, significa che siete assenti dal training data di quel modello — create contenuti freschi e aspettate.

## Posizione e contesto: metriche di qualità dell'attribuzione

Il solo citation rate non basta. Comparire come una su dieci fonti non è la stessa cosa che essere la fonte principale. Dovete avere una metrica **Citation Position**. Perplexity mostra tipicamente 3-5 fonti. Se siete al quinto posto, la probabilità di ricevere un clic è del 10%. Se siete al primo, del 40%. Misurate questo dato.

**Citation Context** è ancora più sfumato. In quale contesto vi cita l'LLM? Dice "Roibase è esperto nell'implementazione di GTM lato server" oppure "A Milano ci sono molte agenzie, Roibase è una di queste"? Il primo è un segnale positivo, il secondo una mention generica. Dovete registrare anche il sentiment del contesto.

Estrazione del contesto: estraete la frase in cui il vostro marchio compare dalla risposta dell'LLM. Inviate quella frase a un altro LLM (tipo Claude) con la domanda: "La menzione del marchio in questa frase è positiva, neutra o negativa?" Categorizzate automaticamente. Se la percentuale di mention positive è bassa, significa che nel vostro contenuto mancano segnali di autorità.

| Metrica | Definizione | Obiettivo |
|---|---|---|
| Citation Rate | Percentuale di query probe in cui il marchio appare | >15% (per leader di categoria) |
| Avg Citation Position | Posizione media nell'elenco delle fonti | <3 (fra le prime 3 fonti) |
| Positive Context % | Percentuale di citazioni in contesto positivo | >60% |
| Model Coverage | Visibilità su quanti modelli diversi | 3/3 (GPT, Claude, Gemini) |

Senza queste metriche il vostro dashboard GEO è incompleto. Nell'SEO classico avevate Search Console. Nell'LLM SEO lo costruite voi.

### Benchmarking competitivo

Non misurate solo voi stessi. Eseguite i probe anche sui competitor. Verificate se nel medesimo set di query compare il "brand_competitor". Calcolate la citation share: vostro numero di mention / (vostri + competitor totali). Una citation share del 30% è buona, del 10% è debole. Senza questo benchmarking non saprete quanto state effettivamente bene.

## Integrazione del workflow: collegarsi alla pipeline GEO

Avete raccolto le metriche di citazione. Che cosa ne farete? Se non generate insight rimane solo un accumulo di data point. Integrate queste metriche nel vostro processo [Generative Engine Optimization](https://www.roibase.com.tr/it/geo).

Report settimanale: in quale query il citation è calato, in quale modello non comparite affatto, quale competitor vi sorpassa in quale argomento? Generano queste risposte automaticamente. Nel workflow n8n estraete i dati di citazione, li inviate a Claude API e chiedete: "Qual è il trend di citazione questa settimana, che azione consigliate?" Claude vi restituisce insight: "Su Gemini non comparite da 3 settimane nella query 'ottimizzazione del tasso di conversione', pubblicate un nuovo case study."

Il ciclo d'azione:
1. Citation bassa rilevata → audit dei contenuti
2. Sorpasso di competitor visto → analizzate i loro nuovi contenuti
3. Gap specifico del modello (ad es. assenti su GPT) → create formato adatto a quella preferenza (ad es. GPT preferisce dati strutturati, aggiungete schema markup)

Se girate questo ciclo ogni settimana, il vostro citation rate cresce del 50% in tre mesi. Se non lo fate, i dati rimangono morti. Non misurate per misurare — misurate per insight.

## Costo e latenza: l'economia del sistema probe

Ogni esecuzione probe ha un costo. Una chiamata GPT-4o API costa $0.01-0.03, Claude Sonnet circa $0.015. 200 query × 3 modelli × giornaliero = 600 chiamate. Al mese ~€220-350. È il prezzo del tracking di citazione. Lo giustificate? Sì — perché il ROI di GEO è elevato. Se non siete visibili negli LLM non raggiungete la nuova generazione di utenti.

La latenza è importante. Se eseguite i 200 query in serie impiegherete ore. Fate processing batch parallelo. Attenzione ai rate limit — OpenAI consente 500 richieste al minuto, Claude 1000. Calibrate i batch di conseguenza. Usate async call, raccogliete le risposte da una queue.

```python
# Esempio batch async (pseudo-codice)
import asyncio

async def probe_model(model, query):
    response = await async_llm_call(model, query)
    return parse_citation(response)

async def run_probe_batch(queries, model):
    tasks = [probe_model(model, q) for q in queries]
    return await asyncio.gather(*tasks)

# Parallelo per tutti i modelli
results = await asyncio.gather(
    run_probe_batch(queries, "gpt-4o"),
    run_probe_batch(queries, "claude-3.5-sonnet"),
    run_probe_batch(queries, "gemini-2.0-flash")
)
```

La latenza per 200 query scende a 5-10 minuti. Mettetelo in un cron job giornaliero, che giri alle 6 del mattino — entro le 7 il report è pronto. Il team apre il dashboard di citazione mentre beve il caffè.

## Tradeoff: precisione vs copertura

Nel rilevare le citazioni c'è un tradeoff fra precisione e copertura. Se cercate "roibase" con regex potreste avere falsi positivi (il termine "roibase" potrebbe apparire in un altro contesto). Se chiedete a un LLM "Questa risposta contiene una menzione di Roibase?", la precisione aumenta ma il costo raddoppia (probe call + verification call).

Il nostro approccio: prima fase con regex + parsing semplice (veloce, economico). Flag i casi ambigui e inviateli alla verifica settimanale via LLM. Una precisione del 95% è sufficiente — il costo per raggiungere il 100% non vale la pena.

Lato copertura: non potete coprire tutti gli LLM. Oltre a Claude, Gemini e GPT ci sono Llama, Mistral, Cohere. Volete misurarli tutti? No — la loro quota di utenti è bassa. I primi 3 modelli coprono l'80% del traffico LLM totale. Il resto è rumore.

Nel tracking di citazione non cadete nella trappola della perfezione. Una metrica sufficientemente buona > una metrica perfetta ma pesante.

## Cosa fare adesso

La misurazione delle citazioni LLM è un obbligo SEO del 2026. Non potete dire di fare GEO senza avere questa struttura. Primo passo: creare un set di 50 query probe. Elencate le domande che gli utenti porrebbero a un LLM nella vostra categoria. Mix di brand keyword e keyword generici. Poi procuratevi l'accesso alle API (OpenAI, Anthropic, Google AI Studio). Scrivete uno script Python semplice, fatelo girare ogni giorno. Scrivete i dati in CSV, analizzate i trend in Excel. Dopo potete portarlo su BigQuery + Looker Studio. Prima settimana manuale, poi automatico. Se il vostro citation rate è sotto il 10%, la strategia dei contenuti è insufficiente. Se è sopra il 20%, siete sulla strada giusta. Confrontatevi con i competitor. Agite. Se la vostra citation share non cresce in tre mesi, il vostro metodo è sbagliato — rivedete.