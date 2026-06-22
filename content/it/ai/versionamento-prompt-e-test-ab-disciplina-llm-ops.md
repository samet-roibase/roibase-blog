---
title: "Versionamento dei Prompt e Test A/B: La Disciplina delle Operazioni LLM"
description: "Rendi misurabili i cambiamenti dei prompt con Promptfoo, LangSmith e pipeline di valutazione. Come implementare versionamento e A/B testing nelle operazioni LLM in produzione?"
publishedAt: 2026-06-22
modifiedAt: 2026-06-22
category: ai
i18nKey: ai-004-2026-06
tags: [prompt-engineering, llm-ops, valutazione, test-ab, promptfoo]
readingTime: 8
author: Roibase
---

Eseguire un LLM in produzione non è più questione di poche chiamate API. Quando modifichi un prompt, la qualità dell'output può diminuire del 15% o aumentare del 22% — ma se non lo noti, il deployment diventa casuale. Il versionamento dei prompt e il test A/B trasportano la disciplina della distribuzione del software nelle operazioni LLM. Questo articolo spiega come utilizzare framework di valutazione come Promptfoo e LangSmith per rendere i cambiamenti dei prompt misurabili.

## Una modifica al prompt non è un deployment

Nell'ingegneria del software classico, quando una funzione cambia, entrano in gioco unit test, test d'integrazione e deployment canary. Nelle operazioni LLM, invece, la maggior parte dei team modifica il prompt in un file di testo semplice, esegue alcuni test manuali e lo invia in produzione. Il risultato: il sentiment dell'utente diminuisce del 8%, ma nessuno riesce a correlare la causa.

Il problema è questo: l'output dell'LLM non è deterministico. Otterrai risposte diverse dallo stesso prompt, il che rende il test su un singolo esempio privo di significato. Senza un sistema di versionamento, non puoi rispondere alla domanda "il vecchio prompt era migliore o il nuovo?". Nemmeno un commit Git è sufficiente — perché non puoi estrarre le differenze semantiche dal messaggio di commit.

La soluzione: registra ogni modifica al prompt come una versione, esegui l'eval set prima e dopo la modifica, confronta le metriche. Questa disciplina offre due vantaggi: rilevamento della regressione (il nuovo prompt danneggia i compiti precedenti?) e misurazione del miglioramento (la metrica target sta davvero aumentando?).

## Come implementare una pipeline di valutazione

Una pipeline di valutazione è composta da tre componenti: eval set, metrica di valutazione, runner. L'eval set è l'elenco di input che verranno inviati all'LLM e degli output attesi (o proprietà dell'output). Appare così in formato JSON:

```json
[
  {
    "input": "Riassumi il trend dei ricavi Q1 2025",
    "expected_topics": ["ricavi", "crescita", "trimestre"],
    "expected_sentiment": "neutrale"
  },
  {
    "input": "Spiega perché il tasso di churn è aumentato",
    "expected_topics": ["churn", "retention"],
    "expected_sentiment": "analitico"
  }
]
```

Puoi creare l'eval set manualmente (campionando dai log di produzione) o generarlo sinteticamente (chiedendo a un altro LLM "genera 50 variazioni di query per questo prompt"). L'importante è che il set copra i casi edge — ad esempio input lunghi, query ambigue, multilingue.

La metrica di valutazione definisce come assegnare un punteggio all'output dell'LLM. Ci sono due tipi comuni: basato su regole (controllare la presenza di parole specifiche nell'output) e LLM-as-judge (chiedere a un altro LLM "questo output risponde correttamente alla domanda? Valuta da 1 a 5"). LLM-as-judge è più flessibile ma più costoso e lento. Per un equilibrio tra velocità e accuratezza, una combinazione di rule-based + classificatore leggero (come un modello di sentiment basato su BERT) è preferibile.

Il runner prende l'eval set, esegue sia il prompt vecchio che quello nuovo per ogni input, confronta gli output con la metrica e genera una tabella diff. Promptfoo fa questo da riga di comando con `promptfoo eval`:

```bash
promptfoo eval \
  --prompts prompts/v1.txt prompts/v2.txt \
  --providers openai:gpt-4 \
  --tests evals/summarization.json \
  --output results.json
```

Nell'output vedrai quale prompt ha prestazioni migliori per ogni caso di test. Se il nuovo prompt ha aumentato il punteggio della metrica nell'80% dell'eval set, è pronto per il deployment. In caso contrario, c'è una regressione — rivedi il prompt.

## Test A/B: eseguire due prompt in parallelo in produzione

La pipeline di valutazione produce risultati offline — non ci sono dati utente reali. Per misurare quale prompt funziona meglio in produzione, esegui due prompt simultaneamente e raccogli le metriche. Questo richiede un'infrastruttura di traffic splitting e metric collection.

Il traffic splitting è semplice: prendi l'hash di `user_id` o `session_id`, applica modulo, e in base al risultato indirizza il request al prompt A o B. Ad esempio, se `hash(user_id) % 100 < 50` allora prompt A, altrimenti B. In questo modo fai uno split 50-50. Il punto importante: lo stesso utente dovrebbe vedere lo stesso prompt ad ogni request (sticky assignment) — altrimenti l'esperienza utente sarà incoerente.

Per la raccolta delle metriche, aggiungi metadati insieme alla risposta dell'LLM: `prompt_version`, `latency`, `token_count`. Questi dati fluiscono nel data warehouse (BigQuery, Snowflake). La pipeline di [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/it/verianalizi) di Roibase entra in gioco qui — puoi combinare i log dell'LLM con altri dati di evento (azione dell'utente, conversione, churn) e misurare l'effetto a valle del prompt.

Quali metriche monitorizzi in un test A/B? Tre categorie:

| Tipo di metrica | Esempio | Obiettivo |
|---|---|---|
| Qualità | Punteggio LLM-as-judge, tasso di allucinazione | Alto |
| Costo | Conteggio token, costo API | Basso |
| A valle | Tasso di conversione, engagement dell'utente | Alto |

Ad esempio, se il prompt B aumenta il punteggio LLM-as-judge del 12% rispetto al prompt A ma aumenta il conteggio dei token del 35%, c'è un trade-off. Se non c'è differenza nella conversione a valle, il prompt A è più efficiente.

## LangSmith e osservabilità

LangSmith è una piattaforma di osservabilità LLM sviluppata dal team di LangChain. Oltre alla valutazione, acquisisce le tracce di produzione, visualizza le catene di prompt e mostra dove la latenza aumenta. È particolarmente critico negli workflow LLM multi-step (come RAG + summarization + JSON parsing).

Per inviare tracce a LangSmith, usi l'SDK:

```python
from langsmith import Client
client = Client(api_key="...")

with client.trace(name="summarize_revenue"):
    result = llm.invoke(prompt)
    client.log_metric("token_count", result.usage.total_tokens)
```

Ogni traccia appare nell'interfaccia di LangSmith, con input/output/metadati completamente registrati. Se hai più versioni di prompt, puoi aprire una vista di confronto. Nell'interfaccia vedrai insight come "il prompt v2 produce output mediamente l'8% più lungo di v1, ma la latenza è il 3% inferiore".

LangSmith fornisce anche un playground — modifica il prompt e testa istantaneamente su più input. Questo crea un ciclo di feedback veloce sia per il prototipaggio che per i test di regressione. Ma attenzione: testare nel playground non sostituisce il test A/B in produzione, è solo un primo filtro.

## Il secondo effetto del versionamento dei prompt: il rollback

La capacità di eseguire un rollback in caso di errore nel deployment è critica. Nelle operazioni LLM, un rollback significa tornare a una versione precedente del prompt. Ma per farlo, devi avere le versioni dei prompt registrate.

L'approccio semplice: mantenere ogni prompt in un file Git separato (`prompts/summarization_v3.txt`). Lo script di deployment salva quale versione è in produzione in un file di configurazione:

```yaml
# config/production.yaml
prompts:
  summarization: v3
  classification: v2
```

Per eseguire un rollback, scrivi `summarization: v2` e attiva il deployment. Ma questo è un processo manuale, lento durante un incidente. Un approccio più avanzato: usare un sistema di feature flag (LaunchDarkly, Unleash). Con un flag puoi cambiare la versione del prompt a runtime senza distribuire codice.

Le pratiche di [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/it/firstparty) di Roibase entrano in gioco qui — devi correlare il cambio del prompt con gli eventi a valle (conversione, churn) per basare la decisione di rollback su dati solidi. Se il tasso di churn aumenta del 4% 6 ore dopo il deployment del nuovo prompt, è il segnale per fare il rollback.

## Caso edge: versionamento dei prompt multilingue

Se la tua applicazione LLM funziona in più lingue (ad esempio IT, EN, DE), devi mantenere versioni separate del prompt per ogni lingua. Un prompt che funziona bene in inglese potrebbe non avere lo stesso tono in italiano.

La soluzione: organizza i file dei prompt per codice lingua:

```
prompts/
  summarization/
    en_v3.txt
    it_v3.txt
    de_v3.txt
```

L'eval set dovrebbe essere specifico per lingua — nei casi di test in italiano, attendi output in italiano. Esegui il test A/B separatamente per lingua, perché il comportamento dell'utente italiano potrebbe differire da quello inglese. Non dimenticare di aggiungere il segmento linguistico nell'aggregazione delle metriche.

Un altro punto di attenzione: in un prompt multilingue, la lunghezza del contesto varia per lingua — una frase italiana è mediamente il 12% più lunga (in termini di token). Questo crea il rischio di superare il limite di token. Aggiungi un controllo del conteggio dei token alla tua pipeline di valutazione e avvisa se la soglia viene superata.

## Azione pratica: crea il tuo primo eval set

Per implementare il sistema descritto, il primo passo è un eval set minimalista di 20-30 query reali di utenti. Apri i log di produzione, seleziona le query più frequenti, e per ciascuna definisci le proprietà dell'output atteso (accuratezza, tono, lunghezza).

Poi installa Promptfoo o LangSmith, esegui il tuo prompt attuale su questo set e ottieni un punteggio baseline. Adesso fai una piccola modifica al prompt (ad esempio, aggiungi "fornisci risposte brevi e dirette"), esegui di nuovo la valutazione e confronta i punteggi. Se non c'è regressione superiore al 5%, distribuisci il cambiamento.

Quando questo ciclo diventa automatico, la tua velocità di iterazione dei prompt triplica. Perché ora rispondi alla domanda "questo cambiamento è buono o cattivo?" non con supposizioni, ma con i numeri.