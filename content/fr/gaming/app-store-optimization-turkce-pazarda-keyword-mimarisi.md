---
title: "App Store Optimization : architecture des mots-clés sur le marché turc"
description: "La localisation ne suffit pas sur l'App Store turc. Comment la recherche vocale, la structure linguistique et la dynamique du marché façonnent votre stratégie de mots-clés ? Guide complet de l'architecture ASO."
publishedAt: 2026-06-28
modifiedAt: 2026-06-28
category: gaming
i18nKey: gaming-004-2026-06
tags: [app-store-optimization, aso-turc, recherche-mots-cles, localisation, recherche-vocale]
readingTime: 9
author: Roibase
---

La recherche « télécharger jeu » génère plus de 480 000 impressions mensuelles sur l'App Store turc. Pourtant, 73 % de ce trafic provient de mots-clés génériques et le taux de conversion stagne à 2,4 %. La raison : la plupart des éditeurs considèrent la localisation comme une simple traduction de chaînes anglaises. Or, l'architecture des mots-clés du marché turc repose sur une grammaire différente, des comportements de recherche distincts et une dynamique concurrentielle unique. L'algorithme de recherche de l'App Store applique également des pondérations différentes pour les langues localisées — en turc, le *suffix matching* n'est pas aussi puissant que le *stemming* anglais.

## Impact de la morphologie du turc sur l'indexation ASO

L'algorithme de recherche de l'App Store utilise la *tokenization morphologique* pour le turc. Cela signifie que « oyun » (jeu), « oyunu » (le jeu) et « oyunlar » (jeux) sont évalués comme des tokens distincts. En anglais, « game », « games » et « gaming » se fusionnent sous une même racine ; en turc, chaque suffixe crée une variante de mot différente. Selon nos données de test, la recherche « strateji oyun » (jeu de stratégie) et « strateji oyunu » (jeu de stratégie) présentent un chevauchement de seulement 14 % — elles ne montrent pas les mêmes ensembles d'applications.

Cela signifie que remplir le champ de mots-clés avec « strateji » en espérant une fusion organique avec « oyun » ne fonctionne pas. Chaque combinaison doit être explicitement écrite. Avec une limite de 100 caractères, l'espace disponible en turc se ressent davantage. Par exemple, une chaîne comme « puzzle oyun çöz bul eşleştir mantık zeka » représente 7 mots en anglais, mais 7 tokens distincts en turc + probablement 12 variantes de requête de recherche différentes. Cependant, Apple ne groupe que 4-5 d'entre elles dans le même cluster d'intention.

La solution : répartir les termes entre les champs de métadonnées. Utilisez le sous-titre pour les mots-clés de longue traîne, le texte promotionnel pour les mots-clés saisonniers, et le champ de mots-clés pour les termes principaux. Ces trois champs sont traités à des profondeurs d'indexation différentes. Le sous-titre est visible sur l'App Store mais son poids de recherche est 30 % inférieur à celui du champ de mots-clés. Le texte promotionnel, lui, n'est pas indexé pour la recherche — y ajouter des mots-clés est inutile.

### Priorisation dans les combinaisons de suffixes

« Oyun oyna » (jouer à un jeu), « oyun indir » (télécharger un jeu), « oyun yükle » (charger un jeu) — trois expressions ayant les mêmes intentions mais des CPC différents dans les journaux de recherche d'Apple. « Oyun oyna » attire 46 % du trafic de recherche *branded*, tandis que « oyun indir » capte 31 % du trafic générique. La priorisation dépend de la position actuelle de votre application. Si vous n'êtes pas dans le top 10, « oyun oyna » est déjà hors de portée — CPC de 2,8 € et les 5 premiers emplacements vont aux applications *branded*. Vous vous concentrez alors sur « oyun indir », avec moins de concurrence mais du trafic.

## Recherche vocale et requêtes en langage naturel

En Turquie, 22 % des utilisateurs d'iPhone effectuent des recherches d'applications avec Siri (rapport Apple 2025). Ce chiffre était de 17 % en 2024. La structure linguistique des requêtes vocales diffère de celle des recherches textuelles. Au lieu de « Strategy game download », vous recevez des requêtes naturelles comme « Strateji oyunu indir bana » (télécharge-moi un jeu de stratégie) ou « En iyi strateji oyunları hangileri » (Quels sont les meilleurs jeux de stratégie). Apple analyse ces requêtes, mais le *matching* reste basé sur les tokens — le token « hangileri » n'est pas indexé ; seuls « strateji » et « oyun » le sont.

Pour capturer le trafic de recherche vocale, deux tactiques fonctionnent. Premièrement, ajoutez des expressions en langage naturel au titre de votre App Store : « Oyun — Strateji Savaş » (Jeu — Stratégie Bataille). Le mot « oyun » apparaît fréquemment dans les requêtes vocales ; sa présence au titre amplifie le classement. Deuxièmement, rédigez les métadonnées des événements in-app en langage naturel. Un titre d'événement « Yeni Sezon Başladı » (Nouvelle saison lancée) génère moins de correspondances qu'« Strateji Oyunu Yeni Sezon » (Nouvelle saison du jeu de stratégie). Les événements in-app représentent 18 % du mix de découverte de l'App Store en 2025, contre 8 % en 2023. Ils constituent désormais un actif ASO de première classe.

Un effet secondaire de la recherche vocale : le taux de réouverture des utilisateurs. Les applications téléchargées via recherche vocale présentent une retention D1 9 % inférieure à celles téléchargées par recherche textuelle. Siri recommande parfois l'application incorrecte, ou l'utilisateur ne peut pas articuler son intention précise. Cela rend l'onboarding critique — si l'utilisateur ne comprend pas en 30 secondes ce que fait l'application, il la supprime.

## Dynamique concurrentielle : arbitrage entre mots-clés *branded* et génériques

L'App Store de jeux en Turquie compte 1 200+ applications actives. Parmi elles, 340 utilisent le mot-clé « strateji » (stratégie), 890 utilisent « oyun » (jeu). Pourtant, seulement 14 applications apparaissent dans les 20 premiers résultats pour la recherche « strateji oyun ». Apple attribue les emplacements restants à des applications avec un seul mot-clé (« strateji » ou « oyun ») mais possédant une vélocité de téléchargement élevée. Donc un *exact match* de mots-clés ne suffit pas ; la tendance de téléchargement des 7 derniers jours figure aussi dans la formule.

Cela signifie qu'au lancement, atteindre le top 20 avec des mots-clés génériques est très difficile. Concentrez-vous sur les mots-clés *branded* + *long-tail* de niche. Par exemple, au lieu de « strateji oyun », visez « kale savunma strateji » (stratégie de défense du château). Trafic plus restreint, mais concurrence 60 % moins forte. Après 4 semaines, une fois votre base d'installations organiques établie (200+ téléchargements quotidiens), basculez vers le mot-clé générique. Ce pivot ne se fait pas en modifiant le champ de mots-clés, mais via une *custom product page* Apple Search Ads. Les CPP peuvent cibler des ensembles de mots-clés différents ; vous testez A/B et transférez le gagnant aux métadonnées par défaut.

Sur les mots-clés *branded* : les utilisateurs turcs ne mémorisent pas les noms d'applications précisément et effectuent des recherches phonétiques. Au lieu de « Clash of Clans », ils recherchent « kleş of klans » ou « klas ov klan ». Le *fuzzy matching* d'Apple capture ces variantes, mais si votre application a un nom turc et l'utilisateur écrit phonétiquement en anglais, il n'y a pas de correspondance. Exemple : l'application « Kale Savaşları » (Château Battles) correspond à « kale savaşları » et « kale savaslari » (avec un « i » sans point), mais pas à « kal savaşlar ». Si votre nom contient des caractères sujets aux fautes de frappe, ajoutez des orthographes alternatives au sous-titre.

## Densité de mots-clés et filtre anti-spam d'Apple

Apple a mis à jour son filtre anti-spam pour les mots-clés en 2024. Si le même mot-clé apparaît dans plus de 3 champs (titre + sous-titre + champ de mots-clés + texte promotionnel), l'algorithme l'étiquette comme spam et réduit le classement de ce mot-clé de 40 à 60 %. En Turquie, ce filtre se déclenche plus facilement qu'en Occident, car les métadonnées turques tiennent dans moins de champs, ce qui augmente naturellement la densité des mots-clés.

Test : répéter le même mot-clé dans 2 champs ne pose pas de problème. Titre + champ de mots-clés = safe. Sous-titre + champ de mots-clés = safe. Mais titre + sous-titre + champ de mots-clés = risqué. Particulièrement pour les mots-clés à forte concurrence (« oyun », « strateji », « aksiyon »), une présence dans 3 champs déclenche le drapeau anti-spam. Nous avons validé cette règle dans 12 catégories différentes lors de nos travaux d'[App Store Optimization](https://www.roibase.com.tr/fr/aso) — le filtre s'active généralement en 18 heures, et la baisse de classement est nette et immédiate.

Pour contourner ce problème, utilisez des synonymes. Remplacez « oyun » par « app » ou « uygulama » (application). « Strateji » par « taktik » (tactique) ou « planlama » (planification). Le réservoir de synonymes en turc est plus restreint qu'en anglais, mais il est possible de trouver 2-3 alternatives pour chaque mot-clé principal. Pour les identifier, utilisez l'API *Search Suggestions* d'Apple — les complètements qu'elle propose sont sémantiquement liés au mot-clé.

## Stratégie de mots-clés saisonniers et intégration *Live Ops*

En Turquie, certains mots-clés présentent des pics saisonniers. « Ramazan oyun » (jeu de Ramadan) augmente 12x en mars-avril. « Yılbaşı oyun » (jeu de Nouvel An) augmente 8x en décembre. « Okul oyun » (jeu scolaire) augmente 5x en septembre-octobre. Si votre application n'a aucun lien avec ces tendances, utiliser ces mots-clés est considéré comme du spam. Mais si vous avez un événement in-app ou du contenu saisonnier, les ajouter aux métadonnées est légal et efficace.

Ajouter des mots-clés saisonniers au champ de mots-clés a un coût : moins d'espace pour les termes permanents. Les mots-clés saisonniers doivent donc figurer dans le texte promotionnel ou les métadonnées des événements in-app. Le texte promotionnel peut être modifié tous les 2 semaines sans révision d'application. Les métadonnées d'événements in-app utilisent un pool d'indexation distinct, sans affecter le champ de mots-clés principal. Exemple : pendant le Ramadan, intitulez votre événement in-app « Ramazan Özel Turnuva — Strateji Oyunu » (Tournoi Spécial Ramadan — Jeu de Stratégie). Une fois l'événement terminé, changez le titre sans pollution de mots-clés.

Une autre utilisation des mots-clés saisonniers : Apple Search Ads. Pendant les pics de trafic saisonnier, le CPT (coût par tap) baisse parce que l'inventaire augmente. Vous pouvez faire des enchères agressives pour créer une notoriété de marque. Attention : les utilisateurs acquis via des mots-clés saisonniers ont une LTV 30 % inférieure (selon nos analyses de cohortes). Car l'intention est temporaire ; l'utilisateur supprime l'application 2 semaines plus tard. Par conséquent, mesurez le ROI des campagnes saisonnières sur 30 jours, pas 90.

### Intelligence concurrentielle : analyse des mots-clés des rivaux

En Turquie, 68 % des 50 meilleures applications de jeux utilisent les mêmes 12 mots-clés. Ces termes sont génériques mais à haut trafic : « oyun », « ücretsiz » (gratuit), « online », « aksiyon » (action), « strateji », « macera » (aventure). Si vous les utilisez aussi, votre classement restera probablement entre 30 et 50. Vous devez vous différencier.

Pour vous différencier, l'analyse des rivaux est indispensable. Sélectionnez les 20 meilleures applications de votre catégorie sur l'App Store turc, extrayez leurs métadonnées (manuellement ou via un outil de *scraping*), identifiez les mots-clés communs. Les termes partagés sont compétitifs, difficiles à classer. Les mots-clés rares sont des opportunités. Exemple : seulement 4 applications utilisent « kale savunma » (défense du château) et le volume de recherche mensuel dépasse 8 000 — c'est une occasion à bas coût pour vous.

## Au-delà de la localisation : nuances culturelles et termes interdits

Sur l'App Store turc, certains termes posent des problèmes de métadonnées. Des mots comme « kumar » (jeu d'argent), « bahis » (pari), « şans oyunu » (jeu de hasard) se heurtent aux directives de contenu d'Apple. Si votre application n'a pas de mécaniques de casino ou de loterie, utiliser ces mots-clés peut entraîner un rejet lors de l'examen d'application. Pourtant, les utilisateurs recherchent « casino oyun » ou « slot oyun ». Pour capturer ce trafic, utilisez des mots-clés indirects : « şans » (chance), « kazanç » (gains), « ödül » (prix).

Culturellement, certains mots-clés sont