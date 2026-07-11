---
title: "Prompt Versiyonlama ve A/B Testi: LLM Operasyonun Disiplini"
description: "Production LLM sistemlerinde prompt değişikliklerini test etmek, versiyonlamak ve geriye dönmek mühendislik disiplini gerektirir. Promptfoo ve LangSmith ile nasıl?"
publishedAt: 2026-07-11
modifiedAt: 2026-07-11
category: ai
i18nKey: ai-004-2026-07
tags: [llm-ops, prompt-engineering, evaluation, ab-testing, langsmith]
readingTime: 8
author: Roibase
---

Production'da LLM kullanan herkes aynı soruyla karşılaşır: prompt'u değiştirdin, output daha iyi mi oldu? "Sanki daha tutarlı" demek yeterli değil. Bir pazarlama ekibi Claude API'den her gün 500 blog başlığı üretiyorsa, prompt'taki "yaratıcı ol" ile "satışçı ol" arasındaki fark binlerce dolarlık conversion farkı yaratabilir. Bu farkı ölçmeden push etmek mühendislik değil, şans oyunudur. Prompt versiyonlama ve evaluation pipeline'ları LLM operasyonunu tahmine dayalı deneyciliğe çevirir.

## Prompt Değişikliği Neden Kod Değişikliğinden Farklı

Klasik yazılımda `if (x > 5)` yerine `if (x >= 5)` yazdığında birim testleri kırılır, davranış deterministiktir. Prompt değişikliği stokastiktir: aynı input'a farklı output verir, regresyon testleri yoktur, "eskisinden kötü" tanımı muğlaktır. GPT-4'e "kısa yaz" dediğinde bir gün 50 kelime, bir gün 120 kelime döner. Bu belirsizlik, "production'a al / alma" kararını metriksiz yapılamaz hale getirir.

İkinci fark kontrol noktası sayısıdır. Kod değişikliği deployment pipeline'da unit test, integration test, staging geçer. Prompt değişikliği çoğu ekipte "Claude UI'da denedim iyi geldi" ile production'a gider. Sonuç: iki hafta sonra "yeni prompt'lar çok jargon kullanıyor" şikayeti gelir, eski versiyona dönmek için git commit'e bakmak zorunda kalırsınız.

Üçüncü fark, etkinin gecikmeyle görünmesidir. Yeni prompt'la üretilen içerik SEO'da iki ay sonra düşüş getirebilir, chatbot output'u müşteri memnuniyetini kademeli aşındırabilir. Kod bug'ı sentry'de hemen alarm verir, prompt regresyonu sessizce birikir.

## Evaluation Pipeline'ı Kurmanın Anatomisi

Evaluation pipeline üç katmandan oluşur: dataset, judge, report. Dataset production'dan örneklenmiş input'lardır — generic "test prompt" değil, gerçek kullanıcı sorguları. Örneğin, bir müşteri destek chatbot'u için dataset 100 adet tickettan input-output çiftidir. Bu çiftleri elle etiketleyeceksiniz: "hallucination var", "tone yanlış", "factually correct". Dataset static bir fixture değil, production'dan her hafta refresh edilir.

Judge, output'u skorlayan mekanizmadır. Basit yol: regex/keyword matching ("output 'üzgünüz' içermeli"). Orta yol: başka bir LLM'i judge olarak kullanmak (GPT-4 "bu output faydalı mı 1-5 skorla" diye sorar). İleri yol: custom classifier train etmek (BERT-based binary classifier: hallucination var/yok). Judge'ın kendisi de versiyonlanmalıdır — judge değişirse score'lar değişir, trend kırılır.

Report katmanı, A/B testini karara dönüştürür. İki prompt versiyonu var: `baseline` (production) ve `candidate` (test ediyorsun). Her ikisini de aynı dataset'e koşarsın, judge skorları toplanır. Report: "candidate 12% daha yüksek factual accuracy, ama 8% daha uzun latency". Karar: latency artışı kabul edilebilir mi? Bunu metrikle cevaplarsın (örn: 95th percentile latency SLA'yı geçti mi?).

### Promptfoo ile Basit Eval Setup

Promptfoo açık kaynak bir CLI tool'udur, config-based eval yaparsınız:

```yaml
# promptfoo.yaml
prompts:
  - file://prompts/v1-baseline.txt
  - file://prompts/v2-candidate.txt

providers:
  - openai:gpt-4
  - anthropic:claude-3-opus-20240229

tests:
  - vars:
      user_query: "Siparişim ne zaman gelir?"
    assert:
      - type: contains
        value: "kargo takip"
      - type: llm-rubric
        value: "Yanıt müşteriye empati gösteriyor mu?"

  - vars:
      user_query: "İade nasıl yaparım?"
    assert:
      - type: not-contains
        value: "maalesef yapamayız"
```

`promptfoo eval` komutu her prompt × her test case'i koşar, assertion'ları kontrol eder, tablo çıktısı verir: hangi prompt hangi test'te başarısız. Burada `llm-rubric` assertion başka bir LLM'i judge yapıyor (Promptfoo bunu otomatik çağırır). A/B farkını görmek için `promptfoo view` web UI açar, iki prompt'u side-by-side karşılaştırırsınız.

Promptfoo'nun avantajı hızdır: 50 test case 2 dakikada koşar, CI/CD'ye entegre edilir (`promptfoo eval --assertions` exit code 1 döner test fail olursa). Dezavantajı: production trace'leriyle entegre değil, manuel export etmelisiniz.

## LangSmith ile Production Trace Tabanlı Eval

LangSmith (LangChain ekibinin ürünü) production LLM run'larını otomatik log'lar, sonra o log'lar üzerinde eval koşarsınız. Akış: uygulamanız LangChain SDK kullanıyorsa her LLM call LangSmith'e trace gider (input, output, latency, cost). LangSmith UI'da "son 7 gün içinde customer_support tag'li run'lar" diye filtre çekersin, 200 örnek seçersin, "create dataset" dersin. Bu dataset artık versiyonlanmıştır — `2026-07-01-support-sample` adıyla kaydedilir.

Şimdi yeni bir prompt'u test etmek istiyorsun. LangSmith "Playground" bölümünde prompt'u değiştirir, "Run on dataset" dersin, 200 örneği bu yeni prompt'la koşar. Sonuçlar yan yana gelir: eski output vs yeni output. Sen veya judge modelini annotation'a sokarsın: thumbs up/down, ya da custom score (1-5). LangSmith bu skorları aggregate eder, örneğin: "yeni prompt thumbs-up oranı %78, eski %65".

LangSmith'in gücü trace context'idir. Sadece prompt değil, retrieval step'i de trace'te görünür. Örneğin RAG sisteminde prompt'u değiştirdin, ama aslında sorun retrieval'daydı — yanlış dokümanlar geliyordu. Trace'e bakınca görürsün: "yeni prompt daha iyi cevap veriyor çünkü retrieval query'sini değiştirdim". Bu insight Promptfoo'da yoktur (Promptfoo sadece final output'a bakar).

LangSmith'in tradeoff'u lock-in'dir: LangChain ekosistemini kullanman gerekir. Pure Anthropic SDK veya OpenAI SDK kullanıyorsan manuel tracing kod yazarsın (her call'u LangSmith API'ye gönder). Alternatif: Roibase'in [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) yaklaşımı — LLM trace'leri kendi data warehouse'ınıza sink edersiniz, eval'i BigQuery'den koşarsınız.

## Eval Metriklerini Neye Göre Seçiyorsun

Metric seçimi use case'e göre değişir. Content generation için metric: "output keyword density hedefte mi?", "tone brand guideline'a uyuyor mu?", "factual hallucination var mı?". Chatbot için: "query çözüldü mü?", "response latency SLA içinde mi?", "kullanıcı takip sorusu sordu mu?". Her metric için judge tanımlamak zorundasın.

İyi bir eval suite en az 3 metric katmanı içerir:

| Katman | Örnek Metrikler | Judge Tipi |
|--------|-----------------|------------|
| **Functional** | Output formatı doğru (JSON parse edilebilir mi?), mandatory keyword içeriyor mu? | Regex/deterministic |
| **Quality** | Tone uygunluğu, factual accuracy, hallucination | LLM-as-judge (GPT-4-turbo puanla) |
| **Business** | Conversion prediction, engagement estimate | Custom model (XGBoost tahmin: bu output satışa dönüşür mü?) |

Functional metrikler ucuzdur, hızlı koşar, regression guard'dır. Quality metrikler pahalıdır (judge LLM call'ı maliyetli), ama insan değerlendirmesine en yakın proxy'dir. Business metrikler en değerlidir ama train etmek zordur — conversion data'sı ile output'u eşleştirmek gerekir.

Promptfoo ve LangSmith ikisi de LLM-as-judge destekler. Örneğin Promptfoo `llm-rubric` assertion'ı GPT-4'e şu prompt'u gönderir: "Aşağıdaki output [kriteriniz] açısından 1-10 skorlayın, sadece sayı dönün". LangSmith'te "Evaluator" tanımlarsınız, örneğin: "Anthropic Claude Haiku ile 'empati var mı?' sorusunu sor, cevabı bool'a çevir".

## A/B Testini Production'a Taşımak

Offline eval geçtikten sonra production A/B testi gelir. İki strateji var: shadow deployment ve gradual rollout. Shadow deployment'ta yeni prompt production trafiğini alır ama output kullanıcıya gösterilmez — sadece log'lanır, baseline ile karşılaştırılır. Bir hafta shadow koşar, metrikler anlamlı fark göstermezse yeni prompt ölür.

Gradual rollout: %5 trafiğe yeni prompt, %95'e baseline. İki hafta koşar, business metrikler (örn: chatbot'ta session resolution rate) izlenir. %5'te sorun yoksa %25'e çıkar, sonra %50, sonra %100. Her aşamada KPI'lar düşerse rollback.

Rollback mekanizması olmazsa olmazdır. Git commit'le prompt versiyonlamak yeterli değil — production deployment'ı da versiyonlaman gerekir. Örnek: n8n workflow'unda prompt'ı GitHub'dan raw URL ile çekiyorsan, URL'de commit hash olmalı: `github.com/.../prompt.md?ref=abc123`. Rollback: hash'i eski commit'e döndür, workflow redeploy (30 saniye). Feature flag sistemi daha sofistike: LaunchDarkly tarzı tool'la prompt version'ı runtime'da toggle edersin, deployment yok.

## Eval Budget ve Otomasyon

Production LLM sisteminin eval budget'ı LLM API maliyetinin %10-20'si olmalıdır. Eğer ayda 5.000$ Claude call'ı yapıyorsan, 500-1.000$ eval'e ayır. Bu budget: dataset refresh (her hafta 100 yeni örnek), judge LLM call'ları (örnek başına 2 call = 200 örnek × 2 × $0.01 = 4$), ve human labeling (kritik edge case'leri insan etiketler, saat başı ücret).

Otomasyonu şu şekilde kur:

1. **CI eval:** Her prompt commit'inde Promptfoo baseline'a karşı koşar, functional metric fail olursa PR merge edilmez.
2. **Nightly eval:** Her gece production'dan yeni dataset sample'lanır, candidate prompt'lar koşar, Slack'e rapor gider.
3. **Weekly review:** Pazartesi sabahı ekip LangSmith dashboard'a bakar, quality metric trendleri gözden geçirilir, yeni experiment kararı alınır.

Otomasyon olmadan eval ölü doğar. "Manuel test edeceğiz" dediğinizde kimse etmez, iki ay sonra production prompt chaos'a dönüşür.

## Karşı Argüman: Eval Gerçek Kullanıcıyı Yakalayamaz

Eval'in limiti: judge ne kadar iyi olursa olsun, gerçek kullanıcı davranışını tahmin edemez. LLM-as-judge "bu tone iyi" diyebilir, ama kullanıcı bounce edebilir. Çözüm: eval'i A/B testi ile tamamlamak, evaluation'ı "go/no-go gate" değil "risk filtresi" olarak kullanmak. Eval pass etti = production'da %5 trafik almaya hak kazandı, ama nihai karar KPI'lardandır.

İkinci karşı argüman maliyet: eval pipeline kurmak zaman alır (2-3 hafta), judge LLM call'ları birikir. Prompt değişikliği ayda 1 kere oluyorsa, pipeline overhead haklı çıkmaz. Cevap: prompt değişikliği ayda 1 kere oluyorsa LLM stratejinizi gözden geçirin — production'da iterasyon hızınız yavaştır, bu büyüme mühendisliği değildir.

Nihai soru: eval'siz gitmek daha mı riskli, yoksa eval overhead'i mi? Eğer LLM output'u revenue-critical ise (örn: product recommendation, customer support, [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) citation'ı), cevap açık: eval yoksa flying blind'sınız. Eğer output secondary ise (örn: internal tool'da özet yapma), manual QA yeterli olabilir.

## Şimdi Neyle Başlıyorsun

Eğer LLM production'dasınız ama eval pipeline'ınız yoksa: bu hafta Promptfoo kur, 20 test case yaz, CI'a ekle. Git commit message'ı: "Add baseline prompt eval". Bir ay içinde: production'dan 100 örnek dataset yarat, LangSmith trial başlat (veya kendi trace log'unu BigQuery'ye aktar), ilk A/B testini shadow mode'da koş. Üç ay içinde: eval otomasyonu canlı, her prompt değişikliği metric diff'i ile merge ediliyor, rollback mekanizması 1 komut.

Prompt versiyonlama ve eval, LLM operasyonunu tahmin oyunundan çıkarıp mühendislik disiplinine sokar. "Yeni prompt daha iyi geldi" demek yerine "candidate prompt baseline'a göre %12 daha yüksek factual accuracy, %3 daha düşük latency" dersiniz. Bu fark, LLM'in production'da güvenilir bir sistem olması ile deney olarak kalması arasındaki çizgidir.