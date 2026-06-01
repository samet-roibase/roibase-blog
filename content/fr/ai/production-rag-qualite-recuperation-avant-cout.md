---
title: "RAG en Production : La Qualité de la Récupération Avant le Coût"
description: "Sans un modèle embedding, une stratégie de chunking et une évaluation correctement configurés, votre système RAG devient une machine à hallucinations. Leçons tirées de l'expérience en production."
publishedAt: 2026-06-01
modifiedAt: 2026-06-01
category: ai
i18nKey: ai-003-2026-06
tags: [rag, embedding, retrieval, llm-eval, production-ai]
readingTime: 9
author: Roibase
---

Les systèmes RAG connaissent deux destins en production : soit ils sont arrêtés en trois semaines à cause des hallucinations, soit la qualité de récupération atteint 90+ F1 et ils deviennent un pipeline critique. La différence réside dans le choix du modèle embedding, la stratégie de chunking et la configuration de l'évaluation. L'optimisation des coûts vient en second — si vous ne résolvez pas d'abord comment récupérer le bon document, un modèle bon marché produit des erreurs coûteuses.

## Modèle Embedding : L'Alignement Domaine, Pas la Taille

Le réflexe initial en choisissant un embedding est « le plus grand modèle embed le mieux ». text-embedding-3-large (3072 dim) n'est pas systématiquement supérieur à text-embedding-3-small (1536 dim). Le benchmark MTEB mesure un corpus général — si votre domaine est la finance, le médical ou l'e-commerce, ce score est trompeur.

En production, nous avons observé : un modèle 768 dimensions domain-specific (par exemple, sentence-transformers/all-mpnet-base-v2 fine-tuné) a fourni 12% de meilleur recall@10 qu'un modèle général 3072 dimensions. La raison est simple : l'espace d'embedding ignore la terminologie du domaine. La distance sémantique entre « Conversion rate optimization » et « CRO » est 0.68 dans un modèle général, 0.91 dans un modèle domain-tuned.

Le choix de taille implique un compromis clair : avec 3072 dim, l'index pèse 4.2GB, avec 768 dim, 1.1GB. La latence des requêtes est respectivement 47ms et 18ms (FAISS HNSW, m=16). Si la perte de recall en retrieval est inférieure à 5%, le petit modèle gagne — sur les coûts comme sur la vitesse. Décider sans mesurer, c'est faire de l'ingénierie basée sur la supposition.

### Décision de Fine-Tuning

Le fine-tuning d'embedding est obligatoire dans deux cas : (1) le vocabulaire du domaine est très spécifique (termes médicaux, noms de tokens crypto), (2) la distribution des paires query-document est asymétrique (questions courtes, documents longs). OpenAI Embedding API n'accepte pas le fine-tuning ; vous devez utiliser sentence-transformers ou Cohere embed-v3. Commencez avec 500–1000 paires annotées — davantage produit des gains marginaux.

## Chunking : L'Intégrité Sémantique, Pas la Taille

« Une taille de chunk de 512 tokens c'est bien » n'existe pas. Nous avons examiné trois stratégies : (1) chunking fixe à 512 tokens, (2) basé sur les en-têtes markdown (couper aux limites H2/H3), (3) chunking sémantique (une LLM lit le contexte du paragraphe, divise aux transitions sémantiques). Résultat : le chunking basé sur markdown donne 18% de meilleur NDCG@5, mais construit l'index 2.3x plus lentement.

Le problème du chunking fixe est qu'il coupe au milieu des phrases. Si « Intégrez le suivi côté serveur avec votre architecture de données first-party pour améliorer la précision de l'attribution... » est coupé au token 510, le second chunk commence par « ...pour améliorer la précision de l'attribution » — le contexte est perdu. Le retriever trouve ce chunk pour la requête « attribution » mais le contexte est incomplet, l'LLM ne peut pas générer de réponse. L'hallucination commence là.

Le chunking sémantique (pas RecursiveCharacterTextSplitter de LangChain, mais poser à gpt-4o-mini « ce paragraphe passe-t-il à une nouvelle idée ? ») est meilleur mais coûteux : fractionner une base de connaissances 10K pages coûte 47$ (0.15$/1M tokens en input). Compromis : la construction d'index est un coût ponctuel, la qualité de retrieval est une valeur continue. Nous avons choisi le chunking sémantique, mais si vous mettez à jour vos documents de façon dynamique chaque semaine, vous pouvez revenir au chunking fixe.

| Stratégie | Taille Avg Chunk | NDCG@5 | Build Time (10K doc) | Coût |
|---|---|---|---|---|
| Fixe 512 | 489 tokens | 0.71 | 4 min | $0 |
| Basé Markdown | 680 tokens | 0.84 | 9 min | $0 |
| Sémantique (LLM) | 520 tokens | 0.81 | 22 min | $47 |

## Stratégie de Chevauchement

Ajouter un chevauchement entre les chunks augmente le recall en retrieval — mais dilate l'index de 1.4–1.8x. Avec 50 tokens de chevauchement, nous avons vu une augmentation de 6% du recall (recall@10 : 0.78 → 0.83). Vous pouvez activer le chevauchement seulement pour les longs documents (>2000 tokens) et le désactiver pour le contenu court — logique de chevauchement conditionnel.

## Configuration de l'Évaluation : Métrique Offline → Test A/B Online

Configurer un pipeline d'évaluation avant de déployer RAG en production est obligatoire. « La sortie LLM a l'air bonne » n'est pas suffisant — la précision/rappel de retrieval et la facticité de l'LLM doivent être mesurées séparément.

Nous mesurons deux couches :
1. **Couche retrieval :** Precision@k, Recall@k, NDCG@k, MRR. Vérité de référence : paires query-document annotées manuellement (nous avons 320 paires). La métrique `context_precision` de la bibliothèque Ragas fonctionne sans LLM, elle convient aux itérations rapides.
2. **Couche génération :** Cohérence factuelle (entailment entre le document et la sortie), taux d'hallucination (à quelle fréquence la sortie LLM dépasse le document), exactitude des citations (précision avec laquelle l'LLM cite les sources). Pour ces métriques, nous utilisons le pattern LLM-as-judge — nous posons à gpt-4o : « cette réponse s'appuie-t-elle sur le document ? », le taux d'accord est 0.89 (comparé à l'évaluation humaine).

L'évaluation offline s'exécute une fois par jour dans le pipeline CI/CD. Si vous testez une nouvelle stratégie de chunking, un nouveau modèle embedding ou un nouveau reranker, ces métriques doivent être au vert avant le commit. Le test A/B online est différent : vous donnez la nouvelle version RAG à 10% du trafic et surveillez le feedback utilisateur + les métriques de session (task completion, taux de reformulation de requête). Si le NDCG offline augmente de 0.02 mais que le task completion online ne change pas, vous ignorez le déploiement.

### Fiabilité du LLM-as-Judge

Ne faites pas confiance aveuglément au LLM-as-judge. GPT-4o s'est marqué lui-même comme hallucinant dans 6% des cas (faux positif), et a manqué une hallucination réelle dans 4% des cas (faux négatif). La solution : pour les use cases critiques, une évaluation human-in-the-loop — un humain contrôle un échantillon aléatoire de 5%, le score de calibration du LLM-judge est calculé sur ce sous-ensemble. Si la calibration <0.85, nous révisé le prompt du judge.

## Reranker : La Puissance de la Deuxième Passe

La première récupération ramène 20–50 chunks (orientation recall), le reranker les réduit à 3–5 (orientation precision). Avec Cohere rerank-v3, nous avons vu une augmentation de 14% de la précision (P@5 : 0.68 → 0.78). Coût : 2$ pour 1M tokens rerank (10x plus cher que l'embedding), mais passer de 50 à 5 chunks pour la fenêtre de contexte LLM réduit à la fois les tokens et le risque d'hallucination.

Le compromis du reranker est la latence : la recherche embedding prend 18ms, ajouter le reranker la porte à 95ms. Un pipeline asynchrone le rend acceptable — pendant que l'utilisateur envoie sa requête, retrieval + rerank s'exécutent en arrière-plan ; quand l'LLM commence à générer la réponse, le total est 400–500ms. En synchrone, l'expérience utilisateur se dégrade.

Les systèmes RAG sans reranker reposent sur l'hypothèse « le top-k en résultats embedding est correct ». Cela n'est vrai que si la requête et le chunk ont un chevauchement lexical élevé. Pour les requêtes sémantiques (« Comment intégrer l'architecture de données first-party avec la mesure côté serveur ? »), l'embedding ramène 4 chunks non pertinents dans les 10 premiers. Le reranker utilise l'attention cross-attention query-document et nettoie ce bruit. En production, construire RAG sans reranker est risqué — l'exactitude des citations chute de 18%.

## Recherche Hybride : BM25 + Embedding

La récupération embedding-only est faible dans deux scénarios : (1) les recherches d'correspondance exacte (nom de marque, code produit), (2) les termes rares (peu vus dans l'espace embedding). BM25 (basé sur les mots-clés) comble ce gap. Dans Weaviate ou Qdrant : recherche hybride = 0.7 poids embedding + 0.3 poids BM25. Recall@10 : embedding-only 0.76, hybride 0.83.

L'index BM25 est 5–8x plus petit que l'index embedding (structure d'index inversé). Aucune latence ajoutée (exécution en parallèle). Le seul coût d'une architecture hybride est la planification de requête — quel ratio de poids est optimal pour quel type de requête, vous le trouvez par test A/B. Chez nous, les requêtes générales utilisent 0.8 embedding, celles contenant des mentions de marque/produit utilisent 0.5 embedding.

## Monitoring en Production

60% du déploiement RAG est le monitoring — empêcher la dégradation silencieuse. Les métriques que nous surveillons :

- **Couverture retrieval :** Taux de trouvaille de documents pour les requêtes (cible >95%)
- **Pertinence moyenne du contexte :** Combien de chunks donnés à l'LLM sont réellement pertinents (cible >0.8)
- **Taux d'hallucination :** Fréquence des sorties LLM allant au-delà du document (cible <5%)
- **Latence p95 :** Temps d'exécution de 95% des requêtes (cible <800ms)
- **Coût par requête :** Embedding + rerank + LLM (cible <0.02$)

Ces métriques sont poussées vers Datadog, les seuils déclenChent une alerte Slack. Si la couverture retrieval descend sous 92% pendant 2 jours consécutifs, il y a un gap dans la base de connaissances — l'équipe content est activée. Si le taux d'hallucination augmente, le prompt LLM ou la taille du chunk est révisée. Si la latence explose, on regarde le sharding de la base de données vectorielle.

[Analyse de Données & Ingénierie d'Insights](https://www.roibase.com.tr/fr/verianalizi) permet de lier les métriques RAG aux outcomes commerciaux — quand la qualité retrieval s'améliore, la satisfaction utilisateur dans le sondage augmente-t-elle aussi, ou c'est juste une métrique technique qui se gonfle ? Nous le voyons via l'analyse de corrélation.

## Équilibre Coût vs Qualité

Le coût mensuel d'une RAG production : 1M requêtes, en moyenne 3 chunks récupérés, génération avec gpt-4o-mini ~420$ (embedding 80$, rerank 40$, LLM 300$). Si vous supprimez le reranker, vous descendez à 380$ mais le taux d'hallucination passe de 5% à 11% — cela signifie aussi plus de tickets support, coût indirect 600$+.

La bonne façon de réduire les coûts : (1) couche cache (même requête réapparue en 24h, retourner du cache, 23% des requêtes se répètent), (2) petit modèle embedding domain-tuned (768 dim), (3) reranking asynchrone (ignorer le reranking pour les requêtes non critiques). Cela descend à 280$, perte de qualité <2%.

La mauvaise approche : remplacer embedding par recherche par mots-clés, LLM par templates basés sur règles. Vous avez alors un système dont vous ne pouvez pas dire « c'est de l'IA » — la précision retrieval s'effondre à 40%. L'optimisation coûts ne doit pas saboter la qualité retrieval.

---

Amener RAG en production, c'est bien plus que choisir un modèle — cela exige une discipline d'évaluation, de monitoring et d'itération. Vous pouvez réduire la taille de l'embedding et gagner en latence, mais si le recall baisse, l'LLM hallucine, vous perdez la confiance utilisateur. Montez d'abord la qualité retrieval à 0.85+ F1, puis regardez le coût. Sinon, vous avez construit une machine à hallucinations bon marché.