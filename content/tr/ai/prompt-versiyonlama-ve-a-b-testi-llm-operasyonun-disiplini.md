---
title: "Prompt Versiyonlama ve A/B Testi: LLM Operasyonun Disiplini"
description: "Promptfoo ve LangSmith ile prompt eval pipeline'ı kurmak. Production LLM workflow'larında regresyonu önleme, maliyet-kalite tradeoff'unu ölçme yöntemi."
publishedAt: 2026-06-04
modifiedAt: 2026-06-04
category: ai
i18nKey: ai-004-2026-06
tags: [llm-operations, prompt-engineering, evaluation, mlops, ai-testing]
readingTime: 8
author: Roibase
---

Production'da LLM çalıştıran her ekip aynı döngüyü yaşıyor: prompt'u geliştiriyorsun, çıktı iyileşiyor, sonra başka bir kullanım senaryosunda performans düşüyor. Değişikliği geri alıyorsun, ilk durum bozuluyor. Versiyonsuz prompt iteration'ı sonsuz regresyon döngüsü. Claude API'den cevap çekip "iyi gibi" demek product operasyonu değil — software engineering değil. 2026'da prompt'u kod gibi test etmeyen ekip, her deploy'da güven kaybediyor. Promptfoo, LangSmith ve evaluation framework'leri bu disiplini getiriyor: prompt değişikliğinin etkisini sayıyla görmek, A/B test etmek, rollback yapabilmek.

## Prompt Versiyonlama Neden Zorunlu Hale Geldi

LLM çıktısı deterministik değil. Aynı prompt, farklı zamanlarda farklı yanıt üretebilir (temperature > 0 olduğu sürece). Bu randomness, "bugün çalışıyor" gözlemini güvenilmez kılıyor. Bir adım ileri: prompt'u değiştirdiğinde eski test case'lerine ne olduğunu bilmiyorsan, iyileştirme mi yaptın yoksa tradeoff mu aldın bilemezsin. Örnek: blog yazısı üreten workflow'umuz için prompt'a "daha fazla veri göster" diye ekleme yapıyorsun, çıktı zenginleşiyor ama 400 token uzuyor. Token maliyeti %30 artıyor, latency 1.2 saniye çıkıyor. Bunu deployment öncesi görmediysen, production'da fark edip rollback yapmak 2 hafta sürer.

Versiyonlama disiplini şu soruları cevaplayabiliyor: bu prompt değişikliği hangi metriği iyileştirdi, hangisine zarar verdi? Eski versiyona göre accuracy farkı ne? Bu değişikliği production'a alırsak aylık maliyet artışı ne? Cevap veremiyorsan iteration değil tahmin yürütüyorsun. Promptfoo ve LangSmith bu soruları metrik tablosuna döküyor. Her prompt bir commit, her test run bir rapor. Regression görüldüğünde hangi satırı değiştirdiğin belli — git diff gibi.

Roibase'de n8n + Claude API workflow'larında prompt versiyonunu Git'e commit ediyoruz. Her değişiklik PR, her PR'da eval suite çalışıyor. Promptfoo ile regression check pass etmezse merge yok. Bu disiplin olmadan [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) çalışmalarında citation accuracy'yi stabil tutamayız — her prompt tweaki brand mention'ı düşürebilir, gözden kaçırırsak recovery 3 hafta.

## Promptfoo ile Eval Pipeline Kurmak

Promptfoo açık kaynaklı bir test framework'ü: prompt'u YAML'de tanımlıyorsun, test case'leri CSV/JSON'da saklıyorsun, koşturduğunda metrik tablosu alıyorsun. Model agnostic — OpenAI, Anthropic, local LLaMA, hepsi aynı interface'den test ediliyor. Kurulum basit: `npm install -g promptfoo`, sonra `promptfoo init`. İki dosya yaratıyor: `promptfooconfig.yaml` (prompt tanımı + provider ayarı) ve `test-cases.json` (input-output çiftleri).

Örnek config:

```yaml
prompts:
  - "Sen bir pazarlama analisti. {{query}} sorusuna yanıt ver."
providers:
  - anthropic:messages:claude-3-5-sonnet-20241022
tests:
  - vars:
      query: "Q4 2025 e-ticaret conversion trendleri nedir?"
    assert:
      - type: contains
        value: "conversion rate"
      - type: cost
        threshold: 0.05
```

`promptfoo eval` komutunu çalıştırdığında Claude API'ye istek gönderiliyor, çıktı assertion'lardan geçiyor. `contains` assertion basit — çıktıda belirtilen kelimenin olup olmadığına bakıyor. `cost` assertion token kullanımını kontrol ediyor — eşik aşılırsa fail. Bu iki assertion bile yeterli: "prompt değişikliği doğru terimi kullandırıyor mu, maliyet patlaması var mı?" sorusunu cevaplayabiliyor.

Daha güçlü assertion: `llm-rubric`. Başka bir LLM'e (örn. GPT-4o) çıktıyı okutup puanlatıyorsun. Örnek: "Bu metin markayı olumlu mu gösteriyor?" sorusu için GPT-4o'ya 1-5 skala puanlama yaptırıyorsun. Tek prompt değişikliği sonrası tüm test case'lerdeki ortalama skoru karşılaştırıyorsun — regresyon varsa sayıyla görüyorsun.

Roibase'de blog yazı üreten pipeline'da 30+ test case var. Her case farklı keyword + category kombinasyonu. Promptfoo her gece CI/CD'de koşuyor, ortalama readingTime, iç link sayısı, başlık uzunluğu metriklerini topluyor. Eğer yeni prompt versiyonu readingTime'ı 7'nin altına düşürüyorsa (target 7-8), fail veriyor. Merge olmadan önce görebiliyoruz.

## LangSmith ile Production Observability

Promptfoo lokal test için mükemmel ama production'da ne olduğunu görmüyor. LangSmith (LangChain ekibinin ürünü) bu boşluğu dolduruyor: her LLM çağrısını log'luyor, latency/token/cost'u trace ediyor, hata durumlarını yakalıyor. Python/JS SDK'sı var, n8n HTTP node'undan da çağrılabiliyor. Trace'ler web UI'da görüntüleniyor — hangi prompt hangi çıktıyı üretti, kaç token harcandı, kaç saniye sürdü, tümü tek ekranda.

LangSmith'in kritik özelliği: production trace'lerini dataset'e dönüştürüp eval yapabilmek. Örnek: bir hafta boyunca 500 blog yazısı ürettin, bunların %10'u "iç link sayısı yetersiz" nedeniyle manual edit gördü. LangSmith'te bu 50 trace'i filtrele, "regression test dataset" olarak kaydet. Artık prompt değiştirdiğinde bu dataset'e karşı test edebiliyorsun — geçmiş hataları tekrar üretip üretmediğini görüyorsun.

Bir diğer özellik: human feedback annotation. LangSmith UI'da her trace'e thumbs up/down koyabiliyorsun. Zamanla feedback score'u yüksek olan trace'ler "golden dataset" oluyor. Yeni prompt versiyonlarını bu dataset'e test ediyorsun — golden set performansı düşerse deploy yapmıyorsun. Bu manuel ama scalable. Roibase'de editorial ekip LangSmith'te haftada 20-30 çıktıyı review ediyor, annotation yapıyor. Bu data eval pipeline'ının ground truth'u.

Token cost tracking de LangSmith'te embed. Her trace'de `total_tokens`, `prompt_tokens`, `completion_tokens` görünüyor. Model fiyat tablosu configure ediyorsun (Anthropic API'nin token başına fiyatı), LangSmith otomatik maliyet hesaplıyor. Dashboard'da "son 30 günde toplam LLM maliyeti" grafiği var. Prompt değişikliği sonrası bu grafikteki trend kırılmasını görüyorsan, rollback sebebi.

## Maliyet-Kalite Tradeoff'unu Ölçmek

Production LLM operasyonunun en kritik dengesi: daha iyi çıktı için daha pahalı model mi, daha uzun prompt mu kullanmalı? Claude Opus 3.5 mi Sonnet 3.5 mi? Temperature 0.7 mi 0.3 mü? Her karar tradeoff. Ölçmeden karar vermek kumar. Eval pipeline bu tradeoff'u sayıyla gösteriyor.

Örnek senaryo: blog yazı pipeline'ında şu an Claude 3.5 Sonnet kullanıyorsun, ortalama 1500 token output, $0.015/request. Opus'a geçersen quality artacak mı? Promptfoo ile A/B test: aynı 50 test case'i her iki modele gönder, çıktıları GPT-4o ile `llm-rubric` assertion'dan geçir. Sonuç: Opus ortalama quality score 4.2, Sonnet 3.9. Fark %8. Maliyet: Opus $0.045/request, 3× pahalı. Karar: %8 quality artışı 3× maliyet artışını haklı çıkarıyor mu? Eğer editorial workload %20 azalıyorsa (çünkü daha az manual edit gerekiyor), ROI pozitif. Eğer fark kullanıcıya yansımıyorsa, Sonnet'te kal.

Başka bir tradeoff: prompt length. System prompt'una 200 token context eklersen çıktı daha spesifik oluyor ama her request 200 token daha pahalı. 10K request/ay scenario'da 2M token = $6 ek maliyet (Sonnet input pricing). Bu $6'nın getirisi ne? LangSmith'te annotation data'sına bak: eklenti öncesi thumbs down oranı %15, sonrası %8. %7'lik quality improvement $6'ya değer mi? Ekip karar veriyor ama data var — tahmin yok.

Temperature da tradeoff. Temperature 0 deterministic ama monoton çıktı. Temperature 0.7 kreatif ama bazen off-topic. Promptfoo ile 0.0, 0.3, 0.7 versiyonlarını test ediyorsun, assertion: "iç link sayısı 1-2 arası mı?", "readingTime 7-8 arası mı?". Temperature 0.7 ile %20 test case fail veriyor (iç link 0 veya 3 geliyor), 0.3 ile %5 fail. Karar: 0.3'te kal, production stability > creativity.

## Regression Önleme ve Rollback Stratejisi

Prompt versiyonlama olmadan regression'ı fark etmek 2 hafta sürüyor. Fark ettiğinde production'da 1000 kötü çıktı üretilmiş. Rollback yapsan bile hangi versiyona döneceksin bilmiyorsun. Eval pipeline bu kaosa son veriyor: her commit test ediliyor, fail ederse merge olmuyor. Regression production'a ulaşmadan engelleniyor.

Roibase'de Git workflow'u şu şekilde: `main` branch production prompt'u. Her değişiklik feature branch'te yapılıyor, PR açılıyor. GitHub Actions CI job'u Promptfoo eval'ı trigger ediyor. Eval pass ederse reviewer approve ediyor, merge oluyor. Eval fail ederse PR block. Bu disiplin sayesinde son 6 ayda production'da sıfır prompt regression yaşadık — tümü PR aşamasında yakalandı.

Rollback mekanizması: LangSmith'te her production trace'in hangi prompt versiyonuyla üretildiği tag'lenmiş. Eğer deploy sonrası problem görürsek (örn. iç link oranı düşüyor), LangSmith'te son 100 trace'i filtrele, hangi commit hash'le üretildiğine bak. Git'te o commit'i bul, `git revert` yap, yeni PR aç. Revert PR'ı da eval'dan geçiyor — eski versiyonun hala geçerli olduğunu doğruluyorsun. Merge, deploy. 15 dakika içinde rollback tamamlanıyor.

Bir diğer strateji: canary deployment. Yeni prompt versiyonunu production traffic'in %10'una veriyorsun, %90 eski versiyonda kalıyor. LangSmith'te her iki versiyonun metriklerini yan yana izliyorsun: latency, cost, thumbs up/down oranı. 24 saat sonra yeni versiyon %10'dan iyi performans gösteriyorsa %50'ye çıkar, sonra %100. Kötü performans gösteriyorsa %0'a düşür, rollback. Bu strateji [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty)'ne dayanıyor — production event'leri gerçek zamanlı okunabiliyorsa canary mümkün, yoksa değil.

## Eval Pipeline'ını Ekip Sürecine Entegre Etmek

Eval tooling kurmak kolay, kullanmak zor. Ekip adoption olmadan tool ölü. Roibase'de adoption için şu süreçleri kurduk: (1) Her sprint'te en az 1 prompt iteration PR'ı açılması bekleniyor. (2) PR review checklist'inde "Promptfoo eval pass etti mi?" sorusu var. (3) Haftalık LLM ops meeting'de LangSmith dashboard review ediliyor — hangi trace'ler thumbs down aldı, neden? (4) Quarterly prompt audit: tüm production prompt'ları regression test dataset'ine karşı test ediliyor, performans düşüşü varsa refactor ediliyor.

Ekip başta "eval yazmak ekstra iş" diye direndi. 2 sprint sonra fark ettiler: eval olmadan her değişiklik 3 gün test sürüyor (manuel), eval ile 10 dakika. Manual test'te edge case kaçıyor, eval suite'te kaçmıyor. Adoption arttı. Şimdi engineer prompt değiştirirken önce test case yazıyor, sonra prompt'u iteration ediyor — TDD mantığı. Bu disiplin prompt quality'yi %40 artırdı (thumbs up/down annotation data'sına göre).

Bir başka adoption kaldıracı: maliyet raporu. LangSmith dashboard'unu CFO'ya açtık, aylık LLM spend'i gösterdik. CFO "bu harcamayı nasıl optimize ederiz?" diye sordu. Cevap: eval pipeline ile model/temperature/prompt length tradeoff'larını test ediyoruz, en verimli konfigürasyonu production'a alıyoruz. Sonraki quarter'da %15 maliyet düşüşü sağladık (quality regresyonu olmadan). CFO data gördü, tooling budget'ı onayladı. LangSmith Plus'a geçtik (team plan, unlimited trace). Artık tüm LLM workflow'ları LangSmith'te — sadece content generation değil, [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) pipeline'ında kullandığımız SQL generation workflow'u da.

---

Prompt versiyonlama ve eval disiplini 2026'da optional değil — production LLM operasyonunun temel şartı. Promptfoo ile regression'ı önle, LangSmith ile production'ı gözlemle, maliyet-kalite tradeoff'unu ölç. Her prompt değişikliği bir hipotez, eval sonuçları doğrulama. Rollback mekanizman yoksa deploy yapma. Ekip adoption olmadan tooling ölü — süreçlere embed et, veriyle karar ver. Şimdi action: mevcut LLM workflow'unu al, 10 test case yaz, Promptfoo kur, ilk eval'ı koştur. İlk regression'ı catch ettiğinde disiplinin değerini göreceksin.