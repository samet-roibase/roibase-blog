---
title: "Multi-Agent Orchestration: От единого вызова LLM к системам"
description: "Agent SDK'и, tool use и параллельная/последовательная топология для доставки LLM приложений в production. Компромиссы по стоимости токенов, латентности и изоляции ошибок."
publishedAt: 2026-06-13
modifiedAt: 2026-06-13
category: ai
i18nKey: ai-008-2026-06
tags: [multi-agent, llm-orchestration, tool-use, agent-sdk, production-ai]
readingTime: 9
author: Roibase
---

Несколько месяцев назад одного LLM промпта было достаточно. Сейчас production системы требуют параллельную топологию агентов, структурированный вывод и цепочки fallback. Computer Use от Anthropic, function calling от OpenAI и поддержка state machine в LangGraph переместили agent orchestration на уровень фреймворка. Multi-agent архитектура — это больше не только research, а повседневный инструмент growth команд. Снижение стоимости токенов, контроль латентности и способность изолировать ошибки делают переход от одного вызова агента к orchestrated системе обязательным.

## Agent SDK'и и протокол Tool Use

Function calling от OpenAI с JSON схемой стал стандартом в 2023 году. Anthropic расширил tool use в Claude 3.5: API response теперь возвращает блок `tool_use`, ты выполняешь его и отправляешь обратно как `tool_result`. Этот цикл может продолжаться до 20+ итераций, но лимит токенов тебя останавливает. Синтаксис function declarations в Gemini похож, разница в grounding и retrieval extension'ах. Все три провайдера делят один паттерн: модель получает дескриптор функции, возвращает имя функции + аргументы, выполнение остаётся на стороне пользователя.

Agent SDK'и абстрагируют этот цикл. `AgentExecutor` в LangChain, `ReActAgent` в LlamaIndex, core engine в AutoGPT — все решают одну задачу: управлять последовательностью вызовов инструментов. Но абстракции создают overhead токенов. Например, LangChain отправляет историю conversation'а как префикс в каждой итерации. 10 tool call'ов = 10× context window. Чтобы это снизить, нужен summarization agent или selective context pruning. В production без observability слоя типа LangSmith отладка невозможна.

Протокол tool use недетерминирован — модель иногда галлюцинирует, передаёт неправильные аргументы функции. Поэтому validation слой обязателен: проверь input через Pydantic schema, ловрай runtime исключения, верни модели сообщение об ошибке. `PydanticOutputParser` в LangChain и параметр `tool_choice="required"` в Anthropic снижают этот риск. Но реальная проблема в том, что модель не всегда выбирает правильный инструмент. Если есть 3-4 похожих инструмента, ошибка выбора происходит в 8-12% случаев. Тогда добавляешь retry logic или routing agent.

## Параллельная vs последовательная топология агентов

Почему два агента делают то, что один не может? Потому что **специализация** повышает token эффективность. Пример сценария: входящая почта → категоризация → написание ответа → утверждение. Монолитный промпт использует 8K токенов, повторяя одну и ту же инструкцию для каждого письма. Раздели на 3 агента: **classifier** (категоризирует), **drafter** (пишет ответ), **validator** (логика утверждения). Каждый имеет свой маленький промпт. Итого токенов: 8K → 2K+2K+1.5K = 5.5K. Снижение на 31%.

Параллельная топология даёт ещё одно преимущество: **снижение латентности**. Пример: pipeline генерации контента — один агент анализирует SEO ключевые слова, другой парсит tone и style guide, третий скрейпит контент конкурентов. Если запустить сериально, латентность ×3. Параллельный запуск (с помощью `StateGraph` + `map` ноду в LangGraph) означает max латентность = время самого медленного агента. Но координация усложняется. Чей output приоритетнее? При конфликте кто решает? Поэтому нужен **arbiter agent** — meta слой, который берёт параллельные результаты и принимает финальное решение.

Последовательная топология обеспечивает изоляцию ошибок. Если агент A падает, B и C не запустятся. Можешь построить fallback цепь: если A не сработает, перейди к A2. В параллели же возникает сценарий частичного отказа: 2 из 3 агентов успешны, один таймаут. Как система продолжит работу? Здесь нужна логика state machine. В LangGraph используешь `conditional_edges` для routing: если агент успешен, то "next", если fail — "retry" или "fallback".

### Руководство по выбору топологии

| Сценарий | Топология | Причина |
|---------|----------|-------|
| Последовательная зависимость (output A — input B) | Последовательная | Overhead координации в параллели |
| Независимые подзадачи | Параллельная | Снижение латентности |
| Высокий риск сбоев | Последовательная + fallback | Изоляция ошибок |
| Критична стоимость токенов | Гибридная (параллель fetch, последовательно process) | Сбор данных без контекстного обмена |

## Управление состоянием и Context Pruning

Самая критичная проблема multi-agent системы: **state bloat**. Каждый агент хранит историю conversation'а, context window растёт на каждой итерации. 10 агентов × 5 итераций = 50 сообщений. Даже 200K context window Claude'а может переполниться. Результат: растёт латентность (стоимость расчёта токенов O(n²)), растёт цена, некоторые модели выбрасывают timeout.

Решение: **stateful orchestration** и **selective memory**. Функция `checkpointing` в LangGraph пишет состояние во внешнее хранилище (Redis, PostgreSQL). Каждый агент читает только свой релевантный контекст. Пример: drafter видит output classifier'а, но не видит предыдущую историю утверждений validator'а — не нужна.

Другой паттерн: **summarization agent**. Запускается каждые N итераций, сжимает conversation в 3-4 предложения. `ConversationSummaryMemory` в LangChain делает это, но внимание: summarization — это сам по себе LLM вызов, дополнительная стоимость. Поэтому threshold должен быть хорошо настроен. В нашем production pipeline'е summarization запускается 1 раз в 12 итераций — вместо 200 токенов контекст занимает 50, 75% экономия.

Context pruning — ещё один вариант: удали нерелевантные сообщения. Пример: output classifier'а — просто label категории, но модель возвращает весь reasoning chain. Перед отправкой drafter'у обрезаешь reasoning, оставляешь только label. В LangChain это `MessagesPlaceholder` + кастомная функция фильтра. Это ручная работа, но даёт 40-50% снижение токенов.

## Reliability и Observability в Production

Multi-agent система = N× поверхность отказа. Один агент таймаут'ится, другой наткнулся на rate limit, третий галлюцинирует. Управлять этим chaos помогают **circuit breaker** и **retry logic**. В LangChain есть wrapper `RunnableRetry`, но для более гранулярного контроля Tenacity лучше: exponential backoff, jitter, max attempt.

Без observability не отладишь. LangSmith, LangGraph Studio, Weights & Biases визуализируют trace агента: когда запустился каждый агент, что вернул, сколько токенов потратил. В нашем стеке используем LangSmith + кастомный Prometheus exporter: метрики агента latency, token count, error rate видны в Grafana. Alert threshold: P95 латентность >3s или error rate >5%.

Ещё одна production проблема: **non-determinism**. Один и тот же input может дать разный output — потому что модель стохастична. Даже при temperature=0 из-за infrastructure варьироваться может. Поэтому надёжный input pipeline обязателен — как в [архитектуре first-party данных](https://www.roibase.com.tr/ru/firstparty): структурированные данные на входе = более консистентный output. Также нужен eval framework: на каждом deploy запускай regression test, измеряй качество output. Можешь использовать `EvaluatorChain` в LangChain или model-based eval от Anthropic.

## Оптимизация стоимости и компромиссы

Multi-agent система дорога. Один вызов агента 2K токенов = $0.006 (цена Claude Sonnet 3.5). Та же задача через 3 агента: 3× API call, всего 6K токенов, $0.018. 3× стоимость. Сценарии, оправдывающие это: укорочение длинного контекста (большой doc → chunks → параллельная обработка), специализация (каждый агент использует меньшую модель, итого дешевле), изоляция ошибок (монолит высокий риск отказа).

Способы снизить стоимость токенов: **model distillation** (большая модель fine-tune меньшую, потом маленькая работает в production), **caching** (один контекст повторяется — верни cached response, Anthropic prompt caching даёт 90% скидку), **batch processing** (async вместо real-time, выбирай дешёвую модель).

Компромисс латентность vs стоимость: параллельная топология снижает латентность, растит стоимость. На критичном пути используй параллель, на некритичном — последовательно. Пример: user query → classifier параллельно (быстрый ответ), но reporting agent последовательно (background job). Гибридный подход держит P95 латентность <2s, снижая стоимость на 35%.

## Примеры Orchestration'а и код

Простая последовательная цепь (LangChain):

```python
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain_anthropic import ChatAnthropic

classifier = LLMChain(
    llm=ChatAnthropic(model="claude-3-5-sonnet"),
    prompt=PromptTemplate.from_template("Категоризируй: {text}")
)

drafter = LLMChain(
    llm=ChatAnthropic(model="claude-3-5-sonnet"),
    prompt=PromptTemplate.from_template("Напиши ответ: {category}, {text}")
)

category = classifier.run(text=user_input)
response = drafter.run(category=category, text=user_input)
```

Параллельное выполнение (LangGraph):

```python
from langgraph.graph import StateGraph

def parallel_tasks(state):
    seo_result = seo_agent.invoke(state["content"])
    tone_result = tone_agent.invoke(state["style_guide"])
    return {"seo": seo_result, "tone": tone_result}

workflow = StateGraph()
workflow.add_node("parallel", parallel_tasks)
workflow.add_node("merge", merge_agent)
workflow.set_entry_point("parallel")
workflow.add_edge("parallel", "merge")
app = workflow.compile()
```

Код запускает 2 агента параллельно, результат отправляет merge agent'у. LangGraph автоматически управляет state'ом, пишет checkpoint'ы в Redis.

Multi-agent orchestration сама по себе не цель, а инструмент. Если автоматизируешь другой канал growth или строишь decision pipeline — выбери топологию агентов, но определи метрики: токены/задача, латентность, error rate. В production успех означает 95% uptime системы и стоимость токенов в бюджете. Если строишь multi-agent для генерации контента, интегрируй со стратегией [Generative Engine Optimization](https://www.roibase.com.tr/ru/geo) — агенты собирают citation data, питают GEO метрики, ROI становится измеримым. Иначе это просто сложный API wrapper.