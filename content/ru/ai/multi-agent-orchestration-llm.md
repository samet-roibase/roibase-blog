---
title: "Multi-Agent Orchestration: От одного вызова LLM к системам"
description: "От SDK агентов к параллельной/последовательной топологии: как строить production-grade системы мульти-агентов на LangGraph, CrewAI, AutoGen?"
publishedAt: 2026-07-20
modifiedAt: 2026-07-20
category: ai
i18nKey: ai-008-2026-07
tags: [multi-agent, llm-orchestration, langgraph, crewai, agent-topology]
readingTime: 8
author: Roibase
---

В 2023 году LLM'ы "научились вызывать инструменты". В 2024 году появилась концепция "агента". В 2025 году все создали своих агентов. В 2026 году вопрос изменился: одного агента недостаточно, но нужно ли запускать 5 агентов параллельно или последовательно? Кто какой инструмент должен использовать? Где должна жить координационная логика? Multi-agent orchestration — первая серьёзная инженерная проблема переходу от "Hello World" LLM-приложений к production системам.

## От одного агента к топологии: почему нужна оркестрация?

Один агент — например Claude Sonnet 3.5 с 5 инструментами — решает множество сценариев. Но когда возникают такие ситуации, система буксует:

**Необходимость параллельной работы:** Ты анализируешь маркетинговую кампанию. Нужно одновременно получить данные из Google Ads API, рассчитать исторические тренды в BigQuery и взять данные о конверсиях из Shopify. Один агент выполнит эти операции последовательно — всего 12 секунд. Три агента, работающие параллельно, справятся за 4.5 секунды. Если latency критична, оркестрация обязательна.

**Необходимость специализации:** Один агент пишет SQL, другой очищает данные, третий генерирует код визуализации. Каждый агент получает разные system prompt'ы, разные модели (Sonnet для SQL, Opus для кода), разный retrieval контекст. Если одному агенту сказать "знай и SQL и дизайн визуализации", контекстное окно раздуется, производительность упадёт.

**Слои безопасности:** Один агент очищает входящий prompt, другой исполняет бизнес-логику, третий валидирует output. Эта "конвейерная" структура критична в production: оркестрация снижает риск передачи некорректных параметров tool'у.

На проектах Roibase [Аналитика данных и инженерия инсайтов](https://www.roibase.com.tr/ru/verianalizi) мы сократили время выполнения запросов BigQuery на 60% с параллельной архитектурой агентов — потому что три разных источника данных можно опрашивать одновременно.

## Agent SDK'ы: LangGraph, CrewAI, AutoGen

**LangGraph (экосистема LangChain):** В структуре directed graph агенты определяются как узлы. Каждый узел хранит "state", рёбра определяют логику переходов. Возможна условная маршрутизация: если агент A говорит "данные неполные", перейди к агенту B, если "готово" — к C.

```python
from langgraph.graph import StateGraph

workflow = StateGraph(AgentState)
workflow.add_node("researcher", research_agent)
workflow.add_node("writer", writer_agent)
workflow.add_conditional_edges(
    "researcher",
    lambda state: "complete" if state.data_ready else "retry"
)
workflow.set_entry_point("researcher")
```

**Преимущества:** Мощное управление state. Distributed tracing просто — логи каждого узла отдельно. **Недостатки:** Синтаксис сложный, цепочки callback'ов усложняют отладку.

**CrewAI:** Оркестрация на основе ролей. Каждому агенту ты назначаешь "роль" (исследователь, аналитик, писатель), список "задач". Фреймворк автоматически запускает их последовательно или параллельно.

```python
from crewai import Crew, Agent, Task

researcher = Agent(role='Data Researcher', tools=[bigquery_tool])
analyst = Agent(role='Analyst', tools=[pandas_tool])

crew = Crew(agents=[researcher, analyst], process="sequential")
result = crew.kickoff()
```

**Преимущества:** Минимальный boilerplate, быстрое прототипирование. **Недостатки:** Ниже гибкость — для custom маршрутизации нужно менять код.

**AutoGen (Microsoft):** Conversational multi-agent. Агенты "разговаривают" друг с другом — один отправляет сообщение другому, тот отвечает. В этом pattern'е оркестрация implicit — поток сообщений определяет топологию.

```python
from autogen import AssistantAgent, UserProxyAgent

assistant = AssistantAgent("assistant", llm_config={...})
user_proxy = UserProxyAgent("user", code_execution_config={...})

user_proxy.initiate_chat(assistant, message="Analyze Q1 data")
```

**Преимущества:** Естественно в сценариях с человеком в цикле. **Недостатки:** Потоки недетерминированы — неясно, когда агент A ответит агенту B.

## Параллельная vs последовательная топология: матрица tradeoff'ов

| Архитектура | Latency | Стоимость | Сложность | Применение |
|-------------|---------|-----------|-----------|-----------|
| **Последовательная (Sequential)** | Высокая (N×t) | Низкая (один LLM за раз) | Низкая | Детерминированные pipeline'ы (данные → анализ → отчёт) |
| **Параллельная (Fork-Join)** | Низкая (max(t₁, t₂, t₃)) | Высокая (N агентов одновременно) | Средняя | Независимые задачи (опросить 3 API одновременно) |
| **Условная (DAG)** | Переменная | Средняя | Высокая | Динамические потоки (если данные отсутствуют → X, если готовы → Y) |
| **Conversational** | Неопределённая | Средняя | Высокая | Human-in-the-loop или переговоры |

**Production решение:** Если операция не в critical-path'е (например, offline отчётность), выбери последовательную топологию — отладка простая, затраты низкие. Если есть SLA на latency (например, real-time dashboard), применяй параллельный fork — но продумай retry логику заранее, иначе timeout одного агента потянет за собой остальных.

## Координация tool'ов: предотвращение конфликтов

В multi-agent системе самый частый баг: 2 агента вызывают одно tool'у одновременно с разными параметрами, один повреждает state другого.

**Пример:** Агент A создаёт `temp_table_x` в BigQuery, агент B одновременно пытается прочитать `temp_table_x` — таблицы нет, ошибка. Это "race condition" решается на уровне оркестрации:

**1. Resource locking:** Когда агент A начинает использовать tool, оркестратор блокирует его для других агентов. В LangGraph используется `shared_state`:

```python
if not state.lock_acquired("bigquery"):
    return {"status": "waiting"}
state.acquire_lock("bigquery")
result = bigquery_tool.run()
state.release_lock("bigquery")
```

**2. Namespace isolation:** Дай каждому агенту отдельное рабочее пространство. Агент A использует `workspace_a/temp_table`, агент B — `workspace_b/temp_table`. В CrewAI это делается через `agent_id` prefix.

**3. Idempotent tool design:** Проектируй tool'ы idempotent с самого начала — повторный вызов с теми же параметрами не вызывает конфликт. Например, используй `upsert` вместо `create` или `create_or_replace`.

## Observability: как отслеживать trace агентов?

В production'е работают 5 агентов, один ошибается — какой? Инструменты вроде LangSmith, Helicone, Arize собирают trace на уровне агентов, но manual instrumentation обязателен.

**Ключевые метрики:**
- **Agent latency per step:** Сколько времени занял каждый агент? В параллельном fork'е `max(latency)` показывает узкое место.
- **Tool call success rate:** Сколько раз каждый агент вызывал каждый tool, сколько успешно? Ниже 95% — red flag.
- **Retry count:** Сколько раз агент делал retry? Высокое число — либо prompt ошибочный, либо spec tool'а неправильный.
- **State transition diagram:** Для LangGraph — сколько раз был переход между каждой парой узлов? Отсюда видны бесконечные циклы.

```python
# Интеграция LangSmith
from langsmith import Client

client = Client()
with client.trace(run_name="multi_agent_pipeline") as run:
    for agent in agents:
        with run.create_child(name=agent.name):
            agent.run()
```

## Управление контекстным окном: shared memory vs isolated

В multi-agent'е самый критичный ресурс — контекстное окно. Если агентов 5, они делят один 128K токен или каждый получает свой 128K?

**Shared memory (LangGraph по умолчанию):** Все агенты читают/пишут в один объект state. Плюс: находки агента A автоматически доступны агенту B. Минус: загрязнение контекста — данные, которые агенту C не нужны, раздувают окно.

**Isolated memory + message passing:** Каждый агент хранит своё state, передаёт другим только необходимые данные сообщениями. CrewAI использует этот pattern. Плюс: высокая эффективность токенов. Минус: нужна manual сериализация данных.

**Гибридный подход (рекомендуется):** В shared state храни только метаданные (что сделал каждый агент, когда завершился), сами данные пиши на диск/БД, передавай агентам ссылку. Например, результат BigQuery запроса пиши в GCS, передавай агентам путь `gs://bucket/result.parquet`.

## Обработка ошибок: что происходит, когда агент падает?

В последовательной топологии, если агент 2 падает — pipeline останавливается, просто. В параллельной — агенты A и C продолжают работу, даже если B упал — но в итоге генерируется отчёт с неполными данными. На уровне оркестрации нужна логика "partial success".

**Стратегии:**

1. **Fail-fast (для последовательной):** Первая ошибка останавливает весь pipeline. Выбирай, если latency неважна.
2. **Best-effort (для параллельной):** Запусти максимум агентов, генерируй output даже с неполными данными — но отметь "incomplete" в метаданных.
3. **Retry with fallback:** Агент A попробовал 3 раза и не получилось — спроси агента A_backup (другая модель или другой prompt).

```python
# Retry в LangGraph
workflow.add_node("agent_a", agent_a, retry_policy={"max_attempts": 3})
workflow.add_edge("agent_a", "agent_a_backup", condition="failed")
```

## Production checklist: перед запуском multi-agent системы

- **Рассчитай бюджет токенов:** 5 агентов × 10K токен input × 2K output × цена API = стоимость за run. 1000 запусков в день = что получится в конце месяца?
- **Определи SLA latency:** Какой max latency для каждого агента приемлем? Если P95 > 10 секунд, нужна параллельная топология.
- **План rollback'а:** Изменение prompt'а одного агента может сломать весь pipeline. Версионирование + canary deployment обязательны.
- **Human-in-the-loop точки:** На критичных решениях (например, корректировка бюджета) покажи output последнего агента человеку, получи approval.
- **Audit log:** Каждый шаг каждого агента — какой tool вызвали, с какими параметрами, что вернулось — пиши в S3 JSON. Нужна для compliance.

Multi-agent orchestration — это "системный курс" LLM engineering'а. То, что начиналось с одного вызова модели, в production требует топологии, управления state'ом, retry логики, observability. LangGraph, CrewAI, AutoGen — это скелеты. Реальная работа — выбрать, как упорядочить и параллелизировать агентов под твой use case. Теперь возьми прототип, измерь latency, запусти cost simulation, потом выбери топологию. Не запускай в production без тестирования — в multi-agent системах между "работает" и "production-ready" лежит 10 слоёв архитектуры.