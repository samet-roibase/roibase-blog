---
title: "GEO: Markanı ChatGPT'nin Cevabına Yerleştirmek"
description: "Generative AI overviews ve LLM citation'larında görünürlük için içerik mimarisi, veri yapılandırma ve ölçüm stratejileri."
publishedAt: 2026-05-06
modifiedAt: 2026-05-06
category: ai
i18nKey: ai-001-2026-05
tags: [geo, llm-citation, ai-overviews, structured-data, brand-visibility]
readingTime: 8
author: Roibase
---

Google Search'te bir soru sorduğunuzda AI overview görünüyor. ChatGPT'ye bir şey sorduğunuzda cevap sonunda kaynak listesi çıkıyor. Perplexity bir sorguya cevap verirken inline citation koyuyor. 2026'da kullanıcıların %40'ı web'e ulaşmadan cevabını LLM arayüzünden alıyor. Bu kaynaklar arasında olmak yeni görünürlük savaşının cephesi. SEO, sayfanızı index'e sokmak için optimize ederdi. GEO, markanızı LLM'in cevabına sokmak için optimize ediyor.

## GEO nedir, SEO'dan farkı ne

Generative Engine Optimization (GEO), içeriğinizi yapay zekâ modellerinin özetleme, citation, retrieval süreçlerinde öncelikli kaynak haline getirmek için yapılan mühendislik çalışmasıdır. SEO'da hedef Google'ın SERP'inde rank almaktı. GEO'da hedef ChatGPT, Perplexity, Claude, Gemini gibi LLM arayüzlerinin ürettiği cevaba kaynak olarak dahil olmaktır.

Fark şurada: SEO'da kullanıcı linki tıklar, sayfanızı ziyaret eder, içeriği okur. GEO'da kullanıcı cevabı LLM arayüzünde alır, kaynak listesini zar zor kontrol eder. Conversion path farklı. Eğer kullanıcı LLM'e "en iyi CRM araçları" diye sorduğunda cevap içinde markanız geçmiyorsa, o sorgu için görünmezsiniz. Attribution doğrudan değil, marka farkındalığı ve trust signal üzerinden çalışır.

GEO'nun metriği trafik değil, mention rate'tir. Kaç sorguya cevap verilirken markanız anıldı? Hangi bağlamda anıldı — pozitif, nötr, negatif? Citation'ın position'ı kaç? Bu verileri çekmek için LLM API loglama, synthetic query testleri, prompt-based citation tracking gerekiyor. Roibase'in [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) pratiği bu katmanda çalışıyor — içerik mimarisi, veri yapılandırma, ölçüm infrastrüktürü.

## İçerik mimarisini retrieval için tasarla

LLM'ler citation kaynağı seçerken iki mekanizma kullanır: web retrieval (Bing API, Google indexi gibi) ve knowledge base (eğitim datasına veya RAG pipeline'ına dahil kaynaklar). Web retrieval tarafında snippet'inizin LLM'e gönderilen context window'a girmesi lazım. Bu snippet ilk 2048 token içinde, net, yapısal, autoritatif olmalı.

İçeriğinizi şöyle tasarlayın: Her H2 başlık altında "core claim + supporting data + source reference" yapısı. Örnek: "Server-side tagging, client-side cookie'lere göre %35 daha güvenilir conversion attribution sağlar (Google Marketing Platform 2025 case study)." Bu cümle tek başına çekildiğinde LLM'in citation verebileceği minimum bilgi birimidir. Generic paragraflar ("Pazarlama dünyası değişiyor…") retrieval'da kaybolur.

Structured data önemli. Schema.org markup'ı LLM retrieval katmanında ayrıcalık yaratmıyor (henüz), ama Google'ın web index'inden çekilen snippet'lerde semantic parsing'i kolaylaştırıyor. `Article`, `FAQPage`, `HowTo` schema'ları kullanın. Eğer yazınız teknik tutorial ise `step` property'leri doldurun — LLM bunları numaralı liste olarak çekip cevabına koyabilir.

Tablo ve listeler kritik. LLM'ler yapısal veriyi düz metinden daha iyi parse eder. Eğer "CRM araçları karşılaştırması" yazısı yapıyorsanız, paragraf yerine markdown tablo kullanın: özellik, fiyat, use case sütunları. ChatGPT bu tabloyu retrieval edip kendi tablosuna çevirebilir, altında kaynak olarak sizi gösterir.

## Kaynak otoritesini first-party veriyle kur

LLM'ler citation yaparken kaynak güvenilirliğine bakar. Bu eski domain authority değil, yeni "first-party signal authority"dir. Eğer yazınızda kendi datasınızı (A/B test sonuçları, customer cohort analizi, attribution model karşılaştırması) paylaşıyorsanız, LLM sizi birincil kaynak olarak işaretler. Üçüncü parti rapor özetleyen yazılar secondary kaynak kalır.

First-party veri yayınlarken anonim, aggregated formatta verin. "Roibase'in 12 Shopify müşterisinde ortalama ROAS %240" gibi. Sayı somut, kaynak belirli, verification mümkün. LLM bu tür claim'leri "verifiable fact" olarak parse eder. Generic "müşterilerimiz başarılı" cümlesi retrieval'da yok sayılır.

Bu yaklaşım [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) çalışmasının bir uzantısı. Conversion tracking datasını internal BI'da tutmak yetmez, bir kısmını public insight olarak yayınlamak gerekiyor. Tabii ki raw data değil — insight katmanı. "X segmentinde Y kanalı Z kadar daha iyi perform etti" türü aggregate claim'ler.

Kaynak linklerini açık verin. Eğer bir istatistik kullandıysanız, parantez içinde kaynak: "(Gartner 2025 Marketing Tech Survey, sayfa 12)". LLM bu referansı kendi citation chain'ine ekleyebilir. Eğer siz zaten başka kaynaklara düzgün atıf yapıyorsanız, LLM sizin yazınızı "well-sourced" olarak değerlendirir, citation priority artar.

## Synthetic query testing ile citation rate'i ölç

GEO metriklerini manuel kontrol edemezsiniz. ChatGPT'ye 100 sorgu atıp kaçında markanız geçiyor diye bakamaz. Automation gerekir. Synthetic query pipeline kurun: hedef keyword listesi → LLM API'ye sorgu gönder → response'u parse et → citation var mı kontrol et → log. Bu pipeline n8n + Claude API ile 20 dakikada kurulur.

Test sorguları gerçekçi olmalı. "En iyi performance marketing ajansları İstanbul" değil, "server-side GTM kurulumunda hangi veri katmanı yapısı gerekiyor" gibi spesifik, intent-driven sorgular. Kullanıcıların LLM'lere sorduğu gerçek sorular — bunları GSC'den, customer support ticket'larından, sales call transcriptlerinden topla.

Her sorgu için 3 metrik: (1) Mention — markanız geçti mi? (2) Position — citation listesinde kaçıncı? (3) Context — pozitif/nötr/negatif bağlam? Bu metrikleri haftalık track edin. Eğer yeni bir içerik yayınladıysanız, 2 hafta sonra synthetic test setinde o konuyla ilgili sorguları tekrar çalıştırın. Citation rate arttı mı?

Competitive benchmark yapın. Rakiplerinizle aynı sorgu setini test edin. "X konusunda Y markası %40 mention alıyor, biz %15 alıyoruz" görürseniz, onların içerik mimarisini analiz edin. Hangi yapısal farklılık var? Tablo kullanıyor mu, schema markup var mı, first-party data paylaşıyor mu?

## Tradeoff: SEO ile GEO çatışır mı

Kısa cevap: bazen. SEO için keyword density, internal linking, long-form content önemli. GEO için tersine brevity, structured snippets, citation-friendly formatting önemli. Uzun paragraflar SEO'da daha iyi rank alabilir, ama LLM retrieval'ında kaybolur.

Çözüm: hybrid mimarisi. Ana içerik SEO için optimize, H2 başlıklar altında "GEO snippet" blokları ekle. Bu bloklar 2-3 cümle, core claim + data + source. LLM bunları çeker, Google da genel içerik kalitesinden dolayı rank verir. Aynı sayfada iki optimizasyon katmanı.

Başka bir tradeoff: trafik ile brand mention arasında. GEO başarılıysa kullanıcı cevabı LLM'den alır, sitenize gelmez. Trafik düşer, mention artar. Bu yeni funnel'da kabul edilebilir. Çünkü kullanıcı sizi "güvenilir kaynak" olarak öğreniyor, sonraki satın alma kararında marka recall artar. Attribution indirect, ama var.

Son tradeoff: içerik freshness. LLM'ler web retrieval yaparken yeni içeriği tercih eder (Google'ın QDF algoritması gibi). Ama eğitim datasına dahil olmak için içeriğin 6-12 ay önce yayınlanmış, authority kazanmış olması gerekir. Yani hem fresh hem established olmalısınız — bu paradox döngüsel publish stratejisi gerektirir: her 3 ayda bir core topic'leri güncelleyin, yeni veri ekleyin, publish date bump edin.

## Citation pipeline'ını production'a kurmak

Teoriden pratiğe: Citation tracking pipeline'ının minimal hali şöyle: (1) Keyword listesi (hedef sorular), (2) LLM API integration (ChatGPT, Claude, Perplexity), (3) Response parser (regex veya JSON), (4) Veritabanı (log kaydı), (5) Dashboard (trend görselleştirme).

N8n workflow'u şu node'larla çalışır: Schedule Trigger (haftalık) → Read File (keyword listesi) → Split (her satırı ayrı işle) → HTTP Request (LLM API) → Function (citation var mı parse et) → Postgres Insert (log kaydet) → Aggregate (rapor özeti) → Slack/Email (bildirim). Toplam maliyet: API call başına $0.002, 100 sorgu haftada $0.20.

Citation data yapısı:

```json
{
  "query": "server-side tagging nedir",
  "llm": "chatgpt-4",
  "timestamp": "2026-05-06T10:23:45Z",
  "response_length": 1024,
  "citations": [
    {"source": "roibase.com.tr", "position": 2, "snippet": "..."},
    {"source": "competitor.com", "position": 5, "snippet": "..."}
  ],
  "mention": true,
  "position": 2,
  "context_sentiment": "positive"
}
```

Bu datayı BigQuery'ye akıtın, Looker Studio'da haftalık trend grafikleri çizin: mention rate over time, average position, competitor comparison. Eğer mention rate düşüyorsa içerik refresh lazım, position kötüyse içerik otoritesi düşük — first-party veri ekleyin.

Advanced seviye: farklı LLM'lerin farklı retrieval mekanizmaları var. ChatGPT Bing kullanır, Perplexity kendi index'ini kullanır, Claude bazen eğitim datasına güvenir. Aynı sorguyu 3 LLM'e atın, hangisi sizi daha çok mention ediyor analiz edin. Eğer ChatGPT mention etmiyor ama Perplexity ediyor, o zaman Bing SEO'nuza odaklanın.

---

GEO, SEO'nun yerini almıyor — yanında duruyor. Kullanıcı journey'si artık "Google arama → web sitesi → conversion" değil, "LLM sorgusu → cevap + citation → (belki) web sitesi → conversion". Citation'da olmamak görünmezlik demek. İçerik mimarinizi retrieval için, veri paylaşımınızı authority için, ölçüm pipeline'ınızı iteration için kurun. 2026'da marka görünürlüğü, LLM'lerin hafızasında olmaktan geçiyor.