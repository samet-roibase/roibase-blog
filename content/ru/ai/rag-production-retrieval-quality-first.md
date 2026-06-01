---
title: "RAG в Production: Качество Retrieval важнее Cost"
description: "Неправильный выбор embedding, chunking и evaluation приводит к галлюцинациям. Уроки из production-опыта: метрики, мониторинг и правильный баланс качества с затратами."
publishedAt: 2026-06-01
modifiedAt: 2026-06-01
category: ai
i18nKey: ai-003-2026-06
tags: [rag, embedding, retrieval, llm-eval, production-ai]
readingTime: 9
author: Roibase
---

RAG-системы в production переживают два сценария: либо закрываются через 3 недели из-за галлюцинаций, либо становятся критичным pipeline с F1 выше 90%. Разница в выборе embedding-модели, стратегии chunking и setup'е evaluation. Оптимизация cost — второстепенная задача. Если не решить проблему доставки правильного документа, дешёвая модель будет производить дорогостоящие ошибки.

## Embedding-модель: не размер, а domain alignment

Первый рефлекс — "большая модель всегда лучше". text-embedding-3-large (3072 dim) выигрывает у text-embedding-3-small (1536 dim) далеко не всегда. MTEB benchmark измеряет на общем corpus'е — если ваш домен финансовый, медицинский или e-commerce, эти баллы вводят в заблуждение.

В production мы увидели: 768-мерная модель, fine-tuned на domain-специфичных данных (например, sentence-transformers/all-mpnet-base-v2 с дообучением), дала recall@10 на 12% выше, чем generic 3072-мерная модель. Причина простая: embedding space не знает domain-терминологию. Семантическое расстояние между "Conversion rate optimization" и "CRO" в generic модели 0.68, в domain-tuned — 0.91.

Трейдофф размера очевиден: 3072 dim — индекс 4.2GB, 768 dim — 1.1GB. Latency query: 47ms vs 18ms соответственно (FAISS HNSW, m=16). Если потеря recall составляет <5%, меньшая модель выигрывает и по cost, и по скорости. Решать это нужно измерением, не догадками.

### Fine-tuning decision

Embedding fine-tuning обязателен в двух случаях: (1) очень специфичная domain vocabulary (медицинские термины, крипто-адреса), (2) асимметричное распределение пар query-document (короткие вопросы, длинные документы). OpenAI Embedding API fine-tuning не поддерживает — нужны sentence-transformers или Cohere embed-v3. Начните с 500-1000 labeled пар; больше дают marginal gains.

## Chunking: не размер, а семантическая целостность

"Chunk size 512 tokens — это хорошо" — это миф. Мы тестировали три подхода: (1) fixed 512 tokens, (2) по markdown headers (разрезать на H2/H3 границах), (3) semantic chunking (LLM читает контекст параграфа, режет на семантических переходах). Результат: markdown-based дал 18% лучше NDCG@5, но index building 2.3x медленнее.

Проблема fixed chunking — режет посредине предложения. "Если интегрировать server-side tracking с first-party архитектурой..." режется на токене 510, второй chunk начинается с "...архитектурой attribution точность растёт" — контекст потерян. Retriever найдёт chunk по запросу "attribution", но LLM не сможет сформировать ответ без контекста. Отсюда галлюцинация.

Semantic chunking (не RecursiveCharacterTextSplitter из LangChain, а реальный "переходит ли параграф на новую идею?" с gpt-4o-mini) лучше, но дорого: chunking 10K страниц знаний стоит $47 (0.15$/1M input tokens). Трейдофф: index building — one-time cost, качество retrieval — постоянная ценность. Мы выбрали semantic, но если ваша база динамичная (обновляется еженедельно), можете вернуться на fixed с учётом затрат.

| Стратегия | Avg Chunk Size | NDCG@5 | Build Time (10K doc) | Cost |
|---|---|---|---|---|
| Fixed 512 | 489 tokens | 0.71 | 4 min | $0 |
| Markdown-based | 680 tokens | 0.84 | 9 min | $0 |
| Semantic (LLM) | 520 tokens | 0.81 | 22 min | $47 |

## Overlap Strategy

Overlap между chunks повышает recall retrieval'а — но индекс раздувается на 1.4-1.8x. С 50-token overlap мы получили 6% прироста recall (recall@10: 0.78 → 0.83). Можно включать overlap условно: только для длинных документов (>2000 tokens), для коротких отключать.

## Eval Setup: offline metrics → online A/B

До production нужна evaluation pipeline. "LLM выглядит хорошо" недостаточно — retrieval precision/recall и factuality LLM'а измеряются отдельно.

Два уровня метрик:

1. **Retrieval layer:** Precision@k, Recall@k, NDCG@k, MRR. Ground truth: вручную размеченные query-document пары (у нас 320 штук). Ragas library's `context_precision` работает без LLM'а, удобна для быстрых итераций.

2. **Generation layer:** Factual consistency (entailment между выводом и документом), hallucination rate (процент информации, выходящей за пределы документов), citation accuracy (насколько LLM правильно указывает источники). Используем LLM-as-judge pattern — просим gpt-4o "этот ответ опирается на документы?" Agreement с human eval: 0.89.

Offline eval запускается раз в сутки (CI/CD integrated). Новая chunking стратегия, новая embedding, новый reranker — всё это должно пройти эту сетку до commit. Online A/B — другое: 10% трафика на новую версию RAG, смотрим user feedback + session metrics (task completion, query reformulation rate). Если offline NDCG вырос на 0.02, но online task completion не изменился, deploy пропускаем.

### Надёжность LLM-as-Judge

Не доверяйте LLM-as-judge слепо. GPT-4o в 6% случаев неправильно отметил свои же галлюцинации (false positive), в 4% пропустил реальные (false negative). Решение: для critical use cases — human-in-the-loop. Случайные 5% samples проверяет человек, по этому subset вычисляем calibration score LLM'а. Если <0.85, переписываем judge prompt.

## Reranker: мощь второго прохода

Первый retrieval достаёт 20-50 chunks (recall-focused), reranker сужает до 3-5 (precision-focused). С Cohere rerank-v3 получили 14% прироста precision (P@5: 0.68 → 0.78). Cost: $2 за 1M reranked tokens (в 10 раз дороже embedding), но передаём в LLM context window не 50, а 5 chunks — снижается и cost LLM'а, и риск галлюцинации.

Трейдофф reranker'а — latency: search 18ms, с rerank становится 95ms. Async pipeline это компенсирует — query идёт, background запускает retrieval+rerank, когда LLM начинает stream, всё готово, total 400-500ms. Синхронно делать опасно — UX упадёт.

RAG без reranker'а рассчитывает "top-k embedding результаты верны". Работает при высоком лексическом overlap query-document. На semantic queries ("как интегрировать first-party архитектуру с server-side измерениями?") embedding в top-10 кладёт 4 irrelevant chunk'а. Reranker использует cross-attention query-document, эту noise чистит. Без него в production citation accuracy падает на 18%.

## Hybrid Search: BM25 + Embedding

Embedding-only слаб в двух случаях: (1) точные совпадения (бренд, SKU), (2) редкие термины (мало видел в embedding space). BM25 (keyword-based) закрывает этот gap. На Weaviate или Qdrant: 0.7 embedding weight + 0.3 BM25. Recall@10: embedding-only 0.76, hybrid 0.83.

BM25 индекс 5-8x компактнее embedding (inverted index). Latency не добавляет (параллель). Cost hybrid'а — query planning: какие веса на какие query types. A/B testing даёт ответ. У нас обычные queries 0.8 embedding, с brand/product mentions 0.5 embedding.

## Production Monitoring

60% RAG deployment'а — это monitoring. Система должна деградировать видимо, не молча. Метрики:

- **Retrieval coverage:** % queries, для которых найдены документы (target >95%)
- **Avg context relevance:** % chunk'ов для LLM, реально relevant (target >0.8)
- **Hallucination rate:** % ответов с информацией вне документов (target <5%)
- **Latency p95:** 95-й перцентиль time-to-response (target <800ms)
- **Cost per query:** embedding + rerank + LLM (target <$0.02)

Push в Datadog, alert в Slack при превышении. Retrieval coverage 2 дня подряд <92% — gap в knowledge base, content team в action. Hallucination растёт — LLM prompt или chunk size на ревью. Latency spike — проверяем sharding'е vector database.

Связать RAG метрики с business outcome критично — когда retrieval качество растёт, user satisfaction survey тоже растёт? Или только техметрика шумит? Корреляционный анализ даёт ответ. По нашему [методологию аналитики](https://www.roibase.com.tr/ru/verianalizi) метрик.

## Cost vs Quality Balance

Monthly cost production RAG: 1M queries, ~3 chunks per query, gpt-4o-mini generation = ~$420 (embedding $80, rerank $40, LLM $300). Без reranker'а $380, но hallucination rate прыгает 5% → 11% — support tickets взлетают, indirect cost $600+.

Правильная оптимизация: (1) cache layer (повторный query за 24h — из cache, 23% queries повторяются), (2) smaller domain-tuned embedding (768 dim), (3) async rerank (некритичные queries пропускаем rerank). Итог: $280, quality loss <2%.

Неправильно: keyword search вместо embedding, templates вместо LLM. Результат — "AI" система с recall 40%. Cost optimization не должна убивать retrieval quality.

---

Production RAG — это не просто выбор модели. Это eval pipeline, monitoring discipline, постоянная итерация. Embedding можете сделать меньше и быстрее, но если recall упадёт, LLM начнёт галлюцинировать, пользователь потеряет доверие. Сначала retrieval quality на 0.85+ F1, потом оптимизируйте cost. Иначе у вас получится дешёвая машина галлюцинаций.