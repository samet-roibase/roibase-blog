---
title: "Privacy-First Analytics: Plausible + Серверная агрегация"
description: "Архитектура без cookies: Plausible, серверная агрегация и соответствие GDPR. Сравнение с GA4, интеграция first-party данных и compliance-driven tracking."
publishedAt: 2026-07-10
modifiedAt: 2026-07-10
category: verianalizi
i18nKey: data-006-2026-07
tags: [privacy-first-analytics, cookieless-tracking, plausible, gdpr-compliance, serverside-aggregation]
readingTime: 9
author: Roibase
---

Google Analytics 4 и обязательный режим согласия v2, а также рекордные штрафы по защите данных в 2024 году переосмысляют измерение маркетинга. В Европе %42 веб-трафика блокирует отслеживание (Ghostery 2025), в России этот показатель достигает %31. Системы на основе клиентских cookies теряют третую часть трафика. Privacy-first analytics становится не только compliance-требованием, но и архитектурной необходимостью — балансируя между техническими потребностями, соответствием регуляции и пользовательским опытом. Решения вроде Plausible в сочетании с серверной агрегацией обеспечивают этот баланс на уровне конкретных данных.

## Архитектурная логика Cookieless Analytics

Privacy-first analytics измеряет поведение пользователей в агрегированном виде, без зависимости от клиентских идентификаторов (cookies, device ID). Plausible регистрирует просмотры страниц, источники трафика, параметры UTM и события без записи cookies или LocalStorage. Каждый запрос отправляется POST-методом на сервер, сервер генерирует анонимный хеш (IP + User-Agent + домен сайта + ротирующая соль), и этот хеш используется для подсчёта уникальных посетителей в 24-часовом окне. Хеш не сохраняется — каждый день обнуляется, переидентификация невозможна.

В GA4 идентификатор пользователя записывается в cookie (`_ga`, срок жизни 2 года), для cross-domain tracking параметр `_ga` добавляется в URL. По GDPR это требует явного согласия — отказ в consent-форме останавливает отслеживание. У Plausible нет необходимости в consent-баннере, так как обработка персональных данных не происходит. В соответствии с GDPR (статья 4(1)) и локальными нормами данные считаются анонимизированными, если хеш удаляется в течение 24 часов без возможности восстановления личности.

Архитектура создаёт очевидный компромисс: анализ по воронке (funnel analysis), когортный анализ удержания (cohort retention), cross-device journey mapping — все эти возможности требуют идентификатора на уровне пользователя. Plausible предоставляет достижение целей и breakdown по источникам, но не имеет segment-based LTV или session replay. Здесь на сцену выходит слой агрегации.

## Слой серверной агрегации

Для компенсации недостатков cookieless tracking необходимо предварительно агрегировать поток событий на серверной стороне. Архитектура работает так: пока Plausible отправляет raw event на свой API, той же payload одновременно отправляется webhook на ваш бэкенд. Бэкенд записывает события в BigQuery, ежедневные job'ы на dbt агрегируют данные.

Пример dbt-модели (ежедневная сводка по событиям):

```sql
WITH daily_events AS (
  SELECT
    DATE(timestamp) AS event_date,
    page_path,
    referrer_source,
    utm_campaign,
    COUNT(*) AS page_views,
    COUNT(DISTINCT session_hash) AS sessions,
    SUM(CASE WHEN event_name = 'goal_completed' THEN 1 ELSE 0 END) AS conversions
  FROM {{ ref('plausible_raw_events') }}
  WHERE DATE(timestamp) = CURRENT_DATE() - 1
  GROUP BY 1, 2, 3, 4
)
SELECT
  event_date,
  page_path,
  referrer_source,
  utm_campaign,
  page_views,
  sessions,
  conversions,
  SAFE_DIVIDE(conversions, sessions) AS conversion_rate
FROM daily_events
```

Эта модель запускается каждое утро, суммируя вчерашний трафик по источникам, средствам и кампаниям. Session hash — это ротирующий клиентский идентификатор, выводимый из IP + User-Agent + sliding window по времени, с истечением через 1 час. Используя этот хеш в BigQuery JOIN, вы объединяете многостраничные сессии, но не привязываете пользователя к постоянному идентификатору.

Для анализа по типу GA4 funnel report сохраняйте последовательность событий в таблице агрегации:

```sql
SELECT
  session_hash,
  ARRAY_AGG(page_path ORDER BY timestamp) AS page_sequence,
  MIN(timestamp) AS session_start,
  MAX(timestamp) AS session_end
FROM {{ ref('plausible_raw_events') }}
WHERE DATE(timestamp) = CURRENT_DATE() - 1
GROUP BY session_hash
```

После завершения сессии хеш истекает, на следующий день тот же пользователь получает новый хеш. Этот подход соответствует GDPR: нет постоянного идентификатора.

### Интеграция Server-Side GTM

Чтобы встроить Plausible в архитектуру [first-party данных](https://www.roibase.com.tr/ru/firstparty), используйте server-side Google Tag Manager (sGTM) для маршрутизации событий. Клиентский скрипт Plausible отправляет событие прямо на серверы Plausible, но одновременно POST-ит событие в контейнер sGTM. На сторону sGTM пользовательский тег пересылает события в Conversion API, CDP и BigQuery параллельно.

Пример конфига sGTM-тага (Plausible event → BigQuery sink):

```javascript
const eventData = getAllEventData();
const BigQuery = require('BigQuery');

BigQuery.insert({
  projectId: 'roibase-analytics',
  datasetId: 'plausible_events',
  tableId: 'raw_events',
  rows: [{
    timestamp: eventData.timestamp,
    page_path: eventData.page_url,
    referrer: eventData.referrer,
    utm_source: eventData.utm_source,
    session_hash: eventData.session_id,
    event_name: eventData.event_name
  }]
});
```

Эта конфигурация даёт три преимущества: (1) dashboard Plausible работает в режиме real-time, (2) исторические данные накапливаются в BigQuery, (3) CDP (Segment, RudderStack) получает поток событий без привязки к постоянному ID — используются только агрегированные метрики.

## GA4 vs Plausible + sGTM: Компромиссы attribution и compliance

Сравнение GA4 с архитектурой Plausible + sGTM по возможностям attribution, нагрузке compliance и операционным затратам показывает следующие различия:

| Метрика | GA4 | Plausible + sGTM |
|---------|-----|-----------------|
| **Период отслеживания пользователя** | 2 года (cookie) | 24 часа (хеш) |
| **Cross-device attribution** | Да (Google Signals) | Нет |
| **Требование consent-баннера** | Да (GDPR) | Нет (анонимные данные) |
| **Контроль residency данных** | США (GCP) | Собственный сервер |
| **Session stitching** | Автоматическое (client ID) | Ручное (event sequence) |
| **Глубина funnel-анализа** | На уровне пользователя | На уровне сессии |
| **Время операционного setup** | 2 часа | 8 часов (backend + dbt) |

Преимущество GA4 — автоматическое user-level attribution: cross-device journey mapping, сегментирование аудитории, автоматическое создание списков для remarketing. Однако эта мощь сопровождается compliance-издержками. По GDPR вы должны объяснить цели обработки, раскрыть права субъекта данных. Consent-баннер приводит к потере %65 трафика (CookieBot 2025 benchmark). Plausible исключает эти издержки, но user-level LTV расчёт невозможен — вместо этого используется анализ на уровне сегмента.

Различие моделей attribution также критично: GA4 использует data-driven attribution (ML взвешивает touchpoints), Plausible предлагает только last-click и first-click. Для multi-touch attribution в BigQuery обработайте event sequence вашей моделью. Пример MMM (Marketing Mix Modeling): загрузите дневные агрегаты (spend, impressions, sessions, conversions) в regression-модель, рассчитайте incremental вклад каждого канала. Этот метод работает без user-level данных.

## Операционное развёртывание: Plausible Self-Hosted + dbt Pipeline

Для production deployment privacy-first analytics необходимо развернуть самостоятельно размещённый экземпляр Plausible. Облачный Plausible (plausible.io) хранит данные на своих серверах — для контроля data residency требуется self-hosted вариант. Развёртывание через Docker Compose занимает 30 минут:

```yaml
version: "3.3"
services:
  plausible:
    image: plausible/analytics:latest
    command: sh -c "sleep 10 && /entrypoint.sh db createdb && /entrypoint.sh db migrate && /entrypoint.sh run"
    depends_on:
      - plausible_db
      - plausible_events_db
    ports:
      - "8000:8000"
    env_file:
      - plausible-conf.env
```

В `plausible-conf.env` установите `DISABLE_AUTH=false` и `SECRET_KEY_BASE`. После запуска инстанса настройте webhook для BigQuery sink. Plausible не имеет встроенного webhook — напишите custom middleware. Пример Node.js Express endpoint:

```javascript
app.post('/plausible-webhook', async (req, res) => {
  const event = req.body;
  await bigquery.dataset('plausible_events').table('raw_events').insert([{
    timestamp: new Date(event.timestamp).toISOString(),
    page_path: event.url,
    referrer: event.referrer,
    utm_source: event.utm_source,
    session_hash: generateSessionHash(req.ip, req.headers['user-agent'])
  }]);
  res.sendStatus(200);
});
```

Функция хеширования сессии генерирует SHA-256 из IP + User-Agent + дневной соли:

```javascript
function generateSessionHash(ip, userAgent) {
  const salt = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return crypto.createHash('sha256').update(ip + userAgent + salt).digest('hex');
}
```

Этот хеш обнуляется каждый день — в 24-часовом окне подсчёт уникальных посетителей точен, но persistent tracking невозможен.

Планируйте dbt pipeline через Github Actions. Каждое утро в 06:00 запустите `dbt run --select +plausible_daily_summary`, агрегаты вчерашнего дня пересчитаются. Dashboard'ы в Looker или Metabase питайте этими таблицами агрегации. Для real-time метрик используйте собственный dashboard Plausible, для исторических трендов — BigQuery + dbt outputs.

## Интеграция с CDP и Retention Engineering

Связь privacy-first analytics с Customer Data Platform выглядит парадоксально — CDP хранит user profiles, Plausible генерирует анонимные данные. Решение — event-based интеграция: отправляйте в CDP агрегированные метрики без user identifiers, затем связывайте с email или phone hash. Пример: пользователь кликает по email-кампании и приходит на сайт, Plausible записывает события с session hash. Когда пользователь заполняет форму и указывает email, бэкенд хеширует email с SHA-256 и привязывает события этой сессии к email hash.

JOIN в BigQuery работает так:

```sql
WITH session_events AS (
  SELECT session_hash, page_path, timestamp
  FROM plausible_raw_events
  WHERE DATE(timestamp) = CURRENT_DATE() - 1
),
identified_sessions AS (
  SELECT email_hash, session_hash, form_submit_timestamp
  FROM user_identifications
  WHERE DATE(form_submit_timestamp) = CURRENT_DATE() - 1
)
SELECT
  i.email_hash,
  ARRAY_AGG(STRUCT(e.page_path, e.timestamp) ORDER BY e.timestamp) AS session_journey
FROM identified_sessions i
JOIN session_events e ON i.session_hash = e.session_hash
WHERE e.timestamp <= i.form_submit_timestamp
GROUP BY i.email_hash
```

Этот запрос привязывает journey до submit'а формы к email hash. В CDP (Segment, RudderStack, Insider) это сохраняется как "anonymous → identified" переход. По GDPR пользователь дал согласие, заполнив форму (если на форме указаны цели GDPR), поэтому email hash становится допустимым идентификатором со этого момента. События до отправки формы остаются анонимными — это не user-level tracking, а aggregate funnel-анализ для сегмента "пользователи, заполнившие форму".

Для retention engineering этот подход мощен: в CDP вы не можете cookieless способом отловить "посетил сайт, но не заполнил форму". Однако вы получаете aggregate данные о "journey пользователей, заполнивших форму, с момента первого прихода". Для когортного удержания считайте sessions по email hash через 7/30/90 дней после submit. Точ