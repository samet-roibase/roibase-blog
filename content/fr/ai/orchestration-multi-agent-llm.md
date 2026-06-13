---
title: "Orchestration Multi-Agent : Des Systèmes Depuis un Seul Appel LLM"
description: "SDK Agent, utilisation d'outils et topologies parallèles/sérielles pour déployer les applications LLM en production. Compromis entre coût token, latence et isolation des erreurs."
publishedAt: 2026-06-13
modifiedAt: 2026-06-13
category: ai
i18nKey: ai-008-2026-06
tags: [multi-agent, orchestration-llm, utilisation-outils, sdk-agent, ia-production]
readingTime: 8
author: Roibase
---

Un seul prompt LLM suffisait il y a quelques mois. Aujourd'hui, les systèmes en production exigent des topologies d'agents parallèles, des sorties structurées et des chaînes de secours. Le Computer Use d'Anthropic, le function calling d'OpenAI et le support des state machines de LangGraph ont porté l'orchestration d'agents au niveau du framework. L'architecture multi-agent n'est plus seulement de la recherche, c'est l'outillage quotidien des équipes de croissance. Réduire le coût token, contrôler la latence et isoler les défaillances rendent le passage d'un appel mono-agent à un système orchestré incontournable.

## SDK Agent et Protocole Tool Use

Le schéma JSON de function calling d'OpenAI est devenu standard en 2023. Anthropic a étendu tool use avec Claude 3.5 : la réponse API retourne maintenant un bloc `tool_use`, tu exécutes et renvoies le résultat sous forme de `tool_result`. Cette boucle peut s'étendre sur 20+ itérations, mais la limite de tokens t'arrête. La syntaxe function declarations de Gemini est similaire, la différence résidant dans le grounding et les extensions de retrieval. Les trois fournisseurs partagent le même pattern : le modèle reçoit un descripteur de fonction, retourne le nom de la fonction + arguments, l'exécution est de ton côté.

Les SDK Agent abstraient cette boucle. L'`AgentExecutor` de LangChain, l'`ReActAgent` de LlamaIndex, le moteur central d'AutoGPT — tous résolvent le même problème : gérer la séquence d'appels d'outils. Mais les abstractions créent une surcharge token. Par exemple, LangChain envoie l'historique de conversation en préfixe à chaque itération. 10 appels d'outils = 10× context window. Pour réduire cela, il faut un agent de summarisation ou une pruning contextuelle sélective. En production, sans une couche d'observabilité comme LangSmith, le débogage est impossible.

Le protocole tool use n'est pas déterministe — le modèle hallucine parfois, donne des arguments de fonction incorrects. C'est pourquoi une couche de validation est obligatoire : valide l'entrée avec un schéma Pydantic, capture les exceptions à l'exécution, retourne un message d'erreur au modèle. Chez LangChain, `PydanticOutputParser`, chez Anthropic, le paramètre `tool_choice="required"` réduit ce risque. Mais le vrai problème : le modèle ne sélectionne pas toujours le bon outil. Avec 3-4 outils similaires, les sélections erronées surviennent à 8-12%. Dans ce cas, tu ajoutes une logique de retry ou un agent de routage.

## Topologie Agent Parallèle vs Sérielle

Pourquoi deux agents feraient ce qu'un seul ne peut pas ? Parce que la **spécialisation** améliore l'efficacité token. Scénario exemple : courrier entrant → catégoriser → rédiger réponse → obtenir approbation. Un prompt monolithique utilise 8K tokens de contexte, répète la même instruction pour chaque e-mail. Divise cela en 3 agents : **classifier** (catégoriser), **drafter** (rédiger réponse), **validator** (logique d'approbation). Chacun a son petit prompt. Total tokens : 8K → 2K+2K+1.5K = 5.5K. Baisse de 31%.

La topologie parallèle offre un autre avantage : **réduction de latence**. Exemple : pipeline de génération de contenu — un agent analyse les mots-clés SEO, un autre parse le guide de ton et style, un troisième scrape le contenu concurrent. En sériel, tu as 3× la latence. En parallèle (avec le `StateGraph` de LangGraph + nœud `map`), la latence max = celle de l'agent le plus lent. Mais la coordination devient plus difficile. La sortie de quel agent a la priorité ? S'il y a un conflit, qui décide ? C'est pourquoi un **agent arbitre** est nécessaire — couche méta qui reçoit les résultats parallèles et prend la décision finale.

La topologie sérielle offre l'isolation des erreurs. Si l'agent A échoue, B et C ne s'exécutent pas. Tu peux construire une chaîne de secours : si A échoue, bascule à A2. En parallèle, il y a un scénario de défaillance partielle : 2 agents sur 3 réussissent, un timeout. Comment le système continue-t-il ? Là, il faut une logique state machine. Chez LangGraph, tu routes avec `conditional_edges` : si l'agent réussit, "next" (suivant), sinon "retry" (réessayer) ou "fallback" (secours).

### Guide de Choix de Topologie

| Scénario | Topologie | Raison |
|----------|-----------|--------|
| Dépendance séquentielle (sortie de A = entrée de B) | Sérielle | Surcharge de coordination en parallèle |
| Sous-tâches indépendantes | Parallèle | Réduction de latence |
| Risque d'échec élevé | Sérielle + secours | Isolation des défaillances |
| Coût token critique | Hybride (fetch parallèle, process sériel) | Collecte de données sans partage de contexte |

## Gestion d'État et Pruning Contextuel

Le problème le plus critique d'un système multi-agent : **bloat d'état**. Chaque agent conserve l'historique de conversation, le context window grandit à chaque itération. 10 agents × 5 itérations = 50 messages. Même le context window 200K de Claude peut être saturé. Résultat : latence augmente (le coût de calcul token est O(n²)), coût augmente, certains modèles timeout.

Solution : **orchestration avec état** et **mémoire sélective**. La fonctionnalité `checkpointing` de LangGraph écrit l'état dans un store externe (Redis, PostgreSQL). Chaque agent lit uniquement son contexte pertinent. Exemple : l'agent drafter voit la sortie du classifier, mais pas l'historique d'approbation du validator — sauf s'il en a besoin.

Un autre pattern : **agent de summarisation**. Il intervient tous les N itérations, réduit la conversation à 3-4 phrases. La `ConversationSummaryMemory` de LangChain fait ce travail mais attention : la summarisation elle-même exige un appel LLM, coût supplémentaire. C'est pourquoi le seuil de déclenchement doit être bien calibré. Dans notre pipeline production, on lance une summarisation tous les 12 itérations — au lieu de 200 tokens de contexte, on en garde 50, économie de 75%.

Le pruning contextuel est une autre option : supprime les messages non pertinents. Exemple : la sortie du classifier est juste le label de catégorie, mais le modèle retourne aussi la chaîne de raisonnement entière. Avant d'envoyer au drafter, tu supprimes le raisonnement, ne gardes que le label. Chez LangChain, `MessagesPlaceholder` + fonction filter personnalisée le fait. C'est du travail manuel, mais ça réduit les tokens de 40-50%.

## Fiabilité et Observabilité en Production

Un système multi-agent = N× la surface de défaillance. Un agent timeout, un autre reçoit un rate limit, un troisième hallucine. Pour gérer ce chaos, **circuit breaker** et **logique de retry** sont obligatoires. LangChain a un wrapper `RunnableRetry`, mais si tu veux un contrôle granulaire, la bibliothèque Tenacity est plus flexible : backoff exponentiel, jitter, max attempts.

Sans observabilité, tu ne peux pas déboguer. Des outils comme LangSmith, LangGraph Studio, Weights & Biases visualisent la trace de l'agent : quel agent a été appelé quand, ce qu'il a retourné, combien de tokens il a coûté. Dans notre stack, on utilise LangSmith + un exportateur Prometheus personnalisé : on affiche les métriques latence agent, décompte token, taux d'erreur sur Grafana. Seuil d'alerte : latence P95 >3s ou taux d'erreur >5%.

Un autre problème production : **non-déterminisme**. Même entrée, sortie différente — parce que le modèle est stochastique. Même avec temperature=0, l'infrastructure du fournisseur introduit de la variation. C'est pourquoi une [architecture de données first-party](https://www.roibase.com.tr/fr/firstparty) fiable est obligatoire : si l'entrée est structurée, la sortie est plus cohérente. De plus, un framework d'eval est requis : lance des tests de régression à chaque déploiement, mesure la qualité de sortie. Tu peux utiliser l'`EvaluatorChain` de LangChain ou l'eval basée sur modèle d'Anthropic.

## Optimisation des Coûts et Compromis

Un système multi-agent est cher. Un appel agent unique = 2K tokens = $0.006 (prix Claude Sonnet 3.5). La même tâche avec 3 agents : 3× appel API, 6K tokens total, $0.018. 3× le coût. Les scénarios qui justifient cela : réduire le contexte long (grand doc → chunk → process parallèle), spécialisation (chaque agent utilise un petit modèle, total moins cher), isolation des erreurs (risque de défaillance monolithe élevé).

Façons de réduire le coût token : **distillation de modèle** (grand modèle fine-tune petit modèle, petit modèle en production), **caching** (même contexte retour = réponse en cache — le prompt caching d'Anthropic offre 90% de réduction), **traitement par batch** (au lieu de real-time, execution async, préfère modèle bon marché).

Compromis latence vs coût : topologie parallèle réduit latence mais augmente coût. Tu peux paralléliser le critical path et sérialiser le non-critique. Exemple : user query → classifier en parallèle (réponse rapide), mais agent reporting en sériel (background job). Cette approche hybride maintient latence P95 <2s tout en réduisant le coût de 35%.

## Exemples d'Orchestration et Code

Chaîne sérielle simple (LangChain) :

```python
from langchain.chains import LLMChain
from langchain.prompts import PromptTemplate
from langchain_anthropic import ChatAnthropic

classifier = LLMChain(
    llm=ChatAnthropic(model="claude-3-5-sonnet"),
    prompt=PromptTemplate.from_template("Catégorise : {text}")
)

drafter = LLMChain(
    llm=ChatAnthropic(model="claude-3-5-sonnet"),
    prompt=PromptTemplate.from_template("Rédige une réponse : {category}, {text}")
)

category = classifier.run(text=user_input)
response = drafter.run(category=category, text=user_input)
```

Exécution parallèle (LangGraph) :

```python
from langgraph.graph import StateGraph

def parallel_tasks(state):
    seo_result = seo_agent.invoke(state["content"])
    tone_result = tone_agent.invoke(state["style_guide"])
    return {"seo": seo_result, "tone": tone_result}

workflow = StateGraph()
workflow.add_node("parallel", parallel_tasks)
workflow.add_node("merge", merge_agent)
workflow.set_entry_point("parallel")
workflow.add_edge("parallel", "merge")
app = workflow.compile()
```

Ce code exécute 2 agents en parallèle, puis passe le résultat à un agent merge. LangGraph gère automatiquement l'état, écrit les checkpoints sur Redis.

L'orchestration multi-agent n'est pas un but en soi, c'est un outil. Si tu automatises un autre canal de croissance ou construis un pipeline de décision, choisis une topologie agent, mais clarifie les métriques : token/tâche, latence, taux d'erreur. En production, le succès c'est que le système fonctionne avec 95% d'uptime et que le coût token reste dans le budget. Si tu construis un système multi-agent pour la génération de contenu, intègre-le à une stratégie d'[Optimisation Moteur Générative](https://www.roibase.com.tr/fr/geo) — les agents collectent des données de citation, alimentent les métriques GEO, le ROI devient mesurable. Sinon, c'est juste un wrapper API compliqué.