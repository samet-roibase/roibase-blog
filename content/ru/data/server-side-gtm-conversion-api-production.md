---
title: "Server-Side GTM и Conversion API: от нуля до production"
description: "Cloud Run deployment, container template, event deduplication — как мы построили server-side измерение в production, какие ловушки встретили."
publishedAt: 2026-05-24
modifiedAt: 2026-05-24
category: verianalizi
i18nKey: data-001-2026-05
tags: [server-side-gtm, conversion-api, cloud-run, first-party-data, event-deduplication]
readingTime: 9
author: Roibase
---

Cookie deprecation, Consent Mode v2, iOS ATT — надёжность client-side measurement сужается каждый год. В 2024 году Meta пришлось работать с %23 меньшим количеством client-side событий, в Google Analytics 4 количество сессий упало на %18. Server-side measurement теперь не "будущее", а "необходимость". С конца 2025 года в Roibase все новые клиенты запускаются на полностью server-side GTM + Conversion API stack. В этой статье рассказываем, что мы узнали при миграции в production, почему принимали те или иные решения и какие компоненты обязательны в этом стеке.

## Где развёртывать sGTM контейнер

Google Tag Manager Server Container можно развёртывать на App Engine, Cloud Run, собственном Docker или третьих сервисах. В 2026 году выделяются два: Cloud Run и Cloudflare Workers. App Engine считается legacy — нет автоматического масштабирования, холодный старт 8+ секунд. Workers дешевле, но интеграция с экосистемой GTM требует дополнительных middleware.

Мы выбрали Cloud Run: официальный container image GTM работает сразу, горизонтальное масштабирование автоматическое, холодный старт меньше 2 секунд. Расчёт цены критичен: 1M запросов/месяц + 512MB RAM инстанс × 3 зоны = ~$35/месяц. На Cloudflare Workers это $5/месяц, но инструменты отладки слабые, интеграция пользовательских переменных требует ручной работы.

Команда deploy:

```bash
gcloud run deploy sgtm-prod \
  --image=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable \
  --platform=managed \
  --region=europe-west1 \
  --memory=512Mi \
  --min-instances=1 \
  --max-instances=10 \
  --allow-unauthenticated \
  --set-env-vars="CONTAINER_CONFIG=$(cat container.json | base64)"
```

`min-instances=1` критичен — в e-commerce раскрутка инстанса с нуля может привести к потере конверсии. Расходы +$8/месяц, но гарантирует %100 uptime. `container.json` — это конфигурация контейнера, экспортированная из веб-интерфейса GTM; можно привязать к CI/CD вместо ручной синхронизации.

Структура поддомена: `sgtm.example.com` → IP Cloud Run. Load Balancer не используем, глобальный anycast IP Cloud Run достаточен. SSL автоматический, managed certificate готов за 3 минуты.

## Дедупликация событий: два сигнала — одна конверсия

Самая большая ловушка server-side measurement: одна конверсия приходит и из браузера, и с сервера, платформа считает дважды. В Meta Conversion API параметр `event_id` решает эту проблему — если клиент и сервер отправляют один ID, Meta очищает дубликаты в 28-часовом окне.

Пример потока: пользователь завершил заказ, браузер GTM запустил `purchase` событие → Meta Pixel. Одновременно фронтенд отправляет POST на наш `/api/track` → sGTM → Meta Conversion API. Оба сигнала несут `event_id: order_12345_ts1716547200`.

```javascript
// Client-side GTM Variable: event_id
function() {
  var orderId = {{Order ID}};
  var timestamp = Math.floor(Date.now() / 1000);
  return orderId + '_ts' + timestamp;
}
```

На server-side GTM мы маппируем тот же `event_id` в тег Meta Conversion API. Важно: компонент timestamp не обязателен, но предотвращает коллизии unique — один order_id может использоваться повторно в разных сессиях.

С Google Ads ситуация иная: параметра `gclid` достаточно, отдельного ID дедупликации не требуется. Но в Google Analytics 4, если вы отправляете комбинацию `client_id` + `session_id` и с клиента, и с сервера, GA4 автоматически удаляет дубликаты — функция добавлена в Q3 2024.

Валидация дедупа: в Meta Events Manager сколько "Event Match Quality" — должно быть выше %80. Если ниже — чаще всего не хватает хешей `em` (email), `ph` (телефон), `fn` (имя) — server событие считается "low confidence" и дедупликация ненадёжна.

## Container template: какие теги должны быть по умолчанию

GTM Server Container стартует пустой, каждый тег добавляется вручную. После 15+ развёртываний мы создали template репо — новый клиент готов к production за 5 минут.

**Обязательные теги:**
- **Meta Conversion API** (через Meta Business Extension)
- **Google Analytics 4** (server-side клиент)
- **Google Ads Conversion** (с Enhanced Conversion)
- **Snapchat Conversion API** (для gaming/fashion клиентов)
- **TikTok Events API** (при таргетировании Gen Z)

**Опциональные, но рекомендуемые:**
- **Firestore/BigQuery writer** — логируй каждое событие raw, критично для audit trail + attribution modeling
- **Consent check variable** — парсь TCF 2.2 строку, проверяй purpose 1 (storage) и purpose 2 (measurement), при отказе отправляй Meta/Google `action_source=physical_store` (это не байпас, aggregate signal)
- **User IP enrichment** — забирай `X-Forwarded-For` из Cloud Run request header, точность геолокации Conversion API увеличивается на %12

Структура template репо:

```
sgtm-template/
├── clients/
│   └── ga4-client.json
├── tags/
│   ├── meta-capi.json
│   ├── google-ads.json
│   └── bigquery-log.json
├── variables/
│   ├── event-id.json
│   ├── user-data.json
│   └── consent-status.json
└── triggers/
    ├── all-events.json
    └── conversion-only.json
```

Каждый JSON экспортируется из веб-UI GTM — прямой импорт через `gcloud` CLI не работает, но можно автоматизировать через скрипт в CI/CD. Есть Terraform провайдер для GTM, но он community-maintained, не официальный.

### Переменная User Data: отправка без хеширования

Meta и Google требуют хеширования PII: email → SHA256, телефон → E.164 формат + SHA256. В client-side GTM хеширование идёт на JavaScript, но в sGTM безопаснее на сервере — в devtools браузера не видно plain text.

```javascript
// sGTM Custom Variable: hashed_email
const crypto = require('crypto');
const getEventData = require('getEventData');

const email = getEventData('user_data.email_address');
if (!email) return undefined;

return crypto.createHash('sha256')
  .update(email.toLowerCase().trim())
  .digest('hex');
```

Для телефона формат E.164: `+905321234567` (код страны + номер без нуля). В проектах Roibase %40 телефонных данных отклоняется из-за ошибок формата — нужна валидация.

## Conversion API и Enhanced Conversion: в чём разница

Meta Conversion API и Google Enhanced Conversion решают одну задачу разными протоколами: увеличить match rate first-party данными. Conversion API event-based — каждый клик, добавление в корзину, покупка это отдельный HTTP POST. Enhanced Conversion tag-based — user data отправляется только на конверсию (покупка, регистрация).

Конфиг Google Enhanced Conversion для sGTM:

```json
{
  "type": "google_ads_remarketing",
  "enhancedConversionData": {
    "email": "{{Hashed Email}}",
    "phone": "{{Hashed Phone}}",
    "address": {
      "first_name": "{{Hashed First Name}}",
      "last_name": "{{Hashed Last Name}}",
      "country": "TR",
      "postal_code": "{{Postal Code}}"
    }
  }
}
```

В Meta `user_data` объект отправляется для каждого события — `ViewContent`, `AddToCart`, `Purchase` все с одними и теми же хешами.

Практическое различие: Google Enhanced Conversion активен только на conversion pixel — при низком трафику match rate остаётся низким. Meta CAPI получает user data для каждого события, retargeting audience становится богаче. Поэтому в e-commerce приоритет на Meta CAPI, Google EC второстепенен.

## Мониторинг и debug: какие метрики следить

Server-side stack в production нуждается в мониторинге. В client-side GTM есть preview mode — в server-side нет, отладка идёт на живом трафике.

**Критичные метрики:**
- **Cloud Run instance count** — даже при min=1, при spike тrafика может вырасти до 10, нужен alarm для контроля стоимости
- **Response time P95** — выше 500ms начинаются потери конверсий, особенно на checkout странице
- **Meta Event Match Quality сколько** (проверяй вручную в Events Manager) — ниже %80 значит не хватает user data
- **GA4 server event count / client event count ratio** — идеально 1.1-1.3 (сервер видит больше из-за блокировщиков), ниже 0.8 значит проблема на сервере

Cloud Logging query:

```sql
resource.type="cloud_run_revision"
resource.labels.service_name="sgtm-prod"
jsonPayload.event_name="purchase"
severity="ERROR"
```

Error логи GTM не пишут через `console.log` — используй API `logToConsole()`, логи падают в Cloud Logging.

Схема BigQuery таблицы логирования:

| Поле | Тип | Описание |
|---|---|---|
| event_timestamp | TIMESTAMP | Время на сервере (UTC) |
| event_name | STRING | purchase, add_to_cart, etc. |
| user_id | STRING | Хеширован |
| client_id | STRING | GA4 client ID |
| event_id | STRING | Dedup ID |
| platform | STRING | meta, google_ads, snapchat |
| response_code | INTEGER | HTTP status |

Эта таблица в рамках [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/ru/firstparty) пишется в BigQuery data warehouse, связывается dbt'ом с downstream моделями (attribution, LTV prediction).

## Consent Mode v2 и Server-Side: как интегрировать

С марта 2024 года Google Consent Mode v2 обязателен в EEA — статус `ad_storage` и `analytics_storage` должен отправляться с каждым hit. На server-side эта информация не приходит от client-side GTM, вы отправляете вручную.

Два метода:
1. **Query parameter:** `sgtm.example.com/g/collect?consent=granted` — просто, но видно в URL, проблемы с cache
2. **HTTP header:** `X-Consent-Status: analytics_storage=granted,ad_storage=denied` — предпочтительно

Пользовательская переменная в sGTM:

```javascript
const getRequestHeader = require('getRequestHeader');
const consentHeader = getRequestHeader('x-consent-status');

if (!consentHeader) return {analytics_storage: 'denied', ad_storage: 'denied'};

const pairs = consentHeader.split(',');
const consent = {};
pairs.forEach(pair => {
  const [key, value] = pair.split('=');
  consent[key.trim()] = value.trim();
});

return consent;
```

Маппируешь эту переменную в теги GA4 и Google Ads. В Meta CAPI параметра consent нет — косвенно управляешь через `action_source`: `action_source=website` означает consent есть, `action_source=physical_store` означает aggregate mode (нет consent, но считается offline attributable).

## Что тестировать в первую неделю

При запуске обязателен параллельный запуск: client-side pixel'ы не отключаешь, server-side работает рядом. Две недели следи оба, потом отключи client-side.

**Чек-лист тестирования:**
- [ ] Количество событий в Meta Events Manager ±%10 к client-side версии
- [ ] В GA4 session count не упал (server-side должен видеть больше)
- [ ] В Google Ads количество конверсий изменилось (Enhanced Conversion даёт +%8-15)
- [ ] Стоимость Cloud Run не превышает $50/месяц (норма $30-40 для 1M event/месяц)
- [ ] Дедупликация работает — в Meta Test Events нет alerts про duplicate события
- [ ] Количество событий в BigQuery логе совпадает с frontend analytics

Проблемы в первую неделю (будут): ошибки формата user data hash (%30-40 событий), отсутствие consent header (%15-20), потеря первой конверсии из-за cold start Cloud Run (если min-instances=0). Поэтому новый стек не запускаешь на Black Friday — стабилизируй в обычный трафик.

## Production стек: что делать теперь

Server-side measurement в 2026 уже не "экспериментально", а "стандартно". Полагаться только на client-side pixel означает потерю %20-30 конверсий — особенно на iOS и у privacy-conscious пользователей. В клиентах Roibase после миграции на sGTM