---
title: "Analytique Respectueuse de la Vie Privée : Plausible + Agrégation Côté Serveur"
description: "Suivi sans cookies, conformité RGPD/KVKK, comparaison avec GA4. Architecture d'agrégation serveur pour une mesure centrée sur la confidentialité."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: data
i18nKey: data-006-2026-06
tags: [privacy-first, plausible, server-side-tracking, rgpd, cookieless]
readingTime: 8
author: Roibase
---

En 2026, le fait que Google Analytics 4 ne renonce pas au fingerprinting navigateur, au dépôt de cookies côté client et à la journalisation des adresses IP dans sa configuration par défaut s'est confirmé. Le guide de janvier 2026 du Contrôleur européen de la protection des données place GA4 dans la catégorie « inutilisable sans consentement explicite ». En Turquie, la modification de l'article 12 de la KVKK, entrée en vigueur fin 2025, va dans le même sens : l'analytique basée sur les cookies exige un consentement préalable. Le marketing de performance s'appuie sur une pile d'attribution agressive, mais transférer votre couche d'analytique de site vers une architecture respectueuse de la vie privée devient désormais une nécessité opérationnelle. Plausible + agrégation côté serveur résout deux questions critiques : comment mesurer sans cookies, et comment construire un pipeline serveur conforme au respect de la vie privée.

## L'Architecture de Plausible : Flux d'Événements Agrégés, Pas de Stockage Brut

Plausible exécute un snippet JavaScript de moins de 1 KB côté navigateur, n'écrit pas de cookie, n'utilise pas le localStorage et ne journalise pas l'adresse IP. Lors d'une page vue, un appel `POST /api/event` est effectué. L'événement brut reçu par le service backend Elixir est **agrégé immédiatement** en PostgreSQL — chaque événement incrémente un compteur de pages vues uniques. La reconnaissance des visiteurs repose sur une signature de visiteur hachée quotidienne plutôt qu'un ID de session : IP + User-Agent → HMAC-SHA256 → TTL de 24 heures. Cette approche reste déterministe mais non réversible : les requêtes du même jour depuis le même appareil reçoivent le même hachage de visiteur, puis le lien disparaît le jour suivant quand la clé de hachage change. Cette méthode se situe en dehors de la définition KVKK d'une « personne identifiable » — même si vous possédiez le hash, vous ne pourriez pas le reconvertir en adresse IP.

GA4 diffère : GA4 maintient un cookie côté client `_ga` pendant 2 ans pour un identifiant client persistant, écrit chaque hit dans un flux d'événements, et l'ID de pseudo-utilisateur dans BigQuery correspond à la valeur du cookie. Même avec Consent Mode v2 activé, le cookie est toujours écrit. Chez Plausible, l'événement qui atteint le serveur ne laisse jamais l'IP brute se retrouver en PostgreSQL — le processus Elixir la hache en mémoire, puis la met au rebut. Cette architecture respecte le principe RGPD de « limitation des finalités » : les données collectées ne peuvent servir que pour compter le trafic du site, pas pour du retargeting ou du suivi entre sites.

### Structure du Compteur d'Agrégation

Les métriques affichées sur le tableau de bord Plausible (pages vues, visiteurs, taux de rebond, durée de session) ne sont pas stockées dans la table `events`. La structure du tableau est :

```sql
CREATE TABLE stats (
  site_id INT,
  date DATE,
  metric VARCHAR(50),   -- 'pageviews', 'visitors', 'bounce_rate'
  dimension VARCHAR(50),-- 'page', 'source', 'device'
  value BIGINT,
  PRIMARY KEY (site_id, date, metric, dimension)
);
```

À chaque événement entrant, une requête `INCREMENT` s'exécute : si la combinaison jour/page/métrique existe, `+1`, sinon `INSERT`. Le tableau de bord en temps réel lit ces compteurs. Puisque aucun flux d'événement brut n'est conservé, cela se conforme parfaitement à la clause RGPD « minimisation des données » — les données que vous conservez sont proportionnées à votre objectif.

## Proxy Côté Serveur : Acheminement du Trafic Client-Plausible Depuis Votre Domaine

Le point de terminaison SaaS de Plausible est `plausible.io/api/event`. Le navigateur y envoie une requête POST. Les bloqueurs de publicités placent `plausible.io` sur la liste noire, ce qui fait perdre les événements. La solution : relayer l'événement Plausible via un proxy inverse fonctionnant sur votre propre domaine. Configuration Nginx :

```nginx
location /stats/api/event {
  proxy_pass https://plausible.io/api/event;
  proxy_set_header Host plausible.io;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_set_header X-Forwarded-Proto $scheme;
  
  # Anonymisation IP — masquer le dernier octet
  set $anonymized_ip $remote_addr;
  if ($remote_addr ~* ^(\d+\.\d+\.\d+)\.\d+$) {
    set $anonymized_ip $1.0;
  }
  proxy_set_header X-Forwarded-For $anonymized_ip;
}
```

Le script frontend change :

```html
<script defer data-domain="yourdomain.com" 
  src="/stats/js/script.js"></script>
```

`/stats/js/script.js` est également proxyfié depuis Nginx. Avec ce configuration, le trafic d'événements se dirige vers `yourdomain.com/stats/api/event`, puis est relayé au backend SaaS Plausible. Le contournement des bloqueurs de publicités récupère 15-20 % de perte de mesure (selon le rapport Plausible 2025). Point important : le proxy anonymise l'IP avant de la transmettre — la requête reçue par le backend Plausible voit le dernier octet à `0`.

### Plausible Auto-Hébergé : Contrôle Intégral

Si vous exécutez Plausible sur votre propre serveur, les données d'événements ne quittent jamais vos endpoints tiers. Configuration Docker Compose :

```yaml
version: '3.8'
services:
  plausible:
    image: plausible/analytics:v2.0
    ports:
      - "8000:8000"
    environment:
      BASE_URL: https://analytics.yourdomain.com
      SECRET_KEY_BASE: ${SECRET}
      DATABASE_URL: postgres://plausible:password@db/plausible
      CLICKHOUSE_DATABASE_URL: http://clickhouse:8123/plausible
    depends_on:
      - db
      - clickhouse
  
  db:
    image: postgres:14-alpine
    volumes:
      - postgres-data:/var/lib/postgresql/data
  
  clickhouse:
    image: clickhouse/clickhouse-server:23.3-alpine
    volumes:
      - clickhouse-data:/var/lib/clickhouse
```

Dans la version auto-hébergée, Plausible a migré de PostgreSQL vers ClickHouse (depuis v2.0). La vitesse d'agrégation d'événements est multipliée par 10 : à 1M événements/jour, la latence des requêtes est < 50 ms. Dans cette architecture, le hachage IP, la rotation de la clé, et tous les mécanismes sont sous votre contrôle — vous pouvez écrire dans votre rapport de conformité KVKK que « les données d'événements ne quittent jamais nos serveurs ».

## Comparaison avec GA4 : Tableau de Trade-off

| Critère | Plausible | GA4 |
|---|---|---|
| **Utilisation de cookies** | Aucun | `_ga`, `_ga_*` (2 ans) |
| **Journalisation IP** | Hachée + TTL 24h | Anonymisée (Consent Mode v2) mais `user_pseudo_id` = ID cookie dans BigQuery export |
| **Consentement requis (RGPD)** | Non (intérêt légitime suffisant) | Oui (opt-in explicite) |
| **Capacité d'attribution** | Aucune — referrer + UTM uniquement | Multi-domaine, chemin de conversion, attribution pilotée par les données |
| **Suivi d'événements personnalisés** | Appel API manuel (événement objectif) | Automatique + plan de mesure |
| **Coût (10M hits/mois)** | Auto-hébergé : coût serveur (~50 $/mois), SaaS : 19 $/mois (plan Business) | Gratuit mais coût BigQuery pour export (~ 5 $/To pour requête) |
| **Propriétaire des données** | Vous (auto-hébergé) / serveur UE (SaaS) | Google (serveur US) |

Chez Plausible, **pas d'attribution** — vous ne voyez pas de quel canal marketing provient une conversion, seulement « cette page a été vue X fois, Y visiteurs uniques l'ont visitée ». Si vous exécutez une modélisation du mix marketing ou un test d'incrément, ces données suffisent : vous mettez en corrélation les changements de trafic agrégé avec les ventes. Mais vous ne pouvez pas faire d'analyse de parcours utilisateur, de cohortes ou de drop-off d'entonnoir. La force de GA4 réside là — un export BigQuery vous permet de joindre par `user_pseudo_id` pour construire une attribution multi-touch.

Le trade-off est clair : en réduisant le risque de conformité à zéro, vous perdez les insights granulaires. La solution : un stack hybride. L'analytique du site passe à Plausible (cookieless), le suivi des conversions utilise une [architecture de données propriétaires](https://www.roibase.com.tr/fr/firstparty) — combinaison sGTM + Conversion API. Vous voyez les tendances générales du trafic dans Plausible, les métriques décisionnelles critiques (ROAS, LTV, CAC) proviennent du pipeline côté serveur.

## Pipeline d'Agrégation Côté Serveur : Plausible + dbt + BigQuery

Avec un déploiement Plausible auto-hébergé, vous accédez directement à la base de données ClickHouse. Scénario pour répliquer les compteurs d'événements dans BigQuery en vue de leur jonction avec les données marketing :

1. **ClickHouse → BigQuery CDC :** Connecteur Airbyte pour synchroniser quotidiennement `plausible.events` en BigQuery (incrément). ClickHouse contient déjà un compteur agrégé, pas d'événement brut.
2. **Modèle dbt :** Créer une table `fct_pageviews` dans BigQuery :

```sql
-- models/fct_pageviews.sql
WITH plausible_raw AS (
  SELECT
    toDate(timestamp) AS date,
    domain,
    pathname,
    referrer_source,
    COUNT(*) AS pageviews,
    uniqExact(visitor_hash) AS unique_visitors
  FROM {{ source('plausible', 'events') }}
  WHERE date >= CURRENT_DATE - 30
  GROUP BY 1, 2, 3, 4
),

marketing_spend AS (
  SELECT
    date,
    channel,
    SUM(spend) AS total_spend
  FROM {{ ref('stg_marketing_spend') }}
  GROUP BY 1, 2
)

SELECT
  p.date,
  p.domain,
  p.pathname,
  p.referrer_source,
  p.pageviews,
  p.unique_visitors,
  m.total_spend,
  SAFE_DIVIDE(p.unique_visitors, m.total_spend) AS visitors_per_dollar
FROM plausible_raw p
LEFT JOIN marketing_spend m
  ON p.date = m.date
  AND p.referrer_source = m.channel
```

Dans ce modèle, le `visitor_hash` n'arrive pas dans BigQuery — l'agrégat ClickHouse arrive sous la forme du nombre `unique_visitors`. Aucun suivi utilisateur au niveau du data warehouse. En joignant avec la table de dépenses marketing, vous voyez « nous avons dépensé X dollars pour ce canal de renvoi, Y visiteurs sont arrivés ». Pour les tests d'incrément, vous ne pouvez pas faire de randomisation basée sur les cookies — vous utilisez un split géographique (activations par région) ou un holdout temporel.

### Tableau de Bord Temps Réel : Métriques Agrégées

Le tableau de bord Plausible affiche les compteurs en temps réel (pages vues des 30 dernières minutes). Pour un tableau similaire dans BigQuery + Looker Studio :

```sql
CREATE MATERIALIZED VIEW analytics.mv_realtime_traffic
AS
SELECT
  FORMAT_TIMESTAMP('%Y-%m-%d %H:%M', timestamp, 'Europe/Istanbul') AS time_bucket,
  pathname,
  COUNT(*) AS hits,
  APPROX_COUNT_DISTINCT(visitor_hash) AS visitors
FROM plausible.events
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 MINUTE)
GROUP BY 1, 2
```

L'agrégation se régénère tous les 5 minutes (limite du MV BigQuery). Graphique linéaire dans Looker Studio : axe X `time_bucket`, axe Y `hits`. Ce tableau de bord aussi — aucune donnée au niveau utilisateur, juste des compteurs agrégés.

## Documentation de Conformité : Accord de Traitement des Données KVKK

Avec Plausible SaaS, vous signez un DPA (Data Processing Agreement). Le modèle 2026 de Plausible inclut :

- **Catégorie de données :** « Agrégation des métriques de trafic du site (nombre de pages vues, nombre de renvois, distribution des types d'appareils) ». Aucun identifiant individuel.
- **Finalité du traitement :** « Analyse des performances du site et attribution des sources de trafic ». Pas de retargeting, profilage ou prise de décision automatisée.
- **Sous-traitant :** ClickHouse Cloud (serveur UE), Hetzner (Allemagne).
- **Durée de rétention :** 2 ans (pour affichage du tableau de bord), suppression automatique ensuite.
- **Droits des personnes concernées :** Puisque les données sont agrégées au moment de l'ingestion, les demandes ne peuvent être satisfaites au niveau individuel. Le DPA le précise explicitement : « En raison de l'agrégation à l'ingestion, les demandes des personnes concernées ne peuvent pas être traitées au niveau individuel. »

Pour votre rapport de conformité KVKK, utiliser Plausible de cette manière est un point fort : vous pouvez dire à l'Autorité « nous ne conservons pas les données utilisateur, seulement des