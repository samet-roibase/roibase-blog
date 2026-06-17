---
title: "Apple Search Ads: Architecture de Campagnes en Entonnoir"
description: "Flux budgétaire de la découverte à la marque : comment structurer les campagnes broad match, concurrents et exact en entonnoir hiérarchique — architecture ASA."
publishedAt: 2026-06-17
modifiedAt: 2026-06-17
category: gaming
i18nKey: gaming-005-2026-06
tags: [apple-search-ads, architecture-campagnes-asa, mobile-user-acquisition, app-funnel-strategy, brand-defense]
readingTime: 8
author: Roibase
---

Structurer les campagnes Apple Search Ads en tant que couches d'entonnoir interconnectées — plutôt que en silos isolés — peut réduire le CPP (Cost Per Promotion) de 20 à 40 % dans l'acquisition utilisateurs pour jeux mobiles. Le signal utilisateur capturé en broad match de découverte alimente le exact concurrents, qui alimente la défense de marque — chaque couche filtre pour la suivante. Après iOS 18.2 en 2026, les données d'attribution des custom product page rendent cette architecture obligatoire : une approche single campaign cache la churn, l'allocation budgétaire reste trop manuelle.

## Couche Discovery : Pourquoi Broad Match Doit Être au Sommet

Les campagnes broad match constituent la couche discovery dans la hiérarchie Apple Search Ads — elles existent pour explorer de nouveaux clusters de mots-clés, capturer les signaux d'intention inattendus. Or, la plupart des studios laissent ce mode ouvert en pensée "essayer tout, filtrer après", brûlant 500–1000 dollars par jour avec un TTR (Tap-Through Rate) sous 2,5 %. La bonne approche : placer le broad match tout en haut de l'entonnoir, mais **contrôler le plafond CPP via une fenêtre glissante de 3 jours**.

Dans une campagne broad, l'objectif n'est pas le CPP, c'est le **ratio LTV/CPI** — accepter 0,4x dans les 3 premiers jours car cette donnée de mots-clés alimente votre data warehouse. La valeur réside ici : l'algorithme Search Match vous permet de voir votre competitive set à travers les yeux d'Apple. Lorsque vous lancez "puzzle game" en broad match, l'algorithme révèle les clusters d'intention "merge", "match-3", "interior design" — autant de candidats à migrer vers la campagne exact concurrents.

Point critique : dans la campagne broad, **ne jamais ajouter de mots-clés exacts en négatif**. Les négatifs ne s'appliquent que sur les catégories peu pertinentes (par ex. "poker", "casino" si c'est un genre différent). Ajouter des mots-clés exacts en négatif coupe la boucle d'apprentissage de l'algorithme et tue la fonction découverte.

### Formule de Plafond Budgétaire pour Broad Match

```python
daily_budget_broad = (target_monthly_installs * 0.15) * target_CPI * 1.8
# 0.15 → part découverte (15%)
# 1.8 → multiplicateur CPI broad (1,8x acceptable vs exact)
```

Exemple : Objectif mensuel de 10K installs, CPI cible $2,5 → budget broad $6 750/mois → ~$225/jour. Dépasser ce plafond signifie faire du waste au lieu de discovery.

## Exact Concurrents : Couche de Hijacking d'Intention

Parmi les mots-clés issus du broad match, identifiez les **noms d'applications rivales** et **termes de marque concurrente**, puis migrez-les vers la deuxième couche — la campagne exact concurrents. La logique : capturer l'awareness créée par le concurrent. Un utilisateur cherche "Candy Crush", vous présentez votre puzzle game — l'éducation d'intention est déjà faite, vous proposez juste une alternative.

Le TTR de l'exact concurrents est 30–50 % inférieur à l'exact marque (données propres d'Apple), mais le CPP est généralement 15–25 % moins cher car la compétition enchère sur le mot concurrent est réduite. Crucial : votre **stratégie custom product page change ici**. Si l'app rival se concentre sur "gestion du temps", votre creative CPP doit dire "moins de temps d'attente" — sans ce positionnement différentiel, le ROI de l'exact concurrents reste négatif.

Pour sélectionner les mots-clés concurrents, l'erreur courante : prendre les 20 premiers du top-grossing chart. Bonne méthode : faire une **analyse de chevauchement d'audience** — récupérer de Sensor Tower ou data.ai le profil démographique de l'app rivale, sélectionner celles à 60%+ de chevauchement avec le vôtre. Par ex., si vous avez un hyper-casual, prendre les mots-clés des jeux match-3 legend est du waste — la motivation core du joueur diffère.

| Type de Concurrent | TTR Benchmark | CPP vs Brand Delta | Utilisation CPP |
|---|---|---|---|
| Concurrent direct (sous-genre identique) | 3,5–5 % | +15–20 % | Oui, priorité haute |
| Genre adjacent (loop core similaire) | 2,8–4 % | +25–35 % | Oui, à tester |
| Leader catégorie (mécanique différente) | 1,5–2,5 % | +50%+ | Non, risque waste |

## Défense de Marque : Pourquoi Votre Nom Mérite Son Propre Silo

La campagne exact marque — le nom de votre app, votre studio — est la couche inférieure de l'entonnoir et **la couche conversion la moins chère**. En Apple Search Ads, le CPT (Cost Per Tap) de marque se situe généralement à $0,10–0,30, tandis que le broad match atteint $1,50–3. Or, nombre de studios pensent "nos utilisateurs nous trouvent déjà en recherche organique" et ignorent cette campagne — cela représente une perte d'installs de 12–18 %.

Pourquoi ? Parce que vos rivaux enchérissent aussi sur votre marque. Vous développez "Puzzle Master", mais un rival offre $2 sur votre exact marque pour son "Match Kingdom". L'algorithme d'enchère d'Apple combine pertinence + bid — sans enchère de votre côté, parfois le rival est en avant. La campagne de défense marque existe pour bloquer ce hijack.

Le TTR de la campagne marque est 18–35 % — très haut, car l'intention est certaine. Ce que vous devez faire : **exact match uniquement**, enchère $0,50–1 (suffisant pour surenchérir les rivaux), et le creative CPP porte "nouvelle saison" ou "mise à jour" — donner une raison fraîche à ceux qui connaissent déjà le jeu.

### Stratégie d'Enchère pour la Campagne Marque

```python
if competitor_bid_on_brand:
    brand_bid = competitor_avg_bid * 1.3  # Surenchérir le rival
else:
    brand_bid = 0.3  # Enchère minimale, mix organique + payant
```

Dans la campagne marque, **Search Match doit être désactivé** — l'algorithme génère parfois des extensions vers des mots-clés sans lien avec votre marque, ce qui crée des fuites budgétaires.

## Flux Budgétaire Inter-Entonnoir : Architecture Waterfall

Plutôt que gérer trois couches avec des budgets isolés, mettre en place une **allocation budgétaire waterfall** augmente le ROAS de 25–40 %. La logique : chaque couche ayant dépassé son seuil de performance, son budget excédentaire monte d'un cran — equilibrant investissement discovery et efficacité conversion.

Règles waterfall :
1. **L'exact marque est toujours entièrement financé** — si ROI positif à cette couche, pas de limite budgétaire
2. **Exact concurrents → feed marque** — si LTV/CPI > 1,2 à exact concurrents, l'overflow budgétaire ne va pas au broad mais teste un nouveau mot-clé concurrent
3. **Broad match → plafond budgétaire 15%** — ne pas dépasser 15 % du budget ASA total en broad, sinon l'entonnoir devient top-heavy

Automatiser cela via l'API Apple Search Ads (en 2026, Campaign Management API v5.0 dispose d'un endpoint d'ajustement budgétaire) :

```json
{
  "campaignId": 123456,
  "budgetAdjustment": {
    "type": "waterfall",
    "source": "competitor_exact",
    "condition": "LTV_CPI > 1.5",
    "action": "reallocate_to_brand",
    "amount": "overflow"
  }
}
```

Exécuter cet endpoint quotidiennement via BigQuery + Airflow, automatisant le flux budgétaire — dans les travaux [App Store Optimization](https://www.roibase.com.tr/fr/aso) de Roibase, c'est standard. Quand l'ajustement manuel se fait tous les 3 jours, la réaction est trop lente, les opportunités perdues se chiffrent à 8–12 % du upside.

## Stratégie Mots-Clés Négatifs : Arrêter les Fuites Inter-Couches

Quand vous lancez broad, exact concurrents et brand en parallèle, il existe un risque de **chevauchement de mots-clés** — le même search term déclenche les trois campagnes, créant une auto-concurrence enchère. L'auction d'Apple n'affiche pas plusieurs campagnes du même annonceur, mais génère du waste enchère : la plus haute bid gagne, les autres ne reçoivent pas d'impression mais réservent du budget.

Solution : **sync de mots-clés négatifs cross-campagne**. Ainsi :
- Chaque mot-clé ajouté à exact marque → ajout en négatif exact à exact concurrents
- Chaque mot-clé en exact concurrents → ajout en négatif phrase en broad match
- Le mot-clé convertissant en broad match → après 14 jours, migré vers exact concurrents ou marque, retiré du broad

Cette synchronisation est impossible manuellement (sur un account de 2000+ mots-clés, 40 heures/semaine de travail). Script Python ou outil ASA automation obligatoire :

```python
# Pseudo-code
brand_kws = get_keywords(campaign_type="brand_exact")
comp_kws = get_keywords(campaign_type="competitor_exact")

for kw in brand_kws:
    add_negative(campaign="competitor_exact", keyword=kw, match="exact")

for kw in comp_kws:
    add_negative(campaign="broad_match", keyword=kw, match="phrase")
```

Sans sync négatif, le CPI moyen gonfle de 18–25 % — pas du waste pur, mais de l'inefficacité. Les frais d'essayer d'atteindre le même utilisateur via trois campagnes différentes.

## Le Piège Attribution de l'Architecture Entonnoir

Apple Search Ads a une fenêtre d'attribution de 30 jours — si un utilisateur tape sur une ad search et installe dans les 30 jours, c'est attribué. Mais la **réalité multi-touch** : l'utilisateur a vu le broad match, n'a pas installé, 5 jours plus tard cherche votre nom exact marque et installe — l'attribution va à marque, le rôle du broad est invisible. Ce phénomène pousse à réduire le budget broad, tuant la fonction discovery.

Solution : **modèle d'attribution multi-touch assistée**. Extraire l'impression + tap data via l'API Apple Search Ads, construire un modèle multi-touch attribution en BigQuery. Approche Markov chain ou Shapley value attribue à chaque campagne sa contribution. Exemple trouvé : la campagne broad a livré 120 installs directs le mois dernier, mais a assisté 840 conversions — sa vraie valeur = 7x.

```sql
-- Exemple BigQuery multi-touch
WITH touch_chain AS (
  SELECT user_id, campaign_type, timestamp,
    LEAD(campaign_type) OVER (PARTITION BY user_id ORDER BY timestamp) as next_touch
  FROM asa_events
)
SELECT campaign_type, COUNT(*) as assisted_conversions
FROM touch_chain
WHERE next_touch = 'brand_exact'
GROUP BY campaign_type;
```

Cette requête montre combien de fois broad et exact concurrents ont aidé les installs marque — sans cette donnée, broad semblerait "cher et inefficace", serait coupé, l'entonnoir s'écroulerait.

## Maintenir l'Architecture Campagne Vivante

L'architecture entonnoir Apple Search Ads n'est pas statique — chaque semaine apporte de nouvelles découvertes de mots-clés, chaque mois le paysage concurrentiel shift, chaque trimestre les trends genre changent. Maintenir l'entonnoir vivant exige un **cycle review de 3 semaines** :

1. **Semaines 1–2 :** Rapport Search Match du broad match → découvrir de nouveaux clusters de mots-clés
2. **Semaine 3 :** Données performance mots-clés → sélectionner candidats migration vers exact concurrents
3. **Semaine 4 :** Vérification hijack marque → surveiller activité enchère rivale

Le reporting manuel via la console Apple Search Ads ne suffit pas — pull API quotidien + Looker Studio dashboard obligatoire. Dans les clients jeux mobiles de Roibase, ce dashboard affiche en temps réel : TTR par étape entonnoir, % chevauchement mots-clés inter-campagnes, taux conversion assistée, LTV/CPI par couche.

Exploiter cette discipline pour l'architecture entonnoir fait de Apple Search Ads peut-être votre plus grand canal UA — CPI contrôlé, LTV visible, scale prévisible. Discovery, concurrents, marque — chaque couche alimente la suivante en signal et budget, créant un écosystème au lieu de campagnes isolées. Alors que le privacy tightening iOS s'accélère en 2026, cette architecture n'est plus un luxe — c'est une nécessité : jouer sur la plateforme d'Apple, avec son attribution, dans son auction, reste le canal growth le plus stable post-IDFA.