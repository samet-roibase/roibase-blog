---
title: "Digital Nomad Vergi Stack'i — 2026 Güncel Tablo"
description: "Estonia e-residency, Portugal NHR sonrası düzenlemeler ve Türkiye dijital göçebe vergi durumu — tech ekipleri için operasyonel karşılaştırma"
publishedAt: 2026-07-01
modifiedAt: 2026-07-01
category: travel
i18nKey: travel-003-2026-07
tags: [digital-nomad, vergi, e-residency, portugal-nhr, remote-work]
readingTime: 8
author: Roibase
---

2025'in son çeyreğinde Portugal NHR programının kapanması, 2026 başında Türkiye'nin dijital göçebe için özel vergi rejimi tartışması ve Estonia e-residency'nin KDV prosedürlerindeki değişiklik — tech ekiplerinin vergi stack kararını iki yılda bir güncellemek zorunda bıraktı. Bu yazı o güncel tabloyu veriyor: hangi jurisdiksiyon hangi profil için mantıklı, hangi maliyet kalemleri gözden kaçıyor, hangi kombinasyonlar operasyonel risk taşıyor.

## Estonia e-Residency: 2026 Güncel Durum

Estonia e-residency 2014'ten beri dijital göçebelerin varsayılan kurumsal kimliğiydi — €100 başvuru, €265 yıllık accounting paketi, %20 kurumlar vergisi yalnızca dağıtımda. 2026'da iki kritik değişiklik var.

İlk değişiklik KDV eşiği. 2024'e kadar €40,000 ciro altında KDV kaydı zorunlu değildi, 2025'te €25,000'e indi, 2026 başında tamamen kaldırıldı — her e-resident şirketi artık ilk faturayla birlikte KDV numarası almak zorunda. Bu reverse-charge mekanizmasında sorun yaratmıyor (B2B faturalarda KDV %0 olabiliyor), ama KDV beyannamesi filing frequency'si değişti: üç aylık yerine aylık. Accounting paketi maliyeti ortalama €50/ay arttı.

İkinci değişiklik permanent establishment (PE) tanımı. OECD'nin 2023 raporuna uyum çerçevesinde Estonya vergi otoritesi şunu netleştirdi: e-resident şirket sahibi Estonya dışında 183 günden fazla aynı ülkede bulunuyorsa ve o ülke ile vergi antlaşması yoksa, PE riski var. Örnek: Bali'de 200 gün kalan bir e-resident, Endonezya vergi otoritesinden PE iddiasıyla karşılaşabilir (Estonya-Endonezya tax treaty yok). Bu durumda iki ülkede de vergi yükümlülüğü doğar.

Pratikte bu ne anlama geliyor? E-residency artık "sadece kuruluş" yapısı değil — coğrafi rotasyonu olan dijital göçebeler için çalışıyor, tek ülkede sabit kalanlar için risk taşıyor. Tech ekipleri genelde 60-90 günlük hub rotasyonu yapıyor, onlar için hâlâ temiz. Ama "Bali'de 10 ay code yazıp gidiyorum" profili artık Estonia e-residency ile riskli.

Maliyet: €100 başvuru + €265/yıl accounting + €600/yıl (aylık KDV beyannamesi için ek paket) + %20 vergi (dağıtımda) = ilk yıl ~€1,000 setup + running €865/yıl + kar üzerinden %20.

### Hangi Profil İçin Mantıklı

E-residency 2026'da şu senaryolar için mantıklı:
- B2B SaaS, danışmanlık, design — düşük fiziksel varlık gerektiren işler
- Yılda 4-6 hub arasında rotasyon yapan nomad (183 gün eşiğini hiçbir yerde geçmiyor)
- Avrupa müşteri tabanı (reverse-charge ile KDV yükü yok)
- €50k-€150k yıllık gelir bandı (altı maliyet oranı yüksek, üstü büyük jurisdiksiyon'lara geçiş zamanı)

Mantıksız olduğu durumlar:
- Tek ülkede 6+ ay kalma planı
- Fiziksel ürün ticareti (KDV filing karmaşık)
- Non-EU müşteri ağırlığı + düşük margin (accounting overhead oransal olarak ağır)

## Portugal NHR Sonrası: 2026 Alternatifi Yok mu?

Portugal'ün Non-Habitual Resident (NHR) programı 2009'dan 2024 sonuna kadar dijital göçebelerin "vergi-optimize hub"uydu — yurtdışı kaynaklı gelir %0 veya flat %20 oranında, Lizbon'da kalabilme, Schengen içinde serbest dolaşım. 2024 Aralık'ta program tamamen kapandı, yeni başvuru alınmıyor.

2026 başında Portekiz hükümeti "Digital Nomad Visa" (D8) rejimini revize etti. Eski NHR'nin vergi avantajı yok, ama kalış koşulları basitleşti: €3,280/ay minimum gelir (eski €2,750'den arttı), 183+ gün koşulu kaldırıldı (sadece 4 ay minimum kalış yeterli). Vergi yapısı standart Portekiz rezidenti gibi: %14.5 - %48 progressive bracket. Bu dijital göçebe için cazip değil, sadece Portekiz'e "geri dönmek isteyen ancak fiziki rezidans yükü taşımak istemeyen" profil için.

Alternatiflere bakalım:

**Malta:** 2026'da hâlâ aktif bir seçenek — Global Residence Programme (GRP) ile %15 flat rate foreign-source income üzerinden. Minimum €15,000 yıllık vergi (Malta'da property rental zorunlu, €1,000/ay civarı). Accounting + legal setup €3,500 ilk yıl. Tech ekipleri için Malta'nın dezavantajı: küçük ada, sınırlı coworking ecosystem, düşük developer density. Lizbon veya Barselona'dan sonra Malta sosyal olarak daraltıcı.

**İspanya Beckham Law:** 2026 revizyonu ile "special tax regime for inbound workers" tekrar canlandı. İlk 6 yıl %24 flat rate (yurtdışı gelir hariç). Ancak setup karmaşık — İspanya'da işveren sponsorluğu veya kendi şirketin İspanya branch'i lazım. Solo freelancer için değil, 2+ kişilik tech ekiplerinin "Barcelona hub" kurarken kullanabileceği bir yol.

**Türkiye (2026 deneme rejimi):** 2025 sonunda Türkiye Hazine yurtdışından Türkiye'ye gelen dijital göçebelere "teknoloji geliri özel istisnası" getirdi (henüz tam yasalaşmadı, 2026 ilk çeyrekte pilot uygulama). Şartlar: Türkiye'de 183 günden az kalma, yurtdışı kaynaklı gelir, Türkiye'de müşteri yok. İstisna kapsamında %0 vergi. Ancak social security contribution hâlâ muğlak — SGK primi düşürülmedi, sadece vergi istisna kapsamında. Pratikte bu şu anlama geliyor: €50k gelir üzerinden SGK primi ~€6k/yıl (Türkiye'de yaşamadığın halde). Bu oran Malta'dan yüksek, e-residency'den düşük. Türkiye'nin avantajı: coworking altyapısı İstanbul ve İzmir'de güçlü, time zone Avrupa ile overlap, maliyet düşük. Dezavantajı: hukuki belirsizlik (pilot rejim), sosyal güvence mekanizması muğlak.

## Kombine Stack: Çift Jurisdiksiyon Stratejisi

2026'da birçok tech ekibi tek jurisdiksiyon yerine "operational entity + tax residency split" yapıyor. Örnek stack:

**Stack A: Estonia entity + UAE tax residency**
- Estonia e-resident şirketi (faturalama, EU müşteri ilişkisi)
- Dubai'de 183+ gün kalarak UAE tax residency (individual %0 income tax)
- Estonia şirketi kar dağıtımını UAE resident'a yapsın → PE riski yok (UAE ile tax treaty var)
- Maliyet: €865/yıl Estonia accounting + Dubai visa €3,000/yıl (freelance permit) = ~€3,900/yıl
- Vergi: %0 individual, %20 corporate (sadece dağıtımda)

**Stack B: US LLC (passthrough) + Türkiye non-resident**
- Delaware LLC (single-member, passthrough entity — kurumsal vergi yok)
- ABD'de fiziksel varlık yok, ETBUS (Effectively Connected to US Business) yok → ABD vergisi yok
- Türkiye'de 183 günden az kalarak non-resident statüsü → Türkiye vergisi yok
- Maliyet: $300/yıl registered agent + $150/yıl accounting software = ~$450/yıl
- Risk: ABD müşteri oranı %25'i geçerse ETBUS riski artar

Bu kombine stack'ler operasyonel karmaşıklık getirir — iki ülkenin compliance gereksinimleri, banka hesabı yönetimi, currency hedging. [Markalaşma & Brand Identity](https://www.roibase.com.tr/tr/branding) açısından da tutarlılık sorunu: fatura Estonia'dan, LinkedIn profil Dubai'de, web site Türkiye hosting — brand story'nin coğrafi tutarlılığı kaybolur. Solo freelancer için makul, 3+ kişilik team için operasyonel overhead çok yüksek.

## Gözden Kaçan Maliyet Kalemleri

Vergi oranı karşılaştırması yaparken şu kalemler genelde atlanır:

**1. Banking friction:** E-residency ile LHV veya Wise Business hesabı açılıyor, ama ABD müşterilerinden wire transfer alırken intermediary bank fee €25-40 arası. Yıllık 50 fatura → €1,250 kayıp. Transferwise kullansan bile FX spread %0.4-0.6 arası (mid-market'e göre). €100k gelirde €400-600 kayıp.

**2. Accounting overhead:** Estonia e-residency ile "otomatik muhasebe" efsanesi var, gerçekte yok. Aylık KDV beyannamesi 2026'da zorunlu — her invoice'u manuel kategorize etmen gerek. Bu ayda 3-4 saat. Outsource edersen €50/ay, DIY yaparsan opportunity cost. Yıllık €600 veya 40 saat.

**3. Travel cost for compliance:** Malta GRP şartı property rental zorunlu demiştik — yılda minimum 1 kere Malta'ya gidip sözleşme yenileme, apostille, noter işlemleri. Flight + konaklama + notary fees = €800-1,000. Tax residency sertifikası için fiziksel başvuru bazı ülkelerde zorunlu (örn. Portekiz'de D8 visa ilk başvurusunda biyometrik veri İstanbul konsolosluğunda alınıyor, Dubai'den gelemezsin). Bu tür logistik maliyetler net vergi hesaplarına girmiyor.

**4. Health insurance gap:** E-resident şirket sahibi Estonya sağlık sistemine erişemiyor (sadece vatandaşlar). Nomad Cruise veya SafetyWing gibi digital nomad insurance €150/ay civari, ama coverage sınırlı — ciddi ameliyat veya kronik hastalık durumunda EU health card yok. Bu risk pricing'e dahil edilmeli.

**5. Pension gap:** Türkiye dijital göçebe rejimi SGK primi alıyor ama pension accrual yok (katkı yalnızca sağlık için). 30 yıl sonra emeklilik hakkı doğmuyor. Malta'da pension contribution zorunlu değil. Estonia e-residency ile II pillar (pension fund) Estonya vatandaşı olmayana kapalı. Yani dijital göçebe stack'lerinin hepsi "bugünkü vergi optimizasyonu, yarınki sosyal güvence yok" üzerine kurulu.

## 2026 Stack Karşılaştırma Tablosu

| Jurisdiksiyon | İlk Yıl Maliyet | Yıllık Recurring | Effective Tax Rate | PE Riski | Compliance Load |
|---|---|---|---|---|---|
| Estonia e-residency | €1,000 | €865 + %20 dağıtımda | %20 | Yüksek (183 gün kuralı) | Orta (aylık KDV) |
| Malta GRP | €3,500 | €1,500 + %15 foreign income | %15 + €15k min | Düşük | Yüksek (property rental, fiziksel presence) |
| Türkiye pilot rejim | €0 (belirsiz) | €6,000 SGK | %0 gelir vergisi | Orta (yasalaşma belirsiz) | Düşük (henüz net prosedür yok) |
| US LLC passthrough + non-resident | $500 | $450 | %0 (ETBUS yoksa) | Yüksek (ABD müşteri oranı) | Çok düşük |
| UAE tax residency | €3,000 | €3,000 | %0 individual | Düşük (treaty network geniş) | Orta (visa renewal yıllık) |

Bu tablo nominal vergi oranlarını gösteriyor — yukarıdaki gözden kaçan kalemler eklendiğinde effective cost %5-10 daha yüksek.

## Karar Ağacı: Hangi Profil Hangi Stack'i Seçmeli

**Solo freelancer, €30k-€60k/yıl, B2B SaaS danışmanlığı, 4-6 hub rotasyonu:**
→ Estonia e-residency. Accounting overhead düşük gelir bandında tolere edilebilir, PE riski rotasyonla kontrol altında.

**2-3 kişilik tech team, €100k-€200k/yıl, Avrupa müşteri ağırlığı, Barcelona veya Lizbon hub:**
→ İspanya Beckham Law. Team'e employment contract yapıp %24 flat rate ile operasyonel basitlik. Accounting karmaşıklığı tek jurisdiksiyon'da kalır.

**Solo developer, €80k-€120k/yıl, ABD müşteri %70, sürekli seyahat:**
→ US LLC passthrough + tax residency yok stratejisi (perpetual traveler). ETBUS riskini düşük tutmak için ABD'de fiziksel varlık sıfır, müşteri görüşmeleri remote. Maliyet minimizasyonu öncelikse en düşük overhead.

**Tech ekip founder, €200k+/yıl, uzun vadeli equity buildup planı:**
→ Malta GRP veya UAE residency + offshore holding. Bu seviyede personal tax minimizasyonundan ziyade corporate structure optimization ön planda — dividend repatriation, capital gains tax, inheritance planning. E-residency bu bandda yetersiz.

**Türkiye'ye dönmek isteyen ama non-resident kalmak isteyen nomad:**
→ Türkiye pilot rejimi. Risk: yasanın 2027'de değişmesi, SGK priminin artması. Ama İstanbul coworking ecosystem güçlü, Avrupa time zone uyumu var, TL maliyet düşük. Trade-off: hukuki belirsizlik.

Son paragraf: 2026 vergi stack'i statik değil — her çeyrekte bir jurisdiksiyon kuralı değişiyor, her 6 ayda bir yeni visa programı açılıyor. Yukarıdaki tablo bugünkü snapshot. Dijital göçebe operasyonel kararı vermek "bir kere kur unut" değil, "quarterly review + compliance monitoring" gerektiriyor. Stack'ini seçtikten sonra aylık €50-100 accounting overhead'i tolere edemiyorsan, e-residency yerine basit US LLC ile başla — ilk €50k'yı orada kazan, sonra optimize et. Optimizasyon erken aşamada operasyonel yük getirir, büyüme öncelikli ekipler için dikkat dağıtıcıdır.