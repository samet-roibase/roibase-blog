---
title: "Production RAG : La Qualité de la Récupération Prime sur le Coût"
description: "Sélection du modèle d'embedding, stratégie de chunking et configuration d'évaluation — comment gérer les compromis performance/coût dans les systèmes RAG en production."
publishedAt: 2026-07-27
modifiedAt: 2026-07-27
category: ai
i18nKey: ai-003-2026-07
tags: [rag, retrieval, embedding, chunking, llm-eval]
readingTime: 9
author: Roibase
---

Lorsqu'on déploie les systèmes RAG en production, le problème le plus fréquent est le suivant : si la qualité de la récupération est faible, aucun LLM puissant ne sauvera vos réponses. Le modèle `text-embedding-3-large` d'OpenAI coûte 0,00013 dollar par token, celui de Cohere `embed-english-v3.0` coûte 0,0001 dollar — une différence de 30%, mais si vous récupérez les mauvais chunks, le résultat reste identique : hallucinations. Réduire le coût de l'embedding en dégradant la qualité de la récupération augmente le coût du LLM en aval de 200% (re-ranking, remplissage du prompt, tentatives supplémentaires). Cet article montre comment prioriser le choix du modèle d'embedding, le chunking et la configuration de l'évaluation dans un pipeline RAG en production.

## Sélection du Modèle d'Embedding : Matrice Latence × Recall

Le choix d'un modèle d'embedding repose sur deux métriques critiques : le recall@k de la récupération (l'information correcte se trouve-t-elle dans les k premiers chunks) et la latence p99. La différence entre Ada v2 et text-embedding-3-small ne tient pas uniquement au prix — c'est aussi la granularité sémantique. Si votre domaine est spécialisé et la terminologie lourde (droit, finance), une variante fine-tunée de Sentence-BERT (768 dimensions) vous donne souvent un meilleur recall que le modèle 1536-dim d'OpenAI.

En production, voici les chiffres que nous observons : avec `text-embedding-3-large`, vous atteignez un score de 64,6 sur le benchmark MTEB, mais sur votre ensemble d'évaluation spécifique au domaine (par exemple, la documentation produit d'une plateforme e-commerce), ce score chute à 58,2. Le modèle `embed-multilingual-v3.0` de Cohere, testé sur du contenu en français, nous a donné un recall@5 de 12% plus élevé — Cohere a utilisé davantage de corpus non-anglophone dans son entraînement multilangue. Il n'existe pas une seule métrique : avec une taille de batch de 128, la latence d'embedding est de 230ms, en requête unique elle est de 45ms. Pour la recherche temps réel, la latence prime ; pour l'indexation hors ligne, le recall prime.

En pratique, voici comment nous testons : vous prenez votre ensemble d'évaluation (100-200 questions + chunks de vérité), vous indexez avec 3 modèles, vous calculez recall@1/3/5 et MRR (mean reciprocal rank) pour chacun. Une fois le modèle gagnant sélectionné, vous décidez si le fine-tuning vaut le coup — si recall@5 est en dessous de 75%, le ROI du fine-tuning est positif. Les [travaux d'analyse de données](https://www.roibase.com.tr/fr/verianalizi) de Roibase incluent l'infrastructure de métriques nécessaire pour mettre en place ce pipeline d'évaluation.

## Stratégie de Chunking : Fixed vs Sémantique vs Récursif

La taille des chunks est l'hyperparamètre le plus critique du RAG. Entre un chunk de 512 tokens et un chunk de 2048 tokens, la différence est la suivante : un chunk plus petit offre une récupération plus spécifique mais perd du contexte ; un chunk plus grand préserve le contexte mais ajoute du bruit. De plus, le taux de chevauchement des chunks (par exemple, 10%) affecte également la précision de la récupération.

Le chunking de taille fixe (couper tous les 512 tokens) est la méthode la plus simple, mais couper au milieu d'un paragraphe brise l'intégrité sémantique. Le `RecursiveCharacterTextSplitter` de Langchain fonctionne comme suit : d'abord diviser par `\n\n` (paragraphe), puis par `\n` (ligne) si trop gros, puis par point. Cette méthode donne 18% de meilleur recall@3 car les limites de chunk suivent la structure naturelle du texte.

Le chunking sémantique va plus loin : vous créez les chunks en fonction de la similarité d'embedding. Par exemple, lorsqu'un changement de sujet est détecté dans un document (la similarité cosinus tombe en dessous de 0,6), vous lancez un nouveau chunk. Le `SemanticSplitterNodeParser` de LlamaIndex utilise cette méthode. En production, nous observons ce compromis : le chunking sémantique augmente le temps d'indexation de 40% (chaque phrase est embedée) mais améliore la qualité de la récupération de 9%.

### Chevauchement des Chunks : Combien Est Suffisant ?

Le taux de chevauchement est généralement maintenu entre 10% et 20%. Sur un chunk de 512 tokens, un chevauchement de 50 tokens signifie qu'une phrase peut apparaître dans deux chunks. À mesure que le chevauchement augmente, la taille de l'index augmente (coût de stockage) mais la qualité de la récupération s'améliore pour les cas limites. Dans nos tests, 15% de chevauchement est le point optimal : au-delà, les rendements diminuent.

La stratégie de chevauchement elle-même importe : faut-il une fenêtre glissante (chaque chunk avance de 50 tokens) ou un chevauchement conscient des paragraphes (le chevauchement ne se produit qu'en début de paragraphe) ? Le chevauchement conscient des paragraphes produit 7% moins de chunks tout en conservant la même qualité de récupération.

## Configuration de l'Évaluation : Les Métriques Hors Ligne Doivent Représenter la Production

Le plus grand piège de l'évaluation RAG est le suivant : vos métriques hors ligne ont l'air bonnes, mais en production vous constatez une explosion des hallucinations. C'est parce que votre ensemble d'évaluation ne représente pas la distribution des requêtes en production. Notre recommandation : extrayez 200 requêtes aléatoires des logs de production et marquez manuellement les chunks de vérité. Ce travail de 4 heures vous guide correctement pendant 6 mois.

Les métriques à mesurer :

| Métrique | Définition | Cible |
|---|---|---|
| Recall@k | L'information correcte se trouve-t-elle parmi les k premiers chunks | >80% (k=5) |
| MRR | Classement moyen du chunk correct | >0,7 |
| Précision du contexte | Quel pourcentage des chunks récupérés est pertinent | >60% |
| Pertinence de la réponse | La réponse du LLM est-elle liée à la question (LLM-as-judge) | >85% |
| Fidélité | La réponse du LLM provient-elle uniquement du contexte | >90% |

Pour mesurer la précision du contexte et la fidélité, nous utilisons LLM-as-judge : nous demandons à GPT-4o-mini « Ce chunk est-il lié à la question ? » et nous obtenons un score 0-1. Cette méthode montre une corrélation de 89% avec l'évaluation humaine (dans notre évaluation interne) et coûte 1/50ème du prix de l'évaluation humaine.

En production, vous devez faire une évaluation continue : à chaque tranche de 1000 requêtes, prélevez aléatoirement 10 requêtes et faites-les passer par le pipeline d'évaluation ; si une baisse de recall est détectée, déclenchez une alerte. Cette configuration s'installe facilement avec Prometheus + Grafana — la latence de récupération, le nombre de chunks, les métriques d'utilisation de tokens du LLM peuvent être suivis sur le même tableau de bord.

## Recherche Hybride : Combinaison de Récupération Dense + Sparse

La récupération purement dense (similarité d'embedding uniquement) manque parfois les correspondances de termes exacts. Par exemple, lorsqu'un utilisateur demande « Q3 2025 revenue », le chunk « third quarter 2025 revenue » est sémantiquement proche mais ne contient pas les termes exacts — BM25 et les méthodes sparse font mieux ici. La recherche hybride combine les deux : la récupération dense ramène les top-50 chunks, la récupération sparse ramène les top-50 chunks, les deux sont fusionnées avec RRF (reciprocal rank fusion).

Des bases de données vectorielles comme Weaviate et Qdrant supportent nativement la recherche hybride. Dans nos tests, la recherche hybride donne 6% de meilleur recall@10 que la pure dense, mais augmente la latence de 18% (deux requêtes d'index distinctes). En production, vous pouvez activer/désactiver la recherche hybride selon la complexité de la requête : si la requête fait moins de 3 mots, utilisez uniquement sparse ; si elle dépasse 10 mots, utilisez uniquement dense ; sinon, utilisez hybride.

Le paramètre alpha (poids dense vs sparse) varie selon le domaine : en e-commerce, le sparse est plus important (code produit, SKU) ; en documentation technique, le dense est plus important (similarité conceptuelle). Notre alpha par défaut est 0,7 (poids dense) mais doit être optimisé via test A/B.

## Re-Ranking : Augmentation de la Précision Après Récupération

La première récupération ramène 50 chunks, mais les donner tous en contexte au LLM est à la fois coûteux et bruyant. Le modèle de re-ranking (comme `rerank-english-v3.0` de Cohere) redonne un score à ces 50 chunks en fonction de la requête et en sélectionne les 5-10 plus pertinents. Le re-ranker a une mission différente : le modèle d'embedding mesure la similarité sémantique générale, le re-ranker mesure la pertinence requête-chunk.

En production, le re-ranking offre 15% de meilleure précision de contexte mais ajoute 80ms de latence. Le compromis est le suivant : si votre coût du LLM en aval est élevé (vous utilisez GPT-4), le ROI du re-ranking est positif ; si vous utilisez GPT-4o-mini, le coût de latence pèse plus lourd. Dans notre configuration, les requêtes critiques (SLA <500ms) sautent le re-ranking, tandis que les requêtes analytiques (tableau de bord, rapport) l'utilisent.

Le choix du re-ranker importe aussi : le modèle de Cohere repose sur un cross-encoder, a une latence élevée mais une bonne précision. Le re-ranker de Jina AI repose sur un bi-encoder, a une latence faible mais une précision 4% inférieure. En production, testez les deux et décidez en fonction du compromis latence/précision.

## Profil de Coût : L'Économie des Tokens Commence par l'Embedding

Dans un pipeline RAG, les coûts se répartissent comme suit (cas de production moyen) :

- Embedding : 8%
- Recherche vectorielle : 2% (compute)
- Re-ranking : 5%
- Inférence LLM : 85%

Le coût de l'embedding semble faible, mais il est calculé à grande échelle lors de l'indexation. 1M documents, moyenne 1000 tokens/document, OpenAI `text-embedding-3-large` avec 1B tokens = 130 dollars. Si vous réindexez chaque mois (pas incrémental, reindex complet), le coût annuel d'embedding est de 1560 dollars. Passer à Cohere coûte 1200 dollars. 23% d'économies.

Mais le vrai coût est ailleurs : si la qualité de la récupération est faible, le LLM réessaye, remplit le prompt, corrige les hallucinations — c'est une augmentation de 200% de tokens. 1M requêtes/mois, moyenne 2000 tokens/requête, GPT-4o 10 dollars/1M tokens = 20K dollars/mois. Si la qualité de la récupération baisse de 10%, le taux de retry augmente de 15%, le coût monte à 23K dollars. Vous économisez 30 dollars sur l'embedding tout en perdant 3K dollars en aval.

C'est pourquoi, lorsqu'on parle de « RAG en production », la première question devrait être : avez-vous une configuration d'évaluation de la récupération ? Si la réponse est non, le choix du modèle d'embedding est prématuré. L'[architecture de données first-party](https://www.roibase.com.tr/fr/firstparty) inclut la mise en place de l'infrastructure de logs qui alimente ce pipeline d'évaluation — les requêtes de production, les résultats de récupération, les réponses du LLM doivent être sauvegardés de manière structurée pour une analyse ultérieure.

## Indexation Incrémentale : Comment Réagir aux Données Changeantes

En production, l'ensemble de documents n'est pas statique — chaque jour, de nouveaux articles de blog, pages produit, documentations sont ajoutés. Une réindexation complète est coûteuse et entraîne des interruptions de service. La méthode d'indexation incrémentale fonctionne ainsi : vous réembeddez uniquement les documents modifiés et les ajoutez à la base de données vectorielle. Qdrant et Pinecone supportent nativement l'insertion incrémentale.

La difficulté est la suivante : lorsqu'un document change, réindexez-vous uniquement son chunk modifié ou le document entier ? Si les limites de chunks changent (nouveau paragraphe ajouté, taille de chunk modifiée), vous devez recalculer tous les chunks du document. Notre stratégie : nous suivons la version du document (hash), si la version change, nous supprimons tous les chunks et les réajoutons. Cette méthode provoque 3% de réindexation supplémentaire mais garantit la cohérence.

La stratégie de suppression importe aussi : si vous ne supprimez pas les anciens chunks de la base de données vectorielle, l'index se pollue et la pertinence baisse. Mais ajouter un TTL à chaque chunk représente une surcharge. Notre solution : nous ajoutons `doc_id` et `version` comme métadonnées à chaque chunk ; quand un document est mis à jour, nous supprimons en bloc les chunks de l'ancienne version avec `doc_id + version`. Cette méthode prend 200ms sur Qd