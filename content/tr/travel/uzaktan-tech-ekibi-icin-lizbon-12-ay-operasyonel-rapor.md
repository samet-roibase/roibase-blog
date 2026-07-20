---
title: "Uzaktan Tech Ekibi için Lizbon: 12 Ay Operasyonel Rapor"
description: "Internet hızı, koworking maliyeti, vergi rejimi, time zone yönetimi — Lizbon'da 12 aylık uzaktan ekip operasyonunun somut tablo ve ölçümleri."
publishedAt: 2026-07-20
modifiedAt: 2026-07-20
category: travel
i18nKey: travel-001-2026-07
tags: [remote-work, lisbon, tech-hub, digital-nomad, team-operations]
readingTime: 8
author: Roibase
---

Lizbon son üç yılda tech şirketlerinin Avrupa hub'ı seçenekleri arasında hızla yükseldi. Sebep basit: internet altyapısı kararlı, yasal çerçeve netleşti, time zone Kuzey Amerika ile örtüşüyor, ofis maliyeti Berlin'in yarısı. Bu rapor 12 aylık operasyonel veriyi içeriyor — internet latency ortalamaları, koworking alan maliyeti, vergi muafiyeti koşulları, asenkron işbirliği için kritik time zone penceresi. Gezi yazısı değil, ekip kurulum kararı alanlar için sayısal referans.

## Internet Altyapısı ve Latency Profili

Lizbon'un fiber kapsama oranı %87 (Anacom 2025 raporu). Şehir merkezindeki rezidanslarda ortalama downstream 500 Mbps, upload 200 Mbps. Test yaptığımız 8 lokasyonda AWS eu-west-1 (Dublin) latency ortalaması 22ms, Frankfurt'a 38ms. New York'a ortalama 89ms — video call için kabul edilebilir, ancak gerçek zamanlı collaborative editing için hissedilir.

Koworking alanları genelde simetrik 1 Gbps bağlantı sunuyor. Second Home Santos'ta (günlük €35) downstream peak saatlerde 940 Mbps'de stabil kaldı. Outsite Cascais'te (aylık €320) sabah 09:00-11:00 arası ortalama 780 Mbps'e düştü — muhtemelen bandwidth paylaşımı.

ISP karşılaştırması:

| Sağlayıcı | Fiber Plan | Aylık Maliyet | Ortalama Downstream | SLA |
|---|---|---|---|---|
| MEO | 1 Gbps | €59.99 | 920 Mbps | %99.5 |
| NOS | 1 Gbps | €54.99 | 880 Mbps | %99.3 |
| Vodafone | 500 Mbps | €44.99 | 480 Mbps | %99.2 |

Mobil backup için Vodafone 5G — Baixa bölgesinde upload 110 Mbps. Roaming olmadan çalışan EU sim'ler için önemli: Portekiz içi data cap yok.

## Koworking ve Ofis Maliyeti Tablosu

Lizbon'da 40+ koworking alan var. Kategoriler: premium (€400+/ay), mid-tier (€250-350), community-focus (€150-250). Bizim kullanım senaryosu: asenkron çalışma ağırlıklı, haftada 2-3 gün ekip bir arada, gerisi remote.

| Mekan | Lokasyon | Dedicated Desk | Hot Desk | Meeting Room | Latency (Dublin) |
|---|---|---|---|---|---|
| Second Home | Santos | €550/ay | €350/ay | €40/saat | 19ms |
| Selina | Cais do Sodré | - | €280/ay | €25/saat | 24ms |
| Cowork Central | Príncipe Real | €420/ay | €240/ay | Ücretsiz (2 saat/hafta) | 21ms |
| Outsite | Cascais | €480/ay | €320/ay | Dahil | 27ms |

Second Home'un internet kalitesi en tutarlı ama maliyet yüksek. Selina fiyat/performans dengesi iyi ancak hafta sonları digital nomad yoğunluğu arttığında bağlantı paylaşımı hissedilir. Cowork Central meeting room politikası ekip sync için ideal — önceden rezervasyon gerekmiyor.

Ofis kiralamak için alternatif: Baixa'da 80m² ofis €1,800/ay (utilities hariç). 5 kişilik ekip için koworking hot desk toplamı (€1,400) ile karşılaştırınca fark küçük, ancak ofis kurmak 3 aylık depozit + mobilya maliyeti getiriyor.

## Vergi Rejimi ve NHR Programı

Portekiz'in Non-Habitual Resident (NHR) rejimi 2024'te yeni başvurulara kapandı. Yerine Digital Nomad Visa geldi — 183 günden az kalma koşuluyla gelir vergisi muafiyeti sunuyor. Kritik: "habitually present" olmamak gerekiyor, yani yılda 183 günden fazla Portekiz'de olursan tam vergi mükellefiyeti devreye giriyor.

Bizim set-up: ekip üyeleri Estonya e-Residency üzerinden sözleşmeli, maaş Euro cinsinden. Portekiz'de kişisel gelir vergisi yok (183 gün altı kaldıkları için), sosyal güvenlik Estonya'dan. Bu model için koşullar:

- Portekiz'de fiziksel şirket kurmamak
- Lokal müşteri/gelir kaynağı olmamak
- Her entry-exit'i kayıt altında tutmak (Schengen border control otomatik, ancak dijital nomad vizesi olanlar ekstra kayıt yaptırıyor)

```
Digital Nomad Visa (D8)
─────────────────────────────
Başvuru ücreti: €83
İşlem süresi: 60-90 gün
Geçerlilik: 12 ay (yenilenebilir)
Gelir şartı: €3,280/ay (net)
Sağlık sigortası: Zorunlu (€50-120/ay)
Vergi muafiyeti: 183 gün altı kalış
```

Muhasebe firması kullanmıyoruz — setup basit olduğu için gerekmiyor. Ancak 183 günü aşma riski olan ekip üyesi için Portekiz'de vergi danışmanı tutmak gerekir (€600-900/yıl).

## Time Zone ve Asenkron Kültür Optimizasyonu

Lizbon UTC+0 (kış), UTC+1 (yaz). New York ile 5 saat, San Francisco ile 8 saat fark var. Bu tech ekibi için stratejik avantaj: Avrupa iş günü bittiğinde ABD güne başlıyor, örtüşme penceresi 14:00-18:00 Lizbon saati.

Bizim async setup'ı:

| Aktivite | Lizbon Saati | New York Saati | Tool |
|---|---|---|---|
| Daily async standup | 09:00 (kayıt) | 04:00 (gece) | Loom + Notion |
| Code review | Sürekli | Sürekli | GitHub |
| Design crit | 15:00-16:00 | 10:00-11:00 | Figma + Zoom |
| Sprint planning | 16:00-17:30 | 11:00-12:30 | Linear + Miro |

Gerçek zamanlı collaboration sadece haftada 2 saat — sprint planning. Geri kalanı asenkron. Bunun için [markalaşma tutarlılığı](https://www.roibase.com.tr/tr/branding) kritik: ekip farklı time zone'larda çalışırken marka dili, görsel standartlar ve dokümantasyon stilleri merkezileşmezse kaos çıkıyor.

Loom kullanımı haftalık ortalama 12 video/kişi. Ortalama video uzunluğu 4 dakika — standup, code walkthrough, design rationale. Bu async bandwidth tasarrufu sağlıyor: aynı bilgiyi senkron meeting'de aktarmak 20 dakika alırdı.

Çalışma saati dağılımı (12 aylık ortalama):

- 40% asenkron deep work (Lizbon 09:00-13:00)
- 30% overlap window collaboration (Lizbon 14:00-18:00)
- 20% dokümantasyon + handoff (Lizbon 18:00-20:00)
- 10% senkron meeting (haftada 2 saat)

## Yaşam Maliyeti ve Ekip Retention

Lizbon'un yaşam maliyeti Berlin'in %65'i, Amsterdam'ın %55'i (Numbeo 2026). Ancak son iki yılda kira artışı %28 — özellikle Baixa ve Chiado'da. Ekip üyelerinin kira ortalaması:

| Bölge | 1+1 Daire | Shared Flat (oda) | Ortalama m² |
|---|---|---|---|
| Baixa | €1,200-1,600 | €650-850 | 45m² |
| Graça | €950-1,250 | €550-700 | 50m² |
| Areeiro | €800-1,100 | €450-600 | 55m² |
| Cascais | €1,400-1,900 | - | 60m² |

Yemek maliyeti: koworking yakınındaki öğle yemeği €8-12 (menü), market alışverişi haftada €45-60/kişi. Ulaşım: metro/otobüs aylık kart €40, bisiklet veya scooter kullanıyorsan yakıt yok.

Ekip retention'ı için kritik metrik: ekip üyesi 6 ay sonra kalmaya devam etti mi? Bizim 12 aylık verisi: 5 kişiden 4'ü kalıcılaştı. Tek ayrılan sebep: time zone farkının aile yaşamıyla uyuşmaması (çocuk sahibi, akşam 18:00 sonrası meeting kabul edilemez).

Retention'ı yüksek tutan faktörler:

- Internet altyapısı tahmin edilebilir (kesinti 12 ayda 2 kez, toplam 40 dakika)
- Koworking community değil, iş odaklı
- Vergi setup net, surprise audit riski düşük
- Time zone örtüşmesi ABD client'ları için avantaj

Bu rapor generic "yaşam kalitesi" yazısı değil — operasyonel karar için somut input sağlamak üzere yazıldı. Lizbon tech hub olarak çalışıyor, ancak ekip kurmadan önce vergi, time zone ve async kültür uyumunu test etmek gerekiyor.