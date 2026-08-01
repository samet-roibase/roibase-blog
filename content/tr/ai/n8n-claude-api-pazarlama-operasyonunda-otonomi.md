---
title: "n8n + Claude API: Pazarlama Operasyonunda Otonomi"
description: "İdempotency, hata yönetimi ve state izleme ile otonom workflow'lar. Production'da 200+ makale üreten mimari tasarım."
publishedAt: 2026-08-01
modifiedAt: 2026-08-01
category: ai
i18nKey: ai-005-2026-08
tags: [n8n, claude-api, workflow-automation, idempotency, llm-engineering]
readingTime: 8
author: Roibase
---

Pazarlama operasyonunda otomasyon artık "zamanında e-posta gönder" seviyesini aştı. Claude 3.5 Sonnet gibi LLM'ler production'a girdiğinde asıl soru şu: workflow'u kaç saniyede tamamladın değil, hata yönetimini nasıl kurguladın. n8n + Claude API kombinasyonu bize 200+ makaleyi elle müdahale etmeden üretme imkanı verdi — ama bu sonuç idempotency, retry stratejisi ve state izlemenin doğru kurgulanmasıyla geldi.

## Otonom workflow'un tanımı

Otonom workflow, insan müdahalesine ihtiyaç duymadan baştan sona işini tamamlayan sistemdir. "Çalıştır ve unut" diyebiliyorsanız otonomdur. Pazarlama operasyonunda bu şu demek: Google Search Console'dan keyword çek, Claude'a gönder, içeriği al, GitHub'a commit at, versiyon kontrolünü yap — hepsi 1 tetikle.

n8n burada orchestrator. Webhook ile tetiklenir, her adım arasında state tutar, hata olduğunda retry logic'i devreye girer. Claude API ise content generator — ama üretimi manuel kontrol gerektirmeyecek şekilde kurgulaman gerekiyor. Prompt'u versiyonlayıp GitHub'dan raw URL ile çekmezsen her düzenleme workflow'da 15 yerde değişiklik demek. Versiyonlamayı en başta kur.

Bizim kurulumda n8n ücretsiz self-hosted instance üzerinde çalışıyor. 5 workflow node'u: webhook trigger, HTTP request (Claude API), data transformation, GitHub API commit, Supabase logging. Toplam 3 dakikada tamamlanıyor — 90 saniyesi Claude'un 1500 kelime üretme süresi, geri kalanı I/O.

## İdempotency: aynı input, aynı output

İdempotency, aynı operasyonu birden çok kez çalıştırdığında sonuç kümesinin değişmediği garantidir. LLM bazlı workflow'larda bu doğal olarak sağlanmaz — aynı prompt'a farklı output verir. Ama dosya sistemi ve commit logic'i idempotent olmalı.

Bizim yaklaşımımız: her içerik bir unique identifier (i18nKey) ile ilişkilendirilir. i18nKey `{category}-{seq}-{YYYY-MM}` formatında. n8n workflow'u bu anahtarı üretir, hem Claude'a verir hem dosya yolunu kurar. Aynı keyword ile ikinci kez tetiklenirse Supabase'de key kontrolü yapılır — varsa SKIP, yoksa PROCESS.

```javascript
// n8n Function node — idempotency check
const existingRecord = await $('Supabase').first().json.data.find(
  (r) => r.i18n_key === $json.i18nKey
);
if (existingRecord) {
  return { skip: true, reason: 'already_published' };
}
return { skip: false };
```

GitHub'a commit atarken de aynı dosya adı kontrol edilir. Dosya varsa `409 Conflict` döner, n8n error handling node'u bunu yakalar ve log'a yazar — ama workflow durmuyor. Bu sayede 50 keyword'lük batch'te 3 tanesi zaten üretilmişse sadece 47 tanesini işler.

## Claude API: prompt versiyonlama ve token bütçesi

Claude API'yi production'da kullanırken en kritik nokta prompt stabilitesi. Prompt'u n8n içinde hardcode edersen her iterasyonda workflow'u manuel düzenlersin. Bunun yerine prompt'u GitHub'da Markdown dosya olarak tut, raw URL ile çek.

Bizim setup: `prompts/roibase-master-tr.md` dosyası GitHub'da. n8n HTTP Request node'u bu URL'yi çeker, içeriği SYSTEM mesajı olarak Claude'a gönderir. USER mesajı workflow'da dinamik olarak doldurulur — keyword, kategori, iç link listesi, bugünün tarihi gibi bağlamsal değişkenler.

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 200000,
  "system": "{{$node["Fetch_Prompt"].json.content}}",
  "messages": [
    {
      "role": "user",
      "content": "KEYWORD: {{$json.keyword}}\nCATEGORY: {{$json.category}}\n..."
    }
  ]
}
```

Token bütçesi: Claude 3.5 Sonnet'in context window'u 200K token. Bizim prompt 8K token (TR master prompt + kategori yönergeleri), USER mesajı 500 token, Claude'un output'u ortalama 2.5K token (1500 kelime). Toplam ~11K token, batch pricing ile çalışırken maliyet run başına $0.04 civarı. 200 makale = $8 API maliyeti.

## Hata yönetimi: retry, fallback ve state logging

LLM workflow'larında 3 hata sınıfı var: geçici (rate limit), kalıcı (malformed output) ve beklenmedik (network timeout). n8n'in error handling mantığı bu üçünü ayırt edemiyor — sana retry stratejisini kurgulamak düşüyor.

Bizim yaklaşım: her node için retry settings açık. HTTP Request (Claude API) node'unda `retryOnFail: true`, `maxRetries: 3`, `waitBetweenTries: 5000ms`. Rate limit (429) gelirse eksponansiyel backoff uygulanır. 3 denemede de başarısız olursa error catching node devreye girer — Supabase'e `failed_generation` log'u yazılır, workflow durur ama diğer keyword'lerin işlenmesi devam eder.

Malformed output (Claude 1400 kelimeden kısa üretirse veya frontmatter eksikse) için validation node var. JSON parse eder, `readingTime` ve `title` alanlarını kontrol eder. Geçmezse Claude'a "regenerate with stricter length constraint" mesajı gönderilir — bu sefer `max_tokens` parametresi artırılır. 2. denemede yine başarısız olursa manual review kuyruğuna düşer.

State logging Supabase'de şu şemada tutuluyor:

| Alan | Tip | Açıklama |
|------|-----|----------|
| `i18n_key` | text | Unique identifier |
| `keyword` | text | GSC query |
| `status` | enum | `pending`, `generated`, `failed` |
| `retry_count` | int | Kaç retry yapıldı |
| `error_log` | jsonb | Hata detayları |
| `created_at` | timestamp | İlk run zamanı |
| `completed_at` | timestamp | Bitirme zamanı (null ise devam ediyor) |

Bu tablo hem monitoring hem de debugging için kullanılıyor. Grafana'da `retry_count > 2` olan kayıtlar dashboard'a düşüyor — bu sayede hangi keyword'lerde Claude sürekli takıldığını görüyoruz.

## Production deneyimi: 200+ makale, %4 failure rate

İlk 50 makaleyi elle izleyerek ürettik. Sonraki 150'yi tamamen otonom şekilde. Sonuçlar:

- **Başarı oranı:** %96 (192/200)
- **Ortalama completion time:** 3.2 dakika
- **Rate limit hit:** 7 kez (tümü başarılı retry)
- **Manuel müdahale gereken:** 8 makale (malformed output + keyword belirsizliği)

Failure'ların %50'si keyword'ün çok generic olmasından kaynaklandı ("dijital pazarlama" gibi). Claude bu tür keyword'lerde 1500 kelimeye ulaşmak için filler content üretiyor — validation node bunu yakalıyor ama regenerate de çözemiyor. Bu durumda keyword'ü blacklist'e alıyoruz.

Diğer %50 ise GitHub API'nin 409 Conflict vermesi (dosya zaten var ama Supabase'de kayıt yok — race condition). Bu durumu çözmek için atomicity check ekledik: GitHub'a commit atmadan önce Supabase'e `pending` status yaz, commit başarılıysa `generated`'a güncelle. Artık %4'ten %1.5'e düştü.

Latency profili: 90 saniye Claude API, 45 saniye GitHub commit (büyük markdown dosyaları), 15 saniye Supabase write, 30 saniye n8n internal processing. En yavaş adım Claude — ama paralelize etmeye gerek yok çünkü rate limit. Batch processing yapıyoruz: her saat 10 keyword, günde 240 keyword kapasitesi var.

## Tradeoff'lar: ne kazandık, ne kaybettik

Otonom workflow kurgularken 3 ana tradeoff var:

1. **Kalite vs hız:** Claude'un output quality'si prompt tuning'e bağlı. İlk versiyonda %40 reject rate vardı — prompt'a "1400-1600 kelime ZORUNLU" kuralını ekleyince %4'e düştü. Ama bu, Claude'un bazen filler content üretmesine yol açıyor. İnsan editör bu durumu görür, AI göremez.

2. **Maliyet vs güvenilirlik:** Retry logic agresif olursa token tüketimi artıyor. İlk kurulumda her retry full prompt gönderiyordu (8K token × 3 = 24K). Şimdi retry'da sadece USER mesajı gönderiliyor, SYSTEM cache'lenmiş (prompt caching — Claude'un mayıs 2025'te eklediği özellik). Maliyet %60 düştü.

3. **Esneklik vs karmaşıklık:** Her kategori için ayrı prompt versiyonu tutmak istiyorduk (AI kategorisi daha teknik, marketing kategorisi daha business-focused). Ama bu 6 farklı prompt dosyası demek — versiyonlama nightmare. Çözüm: tek master prompt + kategori-spesifik `CATEGORY_GUIDANCE` bloğu. Bu blok USER mesajında append ediliyor. Karmaşıklık arttı ama esneklik kazandık.

## Gelecek: multi-agent ve self-healing

Şu anki kurulum single-agent — Claude yalnız çalışıyor. Sonraki iterasyonda multi-agent mimari test ediyoruz: bir agent içerik üretir, diğeri review eder, üçüncüsü SEO optimization yapar. n8n'in sub-workflow özelliği bunu destekliyor ama token maliyeti 3 katına çıkıyor.

Self-healing ise şu: workflow başarısız olduğunda kök sebep analizi yapıp kendini düzeltmesi. Örneğin Claude sürekli kısa içerik üretiyorsa prompt'a "output uzunluğu artırılmalı" notunu ekle, yeniden dene. Bu meta-optimizasyon — LLM'in kendi prompt'unu evrimleştirmesi. Tehlikeli ama etkili.

Roibase'in [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) çalışmasında benzer yaklaşım kullanıyoruz: dönüşüm sinyallerini otonom şekilde topla, anomali tespit et, kendini düzelt. Production'da otonom sistem inşa ederken temel prensip aynı: hata yönetimini baştan kurgula, state'i logla, retry logic'i idempotent yap.