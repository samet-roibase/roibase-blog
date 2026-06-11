---
title: "Cross-Channel Orkestrasyon: Paid + Email + Push Atribüsyon"
description: "Identity graph, lifecycle event mapping ve hold-out gruplarla kanal katkısını ölçmek artık zorunlu. Cookie sonrası dönemde orkestrasyonu nasıl kuracaksınız?"
publishedAt: 2026-06-11
modifiedAt: 2026-06-11
category: marketing
i18nKey: marketing-007-2026-06
tags: [cross-channel-attribution, identity-graph, lifecycle-marketing, holdout-test, incrementality]
readingTime: 8
author: Roibase
---

Cookie üçüncü taraf verisi öldüğünde pazarlamacılar ilk olarak "atribüsyon modeli nasıl değişir" diye sordular. Asıl soru farklıydı: "Hangi kanal gerçekten ne kadar katkı sağlıyor, tüm touchpoint'leri aynı kullanıcıya nasıl bağlayacağız?" 2026'da cross-channel orkestrasyon bir entegrasyon problemi değil, identity ve incrementality problemi. Paid media, email ve push'u aynı user'a bağlayıp her birinin katkısını izole etmeden kampanya bütçesi dağıtmak artık mümkün değil. Bu yazıda identity graph, lifecycle event mapping ve hold-out grup tasarımıyla kanalları orkestrasyon altına almanın pratik mimarisini kuruyoruz.

## Identity Graph: Kullanıcıyı Kanal Boyunca Tanımlamak

Identity graph, aynı kullanıcının farklı kanallarda bıraktığı sinyalleri (email, device ID, cookie, hashed phone) tek bir profile bağlayan veri yapısıdır. Cross-channel orkestrasyonda ilk adım bu grafiği server-side kurmaktır çünkü client-side cookie artık cihaz ve tarayıcı arasında geçersiz.

Tipik bir graph yapısı şöyle görünür: `user_id` (merkez node), `email_hash`, `gclid`, `device_id_ios`, `device_id_android`, `utm_source=email`. Bu node'lar BigQuery veya Snowflake'te bir edge table olarak tutulur. Her olay (conversion, session_start, add_to_cart) bu node'lardan birine damgalanır ve resolve işlemi ile merkez user_id'ye bağlanır. Örneğin kullanıcı önce Google Ads'ten (gclid) gelir, sonra email'den (email_hash) tıklar, ardından mobil app'te (device_id) satın alır — hepsi aynı user_id altında birleşir.

Bu yapı için deterministic match (email, telefon gibi kesin eşleşme) ile probabilistic match'i (IP + user-agent + timestamp fuzzy logic) birleştirmek gerekir. Deterministic match %65-75 coverage verir, geri kalanı probabilistic model toplar. Ancak privacy: hashed PII (SHA-256) kullanarak GDPR/KVKK uyumu sağlamak ve consent management ile eşleştirmeyi sınırlamak zorunlu. Graph'ın her edge'i bir `consent_timestamp` taşımalı ve consent çekildiğinde o edge otomatik silinmeli.

Identity resolution sürekli çalışan bir pipeline gerektirir. Streaming (Kafka + Flink) veya batch (dbt + Airflow) ile her gün yeni sinyaller graph'a eklenir. Graph'ın doğruluğu match rate ve deduplication precision ile ölçülür: match rate > %80, dedup precision > %95 hedeflenmeli. Bu metrikler Looker veya Preset dashboard'unda her gün monitör edilmeli çünkü graph bozulduğunda tüm atribüsyon bozulur.

## Lifecycle Event Mapping: Kanal Katkısını Zamana Yaymak

Identity graph "kim" sorusunu çözünce sıradaki soru "hangi kanal ne zaman katkı yaptı". Lifecycle event mapping, her touchpoint'i kullanıcı journey'sinde anlamlı bir olaya bağlar: awareness, consideration, purchase, retention. Bu mapping sayesinde paid media'nın ilk temas, email'in re-engagement, push'un retention katkısını ayrıştırabilirsiniz.

Mapping için önce her kanalın native event'ini normalize etmelisiniz. Google Ads `first_open`, email `email_click`, push `notification_open` — bunlar GA4 veya CDP'nizde standard event'lere dönüştürülür: `session_start`, `add_to_cart`, `purchase`, `churn_risk`. Ardından her event'e lifecycle stage tag'i eklenir: `awareness`, `activation`, `revenue`, `retention`. Bu tag'ler SQL tablosunda `event_properties` JSON field'ında veya BigQuery'de STRUCT column'da saklanır.

Örnek senaryo: kullanıcı ilk kez Meta Ads'ten gelir (`awareness`), site'de gezinir ama satın almaz. 3 gün sonra email kampanyasından `add_to_cart` tetikler (`consideration`), ardından push notification ile `purchase` tamamlar (`revenue`). Bu senaryo şu SQL ile query edilir:

```sql
SELECT
  user_id,
  ARRAY_AGG(STRUCT(event_name, channel, timestamp, lifecycle_stage) ORDER BY timestamp) AS journey
FROM events
WHERE user_id = 'xyz'
  AND timestamp BETWEEN '2026-06-01' AND '2026-06-10'
GROUP BY user_id
```

Lifecycle mapping'in kritik noktası kanal overlap'idir. Aynı kullanıcı aynı gün hem email hem push alıyorsa hangisi conversion'a sebep oldu? Burada zaman penceresi kuralı devreye girer: son touchpoint öncesi 24 saat içinde hangi kanal event tetikledi, o önceliklendirilir. Ancak bu kural yeterli değil — incrementality ölçmeden kanal katkısını bilemezsiniz. İşte hold-out gruplar buraya girer.

## Hold-Out Gruplar: İncrementality'i Ölçmek

Hold-out grup (kontrol grubu), belirli bir kanaldan hiç mesaj almayan kullanıcı segmentidir. Bu grup sayesinde kanalın gerçek katkısını (incrementality) ölçersiniz: hold-out grubuyla treatment grup arasındaki conversion farkı, kanalın lift'idir. Cross-channel orkestrasyonda her kanal için ayrı hold-out grup tasarlamak zorunludur çünkü paid+email+push birbirini maskeleyebilir.

Tipik hold-out tasarımı: kullanıcı tabanının %10'unu email'den, %10'unu push'tan, %5'ini paid retargeting'ten çıkarın. Bu segmentler rastgele seçilmeli (randomization) ve en az 2 hafta boyunca sabit tutulmalı. Örneğin email hold-out grubu: `user_id % 10 = 0` gibi bir hash-based seçimle oluşturulur. Bu grup hiçbir email almaz ama paid ve push alır. Aynı şekilde push hold-out grubu email ve paid alır ama push almaz.

Incrementality hesaplaması basit bir fark testidir:

```
Lift = (Treatment Conversion Rate - Holdout Conversion Rate) / Holdout Conversion Rate
```

Örneğin email treatment grubu %3.5 conversion, hold-out %2.8 conversion veriyorsa lift = (3.5 - 2.8) / 2.8 = %25. Bu demektir ki email olmadan kullanıcıların %2.8'i zaten convert oluyordu, email sadece %0.7 puan ekledi. Bu %0.7 puan email'in gerçek katkısıdır (incremental conversion).

Hold-out grubun boyutu kritik: çok küçük (%1-2) = istatistiksel güç düşük, çok büyük (%20+) = fırsat kaybı yüksek. Optimum %5-10 arasıdır. Ayrıca hold-out her kanal için değişebilir: email gibi yüksek frekanslı kanalda %10, push gibi düşük frekanslı kanalda %5 yeterli. Hold-out'u BigQuery'de `user_segments` tablosunda saklayın ve her kampanya tetiklenirken bu tabloyu LEFT JOIN ile kontrol edin — segment match ederse mesaj gönderme.

## Multi-Touch Attribution: Kanal Skorlaması

Identity graph ve lifecycle mapping kurduktan sonra multi-touch attribution (MTA) modeli ile her kanalın toplam katkısını skorlayabilirsiniz. MTA, conversion path'indeki tüm touchpoint'lere ağırlık dağıtır. En yaygın model Shapley Value'dur: kooperatif oyun teorisinden gelir, her oyuncunun (kanal) marjinal katkısını ölçer.

Shapley hesaplaması matematiksel olarak karmaşıktır ama Python ile uygulanabilir. Alternatif olarak Google Analytics 4'ün data-driven attribution modeli zaten Shapley-benzeri bir algoritma kullanır. Ancak GA4 sadece Google ekosistemindeki kanalları görebilir (Ads, Organic, Display). Email ve push'u eklemek için custom event export (BigQuery + Looker Studio) veya CDP pipeline (Segment, mParticle) gerekir.

Pratik bir cross-channel skorlama örneği:

| Kanal | Touchpoint Sayısı | Shapley Score | Hold-Out Lift | Final Weight |
|---|---|---|---|---|
| Paid (Meta) | 1200 | 0.32 | %18 | 0.28 |
| Email | 3400 | 0.41 | %25 | 0.38 |
| Push | 2100 | 0.27 | %12 | 0.21 |
| Organic | 800 | — | — | 0.13 |

Bu tabloda Final Weight = (Shapley Score × 0.6) + (Hold-Out Lift normalized × 0.4). Yani hem path contribution hem de incrementality blend ediliyor. Böylece email'in path'te çok görünmesi ama gerçekte düşük lift vermesi dengelenir.

Skorlama sonucu budget allocation'a beslenir: email %38 ağırlık alıyorsa toplam pazarlama bütçesinin %38'i email'e tahsis edilir. Ancak bu statik değil — her ay hold-out test yenilenir ve Shapley score güncellenir. Bu döngü [Performans Pazarlaması](https://www.roibase.com.tr/tr/ppc) disiplini içinde sürekli çalışan bir feedback loop'tur.

## Orkestrasyon Altyapısı: CDP + Workflow Engine

Cross-channel orkestrasyonu manuel yönetemezsiniz. Customer Data Platform (CDP) veya workflow engine (Airflow, n8n, Braze) gerekir. CDP identity graph'ı tutar, segmentleri real-time günceller ve her kanala doğru zamanda mesaj gönderir. Workflow engine ise hold-out kontrol, event mapping ve attribution skorlamasını otomatize eder.

Tipik bir orkestrasyon stack:

- **Identity Resolution:** Segment Protocols, mParticle, RudderStack
- **Event Normalization:** dbt models, Fivetran transforms
- **Hold-Out Management:** BigQuery scheduled queries + Cloud Functions
- **Attribution:** Custom Python (Shapley) veya Rockerbox, Northbeam
- **Activation:** Braze, Iterable, Customer.io

Bu stack'in merkezinde BigQuery veya Snowflake olmalı çünkü tüm kanalların event data'sı orada birleşir. CDP sadece activation katmanıdır — veri temizliği ve attribution logic warehouse'da çalışır. Örneğin her gün saat 02:00'de Airflow DAG tetiklenir: yeni event'ler warehouse'a land eder, identity resolution çalışır, lifecycle stage update edilir, hold-out segmentler refresh edilir, Shapley score yeniden hesaplanır, sonuç Looker'a push edilir.

Orkestrasyon altyapısının performans hedefleri: event ingestion latency < 5 dakika, identity resolution batch < 1 saat, attribution refresh < 24 saat. Bu metrikler Datadog veya New Relic ile monitör edilmeli. Pipeline fail ederse (örneğin CDP API rate limit) fallback: son 24 saatlik veride karar ver, real-time yerine batch'e dön.

## Kaçınılacak Tuzaklar

**Tuzak 1: Over-attribution.** Her kanal kendi katkısını abartır çünkü conversion path'te görünür. Shapley bile yeterli değil — hold-out lift ile doğrulamadan kanal bütçesi dağıtırsanız email ve push bütçe yer, paid starve olur.

**Tuzak 2: Identity graph drift.** Graph zamanla hatalı edge'ler biriktirir (örneğin aynı device'ı iki user paylaşır). Dedup precision düşer, match rate sahte yükselir. Çözüm: her ay edge confidence score hesapla, %50'nin altındaki edge'leri sil.

**Tuzak 3: Hold-out'u kanal bazında ayırmamak.** Tek bir hold-out grup tüm kanallar için kullanılırsa çapraz etkiler ölçülmez. Email+push beraber lift verse bile tek başlarına lift vermiyor olabilir. Her kanal için ayrı hold-out gerekir.

**Tuzak 4: Lifecycle stage'leri manuel tag'lemek.** Event'leri elle tag'lerseniz scaling olmaz. Her event için rule-based veya ML-based classifier kur: `if add_to_cart AND first_time_user THEN lifecycle_stage = 'activation'`.

Cross-channel orkestrasyon bir kere kurulunca sürekli iterasyon gerektirir. Identity graph doğruluğu, hold-out lift trendi, Shapley score dağılımı — hepsi canlı metriklerdir. Bu metrikleri haftalık review etmeden kanallar arası senkronizasyon kaybolur ve budget waste artar. Orkestrasyon engineering değil, engineering + data science + ops üçlüsüdür. Şimdi sıra grafiği kurmakta, hold-out'u tasarlamakta ve lift'i ölçmekte.