---
title: "Creative Operations: Bidding Algoritmasına Beslenecek Variation Stratejisi"
description: "Performance Max ve Advantage+ kampanyalarında kreatif test mimarisi: algoritma için signal üretmek, variation sistemi kurmak, winneri ölçeklendirmek."
publishedAt: 2026-05-16
modifiedAt: 2026-05-16
category: marketing
i18nKey: marketing-005-2026-05
tags: [creative-operations, performance-max, advantage-plus, bidding-algorithm, creative-testing]
readingTime: 8
author: Roibase
---

Google Performance Max ve Meta Advantage+ kampanyalarında kreatif artık sadece mesaj değil — algoritmanın öğrenme malzemesi. Makine bidding'in gücü, beslendiği varyasyon setinin zenginliğiyle doğru orantılı. Ama çoğu ekip hâlâ kreatifi tasarım departmanına havale edip "güzel görseller" bekliyor. Sonuç: kampanya 2 hafta boyunla sinyale aç kalıyor, algoritma dar bir alanda lokal optimuma sıkışıyor, CPA yükseliyor. Creative operations — kreatif üretimini, test mimarisini ve signal besleme sürecini mühendislik disipliniyle kurmak — bu döngüyü kırmak için kritik.

## Kreatif artık iterasyon sorunu, tasarım sorunu değil

Performance Max ve Advantage+ gibi otomatik kampanya formatlarında kreatif, bid ayarı kadar günlük bir operasyon haline geldi. Kampanyaya 3 görsel + 5 headline verip "öğrenme fazı 14 gün" diye beklemek, algoritmanın makul bir karar verebildiği minimum veri havuzunu bile oluşturmuyor. Google'ın kendi rehberinde Performance Max'te en az 4 asset grubu, her birinde 5-15 görsel + 5 başlık kombinasyonu tavsiye ediliyor — bunun sebebi algoritmanın exploration/exploitation dengesini kurmak için yeterli çeşitlilik istemesi.

Ama sorun sadece sayı değil — kreatifler arasında anlamlı farklılıklar olmazsa algoritma yine dar alanda döner. Aynı ürünün 5 açıdan çekilmiş fotoğrafı, makine için aynı signal cluster'ında. Bunun yerine farklı value proposition (fiyat vs. teslimat vs. sosyal kanıt), farklı format (statik vs. carousel vs. video), farklı kitle proxy (lifestyle vs. product-focus) üzerinden varyasyon inşa etmek gerekiyor. Kreatif üretimi tasarımcının Adobe dosyasından çıkıp, growth ekibinin template × değişken matrisine dönüşmeli.

Roibase'in [dijital pazarlama](https://www.roibase.com.tr/tr/dijitalpazarlama) pratiğinde kreatif operasyonunu şöyle kuruyoruz: haftalık kreatif sprint, her sprint 8-12 yeni variation, her variation bir hipotezi test ediyor (angle değişikliği, hook testi, CTA iterasyonu). Tasarımcı süreci yavaşlatmıyor — Figma'da component library + değişken setleri + bulk export ile operasyon hızlanıyor. Bir kampanyaya 2 haftada 20+ unique kreatif beslenebiliyor, algoritmanın 2. haftada zaten kazanan cluster'ı bulması için yeterli variation oluşuyor.

## Signal üretimi için test mimarisi: cohort + holdout

Kreatif variation üretmek yetmiyor, bunları algoritmanın öğrenebileceği şekilde organize etmek gerekiyor. Performance Max'te her asset grubu ayrı bir test hücresi gibi çalışıyor — ama sadece rastgele variation dağıtırsanız hangisinin kazandığını bilemezsiniz, çünkü asset grubu düzeyinde performans Google'ın siyah kutusunda kalıyor. Bunun yerine cohort bazlı test mimarisi kuruyoruz: her dönemde (örneğin 2 hafta) yeni bir asset grubu yaratıyoruz, içine o dönemin variation setini besliyoruz, eski kazananlar "control" grubunda kalıyor. 2 hafta sonra yeni grubun performansını (ROAS, CVR, CPA) control ile kıyaslayıp kazanan variation'ları genişletiyoruz.

Bu yapı Bayesian testing mantığıyla birleşiyor: Her asset grubu bağımsız bir dağılım oluşturuyor, posterior güncellemesi anlık olarak hesaplanabiliyor (Google Ads API ile dönüşüm + maliyet datasını çekip kendi hesaplamanı yapıyorsun). 7 gün içinde %95 confidence'a ulaşan variation varsa onu hemen ana budget asset grubuna taşıyorsun. Ulaşmıyorsa 14 gün sonuna kadar bekleyip o kohortu kapatıyorsun. Bu şekilde statik "kampanya setup" yerine sürekli signal pipeline oluşuyor.

Meta Advantage+ tarafında durum biraz farklı — asset düzeyinde performans Meta'nın "Ads Reporting" arayüzünde görünüyor, ama breakdown bazında. Burada holdout cell kullanmak daha kritik: Yeni kreatif setini test etmek için ayrı bir kampanya (yeni kreatifler) vs. kontrol kampanya (eski kazananlar) şeklinde ayırıyorsun, budget split 20/80 gibi. 1 hafta boyunca ikisinin de aynı audience targeting'e eriştiğinden emin oluyorsun (CBO açık, placement otomatik, lookalike geniş bırakılmış). 7. günde test kampanyasının CPA'sı kontrol kampanyasına göre %15+ düşükse yeni seti kazanan ilan edip kontrol kampanyasını da yeni kreatife geçiriyorsun.

```python
# Basit Bayesian winner hesabı (Google Ads API'den dönüşüm + maliyet çekince)
import numpy as np
from scipy import stats

def bayesian_winner(conversions_a, cost_a, conversions_b, cost_b, prior_alpha=1, prior_beta=1):
    # Beta dağılımı ile conversion rate posterior
    posterior_a = stats.beta(prior_alpha + conversions_a, prior_beta + (cost_a/10 - conversions_a))
    posterior_b = stats.beta(prior_alpha + conversions_b, prior_beta + (cost_b/10 - conversions_b))
    
    # Monte Carlo ile P(B > A)
    samples = 10000
    prob_b_wins = np.mean(posterior_b.rvs(samples) > posterior_a.rvs(samples))
    
    return prob_b_wins

# Örnek: Asset Group A: 120 dönüşüm, $2400 maliyet vs. B: 95 dönüşüm, $1800 maliyet
prob = bayesian_winner(120, 2400, 95, 1800)
print(f"B'nin kazanma olasılığı: {prob:.2%}")
# Eğer > 0.95 ise B kazanan, budget'ı B'ye kaydır
```

## Format çeşitliliği: statik, carousel, video, collection

Algoritmaların en çok signal aldığı nokta format değişikliği. Aynı mesajı hem statik görselde hem video'da hem carousel'de test etmek, makineye farklı kullanıcı davranış pattern'lerini öğrenme şansı veriyor. Örneğin Performance Max'te video asset'ler genelde discovery ve YouTube placement'larda servis ediliyor, statik görseller display'de — ama sen hangisinin daha iyi ROAS getirdiğini bilmiyorsun, algoritma biliyor. Ona seçenek vermezsen default placement mix'ini kullanıyor, optimal dağılımı bulamıyor.

Pratik olarak kreatif pipeline'ı şöyle kurabiliriz:

| Format | Üretim süresi | Test süresi | Kazanma oranı (Roibase datasından ortalama) |
|---|---|---|---|
| Statik (5 variation) | 2 gün | 7 gün | %40 (en az 1 kazanan çıkıyor) |
| Carousel (3 set, her biri 3 kart) | 3 gün | 10 gün | %25 (statikten daha az winner ama kazanınca lift büyük) |
| Video (15 sn, 3 variation) | 5 gün | 14 gün | %50 (kazanınca cost düşüşü %20+) |
| Collection (1 hero + 4 product) | 2 gün | 7 gün | %30 (e-commerce için güçlü) |

Video üretimi 5 gün gibi görünüyor ama bu profesyonel çekim değil — stock footage + product shot + text overlay ile template bazlı üretim. CapCut, Canva gibi araçlar zaten AI ile auto-assembly yapıyor. Önemli olan video'nun "sinematik" olması değil, ilk 3 saniyede hook vermesi ve CTA'nın net olması. Meta'nın kendi Creative Guidance raporu 3 saniye watch rate'e bakıyor — %50'nin altındaysa video işe yaramıyor demek.

Carousel formatında dikkat edilecek nokta: her kartın bağımsız bir mesaj taşıması. "Kart 1: ürün, Kart 2: fiyat, Kart 3: teslimat" gibi sıralı anlatım Meta algoritması için sinyal üretmiyor, çünkü kullanıcı %80 ihtimalle ilk karttan sonra kaymıyor. Bunun yerine her kart farklı bir value prop veya farklı bir SKU göstermeli — böylece algoritma "bu kullanıcı kart 2'ye tıkladı, demek ki X özelliğine ilgisi var" çıkarımı yapabiliyor.

## Incrementality ölçümü: kazanan kreatif mi, yoksa audience shift mi?

Kreatif test sonuçlarını yorumlarken en büyük tuzak: yeni kreatif setini launch edince ROAS yükseldi, "kazandık" dedin — ama aslında algoritma sadece daha kolay convert olan bir audience segmentine shift etti, toplam dönüşüm hacmi düştü. Buna pseudo-winner diyoruz. Bunu engellemek için incrementality check yapman gerekiyor: yeni kreatif setini test ederken toplam dönüşüm sayısının (sadece ROAS'ın değil) düşmediğinden emin ol. Eğer ROAS %20 yükseldi ama dönüşüm %15 düştüyse, algoritma sadece dar bir segmente odaklanmış demektir — bu uzun vadede scale problemi yaratır.

İki metod:

1. **Holdout geo test:** ABD'de eyalet bazlı split yap (örneğin California + Texas'ta yeni kreatif, Florida + New York'ta eski kreatif). 2 hafta sonra toplam dönüşüm artışına bak. Eğer yeni kreatifli geo'larda %10+ daha fazla dönüşüm varsa, bu gerçek lift.

2. **Budget pacing check:** Yeni kreatif setini test kampanyasına 20% budget verdin, kontrol kampanyasına 80% kaldı. Eğer test kampanyası hızlıca budget'ı tüketip "limited by budget" statusüne geçtiyse ve ROAS hâlâ yüksekse, bu gerçek kazanan. Ama budget yavaş tükeniyorsa ve ROAS yüksekse, algoritma dar segmentte dolaşıyor demek.

Roibase'in [performans pazarlaması](https://www.roibase.com.tr/tr/ppc) projelerinde geo-based incrementality testi mecbur yapıyoruz — özellikle $50K+ aylık budget'larda. Bunun için basit bir Python script Google Ads API + BigQuery ile dönüşüm datasını geo dimension'ında split edip t-test yapıyor. %95 confidence ile lift varsa kreatif winner, yoksa iteration devam ediyor.

## Automation: Figma API + bulk upload pipeline

Manuel kreatif upload süreci ölçeklemiyor. 20 variation × 3 format = 60 asset, her birini Google Ads'e tek tek yüklemek 2 saat alıyor. Bunun yerine automation pipeline kur:

1. **Figma → Export:** Figma'da component library'deki tüm variation'ları auto-export eden plugin (Figma REST API ile). Her variation bir JSON dosyası + PNG/MP4 export.
2. **Metadata injection:** JSON'da her variation'a tag ver (angle, format, audience proxy). Bu tag'ler sonra asset group assignment'ta kullanılacak.
3. **Google Ads / Meta bulk upload:** Google Ads API'nin `AssetService` endpoint'i ile batch upload yap. Meta tarafında Campaign Creation API kullan, her kreatif için `ad_creative` objesi oluştur.
4. **Auto asset group assignment:** Yeni variation'ları en düşük impression alan asset grubuna otomatik ata (böylece test hızlanır).

Bu pipeline'ı kurunca kreatif upload süresi 2 saatten 15 dakikaya düşüyor. Hatta cron job ile her Pazartesi sabahı otomatik olarak geçen haftanın kazanan kreatiflerini ana asset grubuna taşıyabiliyorsun.

```javascript
// Figma REST API ile component export (Node.js örneği)
const axios = require('axios');
const fs = require('fs');

const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = 'your-figma-file-key';

async function exportVariations() {
  const response = await axios.get(`https://api.figma.com/v1/files/${FILE_KEY}`, {
    headers: { 'X-Figma-Token': FIGMA_TOKEN }
  });
  
  const components = response.data.document.children
    .filter(node => node.type === 'COMPONENT')
    .map(node => ({ id: node.id, name: node.name }));

  for (const comp of components) {
    const imageUrl = await axios.get(`https://api.figma.com/v1/images/${FILE_KEY}?ids=${comp.id}&format=png`, {
      headers: { 'X-Figma-Token': FIGMA_TOKEN }
    });
    
    // Download ve Google Cloud Storage'a yükle
    const image = await axios.get(imageUrl.data.images[comp.id], { responseType: 'arraybuffer' });
    fs.writeFileSync(`./exports/${comp.name}.png`, image.data);
  }
}

exportVariations();
```

## Kazananı ölçeklendirme: creative refresh cycle

Bir kreatif kazandığında onu sonsuza dek kullanmak yanlış — creative fatigue gerçek. Meta'da ortalama 14 gün sonra aynı kreatifin frequency'si 3.5+'ya çıkıyor, CTR %30+ düşüyor. Google Performance Max'te fatigue daha yavaş oluyor (placement çeşitliliği sayesinde) ama 30 gün sonra yine etkisi azalıyor. Bunun için creative refresh cycle kur:

- **0-14 gün:** Yeni variation test et, kazananı bul.
- **14-30 gün:** Kazananı %70 budget'a çıkar, kontrolü %30'da tut.
- **30-45 gün:** Kazanan kreatifin micro-iteration'larını test et (aynı angle, farklı görseller).
- **45+ gün:** Kazanan kreatifi retire et, yeni döngü başlat.

Bu cycle sayesinde kampanya hiçbir zaman tek bir kreatife bağımlı kalmıyor, sürekli signal flow var. Bazı sektörlerde (özellikle fashion, gaming) cycle daha hızlı — 7 günde refresh gerekebiliyor. Bunu anlık CTR düşüşü ile tespit edebilirsin: eğer bir kreatifte son 3 günün CTR'si ilk 3 güne göre %20+ düşükse fatigue başlamış demek.

Kreatif operasyonunu disiplinli bir sistem haline getirmek, algoritma-driven kampanyaların temel yakıtını sağlamak demek. Variation üretimini haftalık sprint'e çevirmek, test mimarisini cohort bazlı kurmak, incrementality'yi ölçmek ve otomasyonla hızlandırmak — bu dört ayak algoritmanın öğrenmesi için gerekli malzemeyi kesintisiz besliyor. Sonuç: makine bidding 2. haftadan itibaren optimal dağılımı buluyor, CPA düşüyor, scale mümkün oluyor.