---
title: "Optimisation Bayésienne des Prix en F2P Mobile"
description: "Optimisez vos tests IAP avec l'estimation posterior. Segmentation, durée de test, trade-offs de conversion — framework éprouvé pour augmenter le revenue F2P."
publishedAt: 2026-06-24
modifiedAt: 2026-06-24
category: gaming
i18nKey: gaming-002-2026-06
tags: [monetisation-f2p, optimisation-bayesienne, test-iap, jeux-mobiles, strategie-tarifaire]
readingTime: 8
author: Roibase
---

Dans les jeux F2P mobiles, l'optimisation tarifaire fonctionne encore selon la logique des tests A/B classiques : deux price points, 7-14 jours, on choisit le gagnant. Mais quand le taux de conversion passe de 2,8 % à 3,1 %, s'agit-il vraiment d'un gain, ou avez-vous sacrifié le segment des *whales* en réduisant le LTV global ? Le test A/B fréquentiste répond « quel variant a gagné », mais pas « quel prix, pour quel segment, à quel moment ? ». L'optimisation Bayésienne des prix comble cette lacune : en mettant à jour votre échelle IAP sur la distribution *posterior*, vous optimisez simultanément la conversion et le revenue segment-spécifique.

## Pourquoi le Test A/B Fréquentiste Est Insuffisant en F2P

Le test A/B classique repose sur deux hypothèses : (1) le comportement utilisateur est stable pendant la durée du test, (2) le variant gagnant est optimal pour tous les segments. En F2P, les deux sont faux. Le comportement change drastiquement à J1, J7, et J30 — le même prix performera différemment selon les cohortes de rétention. Prenez cet exemple : le starter pack à 4,99 $ affiche une conversion de 3,5 %, le variant à 9,99 $ de 2,8 % — logique A/B, le 4,99 $ gagne. Pourtant, l'analyse LTV sur 30 jours révèle que le variant à 9,99 $ génère 42 % de *lifetime spend* supplémentaire chez les *whales* (top 5 % des dépensiers). Le test fréquentiste ne voit pas cette dynamique car il n'estime pas les posteriors par segment.

Le second problème : la durée fixe du test. Un A/B dure 14 jours, décision prise — mais vous n'avez peut-être pas atteint la puissance statistique requise. Avec Bayes, la distribution *posterior* se met à jour en continu ; vous pouvez arrêter tôt si la confiance est suffisante, ou prolonger si le résultat est ambigu. C'est critique en F2P car le calendrier *live ops* n'attend pas deux semaines — un nouvel événement arrive, le contexte change, votre test devient obsolète.

Troisième problème : la logique binaire. Le test fréquentiste dit « A gagne », mais en F2P, il n'y a pas de gagnant absolu — le bon prix est le bon prix pour le bon segment au bon moment. L'optimisation Bayésienne, via l'estimation *posterior*, fournit pour chaque segment la fourchette de prix optimale, ce qui alimente un moteur de *dynamic pricing*.

## Test Bayésien de l'Échelle IAP : Optimisation Itérative par Estimation Posterior

L'optimisation Bayésienne des prix fonctionne sur trois couches : prior (données antérieures + connaissance métier), fonction de vraisemblance (conversion data actuelle), distribution *posterior* (leur produit — croyance mise à jour). Voici comment l'appliquer aux tests IAP :

**Établir le prior :** Vous disposez de données de tests prix antérieurs. Par exemple, pour un IAP à 4,99 $, votre prior de taux de conversion est Beta(120, 3800) — 120 conversions, 3800 impressions. C'est la baseline de votre jeu. Pour un nouveau test avec un prix à 6,99 $, calibrez le prior selon la connaissance métier : une hausse de 40 % du prix entraîne généralement une baisse de 25-35 % de la conversion (élasticité entre -0,6 et -0,9). Votre prior pourrait être Beta(80, 3840).

**Mise à jour par vraisemblance :** Le test démarre, chaque jour apporte de nouvelles données de conversion. Le framework Bayésien met à jour le *posterior* quotidiennement. Au jour 3, le variant à 6,99 $ affiche 45 conversions sur 1200 impressions — vraisemblance Beta(45, 1155). Posterior = prior × vraisemblance = Beta(125, 4995). Vous obtenez une estimation du taux de conversion actuel : 125/(125+4995) ≈ 2,44 %. L'important : ce n'est pas qu'une estimée ponctuelle, c'est une distribution — intervalle de crédibilité à 95 % : [2,1 %, 2,8 %]. Autrement dit, la conversion se situe entre 2,1 % et 2,8 % avec 95 % de probabilité.

**Allocation dynamique par Thompson Sampling :** En A/B classique, le trafic est réparti 50-50. Avec l'optimisation Bayésienne, vous utilisez Thompson Sampling : à chaque impression, tirez un échantillon de la distribution *posterior*, présentez le variant avec le revenue attendu le plus élevé. Ainsi, au fur et à mesure du test, le trafic bascule vers le meilleur variant, sans jamais arrêter l'exploration. C'est crucial en F2P car les *whales* sont peu nombreux mais très précieux — les écarter trop tôt signifie les perdre.

Exemple de code (Python + PyMC) :

```python
import pymc as pm
import numpy as np

# Prior : conversion IAP à 4,99 $
prior_alpha_499 = 120
prior_beta_499 = 3800

# Variant à 6,99 $ — nouveau test
conversions_699 = 45
impressions_699 = 1200

with pm.Model() as price_test:
    # Mise à jour du posterior
    conv_rate_699 = pm.Beta('conv_rate_699', 
                             alpha=prior_alpha_499*0.7 + conversions_699,
                             beta=prior_beta_499*1.0 + (impressions_699 - conversions_699))
    
    # Attente de revenue (prix IAP × conversion)
    expected_revenue = conv_rate_699 * 6.99
    
    # Sampling
    trace = pm.sample(2000, return_inferencedata=True)

# Intervalle de crédibilité 95 %
print(pm.summary(trace, var_names=['conv_rate_699']))
```

Cette approche vous dit « au jour 3, la conversion à 6,99 $ est entre 2,1 % et 2,8 %, revenue attendu 0,17 $/utilisateur » — et l'intervalle se réduit à mesure que le test progresse.

## Optimisation par Segment : Whale, Dolphin, Minnow

En F2P, tous les utilisateurs ne réagissent pas au même prix de la même façon. Sans estimation *posterior* par segment, vous optimisez la conversion moyenne mais sacrifiez le revenue segment-spécifique. Trois segments clés :

**Whale (top 5 % des dépensiers) :** LTV > 200 $, 8+ IAP, rétention D30 > 85 %. Peu sensible au prix — un IAP à 9,99 $ avec 15 % moins de conversion peut quand même générer 60 % plus de *lifetime spend*. L'estimation *posterior* par segment répond : « Le prix de 9,99 $ est-il optimal pour les *whales*, ou 14,99 $ génère-t-il un meilleur LTV ? » Vous isolez les conversions des *whales* et mettez à jour la distribution *posterior* whale-spécifique. Exemple : conversion globale à 9,99 $ = 2,8 %, mais chez les *whales* = 6,2 % — testez des prix plus élevés pour ce segment.

**Dolphin (25 % intermédiaires) :** LTV 20-50 $, 2-4 IAP, rétention D30 50-70 %. Sensibilité au prix modérée. Le test Bayésien identifie généralement la fourchette optimale pour les *dolphins* : entre 4,99 $ et 6,99 $. La distribution *posterior* peut être bimodale — certains *dolphins* se comportent comme des *whales* (pics de dépense le weekend), d'autres glissent vers le segment *minnow*. Un raffinement de segmentation est nécessaire.

**Minnow (70 % restants) :** LTV < 10 $, majoritairement non-payeurs. Très sensibles au prix — même 2,99 $ vs 4,99 $ change la conversion de 40 %. Le test Bayésien révèle généralement : le prix le plus bas (0,99-1,99 $) maximise la conversion mais le revenue total chute. Stratégie : utilisez 0,99 $ comme premier IAP pour convertir les *minnows*, puis dirigez-les vers l'échelle 4,99 $.

Modèle Bayésien hiérarchique pour estimation par segment :

```python
with pm.Model() as hierarchical_price:
    # Prior global de conversion
    global_alpha = pm.Gamma('global_alpha', alpha=2, beta=0.1)
    global_beta = pm.Gamma('global_beta', alpha=2, beta=0.1)
    
    # Conversion segment-spécifique
    conv_whale = pm.Beta('conv_whale', alpha=global_alpha, beta=global_beta)
    conv_dolphin = pm.Beta('conv_dolphin', alpha=global_alpha, beta=global_beta)
    conv_minnow = pm.Beta('conv_minnow', alpha=global_alpha, beta=global_beta)
    
    # Vraisemblance (données segment)
    whale_obs = pm.Binomial('whale_obs', n=200, p=conv_whale, observed=12)
    dolphin_obs = pm.Binomial('dolphin_obs', n=800, p=conv_dolphin, observed=24)
    minnow_obs = pm.Binomial('minnow_obs', n=3000, p=conv_minnow, observed=60)
    
    trace = pm.sample(3000)
```

Ce modèle relie les conversions *whale*, *dolphin*, *minnow* via un prior global — même avec peu d'observations par segment, vous obtenez des estimées raisonnables.

## Durée de Test et Règle d'Arrêt : Décision par Probabilité Posterior

En A/B classique, la durée du test est fixée à l'avance (14 jours, minimum 1000 conversions). Avec l'optimisation Bayésienne, la règle d'arrêt repose sur la probabilité *posterior* : « La probabilité que le variant A surpasse le variant B dépasse-t-elle 95 % ? » Cette pause dynamique raccourcit le test tout en réduisant le risque de faux positif.

**Exemple de règle d'arrêt :** Test 4,99 $ vs 6,99 $. Chaque jour, vous calculez la probabilité *posterior* :

```python
# Échantillons posterior
samples_499 = trace.posterior['conv_rate_499'].values.flatten()
samples_699 = trace.posterior['conv_rate_699'].values.flatten()

# Comparaison revenue (prix × conversion)
revenue_499 = samples_499 * 4.99
revenue_699 = samples_699 * 6.99

# Probabilité que 6,99 $ soit meilleur
prob_699_better = (revenue_699 > revenue_499).mean()
print(f"P(6,99 $ > 4,99 $) = {prob_699_better:.2%}")
```

Jour 5 : P(6,99 $ > 4,99 $) = 73 % — trop tôt. Jour 9 : 94 % — sous le seuil 95 %. Jour 12 : 96 % — arrêtez, 6,99 $ est optimal. Cette approche économise 2-5 jours par rapport au fréquentiste.

**Durée minimale du test :** Même si Bayes stoppe tôt, en F2P testez au minimum 7 jours — la première semaine révèle les pics de rétention, le comportement des dépensiers du weekend, l'effet événement. Une pause avant 7 jours biaise le *posterior*.

**Minimisation du regret :** Avec Thompson Sampling, vous attribuez du trafic au variant suboptimal (exploration). Le regret = revenue optimal - revenue réel. Le framework Bayésien minimise le regret car à mesure que le *posterior* se met à jour, l'exploration décroît et l'exploitation s'accroît. Sur un test de 14 jours : premiers 5 jours ≈ 30 % regret, derniers 5 jours ≈ 5 % regret — regret moyen 15 %. En A/B classique avec répartition 50-50 permanente : regret moyen 25-30 %.

## Production : Moteur de Dynamic Pricing et Raffinement Posterior Continu

Le test est terminé, 6,99 $ a gagné — mais ce n'est que le début. La vraie puissance de l'optimisation Bayésienne en prix émerge en production avec un raffinement *posterior* continu.

**Architecture du moteur *dynamic pricing* :** À chaque session utilisateur, vous estimez le segment (prédiction LTV, cohorte de rétention, vélocité de dépense). En fonction du segment, vous samplez de la distribution *posterior* pour obtenir le price point optimal. Exemple : nouvel utilisateur, rétention D1 à 80 %, aucun IAP encore — le *prior* *minnow* domine, vous samplez dans la fourchette 0,99-1,99 $. Même utilisateur au jour 7 après 2 IAP pour 8 $ total — le *posterior* *dolphin* se renforce, vous basculez à la fourchette 4,99-6,99 $.

**Raffinement du posterior :** En production, chaque conversion met à jour le *posterior*. Après 30 jours, 1200 conversions supplémentaires à 6,99 $ : prior Beta(125, 4995), nouveau *posterior* Beta(1325, 46995). L'intervalle de crédibilité s'affine : [2,7 %, 2,9 %]. Vous avez 95 % de confiance en 6,99 $. Mais le marché change — un concurrent lance une campagne à 4,99 $, la conversion chute — le *posterior* s'élargit à nouveau, un nouveau test se déclenche.

**Intégration bandit multi-armé :** Si votre échelle IAP contient plusieurs SKU (starter pack 4,99 $, mega pack 19,99 $, ultimate 49,99 $), Thompson Sampling devient un algorithme bandit en production. À chaque impression, vous tirez un échantillon de chaque SKU, présentez celui avec le revenue attendu maximal. Combiné à des efforts d