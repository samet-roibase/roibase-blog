---
title: "Versionnage des prompts et tests A/B : la discipline des opérations LLM"
description: "Avec Promptfoo, LangSmith et des pipelines d'évaluation, mesurez les changements de prompt. Comment mettre en place le versionnage et les tests A/B en production LLM."
publishedAt: 2026-06-22
modifiedAt: 2026-06-22
category: ai
i18nKey: ai-004-2026-06
tags: [prompt-engineering, llm-ops, évaluation, tests-ab, promptfoo]
readingTime: 8
author: Roibase
---

Faire fonctionner un LLM en production n'est plus une simple succession d'appels API. Quand vous modifiez un prompt, la qualité de la sortie peut chuter de 15 % ou augmenter de 22 % — mais si vous ne le détectez pas, le déploiement devient aléatoire. Le versionnage des prompts et les tests A/B transportent la discipline du déploiement logiciel classique vers les opérations LLM. Cet article explique comment rendre les changements de prompts mesurables en utilisant des frameworks d'évaluation comme Promptfoo et LangSmith.

## Un changement de prompt n'est pas un déploiement

Dans l'ingénierie logicielle classique, quand une fonction change, les tests unitaires, tests d'intégration et déploiements canary s'activent. En opérations LLM, la plupart des équipes modifient le prompt dans un fichier texte brut, font quelques tests manuels et le mettent en production. Résultat : le sentiment des utilisateurs baisse de 8 % mais personne ne fait la connexion.

Le problème : la sortie LLM n'est pas déterministe. Vous obtenez des réponses différentes au même prompt, ce qui rend les tests sur un seul exemple dénués de sens. Sans système de versionnage, vous ne pouvez pas répondre à la question « l'ancien prompt était-il meilleur ou le nouveau ? ». Un commit Git ne suffit pas — vous ne pouvez pas extraire les différences sémantiques du message de commit.

La solution : enregistrez chaque modification de prompt comme une version, exécutez la suite d'évaluation avant et après la modification, comparez les métriques. Cette discipline offre deux choses : la détection de régression (est-ce que le nouveau prompt casse les tâches anciennes ?) et la mesure d'amélioration (est-ce que la métrique que vous visiez augmente vraiment ?).

## Comment configurer un pipeline d'évaluation

Un pipeline d'évaluation se compose de trois composants : le set d'évaluation, la métrique d'évaluation et le runner. Le set d'évaluation est une liste d'entrées à envoyer au LLM et les sorties attendues (ou propriétés de sortie). Il ressemble à ceci au format JSON :

```json
[
  {
    "input": "Résume la tendance des revenus du Q1 2025",
    "expected_topics": ["revenue", "croissance", "trimestre"],
    "expected_sentiment": "neutre"
  },
  {
    "input": "Explique pourquoi le taux de désabonnement augmente",
    "expected_topics": ["churn", "retention"],
    "expected_sentiment": "analytique"
  }
]
```

Vous pouvez créer le set d'évaluation manuellement (en échantillonnant les logs de production) ou le générer synthétiquement (en demandant à un autre LLM : « génère 50 variantes de requête pour ce prompt »). L'important est que le set couvre les cas limites — entrées longues, requêtes ambiguës, langues multiples.

Une métrique d'évaluation définit comment noter la sortie du LLM. Deux types sont courants : basé sur des règles (vérifier la présence de mots-clés spécifiques dans la sortie) et LLM-as-judge (demander à un autre LLM : « cette sortie répond-elle correctement à la question, notez 1-5 »). LLM-as-judge est plus flexible mais plus coûteux et plus lent. Pour équilibrer vitesse et précision, préférez une combinaison basée sur des règles + un classifier léger (comme un modèle BERT de sentiment).

Le runner prend le set d'évaluation, exécute l'ancien et le nouveau prompt pour chaque entrée, compare les sorties avec la métrique et génère un tableau diff. Promptfoo fait cela via `promptfoo eval` en ligne de commande :

```bash
promptfoo eval \
  --prompts prompts/v1.txt prompts/v2.txt \
  --providers openai:gpt-4 \
  --tests evals/summarization.json \
  --output results.json
```

Dans la sortie, vous voyez quel prompt performe mieux pour chaque cas de test. Si le nouveau prompt améliore le score métrique dans 80 % du set d'évaluation, il est prêt pour le déploiement. Sinon, il y a une régression et vous devez revoir le prompt.

## Tests A/B : exécuter deux prompts en parallèle en production

Le pipeline d'évaluation produit des résultats hors ligne — il n'y a pas de données utilisateur réels. Pour mesurer quel prompt fonctionne mieux en production en exécutant les deux en même temps, vous avez besoin de tests A/B. Cela nécessite une infrastructure de division de trafic et de collection de métriques.

La division de trafic est simple : vous hashez le `user_id` ou `session_id` d'une requête entrante, prenez le modulo et routez vers le prompt A ou B selon le résultat. Par exemple, si `hash(user_id) % 100 < 50`, alors prompt A, sinon B. Cela crée un split 50-50. Point important : le même utilisateur doit voir le même prompt à chaque requête (sticky assignment) — sinon l'expérience utilisateur devient incohérente.

Pour la collection de métriques, la réponse LLM inclut des métadonnées : `prompt_version`, `latency`, `token_count`. Ces données s'écoulent ensuite dans un data warehouse (BigQuery, Snowflake). Le pipeline [Veri Analizi & İçgörü Mühendisliği](https://www.roibase.com.tr/fr/verianalizi) de Roibase entre en jeu — combinez les logs LLM avec d'autres données événementielles (action utilisateur, conversion, churn) pour mesurer l'impact aval du prompt.

Quelles métriques suivez-vous dans un test A/B ? Trois catégories :

| Type de métrique | Exemple | Cible |
|---|---|---|
| Qualité | Score LLM-as-judge, taux d'hallucination | Haut |
| Coût | Nombre de tokens, coût API | Bas |
| Aval | Taux de conversion, engagement utilisateur | Haut |

Par exemple, le prompt B améliore le score LLM-as-judge de 12 % par rapport au prompt A mais augmente le nombre de tokens de 35 %. Il y a un tradeoff. Si la conversion aval ne change pas, le prompt A est plus efficace.

## LangSmith et observabilité

LangSmith est une plateforme d'observabilité LLM développée par l'équipe LangChain. Au-delà de l'évaluation, elle capture les traces en production, visualise les chaînes de prompts et montre où la latence augmente. C'est particulièrement critique pour les workflows LLM multi-étapes (RAG + summarization + JSON parsing, par exemple).

Pour envoyer des traces à LangSmith, vous utilisez le SDK :

```python
from langsmith import Client
client = Client(api_key="...")

with client.trace(name="summarize_revenue"):
    result = llm.invoke(prompt)
    client.log_metric("token_count", result.usage.total_tokens)
```

Chaque trace apparaît dans l'interface LangSmith avec l'entrée/sortie/métadonnées complètement loguées. S'il y a plusieurs versions de prompts, vous pouvez ouvrir une vue de comparaison. Dans l'interface, vous voyez des insights comme « le prompt v2 produit une sortie 8 % plus longue en moyenne que v1 mais la latence est 3 % plus basse ».

LangSmith offre également un playground — modifiez le prompt et testez-le instantanément contre plusieurs entrées. Cela crée une boucle de feedback rapide à la fois pour le prototypage et les tests de régression. Mais attention : tester dans le playground ne remplace pas les tests A/B en production, c'est juste un premier filtre.

## L'effet secondaire du versionnage de prompts : le rollback

Pouvoir faire un rollback en cas d'erreur de déploiement est critique. En opérations LLM, un rollback signifie revenir à une version antérieure du prompt. Mais pour cela, il faut établir un historique de versioning des prompts.

L'approche simple : conserver chaque prompt dans un fichier distinct dans Git (`prompts/summarization_v3.txt`). Un script de déploiement enregistre la version en production dans un fichier de config :

```yaml
# config/production.yaml
prompts:
  summarization: v3
  classification: v2
```

Pour faire un rollback, écrivez `summarization: v2` et déclenchez le déploiement. Mais c'est un processus manuel et lent en cas d'incident. Une approche plus avancée : utiliser un système de feature flags (LaunchDarkly, Unleash). Avec un flag, vous changez la version du prompt au runtime sans redéployer le code.

Les pratiques de [First-Party Data & Architecture de Mesure](https://www.roibase.com.tr/fr/firstparty) de Roibase jouent un rôle ici — vous devez relier les changements de prompt aux événements aval (conversion, churn) pour mettre la décision de rollback sur une base quantitative. Si le taux de churn augmente de 4 % six heures après un déploiement de prompt, c'est un signal de rollback.

## Cas limites : versionnage de prompts multilingues

Si votre application LLM fonctionne dans plusieurs langues (TR, EN, DE par exemple), vous devez maintenir une version de prompt séparée pour chaque langue. Car un prompt qui fonctionne bien en anglais pourrait ne pas produire le même ton en turc.

Solution : organisez les fichiers de prompts par code de langue :

```
prompts/
  summarization/
    en_v3.txt
    tr_v3.txt
    de_v3.txt
```

Le set d'évaluation doit aussi être spécifique à la langue — dans les cas de test en turc, attendez une sortie en turc. Exécutez les tests A/B séparément par langue, car le comportement des utilisateurs turcs diffère de celui des utilisateurs anglais. N'oubliez pas d'ajouter le segment linguistique dans l'agrégation des métriques.

Un autre point d'attention : dans un prompt multilingue, la longueur du contexte varie selon la langue — une phrase en turc est en moyenne 12 % plus longue (en termes de tokens). Cela signifie un risque de dépassement de limite de tokens. Ajoutez une vérification de nombre de tokens à votre pipeline d'évaluation, et déclenchez une alerte en cas de dépassement de seuil.

## Étape pratique : configurez votre premier set d'évaluation

Pour mettre en place le système décrit dans cet article, la première étape est : créez un set d'évaluation minimal de 20-30 requêtes d'utilisateurs réels. Ouvrez vos logs de production, sélectionnez les requêtes les plus fréquentes, et pour chacune définissez les propriétés de sortie attendues (exactitude, ton, longueur, etc.).

Ensuite, configurez Promptfoo ou LangSmith, exécutez votre prompt existant contre ce set, et enregistrez le score de base. Apportez maintenant une petite modification au prompt (par exemple, « donnez une réponse brève et nette »), relancez l'évaluation et comparez les scores. S'il n'y a pas plus de 5 % de régression, déployez le changement.

Quand cette boucle devient automatisée, votre vitesse d'itération sur les prompts triple. Car vous ne devinez plus « ce changement est-il bon ou mauvais ? » — vous répondez avec des chiffres.