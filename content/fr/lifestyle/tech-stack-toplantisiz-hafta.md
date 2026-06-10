---
title: "Stack Technologique 2026 : Comment Fonctionne la Semaine Sans Réunion chez Roibase"
description: "Linear, Notion, Slack, Figma, Granola — patterns d'intégration testés pendant 8 ans et critères concrets des opérations asynchrones en équipe."
publishedAt: 2026-06-10
modifiedAt: 2026-06-10
category: lifestyle
i18nKey: lifestyle-004-2026-06
tags: [tech-stack, async-first, linear, notion, workflow-design]
readingTime: 9
author: Roibase
---

En 2026, l'équipe Roibase tient en moyenne 2 heures de réunions par semaine — le reste se synchronise via les sprints Linear, les documents Notion et les threads Slack. Ce chiffre était de 18 heures en 2019. Ce qui a changé, ce n'est pas les outils, mais le *pattern* de liaison entre eux. Une tâche ouverte dans Linear crée automatiquement un thread Slack, renvoie vers le document spec dans Notion, s'ancre à la frame de design dans Figma. Cet article expose la systématique de cette intégration — pourquoi nous avons choisi chaque outil, quelles règles d'automatisation nous avons mises en place, quelles métriques nous suivons.

## Linear : Bien Plus qu'un Gestionnaire de Tâches

Nous n'utilisons pas Linear comme un simple *issue tracker* — chaque carte est une mini-spec. À l'ouverture d'une tâche, les champs obligatoires sont : la métrique visée (CTR +5%, TTI <2s), le document Notion associé, le lien vers la frame Figma. Dès que la carte s'ouvre, un thread Slack se crée automatiquement (via Zapier), et l'équipe engage une discussion asynchrone. Le pattern qui en découle : il n'existe pas de « tâche rapide » chez Roibase — chaque carte porte au minimum 2 contextes externes.

Nous suivons la *vélocité* des sprints, mais à un niveau différent : non pas le nombre de tâches complétées, mais le **cycle time moyen des tâches** (durée entre ouverture et fermeture). En 2025, ce cycle time était de 38 heures ; en 2026, il est tombé à 29 heures. La raison : la clarté des specs — quand la métrique visée est écrite dans la carte Linear, les discussions en code review diminuent de 60% (données internes).

### Pattern d'Intégration Linear + Notion

Il existe une règle : chaque carte Linear doit avoir un lien vers un document Notion dans le champ `Related Resources` — cette règle est appliquée manuellement par l'équipe depuis le début (pas d'automatisation forcée, car c'est l'équipe qui détermine le contexte, pas un bot). Le document Notion suit généralement 3 sections : définition du problème, solution proposée, critères d'acceptation. Une carte Linear peut dériver d'une spec Notion, mais l'inverse ne se produit jamais — la spec s'écrit en premier, la tâche vient après.

Cette discipline a réduit le temps de *code review* moyen de 4,2 heures en 2024 à 2,7 heures en 2026. En review, il n'y a pas de question « pourquoi ceci ? » — la réponse est déjà dans Notion.

## Slack : D'Abord les Threads, Pas les Canaux

Nous n'utilisons pas Slack par canal, mais par *thread*. Poster un message dans un canal général est interdit — chaque message démarre soit dans un thread d'une tâche Linear, soit dans un thread lié à un document Notion. La raison : structurer la recherche. Quand tu cherches « comment fonctionne cette fonctionnalité ? » dans Slack, l'ID de la tâche Linear apparaît automatiquement, car Zapier embed cet ID dans le texte du message initial du thread.

Notre objectif de temps de réponse asynchrone : 4 heures (pendant les heures de travail). Comment le mesurons-nous ? Via l'API Slack Analytics — le *median thread response time*. En Q4 2025, c'était 3,2 heures ; en Q1 2026, 2,9 heures. Nous partageons cette métrique en rétrospective de sprint, mais nous ne l'utilisons jamais pour l'évaluation individuelle — c'est une optimisation système, pas une compétition.

## Figma : Les Tokens de Design Liés aux Tâches Linear

Nous n'utilisons pas Figma uniquement comme outil de design — les *design tokens* sont directement liés aux tâches Linear. Quand un composant bouton change dans Figma, toutes les tâches Linear qui utilisent ce composant sont étiquetées automatiquement (via API Figma + Zapier). L'équipe voit en 10 minutes quelles tâches sont affectées.

Cette intégration a été créée pendant un hackathon interne en 2024. Au début, nous pensions que c'était de la « sur-ingénierie » ; pendant un refresh de *brand*, nous avons réalisé que mettre à jour tous les états de bouton a pris 3 jours au lieu de 2 semaines. La synchronisation design-code est le goulot d'étranglement majeur dans les projets de [branding](<https://www.roibase.com.tr/fr/branding>) — cette intégration l'a réduite de 70%.

### Versioning des Design Tokens

Dans Figma, les *design tokens* ne sont pas sous contrôle de version Git, mais les tâches Linear enregistrent chaque changement avec timestamp. Une tâche note « couleur du bouton CTA changée de #FF5733 à #E84C3D », et ce log s'ajoute automatiquement au changelog de design dans Notion. Ainsi, la question « quelle était cette couleur il y a 3 mois ? » reçoit une réponse en 30 secondes.

## Granola : L'Outil qui Relie les Réunions au Reste

Nous avons dit 2 heures de réunions par semaine — la moitié sont des appels client, l'autre moitié du sprint planning. Après chaque réunion, Granola génère automatiquement une transcription + les éléments d'action. Les éléments d'action deviennent des tâches Linear (manuellement, mais avec un template), la transcription s'intègre dans Notion. Ainsi, un membre de l'équipe absent de la réunion rattrape tout le contexte en 10 minutes — on ne passe pas de temps à rédiger des comptes rendus.

La fonctionnalité critique de Granola : il catégorise automatiquement les éléments d'action (design, dev, marketing). Quand on crée une tâche Linear, il suggère automatiquement le bon label. Ce petit détail réduit le temps d'assignment après un appel client de 15 minutes à 3 minutes.

## Notion : Pas Juste un Wiki, une Machine d'État

Nous n'utilisons pas Notion comme un simple wiki — chaque document a 3 états possibles : Draft (en cours de rédaction), Review (tâche Linear associée, discussion asynchrone en cours), Canonical (document source, immuable). Le changement d'état est manuel, mais la règle est nette : passer de Review à Canonical nécessite au minimum 2 réactions « d'approbation » de membres de l'équipe (dans le thread Slack).

Les documents Canonical ne changent pas — s'il faut un changement, une nouvelle version s'ouvre, et l'ancien est archivé. Cette discipline signifie que la question « pourquoi cette décision ? » trouve toujours une réponse — on consulte l'archive, puis les tâches Linear de l'époque, puis le thread Slack.

### Vues de Base et Tagging Automatique

Notion héberge 4 bases principales : Specs, Decisions, Experiments, Changelogs. Chaque base est étiquetée automatiquement avec Linear et Slack (via Zapier + API Notion). Quand on crée un document Spec, Notion extrait automatiquement via l'API Linear « quelles tâches référencent ce spec ? ». Cette requête s'exécute chaque matin à 9h — le document reste à jour.

## Les 3 Règles Fondamentales des Patterns d'Intégration

Après 8 ans d'itération, le pattern que nous avons dégagé : chaque outil a un seul domaine de « source of truth », et les autres outils s'y connectent.

- **Linear :** Source de vérité pour l'état des tâches et les timelines. Notion peut écrire des specs, mais seul Linear modifie l'état de la tâche.
- **Notion :** Source de vérité pour les specs et les documents décisionnels. Une tâche Linear renvoie vers Notion, mais un document Notion ne mises à jour jamais une tâche Linear.
- **Slack :** Source de vérité pour les discussions asynchrones. Les threads se créent automatiquement, mais leur contenu est *manuellement* migré vers Notion (pas de sync automatique, car le ratio signal/bruit se dégraderait).

La deuxième règle : chaque automatisation doit être réversible. Les workflows Zapier peuvent aussi fonctionner en déclenchement manuel — l'équipe peut désactiver « créer un thread Slack quand une tâche Linear s'ouvre » pour une semaine si nécessaire (par exemple, pendant une phase de développement intensive pour réduire le bruit). L'automatisation soutient la discipline culturelle, elle ne l'impose pas.

La troisième règle : la mesure se fait au niveau de l'équipe, jamais au niveau individuel. Temps de réponse Slack, cycle time Linear, durée d'approbation des documents Notion — tout cela est partagé en rétrospective, mais n'apparaît jamais dans les évaluations individuelles. L'objectif est l'optimisation du système, pas la compétition.

## Pourquoi Ces Outils, Pas les Autres

Nous n'avons pas choisi Jira à la place de Linear, car Jira n'incite pas à rédiger des specs — les tâches s'ouvrent vite, le contexte vient après. Linear fait l'inverse : ouvrir une tâche sans description est impossible. Cette petite différence UX crée une différence culturelle.

Nous n'avons pas choisi Confluence à la place de Notion, car Confluence cible l'versioning d'entreprise — trop complexe pour petites équipes. Les vues base de Notion sont souples, les intégrations Linear et Slack sont légères.

Nous n'avons pas choisi Discord à la place de Slack, car la structure de thread Discord est gamifiée ; les threads Slack sont plus nets pour un contexte professionnel. L'API de recherche Slack fonctionne nativement avec les IDs de tâches Linear.

Nous n'avons pas choisi Adobe XD à la place de Figma, car l'API Figma est ouverte et s'intègre via Zapier. L'API XD est restreinte.

Nous n'avons pas choisi Otter.ai à la place de Granola, car Granola extrait les éléments d'action nativement — Otter génère une transcription, mais tu extrais les éléments d'action manuellement.

Le stack technologique chez Roibase n'est pas figé — en 2024, nous avons migré de Loom vers Tella (upload plus rapide, support d'embed Linear). En 2025, nous avons testé Make.com au lieu de Zapier, mais nous sommes revenus (les logs d'erreur de Zapier sont plus lisibles). La sélection d'outils change, mais le pattern d'intégration reste : chaque outil a un seul domaine de « source of truth », les autres s'y connectent.