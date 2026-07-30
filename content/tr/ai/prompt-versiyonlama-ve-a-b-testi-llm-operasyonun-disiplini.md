---
title: "Prompt Versiyonlama ve A/B Testi: LLM Operasyonun Disiplini"
description: "Promptfoo ve LangSmith ile LLM çıktılarını nasıl sistematik olarak test edersiniz? Production-grade AI uygulamalarında evaluation pipeline kurma pratiği."
publishedAt: 2026-07-30
modifiedAt: 2026-07-30
category: ai
i18nKey: ai-004-2026-07
tags: [llm-ops, prompt-engineering, evaluation, ab-testing, mlops]
readingTime: 8
author: Roibase
---

Production'da LLM kullanmaya başladığınız an, klasik yazılım mühendisliğinin "test suite" disiplinine ihtiyacınız olduğunu fark edersiniz. Prompt değiştirdiğinizde çıktı tutarlılığı ne oluyor? Model versiyonu yükselttiğinizde maliyet-kalite dengesi nasıl değişiyor? "Claude daha iyi yanıt verdi" hissini nasıl sayısal metriğe dönüştürüyorsunuz? LLM operasyonlarının olgunlaştığı 2026'da, bu soruları manuel değil sistematik cevaplayanlar kazanıyor. Promptfoo, LangSmith gibi araçlar ve evaluation pipeline'ları LLM'i production'da tutmanın sigortası.

## Prompt Değişikliği = Kod Değişikliği

Bir pazarlama içerik üretim workflow'unuz var. Claude API'ye prompt gönderiyorsunuz, blog taslağı alıyorsunuz. İlk versiyonda "yaz" diyorsunuz, ikinci versiyonda system prompt'una "Roibase için yaz, mühendislik tonunda yaz" ekliyorsunuz. Üçüncü versiyonda "YASAK KELİMELER" listesi koyuyorsunuz. Her değişiklik çıktıyı etkiliyor ama etkiyi nasıl ölçüyorsunuz?

Klasik yazılımda unit test var — fonksiyon girdisi sabit, çıktısı deterministik. LLM'de girdi sabit ama çıktı stokastik. Tek run'la karar veremezsiniz. Aynı prompt'u 10 farklı seed ile koşturmalı, ortalama token count, latency, coherence skoruna bakmalısınız. Bu yüzden **prompt versiyonlama** kod versiyonlama kadar kritik. Git commit'le prompt değişikliği izliyorsunuz ama çıktıyı izlemiyor olabilirsiniz. Burada evaluation suite devreye giriyor: her commit'te otomatik test koşuyor, metrik regresyonu görüyorsunuz.

Somut senaryo: n8n workflow'unuzda Claude'a içerik ürettiriyorsunuz. Prompt'a "1500 kelime" yerine "1400-1600 kelime" yazınca ortalama uzunluk 1520'den 1480'e düşüyor, token maliyeti %3 azalıyor ama readability skoru 0.2 puan kaybediyor. Bu tradeoff'u manuel denemeden görmek için otomatik eval pipeline şart.

## Promptfoo: Regression Test Suite for Prompts

Promptfoo açık kaynak bir CLI aracı — prompt'ları YAML config ile tanımlıyorsunuz, test caseleri CSV veya JSON'da veriyorsunuz, assertionlar yazıyorsunuz. `promptfoo eval` komutu tüm varyantları koşturuyor, başarı/başarısızlık tablosu veriyor.

Tipik bir `promptfoo.yaml` şöyle görünür:

```yaml
prompts:
  - id: baseline
    text: "Write a blog post about {{topic}}"
  - id: roibase-tone
    text: "Write a blog post about {{topic}}. Use engineering discipline tone. No hype words."

providers:
  - anthropic:messages:claude-3-5-sonnet-20241022

tests:
  - vars:
      topic: "server-side GTM setup"
    assert:
      - type: contains
        value: "first-party"
      - type: javascript
        value: output.length > 1400 && output.length < 1600
      - type: cost
        threshold: 0.05
```

Bu config'i çalıştırdığınızda Promptfoo her iki prompt'u da Claude'a gönderiyor, assertion'lara bakıyor: "first-party" kelimesi geçiyor mu, 1400-1600 kelime arasında mı, API maliyeti 0.05 doların altında mı? Başarısızlık varsa hangi prompt'ta olduğunu gösteriyor. CI/CD'ye entegre ederseniz prompt değişikliği pull request'te otomatik test ediliyor — klasik unit test gibi.

### Neden Manuel Değil de Otomasyon?

Manuel test: Claude'a 5 farklı konu gönderirsiniz, çıktıları gözle tarasınız, "iyi" dersiniz. Sonraki gün prompt'u değiştirirsiniz, tekrar manuel test edersiniz. 10. iterasyonda hangi değişikliğin hangi metriği nasıl etkilediğini unutursunuz.

Otomasyon: 50 test case'iniz var (GSC'den çektiğiniz gerçek keyword'ler), her prompt değişikliğinde otomatik koşuyor. Regresyon tablosu: "baseline prompt'ta ortalama 1520 kelime, yeni prompt'ta 1480 — %2.6 düşüş". Karar metrikle alınıyor, hissle değil.

## LangSmith: Production Observability

Promptfoo geliştirme zamanı test aracı. LangSmith (LangChain ekibinin ürünü) production'da ne olduğunu izlemenizi sağlıyor. Her LLM çağrısı LangSmith'e loglanıyor: input, output, latency, token count, metadata. Dashboard'da trace görüntülüyorsunuz — retrieval, prompt construction, LLM call, post-processing chain'ini adım adım takip ediyorsunuz.

Örnek: Roibase'de [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) çalışmalarında ChatGPT citation'larını izlemek için LLM pipeline kuruyoruz. Pipeline: kullanıcı sorusu → embedding → Pinecone retrieval → context injection → Claude → citation extraction. LangSmith her adımı kaydediyor. Citation rate %15'in altına düşerse alert geliyor — prompt drift veya retrieval kalite problemi anında fark ediliyor.

### Tracing vs Logging

Klasik logging: "Claude API'ye şu prompt'u gönderdim, şu yanıtı aldım" kaydı. Trace: "Retrieval 120ms sürdü, 5 döküman geldi, prompt construction 15ms, Claude 2.3 saniye, toplam latency 2.45 saniye — SLA ihlali yok". Trace end-to-end pipeline'ı görmenizi sağlıyor. LLM chain'lerde bottleneck bulmak kritik: retrieval yavaşsa database index optimizasyonu, LLM yavaşsa model versiyonu veya prompt token sayısı azaltma.

Production'da A/B test yaparken de LangSmith kullanılıyor: trafiğin %50'si baseline prompt, %50'si yeni prompt — her variant için ayrı trace grubu, metrik karşılaştırması real-time. Baseline 2.1 saniye ortalama latency, yeni prompt 1.9 saniye ama output quality skoru 0.85'ten 0.80'e düşüyor — tradeoff tablosu canlı.

## Evaluation Pipeline: Otomatik Kalite Skoru

LLM çıktısı subjektif — "iyi mi kötü mü" sorusunu nasıl otomatikleştiriyorsunuz? İki yöntem: rule-based assertion ve LLM-as-a-judge.

**Rule-based:** Promptfoo'daki `contains`, `length`, `regex-match` gibi assertionlar. "1400-1600 kelime", "hiç ünlem işareti yok", "en az 1 iç link var" gibi kurallar. Hızlı, deterministik ama semantik kaliteyi ölçmüyor.

**LLM-as-a-judge:** Başka bir LLM'e (genelde GPT-4 veya Claude) çıktıyı değerlendirtiyorsunuz. Örnek: "Bu blog yazısı mühendislik tonunda mı? 1-10 arası puan ver." Judge model 7.5 verirse geçiyor, 6 verirse başarısız. Bu yöntem semantik kaliteyi yakalar ama non-deterministik — judge model'in kendisi stokastik. Çözüm: her eval'u 3 kez koşturup ortalama almak.

Roibase'in içerik üretim workflow'unda eval pipeline şöyle:

1. Claude'a blog taslağı ürettiriyoruz
2. Taslağı Promptfoo'ya gönderiyoruz
3. Rule-based: kelime sayısı, iç link sayısı, yasak kelime kontrolü
4. LLM-as-a-judge: GPT-4'e "tone uyumu 1-10" puanı verdiriyoruz
5. Tüm metrikler Notion'a kaydediliyor
6. Ortalama puan 8'in altına düşerse Slack alert

Bu pipeline sayesinde 1000 makale ürettiğinizde kalite standartı korunuyor. Manuel QA ekibi her makaleyi okumak yerine sadece eval başarısızlıklarına bakıyor — %90 zaman tasarrufu.

## A/B Test: İki Prompt, İki Maliyet-Kalite Dengesi

Production'da prompt A/B testi klasik feature flagging gibi çalışıyor. LaunchDarkly veya custom flag servisi kullanıyorsunuz: kullanıcı grubunun %50'sine prompt_v1, %50'sine prompt_v2 sunuyorsunuz. Her variant için metrik topluyorsunuz: ortalama token count, latency, downstream dönüşüm (örneğin blog taslağını editör onaylıyor mu?).

Somut örnek: Roibase'de category-specific guidance eklediğimiz yeni prompt versiyonunu test ediyoruz. Baseline prompt genel, yeni prompt kategori bazlı ek talimat içeriyor. A/B test 2 hafta koşuyor:

| Metrik | Baseline | Yeni Prompt | Delta |
|---|---|---|---|
| Ortalama token (input+output) | 3200 | 3450 | +7.8% |
| Ortalama latency (saniye) | 2.1 | 2.3 | +9.5% |
| Maliyet/makale ($) | 0.042 | 0.046 | +9.5% |
| Editor onay oranı | 72% | 81% | +12.5% |
| İç link doğruluk oranı | 65% | 89% | +36.9% |

Yeni prompt %10 daha pahalı ama editör onay oranı %12.5 artıyor — editör revizyon maliyeti daha düşüyor. İç link doğruluğu %36.9 artıyor — SEO kazanımı maliyeti karşılıyor. Karar: yeni prompt kazanıyor, production'a geçiyor.

A/B test süresince LangSmith'te her variant için ayrı trace grubu oluşturuluyor. Anomali görürseniz (örneğin yeni prompt'ta %5 HTTP 429 rate limit hatası) hemen fark ediyorsunuz.

## Versiyonlama: Git + Metadata

Prompt versiyonunu kod gibi Git'te tutuyorsunuz ama metadatası ayrı. `prompts/` klasörü:

```
prompts/
  roibase-blog-v1.md
  roibase-blog-v2.md
  roibase-blog-v3.md
```

Her dosya frontmatter metadata içeriyor:

```markdown
---
version: 3
model: claude-3-5-sonnet-20241022
temperature: 0.7
max_tokens: 8000
created: 2026-07-15
deprecated: false
test_suite: promptfoo-blog-eval.yaml
---

# ROL
Sen Roibase için yazıyorsun.
...
```

Git commit mesajı: "prompt v3: category-specific guidance eklendi, yasak kelime listesi genişletildi". CI/CD bu commit'i görünce otomatik Promptfoo test suite'ini koşturuyor. Test başarılı geçerse staging ortamına deploy ediliyor, 24 saat A/B test koşuyor, başarılı olursa production'a geçiyor.

Versiyonlama sayesinde rollback hızlı: production'da sorun çıkarsa `git revert`, 5 dakikada eski prompt aktif.

## Maliyet Optimizasyonu: Token Audit

LLM uygulamalarında maliyet genelde input token + output token hesabıyla belirleniyor. Claude Sonnet 3.5 API fiyatı: $3/1M input token, $15/1M output token (2026 fiyatı). 1500 kelimelik blog taslağı ~2000 output token, system prompt + user prompt ~1200 input token — makale başına ~$0.042.

Aylık 1000 makale üretiyorsanız $42. Prompt'u optimize edip output token'ı %10 azaltırsanız aylık $6.3 tasarruf — yıllık $75.6. Küçük görünüyor ama ölçeklendikçe büyüyor. 10,000 makale/ay'da $756/yıl.

Promptfoo eval suite'ine maliyet assertion ekliyorsunuz:

```yaml
assert:
  - type: cost
    threshold: 0.045
```

Prompt değişikliği sonrası maliyet 0.045 doları geçerse test başarısız oluyor. Bu threshold'u business metrikle (editör onay oranı, dönüşüm) bağlantılı olarak ayarlıyorsunuz.

Token audit için LangSmith trace'lere bakıyorsunuz: hangi prompt component'i en çok token tüketiyor? Örneğin system prompt'taki "YASAKLAR" bölümü 300 token — gerçekten her çağrıda gerekli mi, yoksa retrieval ile contexte göre injection yapılabilir mi? [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) çalışmalarımızda context injection stratejisi kullanıyoruz: prompt'u modüler yapıyoruz, kullanıcı segmentine göre sadece gerekli modülleri ekliyoruz — %15-20 token tasarrufu.

## Şimdi Ne Yapmalı

Production'da LLM kullanıyorsanız prompt değişikliklerini manuel test etmeyi bırakın. Promptfoo kurarak başlayın: 10 test case, 3 assertion (kelime sayısı, maliyet, semantik keyword kontrolü). CI/CD'ye entegre edin — her PR'da otomatik test. Sonraki adım: LangSmith veya benzeri observability aracı ekleyin, production trace'leri izleyin. A/B test için feature flag sistemi kurun, yeni prompt versiyonlarını %10 trafikle pilot edin. Bu disiplin LLM operasyonunu "çalışıyor gibi" seviyesinden "ölçülebilir, optimize edilebilir" seviyesine çıkarır. Prompt artık kod — kod gibi test edin, versiyonlayın, deploy edin.