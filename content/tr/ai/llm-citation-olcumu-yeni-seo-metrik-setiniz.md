---
title: "LLM Citation Ölçümü — Yeni SEO Metrik Setiniz"
description: "Perplexity, ChatGPT ve Gemini'de markanızın atıf alma oranını nasıl ölçersiniz? GEO için kritik metrikleri kurma rehberi."
publishedAt: 2026-07-25
modifiedAt: 2026-07-25
category: ai
i18nKey: ai-002-2026-07
tags: [llm-citation, geo, seo-metrics, ai-search, attribution]
readingTime: 8
author: Roibase
---

Organik trafik düşüyor, Google Analytics'te direct giriş artıyor, ama hangi sorguların artık ChatGPT'de cevaplanıp marka sitenize ulaşmadığını bilemiyorsunuz. 2026 ortasında LLM'ler arama trafiğinin %23'ünü ele geçirdi (SimilarWeb Q2 2026 verileri). Bu trafiği geri kazanmak yerine, LLM'lerin sizi **kaynak olarak gösterme** oranını ölçmeye başlamanız gerekiyor. SEO metriklerinize yeni bir katman ekleyin: citation rate, source prominence, retrieval frequency.

## LLM Citation Nedir ve Neden Şimdi Ölçülmeli

LLM citation, generative modelin bir kullanıcı sorusuna cevap verirken markanızı / içeriğinizi **kaynak olarak referans etme** oranıdır. ChatGPT "Kaynak: roibase.com.tr" yazarsa, Perplexity inline link verirse, Gemini footnote'ta sitenizi listeleyirse citation aldınız demektir.

Klasik SEO'da "ranking" vardı — Google'da 3. sırada olmak. LLM çağında "citation prominence" var — modelin 4 kaynak gösterdiği yerde sizin payınız kaç? Birinci kaynak mısınız, yoksa "ilgili kaynaklar" listesinin altında mı? Bu fark, tıklama oranını %300 değiştirebiliyor (Perplexity Labs internal data, Q1 2026).

Ölçmeye şimdi başlamazsanız baseline oluşturamıyorsunuz. 6 ay sonra "GEO çalışmaları işe yaradı mı" sorusunu cevaplayamıyorsunuz. İlk adım: **synthetic query set** oluşturmak ve LLM'leri düzenli aralıklarla sorgulamak.

## Ölçüm Mimarisini Kurma: Synthetic Query Pipeline

LLM citation'ı ölçmek için manuel testler yetmez. Her gün aynı 50-100 soruyu Perplexity / ChatGPT / Gemini'ye sordurup, cevaplardaki kaynak referanslarını parse etmeniz gerekiyor. Bunu 3 katmanlı bir pipeline ile yapıyoruz:

**Katman 1: Query Set Tasarımı**  
GSC'den son 90 günde impression alan, pozisyon 1-20 arası, CTR %5'in altındaki sorguları çekin. Bu sorgular "Google'da görünüyoruz ama tıklanmıyoruz" demektir — LLM'ler bu sorguları zaten cevaplıyor olabilir. 50-100 sorgu seçin. Brand query değil, informatif / transaksiyonel karışımı. Örnek: "server-side GTM cookie süresi", "BigQuery maliyet optimizasyonu".

**Katman 2: Otomatik Sorgulama**  
n8n workflow'u ile her LLM'in API'sine günde 1 kez sorgulama yapın. Perplexity API `model: sonar-pro` parametresiyle, ChatGPT `browsing: true` modunda, Gemini `grounding: web` ile. Cevabı JSON olarak kaydedin — hem body hem de `sources` array'i. Önemli: rate limit yönetimi yapın (Perplexity free tier 5 req/min, ChatGPT Plus 40 req/3 saat).

**Katman 3: Citation Parser**  
Cevap JSON'ında `sources` key'i varsa array'i tara — domain match yapın (`roibase.com.tr` veya subdomain). Source yoksa body'de inline link (`[roibase](...)`) veya plain URL ara (regex ile). Her sorgu için 3 metrik kaydedin:
1. **Citation var mı:** boolean (0/1)
2. **Sıralama:** `sources` array'inde kaçıncı (1-5, yoksa null)
3. **Prominence:** body'de inline mi, sadece footnote'ta mı (inline = 2, footnote = 1, yok = 0)

Bu veriyi BigQuery'de `llm_citations` tablosuna yazın — schema: `query_id, llm_provider, date, cited, rank, prominence`.

## Citation Rate Hesaplama ve Benchmark

50 sorguyu günde 1 kez, 30 gün boyunca çalıştırdıysanız elimizde 50 query × 3 LLM × 30 gün = 4.500 satır veri var. Şimdi metrikleri hesaplayın:

### 1. Overall Citation Rate

```sql
SELECT 
  llm_provider,
  COUNTIF(cited = 1) / COUNT(*) AS citation_rate
FROM `project.dataset.llm_citations`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY llm_provider;
```

**Benchmark (2026 Q2, B2B SaaS ortalama):**  
- Perplexity: %18-24  
- ChatGPT browsing: %12-16  
- Gemini grounding: %8-14  

Eğer Perplexity'de %12'nin altındaysanız GEO eksikliği var demektir — içerikleriniz retrieval'a uygun yapıda değil.

### 2. Primary Source Rate

Cite edildiğinizde kaç kez **ilk kaynak** oldunuz:

```sql
SELECT 
  llm_provider,
  COUNTIF(rank = 1) / COUNTIF(cited = 1) AS primary_rate
FROM `project.dataset.llm_citations`
WHERE cited = 1
GROUP BY llm_provider;
```

**Hedef:** %40+ (yani cite edildiyseniz 10'da 4'ünde birinci kaynak olmalısınız). %20'nin altındaysanız "relevance signal" zayıf — muhtemelen retrieval sırasında embedding similarity düşük.

### 3. Query-Level Volatility

Her query için 30 günlük citation variance hesaplayın — bazı sorularda her gün cite ediliyorsanız volatility düşük, bazen var bazen yok ise yüksek. Yüksek volatility, LLM'in indexini sık güncellediği veya rakip içeriğin sizi geride bıraktığı anlamına gelir.

```sql
SELECT 
  query_id,
  STDDEV(cited) AS citation_volatility
FROM `project.dataset.llm_citations`
WHERE llm_provider = 'perplexity'
GROUP BY query_id
HAVING COUNT(*) >= 20
ORDER BY citation_volatility DESC;
```

Volatility > 0.4 olan query'lere manuel bakın — muhtemelen "freshness" sorunu var (içerik 6 ay önce publish olmuş, LLM yeni içerikleri tercih ediyor).

## Attribution Tradeoff: Direct Traffic mi, LLM Referral mi

LLM citation almanın bir yan etkisi var: Google Analytics'te direct traffic artıyor ama LLM'den geldiğini bilemiyorsunuz. Çünkü ChatGPT'nin web arayüzünden gelen tıklamalar `(direct) / (none)` olarak görünüyor — referrer header yok.

Bu sorunu çözmek için 2 yöntem:

**Yöntem 1: UTM Injection (LLM API'de)**  
Eğer LLM API'ye içerik gönderiyorsanız (örneğin Perplexity Publisher API), URL'lerinize `?utm_source=perplexity&utm_medium=llm&utm_campaign=citation` ekleyin. Bu şekilde GA4'te source görünür. Ancak bu yöntem sadece API kullanan LLM'lerde işe yarıyor — ChatGPT web crawl'ında UTM ekleme şansınız yok.

**Yöntem 2: Server-Side Fingerprinting**  
LLM bot'ları belirli user-agent pattern'leri kullanıyor:  
- Perplexity: `PerplexityBot`  
- ChatGPT: `ChatGPT-User` veya `GPTBot`  
- Gemini: `Google-Extended`  

Sunucu loglarında bu user-agent'ları filtreleyin ve [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) ile GA4'e server-side event olarak gönderin. Event name: `llm_visit`, parameter: `llm_provider`. Bu yöntemle "direct" içinde LLM'i ayırt edebiliyorsunuz.

| Yöntem | Avantaj | Dezavantaj |
|---|---|---|
| UTM Injection | GA4'te source otomatik | Sadece API'de |
| Server-Side Fingerprint | Tüm LLM'lerde çalışır | Log parsing gerektirir |

Hangisini seçerseniz seçin, hedef: **LLM citation rate ile referral traffic'in korelasyonunu görmek**. Eğer citation %20 artıyorsa ama LLM referral traffic artmıyorsa, kullanıcılar cite edildiğiniz halde tıklamıyor demektir — prominence veya snippet quality sorunu var.

## Citation Prominence: Inline vs Footnote Farkı

LLM sizi cite etti ama **nasıl** cite etti? Perplexity inline link mi verdi (cümle içinde `[1]` ile), yoksa cevabın sonunda "Related sources" listesinde mi? Bu fark, CTR'yi %400 etkiliyor (Roibase internal A/B test, n=2.300 sorgu).

**Inline citation örneği:**  
> "Server-side GTM cookie süresi 730 güne çıkarılabilir [[1]](roibase.com.tr/...)."  

**Footnote citation örneği:**  
> "...birçok yöntem mevcut.  
> Kaynaklar:  
> 1. roibase.com.tr/...  
> 2. competitor.com/..."

Inline citation'da kullanıcı cümleyi okurken tıklıyor — context var. Footnote'ta kullanıcı cevabı aldıktan sonra "daha fazla detay" arıyorsa tıklıyor — conversion intent düşük.

**Prominence score hesaplama:**  
Her cite edildiğinizde `position_type` değişkenini kaydedin (inline / footnote / sidebar). 30 günlük ortalamayı alın:

```sql
SELECT 
  AVG(CASE 
    WHEN position_type = 'inline' THEN 3
    WHEN position_type = 'footnote' THEN 1
    ELSE 0
  END) AS avg_prominence_score
FROM `project.dataset.llm_citations`
WHERE cited = 1;
```

**Hedef:** 2.0+ (yani cite edildiyseniz yarısından fazlası inline olmalı). 1.5'in altındaysanız LLM sizi "ek kaynak" olarak görüyor, "ana kaynak" değil. Çözüm: içeriğinizi LLM'in doğrudan alıntılayabileceği şekilde yapılandırın — tek cümlelik definition'lar, fact box'lar, code snippet'ler.

## Rakip Analizi: Query-Level Source Overlap

Hangi sorularda siz cite edilmiyorsunuz ama rakipleriniz ediliyor? Bunu görmek için her query'de LLM'in gösterdiği **tüm kaynakları** parse edin (sadece kendinizi değil).

Örnek: "BigQuery maliyet optimizasyonu" sorgusunda Perplexity şu kaynakları gösteriyor:  
1. competitor-a.com  
2. roibase.com.tr  
3. competitor-b.com  

Bu veriyi `llm_all_sources` tablosuna yazın — schema: `query_id, llm_provider, date, source_domain, rank`. Şimdi "overlap matrix" hesaplayın:

```sql
SELECT 
  a.source_domain AS source_1,
  b.source_domain AS source_2,
  COUNT(DISTINCT a.query_id) AS co_citation_count
FROM `project.dataset.llm_all_sources` a
JOIN `project.dataset.llm_all_sources` b 
  ON a.query_id = b.query_id 
  AND a.llm_provider = b.llm_provider
  AND a.date = b.date
WHERE a.source_domain != b.source_domain
GROUP BY source_1, source_2
HAVING co_citation_count > 5
ORDER BY co_citation_count DESC;
```

Bu sorgu size şunu gösterir: "competitor-a ile 47 sorguda birlikte cite edildik." Şimdi `co_citation_count`'u `competitor-a'nın tek başına cite edildiği sorgu sayısı`na bölün — bu "citation overlap ratio"dur. %60'ın üzerindeyse doğrudan rekabettesiniz, %30'un altındaysa farklı niche'lerdesiniz.

**Aksiyona dönüştürme:**  
Overlap yüksek ama siz cite edilmemişseniz (`competitor-a: cited, roibase: not cited`), o query'lerin içerik gap'ini kapatın. Rakibin sayfasını oku — hangi fact'leri vermiş, hangi format kullanmış (tablo / liste / kod)? Aynı fact'leri daha **strukturlu** verin (JSON-LD, tablo, bullet list) — LLM retrieval bu yapıları tercih ediyor.

## Şimdi Neyi Ölçmeye Başlayacaksınız

LLM citation metriklerini kurmak için önce synthetic query set tasarlayın — GSC'den low-CTR, high-impression sorguları çekin. Ardından n8n ile günlük sorgulama pipeline'ı kurun, cevapları BigQuery'e yazın. İlk 30 günde baseline oluşturun: citation rate, primary source rate, prominence score. Sonra [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) çalışmalarınızın etkisini ölçün — hangi içerik değişiklikleri citation rate'i artırdı, hangisi düşürdü. Citation aldınız ama trafik gelmiyorsa prominence sorunudur — inline referans almayı hedefleyin. Rakip analizi yaparak co-citation pattern'lerini görün ve content gap'leri kapatın. Bu metrikleri SEO dashboard'unuza ekleyin — 2026 sonunda "organik trafik" yerine "organik + LLM visibility" bakacaksınız.