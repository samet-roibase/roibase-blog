---
title: "Résolution d'identité : De 6 signaux à une identité client unique"
description: "Hash matching, liaison probabiliste et identité foyer pour unifier les signaux clients fragmentés en une seule identité. Ingénierie BigQuery + CDP en pratique."
publishedAt: 2026-06-16
modifiedAt: 2026-06-16
category: data
i18nKey: data-003-2026-06
tags: [resolution-identite, plateforme-donnees-client, hash-matching, liaison-probabiliste, donnees-first-party]
readingTime: 8
author: Roibase
---

La durée de vie des cookies est passée de 28 jours en moyenne à 7 jours. Un utilisateur démarre sur une application mobile, complète son achat sur le web desktop, revient depuis une campagne e-mail — chaque point de contact génère un identifiant différent. 40% des données marketing restent orphelines : pas d'identifiant utilisateur, pas d'ID session, pas d'attribution de conversion. La résolution d'identité est l'opération qui consolide ces fragments avec discipline d'ingénierie. Hash matching plutôt que supposition, graphe probabiliste plutôt que raisonnement, regroupement par foyer plutôt qu'hypothèse.

## Matching déterministe : unification basée sur le hash

Le matching déterministe fonctionne quand tu **sais avec certitude** que deux points de données partagent le même identifiant. Hash SHA-256 d'e-mail, hash de numéro de téléphone, ID CRM. Si ta table d'événements BigQuery contient `user_id` mais que Google Analytics contient `ga_client_id`, tu ne peux pas les joindre directement — tu dois d'abord trouver un événement où les deux sont écrits, puis construire une table de mapping.

```sql
-- Exemple de stitching d'identité déterministe
CREATE OR REPLACE TABLE `project.dataset.identity_graph` AS
WITH email_hashes AS (
  SELECT DISTINCT
    user_pseudo_id,
    TO_HEX(SHA256(LOWER(TRIM(user_properties.email.value)))) AS email_hash
  FROM `project.dataset.events_*`
  WHERE user_properties.email.value IS NOT NULL
),
crm_map AS (
  SELECT
    crm_id,
    TO_HEX(SHA256(LOWER(TRIM(email)))) AS email_hash
  FROM `project.crm.customers`
)
SELECT
  e.user_pseudo_id,
  c.crm_id,
  e.email_hash
FROM email_hashes e
INNER JOIN crm_map c
  ON e.email_hash = c.email_hash;
```

Cette requête relie le `user_pseudo_id` de Firebase Analytics à l'ID CRM via un **matching exact** sur le hash d'e-mail. Le hash de l'e-mail sert d'identifiant d'ancrage. Point crucial : `LOWER(TRIM())` — si l'utilisateur saisit "Ali@X.com" mais que le CRM le stocke sous "ali@x.com", le matching par hash échoue. La normalisation est la première étape du pipeline.

Le matching déterministe atteint une précision de 100% mais un recall faible — il ne trouve que les enregistrements qui existent dans les deux systèmes avec le même identifiant. Un utilisateur qui a quitté le web sans fournir d'e-mail n'apparaît pas dans ce graphe.

### Collision de hash et confidentialité

La probabilité de collision SHA-256 est théoriquement 2^-256 — zéro en pratique. Cependant, le RGPD Article 32 ne considère pas le hash comme une pseudonymisation en soi ; le hash seul n'est pas une anonymisation. Un hash d'e-mail + IP + timestamp peut permettre une ré-identification de l'utilisateur. C'est pourquoi les tables de hash doivent être protégées par le chiffrement au repos et le contrôle d'accès au niveau des colonnes.

## Liaison probabiliste : matching par graphe basé sur la similarité

Quand le join déterministe échoue, la liaison probabiliste intervient. Tu fais correspondre deux enregistrements avec des identifiants différents en exploitant des **signaux faibles** : similarité comportementale, empreinte digitale de l'appareil, combinaison timezone + user-agent. Pas besoin d'un modèle d'apprentissage automatique — un système de scoring pondéré + seuil suffit.

| Signal | Poids | Exemple |
|--------|-------|---------|
| Même IP (dans 24h) | 0,3 | 192.168.1.10 |
| Même User-Agent | 0,2 | Chrome 120 / Mac |
| Même localisation géographique | 0,15 | Istanbul, Kadıköy |
| Même clic de campagne | 0,25 | utm_campaign=vente_printemps |
| Même séquence de visualisation produit | 0,1 | product_123 → product_456 |

Si le score total ≥ 0,7, les deux sessions appartiennent **probablement** à la même personne. Ce seuil s'ajuste en fonction du dataset — 0,65 peut suffire pour une boutique en ligne, mais 0,85 est nécessaire en fintech.

```sql
-- Exemple de scoring probabiliste
WITH sessions AS (
  SELECT
    session_id,
    user_pseudo_id,
    device.operating_system,
    device.web_info.browser,
    geo.city,
    traffic_source.medium,
    ARRAY_AGG(ecommerce.items.item_id ORDER BY event_timestamp) AS item_sequence
  FROM `project.dataset.events_*`
  WHERE event_name = 'page_view'
  GROUP BY 1,2,3,4,5,6
)
SELECT
  a.session_id AS session_a,
  b.session_id AS session_b,
  (CASE WHEN a.operating_system = b.operating_system THEN 0.2 ELSE 0 END +
   CASE WHEN a.browser = b.browser THEN 0.2 ELSE 0 END +
   CASE WHEN a.city = b.city THEN 0.15 ELSE 0 END +
   CASE WHEN a.medium = b.medium THEN 0.25 ELSE 0 END +
   CASE WHEN a.item_sequence = b.item_sequence THEN 0.2 ELSE 0 END
  ) AS match_score
FROM sessions a
CROSS JOIN sessions b
WHERE a.session_id < b.session_id  -- optimisation de join croisé
  AND a.user_pseudo_id != b.user_pseudo_id
HAVING match_score >= 0.7;
```

Cette requête compare **toutes les paires de sessions** — complexité N². Avec 1M de sessions, c'est 500 milliards de comparaisons. En production, le partitionnement est nécessaire : fenêtre temporelle (7 jours), filtre géographique (même ville), type d'appareil (mobile-mobile).

La liaison probabiliste entraîne un taux de faux positifs de 5-15%. C'est pourquoi les ID dérivés de ce matching doivent être marqués avec un flag "duplicate potentiel" dans l'activation en aval (CDP segment push, campagne e-mail).

## Identité foyer : même appareil, utilisateurs différents

Une tablette ou un téléviseur intelligent est utilisé par plusieurs personnes. Le matching déterministe ou probabiliste fusionnerait les profils différents au sein d'une famille sous un seul ID — entraînant une personnalisation incorrecte. La résolution d'identité foyer tente de distinguer ces scénarios.

**Empreinte au niveau session :** Des utilisateurs qui se connectent à différentes heures sur le même appareil affichent des patterns de navigation différents. Un utilisateur cherchant des vêtements pour enfants à 08:00 du matin et un autre cherchant de l'électronique à 23:00 le soir peuvent être distingués.

**Regroupement comportemental :** Utilise K-means ou clustering hiérarchique pour grouper les sessions. Si les centroïdes des clusters diffèrent, tu crées deux "utilisateurs virtuels" distincts sous le même device_id.

```sql
-- Extraction de features pour clustering par foyer
CREATE OR REPLACE TABLE `project.dataset.household_features` AS
SELECT
  device_id,
  EXTRACT(HOUR FROM TIMESTAMP_MICROS(event_timestamp)) AS hour_of_day,
  COUNT(DISTINCT CASE WHEN event_name = 'purchase' THEN ecommerce.transaction_id END) AS purchase_count,
  APPROX_TOP_COUNT(ecommerce.items.item_category, 3) AS top_categories,
  AVG(ecommerce.purchase_revenue_in_usd) AS avg_basket_value
FROM `project.dataset.events_*`
WHERE device_id IS NOT NULL
GROUP BY device_id, hour_of_day;
```

Après le clustering, chaque device_id génère des ID virtuels comme `household_user_1`, `household_user_2`. Ces ID ne sont jamais synced vers le CRM — ils restent confinés à la couche analytics et de personnalisation.

La résolution d'identité foyer a une précision faible — une marge d'erreur de 30% est normale. Elle n'est donc pas utilisée en dehors de l'e-commerce (particulièrement pas en SaaS ou fintech).

## Structure du graphe d'identité et maintenance

Tous les résultats de matching convergent dans une seule table d'**identité graphe**. Cette table maintient pour chaque user_id tous les alias connus : hash d'e-mail, ID CRM, ga_client_id, ID Firebase, ID publicitaire.

| canonical_id | identifier_type | identifier_value | match_method | confidence | updated_at |
|--------------|-----------------|------------------|--------------|------------|------------|
| user_0001 | email_hash | a1b2c3... | deterministic | 1.0 | 2026-06-15 |
| user_0001 | ga_client_id | GA1.2.123 | deterministic | 1.0 | 2026-06-14 |
| user_0001 | firebase_id | xyz789 | probabilistic | 0.75 | 2026-06-16 |
| user_0002 | crm_id | CRM-456 | deterministic | 1.0 | 2026-06-10 |

Le graphe est mis à jour de façon incrémentale — chaque jour les nouveaux événements sont traités, les nouveaux matchs sont ajoutés. Les anciens liens s'affaiblissent par décroissance de confiance : un lien probabiliste datant de 90 jours voit sa confiance passer de 0,75 à 0,50.

Si tu modélises le graphe comme un **graphe acyclique orienté (DAG)**, tu peux détecter les boucles. Une boucle Utilisateur A → Utilisateur B → Utilisateur C → Utilisateur A signale une erreur — révision manuelle requise.

## Intégration CDP et pipeline d'activation

Le graphe d'identité ne s'utilise jamais isolé — il alimente la CDP. L'architecture de [CDP & Retention Engineering](https://www.roibase.com.tr/fr/retention-engineering-cdp) extrait le canonical_id du graphe, consolide tous les points de contact sous cet ID, l'envoie au moteur de segmentation.

Le processus d'activation fonctionne ainsi :

1. **Définition de segment :** "3+ sessions dans les 30 derniers jours, article ajouté au panier mais pas de conversion" → défini comme une vue BigQuery.
2. **Résolution d'identité :** La vue fait une recherche canonical_id pour chaque user_pseudo_id.
3. **Sync de canal :** Tous les hash d'e-mail sous canonical_id sont poussés vers Meta CAPI, les hash de téléphone vers Google Customer Match.
4. **Attribution :** Quand un événement de conversion arrive, canonical_id trace tous les points de contact via le graphe.

Sans CDP, la résolution d'identité reste incomplète — le graphe ne fait que maintenir "qui correspond à qui", il ne prend pas la décision "quelle action dois-je prendre avec cet utilisateur".

## Conformité à la vie privée et propagation du consentement

La résolution d'identité se justifie par l'article 6(1)(f) du RGPD, "intérêt légitime" — mais si l'utilisateur n'a pas donné son consentement explicite, tu ne peux pas utiliser les ID dérivés de ce graphe pour le remarketing. L'intégration avec une plateforme de gestion du consentement (CMP) est obligatoire.

Pour chaque canonical_id, l'état du consentement est maintenu : `{ analytics: true, marketing: false, personalization: true }`. Les identifiants dérivés du graphe héritent de ce flag — si User A dispose de marketing=false, le ga_client_id de l'utilisateur B qui a été lié à User A par correspondance probabiliste n'entre pas dans les segments marketing.

Sous TCF 2.2, la propagation du consentement par vendor devient plus complexe : si l'utilisateur a consenti pour Meta mais pas pour Google, le graphe exécute un sync sélectif. Cette architecture fait partie du processus de [Données First-Party & Architecture de Mesure](https://www.roibase.com.tr/fr/firstparty) — les signaux de consentement sont injectés au début du pipeline d'événements, les jobs de mise à jour du graphe les lisent.

---

La résolution d'identité n'est pas qu'une opération JOIN technique — c'est la couche critique qui branche les données marketing à un mécanisme de décision. Utiliser le hash matching pour des correspondances exactes, le scoring probabiliste pour les signaux faibles, le regroupement par foyer pour le partage d'appareil exige un détail d'ingénierie. Maintenir le graphe à jour, l'aligner avec la propagation du consentement, l'alimenter dans le pipeline d'activation CDP — c'est la discipline de production. À l'ère post-cookie, l'identité client n'est pas devinée — elle est construite à partir de six identifiants distincts fusionnés.