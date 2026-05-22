---
title: "ASO Creative Testing: avec PPO +32% IPM en 6 Semaines"
description: "Testez vos visuels App Store iOS/Android avec Custom Product Pages et Play Experiments. Significativité statistique, calcul de lift, méthodologie d'itération créative."
publishedAt: 2026-05-22
modifiedAt: 2026-05-22
category: gaming
i18nKey: gaming-001-2026-05
tags: [aso, creative-testing, custom-product-pages, play-experiments, mobile-growth]
readingTime: 9
author: Roibase
---

La zone la plus négligée de la croissance mobile gaming : les visuels de l'App Store. La plupart des studios chargent un icône + quelques captures d'écran une seule fois et oublient. Or, sans A/B test via Apple Custom Product Pages (CPP) et Google Play Experiments (PPE), vous laissez du potentiel IPM (install per impression) sur la table chaque semaine. Depuis 2025, les jeux tier-1 utilisant CPP sur les marchés principaux enregistrent un lift IPM moyen de +22%. Mais si votre méthodologie de test est défaillante, ce chiffre ne veut rien dire. Cet article couvre la partie méthodologie.

## Custom Product Pages : Qu'est-ce que c'est et Pourquoi Maintenant

Apple a lancé CPP en 2021 ; Google Play a suivi en 2022 avec un contrôle expérimental complet. Avant cela, c'était l'ère du "jeu unique de visuels + petits tests". Maintenant, vous pouvez servir différents ensembles créatifs à chaque segment de campagne : si votre UA créative utilise un style anime, faites la même chose sur l'App Store ; si vous mettez l'accent sur la mécanique de combat, vos captures d'écran doivent montrer du combat.

La différence est simple : **cohérence du message**. L'utilisateur voit un personnage héroïque sur TikTok et clique, mais sur l'App Store il voit une capture d'écran de mécanique farming — la conversion chute. CPP ferme cette lacune. Mais le vrai pouvoir réside dans la boucle de test : vous mettez 3 directions visuelles différentes en direct et prenez une décision basée sur les données 2 semaines plus tard.

Détail technique : les CPP existent indépendamment de votre page produit par défaut, vous pouvez en créer jusqu'à 35 (limite Apple). Sur Google, le quota d'expériments est dynamique mais 10-12 tests actifs suffisent en pratique. Chacun est associé à un ID de campagne différent — vous mesurez via SKAdNetwork (SKAN) ou Firebase.

## Play Experiments et l'Équivalent iOS : Architecture du Test

Google Play Experiments vous permet de tester la conversion funnel au niveau du store : vous pouvez montrer 50% control, 50% variant quand l'utilisateur arrive en boutique. Apple n'offre pas cette fonctionnalité, donc vous utilisez CPP avec routage au niveau campagne. Le split du test se fait à la couche médiation, pas au store.

Structure de test typique :

**Google (split au niveau store):**
- Baseline (ensemble visuel existant)
- Variant A (nouvel ordre de captures)
- Variant B (personnage héroïque différent)

Le trafic est distribué automatiquement ; Play Console fournit un rapport de significativité statistique en 14 jours.

**Apple (split au niveau campagne):**
- Campagne 1 → Page produit par défaut
- Campagne 2 → CPP Variant A
- Campagne 3 → CPP Variant B

Vous effectuez le split manuellement via Apple Search Ads ou paid social. Vous extrayez install + données IPM des postbacks SKAN pour chaque campagne. Vous calculez vous-même la significativité (Apple n'a pas d'interface de test).

C'est ici que la plupart des studios font erreur : ils décident avant d'avoir collecté suffisamment d'échantillons. 500 installations et "variant gagne" — arrêt de l'itération. En réalité, la puissance statistique n'est même pas 60%. Minimum : 2000 impressions/variant + intervalle de confiance à 95%.

## Significativité Statistique et Calcul du Lift

Play Console fournit un rapport de significativité mais les mathématiques sous-jacentes sont simples : **test z de proportion**. Il teste si la différence de taux de conversion entre deux groupes est le fruit du hasard.

Formule :

```
z = (p1 - p2) / sqrt(p * (1-p) * (1/n1 + 1/n2))
p = (x1 + x2) / (n1 + n2)
```

- `p1`, `p2` : taux de conversion variant et control
- `n1`, `n2` : nombre d'impressions
- `x1`, `x2` : nombre d'installations

Z-score > 1.96 signifie que vous avez une différence significative à 95% de confiance.

**Exemple :**
- Control : 10 000 impressions, 800 installations → 8.0% CVR
- Variant : 10 000 impressions, 1 120 installations → 11.2% CVR
- Lift : +40% (relatif), +3.2 pp (absolu)
- Z-score : 8.4 → p < 0.001 (clairement significatif)

Mais attention : avec petit sample, même un lift élevé peut manquer de significativité. Vous voyez +15% lift sur 500 impressions ? Votre IC à 95% peut s'étendre de -5% à +35%.

**Calcul du sample minimum** (power analysis) :
CVR baseline 8%, MDE (minimum detectable effect) 20% lift (c.-à-d. 9.6% CVR) et 80% de puissance cible → ~4 500 impressions par groupe. Descendez en dessous à vos risques.

### Bayesian vs Frequentist

Play Console utilise l'approche fréquentiste. Alternative : test A/B Bayésien avec mise à jour continue de la posterior — résultat "le variant est 87% susceptible d'être meilleur". Le Bayésien aide à une décision plus précoce sur petit sample, mais en production, le fréquentiste est généralement plus sûr. La priorité est le contrôle de l'erreur de type I, pas la minimisation du regret.

## Méthodologie d'Itération Créative : du Test Initial au Scale

La plupart des studios utilisent CPP ainsi : l'équipe marketing prépare 3 visuels, les met en direct, regarde 1 semaine plus tard, déclare "celui du milieu est meilleur" et passe à autre chose. Faux.

La bonne boucle d'itération :

1. **Formulation d'hypothèse (Semaine 0):**
   - Prenez votre meilleur performer UA créatif. Quel angle a le plus haut CTI ? (personnage vs mécanique vs récompense)
   - Concevez 2-3 variantes qui transportent cet angle dans le visuel store. Control = visuel existant.

2. **Lancement du test (Semaine 1-2):**
   - Mettez en direct les CPP avec routage au niveau campagne. Versez du trafic égal à chaque variante (ajustement d'enchère manuel ou rotation créative).
   - Extrayez quotidiennement impressions + installations. Ne proclamez pas de gagnant précoce.

3. **Vérification de significativité (Semaine 3):**
   - Exécutez le test z pour chaque variante. Si aucune n'atteint significativité, augmentez le trafic (+50%) ou attendez 1 semaine de plus.
   - Si 1 variante a p < 0.05 et lift > 15%, passez à l'itération.

4. **Itération du gagnant (Semaine 4-5):**
   - Faites de la variante gagnante votre nouvelle baseline. Créez 2 nouvelles variantes : une radicale (schéma couleur différent), une incrémentale (réorganisation de captures).
   - Lancez round 2 de test.

5. **Scale (Semaine 6+):**
   - Si round 2 produit aussi un gagnant, appliquez cette variante à toutes vos campagnes. Archivez l'ancien control.
   - Retestez dans 3 mois — le méta change, decay créatif s'installe.

Si vous bouclez ce cycle en 6 semaines, vous faites 8 tours de test par an. Si chacun livre 10-15% de lift, composé : (1.1)^8 = 2.14x → +114% amélioration IPM à la fin de l'année. En pratique, vous voyez 30-50% (tous les tests ne gagnent pas).

## Test Multivarié et Segmentation

La méthode ci-dessus est A/B à deux groupes. Niveau avancé : **test multivarié** (MVT). Vous testez 3+ éléments simultanément : icône, première capture, aperçu vidéo. Mais les combinaisons explosent (3 icônes × 4 captures × 2 vidéos = 24 variantes). Les exigences de sample multiplient par 24.

Solution : **design factoriel**. Vous mesurez l'effet principal de chaque élément séparément. Mais vous perdez les effets d'interaction (p. ex., icône A + capture B créent une synergie particulière). Tradeoff : vitesse vs profondeur.

Alternative : **sequential testing**. D'abord icône, puis captures, puis vidéo. À chaque étape, vous trouvez le gagnant et passez à l'élément suivant. Durée totale plus longue (12-18 semaines) mais chaque décision est solide.

**Segmentation :** Vous pouvez aussi segmenter les CPP par audience. Exemple : iOS 17+ obtient une UI moderne, iOS 15- obtient un visuel classique. Ou geo-based : superhéros pour USA, fantasy pour MENA. Vous avez alors besoin d'un test séparé par segment — l'exigence de sample global se multiplie. Segmentation judicieuse : groupes avec différence LTV > 30%.

## Roibase et Infrastructure de Test ASO

Le service [App Store Optimization](/fr/aso) de Roibase construit l'infrastructure de test CPP/PPE : mapping de SKAdNetwork conversion value, intégration Firebase/Adjust, tableau de bord custom avec suivi de significativité en temps réel. Via le [Programme Éditeur Premium](/fr/premiumyayinci), nous validons aussi la cohérence créative entre UA et mağaza visuals — votre creative SparkAds TikTok et votre visuel CPP doivent parler le même langage visuel.

Engagement typique : 2 semaines de mesure baseline, semaine 3-6 premier cycle de test, semaine 7-12 itération + scale. Au bout de 3 mois, vous voyez +20-35% lift IPM (segment casual/hyper-casual tier-1). Pour midcore/strategy, le lift est plus faible (+10-15%) car le cycle décisionnel est long et le détail de screenshot critique.

## Conclusion : Creative Testing = Processus Continu

Les tests créatifs ASO ne sont pas une campagne, c'est un processus. Si vous testez une fois et utilisez le gagnant pendant 6 mois, vous perdrez la moitié du lift par decay créatif. Refresh tous les 3 mois. Le méta change, les concurrents essaient de nouveaux styles, les tendances éditoriales Apple/Google évoluent.

Ce que vous devez faire maintenant : analysez vos visuels store existants. L'angle gagnant de votre UA créative correspond-il au message de vos captures ? Sinon, concevez votre première variante CPP selon cet angle. Dans 2 semaines, collectez minimum 5 000 impressions. Exécutez un test z. Si lift > 15% et p < 0.05, passez à l'itération. 6 semaines plus tard, observez — vous verrez +20-30% lift IPM.