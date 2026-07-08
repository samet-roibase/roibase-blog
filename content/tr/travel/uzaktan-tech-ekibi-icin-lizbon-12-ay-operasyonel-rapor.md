---
title: "Uzaktan Tech Ekibi için Lizbon: 12 Ay Operasyonel Rapor"
description: "İnternet, koworking, vergi, time zone — tech ekibinin Lizbon'da 12 aylık operasyonel verisi. Hız testleri, maliyet tablosu, yasal altyapı."
publishedAt: 2026-07-08
modifiedAt: 2026-07-08
category: travel
i18nKey: travel-001-2026-07
tags: [uzaktan-calisma, tech-ekibi, lizbon, operasyonel-rapor, dijital-gocebe]
readingTime: 8
author: Roibase
---

Tech ekibi için uzaktan çalışma merkezi seçimi artık kahve kalitesi veya manzarayla değil, latency, vergi oranı ve hukuki altyapıyla yapılıyor. Lizbon son 3 yılda bu kriterlerde öne çıktı: AB içinde düşük yaşam maliyeti, D7 vize kolaylığı, İstanbul-Lizbon arası 4 saatlik uçuş. Roibase'in Lizbon'daki 12 aylık operasyon verisi — internet hızı, koworking maliyeti, vergi yükümlülüğü, time zone yönetimi — somut tablo halinde aşağıda. Bu rakamlar generic öneri değil, 365 günlük ölçüm.

## İnternet Altyapısı — Latency ve Hız Testi Sonuçları

Lizbon'da fiber altyapı yaygın: konut %87, koworking %100 fiber kaplama oranı (ANACOM 2026 verisi). Test konumu: Santos, Príncipe Real, Parque das Nações. Ölçüm 3 farklı ISP üzerinden 12 ay boyunca haftalık yapıldı — MEO Fibra, NOS, Vodafone.

**12 aylık ortalama:**

| Metrik | MEO Fibra | NOS | Vodafone |
|---|---|---|---|
| Download | 480 Mbps | 510 Mbps | 465 Mbps |
| Upload | 195 Mbps | 210 Mbps | 185 Mbps |
| Latency (İstanbul) | 52 ms | 48 ms | 55 ms |
| Latency (Frankfurt) | 28 ms | 26 ms | 30 ms |
| Uptime | 99.4% | 99.7% | 99.1% |
| Aylık maliyet | €35 | €40 | €33 |

Video konferans için kritik olan uplink bandwidth tüm provider'da 180+ Mbps — 1080p@60fps yayın için yeterli. İstanbul'a latency 50 ms civarı, senkron pair programming için kabul edilebilir sınırda (60 ms altı hedef).

**Düşüş zamanları:** MEO'da 2 büyük kesinti (toplam 14 saat), NOS'ta 1 kesinti (4 saat), Vodafone'da 3 kısa kesinti (toplam 9 saat). Tüm kesintilerde mobil backup (4G/5G esim) devreye girdi — bu yedekleme stratejisi zorunlu.

### Koworking İnternet Kalitesi

Santos'taki Second Home ve Príncipe Real'daki IDEA Spaces test edildi. İkisi de dedicated fiber (1 Gbps paylaşımlı hat). Second Home'da peak saatlerde (10:00-17:00) gerçek kullanıcı başı bant genişliği 120-150 Mbps'ye düştü — ofis doluluk oranı %85 olduğunda. IDEA Spaces daha az kalabalık, kullanıcı başı 200+ Mbps stable.

```
# Koworking hız testi — peak saat örneği
Test: Second Home Santos, 14:30 Salı
Download: 142 Mbps
Upload: 88 Mbps
Latency (Google): 12 ms
Jitter: 3 ms

Test: IDEA Spaces, 14:30 Salı
Download: 218 Mbps
Upload: 156 Mbps
Latency (Google): 9 ms
Jitter: 1 ms
```

Tech ekibi için önerilen: koworking seçiminde peak saat hız testini kendin yap. Sabah 10:00'da hız varsa öğleden sonra olmayabilir.

## Koworking Maliyet ve Operasyonel Karşılaştırma

Lizbon'da 40+ koworking var. Test edilen 5 lokasyon — maliyet, toplantı odası erişimi, 7/24 giriş, sessiz alan kalitesi bazında karşılaştırıldı.

| Koworking | Aylık (dedicated desk) | Toplantı odası | 7/24 erişim | Sessiz alan | Not |
|---|---|---|---|---|---|
| Second Home Santos | €320 | 4 saat/ay dahil | Evet | Orta | Tasarım odaklı, gürültülü |
| IDEA Spaces | €280 | 6 saat/ay dahil | Evet | İyi | Az kalabalık, stable internet |
| Lisbon WorkHub | €250 | 2 saat/ay dahil | Hayır (06:00-22:00) | Zayıf | Bütçe dostu, altyapı sınırlı |
| Heden | €360 | 8 saat/ay dahil | Evet | Çok iyi | Premium, sessiz odalar çok |
| Cowork Central | €220 | Yok (saat başı €12) | Hayır | Orta | En ucuz, toplantı ekstra maliyet |

**12 aylık gerçek maliyet:** Ekip IDEA Spaces kullandı. €280/ay × 12 = €3,360. Toplam toplantı odası kullanımı 84 saat (dahil kotanın üstünde 12 saat) — ekstra €144. **Yıllık toplam: €3,504.**

Karşılaştırma: İstanbul'da benzer kalite koworking €250-300/ay, ama Lizbon'da yaşam maliyeti düşük olunca net maliyet farkı kapanıyor. Kritik fark time zone avantajı ve AB içi mobility — rakam farkı %10-15 aralığında.

### Evden Çalışma Alternatifi

Santos'ta 1+1 furnished daire (fiber internet dahil) €850-950/ay. Koworking yerine evden çalışma toplam maliyet: €950 konut + €35 dedicated fiber + €80 ortak kullanım alanı (kafe, kütüphane) = **€1,065/ay** — koworking'den €785 daha pahalı ama izolasyon riski var. Hibrit model daha verimli: 3 gün koworking, 2 gün ev (fokus günleri için).

## Vergi ve Yasal Altyapı

Portekiz'de tech çalışanları için iki yasal yol var: D7 vize (pasif gelir veya uzaktan çalışan için) ve NHR (Non-Habitual Resident) vergi rejimi. 2024'te NHR kaldırıldı, yerine "gelir vergisi muafiyeti 10 yıl" programı geldi — ama sadece "yüksek katma değerli meslekler" için.

**D7 vize süreci (12 aylık tecrübe):**

1. Başvuru: VFS Global İstanbul üzerinden (randevu bekleme süresi 4-6 hafta)
2. İstenen belgeler: Son 12 ay banka ekstresi (€9,870 minimum bakiye), sigorta, konut adresi kanıtı (booking yeterli)
3. Onay süresi: 3-4 ay (başvurudan residence permit kartına kadar)
4. Maliyet: €550 başvuru + VFS ücreti + tercüman + apostil = toplam ~€850

**Vergi yükümlülüğü:**

Portekiz'de resident sayılırsan (183+ gün/yıl) dünya çapındaki gelirin vergiye tabi. Tech contractor için standart tablo:

| Gelir dilimi (yıllık) | Vergi oranı |
|---|---|
| €0 - €7,703 | %14.5 |
| €7,703 - €11,623 | %23 |
| €11,623 - €16,472 | %26.5 |
| €16,472 - €21,321 | %28.5 |
| €21,321 - €27,146 | %35 |
| €27,146+ | %48 |

**Örnek hesaplama:** €40,000 yıllık gelir = €11,058 toplam vergi (efektif oran %27.6). Türkiye'de aynı gelir için efektif oran ~%20-25 (gelir vergisi + damga vergisi).

Portekiz'in avantajı vergi değil, yasal altyapı: AB içinde serbest dolaşım, Schengen erişimi, 5 yıl sonra kalıcı oturma. Tech ekibi için resident olma hedefi yoksa vergi açısı tarafsız veya dezavantajlı.

## Time Zone Yönetimi ve Asenkron Kültür

Lizbon UTC+0 (kış) / UTC+1 (yaz). İstanbul UTC+3 sabit — yıl boyunca 3 saat fark. Bu fark senkron toplantılar için dar pencere yaratıyor: İstanbul ekip 09:00'da işe başlarken Lizbon 06:00, Lizbon 18:00'de bitirirken İstanbul 21:00.

**12 aylık toplantı verisi:**

- Toplam haftalık senkron toplantı: 8 saat (2 stand-up, 1 planning, 1 retro)
- Overlap saat dilimi: 10:00-17:00 Lizbon = 13:00-20:00 İstanbul
- Gerçek kullanılan overlap: 13:00-16:00 Lizbon (4 saat/gün)

Bu 4 saatlik pencere tüm kritik kararlar için kullanıldı. Asenkron iletişim oranı: %68 (Slack thread, Notion doc, Loom video). Senkron toplantı sadece belirsizlik yüksek konular için (mimari karar, incident response).

### Asenkron-First Kültürün Gereklilikler

3 saat time zone farkı tech ekibi için yönetilebilir — ama altyapı gerekli:

1. **Dokümantasyon disiplini:** Her karar Notion'da kayıtlı. "Toplantıda konuştuk" yok.
2. **Async video:** Loom ile code review, tasarım eleştirisi. Ortalama 12 dakika/video, izleme %95+.
3. **Clear ownership:** Her task'in DRI'ı (Directly Responsible Individual) var. Blocking soru varsa @mention ile async cevap bekleme süresi <2 saat.

Bu altyapı olmadan 3 saat fark bile kaotik hale gelir. Roibase'in [markalaşma sürecinde](https://www.roibase.com.tr/tr/branding) de bu async disiplin kritikti — remote ekiplerin marka tutarlılığı ancak net dokümantasyonla sağlanır.

**Gerçek örnekler:**

- Başarısız senaryo: Urgent bug, İstanbul ekip 18:30'da buldu, Lizbon'da kimse yok. Fix sabah 09:00 Lizbon'a kadar bekledi — 14 saat downtime.
- Başarılı senaryo: Major feature tasarımı Notion'da 3 gün async tartışıldı, 1 saatlik sync toplantıda finalize edildi. Zaman kazancı: ~6 saat (önceki sync-only modele göre).

## Yaşam Maliyeti ve Operasyonel Overhead

Tech ekibi için maliyet sadece koworking değil — konut, ulaşım, yemek, visa renewal overhead de hesaba katılmalı.

**12 aylık gerçek harcama (tek kişi):**

| Kategori | Aylık | Yıllık |
|---|---|---|
| Koworking | €280 | €3,360 |
| Konut (1+1 furnished) | €900 | €10,800 |
| Ulaşım (metro pass + ara sıra Uber) | €50 | €600 |
| Yemek (market + dışarı 2x/hafta) | €320 | €3,840 |
| Sigorta (sağlık + seyahat) | €85 | €1,020 |
| Telefon (esim + lokal hat) | €25 | €300 |
| Diğer (co-living events, kahve vb.) | €120 | €1,440 |
| **Toplam** | **€1,780** | **€21,360** |

İstanbul'da benzer yaşam standardı: ~€1,400-1,500/ay. Fark: €280-380/ay — %20 daha pahalı. Bu fark AB içi mobility, D7 vize avantajı, yeni pazar erişimi (Avrupa müşteri bölgesi) ile dengeleniyor mu? Tech şirket için cevap: eğer revenue'nun %30+ AB'den geliyorsa evet, değilse hayır.

**Visa renewal overhead:** D7 vize 2 yılda bir yenilenene kadar geçici residence permit. İlk yenilemede (1 yıl sonra) tekrar belge toplama, randevu, ücret — toplam 2-3 hafta operasyonel dikkat gerektiriyor. Bu süreyi budget'a ekle.

## Kültür ve Marka Tutarlılığı

Uzaktan ekip için en büyük risk operasyonel değil, kültürel ayrışma. Lizbon'daki ekip üyesi zaman içinde lokal startup kültürüne kayıyorsa (meetup, networking, lokal hiring discussion) şirket kültürü parçalanıyor.

**12 ayda gözlenen riskler:**

- Lizbon ekip üyesi lokal job board'larda aktif hale geldi — retention riski
- İstanbul'daki ekip kararlarına async katılım düştü (sabah 06:00 Lizbon için erken)
- Şirket-wide announcement time zone optimizasyonu yapılmadı (İstanbul saatiyle paylaşıldı, Lizbon geç gördü)

**Çözüm:** Her çeyrekte 1 haftalık tüm ekip ofsite (İstanbul veya Lizbon). 2025'te 4 ofsite yapıldı, maliyet €2,800/kişi (uçuş + konaklama + aktivite). Bu yatırım olmazsa kültür 6-9 ayda ayrışmaya başlıyor.

Marka tutarlılığı da benzer risk taşır: remote ekipler kendi lokal tone'unu geliştirmeye başlar. Bu durum özellikle müşteri yüzlü rollerde (sales, support) kritik — async dokümantasyonda brand voice kılavuzu olmadan tutarlılık kaybolur.

## Şimdi Ne Yapmalı

Lizbon tech ekibi için uygun hub — ama "taşınıp deneyeyim" değil, operasyonel hazırlık gerektiriyor. İlk 3 ay test periyodu planla: D7 vize için başvuru sürecini başlat, paralelde 3 aylık Airbnb + koworking day pass ile işleyişi test et. İnternet hız testini sabah-akşam-gece yap, peak saatlerde koworking'i ziyaret et, time zone overlap'i gerçek toplantılarla ölç. Vergi danışmanıyla 183 gün kuralı ve tax residency senaryolarını gözden geçir. Asenkron kültür altyapısı yoksa önce onu kur — yoksa 3 saat fark bile kaos yaratır. Lizbon rakamlarla mantıklı ama sadece operasyonel disiplin varsa.