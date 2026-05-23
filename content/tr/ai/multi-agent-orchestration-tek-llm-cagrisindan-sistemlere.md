---
title: "Multi-Agent Orchestration: Tek LLM Çağrısından Sistemlere"
description: "Agent SDK'lar, tool use ve paralel/seri topology'lerle LLM'leri production sistemine dönüştürmek — latency, cost, reliability tradeoff'ları."
publishedAt: 2026-05-23
modifiedAt: 2026-05-23
category: ai
i18nKey: ai-008-2026-05
tags: [multi-agent, llm-orchestration, tool-use, agent-sdk, ai-engineering]
readingTime: 8
author: Roibase
---

2024'te "AI asistan" demek tek prompt-response döngüsü demekti. 2026'da production'da olan şey farklı: paralel agent mesh'leri, seri orchestration pipeline'ları, tool use ile dış sistemlere bağlı ajanlar. Tek LLM çağrısı yerine birbirine sinyal gönderen ajanlar sistemi kurmak, reliability ve cost/latency dengesini yeniden yazıyor. Multi-agent orchestration, LLM'i production infrastructure parçasına dönüştüren mimari katman.

## Agent SDK'lar ve Tool Use Katmanı

Agent framework'leri — LangGraph, Autogen, CrewAI — LLM'e "fonksiyon çağırabilirsin" yetkisi veriyor. Tool use, modelin kendi çıktısını JSON schema'ya uygun function call'a dönüştürmesi ve interpreter'ın o fonksiyonu çalıştırıp sonucu tekrar prompt'a eklemesi. OpenAI function calling, Anthropic Claude'un tool use API'si, Google'ın Gemini function declaration'ı aynı ilkeye dayanıyor: LLM deterministik kod çalıştıramaz ama hangi fonksiyonun hangi parametreyle çağrılacağını söyleyebilir.

SDK'lar bu döngüyü manage ediyor: user query gelir, model "hava durumu API'sine city=Istanbul parametresiyle git" der, orchestrator API'yi çağırır, cevabı prompt'a ekler, model final output üretir. Bu 3 turnaround = 3×latency. Production'da tool call zinciri 5-7 adıma çıkabiliyor, her biri 200-800ms ekliyorsa toplam 1-5 saniye response time demek. Multi-agent'ta amaç bu latency'yi paralelleştirme ve cache'leme ile kırmak.

Örnek tool definition:

```python
tools = [
    {
        "name": "query_analytics",
        "description": "BigQuery'den belirtilen metriği çek",
        "parameters": {
            "metric": "string (revenue|sessions|conversions)",
            "date_range": "string (7d|30d|90d)"
        }
    }
]
```

Model bu tool'u kullanmaya karar verirse orchestrator BigQuery client'ını invoke ediyor, result'u prompt'a append ediyor, model final synthesis yapıyor. Tool use'un gücü: LLM determinizmden feragat etmeden dış dünyayı sorgulayabiliyor.

## Paralel ve Seri Agent Topology'leri

Tek agent = seri işlem. Multi-agent = paralel + seri karışımı. İki temel pattern: **scatter-gather** ve **pipeline**.

**Scatter-gather:** Ana orchestrator görevi 3 alt ajana böler, her biri aynı anda farklı tool'la çalışır, sonuçlar merkezi ajanda birleşir. Örnek: "Geçen ayın kampanya performansını analiz et" → agent_1 Google Ads API'sine, agent_2 Meta Ads API'sine, agent_3 BigQuery'ye gider, hepsi paralel. Orchestrator 3 response'u alır, sentez eder, final report verir. Latency: max(agent_1, agent_2, agent_3) + synthesis latency. Seri olsaydı agent_1 + agent_2 + agent_3 + synthesis olacaktı. 3×800ms yerine 800ms + 300ms = 1.1s.

**Pipeline:** Agent_A'nın çıktısı agent_B'nin input'u. Örnek: (1) query planlayıcı agent SQL yazıyor → (2) execution agent SQL'i çalıştırıyor → (3) visualization agent grafik spec'i üretiyor. Her adım bir sonrakinin dependency'si. Latency seri ama **her agent specialized** — query planner küçük model (GPT-4o-mini, 50ms) olabilir, execution logic gerektirmez, visualization agent Gemini Flash kullanabilir. Tek büyük model yerine 3 küçük model = daha ucuz + daha hızlı (bazı durumlarda).

Roibase'in [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) hizmetinde multi-agent orchestration'ı attribution pipeline'larında kullanıyoruz: bir agent raw event'i parse ediyor, bir agent session'a bağlıyor, bir agent revenue'yü mapping'liyor, final agent cross-channel attribution'ı hesaplıyor. Pipeline topology = deterministik adımlar, her biri özel tool set'e sahip.

### Paralel vs Seri Tradeoff

| Topology | Latency | Cost | Kullanım Durumu |
|----------|---------|------|-----------------|
| Paralel (scatter-gather) | Düşük (max işlem süresi) | Yüksek (N agent × LLM call) | Bağımsız sorgular (multi-source data pull) |
| Seri (pipeline) | Yüksek (toplam süre) | Orta (her agent küçük model olabilir) | Bağımlı işlem (parse → enrich → analyze) |
| Hibrit (paralel → merge → seri) | Orta | Orta-Yüksek | Karmaşık görev (veri toplama paralel, sonuç pipeline'da) |

Production'da scatter-gather'ı rate limit'e çarpmamak için concurrency limit koyuyoruz (örn: max 5 paralel LLM call). Seri pipeline'da intermediate cache kullanıyoruz — agent_A'nın çıktısı 10 dakika geçerli ise aynı query geldiğinde agent_B doğrudan cached output'tan başlıyor.

## Orchestrator'ın Sorumluluğu: Routing ve Error Handling

Orchestrator sadece agent'ları tetiklemekle kalmıyor, **hangi agent'ın hangi görevi alacağına karar veriyor**. LangGraph'ta "supervisor agent" diye geçiyor: gelen query'yi categorize edip routing yapıyor. Örnek logic:

```python
def route_query(user_query: str) -> str:
    # LLM-based router (küçük model, hızlı)
    classification = llm.classify(user_query, categories=["data_query", "content_gen", "code_review"])
    
    if classification == "data_query":
        return "analytics_agent"
    elif classification == "content_gen":
        return "writer_agent"
    else:
        return "code_agent"
```

Router agent genellikle GPT-4o-mini veya Claude Haiku gibi hızlı, ucuz model. 50-100ms'lik overhead ekliyor ama gereksiz büyük model kullanımını kesiyor. User "kampanya performansını özetle" diyorsa analytics_agent'a gidiyor (BigQuery tool use), "blog yazısı yaz" diyorsa writer_agent'a (web search tool + writing LLM).

**Error handling multi-agent'ta kritik.** Tek agent'ta LLM hallucinate ederse retry atarsın. Multi-agent'ta agent_2, agent_1'in hatalı output'uyla çalışırsa cascade failure oluyor. Orchestrator her agent'ın output'unu validate etmeli:

```python
def validate_agent_output(output: dict, schema: dict) -> bool:
    # JSON schema validation
    if not matches_schema(output, schema):
        raise AgentOutputError("Agent çıktısı schema'ya uymadı")
    
    # Semantic check (opsiyonel, pahalı)
    if confidence_score(output) < 0.7:
        return False  # retry or fallback
    
    return True
```

Agent_1 başarısız olursa orchestrator fallback chain'e gidiyor: önce retry (1×), sonra alternatif agent (daha büyük model), sonra human-in-the-loop. Production'da bu logic olmadan multi-agent güvenilmez.

## Latency ve Cost: Benchmark Senaryoları

Test senaryosu: "Son 30 günün gelir trendini analiz et, kampanya performansını özetle, CEO'ya özet email yaz" — 3 bağımsız görev.

**Tek agent (GPT-4, seri):**
- Query BigQuery → 800ms (LLM + API)
- Query ad platforms → 900ms
- Generate email → 600ms
- **Toplam:** 2300ms
- **Cost:** 3 turn × $0.03/1K token = ~$0.09 (varsayılan input/output mix)

**Multi-agent (scatter-gather + pipeline):**
- Agent_1, 2, 3 paralel (BigQuery, ads, email prep) → max 900ms
- Orchestrator merge + synthesis → 400ms
- **Toplam:** 1300ms
- **Cost:** 3 agent × $0.02 (küçük model) + synthesis $0.03 = ~$0.09 (aynı ama model seçimiyle düşürülebilir)

**Kazanç:** %43 latency düşüşü. Cost aynı ama model optimization ile (agent_1 → Gemini Flash, agent_2 → Claude Haiku, orchestrator → GPT-4o-mini) $0.05'e iniyor.

**Ama:** Paralel agent = paralel rate limit tüketimi. OpenAI tier limit 500 RPM ise 10 paralel agent = 5 dakikada 50 user'a hizmet verebilirsin. Tek agent olsa 500 user'a hizmet verebilirdin. Production'da bu tradeoff'u queue + cache ile yönetiyoruz.

## Gözlemlenebilirlik ve Debug

Multi-agent sistemde "nerede yanlış gitti?" sorusunu cevaplamak zor. LangSmith, Helicone, Arize Phoenix gibi araçlar agent trace'ini görselleştiriyor: hangi agent ne zaman hangi tool'u çağırdı, hangi prompt'la, ne döndü, nerede retry etti. Örnek trace:

```
orchestrator → classify_query (50ms, GPT-4o-mini) → "data_query"
→ analytics_agent → query_bigquery (800ms, tool_call) → success
→ writer_agent → generate_summary (600ms, GPT-4) → success
→ orchestrator → merge_results (200ms) → final_output
```

Her adımda token count, latency, cost log'lanıyor. Production'da bu telemetri olmadan multi-agent debug edilemez. Agent A'nın tool call'u timeout'a düşüyorsa trace'te görüyorsun, retry logic ekliyorsun.

Bir diğer metric: **agent utilization**. 5 agent tanımladıysan ama kullanıcı query'lerinin %80'i tek agent'a gidiyorsa routing logic bozuk demektir. Orchestrator'ın classification accuracy'sini ölçüyoruz — user feedback ile label'lı dataset oluşturup router agent'ı fine-tune ediyoruz (few-shot prompt yerine lightweight classifier).

## Multi-Agent'ın Limitleri

Multi-agent her problemi çözmüyor. **Coordination overhead** var: agent'lar arası mesaj geçişi, orchestration logic, error handling — hepsi latency ekliyor. Tek agent'la 1 saniyede bitecek basit query, multi-agent'ta 1.5 saniye sürebilir (orchestrator + routing + merge). Mimari karmaşıklığı artıyor — kod tabanı büyük, test etmek zor, deployment daha hassas.

Multi-agent'ın anlamlı olduğu durumlar:
- **Paralel data pull gerekli:** 5 farklı API'den veri çekilecekse scatter-gather kazandırır
- **Specialized model'ler optimal:** Query planning için küçük model, code generation için büyük model — pipeline topology ile cost düşer
- **Long-running task:** Agent_1 işi başlatır, agent_2 async izler, agent_3 biter, orchestrator notify eder — sync LLM call yerine event-driven mimari

Kısa, sık, basit query'lerde tek agent + caching daha iyi. Multi-agent, karmaşık görevin decompose edilip optimize edilmesinde değer yaratıyor.

---

Multi-agent orchestration, LLM'i stateless function call'dan stateful, gözlemlenebilir, ölçeklenebilir sisteme dönüştürüyor. Paralel topology latency'yi kırıyor, pipeline topology cost'u düşürüyor, orchestrator reliability sağlıyor. Production'da scatter-gather ile başla, rate limit ve cost'u izle, gerektiğinde pipeline'a geç. Agent trace'i log'la, error handling'i katmanla, routing logic'i test et. Multi-agent, LLM engineering'den LLM infrastructure'a geçiş noktası.