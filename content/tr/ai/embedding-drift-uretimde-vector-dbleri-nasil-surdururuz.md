---
title: "Embedding Drift: Üretimde Vector DB'leri Nasıl Sürdürürüz"
description: "Re-indexing maliyetleri, model migration stratejileri ve semantic search performansını korumak için production'da izlenmesi gereken metrikler."
publishedAt: 2026-07-16
modifiedAt: 2026-07-16
category: ai
i18nKey: ai-006-2026-07
tags: [vector-database, embedding-drift, mlops, semantic-search, re-indexing]
readingTime: 8
author: Roibase
---

Semantic search production'a geçtiğinde asıl zorluk başlar. Embedding modeli güncellenir, veri hacmi büyür, query pattern'leri kayar — vector DB'nizdeki 10 milyon satır çok hızlı eskir. Hergün yeniden index alamazsınız, ama üç ay sonra recall %15 düşer. Embedding drift — model versiyonu ile DB arasındaki alignment kaybı — pazarlama arama sistemlerinde kullanıcının yanlış içeriğe yönelmesi, RAG pipeline'da yanlış context çekilmesi, AI agent'ların kör noktalar oluşturması demek. Bu yazıda drift'i nasıl izlediğimizi, re-indexing'i nasıl planladığımızı, hangi migration pattern'leri işe yaradığını somut metriklerle gösteriyoruz.

## Embedding Drift'i Üretimde Görmezden Gelmek

Embedding drift iki durumda ortaya çıkar: model değişikliği ve veri distribution shift. İlk durumda OpenAI `text-embedding-3-small`'dan `text-embedding-3-large`'a geçersiniz, boyut 1536'dan 3072'ye çıkar — query embedding'leri yeni modelden gelir, DB'deki vektörler eski modelden. Cosine similarity hesabı mantıksal olarak çalışır ama semantic space farklı, recall bozulur. İkinci durumda model sabit ama corpus değişir: 6 ay önce e-ticaret ürün katalog'unu index'lediniz, şimdi blog içeriği ve PDF'ler eklendi. Query embedding modeli aynı olsa da yeni dokümanların embedding distribution'ı eski corpus'tan farklı — outlier'lar kNN search'te rank kaymalarına yol açar.

Drift'in etkisi recall metriğiyle ölçülür. Production'da `top-k` retrieval yapıyorsunuz, drift başladığında ground truth ile overlap %85'ten %70'e düşer. Kullanıcı "kampanya stratejisi" arıyor, alakalı makale DB'de var ama 15. sırada çıkıyor — k=10 yapılandırmasıyla görünmez. Bu durum RAG pipeline'larda LLM'in hallucination oranını artırır çünkü context eksik gelir.

Drift izlemek için offline test set tutmak gerekiyor. Production'a geçmeden önce 500 query-document pair'i (relevance label'lı) saklayın, her hafta bu set üzerinde recall@10, MRR (mean reciprocal rank), nDCG metriklerini hesaplayın. Metrik %10 düşerse re-indexing tetikleyicisi haline getirin. Burada dikkat edilmesi gereken nokta test set'in güncel corpus'u yansıtması — eğer yeni doküman türleri eklendiyse test set'i de genişletmek gerekir.

## Re-indexing Stratejileri: Full vs Incremental vs Hybrid

Re-indexing'in üç deseni var: full reindex, incremental update, hybrid blue-green. Full reindex tüm corpus'u baştan embedding'leyip yeni DB index'i yaratır. Maliyet yüksek ama garantili alignment. 10 milyon doküman × 0.13$/1M token (OpenAI `text-embedding-3-large` fiyat) = ~25$ direct cost, işlem süresi 6-8 saat (paralelize ederseniz). Buna Pinecone/Weaviate/Qdrant index build maliyeti eklenir — Pinecone p1 pod'da 1M vektör 0.096$/saat, build sırasında geçici pod skalası gerekir.

Incremental update sadece yeni/değişen dokümanları re-embed eder. Modeli değiştirmediyseniz ve corpus büyümesi varsa mantıklı. Ama model değişirse işe yaramaz çünkü eski embedding'lerle yeni embedding'ler semantic space'de uyumsuz. Hybrid pattern'de blue-green deployment kullanırsınız: yeni index paralel kurarsınız, traffic'i kademeli kaydırırsınız, eski index'i 2 hafta backup tutar sonra silersiniz. Downtime olmaması için en güvenli yöntem bu — ama çift kapasite maliyeti gerektirir (örn: Pinecone'da 2 pod 2 hafta = +15$ geçici maliyet).

| Strateji | Maliyet | Downtime | Model değişikliğinde | Veri shift'inde |
|----------|---------|----------|----------------------|-----------------|
| Full reindex | Yüksek | Var (4-8 saat) | Gerekli | Gerekli |
| Incremental | Düşük | Yok | Çalışmaz | Yeterli |
| Blue-green | Orta | Yok | Uygun | Uygun |

Bizim deneyimimizde quarterly full reindex + weekly incremental çalışıyor: her çeyrekte model değişikliği veya büyük corpus güncellemesi bekliyorsak full reindex, ara dönemde yeni dokümanlar incremental ekleniyor. Hybrid deployment'ı critical pipeline'lar için tercih ediyoruz (örn: GEO için AI citation retrieval sistemi — [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) mimarisinde search downtime müşteri referanslarının kaybolması demek).

## Model Migration: Version Lock ve Backward Compatibility

Embedding model değişikliği planlamak deployment kadar kritik. OpenAI yeni model yayınladığında (`text-embedding-3-large` → hypothetical `text-embedding-4` gibi) hemen geçiş yapmak yerine 2 hafta A/B test yapın. Test ortamında eski model embedding'leriyle yeni model query'leri karşılaştırın — recall düşüyorsa migration masraflı demektir. Eğer yeni model dimension artırıyorsa (1536 → 3072), vector DB storage maliyeti ikiye katlanır.

Version lock için model ID + date tuple saklayın. Her embedding'in metadata'sında `{"model": "text-embedding-3-large", "version": "2025-01-15"}` gibi alan tutun. Query zamanında hangi model kullanıldığını loglayın. Migration sırasında DB'de eski/yeni model mix'i olabilir — bu durumda query router gerekir: query embedding'in model versiyonuna göre ilgili index partition'a yönlendirir.

Backward compatibility için fallback mekanizması kurun. Yeni modelle re-index bittikten sonra 1 hafta eski index'i tutun, traffic split yapın (%80 yeni, %20 eski). Yeni index'te recall düşerse hızla geri dönebilirsiniz. Bu pattern blue-green deployment'ın genişletilmiş hali — Kubernetes'te iki ReplicaSet çalıştırıp Istio ile traffic weight ayarlayarak yapılır.

### Model Freeze ve Checkpoint Yönetimi

Production'da model versiyonu freeze edin — API provider'ın "latest" endpoint'ini kullanmayın. OpenAI `/v1/embeddings` endpoint'i model parametresini zorunlu kılar, bunu config'de sabit tutun. Model değişikliği için dedicated migration pipeline çalıştırın, canlıya geçişi manuel onaylayın. Otomatik güncelleme CI/CD'de embedding drift'i tetikler.

Checkpoint yönetimi için quarterly snapshot alın. Her reindex sonrası DB'nin full dump'ını S3/GCS'ye yazın (Parquet formatında — Pinecone export API kullanılabilir). Snapshot'larda model version metadata'sı saklayın. Disaster recovery'de veya A/B test'te eski checkpoint'i restore edebilirsiniz. 10M vektör × 1536 dim × 4 byte (float32) = ~60GB — sıkıştırılmış halde 20GB, quarterly 4 checkpoint = 80GB storage maliyeti minimal.

## Cost Tradeoff: Re-indexing vs Drift Toleransı

Re-indexing her zaman optimal değil. Eğer semantic search'ünüz düşük precision toleransına sahipse (örn: blog içeriği öneri sistemi) hafif drift kabul edilebilir. Ama yüksek güvenilirlik gerektiren use case'lerde (legal doküman retrieval, AI agent knowledge base) drift %5 bile kritik. Tradeoff'u iş metriğiyle ölçün: drift yüzünden kullanıcı yanlış içerik bulursa (churn riski, support ticket artışı) vs re-indexing maliyeti (direct token cost + engineering time).

Örnek hesap: 5M doküman corpus, monthly 10% büyüme. Full reindex quarterly yapılırsa yıllık 4 kez, her seferinde 12.5$ embedding + 10$ index build = 90$. Incremental monthly update ise 500K doküman × 0.13$/1M = 0.65$ × 12 = 7.8$. Fark 82$ — ama drift yüzünden recall %15 düşerse RAG pipeline hallucination oranı %8'den %20'ye çıkabilir. Eğer bu kullanıcı şikayeti artışı demekse (örn: 100 support ticket × 5$ manual handling = 500$), 90$ yıllık re-indexing maliyeti justify olur.

Drift toleransı için baseline metric belirleyin: `recall@10 >= 0.85`, `MRR >= 0.7`. Bu eşiklerin altına düşünce otomatik re-indexing tetikleyici kurabilirsiniz. MLOps pipeline'ında Airflow DAG ile haftalık metric hesaplama yapın, threshold aşımında Slack alert + otomatik ticket oluşturun. Böylece reactive değil proactive re-indexing yaparsınız.

## Üretimde İzleme: Metric Pipeline ve Alarm Eşikleri

Embedding drift'i gerçek zamanlı yakalayamassanız, recall düşüşü production'da 2-3 hafta geçtikten sonra fark edilir. Bu yüzden metric pipeline kritik. Bizim kurduğumuz yapı şöyle: her query log'unda retrieved document ID'leri + user feedback (click, bookmark, bounce) saklanır. Offline'da bu log'lar ground truth pair'e dönüştürülür (clicked doc = relevant). Haftalık batch job bu dataset üzerinde `recall@k`, `nDCG@k`, `MRR` hesaplar, time-series grafik çizer (Grafana + Prometheus).

Alarm eşikleri:
- `recall@10 < 0.80` → warning (1 hafta içinde investigate)
- `recall@10 < 0.75` → critical (re-index plan başlat)
- `nDCG@10` 2 hafta üst üste düşüyorsa → model drift suspect
- Query latency p99 > 200ms → index fragmentation veya shard imbalance

Latency drift de önemli: vector DB'de doküman sayısı artınca kNN search yavaşlar. Pinecone'da pod count artırarak scale edersiniz ama maliyet artar. Eğer query latency drift görüyorsanız (p99 100ms'den 250ms'e çıktıysa) re-indexing ile index optimize edilir — HNSW graph'ı yeniden build edince fragmentation düşer.

[First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) kapsamında user interaction data'yı Snowflake'e pipe ediyorsak, embedding metric'leri de aynı warehouse'a yazmak mantıklı. Böylece cross-analysis yapabilirsiniz: conversion rate düşüşü ile embedding recall düşüşü korelasyonunu görebilirsiniz. Örneğin recall %10 düşünce checkout rate %3 düştüyse, retrieval quality'nin revenue impact'i kanıtlanmış olur — re-indexing ROI'si net çıkar.

---

Embedding drift'i görmezden gelmek 3 ay sonra semantic search sisteminizin sessizce bozulması demek. Re-indexing'i reactive değil proactive yapmak — quarterly checkpoint, weekly metric monitoring, model freeze — production'da güvenilir retrieval'ın temelidir. Maliyet tradeoff'u basit: drift toleransınızı iş metriğiyle ölçün, threshold'ları sıkı tutun, otomatik alarm kurun. Vector DB'niz büyüdükçe bu süreçler engineering disiplinine dönüşür — tahmin yerine metric, manuel müdahale yerine otomation.