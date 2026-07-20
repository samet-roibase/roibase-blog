---
title: "Multi-Agent Orchestration : Des Systèmes via un Appel LLM Unique"
description: "Des SDK d'agents aux topologies parallèles/série : comment construire des systèmes multi-agents production-grade via LangGraph, CrewAI, AutoGen ?"
publishedAt: 2026-07-20
modifiedAt: 2026-07-20
category: ai
i18nKey: ai-008-2026-07
tags: [multi-agent, orchestration-llm, langgraph, crewai, topologie-agent]
readingTime: 9
author: Roibase
---

En 2023, les LLM ont pu "appeler des outils". En 2024, le concept d'"agent" a émergé. En 2025, tout le monde construisait son propre agent. En 2026, la question a changé : un seul agent ne suffit pas, mais dois-je exécuter 5 agents en parallèle ou en série ? Lequel doit utiliser quel outil ? Où doit vivre la logique de coordination ? L'orchestration multi-agent est le premier problème d'ingénierie sérieuse dans la transition des applications LLM du "Hello World" à la production.

## Du Single Agent à la Topologie : Pourquoi l'Orchestration ?

Un agent unique — par exemple Claude Sonnet 3.5 + 5 outils — résout de nombreux scénarios d'utilisation. Mais tu frapperas un mur dans ces situations :

**Besoin de parallélisation :** Tu analysas une campagne marketing. En même temps, extrais les données de l'API Google Ads, calcule les tendances historiques dans BigQuery, récupère les données de conversion de Shopify. Un agent unique fait ces tâches séquentiellement — 12 secondes au total. 3 agents en parallèle terminent en 4,5 secondes. Si la latence est critique, l'orchestration est obligatoire.

**Besoin de spécialisation :** Un agent écrit SQL, un autre nettoie les données, un troisième génère du code de visualisation. Tu donnes à chaque agent un system prompt différent, un modèle différent (Sonnet pour SQL, Opus pour le code), un contexte de retrieval différent. Si tu dis au même agent "maîtrise SQL et la conception visuelle", la context window gonfle et les performances chutent.

**Couches de sécurité :** Un agent nettoie le prompt entrant, un autre exécute la logique métier, un troisième valide la sortie. Cette structure "chaîne d'assemblage" est critique en production : l'orchestration est obligatoire pour réduire le risque de passer des paramètres erronés dans les appels d'outils.

Dans les projets [Analyse des Données & Ingénierie des Insights](https://www.roibase.com.tr/fr/verianalizi) chez Roibase, nous avons réduit de 60 % les temps de requête BigQuery via une structure d'agent parallèle — car 3 sources de données différentes peuvent être interrogées simultanément.

## SDK d'Agents : LangGraph, CrewAI, AutoGen

**LangGraph (écosystème LangChain) :** Tu définis les agents comme des nœuds dans une structure de graphe orienté. Chaque nœud maintient un "state", les arêtes définissent la logique de transition. Le routage conditionnel est possible : si l'agent A dit "données manquantes", va à B, sinon va à C.

```python
from langgraph.graph import StateGraph

workflow = StateGraph(AgentState)
workflow.add_node("researcher", research_agent)
workflow.add_node("writer", writer_agent)
workflow.add_conditional_edges(
    "researcher",
    lambda state: "complete" if state.data_ready else "retry"
)
workflow.set_entry_point("researcher")
```

**Avantages :** Gestion d'état robuste. Tracing distribué facile — chaque nœud a ses propres logs. **Inconvénients :** Syntaxe complexe, les chaînes de callbacks compliquent le debugging.

**CrewAI :** Orchestration basée sur les rôles. Tu assigmes à chaque agent un "role" (researcher, analyst, writer) et une liste de "tasks". Le framework exécute automatiquement séquentiellement ou forke en parallèle.

```python
from crewai import Crew, Agent, Task

researcher = Agent(role='Data Researcher', tools=[bigquery_tool])
analyst = Agent(role='Analyst', tools=[pandas_tool])

crew = Crew(agents=[researcher, analyst], process="sequential")
result = crew.kickoff()
```

**Avantages :** Boilerplate minimal, prototypage rapide. **Inconvénients :** Flexibilité réduite — le routage personnalisé requiert des modifications de code.

**AutoGen (Microsoft) :** Multi-agent conversationnel. Les agents "parlent" les uns aux autres, un agent envoie un message à un autre, qui répond. Dans ce pattern, l'orchestration est implicite — le flux de messages détermine la topologie.

```python
from autogen import AssistantAgent, UserProxyAgent

assistant = AssistantAgent("assistant", llm_config={...})
user_proxy = UserProxyAgent("user", code_execution_config={...})

user_proxy.initiate_chat(assistant, message="Analyze Q1 data")
```

**Avantages :** Scénarios human-in-the-loop naturels. **Inconvénients :** Flux non-déterministes — quand l'agent A répondra-t-il à B reste incertain.

## Topologie Parallèle vs Série : Matrice de Tradeoff

| Architecture | Latence | Coût | Complexité | Utilisation |
|--------------|---------|------|------------|-------------|
| **Série (Sequential)** | Élevée (N×t) | Faible (1 LLM unique) | Basse | Pipelines déterministes (données → analyse → rapport) |
| **Parallèle (Fork-Join)** | Basse (max(t₁, t₂, t₃)) | Élevée (N agents simultané) | Moyenne | Tâches indépendantes (requête 3 API simultanément) |
| **Conditionnelle (DAG)** | Variable | Moyenne | Élevée | Flux dynamique (données manquantes → X, OK → Y) |
| **Conversationnelle** | Incertaine | Moyenne | Élevée | Human-in-the-loop ou négociation |

**Décision production :** Si le traitement n'est pas sur le chemin critique (ex: génération de rapport hors-ligne), choisis une topologie série — debug facile, coût faible. Si une SLA de latence existe (ex: tableau de bord temps réel), forke en parallèle — mais construis dès le départ une logique de retry, sinon 1 timeout d'agent fait attendre les 3 autres.

## Coordination des Tool Calls : Prévenir les Collisions

Dans un système multi-agent, le bug le plus courant : 2 agents appellent le même outil simultanément avec des paramètres différents, l'un corrompt l'état de l'autre.

**Exemple :** L'agent A crée `temp_table_x` dans BigQuery, l'agent B essaie simultanément de la lire — erreur "données non trouvées". Cette "race condition" se résout à la couche orchestration :

**1. Resource locking :** Quand l'agent A commence à utiliser un outil, l'orchestrator le verrouille pour les autres agents. Avec LangGraph, utilise `shared_state` :

```python
if not state.lock_acquired("bigquery"):
    return {"status": "waiting"}
state.acquire_lock("bigquery")
result = bigquery_tool.run()
state.release_lock("bigquery")
```

**2. Isolation d'espace de noms :** Donne à chaque agent un espace de travail séparé. L'agent A utilise `workspace_a/temp_table`, l'agent B `workspace_b/temp_table`. Avec CrewAI, cela se fait via un préfixe `agent_id`.

**3. Conception idempotente des outils :** Dès le départ, construis les outils pour être idempotents — appeler deux fois avec les mêmes paramètres ne crée pas de conflits. Utilise `upsert` ou `create_or_replace` au lieu de `create`.

## Observabilité : Comment Tracer un Agent ?

En production, 5 agents tournent, l'un échoue — lequel ? Des outils comme LangSmith, Helicone, Arize collectent des traces au niveau agent, mais l'instrumentation manuelle est obligatoire.

**Métriques critiques :**
- **Latence par agent :** Combien de temps chaque agent a-t-il pris ? Dans un fork parallèle, `max(latence)` révèle le goulot.
- **Taux de succès par tool :** Chaque agent a appelé quel outil combien de fois, combien de succès ? Moins de 95% est un signal d'alerte.
- **Compteur de retry :** Combien de fois un agent a-t-il retryé ? Un compteur élevé suggère soit un prompt erroné soit une spécification d'outil incorrecte.
- **Diagramme de transitions d'état :** Avec LangGraph, de quel nœud à quel nœud les passages ont eu lieu combien de fois ? Les boucles infinies apparaissent ici.

```python
# Intégration LangSmith
from langsmith import Client

client = Client()
with client.trace(run_name="multi_agent_pipeline") as run:
    for agent in agents:
        with run.create_child(name=agent.name):
            agent.run()
```

## Gestion de la Context Window : Mémoire Partagée vs Isolée

Dans un système multi-agent, la ressource la plus critique est la context window. 5 agents partagent-ils les mêmes 128K tokens, ou chacun a-t-il ses propres 128K ?

**Mémoire partagée (LangGraph par défaut) :** Tous les agents lisent et écrivent au même objet state. Avantage : les découvertes de l'agent A passent automatiquement à B. Inconvénient : pollution de contexte — les données dont C n'a pas besoin gonflent la window.

**Mémoire isolée + passage de messages :** Chaque agent maintient son propre state, ne partageant que les données nécessaires via messages. CrewAI utilise ce pattern. Avantage : efficacité des tokens élevée. Inconvénient : sérialisation manuelle de données requise.

**Hybride (recommandé) :** Garde dans l'état partagé uniquement les métadonnées (quel agent a agi, quand il a terminé), écris les données réelles sur disque/DB, passe aux agents des références. Par exemple, écris le résultat BigQuery sur GCS, donne aux agents le chemin `gs://bucket/result.parquet`.

## Gestion des Erreurs : Que Se Passe-t-il Quand un Agent Tombe ?

En topologie série, si l'agent 2 échoue, le pipeline s'arrête — simple. En parallèle, si l'agent B échoue mais A et C continuent, tu génères un rapport avec des données manquantes. Une logique de "partial success" est obligatoire à la couche orchestration.

**Stratégies :**

1. **Fail-fast (pour la série) :** La première erreur arrête tout le pipeline. À préférer si la latence n'est pas critique.
2. **Best-effort (pour le parallèle) :** Exécute autant d'agents que possible, génère une sortie même avec données manquantes — mais marque "incomplete" dans les métadonnées.
3. **Retry avec fallback :** L'agent A a essayé 3 fois sans succès, consulte agent A_backup (modèle différent ou prompt différent).

```python
# Retry avec LangGraph
workflow.add_node("agent_a", agent_a, retry_policy={"max_attempts": 3})
workflow.add_edge("agent_a", "agent_a_backup", condition="failed")
```

## Checklist Production : Avant de Déployer un Système Multi-Agent

- **Calcule le budget tokens :** 5 agents × 10K tokens entrée × 2K tokens sortie × prix API = coût par exécution. 1000 exécutions/jour = combien en fin de mois ?
- **Définis une SLA de latence :** Combien de temps chaque agent peut-il prendre ? Si la latence P95 dépasse 10 secondes, tu as besoin d'une topologie parallèle.
- **Planifie un rollback :** Changer le prompt d'un agent peut casser tout le pipeline. Contrôle de version + déploiement canary obligatoire.
- **Point human-in-the-loop :** Pour les décisions critiques (ex: ajustement budgétaire), montre la sortie du dernier agent à un humain et obtiens son approbation.
- **Audit log :** Chaque étape de chaque agent — quel outil appelé, quels paramètres, qu'a-t-il retourné — doit être écrit en JSON dans S3. Nécessaire pour la conformité.

L'orchestration multi-agent est le "cours de systèmes" de l'ingénierie LLM. Ce qui commence par un seul appel de modèle en production requiert topologie, gestion d'état, logique de retry, observabilité. LangGraph, CrewAI, AutoGen sont des squelettes — le vrai travail consiste à décider comment arranger et paralléliser tes agents selon ton cas d'usage. Prends maintenant ton prototype, mesure la latence, simule les coûts, choisis ensuite ta topologie. Ne déploie pas sans tester — dans les systèmes multi-agent, il y a 10 couches entre "ça marche" et "c'est prêt pour la production".