---
title: "Tool Stack 2026: L'Anatomie des Opérations Quotidiennes chez Roibase"
description: "Vélocité des sprints Linear, hiérarchie des documents Notion, Slack asynchrone — semaines sans réunion dans une équipe de 12 et discipline de workflow mesurable"
publishedAt: 2026-07-27
modifiedAt: 2026-07-27
category: techstack-partnership
i18nKey: lifestyle-004-2026-07
tags: [tech-stack, async-workflow, linear, notion, operational-discipline]
readingTime: 9
author: Roibase
---

Les articles sur les outils se terminent généralement par « nous utilisons X, c'est super ». Celui-ci est différent — il expose les modèles d'intégration, les critères numériques et les compromis derrière la discipline opérationnelle qui a évolué chez Roibase pendant 8 ans. Tandis que la vélocité des sprints Linear passait de 1,2 à 2,8, la hiérarchie des documents Notion a connu 3 itérations, et le temps de réponse asynchrone Slack a chuté de 4 heures à 45 minutes. Ce changement n'a pas résulté du choix des outils, mais de la conception systémique qui relie les outils à la culture d'équipe.

## Linear : Pas la Vélocité des Sprints, Mais le Coût du Changement de Contexte

Quand nous avons migré de Jira à Linear en 2024, l'attente n'était pas la vitesse — c'était de réduire le coût du changement de contexte. Sur Jira, le cycle de vie d'une issue représentait en moyenne 9 changements d'écran, 3 menus déroulants, 2 déclenchements de webhook manuels. Sur Linear, le même cycle de vie, c'est 2 raccourcis clavier et 1 glisser-déposer. La différence n'est pas le temps, c'est l'économie de l'attention — un développeur qui passe 30 secondes à se demander « où écrire ce champ ? » au lieu de terminer réflexivement en 3 secondes.

Dans la planification des sprints, nous n'utilisons pas la métrique de vélocité — nous utilisons la distribution du cycle de temps. Les analyses intégrées de Linear cachent les moyennes trompeuses comme « moyenne 4,2 jours » et affichent les percentiles P50/P75/P90. Notre temps de cycle P90 est de 11 jours — c'est acceptable, car les issues aberrantes sont généralement des bloqueurs de dépendance. P50, en revanche, est de 2,8 jours — c'est la vraie vitesse du chemin critique. Regarder la distribution au lieu de la vélocité a transformé la pression « accélérer » en discipline « prévisibilité ».

Point d'intégration : les webhooks Linear écrivent en temps réel dans la base de données « Active Sprint » de Notion. Pas de synchronisation manuelle — quand un développeur change le statut dans Linear, la vue roadmap de Notion se met à jour en 200 ms. Ce modèle « source unique de vérité » permet au PM de consulter Notion avant de demander à Slack « où en est cette issue ? ». Dans une culture asynchrone-first, poser une question et attendre une réponse a un coût — le webhook réduit ce coût à zéro.

### Flux de Triage Linear : Discipline de la Boîte de Réception Zéro

Chez Linear, il y a une discipline de boîte de réception zéro — triage automatique chaque matin à 09:00. Les nouvelles issues arrivent dans la Inbox Linear, le PM les trie dans les 30 minutes : libellé de priorité + assignation + lien du projet. Les issues non triées depuis 24 heures tombent automatiquement dans le canal Slack #triage-needed. Cette fonction de contrainte maintient l'entropie du backlog sous contrôle — en 3 mois, 200 issues ont été ouvertes, 198 ont été triées, la latence de triage moyenne est de 4,2 heures.

## Notion : Hiérarchie des Documents et Optimisation du Temps de Lecture

Nous utilisons Notion comme journal des décisions plutôt que comme wiki. Chaque document porte 3 champs de métadonnées : `decision-owner`, `last-reviewed-date`, `status` (draft/active/archived). Le statut actif datant de plus de 90 jours déclenche automatiquement un rappel de révision dans Slack. Cela prévient la dégradation des documents à mesure que l'échelle augmente — en 6 mois, 180 pages Notion ont été créées, 12 ont été archivées, le reste reste en révision active.

La hiérarchie est à 3 niveaux : `Entreprise > Équipe > Projet`. Les documents au niveau entreprise (guide de marque, processus d'embauche) sont accessibles à tous mais modifiables uniquement par le fondateur/lead. Les documents au niveau équipe (rétrospective de sprint, registre de la dette technique) peuvent être éditées par les membres de l'équipe. Les documents au niveau projet (spécification de feature, résultat de test A/B) sont owned par la personne assignée. Ce modèle de permissions élimine le chaos « tout le monde peut éditer tout ».

Optimisation du temps de lecture : chaque page Notion affiche au début une durée de lecture estimée (nombre de mots / 200). Les documents de plus de 5 minutes doivent contenir automatiquement un bloc TL;DR — c'est le propriétaire du document qui le rédige, pas un résumé IA. Grâce au TL;DR, le lecteur décide en 30 secondes « est-ce que cela me concerne ? ». Données sur 6 mois : depuis l'ajout du TL;DR, le taux de rebond sur les pages a chuté de 42 % à 18 %.

Intégration : les fichiers Figma sont intégrés à Notion — mais pas comme capture d'écran, en tant qu'intégration en direct. Quand le designer modifie Figma, la spécification du produit dans Notion se met automatiquement à jour. Ce modèle élimine la question « le document est-il à jour ? ». De plus, les transcriptions de réunion Granola sont automatiquement postées à Notion — 2 minutes après la fin de la réunion, un résumé structuré apparaît sous forme de page Notion.

## Slack : Asynchrone-First, Synchrone-Quand-Critique

Sur Slack, il n'y a pas de modèle de chat en temps réel — chaque canal est asynchrone-first. Quand vous envoyez un message, vous attendez une réponse dans les 4 heures. Si une réponse plus rapide est nécessaire, vous ajoutez la mention `@urgent` au message — cela change le niveau de notification. 6 mois d'utilisation de `@urgent` : 38 messages. Nombre total de messages : 14 200. Donc 0,27 % des messages sont réellement urgents.

Discipline du fil de discussion : chaque message continue dans le fil. Seul le message de démarrage de sujet est posté dans le canal principal. Ainsi, quand vous scrollez le canal, vous voyez « 12 messages sur ce sujet » sans être obligé de tous les lire. Taux de complétion des fils : 91 % — le message trouve sa réponse dans le fil et se clôture, sans déborder dans le canal principal.

Intégration : quand une issue Linear est créée, un fil Slack s'ouvre automatiquement. Quand l'issue se ferme, une réaction « ✅ Resolved » est ajoutée au fil. Ainsi, le cycle de vie de l'issue peut être suivi sur Slack mais reste ancré dans Linear — source unique de vérité maintenue. De plus, après un appel Granola, le résumé IA tombe dans Slack, mais le même résumé existe aussi à Notion — le lecteur peut le consulter où il travaille.

### Taxonomie des Canaux Slack

Dans une équipe de 12 personnes, il y a 18 canaux Slack — mais la taxonomie est nette : `#general` (à l'échelle de l'entreprise), `#dev` (engineering), `#growth` (marketing/ventes), `#client-{name}` (spécifique au client), `#random` (hors sujet). Il y a 6 canaux clients — soit en moyenne 2 personnes suivant 1 client. Cette séparation maintient le ratio bruit/signal sous contrôle. Le canal `#general` reçoit en moyenne 8 messages par jour — assez de visibilité pour les annonces critiques, pas du spam.

## Figma : Bibliothèque de Composants et Synchronisation des Design Tokens

Nous utilisons Figma comme source du système de design, pas comme outil de mockup. La bibliothèque de composants contient 240 composants — bouton, input, carte, modal, primitive de mise en page. Chaque composant est lié à des design tokens : `color-primary-500`, `spacing-md`, `font-body-regular`. Ces tokens sont synchronisés dans le code via l'API Figma — quand le designer change `color-primary-500` dans Figma, une PR GitHub s'ouvre automatiquement, la variable CSS se met à jour.

Ce modèle de synchronisation élimine la transmission design-dev manuelle. Quand le designer marque un fichier comme « prêt pour le dev », une issue Linear s'ouvre automatiquement avec le lien Figma incorporé. Quand le développeur ouvre l'issue, le fichier Figma, la spécification du composant, les valeurs des design tokens — tout est prêt. Pas de question manuelle « ce padding fait combien de pixels ? » — le mode inspection est intégré.

Cycle de révision design : 1 heure de révision asynchrone chaque semaine — le designer pose des questions dans les commentaires Figma, le développeur répond. Pas de réunion synchrone. 6 mois : 24 révisions design, aucune n'a exigé une réunion synchrone. La révision asynchrone permet au développeur de répondre sans changer de contexte, dans son propre flux.

Intégration : le fichier Figma est incorporé à Notion — mais avec contrôle de version. Chaque révision majeure du design est enregistrée comme une branche dans Figma, l'incorporation Notion inclut un sélecteur de branche. Vous pouvez revenir aux anciennes révisions, suivre l'évolution du design. Dans les services de [branding](https://www.roibase.com.tr/fr/branding) de Roibase, la chronologie d'évolution de l'identité de marque livrée aux clients est gérée selon ce modèle — chaque itération de logo est une branche Figma, la vue chronologique Notion.

## Granola : Transcription des Réunions et Extraction des Éléments d'Action

Granola est un assistant IA pour les réunions — mais pas un outil de prise de notes, c'est un moteur d'extraction des décisions. Pendant la réunion, il capture la transcription en temps réel, en fin il produit 3 résultats : (1) résumé structuré, (2) liste d'éléments d'action (avec owner + deadline), (3) journal des décisions (qui a décidé quoi). Ces 3 résultats sont automatiquement postés à Notion.

Données sur 6 mois : 42 appels clients, 18 syncs internes, 60 réunions au total. Chaque réunion dure en moyenne 38 minutes, le résumé Granola prend 4,2 minutes à lire. Précision de l'extraction d'élément d'action : 89 % — sur 10 éléments d'action, 9 sont extraits avec owner + deadline corrects. Les 11 % restants sont corrigés manuellement. Cette précision élimine la discussion post-réunion « qui était censé faire ça ? ».

Intégration : les éléments d'action peuvent s'ouvrir automatiquement comme issues Linear — mais l'approbation manuelle est requise. Granola offre un bouton « envoyer à Linear », le PM approuve, l'issue s'ouvre. Cette étape d'approbation empêche l'IA de créer des éléments d'action erronés. Sur 60 réunions, 180 éléments d'action ont été extraits, 162 ont été envoyés à Linear, 10 % ont été rejetés (non pertinent ou doublon).

## Compromis du Tech Stack : Intégration vs. Propriété

Utiliser 5 outils (Linear, Notion, Slack, Figma, Granola) est plus complexe qu'une plateforme monolithique unique. Mais le compromis est net : le choix d'outils best-of-breed a augmenté l'efficacité de l'équipe de 34 % (suivi sur 6 mois : taux de complétude des tâches passé de 68 % à 91 %). Il y a un coût d'intégration — configurer les webhooks, écrire la synchronisation API, gérer les erreurs — mais c'est un coût unique. Le gain opérationnel continue chaque jour.

Modèle de propriété : chaque outil a 1 propriétaire responsable. Linear → Tech Lead, Notion → PM, Slack → Ops Manager, Figma → Design Lead, Granola → Founder. Le propriétaire garantit que l'outil s'aligne avec le workflow d'équipe, identifie les nouveaux besoins d'intégration, prend les décisions de mise à niveau. Cette propriété élimine la situation « tout le monde l'utilise mais personne n'en est responsable ».

Le seuil de changement d'outil est maintenu élevé — ajouter un nouvel outil requiert 3 critères : (1) peut-il s'intégrer avec le stack existant, (2) casse-t-il le modèle « source unique de vérité », (3) s'aligne-t-il avec la culture asynchrone-first ? En 6 mois, 12 propositions d'outils ont été reçues, 2 ont été acceptées (Granola + 1 outil analytics interne). Le reste a été rejeté — parce que le problème qu'ils résolvaient pouvait l'être avec la combinaison du stack existant.

## Impact Culturel Mesurable du Tech Stack

Le choix des outils est un choix de culture. La discipline des sprints Linear, la discipline de documentation Notion, la discipline asynchrone Slack — ce ne sont pas des features d'outil, ce sont des modèles culturels que les outils renforcent. Sur 6 mois, l'équipe a grandi (8 à 12 personnes), mais le nombre d'heures de réunion a baissé (12 heures par semaine à 6 heures). Ce paradoxe n'a été possible que grâce au tech stack asynchrone-first.

Vous pouvez mesurer la discipline opérationnelle : cycle de temps P50 Linear, latence de révision des docs Notion, temps de réponse asynchrone Slack, fréquence de synchronisation Figma-to-code, précision des éléments d'action Granola. Ces métriques sont discutées au niveau founder/lead lors des révisions trimestrielles. L'outil n'est pas qu'un instrument — c'est la surface mesurable de la performance d'équipe. Maintenant, quoi faire ? Testez le modèle «