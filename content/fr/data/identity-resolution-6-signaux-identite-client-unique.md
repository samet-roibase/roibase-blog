---
title: "Identity Resolution: De 6 Signaux à une Identité Client Unique"
description: "Architecture technique de hash matching, probabilistic linking et household identity pour transformer les signaux dispersés en un profil client unifié."
publishedAt: 2026-05-31
modifiedAt: 2026-05-31
category: data
i18nKey: data-003-2026-05
tags: [identity-resolution, cdp, first-party-data, probabilistic-matching, hash-matching]
readingTime: 9
author: Roibase
---

Un utilisateur s'inscrit par email, passe commande depuis l'app mobile, ouvre un ticket de support depuis le navigateur desktop le lendemain. Cookie ID, device ID, email hashé, IP, session ID, user ID — six signaux distincts. Sans identity resolution, six « clients » différents apparaissent. L'attribution publicitaire se calcule mal, le modèle LTV reste biaisé, les signaux de rétention se perdent. Le User ID merge de Google Analytics 4 unifie uniquement les sessions authentifiées, les comportements anonymes restent fragmentés. Les CDP vendent du « probabilistic stitching » sans montrer l'architecture des tables. Pour mettre en production un identity graph, il faut faire fonctionner ensemble le hash matching, le probabilistic linking et l'household identity.

## Hash Matching: L'Épine Dorsale de l'Unification Déterministe

Le hash matching crée une liaison « certaine » entre deux signaux en appairant les hash SHA-256 de la même adresse email ou du même numéro de téléphone. Quand un utilisateur s'inscrit sur le site web avec `user@example.com`, tu hashifies cette valeur en SHA-256 et l'écris dans ta table `identity_signals` sous la colonne `hashed_email`. Lors d'une connexion à l'app mobile avec le même email, ce hash aura la même valeur dans la deuxième source — tu fusionnes les deux enregistrements.

```sql
-- Exemple de match déterministe dans BigQuery
CREATE OR REPLACE TABLE `project.dataset.merged_identities` AS
SELECT
  web.anonymous_id AS web_cookie_id,
  mobile.device_id AS mobile_device_id,
  web.hashed_email,
  MIN(web.first_seen_timestamp) AS first_seen
FROM `project.dataset.web_events` web
INNER JOIN `project.dataset.mobile_events` mobile
  ON web.hashed_email = mobile.hashed_email
WHERE web.hashed_email IS NOT NULL
GROUP BY 1,2,3;
```

Cette requête fusionne le cookie ID web avec le device ID mobile via l'email hashé. Le `INNER JOIN` est déterministe — seules les correspondances certaines arrivent. Pour regrouper les signaux appairés sous le même `canonical_user_id`, utilise `ROW_NUMBER()` ou une génération UUID. La limite du hash matching : si l'utilisateur change d'email (ancien compte + nouveau compte), ils restent deux identités distinctes. C'est ici que la couche probabiliste intervient.

Le hash matching respecte le RGPD et la KVKK car tu ne stockes pas les plaintext email — le hash est unidirectionnel, non-réversible. Mais il reste vulnérable aux attaques par table arc-en-ciel (rainbow tables), donc il faut ajouter à l'email hashé d'autres signaux secondaires (device fingerprint, plage IP). Une seule colonne hash ne suffit pas — maintiens `hashed_email`, `hashed_phone`, `hashed_customer_id` comme colonnes séparées. Partitionne la table par `DATE(timestamp)` — la résolution d'identité est généralement incrémentale, un full scan de tout l'historique coûte cher.

## Probabilistic Linking: Gérer l'Incertitude par Scoring

Quand un utilisateur navigue sans s'inscrire, tu n'as pas d'email hashé — mais tu as cookie ID, IP, user agent, timestamp de session. Le matching probabiliste pondère ces signaux pour générer un score de « probabilité d'être la même personne ». Si le score dépasse un seuil (ex. 0.85), tu fusionne les deux enregistrements ; en dessous, tu les gardes séparés. Des vendors comme LiveRamp, Merkle, Neustar vendent ces scores, mais tu peux construire ton propre modèle de règles dans ta warehouse.

Logique exemple : même IP + même fingerprint navigateur (hash canvas) + session en 5 min → score 90 %. Même IP + navigateur différent + écart 2 heures → score 40 %. Seuil 0.7 = la première paire fusionne, la deuxième non. Tu peux le modéliser en BigQuery avec des blocs `CASE WHEN` :

```sql
SELECT
  a.session_id AS session_a,
  b.session_id AS session_b,
  CASE
    WHEN a.ip_address = b.ip_address
      AND a.canvas_hash = b.canvas_hash
      AND TIMESTAMP_DIFF(b.timestamp, a.timestamp, MINUTE) <= 5
    THEN 0.90
    WHEN a.ip_address = b.ip_address
      AND TIMESTAMP_DIFF(b.timestamp, a.timestamp, HOUR) <= 2
    THEN 0.40
    ELSE 0.0
  END AS match_score
FROM `project.dataset.anonymous_sessions` a
CROSS JOIN `project.dataset.anonymous_sessions` b
WHERE a.session_id < b.session_id
  AND a.ip_address = b.ip_address
QUALIFY match_score >= 0.70;
```

Ce `CROSS JOIN` fait exploser le coût sur millions de lignes. En production, il faut du windowing ou du bucketing : partitionne par préfixe IP (ex. `/24` CIDR), compare seulement les 100 dernières sessions par bucket avec `ROW_NUMBER()`. Le risque du probabilistic matching : faux positifs — deux utilisateurs différents sur le même IP (Wi-Fi bureau, VPN partagé) à la même heure pourraient fusionner à tort. C'est pourquoi le seuil doit rester entre 0.85–0.90 et validé par des signaux cross-device.

Un modèle probabiliste ML est plus sophistiqué : régression logistique ou gradient boosting pour classifier « même utilisateur ». Feature set : distance Hamming sur IP, similarité Levenshtein sur user agent, décalage timezone, nombre de sessions. Les données d'entraînement étiquetées viennent de paires `user_id` connues (positives) vs `user_id` différents (négatives). Le modèle sort un score 0-1, le seuil reste un paramètre manuel. Construire cette approche nécessite un pipeline Vertex AI ou SageMaker — l'engineering données et ML travaillent ensemble.

## Household Identity: Même IP, Utilisateurs Différents

La couche « household » dans identity resolution : grouper les utilisateurs différents depuis la même IP ou adresse physique et les traiter comme une « unité foyer » pour le ciblage marketing. Exemple : sur un e-commerce, la mère regarde des vêtements enfant, le père achète de l'électronique — deux `user_id` distincts mais même adresse de livraison. Le household graph les réunit sous un `household_id`. Sur les plateformes publicitaires (Facebook Ads, Google Ads), cela s'appelle « household targeting », mais tu dois le modéliser toi-même dans tes first-party data.

Normalise l'adresse de livraison en BigQuery : casse, espaces, numéro d'appartement variés. Puis hashifie et utilise-la comme `household_key` :

```sql
CREATE OR REPLACE TABLE `project.dataset.household_mapping` AS
SELECT
  user_id,
  TO_HEX(SHA256(
    LOWER(REGEXP_REPLACE(CONCAT(street, city, postal_code), r'\s+', ''))
  )) AS household_key
FROM `project.dataset.user_addresses`
WHERE street IS NOT NULL AND postal_code IS NOT NULL;
```

Cette table mappe `user_id` → `household_key`. Groupe les utilisateurs avec la même `household_key` et assigne-leur un `household_id`. L'household identity diffère de l'identity cross-device — pas les appareils d'une même personne, mais les personnes du même foyer. Risque de confidentialité élevé : fusionner deux adultes différents sous le même household viole le principe de minimisation de données (KVKK art. 5). Utilise le household graph uniquement pour les analyses agrégées et le ciblage anonyme, pas pour fusionner les profils individuels.

Signaux supplémentaires au household graph : hash SSID Wi-Fi (si l'app mobile a permission), beacon Bluetooth (magasin physique), shared payment method (même carte de crédit). Ces signaux sont PII — besoin de hash + encrypted storage. Les CDP (Segment, mParticle, RudderStack) offrent une « relationship graph » intégrée, mais tu gagnes plus de contrôle en le bâtissant manuellement en BigQuery — tu vois exactement quel signal a quel poids. Le travail de Roibase sur [CDP & Retention Engineering](https://www.roibase.com.tr/fr/retention-engineering-cdp) intègre cette couche dans un pipeline production.

## Graph Database vs Relational: Qui Est Plus Rapide

Stocker un identity graph dans une warehouse relationnelle comme BigQuery c'est possible, mais interroger les chaînes « A → B → C » (transitive closure) coûte cher. Une graph database (Neo4j, Amazon Neptune, TigerGraph) le fait en structure node/edge — « trouver tous les appareils d'un utilisateur » avec `MATCH (u:User)-[:HAS_DEVICE]->(d:Device)` revient en millisecondes. En BigQuery, le même besoin s'écrit avec `RECURSIVE CTE` ou `ARRAY_AGG` — le coût en slots monte.

Compromis : graph DB très rapide mais schema inflexible, le modèle node/edge est différent de la syntaxe SQL qu'les data engineers connaissent. La warehouse relationnelle est plus lente mais version control avec dbt, tests et documentation sont simples. La plupart des environnements production choisissent l'hybride : construis le mapping d'identité quotidien en BigQuery via dbt, sync-le vers Neo4j, fais les lookups temps réel depuis Neo4j. Pipeline exemple : dbt model → BigQuery view → Cloud Function trigger → Neo4j Cypher INSERT.

```sql
-- BigQuery: transitive closure avec CTE récursive (lent)
WITH RECURSIVE identity_chain AS (
  SELECT signal_a, signal_b, 1 AS depth
  FROM `project.dataset.identity_edges`
  UNION ALL
  SELECT ic.signal_a, e.signal_b, ic.depth + 1
  FROM identity_chain ic
  JOIN `project.dataset.identity_edges` e
    ON ic.signal_b = e.signal_a
  WHERE ic.depth < 5
)
SELECT DISTINCT signal_a, signal_b
FROM identity_chain;
```

Cette requête suit des chaînes jusqu'à 5 niveaux (depth). Sans limite de depth, risque de boucle infinie — A → B → A. Une graph DB gère les boucles nativement, BigQuery besoin d'une condition WHERE manuelle. Si ton graph atteint 10M+ edges, un système dédié comme Neo4j devient plus maintenable. Sous 1M edges, BigQuery + dbt suffisent.

## Privacy et Consentement: Les Limites Légales du Graph d'Identité

Identity resolution rentre dans « profiling » au sens du RGPD (art. 4 pt 4). Sans consentement utilisateur, le hash matching + probabilistic linking pose risque légal. Consent Mode v2 (Google) sépare « analytics_storage » et « ad_storage » mais pour l'identity stitching tu pourrais avoir besoin d'une catégorie « personalization_storage ». TCF 2.2 impose Purpose 1 (device storage) + Purpose 9 (personalized ads) — sans les deux, même le hash matching est illégal.

L'email hashé compte comme « pseudonymous data » en RGPD (Considérant 26) — c'est toujours une donnée personnelle. Si quelqu'un peut inverser le hash ou faire une reverse lookup, ce n'est pas « anonymization » mais « pseudonymization ». Ajoute un salt (email + secret spécifique au site → SHA-256) et stocke le salt dans un HSM (Hardware Security Module) ou Secret Manager. Si l'utilisateur demande une restriction (RGPD art. 18), supprime-lui les edges du graph.

KVKK art. 7 : « Le consentement explicite est le consentement librement donné, spécifique, éclairé et sans ambiguïté quant au traitement des données à caractère personnel. » Identity stitching doit être décrit *explicitement* dans la notice de consentement — « meilleure expérience » est trop vague. Si l'utilisateur retire son consentement, supprime tous les edges pour ce `user_id` du graph et mark-le `deleted_at`. En BigQuery, soft delete suffit — filtre avec `WHERE deleted_at IS NULL` plutôt que vrai suppression.

## Application: Pipeline Identity Incrémental avec dbt

En production, identity resolution ne s'exécute pas une fois mais incrementalement — chaque jour ajoute de nouveaux signaux, update le graph. Utilise un modèle dbt incremental :

```sql
{{
  config(
    materialized='incremental',
    unique_key='edge_id',
    partition_by={'field': 'created_date', 'data_type': 'date'},
    cluster_by=['signal_a_type', 'signal_b_type']
  )
}}

WITH new_edges AS (
  SELECT
    GENERATE_UUID() AS edge_id,
    a.signal_id AS signal_a,
    a.signal_type AS signal_a_type,
    b.signal_id AS signal_b,
    b.signal_type AS signal_b_type,
    0.95 AS match_score,
    CURRENT_DATE() AS created_date
  FROM {{ ref('stg_hashed_emails') }} a
  JOIN {{ ref('stg_device_ids') }} b
    ON a.hashed_email = b.hashed_email
  WHERE a.created_at >= CURRENT_DATE() - 1
)

SELECT * FROM new_edges

{% if is_incremental() %}
WHERE edge_id NOT IN (SELECT edge_id FROM {{ this }})
{% endif %}
```

Le modèle ajoute chaque run les nouveaux appairages email-device du dernier jour. `unique_key` prévient les doublons, `partition_by` laisse les partitions anciennes intactes. Clustérise par `signal_type` car les requêtes filtrent souvent « tous les email→cookie ». Ajoute des tests dbt : si des edges avec `match_score < 0.70` apparaissent, le test échoue et le déploiement s'arrête.

Un pipeline identity sans data quality test est dangereux — une fusion erronée fausse LTV, attribution, segmentation. Le travail de Roibase sur [First-Party Data & Architecture de Mesure](https://www.roibase.com.tr/fr/firstparty) intègre ce pipeline avec consent layer, server-side GTM et CDP.

Ensuite, il faut passer le graph identité en aval : segment builder, moteur de recommandation, prédiction LTV, MMM — tous tirent metrics agrégées via `canonical_user_id`. Quand le graph fonctionne bien, tu réduisais 6 signaux à 1 utilisateur : la précision LTV gagne 30–40 %, la fenêtre d'attribution s