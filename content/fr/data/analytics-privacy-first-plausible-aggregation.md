---
title: "Analytics Respectueux de la Vie Privée : Plausible + Agrégation Côté Serveur"
description: "Suivi sans cookies, conformité RGPD et alternative à GA4. Comment garantir 100% de conformité avec Plausible et l'agrégation côté serveur ?"
publishedAt: 2026-08-11
modifiedAt: 2026-08-11
category: data
i18nKey: data-006-2026-08
tags: [analytics-privacy-first, plausible, suivi-sans-cookies, rgpd-conformite, agregation-cote-serveur]
readingTime: 8
author: Roibase
---

Les mises à jour du masquage IP et du mode de consentement de Google Analytics 4 montrent que votre stack analytique perd actuellement 30 à 40 % des données. En Europe, le taux de refus aux bannières TCF 2.2 dépasse 60 %, et en Amérique du Nord, les demandes de désinscription CCPA exposent les entreprises à des responsabilités juridiques réelles. Les pénalités de conformité aux données en 2026 ont atteint des seuils sans précédent. Analytics à la configuration par défaut, c'est révolu — vous devez choisir entre accepter les lacunes de données ou repenser votre architecture.

L'analytics respectueux de la vie privée n'est plus une tactique de conformité, c'est une stratégie d'ingénierie. Des plateformes sans cookies comme Plausible proposent l'agrégation côté serveur : elles conservent le taux de couverture à 95 %+ tout en garantissant la conformité RGPD. Cet article explore l'architecture Plausible + agrégation côté serveur, la comparaison avec GA4, et les compromis à gérer en production.

## Ce que Signifie Réellement le Suivi Sans Cookies

« Sans cookies » est une étiquette trompeuse. La vraie question n'est pas « comment mesurer sans identifiants », mais « où stockez-vous l'identifiant et combien de temps il persiste ». GA4 repose sur le cookie côté client `_ga` ; il vit 2 ans, transmis via des requêtes tierces. Plausible n'utilise aucun cookie — pour chaque session, il génère un hash temporaire dérivé d'une combinaison IP + chaîne User-Agent avec un salt, renouvelé après 24 heures.

Cette approche a deux conséquences concrètes. Première : elle ne rentre pas dans la définition des données personnelles du RGPD (article 4) car le hash est irrécupérable et utilisé uniquement pour l'agrégation. Deuxième : elle entre dans la catégorie « strictement nécessaire » du RGPD, pas de consentement explicite requis. En Europe, cette distinction est critique — si votre finalité déclarée est « analyse du comportement utilisateur », le RGPD exige un consentement explicite ; Plausible contourne cette exigence.

L'agrégation côté serveur, elle, collecte les données au niveau événement non pas chez le client, mais sur votre backend maîtrisé. Dans la version auto-hébergée de Plausible, chaque pageview est envoyé en POST à votre endpoint `/api/event` propre. Cet endpoint effectue le hachage IP + l'analyse de User-Agent, puis écrit en base de données uniquement les métriques agrégées (comptages de pageviews, sources de référence, type d'appareil). Aucun journal d'événements brut n'est conservé — ce qui satisfait le principe RGPD de minimisation des données (article 5.1.e).

## GA4 vs Plausible : Différence de Couverture de Mesure

Selon les rapports GA4 du Q4 2025, le taux de refus des bannières de consentement en Europe est de 58 %, l'acceptation 31 %, et 11 % ferment complètement la bannière. Avec le Consent Mode v2, Google fait de la modélisation prédictive, mais cette prédiction fonctionne uniquement sur les signaux de conversion — les métriques basées sur la session restent lacunaires. Sur un site de e-commerce, le tunnel « ajouter au panier → commande » souffre de 40 % de lacunes de données, les modèles d'attribution ne fonctionnent pas complètement.

L'approche sans cookies de Plausible n'ayant pas besoin de consentement, elle affiche un taux de couverture de 95 %+. Un client SaaS allemand en début 2026 a exécuté GA4 et Plausible en parallèle : GA4 relevait 420 K visiteurs uniques, Plausible 710 K. La différence n'est pas seulement due au consentement — sur iOS Safari, ITP (Intelligent Tracking Prevention) réduit le cookie `_ga` de GA4 à 7 jours, tandis que Plausible, basé sur des hash, est immunisé contre ITP.

Le compromis est clair : Plausible n'offre pas d'analyse au niveau utilisateur. Vous ne pouvez pas voir « le même utilisateur a visité 5 pages sur 3 jours différents » car le hash se renouvelle toutes les 24 heures. Sur GA4, vous pouvez créer des segments d'exploration comme « utilisateurs arrivés par un premier clic en 7 jours et ayant converti » — Plausible ne le permet pas. Si votre stratégie marketing privilégie l'optimisation de contenu et les canaux de référence plutôt que les entonnoirs, ce compromis est acceptable.

## Architecture d'Agrégation Côté Serveur

Pour utiliser Plausible en production, deux options : cloud managé (plausible.io) ou auto-hébergé. Si vous choisissez l'auto-hébergement, votre architecture ressemble à ceci :

```
Client (navigateur)
  └─> tracking.yourdomain.com/api/event  (proxy Nginx)
       └─> Stack Docker Compose
            ├─ App Plausible (Elixir/Phoenix)
            ├─ ClickHouse (DB d'agrégation événementielle)
            └─ PostgreSQL (métadonnées + paramètres utilisateur)
```

ClickHouse est critique ici — base de données OLAP, orientée colonne, les requêtes d'agrégation sont 10 à 100x plus rapides. Plausible écrit chaque événement pageview dans ClickHouse selon ce schéma :

| Colonne | Type | Exemple |
|---------|------|---------|
| `timestamp` | DateTime | 2026-08-11 14:32:18 |
| `site_id` | UInt32 | 42 |
| `hostname` | String | www.example.com |
| `pathname` | String | /blog/analytics-privacy |
| `referrer_source` | String | google |
| `country_code` | String | FR |
| `device` | String | Desktop |
| `browser` | String | Chrome |

Chaque ligne = 1 pageview. Aucun identifiant utilisateur — les métriques du tableau de bord se créent par agrégation `GROUP BY pathname, country_code`. Les lignes sont auto-supprimées au bout de 90 jours (RGPD article 5.1.e : limitation du stockage). En auto-hébergement, vous fixez cette période de rétention.

Pour l'anonymisation côté serveur des IP, activez ce module Nginx :

```nginx
location /api/event {
    proxy_pass http://plausible:8000;
    proxy_set_header X-Forwarded-For "";
    proxy_set_header X-Real-IP "0.0.0.0";
}
```

Plausible ne voit jamais l'IP client — le hash se dérive uniquement de la chaîne User-Agent. Pour la conformité RGPD, cette configuration renforce l'argument « aucune donnée personnelle traitée ».

## Intégration avec la Stack de Données Propriétaires

Si vous voulez fusionner les métriques agrégées de Plausible dans votre propre data warehouse, vous devez extraire les données de ClickHouse. Plausible n'expose pas d'API (en version auto-hébergée), mais ClickHouse se connecte directement à BigQuery via JDBC :

```sql
-- Tableau de staging dans BigQuery
CREATE TABLE `analytics.plausible_pageviews` (
  event_date DATE,
  pathname STRING,
  pageviews INT64,
  unique_visitors INT64,
  bounce_rate FLOAT64
);

-- DAG Airflow : transfert quotidien ClickHouse → BigQuery
INSERT INTO `analytics.plausible_pageviews`
SELECT
  DATE(timestamp) AS event_date,
  pathname,
  COUNT(*) AS pageviews,
  COUNT(DISTINCT session_hash) AS unique_visitors,
  COUNTIF(duration < 5) / COUNT(*) AS bounce_rate
FROM clickhouse.events
WHERE DATE(timestamp) = CURRENT_DATE() - 1
GROUP BY 1, 2;
```

À ce stade, comme dans l'architecture de données propriétaires que Roibase pratique, vous fusionnez les événements Plausible avec les signaux de conversion du GTM côté serveur. Dans BigQuery, un `JOIN` corrèle « article de blog le plus vu dans Plausible + soumission de formulaire depuis GTM » — une corrélation que GA4 perd à 40 % à cause des lacunes de consentement.

Modèle dbt exemple :

```sql
-- models/analytics/contenu_conversion_entonnoir.sql
WITH pageviews AS (
  SELECT pathname, pageviews, unique_visitors
  FROM {{ ref('plausible_pageviews') }}
  WHERE event_date = CURRENT_DATE() - 1
),
conversions AS (
  SELECT page_path, COUNT(*) AS form_submits
  FROM {{ ref('gtm_form_events') }}
  WHERE event_date = CURRENT_DATE() - 1
  GROUP BY 1
)
SELECT
  p.pathname,
  p.pageviews,
  COALESCE(c.form_submits, 0) AS conversions,
  SAFE_DIVIDE(c.form_submits, p.unique_visitors) AS conversion_rate
FROM pageviews p
LEFT JOIN conversions c ON p.pathname = c.page_path
ORDER BY conversion_rate DESC;
```

Ce modèle produit un rapport « top 10 des pages avec le meilleur taux de conversion » de manière RGPD-conforme.

## Compromis : Limites d'Attribution et de Retargeting

Plausible étant privacy-first, il n'effectue pas de suivi cross-domaine. Si votre marketing est multi-canal (Meta Ads + Google Ads + newsletter) et vous voulez tracker un utilisateur pendant 30 jours, Plausible est insuffisant. Sur GA4, vous pourriez créer un segment d'exploration « même utilisateur arrivé via 3 campagnes différentes » avec User-ID — Plausible ne le permet pas.

Les listes de retargeting ne sont pas non plus possibles. Sur GA4 Audience Builder, vous créez un segment « lecteurs de blog en 7 jours sans achat » et l'envoyez à Google Ads — ce flux n'existe pas dans Plausible. Solution : GTM côté serveur + Conversion API pour gérer vos listes d'audiences propriétaires dans votre CDP. Plausible reste limité à la couche d'analytics de contenu ; le retargeting utilise un pipeline de données distinct.

Pour la mesure d'incrémentalité, Plausible suffit. Il s'intègre avec vos outils de test A/B (Optimizely, VWO) car l'information de variante arrive en query string : `/product?variant=B`. Plausible la voit dans `pathname` et peut l'isoler en agrégation. Mais si le calcul de lift requiert des données au niveau utilisateur (ex. MMM bayésienne), la structure agrégée de Plausible limite les capacités.

## Scénarios d'Audit RGPD et de Conformité Française

Le RGPD article 5 impose aux responsables du traitement de déclarer les données personnelles traitées et les finalités. Avec Plausible, la défense est simple : « Nous dérivons une valeur de hash à partir de l'IP et du User-Agent, cette valeur ne peut être inversée, elle se renouvelle toutes les 24 heures, seuls les comptages de pageviews agrégés sont conservés. » Lors d'un audit RGPD, cette explication relève de la catégorie « données anonymisées » (article 4.1 et considérant 26).

Si une demande d'accès aux données personnelles (RGPD article 15) survient : Plausible n'identifie pas les utilisateurs, donc la réponse « aucune donnée personnelle vous concernant n'est stockée » tient. GA4 exigerait d'appeler l'API de suppression de données Google pour éliminer les ID Signals, Client ID et User-ID — un processus qui prend 60 jours. Plausible n'a aucun tel processus.

Pour la conformité TCF 2.2 : le script de suivi Plausible relève de la catégorie « strictement nécessaire », aucune intégration CMP requise. GA4, lui, exige un consentement explicite (Purpose 1 : « accès et stockage d'informations ») — ce consentement est refusé par 58 % du trafic européen. Plausible supprime cette exigence.

## Checklist de Déploiement en Production

Si vous déployez Plausible auto-hébergé, suivez ces étapes :

1. **Configuration DNS :** créez un sous-domaine `tracking.yourdomain.com`, certificat SSL (Let's Encrypt).
2. **Docker Compose :** récupérez `docker-compose.yml` du dépôt officiel Plausible, configurez `SECRET_KEY_BASE` et `DATABASE_URL`.
3. **Tuning ClickHouse :** dans `/etc/clickhouse-server/config.xml`, fixez `max_memory_usage` à 60 % de la RAM serveur (ex. 32 GB RAM → `19200000000`).
4. **Proxy inverse Nginx :** activez le rate limiting (`limit_req_zone $binary_remote_addr zone=tracking:10m rate=10r/s;`) — protection DDoS.
5. **Script de suivi :** injectez ce snippet dans le frontend :

```html
<script defer data-domain="yourdomain.com" src="https://tracking.yourdomain.com/js/script.js"></script>
```

6. **Politique de rétention :** configurez `TTL` dans ClickHouse (ex. suppression auto après 90 jours) :

```sql
ALTER TABLE events MODIFY TTL timestamp + INTERVAL 90 DAY;
```

7. **Sauvegarde :** `pg_dump` quotidien pour PostgreSQL, outil `clickhouse-backup` pour ClickHouse.

Pour 1 M pageviews/mois en production, infrastructure requise : 2 vCPU, 8 GB RAM, 50 GB SSD. Coût AWS ~80 $/mois, Hetzner ~30 $/mois. Le Plausible cloud managé demande 99 $/mois pour le même trafic — l'auto-hébergement coûte 70 % moins cher mais ajoute du travail DevOps.

## Plausible Sans Cookies, Mais Est-ce Suffisant ?

La limite de l'analytics privacy-first est claire : sans analyse au niveau utilisateur, certaines questions marketing rest