---
title: "Multi-Agent Orchestration: Tek LLM Çağrısından Sistemlere"
description: "Agent SDK'lardan paralel/seri topology'lere: LangGraph, CrewAI, AutoGen üzerinden production-grade multi-agent sistemleri nasıl kurulur?"
publishedAt: 2026-07-20
modifiedAt: 2026-07-20
category: ai
i18nKey: ai-008-2026-07
tags: [multi-agent, llm-orchestration, langgraph, crewai, agent-topology]
readingTime: 8
author: Roibase
---

2023'te LLM'ler "aracı çağırabilir" hale geldi. 2024'te "agent" kavramı çıktı. 2025'te herkes kendi agent'ını yaptı. 2026'da soru değişti: tek agent yetmiyor, ama 5 agent'ı paralelde mi seri mi çalıştırmalıyım? Hangisi hangi tool'u kullanmalı? Koordinasyon mantığı nerede yaşamalı? Multi-agent orchestration, LLM uygulamalarının "Hello World"ünden production sistemine geçişin ilk ciddi mühendislik sorunu.

## Tek Agent'tan Topology'ye: Neden Orchestration?

Tek agent — örneğin Claude Sonnet 3.5 + 5 tool — birçok kullanım senaryosunu çözer. Ama şu durumlar geldiğinde tıkanırsın:

**Paralel çalışma gerekliliği:** Bir pazarlama kampanyası analizi yapıyorsun. Aynı anda Google Ads API'den data çek, BigQuery'de historical trend hesapla, Shopify'dan conversion verisi al. Tek agent bu işleri sırayla yapar — toplam 12 saniye. 3 agent paralel çalışırsa 4.5 saniyede biter. Latency kritikse orchestration zorunlu.

**Uzmanlaşma ihtiyacı:** Bir agent SQL yazsın, biri veri temizlesin, biri görselleştirme kodu üretsin. Her agent'a farklı system prompt, farklı model (SQL için Sonnet, kod için Opus), farklı retrieval context verirsin. Tek agent'a "sen hem SQL bil hem görsel tasarla" dersen context window şişer, performans düşer.

**Güvenlik katmanları:** Bir agent dışarıdan gelen prompt'u temizlesin, biri iş mantığını çalıştırsın, biri output'u validate etsin. Bu "assembly line" yapısı, production'da kritik: tool use'da hatalı parametre geçme riskini düşürmek için orchestration zorunlu.

Roibase'in [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) projelerinde paralel agent yapısıyla BigQuery sorgu sürelerini %60 düşürdük — çünkü 3 farklı veri kaynağı aynı anda sorgulanabiliyor.

## Agent SDK'lar: LangGraph, CrewAI, AutoGen

**LangGraph (LangChain ekosistemi):** Directed graph yapısında agent'ları düğüm olarak tanımlarsın. Her düğüm bir "state" tutar, kenarlar transition mantığını belirler. Conditional routing mümkün: agent A "veri eksik" derse agent B'ye git, tamam derse C'ye git.

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

**장점:** State management güçlü. Distributed tracing kolay — her düğüm log'u ayrı. **Dezavantaj:** Syntax karmaşık, callback zincirleri debugging'i zorlaştırır.

**CrewAI:** Role-based orchestration. Her agent'a bir "role" atarsın (researcher, analyst, writer), bir "task" listesi verirsin. Framework otomatik sırayla çalıştırır veya paralel fork eder.

```python
from crewai import Crew, Agent, Task

researcher = Agent(role='Data Researcher', tools=[bigquery_tool])
analyst = Agent(role='Analyst', tools=[pandas_tool])

crew = Crew(agents=[researcher, analyst], process="sequential")
result = crew.kickoff()
```

**장점:** Minimal boilerplate, hızlı prototip. **Dezavantaj:** Esneklik düşük — custom routing için kod değiştirmen gerekir.

**AutoGen (Microsoft):** Conversational multi-agent. Agent'lar birbirleriyle "konuşur", bir agent diğerine mesaj gönderir, o cevap verir. Bu pattern'de orchestration implicit — mesaj akışı topology'yi belirler.

```python
from autogen import AssistantAgent, UserProxyAgent

assistant = AssistantAgent("assistant", llm_config={...})
user_proxy = UserProxyAgent("user", code_execution_config={...})

user_proxy.initiate_chat(assistant, message="Analyze Q1 data")
```

**장점:** Human-in-the-loop senaryolarında doğal. **Dezavantaz:** Deterministik olmayan akışlar — agent A agent B'ye ne zaman cevap verecek belirsiz.

## Paralel vs Seri Topology: Tradeoff Matrisi

| Mimari | Latency | Maliyet | Complexity | Kullanım |
|--------|---------|---------|------------|----------|
| **Seri (Sequential)** | Yüksek (N×t) | Düşük (tek seferde 1 LLM) | Düşük | Deterministik pipeline'lar (veri → analiz → rapor) |
| **Paralel (Fork-Join)** | Düşük (max(t₁, t₂, t₃)) | Yüksek (N agent aynı anda) | Orta | Bağımsız işler (3 API'yi aynı anda çek) |
| **Conditional (DAG)** | Değişken | Orta | Yüksek | Dinamik akış (veri eksikse X, tamam ise Y) |
| **Conversational** | Belirsiz | Orta | Yüksek | Human-in-the-loop veya negotiation |

**Production kararı:** Eğer işlem critical-path'te değilse (örn: offline rapor üretimi), seri topology seç — debug kolay, maliyet düşük. Eğer latency SLA'sı var (örn: real-time dashboard), paralel fork et — ama retry mantığını baştan kur, yoksa 1 agent timeout'ta 3'ü de bekler.

## Tool Use Koordinasyonu: Çakışmayı Engellemek

Multi-agent sistemde en sık görülen bug: 2 agent aynı tool'u aynı anda farklı parametreyle çağırır, biri diğerinin state'ini bozar.

**Örnek:** Agent A BigQuery'de `temp_table_x` oluşturur, agent B aynı anda `temp_table_x`'i okumaya çalışır — veri yoktur hatası. Bu "race condition" orchestration katmanında çözülür:

**1. Resource locking:** Agent A bir tool'u kullanmaya başladığında, orchestrator o tool'u diğer agent'lara kilitler. LangGraph'te `shared_state` ile yapılır.

```python
if not state.lock_acquired("bigquery"):
    return {"status": "waiting"}
state.acquire_lock("bigquery")
result = bigquery_tool.run()
state.release_lock("bigquery")
```

**2. Namespace isolation:** Her agent'a ayrı workspace ver. Agent A `workspace_a/temp_table`, agent B `workspace_b/temp_table` kullanır. CrewAI'da `agent_id` prefix'i ile yapılır.

**3. Idempotent tool design:** Tool'ları baştan idempotent yaz — aynı parametreyle 2 kere çağrılınca conflict olmasın. Örneğin `upsert` yerine `create_or_replace` kullan.

## Observability: Agent Trace'i Nasıl İzlenir?

Production'da 5 agent çalışıyor, biri hata veriyor, hangisi? LangSmith, Helicone, Arize gibi araçlar agent-level trace toplar, ama manuel enstrümantasyon şart.

**Kritik metrikler:**
- **Agent latency per step:** Hangi agent ne kadar sürdü? Paralel fork'ta `max(latency)` bottleneck'i gösterir.
- **Tool call success rate:** Her agent hangi tool'u kaç kere çağırdı, kaçı başarılı? %95 altı red flag.
- **Retry count:** Bir agent kaç kere retry etti? Yüksek retry, ya prompt hatalı ya da tool spec yanlış.
- **State transition diagram:** LangGraph için hangi düğümden hangisine kaç kere geçildi? Sonsuz döngü buradan görülür.

```python
# LangSmith entegrasyonu
from langsmith import Client

client = Client()
with client.trace(run_name="multi_agent_pipeline") as run:
    for agent in agents:
        with run.create_child(name=agent.name):
            agent.run()
```

## Context Window Yönetimi: Shared Memory vs Isolated

Multi-agent'ta en kritik kaynak context window. 5 agent varsa, hepsi aynı 128K token'ı mı paylaşır, yoksa her biri ayrı 128K mı alır?

**Shared memory (LangGraph default):** Tüm agent'lar aynı state nesnesine yazıp okur. Avantaj: agent A'nın bulgusu agent B'ye otomatik geçer. Dezavantaj: context kirliliği — agent C'nin ihtiyacı olmayan veriler window'u şişirir.

**Isolated memory + message passing:** Her agent kendi state'ini tutar, sadece gerekli data'yı mesaj olarak gönderir. CrewAI bu pattern'i kullanır. Avantaj: token verimliliği yüksek. Dezavantaj: manuel data serialization gerekir.

**Hibrit (önerilen):** Shared state'te sadece metadata tut (hangi agent ne yaptı, ne zaman bitti), asıl data'yı disk/DB'ye yaz, agent'lara referans geçir. Örneğin BigQuery result'ını GCS'ye yaz, agent'lara `gs://bucket/result.parquet` path'i ver.

## Hata Yönetimi: Hangi Agent Düştüğünde Ne Olur?

Seri topology'de agent 2 düşerse pipeline durur — basit. Paralel'de agent B düşse bile agent A ve C devam eder — ama sonunda eksik veriyle rapor üretirsin. Orchestration katmanında "partial success" mantığı şart.

**Stratejiler:**

1. **Fail-fast (seri için):** İlk hata tüm pipeline'ı durdurur. Latency önemsizse tercih et.
2. **Best-effort (paralel için):** Mümkün olduğunca agent çalıştır, eksik veriyle bile output üret — ama metadata'da "incomplete" flag'i koy.
3. **Retry with fallback:** Agent A 3 kere denedi başaramadı, agent A_backup'a sor (farklı model veya farklı prompt).

```python
# LangGraph retry
workflow.add_node("agent_a", agent_a, retry_policy={"max_attempts": 3})
workflow.add_edge("agent_a", "agent_a_backup", condition="failed")
```

## Production Checklist: Multi-Agent Sistemi Yayına Almadan

- **Token budget hesapla:** 5 agent × 10K token input × 2K output × API fiyatı = run başına maliyet. Günlük 1000 run = ay sonu ne olur?
- **Latency SLA belirle:** Hangi agent'ın ne kadar sürmesi kabul edilebilir? P95 latency'i 10 saniye üstüyse paralel topology gerekir.
- **Rollback planı:** Bir agent'ın prompt'unu değiştirince tüm pipeline bozulabilir. Versiyon kontrolü + canary deployment şart.
- **Human-in-the-loop noktası:** Kritik kararlarda (örn: bütçe ayarlama) son agent output'u human'a göster, onay al.
- **Audit log:** Her agent'ın her adımı — hangi tool çağırıldı, ne parametre verildi, ne döndü — S3'e JSON olarak yazılsın. Compliance için gerekir.

Multi-agent orchestration, LLM engineering'in "sistemler dersi". Tek model çağrısıyla başladığın iş, production'da topology, state management, retry logic, observability gerektiriyor. LangGraph, CrewAI, AutoGen birer iskelet — asıl iş, senin use case'ine göre agent'ları nasıl sıralayıp paralelize edeceğin. Şimdi prototipini al, latency'yi ölç, maliyet simülasyonu yap, sonra topology'yi seç. Test etmeden yayına alma — multi-agent sistemde "çalıştı" ile "production-ready" arasında 10 katman var.