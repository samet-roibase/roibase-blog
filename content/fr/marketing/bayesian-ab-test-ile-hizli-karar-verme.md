---
title: "Test Bayésien A/B : Décisions Rapides et Fondées"
description: "Dépassez les limites du test fréquentiste. Maîtrisez les tests séquentiels, la taille d'échantillon dynamique et le test A/B bayésien pour prendre des décisions en quelques jours dans le performance marketing."
publishedAt: 2026-05-09
modifiedAt: 2026-05-09
category: marketing
i18nKey: marketing-002-2026-05
tags: [ab-testing, statistiques-bayesiennes, optimisation-conversion, performance-marketing, tests-sequentiels]
readingTime: 9
author: Roibase
---

Dans le performance marketing, la vitesse de test est un avantage concurrentiel. Avec le test A/B fréquentiste, tu attends deux semaines avant l'intervalle de confiance — ton budget de campagne se consume pendant ce temps. L'approche bayésienne te donne une distribution a posteriori mise à jour chaque jour : tu peux affirmer « la variante B gagne avec 73 % de probabilité » avant même que le test soit terminé. Cet article explique la mécanique du test A/B bayésien, les règles de décision séquentielle et la dynamique de la taille d'échantillon. Tu passes de l'horizon fixe du fréquentiste à la mise à jour continue des décisions dans le flux de données quotidien.

## Le Problème de l'Horizon Fixe dans le Test Fréquentiste

Le test A/B classique repose sur la p-valeur et une taille d'échantillon fixe. Tu commences avec un plan : « j'ai besoin de n=5000 visiteurs, ce qui prendra 14 jours », et tu ne peux pas prendre de décision avant le jour 14. Pendant ce temps, tu envoies du trafic à la variante perdante — même si son taux de conversion est 2 points plus bas, tu dois respecter le plan et attendre. Si tu arrêtes tôt, tu risques d'augmenter l'erreur de type I et d'introduire le problème des tests multiples.

La logique fréquentiste offre une p-valeur < 0,05 pour la signification statistique, mais en pratique, tu rencontres des cas « statistiquement significatifs mais sans valeur métier ». Par exemple, un lift de 0,5 % peut être statistiquement significatif (grâce à une grande taille d'échantillon) mais sans impact réel. Il faut distinguer la largeur de l'intervalle de confiance et la taille d'effet — le cadre fréquentiste ne le montre pas automatiquement.

Une autre limitation : tu ne peux pas faire de monitoring séquentiel. Tu calcules la taille d'échantillon avant le test et attends de l'atteindre. Si l'une des variantes gagne clairement pendant ce temps, tu dois continuer pour ne pas « peeking » et invalider la p-valeur. C'est inefficace et coûteux.

## Test Bayésien : Distribution A Posteriori Mise à Jour

L'approche bayésienne fonctionne selon la logique : prior belief + data = posterior. Avant le test, tu définis une distribution a priori pour le taux de conversion de chaque variante (généralement Beta(1,1) non-informatif ou un prior informatif basé sur les données historiques). Avec chaque visiteur, le théorème de Bayes met à jour la distribution a posteriori. Au 100ᵉ visiteur, tu as une forme de posterior ; au 200ᵉ, une autre — mise à jour continue.

La distribution a posteriori montre exactement « la densité de probabilité du vrai taux de conversion de cette variante ». Par exemple, Beta(25, 75) indique une densité de probabilité élevée entre 20 % et 30 % pour le taux de conversion. En comparant les posteriori des deux variantes, tu calcules « la probabilité que B soit meilleure que A » — cette formule P(B > A) est naturelle dans le monde bayésien.

La version bayésienne du test séquentiel : mets à jour la posteriori chaque jour et arrête le test si P(B > A) > 0,95. Ce seuil dépend de ta tolérance au risque — tu peux utiliser 0,90 ou 0,99 à la place. Le fréquentiste n'a pas de mécanisme de ce type ; sa seule règle de décision est l'horizon fixe. Le bayésien peut prendre une décision à tout moment parce que la distribution a posteriori fournit une information complète.

Dans un test bayésien, il n'y a pas de p-valeur. À la place, tu as : la probabilité de supériorité (P(B > A)), la perte attendue (E[Loss] — le lift qu'tu perds si tu choisis A mais que B est meilleur), et l'intervalle de crédibilité (l'intervalle de 95 % autour de la posteriori). Ceux-ci sont plus interprétables : « la variante B gagne avec 85 % de probabilité et, si elle gagne, le lift moyen est entre 2,3 et 3,1 % ».

### Code de Mise à Jour de la Posteriori

```python
import numpy as np
from scipy.stats import beta

# Prior : Beta(1,1) = uniforme
prior_alpha, prior_beta = 1, 1

# Données arrivantes : variante A avec 50 conversions, 200 visites
conversions_A = 50
visits_A = 200
failures_A = visits_A - conversions_A

# Posteriori : Beta(alpha + conversions, beta + failures)
post_alpha_A = prior_alpha + conversions_A
post_beta_A = prior_beta + failures_A

# Échantillonne depuis la distribution posteriori
samples_A = beta.rvs(post_alpha_A, post_beta_A, size=10000)

# Même chose pour la variante B
conversions_B = 60
visits_B = 200
failures_B = visits_B - conversions_B
post_alpha_B = prior_alpha + conversions_B
post_beta_B = prior_beta + failures_B
samples_B = beta.rvs(post_alpha_B, post_beta_B, size=10000)

# Calcule P(B > A)
prob_B_wins = (samples_B > samples_A).mean()
print(f"P(B > A): {prob_B_wins:.2%}")  # Exemple : 0.82 = B gagne avec 82 % de probabilité
```

## Taille d'Échantillon Dynamique et Arrêt Précoce

Dans un test bayésien, la taille d'échantillon n'est pas fixe. Tu peux définir un minimum au départ (par exemple, 1000 visiteurs pour que la posteriori ne soit pas trop large) mais aucun maximum fixe. Dès que tu atteins le seuil P(B > A) > 0,95, tu arrêtes — ce peut être au 500ᵉ visiteur ou au 5000ᵉ.

La métrique *expected loss* est excellente pour les décisions précoces. Elle formule : `E[Loss] = E[max(0, CR_winner - CR_chosen)]`. Si tu choisis A mais que B est réellement meilleur, tu perds la différence de taux de conversion attendue. Tu fixes un seuil, par exemple « E[Loss] < 0,5 % », ce qui signifie « au pire des cas, je ne perds que 0,5 % de lift » et arrête le test avec confiance. Cette métrique facilite la prise de décision averse au risque.

Exemple de règle d'arrêt séquentiel :

| Métrique | Seuil | Action |
|---|---|---|
| P(B > A) | > 0,95 | Déclare B comme gagnant |
| P(A > B) | > 0,95 | Déclare A comme gagnant |
| E[Loss] | < 0,005 | Arrête et ferme la variante perdante |
| Visite minimum | < 1000 | Ne décide pas encore |

Grâce à ces règles, la durée du test raccourcit en moyenne de 30 à 40 % (selon les données de Google Optimize et VWO). Dans les scénarios avec un grand effet, tu peux décider avec 95 % de confiance en 3 jours — au lieu des 14 jours du fréquentiste.

La différence avec un multi-armed bandit : le test A/B bayésien ne fait toujours pas d'optimisation exploration-exploitation ; il met à jour simplement la posteriori et applique une règle d'arrêt. L'algorithme bandit optimise dynamiquement la distribution du trafic (par exemple, Thompson Sampling) — chaque impression envoie plus de trafic à la variante gagnante. Le test bayésien est plus conservateur : la répartition reste fixe (50/50), l'arrêt est juste plus rapide. Le bandit est plus agressif pour minimiser le regret — la perte du trafic vers les variantes perdantes.

## Prior Informatif et Test d'Incrementalité

Le choix du prior est le point critique du test bayésien. Un prior non-informatif (Beta(1,1)) ignore la connaissance passée, produisant une posteriori entièrement pilotée par les données. Un prior informatif provient de tests antérieurs ou du taux de conversion de base par segment. Par exemple, si la moyenne de 50 tests précédents sur mobile est 12 %, tu peux utiliser Beta(60, 440) (environ 12 % de moyenne, avec variabilité).

L'avantage d'un prior informatif : il réduit la taille d'échantillon requise. La mise à jour a posteriori commence à partir d'une prédiction informée, pas de zéro. L'inconvénient : un prior mal choisi introduit un biais. Si le segment change ou l'effet saisonnier s'applique, un prior ancien trompe. Par conséquent, une analyse de sensibilité du prior est nécessaire — vérifie si les résultats du test changent avec différents priors.

Dans [l'optimisation du taux de conversion](https://www.roibase.com.tr/fr/cro), le test bayésien simplifie la mesure de l'incrementalité. Pour l'incrementalité, tu as besoin d'un groupe holdout ou d'une répartition géographique. Avec Bayes, tu compares la posteriori du taux de conversion du groupe holdout avec celle du groupe de test — tu obtiens une distribution du lift. Au lieu d'un test t classique, tu calcules P(lift > 0), ce qui est plus interprétable. Par exemple : « la nouvelle campagne a 78 % de probabilité d'être incrementale, avec un lift attendu entre 1,2 et 2,8 % ».

### Comparaison du Choix du Prior

```python
# Prior non-informatif
prior_uninf = beta(1, 1)

# Prior informatif : historique 12 % de conversion, n=500
# Beta mean = alpha / (alpha + beta) → 60/500 = 0.12
prior_inf = beta(60, 440)

# Posteriori avec 20 conversions, 100 visites
conversions, visits = 20, 100
post_uninf = beta(1 + conversions, 1 + (visits - conversions))
post_inf = beta(60 + conversions, 440 + (visits - conversions))

# Moyennes a posteriori
print(f"Moyenne posteriori non-informatif : {post_uninf.mean():.2%}")  # ~20 %
print(f"Moyenne posteriori informatif : {post_inf.mean():.2%}")        # ~13.3 %
```

Le prior non-informatif est très sensible aux petits échantillons ; le prior informatif régularise avec la connaissance passée.

## Compromis : Test Bayésien vs Fréquentiste vs Bandit

Le test bayésien n'est pas optimal dans tous les scénarios. Dans les environnements réglementaires (notamment santé, finance), le test fréquentiste est préféré car la p-valeur est un standard établi ; les processus d'évaluation par les pairs reposent dessus. Le choix du prior bayésien peut sembler subjectif. Si la régulation exige une p-valeur et que la durée du test est fixe (par exemple, 30 jours obligatoires), le fréquentiste est rationnel.

Les algorithmes bandit (Thompson Sampling, UCB) équilibrent automatiquement exploration-exploitation et optimisent la répartition du trafic. Pour les tests long terme (3+ semaines), le bandit surpasse le bayésien car il envoie moins de trafic à la variante perdante. Pour les tests courts (1-2 semaines), le test A/B bayésien suffit — la minimisation du regret du bandit n'offre peu de différence à court terme.

Si la taille d'échantillon est très petite (par exemple, 100 visiteurs/jour), le bayésien aussi bien que le fréquentiste sont insuffisants. La distribution a posteriori devient si large que P(B > A) n'atteint jamais 95 %. En tels cas, mesure une micro-conversion (clic, ajout au panier, plus fréquent) ou préfère un test agrégé géographiquement. Le test bayésien n'offre pas d'avantage avec un petit échantillon — il fournit juste des sorties plus interprétables.

La vraie force du test bayésien : l'orchestration de tests multi-canaux. Si tu testes une créative sur le canal payant et, simultanément, une page de destination pour la CRO, tu peux combiner les posteriori des deux (posteriori conjointe) et attribuer les contributions de lift. Le fréquentiste exigerait une ANOVA complexe ; le bayésien le fait naturellement avec MCMC (Chaîne de Markov Monte-Carlo).

## Mise en Œuvre Pratique : Plateformes et Outillage

Google Optimize (qui a fermé ses serveurs) utilisait un moteur bayésien. Aujourd'hui, pour les tests bayésiens en open-source, il existe la bibliothèque Python `bayesian-testing` ou le paquet R `bayesAB`. En production, tu construis ton propre stack — tu peux calculer la posteriori dans BigQuery avec une UDF SQL ou créer un modèle dbt comme pipeline a posteriori.

Exemple de macro dbt : les données de test arrivent quotidiennement ; la macro met à jour les paramètres alpha/beta a posteriori et calcule P(B > A). Si le seuil est atteint, elle envoie une notification Slack. Ainsi, au lieu de surveiller manuellement, une règle d'arrêt automatique fonctionne. En plus, tu extrais l'intervalle de crédibilité et la perte attendue vers un tableau de bord — les parties prenantes voient « actuellement, B gagne avec 82 % de probabilité » au lieu de demander « quand décidons-nous ? ».

Les plateformes de test A/B (VWO, Optimizely) ont ajouté un moteur bayésien mais ne le font pas par défaut ; ils affichent les résultats bayésiens à côté des résultats fréquentistes. Car le choix du prior est ton paramètre et ne peut pas être automatisé par la plateforme. La plateforme présume un prior non-informatif ; si tu veux un prior informatif, une configuration personnalisée est nécessaire. C'est pourquoi, à grande échelle, l'outillage interne est préféré.

Le test multi-variante (A/B/C/D) est plus simple en bayés