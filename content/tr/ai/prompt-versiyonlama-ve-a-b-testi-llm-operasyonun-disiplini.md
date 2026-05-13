---
title: "Prompt Versiyonlama ve A/B Testi: LLM Operasyonun Disiplini"
description: "Production LLM sistemlerinde prompt versiyonlama, evaluation pipeline'ları ve Promptfoo/LangSmith ile deterministik kalite kontrolü nasıl kurulur."
publishedAt: 2026-05-13
modifiedAt: 2026-05-13
category: ai
i18nKey: ai-004-2026-05
tags: [llm-ops, prompt-engineering, evaluation, mlops, ai-quality]
readingTime: 8
author: Roibase
---

LLM kullanan sistemlerde "çalışıyor" ile "production'da güvenilir" arasında 15 adım var. Pazarlama otomasyonunda Claude API'si markdown output üretiyor, müşteri yolculuğunda GPT segmentasyon yapıyor — ama prompt'u değiştirdiğinde nasıl emin oluyorsun ki regresyon yaratmadın? Yazılım mühendisliğinde versiyonlama, test coverage, CI/CD standart; LLM operasyonunda aynı disiplin yoksa her deployment kumar.

Promptfoo ve LangSmith gibi araçlar bu disiplini sağlıyor: prompt versiyonlama, deterministik evaluation, A/B testi, metrik tracking. Bu yazı production LLM sisteminde kalite kontrolünü nasıl inşa edeceğini gösteriyor — kod değil, infrastrüktür seviyesinde.

## Prompt'un Yazılım Kodu Olmadığı Yanılgısı

Çoğu ekip prompt'u "konfigürasyon dosyası" gibi görüyor — UI'da editör, Notion'da dokümantasyon, n8n workflow'unda hardcoded text node. Gerçekte prompt, sistemin davranışını tanımlayan executable specification. Ama versiyonlama yok, diff yok, rollback yok.

Git commit message'ı "fix typo" olan bir değişiklik, model output'unun tonunu değiştirip metrik'leri düşürebilir. Özellikle structured output senaryolarında (JSON schema, markdown frontmatter, SQL sorgusu) tek kelime format kırılması zincirleme hata yaratır. Örnek: `OUTPUT FORMAT: JSON` yerine `OUTPUT FORMAT: Valid JSON` yazınca model bazen açıklama paragrafı ekliyor — downstream parser crash, alert patlaması, 3 saat debugging.

Versiyonlama disiplini şu soruları yanıtlamalı:

- Hangi prompt versiyonu şu an production'da?
- 2 hafta önceki versiyonla şimdiki arasındaki performans farkı ne?
- A/B testinde hangi varyant conversion'ı 8% artırdı?

Bu soruları yanıtlayamıyorsan "AI operasyonu" yapıyorsun değil, manuel deney yürütüyorsun.

## Evaluation Pipeline: Output'u Ölçmenin Üç Katmanı

LLM output'unu değerlendirmek subjektif gibi görünür ama production sisteminde deterministik metrikler kurmak mümkün. Evaluation üç katmanda çalışır: syntax, semantics, business outcome.

**Syntax katmanı** — format uyumluluğu:
- JSON parse ediliyor mu?
- Markdown frontmatter geçerli mi?
- Beklenen field'lar mevcut mu?

Promptfoo'da `javascript` assertion ile kontrol ediliyor:

```javascript
assert: [
  {
    type: "javascript",
    value: "JSON.parse(output).title.length <= 60"
  },
  {
    type: "is-json",
    value: true
  }
]
```

**Semantics katmanı** — içerik kalitesi:
- Yanıt konuya uygun mu? (embedding similarity, cosine distance > 0.85)
- Yasaklı kelime var mı? (regex, token filtering)
- Ton doğru mu? (classifier model, sentiment score)

LangSmith'te custom evaluator:

```python
from langsmith import evaluate

def check_brand_compliance(run, example):
    forbidden = ["uzman", "lider", "devrim"]
    output = run.outputs["text"].lower()
    violations = [w for w in forbidden if w in output]
    return {"score": 0 if violations else 1, "violations": violations}

evaluate(
    dataset_name="marketing_blog_posts",
    evaluators=[check_brand_compliance]
)
```

**Business outcome katmanı** — gerçek etki:
- CTR değişti mi?
- Conversion düştü mü?
- Bounce rate arttı mı?

Bu katman production telemetry ile bağlanır — [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/tr/firstparty) sisteminde event tracking ile prompt versiyonu metadata'ya eklenir, BigQuery'de JOIN edilir, dbt model'i her versiyonun conversion rate'ini hesaplar.

### Promptfoo: Deterministik Test Suite'i Kurmak

Promptfoo lokal çalışan, YAML-based eval framework'ü. Amaç: her prompt değişikliği öncesi regression testiyle doğrulama.

Basit config:

```yaml
prompts:
  - file://prompts/marketing_blog_v1.md
  - file://prompts/marketing_blog_v2.md

providers:
  - anthropic:messages:claude-3-5-sonnet-20241022

tests:
  - vars:
      topic: "Server-side GTM"
      category: "tech"
    assert:
      - type: is-json
      - type: javascript
        value: "output.title.length <= 60"
      - type: similar
        value: "server-side tracking architecture"
        threshold: 0.8
      - type: not-contains
        value: "devrim"
```

`promptfoo eval` komutuyla tüm varyantlar test edilir, metrik tablosu döner:

| Prompt | Pass Rate | Avg Latency | Cost |
|--------|-----------|-------------|------|
| v1 | 92% | 2.3s | $0.012 |
| v2 | 98% | 2.1s | $0.014 |

v2'de pass rate artmış ama cost 17% yükselmiş — token count artıyor, detayda kontrol etmek lazım. Bu tradeoff'u görmeden deploy etseydik monthly budget patlamıştı.

## A/B Testi: Prompt Varyantlarını Production'da Karşılaştırmak

Evaluation suite yeşil döndü, şimdi gerçek trafik gerekiyor. A/B testi LLM sisteminde şu şekilde kurulur:

1. **Variant routing** — kullanıcı/session ID'sine göre prompt versiyonu seç (% split)
2. **Metadata tagging** — her API call'a `prompt_version` ekle
3. **Metric tracking** — downstream event'lere variant bilgisi tut
4. **Statistical significance** — yeterli sample size toplandığında (min 385 observation per variant, %95 confidence) karar ver

n8n workflow örneği:

```javascript
// A/B variant seçimi
const userId = $json.user_id;
const variant = (userId % 100 < 50) ? 'v1' : 'v2';
const promptUrl = `https://raw.githubusercontent.com/roibase/prompts/main/${variant}.md`;

// API call'a metadata ekle
return {
  json: {
    prompt: await fetch(promptUrl).then(r => r.text()),
    metadata: {
      prompt_version: variant,
      experiment_id: 'blog_tone_test_2026_05'
    }
  }
};
```

BigQuery'de analiz:

```sql
SELECT
  metadata.value:prompt_version AS variant,
  COUNT(DISTINCT user_id) AS users,
  AVG(session_duration_sec) AS avg_duration,
  SUM(conversion) / COUNT(*) AS cvr
FROM events
WHERE experiment_id = 'blog_tone_test_2026_05'
  AND event_date >= '2026-05-01'
GROUP BY 1
```

Sonuç: v2 variant CVR'ı 0.042'den 0.051'e çıkarmış (+21%), p-value 0.003 — güvenle production'a alınır.

## LangSmith: Observability ve Long-Term Regression Detection

Promptfoo lokal test, LangSmith production observability. Her LLM call trace edilir: input, output, latency, token count, model version, prompt version.

LangSmith avantajı **long-term metrik tracking**. 3 ay önceki prompt versiyonunun bug'ı bugün feedback'le fark ediliyor — trace'e geri dön, input/output diff'i gör, o gün hangi versiyondu bul, rollback et.

Örnek trace:

```json
{
  "run_id": "abc123",
  "prompt_version": "v2.1",
  "model": "claude-3-5-sonnet-20241022",
  "input": {"topic": "Server-side GTM", "category": "tech"},
  "output": "---\ntitle: \"Server-Side GTM...\"",
  "latency_ms": 2341,
  "tokens": {"input": 1842, "output": 1523},
  "cost_usd": 0.0137,
  "feedback": {"score": 4, "comment": "title çok uzun"}
}
```

Feedback loop: editör her blog'a 1-5 puan veriyor, LangSmith bu puanları trace'e bağlıyor, haftalık rapor "v2.3 versiyonu avg score 3.2'ye düştü" uyarısı veriyor. Hemen rollback → prompt diff → problemi gör → fix et.

### Dataset Management: Golden Set'i Version Control Altında Tutmak

Eval pipeline'ın kalbi **golden dataset** — bilinen input/output çiftleri, beklenen davranışın referansı. Bu dataset'i Notion'da tutmak, Google Sheets'te manuel güncellemek regression riski.

LangSmith dataset'i version control altında:

```python
from langsmith import Client

client = Client()

dataset = client.create_dataset("marketing_blog_golden_v3")

# Golden örnekleri ekle
examples = [
    {
        "inputs": {"topic": "Server-side GTM", "category": "tech"},
        "outputs": {"title": "Server-Side GTM: Cookie Sonrası Ölçüm"},
        "metadata": {"expected_h2_count": 5, "expected_word_count": 1500}
    },
    # 50+ örnek...
]

for ex in examples:
    client.create_example(**ex, dataset_id=dataset.id)
```

Her prompt değişikliğinde bu dataset'e karşı test et. Pass rate düşerse deploy yapma. Dataset'e yeni edge case ekle (production'da bulduğun bug'lar), regression olmasın.

## Tradeoff: Deterministik Metrik vs Yaratıcı Output

LLM'in gücü non-deterministik olması — aynı input'a farklı output. Ama production sisteminde bu güç risk: müşteri her sayfa yenilemede farklı markdown görüyor, bazıları hatalı.

Temperature 0 ile determinizm artar ama output tekdüzeleşir. Tradeoff:
- **Temperature 0**: eval suite için ideal, production için monoton
- **Temperature 0.3-0.5**: makul çeşitlilik, yine de tutarlı
- **Temperature 0.7+**: yaratıcı ama test suite'i yeşil döndürse bile production'da sürpriz

Çözüm: eval'de temperature 0, production'da 0.4, golden set'te her input için 5 farklı acceptable output sakla (range kontrolü).

Başka tradeoff: **latency vs kalite**. Uzun prompt daha iyi output veriyor ama input token cost artıyor, latency yükseliyor. Promptfoo'da latency metriği 2.5s'yi geçerse alert ver — kullanıcı deneyimi bozulmasın.

## Production Checklist: LLM Sistemini Deploy Etmeden Önce

Deploy öncesi kontrol listesi:

- [ ] Prompt git repo'da, commit history temiz
- [ ] Promptfoo eval suite pass rate > %95
- [ ] Golden dataset min 50 örnek
- [ ] A/B test planı hazır, sample size hesaplandı
- [ ] LangSmith trace açık, API key production'da
- [ ] Feedback loop kurulu (editör puanlama, BigQuery join)
- [ ] Rollback prosedürü tanımlı (hangi metrik düşerse otomatik geri al)
- [ ] Cost monitoring — daily token spend threshold $X
- [ ] Latency SLA — p95 < 3s

Bu listeyi tamamlamadan "AI hizmeti" sunduğunu söylemen erken. Versiyonlama, eval, observability olmadan production LLM operasyonu değil, kontrollü kaos.

---

Prompt versiyonlama disiplin meselesi — hız için değil, güvenilirlik için. [Generative Engine Optimization](https://www.roibase.com.tr/tr/geo) gibi LLM-native taktiklerde output kalitesi direkt business outcome'a bağlanıyor. Eval pipeline'ı olmadan her deployment eski performansı riske atıyor. Promptfoo lokal güvenceyi, LangSmith production görünürlüğü sağlıyor. İkisi birlikte LLM operasyonunu yazılım mühendisliği standardına çıkarıyor.