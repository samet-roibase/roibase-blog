---
title: "GEO: Markanı ChatGPT'nin Cevabına Yerleştirmek"
description: "Generative AI overviews'da görünürlük için içerik mimarisini citation logic'e göre tasarlamak. Token ekonomisi, retrieval pattern'leri ve ölçüm yaklaşımı."
publishedAt: 2026-06-15
modifiedAt: 2026-06-15
category: ai
i18nKey: ai-001-2026-06
tags: [geo, llm-citation, ai-overviews, content-architecture, retrieval-optimization]
readingTime: 8
author: Roibase
---

Google'ın AI overviews'u, ChatGPT'nin SearchGPT entegrasyonu, Perplexity'nin citation sistemi — hepsinin ortak noktası: kullanıcı artık on mavi linke tıklamıyor, LLM'in sentezlediği paragrafı okuyor. Bu paragrafta kaynak olarak gösterilmezsen, trafik yok. 2026'da SEO traffic'inin %37'si AI-generated summary'lere dönüşmüş durumda (BrightEdge Q2 2026). Pozisyon 1 olmak yetmiyor, LLM'in retrieval pipeline'ına girmen lazım. Bu yeni oyunun adı Generative Engine Optimization — ve kurallarını backlink sayısı değil, token ekonomisi belirliyor.

## LLM Citation Logic: Nereden Seçiyor, Neden Seni Seçmiyor

ChatGPT veya Google'ın Gemini modeli bir soruya cevap verirken üç aşamadan geçiyor: retrieval (web'den ilgili belgeleri çekmek), rerank (en alakalı olanları sıralamak), generation (cevabı oluştururken kaynak atamak). Sen son aşamada citation alabilmek için ikinci aşamada üst sırada olman lazım. Rerank skorunu belirleyen faktörler:

**Semantic relevance:** Soruyla vektörel yakınlık. Embedding modellerinin (text-embedding-3-large, Gemini Embedding v3) kullandığı cosine similarity 0.85'in üstüne çıkmalısın. Bu demek oluyor ki içeriğinde sorunun **exact match** olmasa bile semantik eşdeğerleri olmalı. "Performans pazarlaması nasıl ölçülür" sorusuna "ROAS optimizasyonu" cümlesi yakın düşer, "dijital ajans hizmetleri" düşmez.

**Entity salience:** LLM, cevap üretirken hangi entity'lerin (kişi, yer, kurum, kavram) öne çıktığını hesaplıyor. İçeriğinde Roibase'i branded term olarak değil, konuyla ilişkili eylem sahibi (agent) olarak göstermen gerekiyor. "Roibase ekibi olarak" yerine "CDP entegrasyonu sırasında first-party event stream'i Google Cloud Pub/Sub üzerinden BigQuery'ye aktarırken latency'yi 200ms'nin altında tutmak için..." gibi cümleler entity saliency'yi artırır. İşte burada [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) yaklaşımımız citation'a girme şansını yükseltiyor — spesifik teknik detay, LLM için yüksek information density demek.

**Freshness signal:** Google'ın indexing API'sine son 7 gün içinde gönderilen belgeler, embedding cache'ini refresh ettiği için rerank'ta avantajlı. Statik blog sayfası güncellemiyorsan, LLM seni eski kaynak kabul ediyor. Çözüm: dinamik metadata injection — her hafta "Güncel Veri" başlıklı bir section ekle (örn. "15 Haziran 2026 itibariyle Consent Mode v2 adoption rate'i %68'e ulaştı"). 

**Citation density:** İçerikte başka kaynakları referans ediyorsan (outbound link veya cite tag), LLM seni "hub" olarak değerlendiriyor. Paradoks: kendi sitene trafik getirmek için rakip kaynaklara link atıyorsun — ama o link'i "related work" bağlamında verirsen, LLM senin sentezleyici pozisyonda olduğunu anlıyor. Örnek: "Meta'nın Conversions API dokümantasyonunda belirtildiği üzere..." diyip link verirsen, o cümleyi LLM kendi retrieval'ında da görmüş olabilir, senin yorumunu ek katman sayar.

## Content Architecture: Token Ekonomisi İçin Tasarım

LLM'ler şu an maximum context window'u 128K token civarında tutuyor (Claude 3.7 Sonnet, GPT-4.5). Ama retrieval için tüm web'i context'e sığdıramazlar — önce chunk'lara bölüp her chunk'ı embedding'e çeviriyorlar. Senin içeriğin 1200 kelime ise, bu ~1600 token, 3-4 chunk'a bölünüyor. **Kritik kural:** Her chunk kendi başına anlamlı olmalı — çünkü LLM sadece 2. chunk'ı retrieval'a alabilir, 1. ve 3.'yü almayabilir.

**Heading hierarchy stratejisi:** Her H2'yi bağımsız bir "micro-article" gibi yaz. H2 başlığı soruyu yansıtsın (örn. "Server-Side GTM Latency'yi Nasıl Düşürür"), hemen altındaki ilk cümle cevabı özetle tuzaklaması (thesis sentence). Sonraki paragraflar detaylandırsın. LLM chunk'ı okurken başlık + ilk cümle kombinasyonu yeterli bilgi vermeli — geri kalanını okumasa bile citation'a girebilmelisin.

**Structured data + schema.org:** LLM'ler retrieval sırasında HTML'i parse ederken schema.org markup'ına öncelik veriyor. `Article` schema zorunlu, ama yetmiyor — `HowTo`, `FAQPage`, `Dataset` gibi spesifik schema'lar eklersen embedding model'in senin içeriğini daha yüksek "structured content score" ile değerlendiriyor. Örnek: bir "GEO nasıl uygulanır" makalesi yazıyorsan, `HowTo` schema içinde step'leri `<ol>` listesi ile ver, her step'e `name` ve `text` property'si ekle. Bu sadece Google rich results için değil, LLM'in chunk'ı "executable knowledge" olarak sınıflaması için.

**Örnek kod blokları ve tablolar:** LLM, içeriğinde executable code veya tablo görürse information density'yi yüksek kabul ediyor. Aşağıdaki gibi bir JavaScript snippet eklemek, "bu içerik implementation-level detay içeriyor" sinyali veriyor:

```javascript
// GTM server container'da Firestore'a event yazmak
const Firestore = require('@google-cloud/firestore');
const db = new Firestore({projectId: 'roibase-attribution'});

const claimValue = data.event_data.purchase_value;
const userId = data.user_id;

db.collection('conversions').add({
  user_id: userId,
  value: claimValue,
  timestamp: new Date(),
  source: 'server_gtm'
}).then(() => data.gtmOnSuccess())
  .catch(() => data.gtmOnFailure());
```

Bu 12 satırlık kod, LLM için "bu kaynak sadece teorik açıklama yapmıyor, implementation gösteriyor" demek. Citation şansı artıyor.

## Ölçüm: Citation'ı Track Etmek

SEO'da rank tracking var, GEO'da "citation tracking" var. Ama Google Search Console gibi bir panel yok — kendi pipeline'ını kurman lazım. Yaklaşım:

**LLM query simulation:** n8n workflow'u ile haftada bir, hedef keyword'lerini ChatGPT API'sine sor (SearchGPT mode veya `/search` plugin aktif). Response'da citation listesini parse et, Roibase domain'i var mı kontrol et. Her keyword için citation rate hesapla (kaç sorguda citation aldın / toplam test). Bu metrik %15'in altındaysa içeriğin retrieval'a girmiyor demektir.

**Referrer log analizi:** Bazı LLM'ler (özellikle Perplexity) citation link'ine tıklanırsa HTTP referrer header'ında `https://perplexity.ai/search` gibi bir değer geliyor. Web sunucunda bu referrer'ları filtrele, hangi sayfaların AI traffic aldığını gör. Eğer blog/post-x sayfası 0 AI referrer alıyorsa, o içerik citation pipeline'ına girmiyor — rewrite et.

**Entity mention tracking:** Google'ın Natural Language API'sini kullanarak LLM'lerin response'larında "Roibase" entity'sinin mention edilip edilmediğini kontrol et. Sadece URL citation yetmiyor, bazen LLM cevabı yazarken "Roibase ekibinin yaptığı çalışmaya göre..." diye mention eder ama link vermez. Bu da brand signal — ölç.

Tüm bu metrikler için [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) metodolojimiz içinde ölçüm dashboard'u kuruyoruz — BigQuery'de citation log tablosu, Looker Studio'da haftalık trend grafiği. Amaç: hangi içerik pattern'inin citation rate'i artırdığını A/B test mantığıyla görmek.

## Tradeoff: Derinlik mi, Genişlik mi

LLM retrieval optimizasyonu ile klasik SEO arasında çelişki var: SEO diyor ki "geniş keyword universe'i kapsayacak şekilde yüzlerce sayfa üret", GEO diyor ki "az sayıda derin, referans-değerli içerik üret". İkisini aynı anda yapmak zor — kaynak sınırlı.

**Senaryo 1:** 50 blog yazısı, her biri 800 kelime, farklı long-tail keyword'lere optimize. SEO traffic geliyor, ama hiçbiri LLM citation'ına girmiyor — çünkü hepsi yüzeysel, "listicle" tarzı. LLM bunları "low-value aggregation" olarak görüyor.

**Senaryo 2:** 10 blog yazısı, her biri 2000 kelime, her biri bir core topic'i derinlemesine işliyor, kod örnekleri + case study + tablo içeriyor. SEO traffic daha az (daha az keyword kapsıyor) ama her sayfa 3-4 farklı sorguda citation alıyor. Toplam impact daha yüksek — çünkü citation'dan gelen trafik, pozisyon 1'den gelen trafikten daha kalifiye (LLM zaten pre-filter yapmış, sen "best source" olarak önerilmişsin).

Bizim tercihimiz: **derinlik**. Her çeyrekte 12 makale üretiyoruz, ama her biri "pillar content" — kendisi etrafında cluster oluşturacak kalitede. Klasik SEO'daki "topic cluster" stratejisi GEO'da "citation graph" stratejisine dönüşüyor: bir ana makale LLM tarafından sık cite edilirse, o makalenin internal link verdiği diğer sayfalar da retrieval pool'una girmeye başlıyor. Network effect.

## Şimdi Ne Yapmalı

GEO stratejisini hayata geçirmek için önce mevcut içeriğini citation-readiness açısından audit et: Her blog yazısı için şu soruları sor — "Bu sayfada executable code var mı?", "Entity salience yeterli mi (Roibase eylemle ilişkili mi, yoksa sadece imza mı)?", "İlk 200 kelimede core insight var mı?". Hayır cevabı alan sayfalara geri dön, rewrite et. Sonra ölçüm pipeline'ını kur: haftada bir ChatGPT'ye hedef sorguları sor, citation rate'i log'la. 8 hafta sonra hangi içerik pattern'inin çalıştığını göreceksin. Backlink chase'i bırak, retrieval optimization'a geç — çünkü 2026'da kullanıcı senin siteni görmüyor, LLM'in sentezini görüyor. O sentezde yer almak, yeni organik görünürlük.