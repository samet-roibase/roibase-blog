# n8n Otonom Yayın Workflow'u

> **Senaryo A:** 8 saatte bir cron, her run'da 1 kategori (round-robin), 7 dilde içerik üretimi, atomik commit.
>
> **Çıktı hızı:** 7 kategori × 3 run/gün = günde 3 makale × 7 dil = 21 dosya/gün, haftada ~21 makale.

## Mimari özet

```
n8n cron (8h) → GSC fetch → opportunity scoring → IF eşik geçti → Claude TR
              → Claude × 6 (paralel çeviri) → validation → GitHub commit
              → wait deploy → OneSignal push × 7 → email rapor
```

Workflow `https://n8n.roibase.com.tr/` içinde tutulur. JSON export'lar:

- **`workflow/test-tr-only.json`** — Faz A1 testi: sadece TR makale üretimi, dry run. İlk doğrulama için.
- **`workflow/main.json`** — Faz B1: TR + 6 dil çeviri, dry run (henüz GitHub commit yok). Tam yayın pipeline'ına yakın.
- _İleride_ `workflow/main-with-commit.json` — Faz B2: GitHub commit + Outplane deploy bekleme + OneSignal.

**Model seçimi (kalibre edildi):**
- Master TR + çeviriler: `claude-haiku-4-5-20251001` — hız + maliyet odaklı
- Kalite yetersizse master için Sonnet 4.6'ya yükseltilebilir (4-5x maliyet)

---

## Repo'da otomasyon için tutulan dosyalar

| Dosya | Amaç | Kim okur/yazar |
|---|---|---|
| `prompts/master-tr.md` | Claude SYSTEM prompt — TR ana makale | n8n okur |
| `prompts/categories/{cat}.md` | Kategori-spesifik prompt eki (7 dosya) | n8n okur |
| `prompts/translate.md` | TR→6 dil çeviri prompt'u (placeholder'lı) | n8n okur |
| `scripts/internal-links.json` | İç link havuzu (Claude'a verilir) | n8n okur |
| `scripts/category-rotation.json` | Round-robin state | n8n okur + yazar |
| `content/{lang}/{cat}/{slug}.md` | Üretilen makaleler | n8n yazar |

Tüm dosyalar GitHub raw URL'inden çekilir:
```
https://raw.githubusercontent.com/samet-roibase/roibase-blog/main/{path}
```

---

## n8n credential'ları

| Credential | Tip | Kullanım |
|---|---|---|
| `Claude API` | Header Auth (`x-api-key: sk-ant-...`) | Master + 6 çeviri |
| `GitHub API` | OAuth2 ya da PAT (`Bearer ghp_...`) | Repo read/write |
| `Google Search Console` | Service Account JSON | Keyword fırsat datası |
| `OneSignal` | Header Auth (`Basic os_v2_...`) | Push notification |
| `Resend` (opsiyonel) | Header Auth (`Bearer re_...`) | Yayın raporu maili |

---

## Workflow node'ları (sırayla)

### 1. Cron Trigger
- Her gün 09:00, 17:00, 01:00 (UTC+3) — 8 saat aralık
- n8n cron expression: `0 1,9,17 * * *` (UTC: `0 22,6,14 * * *`)

### 2. HTTP Request — `category-rotation.json` oku
- Method: GET
- URL: `https://raw.githubusercontent.com/samet-roibase/roibase-blog/main/scripts/category-rotation.json`
- Cache buster için query parametresi: `?_=${Date.now()}`

### 3. Code (JavaScript) — Sıradaki kategoriyi belirle
```js
const data = $input.first().json;
const nextIndex = (data.lastIndex + 1) % data.order.length;
const category = data.order[nextIndex];
return [{ json: { category, nextIndex, rotation: data } }];
```

### 4. HTTP Request — `scripts/topic-pool/{category}.json` oku
- Method: GET
- URL: `https://raw.githubusercontent.com/samet-roibase/roibase-blog/main/scripts/topic-pool/{{ $json.category }}.json`
- Cache buster: `?_=${Date.now()}`

> **Not:** Faz 2A için **statik konu havuzu** kullanılıyor. GSC eklendiğinde bu node'u GSC API'siyle değiştirip dinamik fırsat seçimine geçilecek.

### 5. Code — Sıradaki konuyu seç
```js
const pool = $input.first().json;
const cat = $('Pick Category').item.json.category;

// Önce hiç kullanılmamış konuları al; yoksa en eski kullanılanı seç
let candidates = pool.topics.filter(t => !t.lastUsedAt);
if (candidates.length === 0) {
  candidates = [...pool.topics].sort((a, b) =>
    new Date(a.lastUsedAt) - new Date(b.lastUsedAt)
  );
}
const topic = candidates[0];
return [{ json: { topic, category: cat, pool } }];
```

### 6. (GSC eklenince eşik kontrolü buraya gelecek)
Şimdilik atlandı — topic pool'dan konu seçilince hep devam.

### 7. Code — i18nKey + tarih + slug stub üret
```js
const cat = $('Category').item.json.category;
const today = new Date().toISOString().slice(0,10); // YYYY-MM-DD
const ymonth = today.slice(0,7); // YYYY-MM
const queryStub = $input.first().json.query
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .slice(0, 30);
const i18nKey = `${cat}-${queryStub}-${ymonth}`;
return [{ json: { category: cat, today, i18nKey, query: $input.first().json.query, gscContext: $input.first().json } }];
```

### 8. HTTP Request — `prompts/master-tr.md` + `prompts/categories/{cat}.md` çek
- 2 paralel HTTP GET, sonuçları text olarak al

### 9. HTTP Request — `scripts/internal-links.json` çek
- byCategory[currentCat] listesini Claude'a vermek için

### 10. HTTP Request — Claude API: TR master makale
- POST `https://api.anthropic.com/v1/messages`
- Header: `x-api-key`, `anthropic-version: 2023-06-01`
- Model: `claude-opus-4-7` (kalite için) ya da `claude-sonnet-4-6` (cost için — başlangıçta önerilir)
- max_tokens: 4096
- system: `master-tr.md` içeriği
- messages: `[{role: 'user', content: 'KEYWORD: ... \nCATEGORY: ...\nINTERNAL_LINKS: [...] \nTODAY: ... \nI18N_KEY: ... \nGSC_CONTEXT: ...\nCATEGORY_GUIDANCE: {{ kategori prompt'u }}'}]`

### 11. Code — TR makaleyi parse et + slug üret
```js
const text = $input.first().json.content[0].text;
// frontmatter --- ile body'yi ayır
const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const fm = m[1], body = m[2];
const titleMatch = fm.match(/title:\s*"([^"]+)"/);
const title = titleMatch[1];
// slug: Türkçe karakter dönüşümü + kebab-case
const slug = title.toLowerCase()
  .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
  .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
return [{ json: { lang: 'tr', slug, frontmatter: fm, body, fullContent: text } }];
```

### 12. Split + 6 paralel Claude çeviri çağrısı
6 ayrı HTTP node, her biri:
- Model: `claude-haiku-4-5-20251001` (çeviri için yeterli, cost düşük)
- system: `translate.md` (placeholder'lar workflow'da string-replace ile doldurulmuş)
- user: TR makalenin tam içeriği (`fullContent`)

Diller: en, de, es, fr, it, ru. Her yanıt:
- İlk satır: `SLUG: ...`
- Sonra `---` frontmatter `---` body

### 13. Code — Çevirileri parse et
```js
// Her dil için: SLUG satırı + frontmatter + body ayrıştır
// 6 dil + 1 TR = 7 dosya objesi
const files = []; // [{lang, slug, content}]
// ...
return files;
```

### 14. Code — Validation
- Frontmatter zorunlu alanlar: title, description, publishedAt, category, i18nKey, author
- i18nKey 7 dosyada AYNI olmalı
- Body min 800 / max 1500 kelime
- Markdown parse hatası yok

Hata varsa: workflow durdur, Slack/email alert.

### 15. HTTP Request — `category-rotation.json` güncelle (içerikle aynı commit)
Memory'de tutulur, GitHub commit'inde dosya olarak push edilir.

### 16. Code — GitHub commit body hazırla
- 7 makale dosyası: `content/{lang}/{cat}/{slug}.md`
- 1 rotation güncellemesi: `scripts/category-rotation.json`
- Commit message: `Auto: {category} — {title-tr}`

### 17. HTTP Request — GitHub Contents API (tek tek dosya commit)
n8n'de "GitHub" native node ile her dosya için bir PUT veya tek tree commit oluştur.

**Önerilen:** `git data` API ile blob → tree → commit → ref update zinciri. Tek commit garantili.

### 18. Wait — Outplane deploy bitsin
- Polling: HEAD `https://blog.roibase.com.tr/{lang}/{cat}/{slug}` her 30sn, 200 OK olunca devam
- Timeout: 10 dakika

### 19. Loop — OneSignal push × 7
Her dil için ayrı push:
- Title: makale başlığı (lokal dilde)
- Body: ilk 100 karakter description
- URL: `https://blog.roibase.com.tr/{lang}/{cat}/{slug}?utm_source=onesignal&utm_medium=push&utm_campaign={i18nKey}`
- Audience: `language=={lang}` filter

### 20. Email rapor
Resend API ya da SMTP. Konu: `Roibase Blog — {category} • {date}`. Body: 7 dilin URL listesi + GSC context (hangi keyword tetikledi).

---

## İlk kurulum sırası (öneri)

1. n8n credential'larını ekle (4-5 adet)
2. **Dry-run modu:** GitHub commit yerine "log only" — node 17'i devre dışı, çıktıyı n8n execution viewer'da incele
3. 1 kategori için elle Claude TR + 1 çeviri test et — output formatı doğru mu?
4. Validation node'unu test et (kasten bozuk içerikle)
5. GitHub commit aç, küçük workflow ile gerçek commit yap (1 dosya)
6. 7 dil paralel çeviri tam testini yap
7. Cron'u aktif et — ilk run sonrası dikkatli incele
8. OneSignal + email node'larını ekle (yayın doğru çalıştıktan sonra)

## Maliyet tahmini (Senaryo A)

- Master TR (Sonnet 4.6): ~$0.05/run × 21 run/hafta = ~$1.05/hafta
- 6 çeviri (Haiku 4.5): ~$0.01 × 6 × 21 = ~$1.26/hafta
- Toplam: **~$10/ay** Claude API
- n8n hosting: $0 (Outplane'de mevcut)
- OneSignal: $0 (free tier 10K subscriber'a kadar)

## Genişletilebilirlik notları

- **Yeni dil eklemek:** `config/locales.ts` + `i18n/master.json` + `prompts/translate.md` dil-spesifik notu + n8n'de yeni paralel çeviri node'u
- **Yeni kategori eklemek:** `config/categories.ts` + `i18n/master.json` + `prompts/categories/{new}.md` + `scripts/internal-links.json` byCategory + `scripts/category-rotation.json` order
- **Trigger frekansını değiştirmek:** Sadece Cron node'u değişir; round-robin state korunur
- **Manuel yayın yapmak:** Workflow'u manual trigger ile çalıştır, GSC node'unu skip et, kategori + keyword'ü hardcoded ver
