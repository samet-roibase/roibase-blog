---
title: "Asenkron-First Kültür: 4 Time Zone'da Ürün Geliştirme"
description: "Standup yerine Linear updates, response SLA, async toplantı disiplini — coğrafi dağılım için operasyonel kültür tasarımı."
publishedAt: 2026-07-10
modifiedAt: 2026-07-10
category: travel
i18nKey: travel-002-2026-07
tags: [remote-work, async-culture, distributed-teams, operational-design, time-zones]
readingTime: 7
author: Roibase
---

Roibase ekibinin %70'i İstanbul dışında çalışıyor. Lizbon'daki frontend developer sabah 09:00'da açtığı pull request'i, İstanbul'daki backend lead öğlen görüyor, New York'taki CTO akşam review ediyor. Bu ritim üç yıldır kesintisiz sürüyor çünkü asenkron iletişimi "zorunluluk" yerine "disiplin" olarak tasarladık. Slack üzerinde gerçek zamanlı chat %80 oranında düştü, sprint velocity %40 arttı.

4 time zone'da çalışmanın başarısı "herkes istediği yerden çalışabilir" sloganıyla değil, operasyonel kültür tasarımıyla ölçülür. Standup toplantısı yapmıyoruz — bunun yerine her sabah Linear'da güncellenmiş "done/in-progress/blocker" durumu bekliyoruz. Response SLA belirledik: urgent olmayan sorulara 24 saat, blocker olan hatalara 4 saat. Toplantı yapmak için "bu konuyu async çözemiyoruz" gerekçesi sunmak zorundasın.

## Standup Kültürü Neden Ölçmedi

İlk yıl klasik Scrum'ı denedik. Sabah 10:00 İstanbul saati = Lizbon ekibinin gecesi, New York'un şafağı. Katılım %50'ye düştü, gerisi "özet slacklensin" dedi. Toplantının özeti Slack'e atılınca herkes orayı okumaya başladı — yani standup toplantısı yerine standup raporu çalıştı.

İkinci yıl standupı kaldırıp Linear'da günlük status update'i zorunlu hale getirdik. Her kişi sabah kendi saatinde açıyor, "dün ne yaptım / bugün ne yapacağım / blocker var mı" yazıyor. Bu update Linear'ın API'siyle Slack'e de düşüyor. Okuma süresi 2 dakika, herkes kendi ritminde tüketiyor.

Metrik: Sprint retrospective'de "bilgi kaybı" şikayeti ilk dönem %60'tandı, async update'e geçince %5'e düştü. Sebep: yazılı kayıt arama yapılabilir, senkron konuşmada kaybolmuyor.

Blocker durumu için "4 saat SLA" kuralı var. Frontend developer bir API yanıtıyla takılırsa Linear'da `blocker` label'ı ekliyor, backend lead 4 saat içinde cevap vermiyor mu otomatik Slack mention atılıyor. Bu SLA sayesinde "bekleme süresi" sprint burndown'ından çıktı.

## Response SLA ve Önceliklendirme

Asenkron çalışmanın en büyük riski "sonsuz bekleme" — soruyu soruyorsun, karşı taraf başka time zone'da, 24 saat sonra cevap geliyor ama yanlış anlamış, bir tur daha bekliyorsun. İki gün kayıp.

Bunu çözmek için üç SLA kategorisi tanımladık:

| Kategori | Tanım | Beklenen Response Süresi | Kanal |
|----------|-------|--------------------------|-------|
| Urgent | Production'da kritik hata, müşteri bloğu | 1 saat | Slack DM + telefon |
| Blocker | Sprint içi teknik takılma | 4 saat | Linear comment + Slack mention |
| Standard | Feature tartışması, roadmap sorusu | 24 saat | Linear discussion |

"Urgent" label'ı ayda 2-3 kez kullanılıyor. Abartılırsa alarm yorgunluğu oluşur — ekip artık "urgent" görünce ciddiye almaz. Bu yüzden urgent kullanımını retrospective'de gözden geçiriyoruz.

"Blocker" durumunda karşı tarafın time zone'u fark etmez — gece de olsa bildirimi alır, ama sabaha kadar cevaplaması yeterli. Bu sayede "acil değildir ama 24 saat bekleyemeyiz" durumlarda denge kurulur.

"Standard" kategoride detaylı soru sorma disiplini zorunlu. Frontend "bu endpoint nasıl çalışıyor?" yerine "bu endpoint {X} durumunda {Y} yanıtı mı veriyor, {Z} durumunda {W} mi?" diye soruyor. Detaylı soru tek tura cevap alıyor, muğlak soru iki tur gidiyor.

## Async Toplantı Disiplini

Haftada ortalama 3 toplantı yapıyoruz — sprint planning, retrospective, critical incident review. Diğer konuları async çözme zorunluluğu var.

Toplantı açmak için "async rationale" sunmak gerek: "bu konuyu Linear'da tartıştık, 3 farklı görüş var, konsensüs kuramadık" gibi. Yoksa "konuyu konuşalım" talebi reddediliyor, "önce Linear'da yaz" dönüşü yapılıyor.

Toplantı sırasında ekran kaydı zorunlu. Toplantıya katılamayan kişi kaydı 1.5x hızda izliyor, Notion'a özet düşüyor. Karar noktaları Linear ticket'a bağlanıyor. Bu sayede "toplantıda ne konuşuldu bilmiyorum" durumu yok.

Toplantı süresi maksimum 50 dakika — 60 değil, çünkü katılımcının bir sonraki saatte başka işi olabilir. Agenda önceden Linear discussion'da paylaşılıyor, "surprise topic" yasak. Katılımcı hazırlıksız gelirse toplantı erteleniyor.

Time zone çakışması için "overlap window" belirliyoruz: İstanbul 16:00-18:00 = Lizbon 14:00-16:00 = New York 09:00-11:00. Bu 2 saatlik pencere içinde kritik konular çözülüyor. Dışında toplantı açmak için CTO onayı gerekiyor.

## Dokümantasyon Disiplini

Asenkron kültürün çekirdeği dokümantasyon. Her feature'ın Notion sayfası var: problem, çözüm, tradeoff, deployment checklist. Backend değişikliği yapılırsa frontend ekibi Notion'dan öğreniyor, Slack'te soru sormadan.

Dokümantasyon yazma hızını artırmak için template kullanıyoruz. Feature dokümantasyonu şu yapıda:

```markdown
# Feature: {Ad}

## Problem
{Hangi kullanıcı sorununu çözüyor}

## Çözüm
{Teknik yaklaşım}

## Tradeoff
{Ne kazandık, ne kaybettik}

## Deployment
- [ ] Backend migration
- [ ] Frontend deploy
- [ ] Analytics event check
- [ ] Rollback plan

## Related Linear Tickets
{Link}
```

Bu template sayesinde dokümantasyon 15 dakikada tamamlanıyor. Boş bırakılan alan varsa Linear'da "documentation incomplete" label'ı otomatik düşüyor.

Kod tabanında da async disiplin var: her PR'ın description'ı "ne değiştirdi" yerine "neden değiştirdi" sorusunu cevaplıyor. Review eden kişi context'i anlamak için soru sormuyor, PR açıklaması yeterli oluyor.

## Branding ve Uzaktan Ekip

Coğrafi dağılım sadece operasyonel değil, marka tutarlılığı sorununu da getiriyor. Lizbon'daki designer'ın çizdiği görsel İstanbul'daki branding stratejisiyle uyumlu olmayabilir. Bu yüzden [marka identity sistemimiz](https://www.roibase.com.tr/tr/branding) Figma + Notion üzerinde merkezi yönetiliyor — herkes aynı komponenti, aynı renk paletini, aynı ton of voice rehberini kullanıyor. Asenkron çalışmanın başarısı dokümante edilmiş sistem disipliniyle ölçülür.

## Metrik ve Sonuç

Üç yıllık async dönüşümün sayısal sonuçları:

- Sprint velocity: 23 story point/sprint → 32 story point/sprint (%40 artış)
- Toplantı süresi: 8 saat/hafta → 3 saat/hafta (%60 azalış)
- PR review süresi: 18 saat ortalama → 6 saat ortalama
- Dokümantasyon coverage: %40 → %85

Ekip büyürken async kültür daha kritik hale geliyor. 5 kişilik ekip senkron çalışabilir, 15 kişilik ekip çalışamaz. 4 time zone'a yayılınca "herkes online olsun" stratejisi fiziksel olarak imkansız. Asenkron kültür lüks değil zorunluluk.

Async disiplin aynı zamanda kayıt kültürü demek. Linear'da yazılmayan karar yok sayılır, Notion'a düşmeyen feature yok sayılır. Bu disiplin ilk başta yavaşlatıyor gibi görünür — "şu konuyu 5 dakikada konuşsak biter" diyorsun. Ama 5 dakikalık konuşma kayıt tutulmadığı için 3 ay sonra tekrar konuşuluyor, aynı soru yeniden soruluyor. Yazılı kayıt tek seferlik yatırım, sonsuz geri dönüş.