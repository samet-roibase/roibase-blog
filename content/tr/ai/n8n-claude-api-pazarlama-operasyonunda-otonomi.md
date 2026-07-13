---
title: "n8n + Claude API: Pazarlama Operasyonunda Otonomi"
description: "Otonom workflow tasarımı, idempotency ve hata yönetimi ile pazarlama operasyonlarını insan müdahalesi olmadan ölçeklendirmek."
publishedAt: 2026-07-13
modifiedAt: 2026-07-13
category: ai
i18nKey: ai-005-2026-07
tags: [n8n, claude-api, workflow-automation, idempotency, pazarlama-otomasyonu]
readingTime: 8
author: Roibase
---

Pazarlama operasyonlarında otomasyon, manuel işi azaltmak değil — insan müdahalesini tamamen çıkartmak demek. n8n gibi workflow platformları ile Claude API'yi birleştirdiğinizde, sadece görev zincirleri değil, kendi kendini düzelten, state'ini bilen ve hata senaryolarını yöneten otonom sistemler kuruyorsunuz. Bu yazıda production'da çalışan bir workflow'un mimari prensiplerini açıyoruz: idempotency, retry logic, state management ve LLM'in güvenilir olmadığı noktalarda kontrol mekanizmaları.

## Otonom Değil, Yarı-Otonom

n8n + Claude kombinasyonu "tamamen otonom" sistemler kurmaz — bu mühendislik disiplininden çok sihir pazarlamasıdır. Gerçekte kurduğunuz şey **event-driven, supervised autonomy**: workflow'lar kendi kararlarını alır, ama critical checkpointlerde doğrulama mekanizması devreye girer. Claude'un output'u deterministik değildir, aynı prompt iki farklı run'da iki farklı sonuç üretir. Bu yüzden workflow'un her node'unda beklenen şemayı validate etmeli, anomali varsa durmalısınız.

Örnek senaryo: GSC'den çekilen keyword'ler ile blog makalesi üretimi. Workflow şöyle akar: keyword extraction → kategorize → prompt assembly → Claude API call → schema validation → commit. Bu 6 node'luk zincirde Claude sadece 1 node — geri kalanı deterministic orchestration. Claude'un ürettiği markdown'ın frontmatter'ı parse edip `title`, `description`, `tags` alanlarının varlığını kontrol ediyorsunuz. Eğer `title` 60 karakteri geçiyorsa workflow durur, Slack'e alert gider, insan müdahale eder. Bu supervised autonomy.

Production'da gördüğümüz fail noktası: Claude bazen `---` frontmatter delimiter'ını unutur veya JSON formatında valid olmayan bir tag array'i döndürür. Bunu validate etmezseniz, downstream node'lar (Git commit, file write) invalid data ile çalışır. Sonuç: repository'de bozuk dosya, CI/CD fail, manual rollback. Bu nedenle validation node'u **her zaman** LLM output'undan sonra gelir, opsiyonel değildir.

## Idempotency: Aynı İşi İki Kez Yapmamak

n8n workflow'ları genellikle webhook veya cron ile tetiklenir. Eğer idempotency sağlamazsanız, aynı keyword için 3 farklı makale üretebilirsiniz — çünkü workflow retry'da veya duplicate event'te aynı işlemi tekrar çalıştırır. Idempotency demek: aynı input ile workflow'u 10 kez çalıştırırsanız, sonuç 1 kez çalıştırmakla aynı olmalı.

Bunu sağlamak için her workflow'un başına bir **deduplication check** node'u ekleyin. Örneğin, `keyword` input'unu hash'leyip Redis'te key olarak saklıyorsunuz. Workflow başında bu key'i kontrol ediyorsunuz: varsa workflow terminate, yoksa devam. Bu pattern, Shopify webhook'ları gibi "at-least-once delivery" sistemlerde kritik — aynı sipariş event'i 2-3 kez gelebilir.

```javascript
// n8n Code node örneği (pseudo)
const inputHash = crypto.createHash('sha256')
  .update(JSON.stringify($input.all()))
  .digest('hex');

const exists = await redis.get(`workflow:${inputHash}`);

if (exists) {
  return { skip: true };
}

await redis.setex(`workflow:${inputHash}`, 3600, '1'); // 1 saatlik TTL
return { skip: false };
```

Bu kod, workflow'un geri kalanını `skip` flag'ine göre conditional branch ile yönetir. Aynı input 1 saat içinde tekrar gelirse, LLM call'ı atlanır. Bu hem cost tasarrufu (Claude API ücretli) hem de tutarlılık garantisi sağlar.

Idempotency'nin ikinci katmanı: output tarafında dosya overwrite kontrolü. Git'e commit atmadan önce `git ls-files` ile aynı slug'da dosya var mı kontrol edin. Varsa workflow'u stop edin veya varolan dosyayı version suffix ile kaydedin (`keyword-v2.md` gibi). Yoksa silent overwrite yaparsanız, önceki versiyonun Git history'si dışında izi kalmaz.

## Hata Yönetimi: Exponential Backoff ve Circuit Breaker

Claude API bazen 429 (rate limit) veya 503 (server error) döndürür. n8n'in default retry mekanizması basit: 3 deneme, sabit bekleme süresi. Production'da bu yetersiz — exponential backoff ve circuit breaker pattern'lerini manuel implement etmeniz gerekir.

Exponential backoff: ilk retry 2 saniye bekler, ikinci 4, üçüncü 8, dördüncü 16. Böylece Claude'un altyapısına yük bindirmeden geçici hata durumlarını aşarsınız. n8n'de bunu Set node ile delay ekleyerek yapabilirsiniz:

```javascript
const retryCount = $node["Claude API"].retryCount || 0;
const delay = Math.min(2 ** retryCount * 1000, 32000); // max 32 saniye

return {
  delay: delay,
  nextRetry: retryCount + 1
};
```

Circuit breaker pattern: eğer 5 peş peşe API call fail olursa, workflow'u tamamen durdurur, alert gönderir, 10 dakika beklemeye alır. Bunu n8n'de harici bir state store (Redis) ile implemente edin. Her fail'de counter artır, her success'de sıfırla. Counter eşiğe ulaşınca workflow'u terminate et.

Pratik senaryoda gördüğümüz: Claude API'nin quotası dolduğunda (örn. aylık token limiti), circuit breaker devreye girip tüm content production workflow'larını durdurur. Bu manuel müdahale gerektirir — ya quota artırılır ya da workflow'lar pause'a alınır. Ancak circuit breaker olmazsa, her workflow 3 kez retry yapar, fail olur, log'u kirletir, on-call engineer'ı gereksiz uyandırır.

### Partial Failure ve Compensating Transaction

Workflow'un ortasında fail olursanız (örn. Claude API success, ama Git commit fail), partial state bırakırsınız. Bu durumda **compensating transaction** gerekir: eğer downstream node fail olursa, upstream yapılan değişiklikleri geri al. n8n'de bunu error handler node'ları ile yapıyorsunuz.

Örnek: Claude'dan dönen markdown'ı Redis'e cache'lediniz, sonra Git commit fail etti. Error handler node'u devreye girip Redis'teki cache key'ini silmeli. Yoksa cache'de orphan data kalır, bir sonraki run'da inconsistency yaratır. Bu pattern, microservice orchestration'da saga pattern'inin benzeridir — ama n8n'de manuel implemente edilir, framework desteği yok.

## State Management: Workflow Arası Veri Akışı

Pazarlama operasyonlarında tek bir workflow yetmez — birbirine bağlı workflow zincirleri kurarsınız. Örneğin: GSC keyword extraction → content generation → Git commit → deploy → SEO indexing. Her workflow kendi state'ini taşır, ama global state'e ihtiyaç vardır (örn. "bu keyword için makale üretildi mi?").

Bunu n8n'de harici bir state store ile (Redis, PostgreSQL, Supabase) çözersiniz. Her workflow, state değişikliğini store'a yazar. Sonraki workflow bu state'i okur, kendi kararını alır. Örneğin, content generation workflow'u slug'ı state store'a yazar, deploy workflow'u bu slug'ı okuyup CDN'e deploy eder. Eğer deploy fail olursa, state "pending" olarak kalır, retry mekanizması devreye girer.

State store seçiminde tradeoff: Redis hızlı ama ephemeral (restart'ta data kaybolabilir), PostgreSQL kalıcı ama latency ekler. Production'da ikisini birlikte kullanıyoruz: hot state için Redis, audit log için PostgreSQL. Her workflow, critical state değişikliğini PostgreSQL'e de yazıyor — böylece n8n instance'ı crash olsa bile state recovery mümkün.

### Conflict Resolution

İki workflow paralel çalışırsa, aynı state'i güncelleyebilir — race condition. Bunu önlemek için **optimistic locking** kullanın: her state kaydına `version` numarası ekleyin, güncelleme sırasında version'ı kontrol edin. Eğer version değişmişse (başka workflow güncellediyse), mevcut workflow'u abort edin veya retry'a alın.

```sql
UPDATE workflow_state
SET status = 'completed', version = version + 1
WHERE slug = 'keyword-123' AND version = 5;
```

Bu query, sadece version hala 5 ise güncelleme yapar. Eğer başka workflow version'ı 6'ya çıkardıysa, `RETURNING` clause boş döner, n8n bunu algılar, conflict handler node'unu tetikler.

## LLM Güvenilirliği ve Fallback Mekanizmaları

Claude API production-ready, ama %100 güvenilir değil. Biz [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) süreçlerinde LLM output'unu birden fazla katmanda validate ederiz — schema validation yetmez, semantic validation de gerekir. Örneğin, Claude'un ürettiği makale başlığı keyword'ü içermiyor mu? Meta description 160 karakteri geçiyor mu? Internal link anchor text generic mi?

Bu kontroller için rule-based validation node'ları ekleyin. Eğer validation fail ederse, fallback mekanizması devreye girsin: ya önceden hazırlanmış template kullan, ya da workflow'u pause'a alıp insan onayına gönder. Bizim production workflow'umuzda %5 oranında validation fail görüyoruz — bu durumlarda Slack'e alert gidiyor, content editor 10 dakika içinde düzeltip workflow'u resume ediyor.

Fallback'in ikinci seviyesi: eğer Claude API 3 retry sonrası hala fail ederse, daha basit bir model (GPT-4o-mini gibi) kullan. Bu downgrade, quality kaybı demek ama workflow'un durmamasını garantiler. Cost/quality tradeoff'unda karar sizde — biz critical content için fallback kullanmıyoruz, non-critical operasyonlarda (örn. meta tag generation) kullanıyoruz.

## Observability: Workflow'u İzlemek

Otonom sistemlerde observability yoksa, ne zaman fail olduğunu anlayamazsınız. n8n'in built-in logging'i yetersiz — her node'un input/output'unu, execution süresini, error stack trace'ini harici bir sisteme (Datadog, Sentry, CloudWatch) göndermeniz gerekir. Bunu n8n'in HTTP Request node'u ile webhook olarak yapabilirsiniz, veya daha temiz olanı: n8n'in execution hook'larını kullanarak merkezi bir logging node'u ekleyin.

Observability'nin ikinci boyutu: **LLM trace**. Claude'a gönderdiğiniz prompt'u, dönen response'u, token sayısını, latency'yi log'layın. Böylece prompt regression'ı (yeni versiyonda quality düşmesi) veya cost artışını hemen görebilirsiniz. Biz prompt versiyonlarını Git'te tutuyoruz, her workflow hangi prompt versiyonunu kullandığını log'luyor. Böylece A/B test yapabiliyoruz: eski prompt vs yeni prompt, hangi daha iyi output veriyor?

Metrics: her workflow için SLA tanımlayın. Örneğin, content generation workflow'u 2 dakikadan uzun sürerse alert ver. Bu, Claude API'nin yavaşladığını veya workflow'da bottleneck olduğunu gösterir. Biz production'da P50 latency 45 saniye, P95 latency 90 saniye görüyoruz — bu sürelerin üstünde outlier varsa incident açıyoruz.

## Kapanış: Otonomi, Disiplin İster

n8n + Claude kombinasyonu güçlü, ama sihirli değil. Otonom sistemler kurmanın bedeli: idempotency, retry logic, state management, validation, observability — bunların hepsi manuel implemente edilmeli. n8n bu katmanları framework olarak sunmuyor, siz mühendislik disipliniyle ekliyorsunuz. Production'a geçmeden önce şunu sorun: bu workflow 3 ay boyunca insan müdahalesi olmadan çalışabilir mi? Cevap "hayır" ise, eksik katmanları tespit edip tamamlayın. Çünkü gerçek otomasyon, fail olduğunda bile kendi kendini düzelten sistemlerdir.