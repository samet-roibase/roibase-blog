---
title: "Shopify Hydrogen vs Liquid: На какие цифры мы опирались при выборе"
description: "TTFB 840ms → 180ms, время сборки 12м → 90с. Цифры за переходом на Hydrogen, компромиссы и расчет стоимости миграции."
publishedAt: 2026-05-09
modifiedAt: 2026-05-09
category: tech
i18nKey: tech-002-2026-05
tags: [shopify-hydrogen, headless-commerce, web-performance, remix, ttfb]
readingTime: 8
author: Roibase
---

Семь лет мы использовали Liquid-темы Shopify. Когда лимиты на кастомизацию темы, фиксированное время ответа сервера и монолитный цикл развёртывания начали нас тормозить, на стол легло слово «headless». Но решение блокировал один вопрос: как измерить ROI перехода на Hydrogen? Эта статья — числовые детали нашего ответа. TTFB, время сборки, скорость разработки, стоимость миграции. Мы выбрали Hydrogen не потому, что это framework, а потому, что это дало измеримый прирост производительности.

## Потолок производительности Liquid

Liquid-движок тем Shopify возвращает отрендеренный на сервере HTML. На стороне сервера синтаксис Liquid парсится, делаются вызовы Storefront API, HTML собирается и отправляется клиенту. Такая архитектура проста и стабильна — но у неё есть потолок.

На нашем Production-магазине медианный TTFB был 840ms (RUM-данные, Cloudflare Analytics). 95-й процентиль доходил до 1,4 секунды. Мы не можем контролировать время ответа сервера Shopify — это shared infrastructure. Даже если оптимизировать Liquid-шаблоны (ленивая загрузка неиспользуемых секций, сокращение snippet'ов), задержка со стороны сервера остаётся фиксированной.

Время сборки — отдельная проблема. Когда вы меняете файл темы, вы пушите изменения через Shopify CLI. Среднее время развёртывания — 12 минут. В CI/CD pipeline это означает ожидание между этапом staging и production. Скорость итераций A/B-тестов падает. Velocity разработчиков ограничена.

```bash
# Liquid theme deploy (average)
shopify theme push --store=production
⏱ Upload: 4m 20s
⏱ Processing: 7m 40s
✅ Total: 12m 00s
```

Компромисс Liquid таков: простота развёртывания, ноль управления инфраструктурой — но нет контроля над производительностью, итерация медленная.

## Техническое обещание Hydrogen

Hydrogen — это headless framework Shopify, построенный на Remix. React Server Components, потоковый SSR, развёртывание на edge. Архитектурное отличие в следующем: в Liquid сервер Shopify рендерит HTML. В Hydrogen ты развёртываешь собственный edge-сервер (Oxygen, Cloudflare, Vercel). Ты напрямую вызываешь Storefront API, потоком отправляешь ответ в дерево компонентов.

Обещание TTFB: поскольку ты рендеришь с edge-ноды, latency-сервера Shopify исчезает. При развёртывании на Cloudflare Workers медианный TTFB падает в диапазон 100–200ms (latency POP Cloudflare'а + RTT Storefront API). Обещание времени сборки: сборка на Vite, incremental deploy, под 2 минуты.

Но кроме обещаний есть стоимость: effort миграции, learning curve разработчиков, ответственность за инфраструктуру. Мы шли дальше, численно моделируя эти компромиссы.

### Методология бенчмарка

Мы развернули две среды:
1. **Liquid Baseline:** Production-магазин, fork темы Dawn, 80+ секций, proxy Cloudflare (cache bypass)
2. **Hydrogen Prototype:** то же дерево компонентов homepage, развёртывание на Cloudflare Workers, Storefront API версия 2024-01

Setup тестирования:
- WebPageTest (локация Dulles, Moto G4, 3G Fast)
- медианные значения из 3 прогонов
- холодный state кеша (flush кеша перед каждым тестом)

Метрики:
- TTFB (Time to First Byte)
- LCP (Largest Contentful Paint)
- TBT (Total Blocking Time)
- время сборки (измерено в CI/CD)

## Сравнение производительности

Результаты (медиана из 3 прогонов):

| Метрика | Liquid | Hydrogen | Разница |
|---|---|---|---|
| **TTFB** | 840ms | 180ms | **−79%** |
| **LCP** | 2.4s | 1.1s | **−54%** |
| **TBT** | 680ms | 220ms | **−68%** |
| **Время сборки** | 12m 00s | 1m 30s | **−88%** |

Снижение TTFB совпало с ожиданиями. На Hydrogen edge-нода Cloudflare Workers достигает Storefront API с RTT 40–60ms (CDN Shopify уже на Cloudflare). На Liquid сервер Shopify делает парсинг Liquid + вызов API + сборку HTML — минимум 600ms overhead.

Прирост LCP идёт из потокового SSR. Hydrogen отправляет первый байт рано и потоком передаёт HTML. Critical content (герой-изображение, ATF-сетка товаров) рендерится в первую очередь, below-the-fold ленивой загрузкой. На Liquid рендер блокирующий — страница не отправляется, пока вся не готова.

Снижение TBT происходит от размера bundle'а + оптимизации гидрации. На Hydrogen мы использовали React Server Components — client-side JS bundle 120KB (gzip). На Liquid-теме jQuery + custom скрипты это 340KB. Время гидрации упало.

Разница во времени сборки прямо влияет на velocity разработки. 90 секунд вместо 12 минут — если вы делаете 10 развёртываний в день, это 115 минут экономии. CI/CD pipeline ускоряется, cycle A/B-тестирования сокращается.

```typescript
// Пример потокового SSR на Hydrogen (Remix loader)
export async function loader({ context }: LoaderFunctionArgs) {
  const { storefront } = context;
  
  const productsPromise = storefront.query(PRODUCTS_QUERY);
  const collectionsPromise = storefront.query(COLLECTIONS_QUERY);
  
  // Stream: первый ответ возвращается сразу
  return defer({
    products: productsPromise,
    collections: collectionsPromise,
  });
}
```

API `defer` потоком передаёт promise'ы. Клиент получает первый HTML, и по мере готовности данных страница прогрессивно рендерится. TTFB остаётся низким.

## Расчет стоимости миграции

Прирост производительности очевиден — но какова цена перехода? Мы сделали такую разбивку:

**Effort разработки:**
- миграция компонентов темы → Hydrogen: 160 часов (2 senior-разработчика, 4 недели)
- интеграция Storefront API (переписывание GraphQL-запросов): 40 часов
- setup CI/CD pipeline (Cloudflare Workers): 16 часов
- QA + исправление edge case'ов: 24 часа
- **Итого:** 240 часов

**Стоимость инфраструктуры:**
- Cloudflare Workers: $5/мес (бесплатно до 100K запросов — у нас 80K/мес)
- Oxygen (edge-платформа Shopify): $20/мес начальный tier
- Мы выбрали Cloudflare — уже использовали Cloudflare proxy

**Overhead обслуживания:**
- версия Hydrogen должна обновляться каждые 6 месяцев (отслеживание Remix upstream)
- learning curve разработчиков: требуется опыт React + Remix в команде
- на Liquid мы использовали шаблон Shopify Theme Store — на Hydrogen пользовательская разработка

Полная one-time стоимость миграции: **240 часов × $80/час = $19,200**. Инфраструктура в год: **$60**.

Как мы моделировали прирыль? Два направления:

1. **Влияние на Conversion Rate:** известна корреляция Web Vitals с conversion rate (исследование Google/Deloitte: снижение LCP на 0.1s = подъём конверсии на 1–2%). У нас LCP упал на 1.3s — консервативный estimate 1.5% подъёма. На месячной выручке $200K это = $3K/мес. Годово **$36K**.

2. **Velocity разработки:** время сборки упало на 88%. Команда делает 40 развёртываний в месяц (CI/CD). Каждое развёртывание экономит 10.5 минут = в месяц 420 минут = 7 часов. По ставке senior-разработчика $80/час экономия $560/мес. Годово **$6.7K**.

Период окупаемости: $19,200 / ($36K + $6.7K) = **5.4 месяца**.

Этот расчет justify'л миграцию. Прирост производительности + рост velocity разработки окупают затраты миграции за 6 месяцев.

## Компромиссы и границы

Hydrogen — не правильный выбор для каждого магазина. В этих сценариях Liquid лучше:

**Liquid должен остаться:**
- трафик низкий (<10K/мес visitor) — разница TTFB не влияет на конверсию
- команда не знает React/TypeScript — learning curve удваивает стоимость миграции
- шаблона Theme Store достаточно — кастомизация не требуется
- инфраструктуру управлять не хочешь — shared Shopify-сервер проще

**Пора на Hydrogen:**
- трафик высокий (>50K/мес) — каждые 100ms TTFB влияют на конверсию
- требуется пользовательский UI/UX — архитектура [Headless Commerce](https://www.roibase.com.tr/ru/headless) даёт гибкость
- скорость A/B-итераций критична — CI/CD pipeline должен быть под 2 минуты
- dev-команда работает с современным frontend-стеком (React/Remix)

Ещё cost обслуживания Hydrogen. Remix выпускает major-версию каждые 6 месяцев. Hydrogen это отслеживает. На Liquid Shopify гарантирует backward compatibility — старая тема через 5 лет всё работает. На Hydrogen нужна дисциплина обновления зависимостей.

Edge-развёртывание тоже даёт ограничения. Cloudflare Workers runtime имеет лимиты (CPU time 50ms, память 128MB). Сложная backend-логика (например, рекомендательный движок) на edge не работает — надо offload'ить на origin server. На Liquid этой проблемы нет, сервер безлимитен.

## Итак, теперь что

Мы выбрали Hydrogen — потому что TTFB упал на 79%, время сборки сократилось на 88%, период окупаемости 5.4 месяца. Но решение принимали на основе модели затрат миграции, перечня компромиссов.

Если ты тоже думаешь о переходе на Hydrogen, ответь сначала на эти вопросы: какой у тебя месячный visitor count? Команда знает React? Нужна пользовательская UI/UX? Есть CI/CD pipeline? Если везде «да» — делай числовую модель. Переводи разницу TTFB в лифт конверсии, velocity разработки в часы. Если эти цифры justify'т стоимость миграции — вперёд.

Если оцениваешь headless-переход, в рамках [Shopify Partner Services](https://www.roibase.com.tr/ru/shopify) мы можем выстроить Hydrogen migration roadmap — benchmark, cost model, incremental rollout plan включены.