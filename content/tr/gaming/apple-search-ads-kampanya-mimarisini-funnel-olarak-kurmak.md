---
title: "Apple Search Ads: Kampanya Mimarisini Funnel Olarak Kurmak"
description: "Discovery'den brand'e bütçe akışı: broad match, competitor ve exact kampanyaları nasıl hiyerarşik funnel haline getirirsiniz — ASA mimarisi."
publishedAt: 2026-06-17
modifiedAt: 2026-06-17
category: gaming
i18nKey: gaming-005-2026-06
tags: [apple-search-ads, asa-kampanya-mimarisi, mobile-user-acquisition, app-funnel-strategy, brand-defense]
readingTime: 8
author: Roibase
---

Apple Search Ads kampanyalarını izole silo'lar olarak değil, birbirine bütçe ve sinyal aktaran funnel katmanları olarak kurmak, mobile game growth'unda CPP'yi %20-40 aralığında düşürebiliyor. Discovery broad match'te yakalanan kullanıcı sinyali competitor exact'e, oradan brand defense'e akıyor — her katman bir sonraki için filtering görevi görüyor. 2026'da iOS 18.2 sonrası custom product page attribution verisi bu mimariyi zorunlu kılıyor: single campaign yaklaşımı churn'ü gizliyor, bütçe dağılımı aşırı manuel kalıyor.

## Discovery Katmanı: Broad Match Mod Neden En Üstte Durmalı

Broad match kampanyaları Apple Search Ads hiyerarşisinde discovery katmanıdır — yeni keyword cluster'ları keşfetmek, unexpected intent sinyallerini yakalamak için vardır. Ancak çoğu studio bu modu "her şeyi dene, sonra filtrele" mantığıyla açık bırakıyor, günde 500-1000 dolar yakıp TTR (Tap-Through Rate) %2.5'in altında kalıyor. Doğru yaklaşım: broad match'i funnel'ın en üst katmanına koymak, ama **3 günlük rolling window** ile CPP eşiği kontrol altında tutmak.

Broad kampanyada hedef CPP değil, **LTV/CPI ratio**'su — ilk 3 günde 0.4x kabul edilebilir, çünkü keyword data warehouse'a gidiyor. Bu verinin değeri şurada: Search Match algoritması oyununuzun competitive set'ini Apple'ın gözünden görmenizi sağlıyor. Örneğin "puzzle game" broad match ile başlattığınızda algoritma "merge", "match-3", "interior design" gibi intent cluster'larını ortaya çıkarıyor — bunlar competitor exact kampanyasına migration candidate oluyor.

Kritik ayar: broad kampanyada **exact negative eklemek YASAK**. Negatif keyword sadece irrelevant category'lere (örn. "poker", "casino" oyun türü farklıysa) uygulanmalı. Exact negative koymak algoritmanın learning loop'unu kesiyor, discovery fonksiyonunu öldürüyor.

### Broad Match için Bütçe Tavanı Formülü

```python
daily_budget_broad = (target_monthly_installs * 0.15) * target_CPI * 1.8
# 0.15 → discovery payı (%15)
# 1.8 → broad CPI multiplier (exact'in 1.8x'i kabul edilebilir)
```

Örnek: Aylık 10K install hedefi, $2.5 target CPI → $6,750/ay broad bütçe → günlük ~$225. Bu tavan aşılırsa broad discovery yerine waste yapıyor demektir.

## Competitor Exact: Intent Hijacking Katmanı

Broad match'ten çıkan keyword'ler içinde **rakip oyun adları** ve **rakip brand termleri** varsa, bunlar ikinci katmana — competitor exact kampanyasına — taşınmalı. Bu katmanın mantığı basit: rakibin brand awareness'ını hijack etmek. Kullanıcı "Candy Crush" arıyor, siz kendi puzzle oyununuzu gösteriyorsunuz — zaten intent education yapılmış, siz sadece alternative sunuyorsunuz.

Competitor exact'in TTR'ı brand exact'e göre %30-50 daha düşük (Apple'ın kendi verisi), ama CPP genelde %15-25 daha ucuz çünkü rakip kelime üzerinde bid competition az. Önemli olan: competitor kampanyasında **custom product page stratejisi** değişmeli. Rakip "time management" oyunuysa, CPP creative'iniz "daha az waiting time" mesajı vermeli — bu differential positioning olmadan competitor exact ROI negatif kalır.

Competitor keyword seçiminde yanlış yapılan: top-grossing chart'tan ilk 20 oyunu almak. Doğru yöntem: **audience overlap analysis** — Sensor Tower veya data.ai'dan rakip oyunun user demographic'ini çekmek, sizinle %60+ overlap olanları seçmek. Örneğin hyper-casual oyununuz varsa match-3 legend oyunlarının keyword'ünü almak waste — audience core motivation farklı.

| Competitor Type | TTR Benchmark | CPP vs Brand Delta | CPP Kullanımı |
|---|---|---|---|
| Direct competitor (aynı subgenre) | 3.5-5% | +%15-20 | Evet, yüksek priority |
| Adjacent genre (benzer core loop) | 2.8-4% | +%25-35 | Evet, test et |
| Category leader (farklı mekanik) | 1.5-2.5% | +%50+ | Hayır, waste riski |

## Brand Defense: Kendi Adınızı Korumak Neden Ayrı Kampanya

Brand exact kampanyası — kendi oyununuzun adı, studio adınız — funnel'ın en alt katmanı ve **en ucuz conversion layer**'ı. Apple Search Ads'te brand keyword CPT (Cost Per Tap) genelde $0.10-0.30 aralığında, oysa broad match $1.5-3 seviyesinde. Ancak çoğu studio "zaten bizi arayan kullanıcı organik indiriyor" düşüncesiyle brand kampanyasını atlar — bu %12-18 arası install loss demek.

Neden? Çünkü brand search yapan kullanıcıya **rakipler de bid veriyor**. Siz "Puzzle Master" oyununun sahibisiniz, ama rakip "Match Kingdom" oyunu sizin brand keyword'ünüze $2 bid veriyor. Apple'ın auction algoritması relevance + bid combination ile kazananı seçiyor — siz bid vermiyorsanız bazen rakip üstte çıkıyor. Brand defense kampanyası bu hijack'i engellemek için var.

Brand kampanyasında TTR %18-35 arasında — çok yüksek, çünkü intent kesin. Bu katmanda yapmamız gereken: **exact match only**, bid $0.5-1 aralığında (rakipleri outbid etmek için yeterli), ve CPP creative'i "yeni sezon" veya "güncelleme" mesajlı olmalı — zaten oyunu bilen kullanıcıya fresh reason vermek gerekiyor.

### Brand Kampanyası Bid Stratejisi

```python
if competitor_bid_on_brand:
    brand_bid = competitor_avg_bid * 1.3  # Rakibi geç
else:
    brand_bid = 0.3  # Minimal bid, organik + paid blend
```

Brand kampanyasında **Search Match kapalı** olmalı — algoritma bazen brand benzer terimleri alakasız keyword'lere genişletiyor, bu budget leak yaratıyor.

## Funnel Arası Bütçe Akışı: Waterfall Mimarisi

Üç katmanı izole bütçelerle yönetmek yerine **waterfall budget allocation** kurmak, ROAS'ı %25-40 artırıyor. Mantık: her katman performans eşiğini aştığında overflow bütçe bir üst katmana çıkıyor — böylece discovery investment ile conversion efficiency dengede tutuluyor.

Waterfall kuralları:
1. **Brand exact her zaman fully funded** — bu katman ROI pozitifse bütçe limiti yok
2. **Competitor exact → brand'e feed** — competitor kampanyada LTV/CPI > 1.2 olursa, overflow bütçe brand'e değil yeni competitor keyword testine gitmeli
3. **Broad match → budget cap 15%** — total ASA budget'ın %15'inden fazlası broad'a gitmemeli, yoksa funnel top-heavy kalır

Apple Search Ads API ile bunu otomatize etmek mümkün (2026'da Campaign Management API v5.0 budget adjustment endpoint'i var):

```json
{
  "campaignId": 123456,
  "budgetAdjustment": {
    "type": "waterfall",
    "source": "competitor_exact",
    "condition": "LTV_CPI > 1.5",
    "action": "reallocate_to_brand",
    "amount": "overflow"
  }
}
```

Bu endpoint'i BigQuery + Airflow ile daily çalıştırıp bütçe akışını otomatikleştirmek Roibase'in [App Store Optimization](https://www.roibase.com.tr/tr/aso) çalışmalarında standart — manuel adjustment 3 günde bir yapıldığında reaksiyon geç kalıyor, opportunity loss %8-12 seviyesinde.

## Negative Keyword Stratejisi: Funnel Katmanları Arası Sızıntı

Broad, competitor, brand kampanyalarını ayrı koşturduğunuzda **keyword overlap** riski var — aynı search term üç kampanyada da tetikleniyor, kendi kendinize bid competition yaratıyorsunuz. Apple'ın auction'ı aynı advertiser'ın birden fazla kampanyasını göstermez, ama bid waste yapar: yüksek bid kazanır, diğerleri impression alamaz ama budget reserve eder.

Çözüm: **cross-campaign negative sync**. Şöyle:
- Brand exact'e eklenen her keyword → competitor exact'e negative exact
- Competitor exact'e eklenen keyword → broad match'e negative phrase
- Broad match'ten convert olan keyword → 14 gün sonra competitor veya brand'e taşınıyor, broad'dan negative ekleniyor

Bu senkronizasyon manuel yapılamaz (2000+ keyword'lü account'ta haftada 40 saat emek). Python script veya ASA automation tool ile saatlik sync şart:

```python
# Pseudo-code
brand_kws = get_keywords(campaign_type="brand_exact")
comp_kws = get_keywords(campaign_type="competitor_exact")

for kw in brand_kws:
    add_negative(campaign="competitor_exact", keyword=kw, match="exact")

for kw in comp_kws:
    add_negative(campaign="broad_match", keyword=kw, match="phrase")
```

Negative sync yapılmazsa average CPI %18-25 şişiyor — waste değil, inefficiency. Aynı kullanıcıya üç farklı kampanyadan ulaşma çabasının maliyeti.

## Funnel Mimarisinin Attribution Tuzağı

Apple Search Ads'in attribution window 30 gün — kullanıcı search ad'e tap atıp 30 gün içinde indirirse kampanyaya atfediliyor. Ama **multi-touch gerçeği**: kullanıcı broad match'te oyunu gördü, indirmedi, 5 gün sonra brand exact'te aradı, indirdi — attribution brand'e gitti, broad'ın katkısı görünmez. Bu durum broad budget'ı cut etme eğilimi yaratıyor, discovery fonksiyonu öldürüyor.

Çözüm: **assisted conversion modeling**. Apple Search Ads API'den impression + tap verisi çekilip BigQuery'de multi-touch attribution modeli kurulmalı. Markov chain veya Shapley value yaklaşımıyla her kampanyaya katkı payı verilebilir. Örnek bulgu: broad match kampanyası son 30 günde 120 direct install verdi ama 840 assisted conversion'a katkı verdi — gerçek değeri 7x.

```sql
-- BigQuery multi-touch örneği
WITH touch_chain AS (
  SELECT user_id, campaign_type, timestamp,
    LEAD(campaign_type) OVER (PARTITION BY user_id ORDER BY timestamp) as next_touch
  FROM asa_events
)
SELECT campaign_type, COUNT(*) as assisted_conversions
FROM touch_chain
WHERE next_touch = 'brand_exact'
GROUP BY campaign_type;
```

Bu sorgu broad ve competitor kampanyalarının brand install'lara kaç kez yardımcı olduğunu gösteriyor — bu data olmadan broad "expensive, inefficient" görünür, kesilir, funnel çöker.

## Kampanya Mimarisini Canlı Tutmak

Apple Search Ads funnel mimarisi statik değil — her hafta yeni keyword discovery, her ay competitive landscape shift, her çeyrek genre trend değişimi var. Funnel'ı canlı tutmak için **3 haftalık review cycle** şart:

1. **Week 1-2:** Broad match Search Match report'u → yeni keyword cluster discovery
2. **Week 3:** Keyword performance data → competitor exact'e migration candidate seçimi
3. **Week 4:** Brand keyword hijack kontrolü → rakip bid activity monitoring

Apple Search Ads Console'daki manuel report yeterli değil — API ile daily pull + Looker Studio dashboard gerekiyor. Roibase'in mobile game client'larında bu dashboard şu metrikleri real-time gösteriyor: funnel stage TTR, cross-campaign keyword overlap %, assisted conversion rate, LTV/CPI by layer.

Funnel mimarisini bu disiplinle koşturduğunuzda Apple Search Ads single biggest UA channel'ınız olabiliyor — CPI kontrolde, LTV visible, scale predictable. Discovery, competitor, brand — her katman diğerine sinyal ve bütçe besliyor, tek kampanya izolasyonu yerine ekosistem kuruyorsunuz. 2026'da iOS privacy tightening devam ettikçe bu mimari luxury değil necessity — Apple'ın kendi platformunda, kendi attribution'ıyla, kendi auction'ında oynamak IDFA sonrası en stabil growth kanalı.