---
title: "Multi-Agent Orchestration: Tek LLM Çağrısından Sistemlere"
description: "Agent SDK'lar, tool use ve paralel/seri topology'lerle LLM'leri iş süreçlerine nasıl entegre edersiniz? Production tradeoff'ları ve orchestration mimarileri."
publishedAt: 2026-07-02
modifiedAt: 2026-07-02
category: ai
i18nKey: ai-008-2026-07
tags: [multi-agent, llm-orchestration, agent-sdk, tool-use, ai-infrastructure]
readingTime: 8
author: Roibase
---

Tek bir LLM API çağrısı yapıp cevap alan proof-of-concept aşaması 2023'te bitti. 2026'da LLM'leri production'a taşıyan şirketler "agent orchestration" dediğimiz şeyle uğraşıyor: birden fazla model, her biri farklı tool'a erişebilen, paralel veya seri çalışabilen, gözlemlenebilir ve yeniden oynatılabilir sistemler. Bu yazıda multi-agent mimariyi kurarken hangi kararları aldığınızı, hangi SDK'ların ne vaat ettiğini ve orchestration topology'lerinin hangi trade-off'lara sahip olduğunu göreceğiz.

## Agent SDK'ların Vaat Ettiği ve Verdiği

LangChain, CrewAI, Semantic Kernel, LlamaIndex gibi framework'ler "agent SDK" olarak pazarlanır. Hepsinin ortak vaadi: LLM'e tool kullanma yetkisi ver, karar verme hiyerarşisi kur, chain'leri yönet. Gerçek hayatta bu araçlar yeterli mi?

İlk sorun: **abstraction overhead**. LangChain gibi high-level library'ler tool binding'i kolaylaştırır ama debugging'i katmanlı hale getirir. Production'da bir tool çağrısı başarısız olduğunda LangChain'in internal state'i mi yoksa API response'u mu hatayı tetikledi bunu anlamak için trace'leri parse etmeniz gerekir. Anthropic'in Computer Use API'si gibi natif tool support varsa direkt SDK kullanmak genelde daha temiz görünürlük sağlar.

İkinci sorun: **versioning**. Agent SDK'lar hızlı iterate eder, breaking change sık çıkar. Örneğin LangChain 0.1 → 0.2 geçişi bazı chain yapılarını deprecate etti. Production'da pinlenmiş versiyon kullanıp yama beklemek yerine tool use mantığını kendiniz yazmak bazen daha sürdürülebilir. Özellikle orchestration katmanında özel business logic varsa SDK'nın opinionated yapısına sıkışmazsınız.

Üçüncü fayda: **built-in observability**. LangSmith, LlamaIndex'in eval suite'i gibi eklentiler çağrı zincirini görselleştirir. Bu production debugging için kritik — hangi agent hangi tool'u çağırdı, latency nerede şişti, hangi prompt hangi token'ı harcadı. Eğer kendi orchestration'ınızı yazmışsanız bu telemetry'yi de kendiniz kurarsınız. SDK'lar burada zaman kazandırır ama lock-in riski taşır.

## Tool Use: Function Calling'in Ötesi

Tool use dediğimiz şey LLM'in structured output üreterek external API'lere istek yapmasıdır. OpenAI function calling, Anthropic tool use, Google function calling — hepsi aynı prensibi farklı şema formatlarıyla implement eder. İlginç kısım tool'ların **birbirine bağımlı** olduğu senaryolar.

Basit örnek: bir e-posta kampanya otomasyon agent'ı. İlk tool: `list_segments` (CRM'den segment listesini çeker). İkinci tool: `get_segment_stats` (segment için metrics döndürür). Üçüncü tool: `create_campaign` (kampanya objesini yaratır). Bu üç tool'u **seri** çalıştırmak zorundasınız çünkü her birinin output'u sonrakine input olur.

Karmaşık örnek: veri analizi agent'ı. `query_bigquery`, `fetch_gsc_data`, `fetch_ga4_events` tool'larını **paralel** çalıştırabilirsiniz çünkü birbirlerinden bağımsızlar. Paralel çalışma production latency'yi düşürür ama orchestrator'ün concurrency limit'ini ve rate limit'i yönetmesi gerekir. Anthropic SDK'sı paralel tool çağrısı yapabilir ama OpenAI function calling'i sequential'dır (2026 Q2 itibariyle). Bu durumda orchestrator'ü siz yazarsınız.

Tool use'da kritik bir tradeoff: **determinizm vs. esneklik**. Eğer LLM'e "bu üç tool'dan birini seç" derseniz her run'da farklı tool seçebilir. Eğer tool sequence'ı hard-code ederseniz esneklik kaybedersiniz ama reproducibility kazanırsınız. Production'da genelde **hybrid**: kritik path'i hard-code et, opsiyonel kararları LLM'e bırak.

### Tool Çağrı Zinciri Örneği

```python
# Seri tool zinciri (her adım sonraki için input)
def orchestrate_campaign(prompt: str, client: AnthropicClient):
    # 1. Liste segment'leri
    segments = client.tool_use("list_segments", {})
    
    # 2. Her segment için stats (paralel batch)
    stats_calls = [
        client.tool_use("get_segment_stats", {"segment_id": s})
        for s in segments["ids"]
    ]
    stats = asyncio.gather(*stats_calls)
    
    # 3. En yüksek engagement'lı segment'e kampanya
    best_segment = max(stats, key=lambda x: x["engagement"])
    campaign = client.tool_use("create_campaign", {
        "segment_id": best_segment["id"],
        "message": prompt
    })
    return campaign
```

Bu örnekte `list_segments` → `get_segment_stats` (paralel) → `create_campaign` (seri) yapısı var. LLM'in sadece final message generation'da devreye girdiği **semi-autonomous** bir mimari. Tool çağrılarının mantığını orchestrator yönetir.

## Paralel vs. Seri Agent Topology

Multi-agent sistemlerde iki temel topology var: **paralel** (multiple agents aynı anda çalışır, output'ları merge edilir) ve **seri** (her agent bir sonrakinin input'unu üretir).

**Paralel topology** genelde **specialization** amacıyla kullanılır. Örnek: bir içerik üretim pipeline'ı. Agent A headline yazar, Agent B body paragraph'ları üretir, Agent C SEO meta description'ı optimize eder. Üçü de aynı brief'i input alır, output'ları merge edilir. Bu yapının avantajı: her agent kendi domain'inde uzmanlaşır, prompt'lar kısadır, token maliyeti düşer (context window paylaşılmaz). Dezavantajı: coordination overhead. Merge logic'i sizin sorumluluğunuzda — output'lar uyumsuzsa manuel reconciliation gerekir.

**Seri topology** **refinement** veya **validation** için kullanılır. Agent A draft üretir, Agent B fact-check yapar, Agent C tone'u düzeltir. Her agent bir öncekinin çıktısını alır. Avantajı: her aşama bir öncekini geliştirir, linear reasoning yapısı debug'lanması kolay. Dezavantajı: latency — her agent sequence'da beklemek zorunda. Toplam süre N × ortalama agent latency'dir.

Roibase'de pazarlama operasyonunda kullandığımız bir hybrid model var: **[Generative Engine Optimization](https://www.roibase.com.tr/tr/geo)** süreçlerinde paralel agent'lar farklı arama motorlarından (ChatGPT, Perplexity, Gemini) citation'ları scrap eder, seri bir agent zinciri bu citation'ları brand mention pattern'leriyle eşleştirir. Paralel kısım data collection hızını artırır, seri kısım analiz derinliğini sağlar.

### Topology Karşılaştırması

| Mimari | Latency | Specialization | Debugging | Use Case |
|---|---|---|---|---|
| Paralel | Düşük (max agent süresi) | Yüksek | Merge logic karmaşık | Veri toplama, çoklu kaynak analizi |
| Seri | Yüksek (toplam agent süreleri) | Düşük | Linear trace | Refinement, validation, multi-step reasoning |
| Hybrid | Orta | Yüksek | Karmaşık | Production pipeline'lar |

## Orchestration State ve Reproducibility

Multi-agent sistem kurduğunuzda en kritik karar: **state'i nerede tutacaksınız?** Üç seçenek var.

**Stateless orchestration:** Her agent bağımsızdır, intermediate output'ları orchestrator memory'sinde tutar. Avantaj: yeniden oynatmak kolay, horizontal scaling mümkün. Dezavantaj: memory pressure — uzun zincirde GBlarla conversation history tutarsınız.

**Stateful orchestration:** Intermediate state'i dış bir store'da (Redis, PostgreSQL) saklarsınız. Avantaj: memory usage düşük, crash recovery mümkün. Dezavantaj: I/O overhead, consistency garantisi gerekir.

**Hybrid (checkpointing):** Belirli milestone'larda state'i persist edersiniz. Örneğin her 5 agent çağrısında checkpoint. Crash olursa en son checkpoint'ten devam edersiniz. Avantaj: performance ve reliability arasında denge. Dezavantaj: complex implementation.

Production'da **[First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty)** içinde orchestration state'ini log stream'e yazmak yaygın pattern. Her agent çağrısı structured log olarak BigQuery'ye gider, replay için event sourcing kullanılır. Bu sayede attribution chain'i retrospektif analiz edilebilir — hangi agent output'u hangi downstream metriği etkiledi?

## Eval ve Observability: Orchestration Hata Ayıklama

Multi-agent sistemde debugging zor çünkü fail point çoktur. Agent A yanlış tool seçti mi, Agent B input'u yanlış parse etti mi, orchestrator merge logic'i hatalı mı? **Observability stack** zorunlu.

İhtiyacınız olan metrikler:
- **Agent-level latency** (p50, p95, p99) — hangi agent bottleneck?
- **Tool success rate** — hangi API çağrısı sık fail eder?
- **Token usage per agent** — cost attribution
- **Eval score** — LLM-as-judge kullanarak her agent output'unu 0-1 arası score'layın

Eval için kullandığımız bir pattern: **reference-free scoring**. Bir "supervisor" LLM (örn. GPT-4) her agent output'unu "task completion" ve "hallucination" skorlarıyla değerlendirir. Bu skorlar time-series olarak saklanır, regresyon detect edilir. Örneğin Agent A'nın hallucination skoru 0.1'den 0.3'e çıktıysa prompt versiyonunu rollback edersiniz.

Anthropic'in önerdiği bir diğer teknik: **Claude as evaluator**. Uzun context window sayesinde tüm agent chain'ini tek bir prompt'ta Claude'a verin, "bu zincirde mantık hatası var mı?" diye sorun. Bu meta-evaluation üretim öncesi QA sürecinde kullanılır.

## Orchestration Tradeoff'ları ve Karar Matrisi

Multi-agent mimariyi seçerken şu tradeoff'lara bakarsınız:

**1. Complexity vs. control:** SDK kullanmak implementation'ı hızlandırır ama debugging'i opaklastırır. Custom orchestrator yazmak control verir ama maintenance yükü yüksektir.

**2. Latency vs. specialization:** Paralel agent'lar hızlıdır ama coordination overhead getirir. Seri agent'lar daha derin reasoning yapar ama yavaştır.

**3. Cost vs. quality:** Her agent çağrısı token harcar. Agent sayısını artırmak quality artırabilir ama cost linear şekilde büyür. Production'da "minimum viable agent count" bulmalısınız.

**4. Determinizm vs. adaptability:** Hard-coded tool sequence'ları reproducible'dır ama edge case'leri handle edemez. LLM'e tool seçimi bırakmak adaptif'tir ama non-deterministic'tir.

Roibase'de kullandığımız karar matrisi:

| Kullanım Durumu | Topology | SDK | State Management |
|---|---|---|---|
| Veri toplama | Paralel | LlamaIndex | Stateless |
| İçerik refinement | Seri | Custom | Checkpointing |
| Real-time inference | Hybrid | Anthropic SDK | Redis cache |
| Batch processing | Paralel | LangChain | PostgreSQL |

## Orchestration'ı Üretime Taşırken

Multi-agent sistemi production'a taşıdığınızda üç şeye dikkat edin.

**Rate limiting:** Paralel agent'lar API rate limit'ini aşar. Orchestrator'de token bucket veya semaphore pattern kullanın. Anthropic API 50 req/min limit'i varsa paralel agent sayısını buna göre throttle edin.

**Fallback strategy:** Agent başarısız olursa ne yaparsınız? Retry logic basittir ama exponential backoff + jitter ekleyin. Eğer agent kritik değilse (örn. opsiyonel SEO meta tag generator) circuit breaker kullanıp fail-safe mode'a geçin.

**Cost monitoring:** Her agent çağrısının token maliyetini log'layın. Production'da agent başına $/request metriği takip edin. Eğer bir agent cost spike'ı yaratıyorsa prompt'u optimize edin veya agent'ı devre dışı bırakın.

Multi-agent orchestration'ın gücü "tek bir LLM'den daha fazlasını yapabilmek" değil, **iş süreçlerini modüler, gözlemlenebilir ve ölçeklenebilir hale getirmek**. Orchestration mimarisini production'da sürdürmek için tool topology, state management ve eval pipeline'ını bir arada düşünmelisiniz. Bu sistemleri kurarken [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) kapasitesi orchestration metriklerini iş metriklerine bağlamak için kritik — hangi agent konfigürasyonu hangi downstream KPI'ı artırdı, bunu retrospektif ölçebilmeniz gerekir.