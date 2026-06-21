---
title: "ASO Creative Testing: PPO ile 6 Haftada +%32 IPM"
description: "Custom Product Pages və Play Experiments istifadə edərək App Store vizual testləri statistik əminsizliyə əsaslandıran 6 həftəlik praktika."
publishedAt: 2026-06-21
modifiedAt: 2026-06-21
category: gaming
i18nKey: gaming-001-2026-06
tags: [aso, custom-product-pages, play-experiments, creative-testing, mobile-gaming]
readingTime: 8
author: Roibase
---

App Store'da organik kazanım artık tek bir store listing sayfasıyla sınırlı değil. Apple'ın Custom Product Pages (CPP) və Google'ın Play Experiments özellikleri, farklı kullanıcı segmentlərinə farklı vizual variyasyonlarını göstərmə imkanı vərir. Lakin əksər mobile game ekibi bu aletləri kampaniya əsaslı denəmə aracı kimi istifadə edir — statistik əhəmiyyətli test dizaynı əvəzinə "bir dənilərik" məntiqilə. 6 həftəlik nəzarətlü bir ASO creative testing prosesi, impression-to-install (IPM) metrikasında %32'lik artış təmin etdi. Bu məqalə həmin prosesin metodologiyasını və təkrar edilə biləcək addımlarını çatdırır.

## Custom Product Pages: Segmentasiya, Kampaniya Deyil

CPP xüsusiyyəti 2021'dən bəri mövcuddur, lakin geniş istifadə hələ "ölkə X üçün xüsusi səhifə" və ya "influencer kampaniyası üçün xüsusi landing" səviyyəsində. Amma CPP'nin əsl dəyəri, müxtəlif akquisyon mənbələrinə görə yaradıcı fərziyyələri sınamaq imkanıdır.

Bir RPG oyunu üçün yürütdüyümüz testdə 3 müxtəlif CPP variyasyonu quruldu: (1) personaj odaqlı (qəhrəman yaxından görünüş screenshot dəsti), (2) oyun mexanikası odaqlı (döyüş mexanikası görsəlləri), (3) dünya qurulması odaqlı (ətraf sənəti + fəsanə ipuçları). Hər variyasiya Apple Search Ads'də müxtəlif açar söz qruplarına təyin edildi. Personaj odaqlı CPP, brand axtarışında %41 daha yüksək IPM göstərdi. Oyun mexanikası odaqlı CPP isə jenerik RPG açar sözlərində %28 daha yaxşı performans verdi.

Burada kritik nöqtə: CPP'ni kampaniya səviyyəsində deyil, akquisyon niyyəti səviyyəsində düşünmək. İstifadəçi "oyun adı" axtarırsa artıq qərarını vermişdir — ona personaj yaxını göstərmək daha effektiv. "best rpg 2026" axtarırsa oyunu tanımır — ona mexanika göstərmək lazımdır.

## Play Experiments: Confidence Interval ilə Qərar Vermək

Google Play Console'daki Experiments xüsusiyyəti A/B test infrastrukturu təmin edir, lakin standart parametrləri əksər test üçün çatışmır. %95 inamlılıq istəyirsənsə, minimum 1000 konversiya (qurulum) tələb olunur. Lakin bir çox oyun günə 200-300 organik qurulum alır — bu halda test müddəti 5+ həftəyə uzanır və fəsilə dəyişikliyi nəticələri xərab edir.

Biz 6 həftəlik dövrədə 2 ardıcıl test icra etdik. Birinci test: screenshot sıralanması (hərəkat əvvəl vs hekayə əvvəl). İkinci test: icon rəng paleti (isti vs soyuq). Hər test üçün minimum nümunə ölçüsü hesabını əsas IPM (%18) və hədəf artış (%15 nisbi artım) əsasında etdik. G*Power ilə güc analizi nəticəsi: test başına ən azı 1200 təssürat + %5 IPM əsası üçün 840 qurulum gərəkdi.

Birinci testdə 14 gün sonra inamlılıq %82'də qaldı. Testi dayandırmaq əvəzinə traffic bölünmə nisbətini dəyiştirdik: variyanta %70 göndərərək, kontrol'ə %30 qaldırdıq. Bu yolla 21. gündə %95 inamlılığa çatdıq. Google Play'in standart %50-%50 bölünməsi ideal deyil — Bayesian yanaşma ilə trafiqi qalib tərəfə keçirmək həm daha sürətli nəticə verir həm də fürsət xərci azalır.

### Test Dizayn Yoxlama Siyahısı

- Əsas IPM ən azı 100 təssürat əsasında hesabla (səs-küyü təmizlə)
- Hədəf artış %10'un altındadırsa test etmə — nümunə ölçüsü çox böyük olacaq
- Fəsilə kampaniyası varsa testi ertələ (Black Friday, il sonu satış)
- Variyant sayını 3'lə məhdudlaş — 5+ variyant inamlılıq müddətini katlıyor

## Screenshot Bəyanatı: Aktiv Deyil Hekayə Ardıcıllığı

Mobil oyun screenshot'ları hələ də "ən yaxşı 5 səhnə qoy" məntiqilə seçilir. Amma App Store sürüşmə sürəti 1.2 saniyə/screenshot — istifadəçi hekayə görmək istəyir, kataloq deyil.

Bəyanat ardıcıllığı testi üçün 2 variyant hazırladıq: (A) təsadüfi gözəl səhnələr, (B) təlim axını sırasına görə düzülmüş irəliləmə. B variyantı %19 daha yüksək IPM getirdi. Niyə? Çünki birinci screenshot "bu oyunda nə edəcəksən" sualına cavab verdi, ikinci screenshot "necə edəcəksən" göstərdi, üçüncü screenshot "nə qazanacaqsan" bildirdi. A variyantında sıra təsadüfi olduğu üçün koqnitiv yük artdı.

Screenshot bəyanatını video ilə dəstəklədik. 30 saniyəlik önizləmə video, screenshot 2 ilə 3 arasında avtomatik olaraq oynadıldı. Video'da əsas döngü göstərildi: tap → swing → loot → upgrade. Bu 4 elementli döngüyü 6 saniyədə göstərdik, qalan 24 saniyəni irəliləmə açılışlarına ayırdıq. Video'lu CPP, video'suz CPP'yə nisbətən %14 daha yüksək IPM verdi, amma qurulum başına xərc %9 artdı (video aktiv xərci səbəbilə). Dəyişdirmə qəbul edilə bilinən çıxdı, çünki Gün 1 saxlanma video qrupunda %8 daha yüksək idi — yəni istifadəçi oyunu bilərək yüklədiyini, "aldatıldığını" deyil.

## Statistik Əhəmiyyət: Erkən Bağlama Tələsi

Testlərin %40'ı erkən başa çatdırılır. Səbəb: ilk 3-4 gündə variyant %20+ artış göstərir, ekip "qazandı" deyir, test bağlanır. Sonra 2 həftə sonra IPM geriyə döner — çünki erkən dövrə auditoriya özü seçilmiş (marka fanatı), ümumi kütlə belə davranmır.

Biz minimum 14 gün qaydası qoyduk — inamlılıq %99 olsa belə. Çünki mobil oyun trafiğində həftə içi/həftə sonu nümunə var. Şənbə günü organik qurulum %35 artır, Salı günü %18 azalır. Bir variyant Şənbəyə denk gəlirsə süni üstünlük əldə edir. 14 gün 2 həftə sonunu əhatə edir — nümunə effekti sıfırlanır.

İkinci qayda: qurulumdan sonra metrikaya bax. IPM artımı yaxşıdır, amma Gün 7 saxlanması aşağıdırsa, yanlış kütləni çəkiyorsun. Xüsusən icon testlərində bu tez-tez görülür — click-bait icon IPM'ni artırır, amma saxlanmanı başa vurmaz. Bizim icon testində soyuq paleti variyantı IPM'də %11 öndeydəyken, Gün 7'də %6 geridə qaldi. Test dayandırıldı, isti paleti istifadə edildi.

## Play Store vs App Store: Platforma Fərqləri

Apple və Google'ın test infrastrukturları fərqli işləyir. Apple'da CPP başına 35 variyasyon hakkı var, lakin hər CPP'ni əl ilə URL ilə paylaşmaq lazımdır (Apple Search Ads kampaniyalarına təyin edilir). Google'da Experiments birbaşa trafiqi bölür, əl ilə URL lazım deyil.

Bizim prosesdə Apple Search Ads vasitəsilə 6 müxtəlif CPP'yə trafik göndərdik. Hər CPP'nin öz UTM parametresi vardı (`&ct=cpp_hero`, `&ct=cpp_gameplay` və s.). Bu şəkildə Apple Search Ads Console'da hansı creative'in hansı açar söz'də işlədiyini görmək mümkün oldu. Google Play'də belə dəqiq izləmə yoxdur — Experiments yalnız qlobal IPM farkını raporlaşdırır. Bu səbəbdən Google'da test ssenariləri sadə tut (2 variyant maksimum), Apple'da daha mürəkkəb fərziyyələr qurup.

Başqa bir fərq: Apple'ın xüsusi screenshot hüdu 10, Google'ınkı 8. Biz Apple'da 10 screenshot'ın hamısını istifadə etdik, Google'da 6 ilə məhdudlaşdıq. Səbəb: Google Play'də sürüşmə sürəti daha aşağıdır — istifadəçi 3. screenshot'dan sonra artıq qərar vermişdir. Əlavə screenshot əlavə etmək engagement artırmır, səhifə yükləmə müddətini uzadır.

## 6 Həftəlik Proses: Həftə-Həftə Ümumarx

| Həftə | Fəaliyyət | Metrika |
|---|---|---|
| 1 | Əsas ölçmə (mövcud mağaza siyahısı) | IPM %18.2, D7 %24.1 |
| 2 | CPP variyant 1-2-3 buraxılış (Apple), screenshot testi başladı (Google) | Trafik bölünməsi başladı |
| 3 | Günlük nəzarət, erkən siqnal nəzərdən keçirmə | Hələ qərar yoxdur (nümunə <500) |
| 4 | Apple CPP trafik keçidi (%70 qəhrəman variyant), Google inamlılığı %78 | IPM %21.3 (qəhrəman), %19.8 (oyun mexanikası) |
| 5 | Google testi başa çatdı, qalib variyant canlı | IPM %22.1, D7 %25.8 |
| 6 | Apple son trafik keçidi (%100 qəhrəman), icon testi başladı | IPM %24.0, 6 həftəlik delta %+32 |

Proses boyu UA kampaniyası büdcəsi heç bir dəyişikliyə uğramadı — tamamilə organik artım. Apple Search Ads xərci sabit saxlanıldı (günlük $120), Google UAC bağlandı. Bu sayədə creative testing'in xalis effekti təcrid edildi.

Son həftə icon testi başlayanda, əvvəlki testlərin qalib variyantları əsas kimi istifadə edildi. Yəni yeni test, köhnə qalib'in üstünə quruldu — birləşmiş effekt. Icon testi 8 həftə davam etdi (bu məqalənin əhatə dairəsinin kənarında), lakin ilk 6 həftənin təmin etdiyi %32 artım, canlı-ops təqvimi üçün daha yaxşı əsas təmin etdi.

## Roibase'in [App Store Optimization](https://www.roibase.com.tr/ru/aso) Yanaşması

Bu proses boyu ASO yalnız açar söz tədqiqi və ya metadata yenilənməsi deyil, creative mühəndislik kimi kurgulandı. Hər screenshot, hər icon variyantı, hər video çərçivəsi məlumat-ixtiyar qərar nəticəsi olaraq yaradıldı. Test nəticələri BigQuery'yə pipeline edildi, LTV/D30 kohort analizi ilə birləşdirildi. Hansı creative variyantın hansı istifadəçi seqmentini gətirdiyi, sonradan hansı IAP davranışı göstərdiyi izləndi.

Məsələn, qəhrəman-odaqlı CPP'dən gələn istifadəçilərin %18'i ilk 48 saatdə personaj dərisi satın aldı. Oyun mexanikası-odaqlı CPP'd