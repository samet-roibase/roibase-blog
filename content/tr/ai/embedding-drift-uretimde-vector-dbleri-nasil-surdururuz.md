---
title: "Embedding Drift: Üretimde Vector DB'leri Nasıl Sürdürürüz"
description: "Production'da embedding model değişince vektör indeksler çöker. Re-indexing, hybrid search ve cost tradeoff stratejileri — mühendislik gerçeği."
publishedAt: 2026-08-03
modifiedAt: 2026-08-03
category: ai
i18nKey: ai-006-2026-08
tags: [embedding-drift, vector-database, mlops, retrieval-augmented-generation, ai-infrastructure]
readingTime: 8
author: Roibase
---

Embedding model'inizi değiştirdiğinizde — daha yeni bir versiyon, farklı bir vendor, fine-tune edilmiş bir alternatif — mevcut vektör indeksiniz çöpe gider. Drift başlar. Cosine similarity skorları anlamını yitirdiği için retrieval kalitesi düşer, kullanıcı sorguları yanlış dokümanlara eşlenir, RAG pipeline'ınız hallüsinasyon üretir. Production'da embedding drift'i yönetmek, model performansı ile operasyonel maliyet arasındaki tradeoff'u kabul etmektir. Bu yazıda re-indexing stratejilerini, hybrid search yaklaşımlarını ve cost-benefit hesaplamalarını production perspektifinden değerlendiriyoruz.

## Drift'in Kökeni: Embedding Uzayları Karşılaştırılamaz

Embedding drift, farklı modellerin aynı içeriği farklı vektör uzaylarına haritalamalarından kaynaklanır. `text-embedding-ada-002` ile encode ettiğiniz 1536-boyutlu bir vektör, `text-embedding-3-large` ile encode edilmiş 3072-boyutlu (veya dimension reduction ile 1536'ya sıkıştırılmış) bir vektörle **karşılaştırılamaz**. Cosine similarity hesaplamak matematiksel olarak mümkün, ama sonuç semantik anlam taşımaz. Model değiştirdiğinizde eski embeddingler üretim dışı kalır.

Bu sorun yalnızca vendor değişiminde değil, aynı vendor'ın yeni model versiyonunda da ortaya çıkar. OpenAI'nin `ada-002`'den `3-small`'a geçişinde dimension sayısı değişmese bile, vektör uzayı eğitim verisi ve mimarisi yüzünden farklıdır. Pinecone, Weaviate veya Qdrant üzerindeki indeksinizde 10 milyon belge varsa ve sorgu embeddingleri yeni modelden geliyorsa, retrieval accuracy %60-70 seviyelerine düşebilir (2024 RAG benchmarkları). Production'da bu, customer support chatbot'unuzun yanlış makale önermesi veya e-ticaret ürün arama sisteminin alakasız sonuç göstermesi anlamına gelir.

Embedding drift'i tespit etmek için evaluation pipeline'ınızda retrieval recall ve precision metriklerini sürekli izlemelisiniz. Örneğin her gün 1000 sorgu için top-10 retrieved dokümanın insan etiketli relevance skoru ile karşılaştırılması gerekir. Ortalama recall %85'in altına düştüğünde, model değişimini veya indeks bozulmasını şüphelenmek için kritik eşik budur (LangChain monitoring best practice).

## Re-Indexing: Full vs Incremental Stratejileri

Embedding model değiştiğinde tek kesin çözüm full re-indexing'dir. Tüm doküman korpusu yeni modelle yeniden encode edilir ve vector database'e yazılır. 10 milyon belge için bu işlem zaman ve parayla orantılıdır: OpenAI `text-embedding-3-large` fiyatı token başına $0.00013 (2025 fiyat listesi) — ortalama 500 token/doküman varsayarsak 10M doküman = 5 milyar token = $650 embedding cost. Voyager indeks rebuilding (HNSW algoritması) Pinecone'da p2.x8 pod'unda ~6 saat sürer (Pinecone benchmark).

Full re-indexing downtime yaratıyorsa **blue-green deployment** yaklaşımı uygulayabilirsiniz: yeni embedding model'le paralel bir indeks oluşturur, production traffic'i eski indekse yönlendirirken yeni indeks arka planda build olur. İndeks hazır olduğunda DNS/load balancer switch ile trafik yeni indekse geçer. Bu strateji 2x storage cost getirir (geçiş süresince iki indeks yaşar), ama zero-downtime gereksinimi olan SaaS uygulamalarında tek yoldur.

Incremental re-indexing, dokümanları öncelik sırasına göre yeniden encode etmektir. Hangi dokümanlar daha sık sorgulanıyor? Analytics'ten çektiğiniz "top 10% most-queried documents" listesini önce yeniden indexleyip geri kalanını zamanla güncelleme yaparsınız. Bu hibrit bir geçiş periyodu yaratır: bazı embeddingler yeni model, bazıları eski. Retrieval sırasında similarity skorlarının anlamı karışık olduğu için **metadata filtering** eklemek zorunludur — örneğin `embedding_model_version` field'ı ile sorguyu sınırlandırırsınız. Bu yaklaşım cost'u spread eder ama retrieval quality inconsistent olur.

## Hybrid Search: BM25 + Vector Fusion

Embedding drift riskini azaltmanın başka yolu, retrieval pipeline'ını tamamen vektör arama üzerine kurmamaktır. Hybrid search, keyword-based (BM25, Elasticsearch) ve vector-based arama sonuçlarını birleştirir. Weaviate'in `hybrid` query mode'u alpha parametresiyle iki sonuç setini fusion eder: `alpha=0.5` dengeli karışım, `alpha=0.8` vektöre daha fazla ağırlık (Weaviate 1.24 doc).

Bu yaklaşım embedding model değiştiğinde dayanıklılık sağlar. BM25 token-level exact match'e dayandığı için model-agnostic'tir. Model değişse bile keyword retrieval anchor görevi görür ve drift'in etkisini sınırlar. Ancak hybrid search latency ekler: her query için hem inverted index hem HNSW traversal gerekir. Pinecone'da p95 latency 45ms'den 80ms'ye çıkabilir (2025 benchmark).

Hybrid search'ün başka avantajı **domain-specific terminology**'de performansıdır. Embedding modelleri genel corpus üzerinde eğitildiği için niş jargonu (örneğin medikal terim veya hukuk terminolojisi) iyi encode edemez. Bu durumlarda BM25 component exact match sağlayarak retrieval quality'yi yükseltir. E-ticaret'te ürün kodu (SKU) aramaları için vector search yetersizdir; keyword bileşeni zorunludur.

## Model Migration Cost-Benefit Hesabı

Yeni embedding model'e geçmek her zaman daha iyi retrieval garantilemez. Cost-benefit analizini şu metriklerle yapmalısınız:

| Metrik | Eski Model | Yeni Model | Delta |
|--------|-----------|-----------|-------|
| Recall@10 | %82 | %88 | +6pp |
| Latency (p95) | 35ms | 50ms | +43% |
| Embedding cost ($/M token) | $0.10 | $0.13 | +30% |
| Re-indexing cost (10M doc) | - | $650 | - |
| Storage (dimension) | 1536 | 3072 | 2x |

Bu örnekte recall +6pp iyileşme sağlıyor, ama latency %43 artıyor ve storage double oluyor. E-ticaret arama sisteminde latency kritikse bu tradeoff kabul edilemez. Chatbot için retrieval accuracy öncelikli ise kabul edilebilir.

Re-indexing'i amortize etmek için geçiş planını şöyle yapılandırabilirsiniz: ilk 3 ay eski model ile devam, yeni model paralel test ortamında eval edilir. Recall delta %10'un üzerindeyse re-indexing approve edilir. Bu yaklaşım [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) sürecine benzer: önce data-driven karar, sonra infrastructure investment.

Başka bir cost optimization: **dimension reduction**. `text-embedding-3-large` 3072 dimension üretir, ama OpenAI API'sinde `dimensions=1536` parametresiyle yarıya indirilebilir. Matryoshka embedding yaklaşımı (2024 research) performans kaybını %2-3 ile sınırlar. Bu storage ve indexing süresini yarıya indirir.

## Versiyonlama ve Rollback Stratejisi

Production'da embedding model değişimi geri alınamaz değildir. Blue-green deployment sırasında eski indeksi 30 gün tutmak, rollback opsiyonu sağlar. Yeni model beklenmedik retrieval hataları üretiyorsa (örneğin belirli bir query pattern'inde hallüsinasyon artışı) traffic hızlıca eski indekse dönebilir.

Embedding versiyonlamasını metadata olarak saklamak debug ve monitoring için kritik. Pinecone'da her vektöre `{"embedding_model": "text-embedding-3-large", "indexed_at": "2026-08-01"}` metadata eklerseniz, retrieval sorunlarını model versiyonuna göre filtreleyip analiz edebilirsiniz. Bu approach MLOps best practice'e uygun: her artifact versiyonlanmalı ve traceable olmalı.

Rollback planı yoksa model migration riski artar. Production'da **canary deployment** kullanılmalı: yeni model ile %10 traffic test edilir, 48 saat boyunca error rate ve latency izlenir. Metrikler baseline'ı geçerse trafik kademeli olarak %100'e çıkar. Bu yaklaşım SRE prensiplerinden gelir: incremental rollout, observe, mitigate.

## Drift İzleme ve Otomasyon

Embedding drift'i manuel tespit etmek sürdürülebilir değildir. Otomatik monitoring pipeline'ı şu bileşenleri içermeli:

1. **Evaluation dataset:** 500-1000 sorgu + altın standart (insan etiketli) relevant doküman çiftleri
2. **Daily batch eval:** Her gün production embedding model ile bu dataset üzerinde retrieval yapılır, recall/precision hesaplanır
3. **Alerting:** Recall %85'in altına düşerse Slack/PagerDuty alert
4. **Drift quantification:** Yeni model ile eski model embedding'lerinin cosine similarity dağılımı (eğer anlamlıysa) — ortalama similarity <0.7 ise uzaylar çok farklı

Otomasyon için [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) yaklaşımı gerekir: evaluation sonuçları BigQuery'ye yazılır, Looker Studio dashboard'unda izlenir, anomaly detection (z-score >3) alert tetikler. Bu feedback loop olmadan model migration blind flight olur.

Embedding drift yönetimi reactive değil proactive olmalı. Yeni model release'lerini takip edin (OpenAI changelog, vendor roadmap), önce staging ortamında test edin, production'a geçmeden 2 hafta eval sonuçlarını toplayın. Acele geçiş, downtime ve kullanıcı deneyimi bozulmasına yol açar.

Production'da vector database sürdürülebilirliği mühendislik disiplinini gerektirir: cost-benefit hesabı, incremental rollout, rollback stratejisi, otomatik monitoring. Model değişimi kaçınılmaz — RAG sistemlerinin uzun vadeli başarısı, drift'i kabul edip yönetmek. Re-indexing maliyetini amortize etmek, hybrid search ile dayanıklılık artırmak ve evaluation pipeline'ını otomatikleştirmek, AI infrastructure'ın olgunluk göstergesidir. Embedding drift'e hazırlıksız yakalanan organizasyonlar retrieval quality düşüşüne maruz kalır; hazırlıklı olanlar model evrimini competitive advantage'a çevirir.