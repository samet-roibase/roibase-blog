---
title: "Identity Resolution : Des 6 Signaux à l'Identité Client Unifiée"
description: "Hash matching, probabilistic linking et household identity : architectures modernes transformant des signaux fragmentés en une identité client unique."
publishedAt: 2026-05-12
modifiedAt: 2026-05-12
category: data
i18nKey: data-003-2026-05
tags: [identity-resolution, hash-matching, probabilistic-linking, cdp, first-party-data]
readingTime: 9
author: Roibase
---

Le client e-commerce moyen vous expose à travers 6 appareils différents et 11 touchpoints avant de décider d'acheter. GA4 les enregistre comme 4 users distincts, votre CRM les classe en 2 leads différents, votre plateforme e-mail les voit comme 1 subscriber unique. Dans un monde post-cookie, fusionner ces fragments est indispensable — sans cela, l'attribution est impossible, la segmentation n'a aucun sens, le calcul de la valeur vie client devient aléatoire. L'identity resolution est la discipline d'engineering data qui unifie ces fragments — elle requiert une architecture à 3 couches allant du hash matching déterministe au probabilistic linking.

## Hash Matching : L'Épine Dorsale Déterministe

L'appariement déterministe fonctionne sur SHA-256. L'adresse e-mail « user@example.com » → hash « 5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8 » → même hash dans chaque système = même personne. Dès que l'utilisateur se connecte, vous ajoutez le paramètre `user_data.email_sha256` au payload d'événement du GTM côté serveur ; dans BigQuery, cette fusion de hash permet de réconcilier web session + CRM lead + Klaviyo subscriber en une seule ligne.

Deux points critiques : la stratégie de salt et le risque de collision. Sans salt, vous vous exposez à une rainbow table attack, mais dans une pipeline marketing data, le salt doit être cohérent entre tous les systèmes — sinon, le même e-mail génère des hash différents. Le risque de collision avec SHA-256 est théorique — aucune collision pratique dans l'espace 2^256 — mais pour les champs de faible entropie comme les numéros de téléphone, le déterminisme s'affaiblit. C'est pourquoi une combinaison e-mail + téléphone crée une épine dorsale plus robuste.

Quand vous extrayez des données de Klaviyo vers BigQuery, vous ajoutez la colonne `user_properties.email_sha256` ; dans votre modèle dbt, vous exécutez `LEFT JOIN web_events USING (email_sha256)`. De cette façon, une session web anonyme fusionne avec le profil du subscriber en une seule ligne. Une stratégie de snapshot est importante — les appariements par hash doivent être conservés dans des snapshots quotidiens, car si un utilisateur change d'e-mail, les anciennes correspondances ne doivent pas disparaître.

## Probabilistic Linking : Combiner les Signaux par Logique Floue

L'appariement déterministe s'avère insuffisant sur le web mobile sans cookie. L'utilisateur quitte votre site sans se connecter, ne fournit pas son e-mail, mais la combinaison IP + user agent + timezone + langue indique une probabilité de 87 % qu'il s'agisse de la même personne. Voici où intervient le graphe d'identité probabiliste — une pondération de signaux par probabilité bayésienne.

Six couches de signaux fondamentales existent : device fingerprint (canvas hash, WebGL renderer), couche réseau (subnet IP, ASN), pattern comportemental (durée de session, séquence de pages), géolocalisation (clustering lat/long GPS), signal temporel (pattern d'heures actives) et métadonnées contextuelles (domaine referrer, cohérence UTM). Chaque signal reçoit un score de confiance 0-100 ; si la somme pondérée dépasse 70, un `probabilistic_id` temporaire est attribué.

Vous modélisez cela dans BigQuery comme suit :

```sql
WITH signal_scores AS (
  SELECT
    session_id,
    device_fingerprint,
    ip_subnet,
    SUM(
      CASE WHEN device_fingerprint_match THEN 40 ELSE 0 END +
      CASE WHEN ip_subnet_match AND hour_diff < 4 THEN 25 ELSE 0 END +
      CASE WHEN behavior_vector_similarity > 0.8 THEN 20 ELSE 0 END
    ) AS total_confidence
  FROM event_stream
  WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
)
SELECT session_id, device_fingerprint, total_confidence,
  CASE WHEN total_confidence >= 70 
    THEN GENERATE_UUID() 
    ELSE NULL 
  END AS probabilistic_id
FROM signal_scores
```

Le compromis de cette approche : le risque de faux positif. Un appareil partagé (ordinateur de bureau au bureau) ou une utilisation de VPN peut fusionner deux personnes différentes. C'est pourquoi les ID probabilistes doivent toujours être validés par hash déterministe — au moment de la connexion, une opération de « merge » sur hash corrige les sessions probabilistes antérieures.

## Household Identity : Du Cluster d'Appareils à l'Unité Domestique

L'unité décisionnelle n'est généralement pas l'individu, mais le ménage. Trois appareils partagent la même IP : MacBook (utilisé par la femme le matin), iPhone (toute la journée), iPad (enfant le soir). Les fusionner en un seul « individual » serait une erreur, mais les regrouper en une « household » est critique pour la segmentation — notamment dans les biens durables (électroménager, mobilier) où la décision d'achat se prend au niveau famille.

Le graphe household se construit sur l'adresse MAC du routeur/modem + sous-réseau IP + localisation GPS. Le fingerprint réseau (non device) est la base, car le routeur WiFi génère la même MAC de passerelle pour tous les appareils. L'attention doit se porter sur le filtrage du WiFi public — si vous regroupez 200 appareils d'une même IP Starbucks en « household », votre modèle s'effondre. Vous filtrez cela par seuil de comptage de sessions (>50 appareils uniques par IP = blacklist) et pattern de temps de résidence (aucune session >2h d'une même IP = café/détaillant).

Vous attribuez le household ID dans BigQuery comme suit :

```sql
CREATE OR REPLACE TABLE households AS
WITH network_clusters AS (
  SELECT ip_subnet, router_mac, GPS_lat, GPS_long,
    APPROX_COUNT_DISTINCT(device_id) AS device_count,
    AVG(session_duration_sec) AS avg_session
  FROM sessions
  WHERE DATE(timestamp) > DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  GROUP BY 1,2,3,4
  HAVING device_count BETWEEN 1 AND 8 AND avg_session > 120
)
SELECT *, GENERATE_UUID() AS household_id
FROM network_clusters
```

Au niveau ménage, le calcul de lifetime value a plus de sens — l'achat d'électroménager n'est pas fait par une seule personne, mais pour le foyer entier. Dans une architecture [CDP & Retention Engineering](https://www.roibase.com.tr/fr/retention-engineering-cdp), les segments au niveau ménage génèrent 23 % de ROAS supplémentaire par rapport aux segments individuels — parce que cibler une unité domestique stratégique plutôt que d'envoyer des messages à un numéro de téléphone différent pour chaque appareil transforme le ciblage en une tactique cohérente.

## Graph Stitching : Fusion d'Identités Échelonnée dans le Temps

Le graphe d'identité n'est pas statique — l'utilisateur est anonyme aujourd'hui, fournit son e-mail demain, se connecte dans 5 jours, met à jour son numéro de téléphone dans 2 mois. À chaque nouveau signal, les anciens fragments sont « cousus » ensemble — c'est-à-dire que les vieux ID probabilistes sont fusionnés au nouvel hash déterministe.

Vous résolvez cela en architecture event-driven : chaque événement `user_identified` est envoyé à Pub/Sub, une Cloud Function est déclenchée, une instruction `MERGE` s'exécute dans BigQuery. Par exemple, l'utilisateur se connecte → e-mail hash arrive → tous les ID probabilistes créés avec le même device fingerprint au cours des 90 derniers jours sont liés à ce hash. Cette opération de backfill doit remonter aussi loin que votre fenêtre d'attribution — si votre conversion window est de 30 jours, vous devez faire du stitching 30 jours en arrière.

```sql
MERGE INTO unified_identity AS target
USING (
  SELECT probabilistic_id, email_sha256, MAX(timestamp) AS last_seen
  FROM identification_events
  WHERE event_name = 'user_login'
  GROUP BY 1,2
) AS source
ON target.probabilistic_id = source.probabilistic_id
WHEN MATCHED THEN UPDATE SET 
  target.email_sha256 = source.email_sha256,
  target.is_deterministic = TRUE,
  target.stitched_at = CURRENT_TIMESTAMP()
```

Le stitching porte un risque de race condition — si l'utilisateur se connecte simultanément depuis 2 appareils, deux tentatives de fusion de hash peuvent entrer en conflit. Vous résolvez cela par verrous transactionnels ou clés idempotence. La clé d'idempotence est généralement `device_id + timestamp_truncated_to_second` — deux événements `user_login` du même appareil dans la même seconde ne déclenchent qu'une seule fusion.

## Privacy + Conformité : PII Hashé et Minimalisme des Données

L'identity resolution entre dans les catégories « prise de décision automatisée » et « profiling » selon la RGPD et la KVKK — ce qui signifie que sans consentement explicite, c'est interdit. Si le signal `analytics_storage=granted` ne provient pas de votre Platform de Gestion du Consentement (OneTrust, Cookiebot), vous ne pouvez pas capturer de hash. En Consent Mode v2, avec un consentement basique, le paramètre `user_data` reste vide ; après consentement amélioré, le hash est ajouté.

Le hash n'est pas une PII, mais une pseudo-anonymisation — donc selon la RGPD, le « droit à l'oubli » s'applique aussi aux hash. Quand une demande de suppression arrive, vous exécutez une instruction `DELETE` sur `email_sha256` dans BigQuery, et cette suppression doit être propagée aux systèmes en aval (CDP, CRM). C'est pourquoi la table de mapping de hash doit être centralisée — plutôt que d'avoir des hash éparpillés dans des systèmes distribués, ils doivent tous dériver d'une seule source de vérité.

Le principe de minimalisme des données doit limiter votre graphe d'identité à 90 jours. Les ID probabilistes plus anciens que 90 jours doivent être archivés ; seuls les hash déterministes doivent être conservés à long terme. C'est critique à la fois pour la conformité et les coûts de stockage — si vous appliquez un window roulant de 90 jours avec partition pruning dans BigQuery, les coûts de requête chutent de 60 %.

## Architecture Pipeline Produit : Hybride Batch + Streaming

Votre pipeline d'identity resolution fonctionne sur deux couches : couche streaming (collecte de signaux en temps réel) et couche batch (stitching nocturne). La couche streaming utilise Pub/Sub → Dataflow → BigQuery write avec streaming insert, latence <10 secondes. La couche batch est déclenchée par une exécution dbt programmée à 04h00 chaque matin ; tout le stitching de graphe et le clustering household se font dans cette couche.

À la couche streaming, seuls les signaux sont collectés — le hash matching et le probabilistic scoring ne s'y font pas, car les JOIN complexes coûtent cher en streaming. Les événements sont écrits dans Firestore avec une contrainte unique `event_id` pour éviter les écritures dupliquées. La couche batch lit ces événements et les transforme en modèle dimensionnel dans BigQuery. Les macros dbt chaînent la génération de hash, le calcul de scores et la fusion de graphe en un seul pipeline.

Pour le monitoring, la métrique de couverture de graphe est critique : `identified_users / total_active_users`. Moins de 40 % indique un déficit de signaux déterministes — votre flux de connexion doit être optimisé, les formulaires de leads doivent se concentrer sur la capture d'e-mail. Au-dessus de 75 %, la couverture est saine. Cette métrique est définie comme test dbt dans le fichier `data_tests/identity_coverage.sql` et exécutée avant chaque déploiement en CI/CD.

L'identity resolution est l'épine dorsale du stack marketing moderne. Le monde post-cookie a fait du hash déterministe l'étalon-or, mais seul, il est insuffisant — vous devez construire un graphe d'identité à 3 couches avec probabilistic linking et household clustering. Quand ce pipeline, modélisé dans BigQuery avec dbt, est respectueux des consentements et conforme à la vie privée, vous pouvez basculer vos modèles d'attribution, vos stratégies de segmentation et vos estimations de lifetime value sur une vue unique et fiable du client.