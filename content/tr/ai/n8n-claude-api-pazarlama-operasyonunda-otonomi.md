---
title: "n8n + Claude API: Pazarlama Operasyonunda Otonomi"
description: "Otonom workflow tasarımı, idempotency ve hata yönetimi: n8n ile Claude API'yi production ortamında nasıl işletebilirsiniz."
publishedAt: 2026-06-25
modifiedAt: 2026-06-25
category: ai
i18nKey: ai-005-2026-06
tags: [n8n, claude-api, workflow-automation, idempotency, llm-ops]
readingTime: 8
author: Roibase
---

Pazarlama operasyonlarının çoğu manuel döngülerden oluşur: raporları toplarsınız, veriyi temizlersiniz, içgörü çıkarırsınız, aksiyonları tetiklersiniz. Bu döngüleri LLM ile otomatikleştirebileceğinizi biliyorsunuz — ama production ortamında "çalıştır ve unutabilir" seviyesine nasıl gelirsiniz? n8n gibi bir workflow orchestrator ile Claude API'yi birleştirdiğinizde, kritik nokta kod yazmak değil, sistemin kendi kendini düzeltebileceği bir mimari kurmaktır. İdempotency, hata yönetimi, cost control ve observability olmadan otomasyon kırılgandır.

## Otonom Workflow Gerçekten Ne Demek

Otonom workflow "bir kere çalışır, sonra bozulur" demek değildir. Gerçek otonomi, sistemin kendi hatalarını yakalayıp düzeltmesi, rate limit'e takılıp yeniden denemesi, aynı input'u iki kez işlemediğinden emin olmasıdır. n8n'de bir Claude API node'u tetiklediğinizde, default davranış basittir: HTTP request gönderir, response alır, sonraki node'a geçer. Ama production'da cevap gecikmesi olabilir, API 429 (rate limit) dönebilir, malformed JSON gelebilir, ya da Claude aynı soruya iki farklı formatta yanıt verebilir.

Bu nedenle workflow'unuzda her node aslında bir "hata yönetim bloku" içermelidir. n8n'in error trigger mekanizması bunu sağlar: bir node hata verdiğinde ayrı bir dalda yakalarsınız, Slack'e log atarsınız, ya da webhook ile alerting sisteminize gönderirsiniz. Otonom workflow, insanın müdahale etmeden düzelebilen veya en azından kendi durumunu raporlayabilen workflow'dur. Anthropic'in API dokümantasyonunda retry strategy önerileri var (exponential backoff, 3-5 deneme) — bu stratejileri n8n içinde "Function" node ile kodlarsınız.

Diğer kritik nokta: workflow'lar zamanla karmaşıklaşır. 3 ay sonra aynı workflow'a baktığınızda hangi node'un ne yaptığını anlamak zorlaşır. Bu yüzden her kritik node'a "Sticky Note" ekleyin — hangi Claude prompt'unun çalıştığını, hangi data structure'ın beklendiğini not alın. Roibase bünyesinde [veri analizi](https://www.roibase.com.tr/tr/verianalizi) operasyonlarını otomatikleştirirken, her Claude call'ının hangi business logic'i çözdüğünü dokümante etmek 6 ay sonra refactor yaparken hayat kurtarıyor.

## İdempotency: Aynı İşi İki Kez Yapmamak

Pazarlama operasyonlarında idempotency kritiktir. Örneğin Google Search Console'dan (GSC) keyword verisi çekip Claude'a analiz ettiriyorsunuz — workflow her sabah 08:00'de trigger oluyor. Bir sabah network glitch yaşanır, workflow yarıda kesilir, manual restart tetiklersiniz. Şimdi aynı gün iki kere çalıştı mı? Eğer idempotency mekanizması yoksa, aynı keyword için iki kere blog postu üretip duplicate content yaratırsınız.

İdempotency'yi sağlamanın en basit yolu: her workflow run'ına unique ID atamak ve işlemi kaydetmek. n8n'de bunu "Set" node ile yaparsınız: `{{$execution.id}}` değişkeni her run için unique bir string üretir. Bu ID'yi Claude'a gönderdiğiniz prompt'un metadata'sına eklersiniz, response'u database'e yazarken de bu ID ile tag'lersiniz. Böylece aynı execution ID iki kere gelirse, database'de duplicate check yapabilirsiniz.

Ancak ID yetmez — zaman penceresine de bakmak gerekir. GSC verisi günlük aggregate olduğu için, aynı günün verisini iki kere çekmek idempotency ihlali değildir (veri güncellendi demektir). Ama "aynı keyword + aynı tarih + aynı execution ID" kombinasyonu duplicate sayılır. Bu logic'i PostgreSQL'de `ON CONFLICT` clause ile yönetebilirsiniz: `INSERT ... ON CONFLICT (keyword, date, execution_id) DO NOTHING`. n8n'in Postgres node'u bu syntax'ı destekler.

Bir diğer pattern: Claude'un response'unu hash'leyip karşılaştırmak. Eğer Claude tamamen aynı output'u iki kere ürettiyse (ki prompt caching nedeniyle olabilir), hash match yapar, duplicate olarak işaretlersiniz. Bu özellikle cache hit rate'inizi optimize etmek istediğinizde yararlıdır — Anthropic'in prompt caching'i 90% maliyet tasarrufu sağlar ama her cache hit aynı response verir, bu da idempotency açısından avantajdır.

### Örnek: Idempotent Workflow Yapısı

```
1. Trigger (Cron: her gün 08:00)
2. GSC API call → keyword listesi
3. Loop node (her keyword için)
   ├─ Check DB: bu keyword + bugünün tarihi + execution_id var mı?
   ├─ Eğer var → SKIP (idempotency)
   └─ Eğer yok → Claude API call
       ├─ Response parse
       ├─ DB'ye yaz (keyword, date, execution_id, content)
       └─ Error trigger → Slack alert
```

Bu yapı 1450 kelimelik bir makale ürettiğinde, aynı keyword'ün aynı gün iki kere işlenmediğinden emin olur. Eğer workflow yarıda kesilirse, restart'ta sadece işlenmemiş keyword'ler çalışır — zaten işlenenler skip edilir.

## Hata Yönetimi: Rate Limit, Timeout, Malformed Output

Claude API production kullanımında en yaygın hatalar: 429 (rate limit), 503 (service unavailable), 408 (timeout), 400 (malformed request). n8n'in "HTTP Request" node'u bu hataları otomatik yakalamaz — siz yakalarsınız. Default davranış: hata aldığınızda workflow durur. Ama otonomi istiyorsanız, durmak yerine retry etmelisiniz.

Retry logic'i "Function" node içinde yazarsınız (JavaScript):

```javascript
const maxRetries = 3;
let retries = 0;
let response;

while (retries < maxRetries) {
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { /* ... */ },
      body: JSON.stringify({ /* ... */ })
    });
    
    if (response.status === 429) {
      // Exponential backoff: 2^retries saniye bekle
      await new Promise(r => setTimeout(r, Math.pow(2, retries) * 1000));
      retries++;
      continue;
    }
    
    if (response.ok) break;
    
    throw new Error(`HTTP ${response.status}`);
  } catch (err) {
    retries++;
    if (retries >= maxRetries) throw err;
  }
}

return { json: await response.json() };
```

Bu kod 429 aldığında 2 saniye, sonra 4 saniye, sonra 8 saniye bekler — exponential backoff. Anthropic bu stratejiyi öneriyor. n8n'de Function node her zaman JavaScript runtime'ı destekler, bu nedenle async/await kullanabilirsiniz.

Diğer yaygın hata: Claude malformed JSON döner. Özellikle JSON output'u zorladıysanız (prompt'ta "JSON formatında cevap ver" derseniz), Claude bazen markdown code fence ekler (` ```json ... ``` `). Bu response'u parse edemezsiniz. Çözüm: response'u regex ile temizleyin:

```javascript
let rawText = $json.content[0].text; // Claude'un raw response'u
rawText = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
const parsed = JSON.parse(rawText);
return { json: parsed };
```

Bu pattern'i her Claude call sonrasına koyun — malformed output riskini %80 düşürür.

Son olarak, timeout'lar. Claude'un yanıt süresi prompt complexity'ye bağlı — 200 token prompt genelde 2-3 saniyede döner, 2000 token prompt 15-20 saniye sürebilir. n8n'in HTTP node'unun default timeout'u 300 saniye (5 dakika) — production için bu çok uzun. 30 saniye timeout koyun, aşarsa fallback stratejisi tetikleyin (örn: prompt'u kısaltıp yeniden deneyin, ya da cevabı cache'den çekin).

## Cost Control: Token Budget ve Prompt Caching

Claude API kullanımında maliyet, token sayısına bağlıdır. Input token (sizin gönderdiğiniz) + output token (Claude'un ürettiği) toplamı faturalanır. Haiku modeli ($0.25 / 1M input token, $1.25 / 1M output token — 2026 fiyatı) maliyet-verimlidir, ama Sonnet/Opus daha pahalıdır. n8n workflow'unda cost control yapmak istiyorsanız, iki mekanizma kullanın: token budget ve prompt caching.

Token budget: her workflow execution'da maksimum ne kadar token harcayabileceğinizi sınırlayın. Örneğin günlük 1000 keyword analiz ediyorsanız, her keyword için 500 input + 1500 output token (toplamda 2000 token / keyword) bekliyorsunuz. 1000 keyword × 2000 token = 2M token/gün = Haiku ile $2.50/gün. Ama bir keyword için Claude 10,000 token output üretirse (örn: çok uzun bir analiz), bütçe patlar. Bu yüzden Claude'a `max_tokens` parametresi gönderin:

```json
{
  "model": "claude-3-5-haiku-20241022",
  "max_tokens": 1500,
  "messages": [...]
}
```

Bu garantiye alır: Claude asla 1500 token'dan fazla output üretmez. Eğer cevabı kesmek zorunda kalırsa (`stop_reason: "max_tokens"`), bunu yakalayıp retry ettirebilirsiniz (ancak genelde gerek kalmaz — 1500 token 1200 kelimeye denk gelir, analiz için yeterlidir).

Prompt caching ise maliyeti %90 düşürür. Anthropic'in prompt caching mekanizması şöyle çalışır: eğer aynı system prompt'u tekrar kullanırsanız, ikinci call'da sadece değişen kısmın token'ları faturalanır. Örneğin 2000 token'lık bir master prompt (bu dokümantasyondaki gibi) her keyword için aynı kalıyorsa, cache hit rate %95 olur — yani her call'da 2000 token yerine 100 token input ödüyorsunuz demektir. n8n'de prompt caching'i etkinleştirmek için, system prompt'u GitHub'da saklayın, her call'da raw URL üzerinden çekin, ve `cache_control` parametresi ekleyin:

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "system": [
    {
      "type": "text",
      "text": "{{$json.masterPrompt}}",
      "cache_control": {"type": "ephemeral"}
    }
  ],
  "messages": [...]
}
```

Bu Roibase'in blog üretim workflow'unda uyguladığımız pattern. Master prompt 5000 token — cache ile 1. call'da 5000 token input ödüyoruz, sonraki 99 call'da 50 token (sadece değişen keyword). Ayda 3000 makale üretiyorsak, caching olmadan 15M token ($3.75), caching ile 450K token ($1.12) — %70 tasarruf.

## Observability: Workflow'u Gözlemlemek

Otonom sistem kurduğunuzda, "çalışıyor mu" sorusu yetmez — "nerede yavaş, nerede hata veriyor, hangi node kaç saniye sürüyor" sorularına cevap vermelisiniz. n8n'in built-in execution log'ları var ama yeterli değil — her node'un latency'sini, Claude'un response time'ını, error rate'ini izlemek istersiniz. Bunu external observability tool ile çözerseniz (örn: Datadog, Grafana, Prometheus), workflow'dan metric push etmeniz gerekir.

Basit pattern: her kritik node sonrasına "HTTP Request" node ekleyip Prometheus pushgateway'e metric gönderin. Örnek metric:

```
# Claude API call latency (milliseconds)
claude_api_latency_ms{workflow="blog_generator", model="haiku"} 2340

# Token usage (input + output)
claude_token_usage{workflow="blog_generator", type="input"} 450
claude_token_usage{workflow="blog_generator", type="output"} 1200

# Error count
workflow_error_count{workflow="blog_generator", node="claude_call", error_type="429"} 1
```

Bu metricleri Grafana dashboard'da görselleştirirseniz, hangi workflow'un ne kadar token tükettiğini, hangi node'un bottleneck olduğunu, rate limit'e ne sıklıkla takıldığınızı görürsünüz. Roibase'in production sisteminde bu dashboard sayesinde Claude API latency'sinin 3 saniyeden 1.8 saniyeye düştüğünü gözlemledik (prompt caching + model upgrade ile).

Alternatif: n8n'in webhook node'u üzerinden log aggregation servisine (örn: Loki, Elasticsearch) yapılandırılmış log gönderin. Her execution sonunda `{"workflow": "...", "execution_id": "...", "duration_ms": ..., "tokens": {...}}` şeklinde JSON log atarsanız, ELK stack ile query edebilirsiniz.

## Şimdi Ne Yapmalı

n8n + Claude API ile otonom workflow kurmanın üç temel ilkesi: idempotency (aynı işi iki kez yapma), hata yönetimi (retry + fallback), cost control (token budget + caching). Production ortamında bu üçü olmadan sistemin kırılganlığı artar — manual müdahale gereği artar, otomasyon avantajı kaybolur. Workflow'unuzu tasarlarken her node için şu soruları sorun: "Bu node hata verirse ne olur?", "Bu node aynı input'u iki kez alırsa ne olur?", "Bu node 10 saniyeden fazla sürerse ne olur?". Cevaplar mimariyi belirler.

Eğer marketing operasyonlarınızı LLM ile ölçeklendirmek istiyorsanız, bu engineering prensiplerini uygulamadan başlamayın. [First-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) üzerine kurulu bir sistem, Claude'un output'unu decision engine'e besleyebilir — ama feed edilecek data'nın kendisi temiz ve idempotent olmalıdır. Aksi takdirde otomasyon garbage in, garbage out döngüsüne girer.