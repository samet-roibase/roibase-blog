---
title: "Embedding Drift: Üretimde Vector DB'leri Nasıl Sürdürürüz"
description: "Model migration, re-indexing maliyeti ve embedding versiyonlama — production'daki vector database'lerin bakımı için tradeoff analizi."
publishedAt: 2026-06-08
modifiedAt: 2026-06-08
category: ai
i18nKey: ai-006-2026-06
tags: [embedding-drift, vector-database, mlops, model-migration, retrieval]
readingTime: 8
author: Roibase
---

Embedding modelleri değişiyor. OpenAI text-embedding-3-small'dan text-embedding-3-large'a geçtin — tüm vektörleri yeniden üretecek misin? Bir yıllık eski içeriğin indexi hâlâ geçerli mi, yoksa semantic space kaydı mı? Production'da RAG pipeline'ı kurarken bu soruları erteleyemezsin. Çünkü embedding drift — modelin zaman içinde öğrendiği yeni representation'lar ve eski index arasındaki semantic mesafe — retrieval doğruluğunu sessizce aşındırır. Bu yazıda re-indexing stratejileri, model migration'ın maliyet tradeoff'u ve vector versiyonlama pratiğini kurguluyoruz.

## Drift'in Anatomisi: Embedding Space Neden Kayar

Embedding modeli sadece input'u vektöre çevirmez — latent space'i de tanımlar. Model güncellenir, yeni domain data'yla fine-tune edilir veya tamamen farklı mimariye geçilirse (örneğin Sentence-BERT'ten BGE-M3'e) bu space rotation geçirir. Sonuç: eski belgeler eski modelle encode edilmiş, query'ler yeni modelle encode ediliyor — cosine similarity artık eski semantic ilişkiyi yansıtmıyor.

İki senaryo var: *intra-model drift* (aynı model ailesi içinde versiyon farkı) ve *inter-model drift* (farklı model ailesi). OpenAI'nin ada-002'den text-embedding-3-small'a geçişi inter-model, 3-small'dan 3-large'a geçiş intra-model sayılabilir ama her ikisi de re-indexing ihtiyacı doğurur. Fark magnitude'de: farklı aileler arası migration'da retrieval accuracy %40'a kadar düşebilir (MTEB benchmark'tan gözlem), aynı ailede %5-10 civarı.

Drift'in fark edilmesi zor çünkü sistem sessizce çalışmaya devam eder. Query latency artmaz, hata fırlatılmaz — sadece üst sıralardaki dökümanlar daha az ilgili olur. Bu yüzden production'da retrieval quality metriği (nDCG, recall@k) zorunlu. Eğer user feedback veya offline eval yoksa drift'i ancak %15-20 doğruluk kaybından sonra farklarsın — o noktada iş kaybı zaten gerçekleşmiş.

## Re-indexing Stratejileri: Full Rebuild ve Incremental Hybrid

Re-indexing üç yoldan biri: *full rebuild*, *incremental re-index*, *shadow index*.

**Full rebuild:** Tüm corpus'u yeni modelle encode et, yeni collection'a yaz, prod traffic'i atomic switch ile aktar.장점: garanti edilen semantic tutarlılık. Dezavantaj: maliyet. 10 milyon belge, ortalama 400 token, text-embedding-3-large ile encode = ~2 milyar token. OpenAI fiyatlandırması $0.13/1M token varsayımıyla ~$260. Pinecone veya Weaviate'te 1536-dim, 10M vektör = ~60 GB index size, hosting maliyet ~$150/ay (Pinecone p2 pod). Toplam ilk yatırım: ~$400-500.

**Incremental re-index:** Sadece yeni veya değişen belgeleri yeni modelle encode et. Eski belgeler eski embedding'le kalır.장점: maliyet %70 düşer (varsayım: corpus'un %30'u son 6 ayda eklenmiş). Dezavantaj: hybrid space — query yeni modelle encode, bazı docs eski modelle encode. Cosine similarity tutarlılığı bozulur, hatta farklı modeller normalize edilmemişse magnitude bias oluşur.

**Shadow index:** Yeni modeli production'dan ayrı bir index'te test et. Gerçek query'leri her iki index'e de gönder, sonuçları karşılaştır (ama kullanıcıya sadece eski index döner). Belirli accuracy threshold'u geçince prod switch yaparsın.장점: risk yok, A/B test şansı. Dezavantaj: double cost — hem eski hem yeni index aynı anda serve oluyor, latency %30-40 artar (iki sorgu paralel gönderilse de aggregation overhead var).

Bizim tercihimiz: **shadow index → full rebuild**. İlk iki hafta shadow ile eval yapıyoruz, eğer nDCG@10 improvement >%5 ise production switch edip eski index'i drop ediyoruz. Incremental re-index'i sadece model ailesi değişmediğinde (örneğin ada-002 v1 → v2 gibi minor bump) kullanıyoruz.

## Model Migration'ın Maliyet Tradeoff'u: Dimensionality ve Inference

Yeni embedding modeli genelde daha yüksek boyut sunar: ada-002 (1536-dim) → text-embedding-3-large (3072-dim). Dimensionality artışı iki maliyeti çarpıyor: storage ve query latency.

**Storage:** Pinecone pod-based architecture'da 3072-dim vektör, 1536-dim'e göre %100 daha fazla disk tüketir (float32 encoding varsayımı: 3072 × 4 byte = 12 KB per vector). 10M vektör = 120 GB. p2 pod 100 GB free tier'ı doldurur, p3'e geçmen gerekir (~$500/ay). Alternatif: Weaviate quantization (product quantization veya binary quantization) — %75 storage reduction, ama recall %2-3 düşer.

**Query latency:** Yüksek dim, HNSW index traversal'da daha fazla distance computation gerektirir. 1536-dim → 3072-dim geçişte p95 latency 45ms'den 70ms'ye çıkabilir (Pinecone documentation'dan extrapolation). Eğer SLA target'ın <50ms ise bu kabul edilemez. Çözüm: *dimension reduction* — text-embedding-3-large'ın embedding_size parametresiyle 1536'ya downsize et. Trade-off: accuracy %1-2 düşer ama latency kalır.

Cost tradeoff matrisi:

| Seçenek | Storage (10M doc) | Latency (p95) | Accuracy drop |
|---------|-------------------|---------------|---------------|
| 1536-dim (eski model) | 60 GB | 45 ms | Baseline |
| 3072-dim (yeni model, full) | 120 GB | 70 ms | Baseline |
| 3072-dim + quantization | 30 GB | 65 ms | -2% recall |
| 1536-dim (yeni model, reduced) | 60 GB | 48 ms | -1% recall |

Bizim seçimimiz: yeni modeli 1536-dim'e reduce et. Accuracy loss minimal, infrastructure cost sabit. Eğer downstream task (örneğin GEO için [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) pipeline'ı) citation rate gibi nihai metriğe bakıyorsan offline eval'de 1536 vs 3072'yi doğrudan karşılaştır — çoğu durumda %1 fark son metriği etkilemiyor.

## Versiyonlama: Embedding'i Metadata'da Saklamak

Production'da vector DB'yi log table gibi düşün — her vektör bir *timestamp* ve *model_version* taşımalı. Weaviate veya Qdrant'ta bu metadata field olarak saklanır:

```json
{
  "id": "doc-12345",
  "vector": [...],
  "metadata": {
    "model": "text-embedding-3-large",
    "model_version": "2024-04",
    "indexed_at": "2026-01-15T10:30:00Z",
    "content_hash": "a3f8c..."
  }
}
```

Bu data üç işe yarar:

1. **Incremental re-index filter:** "model_version != current" sorgusuyla hangi belgelerin yenilenmesi gerektiğini bulursun.
2. **Drift detection:** Query time'da metadata üzerinden "eski modelle encode edilmiş belge döndüyse" uyarı logla. Eğer %30'dan fazla result eski versiyondan geliyorsa re-index tetikle.
3. **Rollback:** Yeni model production'da soruna yol açtıysa metadata filter'ıyla eski model embedding'lerine fallback yapabilirsin (shadow index'i henüz drop etmemişsen).

Metadata overhead küçük: her vektör için ~100 byte extra, 10M belge = 1 GB. Fakat operasyonel esneklik kazandırır. Özellikle multi-tenant sistemlerde (her tenant farklı model versiyonu kullanabilir) bu pattern zorunlu hale gelir.

## Content Hash ile Idempotency: Gereksiz Re-indexing'den Kaçınmak

Embedding drift'ten ayrı bir sorun: content değişmediğinde bile re-index tetiklenmesi. Örneğin CMS'ten her gece tüm blog yazılarını çekip index'e gönderiyorsun — ama %90'ı aynı, sadece 10 yazı güncellenmiş. Tüm corpus'u yeniden encode etmek israf.

Çözüm: her belgenin content'ine SHA-256 hash uygula, metadata'ya kaydet. Yeni indexing job'ında önce hash'i karşılaştır — eşleşiyorsa embedding'i tekrar üretme. Örnek pseudo-code:

```python
def should_reindex(doc_id, new_content, vector_db):
    existing = vector_db.get_metadata(doc_id)
    if not existing:
        return True
    new_hash = hashlib.sha256(new_content.encode()).hexdigest()
    return new_hash != existing.get("content_hash")
```

Bu pattern encode cost'u %70-80 düşürür (günlük incremental pipeline'da). Ama dikkat: eğer model değiştiyse content_hash'e bakmadan re-index zorunlu. Yani logic: `if model_version != current OR content_hash != existing → re-index`.

## Karşı Durum: Re-indexing'i Geciktirmenin Bedeli

Bazı ekipler "eski embedding'ler yeterince iyi" diyerek re-indexing'i 6-12 ay erteler. Risk: embedding model'in domain'e özgü fine-tune'u varsa (örneğin e-ticaret için ürün açıklamaları), yeni model %20-30 daha iyi retrieval sunabilir. Bu fark downstream'de conversion'a dönüşür — Roibase'in [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) ekibiyle yaptığımız bir projede RAG-based ürün önerici'nin embed model upgrade'inden sonra click-through rate %18 arttı (A/B test, 14 gün, n=50K user).

Ama tradeoff var: re-indexing sırasında downtime riski. Atomic switch yapmazsan kullanıcılar query'lerinde geçici tutarsızlık görür (bazı docs yeni model, bazıları eski). Çözüm: blue-green deployment — yeni index'i ayrı collection'da hazırla, DNS/load balancer switch ile 10 saniyede geç. Pinecone veya Weaviate'te collection alias feature'ı bunu kolaylaştırır.

## Kapanış: Embedding Hygiene Production Pratiği

Embedding drift kaçınılmaz — model evrilir, domain data değişir, semantic space kayar. Production'da vector DB'yi statik artifact değil, sürekli maintain edilen bir sistem olarak düşünmelisin. Minimum hygiene checklist: (1) model versiyonunu metadata'da sakla, (2) retrieval quality metriği izle (haftada 1 offline eval yeterli), (3) shadow index ile migration test et, (4) content hash'le idempotency kur. Re-indexing maliyetini göze alamıyorsan incremental + reduced dimensionality hybrid'ine git — ama accuracy loss'u downstream metrikte ölç, tahmin etme. Embedding drift'i ignore etmek, search accuracy'yi %15-20 sessizce aşındırır — fark ettiğinde kullanıcı davranışı zaten değişmiş olur.