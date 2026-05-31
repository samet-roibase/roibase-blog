---
title: "Identity Resolution: 6 сигналов в одну идентичность клиента"
description: "Техническая архитектура объединения распределенных сигналов в единый профиль клиента через hash matching, вероятностное связывание и household identity."
publishedAt: 2026-05-31
modifiedAt: 2026-05-31
category: data
i18nKey: data-003-2026-05
tags: [identity-resolution, cdp, first-party-data, probabilistic-matching, hash-matching]
readingTime: 8
author: Roibase
---

Пользователь регистрируется по email, совершает заказ из мобильного приложения, в другой день открывает заявку в поддержку с браузера. Cookie ID, device ID, хешированный email, IP, session ID, идентификатор пользователя — шесть разных сигналов. Без identity resolution они выглядят как шесть разных "клиентов". Атрибуция рекламы рассчитывается неправильно, модель LTV остается искаженной, теряются сигналы retention. Merge User ID в Google Analytics 4 объединяет только аутентифицированные сессии, не связывая анонимное поведение. CDP-системы продают probabilistic stitching, но не показывают структуру таблиц. Чтобы запустить identity graph в production, нужно объединить hash matching, вероятностное связывание и household identity.

## Hash Matching: Позвоночник детерминированного объединения

Hash matching устанавливает "точную" связь между двумя сигналами через сопоставление SHA-256 хешей одного email или номера телефона. Когда пользователь регистрируется на веб-сайте с `user@example.com`, хешируйте это значение в SHA-256 и напишите в таблицу `identity_signals` в BigQuery как колонку `hashed_email`. При входе из мобильного приложения с тем же email хешированный email будет одинаковым в обоих местах — объедините две записи.

```sql
-- Пример детерминированного совпадения в BigQuery
CREATE OR REPLACE TABLE `project.dataset.merged_identities` AS
SELECT
  web.anonymous_id AS web_cookie_id,
  mobile.device_id AS mobile_device_id,
  web.hashed_email,
  MIN(web.first_seen_timestamp) AS first_seen
FROM `project.dataset.web_events` web
INNER JOIN `project.dataset.mobile_events` mobile
  ON web.hashed_email = mobile.hashed_email
WHERE web.hashed_email IS NOT NULL
GROUP BY 1,2,3;
```

Этот запрос объединяет веб-cookie ID с мобильным device ID через хешированный email. `INNER JOIN` детерминирован — приходят только точные совпадения. Чтобы собрать совпадающие сигналы под одним `canonical_user_id`, используйте `ROW_NUMBER()` или генерирование UUID. Ограничение hash matching: если пользователь изменит email (старая учетная запись + новая учетная запись), они остаются двумя отдельными идентичностями. Здесь в дело вступает probabilistic layer.

Hash matching совместим с GDPR и KVKK, потому что вы не храните простой текст email — хеш односторонний и необратимый. Однако он уязвим для атак по радужным таблицам, поэтому добавьте к хешам email вторичный сигнал вроде отпечатка устройства или диапазона IP. Одной колонки хеша недостаточно — храните `hashed_email`, `hashed_phone`, `hashed_customer_id` в отдельных колонках. Установите partitioning таблицы на `DATE(timestamp)` — identity resolution обычно инкрементальна, полная сканирование всей истории дорого.

## Probabilistic Linking: Управление неопределенностью через скоры

Когда пользователь просматривает контент без регистрации, хешированный email отсутствует — есть только cookie ID, IP, user agent, timestamp сессии. Probabilistic matching взвешивает эти сигналы и выдает скор "вероятность того же человека". Если скор выше порога (например, 0.85), объедините две записи; если ниже — оставьте отдельно. Вендоры вроде LiveRamp, Merkle, Neustar продают такие скоры, но вы можете построить собственную модель на основе правил в собственном data warehouse.

Пример логики: одинаковый IP + одинаковый отпечаток браузера (canvas hash) + сеанс в течение 5 минут → скор совпадения 90%. Одинаковый IP + разный браузер + разница 2 часа → скор 40%. При пороге 0.7 первая пара объединяется, вторая — нет. В BigQuery можете смоделировать это блоками `CASE WHEN`:

```sql
SELECT
  a.session_id AS session_a,
  b.session_id AS session_b,
  CASE
    WHEN a.ip_address = b.ip_address
      AND a.canvas_hash = b.canvas_hash
      AND TIMESTAMP_DIFF(b.timestamp, a.timestamp, MINUTE) <= 5
    THEN 0.90
    WHEN a.ip_address = b.ip_address
      AND TIMESTAMP_DIFF(b.timestamp, a.timestamp, HOUR) <= 2
    THEN 0.40
    ELSE 0.0
  END AS match_score
FROM `project.dataset.anonymous_sessions` a
CROSS JOIN `project.dataset.anonymous_sessions` b
WHERE a.session_id < b.session_id
  AND a.ip_address = b.ip_address
QUALIFY match_score >= 0.70;
```

Этот запрос делает `CROSS JOIN` — на миллионах строк стоимость взлетит. В production нужны window function или bucketing: разделите диапазон IP по префиксу (например, `/24` CIDR), сравните только последние 100 сессий через `ROW_NUMBER()`. Риск probabilistic matching — false positive: два разных пользователя с одного IP (корпоративный Wi-Fi, общее VPN) в один момент времени могут неправильно объединиться. Поэтому держите порог скора 0.85–0.90 и подтверждайте через cross-device сигналы.

Более сложная модель с машинным обучением: логистическая регрессия или gradient boosting для бинарной классификации "один пользователь". Набор признаков: расстояние Хэмминга IP, сходство user agent по Левенштейну, смещение временных зон, счетчик сеансов. Размеченные данные обучения — положительные примеры из известных пар `user_id`, отрицательные — из разных `user_id`. Модель выдает скор от 0 до 1, порог остается ручная настройка. Для этого подхода нужен pipeline Vertex AI или Sagemaker — инженерия данных + machine learning работают вместе.

## Household Identity: один дом, разные пользователи

Слой "household" в identity resolution: группировка разных пользователей с одного IP или физического адреса в "семейную единицу" для маркетинг-таргетинга. Например, на сайте электроники мама смотрит детскую одежду, отец покупает электронику — два разных user ID, но один адрес доставки. Household graph объединяет их под `household_id`. На рекламных платформах (Facebook Ads, Google Ads) это продается как household targeting, но вам нужно смоделировать это в first-party data.

Нормализуйте адрес доставки в BigQuery: удалите различия в регистре, пробелах, номерах квартир. Потом захешируйте и используйте как `household_key`:

```sql
CREATE OR REPLACE TABLE `project.dataset.household_mapping` AS
SELECT
  user_id,
  TO_HEX(SHA256(
    LOWER(REGEXP_REPLACE(CONCAT(street, city, postal_code), r'\s+', ''))
  )) AS household_key
FROM `project.dataset.user_addresses`
WHERE street IS NOT NULL AND postal_code IS NOT NULL;
```

Эта таблица дает маппинг `user_id` → `household_key`. Сгруппируйте пользователей под одним `household_key` и присвойте им `household_id`. Household identity отличается от cross-device identity — не устройства одного человека, а люди одного дома. Риск приватности высок: объединение двух разных взрослых пользователей в один household может нарушить принцип минимизации данных (KVKK ст. 5). Поэтому используйте household graph только для агрегированной аналитики и анонимного таргетинга, не для объединения персональных профилей.

Добавьте ко второму слою сигналы: хеш SSID Wi-Fi (если мобильное приложение даст разрешение), Bluetooth beacon (физический магазин), shared payment method (одна кредитная карта). Эти сигналы содержат PII и требуют хеширования + encrypted storage. CDP-системы (Segment, mParticle, RudderStack) предлагают household resolution как "relationship graph", но если построить собственную модель в BigQuery, получаете больше контроля — видите, как каждый сигнал взвешивается. В работе Roibase [CDP & Retention Engineering](https://www.roibase.com.tr/ru/retention-engineering-cdp) этот слой интегрируется в production pipeline.

## Graph Database vs Relational: что быстрее

Хранение identity graph в relational warehouse вроде BigQuery возможно, но запросы "найти все устройства пользователя X" (transitive closure) дорогие. Graph database (Neo4j, Amazon Neptune, TigerGraph) работает с узлами и ребрами быстрее — запрос `MATCH (u:User)-[:HAS_DEVICE]->(d:Device)` вернет ответ за миллисекунды. В BigQuery тот же запрос пишется `RECURSIVE CTE` или `ARRAY_AGG`, но на больших таблицах использование слотов растет.

Trade-off: Graph DB очень быстрая, но изменение схемы сложно, модель node/edge отличается от привычного SQL синтаксиса. Relational warehouse медленнее, но версионирование через dbt, тесты и документация легче. Большинство production сценариев используют гибридный подход: в BigQuery ежедневно batch строит таблицу identity mapping, синхронизирует в Neo4j, real-time lookup делает Neo4j. Пример pipeline: dbt model → BigQuery view → Cloud Function trigger → Neo4j Cypher INSERT.

```sql
-- BigQuery recursive CTE для transitive closure (медленно)
WITH RECURSIVE identity_chain AS (
  SELECT signal_a, signal_b, 1 AS depth
  FROM `project.dataset.identity_edges`
  UNION ALL
  SELECT ic.signal_a, e.signal_b, ic.depth + 1
  FROM identity_chain ic
  JOIN `project.dataset.identity_edges` e
    ON ic.signal_b = e.signal_a
  WHERE ic.depth < 5
)
SELECT DISTINCT signal_a, signal_b
FROM identity_chain;
```

Этот запрос следует цепочке максимум на 5 уровней (depth). Без контроля depth может быть бесконечный цикл — если есть циклическая связь A → B → A. Graph DB встроенно справляется с циклами, в BigQuery нужно добавить WHERE condition вручную. Если identity graph доходит до 10M+ ребер, выделенная система вроде Neo4j более управляема. На масштабе до 1M ребер BigQuery + dbt достаточно.

## Privacy и Consent: юридические границы Identity Graph

Identity resolution попадает в определение "профилирование" в GDPR (ст. 4(4)). Без согласия пользователя детерминированное + probabilistic связывание — юридический риск. Consent Mode v2 (Google) разделяет "analytics_storage" и "ad_storage", но для identity stitching может потребоваться доп. категория "personalization_storage". В TCF 2.2 нужно получить Purpose 1 (device storage) + Purpose 9 (personalized ads) — без них даже hash matching незаконен.

Хешированный email в GDPR считается "псевдонимизированными данными" (Recital 26) — остается персональными данными. Если через rainbow table или reverse lookup можно вернуть plaintext, это не "анонимизация", а "псевдонимизация". Добавьте salt к хешам (email + site-specific secret → SHA-256) и храните salt в HSM (Hardware Security Module) или Secret Manager. Когда пользователь потребует "отсоединить" (GDPR ст. 18 restriction), удалите edges этого пользователя из identity graph и разорвите детерминированную связь.

По KVKK ст. 7 нужна явная согласие: "Кеший билгилердин иштетилишине байланышкан айбык розалуу, белгилүүлүк айбыктуу, маалымдандырылганга негизделген жана озгүч эменелүүлүккө билинген розалууу." Identity stitching должна быть указана как отдельный пункт в форме согласия — "лучший опыт" слишком генеричный. Когда пользователь отозвет согласие (`consent_revoked_at` timestamp), удалите все edges этого `user_id` из identity graph и установите флаг `deleted_at`. В BigQuery сделайте soft delete — вместо физического удаления фильтруйте `WHERE deleted_at IS NULL`.

## Реализация: Incremental Identity Pipeline на dbt

В production identity resolution должна работать инкрементально, не batch — ежедневно добавляйте новые сигналы, обновляйте текущий graph. Инкрементальная модель dbt:

```sql
{{
  config(
    materialized='incremental',
    unique_key='edge_id',
    partition_by={'field': 'created_date', 'data_type': 'date'},
    cluster_by=['signal_a_type', 'signal_b_type']
  )
}}

WITH new_edges AS (
  SELECT
    GENERATE_UUID() AS edge_id,
    a.signal_id AS signal_a,
    a.signal_type AS signal_a_type,
    b.signal_id