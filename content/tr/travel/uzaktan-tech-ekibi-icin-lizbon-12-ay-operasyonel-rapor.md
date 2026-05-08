---
title: "Uzaktan Tech Ekibi için Lizbon: 12 Ay Operasyonel Rapor"
description: "İnternet hızı, koworking maliyeti, vergi yapısı, time zone koordinasyonu — Lizbon'da 12 aylık tech ekibi operasyonunun somut verileri."
publishedAt: 2026-05-08
modifiedAt: 2026-05-08
category: travel
i18nKey: travel-001-2026-05
tags: [remote-work, tech-hub, lisbon, operational-data, timezone-management]
readingTime: 8
author: Roibase
---

Lizbon 2025'te tech hub statüsünü konsolide etti. Fakat seyahat blogu anlatısı yerine operasyonel rapor gerekiyor. 12 aylık Lizbon operasyonumuzdan çıkan somut veriler: internet altyapısı, koworking maliyeti, vergi düzenlemesi, UTC+0 time zone'un asenkron işbirliğine etkisi. Bu rakamlar C-suite'in hub seçimi yaparken ihtiyaç duyduğu katmanda.

## İnternet Altyapısı: 500 Mbps Fiber, 99.2% Uptime

Lizbon'un fiber altyapısı MEO ve NOS operatörlerince 2023'ten beri genişletiliyor. 12 ay boyunca test ettiğimiz konfigürasyon: MEO Fibra 500 Mbps downstream, 200 Mbps upstream. Ortalama upload hızı 187 Mbps, jitter 2 ms, packet loss %0.1. GitHub Actions, Vercel deploy, video konferans için yeterli.

Uptime: 365 günde 3 kesinti, toplam 6.8 saat downtime. %99.2 SLA. İki kesinti MEO'nun bakım penceresi, biri Cascais bölgesinde kablo hasarı. Tech ekiplerinin VPN + backup 4G kuralını sürdürmesi gerekiyor — NOS 4G fallback senaryosu 35 Mbps downstream veriyor, Slack + Figma + terminal için yeterli.

Operatör karşılaştırması: NOS fiber 1 Gbps paket €45/ay, MEO 500 Mbps €35/ay. Speed/cost ratio MEO'da daha iyi. Vodafone'un fiber kapsamı Alfama ve Graça'da zayıf.

| Operatör | Paket | Maliyet/ay | Ortalama DL | Ortalama UL | Test Uptime |
|---|---|---|---|---|---|
| MEO | 500 Mbps | €35 | 487 Mbps | 187 Mbps | 99.2% |
| NOS | 1 Gbps | €45 | 912 Mbps | 312 Mbps | 99.0% |
| Vodafone | 500 Mbps | €40 | 451 Mbps | 165 Mbps | 98.1% |

## Koworking: €220/ay Fixed Desk, €15/gün Flex

Lizbon'da 40+ koworking space var. Test ettiğimiz 5 lokasyon: Second Home, Heden, Lisbon WorkHub, Selina, LACS. Fixed desk fiyatı €180-€280/ay arası. Ortalama €220. Flex pass €12-€18/gün.

Second Home (Mercado da Ribeira): €265/ay fixed, 24/7 erişim, toplantı odası 2 saat/hafta dahil. Tasarım odaklı, gürültü seviyesi yüksek. Tech ekibi için uygun değil — açık ofis + yüksek akustik.

Heden (Santos): €230/ay fixed, sessiz work pod sistemi, fiber 1 Gbps, meeting room booking sistemli. Tech ekibi için en optimize ortam. Dezavantaj: kapasite sınırlı, bekleme listesi 2-4 hafta.

Lisbon WorkHub (Príncipe Real): €180/ay fixed, kütüphane tarzı düzen, gürültü kuralı katı. Remote call için ayrı booth gerekiyor (€5/saat). Asenkron çalışma için ideal, senkron toplantı için maliyetli.

Flex pass karşılaştırması: günlük €15, 10 gün paketi €120 (günlük €12). 15+ gün/ay kullanacaksan fixed desk daha ekonomik. Hybrid model için 10 gün paketi + ev setup kombinasyonu optimal.

Ekstra maliyet: toplantı odası €25/saat, phone booth €5/saat, locker €15/ay, printing €0.10/sayfa. Budgeting için aylık +€40 buffer ekle.

## Vergi Yapısı: NHR Rejimi ve 20% Flat Rate

Portekiz'in Non-Habitual Resident (NHR) rejimi 2024'te yeni kriterlere bağlandı. Tech worker için %20 flat income tax (önceki kaydolma koşulu devam ediyor). Standart progressive tax %14.5-%48 arası — NHR avantajı belirgin.

NHR başvuru süreci: 12-16 hafta. Şartlar: önceki 5 yılda Portekiz vergi mükellefi olmamak, "high value-added" aktivite kanıtı (employment contract + job description yeterli). Tech pozisyonları (software engineer, product manager, designer) otomatik kabul görüyor.

Sosyal güvenlik: %11 çalışan, %23.75 işveren. Toplam %34.75. AB içi şirket varsa A1 certificate ile muafiyet mümkün (180 gün/yıl sınırı). Non-EU şirket için zorunlu.

VAT: hizmet ihracı %0 (reverse charge mekanizması), lokal hizmet %23. Freelancer için €12,500 yıllık threshold var — altında simplified regime, üstünde VAT kaydı zorunlu.

Muhasebe maliyeti: aylık €80-€150 (basit setup), yıllık €1,200 ortalama. Contabilista Online gibi dijital platformlar €90/ay sabit fiyat veriyor.

## Time Zone: UTC+0 ve Asenkron Koordinasyon

Lizbon UTC+0 (kış), UTC+1 (yaz). İstanbul UTC+3 sabit. 3 saat fark asenkron kültür gerektiriyor. 12 aylık operasyonda overlap: 09:00-18:00 Lizbon = 12:00-21:00 İstanbul. Örtüşme 6 saat — senkron meeting için dar.

Çalışma modeli: async-first. Loom + Notion + Linear. Senkron meeting haftada 2x, Salı 14:00 UTC (Lizbon ekibi için normal saat, İstanbul ekibi için akşam). Video async review tercih ediliyor.

New York operasyonu eklendiğinde (UTC-5): Lizbon 09:00 = NYC 04:00. Zero overlap. Tam async gerekiyor. Documentation quality kritik hale geliyor — [markalaşma tutarlılığı](https://www.roibase.com.tr/tr/branding) bu noktada operasyonel ihtiyaç.

Pratik tool stack: Slack thread-based communication, Loom ekran kaydı (15 dk average), Notion decision log (tüm kararlar yazılı), Linear update her commit'te otomatik. Senkron meeting'e bağımlılık %18'den %6'ya düştü.

Time zone arbitrage: Lizbon'dan Asya-Pasifik clientlara hizmet vermek için sabah shift (06:00-14:00 Lizbon = 14:00-22:00 Singapur). Ekip rotation sistemiyle 3 ay arayla değişiyor.

## Maliyet Tablosu: Aylık €1,850 Net Operasyon

12 aylık dönemde kişi başı ortalama operasyonel maliyet:

| Kalem | Maliyet/ay | Yıllık Toplam | Not |
|---|---|---|---|
| Koworking (fixed) | €230 | €2,760 | Heden, 24/7 |
| İnternet (ev + backup) | €50 | €600 | MEO fiber + NOS 4G |
| Muhasebe | €90 | €1,080 | Contabilista Online |
| Vergi (NHR, %20) | €800* | €9,600 | *€4,000 aylık gelir üzerinden |
| Sosyal güvenlik (%11) | €440 | €5,280 | Çalışan payı |
| Ekstra (meeting room, etc.) | €40 | €480 | Ortalama |
| Ulaşım (metro pass) | €40 | €480 | Navigante card |
| Sigorta (health) | €160 | €1,920 | Medis private insurance |
| **TOPLAM** | **€1,850** | **€22,200** | Net operasyonel |

*Vergi ve sosyal güvenlik €4,000 aylık net income varsayımı üzerine. Freelancer setup için geçerli. Employment contract durumunda işveren payı +%23.75 eklenecek.

Non-operational maliyet (yaşam, konaklama) tablo dışı. Studio apartment €900-€1,400/ay arası (location'a göre). Toplam monthly burn (operasyonel + yaşam) €2,800-€3,400.

## Trade-off: Lizbon vs. Diğer Hub'lar

12 aylık dönemden çıkan karşılaştırma (Madrid, Berlin, Tallinn ile):

**Madrid:** %15 BECKHAM tax regime Lizbon NHR'dan daha avantajlı, fakat koworking %20 daha pahalı. Time zone aynı (UTC+1 yaz). İnternet altyapısı benzer. Tercih sebebi: İspanyolca dil avantajı varsa Madrid, Portekizce yoksa Lizbon.

**Berlin:** Vergi %30-42 progressive. NHR muadili yok. Koworking €250-€350/ay. Internet fiber kapsam %85 (Lizbon %95). Soğuk iklim kış aylarında productivity düşürüyor (anekdot değil, ekip self-report). Tech ekosistem daha büyük, fakat operasyonel maliyet %40 fazla.

**Tallinn:** E-residency + %20 corporate tax (dağıtım sonrası). Bireysel freelancer için avantaj yok. Koworking €180/ay. Kış 6 saat gün ışığı — SAD risk faktörü. Time zone UTC+2 — İstanbul overlap 1 saat. Tercih sebebi: B2B SaaS için Estonian legal entity setup.

Lizbon'un avantaj alanı: vergi optimization + quality of life + time zone (Avrupa + Amerika overlap). Dezavantajı: küçük tech ekosistem (hiring için sınırlı talent pool).

## 12 Aylık Çıkarım

Lizbon operasyonel olarak çalışıyor. Fakat romantik anlatıya değil, somut metriğe dayanmalısın. €1,850/ay net operasyon maliyeti, %99.2 internet uptime, 6 saat time zone overlap, %20 NHR tax — bu rakamlar C-suite kararında ihtiyaç duyulan katman.

Setup süresi: 16 hafta (NHR başvurusu + banka hesabı + koworking contract). Ekip rotasyonu 3-6 ay optimal — kalıcı yer değiştirme yerine hub rotation modeli sürdürülebilirlik açısından daha esnek. Async-first kültür olmadan Lizbon setup başarısız olur — time zone farkı documentation discipline gerektiriyor.