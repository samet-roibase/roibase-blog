---
title: "Multi-Agent Orchestration: От одного вызова LLM к системам"
description: "Agent SDK'и, tool use и параллельные/последовательные топологии — трансформация LLM в production-систему с анализом latency, стоимости и надежности."
publishedAt: 2026-05-23
modifiedAt: 2026-05-23
category: ai
i18nKey: ai-008-2026-05
tags: [multi-agent, llm-orchestration, tool-use, agent-sdk, ai-engineering]
readingTime: 8
author: Roibase
---

В 2024 году «AI-ассистент» означал один цикл prompt-response. В 2026-м production — это совсем другое: параллельные agent mesh'и, последовательные orchestration pipeline'ы, агенты, подключённые к внешним системам через tool use. Вместо единого LLM-вызова система агентов, обменивающихся сигналами — переписывает баланс reliability, cost и latency. Multi-agent orchestration — это архитектурный слой, превращающий LLM в компонент production infrastructure.

## Agent SDK'и и слой Tool Use

Agent framework'и — LangGraph, Autogen, CrewAI — дают LLM право «вызывать функции». Tool use — модель трансформирует собственный output в function call согласно JSON schema, а interpreter'ом выполняет функцию и возвращает результат обратно в prompt. OpenAI function calling, tool use API Claude от Anthropic, function declaration Gemini от Google — все построены на одном принципе: LLM не может выполнять детерминированный код, но может указать, какую функцию с какими параметрами вызвать.

SDK'и управляют этим циклом: приходит query пользователя, модель говорит «обратись к weather API с параметром city=Istanbul», orchestrator вызывает API, возвращает результат в prompt, модель создаёт final output. Это 3 раунда = 3× latency. В production цепь tool call'ов растёт до 5–7 шагов, каждый добавляет 200–800ms — итого 1–5 секунд response time. В multi-agent цель — разбить эту latency параллелизацией и кешированием.

Пример определения tool'а:

```python
tools = [
    {
        "name": "query_analytics",
        "description": "Получить метрику из BigQuery",
        "parameters": {
            "metric": "string (revenue|sessions|conversions)",
            "date_range": "string (7d|30d|90d)"
        }
    }
]
```

Если модель решает использовать tool, orchestrator вызывает BigQuery client, результат append'ит в prompt, модель выполняет финальный синтез. Сила tool use: LLM получает доступ во внешний мир, не жертвуя детерминизмом.

## Параллельные и последовательные топологии агентов

Один агент = последовательная обработка. Multi-agent = гибрид параллели и последовательности. Два основных паттерна: **scatter-gather** и **pipeline**.

**Scatter-gather:** главный orchestrator разбивает задачу на 3 подагента, каждый одновременно работает с разным tool'ом, результаты сходятся в центральном агенте. Пример: «Проанализируй производительность кампании за прошлый месяц» → agent_1 к Google Ads API, agent_2 к Meta Ads API, agent_3 к BigQuery, все параллельно. Orchestrator получает 3 ответа, синтезирует, выдаёт финальный отчёт. Latency: max(agent_1, agent_2, agent_3) + synthesis latency. Если бы было последовательно: agent_1 + agent_2 + agent_3 + synthesis. Вместо 3×800ms получаем 800ms + 300ms = 1.1s.

**Pipeline:** output агента A становится input'ом агента B. Пример: (1) query planner агент пишет SQL → (2) execution агент выполняет SQL → (3) visualization агент создаёт spec графика. Каждый шаг — dependency следующего. Latency последовательная, но **каждый агент специализирован** — query planner это маленькая модель (GPT-4o-mini, 50ms), не требует execution logic, visualization агент может быть Gemini Flash. Вместо одной большой модели 3 маленькие = дешевле + быстрее (в ряде случаев).

В сервисах Roibase [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/ru/firstparty) multi-agent orchestration'ы используются в attribution pipeline'ах: один агент парсит raw event, один привязывает к session, один мэпит revenue, финальный считает cross-channel attribution. Pipeline topology = детерминированные шаги, каждый со своим набором tool'ов.

### Параллель vs последовательность: tradeoff

| Топология | Latency | Cost | Использование |
|-----------|---------|------|----------------|
| Параллель (scatter-gather) | Низкая (макс операция) | Высокая (N агент × LLM call) | Независимые запросы (pull данных из разных источников) |
| Последовательность (pipeline) | Высокая (сумма операций) | Средняя (каждый агент может быть маленькой моделью) | Зависимые операции (parse → enrich → analyze) |
| Гибрид (параллель → merge → последовательность) | Средняя | Средняя-Высокая | Сложные задачи (параллель сбор данных, pipeline синтез) |

В production параллель scatter-gather защищена от rate limit с помощью concurrency limit (например: max 5 одновременных LLM call'ов). В pipeline кешируют intermediate результаты — если output агента A валиден 10 минут, тот же query заставит агента B начать с cached output вместо нуля.

## Ответственность Orchestrator'а: routing и error handling

Orchestrator не просто триггерит агентов, а **решает, кому какую задачу дать**. В LangGraph это называется «supervisor agent»: categorize query и выполняет routing. Логика:

```python
def route_query(user_query: str) -> str:
    # LLM-based router (маленькая модель, быстро)
    classification = llm.classify(user_query, categories=["data_query", "content_gen", "code_review"])
    
    if classification == "data_query":
        return "analytics_agent"
    elif classification == "content_gen":
        return "writer_agent"
    else:
        return "code_agent"
```

Router агент обычно GPT-4o-mini или Claude Haiku — быстрые, дешёвые модели. Добавляют 50–100ms overhead, но предотвращают ненужное использование больших моделей. Если пользователь говорит «суммируй производительность кампании» — идёт к analytics_agent (BigQuery tool use), если «напиши блог» — к writer_agent (web search + writing LLM).

**Error handling в multi-agent критичен.** Если один агент hallucinate'ит и выдаёт неправильный output, агент_2 работает с этой ошибкой и cascade failure распространяется. Orchestrator должен валидировать output каждого агента:

```python
def validate_agent_output(output: dict, schema: dict) -> bool:
    # JSON schema validation
    if not matches_schema(output, schema):
        raise AgentOutputError("Output агента не соответствует schema")
    
    # Семантическая проверка (опционально, дорого)
    if confidence_score(output) < 0.7:
        return False  # retry или fallback
    
    return True
```

Если агент_1 неудачен, orchestrator идёт по fallback chain: сначала retry (1×), потом альтернативный агент (более крупная модель), потом human-in-the-loop. Без этой логики multi-agent ненадёжен.

## Latency и Cost: benchmark'и

Сценарий: «Проанализируй тренд дохода за 30 дней, суммируй производительность кампании, подготовь summary email для CEO» — 3 независимых задачи.

**Один агент (GPT-4, последовательно):**
- Query BigQuery → 800ms (LLM + API)
- Query ad platform'ы → 900ms
- Generate email → 600ms
- **Итого:** 2300ms
- **Cost:** 3 turn × $0.03/1K token = ~$0.09 (среднее mix input/output)

**Multi-agent (scatter-gather + pipeline):**
- Agent_1, 2, 3 параллельно (BigQuery, ads, email prep) → max 900ms
- Orchestrator merge + synthesis → 400ms
- **Итого:** 1300ms
- **Cost:** 3 агента × $0.02 (маленькие модели) + synthesis $0.03 = ~$0.09 (то же, но оптимизацией моделей снижается)

**Выигрыш:** 43% снижение latency. Cost тот же, но оптимизацией моделей (agent_1 → Gemini Flash, agent_2 → Claude Haiku, orchestrator → GPT-4o-mini) падает до $0.05.

**Но:** параллельные агенты = параллельное потребление rate limit. Если OpenAI tier limit 500 RPM, то 10 параллельных агентов = 50 пользователей за 5 минут. Один агент = 500 пользователей. В production этот tradeoff'ы управляются queue + кеш.

## Observability и debug

В multi-agent системе ответ на вопрос «где произошла ошибка?» сложен. Инструменты типа LangSmith, Helicone, Arize Phoenix визуализируют agent trace: какой агент когда какой tool вызвал, с каким prompt, что вернул, где был retry. Пример trace:

```
orchestrator → classify_query (50ms, GPT-4o-mini) → "data_query"
→ analytics_agent → query_bigquery (800ms, tool_call) → success
→ writer_agent → generate_summary (600ms, GPT-4) → success
→ orchestrator → merge_results (200ms) → final_output
```

На каждом шаге логируется token count, latency, cost. Без этой телеметрии multi-agent невозможно debug'ить. Если tool call агента A timeout'ится, видно в trace, добавляешь retry logic.

Ещё один метрик: **agent utilization**. Если определили 5 агентов, но 80% user query'й идёт к одному агенту, то routing logic неправильный. Измеряют accuracy классификации router агента — с user feedback создают labelled dataset и fine-tune'ят router (вместо few-shot prompt'а lightweight classifier).

## Ограничения Multi-Agent

Multi-agent не решает все проблемы. **Coordination overhead** существует: обмен сообщениями между агентами, orchestration logic, error handling — всё добавляет latency. Простой query, завершаемый одним агентом за 1 секунду, может занять 1.5 секунды в multi-agent системе (orchestrator + routing + merge). Архитектурная сложность растёт — кодовая база больше, тестирование сложнее, deployment более деликатный.

Multi-agent имеет смысл когда:
- **Нужен параллельный pull данных:** если 5 разных API'й — scatter-gather даёт выигрыш
- **Оптимальны специализированные модели:** маленькая для query planning, большая для code generation, pipeline topology снижает cost
- **Long-running task:** агент_1 инициирует, агент_2 async мониторит, агент_3 завершает, orchestrator уведомляет — event-driven вместо sync LLM call

На коротких, частых, простых query'йх один агент + кеш лучше. Multi-agent создаёт value при decompose сложной задачи и её оптимизации.

---

Multi-agent orchestration трансформирует LLM из stateless function call в stateful, observable, scalable систему. Параллельная топология разбивает latency, pipeline снижает cost, orchestrator обеспечивает reliability. В production начни со scatter-gather, мониторь rate limit и cost, переходи на pipeline если нужно. Логируй agent trace, наслаивай error handling, тестируй routing logic. Multi-agent — это переход от LLM engineering к LLM infrastructure.