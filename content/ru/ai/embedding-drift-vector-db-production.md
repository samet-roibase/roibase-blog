---
title: "Embedding Drift: Как поддерживать Vector DB в production"
description: "Несовместимость эмбеддингов при смене модели, стоимость переиндексации и стратегии постепенной миграции — устойчивость Vector Database в production"
publishedAt: 2026-05-18
modifiedAt: 2026-05-18
category: ai
i18nKey: ai-006-2026-05
tags: [vector-database, embedding-drift, mlops, retrieval-augmented-generation, model-migration]
readingTime: 9
author: Roibase
---

Когда вы развёртываете RAG-системы в production, первый месяц работает отлично. На третий месяц OpenAI выпускает `text-embedding-3-large`, потом `text-embedding-4`. Вы тестируете новую модель — recall на 4% выше. Но 12 миллионов документов по-прежнему проиндексированы по старой модели. Переиндексация занимает 18 часов, стоит 6400 долларов в API-вызовах. Вот где начинается embedding drift — вы обновляете модель, а vector store остаётся в прошлом. Query embedding и stored embedding находятся в разных многообразиях, accuracy retrieval молча падает. В этом материале разберём, при каком соотношении затрат и качества делать migration, как спроектировать incremental re-indexing и как измерять drift в production.

## Что такое Embedding Drift и почему это важно

Embedding drift — ситуация, когда query embedding генерируется другой моделью, чем document embedding. Если вы индексировали документы моделью A, а запросы обрабатываете моделью B — cosine similarity становится бессмысленна. Две модели работают в разных векторных пространствах, "схожесть" скоры теряют смысл.

Это происходит в трёх сценариях: (1) провайдер эмбеддингов выпускает новую версию (OpenAI ada-002 → text-embedding-3-small снизил размер на 12%, но binary compatibility отсутствует), (2) переход на fine-tuned модель (модель, обучённая на domain-specific данных, работает лучше, но корпус нужно переиндексировать полностью), (3) смена multilingual модели (переход с sentence-transformers/paraphrase-multilingual-mpnet-base-v2 на intfloat/multilingual-e5-large повышает retrieval@10 на 8%, но mapping не 1:1).

В production drift трудно заметить, потому что метрики падают постепенно. На первой неделе юзеры жалуются "результаты стали хуже", на второй неделе количество тикетов поддержки растёт на 15%, на третьей неделе падает retention. Ранний сигнал drift'а — средняя cosine similarity новых запросов ниже, чем baseline во время индексации. Если во время индексации было mean cosine similarity 0.78, а теперь во время запросов 0.71 — это признак несовместимости модели.

### Trade-off: Re-index vs Dual Model

Думайте о стоимости переиндексации в трёх компонентах: (1) стоимость API (OpenAI `text-embedding-3-large` стоит 0.13 доллара за 1M токенов, Cohere embed-v3 — 0.10), (2) compute time (12M документов × 512 токенов в среднем = 6.1B токенов ≈ 18 часов параллельной обработки), (3) риск downtime (если не сделать atomic switchover, запросы упадут на полуготовый индекс).

Альтернатива — dual model стратегия: создать отдельный индекс для новой модели и делать A/B тестирование при переходе. Storage cost удвоится, но риск исчезнет. Когда новый индекс готов, постепенно переводите трафик: 10% → 50% → 100%. Если заметите regression — можно откатиться мгновенно. Но двойной индекс означает двойные затраты на хранилище (Pinecone p1.x1 pod стоит 0.096 доллара/час, 12M vectors 1536-dim = ~18GB ≈ 2 pod'а = 140 долларов/месяц, dual index = 280 долларов/месяц).

## Incremental Re-indexing: Hot/Cold Partitioning

Вместо переиндексации всего корпуса за ночь — разделите документы по частоте использования: hot/cold partition. "Hot" — документы, на которые делали запросы за последние 30 дней, "cold" — остальное. Hot partition обычно составляет 15-25% корпуса, но отвечает за 80% попаданий запросов.

Стратегия: сначала переиндексируйте hot partition'ом новой моделью (18 часов → 3 часа, 6400 → 1200 долларов). При запросе используйте shard routing — сначала ищите в hot индексе, если не нашли — fallback на cold. Так 80% accuracy improvement получаете в день, 100% — за 2-3 недели rolling re-index'а.

Для отслеживания partition'ов достаточно таблицы в PostgreSQL:

```sql
CREATE TABLE doc_partition (
  doc_id UUID PRIMARY KEY,
  partition TEXT CHECK (partition IN ('hot', 'cold')),
  last_queried_at TIMESTAMPTZ,
  embedding_model TEXT,
  embedding_version TEXT,
  re_indexed_at TIMESTAMPTZ
);

CREATE INDEX idx_partition_model 
  ON doc_partition(partition, embedding_model);
```

Логика query routing'а:

```python
def retrieve(query: str, model: str, k: int = 10):
    query_emb = embed(query, model)
    
    # ищем в hot partition
    hot_results = vector_db.search(
        collection="hot",
        vector=query_emb,
        limit=k,
        filter={"embedding_model": model}
    )
    
    if len(hot_results) >= k:
        return hot_results
    
    # если не достаточно — дополняем из cold
    cold_results = vector_db.search(
        collection="cold",
        vector=query_emb,
        limit=k - len(hot_results),
        filter={"embedding_model": model}
    )
    
    return merge_results(hot_results, cold_results)
```

Этот подход похож на "event-driven incremental sync" из [first-party data архитектуры Roibase](https://www.roibase.com.tr/ru/firstparty) — вместо копирования всех данных за раз синхронизируем меняющийся subset постоянно.

### Drift Detection: Мониторинг Embedding Space

Измеряйте drift в production тремя метриками:

| Метрика | Порог | Значение |
|---------|-------|----------|
| Mean similarity shift | baseline − 0.05 | Query embedding отдалилась от индекса |
| Top-k stability | <%90 overlap | Один запрос возвращает разные результаты (эффект смены модели) |
| OOV (out-of-vocabulary) rate | >%2 | Новая модель не распознаёт термины из старого корпуса |

Mean similarity shift рассчитывайте ежедневным batch job'ом — возьмите запросы за последние 24 часа, закодируйте их обе модели, вычислите cosine similarity с stored embedding'ами. Если новая модель даёт similarity 0.73, старая 0.78 — есть drift на 0.05, нужна переиндексация.

Top-k stability — каждый день прогоняйте тот же набор тестовых запросов (100-200 штук) обеими моделями, сравнивайте топ-10 результатов. Если overlap упадёт ниже 85% — нужна миграция модели.

## Стратегия Migration: Blue-Green Deployment

При смене модели делайте atomic switchover — blue-green deployment. Старый индекс — "blue", новый — "green". Трафик идёт на blue, вы заполняете green в фоне. Когда green готов, переводите трафик за 5 минут. Проблема — откат на blue мгновенный.

Пошагово:

1. **T-0:** Начинаете генерировать embedding'и новой моделью, параллельно создаёте индекс (`green_index`).
2. **T+18h:** Green индекс готов на 100%, blue всё ещё live.
3. **T+18h 5m:** В query router'е устанавливаете флаг `MODEL_VERSION=green`, переводите 10% трафика на green.
4. **T+18h 30m:** Ошибок нет, переводите 50%.
5. **T+19h:** 100% на green, blue переходит в read-only (резервная копия на 7 дней).
6. **T+7 дней:** Blue индекс удаляется.

Roibase работал с e-commerce клиентом (косметика, 2.4M товаров, 80K запросов/день), где migration модели привела к loss 0.2% сессий (благодаря blue-green, откат произошёл за 12 секунд).

### Cost Optimization: Batch + Cache

Снизьте стоимость переиндексации двумя техниками:

**Batch API:** OpenAI batch API на 50% дешевле обычного (0.13 → 0.065 доллара/1M токенов). Асинхронный — response через 1-24 часа. Для переиндексации подходит идеально. 12M документов в batch'е = 6400 → 3200 долларов.

**Semantic cache:** Если один документ индексируется несколько раз (same description, разные SKU), кэшируйте embedding. Deduplicate через MD5 hash. На практике это даёт 12-18% экономию (особенно в fashion/beauty — описания товаров часто совпадают).

```python
import hashlib
from functools import lru_cache

@lru_cache(maxsize=100_000)
def cached_embed(text: str, model: str) -> list[float]:
    cache_key = hashlib.md5(f"{model}:{text}".encode()).hexdigest()
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    emb = openai.Embedding.create(input=text, model=model)
    redis.setex(cache_key, 86400 * 7, json.dumps(emb))
    return emb
```

## Fine-Tuned Model: Domain Adaptation Trade-off

Переход с generic модели на domain-specific fine-tuned повышает retrieval@10 на 8-15% (example: в legal domain'е `paraphrase-mpnet-base-v2` заменить на `legal-bert-base-uncased` + contrastive learning). Но есть затраты: (1) сбор labeled data (1000-5000 query-document пар), (2) GPU time (A100 8 часов ≈ 60 долларов), (3) полная переиндексация корпуса.

ROI анализ: если retrieval accuracy вырастет на 10% и это приведёт к +2% конверсии (например, в lead gen правильная статья повышает заполнение формы), то 100K запросов/месяц × 0.02 × 50 дол. AOV = 100K дол. lift. Стоимость fine-tuning + переиндексации 10K долларов окупится за месяц.

Но fine-tuned модель требует maintenance — переобучение каждые 6 месяцев (domain shift). Это ведёт к циклам переиндексации. Альтернатива — adapter layer: поверх base модели добавьте маленький fine-tuned слой. Base embedding'и остаются неизменны, меняется только query-time projection. Re-indexing не нужен, но accuracy gain падает с 15% на 8%.

## Контрпример: Когда Переиндексация Не Нужна

Иногда переиндексация — не самое правильное решение. Если (1) смена модели minor (recall разница <%2), (2) корпус статичный (новых документов не добавляется), (3) query pattern не меняется — drift минимален.

В B2B SaaS (internal knowledge base, документация) корпус обновляется 1-2 раза в год. Здесь major upgrade (BERT → MPNet) — исключение, переиндексация неоправдана. Используйте ensemble — retrieval обеими моделями, результаты мержьте через reciprocal rank fusion. +3-5% latency, но дешевле переиндексации.

Decision tree:

- Корпус >5M документов + новая модель даёт +5% accuracy → incremental re-index с hot/cold
- Корпус <1M + +10% accuracy → blue-green full re-index
- Корпус <1M + <%5 accuracy → ensemble + отложить переиндексацию
- Fine-tuned модель + conversion impact >10× затрат → переиндексировать
- Fine-tuned модель + conversion impact <3× затрат → adapter layer или отказаться

В [GEO работах Roibase](https://www.roibase.com.tr/ru/geo) аналогичный вопрос — какой контент переделывать при оптимизации LLM citation, какой достаточен в текущем виде? Тоже требует cost-impact анализа.

## Профилактика Drift: Version Pinning и Contract Testing

Лучший способ избежать drift в production — pin'ить версию модели и писать contract test'ы. Если используете OpenAI `text-embedding-3-large`, зафиксируйте model ID в config, отключите auto-upgrade. При выходе новой версии тестируйте вручную.

Пример contract test'а:

```python
def test_embedding_compatibility():
    test_docs = [
        "machine learning model training",
        "vector database indexing",
        "semantic search optimization"
    ]
    
    # baseline embedding (production модель)
    baseline = [embed(doc, model="text-embedding-3-large") for doc in test_docs]
    
    # сравняем с новой моделью
    candidate = [embed(doc, model="text-embedding-4") for doc in test_docs]
    
    # проверим cosine similarity
    for i, doc in enumerate(test_docs):