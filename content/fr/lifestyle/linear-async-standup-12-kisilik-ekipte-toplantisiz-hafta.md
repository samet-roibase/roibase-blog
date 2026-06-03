---
title: "Linear + Async Standup: Dans une équipe de 12 sans réunions hebdomadaires"
description: "Gestion des cycles, mises à jour quotidiennes et escalade des blocages pour la coordination asynchrone d'équipe. Pas de rapports, de l'opération."
publishedAt: 2026-06-03
modifiedAt: 2026-06-03
category: lifestyle
i18nKey: lifestyle-001-2026-06
tags: [async-work, linear, coordination-équipe, gestion-cycle, remote-work]
readingTime: 9
author: Roibase
---

Chaque notification d'appel synchrone interrompt la période de concentration profonde de 23 minutes d'un membre d'équipe (étude UC Irvine, 2023). Dans une équipe de 12 personnes, un daily standup quotidien consomme 40 minutes, soit 240 minutes × 12 personnes par semaine = 2 880 minutes (48 heures) de perte. La culture de travail asynchrone ne supprime pas cette perte — elle la transforme en un système de suivi mesurable et traçable. La gestion des cycles de Linear et la discipline des mises à jour quotidiennes asynchrones font passer la coordination d'équipe des réunions à l'opération. Cet article décrit le flux de travail concret tiré de 8 années d'expérience de leadership d'équipe chez Roibase.

## Discipline des cycles : notation Fibonacci et rythme hebdomadaire

Dans Linear, chaque cycle dure 1 semaine. Pas de sprint — un cycle. Le terme « sprint » crée une perception de « sprint de dernière minute », tandis que « cycle » implique une répétition rythmique. Chaque lundi matin, un nouveau cycle commence ; vendredi soir, un post d'examen du cycle est publié. Au sein du cycle, les issues sont dans l'un des trois états : Backlog, In Progress, Done.

Nous utilisons un système de points Fibonacci : 1, 2, 3, 5, 8. 1 point = moins de 2 heures de travail, 8 points = 1 jour de travail. Aucune issue de 13 points ou plus n'est acceptée — la décomposition est obligatoire. Cette discipline n'est pas une estimation — elle repose sur des données empiriques passées. Le panneau « Cycle Analytics » de Linear montre la vélocité moyenne de l'équipe (chez Roibase, ~42 points complétés par semaine).

Au début de chaque cycle, nous remplissons 3 colonnes :

| Colonne | Contenu | Responsable |
|---------|---------|-------------|
| Priority | Bloqueur client, bug impactant les revenus, feature avec deadline | Product Lead |
| Next Up | Issues à traiter après Priority | Engineering Lead |
| Icebox | Issues qui ne rentre pas dans le cycle mais sera traitées dans les 2 prochains cycles | Team |

La colonne Priority ne change pas en milieu de cycle — les demandes qui violent cette règle vont au cycle suivant. Exception : bug P0 (production down, échec de paiement). Cette discipline prévient l'inflation du mot « urgent ».

### Mise à jour quotidienne asynchrone : rapports text-first

Il existe un canal Slack `#daily-updates`. Chaque membre d'équipe écrit 3 lignes le matin au démarrage :

```
Hier : Implémentation de la logique de retry Stripe (LIN-482, 5pt) — mergé
Aujourd'hui : Correction du test Cypress instable sur le flux de paiement (LIN-490, 3pt)
Bloquage : Besoin d'approbation design sur la nouvelle modal d'onboarding (CC @DesignLead)
```

Ce format est fixe — pas de texte libre accepté. L'ID Linear (LIN-xxx) est obligatoire, l'estimation en points est obligatoire. S'il n'y a pas de ligne « Bloquage », ne l'écrivez pas — si un membre d'équipe n'est pas bloqué, il n'y a pas besoin de le signaler.

La mise à jour quotidienne doit être envoyée entre 09:00 et 10:30 (fuseau horaire local en cas de décalage). Si elle est envoyée tardivement, un bot de rappel s'active (webhook Linear + automation Slack). Cette discipline élimine la question « qui fait quoi » — la réponse est partagée avant même d'être posée.

## Pattern d'escalade de bloquage : règle des 4 heures

Si un membre d'équipe est bloqué sur la même issue pendant plus de 4 heures, une intervention manuelle est nécessaire. Dans Linear, le label `blocked` est ajouté à l'issue, et la personne concernée est identifiée sur Slack :

```
LIN-490 bloqué — Impossible de seed la base de données dans l'environnement Cypress.
@DevOpsLead : Le script de seed du pipeline CI ne fonctionne pas ?
```

Ce message est envoyé au canal `#blockers`, pas à `#daily-updates`. Un thread est ouvert sous le message pour discuter de la solution. Quand elle est trouvée, un commentaire est ajouté à l'issue Linear : « Bloquage résolu — le script de seed ne voyait pas le fichier .env, ajouté à Docker Compose. »

La règle des 4 heures brise la culture du « travail en solo héroïque ». Chez Roibase, la moyenne d'escalades de bloquage par cycle est 2,3 issues — si ce chiffre est bas, l'équipe ne prend pas assez de risques (choix de tâches faciles) ; s'il est élevé, la complexité du scope doit être ajustée.

### Temps d'attente asynchrone pour la code review

Quand une pull request est ouverte, elle est automatiquement liée à l'issue Linear (intégration GitHub). Après ouverture, le membre d'équipe ne reste pas inactif — il commence la prochaine issue en ordre de priorité. SLA de review : au moins 1 personne doit examiner dans les 8 heures.

Règles de review :

- Si la PR dépasse 400 lignes, sa décomposition est demandée (la qualité de review diminue)
- Si la couverture de test est en dessous de 80%, rejet automatique (vérification CI)
- L'approbation doit venir de 2 personnes (lead + 1 pair)

Pendant la review, les discussions synchrones sont INTERDITES. Le reviewer commente, l'auteur répond — le thread reste ouvert jusqu'à sa clôture. Cette discipline élimine le piège « on en parle sur Zoom ? »

## Examen du cycle le vendredi : rétrospective numérique

Chaque vendredi à 16:00, le « Cycle Completion Report » de Linear s'exécute. Cette automation envoie ces données à Slack :

```
Cycle 2026-W22 Résumé :
Complété : 38 points (objectif : 42)
Reporté : 2 issues (LIN-495, LIN-501)
Nombre de bloquages : 3
Temps moyen du cycle : 2,1 jours
```

Si les reports dépassent 2, un membre d'équipe applique la priorisation dans la colonne Priority du cycle suivant. S'il y en a plus de 3 — c'est une erreur de planification de scope, la capacité du cycle doit être réduite.

Le post d'examen du cycle est publié sur Notion. C'est pas une réunion — c'est un document text-based. Le contenu :

1. **Travail complété :** Résumé court de chaque issue (1 phrase)
2. **Apprentissages :** Opportunités de dette technique, améliorations d'outillage
3. **Focus du prochain cycle :** Domaines sur lesquels on se concentrera la semaine prochaine

Après publication, les membres d'équipe commentent — « LIN-482 : la logique de retry Stripe doit être testée en production » par exemple. Ce feedback entre dans la planification du cycle suivant.

### Pattern de report et discipline de scope

Les issues reportées le sont pour 2 raisons :

1. **Sous-estimation :** Une issue estimée 5 points s'avère être 8 points
2. **Bloquage externe :** Attendre une approbation de design, par exemple

Dans le premier cas, le nombre de points de l'issue est rétroactivement mis à jour (champ « Actual Effort » dans Linear). Ces données calibrent les estimations futures. Dans le second cas, l'issue passe à la colonne Priority — parce qu'elle doit se fermer rapidement une fois le bloquage résolu.

Si un report se répète 3 cycles consécutifs, c'est que la capacité de l'équipe est insuffisante. Chez Roibase, nous appliquons alors un « cooldown cycle » de 2 semaines : pas de nouvelles features, uniquement nettoyage de la dette technique (tests instables, dépendances obsolètes, écarts de documentation).

## Semaine sans réunions : situations synchrones exceptionnelles

Asynchrone d'abord ne signifie pas zéro réunion — cela signifie minimiser les réunions obligatoires. Chez Roibase, il y a une seule réunion synchrone par semaine : **Bi-weekly Planning** (tous les 2 semaines, 60 minutes). L'équipe y discute de la roadmap sur 4 semaines — via la vue « Projects » de Linear.

Les situations qui justifient une réunion synchrone :

- Décision architecturale (ex. : passage d'une architecture monolithique à microservices)
- Alignement client (dans un contexte d'agence, projets cross-fonctionnels comme [Branding & Brand Identity](https://www.roibase.com.tr/fr/branding))
- Résolution de conflit (situation où aucun consensus n'émerge en code review)

Ces situations surviennent ~0,4 fois par cycle chez Roibase — c'est-à-dire une fois tous les 2,5 cycles. La réunion a une limite de 30 minutes maximum, l'agenda est partagé sur Notion en amont, et elle se conclut par un document de décisions.

## Faire de la discipline asynchrone une opération

La culture de travail asynchrone n'est pas « flexible » — elle demande une discipline stricte. Chez Roibase, cette discipline repose sur 3 piliers :

1. **Communication text-first :** Pas de messages vocaux Slack, pas de vidéos Loom (exception : onboarding)
2. **SLA de réponse :** Réponse à un bloquage dans 2 heures, à un message normal dans 8 heures
3. **Respect du fuseau horaire :** Si un membre d'équipe envoie un message après 19:00 heure locale, il désactive les notifications (envoi planifié Slack)

Cette structure fonctionne parce que chaque membre d'équipe protège ses heures de travail profond. La fonction « Focus Time » de Linear crée un bloc de 4 heures dans les calendriers — durant ce créneau, pas de notifications, Slack fermé, seulement code ou itération design.

La coordination d'équipe asynchrone ne consiste pas à réduire le nombre de réunions — c'est créer un rythme qui élève la qualité des décisions. Quand la discipline des cycles, des mises à jour quotidiennes et du pattern d'escalade de bloquage se combinent, les membres d'équipe reçoivent la réponse à « qui fait quoi » avant même de poser la question. Cette structure réduit les 48 heures de réunions hebdomadaires dans une équipe de 12 à seulement 1 heure. Les 47 heures restantes vont au travail profond.