---
title: "Optimisation tarifaire Bayésienne en F2P mobile"
description: "Optimisez les tests de price ladder IAP via estimation posterior et modélisation par segment. Stratégie de tarification basée sur les données."
publishedAt: 2026-07-22
modifiedAt: 2026-07-22
category: gaming
i18nKey: gaming-002-2026-07
tags: [f2p-monetization, bayesian-optimization, iap-pricing, mobile-gaming, data-driven-pricing]
readingTime: 9
author: Roibase
---

Dans les jeux mobiles F2P, les décisions tarifaires reposent souvent sur des hypothèses ou des références « tarifaires du marché ». Un pack starter à 0,99 $, un tier moyen à 4,99 $, un bundle whale à 99,99 $ — cette price ladder est figée dans la plupart des jeux. Or chaque jeu possède une structure de cohortes, un mix géographique et une perception de valeur distincts. L'optimisation tarifaire Bayésienne vous permet de modéliser ces différences via une distribution de probabilité *posterior* et de découvrir le point tarifaire optimal dans chaque segment. Au lieu d'un test A/B classique, construire un système d'apprentissage continu peut améliorer votre taux de conversion IAP de 15 à 40 %.

## Pourquoi l'approche Bayésienne surpasse les tests A/B classiques

Un test A/B classique fonctionne sur une hypothèse fixe : il compare deux prix, par exemple 4,99 $ versus 5,99 $, et attend d'atteindre 95 % de confiance avant de déclarer un gagnant. Cette approche pose deux problèmes : premièrement, pendant la durée du test, le trafic est divisé de moitié et la variante sous-performante continue à être servie aux utilisateurs (coût d'opportunité). Deuxièmement, une fois le test terminé, vous n'avez qu'une décision binaire « A ou B » — vous n'apprenez rien sur les valeurs intermédiaires ou les différences segment-spécifiques.

L'optimisation Bayésienne démarre avec une distribution *prior* (par exemple « le prix pourrait être uniformément distribué entre 3 $ et 7 $ »), ajoute chaque donnée de conversion au *posterior* et met à jour continuellement la distribution de probabilité. De cette manière, des algorithmes comme Thompson Sampling acheminent dynamiquement le trafic vers la variante gagnante — le revenu total est maximisé pendant la durée du test. Par exemple, un test Bayésien sur 10 jours génère 8 à 12 % de revenu supplémentaire, car les points tarifaires sous-optimaux reçoivent un trafic minimal.

De plus, le modèle Bayésien ne vous dit pas seulement « quel prix a gagné », mais « ce prix a 87 % de probabilité d'être optimal ». Cette information accélère l'itération : même à 60 % de confiance, vous pouvez mettre en production un prix et lancer un nouveau test, car la distribution *posterior* porte déjà suffisamment d'information.

## Architecture de prior segment-centrée pour les tests de price ladder IAP

Dans les jeux F2P, tous les utilisateurs ne sont pas équivalents. Bien identifier vos segments de dépenses renforce le *prior* du modèle Bayésien. Segmentation type : **minnows** (lifetime spend < 10 $), **dolphins** (10 $ à 100 $), **whales** (> 100 $). Chaque segment possède une élasticité tarifaire différente — les minnows se convertissent même pour un pack à 0,99 $, tandis que les whales achètent le bundle à 99,99 $ sans regarder le prix.

Pour construire une distribution *prior* par segment, vous avez besoin de données historiques. Par exemple, si votre segment minnow affiche un taux de conversion IAP moyen de 3,2 % entre 0,99 $ et 1,99 $, utilisez 1,49 $ comme prior mean et 0,50 $ comme sigma (hypothèse de distribution normale). Pour le segment whale, si le taux de conversion reste plat entre 49,99 $ et 149,99 $, un *prior* uniforme est plus approprié — ce qui reflète l'hypothèse « les whales sont insensibles au prix » dans votre modèle.

L'avantage du *prior* segment-spécifique est qu'il évite l'apprentissage cross-segment. Un test A/B classique mélange tous les utilisateurs dans un même pool : si les whales convertissent aussi bien sur la variante à bas prix, cela peut masquer le prix optimal pour les minnows. Le modèle Bayésien met à jour le *posterior* séparément pour chaque segment, ce qui révèle des prix optimaux segment-spécifiques — par exemple 1,49 $ pour les minnows, 79,99 $ pour les whales.

### Ajustement du prior en fonction de la géographie

La parité de pouvoir d'achat diffère radicalement entre la Tier-1 (US, UK, JP) et les marchés émergents (BR, TR, IN). Un pack à 4,99 $ semble « bon marché » aux États-Unis, tandis que le même prix (environ ₺150 en Turquie) relève du segment moyen-supérieur. Pour normaliser la distribution *prior* par géographie, utilisez les données ARPU locales. Par exemple, si l'ARPU quotidien IAP est 0,42 $ aux États-Unis et 0,18 $ en Turquie, normalisez le *prior* mean par ce ratio (0,18 / 0,42 = 43 %). Le modèle teste alors la même price ladder relative dans chaque géographie, en intégrant la différence absolue dans le *prior*.

## Estimation posterior et implémentation de Thompson Sampling

Le moteur runtime du modèle Bayésien est l'estimation *posterior*. À chaque impression IAP (affichage d'offre), vous échantillonnez depuis la distribution *posterior* actuelle (par exemple, si la distribution est Beta, utilisez `np.random.beta(alpha, beta)`). Vous montrez au utilisateur le prix correspondant à cet échantillon. Si l'utilisateur achète, vous incrémentez alpha += 1 ; s'il refuse, beta += 1 — le *posterior* se met à jour.

Thompson Sampling utilise ce mécanisme pour router le trafic. Pour chaque variante, il échantillonne une *reward expectation* depuis le *posterior* et sélectionne la variante avec la plus haute récompense attendue. Durant les premiers jours, toutes les variantes reçoivent un trafic équitable (exploration), puis le trafic se concentre vers la variante gagnante (exploitation). L'équilibre repose non pas sur epsilon, mais sur la variance *posterior* — autrement dit, une variante avec variance faible (confiance élevée) accumule davantage de trafic.

Pour l'implémentation pratique, vous pouvez utiliser `scipy.stats.beta` ou `pymc3` en Python. Un bloc de code simple :

```python
import numpy as np
from scipy.stats import beta

# Prior : alpha=1, beta=1 (uniforme)
alpha_a, beta_a = 1, 1  # Variante A (4,99 $)
alpha_b, beta_b = 1, 1  # Variante B (5,99 $)

def select_variant():
    sample_a = np.random.beta(alpha_a, beta_a)
    sample_b = np.random.beta(alpha_b, beta_b)
    return "A" if sample_a > sample_b else "B"

def update_posterior(variant, converted):
    global alpha_a, beta_a, alpha_b, beta_b
    if variant == "A":
        if converted:
            alpha_a += 1
        else:
            beta_a += 1
    else:
        if converted:
            alpha_b += 1
        else:
            beta_b += 1
```

Cette boucle simple converge après 10 000 impressions avec une marge d'erreur de 2 % par rapport au taux de conversion réel (sous l'hypothèse Beta *prior* correcte). En production, vous pouvez mettre à jour quotidiennement les paramètres du *posterior* via BigQuery + Airflow et lancer de nouvelles cohortes avec la distribution actuelle.

## Multi-armed bandit versus modèle Bayésien complet

Dans la littérature d'optimisation tarifaire Bayésienne, deux approches dominent : **multi-armed bandit** (MAB) et **régression Bayésienne complète**. L'approche MAB est Thompson Sampling tel que décrit ci-dessus — elle définit les variantes tarifaires discrètes (par exemple, 5 points tarifaires) en tant que bras, chacun avec son propre *posterior*. Avantages : implémentation simple, empreinte mémoire légère, décisions en temps réel.

La régression Bayésienne complète modélise le prix comme une variable continue et lie la probabilité de conversion au prix via régression logistique ou processus Gaussien. Cette approche offre davantage de flexibilité — par exemple, elle peut apprendre des relations non-linéaires comme « la conversion baisse exponentiellement avec le prix ». Inconvénient : l'entraînement du modèle nécessite BigQuery + une stack Python, les décisions ne peuvent pas être en temps réel (prédictions batch).

Pour les jeux F2P, MAB suffit généralement, car la price ladder est déjà discrète (0,99 $, 2,99 $, 4,99 $, 9,99 $ etc.). La régression Bayésienne complète intervient lorsque vous avez besoin de tarification dynamique — offrir un prix unique à chaque utilisateur — mais cette pratique est interdite par la plupart des politiques d'app store (discrimination tarifaire). Un compromis : MAB par segment avec régression Bayésienne complète intra-segment. Vous trouvez ainsi le point tarifaire optimal dans le segment whale (par exemple, entre 79,99 $ et 149,99 $) via une fonction continue.

## Uplift de revenu et effet LTV de cohorte

Le vrai ROI de l'optimisation tarifaire Bayésienne réside dans le LTV de cohorte. Dans la première semaine du test, le taux de conversion augmente de 8 %, mais le LTV à D30 de ces utilisateurs s'élève de 15 à 20 %. Pourquoi ? Parce que le point tarifaire optimal s'aligne précisément avec la perception de valeur de l'utilisateur — ni trop bas (chute de valeur perçue), ni trop haut (friction). Ces utilisateurs sont plus enclins à acheter un deuxième pack après le premier IAP.

Un exemple concret : dans un RPG mid-core, le modèle Bayésien a proposé 3,49 $ à la place du pack starter à 4,99 $ (segment minnow, géographie US). Le taux de conversion a augmenté de 22 % à 28 % (+27 % en termes relatifs) la première semaine. La rétention D7 est restée stable (42 %), mais l'ARPU à D30 est passé de 2,18 $ à 2,51 $ (+15 %). Pourquoi ? Le prix de 3,49 $ a abaissé le seuil psychologique « Je peux investir dans ce jeu », réduisant la friction avant le second achat. Le LTV total de la cohorte a augmenté de 8,90 $ à 10,20 $ (+15 %).

Pour mesurer cet effet, l'analyse de cohorte est obligatoire. Dans BigQuery, suivez les colonnes `user_id`, `install_date`, `first_iap_price`, `d7_revenue`, `d30_revenue`. Marquez le variant Bayésien via `experiment_group`, puis comparez les courbes LTV avec le groupe contrôle. Les tests de significativité sont précoces dans les 7 premiers jours ; la confiance augmente à D30.

## Idées fausses courantes et compromis

Une idée fausse répandue : l'optimisation tarifaire Bayésienne « gagne immédiatement ». En réalité, la convergence du *posterior* exige un minimum de 5 000 à 10 000 impressions par segment. Pour les jeux à faible trafic (DAU < 50k), la durée du test s'allonge à 4-6 semaines. Pendant ce laps de temps, votre pipeline de données (logging d'impression, suivi de conversion, mise à jour du *posterior*) doit fonctionner de manière fiable — un seul bug corrompt tout le *posterior*.

Un deuxième compromis concerne la granularité des segments. Si vous définissez des segments très fins (par exemple, « L5-10, US, Android, whale »), chaque segment reçoit un nombre d'impressions insuffisant et le *posterior* reste à variance élevée. Règle pratique : chaque segment doit générer au moins 200 impressions IAP par jour. En dessous, regroupez les segments (par exemple, US + UK + CA deviennent un seul segment « Tier-1 EN »).

Un troisième point concerne l'effet psychologique d'un changement de price ladder. Si l'utilisateur a vu 4,99 $ hier et voit 3,99 $ aujourd'hui, il perçoit une « remise » et convertit davantage — mais cet effet n'est pas durable. Pendant le test Bayésien, gardez la plage tarifaire étroite (±20 % maximum) et évitez les changements radicaux (par exemple, 4,99 $ → 1,99 $).

## Scale et automatisation post-test

L'optimisation tarifaire Bayésienne n'est pas un test unique, mais un système d'apprentissage continu. Une fois le test terminé, vous déployez le prix gagnant en production, mais vous conservez la distribution *posterior* pour l'utiliser comme *prior* pour les nouvelles cohortes. Par exemple, pendant la saison des fêtes Q4, l'ARPU augmente de 30 % — le *posterior* du trimestre précédent devient le nouveau *prior*, et le modèle converge rapidement vers le nouvel optimum (warm start au lieu de cold start).

Vous pouvez automatiser le processus via Airflow + BigQuery + Firebase Remote Config. Chaque jour, un DAG Airflow lit les paramètres du *posterior* depuis BigQuery et écrit les nouvelles variantes tarifaires dans Firebase Remote Config. Le client SDK récupère la configuration, affiche l'offre IAP. L'événement de conversion est enregistré dans BigQuery, le *posterior* se met à jour — la boucle se ferme. La première implémentation prend 2-3 semaines, puis elle fonctionne sans intervention manuelle.

L'étape finale : si vous souhaitez scaler le modèle Bayésien sur plusieurs jeux, créez un « pricing service » centralisé. Chaque jeu envoie ses métadonnées (genre, mix géographique, ARPU), et le service propose une distribution *prior* adaptée au profil du jeu. De cette manière, les nouveaux jeux évitent le problème de cold start et exploitent le transfer learning à partir du *posterior* des jeux similaires. Le service de [Optimisation d'App Store](https://www.roibase.com.tr/fr/aso) de Roibase intègre ce type de pipeline d'apprentissage cross-app avec les tests de créatifs ASO — le même framework Bayésien s'applique aux variantes de page produit.

---

L'optimisation tarifaire Bayésienne est l'