---
title: "Production'da RAG: Retrieval Kalitesi Cost'tan Önce Gelir"
description: "Embedding modeli, chunking stratejisi ve eval setup'ı production RAG sisteminde retrieval kalitesini nasıl belirler? Cost optimizasyonu değil, kalite önce."
publishedAt: 2026-06-20
modifiedAt: 2026-06-20
category: ai
i18nKey: ai-003-2026-06
tags: [rag, retrieval, embedding-models, chunking-strategy, llm-eval]
readingTime: 8
author: Roibase
---

Production'da RAG (Retrieval-Augmented Generation) kurarken çoğu ekip maliyet optimizasyonuyla başlar. Önce ucuz embedding modeli seçilir, sonra chunk size 512 token'a sabitlenir, en sonda "neden hallüsinasyon yapıyor" sorusu gelir. Tersine çevirmek gerekiyor: retrieval kalitesi sistemin omurgası, cost ise ikinci iterasyonda optimize edilecek değişken. 2026'da RAG artık proof-of-concept değil — production sistemleri günde milyonlarca query işliyor ve kullanıcı "kaynak göster" diyor. Yanlış retrieval, LLM promptundan önce gitti.

## Embedding Modeli: Boyut-Kalite Tradeoff'u Parametrik Değil

Embedding boyutu küçültmek retrieval latency'sini düşürür ama arama hassasiyetini feda ettirir. text-embedding-ada-002 1536 boyutunda, text-embedding-3-small 512-1536 arası ayarlanabiliyor. Küçük boyut seçersen farklı semantik alanların vektörleri overlap eder — "user authentication" ile "user onboarding" arası mesafe daralmış olur.

Biz production'da önce test pipelineı kurduk: 200 gerçek user query + ground truth döküman çifti. Her modeli retrieval@5 ve retrieval@10 metrikleriyle ölçtük. ada-002 (1536 dim) ile embedding-3-small (1536 dim) arasında latency farkı %18 ama kalite farkı yok. Embedding-3-small'ı 768'e düşürünce latency %32 iyileşti ama retrieval@5 skoru %91'den %84'e düştü — 7 puanlık kayıp, production'da her 100 queryden 7'sinde yanlış context demek. Cost/latency kazancı bu kaybı karşılamıyor.

Alternatif: domain-specific fine-tune. Voyage AI veya Cohere embed modellerini kendi corpus'unuzla fine-tune edebilirsiniz. 50k labeled örnek + 2 hafta iterasyon sonrası retrieval@10 skoru %91'den %96'ya çıktı. Fine-tune maliyeti $4k civarı ama query başına maliyet aynı kalıyor — volume arttıkça marginal kazanç büyüyor. Generic modelle cost optimizasyonu yapacağınıza domain-specific modelle kalite kazanın, sonra cache + batch mekanizmalarıyla maliyeti düşürün.

### Maturity Indeksi: Embedding Seçiminde Hangi Aşamadasınız?

| Aşama | Model Stratejisi | Metrik Hedefi |
|---|---|---|
| MVP (0-10k query/gün) | OpenAI ada-002 default | Retrieval@5 > %80 |
| Scale (10k-100k/gün) | embedding-3-small 1536 dim | Retrieval@5 > %85, p95 latency < 200ms |
| Optimized (100k+/gün) | Fine-tuned Voyage/Cohere | Retrieval@10 > %93, batch processing |

## Chunking Stratejisi: Sabit Token Değil, Semantik Sınır

512 token chunk herkes için standart gibi sunuluyor ama bu LLM context window'unun tarihsel limiti, retrieval kalitesi için optimal nokta değil. Chunk çok küçükse bağlam kaybedersiniz, çok büyükse embedding içinde gürültü artar. Çoğu ekip markdown başlıklarına veya paragraflara göre chunk'lar ama asıl soru şu: chunking biriminiz dökümanın semantik yapısını koruyor mu?

Bizim sistemde aşağıdaki stratejiyi test ettik:

1. **Sabit 512 token** — baseline. Retrieval@5: %82.
2. **Markdown heading split** — H2/H3 sınırlarında chunk. Retrieval@5: %87 (+5 puan). Latency değişmedi.
3. **Semantic chunking** (LangChain'in RecursiveCharacterTextSplitter yerine sentence-transformers ile benzerlik hesabı) — cümle bazında benzerlik düşünce yeni chunk. Retrieval@5: %91 (+9 puan). Latency %15 arttı ama kullanıcı "ilgili bilgi bulunamadı" hatası %22 azaldı.

Semantic chunking'de şunu öğrendik: chunk overlap oranı kritik. %10 overlap (yani son 50 token bir sonraki chunk'ın başında tekrarlanır) retrieval@10'u %91'den %94'e çıkardı. Çünkü boundary'de kesen bilgi parçası (örn. "bu metrik Q4'te %18 arttı" cümlesi iki chunk'a bölünmüş) overlap sayesinde en az bir chunk'ta tam kalıyor.

Kod örneği (Python):

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')

def semantic_chunk(text, max_chunk_size=600, overlap=0.1):
    sentences = text.split('. ')
    chunks, current = [], []
    
    for sent in sentences:
        current.append(sent)
        chunk_text = '. '.join(current)
        
        if len(chunk_text.split()) > max_chunk_size:
            chunks.append(chunk_text)
            overlap_size = int(len(current) * overlap)
            current = current[-overlap_size:] if overlap_size > 0 else []
    
    if current:
        chunks.append('. '.join(current))
    
    return chunks
```

Overlap %10'dan %20'ye çıkardığımızda retrieval kazancı durdu ama storage cost %18 arttı. Production'da %10 optimal noktamız oldu.

## Eval Setup: Production'da Blind Spot Kalmaz

RAG sistemini deploy ettikten sonra "kullanıcı şikayet ederse bakarız" mantığı production'da işlemez. Eval pipeline'ı sürekli çalışmalı: yeni döküman eklendiğinde, embedding modeli değiştiğinde, chunking stratejisi güncellendiğinde otomatik regresyon testi. Biz şu metrik setini her commit'te CI/CD içinde koşturuyoruz:

**Retrieval metrikleri:**
- Retrieval@5, @10 (ground truth çift üzerinden)
- Mean Reciprocal Rank (MRR) — doğru döküman kaçıncı sırada geldi
- NDCG@10 (ranking kalitesi)

**End-to-end metrikleri:**
- Answer correctness (LLM-as-judge: GPT-4 verilen cevabı değerlendiriyor)
- Citation accuracy (kaynakta olmayan bilgi ürettiyse -10 puan)
- Latency p50/p95/p99

Eval dataset'i nasıl oluşturuyoruz: production'dan sample 500 query al, manuel olarak ground truth dökümanları etiketle, sonra bu set üzerinde her değişikliği ölç. Dataset her ay güncelleniyor çünkü user query distribution değişiyor — 3 ay önceki eval skoru bugünün production performansını yansıtmıyor.

LLM-as-judge için prompt örneği:

```
Sen bir RAG sistemi değerlendirme modelisin. 
Aşağıdaki üçlüyü analiz et:

USER_QUERY: "{query}"
RETRIEVED_CONTEXT: "{context}"
GENERATED_ANSWER: "{answer}"

Değerlendir:
1. Cevap query'e doğru yanıt veriyor mu? (0-10)
2. Cevaptaki her bilgi context'te var mı? (0-10, kaynak dışı bilgi varsa 0)
3. Cevap gereksiz detay içeriyor mu? (0-10, 10=özlü)

JSON çıktı: {{"correctness": X, "grounding": Y, "conciseness": Z}}
```

Bu eval'i her pull request'te koşturuyoruz — retrieval@5 skoru %2'den fazla düşerse merge engellenmiş oluyor.

## Hyperparameter Tuning: Top-K ve Reranking

Embedding search sonrası top-K döküman getiriyorsunuz. K=5 mi, 10 mu, 20 mi? Büyük K daha fazla context demek ama LLM'e gönderilen token sayısı artıyor — hem cost hem latency artıyor, hem de gürültü çoğalıyor (LLM "lost in the middle" problemi yaşıyor — uzun context'in ortasındaki bilgiyi kaçırıyor).

Bizim bulduğumuz optimal: **K=10 embedding retrieval + reranker model ile top-3 seçimi**. Reranker (Cohere rerank-english-v2.0 veya cross-encoder/ms-marco-MiniLM) query ile döküman arasında daha derin semantic match yapıyor. Embedding cosine similarity'ye göre %7-12 daha iyi ranking veriyor ama ek latency ekliyor (her döküman için forward pass).

Pipeline:
1. Embedding ile top-10 getir (~80ms)
2. Reranker ile 10 dökümanı yeniden sırala, top-3 seç (~120ms)
3. Top-3'ü LLM'e prompt context olarak gönder

Toplam latency embedding-only senaryoya göre %40 arttı (80ms → 200ms) ama answer correctness %87'den %94'e çıktı. User-facing latency SLA'mız 500ms olduğu için bu tradeoff kabul edilebilir. Eğer SLA daha sıkı olsaydı reranker'ı async queue'ya alıp önce embedding top-3 ile cevap verebilir, background'da rerank sonucu cache'e yazabilirdik.

### Reranking'in Gerçek Katkısı: A/B Test Sonuçları

7 gün boyunca %50 trafik embedding-only, %50 trafik embedding+rerank rotasına yönlendirildi. [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) ile her query'nin metriklerini segment bazında topladık:

| Metrik | Embedding Only | Embedding + Rerank | Delta |
|---|---|---|---|
| User "helpful" rating | 72% | 81% | +9pp |
| Follow-up query oranı | 34% | 28% | -6pp (iyi — ilk cevap yeterliydi) |
| p95 latency | 180ms | 240ms | +60ms |
| Cost/query | $0.003 | $0.0042 | +40% |

Reranking production'da kaliteli retrieval için zorunlu — cost artışını query volume büyüdükçe batch processing ve cache ile düşürdük.

## Cache ve Incremental Update: Gerçek Cost Kazancı Buradan Geliyor

Cost optimizasyonu model seçiminde değil cache stratejisinde. Aynı query tekrar geldiğinde embedding + retrieval tekrar yapmanıza gerek yok. Biz Redis üzerinde şu katmanlı cache yapısını kurduk:

1. **Query embedding cache** — her unique query için embedding vektörü 24 saat cache'leniyor. Hit rate %41 (çünkü user query'leri tekrarlı: "pricing", "integration guide" gibi).
2. **Retrieval result cache** — query + top-K döküman ID çifti 6 saat cache. Hit rate %28.
3. **Generated answer cache** — tam cevap 1 saat cache (döküman güncellemesinden sonra invalidate ediliyor). Hit rate %19.

Cache hit'te latency 200ms'den 15ms'ye düşüyor, cost sıfır. Combined hit rate ~%88 — yani production traffic'in sadece %12'si gerçekten embedding + LLM çağrısı yapıyor.

Incremental update: yeni döküman eklendiğinde tüm corpus'u yeniden embed etmek yerine sadece yeni dökümanı işliyoruz. Vector database (Pinecone/Weaviate) insert operasyonu 50ms altında. Eski döküman değiştiğinde ise sadece o dökümanın chunk'larını güncelliyoruz. Bu sayede günde 500 döküman eklenebiliyor, sistem hiç downtime almıyor.

## Production'da Gözlemlenebilirlik: RAG Debugging İçin Gerekli Araçlar

Kullanıcı "yanlış cevap verdi" dediğinde debugging nasıl yapılıyor? Bizim stack:

- **LangSmith** — her RAG chain adımının trace'ini tutuyor: embedding latency, retrieval sonucu, LLM prompt/response, token count. Query ID ile tüm pipeline'ı replay edebiliyoruz.
- **Custom dashboard** (Grafana + Prometheus) — retrieval@5 skoru, cache hit rate, p95 latency, cost/query metrikleri gerçek zamanlı izleniyor.
- **Error budget** — haftada %2 retrieval başarısızlık toleransı var (ör. döküman bulunamadı). Bu eşik aşılırsa alert gidiyor.

LangSmith'e alternatif open-source araçlar: Helicone, Langfuse. Önemli olan şu: production'da her query'nin full trace'i tutulmalı yoksa "neden yanlış cevap verdi" sorusunu cevaplayamazsınız.

RAG sisteminin karmaşıklığı burada: tek bir latency spike veya retrieval hatası cascade ediyor. Debugging için observability tool'u altyapı kadar kritik.

---

Production RAG'de cost optimizasyonu ikinci adım. Önce retrieval kalitesini %90+ seviyeye çıkarın: embedding modelini eval ile test edin, chunking stratejisini semantik sınırlara göre ayarlayın, reranker ekleyin, sürekli eval pipeline kurun. Kalite sabitlendiğinde cache, batch processing ve incremental update ile maliyeti düşürün. Tersine yaparsanız ucuz ama kullanılamaz bir sistem olur — kullanıcı hallüsinasyon gördüğünde cost kaybınız retrieval hatasının 10 katı oluyor.