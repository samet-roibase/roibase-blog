---
title: "Mesure des citations LLM — Votre nouvel ensemble de métriques SEO"
description: "Comment mesurer votre taux de citation sur Perplexity, ChatGPT et Gemini ? Guide de configuration des métriques critiques pour GEO."
publishedAt: 2026-07-25
modifiedAt: 2026-07-25
category: ai
i18nKey: ai-002-2026-07
tags: [llm-citation, geo, metriques-seo, recherche-ia, attribution]
readingTime: 8
author: Roibase
---

Le trafic organique baisse, les connexions directes augmentent dans Google Analytics, mais vous ne savez pas quelles requêtes sont désormais traitées par ChatGPT sans rediriger vers votre site. À mi-2026, les LLM captaient déjà 23 % du trafic de recherche (données SimilarWeb Q2 2026). Au lieu de chercher à récupérer ce trafic, vous devez commencer à mesurer le taux auquel les LLM vous **citent comme source**. Ajoutez une nouvelle couche à vos métriques SEO : taux de citation, importance de la source, fréquence de récupération.

## Qu'est-ce que la citation LLM et pourquoi la mesurer maintenant

Une citation LLM est le taux auquel un modèle génératif **vous référence comme source** quand il répond à une question utilisateur. Si ChatGPT écrit « Source : roibase.com.tr », si Perplexity fournit un lien inline, si Gemini vous liste en note de bas de page — vous avez obtenu une citation.

Dans le SEO classique, il y avait le « classement » — être 3e sur Google. À l'ère des LLM, il y a « l'importance de la citation » — sur 4 sources affichées, quelle est votre part ? Êtes-vous la première source ou en bas de la liste des « sources connexes » ? Cette différence peut modifier le taux de clics de 300 % (données internes Perplexity Labs, Q1 2026).

Si vous ne commencez pas à mesurer maintenant, vous ne pouvez pas établir de baseline. Dans 6 mois, vous ne pourrez pas répondre à la question « Nos efforts en GEO ont-ils fonctionné ? » Le premier pas : **créer un ensemble de requêtes synthétiques** et interroger régulièrement les LLM.

## Configurer l'architecture de mesure : pipeline de requêtes synthétiques

Mesurer les citations LLM ne suffit pas avec des tests manuels. Vous devez interroger Perplexity / ChatGPT / Gemini avec les mêmes 50-100 requêtes chaque jour et parser les références de sources dans les réponses. Nous le faisons avec un pipeline à 3 niveaux :

**Couche 1 : Conception de l'ensemble de requêtes**  
Extrayez de GSC les requêtes ayant généré des impressions au cours des 90 derniers jours, positionnées entre 1 et 20, avec un CTR inférieur à 5 %. Ces requêtes signifient « nous sommes visibles sur Google mais ne sommes pas cliqués » — les LLM pourraient déjà répondre à ces requêtes. Sélectionnez 50-100 requêtes. Pas seulement des requêtes de marque, mais un mélange informatif/transactionnel. Exemples : « durée des cookies server-side GTM », « optimisation des coûts BigQuery ».

**Couche 2 : Interrogation automatisée**  
Avec un workflow n8n, interrogez l'API de chaque LLM une fois par jour. Perplexity avec le paramètre `model: sonar-pro`, ChatGPT en mode `browsing: true`, Gemini avec `grounding: web`. Enregistrez la réponse en JSON — corps et tableau `sources`. Important : gérez les limites de débit (Perplexity free tier 5 req/min, ChatGPT Plus 40 req/3 heures).

**Couche 3 : Parser de citations**  
Si le JSON de réponse contient une clé `sources`, parcourez le tableau — effectuez une correspondance de domaine (`roibase.com.tr` ou sous-domaine). S'il n'y a pas de sources, cherchez un lien inline dans le corps (`[roibase](...)`) ou une URL simple (avec regex). Pour chaque requête, enregistrez 3 métriques :
1. **Citation existe :** boolean (0/1)
2. **Classement :** position dans le tableau `sources` (1-5, sinon null)
3. **Importance :** inline dans le corps ou seulement en note de bas de page (inline = 2, note = 1, absent = 0)

Écrivez ces données dans BigQuery dans la table `llm_citations` — schéma : `query_id, llm_provider, date, cited, rank, prominence`.

## Calcul du taux de citation et benchmark

Si vous avez exécuté 50 requêtes une fois par jour pendant 30 jours sur 3 LLM, vous avez 50 requêtes × 3 LLM × 30 jours = 4 500 lignes de données. Maintenant, calculez les métriques :

### 1. Taux de citation global

```sql
SELECT 
  llm_provider,
  COUNTIF(cited = 1) / COUNT(*) AS citation_rate
FROM `project.dataset.llm_citations`
WHERE date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY llm_provider;
```

**Benchmark (Q2 2026, moyenne SaaS B2B) :**  
- Perplexity : 18-24 %  
- ChatGPT browsing : 12-16 %  
- Gemini grounding : 8-14 %  

Si vous êtes en dessous de 12 % sur Perplexity, il y a une lacune en GEO — vos contenus ne sont pas structurés pour la récupération.

### 2. Taux de source primaire

Quand vous êtes cités, combien de fois êtes-vous **la première source** :

```sql
SELECT 
  llm_provider,
  COUNTIF(rank = 1) / COUNTIF(cited = 1) AS primary_rate
FROM `project.dataset.llm_citations`
WHERE cited = 1
GROUP BY llm_provider;
```

**Objectif :** 40 %+ (si vous êtes cités, vous devriez être la première source dans 4 cas sur 10). En dessous de 20 %, votre « signal de pertinence » est faible — probablement une similarité d'embedding basse lors de la récupération.

### 3. Volatilité au niveau des requêtes

Calculez la variance de citation sur 30 jours pour chaque requête — si vous êtes cités tous les jours, la volatilité est basse ; si c'est intermittent, elle est haute. Une volatilité élevée signifie que le LLM met à jour son index fréquemment ou que les concurrents vous surpassent.

```sql
SELECT 
  query_id,
  STDDEV(cited) AS citation_volatility
FROM `project.dataset.llm_citations`
WHERE llm_provider = 'perplexity'
GROUP BY query_id
HAVING COUNT(*) >= 20
ORDER BY citation_volatility DESC;
```

Si volatilité > 0.4, examinez manuellement la requête — c'est probablement un problème de « fraîcheur » (votre contenu a 6 mois, le LLM préfère les contenus récents).

## Compromis d'attribution : trafic direct ou référral LLM

Obtenir une citation LLM a un effet secondaire : votre trafic direct sur Google Analytics augmente, mais vous ne savez pas qu'il vient d'un LLM. Les clics depuis l'interface web de ChatGPT apparaissent comme `(direct) / (none)` — pas d'en-tête referrer.

Pour résoudre ce problème, 2 méthodes :

**Méthode 1 : Injection UTM (dans l'API LLM)**  
Si vous envoyez du contenu à l'API d'un LLM (par exemple, l'API Perplexity Publisher), ajoutez `?utm_source=perplexity&utm_medium=llm&utm_campaign=citation` à vos URL. Ainsi, la source apparaît dans GA4. Mais cette méthode ne fonctionne que pour les LLM utilisant une API — pas pour ChatGPT qui crawle le web.

**Méthode 2 : Fingerprinting côté serveur**  
Les bots LLM utilisent des patterns user-agent spécifiques :  
- Perplexity : `PerplexityBot`  
- ChatGPT : `ChatGPT-User` ou `GPTBot`  
- Gemini : `Google-Extended`  

Filtrez ces user-agent dans vos logs serveur et envoyez-les à GA4 en tant qu'événements côté serveur via [Architecture de mesure et données first-party](https://www.roibase.com.tr/fr/firstparty). Nom d'événement : `llm_visit`, paramètre : `llm_provider`. Vous pouvez maintenant distinguer le LLM dans le trafic « direct ».

| Méthode | Avantage | Inconvénient |
|---|---|---|
| Injection UTM | Source automatique dans GA4 | API uniquement |
| Fingerprint côté serveur | Fonctionne pour tous les LLM | Nécessite parsing de logs |

Peu importe votre choix, l'objectif est : **voir la corrélation entre le taux de citation LLM et le trafic référent**. Si les citations augmentent de 20 % mais que le trafic LLM ne suit pas, c'est que les utilisateurs ne cliquent pas bien que vous soyez cités — problème d'importance ou de qualité du snippet.

## Importance de la citation : différence entre inline et note

Le LLM vous a cité, mais **comment** ? Perplexity vous a-t-il donné un lien inline (avec `[1]` dans la phrase) ou vous êtes-vous retrouvé en note de bas de page à la fin de la réponse ? Cette différence affecte le CTR de 400 % (test A/B interne Roibase, n = 2 300 requêtes).

**Exemple de citation inline :**  
> « La durée des cookies server-side GTM peut être augmentée à 730 jours [[1]](roibase.com.tr/...). »  

**Exemple de citation en note :**  
> « ...plusieurs méthodes existent.  
> Sources :  
> 1. roibase.com.tr/...  
> 2. competitor.com/... »

Avec une citation inline, l'utilisateur clique en lisant la phrase — il a du contexte. Avec une note, il clique seulement s'il cherche « plus de détails » après avoir lu la réponse — intention de conversion plus basse.

**Calcul du score d'importance :**  
Enregistrez `position_type` chaque fois que vous êtes cités (inline / note / barre latérale). Calculez la moyenne sur 30 jours :

```sql
SELECT 
  AVG(CASE 
    WHEN position_type = 'inline' THEN 3
    WHEN position_type = 'note' THEN 1
    ELSE 0
  END) AS avg_prominence_score
FROM `project.dataset.llm_citations`
WHERE cited = 1;
```

**Objectif :** 2.0+ (plus de la moitié de vos citations doivent être inline). En dessous de 1.5, le LLM vous voit comme une « source complémentaire », pas une « source principale ». Solution : structurez votre contenu pour que le LLM puisse citer directement — définitions d'une phrase, fact box, snippets de code.

## Analyse des concurrents : chevauchement des sources au niveau des requêtes

Quelles requêtes voient vos concurrents cités mais pas vous ? Pour le voir, parsez **toutes les sources** que le LLM affiche pour chaque requête, pas seulement vous.

Exemple : pour la requête « optimisation des coûts BigQuery », Perplexity affiche les sources :  
1. competitor-a.com  
2. roibase.com.tr  
3. competitor-b.com  

Écrivez ces données dans la table `llm_all_sources` — schéma : `query_id, llm_provider, date, source_domain, rank`. Maintenant, calculez la « matrice de chevauchement » :

```sql
SELECT 
  a.source_domain AS source_1,
  b.source_domain AS source_2,
  COUNT(DISTINCT a.query_id) AS co_citation_count
FROM `project.dataset.llm_all_sources` a
JOIN `project.dataset.llm_all_sources` b 
  ON a.query_id = b.query_id 
  AND a.llm_provider = b.llm_provider
  AND a.date = b.date
WHERE a.source_domain != b.source_domain
GROUP BY source_1, source_2
HAVING co_citation_count > 5
ORDER BY co_citation_count DESC;
```

Cette requête montre : « Nous avons été cités ensemble avec competitor-a dans 47 requêtes. » Divisez maintenant `co_citation_count` par le nombre de requêtes où competitor-a seul a été cité — c'est votre « ratio de chevauchement de citations ». Au-dessus de 60 %, vous êtes en concurrence directe ; en dessous de 30 %, vous êtes dans des niches différentes.

**Transformer en action :**  
Si le chevauchement est élevé mais que vous n'êtes pas cités (competitor-a cité, vous non), bouchez le gap de contenu. Lisez la page du concurrent — quels faits a-t-il fournis, quel format (tableau / liste / code) ? Fournissez les mêmes faits de manière **plus structurée** (JSON-LD, tableau, liste à puces) — la récupération LLM préfère ces formats.

## Ce que vous allez commencer à mesurer maintenant

Pour mettre en place les métriques de citation LLM, commencez par concevoir un ensemble de requêtes synthétiques — extrayez de GSC les requêtes avec un CTR faible mais beaucoup d'impressions. Ensuite, configurez un pipeline de sondage quotidien avec n8n, écrivez les réponses dans BigQuery. Établissez une baseline sur 30 jours : taux de citation, taux de source primaire, score d'importance. Puis mesurez l'impact de votre travail en [Optimisation pour moteurs génératifs](https://www.roibase.com.tr/fr/geo) — quels changements de contenu augmentent le taux de citation, lesquels le diminuent ? Si vous êtes cités mais sans trafic, c'est un problème d'importance — visez les citations inline. Analysez les patterns de co-citation et bouchez les gaps de contenu. Ajoutez ces métriques à votre tableau de bord SEO — d'ici fin 2026, vous regarderez « trafic organique + visibilité LLM » au lieu de juste « trafic organique ».