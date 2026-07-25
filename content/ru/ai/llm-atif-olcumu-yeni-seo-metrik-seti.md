---
title: "Измерение LLM Citation — ваш новый набор метрик SEO"
description: "Как измерить долю упоминаний вашего бренда в Perplexity, ChatGPT и Gemini? Руководство по настройке критических метрик для GEO."
publishedAt: 2026-07-25
modifiedAt: 2026-07-25
category: ai
i18nKey: ai-002-2026-07
tags: [llm-citation, geo, seo-metrics, ai-search, attribution]
readingTime: 8
author: Roibase
---

Органический трафик падает, прямые переходы в Google Analytics растут, но вы не знаете, какие запросы теперь отвечает ChatGPT вместо того, чтобы вести пользователей на ваш сайт. В середине 2026 года LLM'ы захватили 23% поискового трафика (SimilarWeb Q2 2026). Вместо того чтобы пытаться вернуть этот трафик, вам нужно начать измерять **долю упоминаний вашего сайта как источника** в LLM'ах. Добавьте новый слой в метрики SEO: citation rate, source prominence, retrieval frequency.

## Что такое LLM Citation и почему нужно измерять сейчас

LLM citation — это доля случаев, когда генеративная модель упоминает ваш бренд или контент **как источник** при ответе на вопрос пользователя. Если ChatGPT пишет "Источник: roibase.com.tr", Perplexity добавляет встроенную ссылку или Gemini указывает сайт в сноске — вы получили citation.

В классическом SEO была "рейтинг" — быть на 3-м месте в Google. В эпоху LLM это "citation prominence" — если модель показывает 4 источника, какова ваша доля? Вы первый источник или находитесь в списке "похожих источников" в конце? Эта разница влияет на CTR на 300% (Perplexity Labs internal data, Q1 2026).

Если не начнете измерять сейчас, через 6 месяцев не сможете ответить: "Принесли ли результаты наши GEO усилия?" Первый шаг — создать **синтетический набор запросов** и регулярно опрашивать LLM'ы.

## Построение архитектуры измерения: Синтетический конвейер запросов

Ручные тесты для измерения LLM citation недостаточны. Вам нужно ежедневно отправлять одни и те же 50–100 запросов в Perplexity, ChatGPT и Gemini и парсить ссылки на источники в ответах. Используйте трёхуровневый конвейер:

**Уровень 1: Дизайн набора запросов**  
Извлеките из Search Console последние 90 дней запросы с высоким числом показов, позицией 1–20 и CTR ниже 5%. Эти запросы означают "мы видны в Google, но не получаем клики" — LLM'ы уже отвечают на них. Выберите 50–100 запросов. Не только брендовые — смешайте информационные и транзакционные. Примеры: "длительность cookie в server-side GTM", "оптимизация стоимости BigQuery".

**Уровень 2: Автоматизированный запрос**  
Создайте рабочий процесс n8n, который раз в день обращается к API каждого LLM. Для Perplexity используйте параметр `model: sonar-pro`, для ChatGPT — режим `browsing: true`, для Gemini — `grounding: web`. Сохраняйте ответ в JSON — и основной текст, и массив `sources`. Важно: управляйте rate limits (Perplexity free tier — 5 req/min, ChatGPT Plus — 40 req/3 часа).

**Уровень 3: Парсер Citation**  
В ответе JSON найдите ключ `sources` — обойдите массив и проверьте совпадение домена (`roibase.com.tr` или поддомен). Если `sources` нет, ищите в тексте встроенную ссылку (`[ссылка](...)`) или простой URL (regex). Для каждого запроса сохраняйте 3 метрики:
1. **Citation exists:** boolean (0/1)
2. **Ranking:** позиция в массиве `sources` (1–5, иначе null)
3. **Prominence:** встроенная в текст или только в сносках (встроенная = 2, сноска = 1, отсутствует = 0)

Запишите данные в BigQuery в таблицу `llm_citations` — схема: `query_id, llm_provider, date, cited, rank, prominence`.

## Расчёт Citation Rate и Benchmark

Если запускаете 50 запросов раз в день в течение 30 дней в 3 LLM'ах, получаете 50 × 3 × 30 = 4.500 строк данных. Теперь рассчитайте метрики:

### 1. Общий Citation Rate

```sql
SELECT 
  llm_provider,
  COUNTIF(cited = 1) / COUNT(*) AS citation_rate
FROM `project.dataset.llm_citations`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY llm_provider;
```

**Benchmark (B2B SaaS Q2 2026):**  
- Perplexity: 18–24%  
- ChatGPT browsing: 12–16%  
- Gemini grounding: 8–14%  

Если на Perplexity ниже 12%, это признак проблемы с GEO — контент не оптимизирован для retrieval.

### 2. Primary Source Rate

Как часто вы — **первый указанный источник**, когда вас цитируют:

```sql
SELECT 
  llm_provider,
  COUNTIF(rank = 1) / COUNTIF(cited = 1) AS primary_rate
FROM `project.dataset.llm_citations`
WHERE cited = 1
GROUP BY llm_provider;
```

**Целевой показатель:** 40%+ (если цитируют, в 4 из 10 случаев вы должны быть первым источником). Ниже 20% — слабой signal релевантности, вероятно, низкое сходство embedding при retrieval.

### 3. Volatility запросов

Для каждого запроса рассчитайте дисперсию citation за 30 дней — если вас всегда цитируют, volatility низкая; если иногда да, иногда нет — высокая. Высокая volatility означает, что LLM часто обновляет индекс или конкуренты вас оттеснили.

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

Volatility > 0.4 — перепроверьте запрос вручную. Вероятно, проблема свежести (контент опубликован 6 месяцев назад, LLM предпочитает новые источники).

## Компромисс атрибуции: Direct Traffic или LLM Referral

Побочный эффект получения LLM citation: в Google Analytics растет direct traffic, но вы не знаете, откуда он из LLM. Потому что клики из веб-интерфейса ChatGPT отображаются как `(direct) / (none)` — нет referrer header.

Решайте двумя способами:

**Метод 1: UTM Injection (в API LLM)**  
Если отправляете контент через API LLM (например Perplexity Publisher API), добавляйте к URL `?utm_source=perplexity&utm_medium=llm&utm_campaign=citation`. Тогда в GA4 видна будет source. Но работает только с LLM'ами, использующими API — для веб-краулинга ChatGPT UTM не поможет.

**Метод 2: Server-Side Fingerprinting**  
Bot'ы LLM'ов используют определённые паттерны User-Agent:  
- Perplexity: `PerplexityBot`  
- ChatGPT: `ChatGPT-User` или `GPTBot`  
- Gemini: `Google-Extended`  

Фильтруйте эти User-Agent в логах сервера и отправляйте в GA4 как server-side event через [First-Party Вступление & Архитектура измерения](https://www.roibase.com.tr/ru/firstparty). Event name: `llm_visit`, параметр: `llm_provider`. Так различаете LLM в "прямом" трафике.

| Метод | Преимущество | Недостаток |
|---|---|---|
| UTM Injection | Автоматическое отображение source в GA4 | Только API |
| Server-Side Fingerprint | Работает для всех LLM'ов | Требует парсинга логов |

Какой бы метод ни выбрали, цель: **увидеть корреляцию между citation rate и referral traffic**. Если citation выросла на 20%, но LLM traffic не вырос — пользователи не кликают несмотря на упоминание. Проблема в prominence или качестве snippet.

## Citation Prominence: встроенная или сноска

Вас упомянули, но **как**? Perplexity вставила встроенную ссылку в текст (позиция в предложении с `[1]`) или только в список "Related sources" в конце? Эта разница влияет на CTR на 400% (Roibase internal A/B test, n=2.300 запросов).

**Пример встроенной citation:**  
> "Длительность cookie в server-side GTM повышается до 730 дней [[1]](roibase.com.tr/...)."  

**Пример сноски:**  
> "...доступны несколько способов.  
> Источники:  
> 1. roibase.com.tr/...  
> 2. competitor.com/..."

Встроенная — пользователь видит ссылку в контексте и кликает. Сноска — клик только если ищет "больше деталей", intent ниже.

**Расчёт prominence score:**  
При каждом упоминании сохраняйте `position_type` (inline/footnote/sidebar). За 30 дней усредните:

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

**Целевой показатель:** 2.0+ (если цитируют, половина должна быть встроенной). Ниже 1.5 — LLM видит вас как "дополнительный источник", не основной. Решение: структурируйте контент так, чтобы LLM брала прямые цитаты — однострочные определения, fact box, code snippet.

## Конкурентный анализ: Source Overlap по запросам

На какие запросы конкуренты упоминаются, а вы нет? Парсьте **все источники**, которые показывает LLM, не только себя.

Пример: на запрос "оптимизация стоимости BigQuery" Perplexity показывает:  
1. competitor-a.com  
2. roibase.com.tr  
3. competitor-b.com  

Запишите все источники в таблицу `llm_all_sources` — схема: `query_id, llm_provider, date, source_domain, rank`. Теперь рассчитайте "матрицу overlap":

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

Результат: "Упоминаемся вместе с competitor-a на 47 запросах." Разделите `co_citation_count` на количество запросов, где competitor-a упоминается самостоятельно — это "citation overlap ratio". Выше 60% — прямая конкуренция, ниже 30% — разные ниши.

**Трансформация в действия:**  
Высокий overlap, но вас не упоминают — восполняйте content gap. Прочитайте страницу конкурента: какие факты приводит, какой формат (таблица/список/код)? Поместите те же факты в **структурированный вид** — JSON-LD, таблица, bullet list. LLM при retrieval предпочитает структурированные данные.

## Что начать измерять прямо сейчас

Спроектируйте синтетический набор запросов — извлеките из Search Console запросы с низким CTR и высокими показами. Запустите ежедневный конвейер n8n, записывайте ответы в BigQuery. За первые 30 дней соберите baseline: citation rate, primary source rate, prominence score. Затем мониторьте влияние [Generative Engine Optimization](https://www.roibase.com.tr/ru/geo) — какие изменения контента повышали citation, какие понижали. Если citation выросла, но трафик нет — проблема в prominence. Если преимущество есть — inline citation, это основной фокус. Проанализируйте конкурентов через co-citation и закройте content gap. Добавьте метрики в SEO dashboard — к концу 2026 смотрите не на "органический трафик", а на "органический + LLM visibility".