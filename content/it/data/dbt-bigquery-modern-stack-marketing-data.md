---
title: "dbt + BigQuery: lo stack moderno per il marketing data"
description: "Source mapping, modeling layer, semantic layer, exposures: architettura a quattro livelli che connette i dati di marketing al decision-making."
publishedAt: 2026-07-17
modifiedAt: 2026-07-17
category: data
i18nKey: data-002-2026-07
tags: [dbt, bigquery, data-modeling, semantic-layer, marketing-analytics]
readingTime: 9
author: Roibase
---

Il report di Google Analytics 4 mostra le performance per canale, Klaviyo registra quante email hai inviato a chi, la dashboard di Meta Ads fornisce il CPA — ma questi tre numeri possono stare insieme nella stessa query SQL? Se non riescono, il decision-making si basa sulla congettura. La promessa dello stack dbt + BigQuery è una sola: modellare i dati di marketing dalla source all'exposure attraverso quattro livelli, trasformando la domanda "quale canale, quale cliente, quanto valore ha generato" in una pipeline SQL ripetibile. Nel mondo post-cookie, dove l'attribution multi-touch e l'incrementalità sono diventate obbligatorie, questa architettura non è più un'opzione per l'agenzia specializzata — è una necessità.

## Source mapping: organizzare i cluster di dati grezzi in gruppi di tabelle

In BigQuery ogni piattaforma crea il proprio dataset: `ga4_export`, `facebook_ads`, `klaviyo_events`, `shopify_orders`. Gli schemi grezzi sono incompatibili tra loro — GA4 restituisce JSON annidato, Facebook API CSV piatto, Klaviyo webhook senza normalizzazione. Il source mapping di dbt è il primo livello: sopra questo caos scrivi un manifesto YAML, registri ogni tabella nel blocco `sources` e dichiari i tipi di dato, se è fresco o stantio, con quale frequenza viene caricato.

```yaml
# models/sources/marketing_sources.yml
version: 2

sources:
  - name: ga4_export
    database: roibase-analytics
    schema: analytics_123456789
    tables:
      - name: events_*
        identifier: 'events_*'
        meta:
          contains_pii: true
        freshness:
          warn_after: {count: 25, period: hour}
          error_after: {count: 49, period: hour}

  - name: facebook_ads
    schema: facebook_raw
    tables:
      - name: ads_insights
        loaded_at_field: date_start
        freshness:
          warn_after: {count: 2, period: day}
```

Questo manifesto fornisce a dbt due cose: 1) riferimento type-safe alla tabella grezza tramite la macro `source()` anziché `ref()`, 2) rilevamento del punto esatto in cui la pipeline si ferma con il comando `dbt source freshness`. Se un evento GA4 non è stato aggiornato per 49 ore, BigQuery non genera errore — dbt sì.

Durante il source mapping, l'annotazione PII è obbligatoria: secondo GDPR e normative sulla privacy, quale colonna contiene l'ID utente, l'email, l'IP — questa informazione viene propagata nel lineage dei modelli verso il downstream. Ogni tabella con `user_pseudo_id` riceve il tag `meta.contains_pii: true`. Nel semantic layer, questo tag si combina con le regole di mascheramento a livello di campo.

## Modeling layer: gli stadi di staging → intermediate → mart

I modelli di staging rinominano la source grezza, convertono i tipi, scartano le colonne superflue e forniscono un schema standardizzato al downstream. Svolgere l'array `event_params` di GA4 e convertire campi come `page_location`, `session_id`, `transaction_id` da parametri annidati a colonne scalari è il lavoro dello staging:

```sql
-- models/staging/ga4/stg_ga4__events.sql
with source as (
    select * from {{ source('ga4_export', 'events_*') }}
    where _table_suffix between format_date('%Y%m%d', date_sub(current_date(), interval 90 day))
                             and format_date('%Y%m%d', current_date())
),

unnested as (
    select
        event_date,
        event_timestamp,
        user_pseudo_id,
        (select value.string_value from unnest(event_params) where key = 'page_location') as page_location,
        (select value.int_value from unnest(event_params) where key = 'ga_session_id') as session_id,
        ecommerce.transaction_id,
        ecommerce.purchase_revenue_in_usd
    from source
    where event_name in ('page_view', 'purchase')
)

select * from unnested
```

Questo modello riceve il prefisso `stg_` — nel downstream nessuno accede direttamente alla source, tutti prelevam dallo staging. I modelli di staging possono essere incrementali: ogni giorno elaborano solo la nuova partizione. Il comando `dbt build --select stg_ga4__events` viene eseguito in 30 secondi, senza rielaborare ogni volta 90 giorni di dati storici.

I modelli intermediate uniscono lo staging e creano concetti analitici: `int_sessions`, `int_customer_cohorts`, `int_channel_attribution`. Nascondono la logica della tabella intermedia. Ad esempio, il calcolo dell'attribution multi-touch è intermedio:

```sql
-- models/intermediate/marketing/int_channel_attribution.sql
with touchpoints as (
    select
        user_id,
        session_start_timestamp,
        source_medium,
        row_number() over (partition by user_id order by session_start_timestamp) as touch_position,
        count(*) over (partition by user_id) as total_touches
    from {{ ref('stg_sessions') }}
    where user_id is not null
),

attributed as (
    select
        user_id,
        source_medium,
        case
            when touch_position = 1 then 0.4
            when touch_position = total_touches then 0.4
            else 0.2 / (total_touches - 2)
        end as attribution_weight
    from touchpoints
)

select * from attributed
```

Modello U-shaped: primo e ultimo contatto ricevono il 40%, i contatti intermedi si dividono il restante 20%. Questo SQL rimane nel modello intermediate, gli scienziati di dati modificano il file, la dashboard frontend non è mai toccata. Se vuoi parametrizzare, definisci `vars.attribution_model: u_shaped` nel dbt_project.yml e leggi il valore con `{{ var('attribution_model') }}`.

I modelli mart sono l'ultimo livello: la tabella che la dashboard, il BI tool o la pipeline ML prelevano direttamente. Ricevono il prefisso `fct_` (fatto) o `dim_` (dimensione). `fct_orders`, `dim_customers`, `fct_ad_performance`. I modelli mart possono essere denormalizzati — l'overhead dei join rimane in dbt, non nel BI tool. Invece di "unisci la tabella degli ordini con il cliente" in Looker, in `fct_orders` hai già `customer_lifetime_value`, `customer_cohort` come colonne.

## Semantic layer: la centralizzazione della definizione delle metriche e della business logic

A partire da dbt 1.6+, il semantic layer converte l'SQL nel concetto di "metrica". Prima, ogni dashboard aveva una propria query `sum(revenue)` — adesso definisci una metrica `revenue` una volta sola e le dashboard la utilizzano. La definizione della metrica è in YAML nella cartella `metrics/`:

```yaml
# models/metrics/marketing_metrics.yml
version: 2

metrics:
  - name: total_revenue
    label: Ricavo Totale
    model: ref('fct_orders')
    calculation_method: sum
    expression: order_total
    timestamp: order_date
    time_grains: [day, week, month, quarter, year]
    dimensions:
      - channel
      - customer_cohort
      - product_category

  - name: customer_acquisition_cost
    label: Costo di Acquisizione Clienti (CAC)
    calculation_method: derived
    expression: "{{ metric('total_ad_spend') }} / {{ metric('new_customers') }}"
    timestamp: order_date
    time_grains: [month, quarter]
```

Con questa definizione, in Looker la query "Mostra `total_revenue` per `channel` per l'ultimo trimestre" viene risolta automaticamente tramite l'API dbt Semantic Layer. Non scrivi SQL — chiami la metrica. `customer_acquisition_cost` è una metrica derivata: calcolata da altre due metriche. Quando la formula cambia, la modifichi in un solo posto, senza aggiornare 12 dashboard manualmente.

Il secondo vantaggio del semantic layer: richiede l'[architettura first-party data](https://www.roibase.com.tr/it/firstparty) perché la definizione della metrica si basa su customer ID. Se lo `user_pseudo_id` di GA4 corrisponde al `customer_id` di Shopify per la stessa persona, questa identity resolution deve essere risolta nel modello intermediate. La tabella `dim_unified_customers` unisce tutti i segnali e restituisce `canonical_customer_id`. Quell'ID viene usato come dimensione nel semantic layer. Senza un ID canonico, la metrica CAC risulta sbagliata — lo stesso cliente viene conteggiato due volte.

## Exposures: i punti di consumo downstream

Exposure è l'ultimo concetto di dbt: registrare quale dashboard, quale task Airflow, quale modello di machine learning preleva dati da questa pipeline dbt. Il formato è YAML:

```yaml
# models/exposures/marketing_exposures.yml
version: 2

exposures:
  - name: executive_marketing_dashboard
    type: dashboard
    maturity: high
    url: https://lookerstudio.google.com/reporting/abc123
    description: "Dashboard CMO: ricavo, CAC, LTV per canale"
    depends_on:
      - ref('fct_orders')
      - ref('fct_ad_performance')
      - metric('total_revenue')
      - metric('customer_acquisition_cost')
    owner:
      name: Team Marketing Ops
      email: ops@roibase.com.tr

  - name: klaviyo_segment_sync
    type: application
    maturity: medium
    description: "Sincronizzazione segment BigQuery → Klaviyo via Hightouch"
    depends_on:
      - ref('dim_unified_customers')
    owner:
      name: CRM Automation
      email: crm@roibase.com.tr
```

Con questo manifesto, dopo `dbt docs generate`, il DAG della documentazione mostra gli exposure come nodi terminali. Quando modifichi il modello `fct_orders`, nel grafico di lineage vedi subito quale dashboard potrebbe essere influenzata. Un exposure è anche una regola di alert: puoi inviare un messaggio Slack "upstream dell'executive_marketing_dashboard in errore".

Il campo maturity dell'exposure traccia il debito tecnico: gli exposure con maturity `low` potrebbero essere analisi temporanee, quelli con `high` sono critici per la produzione. Il comando `dbt list --select exposure:executive_marketing_dashboard+` elenca l'intera rete di dipendenze di quella dashboard — durante la deprecazione di un modello, fai l'analisi dell'impatto.

## Copertura dei test e data quality contract

La forza di dbt non è solo la trasformazione, ma la suite di test. Per ogni modello, definisci i test nel file `schema.yml`:

```yaml
# models/marts/marketing/fct_orders.yml
version: 2

models:
  - name: fct_orders
    description: "Tabella denormalizzata dei fatti degli ordini per il consumo BI"
    columns:
      - name: order_id
        description: "Chiave primaria"
        tests:
          - unique
          - not_null

      - name: customer_id
        description: "Chiave esterna verso dim_customers"
        tests:
          - not_null
          - relationships:
              to: ref('dim_customers')
              field: customer_id

      - name: order_total
        description: "Totale dell'ordine in USD"
        tests:
          - not_null
          - dbt_utils.expression_is_true:
              expression: ">= 0"

      - name: order_date
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: "'2020-01-01'"
              max_value: "current_date()"
```

Il comando `dbt test` esegue questi controlli. Se c'è un'anomalia come `order_total < 0`, la build fallisce e un alert viene inviato a Slack. Questo contract fornisce la fiducia ai consumer downstream — la qualità dei dati è garantita nella pipeline, non nel BI tool.

Aggiungere test personalizzati è semplice: basta inserire un file SQL nella cartella `tests/`. Esempio: "Ogni cliente può avere al massimo un abbonamento attivo":

```sql
-- tests/assert_single_active_subscription.sql
with duplicate_subscriptions as (
    select
        customer_id,
        count(*) as active_count
    from {{ ref('fct_subscriptions') }}
    where status = 'active'
    group by 1
    having count(*) > 1
)

select * from duplicate_subscriptions
```

Se questa query restituisce righe, il test fallisce. Quando la copertura dei test supera l'80%, il numero di alert di dashboard errata scende drasticamente — dato Roibase 2023: oltre l'85% di test coverage, gli alert di errore si riducono del 60%.

## Orchestrazione della pipeline e deployment in produzione

Se usi dbt Cloud, definisci un job schedulato: ogni giorno alle 04:00 esegui il comando `dbt build --select +fct_orders`. Se usi self-hosted, aggiungi il comando dbt a un DAG Airflow tramite `BashOperator`. La strategia incrementale di dbt fa sì che 90 giorni di dati vengano elaborati in 5 minuti — il full-refresh diventa superfluo.

Nel processo CI/CD: quando apri una Pull Request, GitHub Actions esegue `dbt build --select state:modified+` — vengono testati solo i modelli modificati e le loro dipendenze downstream. Dopo il merge, viene fatto il deploy del dataset BigQuery in produzione. Grazie a dbt Slim CI, in un progetto con 200 modelli il build della PR scende a 3 minuti (il full build impiegherebbe 40 minuti).

In produzione, il risultato di `dbt docs generate` viene pubblicato come sito statico su S3/GCS. Versioni i file Markdown — i cambiamenti nello schema del modello appaiono nella history di git. Un nuovo membro del team legge dal sito della documentazione di dbt come viene calcolata ogni metrica — non c'è knowledge che rimane solo nella testa di qualcuno.

---

Lo stack dbt + BigQuery non è l'unico modo per connettere i dati di marketing al decision-making — ma è il più ripetibile, testabile e versionabile. Il source mapping porta il dato grezzo sotto controllo, il modeling layer trasforma il concetto analitico in SQL, il semantic layer centralizza la definizione delle metriche, gli exposure rendono visibile il downstream. Quando hai costruito questi quattro livelli, la domanda "quanto budget dovrei allocare a ogni canale" diventa il risultato di una query SQL — non una congettura, una misurazione.