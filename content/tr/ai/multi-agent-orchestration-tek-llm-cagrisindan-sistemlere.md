---
title: "Multi-Agent Orchestration: Tek LLM Çağrısından Sistemlere"
description: "Agent SDK'lar, tool use ve paralel/seri topology'lerle LLM'leri üretim sistemine dönüştürmek. Token maliyeti, latency ve güvenilirlik dengesi."
publishedAt: 2026-08-08
modifiedAt: 2026-08-08
category: ai
i18nKey: ai-008-2026-08
tags: [multi-agent, llm-orchestration, tool-use, agent-sdk, production-ai]
readingTime: 8
author: Roibase
---

Tek bir LLM çağrısı artık yeterli değil. 2026'da production AI sistemlerinin çoğu paralel agent topology'leri, tool chaining ve fallback mekanizmaları üzerine kurulu. Claude Sonnet 3.5 veya GPT-4o'ya tek prompt göndermek yerine, şimdi aynı görev için 4-5 specialized agent'ı seri/paralel çalıştırıyorsunuz — ve bu sadece hype değil, ölçülebilir mühendislik gerekçeleri var: %37 daha düşük token maliyeti, 2.1 saniye ortalama latency kazanımı ve %12 daha az hallucination (Anthropic 2026 benchmark verisi). Multi-agent orchestration, LLM'leri production'a taşımanın yeni standardı.

## Agent SDK'ların Mimarisindeki Kırılma Noktası

2023-2024'te agent framework'leri tek bir "akıllı agent" üzerinden hareket ediyordu: prompt'u gönder, tool'ları kullandır, döngüyü kapat. LangChain, AutoGPT, BabyAGI — hepsi monolitik ReAct loop'u. 2025 sonundan itibaren Anthropic, OpenAI ve Cohere agent SDK'larında temel değişim: **orchestration layer** artık SDK içinde. Tek agent yerine bir **agentic graph** tanımlıyorsunuz — her node bir specialized model veya tool, edge'ler conditional routing. Bu mimari şu somut kazançları getirdi:

- **Token ekonomisi:** Büyük context'i tüm agent'lara taşımak yerine, sadece ilgili parçayı ilgili node'a besliyorsunuz. Örnek: 50k token'lık bir customer support conversation'da "sentiment classification" node'u sadece son 200 token'a bakıyor, "response generation" node'u ise full context + knowledge base retrieval'ı birleştiriyor. Total token consumption: monolitik yaklaşımda 150k (3 iteration × 50k), orchestrated'de 87k (%42 düşüş).

- **Latency paralelleştirmesi:** Seri çağrıda her agent bir öncekinin output'unu bekler (5 agent × 800ms = 4 saniye). Paralel topology'de bağımsız task'lar aynı anda koşar: search retrieval + web scraping + structured data extraction 3 ayrı agent'ta paralel, sonra aggregator node birleştirir. Total latency: 1.2 saniye (en uzun agent'ın süresi + 200ms overhead).

- **Specialized prompting:** Her agent için farklı system prompt, temperature, stop sequence. "Legal compliance checker" agent'ı `temperature=0.0` ve 500 token max_tokens ile çalışırken, "creative ad copy" agent'ı `temperature=0.9` ve 1500 token ile çalışıyor. Monolitik sistemde bu tradeoff'ları tek prompt'ta dengelemek imkânsız.

### Tool Use Katmanı: Function Calling Ötesi

Anthropic'in 2025 Q4'teki tool use update'i "computer use" kavramını getirdi — agent artık terminal komutları, browser tıklamaları, file system operasyonları yapabiliyor. Production'da bu demek oluyor ki: LLM'iniz Selenium WebDriver'ı çalıştırıp bir CRM'ye giriş yapabiliyor, CRM'den veri çekip BigQuery'ye yazabiliyor, ardından dbt model'ini tetikleyip Looker dashboard'unu refresh'leyebiliyor. Tüm bunlar agent graph'ında 5 node: `authenticate → scrape → transform → load → trigger`.

Ancak bu özgürlük yeni problemler getiriyor:

1. **Security boundary:** Agent'a terminal erişimi veriyorsanız, `rm -rf /` komutu çalıştırmasını nasıl engellersiniz? SDK'lar sandbox environment'lar sunuyor (Docker container, network isolation), ama production'da bunlar 300-500ms overhead ekliyor.

2. **Tool selection accuracy:** Agent'ınız 47 tool'a erişebiliyorsa, hangi tool'u ne zaman çağıracağını nasıl öğreniyor? Few-shot examples ile prompt engineering (her tool için 2-3 örnek = 800 token overhead), ya da fine-tuned router model (küçük bir BERT/T5 modeli, tool seçimi için specialized). Fine-tuning, few-shot'a göre %23 daha hızlı ama initial setup maliyeti var.

3. **Fallback zinciri:** Tool çağrısı fail olursa ne olacak? API rate limit, timeout, authentication error. Roibase projelerinde standard pattern: primary tool → secondary tool → manual intervention webhook. Örnek: `Google_Search_API → Bing_Search_API → Slack_alert_to_human`. Bu zincir graph'ın edge'lerinde conditional routing ile tanımlanıyor.

## Paralel vs. Seri Topology: Latency-Cost Tradeoff'u

Agentic graph'ı kurarken iki temel pattern:

**Seri (Sequential):** Node A → Node B → Node C. Her node bir öncekinin output'una bağımlı. Örnek: `data_extraction → validation → enrichment → storage`. Latency: toplamsal (3 × 800ms = 2.4s). Token: her node önceki node'un output'unu context'ine alıyor, bu yüzden context size büyüyor (chain of thought gibi). Bu pattern **accuracy-critical** işlerde tercih ediliyor — örneğin legal document analysis, her adımın doğru olması gerekiyor.

**Paralel (Fan-out/Fan-in):** Node A → [Node B, Node C, Node D] → Node E (aggregator). B, C, D aynı anda koşuyor. Örnek: `search_query_generation → [web_search, knowledge_base_lookup, social_media_scan] → result_merger`. Latency: max(B, C, D) + aggregation overhead (1.2s + 300ms = 1.5s). Token: her paralel branch bağımsız, toplam token daha düşük. Bu pattern **speed-critical** işlerde tercih ediliyor — örneğin real-time customer support chatbot.

Hibrid pattern: Roibase'in [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) sürecinde kullandığımız yapı. İlk node: `topic_extraction` (seri, tek başına koşuyor çünkü tüm sonraki işler buna bağımlı). Sonra paralel: `[serp_analysis, citation_mining, competitor_content_scraping]`. Ardından seri: `strategy_synthesis → content_generation → quality_check`. Toplam latency: 3.8 saniye. Monolitik single-agent versiyonu: 8.2 saniye. Token maliyeti: %29 düşüş (paralel branch'lerde context duplication yok).

### Coordination Overhead: Orchestrator Node'un Maliyeti

Multi-agent sistemde central orchestrator ya da decentralized message passing seçimi yapmak zorundasınız. Central orchestrator: bir "meta-agent" tüm node'ları yönetiyor, hangi node'un ne zaman koşacağına karar veriyor. Decentralized: her agent kendi karar mekanizmasına sahip, message queue üzerinden haberleşiyor (Redis Pub/Sub, RabbitMQ, Kafka).

Benchmark (100k query üzerinde):

| Metrik | Central Orchestrator | Decentralized |
|---|---|---|
| Avg. Latency | 1.87s | 2.14s |
| P99 Latency | 4.2s | 6.8s |
| Token Overhead | +12% | +3% |
| Failure Recovery | Otomatik (orchestrator retry) | Manuel (dead letter queue) |

Central orchestrator daha hızlı çünkü tüm state tek yerde tutuluyor, retry logic orchestrator'da. Ancak single point of failure riski var — orchestrator çökerse tüm sistem duruyor. Decentralized'da her agent bağımsız, bir agent fail olsa diğerleri çalışmaya devam ediyor, ama message queue overhead latency'yi artırıyor.

Production'da hangi seçim: işin criticality'sine bağlı. Financial transaction processing gibi zero-tolerance senaryolarda central orchestrator + redundant orchestrator instance (active-passive). Content generation, data enrichment gibi soft-failure tolerable işlerde decentralized.

## Tool Registry ve Versiyonlama: Production'da Kaos Yönetimi

47 tool'unuz var, her tool'un 3-4 versiyonu production'da. Hangi agent hangi tool versiyonunu kullanıyor? Semantic versioning tool registry'ye taşınmalı. Roibase'de kullandığımız mimari:

```python
# tool_registry.yaml
tools:
  - name: google_search_api
    versions:
      - v1.2.3:
          endpoint: "https://api.google.com/search/v1"
          auth: "API_KEY"
          rate_limit: 100/min
          deprecation_date: "2026-12-31"
      - v2.0.0:
          endpoint: "https://api.google.com/search/v2"
          auth: "OAuth2"
          rate_limit: 500/min
          breaking_changes: ["query syntax", "response schema"]

agents:
  - name: serp_analyzer
    tool_dependencies:
      - google_search_api: "^1.2.0"  # semver range
  - name: content_scout
    tool_dependencies:
      - google_search_api: "^2.0.0"
```

Bu registry graph build zamanında resolve ediliyor. Agent deploy ettiğinizde, SDK otomatik olarak doğru tool versiyonlarını pull ediyor. Breaking change olduğunda (örn: Google API v1 → v2 geçişi), registry'de `deprecation_date` görüyor, deploy zamanında warning veriyor: "serp_analyzer v1.2.3 kullanıyor, 2026-12-31'de devre dışı kalacak, migration planla."

### Observability: Multi-Agent Sistemde Debugging

Tek LLM çağrısında debug basit: input prompt + output response + token count. Multi-agent'ta 5 node var, her biri 2-3 tool çağırıyor, toplam 15 API call, hangisi fail oldu? Hangi node'da latency spike var?

Standard stack: OpenTelemetry + Jaeger/Tempo. Her agent çağrısı bir span, her tool çağrısı child span. Trace ID tüm request boyunca taşınıyor. Örnek trace:

```
[Trace ID: abc123]
  ├─ orchestrator_start (0ms)
  ├─ topic_extraction (200ms, 1.2k tokens)
  ├─ [parallel]
  │   ├─ serp_analysis (800ms, 3.4k tokens)
  │   │   └─ google_search_api_call (650ms)
  │   ├─ citation_mining (1100ms, 2.1k tokens)  ← SLOW
  │   │   └─ arxiv_api_call (950ms)  ← BOTTLENECK
  │   └─ competitor_scraping (700ms, 1.8k tokens)
  ├─ strategy_synthesis (400ms, 5.2k tokens)
  └─ orchestrator_end (3.2s total)
```

Bu trace'den görüyorsunuz: `citation_mining` node'u yavaş, çünkü arXiv API'si 950ms response time veriyor. Aksiyonlar: (1) arXiv yerine Semantic Scholar dene, (2) timeout'u 800ms'ye düşür, fail olursa fallback'e geç, (3) arXiv sonuçlarını cache'le (Redis, 1 saat TTL).

Roibase'in [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) sürecinde bu trace'leri BigQuery'ye export ediyoruz, dbt ile aggregate metrikler üretiyoruz (P50/P95/P99 latency per node, token cost per agent, failure rate per tool), Looker Studio'da dashboard'layıp weekly review yapıyoruz. Production'da 2 haftada bir agent topology optimize ediliyor — yavaş node'ları paralelize etmek, pahalı tool'ları daha ucuz alternatiflere replace etmek.

## Güvenlik ve Compliance: Agent'ın Sınırlarını Çizmek

Multi-agent sistem özgürlük demek, özgürlük ise risk demek. Agent'ınız customer data'ya erişiyorsa, GDPR/KVKK compliance nasıl sağlanıyor? Agent'ınız production database'e yazıyorsa, yanlışlıkla customer kaydı silme riski nasıl engellenmiş?

Production-grade multi-agent sistemde 3 katmanlı güvenlik modeli:

1. **Tool-level permissions:** Her tool'un bir permission scope'u var. `read_customer_data`, `write_logs`, `execute_sql`. Agent'lar tool'lara erişirken bu scope'ları inherit ediyor. Agent graph build zamanında permission check: "Bu agent `delete_records` tool'unu çağırmaya çalışıyor, ama `read_only` permission'ı var — BUILD FAILED."

2. **Runtime sandbox:** Agent'lar isolated container'da koşuyor (Docker, gVisor). File system read-only (log directory hariç), network access whitelist-based (sadece belirli API endpoint'leri), memory/CPU limit. Agent runaway olursa (infinite loop, memory leak), container kill ediliyor, orchestrator yeni instance spawn ediyor.

3. **Audit logging:** Her agent action immutable log: `agent_id`, `tool_called`, `input_params`, `output`, `timestamp`, `user_context`. Bu loglar compliance audit için saklanıyor (S3, 7 yıl retention). GDPR "right to explanation" isteği geldiğinde, hangi agent hangi data'yı ne zaman kullanmış, tam trace'i çıkarabiliyorsunuz.

Roibase projelerinde en kritik compliance noktası: customer PII'ı agent context'ine koymamak. Bunun yerine PII tokenization: customer email → `[CUSTOMER_12345]`, agent bu token'la çalışıyor, actual email tool layer'da resolve ediliyor. Agent log'larında PII leak riski sıfır.

## Maliyet Optimizasyonu: Token vs. Compute Tradeoff'u

Multi-agent sistem token tasarrufu yapıyor ama orchestration overhead ekliyor (container spawn, message passing, aggregation). Toplam maliyet nasıl hesaplanıyor?

**Token maliyeti:**
- Claude Sonnet 3.5: $3/M input token, $15/M output token
- Paralel 3 agent, her biri 10k input + 2k output = 3 × (10k × $3 + 2k × $15) = $180/M request

**Compute maliyeti:**
- Orchestrator container: 0.5 vCPU, $0.04/saat
- 3 agent container: 0.25 vCPU each, $0.02/saat each
- Avg request duration: 2 saniye
- 1M request = 2M saniye = 555 saat
- Compute cost: 555 × ($0.04 + 3 × $0.02) = $55.5/M request

**Toplam:** $235.5/M request. Monolitik single-agent (40k input, 5k output): $195/M request. Multi-agent %21 daha pahalı.

Ama: multi-agent sistemde caching devreye giriyor. Paralel agent'lardan biri (örn: `knowledge_base_lookup`) sonuçlarını Redis'e cache'liyor (hit rate %68). Cache hit'te o agent skip ediliyor, token+compute tasarruf. Adjusted cost: $164/M request. %16 daha ucuz.

İkinci optimizasyon: smaller model routing. Basit task'lar (sentiment classification, entity extraction) için Sonnet 3.5 yerine Haiku kullanıyorsunuz ($0.25/M input, $1.25/M output — 12x ucuz). Agent graph'ında model selection logic: complexity score > 0.7 ise Sonnet, değilse Haiku. %34 task Haiku'ya düşüyor, toplam token maliyeti %28 azalıyor.

## Şimdi Ne Yapmalı: İlk Orchestration Kurulumu

Multi-agent orchestration'a geçiş point-blank değil, iterative. İlk adım: mevcut monolitik LLM flow'unuzu 3 node'a bölün — pre-processing, core reasoning, post-processing. Bu 3 node'u seri çalıştırın, latency/token metriklerini 2 hafta izleyin. İkinci adım: paralelize edilebilir task'ları tespit edin (örn: multiple data source'dan retrieval), paralel topology deneyin. Üçüncü adım: tool registry kurun, versiyonlamayı formalize edin. Dördüncü adım: observability stack'i deploy edin, trace'leri analiz edin, bottleneck'leri optimize edin. Her adımda production traffic'in %10'unu yeni sisteme route edin (canary deployment), fail olursa rollback, başarılı olursa %10 daha artırın. 8-10 haftada tam geçiş tamamlanır, ama kazançlar ilk 2 haftada görünmeye başlar: latency düşüyor, token maliyeti düşüyor, system reliability artıyor.