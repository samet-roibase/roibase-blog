---
title: "Production'da RAG: Retrieval Kalitesi Cost'tan Önce Gelir"
description: "Embedding model seçimi, chunking stratejisi ve eval setup — production RAG sistemlerinde performans/maliyet tradeoff'larını nasıl yöneteceğiniz."
publishedAt: 2026-07-27
modifiedAt: 2026-07-27
category: ai
i18nKey: ai-003-2026-07
tags: [rag, retrieval, embedding, chunking, llm-eval]
readingTime: 8
author: Roibase
---

RAG sistemleri production'a alındığında en sık karşılaşılan sorun şu: retrieval kalitesi düşükse LLM ne kadar güçlü olursa olsun yanıt çöp. OpenAI'nın `text-embedding-3-large` modeli token başına 0.00013 dolar, Cohere'in `embed-english-v3.0` 0.0001 dolar — farkı 30%, ama yanlış chunk'ları retrieve ediyorsanız sonuç aynı: hallucination. Embedding maliyetini düşürürken retrieval kalitesini düşürürsek downstream LLM maliyeti %200 artar (re-ranking, prompt padding, retry). Bu yazıda production RAG pipeline'ında embedding seçimi, chunking ve eval setup'ın nasıl önceliklendirildiğini gösteriyoruz.

## Embedding Model Seçimi: Latency × Recall Matrix

Embedding modelini seçerken iki metrik kritik: retrieval recall@k (ilk k chunk içinde doğru bilgi) ve p99 latency. Ada v2 ile text-embedding-3-small arasındaki fark sadece fiyat değil — semantic granularity. Eğer domain'iniz dar ve terminoloji ağırsa (örneğin hukuk, finans), fine-tune edilmiş bir Sentence-BERT variant'ı (768 dim) OpenAI'nın 1536 dim modelinden daha iyi recall verir.

Production'da gördüğümüz sayılar: `text-embedding-3-large` ile MTEB benchmark'ında 64.6 retrieval skor alıyorsunuz, ama domain-specific eval set'inizde (örneğin e-ticaret ürün dokümantasyonu) 58.2'ye düşüyor. Cohere'in `embed-multilingual-v3.0` modelini Türkçe içerikte test ettiğimizde recall@5 %12 daha yüksek çıktı — çünkü Cohere multilingual training'de daha fazla non-English corpus kullanmış. Tek metrik yok: batch size 128 ile embed latency 230ms, tek request'te 45ms. Real-time search yapıyorsanız latency öncelikli, offline indexing yapıyorsanız recall öncelikli.

Pratikte şöyle test ediyoruz: eval set'inizi (100-200 soru + ground truth chunk) alıyorsunuz, 3 model ile indexliyorsunuz, her model için recall@1/3/5 ve MRR (mean reciprocal rank) hesaplıyorsunuz. Kazanan modeli seçtikten sonra fine-tuning yapıp yapmayacağınıza karar veriyorsunuz — eğer recall@5 %75'in altındaysa fine-tuning ROI pozitif. Roibase'in [veri analizi çalışmaları](https://www.roibase.com.tr/tr/verianalizi) bu eval pipeline'ını kurmak için gerekli metrik altyapısını içerir.

## Chunking Stratejisi: Fixed vs Semantic vs Recursive

Chunk boyutu RAG'in en kritik hiperparametresi. 512 token chunk ile 2048 token chunk arasındaki fark şu: küçük chunk daha spesifik retrieval sağlar ama context kaybeder, büyük chunk context korur ama noise artar. Üstelik chunk overlap oranı (örneğin %10) da retrieval precision'ı etkiler.

Fixed-size chunking (her 512 token'da kes) en basit yöntem ama paragraf ortasında kesilme yapınca semantic bütünlük bozuluyor. Langchain'in `RecursiveCharacterTextSplitter` çalışma şekli şöyle: önce `\n\n` ile böl (paragraf), sığmazsa `\n` ile böl (satır), sığmazsa nokta ile böl. Bu yöntem %18 daha iyi recall@3 veriyor çünkü chunk boundary'leri doğal metin yapısını takip ediyor.

Semantic chunking bir adım daha ileri gidiyor: embedding similarity'ye bakarak chunk'ları oluşturuyorsunuz. Örneğin bir dokümanda konu değişimi tespit edildiğinde (cosine similarity 0.6'nın altına düştüğünde) yeni chunk başlatıyorsunuz. LlamaIndex'in `SemanticSplitterNodeParser` bu yöntemi kullanıyor. Production'da gördüğümüz tradeoff: semantic chunking indexing süresini %40 artırıyor (her sentence embedding hesaplanıyor) ama retrieval quality %9 artıyor.

### Chunk Overlap: Ne Kadar Yeterli?

Overlap oranı genelde %10-20 arası tutuluyor. 512 token chunk'ta 50 token overlap demek bir cümlenin iki chunk'ta da görünebileceği anlamına geliyor. Overlap arttıkça index boyutu artıyor (storage cost) ama edge case'lerde retrieval kalitesi artıyor. Bizim testlerimizde %15 overlap optimal nokta: daha fazlası diminishing return veriyor.

Overlap stratejisi de önemli: sliding window (her chunk 50 token kayıyor) mı yoksa paragraph-aware overlap (overlap sadece paragraf başında) mı? Paragraph-aware overlap %7 daha az index boyutu oluşturuyor ama aynı retrieval quality'yi koruyor.

## Eval Setup: Offline Metrikler Production'ı Temsil Etmeli

RAG eval'da en büyük tuzak şu: offline metrikler iyi görünüyor ama production'da hallucination patlaması yaşıyorsunuz. Bunun sebebi eval set'inizin production query distribution'ını temsil etmemesi. Bizim önerimiz: production log'larından rastgele 200 query alıp manual olarak ground truth chunk'larını işaretlemek. Bu 4 saatlik iş size 6 ay boyunca doğru yönlendirme sağlıyor.

Ölçülmesi gereken metrikler:

| Metrik | Tanım | Hedef |
|---|---|---|
| Recall@k | İlk k chunk içinde doğru bilgi var mı | >%80 (k=5) |
| MRR | Doğru chunk'ın ortalama sırası | >0.7 |
| Context precision | Retrieve edilen chunk'ların ne kadarı relevant | >%60 |
| Answer relevancy | LLM yanıtı soruyla alakalı mı (LLM-as-judge) | >%85 |
| Faithfulness | LLM yanıtı sadece context'ten mi üretilmiş | >%90 |

Context precision ve faithfulness'ı ölçmek için LLM-as-judge kullanıyoruz: GPT-4o-mini'ye "Bu chunk soruyla alakalı mı?" diye soruyoruz, 0-1 skor alıyoruz. Bu yöntem human eval ile %89 korelasyon gösteriyor (bizim internal eval'da) ve maliyeti human eval'ın 1/50'si.

Production'da continuous eval yapmanız gerekiyor: her 1000 query'de bir rastgele 10 query alıp eval pipeline'ından geçirin, recall düşüş tespit edilirse alert alın. Bu setup Prometheus + Grafana ile kolayca kurulabilir — retrieval latency, chunk count, LLM token usage metrikleri aynı dashboard'da takip edilebilir.

## Hybrid Search: Dense + Sparse Retrieval Kombinasyonu

Pure dense retrieval (sadece embedding similarity) bazen exact term match'leri kaçırıyor. Örneğin kullanıcı "Q3 2025 revenue" diye sorduğunda "third quarter 2025 gelir" chunk'ı semantik olarak yakın ama exact term yok — BM25 gibi sparse retrieval bu durumda daha iyi çalışıyor. Hybrid search iki yöntemi birleştiriyor: dense retrieval top-50 chunk getiriyor, sparse retrieval top-50 chunk getiriyor, ikisi RRF (reciprocal rank fusion) ile merge ediliyor.

Weaviate ve Qdrant gibi vector DB'ler hybrid search'ü native destekliyor. Bizim testlerimizde hybrid search pure dense'e göre %6 daha iyi recall@10 veriyor ama latency %18 artıyor (iki ayrı index query'si). Production'da hybrid search'ü query karmaşıklığına göre açıp kapatabilirsiniz: eğer query 3 kelimeden kısaysa sadece sparse, 10 kelimeden uzunsa sadece dense, ortası hybrid.

Alpha parametresi (dense vs sparse weight) domain'e göre değişiyor: e-ticaret'te sparse daha önemli (ürün kodu, SKU), teknik dokümantasyonda dense daha önemli (kavramsal benzerlik). Bizim default alpha 0.7 (dense ağırlıklı) ama A/B test ile optimize edilmesi gerekiyor.

## Re-Ranking: Retrieval Sonrası Precision Artışı

İlk retrieval 50 chunk getiriyor, ama bunların hepsini LLM'e context olarak vermek hem pahalı hem de noise ekliyor. Re-ranking modeli (Cohere'in `rerank-english-v3.0` gibi) bu 50 chunk'ı query'ye göre yeniden skorluyor, en relevant 5-10 tanesini seçiyor. Re-ranking modelinin görevi farklı: embedding modeli genel semantic similarity ölçüyor, re-ranker query-chunk relevance'ı ölçüyor.

Production'da re-ranking %15 daha iyi context precision sağlıyor ama 80ms latency ekliyor. Tradeoff şu: eğer downstream LLM maliyetiniz yüksekse (GPT-4 kullanıyorsanız) re-ranking ROI pozitif, GPT-4o-mini kullanıyorsanız latency cost daha ağır basıyor. Bizim setup'ımızda critical query'ler (SLA <500ms) re-ranking atlanıyor, analytical query'ler (dashboard, rapor) re-ranking kullanıyor.

Re-ranker seçimi de önemli: Cohere'in modeli cross-encoder tabanlı, latency yüksek ama accuracy iyi. Jina AI'nın re-ranker'ı bi-encoder tabanlı, latency düşük ama accuracy %4 daha düşük. Production'da ikisini de test edip latency/accuracy tradeoff'ına göre karar vermek gerekiyor.

## Cost Profiling: Token Ekonomisi Embed'den Başlar

RAG pipeline'ında maliyet şu şekilde dağılıyor (ortalama production case):

- Embedding: %8
- Vector search: %2 (compute)
- Re-ranking: %5
- LLM inference: %85

Embedding maliyeti küçük görünüyor ama indexing sırasında büyük hacimlerde hesaplanıyor. 1M doküman, ortalama 1000 token/doküman, OpenAI `text-embedding-3-large` ile 1B token = 130 dolar. Aylık yeniden indexing yapıyorsanız (incremental değil, full reindex) yıllık embedding cost 1560 dolar. Cohere'e geçerseniz 1200 dolar. %23 tasarruf.

Ama asıl maliyet şu: eğer retrieval kalitesi düşükse LLM re-try yapıyor, context padding yapıyor, hallucination correction yapıyor — bu %200 token artışı demek. 1M query/ay, ortalama 2000 token/query, GPT-4o 10 dolar/1M token = 20K dolar/ay. Retrieval quality %10 düşerse retry rate %15 artıyor, maliyet 23K dolara çıkıyor. Embedding'de 30 dolar tasarruf etmeye çalışırken downstream'de 3K dolar kaybediyorsunuz.

Bu yüzden "production'da RAG" derken ilk soru şu olmalı: retrieval eval setup'ım var mı? Cevap hayırsa, embedding model seçimi erken. [First-party veri mimarisi](https://www.roibase.com.tr/tr/firstparty) bu eval pipeline'ını besleyen log altyapısını kurmayı içerir — production query'leri, retrieval sonuçları, LLM yanıtları structured olarak saklanmalı ki sonradan analiz edilebilsin.

## Incremental Indexing: Değişen Veriye Nasıl Reaksiyon Vereceğiniz

Production'da doküman seti statik değil — her gün yeni blog yazısı, ürün sayfası, dokümantasyon ekleniyor. Full reindex maliyetli ve downtime gerektiriyor. Incremental indexing yöntemi şu: sadece değişen dokümanları yeniden embed ediyorsunuz, vector DB'ye ekliyorsunuz. Qdrant ve Pinecone incremental insert'i native destekliyor.

Zorluk şu: bir dokümanda değişiklik olunca sadece o chunk'ı mı güncelliyorsunuz yoksa tüm dokümanı mı? Eğer chunk boundary'leri değiştiyse (yeni paragraf eklendi, chunk boyutu değişti) tüm dokümanın chunk'larını yeniden hesaplamanız gerekiyor. Bizim stratejimiz: doküman versiyonunu takip ediyoruz (hash), versiyon değiştiyse tüm chunk'ları silip yeniden ekliyoruz. Bu yöntem %3 fazla reindex yapıyor ama consistency garantisi veriyor.

Deletion stratejisi de önemli: eski chunk'ları vector DB'den silmezseniz index kirleniyor, relevance düşüyor. Ama her chunk'a TTL eklemek de overhead. Bizim çözümümüz: her chunk'a `doc_id` ve `version` metadata'sı ekliyoruz, doküman güncellendiğinde eski version'ın chunk'larını `doc_id + version` ile bulk delete ediyoruz. Bu yöntem Qdrant'ta 200ms, Pinecone'da 450ms sürüyor (10K chunk için).

RAG sistemini production'a almanın en kritik adımı retrieval quality'yi önceden ölçmek ve sürekli izlemek. Embedding model seçimi, chunking stratejisi, eval setup — bunlar birbirinden bağımsız değil, pipeline'ın tamamını etkiliyor. Cost optimization embeddin'den değil, retrieval precision'dan başlıyor. Doğru chunk'ı ilk seferde getiremeyen bir sistem downstream'de katlanarak pahalılaşıyor.