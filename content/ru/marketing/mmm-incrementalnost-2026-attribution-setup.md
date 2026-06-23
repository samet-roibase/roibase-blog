---
title: "MMM + Incrementalnost: Attribution Setup 2026"
description: "Robyn, Meta Lift i geo-eksperimenty — kakoj metod kogda rabotaet? Tekhnicheskij spravochnik dlya perestroyki atributsii v epohe bez kolachkov."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: marketing
i18nKey: marketing-004-2026-06
tags: [mmm, incrementalnost, atribuciya, robyn, meta-lift]
readingTime: 8
author: Roibase
---

Last-click atribuciya umerla v 2023, multi-touch v 2024. V 2026 izmerie marketinga rassloelis na dva polyusa: na makrourovne Marketing Mix Modeling (MMM), na mikrourovne testy incrementalnosti. Mezhdu nimi server-side conversion API stroet mosty. Etot tekst ob'yasnyaet, kakoj metod v kakikh usloviyakh rabotaet, kakoy vyvod kakoye resheniye podkreplivet — ne abstraktna "filosofiya atributsii", a prakticheskij stack, kotoryj mozhno postroit.

## Marketing Mix Modeling teper' rabotaet yezhenedbel'no

MMM v 2015 oznachalo "raz v god doklad dlya gendirektora". V 2026 otkrytye instrumenty, podobnye Robyn ot Meta, zapuskayut Bayesovy modeli kazhdyj den i obnovlyayut channel contribution. Struktura: istoricheskiye zatrary, impressions, conversions i vneshnie faktory (sezonnost', prazdniki, indeks konkurentsii) analiziruyutsya cherez time-series regressiyu, kazhdyj kanal poluchaet otzuku marginal ROAS. "Esli dopromatyvat' na 100.000 RUB — na kakoi kanal eto prinosit 1 dopolnitelnyj pokup?" — MMM otvetit.

Setup slozhnyj, no tekhnicheskiye trebovaniya prozrachny: minimum 52 nedeli ezhednevnykh dannyh (luchshe 104 nedeli), razbor rashod po kanalam, chislo konversij (dokhod esli vozmozhno — luchshe). Robyn rabotaet na Python i R, beruot dannyye iz BigQuery ili Snowflake, vychislyaet zadnyuyu raspredeleniye cherez Prophet ili Stan. Rezultat — grafik channel contribution, saturation curve i response curve: kakoj kanal podverzhen sytosti, kakoj uzhe na tochke diminishing returns.

Robyn v 2026 dobavlyaet geo-granuliarnost: esli razdelite Rossiyu na 7 regionov, dlya kazhdogo schitayutsya otdelnye saturation thresholds. V Moskve Meta mozhet byt' na 35% saturation, a v Privolzh'e — na 10%. Eto pozvolayet predlozit' peraspredelenie byudzhetov. No vnimaniye: MMM **ne dokazyvaet prichinnost', a pokazyvaet korrelyatsiyyu**. "Esli zatrary na Google Ads rasli — rosli i prodazhi" ne ravno "Google Ads sprichinilas' rozhem". Etot proveol zapolnyaet incrementalnost.

## Meta Lift reshil incrementalnost na platforme

Conversion Lift ot Meta — eto polnopravnyj randomizirovannyj kontroliruemyj eksperiment (RCT). Auditoriyu delit na dve chasti: test-gruppe pokazyvaet reklamu, kontrol'naya ee ne vidit. Raznitsa v konversiyakh mezhdu gruppami — etot **chistyj vklad etoj kampanii**. V 2026 sistema spustilas' s urovnya kampanii na uroven' kreativa — dlya 3 videoprilozhenii v ramkakh odnoj kampanii incrementalnost' meritsya otdel'no.

Tekhnicheskaya nastrojka: v Ads Manager vybirayete "Create Lift Test" (a ne "Create A/B Test"), trebuetsya minimum 200.000 dostignutykh i 2 nedeli dlitel'nosti (Meta eto kontroliruet). Kontrol'naya grupa dolzhna byt' 10-20% — men'she padaet statisticheskaya sila, bol'she — terite dokhod. Po zavershenii Meta daet: "Test-gruppe 1000 konversij, kontrol'naya 700 — eto +30% incremental lift, doveritelnyj interval 18-42%".

Etot chislo pryamo svyazyvalsya s byudzhetom. Kampanya rashodovala 100.000 RUB s 30% lift — znachit, 30.000 RUB prines real'nye dopolnitel'nye prodazhi, ostal'nye 70.000 RUB — organika ili drugoj kanal. Otychislyvayu marginal cost per incremental conversion (mCPIC): 100.000 / 300 = 333 RUB. Sravnivayu s MMM-outporom: "Posledniye 1000 RUB na Meta priniesli 2.8 pokupka" — cifry dolzhny sovpadat', 15-20% raznitsy normalna (metodologiya raznyya), 50%+ — problema s dannymi.

Ogranicheniye Meta Lift: rabotaet tol'ko v ekosisteme Meta, ne merpit cross-channel effekty. Est' li sinergia mezhdu Google Ads + Meta vmestu? Eto merpit geo-eksperiment.

## Geo-eksperimenty meriyayut cross-channel sinergiyu

Geo Experiments ot Google tak: Rossiyu delite na 10 regionov, v 5 uvelichivaete spend na 20% (ili vypyolnyaete), v 5 ostaylyayete bez izmenenij. Cherez 4 nedeli smotrite raznyitsu v prodazhakh mezhdu gruppami — esli difference i statisticheski znachima (p<0.05), izmeneniye raskhoda — prichina. Struktura inaya, chem Meta Lift: kanal ne razdelyen, vzgliad na obshchij effekt po regionam.

Prakticheskaya nastrojka: v Campaign Manager 360 ili Google Ads vybirayete "Experiments" > "Geo experiment". Dlya borodel'niya regionov — pochtovyye kody, regiony ili NUTS2-klassi (dlya Rossii — federal'niye okruga). Trebuetsya 6 nedel' bazovykh dannyh, test — minimum 3 nedeli (ideal'no 6 — shutim fon sezonnosti). Bajesov motor Google ezhednevno obnovlyaet posteriory, po zavershenii: "Uvelichenie spend na 20% prineslo +8.5% prodazh (doveritelnyj interval 4.2-12.8%)".

Metod osobenno moshtchen dlya testirovaniya cross-channel strategij. Primer: "Google + Meta vmestu dayot 15% bol'she prodazh, chem otdel'no?" — v gruppe A oba kanala na polnuyu, v gruppe B Google na 50% — esli raznitsa <10%, sinergii net, peraspredelyaete byudzhet. Nedostatok geo-eksperimenta: dorogo (6 nedel' bazovykh dannyh + 6 nedel' testa = 3 mesyatsa), rezultaty osmyslennyye tol'ko dlya bol'shikh izmenenij. Esli teset 5% tweaka — terpaetsya v shume.

## Kakoj metod kogda — decision tree

Resheniye dvoite trem'ya voprosami:

1. **Skop resheniya?** Godovoe raspredeleniye byudzhetov → MMM. Sravneniye kreativov v kampanii → Meta Lift. Sinergia mezhdu kanalami → Geo-eksperiment.

2. **Dannyye gotovy?** MMM trebuet 52+ nedeli dannykh spend + conversions. Lift — 200K+ impressions i 2 nedeli. Geo — 6 nedel' bazovykh dannyh i regionalnaya segmentatsiya.

3. **Skorost' resheniya?** Ezhednevnaya optimizatsiya → Meta Lift otkryt vsegda. Kvartal'naya strategiya → MMM refresh kazhdyj mesyats. God-dve bol'shikh pivotov → Geo-eksperiment.

Tablitsa:

| Metod | Vyvod | Vremya | Minimum dannyh | Ideal'noe primenenie |
|---|---|---|---|---|
| MMM (Robyn) | Channel contribution, saturation | 52+ nedel' | Raskhody + conversions (ezhednevno) | Strategiya raspredeleniya byudzhetov |
| Meta Lift | Incremental conversion per campaign/creative | 2-4 nedeli | 200K impressions | Testing kreativov, pruning kampanij |
| Geo-eksperiment | Cross-channel synergy, regional'nyj lift | 6-12 nedel' | 6 nedel' bazovykh dannyh + regional'nyye dannyye | Test sinergii, ekspansiya po regionam |

Tri metoda — ne al'ternativy, a dopolneniya. MMM skazhet "kakoj kanal kak tsennen", Lift — "etaprealnyj lift ot etoj kampanii", Geo — "dva kanala vmeste luchshe?". Komanda, kotoraya ispol'zuyet vse tri, straivat' [Performansnyi marketing](https://www.roibase.com.tr/ru/ppc) strategiyu na eksperimentakh, ne na predpolozheniyakh.

## Postroyka stacka na praktike

Chtoby sbrosit' teoreticheskij framework v real'nrost':

**Sbor dannyh:** Server-side GTM otpravlyaet signaly konversii v Google Ads, Meta CAPI i BigQuery parallel'no. Esli polагаetes' na client-side kuki — teraete 30-40% signalov (iOS 17, Firefox, Brave). Roibase infrastruktura [Tsifrovogo marketinga](https://www.roibase.com.tr/ru/dijitalpazarlama) soedinyaet sGTM + first-party data layer — otchyt MMM poluchaet granuliarnyj raskhod.

**Model'nyi pipeline:** Robyn pitaetsya iz BigQuery. Raskhody + conversions modeliruyutsya v dnevnom razreze cherez dbt. Python-skript kazhdyj den' (Cloud Function ili Airflow), rezul'tat v Looker Studio. Lift-testy zapuskayutsya vruchnuyu v Ads Manager, no rezultaty vygruzhaetsya cherez API (Marketing API `insights` endpoint daet lift metrix), zapisyvayutsya v BigQuery i joinyatsya s Robyn. 

**Geo-eksperiment:** Google Ads API `experiments` resource pozvolyaet avtomatizirovannuyu nastrojku. Po zavershenii `experiment_id` daet rezultat, snova BigQuery, sravnenie s MMM.

**Dashboard-soglasie:** Vsyoye tri metoda v odnom meste: "MMM: Meta 22% contribution, Lift: 28% incremental, Geo: regional'naya variatsiya 12-34%" — tri chisla vmeste clarifyyuyut strategiyu.

**Tsikl reshenij:** Kazhdyj kvartal MMM refresh, ezhednevno 1-2 Lift-testa, raz v 6 mesyatsev Geo-eksperiment. Dlya malyh komand: snachala MMM (2 nedeli esli est' dannyye), potom Meta Lift (rutina dlya kazhdoj kampanii), Geo — tol'ko pered bol'shim pivotom.

V 2026 atribuciya — ne odin instrument, a orkestratsiya trekh. Kazhdyj otvechaet na svoyu vopros, vmeste vybiruyut post-cookie realnost'. Ne prognoz, a test. Ne korrelyatsiya, a prichinnost'. Ne dashboard, a eksperiment. Rost stroitsya na ej.