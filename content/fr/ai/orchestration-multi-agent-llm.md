---
title: "Orchestration Multi-Agent : Partir d'Un Seul Appel LLM vers les Systèmes"
description: "Agent SDK, tool use et topologies parallèles/série pour intégrer les LLM aux processus métier. Trade-offs de production et architectures d'orchestration."
publishedAt: 2026-07-02
modifiedAt: 2026-07-02
category: ai
i18nKey: ai-008-2026-07
tags: [multi-agent, llm-orchestration, agent-sdk, tool-use, ai-infrastructure]
readingTime: 9
author: Roibase
---

La phase de preuve de concept où vous effectuez un appel API LLM unique et recevez une réponse a pris fin en 2023. En 2026, les entreprises qui déploient les LLM en production gèrent ce que nous appelons « l'orchestration d'agents » : plusieurs modèles, chacun ayant accès à des outils différents, fonctionnant en parallèle ou en série, observables et rejouables. Dans cet article, vous verrez quelles décisions prendre lors de la mise en place d'une architecture multi-agent, ce que promettent les différents SDK et quels trade-offs impliquent les topologies d'orchestration.

## Ce que Promettent les SDK d'Agent et ce qu'ils Livrent

Les frameworks comme LangChain, CrewAI, Semantic Kernel et LlamaIndex sont commercialisés comme des « SDK d'agent ». Ils partagent une promesse commune : autorisez votre LLM à utiliser des outils, établissez une hiérarchie de prise de décision, gérez les chaînes. En réalité, ces outils sont-ils suffisants ?

Le premier problème : **l'overhead d'abstraction**. Des bibliothèques de haut niveau comme LangChain facilitent le tool binding mais compliquent le débogage. En production, quand un appel d'outil échoue, il faut déterminer si c'est l'état interne de LangChain ou la réponse API qui pose problème — cela signifie parser les traces. Si vous avez un support natif comme l'API Computer Use d'Anthropic, utiliser le SDK directement offre généralement une meilleure visibilité.

Le deuxième problème : **le versioning**. Les SDK d'agent itèrent rapidement, les breaking changes sont fréquents. Par exemple, la transition LangChain 0.1 → 0.2 a déprécié certaines structures de chaîne. Au lieu d'attendre les correctifs sur une version épinglée en production, implémenter vous-même la logique tool use est parfois plus durable. Surtout si vous avez une logique métier personnalisée à la couche d'orchestration — vous ne serez pas contraint par la structure opinionée du SDK.

Le troisième avantage : **l'observabilité intégrée**. Des add-ons comme LangSmith ou la suite d'éval de LlamaIndex visualisent la chaîne d'appels. C'est critique pour le débogage en production — quel agent a appelé quel outil, où la latence explose-t-elle, quel prompt a consommé quels tokens. Si vous écrivez votre propre orchestration, vous devez aussi mettre en place cette télémétrie. Les SDK vous font gagner du temps mais comportent un risque de lock-in.

## Tool Use : Au-delà du Function Calling

Le tool use, c'est quand un LLM génère une sortie structurée pour faire des requêtes vers des API externes. OpenAI function calling, Anthropic tool use, Google function calling — tous implémentent le même principe avec des formats de schéma différents. La partie intéressante, c'est quand les outils sont **interdépendants**.

Exemple simple : un agent d'automatisation de campagne e-mail. Premier outil : `list_segments` (récupère la liste des segments depuis le CRM). Deuxième outil : `get_segment_stats` (retourne les métriques du segment). Troisième outil : `create_campaign` (crée l'objet de campagne). Vous devez exécuter ces trois outils en **série** car la sortie de chacun alimente l'entrée du suivant.

Exemple complexe : un agent d'analyse de données. Vous pouvez exécuter `query_bigquery`, `fetch_gsc_data` et `fetch_ga4_events` en **parallèle** car ils sont indépendants les uns des autres. L'exécution parallèle réduit la latence de production, mais l'orchestrateur doit gérer les limites de concurrence et de débit. Le SDK Anthropic peut effectuer des appels d'outils parallèles, mais OpenAI function calling est séquentiel (au Q2 2026). Dans ce cas, vous écrivez vous-même l'orchestrateur.

Un trade-off critique du tool use : **déterminisme versus flexibilité**. Si vous dites au LLM « choisissez l'un de ces trois outils », il peut choisir différemment à chaque exécution. Si vous hard-codez la séquence d'outils, vous perdez en flexibilité mais gagnez en reproductibilité. En production, c'est généralement **hybride** : hard-codez le chemin critique, laissez le LLM décider pour les choix optionnels.

### Exemple de Chaîne d'Appel d'Outil

```python
# Chaîne d'outils en série (chaque étape alimente l'entrée de la suivante)
def orchestrate_campaign(prompt: str, client: AnthropicClient):
    # 1. Lister les segments
    segments = client.tool_use("list_segments", {})
    
    # 2. Récupérer les stats pour chaque segment (batch parallèle)
    stats_calls = [
        client.tool_use("get_segment_stats", {"segment_id": s})
        for s in segments["ids"]
    ]
    stats = asyncio.gather(*stats_calls)
    
    # 3. Créer une campagne pour le segment avec le meilleur engagement
    best_segment = max(stats, key=lambda x: x["engagement"])
    campaign = client.tool_use("create_campaign", {
        "segment_id": best_segment["id"],
        "message": prompt
    })
    return campaign
```

Dans cet exemple, il y a une structure `list_segments` → `get_segment_stats` (parallèle) → `create_campaign` (série). Le LLM n'intervient que dans la génération du message final — c'est une architecture **semi-autonome** où l'orchestrateur gère la logique des appels d'outils.

## Topologie d'Agent Parallèle vs. Série

Dans les systèmes multi-agent, il existe deux topologies fondamentales : **parallèle** (plusieurs agents fonctionnent simultanément, leurs sorties sont fusionnées) et **série** (chaque agent produit l'entrée du suivant).

La topologie **parallèle** est généralement utilisée pour la **spécialisation**. Exemple : un pipeline de génération de contenu. L'agent A rédige le titre, l'agent B génère les paragraphes du corps, l'agent C optimise la meta description SEO. Les trois reçoivent le même brief en entrée, leurs sorties sont fusionnées. L'avantage : chaque agent se spécialise dans son domaine, les prompts sont plus courts, le coût en tokens diminue (le contexte n'est pas partagé). L'inconvénient : overhead de coordination. Si les sorties sont incompatibles, une réconciliation manuelle est nécessaire.

La topologie **série** est utilisée pour le **raffinement** ou la **validation**. L'agent A génère un brouillon, l'agent B effectue une vérification des faits, l'agent C corrige le ton. Chaque agent traite la sortie du précédent. L'avantage : chaque étape améliore la précédente, la structure de raisonnement linéaire est facile à déboguer. L'inconvénient : latence — chaque agent doit attendre le précédent. Le temps total est N × latence moyenne de l'agent.

Roibase utilise un modèle hybride dans ses opérations marketing : dans les processus d'**[Optimisation de Contenu Géographique (GEO)](https://www.roibase.com.tr/fr/geo)**, des agents en parallèle scrapent les citations de différents moteurs de recherche (ChatGPT, Perplexity, Gemini), tandis qu'une chaîne d'agents en série apparie ces citations aux patterns de mentions de marque. La partie parallèle accélère la collecte de données, la partie série fournit la profondeur d'analyse.

### Comparaison des Topologies

| Architecture | Latence | Spécialisation | Débogage | Cas d'Usage |
|---|---|---|---|---|
| Parallèle | Faible (durée max de l'agent) | Élevée | Logique de fusion complexe | Collecte de données, analyse multi-sources |
| Série | Élevée (somme des durées d'agent) | Faible | Trace linéaire | Raffinement, validation, raisonnement multi-étapes |
| Hybride | Moyenne | Élevée | Complexe | Pipelines de production |

## État d'Orchestration et Rejouabilité

Quand vous mettez en place un système multi-agent, la décision la plus critique est : **où allez-vous stocker l'état ?** Il y a trois options.

**Orchestration sans état (stateless)** : chaque agent est indépendant, l'orchestrateur garde les sorties intermédiaires en mémoire. Avantage : rejouer est facile, la montée en charge horizontale est possible. Inconvénient : pression mémoire — avec une longue chaîne, vous stockez des GBo d'historique de conversation.

**Orchestration avec état (stateful)** : vous persistez l'état intermédiaire dans un magasin externe (Redis, PostgreSQL). Avantage : utilisation mémoire faible, la récupération en cas de panne est possible. Inconvénient : overhead I/O, la garantie de cohérence est requise.

**Hybride (checkpointing)** : vous persistez l'état à certains jalons. Par exemple, tous les 5 appels d'agent, créez un checkpoint. En cas de panne, vous reprenez à partir du dernier checkpoint. Avantage : équilibre entre performance et fiabilité. Inconvénient : implémentation complexe.

En production, un pattern courant pour **[l'Architecture de Données et Mesures First-Party](https://www.roibase.com.tr/fr/firstparty)** est d'écrire l'état d'orchestration dans un flux de logs. Chaque appel d'agent devient un log structuré dans BigQuery ; pour rejouer, vous utilisez l'event sourcing. De cette façon, vous pouvez analyser rétrospectivement la chaîne d'attribution — quelle sortie d'agent a influencé quelle métrique en aval.

## Eval et Observabilité : Débogage d'Orchestration

Le débogage d'un système multi-agent est difficile car il y a de nombreux points de défaillance. L'agent A a-t-il choisi le mauvais outil, l'agent B a-t-il mal parsé l'entrée, la logique de fusion de l'orchestrateur est-elle défectueuse ? Une **pile d'observabilité** est obligatoire.

Les métriques dont vous avez besoin :
- **Latence au niveau de l'agent** (p50, p95, p99) — quel agent est le goulot ?
- **Taux de réussite de l'outil** — quel appel API échoue fréquemment ?
- **Utilisation de tokens par agent** — attribution des coûts
- **Score d'eval** — utilisez LLM-as-judge pour évaluer chaque sortie d'agent sur une échelle 0-1

Pour l'eval, un pattern que nous utilisons : **scoring sans référence**. Un LLM « superviseur » (par exemple GPT-4) évalue chaque sortie d'agent avec des scores « completion de tâche » et « hallucination ». Ces scores sont stockés comme des séries temporelles ; les régressions sont détectées. Par exemple, si le score de hallucination de l'agent A passe de 0,1 à 0,3, vous restaurez la version précédente du prompt.

Une autre technique recommandée par Anthropic : **Claude comme évaluateur**. Grâce à sa fenêtre de contexte large, passez toute la chaîne d'agents à Claude dans un seul prompt et demandez : « y a-t-il une erreur logique dans cette chaîne ? » Cette méta-évaluation est utilisée dans le processus d'assurance qualité avant la production.

## Trade-offs d'Orchestration et Matrice de Décision

Quand vous choisissez votre architecture multi-agent, vous considérez ces trade-offs :

**1. Complexité versus contrôle :** Utiliser un SDK accélère l'implémentation mais obscurcit le débogage. Écrire un orchestrateur personnalisé donne du contrôle mais augmente la charge de maintenance.

**2. Latence versus spécialisation :** Les agents parallèles sont rapides mais engendrent un overhead de coordination. Les agents en série permettent un raisonnement plus profond mais sont plus lents.

**3. Coût versus qualité :** Chaque appel d'agent consomme des tokens. Augmenter le nombre d'agents peut améliorer la qualité mais le coût croît linéairement. En production, vous devez trouver le « nombre minimal viable d'agents ».

**4. Déterminisme versus adaptabilité :** Les séquences d'outils hard-codées sont reproductibles mais ne gèrent pas les cas limites. Laisser le LLM choisir les outils est adaptatif mais non-déterministe.

La matrice de décision utilisée chez Roibase :

| Cas d'Usage | Topologie | SDK | Gestion d'État |
|---|---|---|---|
| Collecte de données | Parallèle | LlamaIndex | Sans état |
| Raffinement de contenu | Série | Personnalisé | Checkpointing |
| Inférence temps réel | Hybride | SDK Anthropic | Cache Redis |
| Traitement par batch | Parallèle | LangChain | PostgreSQL |

## Déployer l'Orchestration en Production

Quand vous déployez un système multi-agent en production, prêtez attention à trois choses.

**Limitation de débit :** Les agents parallèles peuvent dépasser la limite de débit des API. Utilisez le pattern token bucket ou semaphore dans l'orchestrateur. Si l'API Anthropic a une limite de 50 req/min, limitez par débit le nombre d'agents parallèles en conséquence.

**Stratégie de secours :** Que faites-vous si un agent échoue ? La logique de retry est basique, mais ajoutez l'exponential backoff + jitter. Si l'agent n'est pas critique (par exemple, un générateur optionnel de meta tag SEO), utilisez le circuit breaker et basculez en mode sûr.

**Suivi des coûts :** Loggez le coût en tokens de chaque appel d'agent. En production, suivez la métrique $/request par agent. Si un agent provoque un pic de coûts, optimisez son prompt ou désactivez-le.

La puissance de l'orchestration multi-agent ne réside pas dans « faire plus qu'un seul LLM », mais dans la capacité à **r