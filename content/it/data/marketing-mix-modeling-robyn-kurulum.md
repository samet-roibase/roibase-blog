---
title: "Marketing Mix Modeling: Configurazione pratica con Robyn"
description: "Configurazione MMM con framework Robyn di Meta: curve di saturazione, adstock decay, validazione holdout. Include codice R e integrazione BigQuery."
publishedAt: 2026-07-24
modifiedAt: 2026-07-24
category: data
i18nKey: data-005-2026-07
tags: [marketing-mix-modeling, robyn, attribution, data-science, bigquery]
readingTime: 9
author: Roibase
---

L'attribution si è frammentata negli ultimi tre anni. iOS 14.5, Consent Mode v2, il ritiro dei cookie di terze parti — tutto ha lasciato il marketer digitale con la stessa domanda pressante: quale canale funziona realmente? Marketing Mix Modeling (MMM) è la risposta statistica che rompe la dipendenza da pixel e cookie, operando a livello aggregato dei dati. Il framework open source Robyn di Meta trasforma MMM da esercizio accademico a pipeline production-ready. Questo articolo fornisce i passaggi concreti per configurare Robyn da zero, interpretare le curve di saturazione, regolare i parametri di adstock decay e validare il modello con holdout validation.

## Cos'è MMM e perché è critico adesso

Marketing Mix Modeling spiega statisticamente la relazione tra spesa media e vendite o conversioni tramite regressione. Non richiede dati a livello utente — funziona con metriche aggregate settimanali o giornaliere: spesa totale, impressioni, vendite. Il modello calcola il contributo marginale incrementale di ogni canale e identifica quando un canale entra in saturazione.

L'attribution last-click classico è basato su pixel — assegna credito all'ultimo canale toccato dall'utente. MMM invece osserva tutti i canali nella stessa finestra temporale, isolando la correlazione. Ad esempio, se la pubblicità TV ha un ritardo di 3 settimane rispetto alle vendite (carryover effect), il modello cattura questo lag con il parametro "adstock". La curva di saturazione mostra rendimenti decrescenti: i primi 100.000 € di spesa generano 50 conversioni mentre i successivi 100.000 € producono solo 20.

Robyn incapsula questo framework matematico come pacchetto R addestrato sui dati di campagne Meta. Include regressione ridge bayesiana, multi-objective evolutionary algorithm (MOEA) per il tuning degli iperparametri, e ottimizzazione Nevergrad. Non è un setup manuale — una volta preparati i dati, 50 righe di codice R producono il modello.

## Preparazione dei dati: da BigQuery a Robyn

Robyn accetta come input un singolo CSV o data.frame. Ogni riga rappresenta un periodo temporale (settimana o giorno), ogni colonna è una metrica di canale — spesa, impressioni o vendite. Non tollera dati mancanti — se una cella è vuota, devi fare imputazione. Lo schema minimo è:

| date       | tv_spend | fb_spend | google_spend | revenue | control_var |
|------------|----------|----------|--------------|---------|-------------|
| 2024-01-01 | 50000    | 12000    | 8000         | 120000  | 0.8         |
| 2024-01-08 | 55000    | 13000    | 9000         | 135000  | 0.9         |

Per estrarre questi dati da BigQuery con aggregazione settimanale:

```sql
SELECT
  DATE_TRUNC(event_date, WEEK) AS date,
  SUM(IF(channel = 'tv', spend, 0)) AS tv_spend,
  SUM(IF(channel = 'facebook', spend, 0)) AS fb_spend,
  SUM(IF(channel = 'google', spend, 0)) AS google_spend,
  SUM(revenue) AS revenue,
  AVG(seasonality_index) AS control_var
FROM `project.dataset.marketing_events`
WHERE event_date BETWEEN '2022-01-01' AND '2024-12-31'
GROUP BY 1
ORDER BY 1
```

La variabile di controllo (trend, stagionalità, indicatori macroeconomici) non è obbligatoria ma aumenta il potere predittivo del modello. Ad esempio nel retail, se gennaio è il mese dei saldi, aggiungi una variabile dummy. Robyn integra queste variabili come baseline "organic" nella regressione.

Per caricare i dati in R usa il pacchetto `bigrquery`:

```r
library(bigrquery)
bq_auth(path = "service-account-key.json")
sql <- "SELECT date, tv_spend, fb_spend, google_spend, revenue FROM ..."
df <- bq_project_query("your-project-id", sql) %>% bq_table_download()
```

La funzione `robyn_inputs()` valida la conformità dello schema di Robyn. La colonna della data deve essere di classe Date, le metriche di classe numeric.

## Configurazione del modello Robyn: adstock e saturazione

Il nucleo di Robyn sono le funzioni `robyn_inputs()` e `robyn_run()`. Il primo passaggio è definire gli input del modello:

```r
library(Robyn)

InputCollect <- robyn_inputs(
  dt_input = df,
  date_var = "date",
  dep_var = "revenue",
  dep_var_type = "revenue",
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "IT",
  paid_media_spends = c("tv_spend", "fb_spend", "google_spend"),
  paid_media_vars = c("tv_spend", "fb_spend", "google_spend"),
  context_vars = c("control_var"),
  adstock = "geometric",
  window_start = "2022-01-01",
  window_end = "2024-10-31"
)
```

**Selezione del tipo di adstock:**
- `geometric`: Più comune. Decay rate costante (ad es. il 80% rimane ogni settimana). Appropriato per TV e display.
- `weibull`: Decay asimmetrico — diminuzione iniziale veloce, rallentamento successivo. Logico per video e campagne influencer.

La formula dell'adstock geometrico:

```
transformed_value[t] = spend[t] + theta * transformed_value[t-1]
```

`theta` è il decay rate (tra 0 e 1). Robyn lo ottimizza automaticamente ma puoi fornire un range manuale:

```r
hyperparameters <- list(
  tv_spend_alphas = c(0.5, 3),       # coefficiente curva di saturazione
  tv_spend_gammas = c(0.3, 1),       # punto di inflessione saturazione
  tv_spend_thetas = c(0, 0.5),       # adstock decay rate
  fb_spend_alphas = c(0.5, 3),
  fb_spend_gammas = c(0.3, 1),
  fb_spend_thetas = c(0, 0.3)
)

InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  hyperparameters = hyperparameters
)
```

**Parametri di saturazione:**
- `alpha`: Forma della curva. Alpha elevato → saturazione tardiva.
- `gamma`: Punto di inflessione — 0.5 significa piega al punto medio.

La saturazione è modellata con l'equazione di Hill:

```
response = spend^alpha / (gamma^alpha + spend^alpha)
```

Robyn ottimizza questi parametri con algoritmi evolutivi. Genera 2000 modelli, seleziona i migliori trade-off dalla frontiera di Pareto (equilibrio tra R² e NRMSE).

## Esecuzione del modello e interpretazione dei risultati

Per eseguire il modello Robyn:

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  cores = 8
)
```

L'output è una lista — ogni iterazione corrisponde a un set di iperparametri differente. Robyn seleziona automaticamente i 3 migliori modelli (ottimali secondo Pareto). I risultati includono:

```r
OutputModels$resultHypParam    # parametri di tutti i modelli
OutputModels$xDecompAgg        # decomposizione contributo per canale
OutputModels$resultCalibration # score validazione holdout
```

**Esempio di tabella decomposizione:**

| channel      | total_spend | total_response | roi   | mean_response |
|--------------|-------------|----------------|-------|---------------|
| tv_spend     | 2400000     | 1800000        | 0.75  | 15000         |
| fb_spend     | 600000      | 720000         | 1.20  | 6000          |
| google_spend | 400000      | 560000         | 1.40  | 4667          |

**Interpretazione ROI:** Facebook 1.20 — ogni 1 € speso genera 1.20 € di ritorno. TV 0.75 — non ROI negativo, bensì contributo incrementale di 0.75 € sopra baseline. Robyn misura l'incrementalità, non il credito last-click.

**Rilevamento saturazione:** Robyn traccia la curva di saturazione:

```r
robyn_onepagers(InputCollect, OutputModels, select_model = "2_100_3")
```

Nel grafico osserva dove la curva si appiattisce al crescere della spesa. Ad esempio, se TV supera 80.000 € il guadagno marginale scende del 50% — segnale critico per l'ottimizzazione del budget.

## Validazione holdout e affidabilità del modello

Per utilizzare il modello MMM in produzione il dataset storico deve essere diviso: training set (ad es. da gennaio 2022 a ottobre 2024) + holdout set (novembre-dicembre 2024). Il modello è addestrato sul training set e testato sull'holdout. Se MAPE (mean absolute percentage error) è sotto il 10% il modello è affidabile.

Robyn esegue validazione holdout automaticamente:

```r
InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  window_start = "2022-01-01",
  window_end = "2024-10-31",
  rollingWindowStartWhich = 52,  # ultimi 52 giorni come holdout
  rollingWindowEndWhich = 4
)
```

Il risultato appare nella tabella `resultCalibration`:

| model_id  | nrmse_train | nrmse_val | decomp.rssd |
|-----------|-------------|-----------|-------------|
| 2_100_3   | 0.08        | 0.12      | 0.05        |

**NRMSE (normalized root mean squared error):** Più basso è meglio. 0.12 è accettabile (sotto 0.15 è production-ready).
**decomp.rssd:** Coerenza della decomposizione tra training e validazione. 0.05 → 5% di divergenza → modello stabile.

Se la validazione holdout fallisce due scenari possibili: (1) Dati insufficienti — servono almeno 2 anni di dati settimanali. (2) Variabile mancante — aggiungi stagionalità, spesa competitor, variazioni di prezzo o altri confounding factor.

## Collegare l'output di Robyn al meccanismo decisionale

Per rialimentare i risultati di Robyn in BigQuery, esporta la tabella decomposizione come CSV:

```r
write.csv(OutputModels$xDecompAgg, "robyn_output.csv")
```

Caricalo in BigQuery:

```sql
LOAD DATA OVERWRITE `project.dataset.mmm_results`
FROM FILES (
  format = 'CSV',
  uris = ['gs://bucket/robyn_output.csv']
);
```

Questa tabella si collega a dashboard (Looker, Tableau) o a un ottimizzatore di budget. Ad esempio con un modello dbt calcola la soglia di saturazione:

```sql
WITH saturation AS (
  SELECT
    channel,
    total_spend,
    roi,
    total_spend / NULLIF(roi, 0) AS optimal_spend
  FROM `project.dataset.mmm_results`
)
SELECT * FROM saturation WHERE roi > 1.0 ORDER BY roi DESC;
```

Questa query ordina i canali con ROI > 1 — lista prioritaria per aumento budget. Robyn ha anche una funzione budget allocator:

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = "2_100_3",
  scenario = "max_response",
  channel_constr_low = c(0.7, 0.7, 0.7),
  channel_constr_up = c(1.5, 1.5, 1.5)
)
```

L'output suggerisce nuovo budget per ogni canale. I vincoli limitano il budget al 70-150% della spesa attuale (il cambiamento improvviso rappresenta rischio operativo).

La configurazione di [architettura dati first-party e misurazione](https://www.roibase.com.tr/it/firstparty) è critica per MMM — la qualità dei dati alimentati a Robyn impatta direttamente l'affidabilità del modello. Se tracking server-side, identity resolution e integrazione consent mode mancano, bias si accumula a livello aggregato.

## Insidie comuni e mitigazione

**Multicollinearità:** Se due canali sono sempre attivi simultaneamente (ad es. TV e Facebook sempre insieme), il modello non riesce a separare il contributo. Controlla il Variance Inflation Factor (VIF):

```r
library(car)
vif_model <- lm(revenue ~ tv_spend + fb_spend + google_spend, data = df)
vif(vif_model)
```

VIF > 5 → problema. Soluzioni: (1) Spegni temporaneamente un canale per un test holdout. (2) Raccogli serie più lunghe.

**Incertezza sulla latenza:** Se il parametro adstock è configurato male (ad es. TV con 1 settimana anziché 4), il modello produce risultati fuorvianti. Valida il vero decay time con A/B test o geo-experiment. Il pacchetto GeoLift di Meta fa esattamente questo.

**Controllo stagionalità mancante:** Se i component Prophet (trend, stagione, festività) non sono aggiunti, il picco di vendite di gennaio può essere attribuito ai media (in realtà è effetto dei saldi natalizia). Abilita sempre Prophet:

```r
InputCollect <- robyn_inputs(
  InputCollect = InputCollect,
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "IT"
)
```

**Model drift:** Quando la dinamica di mercato cambia (nuovo competitor, variazione prezzo, aggiornamento algoritmo platform) il modello invecchia. Soluzione: refresh trimestrale — riaddestrare con ultimi 2 anni di dati. In Robyn usa il parametro `json_file` per versionare il modello:

```r
robyn_write(InputCollect, OutputModels, dir = "./robyn_models/")
```

Ogni versione del modello è etichettata con git commit — essenziale per A/B test.

MMM da solo non è sufficiente. Validazione con incrementality test (geo-experiment, PSA holdout)