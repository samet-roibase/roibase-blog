---
title: "Multi-Agent Orchestration: Tek LLM Çağrısından Sistemlere"
description: "Agent SDK'lar, tool use ve paralel/seri topology'lerle LLM uygulamalarını üretime taşımak. Token maliyeti, latency ve hata yalıtımı tradeoff'ları."
publishedAt: 2026-06-13
modifiedAt: 2026-06-13
category: ai
i18nKey: ai-008-2026-06
tags: [multi-agent, llm-orchestration, tool-use, agent-sdk, production-ai]
readingTime: 8
author: Roibase
---

Tek bir LLM promptu birkaç ay önce yeterliydi. Şimdi production'da çalışan sistemler paralel agent topology'leri, structured output ve fallback zinciri gerektiriyor. Anthropic'in Computer Use, OpenAI'nin function calling ve LangGraph'in state machine desteği agent orchestration'ı framework düzeyine taşıdı. Multi-agent mimari artık yalnızca research değil, büyüme ekiplerinin günlük tooling'i. Token maliyetini düşürmek, latency'yi kontrol etmek ve hata yalıtımı yapabilmek için single-agent çağrısından orchestrated system'e geçiş zorunlu.

## Agent SDK'lar ve Tool Use Protokolü

OpenAI'nin function calling JSON şeması 2023'te standart haline geldi. Anthropic, Claude 3.5 ile tool use'i genişletti: API response artık `tool_use` bloğu döndürüyor, sen execute edip `tool_result` olarak geri veriyorsun. Bu loop 20+ iterasyona kadar gidebilir, ama token limiti seni kesiyor. Gemini'nin function declarations syntax'ı benzer, fark grounding ve retrieval extension'larında. Üç provider da aynı pattern'i paylaşıyor: model function descriptor alıyor, function name + arguments döndürüyor, execution kullanıcıda.

Agent SDK'lar bu loop'u soyutluyor. LangChain'in `AgentExecutor`, LlamaIndex'in `ReActAgent`, AutoGPT'nin core engine — hepsi aynı sorunu çözüyor: tool call sequence'ini yönetmek. Ama abstraksiyonlar token overhead yaratıyor. Örneğin LangChain, her iterasyonda conversation history'yi prefix olarak gönderiyor. 10 tool call = 10× context window. Bunu azaltmak için summarization agent veya selective context pruning gerekiyor. Production'da LangSmith gibi observability katmanı olmadan debugging imkansız.

Tool use protokolü deterministik değil — model bazen hallucinate ediyor, yanlış function argument veriyor. Bu yüzden validation katmanı zorunlu: Pydantic schema ile input validate et, runtime'da exception yakala, model'e error message döndür. LangChain'de `PydanticOutputParser`, Anthropic'te `tool_choice="required"` parametresi bu riski düşürüyor. Ama asıl sorun şu: model her zaman doğru tool'u seçmiyor. 3-4 benzer tool varsa, seçim yanılması %8-12 oranında. Bu durumda retry logic veya routing agent ekliyorsun.

## Paralel vs Seri Agent Topology

Tek agent'in yapamadığı şeyi niye iki agent yapsın? Çünkü **specialization** token verimliliğini artırıyor. Örnek senaryo: e-posta gelen kutusu → kategorize et → yanıt yaz → onay al. Monolithic prompt 8K token context kullanır, her e-posta için aynı instruction'ı tekrarlar. Bunu 3 agent'e böl: **classifier** (kategorize), **drafter** (yanıt yaz), **validator** (onay logic). Her biri kendi küçük prompt'una sahip. Toplam token: 8K → 2K+2K+1.5K = 5.5K. %31 düşüş.

Paralel topology başka avantaj: **latency azaltma**. Örnek: content generation pipeline — bir agent SEO keyword analizi yapıyor, diğeri ton ve style guide'ı parse ediyor, üçüncüsü rakip içerik scrape ediyor. Seri çalıştırırsan 3× latency. Paralel çalıştırırsan (LangGraph'in `StateGraph` + `map` node'u ile) max latency = en yavaş agent'in süresi. Ancak paralelde coordination zorlaşıyor. Hangi agent'in output'u öncelikli? Conflict olursa kim karar veriyor? Bu yüzden **arbiter agent** gerekiyor — paralel sonuçları alıp final decision veren meta-layer.

Seri topology hata yalıtımı sağlıyor. Agent A başarısız olursa, B ve C çalışmıyor. Fallback chain kurabilirsin: A fail olursa A2'ye geç. Paralelde ise partial failure senaryosu var: 3 agent'ten 2'si başarılı, biri timeout. Sistem nasıl devam edecek? Bu durumda state machine logic gerekiyor. LangGraph'de `conditional_edges` ile routing yapıyorsun: agent başarılıysa "next", fail ise "retry" veya "fallback".

### Topology Seçim Kılavuzu

| Senaryo | Topology | Neden |
|---------|----------|-------|
| Sequential dependency (A'nın output'u B'nin input'u) | Seri | Paralelde coordination overhead |
| Bağımsız subtask'ler | Paralel | Latency azaltma |
| Yüksek fail riski | Seri + fallback | Hata yalıtımı |
| Token maliyeti kritik | Hybrid (paralel fetch, seri process) | Context paylaşmadan veri toplama |

## State Management ve Context Pruning

Multi-agent sistemin en kritik sorunu: **state bloat**. Her agent conversation history'yi tutuyor, her iterasyonda context window büyüyor. 10 agent × 5 iterasyon = 50 message. Claude'un 200K context window'u bile dolabiliyor. Sonuç: latency artıyor (token hesaplama maliyeti O(n²)), cost artıyor, bazı model'ler timeout veriyor.

Çözüm: **stateful orchestration** ve **selective memory**. LangGraph'in `checkpointing` özelliği state'i external store'a yazıyor (Redis, PostgreSQL). Her agent yalnızca kendi ilgili context'ini okuyor. Örnek: drafter agent classifier'ın output'unu görüyor, ama validator'ın önceki onay geçmişini görmüyor — gerekmedikçe.

Bir diğer pattern: **summarization agent**. Her N iterasyonda devreye giriyor, conversation'ı 3-4 cümleye indiriyor. LangChain'in `ConversationSummaryMemory` bu işi yapıyor ama dikkat: summarization kendisi de LLM call gerektiriyor, ekstra maliyet. Bu yüzden trigger threshold iyi ayarlanmalı. Bizim production pipeline'ımızda 12 iterasyonda 1 summarization çalıştırıyoruz — 200 token yerine 50 token context tutuyor, %75 tasarruf.

Context pruning başka bir seçenek: ilgisiz message'ları sil. Örnek: classifier agent'in output yalnızca category label, ama model tüm reasoning chain'i de dönüyor. Drafter'a gönderirken reasoning'i kesiyorsun, yalnızca label'ı bırakıyorsun. LangChain'de `MessagesPlaceholder` + custom filter function ile yapabilirsin. Bu manuel iş, ama %40-50 token düşürüyor.

## Production'da Reliability ve Observability

Multi-agent sistem demek N× failure surface demek. Bir agent timeout veriyor, diğeri rate limit yiyor, üçüncüsü hallucinate ediyor. Bu chaos'u yönetmek için **circuit breaker** ve **retry logic** zorunlu. LangChain'in `RunnableRetry` wrapper'ı var, ama granular kontrol istemiyorsan Tenacity kütüphanesi daha esnek: exponential backoff, jitter, max attempt.

Observability olmadan debug edemezsin. LangSmith, LangGraph Studio, Weights & Biases gibi tool'lar agent trace'i görselleştiriyor: hangi agent ne zaman çağrıldı, ne döndü, ne kadar token harcadı. Bizim stack'imizde LangSmith + custom Prometheus exporter kullanıyoruz: agent latency, token count, error rate metriklerini Grafana'da gösteriyoruz. Alert threshold: P95 latency >3s veya error rate >5%.

Bir başka production sorunu: **non-determinism**. Aynı input, farklı output verebiliyor — çünkü model stochastic. Temperature=0 yapsan bile, provider'ın infrastructure'ına bağlı varyasyon oluyor. Bu yüzden [first-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) gibi güvenilir input pipeline'ı şart: structured data girerse, output daha tutarlı. Ayrıca eval framework gerekiyor: her deploy'da regression test koştur, output quality'yi ölç. LangChain'in `EvaluatorChain` veya Anthropic'in model-based eval kullanabilirsin.

## Cost Optimization ve Tradeoff'lar

Multi-agent sistem pahalı. Tek agent çağrısı 2K token = $0.006 (Claude Sonnet 3.5 fiyatıyla). Aynı task'ı 3 agent'le yaparsan: 3× API call, toplam 6K token, $0.018. 3× maliyet. Bunu haklı çıkaran senaryolar: uzun context'i kısaltmak (büyük doc → chunk → parallel process), specialization (her agent küçük model kullanıyor, toplam ucuz), hata yalıtımı (monolith fail riski yüksek).

Token maliyetini düşürmenin yolları: **model distillation** (büyük model küçük model'i fine-tune ediyor, sonra küçük model production'da), **caching** (aynı context tekrar gelirse cached response dön — Anthropic'in prompt caching'i %90 indirim sağlıyor), **batch processing** (real-time yerine async çalıştır, ucuz model tercih et).

Latency vs cost tradeoff: paralel topology latency düşürüyor ama maliyet artırıyor. Kritik path'te paralel, non-kritik'te seri yapabilirsin. Örnek: kullanıcı query → classifier paralel (hızlı cevap), ama raporlama agent seri (background job). Bu hybrid yaklaşım latency'yi P95 <2s tutarken cost'u %35 düşürüyor.

## Orchestration Örnekleri ve Kod

Basit seri chain (LangChain):

```python
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain_anthropic import ChatAnthropic

classifier = LLMChain(
    llm=ChatAnthropic(model="claude-3-5-sonnet"),
    prompt=PromptTemplate.from_template("Kategorize et: {text}")
)

drafter = LLMChain(
    llm=ChatAnthropic(model="claude-3-5-sonnet"),
    prompt=PromptTemplate.from_template("Yanıt yaz: {category}, {text}")
)

category = classifier.run(text=user_input)
response = drafter.run(category=category, text=user_input)
```

Paralel execution (LangGraph):

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

Bu kod 2 agent'i paralel çalıştırıp, sonucu merge agent'e veriyor. LangGraph otomatik olarak state'i yönetiyor, checkpoint'leri Redis'e yazıyor.

Multi-agent orchestration tek başına amacı değil, araç. Başka bir büyüme kanalını otomatikleştiriyorsan veya decision pipeline kuruyorsan agent topology seç, ama metrik netleştir: token/task, latency, error rate. Production'da başarı ölçütü, sistemin %95 uptime'la çalışması ve token cost'un bütçede kalması. Eğer multi-agent sistemi content generation için kuruyorsan, [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) stratejisiyle entegre et — agent'ler citation verisi topluyor, GEO metriklerini besliyorsa, ROI ölçülebilir hale geliyor. Aksi halde yalnızca karmaşık bir API wrapper.