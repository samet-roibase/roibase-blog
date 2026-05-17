---
title: "Marketing Mix Modeling: Configurazione Pratica con Robyn"
description: "La libreria MMM open source di Meta, Robyn, consente di modellare curve di saturazione, adstock decay e validazione holdout su BigQuery data stack."
publishedAt: 2026-05-17
modifiedAt: 2026-05-17
category: data
i18nKey: data-005-2026-05
tags: [marketing-mix-modeling, robyn, meta, adstock, saturation-curve]
readingTime: 9
author: Roibase
---

La finestra di attribuzione è scesa a 7 giorni, il rifiuto del consenso ai cookie supera il 40%, l'attribuzione multi-touch tra canali è diventata inmisurevole. Nel 2026, l'unica strada affidabile per chi gestisce performance marketing è il modello econometrico aggregato — Marketing Mix Modeling. La libreria Robyn, rilasciata da Meta nel 2021, ha reso questo processo production-ready per la prima volta. Come interpretare le curve di saturazione, cosa significa adstock decay, in quale intervallo funziona la validazione holdout — in questo articolo configurerete Robyn su uno stack di dati BigQuery e risponderemo a queste domande.

## Che cos'è Robyn, e che cosa Non È

Robyn è una libreria R. È stata rilasciata open source dal team Meta Marketing Science. Lo scopo: regressione della spesa totale settimanale o giornaliera per canale + variabili macroeconomiche esterne (festività, stagionalità, prezzo) rispetto a una metrica di vendita. L'output: ROAS per ogni canale, livello di saturazione, effetto ritardato (adstock), allocazione ottimale del budget.

Che cosa non è: non è attribuzione last-click, non traccia path di conversione a livello utente. Non utilizza dati personali, non dipende da segnali di cookie. Usa modelli di regressione time series aggregati — non Ridge o Lasso, bensì ottimizzazione degli iperparametri con Nevergrad che scandaglia trasformazioni non-lineari complesse.

Nei processi MMM tipici vengono modellati 36 punti dati mensili. Robyn funziona anche con granularità giornaliera — si consiglia un minimo di 104 settimane (2 anni). Con meno di 52 settimane, la varianza rimane alta e gli intervalli di confidenza non sono affidabili.

## Curva di Saturazione: Funzione S-Curve e Hill

Nel cuore di Robyn si trovano due trasformazioni di saturazione: Adbudg (S-curve) e Hill. Entrambe codificano l'assunto dei rendimenti marginali decrescenti (diminishing returns). In altre parole, quando spendete altri 1.000 TL su un canale, non ottenete lo stesso incremento di conversione dei primi 1.000 TL.

**Formula della trasformazione Hill:**
```
y = K * (x^alpha) / (S^alpha + x^alpha)
```
- K: risposta massima (asintoto)
- S: punto di semi-saturazione (la spesa a questo livello raggiunge il 50% di K)
- alpha: pendenza della curva (alpha > 1 curva S, alpha < 1 concava)

Robyn ottimizza i parametri alpha e S per ogni canale mediante Nevergrad. Testa più di 10.000 combinazioni e seleziona il miglior fit in base al NRMSE (normalized root mean squared error) più basso.

**Interpretazione pratica:**
- Se per Google Ads S = 50.000 TL, una spesa settimanale di 50.000 TL raggiunge il 50% del potenziale di risposta.
- Se alpha = 2,5, la curva è una S ripida — sotto i 50.000 TL il rendimento è molto basso, sopra aumenta lentamente.
- Lo strumento di ottimizzazione del budget risponde a domande come: "È meglio aumentare da 50.000 TL a 60.000 TL su Google Ads o da 30.000 TL a 40.000 TL su Facebook?"

Nel mondo reale: il budget di ricerca di solito esce concavo (alpha < 1), il budget display/video esce come S-curve (alpha > 1). La ricerca ha domanda limitata, display ha un pool illimitato ma attenzione limitata.

## Adstock Decay: Modellazione dell'Effetto Ritardato

La spesa di marketing può influenzare le vendite lo stesso giorno, ma l'effetto può durare settimane. Uno spot TV genera brand recall anche 3 settimane dopo, il paid social perde effetto entro 7 giorni. Adstock codifica questo ritardo (carryover) e questa diminuzione (decay) in forma matematica.

Robyn offre due trasformazioni di adstock:
1. **Adstock geometrico:** Decadimento esponenziale. Parametro theta (intervallo 0-1). Se theta = 0,5, il 50% dell'effetto della settimana precedente si riporta a questa settimana.
2. **Adstock Weibull:** Più flessibile — picco ritardato + coda lunga. Parametri: shape (k) e scale (lambda). Preferito per canali come la TV che hanno un picco di effetto ritardato.

**Formula dell'adstock geometrico:**
```
adstocked_t = spend_t + theta * adstocked_(t-1)
```

Robyn ottimizza theta (o k, lambda) per ogni canale mediante grid search. L'utente specifica l'intervallo di theta nel file hyperparameters.json (ad esempio, 0-0,7) e il modello trova il theta ottimale.

**Cosa fare nella pratica:**

```r
hyperparameters <- list(
  google_ads_S = c(0.3, 3),    # intervallo theta per adstock
  google_ads_alphas = c(0.5, 3), # intervallo alpha per saturazione
  facebook_ads_S = c(0.1, 2),
  facebook_ads_alphas = c(1, 5)
)
```

Il risultato: se theta di Google Ads = 0,4 e Facebook Ads = 0,2, significa che l'effetto di Google Ads dura più a lungo. Nel budget planner lo considerate — un quarto della spesa su Google Ads lavora ancora 2 settimane dopo, quella di Facebook finisce in 1 settimana.

### Blocco di Codice: Trasformazione Adstock Semplice (R)

```r
apply_geometric_adstock <- function(spend, theta) {
  adstocked <- numeric(length(spend))
  adstocked[1] <- spend[1]
  for (t in 2:length(spend)) {
    adstocked[t] <- spend[t] + theta * adstocked[t - 1]
  }
  return(adstocked)
}

# Esempio: spesa Google Ads
google_spend <- c(10000, 15000, 12000, 8000, 20000)
theta_google <- 0.5
adstocked_google <- apply_geometric_adstock(google_spend, theta_google)
print(adstocked_google)
# [1] 10000.0 20000.0 22000.0 19000.0 29500.0
```

Questo codice in Robyn viene eseguito a livello C++ e ottimizzato, ma la logica è identica.

## Validazione Holdout: Test di Affidabilità del Modello

Quando Robyn migliora il fit del modello, esiste il rischio di overfitting. 10 canali + 5 variabili macroeconomiche + parametri di saturazione e adstock per ognuno → 30+ variabili. Con 104 punti dati, rappresenta troppi gradi di libertà.

Robyn utilizza la validazione holdout: esclude gli ultimi N giorni dal training del modello, il modello impara dai dati precedenti e fa previsioni nel periodo holdout, quindi confronta MAPE (mean absolute percentage error) con i valori reali.

**Definizione dell'holdout in Robyn:**

```r
InputCollect <- robyn_inputs(
  dt_input = df_marketing,
  dep_var = "revenue",
  paid_media_spends = c("google_ads", "facebook_ads", "tiktok_ads"),
  window_start = "2024-01-01",
  window_end = "2026-04-30",
  adstock = "geometric",
  prophet_vars = c("trend", "season", "holiday"),
  prophet_country = "TR"
)

# Holdout: ultime 8 settimane
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  ts_validation = TRUE,
  ts_holdout = 8  # ultime 8 settimane come set di test
)
```

**Interpretazione dei risultati:**
- NRMSE train < 0,10, NRMSE holdout < 0,15 → modello affidabile.
- NRMSE train = 0,05, holdout = 0,30 → overfitting, restringere l'intervallo degli iperparametri.
- Decomp.RSSD (response sum of squared differences): quanto della revenue prevista viene spiegato dalla contribution totale dei canali. 0,6+ è buono, 0,8+ eccellente.

Robyn esegue 5 trial contemporaneamente (differenti seed casuali di Nevergrad), ciascun trial con 2.000 iterazioni, mostrando i 10 migliori modelli sulla frontiera di Pareto. L'utente seleziona un modello in base ai vincoli aziendali (ad esempio, "Google Ads ROAS non può essere inferiore a 3").

## Robyn su BigQuery: Architettura Pipeline

Robyn gira in ambiente R, ma la fonte dati può essere BigQuery. Stack tipico:

1. **BigQuery data warehouse:** Tabella spesa giornaliera (spend_daily), tabella conversioni (conversions_daily), variabili macroeconomiche (holidays, weather, competitor_price).
2. **Trasformazione dbt:** Join + aggregazione. Convertite in righe settimanali, create colonne di spesa per canale.
3. **Script R (Cloud Run o Vertex AI):** Estraete da BigQuery con il pacchetto bigrquery, alimentate Robyn, riscrivete i risultati del modello su BigQuery.
4. **Dashboard Looker Studio:** Visualizzate l'output del modello — ROAS dei canali, split di budget ottimale, chart di saturazione.

**Esempio di modello dbt (marketing_mix_weekly.sql):**

```sql
WITH spend_agg AS (
  SELECT
    DATE_TRUNC(spend_date, WEEK) AS week_start,
    SUM(CASE WHEN channel = 'google_ads' THEN spend ELSE 0 END) AS google_ads_spend,
    SUM(CASE WHEN channel = 'facebook_ads' THEN spend ELSE 0 END) AS facebook_ads_spend,
    SUM(CASE WHEN channel = 'tiktok_ads' THEN spend ELSE 0 END) AS tiktok_ads_spend
  FROM `project.dataset.spend_daily`
  WHERE spend_date BETWEEN '2024-01-01' AND '2026-04-30'
  GROUP BY 1
),
revenue_agg AS (
  SELECT
    DATE_TRUNC(conversion_date, WEEK) AS week_start,
    SUM(revenue) AS total_revenue
  FROM `project.dataset.conversions_daily`
  WHERE conversion_date BETWEEN '2024-01-01' AND '2026-04-30'
  GROUP BY 1
)
SELECT
  s.week_start,
  s.google_ads_spend,
  s.facebook_ads_spend,
  s.tiktok_ads_spend,
  r.total_revenue
FROM spend_agg s
LEFT JOIN revenue_agg r USING (week_start)
ORDER BY week_start
```

Questa tabella viene materializzata in BigQuery, lo script R di Robyn la scarica con `bigrquery::bq_table_download()`. L'output del modello (contribution di ogni canale per ogni settimana) viene scritto su BigQuery — i tool BI leggono da lì.

## Budget Optimizer: Allocazione Ottimale di Pareto

Dopo il fit del modello, Robyn esegue un secondo modulo: l'allocatore di budget. Input: budget totale (ad esempio, 500.000 TL/settimana), vincoli di spesa per canale (ad esempio, Google Ads minimo 50.000 TL). Output: allocazione ottimale per massimizzare ROAS.

L'algoritmo: prende la derivata della curva di saturazione di ogni canale (ROAS marginale) e sposta la spesa finché ROAS marginale non si equalizza. È ottimizzazione con moltiplicatori di Lagrange.

**Esempio di tabella di risultati:**

| Canale | Spesa Attuale | Spesa Ottimale | Delta | ROAS Attuale | ROAS Ottimale |
|---|---|---|---|---|---|
| Google Ads | 200.000 TL | 180.000 TL | -20.000 | 4,2 | 4,5 |
| Facebook Ads | 150.000 TL | 200.000 TL | +50.000 | 3,8 | 4,1 |
| TikTok Ads | 100.000 TL | 120.000 TL | +20.000 | 3,5 | 3,9 |
| Display | 50.000 TL | 0 TL | -50.000 | 1,2 | — |

Interpretazione: il canale Display ha ROAS 1,2 anche ben sotto il livello di saturazione — dovrebbe essere eliminato. Google Ads è già oltre il punto di saturazione, ridurre la spesa di 20.000 TL aumenterebbe ROAS. Facebook Ads è ancora nella parte piatta della curva, un aumento di budget sarebbe efficiente.

Questa tabella viene presentata al CFO, l'output SQL di Robyn viene visualizzato su Looker. Il processo decisionale diventa data-driven — "diamo altri 50.000 TL a Facebook questo mese" non è più una supposizione, è un output del modello.

---

Per configurare Robyn servono 2 anni di dati granulari settimanali, un ambiente R, connessione a BigQuery e 4-6 ore di tuning degli iperparametri. Dopo il lancio in produzione, il modello viene ricalcolato una volta al mese (aggiungono le ultime 4 settimane, la finestra di holdout scorre). Le curve di saturazione e i parametri di adstock cambiano nel tempo — il theta di Facebook diminuisce nel mese di Ramadan, l'alpha di Google Ads aumenta prima del Black Friday. Robyn non cattura queste dinamiche automaticamente, ma aumentare la frequenza di retraining le coglie. Se l'architettura [dati first-party](https://www.roibase.com.tr/it/firstparty) è solidamente costruita su BigQuery, Robyn si appoggia su quell'architettura e rende il MMM aggregato operazionale. Nel mondo post-cookie, il modello econometrico sostituisce l'attribuzione — Robyn è il primo strumento open source che lo rende fattibile in ambienti produttivi.