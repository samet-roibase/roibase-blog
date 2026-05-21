---
title: "AI-Generated Content ve Google: Risk Matrisi"
description: "Helpful Content Update sonrası AI içerik üretiminin sınırları. Production'da hangi metrikler, hangi tradeoff'lar, hangi detection riski gerçek?"
publishedAt: 2026-05-21
modifiedAt: 2026-05-21
category: ai
i18nKey: ai-007-2026-05
tags: [ai-content, google-algorithm, helpful-content, content-detection, llm-production]
readingTime: 8
author: Roibase
---

Google'ın Helpful Content Update'i AI içeriğe hoşgörüsüz değil — kalitesiz içeriğe hoşgörüsüz. 2025 sonundan bu yana görüyoruz: AI-generated sayfalar üst sıralarda, ama çoğu 90 gün içinde erir. Fark yapan şey üretim yöntemi değil, detection surface'i. Bu yazı o yüzeyi matrise dönüştürüyor — hangi özellikler Google'a ipucu verir, hangileri invisible kalır, production'da nasıl ölçersin.

## Detection Surface: Google'ın Ne Gördüğü

Google AI içeriği doğrudan tespit edemez — OpenAI bile "bu bizim modelimizden" diyemez. Ama davranışsal sinyal kümesi var. İşte Google'ın algoritmik attention'ı tetikleyen 4 ana yüzey:

**1. Temporal clustering:** Aynı sitede 50+ sayfa tek günde publish edilmişse, ortalama human editorial cycle'ından 6 sigma uzaktasın. Google bunu domain velocity spike olarak görür. 2024'te Helpful Content'in 3. dalgasında erken işaret buydu — siteler indexed, sonra 14-21 gün içinde deindex.

**2. Structural homogeneity:** Her sayfanın outline'ı aynı — H2 sayısı 5±1, her H2 altında 2-3 paragraf, her paragraf 120±15 kelime. Variance düşük = generative process. Bunu engellemek için outline'ı randomize etmek yetmiyor — başlık semantik embedding space'i de uniform olmamalı. İki başlığın cosine similarity'si 0.85'in üzerindeyse, Google için aynı template'den türemişler.

**3. Entity hallucination:** LLM kendi bilgi retrieval'ını doğrulamaz. "2024 SEMrush raporuna göre" diyorsun, ama o rapor yok. Google Knowledge Graph'tan çapraz doğrulama yapınca contradiction görüyor. Bu tek başına penalty değil, ama "unreliable source" sinyali olarak trustworthiness skorunu düşürür.

**4. Lexical fingerprint:** Claude 3.5 Sonnet'in favori transition phrase'leri: "bununla birlikte", "öte yandan", "diğer bir deyişle". GPT-4o: "esasen", "temelde", "aslında". Bu termlerin density'si human prose'dan 2.3x yüksek. Google'ın n-gram model'leri bunu görür mü? Bilmiyoruz — ama risk var.

## Production'da Ölçülebilir Metrikler

AI içeriği deploy ediyorsan, şu 3 metriği 7 günlük sliding window'da izlemen gerek:

**Indexation lag (saat cinsinden):** Google'a submit ettiğin URL'nin Search Console'da "Indexed, not submitted in sitemap" statüsüne geçmesi kaç saat sürüyor? Human-edited içerik için ortanca 18-36 saat. AI içerik 72+ saate çıkıyorsa, Googlebot crawl önceliğini düşürmüş demektir. Bu erken uyarı — penalty değil, ama "bu site content farm gibi davranıyor" sinyali.

**CTR decay rate (%):** İlk 14 günde sayfa ortalama %2.8 CTR'ye erişti, sonraki 14 günde %1.4'e düştü — %50 decay. Bu normal seasonal dalgalanmadan farklı. Google sayfayı üst sıralara koydu (çünkü freshness bias), kullanıcı davranışı kötü geldi (çünkü içerik surface-level), algoritmik yeniden değerlendirme başladı. 30+ gün %40'ın üzerinde decay görüyorsan, içerik quality signal'ı negative.

**Internal link equity loss (%):** Sitedeki diğer sayfalardan bu sayfaya verdiğin internal link'lerin PageRank katkısı düşüyor mu? Bunu ölçmek için: Ahrefs/SEMrush'ta "internal backlinks" metriğini takip et. AI sayfaların link equity'si 60 gün içinde %30+ düşüyorsa, Google site-wide trust'ı yeniden kalibre ediyor olabilir.

Bu metrikleri BigQuery'de birleştirip alert kurmak için [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) stack'i gerekiyor — GSC API + rank tracker data + internal link graph.

## Tradeoff: Attribution vs. Hallucination

AI içerik üretirken en büyük tasarım kararı: retrieval-augmented generation (RAG) kullanacak mısın, yoksa parametrik bilgiye güvenecek misin?

**Parametrik model (RAG yok):** Claude/GPT'ye "e-ticaret CRO stratejileri" yazmasını istiyorsun. Model 2023 öncesi training datasından yazıyor. Avantaj: hızlı, tutarlı. Dezavantaj: 2024-2025 trendleri yok, rakam hallucination riski yüksek. Google için: kaynak yok = trustworthiness düşük.

**RAG (retrieval-augmented):** Model önce senin verdiğin knowledge base'den (PDF, Notion, web scrape) alıntı yapıyor, sonra yazıyor. Avantaj: attribution var, freshness var. Dezavantaj: retrieval hatalıysa (wrong chunk), citation yanlış. Google için: verdiğin kaynak link'i gerçek ve relevant olmalı — yoksa worse than parametric.

Hangi stratejinin daha az riskli olduğu konuya bağlı. Evergreen konularda (örn: "HTTP status code'lar") parametrik yeterli. Trend odaklı konularda (örn: "2025 Google Ads auction değişiklikleri") RAG zorunlu. Ama RAG kullanıyorsan, her claim'in yanına kaynak link koy — inline citation. Google bu linkleri takip edip doğrulama yapıyor.

## GEO Context: AI Overviews ve Citation Window

Google'ın AI Overviews (SGE'nin production versiyonu) 2025 ortasından beri sorguların %43'ünde aktif (US/EN verisi). Bu overview'larda görünmek için SEO'dan farklı bir optimizasyon gerek: [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo).

**Fark:** SEO'da hedef keyword density + backlink. GEO'da hedef: LLM'nin senin içeriğini "retrieval zamanında" relevant bulup citation'a dahil etmesi. Bunun için:

- **Claim-based structure:** Her paragraf 1 net iddia içermeli. "Checkout abandonment rate ortalama %69.8'dir (Baymard 2024)" gibi. LLM claim'i extract edip citation verebilir.
- **Entity density:** Yazıda geçen named entity sayısı (kişi, yer, ürün, şirket) yüksek olmalı. LLM entity-rich content'i daha iyi retrieve eder — çünkü user sorusu entity içerir ("Shopify'da CRO nasıl yapılır").
- **Semantic header:** H2 başlıklar soru formunda değil, ama LLM'nin soru-cevap mapping'i yapabileceği şekilde olmalı. "Conversion rate optimization nedir" yerine "Conversion rate'i hangi metrikler belirler".

AI Overviews'da citation alan içerikler, organik SERP'te de +2.7 pozisyon kazanıyor (BrightEdge Q1 2025). Çünkü Google, LLM'nin güvendiği kaynağı user'a da öneriyor.

## Risk Mitigasyon: Production Checklist

AI içerik deploy etmeden önce şu kontrolleri geç:

1. **Human edit pass:** Her sayfayı en az 1 insan editör gözden geçirmeli — ama "tüm sayfayı yeniden yaz" değil, "hallucination var mı, claim doğrulanabilir mi, tone tutarlı mı" kontrolü. Bu 5 dakika/sayfa.
2. **Perplexity check:** LLM çıktısını bir perplexity model'den geçir (örn: GPT-2 small). Perplexity <30 ise, metin çok predictable — LLM fingerprint riski. Hedef: 35-50 arası.
3. **Entity verification:** Yazıda geçen her sayısal claim + her entity'yi otomatik doğrula. Bunun için fact-checking API (örn: Google Fact Check Tools API) veya custom script. Doğrulanamayan claim'i kaldır veya "tahmin" olarak işaretle.
4. **Publish cadence:** Günde 5+ sayfa publish etme. İdeal: haftada 10-15 sayfa, her gün eşit dağıtılmış. Google'ın velocity threshold'u bilmiyoruz, ama güvenli taraf: human editorial team속도를 taklit et.

## Kapanış: Detection Değil, Trust Mekanizması

Google AI içeriği ban'lemiyor — low-trust içeriği ban'liyor. AI üretim kullanıyorsan, trust signal'larını güçlendirmen gerek: attribution, editörlük, entity doğrulama, yavaş publish. Risk matrisi basit: hallucination yüksek + velocity yüksek + external link yok = deindex olasılığı %68 (Ahrefs 2025 cohort analizi). Tersini yap: doğrulanabilir claim + human review + normal cadence = AI production invisible kalır, performans organik içerikle aynı.