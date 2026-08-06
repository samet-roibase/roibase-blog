---
title: "Cross-Channel Orkestrasyon: Paid + Email + Push Atribüsyon"
description: "Identity graph, lifecycle event mapping ve hold-out gruplarla kanallararası performans ölçümünü mühendislik disiplinine bağlamak."
publishedAt: 2026-08-06
modifiedAt: 2026-08-06
category: marketing
i18nKey: marketing-007-2026-08
tags: [cross-channel-attribution, identity-graph, lifecycle-marketing, hold-out-testing, incrementality]
readingTime: 8
author: Roibase
---

Paid media bütçesinin yarısı email'e, email'in yarısı push'a kanıyor — ama hangi yarı? Cross-channel orkestrasyon sorunu 2026'da artık kanal performans raporu okumakla çözülmüyor. Google Ads dashboard'u ROAS 4.2 gösterirken, email ekibi son kampanyadan %18 conversion artışı raporluyor. Aynı kullanıcı her iki kanala da maruz kaldıysa, hangisi tetikleyici? Bu soruya "last-touch" veya "multi-touch modeli" diyerek yaklaşmak artık yeterli değil. Identity graph üzerine kurulu, lifecycle event mapping ve hold-out gruplarla doğrulanmış bir atribüsyon altyapısı gerekiyor.

## Identity Graph: Kanal Değil Kişi Odağı

Cross-channel orkestrasyon için önce "kim" sorusunu çözmek zorundasın. Paid mediadaki `GCLID`, email'deki `user_id`, push notification'daki `device_token` — her kanal farklı identifier üretiyor. Identity graph bu parçaları tek bir kişiye birleştiren veri yapısı. BigQuery veya Snowflake üzerinde düğüm-tabanlı tablo tasarımı: bir düğüm kullanıcı, kenarlar tanımlayıcılar arası ilişki.

Tipik bir graph yapısı şöyle: `user_123` düğümüne `email:user@domain.com`, `device_token:abc123`, `gclid:xyz789` kenarları bağlı. Bu yapıyı kurmak için oturum bazlı identifier merge gerekiyor. Kullanıcı email giriş yaptığında `user_id` + `device_token` eşleşmesi yazılır. Paid mediadaki tıklama `GCLID`'yi session cookie'ye taşırsan, conversion event'i bu üçlüyü birleştirir. CDP (Customer Data Platform) kullanıyorsan Segment veya mParticle bu merge işlemini native yapıyor. Kendi stack'in varsa dbt üzerinde daily snapshot model'i yeterli:

```sql
WITH user_edges AS (
  SELECT user_id, email, device_token, gclid, session_timestamp
  FROM events
  WHERE user_id IS NOT NULL AND (email IS NOT NULL OR device_token IS NOT NULL)
),
merged_graph AS (
  SELECT DISTINCT user_id,
         FIRST_VALUE(email) OVER (PARTITION BY user_id ORDER BY session_timestamp) AS primary_email,
         FIRST_VALUE(device_token) OVER (PARTITION BY user_id ORDER BY session_timestamp DESC) AS latest_device
  FROM user_edges
)
SELECT * FROM merged_graph;
```

Bu graph'ı production'a atmadan önce deduplication hata oranını ölç. Eğer %5'in üzerinde çakışma varsa (aynı device_token iki farklı user_id'ye bağlanıyorsa), identifier kaliteni gözden geçir. Identity resolution %95 accuracy altındaysa atribüsyon sonuçları güvenilmez.

## Lifecycle Event Mapping: Kanal Sırası ve Zamanlama

Identity graph kim olduğunu söyler, lifecycle event mapping ne zaman hangi kanalda ne olduğunu söyler. Cross-channel atribüsyon için kullanıcının journey'sindeki her touchpoint'i zaman damgalı event olarak kaydet. Örnek event tablosu:

| user_id | event_type | channel | timestamp | campaign_id | revenue |
|---------|------------|---------|-----------|-------------|---------|
| user_123 | ad_click | google_ads | 2026-08-01 10:15 | camp_A | null |
| user_123 | email_open | klaviyo | 2026-08-02 09:00 | email_B | null |
| user_123 | push_click | onesignal | 2026-08-03 14:30 | push_C | null |
| user_123 | purchase | web | 2026-08-03 15:00 | null | 120 |

Bu tabloyu oluşturmak için server-side tracking zorunlu. Client-side pixel'ler third-party cookie kaybıyla % 40-60 event kaybına yol açıyor (Chrome Privacy Sandbox raporlarına göre 2025'te ortalama %52). [Dijital Pazarlama](https://www.roibase.com.tr/tr/dijitalpazarlama) altyapısında server-side GTM + first-party cookie ile event loss %5'in altına düşer.

Lifecycle event mapping ile şu analizleri yaparsın:

1. **Time-to-conversion by channel sequence:** "Google Ads → Email → Purchase" path'i ortalama 48 saat sürüyorsa, "Email → Push → Purchase" 12 saatte tamamlanıyorsa, push'ın conversion hızlandırma rolü var.

2. **Channel overlap matrix:** Kaç kullanıcı aynı gün hem paid ad hem email'e maruz kalıyor? Overlap %30'u geçiyorsa, kampanya timing koordinasyonu gerekiyor.

3. **Drop-off noktası analizi:** Email'den push'a geçişte %60 drop-off varsa, push permission rate'i düşük demektir.

Bu analizleri Python pandas veya SQL window function'larıyla yap. BigQuery'de `LAG()` function ile bir önceki event'i aynı satıra getirip channel transition matrisini çıkarabilirsin.

## Hold-Out Gruplar: İncrementality Kanıtı

Cross-channel atribüsyon modelinin söylediği ile gerçek incrementality arasında fark vardır. Model "paid media son 7 gün içindeki conversion'ların %40'ına katkıda bulundu" diyebilir — ama o kullanıcılar paid medya olmasaydı da satın alır mıydı? Bu soruyu cevaplamak için hold-out grup testi gerekiyor.

Hold-out tasarımı: Toplam audience'i rastgele ikiye böl. Bir grup (treatment) tüm kanallara maruz kalır, diğer grup (hold-out) belirli bir kanaldan hariç tutulur. Örneğin paid media incrementality'sini test ediyorsan, hold-out grubu Google Ads remarketing listesinden çıkar, email ve push'u normal yolla al. 14-30 gün sonra iki grup arasındaki conversion rate farkı senin gerçek lift'in.

Tipik bir test kurulumu:

- **Treatment grubu:** 50,000 kullanıcı, paid + email + push
- **Hold-out grubu:** 50,000 kullanıcı, email + push (paid hariç)
- **Süre:** 21 gün
- **Ölçülen metrik:** Conversion rate, revenue per user

Eğer treatment conversion rate %3.2, hold-out %2.8 ise, paid media gerçek lift'i %0.4 puan (14% relative lift). Atribüsyon modelin paid'e %40 kredi veriyorsa ama gerçek lift %14 ise, model overestimate ediyor demektir.

Hold-out testinin başarısı için:

- **Rastgele atama zorunlu:** User ID'nin son basamağına göre bölme gibi deterministik yöntemler sampling bias yaratır.
- **Sample size yeterli olmalı:** A/B test calculator'da %95 confidence, %80 power için minimum 10,000 kullanıcı/grup gerekir.
- **Test süresini sezonalite ile hizala:** Black Friday öncesi başlatırsan sonuçlar왜곡enir.

## Orkestrasyon Engine: Karar Mekanizması

Identity graph + lifecycle event + hold-out sonuçlarını birleştirince ortada bir karar motoru kurmak kalıyor. Bu motor "kullanıcı X şu an hangi kanaldan mesaj almalı?" sorusunu cevaplıyor. Basit bir rule-based engine bile büyük fark yaratır:

```python
def next_channel(user_id, event_history):
    last_event = event_history[-1]
    hours_since_last = (now - last_event.timestamp).hours
    
    if last_event.channel == 'google_ads' and hours_since_last < 24:
        return 'email'  # Paid'den sonra email ile sıcak tutma
    elif last_event.channel == 'email' and last_event.event_type == 'open' and hours_since_last < 6:
        return 'push'  # Email açan kullanıcıya hızlı push
    elif hours_since_last > 72:
        return 'paid'  # 3 gün aktivite yok, remarketing
    else:
        return None  # Bekle
```

Production sistemlerde bu logic Airflow DAG'i veya real-time event processor (Kafka + Flink) olarak çalışır. Kullanıcı bir event tetiklediğinde sistem son 7 günlük event history'yi çeker, incrementality skorunu ekler (hold-out testinden gelen channel efficiency), sonraki en optimal kanalı seçer.

Gelişmiş orkestrasyon için machine learning modeli entegre edebilirsin: LightGBM ile "kullanıcı X'e Y kanalından Z zamanında mesaj gönderince conversion olasılığı nedir?" tahmini yap. Feature'lar: user segment, last_interaction_channel, days_since_signup, average_order_value, channel_overlap_count. Model çıktısı channel priority score olur, en yüksek skoru seç.

## Trade-Off: Koordinasyon ile Hız

Cross-channel orkestrasyon tam otomatikleştiğinde bir yan etki ortaya çıkar: kanal takımları özerk karar veremez hale gelir. Email ekibi "yarın kampanya gönderelim" dediğinde orkestrasyon engine "hayır, bu kullanıcılar 2 gün önce paid medyaya maruz kaldı, 48 saat bekle" diyebilir. Bu koordinasyon theorik olarak doğru ama operasyonel esnekliği kırar.

Trade-off'u yönetmek için:

1. **Kanal takımlarına override yetkisi ver:** Kritik kampanyalarda (product launch, flash sale) manual override ile orkestrasyon kuralını ezer.
2. **Test window'ları tanımla:** Her ayın ilk haftası "free-for-all" yap, takımlar bağımsız test yapsın. Geri kalan 3 hafta orkestrasyon devrede.
3. **Incrementality dashboard'u paylaş:** Kanal sahipleri kendi contribution'ını canlı görsün, güven oluşsun.

Koordinasyon maliyeti de hesaba kat. Orkestrasyon engine kurulumu ortalama 8-12 hafta (identity graph + event pipeline + hold-out infra + karar motoru). Küçük ekiplerde bu yatırım return süresi 6-9 ay. Eğer yıllık pazarlama bütçen $500K altındaysa, tam orkestrasyon yerine basit channel sequencing (paid → email → push sıralaması) yeterli olabilir.

---

Cross-channel orkestrasyon artık opsiyonel değil. Identity graph'ı kurmazsan aynı kullanıcıyı 3 kez farklı kanalda sayıyor, efficiency yanılsamasına düşüyorsun. Lifecycle event mapping olmadan hangi sıranın çalıştığını bilemiyorsun. Hold-out grupları koşmadan atribüsyon modelinin overestimate ettiğini fark edemiyorsun. 2026'da kanal siled'i kırıp kişi-bazlı orkestrasyona geçen ekipler CAC'i %20-30 düşürüyor, LTV %15-25 artırıyor. Senin stack'in hazır mı?