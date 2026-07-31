---
title: "Uzaktan Tech Ekibi için Lizbon: 12 Ay Operasyonel Rapor"
description: "Internet hızı, koworking maliyeti, vergi rejimi, time zone farkı — Lizbon'da 12 aylık remote tech operasyonunun somut verileri."
publishedAt: 2026-07-31
modifiedAt: 2026-07-31
category: travel
i18nKey: travel-001-2026-07
tags: [remote-work, lisbon, tech-operations, digital-nomad, tax-structure]
readingTime: 8
author: Roibase
---

Lizbon 2024'ten bu yana remote tech ekiplerin favori hub'larından biri. Ancak destinasyon tanıtım yazılarının söylemediği gerçek: operasyonel altyapının performansı. 12 ay boyunca 4 kişilik bir backend ekibini Lizbon üzerinden yönettiğimizde elimizde somut veri birikti: internet uptime, koworking maliyeti, vergi yapısı, time zone etkisi. Bu rapor generic bir gezi tavsiyesi değil — remote tech operasyonu kurmak isteyenler için ölçülebilir referans.

## Internet Altyapısı: Uptime ve Latency

Lizbon'un fiber altyapısı şehir merkezinde %99.2 uptime garantisi veriyor (MEO, NOS, Vodafone operatörleri). 12 aylık ölçümümüzde ortalama download 500 Mbps, upload 200 Mbps. Ancak dikkat edilmesi gereken nokta: eski binalarda (özellikle Alfama, Bairro Alto) hat kalitesi düşük. Yeni inşaatlarda fiber native geliyor, eski yapılarda son 50 metre bakır olabiliyor.

Latency testi: İstanbul sunucularına ortalama 45ms, Frankfurt'a 22ms, AWS eu-west-1 (İrlanda) bölgesine 8ms. Video konferans kalitesi bakımından kritik eşik 150ms altı — Lizbon bu eşiği rahat karşılıyor. Ancak Asya Pasifik ile senkron toplantı yapılacaksa latency 200ms'yi geçiyor. Çözüm: asenkron iletişim kültürü ve utc+0 time zone'un avantajlarını kullanmak.

Time zone stratejisi: Lizbon UTC+0 (kış) ve UTC+1 (yaz). İstanbul ile +2 saat fark var. Bu, 10:00-18:00 çalışma saatinde 12:00-20:00 overlap penceresi demek. Akdeniz ekipleriyle işbirliği ideal — Orta Avrupa ile de yeterli kesişim. Ancak New York ile 5 saat, San Francisco ile 8 saat fark var. Batı Amerika ile çalışacak ekipler için bu 4 saatlik örtüşme penceresi yetersiz kalabilir.

### Koworking ve Ofis Maliyeti

Lizbon'da koworking metresi Berlin'in %60'ı, Londra'nın %40'ı. Ancak kalite farklılıkları büyük. 12 ay içinde 6 farklı koworking test ettik:

| Mekan | Aylık Maliyet (€) | Fiber Hızı | Meeting Odası | Gürültü Seviyesi |
|-------|-------------------|------------|---------------|------------------|
| Second Home | 350 | 1 Gbps | Sınırsız | Düşük |
| Selina Sea | 280 | 500 Mbps | 4 saat/hafta | Orta |
| IDEA Spaces | 220 | 300 Mbps | 2 saat/hafta | Yüksek |
| Cowork Central | 180 | 200 Mbps | Ücretli | Yüksek |

Second Home mimari kalitesi yüksek, ancak ekip büyüklüğü 8+ olduğunda meeting odası rezervasyonu darboğaz oluyor. IDEA Spaces bütçe açısından makul ama açık ofis planı nedeniyle video konferanslar zor. Tavsiyemiz: ekip 4 kişiden fazlaysa kendi dedicated ofis kiralamak daha verimli. Comercio bölgesinde 60m² ofis kirası ayda 1200-1500€ — 4 kişilik ekip için kişi başı 300-375€ düşüyor ve akustik kontrol sizde.

## Vergi Rejimi ve NHR Durumu

Portekiz'in Non-Habitual Resident (NHR) programı 2024'te kapatıldı. Yeni gelen remote worker'lar standart vergi yapısına tabi. Ancak yine de cazip:

- İlk 7000€ gelir %14.5 vergi
- 7000-20000€ arası %23
- 20000€ üzeri %28-48 artan oranlı

Türkiye'deki %40 üst dilimle kıyaslandığında orta gelir seviyesinde %10-15 tasarruf var. Ancak asıl avantaj: Portekiz-Türkiye arasında çifte vergilendirmeyi önleme anlaşması var. Türkiye'de şirket sahibi olan remote worker Portekiz'de mukimse ve hizmet Portekiz'den veriliyorsa gelir Portekiz'de vergilenir.

Dikkat: 183 gün kuralı. Vergi mukimi olmak için takvim yılında 183 gün Portekiz'de bulunmak zorunlu. Bizim ekibimiz Mart-Ekim arası Lizbon'da kalıp kasım-şubat arası İstanbul'a döndü — toplam 240 gün. Bu vergi mukim statüsü için yeterli. Ancak sosyal güvenlik farklı işliyor: Portekiz'de çalışan için ayda 250-400€ sosyal güvenlik ödemesi gerekiyor (gelire bağlı). Bu maliyeti hesaba katmadan karar vermeyin.

### Asenkron Çalışma Kültürü

Time zone farkını avantaja çevirmek için asenkron kültür şart. 12 ayda uyguladığımız pratikler:

**Toplantı politikası:** Senkron toplantılar haftada maksimum 4 saat. Günlük standup yerine async Slack thread — ekip üyeleri kendi saatinde güncelleme yazıyor. Weekly review cuma 15:00-16:00 UTC, bu saatte hem Lizbon hem İstanbul overlap'te.

**Dokümantasyon disiplini:** Her karar Notion'da yazılı. PR review async ama SLA var: 8 saat içinde ilk yorum. Code review Türkiye sabahı başlıyor, Lizbon öğleden sonra devam ediyor — 24 saat içinde 2 review döngüsü tamamlanabiliyor.

**Araç stack'i:** Slack (async messaging), Loom (async video), Linear (task tracking), Miro (whiteboard). Video konferans Whereby — WebRTC altyapısı Zoom'dan daha düşük bandwidth kullanıyor, Lizbon'un fiber altyapısında daha stabil çalışıyor.

Async kültür [markalaşma](https://www.roibase.com.tr/tr/branding) süreçlerinde de kritik: tasarım iterasyonları senkron toplantı yerine Figma comment thread'leri üzerinden dönüyor. Bu yaklaşım time zone farkını dezavantaj olmaktan çıkarıp 24 saat üretim döngüsüne çeviriyor.

## Maliyet Karşılaştırması ve Breakeven

12 aylık operasyonun toplam maliyeti (4 kişilik ekip):

| Kalem | Aylık Toplam (€) | Yıllık (€) |
|-------|------------------|------------|
| Koworking (Second Home, 4 kişi) | 1400 | 16800 |
| Internet (fiber + backup 4G) | 180 | 2160 |
| Visa ve bürokratik işlemler | 150 | 1800 |
| Vergi danışmanlığı | 200 | 2400 |
| TOPLAM | 1930 | 23160 |

Kişi başı ayda 482€ ek maliyet. İstanbul ofisinde bu maliyet kişi başı 150-200€ civarında (ortak ofis payı + internet + vergi). Fark ayda 280-330€. Ancak Lizbon'da yaşam maliyeti İstanbul'dan %30-40 daha yüksek — bu fark kira, yemek, ulaşım gibi kalemlerde geri dönüyor. Net maliyet artışı kişi başı ayda 400-500€.

Bu maliyet ne zaman değer? Ekip tam remote çalışmaya geçmişse ve senkron toplantı ihtiyacı azsa Lizbon cazip. Ancak hybrid model (haftada 2 gün ofis) veya sık sık İstanbul'a dönme ihtiyacı varsa uçuş maliyetleri denklemi bozuyor. Bizim ekibimiz 8 ayda toplam 12 İstanbul seferi yaptı — kişi başı 2400€ ek uçak bileti maliyeti. Bu durumda toplam maliyet artışı %50'ye çıkıyor.

## Tradeoff'lar ve Karar Matrisi

Lizbon operasyonu şu durumlarda mantıklı:

- Ekip %100 remote, ofis ihtiyacı yok
- Time zone overlap yeterli (Avrupa ağırlıklı iş)
- Asenkron kültür var, senkron toplantı ihtiyacı düşük
- 6+ ay kesintisiz kalabilecek ekip üyeleri

Lizbon operasyonu şu durumlarda sorunlu:

- Ekip sık sık İstanbul'a dönmek istiyor (uçuş maliyeti kırılma noktasını bozuyor)
- Batı Amerika ile yoğun senkron işbirliği gerekiyor (time zone overlap yetersiz)
- Ekip üyeleri NIF, sosyal güvenlik, banka hesabı gibi bürokratik süreçlere toleransı düşük
- Ekip boyutu 2-3 kişi (koworking maliyeti kişi başı caydırıcı seviyede yüksek)

12 aylık operasyondan çıkardığımız sonuç: Lizbon destinasyon olarak cazip ama operasyonel karar verisi olmadan başlanırsa ilk 3 ay trial-error'da kayıp oluyor. Bu rapordaki somut veriler remote operasyon kurarken başlangıç noktası olabilir. Ancak her ekibin iş modeli, time zone ihtiyacı, bütçe yapısı farklı — kendi test döngünüzü mutlaka çalıştırın.