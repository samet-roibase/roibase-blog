---
title: "Résolution d'identité : De 6 signaux à un profil client unique"
description: "Hash matching, probabilistic linking et identity graph : fusionnez les touchpoints dispersés en un profil client unifié. Architecture server-side et schéma pratique."
publishedAt: 2026-07-19
modifiedAt: 2026-07-19
category: data
i18nKey: data-003-2026-07
tags: [resolution-identite, hash-matching, probabilistic-linking, cdp, first-party-data]
readingTime: 9
author: Roibase
---

Un utilisateur clique sur une campagne depuis son téléphone, ajoute un produit au panier sur son ordinateur, achète en magasin. Ces trois signaux correspondent à trois identités distinctes : `device_id`, `cookie_hash`, `email_hash`. La résolution d'identité est le pipeline de données qui transforme ces fragments en un profil client unifié. À l'ère post-cookie — Consent Mode v2, iOS ATT, CCPA — une architecture de résolution d'identité server-side basée sur les données first-party n'est plus une recommandation, c'est une nécessité.

## Pourquoi six signaux différents

La stack marketing moderne collecte les signaux d'identité sur six couches : **browser cookie**, **device ID** (IDFA/GAID), **authenticated hash** (email SHA-256), **customer ID** (interne CRM/CDP), **IP + user-agent fingerprint**, **household graph**. Chacun s'active à un moment différent du lifecycle.

Le browser cookie arrive au premier touchpoint ; le device ID sur l'app mobile ; l'authenticated hash lors de la collecte d'email ou de numéro de téléphone ; le customer ID après le checkout ; la fingerprint pour l'appariement probabiliste sans consentement ; le household graph pour regrouper les appareils connectés au même routeur. Le problème : ces six signaux vivent dans des tables différentes, avec des TTL différents (cookie 90 jours, IDFA illimité, email hash jusqu'à suppression du client). Sans résolution, chaque canal compte des utilisateurs distincts — doublon dans le mix model, surestimation en test d'incrémentalité, illusion de faible rétention dans les cohortes.

La logique de résolution fonctionne selon deux méthodes : **déterministe (hash matching)** et **probabiliste (graph linking)**. Déterministe : le hash SHA-256 de l'email relie un événement web à une transaction backend — 100 % de certitude. Probabiliste : si le même IP + user-agent apparaît dans deux événements en 24 heures, la probabilité que ce soit le même utilisateur est de ~73 % (seuil exemple). Sans résolution, le nombre d'utilisateurs uniques gonfle de 40 à 80 % (selon la catégorie et le mix d'appareils).

## Hash matching : transformer email et téléphone en clés d'identité

Le hash matching est l'épine dorsale de la résolution d'identité server-side. Dès que l'utilisateur fournit son email ou téléphone, le client-side ou sGTM génère un hash SHA-256, écrit ce hash dans la table `identity_map`. Lors des événements anonymes suivants, une recherche par cookie ou device ID retrouve le hash associé.

Schéma simple de `identity_map` :

```sql
CREATE TABLE identity_map (
  canonical_id STRING NOT NULL,      -- UUID, ID interne
  signal_type STRING NOT NULL,       -- 'email_sha256', 'phone_sha256', 'device_id', 'cookie'
  signal_value STRING NOT NULL,      -- hash ou ID
  first_seen TIMESTAMP,
  last_seen TIMESTAMP,
  PRIMARY KEY (signal_type, signal_value)
);
```

Quand un utilisateur rentre `user@example.com` dans un formulaire d'inscription, sGTM hash cet email en SHA-256 et fait un `INSERT` : `('uuid-123', 'email_sha256', 'abc123...', NOW(), NOW())`. Dans la même session, si le cookie est `_ga=GA1.1.xyz`, une deuxième ligne : `('uuid-123', 'cookie', 'GA1.1.xyz', NOW(), NOW())`. Ainsi, deux signaux se fusionnent sous `canonical_id = uuid-123`.

Dans la session suivante, l'utilisateur arrive sans refournir son email, juste avec `_ga=GA1.1.xyz`. Lookup dans BigQuery :

```sql
SELECT canonical_id
FROM identity_map
WHERE signal_type = 'cookie' AND signal_value = 'GA1.1.xyz'
LIMIT 1;
```

Retour : `uuid-123`. L'événement se rattache à cet ID — même utilisateur identifié sans recourir au hash d'email. La précision du hash matching atteint 100 % car la collision cryptographique est théoriquement impossible. En revanche, il y a un problème de couverture : si l'utilisateur n'a pas fourni son email, il n'y a pas de hash, on bascule sur le probabiliste.

### Risque de collision et salt

Le risque de collision SHA-256 est théorique : 1 sur 2^128 tentatives. En production, le vrai problème est qu'**un même email peut être lié à plusieurs `canonical_id`** (erreur manuelle, reliquats de migration ancienne). D'où l'importance d'ajouter `UNIQUE INDEX (signal_type, signal_value)`. L'utilisation d'un salt (email + chaîne secrète puis hash) n'augmente pas le risque de collision mais ajoute une couche de confidentialité dans l'[architecture first-party](https://www.roibase.com.tr/fr/firstparty) — en rotant le salt, les anciens hash deviennent invalides, utile pour RGPD "droit à l'oubli".

## Linking probabiliste : IP, user-agent et device graph

Si l'utilisateur navigue en mode anonyme, il n'y a pas de signal déterministe. Vous exploitez alors un **graph probabiliste** : IP + user-agent + proximité temporelle pour générer un score "probablement le même utilisateur". Exemple : même IP, même user-agent, 15 minutes d'intervalle → 85 % de chance que ce soit la même personne.

Logique simple de fusion probabiliste :

```sql
WITH anon_events AS (
  SELECT
    event_id,
    ip_address,
    user_agent,
    event_timestamp,
    FARM_FINGERPRINT(CONCAT(ip_address, user_agent)) AS fingerprint
  FROM events
  WHERE canonical_id IS NULL
),
clusters AS (
  SELECT
    fingerprint,
    MIN(event_timestamp) AS first_event,
    MAX(event_timestamp) AS last_event,
    COUNT(*) AS event_count
  FROM anon_events
  GROUP BY fingerprint
  HAVING TIMESTAMP_DIFF(MAX(event_timestamp), MIN(event_timestamp), HOUR) < 24
)
SELECT
  a.event_id,
  c.fingerprint AS probable_cluster_id
FROM anon_events a
JOIN clusters c ON a.fingerprint = c.fingerprint;
```

Cette requête groupe les événements sur 24 heures selon le hash IP+UA. On utilise l'ID du cluster comme `canonical_id` temporaire, mais il faut ajouter un score de confiance : `event_count > 3 AND time_span < 1 HOUR → confidence=0.9`.

**Household graph :** Différents user-agent depuis le même IP (laptop, tablette, téléphone) suggèrent une même maison. On crée un `household_id` qu'on place sous chaque `canonical_id` individuel. Par exemple, abonnement Amazon Prime : 1 souscription, 6 profils — la résolution d'identité agrège au niveau du foyer.

### Taux de faux positifs

Le linking probabiliste comporte un risque de faux positif. Le même IP + user-agent peut provenir de deux utilisateurs différents (WiFi de bureau, bibliothèque). Si le seuil est trop bas (50 % de confiance), on atteint 15-25 % de faux positifs. Les meilleures pratiques du secteur : seuil ≥75 % de confiance, fenêtre de 1 heure, minimum 2 correspondances d'événements. Des vendors comme LiveRamp utilisent une base de données graphe (Neo4j) et combinent 30+ signaux, affichant 95 %+ de précision — mais sur votre propre pipeline first-party, 2-3 signaux avec 80 % de précision suffisent.

## Pipeline server-side : sGTM + BigQuery + dbt

En environnement production, la résolution d'identité suit ce flux de données :

1. **Ingestion événements sGTM :** L'événement client côté GTM passe à sGTM, sGTM ajoute le hash SHA-256 s'il y a un email, écrit l'événement brut dans BigQuery (`events_raw`).
2. **Modèle staging dbt :** La table `stg_events` nettoie les événements depuis `events_raw`, parse les colonnes `signal_type` et `signal_value`.
3. **Fusion identity_map dbt :** Quand un nouveau hash est vu, on fait un `MERGE` dans `identity_map` (logique upsert).
4. **Enrichissement canonical_id dbt :** Chaque événement se joint à `identity_map` pour retrouver le `canonical_id`.
5. **Agrégation dbt :** Les métriques au niveau utilisateur (`user_ltv`, `session_count`) sont agrégées par `canonical_id`.

Exemple de snippet modèle dbt (`models/staging/stg_events.sql`) :

```sql
{{ config(materialized='incremental') }}

WITH events_with_signals AS (
  SELECT
    event_id,
    event_timestamp,
    COALESCE(user_properties.email_sha256, NULL) AS email_hash,
    COALESCE(user_properties.ga_client_id, NULL) AS cookie_id,
    event_params
  FROM {{ source('bigquery', 'events_raw') }}
  {% if is_incremental() %}
  WHERE event_timestamp > (SELECT MAX(event_timestamp) FROM {{ this }})
  {% endif %}
)
SELECT * FROM events_with_signals;
```

Le modèle incremental s'exécute chaque heure, traite le dernier lot. La logique de fusion d'identité se trouve dans un modèle distinct (`models/core/fct_identity_resolved.sql`) :

```sql
SELECT
  e.event_id,
  COALESCE(im_email.canonical_id, im_cookie.canonical_id) AS canonical_id,
  e.event_timestamp
FROM {{ ref('stg_events') }} e
LEFT JOIN {{ ref('identity_map') }} im_email
  ON e.email_hash IS NOT NULL
  AND im_email.signal_type = 'email_sha256'
  AND im_email.signal_value = e.email_hash
LEFT JOIN {{ ref('identity_map') }} im_cookie
  ON e.cookie_id IS NOT NULL
  AND im_cookie.signal_type = 'cookie'
  AND im_cookie.signal_value = e.cookie_id;
```

Cette logique de jointure effectue le hash matching déterministe. Pour le probabiliste, vous ajoutez un modèle `fct_probabilistic_clusters` séparé.

## Consentement et confidentialité : conformité RGPD, CCPA

La résolution d'identité relève du RGPD Article 6 (fondement juridique) et des règles CCPA "do not sell". Le hash d'email est classé comme **donnée personnelle** (décision CJUE 2019), exigeant un consentement ou un intérêt légitime.

Sous Consent Mode v2, si l'utilisateur fixe `analytics_storage=denied`, vous ne pouvez pas collecter le hash d'email. Seule la fingerprint IP+UA s'applique (intérêt légitime — mais l'interprétation CJUE reste débattue). Bonne pratique : ajouter une colonne `consent_status` à `identity_map`, n'écrire le hash que depuis les événements `analytics_storage=granted`.

Pour le "right to delete" CCPA, il faut une logique de suppression basée sur `canonical_id` :

```sql
DELETE FROM identity_map WHERE canonical_id = 'uuid-123';
DELETE FROM events WHERE canonical_id = 'uuid-123';
```

Pour les suppressions en cascade, utilisez des contraintes de clé étrangère (BigQuery ne les supporte pas nativement, mais Postgres/Snowflake le font). Alternative : soft delete (`deleted_at TIMESTAMP`) suivi d'une purge par lot.

### Mapping vendor TCF 2.2

Sous IAB TCF 2.2, la résolution d'identité relève de "Purpose 1 — Store and/or access information on a device". Si l'utilisateur n'a pas approuvé votre entrée dans la vendor list, vous ne pouvez pas faire de linking cross-device. Dans les projets Roibase, on parse la chaîne TCF dans BigQuery et l'écrit dans `vendor_consent`, puis on filtre la fusion d'identité :

```sql
WHERE vendor_consent LIKE '%vendor_id=123%'
```

Cette logique empêche de construire un identity graph sans consentement — équilibre conformité + qualité data.

## Intégration CDP : Segment, mParticle, Rudderstack

Les CDP modernes proposent leurs propres graph d'identité, mais généralement en boîte noire. En construisant votre propre pipeline, vous contrôlez la logique — essentiel notamment dans les projets [CDP & Retention Engineering](https://www.roibase.com.tr/fr/retention-engineering-cdp). L'appel `identify()` de Segment fusionne `userId` et `anonymousId`, mais quel signal a la priorité ? Dans votre logique de résolution, l'ordre de priorité doit être explicite :

1. `customer_id` (CRM) → le plus fiable
2. `email_sha256` → déterministe
3. `device_id` → cross-session mais pas cross-device
4. `cookie` → TTL le plus court
5. `fingerprint` → fallback probabiliste

Vous codifiez cette cascade de priorité avec `COALESCE()` en dbt. Seul le `canonical_id` final et le `confidence_score` vont au CDP — la logique de fusion vous reste.

La résolution d'identité est la couche fondamentale de la stack data marketing moderne. Le hash matching apporte une certitude déterministe, le linking probabiliste assure la couverture, le household graph ouvre la segmentation familiale. Quand votre pipeline server-side fusionne ces six signaux en respectant consentement et confidentialité, la précision des utilisateurs uniques augmente de 40 %, l'illusion de rétention faible diminue, les tests d'incrémentalité deviennent fiables. Construire votre propre logique de résolution via BigQuery + dbt + sGTM vous affranchit de la boîte noire des vendors et vous laisse maîtriser votre graph selon vos besoins.