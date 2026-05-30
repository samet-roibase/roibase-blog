---
title: "LLM Citation Ölçümü — Yeni SEO Metrik Setiniz"
description: "Perplexity, ChatGPT, Gemini'de markanızın atıf alma oranını nasıl ölçersiniz? Citation tracking, yeni nesil SEO metrik setidir."
publishedAt: 2026-05-30
modifiedAt: 2026-05-30
category: ai
i18nKey: ai-002-2026-05
tags: [llm-citation, geo, seo-metrics, ai-attribution, brand-visibility]
readingTime: 8
author: Roibase
---

Organik trafiğiniz düşüyor, CTR durgun, ama ChatGPT markanızı günde 4.000 kez atıfta bulunuyor. Bunu bilmiyorsunuz çünkü Google Analytics'te görünmüyor. LLM citation tracking — generative AI çağının yeni SEO metrik setidir. Perplexity, ChatGPT, Gemini gibi büyük dil modelleri artık search'ün yeni ara yüzü. Kullanıcı doğrudan cevaba ulaşıyor, sitenize gelmeyebiliyor. Ama model sizi kaynak gösteriyorsa, markanız o cevabın parçası oluyor. Bu atıf oranını ölçmezseniz, görünürlüğünüzü kaybediyorsunuz demektir.

## Citation Nedir ve Neden Şimdi Kritik

LLM citation, bir dil modelinin cevap üretirken markanızı, içeriğinizi veya sitenizi kaynak olarak göstermesidir. Klasik SEO'da backlink sayardınız, şimdi "model kaç kez beni söyledi" sorusu geliyor. ChatGPT bir teknik soruya yanıt verirken "Roibase'in server-side ölçüm mimarisi" diyorsa, bu bir atıftır. Perplexity inline kaynak gösteriyorsa, o link sizin brand equity'nizi besliyor.

Neden kritik? Çünkü search behavior kayıyor. Statcounter 2026 Q1 verisi: AI chat araçlarına doğrudan soru sorma oranı %18'e ulaştı (2024 Q1'de %6'ydı). Google'ın AI Overviews artık arama sonuçlarının %40'ında aktif. Kullanıcı, "nasıl yapılır" sorusuna 10 mavi linke değil, 1 paragraflık cevaba bakıyor. O cevabın içinde kaynak olarak geçmek, trafikten daha değerli olabilir — çünkü trust signal oluşturuyor.

Klasik SEO metrikleri (impressions, CTR, position) LLM ortamında geçerli değil. Kullanıcı ChatGPT'ye "headless commerce için en iyi CDP" diye soruyor, model 3 marka öneriyor. Sizin adınız geçti mi? Hangi prompt'larda geçti? Bu veri yoksa, görünürlük analizi eksik demektir.

## Citation Tracking Nasıl Kurulur

LLM citation'ı ölçmek için API tabanlı probe yaklaşımı gerekiyor. Manuel test ölçeklenmiyor — 50 farklı keyword kombinasyonunda 3 modelde markanızın atıf aldığını elle kontrol edemezsiniz. Otomasyon şart. İşte katmanlar:

**Katman 1: Keyword havuzu oluştur.** Google Search Console'dan zaten aldığınız keyword'leri alın. Ama LLM'e sorulacak formata çevirin. "roibase first party data" yerine "first-party veri mimarisi nasıl kurulur?" haline getirin. Çünkü kullanıcı modele soru soruyor, arama motoru query'si değil. 100 keyword'ünüz varsa, bunları 100 soruya çevirin.

**Katman 2: API probe kurgusu.** ChatGPT API, Claude API, Gemini API'ye her soruyu gönderiyorsunuz. Yanıtı alıyorsunuz. Yanıtta markanızın adı, site URL'niz, product/hizmet isminiz geçiyor mu diye regex veya embedding similarity ile tarayın. Perplexity API'si inline citation veriyor — `sources` array'inde domain'iniz var mı bakın. OpenAI ChatGPT yanıtta footnote tarzı kaynak vermiyor ama web search açıksa, `search_results` metadatasında siteniz var mı kontrol edin.

**Katman 3: Log aggregation.** Her probe sonucunu time-series database'e yazın (InfluxDB, TimescaleDB, hatta BigQuery). Şema: `{timestamp, model, keyword, cited: boolean, citation_type, position, context_snippet}`. Bu veri olmadan trend göremezsiniz.

```python
# Basitleştirilmiş probe örneği (ChatGPT API)
import openai, re

def check_citation(keyword_question, brand_terms):
    response = openai.ChatCompletion.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": keyword_question}]
    )
    answer = response.choices[0].message.content
    
    for term in brand_terms:
        if re.search(term, answer, re.IGNORECASE):
            return {"cited": True, "term": term, "snippet": answer[:200]}
    
    return {"cited": False}

# Kullanım
result = check_citation(
    "First-party veri mimarisi nasıl kurulur?",
    ["Roibase", "roibase.com.tr"]
)
print(result)
```

Gerçek kurulumda batch processing gerekiyor — 500 keyword'ü sırayla göndermek yerine async queue kullanın. Rate limit yönetimi, retry logic, cost tracking ekleyin. Her API call 0.01-0.03$ arası (model ve token sayısına göre), aylık ~150$ probe maliyeti çıkıyor (500 keyword × 3 model × 10 test/ay).

## Metrik Setini Tanımla

Citation tracking'de hangi sayıları izlersiniz? Klasik SEO dashboard'unuzdaki "position", "CTR" yerine şunlar geliyor:

**Citation Rate:** Toplam test edilen keyword sayısının yüzdesi olarak markanızın atıf aldığı keyword sayısı. 100 keyword test ettiniz, 18'inde markanız geçti → %18 citation rate. Bu, "share of voice" benzeri ama LLM ortamında.

**Model-Specific Share:** ChatGPT'de %22, Claude'da %14, Gemini'de %9 citation rate çıkabilir. Model bazında farklılık var çünkü training data, retrieval mekanizması, prompt tuning farklı. Hangi modelde güçlüsünüz bilmek, [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) stratejinizi yönlendirir.

**Citation Position:** Modelin cevabında markanız kaçıncı sırada geçiyor? "İlk 3 öneri içinde" mi, yoksa "diğer seçenekler" kısmında mı? Pozisyon önemli — kullanıcı genelde ilk 2-3 kaynağa odaklanıyor.

**Context Quality Score:** Markanız geçti ama hangi bağlamda? "Roibase gibi ajanslar" vs "Roibase'in server-side GTM çözümü" farklı equity taşır. Snippet'i semantic analysis ile skorlayın (pozitif/nötr/negatif + spesifite derecesi).

**Competitive Displacement:** Aynı keyword'de rakip markaların atıf aldığı oran. "First-party data CDP" sorusunda Segment, mParticle, Roibase geçiyorsa, 3'lü share var demektir. Zaman içinde payınız artıyor mu?

| Metrik | Tanım | Hedef Değer |
|---|---|---|
| Citation Rate | Atıf alınan keyword oranı | >%15 (kategori liderine göre) |
| First-Position Rate | İlk sırada geçme oranı | >%5 |
| Context Positivity | Pozitif bağlam snippet oranı | >%80 |
| Competitive Share | Rakiplere göre atıf payı | Top 3 içinde |

Bu metrikleri haftalık dashboard'a alın. Trend grafiği: X ekseni zaman, Y ekseni citation rate. Content yayınladıktan 2-4 hafta sonra citation rate'te yükseliş görmeniz gerekir (modelin indexing gecikmesi var).

## Content Stratejisini Citation'a Göre Optimize Et

Citation rate düşükse ne yaparsınız? Klasik SEO'daki "daha fazla backlink" yaklaşımı işe yaramıyor. LLM'ler backlink saymıyor (en azından doğrudan değil). Bunun yerine: **içerik derinliği, yapısal veri, authoritative signal**.

**Derinlik:** LLM'ler shallow content'i atlamıyor, ama "bu kaynak detaylı mı?" sinyaline duyarlı. 500 kelimelik blog yerine 2000 kelimelik technical guide yazın. Kod örnekleri, tablolar, step-by-step instruction ekleyin. Model retrieval yaparken "bu kaynak actionable" sinyali veriyor.

**Yapısal veri:** Schema.org markup'ı LLM'lerin parse etmesini kolaylaştırıyor. `Article`, `HowTo`, `FAQPage` schema'ları ekleyin. Özellikle `FAQPage` — model soru-cevap ikililerini direkt çekebiliyor.

**Authoritativeness:** Yazar bio'su, kurum bilgisi, yayın tarihi. Model "bu 2023'te yazılmış, outdated" diyebiliyor. Fresh content bias var. Eski içeriği güncelleme tarihi ile yenileyin.

**Tradeoff:** Citation optimize etmek trafikten taviz vermek değil, ama öncelik kayması var. Örneğin: "Shopify eklentileri" generic keyword'ü trafik getirir ama LLM citation'ı düşüktür (çünkü model kendi listesini üretir). "Server-side Shopify checkout tracking" spesifik keyword'ü daha az trafik getirir ama citation rate yüksektir (çünkü az kaynak var, sizinki derinlikli). İkisini dengeleyin — traffic keyword'lere 60%, citation keyword'lere 40% effort verin.

## Citation Data'yı Attribution Pipeline'a Bağla

Citation tracking'i izole tutmayın. Klasik marketing attribution ile entegre edin. Çünkü kullanıcı ChatGPT'de markanızı görüp, 2 gün sonra Google'da aratıp gelebilir. Bu journey'i bağlamazsanız, LLM'in katkısını göremezsiniz.

**UTM tagging:** Eğer Perplexity inline link veriyorsa, o link'i UTM'le tag'leyin (`utm_source=perplexity&utm_medium=citation`). Google Analytics'te "perplexity" source'undan gelen trafiği göreceksiniz. Ama ChatGPT link vermiyor, sadece marka adı geçiyor — orada doğrudan attribution yok.

**Brand search lift:** Citation rate artınca, brand search volume artıyor mu? Google Trends veya Search Console'da marka keyword'lerini izleyin. Eğer ChatGPT'de markanız 3 ay boyunca %25 citation rate'e çıktıysa, brand search'te +%15 artış görebilirsiniz. Korelasyon, tam attribution değil ama güçlü sinyal.

**Survey attribution:** Kullanıcıya "Bizi nereden duydunuz?" sorusunda "AI chatbot (ChatGPT, Perplexity vb.)" seçeneği ekleyin. Küçük sample ama directional veri verir.

**First-party event tracking:** Kullanıcı sitenize geldiğinde, referrer yoksa ama landing page AI ile ilgili keyword içeriyorsa (örn. `/blog/llm-citation`), bu dolaylı sinyal. [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) ile bu sinyalleri CDP'de birleştirip, customer journey'de "AI exposure" segmenti oluşturabilirsiniz.

## Risk ve Blindspot'lar

LLM citation tracking'in sınırları neler? Birincisi: **sampling bias**. Siz 500 keyword test ediyorsunuz, ama gerçek kullanıcılar 50.000 farklı soru soruyor. Sizin test setiniz representative olmayabilir. Çözüm: keyword havuzunu Search Console'dan çekip, prompt template'lere çevirin — böylece gerçek demand'i proxy'liyorsunuz.

İkincisi: **model update churn**. ChatGPT bugün sizi atıf ediyor, 2 hafta sonra model güncellemesi oluyor, citation rate %18'den %9'a düşüyor. Bu, algoritma güncellemesi gibi — kontrol edemezsiniz. Tek savunma: multi-model diversification. Sadece ChatGPT'ye bel bağlamayın, Claude, Gemini, Perplexity'de de citation alın.

Üçüncüsü: **maliyet**. Aylık 500 keyword × 3 model × 4 hafta = 6.000 API call. Her call 0.02$ ise, ayda 120$. Startup için tolere edilebilir, ama enterprise'da keyword sayısı 5.000'e çıkarsa, maliyet 1.200$/ay olur. Budget constraint varsa, keyword'leri tier'lere ayırın — Tier 1 (yüksek değer, haftalık test), Tier 2 (orta değer, aylık test).

Dördüncüsü: **yanlış pozitif**. Regex ile "Roibase" arıyorsunuz, model "Roibase benzeri küçük ajanslar" demiş. Bu citation mı? Teknik olarak evet ama equity sıfır. Context quality score buraya çözüm — sadece mention'ı saymak yerine, sentiment + specificity skoru ekleyin.

## Şimdi Ne Yapmalı

Citation tracking henüz mainstream değil, ama 2027'de standart metrik olacak. Erken başlarsanız, baseline kurarsınız — rakipleriniz başladığında siz zaten trend görüyorsunuz. İlk adım: 50 kritik keyword'ünüzü alın, prompt template'e çevirin, ChatGPT + Perplexity'de manuel test edin. Markanız kaç kez geçiyor? Hangi bağlamda? Bu 2 saatlik iş, size mevcut durumu gösterir. Sonraki adım: API probe'u kurgulamak. n8n workflow'u veya Python script'i ile otomasyonu kurun, haftalık rapor alın. Citation rate düşükse, içerik derinliği ve yapısal veriyi artırın. Yüksekse, bunu attribution pipeline'a bağlayıp, brand lift'i ölçün. LLM citation, SEO'nun yeni frontier'ı — Google position 1'de olmak yerine, ChatGPT'nin cevabında geçmek hedef oldu.