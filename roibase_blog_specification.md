# Roibase Otonom Blog Ekosistemi: Teknik Spesifikasyon Belgesi

## 1. Vizyon ve Mimari Özet
Bu belge, **Roibase** markası için 0 insan müdahalesi ile çalışan, 7 dilde yayın yapan ve teknik otoriteyi temsil eden bir **"Otonom Teknoloji Merkezi"** inşası için hazırlanmıştır.

- **URL Yapısı:** `blog.roibase.com.tr/[dil-kodu]/[slug]`
- **Teknoloji Yığını:** Vue.js (Nuxt 3), Tailwind CSS, Nuxt Content v2.
- **Diller:** TR, EN, DE, FR, ES, IT, AR.
- **Temel Felsefe:** Görsel içermeyen, ultra-minimalist, tipografi odaklı "Premium Tech" estetiği. Asimetrik layout ve dark-light mod geçişleri ile görsel derinlik sağlanacaktır.

## 2. Kategoriler ve İçerik Stratejisi (7x7)
Sistem, her hafta her kategori için 1 adet olmak üzere toplam 49 özgün yazı üretir (7 dilde toplam 343 yayın).
1. **AI:** Yapay zeka modelleri, otomasyon ve gelecek trendleri.
2. **Marketing:** Performans pazarlaması, strateji ve büyüme.
3. **Tech:** Yazılım geliştirme, mimari ve modern frameworkler.
4. **Data:** Analitik, tracking (sGTM), BigQuery ve veri mimarisi.
5. **Gaming:** Dijital oyun kültürü, teknoloji ve e-spor.
6. **Travel:** Dijital göçebelik, teknoloji şehirleri ve gezi rehberleri.
7. **Lifestyle:** Verimlilik, çalışma kültürü ve modern yaşam.

## 3. n8n Otonom İş Akışı (The Master Flow)
n8n üzerindeki akış şu mantıkla kurgulanacaktır:

### A. Keşif ve Karar (Discovery Phase)
- **GSC Entegrasyonu:** n8n, Google Search Console API'ye bağlanır.
- **Fırsat Analizi:** Tıklaması düşük (low CTR) ama gösterimi yüksek (high impression) anahtar kelimeleri veya yeni trend olan "Query"leri tespit eder.
- **Konu Belirleme:** GSC verilerini ve 7 kategoriyi harmanlayarak "Günlük Yazı Planı" oluşturur.

### B. Üretim ve Yerelleştirme (Production Phase)
- **Claude 4.7 API:** Belirlenen konuyu, Roibase marka diline uygun olarak "Master Language" (genellikle EN veya TR) formatında yazar.
- **Çoklu Dil Fabrikası:** Ana metin onaylandıktan sonra diğer 6 dile yerelleştirme (localization) yapılır.
- **Akıllı Linkleme:** Claude, `roibase.com.tr/sitemap.xml` verisini kullanarak, metin içindeki teknik terimlere ilgili dildeki hizmet sayfasına (Örn: `/en/seo`) doğal backlinkler ekler.

### C. Doğrulama ve Yayın (Validation & Deployment)
- **Validation:** Markdown syntax kontrolü ve linklerin 200 OK durum kontrolü n8n içinde otomatik yapılır.
- **GitHub API:** Hazırlanan 7 dildeki `.md` dosyaları doğrudan GitHub reposuna push edilir.
- **Vercel/Netlify:** Push sonrası "Auto-Deploy" tetiklenir, site statik (SSG) olarak ayağa kalkar.

## 4. Frontend Detayları ve Zenginleştirme
### A. Asimetrik Görsel Şov
- Görsel yerine CSS Grid (`grid-template-areas`) ve `clip-path` kullanılarak modern, dergi kapağı tadında asimetrik yapılar kurulur.
- Scroll-triggered animasyonlar ile Dark/Light modlar arasında yumuşak geçişler (harmanlama) yapılır.

### B. İnteraktif Elementler (ROI Calculators)
- Claude, yazı içerisine `<roi-calculator />` veya `<data-tracking-preview />` gibi özel Vue tagleri enjekte eder.
- Nuxt Content, bu tagleri canlı Vue bileşenleri olarak render ederek kullanıcı etkileşimini artırır.

### C. SEO & Meta
- **Hreflang:** Tüm diller arası çapraz linkleme (cross-linking) otomatik yapılır.
- **Schema.org:** JSON-LD formatında `Article`, `FAQ` ve `Breadcrumb` işaretlemeleri her sayfaya dinamik basılır.

## 5. Dağıtım ve Bildirim
- **OneSignal:** Yeni yazı yayına girdiği an, o dildeki kullanıcılara UTM parametreli (push) bildirim gönderilir.
- **Email Report:** Süreç sonunda yöneticiye (Roibase ekibi) tüm dillerdeki linkleri içeren "İşlem Tamamlandı" raporu mail atılır.

## 6. Güvenlik ve Bot Engelleme
- `blog.roibase.com.tr` indekslemeye açık iken, `docs` ve `offer` subdomainleri için global middleware ile bot engelleme ve şifreli erişim katmanları uygulanacaktır.

---
**Komut:** Claude, yukarıdaki spesifikasyonlara göre bana tam `nuxt.config.ts`, klasör yapısı, n8n JSON workflow dökümü ve içerik üretiminde kullanılacak 'Expert System Prompt'u hazırla.