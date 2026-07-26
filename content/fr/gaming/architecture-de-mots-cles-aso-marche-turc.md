---
title: "App Store Optimization : Architecture de Mots-clés pour le Marché Turc"
description: "En Turquie, l'ASO n'est pas une simple traduction. Cartographie d'intent, recherche vocale et pondération des plateformes : comment construire une croissance organique durable."
publishedAt: 2026-07-26
modifiedAt: 2026-07-26
category: gaming
i18nKey: gaming-004-2026-07
tags: [aso, mobile-gaming, keyword-research, marche-turc, localisation]
readingTime: 9
author: Roibase
---

L'App Store turc enregistre 8 millions de recherches utilisateur actives par mois. Pourtant, 73 % de ces requêtes suivent un format hybride : « terme anglais + modificateur turc » (données App Annie 2026). « Battle royale oyun », « strategy game oyna », « idle game indir » — aucune n'est complètement locale, aucune complètement mondiale. Cette structure hybride transforme l'ASO d'un simple exercice de traduction en problème d'ingénierie culturelle. La plupart des studios commettent l'erreur de nommer "localisation" la traduction pure des chaînes UI. Or, sur le marché turc, l'architecture de mots-clés doit opérer à un niveau différent : cartographie d'intent, comportement de recherche vocale, pondération spécifique à la plateforme, et impact des contraintes légales sur les métadonnées.

## Pourquoi le Marché Turc N'est Pas Qu'une Question de Langue

La Turquie est un marché mobile gaming de tier 2, mais avec un comportement de tier 1. L'ARPPU représente 40 % de celui de l'Europe, mais la fréquence de session est 15 % plus élevée (Sensor Tower Q1 2026). Traduction : l'utilisateur joue gratuitement mais revient chaque jour, teste un nouveau jeu chaque semaine. L'ASO doit équilibrer ces deux vecteurs — mettant l'accent sur « gratuit » tout en ne cachant pas les fonctionnalités premium.

La recherche de mots-clés en turc s'organise en 3 couches. La première est traduction directe : « puzzle game » → « bulmaca oyunu ». La deuxième est équivalent culturel : « idle game » → non pas « boş zaman oyunu » mais « tıkla kazan oyunu » (formule établie dans l'esprit de l'utilisateur). La troisième est spécifique au marché vocal : « Türkçe savaş oyunu » — ici, le modificateur « Türkçe » ne désigne pas la langue UI mais une quête de contenu local. Sur l'App Store, 60 % des requêtes contenant le modificateur « Türkçe » recherchent en réalité une narration ou un univers local, pas une langue. Intégrer « Türkçe » aux métadonnées impacte le CPI de 12 à 18 % (données de test Roibase 2025-2026).

La deuxième différence réside dans la distribution d'intent. En anglais, « strategy game » est un terme générique — 4X, tower defense, auto-battler inclus. En turc, « strateji oyunu » se rétrécit — seuls les jeux de tactique au tour par tour entrent dans cette catégorie. « Kale savunma », « kart oyunu », « savaş simülasyonu » forment des clusters d'intent distincts. Pour un même jeu, il faut tester 3 ensembles de mots-clés différents. Exemple : un jeu tower defense avec le mot-clé « strateji » dans le sous-titre affichait un CVR de 3,2 %. En le remplaçant par « kale savunma », le CVR a grimpé à 5,8 %. La précision d'intent fait la différence.

### Pondération des Plateformes : App Store vs Google Play

L'algorithme de densité de mots-clés de l'App Store en Turquie est 30 % plus sensible que celui de Google Play (observation actuelle 2026). Avec 3 mots-clés dans le titre, chacun reçoit un poids distinct. Google Play favorise plutôt les permutations — « savaş strateji oyunu » et « strateji savaş oyunu » sont traités de façon similaire. Sur l'App Store, l'ordre est critique. Les données de test montrent un écart de 18 % d'impressions entre « aksiyon macera oyunu » (action en premier) et « macera aksiyon oyunu » (aventure en premier). Placez le mot-clé prioritaire en premier.

## Workflow de Recherche de Mots-clés : Cartographie d'Intent

L'ASO turc fonctionne selon ce processus : d'abord identifier les termes fondamentaux en anglais (genre, mécanique, thème), puis trouver non pas leurs **traductions turques** mais leurs **équivalents dans le modèle mental de l'utilisateur turc**. Trois sources de données y contribuent :

| Source | Usage | Fiabilité |
|--------|-------|-----------|
| Suggestions App Store | Logs de requête en temps réel | 85 % |
| Google Trends (filtre mobile) | Motifs saisonniers/culturels | 70 % |
| Reverse engineering concurrents | Scraping de mots-clés payants | 60 % |

Les suggestions App Store sont la source la plus fiable car elles s'appuient sur les logs de requête d'Apple. Exemple : tapez « oyun » et attendez — le menu déroulant affiche « oyun indir », « oyun oyna online », « oyun hileleri ». Observez le modificateur « hileleri » — la recherche de triche/mod est élevée chez l'utilisateur turc ; cela signale d'ajouter aux métadonnées des termes comme « bonus », « amélioration ». Mais n'utilisez pas « hile » directement — risque de rejet par l'App Store.

Google Trends avec le filtre mobile révèle les motifs saisonniers. « Ramazan oyunu » connaît une hausse de 400 % en mars-avril (pour les jeux casual à thème spécial). « Yaz oyunu » atteint un pic en juin. Si votre jeu est indépendant de la saison, annotez ces mots-clés pour une rotation des métadonnées — synchronisez les mises à jour de métadonnées avec vos live ops (Apple autorise une mise à jour mensuelle ; le timing importe).

Pour le reverse engineering, utilisez des données de recherche payante. Vous ne voyez pas directement les mots-clés des rivaux sur Apple Search Ads, mais en consultant la liste « suggested keywords » de votre propre campagne, des chevauchements apparaissent. Si un concurrent mise sur « kart dövüş oyunu », testez-le aussi. Mais ne le copiez pas — servez-vous-en pour valider. Construisez votre propre champ sémantique.

### Construction du Champ Sémantique

En ASO turc, le champ sémantique s'articule en 4 couches :

1. **Descripteur fondamental :** Terme générique genre/mécanique (« puzzle », « aksiyon », « strateji »)
2. **Modificateur culturel :** Formule établie chez l'utilisateur local (« Türkçe », « yerli yapım », « Osmanlı temalı »)
3. **Signal d'intent :** Ce que cherche l'utilisateur (« ücretsiz », « çevrimdışı », « reklamsız »)
4. **Crochet émotionnel :** Attrait émotionnel (« eğlenceli », « sürükleyici », « rekabetçi »)

Exemple de métadonnées :

```
Title: Kale Savunma: Türk Savaşçılar
Subtitle: Strateji | Çevrimdışı Oyun | Ücretsiz
```

Équilibrez ces 4 couches. Title = fondamental + culturel (kale savunma + Türk), subtitle = intent + genre (çevrimdışı + strateji). Réservez le crochet émotionnel à la description — pas de place dans le titre.

## Recherche Vocale et Impact de la Structure Linguistique

La pénétration de la recherche vocale mobile en Turquie atteint 23 % (moyenne mondiale 18 %, Statista 2026). Quand on demande à Siri « oyun öner », les résultats retournés utilisent une pondération de mots-clés différente de celle de la recherche texte. Les requêtes vocales sont plus longues (moyenne 5,2 mots vs 2,8 en texte) et en langage naturel (« bana iyi bir strateji oyunu öner » vs « strateji oyun »).

L'impact des métadonnées ASO sur la recherche vocale est indirect — Siri construit ses résultats sur les métadonnées + curation éditoriale + métriques d'engagement. Deux points restent cruciaux :

1. **Mot-clé long-tail :** Des termes à 3+ mots comme « iyi strateji oyunu » correspondent aux requêtes vocales. Intégrez-les au sous-titre.
2. **Phrase naturelle :** Des qualifiants comme « en iyi », « popüler », « yeni » sont fréquents en recherche vocale. Ajoutez-les au texte promotionnel (l'App Store offre 170 caractères, modifiables tous les 4 mois).

La structure grammaticale turque joue un rôle. Le turc est SOV (sujet-objet-verbe), l'anglais SVO. En requête vocale, cet ordre change : « strateji oyunu oyna » plutôt que « oyna strateji oyunu » (commande en premier). Les métadonnées ne doivent pas suivre ce pattern — l'algorithme de l'App Store effectue des permutations n-grammes, la requête « oyna strateji oyunu » identifiera le mot-clé « strateji oyunu ». Mais en description, utilisez la phrase naturelle pour la lisibilité.

## Contraintes Légales et Limites de Métadonnées

En Turquie, les métadonnées de jeu obéissent à deux cadres légaux : les principes de diffusion du RTÜK (appliqués au contenu numérique) et les directives de l'App Store d'Apple. Le RTÜK impose des restrictions violence/sexe mais n'interfère pas directement avec les métadonnées. Apple, en revanche, applique des directives strictes : le mot « ücretsiz » est trompeur s'il y a des IAP, les affirmations « en iyi » nécessitent une preuve.

Points d'attention pour l'ASO turc :

- **« Bedava » vs « Ücretsiz » :** Les deux sont utilisés mais « bedava » est plus informel, adapté aux casual games. Pour les hardcore/strategy games, « ücretsiz » semble plus professionnel.
- **Terme « Premium » :** L'utilisateur turc interprète « premium » comme IAP, non comme ad-free. Pour un jeu sans pub, utilisez « reklamsız », pas « premium ».
- **Utilisation de chiffres :** Les métriques type « 1 million téléchargements » ne sont pas vérifiées par Apple mais cruciales pour la confiance utilisateur. Fournissez uniquement des chiffres validables par app analytics (« 500K+ joueurs » plutôt que « 4,8 étoiles sur l'App Store »).

Limites de caractères des champs :

| Champ | Limite | Stratégie |
|-------|--------|-----------|
| Title | 30 caractères | Mot-clé fondamental + marque |
| Subtitle | 30 caractères | Mot-clé intent + genre |
| Keyword field | 100 caractères | Long-tail + termes concurrents |
| Texte promotionnel | 170 caractères | Mise à jour saisonnière, crochet émotionnel |

Le keyword field doit être écrit sans virgules — Apple utilise les espaces comme séparateurs. Format correct : « strateji kale savunma türk oyun ». Supprimez les répétitions — si « oyun » figure au titre, ne l'ajoutez pas au keyword field, c'est du gaspillage.

## Tests A/B et Itération

Depuis 2025, l'App Store a ouvert la fonctionnalité Custom Product Page (CPP) à la Turquie. Les CPP permettent de tester différents ensembles de métadonnées, mais seuls screenshot/vidéo/texte promotionnel varient ; titre/sous-titre restent fixes. C'est suffisant — par exemple, pour un RPG :

- **CPP A :** Accent sur « mythologie turque », détails de personnages en screenshot
- **CPP B :** Accent sur « jouable hors ligne », icône offline en screenshot

Après 6 semaines de test, CPP B a généré 22 % de CVR supplémentaire — l'utilisateur turc priorise l'offline sur la mythologie (le coût du data package reste un facteur décisif).

Les tests de métadonnées sont plus limités — Apple autorise une modification mensuelle, la collecte d'un sample suffisant dure 3-4 semaines. Notre méthodologie : testez d'abord l'hypothèse via CPP (rapide, réversible), puis transposez le variant gagnant aux métadonnées principales. Exemple : testez « savaş » vs « strateji » dans le texte promotionnel de CPP, basculez le gagnant au sous-titre.

Ne mesurez pas uniquement impression/CVR — considérez la rétention. Certains mots-clés poussent un CVR élevé mais une rétention D1 faible, car ils créent une fausse attente. Le mot-clé « tempo rapide aksiyon » booste le CVR pour un casual RPG mais affiche une rétention D1 en baisse de 8 % car l'utilisateur n'anticipait pas la mécanique idle. Lors de l'[App Store Optimization](https://www.roibase.com.tr/fr/aso), la cohérence de rétention détermine le ROI long terme des métadonnées.

## Sélection de Catégorie et Impact de Cross-Promotion

L'App Store Turquie compte 23 sous-catégories dans « Jeux ». La catégorie principale d'un jeu est immuable post-lancement, mais la catégorie secondaire peut être modifiée une fois par mois. C'est un outil stratégique — un tower defense peut être Stratégie (primaire) et Action (secondaire). Modifiez la catégorie secondaire en fonction des saisons : « Aventure » en été, « Stratégie » en hiver — le comportement utilisateur turc varie saisonnièrement (en été, la préférence pour les casual games augmente de 18 %).

Le choix de catégorie affecte la pondération des mots-clés. Pour un jeu en catégorie « Stratégie », le mot-clé « strateji » est sur-concurrentiel — tout le monde l'utilise. Préférez des mots-clés de niche : « turn-based strateji », « hex grid savaş ». La catégorie établit déjà l'intent général ; les métadonnées doivent être spécifiques.

La cross-promotion crée un effet indirect sur les métadonn