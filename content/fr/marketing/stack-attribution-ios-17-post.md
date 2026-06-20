---
title: "Stack d'Attribution Post-iOS 17"
description: "ATT, SKAdNetwork 4 et conversions modélisées : nouvelle architecture de mesure pour iOS. Configuration pratique du stack post-lookback pour 2026."
publishedAt: 2026-06-20
modifiedAt: 2026-06-20
category: marketing
i18nKey: marketing-003-2026-06
tags: [ios-attribution, skadnetwork, att, mobile-marketing, conversion-modeling]
readingTime: 9
author: Roibase
---

La transformation initiée par ATT (App Tracking Transparency) sur iOS 14 a maturé en 2026. Avec SKAdNetwork 4, les conversions modélisées et l'élargissement des fenêtres post-installation, le marketing iOS exige désormais un stack technique différent. Au T4 2025, 73 % des utilisateurs américains rejettent le suivi lors de la demande ATT (Flurry Analytics 2025). Cela marque une période où les modèles d'attribution déterministes se sont effondrés, mais les nouveaux systèmes probabilistes offrent davantage de signaux. Ci-dessous, nous construisons le stack de performance marketing pour iOS 17+ au niveau technique.

## Pas de Signaux Déterministes Après ATT

Après qu'App Tracking Transparency ait demandé aux utilisateurs une autorisation de suivi, le taux de refus a dépassé 70 %. Cela signifie que les identifiants basés sur l'appareil, comme l'IDFA (Identifier for Advertisers), ne peuvent plus être au cœur des décisions marketing. Les plateformes comme Meta, Google et TikTok, n'ayant plus accès aux données au niveau utilisateur, exécutent désormais l'optimisation des campagnes via des signaux agrégés.

**Ce qui reste en l'absence de signaux déterministes :**
- Postbacks SKAdNetwork (les événements d'installation et conversion correspondent à l'ID de campagne, mais pas d'ID utilisateur)
- Signaux de conversion côté serveur (flux d'événements first-party)
- Conversions modélisées (les modèles ML des plateformes prédisent les données manquantes)

Point critique : les anciennes analyses de cohorte LTV fonctionnent désormais avec modélisation probabiliste plutôt que données déterministes. Par exemple, les « Estimated Actions » dans Meta Ads Manager — ces prédictions portent une marge d'erreur de 15–25 % (rapport d'attribution Meta Q1 2025). Lors de la construction du stack, il faut intégrer cette incertitude dans les tarifs.

### Fenêtre Post-Installation Lookback

Avec SKAdNetwork 4, la fenêtre lookback passe de 24 heures à 35 jours. Cependant, vous ne pouvez envoyer que 3 mises à jour de valeur de conversion durant cette période. Chaque mise à jour se présente avec une granularité « coarse » ou « fine » — cette granularité dépend du taux de conversion. En cas de conversion élevée, fine (64 conversion values), sinon coarse (classification low/medium/high).

**Règle technique :** si le signal de conversion arrive dans les 24 premières heures, c'est fine ; de jour 3–7, c'est coarse ; après jour 8, c'est un postback basé sur minuteur. Cela signifie que le calcul du LTV à J7 n'est plus déterministe — seuls 40 % des installations génèrent un signal avant J7 (benchmark AppsFlyer 2025).

## Schéma de Valeur de Conversion SKAdNetwork 4

SKAdNetwork dispose de 64 valeurs de conversion (0–63). Chaque valeur encode une « combinaison d'événements ». Par exemple :
- 0–9 : Première ouverture + onboarding complété
- 10–19 : Première interaction de contenu
- 20–29 : Premier achat (faible valeur)
- 30–39 : Premier achat (valeur élevée)
- 40–63 : Achat récurrent, renouvellement d'abonnement

Lors de la configuration de ce schéma, vous devez effectuer un **priority mapping** — l'événement avec la plus grande valeur métier se mappe à la valeur SKAdNetwork la plus élevée. Parce que SKAdNetwork envoie uniquement la **valeur de conversion la plus élevée** dans le postback. Donc si un utilisateur à la fois termine l'onboarding (value 5) et effectue un achat (value 25), seul le 25 est envoyé.

**Exemple de mapping (application de jeu) :**

| Événement | Valeur Métier | Valeur SKAdNetwork |
|---|---|---|
| Tutoriel complété | $0,10 | 5 |
| Niveau 3 complété | $0,30 | 10 |
| Premier IAP ($0,99) | $0,99 | 20 |
| Premier IAP ($4,99+) | $4,99+ | 30 |
| Rétention J7 | $2,50 (modélisée) | 40 |

Construire ce schéma **weighted par revenu** est critique — sinon les événements de faible valeur et haute fréquence étoufferont les valeurs élevées et l'optimisation de la plateforme s'orientera mal.

### Source Identifier Hiérarchique

Avec SKAdNetwork 4 arrive le « hierarchical source ID » — cela encode la hiérarchie campagne → groupe d'annonces → créatif avec un code à 4 chiffres. Par exemple, `1234` pourrait signifier :
- Deux premiers chiffres (12) : ID de campagne
- 3e chiffre (3) : Groupe d'annonces
- 4e chiffre (4) : Variante créative

Configurer correctement cet ID est crucial pour la granularité de l'attribution. Sinon, toutes les campagnes arrivent avec un seul ID et la performance au niveau créatif devient invisible. Dans les stratégies de [Performance Marketing](https://www.roibase.com.tr/fr/ppc), cette granularité accélère les tests de conversion — par exemple, un test A/B créatif peut produire des résultats en 3 jours au lieu de 7.

## Conversions Modélisées : ML Côté Plateforme

Meta, Google et TikTok proposent désormais des « conversions modélisées » — une couche qui prédit les signaux manquants via ML. Lorsque Meta reçoit un événement côté serveur via l'API Conversions, la plateforme utilise :
- Les paramètres d'événement que vous envoyez (event_name, value, currency)
- L'adresse IP, user agent, click ID (fbclid, gclid)
- Les patterns de comportement historiques d'utilisateurs similaires

Meta fusionne ces signaux et produit un nombre de conversions « modélisé ». Par exemple, avec 100 vraies conversions, le modèle affichera 120–130 conversions « estimées ». Ces prédictions entrent dans l'algorithme de bid — donc l'optimisation du ROAS cible se fait sur données modélisées.

**Question critique :** les données modélisées sont-elles fiables ? Les propres tests A/B de Meta montrent que le modèle a ~18–22 % de précision (Meta Advertiser Help Center 2025). Ceci doit être validé avec des tests de lift incrémentiel. Si le ROAS modélisé est 3,5x mais l'incrementalité vraie est 2,1x, vous prenez des décisions budgétaires basées sur données modélisées et over-dépensez.

### Qualité du Signal Côté Serveur

La qualité de la conversion modélisée dépend de la richesse du signal côté serveur. Exigences minimales :
- `event_source_url` (URL de la page d'arrivée)
- `client_ip_address` (IP utilisateur)
- `client_user_agent` (informations du navigateur)
- `fbp` cookie (cookie first-party Meta Pixel)
- `fbc` cookie (click ID cookie, tiré du paramètre fbclid)

Sans ces 5 paramètres, la qualité de conversion modélisée chute de 40–50 % (documentation Meta CAPI). En particulier, définir les cookies `fbp` et `fbc` depuis le domaine first-party est critique — si ces signaux se perdent à cause du blocage des cookies tiers, l'attribution bascule entièrement vers l'agrégé.

## Maturité des Campagnes Post-Lookback

Pour les campagnes iOS, la durée de la « phase d'apprentissage » a augmenté. Dans Google App Campaigns, la campagne reste en mode « learning » jusqu'à atteindre 50 conversions. Cependant, comme les signaux SKAdNetwork arrivent avec 24 heures de délai, ces 50 conversions peuvent prendre 3–5 jours. Pendant ce laps de temps, le CPA est 30–40 % plus volatil.

**Règle opérationnelle :** ne pausez pas la campagne les 7 premiers jours — fournissez le flux de signaux à l'algorithme. À partir du jour 7, si le CPA s'est stabilisé, augmentez ; sinon, changez le créatif ou le ciblage. Cependant, chaque changement réinitialise la phase d'apprentissage — ce qui signifie 7 jours de plus.

### Structure de Campagne : Consolidation vs. Segmentation

À l'époque iOS 13, segmenter les campagnes en cibles étroites avait du sens (lookalike %1, %2 comme campagnes séparées). Aujourd'hui, cette approche allonge la phase d'apprentissage. À la place, on préfère la **campagne consolidée** :
- Une seule campagne, ciblage large (iOS 15+, tout États-Unis)
- La plateforme segmente elle-même via son modèle
- Test créatif au sein de la campagne via créatif dynamique

Selon le benchmark AppsFlyer 2025, la structure consolidée a livré 22 % de CPA plus bas. Cependant, cette approche réduit le contrôle d'optimisation manuel — tout le pouvoir revient au ML de la plateforme.

## Validation via Test d'Incrementalité

La précision des données modélisées et des signaux SKAdNetwork ne peut être comprise que via un test d'incrementalité. Effectuez un test de rétention géographique pour mesurer la différence de conversion entre le groupe de contrôle (pas de publicité) et le groupe test (avec publicité).

**Calcul simple :**
```
Incremental Lift = (Test Group CVR - Control Group CVR) / Control Group CVR
```

Par exemple, groupe test 3,2 % CVR, groupe contrôle 2,1 % CVR, le lift est 52 %. Cependant, si tout ce lift ne vient pas des annonces (par exemple, si un pic organique se produit), l'« incrementalité vraie » est plus basse. Dans ce cas, ajustez le ROAS modélisé par le ratio de lift :
```
True ROAS = Reported ROAS × (Incremental Lift / 100)
```

Si le ROAS signalé est 4,0x mais le lift est 40 %, le true ROAS est 1,6x — une différence importante qui modifie l'allocation budgétaire.

## Conception du Stack : Couche par Couche

Pour iOS 17+, le stack d'attribution end-to-end est composé de ces couches :

**1. SDK + MMP (Mobile Measurement Partner) :** Les MMP comme AppsFlyer, Adjust et Branch collectent les postbacks SKAdNetwork et les font correspondre avec l'ID de campagne. Cette couche fournit le signal déterministe mais sans détail au niveau utilisateur.

**2. Flux d'Événement Côté Serveur :** Envoyez les événements du backend de l'application vers l'API CAPI (Meta), Google Ads API, TikTok Events API. Ces signaux alimentent la conversion modélisée.

**3. BI + Modèle d'Attribution :** Dans BigQuery ou Snowflake, fusionnez SKAdNetwork + server-side + données modélisées. Construisez ici un modèle « blended attribution » — par exemple, poids SKAdNetwork 60 %, poids modélisé 40 %.

**4. Couche Incrementalité :** Importez les résultats du test géographique dans la BI, ajustez l'attribution blended par incrementalité. Cette couche fournit la « ground truth ».

Chaque couche est une source de données différente — la robustesse du stack dépend donc de la disponibilité du pipeline de données. Les postbacks SKAdNetwork portent 2–5 % de taux de perte (problèmes réseau, erreur de minuteur, etc.), minimisez ces pertes via le mécanisme de retry du MMP.

## À Faire Maintenant

Le stack d'attribution iOS fonctionne désormais avec modélisation probabiliste plutôt que données déterministes. Construisez votre schéma SKAdNetwork 4 conversion value weighted par revenu, fournissez la granularité via hierarchical source ID, maximisez la qualité du signal côté serveur. En faisant confiance aux conversions modélisées, validez via test d'incrementalité — sinon, risque d'over-attribution. La maturité de la campagne a augmenté, soyez patient les 7 premiers jours et évitez les changements qui réinitialisent la phase d'apprentissage. Construisez le stack couche par couche et surveillez la perte de données à chaque étape — car sur iOS, il n'existe plus une seule source de signal, c'est l'agrégation de tous qui livre la vérité.