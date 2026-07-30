---
title: "Versionnage des prompts et tests A/B : la discipline des opérations LLM"
description: "Comment tester systématiquement les sorties LLM avec Promptfoo et LangSmith ? Pratiques de construction de pipelines d'évaluation pour les applications IA en production."
publishedAt: 2026-07-30
modifiedAt: 2026-07-30
category: ai
i18nKey: ai-004-2026-07
tags: [llm-ops, prompt-engineering, evaluation, ab-testing, mlops]
readingTime: 8
author: Roibase
---

À partir du moment où vous déployez un LLM en production, vous découvrez le besoin de la discipline des « test suites » du génie logiciel classique. Lorsque vous modifiez un prompt, comment évolue la cohérence de la sortie ? Lorsque vous mettez à niveau la version du modèle, comment change l'équilibre coût-qualité ? Comment transformer la sensation « Claude a donné une meilleure réponse » en une métrique numérique ? En 2026, dans les opérations LLM matures, ceux qui répondent à ces questions de façon systématique — non manuelle — gagnent. Des outils comme Promptfoo, LangSmith et les pipelines d'évaluation sont l'assurance que les LLM restent en production.

## Modification de prompt = Modification de code

Vous avez un workflow de production de contenu marketing. Vous envoyez un prompt à l'API Claude, vous recevez un brouillon de blog. Dans la première version, vous dites « écris », dans la deuxième, vous ajoutez au system prompt « écris pour Roibase, dans un ton d'ingénierie », dans la troisième, vous ajoutez une liste de « MOTS INTERDITS ». Chaque modification affecte la sortie — mais comment mesurez-vous l'impact ?

En logiciel classique, il y a les tests unitaires — l'entrée est fixe, la sortie est déterministe. Avec les LLM, l'entrée est fixe mais la sortie est stochastique. Vous ne pouvez pas décider sur la base d'une seule exécution. Vous devez exécuter le même prompt 10 fois avec différentes seeds, regarder le compte de tokens moyen, la latence, le score de cohérence. C'est pourquoi le **versionnage des prompts** est aussi critique que le versionnage du code. Vous suivez les modifications de prompt avec un commit Git, mais vous n'êtes peut-être pas en train de suivre la sortie. C'est là qu'une suite d'évaluation intervient : elle exécute automatiquement des tests à chaque commit, vous voyez les régressions de métriques.

Scénario concret : dans votre workflow n8n, vous faites générer du contenu par Claude. Quand vous remplacez « 1500 mots » par « 1400-1600 mots » dans le prompt, la longueur moyenne baisse de 1520 à 1480 mots, le coût en tokens baisse de 3 %, mais le score de lisibilité recule de 0,2 points. Pour voir ce compromis sans essais manuels, un pipeline d'évaluation automatisé est obligatoire.

## Promptfoo : Suite de régression pour les prompts

Promptfoo est un outil open source en CLI — vous définissez les prompts dans une configuration YAML, vous fournissez les cas de test en CSV ou JSON, vous écrivez des assertions. La commande `promptfoo eval` exécute toutes les variantes et vous affiche un tableau de réussite/échec.

Un typique `promptfoo.yaml` ressemble à ceci :

```yaml
prompts:
  - id: baseline
    text: "Write a blog post about {{topic}}"
  - id: roibase-tone
    text: "Write a blog post about {{topic}}. Use engineering discipline tone. No hype words."

providers:
  - anthropic:messages:claude-3-5-sonnet-20241022

tests:
  - vars:
      topic: "server-side GTM setup"
    assert:
      - type: contains
        value: "first-party"
      - type: javascript
        value: output.length > 1400 && output.length < 1600
      - type: cost
        threshold: 0.05
```

Quand vous exécutez cette configuration, Promptfoo envoie les deux prompts à Claude, regarde les assertions : le mot « first-party » est-il présent, la sortie est-elle entre 1400 et 1600 mots, le coût API est-il inférieur à 0,05 dollar ? Si une assertion échoue, Promptfoo vous dit quel prompt a échoué. Si vous l'intégrez à la CI/CD, la modification du prompt est testée automatiquement dans la pull request — comme un test unitaire classique.

### Pourquoi l'automatisation plutôt que le manuel ?

Test manuel : vous envoyez 5 sujets différents à Claude, vous parcourez les sorties en les regardant, vous dites « c'est bon ». Le jour suivant, vous modifiez le prompt et testez à nouveau manuellement. À la 10e itération, vous oubliez quelle modification a affecté quelle métrique.

Automatisation : vous avez 50 cas de test (des mots-clés réels que vous avez extrait de GSC), ils s'exécutent automatiquement à chaque modification de prompt. Tableau de régression : « prompt de base : 1520 mots en moyenne, nouveau prompt : 1480 — baisse de 2,6 % ». La décision est prise sur la base de la métrique, pas sur la sensation.

## LangSmith : Observabilité en production

Promptfoo est un outil de test en temps de développement. LangSmith (produit de l'équipe LangChain) vous permet de surveiller ce qui se passe en production. Chaque appel LLM est enregistré dans LangSmith : entrée, sortie, latence, compte de tokens, métadonnées. Vous visualisez les traces sur le dashboard — récupération, construction du prompt, appel LLM, post-traitement dans la chaîne, vous tracez chaque étape.

Exemple : chez Roibase, dans nos travaux sur [Optimization Moteur Génératif](https://www.roibase.com.tr/fr/geo), nous construisons un pipeline LLM pour suivre les citations ChatGPT. Pipeline : question de l'utilisateur → embedding → récupération Pinecone → injection de contexte → Claude → extraction de citation. LangSmith enregistre chaque étape. Si le taux de citation tombe en dessous de 15 %, une alerte se déclenche — une dérive du prompt ou un problème de qualité de récupération est détecté instantanément.

### Trace vs log

Log classique : « j'ai envoyé ce prompt à l'API Claude, j'ai reçu cette réponse ». Trace : « la récupération a pris 120 ms, 5 documents ont été retournés, la construction du prompt a pris 15 ms, Claude a pris 2,3 secondes, latence totale 2,45 secondes — pas de violation SLA ». La trace vous permet de voir le pipeline end-to-end. Dans les chaînes LLM, trouver le goulot d'étranglement est critique : si la récupération est lente, optimisez l'index de la base de données, si le LLM est lent, changez la version du modèle ou réduisez le nombre de tokens du prompt.

En production, lors d'un test A/B, vous utilisez aussi LangSmith : 50 % du trafic reçoit le prompt de base, 50 % le nouveau prompt — groupes de traces séparés pour chaque variante, comparaison de métriques en temps réel. Latence moyenne du baseline 2,1 secondes, nouveau prompt 1,9 secondes, mais le score de qualité baisse de 0,85 à 0,80 — un tableau de compromis en direct.

## Pipeline d'évaluation : Score de qualité automatisé

La sortie LLM est subjective — comment automatisez-vous la question « c'est bon ou c'est mauvais » ? Deux approches : assertions basées sur les règles et LLM-as-a-judge.

**Basé sur les règles :** Les assertions dans Promptfoo comme `contains`, `length`, `regex-match`. Des règles comme « 1400-1600 mots », « pas de point d'exclamation », « au moins 1 lien interne ». Rapide, déterministe mais ne mesure pas la qualité sémantique.

**LLM-as-a-judge :** Vous faites évaluer la sortie par un autre LLM (généralement GPT-4 ou Claude). Exemple : « Ce post de blog est-il rédigé dans un ton d'ingénierie ? Donne une note de 1 à 10. » Si le modèle judge donne 7,5, c'est OK, s'il donne 6, c'est un échec. Cette approche capture la qualité sémantique mais est non-déterministe — le modèle judge lui-même est stochastique. Solution : exécuter chaque évaluation 3 fois et prendre la moyenne.

Dans le workflow de production de contenu de Roibase, le pipeline d'évaluation fonctionne ainsi :

1. Claude génère un brouillon de blog
2. Nous envoyons le brouillon à Promptfoo
3. Basé sur les règles : compte de mots, nombre de liens internes, contrôle des mots interdits
4. LLM-as-a-judge : GPT-4 nous attribue une note de 1 à 10 pour « conformité au ton »
5. Toutes les métriques sont enregistrées dans Notion
6. Si la note moyenne baisse en dessous de 8, une alerte Slack se déclenche

Grâce à ce pipeline, quand vous générez 1000 articles, le standard de qualité est conservé. Au lieu que l'équipe QA manuelle lise chaque article, elle regarde seulement les échecs d'évaluation — 90 % d'économie de temps.

## Test A/B : Deux prompts, deux équilibres coût-qualité

En production, un test A/B de prompt fonctionne comme un feature flagging classique. Vous utilisez LaunchDarkly ou un service de flag personnalisé : 50 % des utilisateurs reçoivent prompt_v1, 50 % prompt_v2. Vous collectez les métriques pour chaque variante : compte de tokens moyen, latence, conversion aval (par exemple, l'éditeur approuve-t-il le brouillon ?).

Exemple concret : chez Roibase, nous testons une nouvelle version du prompt avec une guidance spécifique à la catégorie. Le prompt de base est général, le nouveau prompt contient des instructions supplémentaires par catégorie. Le test A/B dure 2 semaines :

| Métrique | Baseline | Nouveau prompt | Delta |
|---|---|---|---|
| Tokens moyens (input+output) | 3200 | 3450 | +7,8 % |
| Latence moyenne (sec) | 2,1 | 2,3 | +9,5 % |
| Coût/article ($) | 0,042 | 0,046 | +9,5 % |
| Taux d'approbation éditeur | 72 % | 81 % | +12,5 % |
| Exactitude lien interne | 65 % | 89 % | +36,9 % |

Le nouveau prompt est 10 % plus cher, mais le taux d'approbation des éditeurs augmente de 12,5 % — le coût de révision éditoriale baisse. L'exactitude du lien interne augmente de 36,9 % — les gains SEO compensent le coût. Décision : le nouveau prompt gagne, passage en production.

Pendant la durée du test A/B, LangSmith crée un groupe de traces séparé pour chaque variante. Si vous voyez une anomalie (par exemple, 5 % d'erreurs HTTP 429 de limitation de débit avec le nouveau prompt), vous la détectez immédiatement.

## Versionnage : Git + Métadonnées

Vous gardez la version du prompt dans Git comme du code, mais ses métadonnées sont séparées. Dossier `prompts/` :

```
prompts/
  roibase-blog-v1.md
  roibase-blog-v2.md
  roibase-blog-v3.md
```

Chaque fichier contient des métadonnées en frontmatter :

```markdown
---
version: 3
model: claude-3-5-sonnet-20241022
temperature: 0.7
max_tokens: 8000
created: 2026-07-15
deprecated: false
test_suite: promptfoo-blog-eval.yaml
---

# RÔLE
Tu écris pour Roibase.
...
```

Le message de commit Git : « prompt v3 : ajout de guidance spécifique à la catégorie, liste de mots interdits étendue ». Votre CI/CD voit ce commit et exécute automatiquement la suite de tests Promptfoo. Si les tests réussissent, le déploiement en environnement de staging se fait, un test A/B de 24 heures s'exécute, s'il réussit, le passage en production se fait.

Le versionnage permet une mise à jour rapide : si un problème survient en production, `git revert`, l'ancien prompt est actif en 5 minutes.

## Optimisation des coûts : Audit des tokens

Dans les applications LLM, le coût est généralement déterminé par input tokens + output tokens. Le prix API de Claude Sonnet 3.5 : 3 $/1M tokens d'entrée, 15 $/1M tokens de sortie (prix 2026). Un brouillon de blog de 1500 mots ~ 2000 tokens de sortie, system prompt + user prompt ~ 1200 tokens d'entrée — ~0,042 $ par article.

Si vous générez 1000 articles/mois, c'est 42 $. Si vous optimisez le prompt et réduisez les tokens de sortie de 10 %, vous économisez 6,30 $ par mois — 75,60 $/an. Cela semble petit, mais à l'échelle : 10 000 articles/mois, c'est 756 $/an.

Vous ajoutez une assertion de coût à la suite d'évaluation Promptfoo :

```yaml
assert:
  - type: cost
    threshold: 0.045
```

Si après une modification de prompt le coût dépasse 0,045 $, le test échoue. Vous ajustez ce seuil en le liant à des métriques métier (taux d'approbation éditeur, conversion).

Pour un audit des tokens, vous regardez les traces LangSmith : quel composant du prompt consomme le plus de tokens ? Par exemple, la section « INTERDITS » du system prompt — 300 tokens. Est-elle vraiment nécessaire à chaque appel, ou pouvez-vous la faire injecter par contexte en fonction de l'utilisateur ? Dans nos travaux sur [Architecture des données et mesure first-party](https://www.roibase.com.tr/fr/firstparty), nous utilisons une stratégie d'injection de contexte : vous modularisez le prompt, vous n'ajoutez que les modules nécessaires selon le segment utilisateur — économie de 15 à 20 % de tokens.

## Maintenant, que faire

Si vous utilisez des LLM en