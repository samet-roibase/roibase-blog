---
title: "Apple Search Ads : Structurer votre campagne comme un entonnoir"
description: "Organisez Discovery, Competitor, Brand et Broad Match en structure d'entonnoir. Maîtrisez le flux budgétaire, augmentez le ROAS de 40 %."
publishedAt: 2026-08-12
modifiedAt: 2026-08-12
category: gaming
i18nKey: gaming-005-2026-08
tags: [apple-search-ads, asa-entonnoir, strategie-match-type, acquisition-mobile, performance-gaming]
readingTime: 9
author: Roibase
---

Lorsque vous lancez une campagne Apple Search Ads, la première question est : quel type de correspondance dois-je utiliser et quand ? La plupart des UA managers ouvrent Discovery, brûlent le budget, voient les CPT dépasser $12, puis basculent sur Broad Match — mais les installations ne sont pas pertinentes. Le problème n'est pas le choix du type de correspondance, c'est que les campagnes fonctionnent en silos. Si vous structurez Apple Search Ads comme un entonnoir, Discovery explore, Competitor génère du trafic au milieu, Brand convertit, et Broad Match agrège tout. Nous partageons ici l'architecture de campagne à 4 niveaux testée par Roibase sur des projets de jeux mobiles, la logique du flux budgétaire et la boucle de transfert des mots-clés négatifs.

## Discovery : La couche d'exploration, pas la montée en charge

Discovery est le réservoir de données où Apple dit « ceux qui regardent ton jeu regardent aussi ceux-ci ». L'objectif n'est pas de récolter des installations mais de voir les mots-clés suggérés par ASA et de réserver de l'espace pour ceux avec LTV/D7 > $5 dans les campagnes Exact ou Broad. Lancez la campagne Discovery en batches de 2 semaines — budget quotidien entre $50-100. Si le CPT dépasse $8, mettez en pause ; si aucun nouveau mot-clé n'apparaît, relancez après 7 jours. Cette couche ne reste pas ouverte en permanence — elle explore, puis se ferme.

Un batch Discovery typique fonctionne ainsi : les 3 premiers jours, vous voyez 40-60 impressions par mot-clé, conversion d'installations entre 2-4 %. Le point critique ici : même si vous obtenez des installations, ne lancez pas immédiatement. Attendez la cohort. Si la rétention D7 est inférieure à 18 %, transférez ce mot-clé en Exact négatif vers votre campagne Brand. Au-dessus de 18 %, ajoutez-le comme mot-clé Exact dans Competitor ou Broad Match. Sans cette boucle, Discovery ne fait que brûler le budget — avec elle, vous alimentez le machine learning d'Apple avec votre entonnoir.

Ne testez pas de creative dans Discovery. L'objectif est de trouver des mots-clés, pas de tester des créatives. Si vous utilisez des pages produit personnalisées, testez-les dans les couches Competitor ou Brand. Avec Discovery, utilisez un seul creative de contrôle et mesurez les performances par mot-clé. Changer le creative brise les comparaisons de performance.

## Competitor : Trafic du milieu de l'entonnoir avec correspondance exacte

Les mots-clés venant de Discovery fonctionnent ici en correspondance exacte. Exemple : Discovery vous a montré « idle game », D7 LTV atteint $6,2, ajoutez donc `[idle game]` en Exact à votre campagne Competitor. Pas de Broad Match ici — uniquement Exact et Phrase. L'objectif est de cibler les noms des jeux concurrents ou les termes de catégorie, mais de manière contrôlée.

Budget quotidien entre $200-400. Gardez le CPT cible dans la bande $5-7. Apple Search Ads : les termes Competitor coûtent généralement 30-50 % plus chers que les termes Brand, mais la rétention D7 reste proche. La métrique à surveiller ici est le TTR (taux de clics). Moins de 5 % signifie un problème créatif — testez une page produit personnalisée. Dans les travaux d'[Optimisation App Store](/tr/aso) de Roibase, nous testons Icon + Screenshot à ce niveau — en particulier, les créatives avec frame « vs » génèrent 8-12 % de TTR sur les termes Competitor.

La boucle des mots-clés négatifs est critique en Competitor. Transférez les termes venant de Discovery qui ne convertissent pas en Exact négatif ici. De plus, si un mot-clé génère des installations mais une rétention D1 inférieure à 40 %, marquez-le aussi comme négatif. Sans cette boucle, l'algorithme d'Apple distribue le budget vers les mots-clés LTV faible et le ROAS reste bloqué à 60-70 %.

### Tableau de transfert des mots-clés négatifs

| CPT Discovery | D7 LTV | Campagne cible | Type de correspondance |
|---|---|---|---|
| < $8 | > $5 | Competitor | Exact |
| < $8 | $3-5 | Broad Match | Phrase |
| > $8 | < $3 | Liste négative | Exact |
| N/A | < $2 | Brand (négatif) | Exact |

Ce tableau est mis à jour toutes les 2 semaines. Les mots-clés remontent ou descendent à mesure que les données de cohort arrivent.

## Brand : La couche de conversion, CPT le plus bas

La campagne Brand cible votre nom de jeu et les termes de marque associés. Correspondance exacte obligatoire — n'utilisez pas Phrase ou Broad parce qu'Apple vous avantage déjà sur les termes Brand ; la correspondance large génère juste des impressions inutiles. Exemple : si votre jeu s'appelle « Dragon Merge », utilisez uniquement `[dragon merge]`, `[dragonmerge]`, `[dragon merge game]` en Exact.

Budget quotidien $100-150 suffisent car le trafic de termes de marque est limité. CPT entre $1,5-3. L'objectif est de ne pas perdre l'utilisateur qui pourrait arriver en organique et d'empêcher les concurrents de faire de la publicité sur votre marque. Apple Search Ads : la défense de marque est obligatoire — sinon les concurrents font de la publicité sur votre nom et les utilisateurs qui vous cherchent téléchargent leur jeu.

Sur Brand, la page produit personnalisée génère la conversion la plus haute. L'utilisateur connaît déjà le jeu — vous n'avez pas besoin de convaincre, juste offrir un processus d'installation rapide. Utilisez une CPP simple avec CTA « Télécharger maintenant », sans plus de 3 captures d'écran. Dans les tests Roibase, une CPP simple génère 12-15 % de conversion supérieure sur Brand.

## Broad Match : Agrégez la sortie de l'entonnoir

La campagne Broad Match est alimentée par les 3 couches précédentes. Ajoutez-y en Phrase Match les mots-clés venant de Discovery avec LTV/D7 entre $3-5. Transférez de Competitor les mots-clés convertisseurs mais avec CPT > $7 en Broad Match. Ajoutez les termes « peu pertinents mais installants » marqués comme négatifs dans Brand en Phrase ici.

La logique : l'algorithme d'Apple est agressif en Broad Match, génère des impressions peu pertinentes. Mais vous avez construit une liste de mots-clés négatifs dans les couches précédentes, donc cette campagne Broad ne contient que des termes « modérément pertinents ». Résultat : Broad Match fonctionne à CPT $4-6, ROAS atteint 120-150 %.

Budget quotidien $300-500 — le plus gros budget ici. En Broad Match, faites tourner les créatives : changez une page produit personnalisée par semaine, exploitez le creative avec le meilleur TTR pendant 2 semaines. Apple Search Ads : Broad Match représente 50-60 % du flux budgétaire mais génère le ROI le plus élevé car vous travaillez dans un réservoir de mots-clés nettoyé par les négatifs.

## Flux budgétaire et boucle d'optimisation

Budget quotidien total $650-1000. Distribution : Discovery 10 %, Competitor 30 %, Brand 15 %, Broad Match 45 %. Les 2 premières semaines, Discovery domine ; à partir de la semaine 3, Broad Match démarre. À la semaine 4, l'entonnoir s'équilibre et vous atteignez ROAS 130-160 %.

La boucle d'optimisation fonctionne toutes les 2 semaines :
1. Fermez la campagne Discovery, extrayez les mots-clés du Search Match report
2. Transférez-les en Competitor/Broad/Négatif selon la LTV/D7
3. Déplacez les mots-clés Competitor avec CPT > $7 vers Broad Match
4. Ajoutez les termes négatifs de Brand vers Broad Match en Phrase
5. Marquez les mots-clés Broad Match avec impressions > 1000 mais installations < 5 comme négatifs au niveau campagne

Cette boucle fonctionne manuellement — elle peut être automatisée avec l'API Apple Search Ads mais pendant 3 mois faites-la manuellement pour comprendre la logique de l'entonnoir. Roibase exécute cette boucle hebdomadairement dans son [Programme Editeur Premium](/tr/premiumyayunci) car les dynamiques de mots-clés sont rapides sur les marchés Tier-1.

## Apple Search Ads sans entonnoir ne fonctionne pas

Si vous lancez Apple Search Ads avec une seule campagne, soit vous brûlez le budget en Discovery, soit vous manquez du trafic Brand. La structure en entonnoir est obligatoire parce que chaque type de correspondance a un rôle : Discovery explore, Competitor génère du trafic, Brand convertit, Broad Match évolue. Ces 4 couches s'alimentent mutuellement — les mots-clés de Discovery remontent vers Competitor, ceux trop chers en Competitor descendant vers Broad Match, ceux négatifs en Brand sont testés en Phrase dans Broad Match. Sans cette boucle, l'algorithme d'Apple vous propose des mots-clés chers et faible LTV. Avec elle, le ROAS dépasse 130 % en 6-8 semaines, le CPT descend sous $5, la rétention de cohort se distribue équilibrée.