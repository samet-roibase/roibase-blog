---
title: "Server-Side GTM и Conversion API: От нуля к Production"
description: "Развертывание server-side tagging на Cloud Run и Workers, контейнер-шаблон, дедупликация событий и стратегии мониторинга production."
publishedAt: 2026-05-07
modifiedAt: 2026-05-07
category: data
i18nKey: data-001-2026-05
tags: [server-side-gtm, conversion-api, cloud-run, event-deduplication, privacy-sandbox]
readingTime: 9
author: Roibase
---

Браузерная аналитика умерла. Third-party cookie исчезли, ITP упал до 12 часов, Consent Mode v2 стал обязательным. Маркеры, которые не отправляют события напрямую в API-endpoints Meta и Google на стороне сервера, сейчас находятся в полной тьме атрибуции. Server-side Google Tag Manager (sGTM) и Conversion API в 2026 году — это не опция, а production requirement. В этой статье мы покажем, как развернуть production-ready sGTM контейнер на Cloud Run с нуля, как настроить дедупликацию событий и какие метрики мониторить.

## Почему Server-Side Tagging требует контейнера

Классический GTM на стороне браузера загружает JavaScript-библиотеку и собирает данные из user agent. Server-side GTM работает совершенно иначе: Node.js контейнер, запущенный на твоём сервере, принимает HTTP POST от клиента, обогащает события (парсинг IP, user-agent, first-party ID из cookie) и перенаправляет их в целевые API (Meta CAPI, Google Ads Conversion, GA4 Measurement Protocol). Эта архитектура дает три ключевых преимущества: (1) ты обходишь ограничения браузера — ITP, adblock, CORS просто не существуют; (2) ты контролируешь хеширование PII — email, телефон хешируются на сервере SHA-256, в браузер никогда не возвращаются; (3) ты отправляешь один event в несколько платформ параллельно — один POST с клиента, fan-out на 4 разных endpoint с сервера.

Официальный путь Google — App Engine или Cloud Run. App Engine приносит фиксированную стоимость и auto-scaling, но не кастомизируется. Cloud Run предпочтительнее: с минимальной инстанцией 1 ты гарантируешь latency 24/7, и ты полностью кастомизируешь image через Dockerfile (например, injection переменных окружения из secrets, startup scripts). Альтернатива — Cloudflare Workers, где cold-start быстрее (~5ms против 200ms), но Node.js sandbox ограничивает возможности (некоторые GTM теги не работают в custom template с native require).

Процесс развертывания: (1) новый проект в Google Cloud Console, (2) `gcloud` CLI pull'ит sGTM container image, (3) Cloud Run service создаешь с environment variable'ами (`CONTAINER_CONFIG`, `PREVIEW_SERVER_URL`), (4) кастомный домен привязываешь (например, `gtm.roibase.com.tr`) — критично для first-party контекста, (5) tagging server URL добавляешь в web GTM (`serverContainerUrl` параметр). Первое развертывание занимает ~15 минут, последующие через CI/CD — 2 минуты.

## Event Deduplication: связываем клиент + сервер одним ID

Критическая проблема server-side GTM — дедупликация. Если одно преобразование отправится и из браузера (client-side GA4 tag), и с сервера (server-side GA4 client), платформа посчитает 2 conversion. Для Meta CAPI и Google Ads Conversion система deduplication ID обязательна. Как это работает: каждому event присваиваешь уникальный `event_id` (или в терминологии Meta `event_name + event_id`), и клиент, и сервер отправляют один и тот же ID, платформа в 24-часовом окне проверяет ID collision и drop дубликат.

Стратегии Deduplication ID:

| Метод | Преимущество | Риск |
|--------|---------|------|
| UUID v4 (случайный) | Коллизия невероятна | Нужна синхронизация клиент-сервер (localStorage/cookie) |
| Transaction ID (e-commerce) | Естественный уникум | Отсутствует в non-transaction event (lead, signup) |
| Session ID + timestamp | Легко генерировать | Пересечение сессий может вызвать столкновение |
| `_ga` client ID + event timestamp | Основан на first-party ID | Риск clock skew (разница в часах клиент/сервер) |

Production setup Roibase: `SHA-256(_ga + event_name + unix_ms)` — при push в DataLayer на браузере заполняем `event_id` этим хешем, server-side GA4 tag читает тот же field и отправляет его в Measurement Protocol. Для Meta CAPI дополнительно inject'им `event_source_url` и `action_source=website` параметры на сервере, потому что client-side Facebook Pixel эти field'ы не отправляет, а сервер-side валидация требует.

```javascript
// Пример DataLayer push (client-side)
window.dataLayer.push({
  event: 'purchase',
  event_id: sha256(_ga + 'purchase' + Date.now()),
  transaction_id: 'ORD-12345',
  value: 299.00,
  currency: 'TRY'
});
```

В server-side контейнере создаешь custom variable, который маппирует `{{Event ID}}` в GA4 и CAPI tag'и. GA4 Measurement Protocol поддерживает `&ep.event_id=` параметр, Meta CAPI имеет root-level `event_id` field. Для Google Ads Conversion комбинация `gclid` + `conversion_action_id` обеспечивает дедупликацию — `gclid` читается из cookie и POST'ится на сервер, server-side Ads tag объединяет `gclid` + `conversion_value` и отправляет в Conversion Tracking API.

## Container Template и Custom Client Setup

sGTM контейнер состоит из 3 основных компонентов: **Client** (парсит входящий HTTP request, преобразует в event object), **Tag** (отправляет event во внешний API), **Variable** (обмен данными между tag'ами). Default "GA4" client Google'а недостаточен — он слушает только `/g/collect` endpoint. Мы пишем custom client, который handle'ит и GA4, и кастомные endpoint'ы (`/event`, `/purchase`) в одном контейнере.

Пример custom client template:

```javascript
const claimRequest = require('claimRequest');
const getRequestBody = require('getRequestBody');
const JSON = require('JSON');
const logToConsole = require('logToConsole');

claimRequest();

const body = getRequestBody();
const eventData = JSON.parse(body);

// Нормализуем event object
const normalizedEvent = {
  event_name: eventData.event || 'unknown',
  user_data: {
    client_id: eventData.client_id,
    user_agent: eventData.user_agent,
    ip_override: eventData.ip_address
  },
  event_id: eventData.event_id,
  timestamp_micros: eventData.timestamp * 1000000
};

logToConsole('Normalized event:', normalizedEvent);
runContainer(normalizedEvent, () => {
  returnResponse();
});
```

Этот client ловит POST'ы на `/event`, парсит JSON body и трансформирует в sGTM event model. Вызов `runContainer()` триггерит tag'и — GA4 tag видит `event_name=purchase` и отправляет в Measurement Protocol, Meta CAPI tag видит `user_data.email` и отправляет SHA-256 хеш в `/events` endpoint.

Production setup работает с 4 client'ами: (1) GA4 default client (`/g/collect`), (2) custom JSON client (`/event`), (3) Meta Pixel client (`/tr/` endpoint — совместимость с Facebook SDK), (4) health check client (`/health`) — Cloud Run liveness probe пингует этот endpoint, проверяя здоровье контейнера. Каждый client имеет приоритет (priority number) — если два client'а claim одной path, выигрывает с наивысшим приоритетом.

Custom template'ы нужно держать под version control. Изменения в UI Google Tag Manager не видны в git history. Наш workflow: сохраняем template'ы как `.tpl` файлы в repo, CI pipeline использует `gtm-template-push` CLI tool для развертывания в sGTM workspace, тестируем на staging контейнере, затем promote в production. Rollback — один git revert.

## Production Monitoring: какие метрики критичны

После развертывания server-side GTM мониторинг на 4 уровнях обязателен: (1) container health (uptime, latency, error rate), (2) event throughput (event/sec, tag success rate), (3) deduplication accuracy (delta между клиент и сервер event count), (4) downstream platform validation (Meta Event Quality Score, Google Ads conversion tracking status).

Cloud Run native метрики:

- **Request count** — количество POST на `/event`, breakdown по минутам
- **Request latency (p50, p95, p99)** — если median > 120ms, проблема (норма 40-80ms)
- **Container instance count** — если min=1, всегда должно быть 1, spike'ы trigg'ат auto-scale
- **Error rate (5xx)** — >0.1% постоянно = проблема в downstream tag'ах

sGTM Console имеет "Logs" вкладку с event-level debug log, но production `console.log` каждого event создает I/O overhead. Наш setup: debug logging только при `?gtm_debug=1` query param, production трафик отключен. Критические ошибки (tag HTTP 4xx/5xx) идут в Google Cloud Logging как structured JSON log, оттуда Cloud Monitoring alert policy trigger'ит — если за 3 минуты 10+ "Invalid access token" ошибок из Meta CAPI, Slack notif отправляется.

Для event throughput monitoring создаешь custom metric: внутри sGTM tag'а call `sendHttpGet('https://metrics.roibase.com.tr/increment?metric=capi_event')`, метрик-сервис хранит Prometheus counter. В Grafana dashboard видишь real-time event flow — если client-side GA4 отправляет 1000 event/мин, но server-side CAPI получает только 850, это значит collision в deduplication ID или network drop.

Downstream platform validation — самое критичное. В Meta Events Manager есть Event Match Quality (EMQ) score — ниже 6.5/10 = "низкое качество", хеш-алгоритм неправильный или PII field'ы неполные. Google Ads Conversion Tracking должно быть "Status: Eligible" — если видишь "Rarely used" или "Below threshold", event volume недостаточен (минимум 15 conversion/30 дней). В GA4 DebugView фильтруешь по `traffic_type=server_side`, сравниваешь `event_count` с client-side — разница >20% требует investigation.

## Identity Resolution и User Matching сигналы

Мощь server-side ölçüm — контролируемая отправка PII (Personally Identifiable Information) платформам. Meta CAPI принимает 7 user matching параметров: `em` (email hash), `ph` (phone hash), `fn` (first name), `ln` (last name), `ct` (city), `st` (state), `zp` (zip), `country`, `external_id` (CRM ID). Чем больше сигналов, тем выше EMQ — один `em` дает 4.2/10, `em + ph + fn + ln` дает 7.8/10. Google Enhanced Conversions работает аналогично: добавляешь `sha256_email_address` и `sha256_phone_number` в Ads Conversion tag — attribution accuracy растет на 40% (по бета-тесту Google 2025).

Production identity resolution pipeline Roibase: (1) пользователь вводит email/телефон в веб-форму, (2) client-side JS хеширует SHA-256 (plain text не держится в браузере), (3) хешированное значение push'ится в DataLayer, (4) sGTM берет хеш и отправляет Meta CAPI как `user_data.em` field, Google как `user_data.sha256_email_address`. Этот flow GDPR-compliant — plain PII никогда не падает в server log'и, SHA-256 — one-way hash, обратно не возвращается.

Дополнительный сигнал: `fbp` (Facebook Browser ID) и `fbc` (Facebook Click ID) cookie'и читаешь на стороне сервера и отправляешь в CAPI. `fbp` cookie set'ит client-side Pixel, но ITP expire'ит за 7 дней; мы переписываем с server-side с 90-дневным TTL (first-party domain bypass'ит ITP). `fbc` cookie несет `fbclid` query param из Facebook ad — server-side парсим этот ID и добавляем в CAPI `fbc` field, что расширяет Meta attribution с 24 часов на 28 дней.

Google `gclid` (Google Click ID) механизм аналогичен. Client-side GTM читает `gclid` из URL и записывает в `_gcl_aw` cookie (90 дней TTL). Server-side читаешь этот cookie и добавляешь `gclid` параметр в Ads Conversion tag. Server-side Conversion Tracking API Google'а использует `gclid` + `conversion_action_id` как unique key — если отправишь 2 conversion с одним `gclid`, платформа дедуплицирует. Наш setup: если `gclid` cookie отсутствует (direct traffic), fallback на `_ga` client ID, который маппируем в `gbraid` параметр — это связывает Google Analytics attribution с Ads.

## Compliance и Consent Orchestration

Server-side tagging без интеграции Consent Mode v2 = GDPR risk. Правило Google: при `ad_storage=denied` consent state sGTM не должен триггерить Google Ads Conversion tag или отправлять только anonymized сигналы (IP masking + drop user ID). Meta Limited Data Use (LDU