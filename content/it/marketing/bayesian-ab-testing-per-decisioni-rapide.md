---
title: "Decisioni Rapide con il Test Bayesiano A/B"
description: "Oltre il vincolo frequentista p<0.05: campionamento sequenziale, arresto anticipato, quantificazione dell'incertezza. Guida per accelerare la performance marketing."
publishedAt: 2026-08-13
modifiedAt: 2026-08-13
category: marketing
i18nKey: marketing-002-2026-08
tags: [bayesian-testing, ab-test, conversion-optimization, frequentist-statistics, sequential-sampling]
readingTime: 9
author: Roibase
---

Nel performance marketing, il test A/B viene ancora condotto con la metodologia frequentista degli anni 2010: calcolo della dimensione campionaria fissa, soglia p<0.05, attesa del "risultato significativo". Stai testando tre varianti di creative su Meta Ads, una perde chiaramente ma "la dimensione campionaria non è sufficiente" — allora bruci budget per altre due settimane. Il test Bayesiano A/B spezza questo ciclo: ti dà il diritto di fermarti in anticipo, quantifica l'incertezza, ti dice "probabilità di vittoria 94%". Google Optimize è stato dismesso; se stai costruendo il tuo stack di testing, la matematica Bayesiana ti fa guadagnare velocità.

## Le Regole Fisse del Test Frequentista

Il test A/B classico funziona così: calcola in anticipo la dimensione campionaria (power analysis: 80% potenza, 5% alfa, 10% lift atteso), attendi di raggiungerla, guarda il p-valore, decidi. Il problema: nella realtà il lift è 3%, non 10%, la dimensione campionaria si allunga da 2 a 8 settimane. In questo lasso di tempo il creative è stanco, il contesto stagionale cambia, il CPM sale del 40%. Nel frequentismo è vietato guardare presto — "peeking" gonfia l'errore di tipo 1. Anche con il sequential testing, le funzioni di spending alpha (Bonferroni, O'Brien-Fleming) aggiungono complessità e richiedono soglie rigide.

Scenario di e-commerce: il controllo ha CR del 2.1%, la nuova variante 2.3%. Dopo 1000 sessioni c'è un lift del 9.5% ma p=0.12. Il frequentista dice: "non significativo, continua". A 2000 sessioni p=0.08, ancora insufficiente. A 3500 sessioni p=0.047, finalmente significativo. Ma a quel punto la variante B è stata attiva per 3 settimane, la stagione è passata, stimare il guadagno è impossibile. La matematica frequentista produce decisioni binarie: significativo o no. Esiste un intervallo di confidenza ma viene usato solo per dire "serve il 95% CI per decidere".

## La Distribuzione di Probabilità nell'Approccio Bayesiano

La statistica Bayesiana pone una domanda diversa: "Quale è la probabilità che la variante B sia migliore di A?" La risposta è una distribuzione a posteriori che si aggiorna continuamente. La credenza preliminare (prior) + i dati = posteriori. Ad ogni nuova sessione il posteriori si ricalcola. Con 100 sessioni: probabilità di vittoria 72%, con 500 sessioni 88%, con 1000 sessioni 94%. Non c'è una soglia fissa; decidi tu: è sufficiente il 90%, oppure aspetti il 95%?

La matematica: modello beta-binomiale. Il prior per il tasso di conversione è Beta(α=1, β=1) (uniforme); ogni conversione aumenta α di 1, ogni non-conversione aumenta β di 1. Il posteriori è Beta(α + conversioni, β + non-conversioni). Per due varianti hai due distribuzioni beta; con Monte Carlo estraiamo 10.000 campioni e contiamo "B > A". In Python: `scipy.stats.beta.rvs`. In BigQuery è possibile con UDF, ma Python è più veloce per il sampling.

```python
from scipy.stats import beta

# Variante A: 50 conversioni, 2000 impressioni
a_alpha, a_beta = 1 + 50, 1 + (2000 - 50)
# Variante B: 58 conversioni, 2000 impressioni
b_alpha, b_beta = 1 + 58, 1 + (2000 - 58)

samples_a = beta.rvs(a_alpha, a_beta, size=10000)
samples_b = beta.rvs(b_alpha, b_beta, size=10000)

prob_b_wins = (samples_b > samples_a).mean()
# Output: 0.847 → Probabilità di vittoria 84.7%
```

Metti questo output nel dashboard quotidiano: "Variante B vince con probabilità 84.7%, lift atteso 15.3%, credible interval al 95% [2.1%, 29.8%]". Non cadi nel dilemma "è significativo sì o no", fornisci una misura del rischio. Se l'84.7% basta al tuo risk appetite, fermati; altrimenti continua. Decisione sequenziale — valuti ogni giorno da capo.

## Campionamento Sequenziale e Criterio di Arresto Anticipato

La vera forza del Bayesiano: puoi fermare il test quando vuoi. Nel frequentismo il peeking è proibito perché ad ogni controllo l'errore di tipo 1 si gonfia, nel Bayesiano il posteriori si aggiorna ma il concetto di errore di tipo 1 non esiste (niente frequenza a lungo termine, solo aggiornamento della credenza). Il criterio di arresto lo scegli tu: "Se probabilità di vittoria >95% o <5%, fermati". Con questo criterio la dimensione campionaria media cala del 30-50% (secondo i benchmark 2024 di VWO).

Attenzione però: controllare troppo presto è comunque fuorviante. Nei primi 50 utenti potresti vedere probabilità di vittoria 98%, per fluttuazione casuale. Qui entra il "regret minimization" Bayesiano: calcoli l'expected value of information (EVOI). EVOI = (guadagno atteso) - (costo del proseguire del test). Se EVOI è negativo, fermati. Approccio pratico: mantieni una dimensione minima del campione (es. 500 impressioni per variante), poi applica la regola di arresto Bayesiana.

Nel [Conversion Rate Optimization](https://www.roibase.com.tr/it/cro), il test Bayesiano su Meta Ads creative funziona così: 3 varianti di creative, $100/giorno ognuna. Il primo giorno, la variante C crolla (CTR 2.1% vs 3.8% delle altre). Il posteriori Bayesiano con probabilità 97% dice "C perde". Fermati su C, ridistribuisci il budget ad A e B. Al 5° giorno, A vince con probabilità 91%, fermati su B e dai tutto ad A. Decisione in 7 giorni; il frequentismo avrebbe aspettato 14.

## Expected Loss e Risk Management

La probabilità di vittoria è un'unica metrica. Se B vince con 60% di probabilità ma perde in media del -8% CR quando perde, e guadagna +3% quando vince, allora passare a B è rischioso. La metrica "expected loss" lo misura: la media del CR loss nello scenario di sconfitta. Formula: `E[max(0, A - B)]`. In Python: `numpy.maximum(samples_a - samples_b, 0).mean()`. Se l'expected loss è <1% e la probabilità di vittoria >70%, puoi passare con fiducia.

Tabella: matrice decisionale Bayesiana

| Probabilità di vittoria | Expected loss (CR) | Decisione |
|---|---|---|
| 94% | 0.3% | Passa subito |
| 78% | 1.2% | Raccogli altri dati |
| 51% | 2.8% | Fermati, nessuna differenza |

Questa tabella rimane viva sul dashboard. Quando il PM chiede "Passiamo a B?", non rispondi con binari, ma con "B vince con 78%, expected loss 1.2%, raccogliamo altri 200 utenti". La decisione è trasparente, il rischio è quantificato, il tempo non è sprecato.

## Scelta del Prior e Analisi di Sensibilità

La matematica Bayesiana dipende dalla scelta del prior. Il prior uniforme (Beta(1,1)) è il più neutro, i dati predominano. Ma se hai conoscenza del dominio, usa un prior informativo: dai test passati il CR gira tra 2-3%, quindi prior Beta(20, 980) (media 2%). Questo prior stabilizza il posteriori nei primi 100 utenti, riduce le fluttuazioni casuali.

Testa la sensibilità del prior: esegui il posteriori con 3 prior diversi (uniforme, debolmente informativo, fortemente informativo). Se la probabilità di vittoria cambia di più del 5%, i dati sono insufficienti. Esempio: prior uniforme dà 82%, prior fortemente informativo dà 77%, differenza <5%, procedi fiducioso. Se differenza >10%, raccogli più dati o ricalibrare il prior con dati storici di test.

Codice: sensibilità del prior

```python
priors = [
    (1, 1),           # uniforme
    (10, 490),        # debolmente informativo, media=2%
    (30, 1470)        # fortemente informativo, media=2%
]

for alpha, beta_prior in priors:
    a_posterior = beta.rvs(alpha + 50, beta_prior + 1950, size=10000)
    b_posterior = beta.rvs(alpha + 58, beta_prior + 1942, size=10000)
    prob = (b_posterior > a_posterior).mean()
    print(f"Prior Beta({alpha},{beta_prior}): P(B>A)={prob:.2f}")
```

Se l'output è coerente (±3%), la scelta del prior è robusta.

## Chiusura: Accelerazione e Adattamento Organizzativo

Il test Bayesiano A/B non basta da solo; devi cambiare il processo decisionale organizzativo. Dalla cultura "aspetta finché non sia significativo" a "procedi misurato il rischio". Al CMO offri il 90% di probabilità, non il 100% di certezza — è un cambio culturale. Ma il guadagno è concreto: tempo medio di test scende da 14 a 7 giorni, costo della variante perdente cala del 50%, velocità di iterazione del creative raddoppia. Su Meta Ads questa accelerazione si traduce direttamente in ROAS — più test, creative vincenti migliori, CPA più basso. Quando la matematica Bayesiana è integrata nel tuo dataflow (BigQuery + dbt + Looker), non calcoli a mano, il posteriori si aggiorna automaticamente, ogni mattina hai metriche decisionali fresche.