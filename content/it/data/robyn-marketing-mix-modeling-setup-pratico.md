---
title: "Marketing Mix Modeling: Configurazione Pratica con Robyn"
description: "Framework MMM open-source di Meta Robyn: configurare saturazione, adstock e holdout validation con codice R e struttura dati corretta."
publishedAt: 2026-06-05
modifiedAt: 2026-06-05
category: data
i18nKey: data-005-2026-06
tags: [marketing-mix-modeling, robyn, adstock, saturation-curve, incrementality]
readingTime: 8
author: Roibase
---

Nel mondo della misurazione post-cookie, l'attribution perde segnale ogni giorno. Con iOS 17.4 e persino SKAdNetwork che fatica a mostrare il vero ROAS, i proprietari di budget di marketing si rivolgono ai modelli econometrici per misurare il vero contributo dei canali. Il Marketing Mix Modeling (MMM), metodo statistico sviluppato negli anni Sessanta per la pubblicità televisiva, nel 2026 ritorna al centro insieme a server-side measurement e first-party data lake. **Robyn**, rilasciato da Meta come open-source nel 2021, ha accelerato l'applicazione di questa metodologia basata su regressione aggiungendo machine learning moderno e ottimizzazione bayesiana.

## Perché MMM è critico adesso

Mentre il modello di last-click attribution crolla con la perdita dei cookie, anche l'attribution multi-touch (MTA) diventa inutilizzabile dopo GDPR e ATT perché richiede dati a livello di evento. L'attribution data-driven di Google Analytics 4 si basa sul machine learning ma funziona solo nell'ecosistema Google. Tuttavia, il 60% del budget di marketing rimane fuori da Google: Meta, TikTok, display programmatico, TV offline, sponsorizzazioni.

MMM si basa su dati **aggregati** settimanali o giornalieri invece del tracking a livello utente. Il modello di regressione estrae la relazione tra la spesa di ogni canale e le vendite (o conversioni). Il modello poggia su due assunzioni fondamentali: **saturazione** (maggiore spesa produce rendimenti marginali decrescenti) e **adstock** (la pubblicità di oggi impatta le prossime settimane). Queste assunzioni sono statistiche ma riflettono la realtà commerciale. Robyn mira a trovare automaticamente questi due parametri attraverso ottimizzazione bayesiana degli iperparametri. Dalle versioni 2024 in poi (v3.11+), l'aggiunta di **ridge regression** e **decomposizione time-series con Prophet** ha aumentato l'accuratezza stagionale del modello.

Un'altra caratteristica critica di Robyn è la **holdout validation**: addestra il modello con i dati passati di 12 settimane e prevede le successive 4 settimane per misurare l'errore fuori campione. Questo previene l'overfitting e dimostra che il modello apprende veramente i canali. Le soluzioni MMM di Google (Meridian) e Facebook usano approcci simili ma sono closed-source e costose. Robyn offre accesso gratuito alla stessa metodologia.

## Struttura dati e preparazione

Per eseguire Robyn, il formato dati richiesto è: ogni riga è un'unità di tempo (giorno o settimana), ogni colonna è la spesa di un canale o una metrica di conversione. Si consigliano minimo 104 settimane (2 anni) perché l'importanza statistica dei coefficienti di regressione dipende dalla dimensione del campione. Con meno di 52 settimane avrai problemi di convergenza del modello.

```r
# Esempio di struttura dati — aggregato settimanale estratto da BigQuery
df <- data.frame(
  DATE = seq.Date(from = as.Date("2024-01-01"), by = "week", length.out = 104),
  revenue = runif(104, 80000, 150000),
  google_search_spend = runif(104, 5000, 15000),
  meta_spend = runif(104, 8000, 20000),
  tiktok_spend = runif(104, 2000, 8000),
  tv_grp = runif(104, 50, 200),
  organic_sessions = runif(104, 10000, 30000),
  competitor_index = runif(104, 0.8, 1.2)
)
```

**Dettagli importanti:**
- La colonna `DATE` deve essere di classe Date, non stringa
- Revenue o conversion entra nel modello come variabile target (variabile dipendente)
- I canali (google_search_spend, meta_spend) sono colonne di **paid media** — a questi si applica adstock e saturazione
- Variabili come `organic_sessions` e `competitor_index` sono **variabili organiche / di controllo** — non viene applicata la trasformazione, sono usate per dedurre il baseline
- Se hai dati di canali offline come TV, normalizza come GRP, reach o minuti visualizzati

Robyn non funziona con etichette manuali come "facebook_spend"; tu definisci i nomi delle colonne ma devi specificare esplicitamente nella funzione `InputCollect()` quali colonne sono paid e quali organiche.

Se non hai [costruito un'architettura di dati first-party](https://www.roibase.com.tr/it/firstparty), raccogliere questi dati è difficile. Server-side GTM, esportazione raw GA4, API di Meta / Google Ads, dati di vendita da CRM — devi unirli tutti in BigQuery e fare il rollup settimanale. Quando costruiamo questa pipeline ETL con dbt, produciamo una tabella `fact_marketing_weekly` pronta per MMM.

## Configurazione di saturazione e adstock

La forza di Robyn è poter ottimizzare **separatamente** la curva di saturazione e i parametri di adstock decay per ogni canale. La saturazione è modellata con la funzione Hill:

```
effect = spend^alpha / (spend^alpha + half_saturation^alpha)
```

Il parametro `alpha` determina la concavità della curva, `half_saturation` determina il livello di spesa dove l'effetto raggiunge il punto mediano. Canali basati su intent come Google Search saturano presto (alpha basso, half_saturation basso). Canali di brand awareness (TV, YouTube) saturano tardi.

L'adstock modella l'effetto della spesa passata su quella odierna. L'adstock geometrico è il più comune:

```
adstocked_spend[t] = spend[t] + theta * adstocked_spend[t-1]
```

`theta` (tra 0 e 1) è la velocità di decay. Per TV è alto (0.7-0.9 — l'effetto dura settimane), per search è basso (0.1-0.3 — l'effetto finisce subito). Robyn trova questi parametri tramite ottimizzazione Nevergrad, ma tu devi fornire il **range precedente**:

```r
hyperparameters <- list(
  google_search_spend_alphas = c(0.5, 1.5),
  google_search_spend_gammas = c(0.1, 0.4), # adstock decay
  google_search_spend_thetas = c(0, 0.3),   # adstock theta
  meta_spend_alphas = c(0.5, 2.0),
  meta_spend_gammas = c(0.3, 0.8),
  meta_spend_thetas = c(0.2, 0.6),
  tv_grp_alphas = c(1.0, 3.0),
  tv_grp_gammas = c(0.5, 0.9),
  tv_grp_thetas = c(0.6, 0.9)
)
```

Devi definire questi range con conoscenza del dominio. Se dai range completamente casuali il modello diverge o trova coefficienti insensati (come TV con effetto negativo). La documentazione di Robyn suggerisce range default ma testali sui tuoi dati prima di usarli.

## Addestramento del modello e holdout validation

Per eseguire Robyn usi la funzione `robyn_run()`. Dentro usa la libreria **Nevergrad** e l'ottimizzazione bayesiana per trovare la miglior combinazione di iperparametri. Un run tipico significa 2000 iterazioni × 10 trial = 20.000 addestramentimodello. Su un MacBook M1 con 8 core impiega ~15 minuti.

```r
library(Robyn)

InputCollect <- robyn_inputs(
  dt_input = df,
  date_var = "DATE",
  dep_var = "revenue",
  dep_var_type = "revenue",
  paid_media_vars = c("google_search_spend", "meta_spend", "tiktok_spend"),
  paid_media_spends = c("google_search_spend", "meta_spend", "tiktok_spend"),
  organic_vars = c("organic_sessions"),
  prophet_vars = c("trend", "season", "holiday"),
  window_start = "2024-01-01",
  window_end = "2025-12-31",
  adstock = "geometric",
  hyperparameters = hyperparameters
)

OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 10,
  outputs = FALSE
)
```

Dopo l'addestramento del modello mostra le soluzioni **Pareto-ottimali**. Robyn ottimizza due metriche: NRMSE (normalized root mean square error) e RSSD di decomposizione (residual sum of squared differences). Ogni modello sulla frontiera di Pareto rappresenta un trade-off: uno ha fit buono ma decomposizione cattiva, l'altro il contrario. Tu scegli manualmente il modello più ragionevole.

Per holdout validation, metti da parte le ultime 4-8 settimane. Robyn lo fa automaticamente:

```r
robyn_refresh(
  robyn_object = OutputModels,
  dt_input = df_new, # Refresh con nuovi dati
  refresh_steps = 4,
  refresh_mode = "manual"
)
```

Se l'holdout MAPE (mean absolute percentage error) è sotto il 10%, il modello è affidabile. Sopra il 20% è pericoloso — segnale di overfitting o variabili mancanti.

## Interpretazione degli output e ottimizzazione del budget

L'output più critico di Robyn è la tabella **channel contribution**. Mostra la percentuale di contributo alla revenue di ogni canale e il suo **ROAS** (return on ad spend). Ma attenzione: questi sono valori ROAS storici, non **ROAS marginale**. L'ROAS marginale mostra quanto ricavo genera il prossimo 1.000 euro di spesa ed è calcolato dalla derivata della curva di saturazione.

La funzione `budget_allocator()` di Robyn ridistribuisce il budget corrente in base alle curve di saturazione. Se Google Search è saturo, sposta budget extra a Meta o TikTok. Questa ottimizzazione trova il punto sulla curva di risposta dove il rendimento marginale è equalizzato (economia 101: MR₁ = MR₂).

```r
AllocatorCollect <- robyn_allocator(
  robyn_object = OutputModels,
  select_model = "1_100_2", # Model ID scelto da Pareto
  scenario = "max_response_expected_spend",
  channel_constr_low = c(0.7, 0.7, 0.5), # Minimo 70% Google, 70% Meta, 50% TikTok
  channel_constr_up = c(1.5, 2.0, 3.0),  # Limiti di aumento massimo
  expected_spend = 100000
)
```

L'output mostra come distribuire il budget corrente di 100.000 euro per ottenere il ricavo ottimale. Ma è una raccomandazione statica — nella realtà cambiano creative refresh, competitor activity, stagionalità. Per questo devi **refresh l'MMM mensilmente**.

## Trade-off e limiti

MMM, a differenza dell'attribution, funziona a **livello aggregato**. Non puoi usarlo per la personalizzazione. Per Google Search non puoi vedere quale parola chiave performa meglio — puoi solo misurare il contributo complessivo di Search. Inoltre il modello è suscettibile al problema **correlazione ≠ causalità**: se le vendite aumentano d'estate e anche tu aumenti la spesa TV d'estate, il modello potrebbe dare troppo credito a TV.

Per risolvere questo, devi **validare l'MMM con test di incrementalità**. Misuri il vero effetto causale con geo-lift o holdout test e lo confronti con i risultati MMM. Robyn può includere i risultati di incrementalità come parametro di `calibration` — funziona come prior bayesiano e avvicina il modello alla realtà.

Un'altra difficoltà è l'**aggiunta di nuovi canali**. Se apri un nuovo canale (es. Snapchat) con soli 8 settimane di dati, Robyn non può imparare la curva di saturazione di quel canale. In questo caso devi impostare prior manuali o escludere le prime 12 settimane dal modello e aggiungerlo dopo.

Infine, MMM è **più potente quando unisce offline e online**. Se non includi nel modello la spesa di canali offline come TV, outdoor, sponsorizzazioni, il modello dà troppo credito ai canali online (bias della variabile omessa). Robyn è flessibile: accetta variabili proxy come GRP, reach, o persino brand search volume.

Una pipeline MMM costruita correttamente trasforma il planning del budget marketing da gioco di ipotesi a ingegneria basata su evidenze. Robyn lo rende accessibile come open-source — ma la struttura dati, il tuning degli iperparametri e la validazione dell'incrementalità richiedono ancora expertise umana. I team che investono in regressione econometrica al posto dell'attribution nel mondo senza cookie saranno 12 mesi avanti ai competitor nel 2027.