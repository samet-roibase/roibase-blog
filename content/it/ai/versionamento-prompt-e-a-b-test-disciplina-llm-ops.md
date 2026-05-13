---
title: "Versionamento dei Prompt e A/B Test: La Disciplina delle Operazioni LLM"
description: "Come costruire versioning dei prompt, pipeline di evaluation e controllo qualità deterministico con Promptfoo e LangSmith nei sistemi LLM di produzione."
publishedAt: 2026-05-13
modifiedAt: 2026-05-13
category: ai
i18nKey: ai-004-2026-05
tags: [llm-ops, prompt-engineering, evaluation, mlops, ai-quality]
readingTime: 9
author: Roibase
---

Nei sistemi che utilizzano LLM, tra "funziona" e "affidabile in produzione" ci sono 15 passi. L'automazione del marketing produce output in markdown con Claude API, la segmentazione del customer journey avviene con GPT — ma quando modifichi il prompt, come sei sicuro di non aver creato una regressione? Nell'ingegneria software il versioning, il test coverage, la CI/CD sono standard; nelle operazioni LLM senza questa disciplina ogni deployment è una scommessa.

Strumenti come Promptfoo e LangSmith forniscono questa disciplina: versionamento dei prompt, evaluation deterministici, A/B test, tracking delle metriche. Questo articolo mostra come costruire il controllo qualità nei sistemi LLM di produzione — a livello di infrastruttura, non di codice sorgente.

## L'Illusione che il Prompt non sia Codice Software

La maggior parte dei team vede il prompt come un "file di configurazione" — editor nell'UI, documentazione in Notion, testo hardcodato in un nodo di workflow n8n. In realtà, il prompt è una specifica eseguibile che definisce il comportamento del sistema. Eppure non c'è versionamento, non ci sono diff, non c'è rollback.

Un commit su Git con messaggio "fix typo" può cambiare il tono dell'output del modello e far crollare le metriche. Soprattutto negli scenari di structured output (JSON schema, frontmatter markdown, query SQL), una sola parola fuori posto può rompere il formato e causare errori a cascata. Esempio: scrivere `OUTPUT FORMAT: JSON` al posto di `OUTPUT FORMAT: Valid JSON` fa sì che il modello a volte aggiunga paragrafi di spiegazione — il parser downstream va in crash, gli alert si moltiplicano, tre ore di debug.

La disciplina del versioning deve rispondere a queste domande:

- Quale versione del prompt è in produzione adesso?
- Qual è la differenza di performance tra la versione di due settimane fa e quella attuale?
- Quale variante dell'A/B test ha aumentato la conversione dell'8%?

Se non puoi rispondere a queste domande, non stai facendo "operazioni AI", stai conducendo esperimenti manuali.

## Pipeline di Evaluation: Tre Livelli per Misurare l'Output

La valutazione dell'output dell'LLM sembra soggettiva, ma nei sistemi di produzione è possibile costruire metriche deterministiche. La valutazione funziona su tre livelli: sintassi, semantica, outcome di business.

**Il livello di sintassi** — conformità del formato:
- Il JSON viene parsato correttamente?
- Il frontmatter markdown è valido?
- Sono presenti tutti i field attesi?

Con Promptfoo si controlla tramite asserzioni `javascript`:

```javascript
assert: [
  {
    type: "javascript",
    value: "JSON.parse(output).title.length <= 60"
  },
  {
    type: "is-json",
    value: true
  }
]
```

**Il livello di semantica** — qualità del contenuto:
- La risposta è pertinente al topic? (somiglianza di embedding, cosine distance > 0.85)
- Contiene parole vietate? (regex, token filtering)
- Il tono è corretto? (modello classifier, sentiment score)

Con LangSmith, uno evaluator personalizzato:

```python
from langsmith import evaluate

def check_brand_compliance(run, example):
    forbidden = ["esperto", "leader", "rivoluzionario"]
    output = run.outputs["text"].lower()
    violations = [w for w in forbidden if w in output]
    return {"score": 0 if violations else 1, "violations": violations}

evaluate(
    dataset_name="marketing_blog_posts",
    evaluators=[check_brand_compliance]
)
```

**Il livello di outcome di business** — l'impatto reale:
- È cambiato il CTR?
- È diminuita la conversione?
- È aumentato il bounce rate?

Questo livello si connette alla telemetria di produzione — nel sistema di [Misurazione e Dati First-Party](https://www.roibase.com.tr/it/firstparty), la versione del prompt viene aggiunta ai metadati dell'evento, unita in BigQuery, e un modello dbt calcola il conversion rate per ogni versione.

### Promptfoo: Costruire una Test Suite Deterministica

Promptfoo è un framework di evaluation basato su YAML che gira in locale. L'obiettivo: convalidare ogni modifica del prompt attraverso un test di regressione prima di deployare.

Un config semplice:

```yaml
prompts:
  - file://prompts/marketing_blog_v1.md
  - file://prompts/marketing_blog_v2.md

providers:
  - anthropic:messages:claude-3-5-sonnet-20241022

tests:
  - vars:
      topic: "Server-side GTM"
      category: "tech"
    assert:
      - type: is-json
      - type: javascript
        value: "output.title.length <= 60"
      - type: similar
        value: "architettura di tracciamento server-side"
        threshold: 0.8
      - type: not-contains
        value: "rivoluzionario"
```

Con il comando `promptfoo eval`, tutte le varianti vengono testate e viene restituita una tabella di metriche:

| Prompt | Pass Rate | Avg Latency | Cost |
|--------|-----------|-------------|------|
| v1 | 92% | 2.3s | $0.012 |
| v2 | 98% | 2.1s | $0.014 |

La versione v2 ha un pass rate migliore ma il costo è aumentato del 17% — il token count sta salendo, va investigato nel dettaglio. Se avessimo deployato senza vedere questo tradeoff, il budget mensile sarebbe esploso.

## A/B Test: Confrontare le Varianti dei Prompt in Produzione

La test suite per l'evaluation è verde, ora serve il traffico reale. L'A/B test in un sistema LLM funziona così:

1. **Variant routing** — seleziona la versione del prompt in base all'ID utente/sessione (% split)
2. **Metadata tagging** — aggiungi `prompt_version` ad ogni call API
3. **Metric tracking** — mantieni l'informazione della variante negli event downstream
4. **Statistical significance** — quando hai raccolto un numero sufficiente di sample (minimo 385 osservazioni per variante, 95% confidence), prendi una decisione

Esempio di workflow n8n:

```javascript
// Selezione della variante A/B
const userId = $json.user_id;
const variant = (userId % 100 < 50) ? 'v1' : 'v2';
const promptUrl = `https://raw.githubusercontent.com/roibase/prompts/main/${variant}.md`;

// Aggiungi metadati alla call API
return {
  json: {
    prompt: await fetch(promptUrl).then(r => r.text()),
    metadata: {
      prompt_version: variant,
      experiment_id: 'blog_tone_test_2026_05'
    }
  }
};
```

Analisi in BigQuery:

```sql
SELECT
  metadata.value:prompt_version AS variant,
  COUNT(DISTINCT user_id) AS users,
  AVG(session_duration_sec) AS avg_duration,
  SUM(conversion) / COUNT(*) AS cvr
FROM events
WHERE experiment_id = 'blog_tone_test_2026_05'
  AND event_date >= '2026-05-01'
GROUP BY 1
```

Risultato: la variante v2 ha aumentato il CVR da 0.042 a 0.051 (+21%), p-value 0.003 — puoi passare con fiducia a produzione.

## LangSmith: Observability e Rilevamento di Regressioni Long-Term

Promptfoo fa i test in locale, LangSmith fornisce l'observability in produzione. Ogni call LLM viene tracciata: input, output, latency, token count, versione del modello, versione del prompt.

Il vantaggio di LangSmith è il **tracking delle metriche nel lungo termine**. Se un bug di una versione del prompt da 3 mesi fa viene scoperto oggi tramite feedback, puoi tornare alla trace, vedere la differenza tra input/output, trovare quale versione era in uso quel giorno, e fare rollback.

Esempio di trace:

```json
{
  "run_id": "abc123",
  "prompt_version": "v2.1",
  "model": "claude-3-5-sonnet-20241022",
  "input": {"topic": "Server-side GTM", "category": "tech"},
  "output": "---\ntitle: \"Server-Side GTM...\"",
  "latency_ms": 2341,
  "tokens": {"input": 1842, "output": 1523},
  "cost_usd": 0.0137,
  "feedback": {"score": 4, "comment": "titolo troppo lungo"}
}
```

Loop di feedback: gli editor danno un voto da 1 a 5 per ogni blog, LangSmith collega questi voti alle trace, il report settimanale avvisa "la versione v2.3 ha un average score sceso a 3.2". Rollback immediato → diff del prompt → individua il problema → correggi.

### Dataset Management: Mantenere il Golden Set Sotto Controllo di Versione

Il cuore della pipeline di evaluation è il **golden dataset** — coppie input/output conosciute, la referenza del comportamento atteso. Mantenere questo dataset in Notion, aggiornarlo manualmente in Google Sheets rappresenta un rischio di regressione.

Mantieni il dataset di LangSmith sotto controllo di versione:

```python
from langsmith import Client

client = Client()

dataset = client.create_dataset("marketing_blog_golden_v3")

# Aggiungi gli esempi golden
examples = [
    {
        "inputs": {"topic": "Server-side GTM", "category": "tech"},
        "outputs": {"title": "Server-Side GTM: Misurazione Post-Cookie"},
        "metadata": {"expected_h2_count": 5, "expected_word_count": 1500}
    },
    # 50+ esempi...
]

for ex in examples:
    client.create_example(**ex, dataset_id=dataset.id)
```

Ad ogni modifica del prompt, testa contro questo dataset. Se il pass rate diminuisce, non deployare. Quando trovi un edge case in produzione (bug che non era nel golden set), aggiungilo — così non regredisci.

## Tradeoff: Metriche Deterministiche vs Output Creativo

La forza degli LLM è la non-deterministicità — lo stesso input produce output diversi. Ma in un sistema di produzione, questa caratteristica diventa un rischio: il cliente vede un markdown diverso ad ogni refresh della pagina, alcuni versioni contengono errori.

La temperature 0 aumenta il determinismo ma l'output diventa monotono. Tradeoff:
- **Temperature 0**: ideale per la test suite, in produzione è noioso
- **Temperature 0.3-0.5**: varietà ragionevole, comunque coerente
- **Temperature 0.7+**: creativo ma anche in produzione sorprese, anche se la test suite è verde

La soluzione: usa temperature 0 negli eval, 0.4 in produzione, nel golden set salva 5 output accettabili diversi per ogni input (controllo di range).

Un altro tradeoff: **latency vs qualità**. Un prompt più lungo produce output migliore ma il costo di input token aumenta e la latency cresce. In Promptfoo, se la metrica di latency supera 2.5s, lancia un alert — non rovinare l'esperienza utente.

## Checklist di Produzione: Prima di Deployare il Tuo Sistema LLM

Lista di controllo pre-deployment:

- [ ] Il prompt è in git repo, la storia dei commit è pulita
- [ ] La test suite Promptfoo ha pass rate > 95%
- [ ] Il golden dataset contiene almeno 50 esempi
- [ ] Il piano dell'A/B test è pronto, sample size calcolata
- [ ] LangSmith tracing è attivo, API key in produzione
- [ ] Loop di feedback è configurato (scoring degli editor, join in BigQuery)
- [ ] Procedura di rollback definita (quale metrica in calo triggerizza il rollback automatico)
- [ ] Monitoring dei costi — soglia di spend giornaliero $X
- [ ] SLA di latency — p95 < 3s

Se non completi questa lista, non puoi dire di fornire un "servizio AI". Senza versioning, evaluation, observability, il deployment di un LLM in produzione non è operazione controllata, è caos controllato.

---

Il versionamento dei prompt è una questione di disciplina — non per velocità, ma per affidabilità. In tattiche come [Generative Engine Optimization](https://www.roibase.com.tr/it/geo), la qualità dell'output si collega direttamente all'outcome di business. Senza una pipeline di evaluation, ogni deployment rischia le performance precedenti. Promptfoo fornisce garanzie locali, LangSmith visibilità in produzione. Insieme, portano le operazioni LLM allo standard dell'ingegneria software.