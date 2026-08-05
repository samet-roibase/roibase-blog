---
title: "Optimisation Bayésienne des Prix dans les F2P Mobile"
description: "Optimiser les paliers de prix des IAP avec des tests bayésiens : estimation posterior, tarification segmentée et méthodologie de calcul du lift revenue."
publishedAt: 2026-08-05
modifiedAt: 2026-08-05
category: gaming
i18nKey: gaming-002-2026-08
tags: [monetisation-f2p, test-bayesien, optimisation-iap, price-ladder, mobile-gaming]
readingTime: 9
author: Roibase
---

Dans les jeux F2P mobile, l'optimisation des prix IAP se réduit souvent à un simple test A/B : comparez deux prix, choisissez celui qui génère le plus de revenue. Cette approche fonctionnait en 2018 — les coûts d'acquisition étaient bas et les problèmes de taille d'échantillon n'existaient pas. En 2026, la situation est différente : après iOS 14.5, le suivi des cohortes est fragmenté, le CPI Apple Search Ads a augmenté de 340 %, les durées de test sont passées de 8 à 14 semaines. La méthodologie bayésienne offre deux avantages majeurs dans ces conditions : elle permet de prendre des décisions précoces via la distribution posterior, et la segmentation renforce le modèle grâce aux *priors* informatifs. En économie des jeux, l'élasticité des prix n'est pas constante — elle varie significativement entre les segments whale/dolphin/minnow, et capture cette différence dépasse les capacités des tests A/B fréquentistes.

## La Logique Économique des Tests Bayésiens

En F2P mobile, le coût d'un test de prix ne se limite pas au temps de développement : il inclut le *coût d'opportunité*. Si vous testez un passage de $4.99 à $6.99 pendant 14 semaines, la revenue perdue en attendant le bon prix est elle-même un coût du test. L'approche bayésienne met à jour la distribution posterior chaque jour — au lieu d'une conversion de 2,3 %, vous avez un intervalle de crédibilité à 95 % : 1,8 % à 2,9 %. Cet intervalle se rétrécit progressivement, et lorsqu'il devient suffisamment étroit, la décision devient évidente et le test peut s'arrêter prématurément.

En A/B fréquentiste, vous calculez la taille d'échantillon minimale pour atteindre une *p*-value < 0,05, puis attendez d'atteindre ce nombre. Or, la taille des cohortes varie quotidiennement dans les jeux mobiles : une nouvelle fonctionnalité augmente le DAU de 40 %, ou la saisonnalité estivale le réduit de 25 %. Le modèle bayésien interprète ces fluctuations comme des mises à jour du *prior*, sans se laisser piéger par un plan de taille d'échantillon fixe.

Exemple concret : dans un jeu avec 10 000 DAU, vous testez le prix du starter pack à $9.99. Le calcul fréquentiste requiert 42 000 utilisateurs pour détecter un lift de revenue de 5 % pendant 6 semaines. Le modèle bayésien, à la 3e semaine, affiche une moyenne posterior de $11.2 ARPPU pour le variant, $10.8 pour le contrôle, avec des intervalles de crédibilité qui ne se chevauchent pas — décision prise. Le test s'arrête. Les 3 semaines de revenue perdue sont récupérées.

### Sélection du *Prior* et Segmentation

Dans les tests bayésiens, le choix de la distribution *prior* n'est pas subjectif — il est fondé sur les données historiques. Si vous avez testé 8 paliers de prix entre $4.99 et $9.99 l'année précédente sur un jeu similaire, vous extrayez une distribution bêta *prior* de ces données. Le *prior* peut être faible (variance élevée) mais il est supérieur à un *prior* uniforme non informatif, car vous savez que le taux de conversion des whale ne descendra jamais sous 0,5 %.

La segmentation renforce le *prior* : vous utilisez un *prior* non informatif pour les nouveaux utilisateurs, et un *prior* serré pour les utilisateurs avec 30+ jours de rétention. Un modèle bayésien hiérarchique estime simultanément les paramètres au niveau du segment et au niveau global — chaque segment utilise ses propres données tout en partageant la tendance globale. Cette approche prévient l'overfitting dans les petits segments.

## Architecture de la Price Ladder IAP

Dans les jeux F2P, la price ladder n'est pas plate mais distribuée sur une échelle logarithmique : $0.99, $2.99, $4.99, $9.99, $19.99, $49.99, $99.99. Ces paliers ont une justification psychologique (charm pricing) mais surtout économique : chaque étape capture un segment de willingness-to-pay différent. Dans l'optimisation bayésienne, chaque palier possède sa propre posterior, et ils s'influencent mutuellement — si vous augmentez $4.99, la conversion à $2.99 peut baisser (downgrade), tandis que $9.99 augmente (upgrade).

Dans le test d'une ladder complète, vous n'optimisez pas un prix unique mais toute l'escalade. Un algorithme *multi-armed bandit* traite chaque point de prix comme un « bras », utilisant Thompson Sampling pour puiser dans la posterior actuelle et sélectionner le prix d'expected revenue maximal. Les deux premières semaines, tous les bras reçoivent 14 % du trafic chacun (exploration uniforme). À partir de la 3e semaine, à mesure que la confiance posterior augmente, l'exploitation prend le pas.

Exemple de scénario : ladder à 7 paliers, test de 21 jours. Jours 1-7, chaque prix reçoit 14 % du trafic. À partir du jour 8, le prix avec le plus haut (posterior mean × conversion rate) attire le trafic. Au jour 21, $4.99 reçoit 40 % du trafic, $9.99 reçoit 25 %, les autres 5-10 % chacun. En conclusion, les deux paliers restent actifs car ils génèrent tous deux une marginal revenue positive sans se cannabaliser.

### Tarification Basée sur les Segments

Les segments whale/dolphin/minnow ne réagissent pas au même prix car l'élasticité est différente. Les whale (top 1 % des dépensiers) qui achètent des paquets à $99.99 voient leur conversion baisser de seulement 3 % si le prix augmente de 20 % — *inélastique*. Les minnow (utilisateurs qui achètent $0.99 en premiers 7 jours) baissent leur conversion de 18 % pour une augmentation de 10 % du prix — *élastique*. Le modèle bayésien encode cette élasticité dans le *prior* au niveau du segment.

La segmentation utilise des features : jours depuis l'installation (D1/D7/D30), total dépensé, temps écoulé depuis le dernier IAP, fréquence des sessions, progression du niveau. Ces features construisent un *prior* de segment latent — un modèle hiérarchique estime également l'appartenance au segment. Ainsi, quand un nouvel utilisateur arrive, ses 24 premières heures de comportement permettent une prédiction de segment et un affichage de prix adapté.

Dans le travail d'[optimisation de l'App Store](/tr/aso) chez Roibase, une segmentation similaire est utilisée : les résultats des tests créatifs varient selon le segment d'utilisateur — une même création affiche 8 % d'IPM sur iOS 16+ mais seulement 3 % sur iOS 15. L'intégration de l'ASO à l'optimisation IAP assure la cohérence de l'entonnoir — afficher le bon prix au bon utilisateur exige d'abord d'attirer le bon utilisateur.

## Estimation Posterior et Mécanisme de Décision

Dans un test bayésien, la métrique de décision est la *probability of superiority* : P(treatment > control | data). Quand cette probabilité dépasse 95 %, le traitement gagne. La différence avec la *p*-value fréquentiste est fondamentale : une *p*-value mesure l'extrêmité des données sous l'hypothèse nulle, tandis que la probabilité posterior estime directement « la probabilité que le treatment soit meilleur ».

Pour calculer la posterior, si vous utilisez un *prior* conjugué, il existe une solution analytique (bêta-binomiale). Sinon, une simulation MCMC (Markov Chain Monte Carlo) est nécessaire. Dans les tests gaming mobile, une combinaison binomiale pour la conversion + distribution lognormale pour la revenue fonctionne bien. PyMC3 ou Stan exécutent 10 000 itérations MCMC en 30 secondes ; la mise à jour quotidienne des données rafraîchit la posterior.

Le seuil de décision peut être fixé à 90 % au lieu de 95 % — en phase de croissance agressive, 90 % suffit ; dans un jeu mature, 95 % est préférable. Le seuil bas augmente le risque de faux positif mais raccourcit le test. L'*Expected Value of Information* (EVI) calcule le seuil optimal : on confronte le coût d'une semaine supplémentaire de test au coût d'une décision erronée, et on trouve l'équilibre.

### Structure du Test Bayésien Multi-Variant

Un test de prix IAP comprend souvent 3+ variantes : contrôle ($4.99), traitement A ($5.99), traitement B ($6.99). En test A/B fréquentiste, le problème des comparaisons multiples surgit ; la correction de Bonferroni multiplie la taille d'échantillon. En bayésien, chaque variante a sa propre posterior, les comparaisons par paires se font simultanément. Au lieu de sélectionner la variante avec la plus grande moyenne posterior, vous maximisez la revenue attendue : (probabilité de gagner) × (revenue attendue) pour chaque variante.

La stratégie Thompson Sampling fonctionne ainsi : chaque jour, tirez un échantillon de la posterior de chaque variante, sélectionnez l'échantillon le plus élevé et envoyez le trafic vers cette variante. Cette stratégie équilibre automatiquement exploration et exploitation — la distribution du trafic est quasi-uniforme quand l'incertitude posterior est haute (premiers jours), puis bascule vers la variante gagnante.

Snippet de code (modèle bêta-binomial avec PyMC3) :

```python
import pymc3 as pm

with pm.Model() as iap_model:
    # Prior : bêta uniforme
    p_control = pm.Beta('p_control', alpha=1, beta=1)
    p_treatment = pm.Beta('p_treatment', alpha=1, beta=1)
    
    # Likelihood
    obs_control = pm.Binomial('obs_control', n=n_control, p=p_control, observed=conversions_control)
    obs_treatment = pm.Binomial('obs_treatment', n=n_treatment, p=p_treatment, observed=conversions_treatment)
    
    # Posterior sampling
    trace = pm.sample(10000, return_inferencedata=False)
    
    # Probability of superiority
    prob_superiority = (trace['p_treatment'] > trace['p_control']).mean()
```

Ce modèle optimise le taux de conversion. Pour optimiser la revenue, ajoutez un *prior* lognormal et calculez la posterior jointe de `p × revenue_mean`.

## Migration de Segment et Impact Long-Terme

L'optimisation des prix n'est pas un test unique mais un processus continu. Les utilisateurs changent de segment : un minnow aujourd'hui peut être dolphin dans 30 jours. Le modèle bayésien ne capture pas cette migration car il utilise un *prior* statique. La solution : mise à jour dynamique du *prior* — tous les 30 jours, la posterior devient un nouveau *prior* combiné aux nouvelles données.

Pour mesurer l'impact long-terme, la courbe de rétention des cohortes est modélisée avec l'analyse bayésienne de survie. Si une hausse de prix abaisse la rétention D7 de 2 % mais élève le LTV de $12 à $14, c'est un gain net. Le modèle de survie utilise la distribution de Weibull pour estimer les paramètres de forme et d'échelle ; les vérifications prédictives posterior fournissent une prévision du LTV à 90 jours.

Le test d'impact sur la rétention prend 6-8 semaines car il faut attendre le signal de rétention D30. L'approche bayésienne prédit D30 à partir de données D7 — le *prior* est fondé sur les taux de transition D7→D30 des cohortes passées. Cela permet de détecter un signal précoce dès la 3e semaine : si la moyenne posterior pour D30 est 18 % avec un IC 95 % de [16 %, 20 %], le test continue ; si [14 %, 16 %], la hausse de prix casse la rétention, et on revient au prix précédent.

## Économie du Jeu et Dynamiques Plateformes

Les utilisateurs iOS et Android réagissent différemment à la même price ladder. Les utilisateurs iOS affichent en moyenne 23 % d'ARPPU plus élevé ; le même prix $4.99 produit 3,2 % de conversion sur iOS mais 2,1 % sur Android. Le modèle bayésien intègre la plateforme comme un facteur hiérarchique — chaque plateforme a son propre *prior* de segment mais partage la tendance mondiale.

Le système de tarification de l'App Store d'Apple (Tier 1 = $0.99, Tier 5 = $4.99...) limite la flexibilité. Entre les paliers, au lieu de tester la posterior, on effectue une grille de recherche : entre Tier 3/4/5, lequel maximise la posterior revenue attendue ? Google Play est plus flexible (tarification arbitraire) mais le taux de conversion Android est plus volatil — les tests Android conservent un *prior* 30 % plus large que iOS.

Les fluctuations monétaires affectent aussi la posterior : quand le cours TRY passe de ₺25 à ₺35 pour 1 USD, le prix ₺49.99 descend de $2 à $1.43 en terms réels. Le modèle utilise la revenue ajustée par devise, avec la posterior calculée en USD. Sur les marchés émergents, une tarification ajustée par PPA exige des *priors* distincts — le même jeu affiche $4.99 aux États-Unis et R$9.90 au Brésil (équivalent PPA ~$1.80).

Dans le [Programme Éditeur Premium](/tr/premiumyayinci), les campagnes UA alimentent aussi les résultats du test de prix : pour un segment à LTV élevé, on augmente l'enchère CPM ; pour un segment à faible conversion, on la réduit. Quand le modèle bayésien IAP est intégré à la stratégie d'enchères UA, l'optimisation du ROI au niveau du portefeuille devient possible —