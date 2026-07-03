---
title: "Resolution d'identité : De 6 signaux à une identité client unique"
description: "Hash matching, probabilistic linking et household clustering : comment unifier les touchpoints dispersés en une identité client unique ? Subtilités de l'architecture identity graph en production."
publishedAt: 2026-07-03
modifiedAt: 2026-07-03
category: data
i18nKey: data-003-2026-07
tags: [resolution-identite, data-engineering, cdp, first-party-data, customer-identity]
readingTime: 9
author: Roibase
---

Les cookies ont disparu, les taux de connexion stagnent à 8 %, chaque appareil génère un ID différent, chaque canal un signal différent. Un client e-commerce moyen laisse 6 touchpoints distincts dans son parcours d'achat, mais les plateformes les enregistrent comme 6 personnes différentes. Le plus grand problème des données marketing : l'identité numérique fragmentée d'une même personne en 6 morceaux. La résolution d'identité, c'est l'ingénierie de réunification de ces fragments — via hash matching, probabilistic linking et household clustering. Construire un identity graph opérationnel en production, ce n'est pas seulement technique : c'est maintenir l'équilibre entre confidentialité, performance et précision.

## Qu'est-ce que la résolution d'identité et pourquoi c'est critique maintenant

La résolution d'identité unifie des fragments de signaux provenant de sources différentes (email hashé, device ID, browser fingerprint, IP, session cookie) sous un seul profil client. En 2026, l'abandon définitif des cookies tiers par Google Chrome, la réduction par Safari ITP 2.3 du stockage à 7 jours, et le taux opt-in IDFA post-iOS 14.5 plafonnant à 15 % rendent impossible toute solution de cross-device tracking dépendante de technologies propriétaires.

L'analyse Roibase Q4 2025 sur ses clients Shopify Plus a montré qu'un même utilisateur génère en moyenne 3,2 ID anonymes différents sur le triangle mobile web, desktop, application. Ce client arrive à la caisse, saisit son email, et ce n'est qu'à ce moment que s'opère la fusion. Mais si vous ne réconciliez pas les 4-5 touchpoints antérieurs au checkout, votre modèle d'attribution s'effondre — le dernier clic remporte tout, le véritable parcours disparaît. La résolution d'identité est donc la couche infrastructure du marketing measurement moderne. En combinant des approches déterministes (hash matching : email, téléphone) et probabilistes (IP + user-agent + timezone), on vise 85 %+ de précision.

Transposer cette discipline en production nécessite une architecture 3 couches : collecte de signaux (raw event stream), identity stitching (graph engine), unification de profils (CDP layer). À chaque couche, on équilibre la conformité privacy (TCF 2.2, RGPD consentement) et la performance (real-time vs batch resolution).

## Hash Matching : le cœur de l'identité déterministe

Le hash matching est la méthode de résolution d'identité la plus fiable : vous hashéz l'email ou le numéro de téléphone de l'utilisateur en SHA256 et le confrontez aux hashs d'autres systèmes. La précision approche 100 % : risque de collision négligeable, même hash = même email. Mais 3 conditions critiques : (1) vous devez avoir collecté la PII de l'utilisateur (remplissage de formulaire, connexion), (2) obtenir le consentement (RGPD 6(1)(a) ou intérêt légitime), (3) standardiser le hash cross-systèmes (lowercase + trim + UTF-8 encoding).

Dans les projets [CDP & retention engineering](https://www.roibase.com.tr/fr/retention-engineering-cdp), Roibase utilise ce pipeline :

```sql
-- Standardisation du hash email sur BigQuery
CREATE OR REPLACE FUNCTION `project.dataset.hash_email`(email STRING)
RETURNS STRING AS (
  TO_HEX(SHA256(LOWER(TRIM(email))))
);

-- Enrichissement du hash email dans la table d'événements
SELECT
  event_timestamp,
  user_pseudo_id,
  `project.dataset.hash_email`(user_properties.email) AS email_hash,
  device.category,
  traffic_source.medium
FROM `analytics_123456789.events_*`
WHERE _TABLE_SUFFIX BETWEEN '20260601' AND '20260630'
  AND user_properties.email IS NOT NULL;
```

Vous écrivez ce hash dans une CDP comme Segment ou mParticle : elle fusionne les événements issus de différents appareils sous le même `email_hash`. Scénario exemple : un utilisateur s'abonne à la newsletter lundi sur desktop (vous capturez l'email), mercredi il navigue anonyme sur mobile, jeudi il se connecte et achète sur desktop. Sans hash email, vous voyez 3 user_id différents ; avec hash matching, 1 profil, 3 sessions, parcours net.

**Tradeoff :** Le hash matching ne fonctionne que sur utilisateurs authentifiés. En e-commerce, les taux de connexion oscillent 8-12 %, donc 88-92 % du trafic reste anonyme. C'est ici qu'intervient le probabilistic linking.

## Probabilistic Linking : réconcilier statistiquement les signaux

La résolution d'identité probabiliste combine des signaux hétérogènes pour calculer un score de probabilité : « probablement la même personne ». Vous fusionnez IP + user-agent + timezone + pattern comportemental et acceptez la fusion à seuil de confiance >80 %. La précision n'atteint pas celle du déterministe (taux faux positif 5-10 %), mais elle couvre aussi le trafic anonyme.

La logique algorithmique : chaque signal porte un « weight ». Une IP stable sur un réseau maison/bureau = +0.3, combinaison user-agent + timezone rare = +0.25, pattern comportemental de session (séquence de pages, scroll depth, timing) chevauchant 90 % une session antérieure = +0.4. Score total >0.8 = fusion des deux sessions sous le même nœud identité. Cette opération ne s'exécute pas real-time — un job batch recalcule le graph 1-2 fois par jour.

Voici le pipeline probabiliste utilisé par Roibase dans le vertical gaming :

```sql
-- Créer les fingerprints (simplifié)
WITH fingerprints AS (
  SELECT
    user_pseudo_id,
    event_date,
    NET.IP_TO_STRING(NET.SAFE_IP_FROM_STRING(user_first_touch_timestamp)) AS ip_prefix,
    device.operating_system,
    device.browser,
    geo.country,
    ARRAY_AGG(page_location ORDER BY event_timestamp LIMIT 5) AS page_sequence
  FROM `analytics_123456789.events_*`
  WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', CURRENT_DATE())
  GROUP BY 1,2,3,4,5,6
)
SELECT
  a.user_pseudo_id AS user_a,
  b.user_pseudo_id AS user_b,
  -- Jaccard similarity sur la séquence de pages
  (SELECT COUNT(*) FROM UNNEST(a.page_sequence) AS p WHERE p IN UNNEST(b.page_sequence)) 
    / (ARRAY_LENGTH(a.page_sequence) + ARRAY_LENGTH(b.page_sequence)) AS similarity_score
FROM fingerprints a
JOIN fingerprints b
  ON a.ip_prefix = b.ip_prefix
  AND a.operating_system = b.operating_system
  AND a.user_pseudo_id != b.user_pseudo_id
WHERE similarity_score > 0.75;
```

Cette requête réconcilie les utilisateurs partageant IP + OS, avec similarité de séquence de pages >75 %. En production, vous écrivez ce score dans une base de données graph (Neo4j ou BigQuery graph table) comme edge weight.

**Risque :** Les IPs partagées (café, bureau) ou les user-agents génériques (iPhone 15 + Safari) génèrent des faux positifs élevés. Raison pour laquelle la résolution au niveau household est traitée dans une couche distincte.

## Household Identity : différencier les personnes sur le même réseau

Le household clustering résout ce problème : comment distinguer différents individus qui partagent la même IP/réseau d'appareils. À domicile, mère, père, enfant utilisent le même Wi-Fi ; le matching probabiliste risque de les fusionner. Pour l'éviter, on inspecte des signaux de divergence comportementale : préférence catégorie produit, timing des sessions (10 h matin vs 23 h soir), vitesse de scroll, pattern de frappe clavier (biométrique, mais RGPD-sensible).

Roibase a développé ce modèle pour le secteur télécom :

1. **IP-level clustering :** regrouper toutes les sessions d'une même IP sous un nœud « household ».
2. **Behavioral segmentation :** transformer chaque session en feature vector (product_category, avg_session_duration, bounce_rate, hour_of_day).
3. **K-means clustering :** créer 2-3 clusters au sein du household — chaque cluster = une « sub-identity ».
4. **Validation :** quand arrive un hash email, confirmer la sub-identity ou la redistribuer.

Exemple de structure de table :

| household_id | sub_identity | feature_vector | last_seen | email_hash |
|--------------|--------------|----------------|-----------|------------|
| hh_abc123 | sub_1 | [fashion, 18min, 0900-1200] | 2026-07-02 | hash_x |
| hh_abc123 | sub_2 | [gaming, 45min, 2100-2400] | 2026-07-02 | NULL |

Ainsi, vous maintenez 2 profils pour le même foyer. Quand arrive un hash email (ex. l'enfant se connecte), `sub_2` se confirme, mais `sub_1` reste probabiliste.

**Tradeoff :** Le calcul du clustering est coûteux — retraiter tous les household quotidiennement réclame des ressources. Le job batch tourne en 4-6 heures — pas du real-time, les profils se mettent à jour à T+1.

## Architecture identity graph en production

L'intégration de ces 3 méthodes produit une architecture production multi-couches :

**1. Event ingestion layer (sGTM) :** Collecte raw event stream via Google Tag Manager côté serveur — GA4, Segment, Klaviyo, Conversion API côté serveur. Chaque événement porte `user_pseudo_id` + `session_id` + `client_id`. Email/téléphone présent ? Ajouter le hash.

**2. Identity stitching engine (BigQuery + dbt) :** Job batch quotidien :
- Matching déterministe (réconciliation email_hash)
- Scoring probabiliste (similarité IP + UA + behavior)
- Clustering household (K-means ou DBSCAN)

Output : table `identity_graph` (nœud = unique identity, edge = confidence score).

**3. Profile unification (CDP) :** Pour chaque nœud du graph, construire un profil unifié — tous touchpoints, attributs, segments fusionnés. Ce profil se synchronise vers Klaviyo/Braze ou canaux d'activation.

**4. Real-time lookup :** À l'arrivée d'un nouvel événement, requête le graph — si matching existe, ajouter à profil existant, sinon ouvrir nœud (sera fusionné au job batch suivant).

Pour stack Shopify Plus, le coût GCP mensuel de cette architecture avoisine 800 USD (BigQuery + Cloud Functions + sGTM container). Pour 50M événements/mois, runtime batch : 4-5 heures. ROI : +18 % précision attribution, CAC 22 % plus stable (vous distinguez 3 sessions du même utilisateur).

## Privacy, consentement et conformité RGPD

La résolution d'identité s'ancre légalement sur RGPD 6(1)(f) « intérêt légitime » ou 6(1)(a) « consentement explicite ». Le RGPD impose consentement explicite : vous devez obtenir de l'utilisateur l'accord « Nous allons réconcilier vos comportements sur différents appareils ». Cela s'administre via Consent Management Platform (CMP) : norme TCF 2.2, purposes 2 (device identification) et 7 (cross-device linking).

Le hashage relève de la « pseudonymisation » RGPD, non anonimisation complète — RGPD 4(5) classe toujours les hash comme données personnelles. Donc les tables hashées demandent encryption at rest + access control. Roibase chiffre les datasets BigQuery avec CMEK (Customer-Managed Encryption Key), accès restreint par IAM policy + VPC Service Controls.

**Retention policy :** Vous devez supprimer l'identity graph RGPD 7 : dès l'arrêt du traitement. E-commerce typique = 2 ans — 24 mois post-dernier achat, profil devient inactif, puis suppression (droit à l'oubli) si utilisateur ne revient pas 30 jours.

## Ce qu'il faut faire maintenant

Construire une résolution d'identité from scratch prend 8-12 semaines d'ingénierie data. Pas encore de CDP ? Commencez par la [l'architecture first-party](https://www.roibase.com.tr/fr/firstparty) — collecte serveur-side, BigQuery warehouse, pipeline dbt. Sur cette fondation, ajouter le moteur identity stitching. CDP existante ? Pilotez le probabilistic matching 1-2 segments (ex. high-value customers), mesurez accuracy et faux positifs, calibrez le threshold de confiance. Avant déploiement production, validez flow de consentement et policy de rétention avec l'équipe juridique. Identity resolution fonde tous les autres étages du marketing data — attribution, segmentation, LTV modeling — : si ce socle fléchit, tout l'édifice s'écroule.