---
title: "Production'da RAG: Retrieval Kalitesi Cost'tan Önce Gelir"
description: "Embedding modeli, chunking stratejisi ve eval setup'ı doğru kurmadan RAG sisteminiz hallüsinasyon makinesi olur. Production deneyiminden dersler."
publishedAt: 2026-06-01
modifiedAt: 2026-06-01
category: ai
i18nKey: ai-003-2026-06
tags: [rag, embedding, retrieval, llm-eval, production-ai]
readingTime: 8
author: Roibase
---

RAG sistemleri production'a çıktıktan sonra iki kader yaşar: ya hallüsinasyon yüzünden 3 hafta içinde kapatılır, ya da retrieval kalitesini 90+ F1'e çıkarıp iş kritik pipeline haline gelir. Fark embedding seçiminde, chunking stratejisinde ve eval setup'ında gizli. Cost optimizasyonu ikinci konu — önce doğru dökümanı getirmeyi çözmezseniz ucuz model pahalı hata üretir.

## Embedding Modeli: Boyut Değil, Domain Uyumu

Embedding seçiminde ilk refleks "en büyük model en iyi embed yapar" oluyor. text-embedding-3-large (3072 dim) her durumda text-embedding-3-small'dan (1536 dim) üstün değil. MTEB benchmark'ı genel corpus'ta ölçüyor — senin domain'in finans, medikal veya e-ticaret ise o skor yanıltıcı.

Production'da gördüğümüz: 768 boyutlu domain-specific bir model (örn: sentence-transformers/all-mpnet-base-v2 üzerine fine-tune edilmiş), 3072 boyutlu genel model'den %12 daha iyi recall@10 verdi. Sebep basit: embedding space domain jargonunu bilmiyor. "Conversion rate optimization" ile "CRO" arasındaki semantik mesafe genel modelde 0.68, domain-tuned modelde 0.91 çıkıyor.

Boyut seçiminde tradeoff net: 3072 dim ile index 4.2GB, 768 dim ile 1.1GB. Query latency sırasıyla 47ms ve 18ms (FAISS HNSW, m=16). Eğer retrieval recall'unda %5'ten az kayıp varsa küçük model kazanır — hem maliyet hem hız açısından. Bunu ölçmeden karar vermek tahmin üzerine mühendislik yapmak demek.

### Fine-Tuning Kararı

Embedding fine-tune'u iki durumda zorunlu: (1) domain vocabulary çok spesifik (tıbbi terim, kripto token isimleri), (2) query-document pair'lerin dağılımı asimetrik (soru kısa, döküman uzun). OpenAI Embedding API fine-tune kabul etmiyor, sentence-transformers veya Cohere embed-v3 kullanmanız lazım. 500-1000 labeled pair ile başlayın — daha fazlası marginal gain veriyor.

## Chunking: Boyut Değil, Semantik Bütünlük

"Chunk size 512 token iyidir" diye bir kural yok. Biz 3 farklı stratejiye baktık: (1) fixed 512 token, (2) markdown header bazlı (H2/H3 sınırlarında kes), (3) semantic chunking (LLM ile paragraf bağlamını oku, anlamsal geçişte böl). Sonuç: markdown-based chunking %18 daha iyi NDCG@5 verdi, ama 2.3x daha yavaş index build etti.

Fixed chunking'in sorunu cümle ortasından kesmesi. "Server-side tracking ile first-party veri mimarisini entegre ederseniz..." cümlesi 510. tokende kesilirse ikinci chunk "...entegre ederseniz attribution doğruluğu artıyor" diye başlıyor — context kaybolmuş. Retriever bu chunk'ı "attribution" sorgusu için bulur ama bağlam eksik olduğu için LLM yanıt üretemez. Hallüsinasyon buradan başlıyor.

Semantic chunking (LangChain'in RecursiveCharacterTextSplitter'ı değil, gpt-4o-mini ile "bu paragraf yeni bir fikre mi geçiyor?" sorusu) daha iyi ama maliyetli: 10K sayfalık knowledge base'i chunk'lamak $47 tuttu (0.15$/1M token input). Tradeoff: index build'i one-time cost, retrieval quality sürekli değer. Biz semantic tercih ettik, ama index'i haftada bir güncellediğiniz dinamik döküman setinde fixed chunking'e geri dönebilirsiniz.

| Strateji | Avg Chunk Size | NDCG@5 | Build Time (10K doc) | Maliyet |
|---|---|---|---|---|
| Fixed 512 | 489 token | 0.71 | 4 dk | $0 |
| Markdown-based | 680 token | 0.84 | 9 dk | $0 |
| Semantic (LLM) | 520 token | 0.81 | 22 dk | $47 |

## Overlap Stratejisi

Chunk'lar arasında overlap koymak retrieval recall'u artırır — ama index boyutunu 1.4-1.8x şişirir. 50 token overlap ile %6 recall artışı gördük (recall@10: 0.78 → 0.83). Overlap'i sadece uzun dökümanlar için (>2000 token) aktive edip kısa içeriklerde kapatabilirsiniz — conditional overlap logic.

## Eval Setup: Offline Metric → Online A/B

RAG'i production'a sürmeden eval pipeline kurmak zorunlu. "LLM çıktısı iyi görünüyor" yeterli değil — retrieval precision/recall + LLM factuality ayrı ölçülmeli.

İki katman ölçüyoruz:
1. **Retrieval katmanı:** Precision@k, Recall@k, NDCG@k, MRR. Ground truth: el ile etiketlenmiş query-document pair'ler (bizde 320 adet). Ragas kütüphanesinin `context_precision` metriği LLM'siz çalışıyor, hızlı iterasyona uygun.
2. **Generation katmanı:** Factual consistency (döküman ile çıktı arasındaki entailment), hallucination rate (LLM çıktısının döküman dışına çıkma oranı), citation accuracy (LLM'in kaynak belirtme doğruluğu). Bunlar için LLM-as-judge pattern kullanıyoruz — gpt-4o'ya "bu cevap dokümana dayanıyor mu?" soruyoruz, agreement rate 0.89 (human eval ile kıyasla).

Offline eval günde 1 kez otomatik koşuyor (CI/CD pipeline'ına entegre). Yeni chunking stratejisi, yeni embedding modeli, yeni reranker test ediyorsanız commit öncesi bu metrikler yeşil olmalı. Online A/B test başka: %10 trafiğe yeni RAG versiyonunu verip user feedback + session metriklerini (task completion, query reformulation rate) izliyoruz. Offline NDCG 0.02 artsa bile online task completion değişmeyebilir — bu durumda deploy'u es geçiyoruz.

### LLM-as-Judge Güvenilirliği

LLM-as-judge'ı körü körüne güvenmeyin. GPT-4o kendini 6% durumda hallüsinasyon yapmış olarak işaretledi (false positive), %4 durumda gerçek hallüsinasyonu kaçırdı (false negative). Çözüm: kritik use case'lerde human-in-the-loop eval — random %5 sample'ı insan kontrol ediyor, LLM-judge'ın calibration skoru bu subset üzerinden hesaplanıyor. Calibration <0.85 ise judge prompt'unu revize ediyoruz.

## Reranker: İkinci Geçişin Gücü

İlk retrieval 20-50 chunk getiriyor (recall odaklı), reranker bunları 3-5'e indiriyor (precision odaklı). Cohere rerank-v3 ile %14 precision artışı gördük (P@5: 0.68 → 0.78). Maliyet: 1M token rerank için $2 (embedding'den 10x pahalı), ama LLM context window'una 50 yerine 5 chunk vermek hem token hem hallüsinasyon riskini düşürüyor.

Reranker'ın tradeoff'u latency: embedding search 18ms, rerank eklediğinizde 95ms oluyor. Async pipeline ile tolere edilebilir — kullanıcı sorgusunu gönderirken background'da retrieval + rerank koşuyor, LLM yanıt stream başladığında toplam 400-500ms'de bitiyor. Senkron yaparsanız user experience kötüleşir.

Reranker'sız RAG sistemleri "top-k embedding result doğrudur" varsayımına dayanıyor. Bu sadece query ile chunk arasında yüksek lexical overlap varsa geçerli. Semantic query'lerde (örn: "first-party veri mimarisi ile server-side ölçümü nasıl bağlarım?") embedding ilk 10'da 4 irrelevant chunk getiriyor. Reranker query-document cross-attention'ı kullandığı için bu noise'ı temizliyor. Production'da reranker olmadan RAG kurmak riskli — citation accuracy %18 düşüyor.

## Hibrid Search: BM25 + Embedding

Embedding-only retrieval iki senaryoda zayıf: (1) tam eşleşme aramaları (brand name, ürün kodu), (2) rare term'ler (embedding space'de az görülmüş kelimeler). BM25 (keyword-based) bu gap'i kapatıyor. Weaviate veya Qdrant'ta hibrid search: 0.7 embedding weight + 0.3 BM25 weight. Recall@10: embedding-only 0.76, hibrid 0.83.

BM25 index'i embedding index boyutuna göre 5-8x daha küçük (inverted index structure). Latency eklemiyor (paralel koşuyor). Hibrid yapının tek maliyeti query planning — hangi ağırlık oranı hangi query type'ı için optimal, bunu A/B test ile buluyoruz. Bizde genel query'ler 0.8 embedding, brand/product mention içerenler 0.5 embedding kullanıyor.

## Production'da İzleme

RAG deployment'ın %60'ı monitoring — sistemin sessizce kötüleşmesini engellemek için. İzlediğimiz metrikler:

- **Retrieval coverage:** Query'lere döküman bulma oranı (target >95%)
- **Avg context relevance:** LLM'e verilen chunk'ların kaçı gerçekten relevant (target >0.8)
- **Hallucination rate:** LLM çıktısının döküman dışına çıkma sıklığı (target <5%)
- **Latency p95:** %95 query'nin bitme süresi (target <800ms)
- **Cost per query:** Embedding + rerank + LLM (target <$0.02)

Bu metrikler Datadog'a push ediliyor, threshold aşıldığında Slack alert. Retrieval coverage 2 gün üst üste %92'nin altına düşerse knowledge base'de gap var demek — content ekibi tetikleniyor. Hallucination rate artıyorsa LLM prompt'u veya chunk boyutu revize ediliyor. Latency spike varsa vector database sharding'ine bakılıyor.

[Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/tr/verianalizi) metodolojisiyle RAG metriklerini business outcome'a bağlamak kritik — retrieval kalitesi artınca user satisfaction survey skoru da artıyor mu, yoksa sadece teknik metrik mi şişiyor? Bunu korelasyon analizi ile görüyoruz.

## Cost vs Kalite Dengesi

Production RAG'in aylık maliyeti: 1M query, ortalama 3 chunk retrieved, gpt-4o-mini generation ile ~$420 (embedding $80, rerank $40, LLM $300). Eğer reranker'ı kaldırırsanız $380'e iner ama hallucination rate %5'ten %11'e çıkıyor — bu da support ticket artışı demek, indirect cost $600+.

Cost'u düşürmenin doğru yolu: (1) cache layer (aynı query 24 saat içinde tekrar gelirse cache'ten dön, %23 query tekrarlı), (2) smaller embedding model (domain-tuned 768 dim), (3) async rerank (kritik olmayan query'lerde rerank'ı skip et). Bunlar yapılınca $280'e iniyor, kalite kaybı %2 altında.

Yanlış yaklaşım: embedding yerine keyword search, LLM yerine rule-based template. Bu "AI yaptık" diyemeyeceğiniz bir sistem üretir — retrieval precision %40'lara düşüyor. Cost optimizasyonu retrieval kalitesini sabote etmemeli.

---

RAG'i production'a taşımak model seçiminden fazlası — eval, monitoring, iterasyon disiplini gerekiyor. Embedding boyutunu küçültüp latency kazanabilirsiniz ama recall düşerse LLM hallüsinasyon yapar, kullanıcı güvenini kaybedersiniz. Önce retrieval kalitesini 0.85+ F1'e çıkarın, sonra cost'a bakın. Yoksa ucuz bir hallüsinasyon makinesi kurmuş olursunuz.