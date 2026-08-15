---
title: "La Pile d'Attribution Post-iOS 17"
description: "Reconstruire la mesure de conversion sur iOS avec ATT, SKAdNetwork 4 et modeled conversions : architecture pratique de la période de maturité post-lookback."
publishedAt: 2026-08-15
modifiedAt: 2026-08-15
category: marketing
i18nKey: marketing-003-2026-08
tags: [ios-attribution, skadnetwork, att, modeled-conversions, mobile-measurement]
readingTime: 9
author: Roibase
---

La transformation initiée par ATT (App Tracking Transparency) en iOS 14.5 n'est plus une « nouvelle menace » en 2026 — c'est la réalité opérationnelle du marché. La panique des premiers jours a disparu, mais la pile d'attribution fonctionne toujours dans de nombreuses équipes selon des hypothèses obsolètes. Avec iOS 17 et la maturité complète de SKAdNetwork 4.0 (période post-lookback) et les algorithmes d'enchères optimisés par Meta et Google sur les modeled conversions, la recalibration devient incontournable. Cet article fournit la cartographie technique pour reconstruire la mesure de conversion sur iOS selon les standards 2026.

## L'Architecture de l'Attribution Après ATT

Avant iOS 14.5, l'IDFA (Identifier for Advertisers) fournissait un identifiant déterministe pour chaque utilisateur. Les réseaux publicitaires utilisaient cet ID pour relier impressions, clics, installations et événements in-app. Avec ATT, 70-80 % des utilisateurs ont refusé le suivi (selon les données publiques 2025 de Meta, 23 % d'opt-in). La perte de l'IDFA a effondré l'ancienne infrastructure MMP (Mobile Measurement Partner).

Le système qui a émergé fonctionne sur deux couches : **déterministe** (limitée via SKAdNetwork — agrégée, retardée) et **probabiliste** (basée sur les modeled conversions). SKAdNetwork 4.0 a introduit trois changements clés : une fenêtre de postback en trois phases (0-2 jours, 3-7 jours, 8-35 jours), une visibilité au niveau éditeur via source identifier, et un seuil d'anonymité collective réduit. Ces modifications ont rendu le signal d'attribution plus granulaire, mais les données déterministes restent au niveau agrégé — par cohorte, non par utilisateur.

Les modeled conversions, en contraste, permettent à Meta et Google d'utiliser l'apprentissage automatique pour **prédire** les événements des utilisateurs ayant refusé le suivi et les intégrer à l'optimisation des campagnes. L'AEM (Aggregated Event Measurement) de Meta et le Consent Mode v2 de Google en dépendent. Cependant, les données modelées dépendent directement de la qualité des signaux first-party comme CAPI (Conversions API) ou Enhanced Conversions — une qualité de signal faible introduit du biais dans le modèle.

## Le Vrai Coût du Travail avec SKAdNetwork 4

La structure postback en trois phases de SKAdNetwork 4.0 offre théoriquement un avantage — utiliser les signaux précoces (0-2 jours) pour optimiser rapidement la campagne. En pratique, deux problèmes émergeront : **timer randomization** et **limitation des bits de conversion value**.

La timer randomization est le mécanisme de confidentialité d'Apple : le postback arrive dans une fenêtre aléatoire de 0-24 heures. Cela signifie que même dans la fenêtre de 0-2 jours, le signal ne peut pas être utilisé en temps réel. Par exemple, si un utilisateur effectue un achat in-app 6 heures après l'installation, le postback de SKAdNetwork peut arriver 48 heures plus tard avec un délai aléatoire de 18 heures — la boucle de rétroaction pour la campagne responsable se ferme en 66 heures. Ce délai complique les décisions budgétaires quotidiennes des campagnes UA (User Acquisition).

La conversion value utilise 6 bits (valeurs entières de 0-63). Cela signifie 64 combinaisons d'événements possibles. Pour une application de jeux, tu dois encoder : niveau 1, niveau 5, niveau 10, premier achat, deuxième achat. L'attribution correcte des bits est une décision stratégique — un mauvais mappage détruit le signal d'enchère. Par exemple, si tu assignes la valeur maximale à « niveau 10 » mais que la vraie source de LTV est « 3+ achats en 7 jours », l'algorithme optimise la mauvaise cohorte.

### Exemple de Mappage de Conversion Value

```json
{
  "install": 0,
  "tutorial_complete": 1,
  "level_3": 5,
  "level_10": 15,
  "first_purchase": 25,
  "purchase_3d": 40,
  "purchase_7d": 63
}
```

Dans ce mappage, « purchase_7d » reçoit la valeur maximale (63) car elle représente à la fois la rétention à 7 jours et la monétisation — un proxy LTV solide. Cependant, si ce seuil d'anonymité collective est trop bas, cette valeur peut être dégradée, et le système bascule vers « purchase_3d » (40).

## Modeled Conversions et Qualité du Signal First-Party

Le système de modeled conversions de Meta prédit les événements des utilisateurs ayant refusé le suivi en utilisant : les postbacks SKAdNetwork agrégés, un pont pixel web-vers-app, et les événements first-party envoyés via CAPI. Le modèle apparie ces données aux démographies utilisateur, patterns comportementaux et empreintes d'appareil pour imputer les événements manquants.

La précision du modèle dépend entièrement de la qualité de la signal de votre infrastructure. Si le score EMQ (Event Match Quality) dans CAPI est inférieur à 50 %, le modèle génère du bruit. Les causes principales d'un EMQ faible : emails non hashés, `external_id` manquant, champ `event_source_url` vide. Selon les directives 2025 de Meta, viser EMQ ≥ 75 % — cela requiert un hashage approprié d'email/téléphone, un `external_id` correctement transmis, et une déduplication entre événements client et serveur.

Un autre problème : **la latence de la boucle de rétroaction**. Tandis que l'algorithme de campagne de Meta optimise selon les prédictions du modèle, les vraies données de conversion arrivent avec un délai de 2-3 jours depuis SKAdNetwork agrégé. Pendant ce lag, l'algorithme peut optimiser la mauvaise cohorte. Par exemple, si les données modelées montrent un ROAS élevé pour « utilisateurs Android + femmes », mais que SKAdNetwork agrégé révèle que ce segment a en réalité un taux de conversion bas, la correction de l'algorithme prend 5-7 jours.

## Incrementality et le Nouveau Rôle de l'Attribution Multi-Touch

SKAdNetwork et les modeled conversions fonctionnent tous deux selon une logique de **last-touch** — le dernier clic avant l'installation crédite la campagne. Mais le vrai parcours utilisateur est multi-touch : vidéo sur TikTok, recherche de marque sur Google, clic retargeting Meta, puis installation. Last-touch ne voit que cette dernière étape, crédite tout à Meta.

Le test d'incrementality comble cette lacune. Via des holdouts géographiques (désactiver une campagne dans certaines zones pour mesurer l'organic baseline), des campagnes placébo PSA (Public Service Announcement), ou MMM bayésienne (Marketing Mix Modeling), vous mesurez la **vraie contribution** de chaque canal. Par exemple, désactiver Meta pendant 2 semaines à Ankara : si les installations baissent de 30 %, la contribution incrémentale de Meta est 30 %. Ce test révèle la contribution de l'upper-funnel que SKAdNetwork n'attribue pas.

MMM analyse les données historiques spend/outcome via régression. Post-iOS 17, le rôle de MMM augmente car l'attribution user-level est désormais incomplète. Mais bien construire MMM requiert de la rigueur — sans variables de contrôle (seasonalité, indices macroéconomiques, dépenses concurrentes), le modèle ne trouve que la corrélation, jamais la causalité.

## Opération Pendant la Période de Maturité Post-Lookback

Quand nous disons que la pile d'attribution iOS est « mature » en 2026, nous entendons : les MMP (Adjust, AppsFlyer, Singular) supportent complètement SKAdNetwork 4, les modeled conversions sont intégrées aux enchères Meta/Google, la configuration CAPI + Enhanced Conversions est devenue standard. Mais au niveau opérationnel, des points critiques demeurent.

D'abord : **la stratégie de blend entre SKAN et modeled data**. Certaines équipes ne font confiance qu'aux modeled data — rapides, granulaires. Mais les données modelées peuvent être biaisées. D'autres ne regardent que SKAdNetwork — déterministe mais retardé et agrégé. La bonne approche : blender les deux. Optimisez rapidement avec modeled data, recalibrez chaque semaine avec l'agrégé SKAdNetwork. Par exemple, si modeled ROAS affiche 120 % mais l'agrégé SKAdNetwork 90 %, vos données modelées surestiment — réduisez votre stratégie d'enchères de 15-20 %.

Deuxième point : **la mise à jour dynamique de la stratégie conversion value**. Si votre mécanique de jeu change (nouveau niveau, nouveau prix IAP), mettez à jour le mappage conversion value. Cette mise à jour se fait dans Apple Developer Console mais ne s'applique qu'aux nouvelles campagnes — les existantes continuent avec l'ancien mappage. Cela complique la segmentation lors des tests A/B.

Troisième : **surveiller les seuils de confidentialité**. Si un postback SKAdNetwork ne franchit pas le seuil d'anonymité collective, la conversion value baisse ou ne s'envoie pas du tout. Sur les petites campagnes (< 500 installations/jour), c'est fréquent. Solution : agréger les petites campagnes sous une seule fenêtre postback, ou simplifier le mappage conversion value pour abaisser le seuil.

## Que Faire Maintenant

La pile d'attribution iOS post-17 n'est plus une « solution temporaire » — c'est une architecture permanente. Priorisez ces étapes : calibrez l'intégration CAPI/Enhanced Conversions pour EMQ ≥ 75 %, repensez le mappage SKAdNetwork conversion value autour des proxys LTV, blendez les modeled conversions + agrégé SKAN pour un contrôle de biais hebdomadaire, exécutez un test d'incrementality (geo-holdout ou PSA) pour mesurer la contribution multi-touch. Vous ne pouvez pas revenir à l'attribution déterministe des anciens jours, mais avec une pile bien construite, votre algorithme d'enchère reçoit le bon signal et la performance de campagne reste mesurable.