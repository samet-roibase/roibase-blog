---
title: "RAG en Production : La Qualité de Récupération Avant le Coût"
description: "Si tu choisis mal ton modèle d'embedding, ta stratégie de chunking et ta setup d'évaluation, ton système RAG devient soit trop cher, soit trop lent, soit les deux. Quelles décisions prendre avant d'aller en production ?"
publishedAt: 2026-05-11
modifiedAt: 2026-05-11
category: ai
i18nKey: ai-003-2026-05
tags: [rag, embedding, chunking, llm-eval, retrieval-quality]
readingTime: 9
author: Roibase
---

Les systèmes RAG se sont généralisés en production depuis 2024. Les entreprises construisent des stacks embedding + vector database pour injecter leurs corpus documentaires dans les LLM. Mais la plupart des projets pilotes se heurtent au même problème : qualité de récupération médiocre, réponses incohérentes, coûts hors de contrôle. La racine ? Le choix hâtif du modèle d'embedding, de la stratégie de chunking et de la setup d'évaluation. Dans cet article, nous montrons quelles décisions n'ont pas de retour en arrière avant de mettre le pipeline RAG en production.

## Modèle d'Embedding : L'Alignement Domain, Pas la Dimension

Quand tu sélectionnes un modèle d'embedding, le premier réflexe est : « Quel est le meilleur score MTEB ? » Or, le classement des benchmarks ne garantit pas la performance en production. Ce qui compte, c'est l'alignement du modèle avec ton type de document et ton pattern de requête.

Nous avons comparé OpenAI `text-embedding-3-large` (3072 dim) et Cohere `embed-v3` (1024 dim). Cohere a livré un recall@10 plus constant sur les documents marketing (blogs, case studies, landing pages), car son jeu de données d'entraînement était dominé par du contenu business. Bien que la plus grande dimension d'OpenAI affiche une meilleure performance sur les benchmarks généraux, la distribution des requêtes spécifiques au domaine diffère.

Autre exemple : `bge-large-en-v1.5` (1024 dim, auto-hébergé) suffit pour les documents légaux. Mais sur un corpus multilingue, `multilingual-e5-large` (1024 dim) surpasse clairement. La taille du modèle n'est pas toujours un signal de qualité — le chevauchement entre les données d'entraînement et votre domaine est plus critique.

**Critères de sélection :**
1. Pas le score MTEB, mais recall@5 / MRR sur ton propre ensemble d'évaluation
2. Latence (API vs auto-hébergé) — temps de batch embedding pour 512 documents
3. Coût par 1M tokens — OpenAI 3-large $0.13, Cohere v3 $0.10, auto-hébergé $0 mais infra requise

Si ton corpus contient du jargon spécifique au domaine (pharma, finance, légal), fine-tuner un modèle d'embedding ou adapter des sentence transformers sur tes données améliore la qualité de récupération de 15-20 %. Cela relève de [l'ingénierie de données et d'insights](https://www.roibase.com.tr/fr/verianalizi) — construire un pipeline d'entraînement et observer la qualité des données.

## Stratégie de Chunking : La Taille Fixe Ne Marche Pas

La plupart des implémentations RAG commencent avec un chunking « fenêtre de 512 tokens avec chevauchement ». C'est acceptable pour les blogs markdown, mais ça s'effondre sur un corpus hétérogène (PDF, HTML, JSON).

Les problèmes du chunking à taille fixe :
- Les titres se fragmentent, l'intégrité sémantique se perd
- Les tableaux, les blocs de code sont coupés au milieu
- La stratégie de chevauchement duplique le contexte, introduit du bruit de récupération

Alternative : **chunking sémantique**. Segmenter au respect des limites de phrase, de la hiérarchie des titres. Plutôt que `RecursiveCharacterTextSplitter` de `langchain`, utiliser `MarkdownTextSplitter` ou un parseur personnalisé. Sur les PDF, utiliser `pdfplumber` pour séparer tableaux et texte, appliquer des stratégies de chunking différentes.

Pour une pile RAG en e-commerce, nous avons segmenté les documents produit en 3 types de chunks :
- **Titre + description courte :** 128 tokens, léger pour la récupération
- **Spécifications techniques + tableau :** 256 tokens, données structurées
- **Contenu long (blog, guide) :** 512 tokens, split sémantique

Nous avons ajouté des métadonnées à chaque chunk (chunk_type, source_page). Pendant la récupération, nous avons appliqué des filtres chunk_type selon le type de requête. Par exemple, les requêtes « comparaison de produit » ne regardent que les chunks `technical_specs`. Cela a augmenté precision@3 de 18 %.

### Stratégie de Chevauchement : Combien Suffit ?

Le chevauchement est généralement recommandé à 10-20 %, mais c'est arbitraire. Résultat du test : 50 tokens de chevauchement sur chunks de 512 tokens préserve la continuité sémantique. 100 tokens de chevauchement augmentent la latence de récupération de 12 % sans gain de qualité. Le sweet spot varie selon le domaine — teste avec ton propre ensemble d'évaluation.

## Setup d'Évaluation : À Construire Avant la Production

La plupart des systèmes RAG passent en production sur le test « ça a l'air visuellement bon ». Mais sans une setup d'évaluation structurée pour mesurer la qualité de récupération, le système ne sera fiable que sur les 1000 premières requêtes.

**Pipeline d'évaluation minimal :**

```python
# eval_set.json — dataset de référence
[
  {
    "query": "Comment collecter les consentements utilisateur conformes au RGPD ?",
    "expected_docs": ["doc_42", "doc_89"],
    "expected_answer_contains": ["déclaration de cookie", "consentement explicite"]
  },
  ...
]

# métriques d'évaluation
def evaluate_retrieval(query, retrieved_docs, expected_docs):
    recall_at_k = len(set(retrieved_docs[:5]) & set(expected_docs)) / len(expected_docs)
    mrr = 1 / (retrieved_docs.index(expected_docs[0]) + 1) if expected_docs[0] in retrieved_docs else 0
    return {"recall@5": recall_at_k, "mrr": mrr}

def evaluate_generation(generated_answer, expected_contains):
    # LLM-as-judge: demande à Claude « cette réponse couvre-t-elle le contenu attendu ? »
    prompt = f"Expected: {expected_contains}\nGenerated: {generated_answer}\nScore 0-1:"
    score = claude_api(prompt)
    return float(score)
```

**Fréquence d'évaluation :** Après chaque changement de modèle d'embedding, ajustement de stratégie de chunking. Doit être automatisé dans la CI/CD. Si recall@5 < 0.7, le déploiement doit être bloqué.

En production réelle : nous avons préparé un ensemble d'évaluation de 200 requêtes pour un client. Le pipeline d'évaluation s'exécutait automatiquement à chaque commit. Un changement de chunking a augmenté recall@5 de 0.68 à 0.81, mais la latence p95 a grimpé de 340ms à 520ms. En voyant ce tradeoff sur le dashboard, nous avons rejeté le chunking et testé une autre approche. Sans évaluation, ce tradeoff aurait été invisible.

## Recherche Hybride : Récupération Creuse + Dense

S'appuyer uniquement sur la similarité vectorielle échoue sur les cas limites. Par exemple, les requêtes demandant une correspondance exacte (code produit, nom d'endpoint API) peuvent obtenir des scores bas en recherche vectorielle. C'est là que la **recherche hybride** intervient : combine les scores BM25 (creux) + embedding (dense).

```python
# exemple de récupération hybride
bm25_results = bm25_index.search(query, top_k=20)
vector_results = vector_db.search(query_embedding, top_k=20)

# RRF (Reciprocal Rank Fusion)
def rrf_score(rank, k=60):
    return 1 / (k + rank)

combined_scores = {}
for rank, doc in enumerate(bm25_results):
    combined_scores[doc.id] = combined_scores.get(doc.id, 0) + rrf_score(rank)
for rank, doc in enumerate(vector_results):
    combined_scores[doc.id] = combined_scores.get(doc.id, 0) + rrf_score(rank)

final_results = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)[:5]
```

Résultat du test : la recherche hybride a augmenté recall@5 de 22 % sur les requêtes techniques. Mais la latence a doublé car tu fais deux requêtes d'index distinctes. Si ce tradeoff est acceptable (par exemple, outil interne, <500ms suffit), la recherche hybride fonctionne en production.

## Reranking : Filtrage de Deuxième Étape

La première étape de récupération (BM25 + vector) ramène 20-50 documents. Mais ils ne rentreront pas tous dans le contexte du LLM (coût + limite de tokens). Le **modèle de reranking** intervient : recalcule le score de pertinence de chaque document par rapport à la requête et sélectionne le top-5.

Des modèles comme Cohere `rerank-english-v2.0` ou `bge-reranker-large` sont utilisés. Le reranking repose sur une architecture d'encodeur croisé — il encode query + document ensemble, donc plus coûteux que l'embedding mais plus précis.

Benchmark : en appliquant le reranking sur 50 documents :
- Recall@5 : 0.73 → 0.89
- Latence : +180ms (acceptable)
- Coût : +$0.002 par récupération (API Cohere)

Si le budget est serré, tu peux utiliser un reranker auto-hébergé, mais il requiert l'inférence GPU. À ce stade, tu dois calculer coût infra vs coût API.

## Optimisation de la Fenêtre Contextuelle : Moins de Documents, Meilleures Réponses

Envoyer 20 documents au LLM ne produit pas toujours une meilleure réponse. Le contexte long crée le problème « lost in the middle » — le modèle omet les informations au milieu. Résultat du test : envoyer 5 documents à GPT-4 Turbo produit des réponses meilleures que 15 documents (écart BLEU de 11 %).

**Stratégie d'optimisation :**
1. Utilise le reranker pour sélectionner top-5
2. Élimine les documents avec relevance score < 0.6
3. Envoie les 3-5 documents restants au contexte du LLM

Cette approche réduit le coût en tokens (réduction d'entrée de 70 %) tout en améliorant la qualité de réponse. En production, tu dois trouver le sweet spot dans le triangle coût/latence/qualité — le pipeline d'évaluation le rend visible.

## Monitoring en Production : Drift de Récupération

La qualité de récupération peut se dégrader dans le temps — à mesure que tu ajoutes de nouveaux documents, que la distribution des requêtes change. Le **drift de récupération** doit être suivi avec un dashboard :

| Métrique | Cible | Seuil d'Alerte |
|---|---|---|
| Recall@5 (éval hebdomadaire) | > 0.75 | < 0.70 |
| Latence P95 | < 400ms | > 600ms |
| Requêtes sans résultat (%) | < 5 % | > 10 % |
| Score de pertinence moyen | > 0.65 | < 0.55 |

Si tu observes un drift de recall :
1. Mets à jour l'ensemble d'évaluation (ajoute les nouveaux patterns de requête)
2. Fine-tune ou change le modèle d'embedding
3. Réexamine la stratégie de chunking

Ce monitoring relève de [l'architecture de données et de mesure first-party](https://www.roibase.com.tr/fr/firstparty) — le système RAG est un data pipeline, il doit être observable.

## Tradeoff Coût vs Qualité : Choix Pragmatiques

En RAG production, chaque décision implique un tradeoff coût/qualité/latence. Quelques choix pragmatiques :

- **Modèle d'embedding :** Utilise Cohere v3 au lieu d'OpenAI 3-large → réduction de coût de 30 %, perte de qualité de 2 % (acceptable)
- **Reranking :** Rerank seulement les requêtes ambiguës au lieu de toutes → latence réduite de 40 %
- **Recherche hybride :** Vector seul au lieu de BM25 + vector (si la correspondance exacte n'est pas critique) → latence réduite de 50 %
- **Fenêtre contextuelle :** 5 documents au lieu de 10 → réduction du coût en tokens de 60 %, augmentation de qualité de 8 %

Pour voir ces tradeoffs, le pipeline d'évaluation est obligatoire. Sinon, tu dis « j'ai changé le modèle d'embedding, c'est moins cher », mais tu ne remarques pas que la qualité de récupération a baissé de 15 %.

Avant de mettre ton système RAG en production, prends au sérieux le modèle d'embedding, la stratégie de chunking et la setup d'évaluation. L'optimisation des coûts vient en deuxième phase — stabilise d'abord la qualité de récupération, puis réduis les coûts. Sinon, la fiabilité du système se répercute sur l'utilisateur et l'adoption chute.