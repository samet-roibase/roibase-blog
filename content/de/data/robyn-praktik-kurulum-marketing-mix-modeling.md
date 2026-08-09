---
title: "Marketing Mix Modeling: Praktischer Setup mit Robyn"
description: "Metas Open-Source-MMM-Tool Robyn mit Sättigungskurven, Adstock-Decay und Holdout-Validierung in die Production-Umgebung implementieren."
publishedAt: 2026-08-09
modifiedAt: 2026-08-09
category: data
i18nKey: data-005-2026-08
tags: [marketing-mix-modeling, robyn, adstock, attribution, data-science]
readingTime: 9
author: Roibase
---

Marketing Mix Modeling (MMM) erlebte Ende der 2020er-Jahre ein Comeback durch den Kollaps der cookiegestützten Attribution. Der Sprung von akademischen Publikationen in die Produktionsumgebung ist jedoch eine völlig andere Kategorie. Robyn, das Meta 2021 als Open-Source veröffentlichte, verankert diesen Übergang in ingenieurmäßiger Disziplin: Es bietet konkrete Werkzeuge, um statistische Konzepte wie Sättigungskurven, Adstock-Decay und Holdout-Validierung vom R-Skript in die operative Pipeline zu transportieren. Dieser Artikel zeigt, wie Sie die drei Mechanismen, die Robyn's Kern ausmachen — die zeitliche Abklingdauer des Werbeffekts, die Sättigung der Ausgaben-Rendite-Beziehung und der Validierungsprozess, der die Prognosekraft des Modells testet — in einem Production-Setup implementieren.

## Adstock Decay: Die zeitliche Ausbreitung von Werbewirkung

Ein TV-Spot erzeugt keinen Umsatz am Ausstrahlungstag, sondern wirkt über die Woche. Eine Search-Anzeige kann in der Sekunde des Klicks konvertieren, aber Brand Recall löst Konversionen drei Tage später aus. Der Adstock-Begriff beschreibt diese zeitliche Verzögerung mathematisch. In Robyn gibt es zwei Adstock-Typen: geometric und Weibull. Geometric modelliert einfachen exponentiellen Verfall; die Wirkung des Vortags wird jeden Tag mit dem Parameter `theta` multipliziert. Weibull ist flexibler — es ermöglicht unabhängige Kontrolle über Anstiegs- und Abfallkurve des Effekts.

Im praktischen Setup kalibrieren Sie Adstock-Parameter nach Kanaltyp. Paid Search hat typischerweise `theta=0,3` (schneller Verfall), TV `theta=0,7` (langer Schwanz), Display etwa `theta=0,5`. Diese Werte sind nicht beliebig — sie werden durch Hyperparameter-Suche im Holdout-Set der Vergangenheit ermittelt. In Robyn's `robyn_inputs()`-Funktion setzen Sie das Argument `adstock` kanalweise:

```r
InputCollect <- robyn_inputs(
  dt_input = dt_simulated_weekly,
  adstock = "geometric",
  adstock_params = list(
    tv_s = c(0.3, 0.8),
    search_clicks_p = c(0.0, 0.3),
    facebook_i = c(0.0, 0.5)
  )
)
```

Hier geben Sie mit `c(min, max)` einen Bereich an; der Nevergrad-Optimierungsalgorithmus durchsucht diesen Bereich nach dem besten `theta`-Wert. Wenn Sie statt Geometric Weibull verwenden, werden auch Shape- und Scale-Parameter hinzugefügt. Weibull's Vorteil liegt bei Kanälen wie Display, die "spät spitzenlastig" sind — der Effekt ist in den ersten zwei Tagen niedrig, erreicht zwischen Tag 3–5 seinen Höhepunkt.

Ein falsch kalibriertes Adstock führt dazu, dass das Modell Kanalbeiträge falsch zuordnet. Wenn Sie TV mit geometrischem `theta=0,1` modellieren, wird nur der Ausstrahlungstag berücksichtigt und der organische Traffic über die Woche wird übersehen. Umgekehrt: Geben Sie Paid Search `theta=0,9`, werden Klicks von vor einer Woche heutigen Verkäufen zugeordnet — unrealistisch. Deshalb muss das Adstock-Setup nach Kanalcharakteristik kalibriert werden, begrenzt durch Domain-Wissen.

## Sättigungskurve: Der Punkt, an dem Ausgaben an Ertrag verschärft

Lineare Regression unterstellt, dass jeder Euro Ausgaben den gleichen Ertrag bringt. In der Realität fällt der ROAS bei den ersten 10.000 Euro auf 8, bei 100.000 Euro auf 3, bei einer Million Euro unter 1 — der Grenzertrag ist fallend. Sättigung ist die Transformation, die diese Kurve modelliert. Der in Robyn am häufigsten verwendete Sättigungstyp ist die Hill-Gleichung (Michaelis-Menten):

```
y = Vmax * (x^S) / (K^S + x^S)
```

Hierbei ist `Vmax` der maximale Effekt, `K` das Ausgabenniveau, bei dem Halbsättigung erreicht wird (Inflexionspunkt), `S` die Steilheit der Kurve (Form). Ein niedriges `K` bedeutet schnelle Sättigung, hohes `K` späte Sättigung. Wenn `S>1`, nimmt die Kurve eine S-Form an — anfangs langsam, in der Mitte schnell, am Ende wieder langsam.

In Robyn definieren Sie Hill-Parameter ebenfalls kanalweise:

```r
hyperparameters <- list(
  tv_s_alphas = c(0.5, 3),
  tv_s_gammas = c(0.3, 1),
  search_clicks_p_alphas = c(0.5, 3),
  search_clicks_p_gammas = c(0.3, 1)
)
```

`alphas` entspricht Robyn's Hill-`S`-Parameter, `gammas` dem `K`-Parameter (Robyn-Notation). Die Optimierung sucht in diesen Bereichen den besten Fit. Lassen Sie die Suche aber nicht blind laufen — wenn Sie 80 % Ihres TV-Budgets bereits ausgeben, sollte die Sättigung bei >90 % liegen, sonst produziert das Modell irrealistische Grenzwert-ROAS-Werte.

Das Sättigungssetup beeinflusst direkt die Budget-Allokationsstrategie. Wenn das Modell die Sättigungskurve korrekt berechnet, können Sie den Grenzwert-ROAS jedes Kanals berechnen und das Budget neu zuteilen. Robyn's `robyn_allocator()`-Funktion macht dies — welcher Kanal sollte Geld verlieren und welcher bekommen, um bei festem Gesamtbudget den Umsatz zu maximieren? Diese Empfehlung ist jedoch nur gültig, wenn die Sättigungsparameter korrekt sind. Ein falscher `K`-Wert bedeutet millionenschwere Fehlentscheidungen.

## Holdout-Validierung: Testen der Prognosekraft des Modells

Das größte Risiko von MMM ist Overfitting — das Modell memoriert historische Daten statt Zukunftsprognosen zu machen. Um dies zu verhindern, ist Zeitreihen-Holdout-Validierung erforderlich. Im Robyn-Setup reservieren Sie die letzten 4–8 Wochen als Holdout-Set; das Modell wird mit den verbleibenden Daten trainiert und prognostiziert für die Holdout-Periode. Ein niedriges NRMSE (Normalized Root Mean Square Error) und MAPE (Mean Absolute Percentage Error) deuten darauf hin, dass das Modell verallgemeinert.

```r
InputCollect <- robyn_inputs(
  dt_input = dt_simulated_weekly,
  window_start = "2022-01-01",
  window_end = "2023-10-31",
  rollingWindowStartWhich = 1,
  rollingWindowEndWhich = 52,
  rollingWindowLength = 4
)
```

`rollingWindowLength = 4` hält die letzten 4 Wochen aus. Das Modell wird ohne diese 4 Wochen trainiert, erstellt dann Prognosen. In Robyn's Output sehen Sie Holdout-NRMSE für jedes Modell — unter 10 % ist gut, über 20 % verdächtig. Aber entscheiden Sie nicht nur nach einer Metrik; überprüfen Sie, ob in der Holdout-Periode Anomalien vorlagen (Kampagnen, Feiertage). Wenn beispielsweise Black Friday in der Holdout-Woche liegt, unterschätzt das Modell — weil solche Spitzen im normalen Nachfrage-Muster nicht vorkommen.

Es ist üblich, das Modell nach Holdout neu zu trainieren — Sie fitten das Final-Modell mit allen Daten, wählen aber die Hyperparameter anhand der Holdout-Ergebnisse. Dieser „train-validate-finalize"-Zyklus ist Standard. In Robyn nutzen Sie `robyn_refresh()`:

```r
Robyn1 <- robyn_run(InputCollect = InputCollect, plot_folder = OutputCollect$plot_folder)
OutputCollect <- robyn_outputs(Robyn1, select_model = "1_100_3")
RobynRefresh <- robyn_refresh(Robyn1, dt_input = dt_simulated_weekly, refresh_steps = 4)
```

`refresh_steps = 4` aktualisiert das Modell mit den letzten 4 Wochen neuer Daten, behält aber Sättigungs- und Adstock-Parameter bei (Kalibrierung bleibt erhalten). Dies ist die Grundlage einer laufenden Production-Pipeline — jede Woche neue Zeilen hinzufügen, Modell re-fitten, Dashboard aktualisieren.

## Robyn-Pipeline in die Production verschieben

Robyn ist kein R-Skript, das man einmal laufen lässt — es muss in eine Daten-Pipeline für den laufenden Betrieb integriert werden. Eine typische Architektur: Marketing-Ausgabentabelle in BigQuery + GA4-Konversionstabelle + CRM-Revenue-Tabelle → mit dbt zu wöchentlicher Aggregattabelle → Robyn-R-Skript ausgelöst in Cloud Composer (Airflow) DAG → Ergebnis-JSON im Looker Studio-Dashboard. Dieser Stack läuft innerhalb einer [First-Party-Daten-Architektur](https://www.roibase.com.tr/de/firstparty).

Der erste Schritt ist das Datenschema standardisieren. Robyn erwartet eine `dt_input`-Tabelle mit Spalten: `DATE` (wöchentlich), `revenue`, `tv_spend`, `search_spend`, `facebook_impressions` etc. Jeder Kanal sollte eine separate Spalte sein; ohne Organic/Paid-Unterscheidung kann das Modell keine Attribution durchführen. Fehlende Wochen müssen interpoliert werden (Nullwert oder Interpolation), Ausreißer müssen gekennzeichnet sein. Ein dbt-Modell-Beispiel:

```sql
with base as (
  select
    date_trunc(event_date, week) as week_start,
    sum(case when source = 'google/cpc' then cost else 0 end) as search_spend,
    sum(case when source = 'facebook' then cost else 0 end) as facebook_spend,
    count(distinct case when event_name = 'purchase' then user_pseudo_id end) as conversions
  from `project.analytics_123456789.events_*`
  where _table_suffix between '20220101' and '20231231'
  group by 1
)
select * from base
order by week_start
```

Diese Tabelle wird aus BigQuery als CSV exportiert oder — besser — mit dem R-Paket `bigrquery` direkt abgerufen. Letzteres ist vorzuziehen, da es Data-Freshness-Garantien bietet.

Im Airflow-DAG der Robyn-Schritt:

```python
from airflow.operators.bash import BashOperator

run_robyn = BashOperator(
    task_id='run_robyn_mmm',
    bash_command='Rscript /path/to/robyn_model.R ',
    dag=dag
)
```

Im Skript speichern Sie das Modellobjekt mit `robyn_save()` im RDS-Format und laden es in GCS hoch. In den folgenden Wochen laden Sie es mit `robyn_refresh()` erneut. Anstatt jede Woche neu zu trainieren, führen Sie ein inkrementelles Update durch — die Rechenzeit sinkt von 2 Stunden auf 15 Minuten.

Holdout-Metriken werden in JSON-Output gespeichert, in BigQuery geschrieben und als Trend-Grafik in Looker Studio visualisiert. Wenn NRMSE plötzlich springt (z.B. von 8 % auf 18 %), wird ein Alert ausgelöst — das Modell ist beschädigt, muss neu kalibriert werden. Ohne dieses Monitoring schlägt MMM lautlos fehl; falsche Budget-Allokation wird erst nach 3 Monaten bemerkt.

## Modell-Output mit dem Entscheidungsmechanismus verbinden

Robyn's Output ist kein Kanal-Contribution-Pie-Chart, sondern eine Grenzwert-ROAS-Tabelle. Der ROAS jedes Kanals für die letzte ausgegebene Einheit. Damit führen Sie einen Budget-Optimizer aus: Wenn TV's Grenzwert-ROAS 2 ist und Search's 5, sollte zu Search verschoben werden. Diese mechanische Optimierung kann aber mit der Brand-Strategie kollidieren — wenn TV für Brand-Awareness läuft, ist eine Entscheidung basierend auf kurzfristigem ROAS irreführend.

Daher sollten MMM-Ergebnisse nicht als isoliertes Entscheidungsinstrument angesehen werden, sondern als Teil der [Datenanalyseschicht](https://www.roibase.com.tr/de/verianalizi), synthetisiert mit anderen Signalen: Brand-Lift-Studie, Incrementality-Test, Customer Lifetime Value. Robyn sagt Contribution bei 30 %, aber ein Geo-Lift-Test findet 15 % — dann müssen Sie beide abgleichen. Das Modell hat fehlerhafte Annahmen (z.B. zu hoher Adstock-Decay-Wert).

In Production läuft MMM wöchentlich, aber Budget-Entscheidungen werden monatlich oder quartalsweise getroffen. Das Modell läuft jede Woche, Metriken gehen in den Trend ein, aber Sie schauen auf den 4-Wochen-Durchschnitt. Eine Millionen-Verschiebung basierend auf einer Woche verursacht Volatilität. Da die Holdout-Validierung 4 Wochen beträgt, sollte der Budget-Review-Zyklus mit dem Holdout-Fenster abgestimmt sein.

Zum