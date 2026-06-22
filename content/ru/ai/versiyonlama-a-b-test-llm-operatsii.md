---
title: "Версионирование Prompt'а и A/B-тестирование: Дисциплина LLM-операций"
description: "С помощью Promptfoo, LangSmith и evaluation pipeline'ов сделайте изменения prompt'ов измеримыми. Как настроить версионирование и A/B-тестирование в production LLM-операциях?"
publishedAt: 2026-06-22
modifiedAt: 2026-06-22
category: ai
i18nKey: ai-004-2026-06
tags: [prompt-engineering, llm-ops, evaluation, ab-testing, promptfoo]
readingTime: 8
author: Roibase
---

Запуск LLM в production — это уже не просто несколько вызовов API. Когда вы меняете prompt, качество output может упасть на 15% или вырасти на 22% — но если вы этого не замечаете, развёртывание превращается в лотерею. Версионирование prompt'ов и A/B-тестирование переносят дисциплину развёртывания ПО в LLM-операции. В этой статье рассказываем, как использовать evaluation framework'и вроде Promptfoo и LangSmith, чтобы сделать изменения prompt'ов измеримыми.

## Изменение prompt'а — это не развёртывание

В классическом software engineering'е при изменении функции в ход идут unit-тесты, integration-тесты и canary-развёртывание. В LLM-операциях же большинство команд меняют prompt в обычном текстовом файле, проводят несколько ручных проверок и выкатывают в production. Результат: user sentiment падает на 8%, но никто не видит связи.

Проблема в том, что LLM-output недетерминирован. На один и тот же prompt вы получите разные ответы, что делает тестирование на одном примере бесполезным. Без системы версионирования вы не можете ответить на вопрос "какой prompt был лучше — старый или новый?". Даже коммит в Git недостаточен — семантическую разницу нельзя вытащить из сообщения коммита.

Решение: каждое изменение prompt'а записывайте как версию, запускайте eval set до и после изменения, сравнивайте метрики. Такая дисциплина даёт два преимущества: detection regression'ов (не сломал ли новый prompt старые задачи) и measurement улучшений (действительно ли целевая метрика выросла).

## Как устроена evaluation pipeline

Evaluation pipeline состоит из трёх компонентов: eval set, eval метрика, runner. Eval set — это список input'ов, которые пойдут в LLM, и ожидаемых output'ов (или свойств output'ов). В JSON это выглядит так:

```json
[
  {
    "input": "Суммаризируй тренд revenue за Q1 2025",
    "expected_topics": ["revenue", "growth", "quarter"],
    "expected_sentiment": "neutral"
  },
  {
    "input": "Объясни, почему выросла churn rate",
    "expected_topics": ["churn", "retention"],
    "expected_sentiment": "analytical"
  }
]
```

Eval set можно создать вручную (sampling из production логов) или синтетически (попросить другую LLM "сгенерируй 50 вариаций запросов для этого prompt'а"). Главное — чтобы set покрывал edge case'ы: длинные input'ы, неоднозначные вопросы, мультиязычность.

Eval метрика определяет, как оценивать output LLM. Два основных типа: rule-based (проверка наличия определённых слов в output'е) и LLM-as-judge (попросить другую LLM оценить ответ по шкале 1–5). LLM-as-judge гибче, но дороже и медленнее. Для баланса скорости и точности часто используют комбинацию: rule-based + лёгкий classifier (например, BERT для sentiment).

Runner берёт eval set, запускает старый и новый prompt на каждом input'е, сравнивает output'ы метриками и выдаёт diff-таблицу. Promptfoo это делает командой `promptfoo eval`:

```bash
promptfoo eval \
  --prompts prompts/v1.txt prompts/v2.txt \
  --providers openai:gpt-4 \
  --tests evals/summarization.json \
  --output results.json
```

В результате для каждого test case видно, какой prompt показал лучше. Если новый prompt улучшил метрику на 80% test case'ов — готов к развёртыванию. Иначе есть regression, нужно доработать prompt.

## A/B-тестирование: параллельный запуск двух prompt'ов в production

Evaluation pipeline даёт offline результаты — нет данных реальных пользователей. Чтобы измерить, какой prompt работает лучше на живых пользователях, нужно A/B-тестирование: параллельно запускать оба prompt'а и смотреть, какой даёт лучший результат. Для этого нужна инфраструктура traffic splitting и сбора метрик.

Traffic splitting просто: входящий request'ом берёте `user_id` или `session_id`, хешируете, берёте модуль. Например, если `hash(user_id) % 100 < 50` — prompt A, иначе — B. Так делаете 50/50 split. Важный момент: один и тот же пользователь должен видеть один и тот же prompt в каждом request'е (sticky assignment) — иначе пользовательский опыт будет непредсказуем.

Для сбора метрик к LLM-ответу добавляется метаинформация: `prompt_version`, `latency`, `token_count`. Эти данные поступают в data warehouse (BigQuery, Snowflake). Здесь включается [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/ru/verianalizi) pipeline'а Roibase — вы объединяете LLM-логи с другими event'ами (действия пользователя, conversion, churn) и измеряете downstream эффект prompt'а.

Какие метрики отслеживать в A/B-тесте? Три категории:

| Тип метрики | Пример | Цель |
|---|---|---|
| Качество | LLM-as-judge score, hallucination rate | Высокая |
| Стоимость | Token count, API cost | Низкая |
| Downstream | Conversion rate, user engagement | Высокая |

Например, prompt B даёт LLM-as-judge score выше на 12%, чем prompt A, но требует на 35% больше токенов — есть trade-off. Если downstream conversion не отличается, prompt A эффективнее.

## LangSmith и observability

LangSmith — платформа LLM observability от команды LangChain. Помимо evaluation, она захватывает production trace'ы, визуализирует цепочки prompt'ов, показывает, где растёт latency. Особенно критично для multi-step LLM workflow'ов (RAG + summarization + JSON parsing) при отладке.

Отправить trace в LangSmith можно через SDK:

```python
from langsmith import Client
client = Client(api_key="...")

with client.trace(name="summarize_revenue"):
    result = llm.invoke(prompt)
    client.log_metric("token_count", result.usage.total_tokens)
```

Каждый trace видно в UI LangSmith, полностью залогированы input/output/метаданные. Если версий prompt'а несколько, можно открыть view для сравнения. В интерфейсе увидите такое: "prompt v2 производит на 8% длиннее output, чем v1, но latency на 3% ниже".

LangSmith предоставляет playground — меняете prompt и одной кнопкой тестируете на множестве input'ов. Это даёт быструю feedback-петлю и для прототипирования, и для regression-тестов. Но помните: playground — первый фильтр, он не заменяет production A/B-тест.

## Второй эффект версионирования prompt'ов: rollback

Когда развёртывание выходит из строя, нужен rollback. В LLM-операциях rollback — это возврат к предыдущей версии prompt'а. Чтобы это работало, нужна история версий.

Простой подход: хранить каждый prompt в отдельном файле git'а (`prompts/summarization_v3.txt`). Скрипт развёртывания хранит текущую версию в конфиг-файле:

```yaml
# config/production.yaml
prompts:
  summarization: v3
  classification: v2
```

Для rollback'а меняете `summarization: v2` и запускаете развёртывание. Но это ручной процесс, при инциденте медленно. Продвинутый подход: feature flag система (LaunchDarkly, Unleash). Флаг позволяет менять версию prompt'а в runtime, без переразвёртывания кода.

Здесь вступают в силу практики [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/ru/firstparty) Roibase — нужно связать изменение prompt'а с downstream event'ами (conversion, churn), чтобы решение о rollback'е было на числовой основе. Если через 6 часов после развёртывания нового prompt'а churn выросла на 4% — это сигнал откатить prompt.

## Edge case: версионирование prompt'ов в мультиязычной среде

Если ваше LLM-приложение работает на нескольких языках (TR, EN, DE), для каждого языка нужна своя версия prompt'а. Потому что prompt, хороший для английского, может не дать тот же тон на турецком.

Решение: организуйте prompt-файлы по языкам:

```
prompts/
  summarization/
    en_v3.txt
    tr_v3.txt
    de_v3.txt
```

Eval set тоже должен быть язык-специфичным — в турецких test case'ах ожидайте турецкий output. A/B-тест запускайте отдельно по языкам, потому что поведение пользователя турецкий ≠ английский. При агрегировании метрик не забывайте language segment.

Ещё один момент: в мультиязычном prompt'е длина контекста варьируется — турецкое предложение в среднем на 12% длиннее (в токенах). Это риск выхода за token limit. Добавьте в evaluation pipeline проверку token count и выдавайте warning при превышении threshold.

## На практике: установите первый eval set

Чтобы начать с описанной системы, первый шаг — minimal eval set из 20–30 реальных запросов пользователей. Откройте production логи, выберите самые частые запросы, для каждого определите ожидаемые свойства output'а (точность, тон, длину).

Потом установите Promptfoo или LangSmith, запустите текущий prompt'ом на этом set'е, получите baseline score. Теперь сделайте маленькое изменение prompt'а (например, добавьте "отвечай кратко и чётко"), запустите eval снова, сравните score'ы. Если regression меньше 5% — развёртывайте.

Когда цикл автоматизируется, скорость iteration по prompt'ам вырастает в 3 раза. Потому что теперь на вопрос "хорошо ли это изменение?" отвечаете не интуицией, а числами.