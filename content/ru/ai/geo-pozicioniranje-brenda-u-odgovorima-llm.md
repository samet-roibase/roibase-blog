---
title: "GEO: Pozicioniranje brenda u odgovorima ChatGPT-a"
description: "Arhitektura sadržaja za vidljivost u AI pregledu i LLM citacijama. Mehanizmi citiranja generativnih engine-a, strategija strukturiranog sadržaja i merenje."
publishedAt: 2026-08-10
modifiedAt: 2026-08-10
category: ai
i18nKey: ai-001-2026-08
tags: [geo, llm-citation, ai-overviews, structured-data, generative-ai]
readingTime: 9
author: Roibase
---

Google sada prikazuje AI pregled u 43% slučajeva. ChatGPT odgovara 200 miliona upita dnevno. Wjezd u pool citacija na Perplexity-ju postao je izvor saobraćaja. 2026. je novi front SEO-a mehanizam citiranja LLM-a — arhitektura koja određuje koje izvore će preporučiti. 30% organskog saobraćaja ove godine dolazi iz generativnih odgovora (SimilarWeb 2026 Q2). Praćenje klasičnog ranga ključne reči vise nije dovoljno. Pitanje je: Preporučiće li ChatGPT tvoj brend?

## Mehanizam LLM Citiranja — Koji izvor se bira

Generativni engine-i koriste dva stadijuma pri kreiranju odgovora: pretragu i generisanje. Sloj pronalaženja koristi sličnost embedding-a i filtriranje metapodataka. Kad korisnik upita "attribution model za B2B SaaS", model pronalazi prvih 50-100 kandidata u vektorskom prostoru, zatim ranking algoritam ulazi u igru. Ovaj ranking funkcioniše drugačije od SEO-a — broj povratnih linkova nije odlučujući, već relevantnost na nivou čitavog odeljka. Sistem ocenjuje koliko je kompletan odgovor odseka. Google-ov mehanizam u SGE-u se naziva "information gain": izvor koji ponavlja istu informaciju ne pobjeđuje, već onaj koji otvara novu dimenziju.

ChatGPT web-pretraga funkcioniše drugačije. Model transformiše korisničko pitanje u search upyt, šalje ga Bing API-ju, preuzima prvih 10 rezultata i deli sadržaj na čitaće delove. Zatim svakom delu dodeluje "vrednost citiranja" — retroaktivno prati koji deo odgovora dolazi iz kojeg izvora. U ovom procesu strukturirani podaci daju prednost: sadržaj sa schema markup-om dobija viši score sigurnosti jer je ekstraktovanje entiteta lakše. Stranice sa FAQPage, HowTo, Article schema dobijaju 60% više citacija (interno poređenje Roibase, 200 upita).

Perplexity-jev algoritam citiranja je agresivniji: ako isti podatak vidim u 3 različita izvora, bira najnoviji + najpouzdaniji. "Pouzdan" ovde nije domain authority, već EEAT signali: biografija autora, svežina datuma objavljivanja, broj spoljnih referenci. Ako članak navodi "Smith et al. 2025", sirovi score raste. LLM-ovi mogu da čitaju lance citiranja — sadržaj sa referencama označen je kao "nizi rizik od halucinacija" i dobija prioritet.

## Arhitektura Sadržaja — Struktura Optimizovana za Čitive Delove

Klasični SEO je zahtevao comprehensive vodiče od 2000 reči. GEO zahteva da sadržaj bude organizovan u čitave delove koje LLM može da rastavlja. Veličina čitavog dela je kritična: GPT-4 koristi prozor od 512 tokena, Claude 1024. Ako paragraf premaši ovu granicu, polovina ne ulazi u kontekst i šansa za citiranje pada. Optimalna struktura čitavog dela: paragraf od 150-250 reči koji odgovara na jedno specifično pitanje. Svaki paragraf treba da ima vlastiti naslov (H3 ili H4) jer LLM-ovi koriste hijerarhiju naslova kao semantičku granicu.

```markdown
## Attribution modeli

### First-Touch Attribution
Model koji dodeljivanja zaslugu prvoj tački 
kontakta. Dodeluje 100% vrednosti prvoj 
kampnji pre konverzije. Prednost: merenje 
awareness kanala. Nedostatak: zanemaruje 
nurture fazu.

### Multi-Touch Attribution
Raspodeljuje ponderisanu vrednost svim 
tačkama kontakta. Varijacije uključuju 
linearni, vremenski raspad i U-oblik. 
Shopify Plus koristi linearni kao zadanu 
postavku.
```

Ova struktura LLM-u olakšava mapiranje "koji paragraf odgovara kojem pitanju". Kada ChatGPT dobije upyt "šta je first-touch attribution", može da izvuče prvi čitav deo i koristi ga kao citaciju. Modularni blokovi umesto dugih, tečnih paragrafа su osnovna načela GEO-a.

Integracija strukturiranoga sadržaja je obavezna. JSON-LD format sa FAQPage schema označava svaki Q&A par kao odvojenu stavku. Google AI pregledi mogu direktno da izvlače ove stavke — umesto DOM parsiranja, čitaju strukturirana polja i kreiraju odgovore. HowTo schema za sadržaj zasnovan na koracima sledi istu logiku: svaki korak je odvojena entiteta i LLM može da koristi korak 3 kao citaciju. U Article schema-u, ako se koristi svojstvo `speakable`, citiranje glasa asistenta raste (važno za Google Assistant + ChatGPT integraciju glasa).

Format tabela i lista čini se čitavljujem LLM-a: markdown tabela ide direktno u tokenizer, model vidi ćeliju tabele kao odvojenu faktičku jedinicu. Za upyty kao "poredi SaaS metrike", tabela ima stopu citiranja od 80% (tekstualni paragraf 45%). Code blokovi su slični: SQL upyt ili Python isečak dobija visoku sigurnost u citacijama jer je izvršiv — model može da proveri "da li ovo radi".

## Merenje — Arhitektura za Praćenje Citacija

SEO je imao tracker-e ranga, GEO zahteva tracker-e citiranja. Nema još zrelog alata, prilagođeno postavljanje je obavezno. Roibase stack: n8n workflow šalje Perplexity API upyt svakih 6 sati (brendirana pitanja kao "Šta je Roibase", "agencije za performansi marketing"), parsira odgovore i ako sadrži citaciju, piše u BigQuery. Isti workflow šalje ChatGPT API-ju (omogućen web browsing) istu upyt, pronalazi koje URL-ove referencira i spaja. 30-dnevni rolling prozor prati "koliko puta smo dobili citaciju".

Merenje Google AI pregleda je teže: još nema javnog API-ja. Obchod: Search Console - detekcija anomalije CTR-a — ako ključna reč obično daje 8% CTR, a sada daje 2%, moguće da se prikazuje AI pregled (korisnik je dobio odgovor direktno, nije kliknuo). Ako impresije rastu, a CTR pada, to je jasan signal. Ovaj obrazac može automatski biti detektovan kroz dbt model: `impressions_7d / clicks_7d` versus `impressions_30d / clicks_30d` — ako se odnos promeni za više od 30%, alarm.

Za praćenje URL-a citacije, UTM je nesufijeran jer LLM-ovi mogu da uklanjaju UTM parametre. Alternativa: jedinstveni slug. Umesto "/geo-vodic" koristi "/geo-vodic-llm" kao varijantu, daj ovaj URL samo LLM kontekstu (u svojstvu `url` schema-a). Ako saobraćaj dolazi ovde, došao je iz citacije. Analiziraj origem kroz Server log filtriranje: traži `GPTBot`, `ChatGPT-User`, `PerplexityBot` u `User-Agent` stringovima.

## Kompromis — Granularnost Čitanja naspram Dubine Teme

Čitava GEO optimizacija ugrožava sveobuhvatnost. Modularni blokovi od 250 reči mogu biti međusobno nezavisni — rizik da sadržaj izgleda kao "površinski". Google i dalje traži tematsku autoritet — ako 5000-reč deep dive dobro radi u SEO-u, kada ga podelis na čitaće delove, ne treba da izgubis internu koherentnost. Rešenje: hub-spoke model. Glavna stranica je sveobuhvatna (2000+ reči), svaki H2 postaje odvojena child stranica (500 reči optimizovano za čitane delove), glavna stranica linkuje child stranicu. LLM može da koristi glavnu stranicu kao "pregled" i child stranicu kao "detaljni odgovor" za citiranje.

Nesrazmera između svežine i everggreen-a: LLM-ovi gledaju datum objavljivanja; 2024. sadržaj dobija 40% manje citiranja 2026. (Roibase benchmark). Ali prepisivanje svakog meseca nije održivo. Rešenje: modularni update. Neka osnovna tela budu everggreen, dodaj H2 na kraju "2026. ažuriranje", ovde pomeni nove podatke/alate/metodologije. LLM detektuje inkrementalni update; `modifiedAt` metadata olakšava svežinu score-a. 20% refresh sadržaja je dovoljno umesto punog prepisivanja.

Atrибuciona kompleksnost: ako korisnik vidi tvoj brend u ChatGPT-u, zatim gugluje "Roibase" i dolazi do stranice, koji kanal dobija zaslugu? Izgleda kao direct saobraćaj ali je pravi izvor citiranje LLM-a. Arhitektura [first-party podataka](https://www.roibase.com.tr/ru/firstparty) je ključna: ako je `document.referrer` prazan, ali `sessionStorage` sadrži LLM interaction flag (na primer, došao iz ChatGPT ugrađivanja), attribution ide u custom dimenziju. Ovi podaci kreiraju "AI-assisted discovery" segment u CDP-u.

## Operativna Integracija — GEO Workflow Automatizacija

Praćenje citiranja ne može biti ručno — API pozive, parsiranje, logging, upozorenja moraju biti automatizovani. Roibase koristi n8n + Claude + BigQuery u [GEO](https://www.roibase.com.tr/ru/geo) operacijama. Workflow: svakog jutra u 09:00 n8n trigger učitava listu ciljnih ključnih reči iz Google Sheets (50 stavki), poziva Perplexity API za svaku ključnu reč, šalje JSON odgovore Claude-u sa binarnom klasifikacijom "da li je roibase.com.tr spominjan?", ako jeste, piše u BigQuery `geo_citations` tabelu. Ako je ključna reč dobila citaciju prošle nedelje, a sada ne, Slack alert pada — sadržaj zahteva ažuriranje.

Automatizacija schema deployment-a: kada se novi članak ubaci u CMS, webhook dolazi n8n-u, Claude prima sadržaj članka i generiše FAQPage schema (LLM konvertuje naslove u pitanja-odgovore par), šalje schema u custom CMS polje, kada se stranica objavi, schema se prikazuje u head-u. Nema ručnog pisanja JSON-LD, stopa greške pada 90%.

Konkurentsko praćenje citacija: upyti o pomenutim konkurentima ulaze u isti workflow. Kada se upyta "agencije za performansi marketing", koja se konkurencija spominje na Perplexity-ju? Ovi podaci ide u `competitor_citations` tabelu, nedeljni dashboard prikazuje trend. Ako se konkurencija pojavljuje sa 15% na 25%, reverzno-inžinjeri njihovu strategiju i adaptira je svojoj.

## Što Uraditi Sada

Za povećanje GEO saobraćaja sa 10% na 25% u 6 meseci: (1) Optimizuj top 20 landing stranica za čitaće delove — podeli jedan 3000-reč vodiči u 6 child stranica + hub stranicu. (2) Dodaj FAQPage + Article schema svakoj stranici, uključujući `speakable` markup. (3) Postavi stack za praćenje citacija — Perplexity + ChatGPT API upyti su automatizovani, BigQuery logs su postavljeni. (4) Napiši Search Console CTR anomaly detection model za merenje uticaja AI pregleda. (5) Pokreni 30-dnevni freshness cycle — modularni refresh ažurira `modifiedAt`. Trka za citacije je počela; oni koji se krenu prvi hvataju 60% citacija (powerlaw distribution). Docnjaši padaju u "takođe se spominje" kategoriju.