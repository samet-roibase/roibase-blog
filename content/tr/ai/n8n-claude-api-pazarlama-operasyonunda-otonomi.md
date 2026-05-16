---
title: "n8n + Claude API: Pazarlama Operasyonunda Otonomi"
description: "Otonom workflow tasarımı, idempotency garantileri ve hata yönetimi stratejileriyle pazarlama operasyonlarını AI'ya güvenle devretmek."
publishedAt: 2026-05-16
modifiedAt: 2026-05-16
category: ai
i18nKey: ai-005-2026-05
tags: [n8n, claude-api, workflow-automation, idempotency, ai-operations]
readingTime: 8
author: Roibase
---

Pazarlama operasyonlarında tek darboğaz insan kapasitesi değil — karar sürecinin sürekli müdahale gerektirmesi. İçerik üretimi, veri normalizasyonu, raporlama gibi tekrarlayan işleri otomatikleştirince karşınıza yeni bir sorun çıkıyor: otomasyon güvenilir değilse sürekli izlemeniz gerekiyor. n8n gibi workflow araçlarını Claude API ile birleştirdiğinizde asıl kazanç, işi otomatikleştirmek değil — işi *gözetimsiz* çalıştırmak. Bunun için üç katman gerekiyor: idempotency garantisi, hata kurtarma mekanizmaları ve gözlemlenebilir state yönetimi.

## Otonom Workflow'un Gerçek Tanımı

Otonom workflow, sadece "A olduğunda B'yi tetikle" automasyonu değil. Sistem şunu garanti eder: workflow yarıda kesintiye uğrasa bile aynı girdiye her zaman aynı sonucu üretir ve corrupt state bırakmaz. Pazarlama operasyonunda bu kritik — örneğin GSC'den gelen 500 keyword'ü Claude'a blog başlığı ürettiriyorsanız, 247. keyword'de API timeout'u olduğunda ne yapacaksınız önemli. Baştan mı başlayacak (ilk 246'yı duplicate eder), kaldığı yerden mi devam edecek (247-500 arası orphan kalır), yoksa işlemi idempotent şekilde retry edip aynı sonucu mu üretecek?

Claude gibi LLM'lerde deterministik output garantisi yok — aynı prompt'a farklı cevap verebilir. Bu yüzden idempotency'yi API seviyesinde değil, workflow seviyesinde kurmalısınız. n8n'de her node'un output'unu hash'leyip cache'leyin. Eğer aynı input gelirse (örneğin aynı keyword + kategori kombinasyonu) Claude'u çağırmadan cached sonucu dönün. Bu hem maliyet düşürür (247. keyword'de crash olunca ilk 246'yı tekrar işlemezsiniz) hem de state'i tutarlı tutar.

Gözlemlenebilirlik için her workflow run'ını structured log'layın: input hash, timestamp, Claude response metadata (model, prompt tokens, completion tokens), output hash, retry sayısı. BigQuery'e yazın. Bu veri hem debugging'de (hangi prompt'ta output değişti?) hem de cost attribution'da (hangi kategori ne kadar token tüketiyor?) kullanılır. [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) yapısı burada workflow telemetrisi ile entegre çalışır — sadece iş sonuçlarını değil, üretim sürecinin maliyetini de ölçersiniz.

## n8n'de Idempotency Garantisi Kurmak

n8n webhook veya schedule ile tetiklenen bir workflow'da idempotency şu mekanizmalarla kurulur: input deduplication, checkpoint state, conditional retry. Örnek senaryo: her sabah GSC'den top 100 impression keyword'ü çekip Claude ile blog outline üretiyorsunuz.

```javascript
// n8n Function node — input hash
const inputData = {
  keyword: $json.keyword,
  category: $json.category,
  date: $json.date
};
const inputHash = require('crypto')
  .createHash('sha256')
  .update(JSON.stringify(inputData))
  .digest('hex');

return { ...inputData, inputHash };
```

Bu hash'i PostgreSQL'de `workflow_state` tablosuna yazın: `(inputHash, status, output, createdAt)`. Workflow başlangıcında hash'i kontrol edin — `status=completed` ise Claude node'unu skip edin, cached output'u dönün. `status=failed` ise retry sayısını increment edin (3'ten fazla retry'da alert gönderin).

Claude node'undan sonra output'u yine hash'leyin ve aynı satırı `UPDATE` edin: `status=completed, output={hash}, completedAt=NOW()`. Crash olursa satır `status=in_progress` kalır — cron job her 5 dakikada `in_progress AND createdAt < NOW() - INTERVAL '10 minutes'` satırları `failed` yapar ve Slack'e haber verir.

Bu yapı şu garantiyi verir: aynı keyword + kategori + tarih kombinasyonu için workflow kaç kez tetiklense de, Claude'a 1 kez sorulur. 247. keyword'de crash olunca 248-500 arası işlenir, ilk 246 dokunulmaz. Cost kontrol altındadır (Claude'un output pricing'i prompt'tan pahalıdır — duplicate call pahalıya mal olur).

### Checkpoint State ile Kısmi Kurtarma

500 keyword'lü batch işlemde idempotency tek başına yetmez — tüm batch'i atomik yapamazsınız (Claude rate limit'e takılırsınız). Çözüm: batch'i 50'lik chunk'lara bölün, her chunk'tan sonra checkpoint yazın. n8n'de `Loop Over Items` node'u kullanıyorsanız, her 50 item'da bir `Write Checkpoint` node'u ekleyin:

```javascript
// Function node — checkpoint yazma
const processedCount = $json.processedCount || 0;
const newCheckpoint = processedCount + $json.items.length;

// Supabase veya Redis'e yaz
await fetch('https://api.supabase.io/rest/v1/checkpoints', {
  method: 'POST',
  headers: { 'apikey': 'XXX', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workflowId: $workflow.id,
    runId: $execution.id,
    processedCount: newCheckpoint
  })
});

return { processedCount: newCheckpoint };
```

Workflow başlangıcında checkpoint'i oku — eğer `processedCount > 0` ise input array'inden ilk N elemanı skip et. Böylece 247'de crash olunca 0-246 tekrar işlenmez, 247'den devam edilir.

Alternatif: her chunk'tan sonra output'u incremental olarak dosyaya yaz (S3'e append). Crash olunca partial file'ı oku, son satırdan devam et. Bu yaklaşım idempotency ile uyumlu değil (aynı run'da farklı satır sayısı üretir) ama cost-sensitive batch işlemlerde kabul edilebilir. Tradeoff: determinizm vs. hız.

## Hata Yönetimi Stratejileri

Claude API'nin iki hata sınıfı var: transient (rate limit, timeout) ve persistent (invalid prompt, safety filter). Transient hataları exponential backoff ile retry edin — n8n'de `Retry On Fail` ayarı var ama o naive retry (hemen tekrar dener, rate limit'i kötüleştirir). Custom retry logic yazın:

```javascript
// Function node — exponential backoff
const maxRetries = 5;
const retryCount = $json.retryCount || 0;

if (retryCount >= maxRetries) {
  throw new Error('Max retries exceeded');
}

const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s, 8s, 16s
await new Promise(resolve => setTimeout(resolve, delay));

// Claude node'unu tetikle
return { ...input, retryCount: retryCount + 1 };
```

Persistent hatalarda retry mantıksız — prompt'ta sorun var. Bu durumda error'u log'layıp skip edin. n8n'de `Continue On Fail` açın, sonraki node'da error check yapın:

```javascript
// IF node — error check
if ($json.error && $json.error.type === 'invalid_request_error') {
  // Slack'e haber ver, DB'ye `status=skipped` yaz
  return { skipReason: $json.error.message };
}
```

Claude'un output'u bazen prompt'a uymuyor — örneğin frontmatter eksik, markdown bozuk. Bu durumda validation node ekleyin: regex ile frontmatter kontrolü, title/description length kontrolü. Validation fail ederse Claude'u yeniden çağırın ama bu sefer prompt'a "PREVIOUS OUTPUT WAS INVALID" context'i ekleyin (Claude kendi hatasını düzeltir, genelde 2. denemede doğru üretir).

```javascript
// Validation node
const output = $json.claudeOutput;
const hasFrontmatter = /^---\ntitle:/.test(output);
const titleLength = output.match(/title: "(.+?)"/)?.[1]?.length || 0;

if (!hasFrontmatter || titleLength > 60) {
  return { 
    validationFailed: true, 
    reason: !hasFrontmatter ? 'missing_frontmatter' : 'title_too_long'
  };
}

return { valid: true };
```

Validation fail rate'i %5'in üstündeyse prompt'ta yapısal sorun var demektir — o zaman prompt mühendisliği yapın, validation logic'i gevşetmeyin (output kalitesi düşer).

## Production'da Gözlemlenebilirlik

Otonom workflow'u production'a aldıktan sonra izlemeniz gereken metrikler:

| Metrik | Eşik | Aksiyun |
|---|---|---|
| Retry rate | >10% | Prompt/API config gözden geçir |
| Validation fail rate | >5% | Prompt refactor |
| Avg. completion tokens | +%20 artış | Model degişikliği veya input creep (context'e gereksiz veri ekleniyor) |
| Execution time P95 | >120s | Batch size küçült veya parallelization ekle |
| Cost per output | +%30 artış | Token usage anomaly — cache miss mi, yoksa input inflation mı? |

n8n'de bu metrikleri toplamak için her workflow'un sonuna `Log Metrics` node'u ekleyin — structured JSON olarak DataDog/Grafana'ya POST edin. Alternatif: workflow telemetrisi için [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty)'nden faydalanın — workflow event'lerini first-party veri olarak toplayıp attribution pipeline'ına besleyin (hangi keyword'den üretilen içerik ne kadar trafik getirdi?).

Alerting için passive log analizi yerine active health check yapın: her 15 dakikada bir test input'u workflow'a gönderin (synthetic monitoring). Test input'unun expected output'unu biliyorsunuz — eğer farklı output gelirse (veya timeout olursa) incident açın. Bu, production traffic'i etkilemeden system health'ini gösterir.

## Otomasyon Maturity Seviyeleri

Pazarlama operasyonlarında AI workflow'larının maturity seviyesi şöyle kategorize edilir:

**Seviye 1 — Assisted:** Workflow sonucu human review gerektiriyor. Örnek: Claude başlık önerisi üretiyor, insan seçiyor. Otonom değil.

**Seviye 2 — Autonomous with fallback:** Workflow kendi başına çalışıyor ama critical error'da human müdahale ediyor. Örnek: validation fail edince Slack'e düşüyor, insan düzeltiyor. Çoğu production workflow bu seviyede.

**Seviye 3 — Fully autonomous:** Workflow hata durumunda bile insan müdahale etmeden kurtarıyor. Örnek: validation fail edince farklı prompt ile retry, 3 retry'dan sonra skip ve log. İdeal durum ama %100'e ulaşmak mümkün değil — edge case'ler her zaman olur.

Roibase operasyonlarında **Seviye 2.5** hedefliyoruz: critical path'te human-in-the-loop yok ama dashboard'da anomaly alerting var. Örneğin günde 100 blog outline üretiyorsak, validation fail rate aniden %20'ye çıktığında bildirim alıyoruz — ama işlem durmaz, başarılı olan 80 outline yayınlanır. Bu yaklaşım velocity ile quality arasında optimal tradeoff sağlıyor.

## LLM Workflow'unda Cost Kontrol

Claude Sonnet 4 pricing (Mayıs 2026): $3/M input token, $15/M output token. 1500 kelimelik blog outline üretimi yaklaşık 2K output token = $0.03. Günde 100 outline = $3/gün = $90/ay. Ciddi bir maliyet değil ama idempotency olmadan (duplicate call'larla) 2-3 katına çıkabilir.

Cost optimization için cache stratejisi: n8n'de Redis node kullanın. Claude'a göndermeden önce `GET {inputHash}` yapın — varsa sonucu dönün (hit), yoksa Claude'u çağırıp `SET {inputHash} {output} EX 2592000` (30 gün TTL) yapın. Bu yaklaşımla aynı keyword/kategori kombinasyonu tekrar geldiğinde (örneğin aylık refresh job'ında) $0 maliyet.

Alternatif: prompt caching kullanın (Claude API'de `system` role cache'leniyor). Eğer system prompt'unuz 10K token ve her call'da aynıysa (ki master prompt'unuz bu), ilk call'da cache'leniyor, sonraki call'larda input token cost %90 düşüyor. n8n'de aynı execution içinde birden fazla Claude node varsa, ilk node'da system prompt'u cache'leyin, sonrakiler otomatik kullanır.

Cost attribution için BigQuery'de her workflow run'ının token breakdown'unu saklayın: `(workflowId, runId, inputTokens, cachedTokens, outputTokens, cost)`. Dashboard'da kategori/keyword bazında maliyet analizi yapın — hangi kategoride ortalama output token'ı yüksek? Prompt'u daraltabilir miyiz? Bu tür analiz için [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) pipeline'ı gerekli — raw log'dan actionable insight çıkartmak tek başına query yazmakla olmuyor.

## Sonraki Adım: Eval Pipeline'ı Kurmak

Otonom workflow production'a alındıktan sonra asıl sorun başlıyor: output kalitesi zamanla düşüyor mu? Prompt değişikliği performansı artırdı mı, düşürdü mü? Bunu anlamak için LLM eval pipeline'ı gerekiyor — Claude'un ürettiği içeriği başka bir LLM (veya rule-based scorer) ile değerlendirin. Örneğin her outline'ı GPT-4o'ya "Bu başlık SEO-friendly mi? 1-10 puan ver" diye sorun, sonuçları time series olarak kaydedin. Prompt değişikliği deploy ettikten sonra ortalama score düşüyorsa rollback yapın.

Eval pipeline'ı başka yazının konusu ama burada önemli nokta: otomasyon sadece "işi yaptırmak" değil, işin *kalitesini* sürekli ölçmek. Aksi halde autonomous system sessizce bozulur — insan müdahale etmediği için kimse farketmez. Production-grade AI operasyonlarının gerçek maliyeti buradan geliyor: sadece API cost değil, eval + monitoring infrastructure. Bunu baştan planlayın.