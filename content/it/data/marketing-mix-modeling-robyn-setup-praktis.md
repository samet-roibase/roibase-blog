---
title: "Marketing Mix Modeling: Configurazione pratica con Robyn"
description: "Costruire un modello di attribuzione con Robyn di Meta: curve di saturazione, adstock decay e validazione holdout. SQL, R e pipeline production."
publishedAt: 2026-06-21
modifiedAt: 2026-06-21
category: data
i18nKey: data-005-2026-06
tags: [marketing-mix-modeling, robyn, adstock, attribution, mmm]
readingTime: 9
author: Roibase
---

L'abbandono dei cookie di terze parti e le normative sulla privacy spostano l'attribuzione da metodi deterministici a modelli probabilistici. Marketing Mix Modeling (MMM) — uno strumento statistico degli anni '60 — ritorna al centro della scena. Il framework open source Robyn di Meta fornisce l'aspetto pratico di questa trasformazione: con inferenza bayesiana, curve di saturazione e adstock decay, colleghi la spesa di marketing settimanale alle vendite tramite regressione, portandola in produzione. Questo articolo mostra come configurare Robyn, adattare il modello a dati reali, eseguire grid search di iperparametri e prevenire l'overfitting con validazione holdout.

## Che cosa è Robyn e come differisce dalla regressione classica

Robyn è un framework MMM open source scritto in R. Meta l'ha sviluppato nel 2020 per il proprio team di marketing e rilasciato nel 2021. Le differenze rispetto alla regressione lineare classica sono significative:

**Trasformazione Adstock**: L'effetto del marketing non è immediato — uno spot televisivo genera top-of-mind per settimane. Adstock modella il contributo della spesa passata alle vendite odierne tramite decadimento esponenziale. Robyn supporta funzioni adstock geometriche e Weibull. Geometrica è semplice: `adstock_t = spend_t + θ × adstock_(t-1)`, dove θ è il parametro di decadimento. Weibull è più flessibile — puoi posizionare l'effetto di picco con ritardo.

**Saturazione (Rendimenti decrescenti)**: La relazione spesa-vendite non è lineare. I primi 100.000 EUR generano ROI dell'80%, mentre i successivi 100.000 EUR possono generare il 40%. Robyn applica funzioni di saturazione Hill e S-curve. L'equazione di Hill è: `y = V_max × x^n / (K^n + x^n)`, dove K è il punto di semisaturazione e n è la pendenza. Questa non-linearità è critica per l'ottimizzazione del budget a livello di canale.

**Tuning degli iperparametri**: I valori di decay dell'adstock, K e n di saturazione sono sconosciuti — li trovi tramite grid search. Robyn utilizza un algoritmo genetico (NSGAII) per testare migliaia di combinazioni di modelli, selezionando i migliori trade-off dalla frontiera di Pareto.

## Preparazione dei dati: da SQL a granularità settimanale

Robyn funziona con granularità settimanale. Dai log delle transazioni giornaliere aggreghi spesa media e ricavi settimanali. Esempio di query BigQuery:

```sql
WITH weekly_revenue AS (
  SELECT
    DATE_TRUNC(order_date, WEEK) AS week_start,
    SUM(revenue) AS revenue
  FROM `project.dataset.orders`
  WHERE order_date >= '2024-01-01'
  GROUP BY 1
),
weekly_spend AS (
  SELECT
    DATE_TRUNC(date, WEEK) AS week_start,
    channel,
    SUM(cost) AS spend
  FROM `project.dataset.marketing_costs`
  WHERE date >= '2024-01-01'
  GROUP BY 1, 2
)
SELECT
  r.week_start,
  r.revenue,
  COALESCE(s_google.spend, 0) AS google_search_spend,
  COALESCE(s_meta.spend, 0) AS meta_paid_social_spend,
  COALESCE(s_tv.spend, 0) AS tv_spend
FROM weekly_revenue r
LEFT JOIN weekly_spend s_google
  ON r.week_start = s_google.week_start AND s_google.channel = 'google_search'
LEFT JOIN weekly_spend s_meta
  ON r.week_start = s_meta.week_start AND s_meta.channel = 'meta'
LEFT JOIN weekly_spend s_tv
  ON r.week_start = s_tv.week_start AND s_tv.channel = 'tv'
ORDER BY 1;
```

La query produce una riga per settimana, 1 ricavo e N colonne di spesa per canale. Robyn accetta CSV, ma in produzione è più pulito estrarre direttamente da BigQuery in R. Con il pacchetto `bigrquery`:

```r
library(bigrquery)
library(Robyn)

bq_auth()
df_input <- bq_project_query(
  "project-id",
  "SELECT week_start, revenue, google_search_spend, meta_paid_social_spend, tv_spend FROM `project.dataset.mmm_input`"
) %>% bq_table_download()
```

Requisito minimo di dati: 104 settimane (2 anni). Meno dati comportano rischi di overfitting. I prior bayesiani di Robyn funzionano con 52 settimane, ma 104+ settimane catturano meglio la stagionalità.

## Configurazione del modello: robyn_inputs e griglia di iperparametri

Robyn crea un oggetto di configurazione con la funzione `robyn_inputs()`:

```r
InputCollect <- robyn_inputs(
  dt_input = df_input,
  date_var = "week_start",
  dep_var = "revenue",
  dep_var_type = "revenue",
  paid_media_spends = c("google_search_spend", "meta_paid_social_spend", "tv_spend"),
  paid_media_vars = c("google_search_spend", "meta_paid_social_spend", "tv_spend"),
  context_vars = c("competitor_index", "seasonality"),
  window_start = "2024-01-01",
  window_end = "2026-06-14",
  adstock = "geometric",
  hyperparameters = list(
    google_search_spend_alphas = c(0.5, 3),
    google_search_spend_gammas = c(0.3, 1),
    google_search_spend_thetas = c(0, 0.3),
    meta_paid_social_spend_alphas = c(0.5, 3),
    meta_paid_social_spend_gammas = c(0.3, 1),
    meta_paid_social_spend_thetas = c(0, 0.5),
    tv_spend_alphas = c(0.5, 3),
    tv_spend_gammas = c(0.3, 1),
    tv_spend_thetas = c(0.1, 0.7)
  )
)
```

**Spiegazione degli iperparametri:**

- **alpha**: Parametro di pendenza della funzione di saturazione Hill (n). Alpha alto = saturazione tardiva.
- **gamma**: Parametro K di Hill — punto di semisaturazione. Gamma basso = saturazione precoce.
- **theta**: Decadimento adstock geometrico. 0 = effetto istantaneo, 0.7 = 70% trasferito alla settimana successiva.

Fornisci un intervallo min-max per ogni canale. Robyn esegue grid search entro questi intervalli. Per TV, il limite superiore di theta è 0.7 — lo share-of-mind dura a lungo. Per paid search, 0.3 — la conversione è a breve termine.

## Esecuzione del modello: robyn_run e ottimizzazione Pareto

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  cores = 8,
  iterations = 2000,
  trials = 5,
  outputs = FALSE
)
```

`robyn_run()` esegue un algoritmo genetico su 2000 iterazioni testando combinazioni di iperparametri. Ad ogni iterazione, minimizza NRMSE (normalized root mean squared error) e DECOMP.RSSD (decomposition residual sum of squares difference). Seleziona 5 modelli dalla frontiera di Pareto — trade-off tra qualità del fit e logica aziendale (ad esempio, l'ROI della TV non dovrebbe superare quello della ricerca).

L'oggetto output contiene la tabella `df_allpareto` — ogni modello con ROI a livello di canale, ROAS e CPA. Numero di righe = iterazioni × trial. Include queste colonne:

| Colonna | Descrizione |
|---------|-------------|
| `solID` | ID del modello |
| `nrmse` | Normalized RMSE — basso = buon fit |
| `decomp.rssd` | Decomposition RSSD — basso = contributi stabili |
| `mape` | Mean absolute percentage error |
| `rsq_train` | R² di training |
| `google_search_spend_roi` | ROI di Google Search (ricavi/spesa) |
| `meta_paid_social_spend_roi` | ROI di Meta |
| `tv_spend_roi` | ROI della TV |

Scegli il miglior modello per NRMSE + DECOMP.RSSD + logica aziendale. La dashboard Shiny di Robyn offre un'interfaccia visiva, ma in produzione la selezione programmatica è più controllata:

```r
best_model_id <- OutputModels$allPareto %>%
  filter(nrmse < 0.1, decomp.rssd < 0.05) %>%
  arrange(nrmse) %>%
  slice(1) %>%
  pull(solID)
```

## Validazione Holdout: prevenire l'overfitting

Un modello adattato ai dati di training potrebbe non generalizzare bene ai dati invisibili. Con Robyn, esegui validazione holdout: escludere le ultime 8-12 settimane dal training e usarle come test set. Il modello si adatta ai dati di training, fa previsioni sul test set. Se MAPE (mean absolute percentage error) sul test set è inferiore al 15%, il modello è pronto per la produzione.

```r
InputCollect_train <- robyn_inputs(
  dt_input = df_input,
  date_var = "week_start",
  dep_var = "revenue",
  window_start = "2024-01-01",
  window_end = "2026-04-12",  # Ultime 10 settimane in holdout
  # ... altri parametri uguali
)

OutputModels_train <- robyn_run(InputCollect_train, iterations = 2000)

# Previsioni sul test set
df_test <- df_input %>% filter(week_start > "2026-04-12")
predictions <- predict(OutputModels_train, newdata = df_test)
mape_test <- mean(abs((df_test$revenue - predictions) / df_test$revenue)) * 100
```

Se MAPE > 20%, il modello è overfitting. Riduci gli intervalli di iperparametri o aggiungi variabili di contesto (indice economico, meteo). La regolarizzazione bayesiana di Robyn (penalty di ridge) riduce l'overfitting, ma la validazione holdout è la garanzia finale.

## Visualizzazione delle curve di adstock e saturazione

Robyn, con `robyn_outputs()`, traccia curve di adstock e saturazione. In produzione, esporti questi grafici come PNG e li incorpori nel dashboard BI:

```r
robyn_outputs(
  InputCollect = InputCollect,
  OutputModels = OutputModels,
  select_model = best_model_id,
  export = TRUE,
  export_location = "/data/mmm_output/"
)
```

File esportati:

- `saturate_curves.png` — Per ogni canale, spesa vs. risposta. Asse X: spesa, asse Y: ricavi previsti. La curva si appiattisce al punto di saturazione.
- `adstock_curves.png` — Profilo di decadimento. Asse X: settimana, asse Y: moltiplicatore adstock. Per la TV, puoi vedere decadimento di 6-8 settimane.
- `waterfall.png` — Decomposizione dei ricavi: base + stagionalità + contributo per canale.

Con questi grafici, comunichi al CMO non "Aumenta la spesa in TV del 30%", ma "La TV è al punto di saturazione; spostando il 20% su ricerca, l'ROI totale aumenta del 12%".

## Pipeline di produzione: dbt + Robyn + Looker Studio

MMM non è un'analisi una tantum — richiede aggiornamento settimanale. Con l'approccio di Roibase per [First-Party Veri & Ölçüm Mimarisi](https://www.roibase.com.tr/it/firstparty), la pipeline è:

1. **dbt**: Crea la tabella `mmm_input` dagli eventi raw di BigQuery (query SQL sopra). Esecuzione programmata dbt Cloud ogni lunedì 00:00.
2. **Script R Robyn**: Eseguito in un container Cloud Run. Estrae `mmm_input` con `bigrquery`, chiama `robyn_run()`, scrive output su BigQuery (tabella `mmm_output`: `week_start`, `channel`, `roi`, `predicted_revenue`).
3. **Looker Studio**: Alimentato da `mmm_output`, mostra dashboard di trend ROI per canale, curve di saturazione e raccomandazioni di budget.

Pacchetti il container con Dockerfile:

```dockerfile
FROM rocker/tidyverse:4.2.0
RUN R -e "install.packages('Robyn', repos='https://cloud.r-project.org')"
RUN R -e "install.packages('bigrquery')"
COPY run_mmm.R /app/run_mmm.R
CMD ["Rscript", "/app/run_mmm.R"]
```

Attivi con Cloud Scheduler ogni lunedì 06:00. Robyn con 2000 iterazioni richiede ~20 minuti (con 8 core).

## Riallocazione del budget: decisioni dalla frontiera di Pareto

L'output più potente di Robyn è l'ottimizzatore di budget. La funzione `robyn_allocator()` ridistribuisce il budget tra canali per massimizzare i ricavi totali:

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = best_model_id,
  scenario = "max_response",
  channel_constr_low = c(0.7, 0.7, 0.5),  # Google, Meta, TV: mantenere min 70%, 70%, 50%
  channel_constr_up = c(1.5, 1.5, 2),     # Max 150%, 150%, 200%
  expected_spend = 500000,                # Budget totale
  expected_spend_days = 90
)
```

Tabella di output:

| Canale | Spesa attuale | Spesa ottimizzata | Delta | Lift ricavi previsto |
|--------|---------------|-------------------|-------|----------------------|
| Google Search | 200.000 | 180.000 | -