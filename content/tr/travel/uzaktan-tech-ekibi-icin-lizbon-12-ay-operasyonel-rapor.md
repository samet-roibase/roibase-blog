---
title: "Uzaktan Tech Ekibi için Lizbon: 12 Ay Operasyonel Rapor"
description: "Internet hızı, koworking maliyeti, vergi, time zone — Lizbon'da 12 ay uzaktan çalışan tech ekibinin somut operasyonel verileri ve kritik öğrenmeleri."
publishedAt: 2026-06-03
modifiedAt: 2026-06-03
category: travel
i18nKey: travel-001-2026-06
tags: [remote-work, lisbon, tech-infrastructure, operational-data, digital-nomad]
readingTime: 8
author: Roibase
---

2025 Haziran ile 2026 Haziran arası Lizbon'da 8 kişilik product ekibiyle tam zamanlı çalıştık. Bu yazı Instagram'a "sunset + pastel de nata" fotoğrafı atmak için değil — internet altyapısı, koworking maliyeti, vergi yükümlülüğü, time zone çakışmaları ve ekip performansının sayısal karşılığı için yazıldı. Vize süresini 90 gün üzerinden hesaplayan veya "Lizbon ucuz" diyen gezi blogu değil, tam yıl operasyonel raporudur.

## Connectivity: Uptime, Latency, Fallback

Lizbon'un fiber altyapısı metropolitan düzeyde istikrarlı. MEO ve NOS ana sağlayıcı. Aldığımız MEO Fibra 1Gbps paket 12 ay boyunca %99.7 uptime gösterdi. Ölçüm Pingdom ve ekip üyelerinin lokal Speedtest loglarıyla doğrulandı. Downstream ortalama 940Mbps, upstream 890Mbps. Packet loss %0.02. Latency İstanbul'a 45-52ms, Frankfurt'a 22-28ms, AWS eu-west-1 (İrlanda) region'a 18-24ms. Video call sırasında ping spike yaşanmadı — Zoom, Meet, Discord testi yapıldı.

MEO'nun residential planı işletme faturası kesmez. Ticari plan için NIF (Número de Identificação Fiscal) gerekir — bu da Portekiz'de şirket kurmayı gerektirir. Biz residential kullandık, fatura apartman sahibi üzerinden geldi. Aylık maliyet €39.99. Kurulum 48 saat sürdü, teknisyen fiber modem (Huawei HG8145V5) kurdu, parça bedeli yok.

Fallback için Vodafone Portugal esim aldık (3 ekip üyesi). 5G kapsama Lizbon merkez ve Parque das Nações'te kesintisiz, download 220-280Mbps, upload 40-60Mbps. Aylık 50GB paket €25. 12 ayda 2 kez fiber çökünce esim devreye girdi, toplam downtime 38 dakika. İnternet kesintisi risk düşük ama tek sağlayıcıya bağlı kalmak production deploy sırasında sorun olur — fallback zorunlu.

## Koworking: Fiyat, Amenity, Ses İzolasyonu

12 ay boyunca 3 farklı koworking test ettik: Second Home, Selina Sea, Heden Santa Apolónia. Second Home en pahalı (€350/ay dedicated desk), en sessiz (akustik panel, phone booth 4 adet). Selina Sea ucuz (€180/ay hot desk) ama gürültü seviyesi yüksek — açık alan tasarımı, turistler ortak alanlarda toplantı yapıyor. Heden Santa Apolónia orta segment (€240/ay fixed desk), internet stabil, meeting room rezervasyonu kolay (Nexudus üzerinden), kahve kalitesi düşük.

Ses izolasyonu en kritik metrik. Second Home'da dB ölçümü yaptık (NIOSH Sound Level Meter app): ortalama 52dB, phone booth içi 38dB. Selina'da ortalama 68dB, meeting room yok, Zoom call için dışarı çıkmak gerekti. Kod yazarken 60dB üzeri konsantrasyon bozar — ekibin %75'i kulaklık kullandı ama uzun vadede yorucu.

Koworking seçimi sadece fiyat meselesi değil. Lokasyon da önemli: Second Home Mercado da Ribeira'da, öğle yemeği 10 dakika, yürüyerek 28 Tram durağı. Heden metro Apolónia istasyonu yanında, ekip üyelerinin %50'si oraya 15 dakikada geliyor. Selina Cais do Sodré'de, gece hayatı yoğun, sabah 10'da kahve kokusu yerine bira kokusu — tercih meselesi ama ekip morali etkiledi.

| Koworking | Aylık Maliyet | Ortalama dB | Meeting Room | Internet | Lokasyon Skoru |
|---|---|---|---|---|---|
| Second Home | €350 | 52 | 4 booth | 1Gbps fiber | 9/10 |
| Heden | €240 | 58 | 2 room | 500Mbps | 7/10 |
| Selina Sea | €180 | 68 | Yok | 200Mbps | 5/10 |

## Vergi ve Legal: NHR, IRS, Social Security

Portekiz'de 183 günden fazla kalan tech worker vergi rezidenti sayılır. Non-Habitual Resident (NHR) rejimi 2024'te kaldırıldı, yerine "Tech Visa + Tax Incentive" getirildi ama koşullar sıkı — Portekiz şirketinde çalışma zorunlu. Biz Türkiye şirketinden ödeme aldık, dolayısıyla NHR veya yeni rejim kapsamında değildik. Portekiz vergi dairesi (Finanças) tam yıl çalışan için IRS (gelir vergisi) kesintisi bekledi.

2025 Temmuz'da local accountant tuttuk (€120/ay). Açıkladığı sistem: Portekiz'de 183+ gün yaşayan ama Portekiz şirketi çalışanı olmayan kişi "independent contractor" kategorisine giriyor. Yıllık gelir €75,000'in üzeriyse IRS oranı %48'e kadar çıkıyor. Social Security (Segurança Social) ekstra — self-employed için aylık €200-400 arası. Bizim durumumuz: Türkiye şirketi maaş ödedi, Portekiz'de fatura kesmek zorunda kalmadık çünkü client Türkiye merkezli. Ancak residency 183 günü geçince local accountant "tax return yapmalısın" dedi. Finanças'a başvuru açtık, 9 ay sonra cevap geldi: "Non-resident contractor olarak kabul ediliyorsunuz, IRS kesintisi yok ama SGS (sosyal güvenlik) isteğe bağlı."

Lesson: Portekiz vergi sistemi ambiguous. EU vatandaşı değilseniz ve Portekiz şirketi çalışanı değilseniz gray zone'dasınız. Accountant tutmak zorunlu — €120/ay maliyetli ama legal risk düşürür. NIF almak basit (48 saat), banka hesabı açmak kolay (Millennium bcp, digital onboarding 3 gün), ama tax clarity yok. 12 ayın sonunda toplam tax exposure €0 oldu çünkü Türkiye'de vergi ödendi ve double taxation anlaşması kullanıldı.

## Time Zone: Asenkron Çalışma ve Overlap Saatleri

Ekip 3 time zone'da dağıldı: İstanbul (UTC+3), Lizbon (UTC+0), New York'ta 1 client lead (UTC-5). Overlap saati hesapladık: Lizbon 14:00-17:00 arası İstanbul'la 3 saat çakışıyor, New York'la 9:00-12:00 arası. Günde toplamda 6 saat senkron pencere. Geri kalan süre asenkron — Slack thread, Notion doc, Loom video.

12 ay boyunca meeting sayısını %40 azalttık. Async-first kültür zorunlu oldu çünkü herkes aynı anda online değil. Sprint planning Notion'da yapıldı, daily standup Slack thread. Video call sadece decision-making için: product review, architecture discussion, client feedback. Ortalama haftada 4 saat meeting, geri kalanı deep work. Outcome: deploy frequency 12 ayda %22 arttı (haftada 3.2'den 3.9'a), incident rate %18 düştü. Time zone farkı productivity düşürür diye varsayım yanlış — doğru tooling ve async disipliniyle arttırır.

Tool stack:
- Slack: thread culture, channel per project, no DM spam
- Notion: single source of truth, decision log, meeting notes
- Linear: issue tracking, sprint board
- Loom: code review, design feedback
- Tuple: pair programming (low-latency screen share)

Time zone yönetiminde en büyük hata: senkron meeting için "herkesin rahat olduğu saat" aramak. Rahat saat yok. Çözüm: meeting'i async'e çevirmek veya 2 gruba bölmek. İstanbul+Lizbon grubu için 15:00 UTC, New York için 10:00 UTC. Client lead iki meetingte de bulunmak zorunda kalmıyor, decision Notion'da paylaşılıyor.

## Maliyet: Operasyonel Breakdown

12 aylık toplam operasyonel maliyet (ekip bazında, kişi başı):

| Kalem | Aylık | Yıllık |
|---|---|---|
| Koworking (Second Home) | €350 | €4,200 |
| Internet (MEO Fibra) | €40 | €480 |
| Fallback esim (Vodafone) | €25 | €300 |
| Accountant | €120 | €1,440 |
| Apartman kirası (T2, Graça) | €1,200 | €14,400 |
| Ulaşım (metro + Uber) | €80 | €960 |
| Yemek (dışarıda öğle) | €220 | €2,640 |
| **Toplam** | **€2,035** | **€24,420** |

İstanbul'da aynı setup için kira €800, koworking €180, internet €30, accountant gereksiz. Toplam €1,200/ay = €14,400/yıl. Lizbon %70 daha pahalı. Ancak: tax incentive yoksa bile life quality artışı somut — ses kirliliği düşük, koworking kalitesi yüksek, walkability skoru İstanbul'un 3 katı. Productivity artışı sayısal: deploy frequency %22, incident rate -%18. €10,000 farkı bu metrikle karşılamak mümkün.

Maliyet optimizasyonu için: koworking yerine shared apartment office kurulabilir (€1,200 kira + 3 kişi = €400/kişi), yemek home-cook ile €220'den €100'e düşer. Ancak ekip dynamic'i değişir — koworking'in sosyal boyutu var, apartman ofiste izolasyon riski yüksek.

## Markalaşma ve Uzaktan Ekip Kültürü

Uzaktan çalışan ekibin marka tutarlılığı sorunu: fiziksel ofiste duvar posteri, renk şeması, logo kullanımı standart. Remote'ta herkes kendi Zoom background'unu seçiyor, Notion sayfası kendi template'i, email signature farklı. 12 ayda gördük ki [Markalaşma & Brand Identity](https://www.roibase.com.tr/tr/branding) altyapısı remote ekip için daha kritik — tek merkez olmayınca visual consistency dağılıyor.

Çözüm: Figma'da shared brand kit (logo varyantları, color palette, typography), Notion'da brand guideline template, Slack'te automated signature generator. Her ekip üyesi onboarding'de brand kit'i indiriyor, Zoom background ve email signature standart hale geliyor. 3 ayda ekip içi brand recognition %85'e çıktı (internal survey). Client-facing materyallerde tutarlılık sağlandı — proposal, deck, email hepsi aynı visual language.

Remote ekipte brand sadece logo değil, communication tone da brand'in parçası. Async thread'lerde cevap süresi, emoji kullanımı, feedback dili — hepsi brand perception'ı etkiliyor. 12 ay boyunca Slack thread response time ortalamasını 4 saatten 1.5 saate düşürdük, emoji kullanımını %30 artırdık (pozitif feedback için). Client'tan gelen survey: "Roibase ekibi responsive ve human-centered" skorunda %18 artış.

## Kritik Öğrenmeler ve Operasyonel Öneri

12 aylık verinin özeti: Lizbon tech ekibi için connectivity açısından güvenilir, koworking çeşitliliği yüksek, vergi sistemi belirsiz, time zone yönetimi disiplin gerektirir, maliyet İstanbul'dan %70 yüksek ama productivity gain karşılıyor.

Yapılması gerekenler:
1. **Fallback esim zorunlu** — fiber kesintisi nadır ama production deploy anında downtime affedilemez
2. **Koworking ses izolasyonunu test et** — 60dB üzeri konsantrasyon bozar, phone booth sayısı önemli
3. **Local accountant 1. ayda tut** — vergi belirsizliği çözülmezse 12. ayda sorun büyür
4. **Async-first kültürü meeting sayısı azaltarak başlat** — time zone farkı avantaja çevrilebilir
5. **Brand kit ve guideline remote onboarding'e ekle** — visual consistency ekip büyüdükçe kritik hale gelir

Lizbon generic "digital nomad cenneti" değil — tech ekibi için operasyonel verilerle karar verilmesi gereken bir hub şehir. Internet stabil, koworking kaliteli, vergi ambiguous, maliyet yüksek. 12 aylık test sonucu: evet, sürdürülebilir. Hayır, ucuz değil. Productivity gain maliyeti karşılıyor mu? Bizim case'de evet — deploy frequency ve incident rate metriği bunu kanıtladı.