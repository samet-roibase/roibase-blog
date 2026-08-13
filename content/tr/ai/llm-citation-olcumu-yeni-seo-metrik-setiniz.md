---
title: "LLM Citation Ölçümü — Yeni SEO Metrik Setiniz"
description: "Perplexity, ChatGPT ve Gemini'de markanızın atıf alma oranını ölçmek için kullanabileceğiniz metrik çerçevesi ve teknik yöntemler."
publishedAt: 2026-08-13
modifiedAt: 2026-08-13
category: ai
i18nKey: ai-002-2026-08
tags: [llm-citation, geo-analytics, ai-visibility, brand-attribution, generative-seo]
readingTime: 8
author: Roibase
---

Google Search Console'daki CTR ve konum metriklerine alıştınız. Şimdi ChatGPT'nin cevaplarında markanızın adı kaç kez geçiyor? Perplexity'nin kaynaklarında sayfanız referans gösteriliyor mu? Gemini sizin verilerinizi citation yapıyor mu? 2026'da LLM'lerin bilgi katmanına yerleşmek, klasik SERP'te rank etmek kadar kritik. Ama ölçüm altyapınız hazır değil. Bu yazıda LLM citation'ı nasıl metrik haline getirip karar mekanizmasına bağlayacağınızı göstereceğiz.

## Citation artık birinci sınıf metrik

SEO'nun son 20 yılı "hangi pozisyondasın" sorusu etrafında döndü. Pozisyon, tıklama, dönüşüm. Şimdi kullanıcı arama yapmıyor — ChatGPT'ye soruyor, Perplexity'den özet alıyor. Bu platformlarda "pozisyon" yok. Citation var. Atıf. Kaynak olarak gösterilme.

Citation oranı (Citation Rate) = markanızın kaç LLM yanıtında görünür olduğu / toplam ilgili sorgu. Klasik CTR'nin LLM karşılığı. Ama hesaplaması farklı. Google Search Console'da otomatik gelmiyor. Kendiniz kurmalısınız.

Ölçüm yapmadan optimizasyon yok. GEO (Generative Engine Optimization) stratejiniz citation verisi olmadan kör. Hangi konular atıf alıyor? Hangi içerik formatları LLM'in referans seçimine giriyor? Rakipleriniz ne kadar görünür? Bu soruları cevaplayacak altyapıyı şimdi kurmazsanız, 6 ay sonra pazardan geri kalırsınız.

Üç metrik birincil: **Citation Rate** (kaç cevap sizi içeriyor), **Citation Position** (kaynak listesinde kaçıncı sırada), **Citation Context** (hangi bağlamda atıf alıyorsunuz). Bu üçü olmadan "LLM'de visibility" sadece tahmin.

## Ölçüm altyapısı: API + probe query seti

LLM citation'ı manuel kontrol edemezsiniz. Günde 50 sorgu elle test etseniz bias kaçınılmaz. Otomatik probe sistemi kurmalısınız. OpenAI API, Anthropic API, Google AI Studio API — hepsi programatik erişim veriyor. Perplexity henüz public API yok ama web scraping ile capture edilebilir (ToS'a uygun şekilde).

**Probe query seti** kritik. Brand keyword + kategori keyword + long-tail kombinasyonları. Örnek: "en iyi CRO ajansı İstanbul", "conversion rate optimization nedir", "A/B test platformu seçimi". Toplamda 100-200 query. Her gün veya her hafta bu seti tüm modellere çalıştırıyorsunuz. Response'ları parse edip citation varlığını tespit ediyorsunuz.

Response parsing: JSON çıktı alın. Regex ile brand mention arayın. Citation source listesi varsa (Perplexity gibi) ona bakın. Yoksa (ChatGPT gibi) cevap içinde brand adınızın yanında URL var mı kontrol edin. Her LLM farklı format kullanıyor — parser kodunuzu her model için özelleştirin.

```python
# Örnek probe workflow (Python pseudo-code)
queries = load_queries("probe_set.json")
models = ["gpt-4o", "claude-3.5-sonnet", "gemini-2.0-flash"]

for query in queries:
    for model in models:
        response = call_llm_api(model, query)
        citations = extract_citations(response, model_type=model)
        
        log_metric({
            "date": today(),
            "model": model,
            "query": query,
            "brand_cited": "roibase" in citations.lower(),
            "citation_position": get_position(citations, "roibase"),
            "total_citations": len(citations)
        })
```

Veriyi BigQuery'ye yazın. Günlük snapshot. Haftalık trendlere bakın. Citation rate düşüyorsa içerik stratejisini gözden geçirin. Belirli modelde asla çıkmıyorsanız o modelin training data'sında yoksunuz demektir — taze içerik üretip bekleyin.

## Position ve context: atıf kalitesi metrikleri

Citation rate yeterli değil. 10 kaynaktan biri olarak geçmekle ilk kaynak olmak aynı değil. Citation Position metriğiniz olmalı. Perplexity'de genelde 3-5 kaynak gösterir. Siz 5. sıradaysanız tıklama alma olasılığınız %10. İlk sıradaysanız %40. Bu data'yı ölçün.

Citation Context daha nüanslı. LLM sizi hangi bağlamda referans gösteriyor? "Roibase, server-side GTM kurulumunda uzman" mu diyor, yoksa "İstanbul'da birçok ajans var, Roibase bunlardan biri" mi? İlki pozitif signal, ikincisi generic mention. Context sentiment'ını da loglamak gerekiyor.

Context extraction: LLM response'unda markanızın geçtiği cümleyi çıkarın. O cümleyi başka bir LLM'e (Claude gibi) gönderin, "Bu cümlede brand mention pozitif mi, nötr mü, negatif mi?" diye sorun. Otomatik kategorize edin. Pozitif mention oranınız düşükse içeriğinizde authority signal eksik demektir.

| Metrik | Tanım | Hedef |
|---|---|---|
| Citation Rate | Toplam probe query'de markanın geçme oranı | >15% (kategori lideri için) |
| Avg Citation Position | Kaynak listesinde ortalama sıra | <3 (ilk 3 kaynak) |
| Positive Context % | Pozitif bağlamda atıf alma oranı | >60% |
| Model Coverage | Kaç farklı modelde görünürlük | 3/3 (GPT, Claude, Gemini) |

Bu metrikler olmadan GEO dashboard'u eksik. Klasik SEO'da Search Console vardı. LLM SEO'da kendiniz kuruyorsunuz.

### Competitive benchmarking

Sadece kendinizi ölçmeyin. Rakipleri de probe edin. Aynı query setinde "competitor_brand" mention var mı bakın. Citation share hesaplayın: sizin mention sayınız / (sizin + rakiplerin toplamı). %30 citation share iyi, %10 zayıf. Bu benchmarking olmadan ne kadar iyi olduğunuzu bilemezsiniz.

## Workflow entegrasyonu: GEO pipeline'a bağlamak

Citation metriklerini topladınız. Şimdi ne yapacaksınız? İçgörü üretmezseniz sadece data point biriktirmiş olursunuz. Bu metrikleri [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) sürecinize entegre edin.

Haftalık rapor: hangi query'lerde citation düştü, hangi modelde hiç çıkmıyoruz, rakip hangi konuda bizi geçti? Bu soruların cevaplarını otomatik üretin. n8n workflow'unda citation data'yı çekin, Claude API'ye gönderin, "Bu hafta citation trend'i nedir, hangi aksiyonu önerirsin?" diye sorun. Claude size insight döner: "Gemini'de 'conversion rate optimization' query'sinde 3 haftadır görünmüyorsunuz, yeni case study yayınlayın."

Aksiyon döngüsü:
1. Citation düşük tespit edildi → içerik audit
2. Rakip geçiş görüldü → onların yeni içeriğini analiz et
3. Model-specific gap (örn. GPT'de yoksun) → o modelin preference'ına uygun format üret (örn. GPT structured data sever, schema markup ekle)

Bu döngüyü haftalık döndürürseniz citation rate 3 ayda %50 artar. Döndürmezseniz data ölü kalır. Ölçüm için ölçüm yapmayın — insight için ölçün.

## Cost ve latency: probe sisteminin ekonomisi

Her probe run maliyetli. GPT-4o API call $0.01-0.03, Claude Sonnet $0.015 civarı. 200 query × 3 model × günlük = 600 call. Ayda ~$250-400. Citation tracking'in bedeli bu. Kabul edilebilir mi? Evet — çünkü GEO ROI'si yüksek. LLM'de görünmezseniz yeni nesil kullanıcıya ulaşamazsınız.

Latency de önemli. 200 query'yi seri çalıştırırsanız saatler sürer. Paralel batch processing yapın. Rate limit'e dikkat — OpenAI dakikada 500 request, Claude 1000. Batch'leri ona göre ayarlayın. Async call kullanın, response'ları queue'dan toplayın.

```python
# Async batch örneği (pseudo-code)
import asyncio

async def probe_model(model, query):
    response = await async_llm_call(model, query)
    return parse_citation(response)

async def run_probe_batch(queries, model):
    tasks = [probe_model(model, q) for q in queries]
    return await asyncio.gather(*tasks)

# Tüm modeller için paralel
results = await asyncio.gather(
    run_probe_batch(queries, "gpt-4o"),
    run_probe_batch(queries, "claude-3.5-sonnet"),
    run_probe_batch(queries, "gemini-2.0-flash")
)
```

Latency 200 query için 5-10 dakikaya iner. Günlük cron job'a koyun, sabah 6'da çalışsın, 7'de rapor hazır olsun. Ekibiniz kahve içerken citation dashboard'u açıyor.

## Tradeoff: precision vs coverage

Citation tespit ederken precision ile coverage arasında tradeoff var. Regex ile "roibase" ararsanız false positive çıkabilir (başka context'te "roibase" kelimesi geçebilir). LLM'e "Bu response'da Roibase mention var mı?" diye sorarsanız precision artar ama maliyet 2x olur (probe + verification call).

Bizim yaklaşımımız: ilk aşamada regex + basit parsing (hızlı, ucuz). Belirsiz case'leri flag'le, onları haftalık LLM verification'a gönder. %95 precision yeterli — %100 için ödediğiniz bedel değmez.

Coverage tarafında: tüm LLM'leri kapsayamayabilirsiniz. Claude, Gemini, GPT dışında Llama, Mistral, Cohere var. Onları da ölçmek ister misiniz? Hayır — kullanıcı payı düşük. İlk 3 model toplam LLM trafiğinin %80'ini kapsıyor. Geri kalanı noise.

Citation tracking'de perfection trap'e düşmeyin. Yeterince iyi metrik > mükemmel ama ağır metrik.

## Şimdi ne yapmalı

LLM citation ölçümü 2026'nın SEO zorunluluğu. Bunu kurmadan GEO yapıyorum diyemezsiniz. İlk adım: 50 soruluk probe seti. Kategorinizde kullanıcıların LLM'e sorabileceği soruları listeleyin. Brand keyword + generic keyword karışımı. Sonra API erişimi alın (OpenAI, Anthropic, Google AI Studio). Basit Python script yazın, günlük çalıştırın. Veriyi CSV'ye yazın, Excel'de trend bakın. Sonra BigQuery + Looker Studio'ya taşırsınız. İlk hafta manuel, sonra otomatik. Citation rate %10'un altındaysa içerik stratejiniz yetersiz. %20 üstündeyse doğru yoldasınız. Rakiplerinizle kıyaslayın. Aksiyon alın. 3 ay içinde citation share'iniz artmazsa metodunuz yanlış — revize edin.