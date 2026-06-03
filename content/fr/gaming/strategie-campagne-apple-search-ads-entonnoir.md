---
title: "Apple Search Ads : Structurer l'Architecture Campagne Comme un Entonnoir"
description: "Budgétiser les modes Discovery, Concurrent, Marque et Broad Match selon une logique d'entonnoir. Intégrer l'architecture ASA avec l'LTV."
publishedAt: 2026-06-03
modifiedAt: 2026-06-03
category: gaming
i18nKey: gaming-005-2026-06
tags: [apple-search-ads, asa-entonnoir, mobile-acquisition, match-type-strategy, gaming-ua]
readingTime: 9
author: Roibase
---

Utiliser Apple Search Ads comme un simple outil PPC par mot-clé, c'était 2021. En 2026, ASA est une opération d'entonnoir. Les strates campagne qui s'étendent de Discovery à Marque sont budgétisées selon les estimations LTV et optimisées sur le D7 ROAS, non sur le volume d'installations. La plupart des équipes utilisent encore un seul broad match sur une campagne unique et se plaignent de "ne pas scaler". Le problème n'est pas le budget, c'est la conception architecturale.

## Campagne Discovery : Scanner le Réservoir de Trafic Froid

La campagne Discovery est conçue pour déchiffrer le comportement de recherche des utilisateurs qui n'ont jamais entendu parler de votre application sur l'App Store. On sélectionne 200–500 mots-clés génériques en broad match, on maintient le budget quotidien bas (50–100 USD en tier-1), mais on pousse la part d'impression de recherche vers 100 %. L'objectif n'est pas le volume d'installations, mais la collecte de données Search Match.

On analyse le rapport Search Match 72 heures après le lancement de la campagne. Sur quelles requêtes avez-vous eu des impressions ? Quels termes ont apporté des installations ? Lesquels sont du spam ? Cette donnée valide ou invalide votre stratégie ASO. Par exemple, si vos métadonnées insistent sur "puzzle" mais que Search Match affiche un TTR élevé sur "idle game", il existe une déconnexion entre votre ASO et votre UA.

La couche Discovery affiche un CPT de 35 % à 50 % inférieur car la concurrence sur les mots-clés inconnus est rare. Mais le taux de conversion (tap-to-install) est faible. C'est normal. Le rôle de Discovery est d'alimenter l'entonnoir, pas de générer du volume d'installations. 200–300 installations par semaine suffisent ; 15 % sont ajoutées à votre liste de mots-clés négatifs, le reste s'infiltre dans les strates Concurrent et Marque.

### Règle de Budget Discovery

Le budget quotidien de votre campagne Discovery ne doit pas dépasser 10–15 % de votre budget ASA total. Exemple : avec un budget ASA mensuel de 30 000 USD, vous allouez 100 USD/jour à Discovery. Le budget est fixe, il n'y a pas d'objectif CPA, on utilise une enchère manuelle (généralement 0,30–0,50 USD en tier-1). Après 14 jours, les mots-clés à haute performance extraits de Search Match sont transférés comme exact match vers votre campagne Concurrent.

## Campagne Concurrent : Rivaliser sur la Marque Rivale

La strate Concurrent cible les noms de marque rivaux en exact match. « Candy Crush », « Clash of Clans », « Subway Surfers » — ces termes de marque fonctionnent dans cette strate. La stratégie doit être opportuniste, non agressive. Si le rival utilise une enchère maximale pour son propre terme de marque, vous restez à 60–70 %, sans viser la première position.

Le CPT des campagnes Concurrent est 80 % supérieur à Discovery, mais le TTR monte à 12–18 % (versus 3–5 % en Discovery). Le taux de conversion d'installation reste médiocre car l'utilisateur cherchait un autre jeu. La rétention D1 stagne autour de 25–30 %, alors qu'elle atteint 45–50 % sur les installations organiques. Mais dans certains scénarios, elle élargit votre réserve LTV globale.

Le KPI de la strate Concurrent est le « ROAS incrémentiel ». Si vous mettez en pause le terme rival, vos installations chutent-elles de 10 % ? Si oui, la campagne génère de l'incrémentalité. Si non, le même utilisateur provenait déjà de Discovery ou de votre campagne Marque — il y a cannibalisation. Un test d'incrémentalité sur 14 jours est obligatoire.

| Type Match | CPT (tier-1) | TTR | Objectif D7 ROAS | Part Budget |
|---|---|---|---|---|
| Discovery (broad) | $0,40 | 3–5 % | Mode test | 10 % |
| Concurrent (exact) | $1,20 | 12–18 % | 80+ % | 25 % |
| Marque (exact) | $0,60 | 25–35 % | 200+ % | 50 % |
| Générique (broad) | $0,70 | 6–9 % | 120+ % | 15 % |

## Campagne Marque : Protéger Votre Propre Marque

La campagne Marque s'assure que les utilisateurs recherchant votre jeu ne basculez pas vers les concurrents. Des termes comme « Roibase Puzzle », « Roibase Game », « Roibase RPG » sont ciblés en exact match. On utilise une enchère maximale dans cette strate car même un classement organique peut perdre face à une annonce concurrente.

Le CPT des campagnes Marque est le plus bas (0,40–0,80 USD en tier-1). Le TTR atteint 25–35 %, le CR d'installation 60–70 %, la rétention D7 50+. Cet utilisateur connaît déjà votre jeu et s'apprêtait à le télécharger. La question pertinente : « Cet utilisateur terminerait-il le téléchargement organique sans cette campagne ? » La réponse est généralement « oui », mais si un concurrent fait de la publicité sur le même terme, la campagne devient indispensable.

Le budget de la strate Marque représente 40–50 % de votre dépense ASA totale. C'est imposant, mais c'est une position de défense. Quand un rival cible votre terme de marque, vous le visez en retour — équilibre MAD (destruction mutuelle assurée). En 2026, pratiquement tous les jeux tier-1 font de la défense de marque ; ceux qui ne le font pas perdent 10–15 % de leurs installations organiques.

### Test de Pause Campagne Marque

Si aucun rival ne cible votre terme de marque, mettez la campagne en pause pendant 7 jours. Vos installations organiques chutent-elles ? Non ? Votre campagne Marque gonfle votre budget UA mais ne crée pas de valeur incrémentielle. Oui ? (Une baisse de 8–12 % est typique) Maintenez la campagne active, mais imposez un cap CPA (plafond : 15 % de l'LTV utilisateur organique).

## Mode Broad Match : Exploration ou Outil de Scale ?

Le broad match ne doit pas être confondu avec Discovery. Discovery utilise le broad match mais fonctionne avec une enchère basse et un budget bas. Une campagne broad match de scale utilise une enchère élevée et un budget élevé pour gagner la part d'impression sur des termes génériques. Des termes comme « puzzle game », « idle rpg », « strategy mobile » opèrent dans ce mode.

Le risque des campagnes broad match est la « requête non pertinente ». Vous faites de la publicité sur « puzzle » mais Search Match l'affiche aussi sur « puzzle solver app » ou « puzzle table » — requêtes non-gaming. Votre liste de mots-clés négatifs doit contenir 200+ termes. Vérification manuelle obligatoire les 7 premiers jours — review quotidienne sur Search Match.

Le budget broad match ne doit pas dépasser 15–20 % de votre dépense ASA totale. Exemple : avec 30 000 USD/mois, 5 000 USD vont au broad match. L'objectif CPA est 20–30 % supérieur aux campagnes exact match car il opère en haut d'entonnoir. L'objectif D7 ROAS est de 100–120 %. S'il chute en dessous, ne pausez pas — réduisez l'enchère. La campagne continue à collecter des données.

## Flux de Budget : Migrer d'Étage en Étage de l'Entonnoir

Une architecture ASA saine transporte l'utilisateur de Discovery vers Marque. Un utilisateur exposé pour la première fois en Discovery cherche le nom de votre jeu sur l'App Store dans les 48–72 heures suivantes ? Cette fois, c'est votre campagne Marque qui le saisit. Mesurer ce flux exige les données d'attribution « Custom Product Page » d'Apple — quel premier contact campagne, quel install ?

La répartition budgétaire s'organise ainsi : Discovery reste fixe (100 USD/jour), Concurrent et broad match augmentent ou diminuent de 10–20 % hebdomadairement selon le CPA, la campagne Marque fonctionne en mode « toujours actif » avec budget maximal. Dès que le D7 ROAS total chute sous l'objectif, fermez d'abord Concurrent, puis pausez le broad match ; Discovery et Marque continuent.

Flux d'exemple : en mai, Discovery a généré 250 installations ; 12 % (30 utilisateurs) ont recherché votre terme de marque dans les 72 heures et ont installé via Marque. L'LTV moyen de ces 30 utilisateurs était 40 % supérieur au groupe d'installations Discovery directes. Cette donnée prouve que Discovery ne produit pas seulement des installations directes, mais aussi un effet de lift de marque indirect.

### Tableau Attribution Entonnoir

```
Campagne        | Dépense  | Installs | LTV Direct | Installs Assist | LTV Mixte
----------------|----------|----------|------------|-----------------|-------------
Discovery       | $3 000   | 250      | $4,20      | 30 (Marque)     | $5,80
Concurrent      | $7 500   | 420      | $6,10      | 15 (Marque)     | $6,50
Marque          | $15 000  | 1 200    | $12,40     | —               | $12,40
Broad Match     | $4 500   | 310      | $5,30      | 22 (Marque)     | $6,00
```

## Campaign Budget Optimization : Le Nouvel Algorithme Apple

Depuis 2025, Apple Search Ads teste « Campaign Budget Optimization » (CBO). Il ressemble à la stratégie d'enchères portfolio de Google App Campaigns : un seul budget, plusieurs campagnes, l'apprentissage automatique réoriente vers la meilleure performance. Utiliser CBO en gaming UA est risqué. L'algorithme ignore votre objectif D7 ROAS et maximise seulement le volume d'installations.

Si vous activez CBO, la campagne Marque absorbe 70–80 % du budget car son CPA y est le plus bas. Discovery et Concurrent se vident. Résultat : votre volume d'installations ne baisse pas, mais l'alimentation du haut d'entonnoir s'arrête ; 3 semaines après, le volume d'installations Marque commence aussi à chuter. N'activez CBO que dans ces conditions : vous fusionnez des campagnes CPA similaires (Marque + broad match).

## Quelle Strate Fermer si la Performance Faiblit ?

La décision de fermer dépend de l'incrémentalité, non du CPA. La campagne Concurrent dépasse son objectif CPA de 30 % mais, en pause, vos installations baissent de 8 % — elle est incrémentale, poursuivez-la et optimisez l'enchère. La campagne broad match respecte le CPA mais, en pause, l'installation ne bouge pas — elle cannibalise, fermez-la.

Discovery ne ferme jamais. Son budget peut baisser mais doit rester actif. Parce que l'objectif de Discovery n'est pas le ROAS immédiat, mais valider les hypothèses ASO et alimenter le réservoir de données Search Match. La campagne Marque ne ferme jamais non plus. Si un rival cible votre terme de marque, vous restez en position de défense.

L'architecture entonnoir ASA sans intégration [stratégie App Store Optimization](https://www.roibase.com.tr/fr/aso) plafonne en 3–4 semaines. Les mots-clés mis en avant dans les métadonnées doivent être cohérents avec les termes ciblés dans vos campagnes ASA. Si un terme génère un TTR inattendu élevé en Discovery, l'ajouter aux métadonnées ASO élève le CR d'installation de 10–15 %.