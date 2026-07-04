---
title: "GEO: Markanı ChatGPT'nin Cevabına Yerleştirmek"
description: "AI overviews ve LLM citation'larında görünürlük kazanmak için içerik mimarisini nasıl kurarsın? Generative Engine Optimization stratejisi."
publishedAt: 2026-07-04
modifiedAt: 2026-07-04
category: ai
i18nKey: ai-001-2026-07
tags: [geo, llm-citation, ai-overviews, content-architecture, generative-search]
readingTime: 8
author: Roibase
---

Google'ın AI Overviews'inde, ChatGPT'nin aramalarında, Perplexity'nin yanıtlarında marka adın çıkmıyorsa, o trafiği rakibin alıyor. 2026'da arama davranışının %43'ü artık bir LLM arayüzünden geçiyor (Gartner). Traditional SEO sıralama odaklıydı — GEO citation odaklı. Sıralama yerine referans, snippet yerine attribution. Bu yazı, marka ismini generative cevaba yerleştiren içerik mimarisinin mühendislik tarafını açıyor.

## Citation Mekanizması Nasıl Çalışır

LLM'ler cevap üretirken retrieval-augmented generation (RAG) kullanır. Kullanıcı sorusu embedding'e dönüşür, vektör benzerliğiyle en yakın dokümanlar bulunur, context window'a enjekte edilir, model bu context'ten cevap sentezler. Citation eklerse, hangi dokümanı kullandığını dipnotta gösterir.

Bu süreçte kazanmak için iki koşul gerekiyor: (1) embedding benzerlik skorunu yükseltmek, (2) context window'a girdiğinde anlamlı bir "authority signal" vermek. İkisi ayrı problem. Birincisi retrieval engineering, ikincisi content engineering.

Retrieval katmanında LLM şu sinyalleri ağırlıklandırır: semantic density (kelime başına bilgi yoğunluğu), freshness (yayın tarihi), domain authority (backlink profili + trust score), structured data markup (schema.org). Sadece keyword stuffing değil — embedding uzayında "semantic proximity" kritik. "E-ticaret dönüşüm optimizasyonu" araması için sayfanda "conversion rate", "checkout flow", "cart abandonment" gibi terimlerin co-occurrence yoğunluğu olmalı.

Context window'a girdikten sonra model "hangi kaynaktan alıntı yapayım" diye karar verirken authoritativeness sinyali arıyor. Bu sinyal nereden gelir? İçeriğin yapısından. Başlıkların net olması, numerical claim'lerde kaynak atfedilmesi, "according to X study" ifadeleri, istatistiksel kesinlik. Claude gibi modeller training sırasında Wikipedia, PubMed, arXiv tarzı citation-heavy korpuslara maruz kalmış — aynı pattern'i kendi içeriğinde gördüklerinde citation yapma olasılığı artıyor.

## İçerik Mimarisinde Citation-Friendly Yapı

Klasik blog yazısı anlatı akışına sahip — giriş, gelişme, kapanış. GEO için bu yapı verimsiz. LLM retrieval'ı "question → direct answer" akışını arar. Bunun için içeriğin atomik bilgi blokları halinde parçalanması gerekiyor.

Örnek senaryo: "Shopify mağazasında sepet terk oranını düşürmek" konusunda içerik. Klasik yapıda şöyle bir akış olur:

- Giriş paragrafı (sepet terk nedir, neden önemlidir)
- Nedenleri anlatan 3 paragraf
- Çözüm önerileri 4 paragraf
- Sonuç

Bu yapıda LLM "what is cart abandonment rate benchmark" sorusuna doğrudan cevap verebilecek bir blok bulamaz. Context window'a giren 4 paragraf içinde benchmark sayısı gömülü durumda.

Citation-friendly yapı:

```markdown
## Sepet Terk Oranı: Sektör Benchmarkları

E-ticaret ortalaması %69.8 (Baymard Institute, 2026 Q2). 
Moda: %68.3, elektronik: %77.2, kozmetik: %63.1.

## Sepet Terk Nedenlerinin Dağılımı

1. Beklenmedik kargo maliyeti — %48
2. Hesap oluşturma zorunluluğu — %24
3. Uzun checkout süreci — %18
...

## Terk Oranını Azaltan Müdahaleler

A/B test verisine göre (n=1,240 Shopify mağazası):
- Exit-intent popup: -12% terk
- Progressive checkout: -8% terk
- One-click upsell: +3.2% AOV ama -2% terk
```

Bu yapıda her H2 bağımsız bir "bilgi atomu". LLM "what reduces cart abandonment" sorusuna context window'dan doğrudan listeyi çekip citation yapabilir. Paragraph flow yerine information density öncelikli.

Structured data markup ayrı katman. Schema.org'da `HowTo`, `FAQPage`, `DefinedTerm` gibi tipler var. Bunları sayfaya enjekte edersen Google'ın Rich Results'ına girersin, ama aynı zamanda LLM retrieval'ında da sinyal oluşturursun. OpenAI'nin web crawler'ı (OAI-SearchBot) structured data okur, embedding sırasında weighted signal olarak kullanır.

Kod bloğu örneği — bir FAQ schema:

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [{
    "@type": "Question",
    "name": "E-ticaret sepet terk oranı nedir?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "2026 sektör ortalaması %69.8. Moda segmentinde %68.3, elektronik %77.2."
    }
  }]
}
```

Bu markup'ı sayfaya eklediğinde, LLM retrieval sırasında question-answer eşleşmesi semantic similarity'yi artırır.

## Authority Signal Engineering

Citation yapılmak için içeriğin "trustworthy" olarak algılanması gerekiyor. LLM'ler training sırasında hangi içeriklerin citation aldığını gördü — Wikipedia'da referans listesi olan maddeler, research paper'larda bibliography bölümü. Aynı pattern'i kendi içeriğinde gördüğünde "bu kaynak citation-worthy" sinyali alır.

Pratik uygulama: her numeric claim'e parantez içinde kaynak ekle. "E-ticaret dönüşüm oranı ortalama %2.86 (Adobe Analytics, Q1 2026)" yerine "ortalama %2.86" dersen, LLM bu sayıyı kullanabilir ama citation yapmaz — çünkü authoritativeness sinyali yok.

İkinci katman: first-party data göstermek. Kendi deneylerinden, A/B test sonuçlarından, customer cohort analizinden bahsedersen, LLM bunu "primary source" olarak değerlendiriyor. "Müşterilerimizin %64'ü ilk 7 günde churn oluyor" cümlesi generic "bazı müşteriler erken churn olur" cümlesinden daha citation-worthy. Sayı + zaman dilimi + metodoloji (cohort analizi gibi) combinasyonu authority sinyali üretiyor.

Üçüncü katman: internal linking architecture. Sayfanda başka bir sayfaya link verdiğinde, LLM o linki "related context" olarak değerlendiriyor. Eğer [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) sayfasına link veriyorsan, LLM bu konuda daha derin bir content cluster'ın olduğunu anlıyor — topical authority sinyali. Orphan page yerine hub-spoke modelinde düşün. Bir "pillar page" (hub), etrafında 5-7 "cluster page" (spoke). LLM retrieval sırasında cluster'dan hub'a link görünce, hub sayfayı da context'e çekebiliyor.

## Citation Tracking ve Optimizasyon Döngüsü

Traditional SEO'da Google Search Console'da impression/click/position izlersin. GEO'da farklı metrik seti: citation count, citation context quality, retrieval frequency. Henüz standart bir dashboard yok — custom tracking gerekiyor.

Citation count nasıl ölçülür? Manuel yöntem: ChatGPT'ye, Perplexity'ye, Claude'a hedef sorguyu sor, dipnot referanslarına bak. Scalable yöntem: API üzerinden sorgu gönder, response'u parse et, citation varsa loglama sistemi. OpenAI API'de `logprobs` parametresi citation token'larını döndürüyor — hangi tokenin hangi source'tan geldiğini görebiliyorsun.

Örnek n8n workflow: her sabah saat 09:00'da hedef keyword listesini (50 sorgu) ChatGPT API'ye gönder, response'u parse et, citation var mı kontrol et, varsa Notion'a veya Airtable'a kaydet. Haftada bir bu veriyi aggregate edip trend analizi yap. Hangi içerikler citation alıyor, hangisi almıyor? Almayan içeriği yukarıdaki structuring prensipleriyle revize et.

Citation context quality metrikleri: citation'ın cevabın hangi kısmında göründüğü. Başlangıç paragrafında mı, yoksa "further reading" bölümünde mi? İlkinde visibility daha yüksek. LLM'nin cevabını JSON olarak parse edersen, citation'ın position index'ini çıkarabilirsin. Hedef: top-3 citation içinde olmak.

Retrieval frequency: belirli bir sorgu için kaç farklı LLM modelinde retrieval'a giriyorsun? ChatGPT'de var, Perplexity'de yok mu? Farklı modeller farklı embedding algoritmaları kullanıyor — ChatGPT OpenAI embeddings, Perplexity hybrid (OpenAI + kendi RAG stack). Hepsinde görünürlük istiyorsan, content'i her iki embedding space'inde de optimize etmen gerekiyor. Bu dual optimization problemi — keyword density + semantic density balansı.

## Karşı Argüman: Attribution Kontrolsüzlüğü

GEO'nun en büyük riski: LLM'nin senin içeriğini kullanıp citation yapmaması. Traditional SEO'da Google seni snippet'te gösterse bile, link veriyor — trafik geliyor. LLM cevabında senin datasını kullanır ama referans etmezse, zero-click outcome. Bu durumda visibility var, traffic yok.

OpenAI ve Google kısmen bu problemi bildiriyor — AI Overviews'te source link gösterme oranı %37 (BrightEdge, 2026 Mart). Yani %63 zero-attribution. Bu oranı artırmanın yolu: watermarking ve structured attribution enforcement. Watermarking: içeriğe "unique identifier" gömmek (örn: her paragrafta marka ismini doğal akışta tekrar etmek). Structured attribution: schema markup'ta `author`, `publisher`, `datePublished` gibi alanları doldurmak — LLM training sırasında bu metadata'yı öğreniyor, citation formatında kullanma olasılığı artıyor.

İkinci tradeoff: freshness vs depth. LLM'ler fresh content'i tercih eder (retrieval sırasında `publishedDate` ağırlıklı). Ama deep analysis zaman alır — 3000 kelimelik içerik çıkarmak 2 hafta sürebilir. Bu süre zarfında rakip 5 tane shallow ama fresh içerik çıkarırsa, retrieval race'i kaybedersin. Çözüm: hybrid model. Core pillar page'leri depth öncelikli yaz (3000+ kelime), cluster page'leri freshness öncelikli (800-1200 kelime, haftada 2-3 yayın). LLM retrieval sırasında cluster page'den girer, citation yaparken pillar'a yönlendirir.

## Şimdi Ne Yapmalı

GEO stratejisi kurmak için önce baseline ölç: mevcut içerik setinde kaç citation alıyorsun? ChatGPT, Perplexity, Google AI Overviews'te marka adın kaç kez çıkıyor? Manuel kontrol yap — 20 hedef sorgu seç, her birini 3 LLM'de test et, citation count tablosu çıkar. Citation yoksa, içerik mimarisini yukarıdaki prensiplere göre revize et. Schema markup ekle, numeric claim'lere kaynak at, atomik bilgi blokları oluştur. 2 hafta sonra aynı sorguları tekrar test et — citation değişimini gözlemle. Bu iteratif döngüyü sürdür. Traditional SEO'nun 3 aylık rank tracking cycle'ı yerine, GEO'da 2 haftalık citation tracking cycle'ı yeterli — çünkü LLM retrieval index'i daha sık güncelleniyor.