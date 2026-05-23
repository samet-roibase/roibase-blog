---
title: "Multi-Agent Orchestration: Des Systèmes en Un Seul Appel LLM"
description: "Agent SDK, tool use et topologies parallèles/sérielles pour transformer les LLM en systèmes production — arbitrage latence, coût, fiabilité."
publishedAt: 2026-05-23
modifiedAt: 2026-05-23
category: ai
i18nKey: ai-008-2026-05
tags: [multi-agent, llm-orchestration, tool-use, agent-sdk, ai-engineering]
readingTime: 9
author: Roibase
---

En 2024, dire « assistant IA » signifiait une seule boucle prompt-réponse. En 2026, ce qui existe en production est différent : des mesh d'agents parallèles, des pipelines d'orchestration sériels, des agents liés aux systèmes externes via tool use. Construire un système d'agents qui s'envoient des signaux plutôt qu'un appel LLM unique, redéfinit l'équilibre entre fiabilité et coût/latence. L'orchestration multi-agent est la couche architecturale qui transforme l'LLM en composant d'infrastructure production.

## Couche SDK d'Agent et Tool Use

Les frameworks d'agent — LangGraph, Autogen, CrewAI — autorisent le modèle à « appeler des fonctions ». Le tool use consiste pour le modèle à transformer sa propre sortie en function call conforme à un JSON schema, et l'interpréteur exécute cette fonction avant d'ajouter le résultat au prompt. L'OpenAI function calling, l'API tool use de Claude d'Anthropic, la function declaration de Gemini de Google reposent tous sur le même principe : l'LLM ne peut pas exécuter du code déterministe, mais il peut dire quelle fonction appeler avec quels paramètres.

Les SDK gèrent cette boucle : la requête utilisateur arrive, le modèle dit « appelle l'API météo avec city=Istanbul », l'orchestrateur invoque l'API, ajoute la réponse au prompt, le modèle produit la sortie finale. Ces 3 allers-retours = 3×latence. En production, une chaîne de tool call peut atteindre 5-7 étapes, chacune ajoutant 200-800ms, ce qui signifie 1-5 secondes de temps de réponse au total. En multi-agent, l'objectif est de briser cette latence via la parallélisation et le cache.

Exemple de définition d'outil :

```python
tools = [
    {
        "name": "query_analytics",
        "description": "Récupère la métrique spécifiée depuis BigQuery",
        "parameters": {
            "metric": "string (revenue|sessions|conversions)",
            "date_range": "string (7d|30d|90d)"
        }
    }
]
```

Si le modèle décide d'utiliser cet outil, l'orchestrateur invoque le client BigQuery, ajoute le résultat au prompt, le modèle effectue la synthèse finale. La puissance du tool use : l'LLM peut interroger le monde extérieur sans renoncer au déterminisme.

## Topologies d'Agent Parallèles et Sérielles

Un seul agent = traitement sériel. Multi-agent = mélange parallèle + sériel. Deux patterns fondamentaux : **scatter-gather** et **pipeline**.

**Scatter-gather :** L'orchestrateur principal divise la tâche entre 3 agents subordonnés, chacun travaille simultanément avec un outil différent, les résultats fusionnent dans l'agent central. Exemple : « Analyse la performance de la campagne du mois dernier » → l'agent_1 va vers Google Ads API, l'agent_2 vers Meta Ads API, l'agent_3 vers BigQuery, tous en parallèle. L'orchestrateur récupère les 3 réponses, synthétise, produit le rapport final. Latence : max(agent_1, agent_2, agent_3) + latence de synthèse. En sériel, ce serait agent_1 + agent_2 + agent_3 + synthèse. Au lieu de 3×800ms, on a 800ms + 300ms = 1.1s.

**Pipeline :** La sortie d'agent_A est l'input d'agent_B. Exemple : (1) agent de planification des requêtes écrit du SQL → (2) agent d'exécution exécute le SQL → (3) agent de visualisation génère la spec graphique. Chaque étape dépend de la précédente. La latence est sérielle, mais **chaque agent est spécialisé** — le planificateur peut être un petit modèle (GPT-4o-mini, 50ms) sans logique d'exécution, l'agent de visualisation peut utiliser Gemini Flash. Un gros modèle unique au lieu de 3 petits = plus cher + plus lent (dans certains cas).

Roibase utilise l'orchestration multi-agent dans ses services de [Data et Mesure First-Party](https://www.roibase.com.tr/fr/firstparty) : un agent analyse l'événement brut, un agent le lie à une session, un agent mappe le revenu, l'agent final calcule l'attribution cross-canal. Topologie pipeline = étapes déterministes, chacune avec son ensemble d'outils spécifiques.

### Arbitrage Parallèle vs Sériel

| Topologie | Latence | Coût | Cas d'usage |
|-----------|---------|------|------------|
| Parallèle (scatter-gather) | Faible (durée max) | Élevé (N agent × appel LLM) | Requêtes indépendantes (multi-source data pull) |
| Sériel (pipeline) | Élevé (durée totale) | Moyen (chaque agent peut être petit modèle) | Traitement dépendant (parse → enrich → analyze) |
| Hybride (parallèle → merge → sériel) | Moyen | Moyen-Élevé | Tâche complexe (collecte data parallèle, résultat en pipeline) |

En production, on place un limit de concurrence sur scatter-gather pour éviter les rate limits (ex : max 5 appels LLM parallèles). En pipeline sériel, on utilise du cache intermédiaire — si la sortie d'agent_A est valide 10 minutes, la même requête démarre agent_B avec la sortie en cache.

## Responsabilité de l'Orchestrateur : Routage et Gestion d'Erreurs

L'orchestrateur ne se contente pas de déclencher des agents, il **décide quel agent gère quelle tâche**. Dans LangGraph, on parle d'« agent superviseur » : il catégorise la requête entrante et effectue le routage. Exemple de logique :

```python
def route_query(user_query: str) -> str:
    # LLM-based router (petit modèle, rapide)
    classification = llm.classify(user_query, categories=["data_query", "content_gen", "code_review"])
    
    if classification == "data_query":
        return "analytics_agent"
    elif classification == "content_gen":
        return "writer_agent"
    else:
        return "code_agent"
```

L'agent routeur utilise généralement un modèle rapide et bon marché comme GPT-4o-mini ou Claude Haiku. Il ajoute 50-100ms de surcharge mais évite une utilisation inutile d'un grand modèle. Si l'utilisateur dit « résume la performance de la campagne », cela va vers l'analytics_agent (tool use BigQuery), si c'est « écris un article de blog », cela va vers le writer_agent (tool use web search + LLM pour l'écriture).

**La gestion d'erreurs est critique en multi-agent.** Avec un seul agent, si l'LLM hallucine, vous réessayez. En multi-agent, si l'agent_2 travaille avec une sortie erronée de l'agent_1, c'est une cascade de pannes. L'orchestrateur doit valider la sortie de chaque agent :

```python
def validate_agent_output(output: dict, schema: dict) -> bool:
    # Validation schéma JSON
    if not matches_schema(output, schema):
        raise AgentOutputError("La sortie agent ne correspond pas au schéma")
    
    # Vérification sémantique (optionnelle, coûteuse)
    if confidence_score(output) < 0.7:
        return False  # retry ou fallback
    
    return True
```

Si l'agent_1 échoue, l'orchestrateur suit une chaîne de fallback : d'abord un retry (1×), puis un agent alternatif (modèle plus grand), puis human-in-the-loop. Sans cette logique, le multi-agent n'est pas fiable en production.

## Latence et Coût : Scénarios de Benchmark

Scénario de test : « Analyse la tendance des revenus des 30 derniers jours, résume la performance des campagnes, écris un email résumé pour le PDG » — 3 tâches indépendantes.

**Agent unique (GPT-4, sériel) :**
- Requête BigQuery → 800ms (LLM + API)
- Requête plateformes publicitaires → 900ms
- Générer email → 600ms
- **Total :** 2300ms
- **Coût :** 3 tours × $0,03/1K tokens = ~$0,09 (mix input/output supposé)

**Multi-agent (scatter-gather + pipeline) :**
- Agent_1, 2, 3 parallèles (BigQuery, ads, email prep) → max 900ms
- Orchestrateur merge + synthèse → 400ms
- **Total :** 1300ms
- **Coût :** 3 agents × $0,02 (petit modèle) + synthèse $0,03 = ~$0,09 (identique, mais réductible par optimisation de modèles)

**Gain :** 43% de réduction latence. Coût identique, mais avec optimisation de modèles (agent_1 → Gemini Flash, agent_2 → Claude Haiku, orchestrateur → GPT-4o-mini), on passe à $0,05.

**Cependant :** Agent parallèle = consommation parallèle des rate limits. Si le tier OpenAI est 500 RPM, 10 agents parallèles = servez 50 utilisateurs en 5 minutes. Un agent unique aurait servi 500 utilisateurs. En production, on gère ce tradeoff via queue + cache.

## Observabilité et Debug

Dans un système multi-agent, répondre à « où ça a mal tourné ? » est difficile. Les outils comme LangSmith, Helicone, Arize Phoenix visualisent la trace de l'agent : quel agent a appelé quel outil à quel moment, avec quel prompt, qu'a-t-il retourné, où a-t-il fait un retry. Exemple de trace :

```
orchestrator → classify_query (50ms, GPT-4o-mini) → "data_query"
→ analytics_agent → query_bigquery (800ms, tool_call) → success
→ writer_agent → generate_summary (600ms, GPT-4) → success
→ orchestrator → merge_results (200ms) → final_output
```

Le token count, la latence et le coût sont enregistrés à chaque étape. Sans cette télémétrie, on ne peut pas debugger le multi-agent en production. Si l'appel tool d'agent A expire, vous le voyez dans la trace et pouvez ajouter une logique de retry.

Une autre métrique : **utilisation de l'agent**. Si vous avez défini 5 agents mais que 80% des requêtes utilisateur vont vers un seul agent, le routage est défaillant. On mesure la précision de classification du routeur — en utilisant un feedback utilisateur, on crée un dataset étiqueté et on affine l'agent routeur (few-shot prompt plutôt que classifieurs légers).

## Limites du Multi-Agent

Le multi-agent ne résout pas tous les problèmes. Il y a un **overhead de coordination** : passage de messages entre agents, logique d'orchestration, gestion d'erreurs — tout ajoute de la latence. Une requête simple qui prend 1 seconde avec un seul agent peut prendre 1.5 secondes en multi-agent (orchestrateur + routage + merge). La complexité architecturale augmente — la base de code grandit, les tests sont plus difficiles, le déploiement est plus sensible.

Cas où multi-agent a du sens :
- **Pull de données parallèle nécessaire :** 5 API différentes à interroger, scatter-gather y gagne
- **Modèles spécialisés optimaux :** Petit modèle pour la planification de requêtes, grand pour la génération de code, pipeline topology réduit le coût
- **Tâches longue durée :** Agent_1 lance, agent_2 surveille async, agent_3 termine, orchestrateur notifie — architecture event-driven au lieu d'appel LLM synchrone

Sur des requêtes courtes, fréquentes, simples, un seul agent + cache est meilleur. Multi-agent crée de la valeur quand une tâche complexe peut être décomposée et optimisée.

---

L'orchestration multi-agent transforme l'LLM d'un appel de fonction sans état à un système stateful, observable et scalable. La topologie parallèle réduit la latence, la pipeline réduit le coût, l'orchestrateur assure la fiabilité. En production, commencez par scatter-gather, surveillez les rate limits et les coûts, passez à pipeline si nécessaire. Enregistrez les traces d'agent, stratifiez la gestion d'erreurs, testez la logique de routage. Multi-agent marque le passage de l'ingénierie LLM à l'infrastructure LLM.