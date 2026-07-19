---
title: "Разрешение идентичности: 6 сигналов в единый профиль клиента"
description: "Как объединить рассеянные touchpoint'ы в единую идентичность через hash matching, probabilistic linking и household identity? Server-side pipeline и практическая схема."
publishedAt: 2026-07-19
modifiedAt: 2026-07-19
category: data
i18nKey: data-003-2026-07
tags: [identity-resolution, hash-matching, probabilistic-linking, cdp, first-party-data]
readingTime: 9
author: Roibase
---

Пользователь кликает на кампанию со смартфона, добавляет товар в корзину с десктопа, совершает покупку в магазине. Три события — три разные идентичности: `device_id`, `cookie_hash`, `email_hash`. Identity resolution — это data pipeline, который объединяет эти фрагменты в один профиль клиента. В постпеченьевскую эпоху (Consent Mode v2, iOS ATT, CCPA) server-side идентификация на базе first-party данных — это уже не рекомендация, а необходимость.

## Почему 6 разных сигналов

Современный маркетинг-стек собирает сигналы идентичности в шести слоях: **браузерная кука**, **ID устройства** (IDFA/GAID), **аутентифицированный хеш** (email SHA-256), **ID клиента** (CRM/CDP внутренний), **отпечаток IP+user-agent**, **household graph**. Каждый включается на разных этапах жизненного цикла пользователя.

Браузерная кука появляется при первом touchpoint'е; ID устройства — в мобильном приложении; аутентифицированный хеш — когда собирают email или номер телефона; ID клиента — после checkout'а; отпечаток — для вероятностного сопоставления без консента; household graph — для группировки устройств с одного маршрутизатора. Проблема: эти шесть сигналов хранятся в разных таблицах с разными TTL'ями (кука — 90 дней, IDFA — бесконечно, email хеш — до удаления клиента). Без разрешения каждый канал считает отдельного пользователя — в marketing mix model'и возникает двойной счёт, в incrementality тестах переоценка, в retention когортах искусственно низкая retention.

Логику разрешения строят двумя методами: **детерминистический (hash matching)** и **вероятностный (graph linking)**. Детерминистический: хеш SHA-256 email'а связывает браузерное событие с backend транзакцией — 100% уверенность. Вероятностный: одинаковые IP+user-agent за 24 часа в двух событиях → 73% вероятность, что это один пользователь (пример threshold). Без разрешения идентичности число unique users раздувается на 40-80% (в зависимости от категории и микса девайсов).

## Hash matching: превращаем email и номер в identity key

Hash matching — позвоночник server-side идентификации. Когда пользователь вводит email или телефон, client-side или sGTM создаёт SHA-256 хеш, который пишется в таблицу `identity_map`. При следующих анонимных событиях вы можешь найти хеш по куке или ID устройства.

Базовая схема `identity_map`:

```sql
CREATE TABLE identity_map (
  canonical_id STRING NOT NULL,      -- UUID, внутренний ID
  signal_type STRING NOT NULL,       -- 'email_sha256', 'phone_sha256', 'device_id', 'cookie'
  signal_value STRING NOT NULL,      -- хеш или ID
  first_seen TIMESTAMP,
  last_seen TIMESTAMP,
  PRIMARY KEY (signal_type, signal_value)
);
```

Пользователь вводит `user@example.com` в форму регистрации — sGTM хеширует этот email SHA-256 и выполняет `INSERT`: `('uuid-123', 'email_sha256', 'abc123...', NOW(), NOW())`. На той же сессии есть кука `_ga=GA1.1.xyz` — вторая строка: `('uuid-123', 'cookie', 'GA1.1.xyz', NOW(), NOW())`. Теперь под `canonical_id = uuid-123` два сигнала объединены.

На следующей сессии пользователь приходит с `_ga=GA1.1.xyz`, но email не вводит. Запрос в BigQuery:

```sql
SELECT canonical_id
FROM identity_map
WHERE signal_type = 'cookie' AND signal_value = 'GA1.1.xyz'
LIMIT 1;
```

Возвращает: `uuid-123`. События привязываются к этому ID — пользователь опознан даже без email хеша. Hash matching на 100% точен, потому что кол-лизия хешей криптографически невозможна. Но есть проблема покрытия: если пользователь email не вводил — хеша нет, переходите на вероятностный метод.

### Риск коллизий и salt

Риск SHA-256 коллизии теоретический: 1 на 2^128 попыток. В production главная проблема — **один email может быть привязан к разным canonical_id'ам** (ручная ошибка, остатки старой миграции). Поэтому вы ставите `UNIQUE INDEX (signal_type, signal_value)`. Salt (email + секретная строка, потом хеш) не повышает риск коллизии, но в архитектуре [first-party данных](https://www.roibase.com.tr/ru/firstparty) добавляет privacy слой — при ротации salt'а старые хеши становятся невалидными, что полезно для GDPR "right to be forgotten".

## Probabilistic linking: IP, user-agent и device graph

Пользователь сёрфит в инкогнито — детерминистичных сигналов нет. Тогда включаете **вероятностный граф**: IP + user-agent + proximity timestamps создают оценку "скорее всего одно лицо". Пример: один IP, одинаковый user-agent, события с разницей в 15 минут — это 85% вероятность того же пользователя.

Простая вероятностная логика слияния:

```sql
WITH anon_events AS (
  SELECT
    event_id,
    ip_address,
    user_agent,
    event_timestamp,
    FARM_FINGERPRINT(CONCAT(ip_address, user_agent)) AS fingerprint
  FROM events
  WHERE canonical_id IS NULL
),
clusters AS (
  SELECT
    fingerprint,
    MIN(event_timestamp) AS first_event,
    MAX(event_timestamp) AS last_event,
    COUNT(*) AS event_count
  FROM anon_events
  GROUP BY fingerprint
  HAVING TIMESTAMP_DIFF(MAX(event_timestamp), MIN(event_timestamp), HOUR) < 24
)
SELECT
  a.event_id,
  c.fingerprint AS probable_cluster_id
FROM anon_events a
JOIN clusters c ON a.fingerprint = c.fingerprint;
```

Этот запрос группирует события по хешу IP+UA за 24 часа. Cluster ID можно использовать как временный `canonical_id`, но добавьте confidence score: `event_count > 3 AND time_span < 1 HOUR → confidence=0.9`.

**Household graph:** разные user-agent'ы (ноутбук, планшет, телефон) с одного IP — вероятно один дом. Вы создаёте `household_id` и привязываете его к отдельным `canonical_id`. Например, Amazon Prime подписка: 1 аккаунт, 6 профилей — identity resolution агрегирует на household уровне.

### Процент ложных срабатываний

В probabilistic linking есть риск ложных срабатываний. Два разных пользователя могут быть с одного IP+user-agent (офисный WiFi, библиотека). Слишком низкий порог (%50 confidence) даст 15-25% ложных срабатываний. Industry best practice: порог 75%+, окно 1 час, минимум 2 события на совпадение. Вендоры типа LiveRamp используют graph databases (Neo4j) и комбинируют 30+ сигналов, обещая 95%+ accuracy — но в вашем first-party pipeline'е 2-3 сигнала с 80% accuracy достаточно.

## Server-side pipeline: sGTM + BigQuery + dbt

Identity resolution в production работает вот по такому потоку:

1. **sGTM ingestion:** Client-side GTM отправляет событие в sGTM, sGTM добавляет SHA-256 хеш email'а (если есть), пишет raw событие в BigQuery (`events_raw`).
2. **dbt staging model:** таблица `stg_events` вычищает `events_raw`, парсит `signal_type` и `signal_value`.
3. **dbt identity_map merge:** при первом виде нового хеша выполняется `MERGE` в `identity_map` (upsert логика).
4. **dbt canonical_id enrichment:** каждое событие join'ится с `identity_map`, выполняется lookup `canonical_id`.
5. **dbt aggregation:** user-level метрики (`user_ltv`, `session_count`) агрегируются по `canonical_id`.

Пример dbt модели (`models/staging/stg_events.sql`):

```sql
{{ config(materialized='incremental') }}

WITH events_with_signals AS (
  SELECT
    event_id,
    event_timestamp,
    COALESCE(user_properties.email_sha256, NULL) AS email_hash,
    COALESCE(user_properties.ga_client_id, NULL) AS cookie_id,
    event_params
  FROM {{ source('bigquery', 'events_raw') }}
  {% if is_incremental() %}
  WHERE event_timestamp > (SELECT MAX(event_timestamp) FROM {{ this }})
  {% endif %}
)
SELECT * FROM events_with_signals;
```

Incremental модель запускается каждый час, обрабатывает последний батч. Логика identity merge в отдельной модели (`models/core/fct_identity_resolved.sql`):

```sql
SELECT
  e.event_id,
  COALESCE(im_email.canonical_id, im_cookie.canonical_id) AS canonical_id,
  e.event_timestamp
FROM {{ ref('stg_events') }} e
LEFT JOIN {{ ref('identity_map') }} im_email
  ON e.email_hash IS NOT NULL
  AND im_email.signal_type = 'email_sha256'
  AND im_email.signal_value = e.email_hash
LEFT JOIN {{ ref('identity_map') }} im_cookie
  ON e.cookie_id IS NOT NULL
  AND im_cookie.signal_type = 'cookie'
  AND im_cookie.signal_value = e.cookie_id;
```

Эта логика join'а выполняет детерминистичный hash matching. Для вероятностного добавляете отдельную модель `fct_probabilistic_clusters`.

## Consent и privacy: GDPR, CCPA соответствие

Identity resolution подпадает под GDPR Article 6 (законное основание) и CCPA "do not sell" правила. Email хеш квалифицируется как **личные данные** (решение CJEU 2019), поэтому требуется consent или legitimate interest.

Под Consent Mode v2: если пользователь выставляет `analytics_storage=denied`, вы не можете собирать email хеш. Остаётся только IP+UA отпечаток (под legitimate interest — хотя интерпретация CJEU спорна). Best practice: добавляете колонку `consent_status` в `identity_map` и пишите хеш только из событий с `analytics_storage=granted`.

Для CCPA "right to delete" нужна логика удаления по `canonical_id`:

```sql
DELETE FROM identity_map WHERE canonical_id = 'uuid-123';
DELETE FROM events WHERE canonical_id = 'uuid-123';
```

Для cascade удаления используйте foreign key constraints (BigQuery их не поддерживает, но Postgres/Snowflake поддерживают). Альтернатива: soft delete (`deleted_at TIMESTAMP`) с последующей batch очисткой.

### TCF 2.2 маппинг вендоров

Под IAB TCF 2.2 identity resolution попадает под "Purpose 1 — Store and/or access information on a device". Если пользователь не одобрил вашего вендора в списке, вы не можете делать cross-device linking. В Roibase проектах парсим TCF строку в BigQuery и пишем в колонку `vendor_consent`, затем фильтруем при identity merge:

```sql
WHERE vendor_consent LIKE '%vendor_id=123%'
```

Эта логика блокирует граф идентичности без consent'а — баланс между compliance и качеством данных.

## CDP интеграция: Segment, mParticle, Rudderstack

Современные CDP'ы предлагают собственные identity graph'ы, но обычно это "чёрный ящик". Когда вы строите свой pipeline, вы контролируете логику графа — особенно критично в проектах [CDP и Retention Engineering](https://www.roibase.com.tr/ru/retention-engineering-cdp). `identify()` вызов в Segment слияет `userId` и `anonymousId`, но какой сигнал приоритетнее? В вашей логике порядок приоритета явный:

1. `customer_id` (CRM) — самый надёжный
2. `email_sha256` — детерминистичный
3. `device_id` — cross-session но не cross-device
4. `cookie` — самый короткий TTL
5. `fingerprint` — probabilistic fallback

Этот порядок кодируется в dbt цепочкой `COALESCE()`. В CDP отправляете только финальный `canonical_id` и `confidence_score` — логика слияния остаётся у вас.

Identity resolution — фундаментальный слой современного маркетинг data stack'а. Hash matching даёт детерминистичную точность, probabilistic linking обеспечивает покрытие, household graph открывает семейную сегментацию. Server-side pipeline объединяет эти шесть сигналов в соответствии с consent и privacy правилами — и accuracy unique users прыгает на 40%, аномалии в retention когортах исчезают, incrementality тесты становятся надёжными. Когда вы кодируете resolution лог