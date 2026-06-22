---
title: "Prompt Versiyonlama ve A/B Testi: LLM Operasyonun Disiplini"
description: "Promptfoo, LangSmith ve evaluation pipeline'larıyla prompt değişikliklerini ölçülebilir hale getirin. Production LLM operasyonunda versiyonlama ve A/B testi nasıl kurulur?"
publishedAt: 2026-06-22
modifiedAt: 2026-06-22
category: ai
i18nKey: ai-004-2026-06
tags: [prompt-engineering, llm-ops, evaluation, ab-testing, promptfoo]
readingTime: 8
author: Roibase
---

Production'da LLM çalıştırmak artık birkaç API çağrısından ibaret değil. Prompt değiştirdiğinizde output kalitesi %15 düşebilir veya %22 yükselebilir — ama bunu fark etmiyorsanız deployment rastgeleliğe dönüşür. Prompt versiyonlama ve A/B testi, yazılım deployment disiplinini LLM operasyonuna taşır. Bu yazı, Promptfoo, LangSmith gibi evaluation framework'lerini kullanarak prompt değişikliklerini ölçülebilir hale getirmeyi anlatıyor.

## Prompt değişikliği deployment değildir

Klasik yazılım engineering'de bir fonksiyon değiştiğinde unit test, integration test ve canary deployment süreçleri devreye girer. LLM operasyonunda ise çoğu ekip prompt'u düz text dosyasında değiştirir, birkaç manuel test yapar ve production'a yollar. Sonuç: kullanıcı sentiment'ı %8 düşer ama kimse ilişkilendiremez.

Sorun şu: LLM output deterministik değil. Aynı prompt'a farklı yanıtlar alırsınız, bu da tek örnekle test yapmayı anlamsız kılar. Versiyonlama sistemi olmadan "eski prompt mu iyiydi yoksa yeni mi?" sorusuna cevap veremezsiniz. Git commit'i bile yetmez — çünkü semantic farklılığı commit message'dan çıkaramazsınız.

Çözüm: her prompt değişikliğini versiyon olarak kaydedin, değişiklik öncesi ve sonrası için eval set çalıştırın, metrikleri karşılaştırın. Bu disiplin iki şey sağlar: regression detection (yeni prompt'un eski görevleri bozup bozmadığı) ve improvement measurement (hedeflediğiniz metriğin gerçekten yükselip yükselmediği).

## Evaluation pipeline nasıl kurulur

Evaluation pipeline üç component'ten oluşur: eval set, eval metriği, runner. Eval set, LLM'e gönderilecek input'lar ve beklenen output'ların (veya output özelliklerinin) listesidir. JSON formatında şöyle görünür:

```json
[
  {
    "input": "2025 Q1 revenue trend'ini özetle",
    "expected_topics": ["revenue", "growth", "quarter"],
    "expected_sentiment": "neutral"
  },
  {
    "input": "Churn rate'in neden yükseldiğini açıkla",
    "expected_topics": ["churn", "retention"],
    "expected_sentiment": "analytical"
  }
]
```

Eval set'i manuel oluşturabilirsiniz (production loglarından örnekleme yaparak) veya sentetik olarak üretebilirsiniz (başka bir LLM'e "bu prompt için 50 farklı sorgu varyasyonu üret" diye sorarak). Önemli olan set'in edge case'leri kapsaması — örneğin uzun input, belirsiz sorgu, çoklu dil.

Eval metriği, LLM output'unu nasıl puanlayacağınızı tanımlar. İki tip yaygın: rule-based (output'ta belirli kelimelerin varlığını kontrol etmek) ve LLM-as-judge (başka bir LLM'e "bu output soruyu doğru yanıtlıyor mu 1-5 arası puanla" diye sormak). LLM-as-judge daha esnek ama daha pahalı ve yavaş. Hem hız hem accuracy dengesi için rule-based + lightweight classifier (BERT-based sentiment model gibi) kombinasyonu tercih edilebilir.

Runner, eval set'i alır, her input için eski ve yeni prompt'u çalıştırır, output'ları metrikle karşılaştırır ve diff tablosunu üretir. Promptfoo bunu terminalden `promptfoo eval` komutuyla yapar:

```bash
promptfoo eval \
  --prompts prompts/v1.txt prompts/v2.txt \
  --providers openai:gpt-4 \
  --tests evals/summarization.json \
  --output results.json
```

Output'ta her test case için hangi prompt'un daha iyi performans verdiğini görürsünüz. Eğer yeni prompt eval set'in %80'inde metrik puanını artırmışsa deployment'a hazırdır. Değilse regression var demektir, prompt'u gözden geçirmelisiniz.

## A/B testi: production'da iki prompt'u paralel çalıştırmak

Eval pipeline offline sonuç verir — gerçek kullanıcı verisi yoktur. Production'da iki prompt'u aynı anda çalıştırıp hangisinin daha iyi sonuç verdiğini ölçmek için A/B testi gerekir. Bunun için trafik splitting ve metric collection altyapısı kurulur.

Trafik splitting basit: gelen request'e `user_id` veya `session_id` hash'leyip modulo alırsınız, sonuca göre prompt A veya B'ye yönlendirirsiniz. Örneğin `hash(user_id) % 100 < 50` ise prompt A, değilse B. Bu sayede %50-%50 split yaparsınız. Önemli nokta: aynı kullanıcı her request'te aynı prompt'u görmeli (sticky assignment) — yoksa kullanıcı deneyimi tutarsız olur.

Metric collection için LLM response'unun yanına metadata eklenir: `prompt_version`, `latency`, `token_count`. Sonra bu data warehouse'a (BigQuery, Snowflake) akar. Roibase'in [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) pipeline'ı bu noktada devreye girer — LLM loglarını diğer olay verisiyle (kullanıcı eylemi, conversion, churn) birleştirip prompt'un downstream etkisini ölçebilirsiniz.

A/B testinde hangi metrikleri izlersiniz? Üç kategori:

| Metrik tipi | Örnek | Hedef |
|---|---|---|
| Kalite | LLM-as-judge puanı, hallucination oranı | Yüksek |
| Maliyet | Token count, API cost | Düşük |
| Downstream | Conversion rate, kullanıcı engagement | Yüksek |

Örneğin prompt B, prompt A'ya göre LLM-as-judge puanını %12 artırıyor ama token sayısını %35 artırıyorsa tradeoff var demektir. Eğer downstream conversion'da fark yoksa prompt A daha verimlidir.

## LangSmith ve observability

LangSmith, LangChain ekibinin geliştirdiği bir LLM observability platformudur. Evaluation'ın ötesinde production trace'lerini yakalar, prompt chain'lerini görselleştirir, hangi adımda latency arttığını gösterir. Özellikle multi-step LLM workflow'larında (RAG + summarization + JSON parsing gibi) debugging kritiktir.

LangSmith'e trace göndermek için SDK kullanırsınız:

```python
from langsmith import Client
client = Client(api_key="...")

with client.trace(name="summarize_revenue"):
    result = llm.invoke(prompt)
    client.log_metric("token_count", result.usage.total_tokens)
```

Her trace LangSmith UI'da görünür, input/output/metadata tam loglanır. Birden fazla prompt versiyonu varsa karşılaştırma görünümü açabilirsiniz. UI'da "prompt v2, v1'e göre ortalama %8 daha uzun output üretiyor ama latency %3 düşük" gibi insight'ları görürsünüz.

LangSmith ayrıca playground sağlar — prompt'u değiştirip tek tuşla birden fazla input'a karşı test edebilirsiniz. Bu hem prototyping hem de regression test için hızlı feedback döngüsü oluşturur. Ama dikkat: playground'da test etmek production A/B testinin yerini tutmaz, sadece ilk filtre sağlar.

## Prompt versiyonlamanın ikinci etkisi: rollback

Deployment hatası olduğunda rollback yapabilmek kritiktir. LLM operasyonunda rollback, önceki prompt versiyonuna geri dönmek demektir. Ama bunu yapabilmek için prompt'ların versiyon tarihi kurulması gerekir.

Basit yaklaşım: her prompt'u git'te ayrı dosyada tutmak (`prompts/summarization_v3.txt`). Deployment script, hangi versiyonun production'da olduğunu bir config dosyasında saklar:

```yaml
# config/production.yaml
prompts:
  summarization: v3
  classification: v2
```

Rollback yapmak için `summarization: v2` yazıp deployment'ı tetiklersiniz. Ama bu manuel süreçtir, incident'ta yavaş kalırsınız. Daha gelişmiş yaklaşım: feature flag sistemi (LaunchDarkly, Unleash) kullanmak. Flag'le prompt versiyonunu runtime'da değiştirirsiniz, code deploy etmeden geçiş yaparsınız.

Roibase'in [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) pratikleri burada devreye girer — prompt değişikliği ile downstream event'leri (conversion, churn) ilişkilendirmeniz gerekir ki rollback kararını sayısal temele oturtun. Eğer yeni prompt deployment'ından 6 saat sonra churn rate %4 yükseldiyse prompt'u rollback etmenin sinyali budur.

## Edge case: çok dilli prompt versiyonlama

Eğer LLM uygulamanız çok dilde çalışıyorsa (örneğin TR, EN, DE) her dil için ayrı prompt versiyonu tutmanız gerekir. Çünkü İngilizce'de iyi çalışan bir prompt Türkçe'de aynı ton'u vermeyebilir.

Çözüm: prompt dosyalarını dil koduna göre organize edin:

```
prompts/
  summarization/
    en_v3.txt
    tr_v3.txt
    de_v3.txt
```

Eval set de dile özel olmalı — Türkçe test case'lerde Türkçe output beklentisi koyun. A/B testi dil bazında ayrı çalıştırın, çünkü TR kullanıcılarının davranışı EN kullanıcılardan farklıdır. Metrik aggregation'ında language segment eklemeyi unutmayın.

Bir diğer dikkat noktası: çok dilli prompt'ta context uzunluğu dile göre değişir — Türkçe cümle ortalama %12 daha uzundur (token bazında). Bu da token limit'e çarpma riski demektir. Eval pipeline'ınıza token count kontrolü ekleyin, threshold aşımında warning verin.

## Pratik adım: ilk prompt eval set'inizi kurun

Yazıda anlatılan sistemi kurmak için ilk adım: 20-30 gerçek kullanıcı sorgusundan oluşan minimal eval set. Production loglarınızı açın, en sık gelen sorguları seçin, her biri için beklenen output özelliklerini tanımlayın (doğruluk, ton, uzunluk gibi).

Sonra Promptfoo veya LangSmith'i kurun, mevcut prompt'unuzu bu set'e karşı çalıştırın, baseline skor alın. Şimdi prompt'ta küçük bir değişiklik yapın (örn: "kısa ve net cevap ver" ekleyin), yeniden eval çalıştırın, skorları karşılaştırın. Eğer %5'ten fazla regresyon yoksa değişikliği deploy edin.

Bu döngü otomatik hale geldiğinde prompt iteration hızınız 3x artar. Çünkü artık "acaba bu değişiklik iyi mi kötü mü" sorusuna tahminle değil, sayıyla cevap verirsiniz.