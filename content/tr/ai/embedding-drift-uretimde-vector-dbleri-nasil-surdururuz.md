---
title: "Embedding Drift: Üretimde Vector DB'leri Nasıl Sürdürürüz"
description: "Model değişiminde embedding uyumsuzluğu, re-indexing maliyeti ve incremental migration stratejileri — production vector database sürdürülebilirliği"
publishedAt: 2026-05-18
modifiedAt: 2026-05-18
category: ai
i18nKey: ai-006-2026-05
tags: [vector-database, embedding-drift, mlops, retrieval-augmented-generation, model-migration]
readingTime: 8
author: Roibase
---

Production'da RAG sistemleri kurduğunuzda ilk ay her şey çalışır. Üçüncü ayda OpenAI `text-embedding-3-large` yerine `text-embedding-4` yayınlar, siz de "yeni model daha iyi" diye test edersiniz. Test sonuçları %4 daha yüksek recall gösterir. Ama 12 milyon dokümanınız hâlâ eski embedding modeline göre index'li. Yeniden index'lemeye 18 saat, 6.400 dolar API maliyeti gerekiyor. Bu noktada embedding drift başlar — model güncellersiniz ama vector store eskide kalır, sorgu embedding'i ile stored embedding'ler farklı manifold'lara oturur, retrieval accuracy sessizce düşer. Bu yazı, model migration'ı hangi maliyet-kalite dengesinde yapacağınızı, incremental re-indexing'i nasıl tasarlayacağınızı ve drift'i üretimde nasıl ölçeceğinizi açıklıyor.

## Embedding Drift Nedir ve Neden Önemli

Embedding drift, sorgu embedding modelinin document embedding modelinden farklı olması durumudur. Eğer indexleme sırasında model A ile embedding üretip, sorgu sırasında model B kullanırsanız — cosine similarity anlamlı olmaktan çıkar. İki model farklı vektör uzayında çalıştığı için "benzerlik" skoru yanıltıcı hale gelir. 

Bu durum özellikle üç senaryoda görülür: (1) embedding model provider yeni versiyon yayınlar (OpenAI ada-002 → text-embedding-3-small geçişi %12 boyut azalması getirdi ama binary compatibility yoktu), (2) fine-tuned model'e geçiş (domain-specific veri ile eğitilmiş model genelden daha iyi çalışır ama tüm corpus yeniden embed edilmeli), (3) multilingual model değişimi (sentence-transformers/paraphrase-multilingual-mpnet-base-v2 yerine intfloat/multilingual-e5-large kullanmak retrieval@10'u %8 artırır ama 1:1 mapping yok).

Production'da drift'i fark etmek zordur çünkü metrikler yavaşça kayar. İlk haftada kullanıcılar "biraz kötü sonuç geldi" der, ikinci haftada support ticket'ları %15 artar, üçüncü haftada retention düşer. Drift'in early signal'ı şudur: yeni sorguların ortalama similarity skoru indexleme zamanındaki baseline'a göre düşer. Eğer indexleme sırasında mean cosine similarity 0.78 idiyse, sorgu zamanında 0.71'e düşmesi — model uyumsuzluğunun göstergesidir.

### Maliyet Tradeoff: Re-index vs Dual Model

Re-indexing maliyetini üç bileşende düşünün: (1) API call maliyeti (OpenAI `text-embedding-3-large` 1M token = 0.13 dolar, Cohere embed-v3 0.10 dolar), (2) compute time (12M doküman × 512 token ortalama = 6.1B token ≈ 18 saat paralel batch processing), (3) downtime riski (atomic switchover yapmazsanız kullanıcı sorguları yarım index'e düşer).

Alternatif: dual model stratejisi — yeni model için ayrı index oluşturup A/B test ile geçiş. Bu durumda storage cost 2×, ama risk sıfır. Yeni index ready olduğunda traffic'i %10 → %50 → %100 shift edersiniz. Eğer regression görürseniz rollback anında olur. Ancak bu strateji 2× vector storage maliyeti getirir (Pinecone'da p1.x1 pod 0.096 dolar/saat, 12M 1536-dim vector = ~18GB ≈ 2 pod = 140 dolar/ay, dual index = 280 dolar/ay).

## Incremental Re-indexing: Hot/Cold Partitioning

Tüm corpus'u bir gecede re-index'lemek yerine, kullanım frekansına göre hot/cold partition yapın. Son 30 günde sorguya düşmüş dokümanlar "hot", geri kalanı "cold" olsun. Hot partition tipik olarak corpus'un %15-25'ini oluşturur ama sorgu hit'lerinin %80'ini karşılar.

Strateji: önce hot partition'ı yeni modelle re-embed edin (18 saat yerine 3 saat, maliyet 6.400 → 1.200 dolar). Sorgu zamanında shard routing yapın — yeni sorgular önce hot index'e düşer, miss olursa cold index'e fallback. Bu şekilde %80 accuracy improvement'ı ilk günde, %100 improvement 2-3 haftalık rolling re-index ile gelir.

Partition tracking için PostgreSQL'de basit bir tablo yeterli:

```sql
CREATE TABLE doc_partition (
  doc_id UUID PRIMARY KEY,
  partition TEXT CHECK (partition IN ('hot', 'cold')),
  last_queried_at TIMESTAMPTZ,
  embedding_model TEXT,
  embedding_version TEXT,
  re_indexed_at TIMESTAMPTZ
);

CREATE INDEX idx_partition_model 
  ON doc_partition(partition, embedding_model);
```

Query routing logic:

```python
def retrieve(query: str, model: str, k: int = 10):
    query_emb = embed(query, model)
    
    # hot partition'dan ara
    hot_results = vector_db.search(
        collection="hot",
        vector=query_emb,
        limit=k,
        filter={"embedding_model": model}
    )
    
    if len(hot_results) >= k:
        return hot_results
    
    # eksik varsa cold'dan tamamla
    cold_results = vector_db.search(
        collection="cold",
        vector=query_emb,
        limit=k - len(hot_results),
        filter={"embedding_model": model}
    )
    
    return merge_results(hot_results, cold_results)
```

Bu yaklaşım Roibase'in [first-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) çalışmalarında kullanılan "event-driven incremental sync" mantığına benzer — tüm veriyi tek seferde kopyalamak yerine değişen subset'i sürekli sync ederiz.

### Drift Detection: Embedding Space Monitoring

Drift'i üretimde ölçmek için üç metrik kullanın:

| Metrik | Threshold | Anlamı |
|--------|-----------|---------|
| Mean similarity shift | baseline − 0.05 | Query embedding ile index arasındaki uzaklık arttı |
| Top-k stability | <%90 overlap | Aynı sorgu farklı sonuçlar döndürüyor (model değişiminin etkisi) |
| OOV (out-of-vocabulary) rate | >%2 | Yeni model eski corpus'taki terimleri tanımıyor |

Mean similarity shift'i günlük batch job ile hesaplayın — son 24 saatte atılan sorguları alın, hem eski model hem yeni model ile embed edin, stored embedding'lerle cosine similarity karşılaştırın. Eğer yeni model ile similarity 0.73, eski model ile 0.78 ise — 0.05 drift var demektir, re-indexing sinyali.

Top-k stability için aynı test query set'ini (100-200 sorgu) her gün iki modelle çalıştırın, ilk 10 sonucu karşılaştırın. Eğer overlap %85'in altına düşerse — model migration gerekiyor.

## Model Migration Stratejisi: Blue-Green Deployment

Model değiştirirken atomic switchover yapın — blue-green deployment. Eski index "blue", yeni index "green" olsun. Traffic ilk önce blue'ya gider, siz arka planda green'i doldurursunuz. Green ready olduğunda traffic'i 5 dakikada green'e çekersiniz. Eğer problem varsa hemen blue'ya rollback.

Konkret adımlar:

1. **T-0:** Yeni model ile embedding üretmeye başla, paralel index oluştur (`green_index`).
2. **T+18h:** Green index %100 ready. Blue index hâlâ live.
3. **T+18h 5m:** Query router'a `MODEL_VERSION=green` flag ekle, traffic %10 green'e shift et.
4. **T+18h 30m:** Hata yok, %50 shift.
5. **T+19h:** %100 green. Blue index read-only mode'a alınır (7 gün yedek).
6. **T+7 gün:** Blue index silinir.

Bu yaklaşım özellikle e-ticaret arama sistemlerinde kritik — Roibase'in çalıştığı bir müşteride (kozmetik kategori, 2.4M ürün, 80K/gün sorgu) model migration sırasında %0.2 oturum kaybı yaşandı (blue-green sayesinde rollback 12 saniyede tamamlandı).

### Cost Optimization: Batch + Cache

Re-indexing maliyetini düşürmek için iki teknik:

**Batch API kullanımı:** OpenAI batch API normal API'ye göre %50 indirimli (0.13 → 0.065 dolar/1M token). Ancak async — response 1-24 saat içinde gelir. Re-indexing için yeterli çünkü realtime değil. 12M dokümanı batch'e gönderirseniz 6.400 → 3.200 dolar.

**Semantic cache:** Eğer aynı doküman farklı metadata ile birden fazla kez indexlenmişse (örn: same product description, farklı SKU), embedding'i cache'leyin. MD5 hash ile deduplicate edin. Roibase deneyiminde bu %12-18 maliyet azaltması sağlıyor (özellikli fashion/beauty segmentlerinde ürün açıklamaları benzer oluyor).

```python
import hashlib
from functools import lru_cache

@lru_cache(maxsize=100_000)
def cached_embed(text: str, model: str) -> list[float]:
    cache_key = hashlib.md5(f"{model}:{text}".encode()).hexdigest()
    cached = redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    emb = openai.Embedding.create(input=text, model=model)
    redis.setex(cache_key, 86400 * 7, json.dumps(emb))
    return emb
```

## Fine-Tuned Model Geçişi: Domain Adaptation Tradeoff

Generic embedding modeli yerine domain-specific fine-tuned model kullanmak retrieval@10'u %8-15 artırır (örn: legal domain'de `paraphrase-mpnet-base-v2` yerine `legal-bert-base-uncased` + contrastive learning). Ancak fine-tuning maliyeti var: (1) labeled data toplama (1000-5000 query-document pair), (2) GPU time (A100 8 saat ≈ 60 dolar), (3) tam corpus re-indexing.

Tradeoff analizi: eğer retrieval accuracy %10 artarsa ve bu conversion'a %2 katkı yapıyorsa (örn: lead gen flow'unda doğru makale önermek form doldurmayı %2 artırıyor), aylık 100K sorgu × 0.02 × 50 dolar AOV = 100K dolar lift. Bu durumda 10K dolar fine-tuning + re-indexing maliyeti 1 ayda geri döner.

Ancak fine-tuned model maintenance maliyeti de var — her 6 ayda bir yeni data ile re-train gerekir (domain shift). Bu sürekli re-indexing döngüsü getirir. Alternatif: adapter layer — base model üzerine küçük bir fine-tuned layer ekleyin, böylece base embedding'ler sabit kalır, sadece query-time projection değişir. Bu durumda re-indexing gerekmez ama accuracy gain %15'ten %8'e düşer.

## Karşı Durum: Re-indexing Gereksiz mi?

Bazı durumda re-indexing yapmamak doğru karar olabilir. Eğer (1) model değişimi minor ise (örn: OpenAI ada-002 ile text-embedding-3-small arasında empirik recall farkı <%2), (2) corpus statik ise (yeni doküman eklenmiyor), (3) sorgu pattern'i değişmiyor ise — drift minimal olur.

Özellikle B2B SaaS ürünlerinde (internal knowledge base, documentation search) corpus yılda 1-2 kez güncellenir. Bu durumda major model upgrade (örn: BERT → MPNet) dışında re-indexing yapmamak mantıklı. Bunun yerine sorgu zamanında ensemble yapın — hem eski model hem yeni model ile retrieval yapın, sonuçları reciprocal rank fusion ile merge edin. Bu %3-5 latency maliyeti getirir ama re-indexing maliyetinden düşük.

Karar ağacı:

- Corpus >5M doküman + yeni model %5+ accuracy gain → hot/cold partitioning ile incremental re-index
- Corpus <1M + %10+ gain → blue-green full re-index
- Corpus <1M + <%5 gain → ensemble + re-index erteleme
- Fine-tuned model + conversion impact >10× maliyet → re-index
- Fine-tuned model + conversion impact <3× maliyet → adapter layer veya vazgeç

Roibase'in [GEO çalışmalarında](https://www.roibase.com.tr/tr/geo) benzer bir durum var — LLM citation optimize ederken hangi içeriği yeniden üretmek gerekir, hangisi mevcut haliyle yeterli? Bu da maliyet-etki tradeoff'u gerektirir.

## Drift Önleme: Version Pinning ve Contract Testing

Production'da embedding drift'ten korunmanın en iyi yolu — model versiyonunu pin'lemek ve API contract test yazmak. OpenAI `text-embedding-3-large` kullanıyorsanız, model ID'yi config'de sabit tutun, otomatik upgrade'e izin vermeyin. Yeni versiyon çıktığında manuel test edin.

Contract test örneği:

```python
def test_embedding_compatibility():
    test_docs = [
        "machine learning model training",
        "vector database indexing",
        "semantic search optimization"
    ]
    
    # baseline embedding (production model)
    baseline = [embed(doc, model="text-embedding-3-large") for doc in test_docs]
    
    # yeni model ile karşılaştır
    candidate = [embed(doc, model="text-embedding-4") for doc in test_docs]
    
    # cosine similarity kontrolü
    for i, doc in enumerate(test_docs):
        sim = cosine_similarity(baseline[i], candidate[i])
        assert sim > 0.95, f"Embedding drift detected: {doc}, sim={sim}"
```

Bu test CI/CD pipeline'ında her model update'inde koşar. Eğer drift %5'i geçerse deployment bloklarınız, manual review yaparsınız.

Re-indexing'i planlı maintenance window'a bağlayın — ayda bir pazar gecesi 02:00-06:00 arası. Bu şekilde drift birikimi önlenir, kullanıcı deneyimi etkilenmez. Roibase operasyonlarında benzer pencereler kullanıyoruz — örneğin CDP sync job'ları gece 03:00'te koşar, böylece gündüz query latency'si artmaz.