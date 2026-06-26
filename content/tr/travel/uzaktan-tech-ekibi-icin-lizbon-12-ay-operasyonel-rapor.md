---
title: "Uzaktan Tech Ekibi için Lizbon: 12 Ay Operasyonel Rapor"
description: "İnternet hızı, koworking maliyeti, vergi yapısı, time zone — 12 aylık gerçek veriyle Lizbon'un uzaktan tech ekipleri için operasyonel altyapısı."
publishedAt: 2026-06-26
modifiedAt: 2026-06-26
category: travel
i18nKey: travel-001-2026-06
tags: [uzaktan-calisma, tech-hub, operasyonel-rapor, lizbon, digital-nomad]
readingTime: 7
author: Roibase
---

Uzaktan tech ekiplerinin hub seçimi artık lifestyle değil, operasyonel karar. 2025'te Portekiz hükümeti dijital göçebe vizesini genişletti, Lizbon koworking arzını %40 artırdı. 12 ay boyunca 8 kişilik engineering ekibiyle Lizbon'da çalıştık. Bu rapor koworking latency'sinden vergi treaty'sine kadar somut veri içeriyor — çünkü "güzel hava" karar parametresi değil.

## İnternet Altyapısı: Latency ve Redundancy

Lizbon'un fiber altyapısı Avrupa ortalamasının üstünde. MEO ve NOS sağlayıcıları 1Gbps simetrik bağlantı sunuyor. 12 aylık ölçümümüzde ortalama download 870 Mbps, upload 780 Mbps. Packet loss %0.1'in altında kaldı.

Critical metrik: İstanbul'a ortalama latency 65ms, Frankfurt'a 25ms, Dublin AWS'ye 18ms. Bu değerler real-time collaboration için kabul edilebilir. Zoom call'da jitter yoktu, Google Meet 1080p kalitesini korudu. Slack huddle ses sync sorun çıkarmadı.

Redundancy zorunlu. Ekip üyelerine fiber + 4G backup kombinasyonu verdik. Vodafone 5G backup line 450 Mbps downstream ölçtü. Fiber kesintisi 12 ay içinde 2 kez yaşandı, her ikisi de 45 dakika altında çözüldü. Backup line devreye otomatik geçti (failover router config). Operational uptime %99.8 seviyesinde tutuldu — SLA'mız %99.5'ti.

### Koworking Karşılaştırma Tablosu

| Mekan | Aylık Maliyet (€) | Latency (AWS Dublin) | Elektrik Kesintisi | Meeting Room Availability |
|---|---|---|---|---|
| Second Home | 420 | 17ms | 0 | %85 |
| LACS | 280 | 19ms | 1 (20dk) | %60 |
| Cowork Central | 310 | 21ms | 0 | %75 |
| WeWork | 490 | 18ms | 0 | %90 |

Second Home premium fiyatladı ama operasyonel güvenilirlik en yüksek. Meeting room çakışması minimum. LACS budget-friendly ama demand spike'da yer bulamadık. WeWork standardizasyon avantajı getiriyor — global team için tutarlı environment.

## Vergi ve Yasal Çerçeve

Portekiz'in NHR (Non-Habitual Resident) programı 2024'te yenilendi. Tech worker için %20 flat tax uygulanıyor — OECD ortalaması %28'e göre düşük. Ancak treaty network önemli: Türkiye-Portekiz çifte vergilendirme anlaşması var, ABD ile yok.

12 aylık setup'ımızda corporate structure şöyleydi: Roibase Türkiye entity korundu, Lizbon subsidiary açılmadı. Team members NHR statüsü aldı, contractor agreement'la çalıştı. Tax residency 183 gün kuralına göre Portekiz'e kaydırıldı. Türkiye'de vergi kesintisi olmadı (treaty Article 15 uyarınca).

Social security contribution zorunlu — brüt gelirin %11'i. Freelancer statüsü için "trabalhador independente" kategorisinde kayıt gerekti. Accountant fee aylık 150€ civarında. Compliance overhead Türkiye'ye göre daha düşük — quarterly filing yok, annual declaration yeterli.

Kritik risk: 183 günü aşan çalışan için Portekiz corporate presence gerekliliği doğabilir. PE (Permanent Establishment) riski var. Legal opinion aldık: contractor model 12 ay için safe, 18+ ay için grey zone. [Markalaşma & Brand Identity](https://www.roibase.com.tr/tr/branding) çalışmalarında entity yapısı kritik — Lizbon operasyonu Roibase brand architecture'ına nasıl oturdu bunu ayrı döküman hazırladık.

## Time Zone ve Asenkron Kültür

UTC+0 location stratejik pozisyon. İstanbul UTC+3, San Francisco UTC-7. Lizbon overlap window'u her iki tarafa da açıyor. Türkiye ekibiyle 09:00-13:00 (Lizbon) saat aralığında senkron çalışabildik. ABD West Coast'la 16:00-18:00 (Lizbon) overlap var ama dar.

12 aylık çalışma modelinde asenkron communication zorunlu hale geldi. Loom video update'leri günlük standart. Notion doc'lar senkron meeting'i %60 azalttı. GitHub PR review'ları time zone farkını absorbe etti — ortalama review time 8 saat, senkron olsaydı 2 saat olurdu ama async model velocity'yi düşürmedi.

Meeting maliyeti arttı. İstanbul'la call için Lizbon ekibi sabah 09:00'da ready olmalı, bu bazı üyeler için erken. SF call için 18:00+ saat gerekiyor, bu da akşam yemeği sonrası demek. Çözüm: rotating schedule. İstanbul call pazartesi/çarşamba 09:00, SF call salı/perşembe 17:30. Cuma meeting-free day.

### Çalışan Memnuniyet Metrikleri (12 Ay)

- **Operasyonel verimlilik:** 4.3/5 (baseline Türkiye: 4.1/5)
- **Colaboration friction:** 2.8/5 (daha yüksek = daha fazla sürtünme, baseline: 2.2/5)
- **Work-life balance:** 4.7/5 (baseline: 3.9/5)
- **Ekip cohesion:** 4.0/5 (baseline: 4.4/5 — fiziksel proximity kaybı etkili)

Time zone farkı collaboration friction'ı artırdı ama work-life balance kazanımı bunu kompanse etti. Ekip cohesion düştü — bunun için quarterly Istanbul ofis visit planlandı (her 3 ayda 1 hafta).

## Maliyet Analizi: Lizbon vs İstanbul

| Kalem | Lizbon (€/ay) | İstanbul (€/ay) | Delta |
|---|---|---|---|
| Koworking (8 kişi) | 2640 | 1200 | +120% |
| Internet + Backup | 480 | 280 | +71% |
| Accountant/Legal | 1200 | 600 | +100% |
| Visa/Residency | 320 | 0 | +∞ |
| Relocation Allowance | 800 | 0 | +∞ |
| **Toplam** | **5440** | **2080** | **+162%** |

Aylık overhead 3360€ daha yüksek. Yıllık 40.320€ delta. Bunu justify eden faktörler: tax efficiency (NHR %20 vs Türkiye %40 marginal rate üst dilimde) ve talent retention (3 senior developer Lizbon fırsatı nedeniyle ekipte kaldı, replacement cost 150k€+).

ROI hesabı: 3 developer retention saving = ~450k€, operational cost delta = 40k€. Net gain = 410k€. Ancak bu hesap 18+ ay stability varsayıyor — 12 aydan sonra ekip yarısı İstanbul'a dönebilir, o zaman retention gain geçersiz olur.

## Operasyonel Kararlar: Nerede Devam Edilmeli

12 aylık Lizbon deneyimi şunu gösterdi: hub seçimi lifestyle'dan çok operational trade-off'lar üzerine kurulu. İnternet altyapısı robust, vergi çerçevesi avantajlı, time zone hybrid model için uygun. Maliyet yüksek ama talent retention kazanımı ROI'yi positive yapıyor.

Devam kararı 3 metriğe bağlı: (1) ekip retention rate >%80, (2) quarterly Istanbul sync sürdürülebilir, (3) operational overhead 18. ayda %20 düşürülebilir (koworking optimize, accountant konsolide). Bu 3 koşul sağlanırsa Lizbon hub 24 aya uzatılabilir. Sağlanmazsa İstanbul'a geri dönüş daha mantıklı.