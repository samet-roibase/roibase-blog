---
title: "Identity Resolution: От 6 Сигналов к Единому Идентификатору Клиента"
description: "Hash matching, probabilistic linking и household identity для объединения разрозненных сигналов клиента в единый идентификатор. Инженерия BigQuery + CDP на практике."
publishedAt: 2026-06-16
modifiedAt: 2026-06-16
category: data
i18nKey: data-003-2026-06
tags: [identity-resolution, customer-data-platform, hash-matching, probabilistic-linking, first-party-data]
readingTime: 8
author: Roibase
---

Средний срок жизни cookies сократился с 28 дней до 7. Пользователь начинает в мобильном приложении, платит на десктопном веб-сайте, возвращается из email-кампании — каждая точка контакта генерирует другой идентификатор. 40% маркетинговых данных остаётся orphan-событиями: нет user ID, нет session ID, нет attribution. Identity resolution — это операция объединения этих фрагментов инженерной дисциплиной. Не предположения, а hash matching; не умозаключения, а probabilistic graph; не допущения, а household clustering.

## Deterministic Matching: Объединение на Основе Хешей

Deterministic match работает, когда вы **достоверно знаете**, что два датапойнта делят одинаковый идентификатор. Email SHA-256 hash, phone number hash, CRM ID. Если в таблице событий BigQuery есть `user_id`, а в веб-аналитике `ga_client_id`, вы не можете напрямую их соединить — сначала нужно найти событие, где оба писаны, и построить таблицу сопоставления.

```sql
-- Пример детерминистского сшивания идентичности
CREATE OR REPLACE TABLE `project.dataset.identity_graph` AS
WITH email_hashes AS (
  SELECT DISTINCT
    user_pseudo_id,
    TO_HEX(SHA256(LOWER(TRIM(user_properties.email.value)))) AS email_hash
  FROM `project.dataset.events_*`
  WHERE user_properties.email.value IS NOT NULL
),
crm_map AS (
  SELECT
    crm_id,
    TO_HEX(SHA256(LOWER(TRIM(email)))) AS email_hash
  FROM `project.crm.customers`
)
SELECT
  e.user_pseudo_id,
  c.crm_id,
  e.email_hash
FROM email_hashes e
INNER JOIN crm_map c
  ON e.email_hash = c.email_hash;
```

Этот запрос связывает `user_pseudo_id` из Firebase Analytics с `crm_id` из CRM через **точное совпадение** email hash. Хеш email используется как якорный идентификатор. Важный момент: `LOWER(TRIM())` — если пользователь написал "Ali@X.com", а в CRM записано "ali@x.com", хеш совпадения разрушится. Поэтому нормализация — первый шаг pipeline.

Точность deterministic match 100%, recall низкий — находит только записи, где оба система делят идентификатор. Если пользователь вышел с веб-сайта без email, он не попадает в этот graph.

### Hash Collision и Приватность

Вероятность коллизии SHA-256 теоретически 2^-256 — в практике практически ноль. Однако GDPR Article 32 не приравнивает hash к pseudonymization; хеш сам по себе не является anonymization. Комбинация email hash + IP + timestamp может привести к re-identification. Поэтому таблицы хешей должны быть защищены encryption-at-rest + column-level access control.

## Probabilistic Linking: Граф-ориентированное Вероятностное Совпадение

Когда deterministic join не срабатывает, включается probabilistic matching. Вы связываете два record с разными идентификаторами через **поведенческое сходство**, **device fingerprint**, **timezone + user-agent**. Не машинное обучение — взвешенная оценка + пороговая система.

| Сигнал | Вес | Пример |
|--------|-----|---------|
| Один IP (в течение 24 часов) | 0.3 | 192.168.1.10 |
| Один User-Agent | 0.2 | Chrome 120 / Mac |
| Одна географическая локация | 0.15 | Istanbul, Kadıköy |
| Один клик на кампанию | 0.25 | utm_campaign=spring_sale |
| Одна последовательность просмотра товара | 0.1 | product_123 → product_456 |

Общий балл ≥ 0.7 означает, что две session **предположительно** одного человека. Этот порог регулируется в зависимости от dataset — на e-commerce может быть достаточно 0.65, в fintech нужна 0.85.

```sql
-- Пример вероятностного скоринга
WITH sessions AS (
  SELECT
    session_id,
    user_pseudo_id,
    device.operating_system,
    device.web_info.browser,
    geo.city,
    traffic_source.medium,
    ARRAY_AGG(ecommerce.items.item_id ORDER BY event_timestamp) AS item_sequence
  FROM `project.dataset.events_*`
  WHERE event_name = 'page_view'
  GROUP BY 1,2,3,4,5,6
)
SELECT
  a.session_id AS session_a,
  b.session_id AS session_b,
  (CASE WHEN a.operating_system = b.operating_system THEN 0.2 ELSE 0 END +
   CASE WHEN a.browser = b.browser THEN 0.2 ELSE 0 END +
   CASE WHEN a.city = b.city THEN 0.15 ELSE 0 END +
   CASE WHEN a.medium = b.medium THEN 0.25 ELSE 0 END +
   CASE WHEN a.item_sequence = b.item_sequence THEN 0.2 ELSE 0 END
  ) AS match_score
FROM sessions a
CROSS JOIN sessions b
WHERE a.session_id < b.session_id  -- оптимизация self-join
  AND a.user_pseudo_id != b.user_pseudo_id
HAVING match_score >= 0.7;
```

Этот запрос сравнивает **все пары session** — N² сложность. При 1M session это 500 миллиардов сравнений. В production нужно partitioning: временное окно (7 дней), geo-фильтр (один город), тип устройства (mobile-mobile).

Уровень false positive в probabilistic link 5-15%. Поэтому на downstream activation (CDP segment push, email-кампания) эти ID должны быть помечены флагом "potential duplicate".

## Household Identity: Один Девайс, Разные Пользователи

Планшет или Smart TV используют несколько человек. Детерминистское или вероятностное совпадение здесь объединяет разные семейные профили в один ID — ведёт к неправильной персонализации. Household identity resolution пытается разделить эти сценарии.

**Session-level fingerprint:** Разные пользователи, логинящиеся на одном девайсе в разное время, показывают разные browsing pattern. Пользователь, ищущий одежду в 08:00, отличается от того, кто ищет электронику в 23:00.

**Behavioral clustering:** K-means или hierarchical clustering группируют session. Если центроиды кластеров разные, вы создаёте несколько "виртуальных пользователей" под одним device_id.

```sql
-- Feature extraction для household clustering
CREATE OR REPLACE TABLE `project.dataset.household_features` AS
SELECT
  device_id,
  EXTRACT(HOUR FROM TIMESTAMP_MICROS(event_timestamp)) AS hour_of_day,
  COUNT(DISTINCT CASE WHEN event_name = 'purchase' THEN ecommerce.transaction_id END) AS purchase_count,
  APPROX_TOP_COUNT(ecommerce.items.item_category, 3) AS top_categories,
  AVG(ecommerce.purchase_revenue_in_usd) AS avg_basket_value
FROM `project.dataset.events_*`
WHERE device_id IS NOT NULL
GROUP BY device_id, hour_of_day;
```

После кластеризации каждый device_id получает виртуальные ID типа `household_user_1`, `household_user_2`. Эти ID не sync в CRM — используются только в analytics и personalization layer.

Точность household resolution низкая — ошибка в 30% нормальна. Поэтому за пределами e-commerce (особенно SaaS, fintech) не применяется.

## Структура Identity Graph и Обновление

Все результаты matching объединяются в один **identity graph table**. Эта таблица для каждого user_id хранит все известные aliases: email hash, CRM ID, ga_client_id, Firebase ID, advertising ID.

| canonical_id | identifier_type | identifier_value | match_method | confidence | updated_at |
|--------------|-----------------|------------------|--------------|------------|------------|
| user_0001 | email_hash | a1b2c3... | deterministic | 1.0 | 2026-06-15 |
| user_0001 | ga_client_id | GA1.2.123 | deterministic | 1.0 | 2026-06-14 |
| user_0001 | firebase_id | xyz789 | probabilistic | 0.75 | 2026-06-16 |
| user_0002 | crm_id | CRM-456 | deterministic | 1.0 | 2026-06-10 |

Graph обновляется инкрементально — каждый день сканируются новые события, добавляются новые совпадения. Старые links ослабляют через confidence decay: probabilistic link из 90 дней назад падает с 0.75 до 0.50.

Если вы моделируете graph как **directed acyclic graph (DAG)**, можете обнаружить циклы. Цикл User A → User B → User C → User A — признак ошибки данных, требует ручного review.

## Интеграция CDP и Activation Pipeline

Identity graph не используется изолированно — подаётся в CDP. Архитектура [CDP & Retention Engineering](https://www.roibase.com.tr/ru/retention-engineering-cdp) берёт canonical_id из graph, объединяет все touch point под этим ID, отправляет в segment engine.

Процесс activation работает так:

1. **Segment definition:** "За последние 30 дней 3+ session, добавил в корзину, но не купил" → определяется как BigQuery view.
2. **Identity resolution:** View для каждого user_pseudo_id выполняет lookup canonical_id.
3. **Channel sync:** Все email hash под canonical_id push в Meta CAPI, phone hash в Google Customer Match.
4. **Attribution:** При поступлении conversion event canonical_id trace все touch point через graph.

Без CDP identity resolution остаётся неполным — graph только говорит "кто с кем связан", не определяет "что делать с этим пользователем".

## Privacy Compliance и Consent Propagation

Identity resolution обосновывается через GDPR Article 6(1)(f) "legitimate interest" — но если пользователь явно не согласился, ID из этого graph нельзя использовать для retargeting. Интеграция с Consent Management Platform (CMP) обязательна.

Для каждого canonical_id хранится статус согласия: `{ analytics: true, marketing: false, personalization: true }`. ID, производные от graph, наследуют этот флаг — если User A имеет marketing=false, то ga_client_id User B, вероятностно связанный с User A, также не попадает в marketing segments.

При TCF 2.2 vendor consent propagation сложнее: пользователи дали согласие Meta, но не Google, для них graph selective sync. Эта архитектура часть процесса [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/ru/firstparty) — consent signal injekt в event pipeline с самого начала, graph update job читает эти signal.

---

Identity resolution — не просто JOIN операция, а критический слой, связывающий маркетинговые данные с механизмом принятия решений. Hash matching для достоверных совпадений, probabilistic scoring для слабых сигналов, household clustering для device sharing — все требует инженерной точности. Поддержание графика в актуальном состоянии, согласование с consent propagation, питание CDP activation pipeline — production-сторона этой дисциплины. В era без cookies идентификация клиента не предполагается — конструируется из шести разных идентификаторов.