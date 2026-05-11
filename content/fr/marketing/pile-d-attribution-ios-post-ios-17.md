---
title: "La Stack d'Attribution iOS Après iOS 17"
description: "Avec ATT, SKAdNetwork 4 et les conversions modélisées, la mesure publicitaire sur iOS s'est reconstruit de zéro. Voici la stack qui fonctionne en 2026."
publishedAt: 2026-05-11
modifiedAt: 2026-05-11
category: marketing
i18nKey: marketing-003-2026-05
tags: [ios-attribution, skadnetwork, att, modeled-conversions, mobile-measurement]
readingTime: 9
author: Roibase
---

La fragmentation de l'attribution, commencée avec iOS 14, a atteint sa maturité en 2026. Les taux d'opt-in ATT sont restés bloqués sous 25 %, SKAdNetwork 4 pousse la valeur de conversion à 128 bits, et Meta et Google ont fait des conversions modélisées la norme par défaut. Le jeu a changé : l'attribution déterministe est morte, l'ère probabiliste + post-lookback a commencé. Sur iOS, quiconque investit en publicité doit construire la bonne stack, sinon le budget disparaît dans un trou noir.

## La Réalité Après ATT : Vivre Avec 25 % d'Opt-In

Le taux d'opt-in global moyen pour ATT sur la base d'utilisateurs iOS 17 s'est stabilisé entre 23 et 27 % (donnée Singular, Q1 2026). Cela signifie que 75 % des utilisateurs ne partagent pas d'IDFA. Les campagnes qui dépendent encore de l'attribution basée sur l'IDFA ne voient qu'une minorité de leurs utilisateurs — le reste est marqué comme « modélisé ».

Qu'est-ce que les conversions modélisées ? Meta et Google appliquent le machine learning aux utilisateurs qui ont refusé ATT, en régression des comportements utilisateur et en attribuant une probabilité de conversion. Cette approche est agrégée — par cohorte, non par personne. Le ROAS sort maintenant à 70-80 % du modélisé. Si tu optimises encore les campagnes sur du « ROAS déterministe », tu ignores la majorité de tes données.

La nouvelle réalité est simple : sur iOS, il n'y a déjà plus de précision à 100 %. Accepte-le et construis ta stack en conséquence. Les signaux déterministes, trop rares pour être décisifs, ne suffisent pas — comprendre comment les données modélisées sont générées, vérifier leur fiabilité et les valider par des tests d'incrémentalité devient obligatoire.

## SKAdNetwork 4 : Valeur de Conversion 128 Bits et Source ID Hiérarchique

SKAdNetwork 4 (par défaut iOS 16.1+, mature sur iOS 17) est la seule méthode d'attribution « officielle » qu'Apple propose. Le mécanisme de base : l'utilisateur clique sur une pub, l'app s'installe et s'ouvre pour la première fois, une valeur de conversion est enregistrée, puis après une fenêtre de postback de 24-72 heures, Apple envoie un signal agrégé. Aucun IDFA, aucun identifiant d'appareil.

Quoi de neuf ? La valeur de conversion passe à 128 bits — tu peux coder plus de détails. Exemple de stratégie d'encoding : les 6 premiers bits pour la source d'installation (Meta, Google, TikTok, organique), les 7 bits suivants pour le type d'événement (premier achat, tutoriel complété, niveau 3 débloqué), les 115 derniers bits pour le bucketing des revenus + segment de cohorte. C'est toi qui définis cet encoding, chaque app le configure selon ses besoins.

Le Source ID hiérarchique arrive aussi : au lieu d'un seul ID de campagne, tu utilises maintenant une hiérarchie à 4 niveaux (campagne → groupe d'annonces → créatif → mot-clé). C'est critique pour la modélisation multi-touch — avec l'ancien SKAdNetwork, on avait seulement du data au niveau campagne, maintenant on peut distinguer la performance au niveau créatif. Mais plus de détails = plus de bruit : à cause du seuil de confidentialité d'Apple, les segments à faible volume ne reçoivent pas de postback. Trade-off stratégique : être granulaire ou recevoir plus de postbacks ?

### Design de la Valeur de Conversion

| Plage de Bits | Utilisation | Exemple d'Encoding |
|---|---|---|
| 0-5 (6 bits) | Source d'installation | 0=organique, 1=Meta, 2=Google, 3=TikTok |
| 6-12 (7 bits) | Type d'événement | 0=install, 1=inscription, 2=premier_achat, 3=retention_D7 |
| 13-127 (115 bits) | Bucket de revenu + segment | Prédiction LTV + géo + tier d'appareil |

Cet encoding est intégré au SDK par les MMP (Adjust, AppsFlyer). Mais la logique d'encoding, c'est toi qui la définis — l'encoding par défaut des MMP est trop basique.

## Conversions Modélisées : Comment les Enrichir Avec Meta CAPI et Google Enhanced

La qualité des conversions modélisées est directement proportionnelle à la quantité de signaux first-party envoyés à la plateforme. Ici interviennent Meta CAPI (Conversions API) et Google Enhanced Conversions. Sans IDFA sur iOS, les données du côté serveur — email hash, phone hash, paramètres user_data — permettent à la plateforme d'affiner sa modélisation.

Meta CAPI sur iOS a montré une amélioration de 15-20 % du ROAS (données partenaires Meta Business, Q4 2025). Pourquoi ? Parce que les conversions qui ne remontent pas au pixel sont complétées côté serveur, et Meta utilise ce signal pour matcher les utilisateurs et affiner la modélisation. Point clé : l'event_id envoyé à CAPI doit être identique à celui du pixel (déduplication), les paramètres user_data doivent être normalisés en hash SHA-256, et event_time doit correspondre au timestamp serveur.

Google Enhanced Conversions fonctionne sur le même principe — mais le mécanisme diffère. Si enhanced conversions est activé dans Google Ads, on peut ajouter user_data aux conversions remontées par GTM server container. Google cross-reference ces données avec son propre graphe d'utilisateurs connectés et affine la modélisation. Attention : les enhanced conversions ne concernent pas que le web, elles fonctionnent aussi sur app — mais le setup côté serveur est plus complexe. Il faut Firebase SDK + Cloud Functions, c'est-à-dire une [architecture de données first-party](https://www.roibase.com.tr/fr/firstparty).

## Post-Lookback Maturity : Une Fenêtre d'Attribution de 7 Jours N'est Plus Suffisante

Sur la stack iOS, la fenêtre de lookback est généralement 1-7 jours. SKAdNetwork : 24-72 heures, Meta sur iOS : 7 jours, Google Ads : configurable mais 7 jours par défaut. Le problème ? Le comportement utilisateur ne s'arrête pas à 7 jours — surtout dans les catégories avec un cycle de considération long (abonnements, e-commerce haut de gamme), le premier achat peut intervenir 14-30 jours après.

Post-lookback maturity, c'est quoi ? Compter rétrospectivement les conversions qui se produisent après la fenêtre courte. Exemple : l'utilisateur clique sur la pub au jour 3, achète au jour 12 — cette conversion n'est pas capturée dans la fenêtre 7 jours de Meta, mais elle est réelle. Si tu fais de l'analyse LTV par cohorte, tu dois l'attribuer manuellement à la campagne.

Méthode : suive la cohorte d'installation, mesure l'augmentation de revenu D7 → D14 → D30, redistribue le delta aux campagnes. Ce processus est manuel mais peut être automatisé avec data warehouse et BI. Sur BigQuery, tu utilises la fonction window `FIRST_VALUE()` pour matcher la date d'installation et la campagne, puis tu redistributes l'incrément LTV par attribution pondérée. Chez Roibase, cette pipeline est [incluse dans l'infrastructure de performance marketing](https://www.roibase.com.tr/fr/ppc).

## Tests d'Incrémentalité : Peut-on Faire Confiance aux Données Modélisées ?

Quelle est la précision des conversions modélisées ? Tu ne peux le savoir qu'en testant. Les tests d'incrémentalité — des expériences de type holdout ou géographiques — deviennent obligatoires sur les campagnes iOS. Meta Conversion Lift, Google Campaign Experiments, TikTok Split Testing servent tous le même objectif : tu mesures la différence de conversion entre des groupes avec et sans campagne, tu vois le vrai lift.

Exemple : tu mets 10 % d'utilisateurs en holdout (pas de pub), 90 % en traitement (pub). Au bout de 30 jours, le taux de conversion du groupe traitement est 5 %, celui du holdout 3,5 % — donc le vrai lift est 1,5 points (absolu). Si la plateforme affiche un ROAS de 3,0 mais le test d'incrémentalité dit 1,2, les données modélisées surreprésentent. Tu dois appliquer ce gap comme facteur d'ajustement au ROAS rapporté par la plateforme.

Le test géographique est plus robuste mais plus lent. Tu divises les pays ou États selon la densité d'utilisateurs iOS, campagne active dans une moitié, désactivée dans l'autre. Après 4-8 semaines, tu regardes la différence. Meta automatise cela avec Conversion Lift, Google Ads demande une config manuelle (campaign draft + experiment).

## Architecture de la Stack iOS en 2026

La stack d'attribution iOS moderne ressemble à ceci :

1. **Intégration SKAdNetwork 4** — encoding de valeur de conversion via MMP + Source ID hiérarchique
2. **Meta CAPI + Google Enhanced** — envoi côté serveur, enrichissement user_data
3. **Lecture des conversions modélisées** — note le flag « modeled » dans les dashboards, calcule le ROAS agrégé
4. **Tracking LTV par cohorte** — BigQuery/Snowflake, match install cohort → revenu, attribution post-lookback
5. **Tests d'incrémentalité** — minimum 1 expérience holdout par trimestre, calcule le lift factor
6. **Vélocité de test créatif** — SKAdNetwork offre granularité au niveau créatif, itère vite

Construire cette stack demande 6-8 semaines : onboarding MMP, setup CAPI/Enhanced côté serveur, pipeline data warehouse, dashboards BI. Mais une fois construite, le ROAS iOS devient 20-30 % plus fiable — parce que tu lis correctement les données modélisées, tu les valides avec l'incrémentalité, et tu vois la LTV complète post-lookback.

iOS 17 après, l'attribution n'est pas noire — elle est juste différente. Les signaux déterministes ont diminué mais les méthodes probabilistes + agrégées ont mûri. Avec la bonne stack, on peut toujours mesurer et optimiser. Clé de voûte : accepter les données modélisées, investir dans l'incrémentalité et standardiser l'analyse par cohorte. En 2026, quiconque veut croître sur iOS doit maîtriser ces trois piliers.