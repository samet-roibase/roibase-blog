---
title: "Résolution d'identités : De 6 signaux vers un profil client unique"
description: "Associer les hash, la liaison probabiliste et l'identité foyer pour consolider les signaux fragmentés et connecter les données marketing à votre mécanisme décisionnel."
publishedAt: 2026-08-04
modifiedAt: 2026-08-04
category: data
i18nKey: data-003-2026-08
tags: [resolution-identite, hash-matching, liaison-probabiliste, cdp, donnees-first-party]
readingTime: 9
author: Roibase
---

Un utilisateur navigue anonymement sur le web, se connecte sur une application mobile, s'inscrit à votre newsletter avec une autre adresse e-mail, paie en magasin avec sa carte bancaire. Chaque point de contact génère un signal distinct — mais pour optimiser votre budget marketing, vous devez fusionner ces données dans un profil client unique. En 2026, avec la disparition des cookies et la multiplication des appareils, les taux de consentement oscillant entre 40 et 60 %, la résolution d'identités n'est plus une option mais le fondement même de votre architecture de mesure.

## Hash Matching : transformer l'e-mail et le numéro de téléphone en graphe de données

Le hash matching est la méthode par laquelle vous convertissez les données personnelles des utilisateurs (PII : e-mail, téléphone) en utilisant SHA-256, puis vous les envoyez aux graphes des plateformes (Google PAIR, Meta Advanced Matching, LiveRamp). Les données brutes de PII ne descendent jamais jusqu'au navigateur — elles sont hachées côté serveur dans votre conteneur GTM ou CDP, puis transmises au Measurement Protocol.

Flux pratique : un utilisateur saisit `jane.doe@example.com` lors du paiement. Dans votre conteneur côté serveur, JavaScript génère le hash `sha256('jane.doe@example.com')` → `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` et l'ajoute au paramètre `user_id` de Google Analytics 4. Google compare ce hash à son propre graphe d'identités — si l'utilisateur s'est précédemment connecté à Google Ads, il y a correspondance et la chaîne d'attribution multi-appareils s'active.

SHA-256 est unidirectionnel, mais sans salt supplémentaire, il peut être craqué via une table arc-en-ciel. En production, utilisez `sha256(email + pepper)` (pepper : clé secrète globale stockée dans vos variables d'environnement). Chez Meta Advanced Matching, la combinaison hash + code pays augmente le taux de correspondance de 12 à 18 % (benchmark Meta 2025). La limite du hash matching est le consentement — sous le RGPD, vous ne pouvez pas envoyer un hash si l'utilisateur n'a pas coché la case « j'accepte ».

### Exemple de pipeline BigQuery pour hash matching

```sql
-- modèle dbt : hash_user_pii.sql
WITH raw_signups AS (
  SELECT
    user_id,
    LOWER(TRIM(email)) AS email_normalized,
    REGEXP_REPLACE(phone, r'[^\d]', '') AS phone_normalized,
    created_at
  FROM {{ ref('raw_user_signups') }}
)
SELECT
  user_id,
  TO_HEX(SHA256(CONCAT(email_normalized, '{{env_var("HASH_PEPPER")}}'))) AS email_hash,
  TO_HEX(SHA256(CONCAT(phone_normalized, '{{env_var("HASH_PEPPER")}}'))) AS phone_hash,
  created_at
FROM raw_signups
WHERE email_normalized IS NOT NULL
  AND LENGTH(phone_normalized) >= 10
```

Ce modèle est paramétrisé dans dbt, le pepper est stocké dans vos variables d'environnement, et en aval il s'intègre aux événements sGTM via l'objet `user_data`. Sans le salt, le hash PII reste réversible — en production, le pepper est obligatoire.

## Liaison probabiliste : empreinte digitale et graphe comportemental

Quand la correspondance déterministe (e-mail/téléphone) n'existe pas, la liaison probabiliste entre en jeu. Vous regroupez les utilisateurs selon leur empreinte de navigateur (User-Agent, adresse IP, résolution d'écran, fuseau horaire), leur séquence d'événements et la durée de session. Si le score de confiance descend sous 60 %, cessez la liaison — un faux positif impacte directement votre budget marketing.

Scénario type : deux appareils différents (iPhone Safari, MacBook Chrome) accèdent à votre site e-commerce depuis la même adresse IP avec 30 minutes d'intervalle, consultent la même catégorie de produits, abandonnent le panier. Le moteur probabiliste étiquette ces deux sessions comme « même utilisateur, même foyer » avec 78 % de confiance. Si l'utilisateur revient sur iPhone pour finaliser l'achat, la confiance monte à 95 % et les identités se fusionnent dans le graphe.

Des solutions comme LiveRamp IdentityLink ou The Trade Desk Unified ID 2.0 emploient un modèle hybride probabiliste + déterministe. Le framework UID2 combine le hash e-mail avec les signaux du bidstream (spécification UID2 2025). Si vous construisez votre propre pipeline, explorez les algorithmes DBScan ou le clustering hiérarchique — mais en production, l'interprétabilité prime : préférez le scoring basé sur des règles aux modèles ML boîte noire.

| Type de signal | Confiance de correspondance | Risque vie privée | Cas d'usage |
|---|---|---|---|
| Hash e-mail (SHA-256 + pepper) | 92-98 % | Faible (consentement requis) | GA4 multi-appareils, Meta CAPI |
| Hash téléphone (SHA-256 + pepper) | 88-94 % | Moyen (consentement explicite RGPD) | Sync CRM → plateformes d'annonces |
| IP + User-Agent | 55-70 % | Élevé (empreinte numérique) | Détection fraude, filtrage bot |
| Séquence comportementale (pattern d'événements) | 60-80 % | Faible (anonymisée) | Stitching de sessions, analyse de parcours |

Si vous implémentez la liaison probabiliste au niveau [CDP & Retention Engineering](https://www.roibase.com.tr/fr/retention-engineering-cdp), vous maintenez un graphe d'identités anonymisé dans votre data lake — la conformité RGPD en devient plus simple.

## Identité de foyer : une identité basée sur la localisation, non sur l'appareil

Regrouper tous les appareils d'un foyer (Smart TV, tablette, téléphone, ordinateur portable) sous un seul household ID est essentiel, particulièrement pour le FMCG, les télécoms et la finance. Vous ne ciblez plus un utilisateur individuel mais une unité « ménage » avec capacité d'achat.

Le protocole PAIR de Google (Publisher Advertiser Identity Reconciliation) supporte le household graph — les appareils connectés au même réseau Wi-Fi (correspondance IP + localisation + fuseau horaire) sont agrégés et convertis en signaux publicitaires. Cependant, PAIR est basée sur le consentement : sans « ad_storage=granted » dans Consent Mode v2, aucun household ID n'est créé.

Exemple concret : une famille est abonnée à Netflix, la mère et le père regardent sur des profils distincts, l'enfant regarde des dessins animés sur le téléviseur. La plateforme OTT (Roku, Samsung Ads) assigne un household ID unique à ces trois profils et gère la fréquence des annonces au niveau du foyer, non de l'appareil. La même annonce de 30 secondes n'apparaît au maximum que 5 fois par semaine au foyer — même si cela représente 15 impressions par appareil.

### Exemple de pipeline avec règles pour l'identité de foyer

```sql
-- modèle dbt : household_identity_graph.sql
WITH device_sessions AS (
  SELECT
    device_id,
    ip_address,
    timezone,
    CAST(TIMESTAMP_TRUNC(session_start, HOUR) AS STRING) AS session_hour,
    user_agent
  FROM {{ ref('raw_sessions') }}
  WHERE session_start >= CURRENT_DATE() - 7
),
household_candidates AS (
  SELECT
    ip_address,
    timezone,
    session_hour,
    ARRAY_AGG(DISTINCT device_id) AS devices
  FROM device_sessions
  GROUP BY ip_address, timezone, session_hour
  HAVING COUNT(DISTINCT device_id) > 1
)
SELECT
  FARM_FINGERPRINT(CONCAT(ip_address, timezone)) AS household_id,
  devices,
  ARRAY_LENGTH(devices) AS device_count
FROM household_candidates
```

Ce modèle agrège les appareils issus de la même combinaison IP + fuseau horaire dans une fenêtre d'une heure. En production, préférez une fenêtre de 4 heures (augmente la probabilité que les appareils du foyer soient actifs simultanément). Filtrez les household avec plus de 10 appareils pour éviter les risques de fraude.

## Synchronisation du graphe d'identités : du data lake aux plateformes publicitaires

Votre graphe d'identités issu du hash matching et de la liaison probabiliste réside dans BigQuery, mais Google Ads, Meta et Klaviyo utilisent leurs propres systèmes d'identité. Sans couche de synchronisation, la résolution d'identités reste une donnée morte.

Flux d'orchestration : chaque nuit à 02:00, un DAG Airflow récupère dans BigQuery les enregistrements mis à jour depuis 7 jours de votre table `identity_graph`, envoie les hash e-mail à l'API Google Ads Customer Match, et les hash téléphone à l'API Meta Conversions. La gestion des limites API est obligatoire — Google Customer Match accepte 500 000 lignes par jour, Meta CAPI 1 million d'événements (standard tier 2025).

Pour Google Ads Customer Match, vous avez besoin d'au moins 1 000 utilisateurs correspondants (seuil d'audience). Quand vous uploadez les hash e-mail, Google les compare à son propre graphe ; le taux de correspondance tourne entre 40 et 70 % (selon la qualité de vos données e-mail). Les hash sans correspondance ne sont pas intégrés — c'est pourquoi vous devez garantir la qualité des données en amont, au niveau de [First-Party Data & Architecture de Mesure](https://www.roibase.com.tr/fr/firstparty).

Avec Meta Conversions API, vous pouvez ajouter au hash matching les paramètres `fbc` (Facebook Click ID) et `fbp` (Facebook Browser ID). Si l'utilisateur a cliqué sur une annonce Meta avant de visiter votre site, le paramètre `fbc` figure dans l'URL (`fbclid=`) — capturez-le côté serveur et intégrez-le à votre événement CAPI. La fenêtre d'attribution double à 28 jours, le taux de correspondance grimpe de 18 à 25 % (benchmark interne Meta 2025).

## Confidentialité + conformité : les limites de la résolution d'identités

Si vous n'alignez pas votre résolution d'identités sur le RGPD, la CNIL et les lois locales, votre pipeline de données porte un risque juridique. Règle fondamentale : vous ne pouvez pas hacher un PII sans consentement explicite de l'utilisateur (RGPD article 6). L'intégration avec une plateforme de gestion du consentement (OneTrust, Cookiebot) est impérative.

En Consent Mode v2, si l'utilisateur refuse « ad_storage », Google vous interdit d'envoyer des PII et même d'en produire des hash. Dans votre conteneur GTM côté serveur, écoutez l'événement `consent`, ne déclenchez la fonction `sha256()` que si le consentement est accordé. La même règle s'applique à Meta CAPI — basculez le paramètre `data_processing_options` en mode « LDU » (Limited Data Use).

Sous le CCPA, si un signal « Do Not Sell » arrive, supprimez l'utilisateur de votre graphe d'identités et effacez son PII hashé des APIs plateformes. Google Customer Match et Meta Custom Audiences disposent d'API de suppression — ils retirent le hash de leurs systèmes dans les 48 heures (SLA conformité CCPA). Maintenez une table `user_deletion_requests` dans BigQuery, nettoyez votre graphe d'identités chaque nuit en fonction de cette table.

## Traçabilité : déboguer votre résolution d'identités

Une fois votre graphe d'identités en production, la question la plus fréquente devient « pourquoi ces deux appareils n'ont-ils pas fusionné ? ». Sans tableau de monitoring, vous ne pouvez pas répondre.

Créez une table `identity_resolution_log` dans BigQuery pour enregistrer les métadonnées de chaque opération de fusion : quels signaux ont été utilisés (email_hash, phone_hash, ip_fingerprint), quel score de confiance, date de fusion, plateforme aval synchronisée. Validez la qualité des données avec des tests dbt — si un `household_id` contient plus de 50 appareils, déclenchez une alerte (trafic bot ou serveur proxy).

Dans Google Analytics 4, ouvrez le rapport User-ID et surveillez le nombre d'utilisateurs multi-appareils. Si votre pipeline de résolution d'identités fonctionne, la métrique « utilisateurs (multi-appareils) » doit être 15 à 30 % inférieure à « total utilisateurs » (le nombre réel d'utilisateurs est inférieur au volume d'appareils). Si cette écart ne se réduit pas, il y a une fuite de données au niveau du hash matching ou de la liaison probabiliste — vérifiez vos événements de consentement et votre pepper de hash.

---

Concevez la résolution d'identités non comme un projet ponctuel mais comme un pipeline de données à optimiser en continu. Fusionnez les signaux fragmentés via la combinaison hash matching + liaison probabiliste + identité de foyer, mais intégrez les règles de conformité dès la conception — sinon votre data lake deviendra un réservoir de risques juridiques. Premier pas : créez la table `identity_graph` dans BigQuery, construisez votre pipeline de hash avec dbt, synchronisez avec Google Ads Customer Match via Airflow. Deuxième étape : baissez votre seuil de confiance à 70 %, mesurez le taux de faux positifs, puis élargissez à Meta et Klaviyo. Sans résolution d'identités, 22 à 35 % de votre budget marketing se perd en mauvaise attribution (Forrester 2025) — démarrez votre graphe maintenant.