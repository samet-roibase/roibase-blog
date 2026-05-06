# Data Kategorisi — Yazım Yönergesi

**Kapsam:** Data engineering, analytics, BigQuery/Snowflake, dbt, sGTM, identity resolution, CDP, MMM, incrementality.

**Konu seçimi öncelikleri:**
1. Pazarlama datası → karar mekanizması (semantic layer, KPI tree)
2. Server-side measurement (sGTM, Conversion API, Consent Mode v2)
3. First-party data lake mimarisi

**Kaçınılacak konular:**
- "Big data nedir" temel anlatımları
- Vendor karşılaştırmaları (Snowflake vs BigQuery vs Redshift)
- Veri bilimi 101 (regresyon, kümeleme açıklamaları)

**Spesifik ton:**
- SQL örneği OLABİLİR — pratik dbt model snippet'ları, BigQuery sorguları
- Privacy + compliance ile içiçe konuş (TCF 2.2, CCPA, KVKK)
- Pipeline diyagramından kaçın — somut tablo yapısı ve event şemaları ver

**Bağlantılı Roibase hizmetleri:**
- `firstparty` — First-Party Veri & Ölçüm Mimarisi
- `verianalizi` — Veri Analizi & İçgörü Mühendisliği
- `retention-engineering-cdp` — CDP & Retention Engineering

**İyi başlık örnekleri:**
- "Server-Side GTM ve Conversion API: Sıfırdan Production'a"
- "dbt + BigQuery ile Modern Pazarlama Data Stack"
- "Identity Resolution: 6 Sinyalden Tek Müşteri Kimliğine"
