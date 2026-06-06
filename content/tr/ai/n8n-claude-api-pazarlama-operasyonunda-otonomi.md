---
title: "n8n + Claude API: Pazarlama Operasyonunda Otonomi"
description: "Otonom workflow tasarımı, idempotency, hata yönetimi — production-grade LLM otomasyonunun mühendislik gerçekleri."
publishedAt: 2026-06-06
modifiedAt: 2026-06-06
category: ai
i18nKey: ai-005-2026-06
tags: [llm-automation, n8n-workflows, idempotency, claude-api, production-ai]
readingTime: 8
author: Roibase
---

Pazarlama operasyonları manuel döngülerle tıkanıyor: veri eksport et, tabloda clean yap, prompt yaz, output'u kopyala, CMS'e yapıştır, publish et. Her adımda insan, her insan adımında latency. LLM API'leri bu döngüyü kırma vaat ediyor ama production'da çalışan otonom sistem kurmak prompt yazmaktan farklı. n8n gibi no-code workflow platformu ile Claude API'yi birleştirdiğinde kazandığın 10x hız, doğru mimarinin yanına idempotency, hata yönetimi ve observability eklemeden sürdürülemez.

## Manuel Operasyonun Asıl Maliyeti: Karar Gecikmesi

Pazarlama ekipleri içerik üretiyor, kampanya planı yapıyor, raporlama yapıyor. Her işlem birden fazla sistemde veri taşımayı, insanın formatını düzeltmesini, approval döngüsünü gerektiriyor. Asıl problem cycle time değil — decision latency. İçerik fikrini approve'a sunarken keyword opportunity window kapanıyor, kampanya brief'i yazdığın hafta rakibin aynı mesajı yayına almış. Manuel süreç hızını artırmak 2x kazandırır, otonom sistem 10x değil, karar anını production anına yaklaştırır.

Otonom workflow'un tanımı: tetikleme sinyalinden (örn. Google Search Console'da query trending oldu) çıktıya (blog post published) kadar **insan onayı olmadan** işlevi tamamlamak. Bu "AI content generator" değil — AI, veri pipeline'ı, quality gate, deployment pipeline'ı entegre çalışır. n8n bu pipeline'ın orchestration katmanı, Claude API cognitive işlem katmanı. İkisi arasındaki tasarım yanlışsa output garbage, doğruysa operasyon capacity 10x büyür.

Production'da otonom workflow 3 şartı taşımalı: **idempotent** (aynı input tekrar işlense aynı sonuç), **fault-tolerant** (API timeout'u workflow'u patlatmaz), **observable** (ne olduğu görünür). Bu şartları sağlamadan kurduğun sistem ilk rate limit hatasında durur, duplicate içerik üretir, neden hata verdiğini 3 saat debug edersin.

## n8n Workflow Mimarisi: Node Tasarımı Hata Yönetimi Değil, Süreç Tasarımıdır

n8n drag-and-drop'la node bağlarsın, her node bir işlem: HTTP request, veritabanı query, IF koşul, loop. Pazarlama otomasyon senaryoları genelde şu akışı takip eder: trigger (webhook / schedule), veri getir (API / DB), dönüştür (set node), LLM API çağır, çıktıyı validate et, hedef sisteme yaz (CMS / Slack / Sheets). Hatalı tasarım her adımı doğrudan birbirine bağlar — bir node fail olursa tüm workflow durur, retry logic yok, hatalı output downstream'e geçer.

Doğru mimari **zone** düşünür: input zone, processing zone, validation zone, output zone. Her zone kendi içinde retry, logging, fallback içerir. Örnek senaryo: Google Search Console'dan keyword trending oldu → BigQuery'den ilgili historical query data çek → Claude API'ye makale ürettir → içeriği quality gate'den geçir (kelime sayısı, iç link varlığı, prohibited term check) → geçerse GitHub'a commit et, geçmezse Slack'e hata gönder.

Bu akışı tek bir doğrusal chain olarak kodlarsan Claude API 429 (rate limit) dönerse workflow patlır, retry yok, data kaybı var. Zone tasarımında processing zone timeout sonrası exponential backoff ile retry eder, 3 retry sonrası başarısız output'u validation zone'a garbage olarak gönderir, validation zone bunu reject edip output zone'a hiç yazmaz. Slack'e "Claude timeout, 3 retry sonrası abort" mesajı gider, insan müdahale edebilir. Aynı keyword tekrar trigger olursa idempotency check (BigQuery'de "bu keyword için son 7 günde üretilmiş makale var mı" query) duplicate üretimi durdurur.

### Idempotency: Aynı Input Tekrar İşlense Aynı Sonuç

Otonom sistemde trigger birden fazla kez tetiklenebilir: webhook duplicate gelir, scheduled job overlap olur, retry logic aynı eventi tekrar işler. Idempotent olmayan workflow her trigger'da yeni output üretir — 1 keyword için 5 makale yayınlanır, CMS spam olur. Idempotency key pattern uygula: her işleme unique ID ver (örn. GSC query hash + tarih), işlem başlangıcında ID'nin daha önce işlenip işlenmediğini kontrol et. İşlenmişse skip et, işlenmemişse devam et, bitince ID'yi "completed" olarak kaydet.

n8n'de idempotency node'u IF koşulu + database check kombiyonu: Redis veya PostgreSQL'de `processed_events` tablosu tut, workflow başlangıcında `SELECT * FROM processed_events WHERE event_id = {hash}` query at. Sonuç varsa workflow'u STOP node ile durdur, yoksa devam ettir, son adımda `INSERT INTO processed_events (event_id, timestamp)` yaz. Bu pattern Claude API çağırmadan önce duplicate kontrol sağlar — API call maliyetli, duplicate check ucuz.

## Claude API Entegrasyonu: Prompt Versiyonlama ve Retriable Error Handling

Claude API'yi n8n'den HTTP Request node ile çağırırsın. Request body:

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 4096,
  "system": "{{$node[\"Fetch_System_Prompt\"].json.prompt}}",
  "messages": [
    {
      "role": "user",
      "content": "KEYWORD: {{$node[\"GSC_Data\"].json.query}}\nCATEGORY: {{$node[\"Set_Variables\"].json.category}}"
    }
  ]
}
```

`system` promptu **hard-code etme**. GitHub'da master prompt dosyası tut, n8n workflow'da HTTP Request node ile raw GitHub URL'den çek. Böylece prompt değişince workflow'a dokunmadan yeni versiyon kullanılır. Versiyonlama için git branch kullan: main branch production prompt, test branch deneysel prompt. n8n'de environment variable ile branch seçimini parametrize et.

Claude API 3 hata sınıfı döner: **4xx** (client hatası, retry etme — invalid request, prompt policy ihlali), **429** (rate limit, exponential backoff ile retry et), **5xx** (server hatası, retry et ama backoff limit koy). n8n'de HTTP Request node timeout ayarı default 5 saniye — bunu 30 saniyeye çıkar, uzun content generation request'leri 5 saniyede timeout olur. Retry logic ekle: "On Error" workflow path tanımla, error tipi 429 veya 5xx ise wait node (2s → 4s → 8s backoff) ekle, tekrar dene. 3 retry sonrası başarısız olursa fallback path'e gönder — burada Slack notification + error logging yap, workflow'u gracefully durdur.

### Output Validation: LLM Çıktısının Quality Gate'i

Claude API response her zaman kullanılabilir formatta gelmez: markdown frontmatter eksik olur, kelime sayısı hedefin altında kalır, iç link kural ihlali olur. Validation zone bu outputu kontrol eder, pass olmayan içeriği downstream'e göndermez. n8n'de Code node ile JavaScript validation fonksiyonu yaz:

```javascript
const output = $input.first().json.content;
const wordCount = output.split(/\s+/).length;
const hasFrontmatter = output.startsWith('---');
const internalLinkCount = (output.match(/\[.*?\]\(https:\/\/www\.roibase\.com\.tr.*?\)/g) || []).length;

if (wordCount < 1400) return { valid: false, reason: "word_count_low" };
if (!hasFrontmatter) return { valid: false, reason: "no_frontmatter" };
if (internalLinkCount < 1) return { valid: false, reason: "missing_internal_link" };

return { valid: true, content: output };
```

IF node ile `valid === false` path'i reject eder, `valid === true` path output zone'a gider. Reject path'de Slack'e detaylı hata mesajı gönder: "Claude output 1250 kelime — 1400 minimum gerekli. Retry ediliyor." Retry logic prompt'a ek constraint ekler: "Previous output 1250 words, minimum is 1400. Expand section 2 and 3." Bu iterative refinement loop LLM output'unu production quality'e çıkarır.

## Observability: Workflow Neden Durdu, Nerede Takıldı

Otonom sistem sessizce başarısız olursa değeri yoktur. n8n workflow execution loglama default yaptığı için "workflow çalıştı" görürsün ama "hangi node 8 saniye sürdü", "Claude API response time 3x arttı" görünmez. Production observability 3 katman gerektirir: **execution log** (workflow seviyesi başarı/başarısızlık), **node duration metrics** (hangi adım ne kadar sürdü), **business metrics** (kaç makale üretildi, kaçı publish edildi).

n8n'de her node sonrası Set node ekle, timestamp + node adı kaydet. Workflow bitiminde tüm timestamp'leri Postgres'e yaz, Grafana ile görselleştir. Claude API latency tracking için HTTP Request node başlamadan önce timestamp al, response geldikten sonra duration hesapla, bu değeri metric olarak push et. BigQuery'ye `workflow_executions` tablosu oluştur:

```sql
CREATE TABLE workflow_executions (
  execution_id STRING,
  workflow_name STRING,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds FLOAT64,
  status STRING, -- success / failed / timeout
  error_message STRING
);
```

Her workflow execution'da bu tabloya INSERT yap. Haftalık query: "Ortalama workflow duration", "başarı oranı", "en sık fail eden node". Bu metrik [veri analizi](https://www.roibase.com.tr/tr/verianalizi) pipeline'ına besle — hangi prompt versiyonunun daha hızlı döndüğünü, hangi kategoride validation fail oranının yüksek olduğunu gör.

## Production Deployment: Environment Separation ve Rate Limit Yönetimi

Test workflow'unu production'a taşırken environment separation zorunlu. n8n'de credential system var — Claude API key, GitHub token, database connection string environment variable olarak tanımlanır. Development environment test API key kullanır (rate limit düşük, maliyet yok), production environment production key kullanır. n8n workflow JSON export et, git'e commit et — bu IaC (Infrastructure as Code) yaklaşımı workflow'u versiyonlamayı sağlar.

Rate limit stratejisi: Claude API tier'ına göre RPM (request per minute) limiti var. Örneğin Tier 2: 50 RPM. Eğer scheduled workflow her 5 dakikada tetiklenip 20 keyword için makale üretiyorsa her tetikleme 20 request yapar — RPM limit aşılır, API 429 döner. n8n'de **batch processing** uygula: 20 keyword'u 5'erlik gruplara böl, her grup arasında 60 saniye wait node ekle. Böylece RPM limit aşılmaz. Alternatif: queue system — RabbitMQ veya Redis queue kullan, keyword'leri queue'ya bas, consumer workflow sırayla işler. Bu yaklaşım scale eder — 100 keyword olsa bile queue sürekli boşalır, rate limit aşılmaz.

## Otonom Sistemin Sınırları: İnsan Karar Noktalarını Tanımlamak

Otonom workflow her kararı almaz. Hangi işlemler tam otonomiye uygun, hangileri human-in-the-loop gerektirir? Kriter: output'un business impact'i + error maliyeti. Örnek: blog post üretimi → business impact orta, error maliyeti düşük (kötü makale yayınlanırsa unpublish edersin) → tam otonom. Örnek: Google Ads kampanya bid stratejisi değişimi → business impact yüksek, error maliyeti yüksek (yanlış bid 1 günde bütçe bitirir) → human approval gerekli.

n8n'de approval node pattern: workflow validation geçtikten sonra Slack'e mesaj gönder, approve/reject button ekle. Approval gelene kadar workflow "waiting" state'inde bekler. Approve gelirse devam eder, reject gelirse durdurur. Timeout ekle — 24 saat içinde approval gelmezse auto-reject. Bu hybrid model otonominin hızını approval kontrolüyle dengeler. Zamanla approval pattern'lerini öğren: "kelime sayısı >1500 ve iç link >2 olan makaleler %95 approve alıyor" → bu subset için approval gate kaldır, tam otonomiye geçir.

## Maliyeti Ölçülebilir Kılmak: Token Budget ve ROI Tracking

Claude API token bazlı fiyatlandırma: input token + output token. Sonnet 3.5: $3/1M input token, $15/1M output token (Haziran 2026). Ortalama makale: 1500 input token (system prompt + user prompt), 8000 output token (1500 kelime makale + frontmatter). Maliyet: (1500 × $3 + 8000 × $15) / 1M = $0.124 per article. Günde 10 makale → $1.24/gün → $37/ay. Manuel yazarsa 1 makale 2 saat × $50/saat = $100 → 10 makale $1000. Otomasyon ROI: 96% cost reduction.

n8n'de token tracking: Claude API response `usage` field döner: `{prompt_tokens: 1523, completion_tokens: 8042}`. Bu değerleri her execution'da BigQuery'ye log'la. Aylık dashboard: toplam token, toplam maliyet, makale başına maliyet. Prompt versiyonu değiştirince token consumption değişir — uzun prompt daha pahalı ama daha iyi output verir. A/B test yap: 1 hafta eski prompt (1500 input token), 1 hafta yeni prompt (2000 input token), output quality metrics karşılaştır. Quality artışı maliyet artışını justify ediyorsa yeni prompt'a geç.

Otonom workflow'u pazarlama operasyonuna entegre etmek manuel süreçten 10x hızlı çıktı sağlar ama production'da çalışan sistem idempotency, hata yönetimi, observability gerektiriyor. n8n orchestration sağlar, Claude API cognitive işlemi yapar, ikisi arasındaki tasarım hatası duplicate content, API timeout, maliyetsiz scale engeli yaratır. Workflow zone mimarisi, retry logic, validation gate, environment separation, token tracking — bu engineering disiplin LLM otomasyonunu güvenilir production sistemine dönüştürür. Manuel onay noktalarını stratejik tut, tam otonomiye kademeli geç, maliyeti ölçülebilir kıl.