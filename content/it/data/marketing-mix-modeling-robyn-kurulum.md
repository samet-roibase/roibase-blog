---
title: "Marketing Mix Modeling: Configurazione Pratica con Robyn"
description: "La libreria MMM open source di Meta, Robyn, illustrata attraverso curve di saturazione, adstock decay e validazione holdout su dati di produzione."
publishedAt: 2026-07-07
modifiedAt: 2026-07-07
category: verianalizi
i18nKey: data-005-2026-07
tags: [marketing-mix-modeling, robyn, adstock, saturation-curve, media-attribution]
readingTime: 9
author: Roibase
---

I modelli di attribuzione multi-touch hanno perso affidabilità nell'era post-cookie, mentre il marketing mix modeling torna in primo piano. Le suite MMM open source di Google e Meta (LightweightMMM, Robyn) offrono ai marketer la possibilità di misurare l'efficacia dei canali a livello aggregato. Con il rilascio di Robyn 3.11 all'inizio del 2025, l'ottimizzazione Bayesiana e la ricerca iperparametrica parallela lo hanno reso pronto per la produzione. Questo articolo illustra il setup di Robyn attraverso tre concetti fondamentali: la curva di saturazione (diminishing returns), l'adstock decay (effetto ritardato) e la validazione holdout (affidabilità del modello).

## Cos'è Robyn e perché è importante adesso

Robyn è un pacchetto R rilasciato da Meta come open source nel 2021. Il modello, basato sulla regressione Ridge, accetta dati di spesa per canale e conversioni a granularità settimanale/giornaliera e calcola il contributo di conversione incrementale di ciascun canale. Con i grandi aggiornamenti del 2024, il modello ha integrato i componenti di serie temporale di Prophet e il supporto all'esportazione in formato JSON — rendendo possibile il collegamento ai workflow Python.

Tre caratteristiche distinguono Robyn da altri approcci MMM: primo, modella la relazione spesa-conversione non in modo lineare ma tramite trasformazione Hill-Adstock (saturazione realistica); secondo, risolve l'ottimizzazione degli iperparametri con algoritmi genetici e l'ottimizzatore gradient-free Nevergrad (nessun tuning manuale); terzo, genera automaticamente metriche di qualità del modello (NRMSE, DECOMP.RSSD, MAPE). In produzione, testare l'affidabilità del modello attraverso la funzione built-in di validazione holdout è critico — lo mostreremo di seguito.

Il vantaggio del marketing mix modeling rispetto all'attribuzione è questo: operando su dati aggregati, non è influenzato dai vincoli GDPR/CCPA e aggira la complessità del customer journey cross-device. Lo svantaggio è che rimane a granularità settimanale — non è per l'ottimizzazione intraday delle campagne, ma per l'allocazione del budget trimestrale. In Roibase, all'interno dell'[architettura dati first-party](https://www.roibase.com.tr/it/firstparty), posizioniamo l'MMM insieme ai risultati dei test di incrementalità: un alto ROAS su MMM non è sufficiente; il canale deve essere validato con test geo-split o controlli sintetici.

## Preparazione dei dati: spesa per canale + variabili macro

Il minimo input per Robyn è una serie temporale settimanale contenente queste colonne:

```r
# Struttura dati di esempio (2 anni di dati settimanali)
data <- data.frame(
  date = seq(as.Date("2024-01-01"), by = "week", length.out = 104),
  revenue = rnorm(104, 50000, 8000),
  facebook_spend = rnorm(104, 5000, 1000),
  google_search_spend = rnorm(104, 7000, 1500),
  display_spend = rnorm(104, 3000, 800),
  competitor_index = rnorm(104, 100, 15),  # variabile macro
  holiday_flag = sample(0:1, 104, replace = TRUE)
)
```

**Numero di colonne canale:** Minimo 2, massimo 15 canali consigliati. Con 20+ canali il rischio di overfitting aumenta e la stabilità dei coefficienti cala. Se hai canali long-tail come affiliate, influencer, podcast, è più sano aggregarli in una singola colonna `other_digital`.

**Variabile macro:** Aggiungi variabili di controllo come stagionalità, giorni festivi, indice competitivo, indicatori economici — altrimenti il modello potrebbe attribuire ogni aumento di conversione ai canali media. L'integrazione di Prophet in Robyn cattura automaticamente trend e festività, ma se c'è uno shock specifico del settore (Black Friday, Ramadan) conviene aggiungere un `holiday_flag`.

**Controlli di qualità dei dati:**
- Nessuna colonna deve avere varianza zero (spesa costante = inutile)
- Tolleranza di missing value: 5% — Robyn non fa imputazione automatica
- Granularità settimanale è preferibile — i dati giornalieri amplificano il rumore, i dati mensili significano osservazioni insufficienti

Se la spesa proviene da diverse fonti (Google Ads API, Meta Marketing API, sistema finance interno) dovresti impostare una pipeline ETL nel tuo processo di [analisi dei dati](https://www.roibase.com.tr/it/verianalizi). Nel nostro workflow di produzione abbiamo una tabella `marketing_spend_weekly` in BigQuery; ogni lunedì mattina il modello dbt aggiorna questa tabella e uno script R la legge per eseguire Robyn.

## Saturazione e adstock: trasformazione Hill-Adstock

Robyn passa ogni spesa di canale attraverso una trasformazione in due fasi: prima adstock (effetto ritardato), poi saturazione (rendimenti decrescenti).

### Adstock decay (geometrico o Weibull)

L'effetto di una pubblicità TV non finisce immediatamente — rimane nella memoria dello spettatore per un paio di settimane. L'adstock lo modella. Robyn supporta due tipi di adstock: `geometric` (semplice, decadimento esponenziale) e `weibull` (flessibile, curva a S).

**Adstock geometrico:**

```
adstocked_spend[t] = spend[t] + θ × adstocked_spend[t-1]
```

Qui `θ` (theta) è il tasso di decadimento — 0.5 significa che metà dell'effetto della settimana precedente si trasporta a questa settimana. Robyn lo ricerca automaticamente nell'intervallo 0–0.9.

**Adstock Weibull:** Più complesso — ha parametri di forma e scala. Per canali "awareness" come TV, outdoor, influencer, Weibull fornisce un fit migliore perché l'effetto può partire lentamente, raggiungere un picco e poi cadere rapidamente.

**Consiglio pratico:** Nella prima iterazione del modello usa geometric — la convergenza è più veloce. Se le performance degradano (NRMSE > 0.15) e il mix è ricco di consapevolezza, prova Weibull.

### Saturazione: funzione Hill

Raddoppiando la spesa non raddoppi le conversioni — ci sono rendimenti decrescenti. Robyn lo modella con l'equazione Hill:

```
effect = spend^α / (K^α + spend^α)
```

- `α` (alfa): pendenza della curva — piccolo significa lenta saturazione, grande significa rapida
- `K`: punto di semi-saturazione — quando la spesa raggiunge questo punto, si ottiene metà dell'effetto massimo

Durante la ricerca degli iperparametri, Robyn trova questi due parametri per ogni canale. Il risultato è la "curva di risposta" di ogni canale — ad esempio, potresti scoprire che Facebook Ads diventa piatto dopo 10K€ di spesa, mentre Google Search rimane lineare fino a 20K€.

**A cosa serve la curva di saturazione:** Negli scenari di riallocazione del budget. Se la pendenza di un canale è già piatta (regione a basso rendimento), spostare budget da quel canale a uno con pendenza più ripida aumenterà il ROAS complessivo.

## Esecuzione del modello e tuning degli iperparametri

L'installazione di Robyn è semplice:

```r
install.packages("Robyn")
library(Robyn)
```

Nella funzione InputCollect definisci la struttura dei dati:

```r
InputCollect <- robyn_inputs(
  dt_input = data,
  date_var = "date",
  dep_var = "revenue",
  paid_media_spends = c("facebook_spend", "google_search_spend", "display_spend"),
  context_vars = c("competitor_index", "holiday_flag"),
  window_start = "2024-01-01",
  window_end = "2025-12-31",
  adstock = "geometric"  # o "weibull"
)
```

**Intervalli degli iperparametri:**
Robyn ricerca i valori theta adstock e alpha/K di saturazione per ogni canale all'interno dell'intervallo specificato. Gli intervalli predefiniti sono solitamente sufficienti, ma se hai knowledge del dominio puoi aggiungere vincoli:

```r
hyperparameters <- list(
  facebook_spend_alphas = c(0.5, 3),   # pendenza saturazione
  facebook_spend_gammas = c(0.3, 1),   # inflession saturazione
  facebook_spend_thetas = c(0, 0.5)    # adstock decay (geometrico)
)
```

Esecuzione del modello:

```r
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,     # numero iterazioni algoritmo genetico
  trials = 5,            # quanti diversi random seed
  cores = 4
)
```

Questo step richiede 10–30 minuti (dipende dalla grandezza dei dati). Al termine mostra l'insieme di modelli Pareto-optimal — trade-off tra NRMSE (qualità dell'adattamento) e DECOMP.RSSD (smoothness della distribuzione del contributo dei canali).

**Selezione del modello:** Robyn suggerisce 10–20 modelli Pareto. Selezionare l'NRMSE più basso non è sempre corretto — alcuni modelli potrebbero overfitting. L'argomento `robyn_clusters` in `robyn_outputs()` raggruppa i modelli e seleziona il baricentro del cluster più stabile.

## Validazione holdout: misurare l'affidabilità del modello

Una delle caratteristiche più critiche di Robyn è la validazione holdout integrata. Durante l'addestramento del modello, trattieni le ultime N settimane come set di test, quindi genera previsioni per quel periodo e confrontale con i valori reali.

```r
# Trattieni le ultime 8 settimane
OutputModels <- robyn_run(
  InputCollect = InputCollect,
  iterations = 2000,
  trials = 5,
  cores = 4,
  calibration_input = NULL,
  holdout_periods = 8  # ultime 8 settimane come test set
)
```

I risultati holdout sono nella tabella `OutputModels$resultHypParam`:

| Model ID | Train NRMSE | Holdout MAPE | Holdout NRMSE |
|---|---|---|---|
| 1_123_4 | 0.08 | 12.3% | 0.14 |
| 2_456_1 | 0.07 | 18.5% | 0.21 |

**Holdout MAPE < 15%** è generalmente considerato production-ready. Valori oltre il 20% indicano che la capacità di previsione futura del modello è debole — potrebbe esserci un problema di qualità dei dati o gli intervalli degli iperparametri potrebbero essere troppo ampi.

**Trappola pratica:** Se il periodo holdout contiene un grande outlier (ad esempio, un'interruzione di piattaforma, una campagna virale) il modello non potrà prevederlo e il MAPE esploderà. In questo caso, sposta il periodo holdout e ripeti il test, oppure contrassegna quella settimana come anomalia.

Un vantaggio collaterale della validazione holdout: la possibilità di fare cross-check con i risultati dei test di incrementalità. Ad esempio, se l'MMM mostra un ROAS del 30% per Facebook ma un precedente geo-split test ne ha trovato il 15%, probabilmente l'MMM sta attribuendo a Facebook un effetto macro correlato (stagionalità, trend organico). Rilevare questo tipo di incoerenze è importante; nel nostro processo di [CDP e retention engineering](https://www.roibase.com.tr/it/retention-engineering-cdp), colleghiamo l'output dell'MMM al dashboard degli esperimenti.

## Ottimizzazione del budget e pianificazione degli scenari

Una volta costruito il modello Robyn, ci sono due usi principali: **riallocazione del budget** (distribuzione ottimale dei canali) e **analisi what-if** (cosa succede se aumentiamo il budget del 20%?).

**Budget allocator:**

```r
AllocatorCollect <- robyn_allocator(
  InputCollect = InputCollect,
  OutputCollect = OutputModels,
  select_model = "1_123_4",  # modello Pareto selezionato
  scenario = "max_response",  # o "target_efficiency"
  channel_constr_low = 0.7,   # ogni canale min 70% del budget attuale
  channel_constr_up = 1.5     # max 150%
)
```

L'output suggerisce la nuova spesa per ogni canale e il revenue incrementale atteso:

| Canale | Attuale | Suggerito | Delta | Revenue Incrementale |
|---|---|---|---|---|
| Facebook | 5K€ | 4.2K€ | -16% | -800€ |
| Google Search | 7K€ | 9.1K€ | +30% | +3.2K€ |
| Display | 3K€ | 2.7K€ | -10% | -200€ |

Questa tabella dice "se dai il 30% di budget in più a Google Search e riduci Facebook del 16%, puoi aumentare il revenue totale di 2.2K€". I parametri di vincolo (low/up) prevengono cambiamenti drastici — nella pratica, dimezzare un canale in una notte porta rischi operazionali.

**Pianificazione degli scenari:** Con il parametro `expected_spend` puoi variare il budget totale e ottenere la nuova distribuzione ottimale. Se ad esempio il budget aumenterà del 25% in Q4, Robyn ti dirà come distribuirlo tra i canali in quello scenario.

Nei progetti Roibase esportiamo automaticamente l'output dell'MMM in Google Sheets o Looker Studio — il CMO vede le raccomandazioni del modello nei meeting settimanali di budget. L'esportazione JSON:

```r
robyn_write(InputCollect, OutputModels, select_model = "1_123_4", export = TRUE)
```

Genera un file `Robyn_[timestamp].json` contenente tutti i dati degli iperparametri, coefficienti e curve di risposta. Puoi leggerlo con