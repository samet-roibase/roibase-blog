---
title: "Tool Stack 2026: Operations quotidiennes de l'équipe Roibase"
description: "Linear, Notion, Slack, Figma, Granola — patterns d'intégration et discipline de productivité mesurable dans une équipe de croissance de 12 personnes."
publishedAt: 2026-05-30
modifiedAt: 2026-05-30
category: techstack-partnership
i18nKey: lifestyle-004-2026-05
tags: [tool-stack, async-workflow, linear, notion, team-operations]
readingTime: 8
author: Roibase
---

Les discussions sur les tool stacks dégénèrent souvent en catalogues : « voici les apps qu'on utilise ». Mais l'enjeu réel n'est pas les outils isolés — c'est le pattern d'intégration, le coût du context-switching, la discipline async-first. Chez Roibase, une équipe de 12 personnes travaille en remote-first depuis 2018. En 2026, nos opérations quotidiennes tournent autour de 5 outils : Linear, Notion, Slack, Figma, Granola. Plutôt que de les énumérer, nous exposons la couche d'intégration — où vivent les données, quels workflows les déclenchent, quelles notifications sont fermées.

## Linear : Pas de sprints, métriques de flow

Linear est vendu comme outil de gestion de projet, mais chez Roibase c'est une « couche de visibilité du work-in-progress ». Pas de planification de sprint — pas de cycles, pas de jalons. À la place, chaque issue reçoit une **priority (P0/P1/P2)** et une **estimate (1-3-5-8)**. La priorité n'est pas décidée par la personne, mais par le système : P0 = bloque le déploiement aujourd'hui, P1 = doit être fermé dans le cycle, P2 = backlog.

**Métriques de flow :**
- **Cycle time :** Moyenne de 2,3 jours entre ouverture et fermeture d'une issue (donnée Q4 2025). Les issues dépassant 5 jours sont automatiquement promues en P0.
- **Work-in-progress limit :** Maximum 3 issues ouvertes par personne. Pour en prendre une 4e, il faut en fermer une ou la déléguer.
- **Merge-to-close time :** Temps écoulé entre la fusion d'une PR et la fermeture de l'issue Linear — cible <30 minutes (CI/CD + QA automatisés).

L'intégration Slack de Linear est fermée. Au lieu d'un bombardement de notifications, nous avons un **système de digest** : chaque matin à 09:00, un résumé est posté sur Slack (nombre d'issues P0, cycle time moyen, répartition du WIP). Personne ne mention sur Linear — tout le monde lit le digest du matin.

### Synchronisation Linear → Notion

Les issues complétées sont archivées dans Notion chaque semaine (workflow Zapier). Notion héberge une « Retrospective Database » — chaque issue fermée est taggée par service. Par exemple, les issues du projet `branding` sont rapportées sous [Marque & Identité Visuelle](https://www.roibase.com.tr/fr/branding). Cette donnée alimente la planification de capacité tous les 3 mois : combien de temps d'ingénierie chaque service consomme-t-il ?

## Notion : Source of truth, pas un wiki

Notion n'est pas un wiki — c'est un « decision log ». Chaque décision stratégique (par exemple « tracking côté serveur ou côté client pour cette campagne ? ») est documentée au format **RFC (Request for Comments)**. Le template RFC :

```
## Décision
[Une phrase — qu'est-ce qu'on fait]

## Contexte
[Pourquoi c'est nécessaire maintenant]

## Alternatives
[Au moins 2 options + tableau des tradeoffs]

## Mesure
[Comment saurons-nous si la décision était juste dans 4 semaines]

## Propriétaire
[Qui en est responsable]
```

Après l'ouverture d'un RFC, il y a 48 heures pour commenter en async. Personne n'appelle une réunion — chacun lit à son rythme, commente. Après 48 heures, le decision owner documente la décision finale, et l'action passe à Linear.

**Couches de données dans Notion :**
1. **RFC Database** — tous les décisions
2. **Retrospective Database** — tâches complétées venant de Linear
3. **Client Playbook** — notes opérationnelles par client (où est tel tableau de bord, où est telle API key)
4. **Brand Assets** — liens Figma, tone-of-voice document

La recherche dans Notion ne fonctionne pas bien, dit-on. Nous ne cherchons pas — chaque base est filtrée et taggée. Avoir besoin de search signifie généralement « j'ai rangé les données au mauvais endroit ».

## Slack : Async-first, real-time en second

Les notifications Slack sont désactivées au niveau de l'équipe. Seuls `@channel` et `@here` sont actifs — avec une règle : interdit sauf P0 incident. La messagerie est divisée en 3 canaux :

1. **#daily-digest :** Résumés Linear/Notion, logs de déploiement CI/CD
2. **#async-questions :** Questions sans attente de réponse immédiate (réponse sous 24h acceptable)
3. **#sync-now :** Vraie coordination temps réel (incident production, optimisation de campagne live)

**Attentes de temps de réponse :**
- `#sync-now` → 15 minutes
- `#async-questions` → 24 heures
- DM → 48 heures (pas de culture de DM, canaux utilisés)

Les threads Slack sont obligatoires. Répondre au message principal est interdit — chaque message ouvre un thread. Les conversations parallèles ne s'entrelacent pas.

### Intégration Slack → Granola

Granola est un outil de notes de réunion — mais chez Roibase il n'est utilisé que pour les appels clients. Pas de réunions internes (0-1 sync call par semaine). Après un appel client, Granola envoie la transcription IA sur Slack, l'équipe lit en async. Les items d'action deviennent automatiquement des issues Linear (trigger Zapier).

Le killer feature de Granola : il met en surbrillance les engagements numériques mentionnés (« résultats du test A/B dans 2 semaines », « CTR doit augmenter de 15 % »). Ces éléments reçoivent automatiquement un rappel — personne n'oublie.

## Figma : Pas un handoff, une spec vivante

Figma n'est pas qu'un outil de design — c'est une « couche de frontend spec ». Chaque composant UI est défini comme variant dans Figma. Le développeur n'extrait pas de code de Figma (pas de copy CSS) — mais il lit le comportement du composant. Par exemple, un bouton a ses états `hover`, `active`, `disabled` en tant que frames dans Figma. La logique d'état correspondante est appliquée dans le code.

**Liaison Figma → Linear :**
Chaque fichier Figma a un plugin `Linear Issue`. Quand le design est approuvé, le designer ouvre une issue Linear directement, colle le lien Figma dans la description. Quand le développeur prend l'issue, il connaît déjà le design — il implémente sans poser de questions.

Les commentaires Figma ne s'écoulent pas vers Slack (pour éviter le bombardement). À la place, un « Figma Digest » hebdomadaire — les commentaires ouverts sont convertis en issues Linear.

## Pattern d'intégration : Où vivent les données ?

Les discussions sur les tool stacks commencent souvent par « quel outil utilisez-vous ? ». La vraie question : « quelle donnée est canonique où ? ». Chez Roibase, la propriété des données fonctionne ainsi :

| Type de donnée | Source de vérité | Synchronisée vers |
|---|---|---|
| Travail actif (WIP) | Linear | Slack digest quotidien |
| Travail complété (rétrospective) | Notion | Linear (archivé) |
| Décisions stratégiques | Notion (RFC) | Linear (action items) |
| Notes d'appels clients | Granola | Slack thread |
| Spec UI | Figma | Description issue Linear |
| Assets marque | Notion | Figma (lien embedded) |

Pas de double source-of-truth. Si une donnée paraît canonique à deux endroits, l'un est faux.

## Discipline des notifications : Quand se taire, quand faire du bruit

Le plus grand danger d'un modern tool stack est la notification creep. Chez Roibase, la stratégie est :

**Complètement fermées :**
- Mentions Linear (threads Slack à la place)
- Commentaires Figma (digest hebdomadaire)
- Mises à jour Notion (personne ne watch)

**En tant que digest :**
- Résumé quotidien Linear (09:00)
- Résumé commentaires Figma ouverts (vendredi 17:00)
- Log de déploiement CI/CD (résumé après chaque déploiement)

**Temps réel :**
- `@channel` (incident P0 seulement)
- Résumé appel client Granola (5 min après la fin)
- Erreur production (Sentry → Slack, canal `#sync-now` uniquement)

À chaque nouvel outil : première question « notification real-time ou digest ? ». Réponse par défaut : digest.

## Et maintenant ?

Au lieu du réflexe « adoptons aussi cet outil », posez-vous : « où doit être canonique cette donnée ? ». Le stack 2026 de Roibase repose sur Linear/Notion/Slack/Figma/Granola, mais ces outils peuvent changer — l'important est le pattern d'intégration, la discipline des notifications, la culture async-first. Si votre équipe se plaint « pourquoi je ne reçois pas la notification de X ? », le problème n'est pas l'outil — c'est que la propriété des données est floue.