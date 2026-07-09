---
title: "iOS 17 Sonrası Ad Attribution Stack'i"
description: "ATT, SKAdNetwork 4, modeled conversions: iOS 17 sonrası mobil attribution mimarisi nasıl değişti, hangi sinyal kaynakları güvenilir, incrementality testi neden zorunlu?"
publishedAt: 2026-07-09
modifiedAt: 2026-07-09
category: marketing
i18nKey: marketing-003-2026-07
tags: [ios-attribution, skadnetwork, att, mobile-measurement, incrementality]
readingTime: 8
author: Roibase
---

Depuis iOS 14.5, l'attribution mobile livre un combat pour la survie. En iOS 17, au milieu de 2026, nous en sommes là : les signaux déterministes représentent 15-20 % de la bande passante, les conversions modélisées constituent la majorité, SKAdNetwork 4 a mûri mais n'est pas encore un standard, chaque plateforme se fie à sa propre estimation. Les CMO ne peuvent toujours pas répondre à la question « quel budget dois-je allouer à quel canal » parce que la stack d'attribution est fragmentée et contradictoire. Dans cet article, nous expliquons l'architecture de la mesure mobile post-iOS 17, la hiérarchie de fiabilité des sources de signal et pourquoi les tests d'incrémentalité sont devenus plus importants que la mesure elle-même.

## Les signaux déterministes ne sont plus la majorité

Lorsqu'ATT (App Tracking Transparency) a été lancé dans iOS 14.5, les taux d'opt-in pour l'IDFA sont tombés à 5-15 %. Avec iOS 17, cette bande a augmenté à 15-20 %, mais reste minoritaire. L'attribution déterministe — l'appariement précis entre l'annonce cliquée par l'utilisateur et l'événement qu'il effectue dans l'application — est désormais au niveau des données d'échantillon. Vous pouvez l'utiliser comme segment, mais vous ne pouvez pas extrapoler à partir de là vers la performance globale, car les utilisateurs qui consentent sont conscients de la confidentialité et résistants aux annonces — une démographie différente.

Pour les 80-85 % restants, il existe trois sources de signal : SKAdNetwork (framework privacy-preserving d'Apple), l'appariement probabiliste (restes de fingerprinting) et la modélisation de plateforme (apprentissage automatique de Meta/Google). Aucun n'est déterministe. Les postback SKAdNetwork agrègent les événements, arrivent avec 24-144 heures de retard, et l'encodage de conversion value est limité (entier 6-bit, 0-63). L'appariement probabiliste est interdit par Apple — les entreprises prise risquent une exclusion de l'App Store. Il ne reste que la modélisation — Meta Aggregated Event Measurement (AEM), les mécanismes de injection de bruit de Google Privacy Sandbox — mais ces estimations ne peuvent pas être réconciliées cross-plateforme.

Résultat : votre stack d'attribution n'est plus déterministe, elle est probabiliste, et vous devez l'accepter.

## SKAdNetwork 4 : mature mais pas encore standardisé

SKAdNetwork a basculé sur la version 4 en 2023. Les principaux changements : les postback sont désormais en trois phases (0-2 jours, 3-7 jours, 8-35 jours), l'attribution web-to-app est supportée (les installations d'applications depuis des web view compatibles SKAdNetwork peuvent être suivies), et l'identifiant source hiérarchique permet d'identifier la source publicitaire sur 4 niveaux (campagne / groupe d'annonces / créatif). Le schéma d'encryption de conversion value n'a pas changé, mais Apple a renforcé la protection de la confidentialité en postback en ajoutant un seuil d'anonymat de foule (nombre minimum d'utilisateurs) — pour les campagnes à faible trafic, aucun postback ne arrive.

Vers le milieu de 2026, le taux d'adoption est d'environ 60 %. Meta et Google supportent SKAdNetwork 4, mais des réseaux comme Unity Ads, ironSource et AppLovin sont toujours en transition entre les versions. Cela signifie que la même campagne est mesurée par différents DSP avec différentes versions de SKAdNetwork, créant des lignes impossibles à réconcilier dans les tableaux de bord.

Problème supplémentaire : les postback SKAdNetwork n'utilisent que l'attribution last-click — seule la dernière annonce cliquée est créditée. Pas de view-through, pas de point de contact assisté. Dans un parcours utilisateur multi-canal, le réseau effectuant le dernier touch prend tout le conversion value, les contributions intermédiaires restent invisibles.

### Exemple de mapping de conversion value

```
Postback 0 (0-2 jours) :
- conversion_value = 1 → installation
- conversion_value = 2 → première ouverture + onboarding complété

Postback 1 (3-7 jours) :
- conversion_value = 10-20 → montant des achats in-app les 7 premiers jours,
  encodés en bandes de 10 USD

Postback 2 (8-35 jours) :
- conversion_value = 30-40 → estimation LTV jusqu'au 35e jour,
  codée en bandes de 50 USD
```

En raison de la limite 6-bit, vous ne pouvez pas envoyer directement le chiffre d'affaires, vous définissez le schéma d'encodage vous-même et ce schéma peut varier entre les campagnes. Résultat : une couche de mapping externe est nécessaire pour la comparaison apples-to-apples.

## Les conversions modélisées : une estimation, pas un signal minoritaire

L'Aggregated Event Measurement (AEM) de Meta et les modèles Google Privacy Sandbox sont désormais au centre de la stack d'attribution mobile. Ces modèles estiment le comportement des utilisateurs sans IDFA par apprentissage automatique : l'utilisateur a vu la campagne, a installé l'application mais aucun lien déterministe ne peut être établi — le modèle prédit statistiquement à partir du comportement passé des utilisateurs ayant des caractéristiques similaires de campagne-cohorte-démographie.

Selon le rapport 2025 de Meta, 70 % des conversions d'installation iOS sont modélisées. Chez Google Ads, ce chiffre est de 60-65 %. Autrement dit, la majorité des chiffres de ROAS que vous voyez sur votre tableau de bord est une estimation. À quel point ces estimations sont-elles proches de la réalité ? Meta revendique 85-90 % de précision dans ses tests de validation propres (en comparant avec des tests de holdout incrémental). Mais cette précision est au niveau agrégé — si vous effectuez un test d'incrémentalité au niveau de la campagne, vous pouvez voir des écarts de ±30 % entre le ROAS modélisé et le lift réel.

Deuxième problème : les conversions modélisées sont spécifiques à la plateforme. Le modèle de Meta ne parle pas avec celui de Google. Si le même utilisateur est modélisé différemment sur les deux plateformes, la dédupplication cross-plateforme devient impossible. Sans MMM (Marketing Mix Modeling) ou tests géo-holdout, il est impossible de savoir quelle plateforme contribue combien.

Troisième problème : les rythmes de mise à jour des modèles. Si Meta met à jour son modèle une fois par semaine et que vous arrêtez votre campagne, l'apprentissage du modèle se reflète avec 7-14 jours de retard. Cela rend les tests « arrêtons la campagne et voyons l'effet » difficiles car le modèle éprouve de l'inertie.

## Le test d'incrémentalité est maintenant la décision, pas la mesure

Dans un monde où les conversions modélisées représentent 70 % de la part, vous ne pouvez pas faire confiance aux chiffres du tableau de bord. La solution : le test d'incrémentalité — des expériences contrôlées qui mesurent l'augmentation réelle causée par la campagne. Les deux méthodes les plus courantes : le géo-holdout et le audience holdout.

**Géo-holdout :** Vous arrêtez la campagne dans certaines zones géographiques, vous mesurez la différence d'installations ou de chiffre d'affaires. Par exemple, vous arrêtez votre campagne Meta iOS dans 10 États, vous la laissez fonctionner dans les 40 autres, et après 14 jours, vous voyez de combien le taux d'installation a baissé dans les zones fermées. Cette baisse est l'effet causal réel de la campagne. L'avantage du géo-holdout : aucune donnée au niveau utilisateur n'est requise, indépendante d'ATT. L'inconvénient : les différences macroéconomiques entre les groupes de contrôle et de traitement (vacances locales, densité concurrentielle) peuvent biaiser les résultats.

**Audience holdout :** Vous utilisez une campagne PSA (Public Service Announcement) ou des mécanismes de ghost bid pour exclure un groupe d'utilisateurs aléatoire des annonces, vous les comparez avec l'autre groupe. Meta l'offre sous forme de tests Conversion Lift, Google sous forme de tests Brand Lift. Si vous maintenez le groupe holdout à 5-10 %, vous avez besoin d'un minimum de 100 000 personnes pour la puissance statistique — pour les petites campagnes, cela ne fonctionne pas.

Les deux méthodes prennent 14-28 jours, ce qui ralentit la vitesse d'itération. Mais post-iOS 17, sans faire confiance au ROAS modélisé, il n'y a pas d'autre moyen d'allouer les budgets. Dans les initiatives [Performance Marketing](https://www.roibase.com.tr/fr/ppc), nous répétons les tests d'incrémentalité chaque trimestre plutôt qu'avant le lancement pour suivre la dérive du modèle.

## Privacy Sandbox et attribution web-to-app

iOS 17 : les règles de l'ITP (Intelligent Tracking Prevention) de Safari se sont durcies. Les utilisateurs redirigés d'une web view vers l'App Store entrent désormais dans le flux web-to-app de SKAdNetwork 4, mais la fenêtre de conversion y est limitée à 24 heures. Si l'utilisateur a vu une campagne sur le web et installe l'application 48 heures plus tard, cette attribution est perdue.

Google Privacy Sandbox propose Topics API et FLEDGE (First Locally-Executed Decision over Groups Experiment) comme alternatives au suivi du web, mais ce n'est pas encore un standard pour l'attribution in-app mobile. On parle que Apple lancera sa propre API similaire à Topics en 2026, mais aucune annonce officielle.

Détail important : les chaînes d'attribution web-to-app, même sans cookies, ne peuvent pas être correctement créditées par SKAdNetwork car vous ne pouvez pas transporter l'ID de clic web à travers la redirection de l'App Store. Apple teste un mécanisme « web attribution token » dans StoreKit 2 pour cela, mais pas en production.

## Post-lookback maturity : 35 jours suffisent-ils ?

La plus longue fenêtre de postback de SKAdNetwork est 35 jours. Mais pour les jeux, la fintech et les applications d'abonnement, la véritable LTV émerge en 90-180 jours. Au jour 35, vous encodez une estimation LTV basée sur la cohorte en conversion value, mais cette estimation ne capture ni le churn précoce ni la monétisation tardive.

Solution : les couches de modélisation post-attribution des MMP (Mobile Measurement Partner — Adjust, AppsFlyer, Singular). Ces outils prennent les postback SKAdNetwork et, en s'appuyant sur leur pool de données déterministes (utilisateurs opt-in), entraînent un modèle qui prédit la LTV à 90 jours. Mais cette prédiction est aussi un modèle — et si les données d'entraînement du MMP ne reflètent pas complètement votre comportement d'application, l'estimation s'écarte.

Alternative : faire l'analyse de cohorte manuellement. Vous prenez vos données SKAdNetwork des 35 premiers jours, suivez la même cohorte manuellement dans les tableaux de bord BI jusqu'à 90 jours, puis corrigez rétroactivement le ROAS de la campagne. Ce processus est manuel mais c'est la méthode la plus proche de la « vérité » post-iOS 17.

## Que faire maintenant

La stack d'attribution post-iOS 17 est fragmentée, lente et basée sur l'estimation. Si vous ne faites pas confiance à votre ROAS de tableau de bord, vous réagissez correctement. Suivez ces étapes : révisez votre mappage de conversion value SKAdNetwork 4, assurez-vous que vous encodez correctement les événements des 7-14 premiers jours. Récupérez la part des conversions modélisées à partir des tableaux de bord MMP — si elle dépasse 70 %, le test d'incrémentalité est obligatoire chaque trimestre. Lors du choix entre géo-holdout et audience holdout, décidez en fonction de votre volume de trafic — moins de 1 000 installations par jour, l'audience holdout n'atteindra pas la signification statistique. Si vous avez un flux web-to-app, tenez compte de la fenêtre d'attribution de 24 heures, testez le déplacement des campagnes de retargeting vers des canaux avec des fenêtres plus longues. Enfin : ne pas ignorer l'attribution, mais n'en faites pas la seule entrée de votre mécanisme de décision — créez un triangle avec MMM, analyse LTV de cohorte et tests d'incrémentalité. Le jeu post-iOS 17 ne se gagne pas avec des signaux déterministes, mais en associant la bonne estimation à la bonne décision.