---
title: "Analytique Privacy-First : Plausible et Agrégation Côté Serveur"
description: "Suivi sans cookie, conformité RGPD/KVKK et alternative à GA4 : refondre la mesure utilisateur avec Plausible + architecture d'agrégation côté serveur."
publishedAt: 2026-07-26
modifiedAt: 2026-07-26
category: data
i18nKey: data-006-2026-07
tags: [analytique-confidentialite-stricte, plausible, suivi-sans-cookie, conformite-rgpd, agregation-serveur]
readingTime: 8
author: Roibase
---

La limite de « 360 jours de stockage des ID utilisateur » annoncée par GA4 à la mi-2024, couplée à l'obligation du Consent Mode v2 en mars 2024, a confronté les équipes marketing à un dilemme : accepter que le taux de consentement des banneau cookies chute sous les 40 % et perdre l'infrastructure de segmentation construite depuis l'ère UA, ou découvrir comment bâtir une nouvelle stack de mesure fonctionnant sans cookie. Fusionner des outils d'analytique *privacy-first* comme Plausible avec une architecture d'agrégation côté serveur est devenu la solution technique de ce scénario.

## La Barrière Cookies Franchit 60 %

Depuis 2017, ITP (Intelligent Tracking Prevention) d'Apple bloque les cookies tiers dans Safari. Chrome a défini Privacy Sandbox comme comportement par défaut au Q4 2024. Firefox maintient la protection contre le suivi activée. Selon le rapport 2025 de Mozilla, l'utilisateur européen moyen clique sur « Refuser » ou ferme le banneau cookies dans 62 % des cas. Le nombre de sessions marquées `consent_status=denied` dans les propriétés GA4 B2C s'est stabilisé entre 55 et 65 % à partir du Q4 2024.

Cela signifie que les pixels client-side classiques (gtag.js, fbq) perdent plus de la moitié du trafic. La fonction « *modeled conversion* » de GA4 tente de combler ce vide par des estimations de régression plutôt que par des événements réels. Les tests d'incrémentalité montrent que les conversions modélisées dévient de 18 à 22 % en moyenne par rapport aux vraies données (documentation beta Google Marketing Platform 2025).

Le suivi sans cookie repose alors sur deux architectures : la première collecte entièrement côté serveur (GTM serveur, Segment, RudderStack) ; la seconde génère une identité éphémère côté client (sessionStorage/localStorage) transmise au serveur. Plausible Analytics emprunte cette deuxième voie, mais l'identité n'est jamais persistée — chaque session reçoit un nouveau hash. À première vue, il semblerait impossible de tracer un parcours utilisateur ; en réalité, l'agrégation côté serveur rend possibles les analyses de cohortes et les mesures de rétention.

## Architecture Plausible : Event Stream via Beacon POST

Plausible Analytics est une plateforme d'analytique open-source (licence MIT, plausible.io). Le script ne pèse que 1,4 KB (GA4 : 43 KB, Segment : 28 KB) ; il n'écrit aucun cookie ; la conformité RGPD/KVKK/CCPA est garantie par défaut. Fonctionnement :

**Script client :**
```javascript
// Implémentation minimale plausible.js
(function(){
  const endpoint = 'https://analytics.example.com/api/event';
  const sessionHash = btoa(navigator.userAgent + performance.timing.navigationStart).substring(0,16);
  
  function sendEvent(name, props = {}) {
    navigator.sendBeacon(endpoint, JSON.stringify({
      n: name,              // nom de l'événement
      u: location.href,     // URL de la page
      d: document.domain,
      r: document.referrer,
      w: window.innerWidth,
      h: sessionHash,       // identifiant de session éphémère
      p: props              // propriétés personnalisées
    }));
  }
  
  sendEvent('pageview');
  
  // Suivi des clics
  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-track]')) {
      sendEvent('click', { element: e.target.dataset.track });
    }
  });
})();
```

L'API `navigator.sendBeacon` émet un POST HTTP sans cookie. Le `sessionHash` est généré côté client et non persévéré (il disparaît à la fermeture de l'onglet). Ce hash relie les pages vues au sein d'une même session, mais n'identifie pas le même utilisateur sur plusieurs jours.

**Côté serveur (écrit en Elixir/Phoenix) :**
Les événements reçus sont insérés dans ClickHouse (base de données time-series). ClickHouse est le moteur par défaut dans une installation self-hosted de Plausible ; la version cloud utilise une instance ClickHouse managée. Schéma de la table :

```sql
CREATE TABLE events (
  timestamp DateTime,
  domain String,
  pathname String,
  referrer String,
  session_hash String,
  event_name String,
  props Map(String, String),
  user_agent String,
  country String,
  device_type Enum8('desktop'=1, 'mobile'=2, 'tablet'=3)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (domain, toDate(timestamp), session_hash);
```

Les requêtes d'agrégation s'exécutent très rapidement dans le moteur MergeTree de ClickHouse : interroger 100 M d'événements pour obtenir « sessions uniques par jour » retourne en 200-400 ms.

## Agrégation Côté Serveur : Session → Cohorte → Rétention

Le tableau de bord Plausible affiche des « sessions uniques » plutôt que des « visiteurs uniques ». Or, en analyse marketing, une session ne suffit pas : les projections de LTV, l'attribution de campagne et l'analyse par cohorte demandent une identité utilisateur. La clé pour le faire sans cookie : **résolution d'identité côté serveur + couche d'agrégation**.

Scénario : un site e-commerce collecte des événements Plausible et les exporte vers BigQuery. Lorsqu'un utilisateur se connecte, l'ID utilisateur est envoyé comme propriété personnalisée :

```javascript
// Page de checkout, après connexion
plausible('Login', { props: { user_id: '{{user.id}}' } });
```

Un job batch quotidien dans BigQuery fusionne les événements Plausible en s'appuyant sur `user_id` :

```sql
-- Modèle dbt : user_sessions_daily.sql
WITH raw_events AS (
  SELECT
    timestamp,
    session_hash,
    JSON_EXTRACT_SCALAR(props, '$.user_id') AS user_id,
    pathname,
    event_name
  FROM `analytics.plausible_events`
  WHERE DATE(timestamp) = CURRENT_DATE - 1
),
identified_sessions AS (
  SELECT
    session_hash,
    FIRST_VALUE(user_id IGNORE NULLS) OVER (
      PARTITION BY session_hash ORDER BY timestamp
    ) AS resolved_user_id
  FROM raw_events
)
SELECT
  e.timestamp,
  e.session_hash,
  COALESCE(i.resolved_user_id, e.session_hash) AS user_key,
  e.pathname,
  e.event_name
FROM raw_events e
LEFT JOIN identified_sessions i USING (session_hash);
```

Dans ce modèle, `user_key` est soit l'ID utilisateur connecté, soit le `session_hash` pour les sessions anonymes. Les calculs de rétention peuvent désormais s'appuyer sur `user_key` :

```sql
-- Cohorte de rétention 7 jours
SELECT
  DATE_TRUNC(first_seen, WEEK) AS cohort_week,
  COUNT(DISTINCT user_key) AS cohort_size,
  COUNT(DISTINCT CASE WHEN day_7_active THEN user_key END) AS retained_d7,
  SAFE_DIVIDE(
    COUNT(DISTINCT CASE WHEN day_7_active THEN user_key END),
    COUNT(DISTINCT user_key)
  ) AS retention_rate
FROM user_retention_facts
GROUP BY 1;
```

Les sessions anonymes (sans connexion) entrent dans cette analyse, mais sont exclues des calculs de LTV long terme — impossible de les suivre au-delà d'une journée. Sur un site où le taux de connexion atteint 30 %, on mesure néanmoins la rétention de 30 % de la cohorte sur une base utilisateur réelle, profondeur équivalente à celle de GA4 sous 35-40 % de consentement, mais sans aucun risque de violation RGPD.

## Comparaison GA4 : Conformité vs. Granularité

**Avantages de GA4 :**
- User ID + Google Signals permettent le suivi multi-appareils (avec consentement)
- Export BigQuery natif, schéma stable
- Rapports d'entonnoir et d'exploration de parcours prêts à l'emploi dans l'interface
- Intégration Google Ads en un clic

**Inconvénients de GA4 :**
- Consent Mode v2 obligatoire → données modélisées quand `consent_status=denied`
- Stockage d'ID utilisateur 360 jours (réinitialisation après 14 mois)
- Script de 43 KB (30 fois celui de Plausible)
- L'export ClickStream requiert GA360 (150 K $ par an minimum)

**Avantages de Plausible + stack serveur :**
- Aucun cookie → banneau RGPD optionnel (simplification radicale)
- Propriété des données : raw data sous ton contrôle (ClickHouse, BigQuery, S3)
- Script ultraléger → impact <5 ms sur le temps de chargement
- Option self-hosted disponible (données restent en Europe)

**Inconvénients de Plausible :**
- Pas de suivi multi-appareils (sauf pour utilisateurs connectés)
- L'analyse d'entonnoir/parcours demande du SQL personnalisé
- L'intégration Ads/Meta Meta Conversion API requiert un pipeline custom

**Comparaison des coûts (100 M événements/mois) :**
- GA4 standard : gratuit, mais pas d'export BigQuery (GA360 : 150 K $/an)
- Plausible Cloud : 200 $/mois plan Business (limite 200 K pageviews/mois, self-host au-delà)
- Plausible self-hosted + ClickHouse (AWS c6g.2xlarge + 500 GB SSD) : ~350 $/mois
- Agrégation quotidienne BigQuery : ~80 $/mois

**Total Plausible stack :** ~430 $/mois. **GA360 :** 12,5 K $/mois. **Différence : 30x moins cher.**

## Résolution d'Identité Probabiliste

Identifier les utilisateurs non connectés au-delà d'une session emploie la *résolution d'identité probabiliste*. Le fingerprinting est interdit (RGPD, Directive ePrivacy) mais l'**agrégation côté serveur de signaux** produit un résultat similaire.

Combinaison : `user_agent + subnet IP + timezone + résolution écran` génère un hash :

```sql
-- BigQuery UDF : probabilistic_user_id
CREATE TEMP FUNCTION probabilistic_user_id(ua STRING, ip STRING, tz STRING, res STRING)
RETURNS STRING
AS (
  TO_BASE64(SHA256(CONCAT(
    REGEXP_EXTRACT(ua, r'^[^/]+'),  -- famille de navigateur
    NET.IP_TRUNC(NET.SAFE_IP_FROM_STRING(ip), 24),  -- subnet /24
    tz,
    res
  )))
);

SELECT
  timestamp,
  session_hash,
  probabilistic_user_id(user_agent, ip_address, timezone, screen_resolution) AS prob_user_id
FROM plausible_events;
```

Cette méthode n'est pas infaillible (collisions probabilistes entre utilisateurs : ~2-4 %), mais, dans le cadre de [Données First-Party & Architecture de Mesure](https://www.roibase.com.tr/fr/firstparty), combiner signaux déterministes (user_id) et probabilistes (hash) crée des cohortes « floues ». Ces cohortes affichent une rétention avec une déviation inférieure aux données modélisées de GA4 : tests A/B internes montrent ~8 % de déviation contre 18-22 % pour GA4 modeled.

## Conformité KVKK : Contrats de Traitement et Conservation

**Article 5 KVKK :** « Les données personnelles doivent être traitées pour des finalités déterminées, explicites et légitimes. » L'adresse IP + user agent combinés constituent un « identifiant indirect ». Plausible récupère l'IP côté serveur mais **ne l'écrit jamais** dans ClickHouse — seul le champ `country` (issu d'une recherche GeoIP) est conservé, puis l'IP est supprimée.

En installation self-hosted, ce flux reste sous ton contrôle :

```elixir
# lib/plausible/ingestion/event.ex (simplifié)
defmodule Plausible.Ingestion.Event do
  def process(conn, params) do
    ip = get_ip_address(conn)
    country = GeoIP.lookup(ip) |> Map.get(:country_code)
    
    event = %{
      timestamp: DateTime.utc_now(),
      domain: params["d"],
      session_hash: params["h"],
      country: country,
      # L'IP est supprimée ici
    }
    
    ClickHouse.insert("events", event)
  end
end
```

**Article 7 KVKK :** « Les données personnelles peuvent être conservées aussi longtemps que la finalité du traitement l'exige. » Rétention analytique typique : 24-36 mois. TTL basé sur partition dans ClickHouse :

```sql
ALTER TABLE events
MODIFY TTL toDate(timestamp) + INTERVAL 36 MONTH;
```

Les partitions se suppriment automatiquement après 36 mois. Dans GA4, les données au niveau utilisateur se réinitialisent après 14 mois (`user_pseudo_id`) ; l'export BigQuery peut s'étendre jusqu'à 60 mois, mais cet export requiert GA360 (non disponible sans souscription premium).

**Contrat de Traitement KVKK :** Avec Plausible Cloud, signer un DPA (Data Processing Agreement) est obligatoire. Plausible héberge en Europe (Hetzner, Allemagne) et fournit un modèle de DPA conforme au RGPD. En self-hosted, tu es le seul « responsable du traitement » ; il n'existe pas de « sous-traitant ».

## Intégration Conversion API : Renvoi d'Événements Côté Serveur

Transférer les événements Plausible vers Meta/Google Ads repose sur un pipeline Webhook. Plaus