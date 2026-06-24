---
title: "Recruter en Async-First : Filtres Pratiques et Structure d'Entretien"
description: "Trial week, évaluation écrite et éliminer les préjugés synchrones : guide opérationnel pour tester les candidats avec la véritable discipline du travail distant."
publishedAt: 2026-06-24
modifiedAt: 2026-06-24
category: lifestyle
i18nKey: lifestyle-005-2026-06
tags: [async-first, recrutement, travail-distant, trial-week, construction-equipe]
readingTime: 9
author: Roibase
---

Construire une équipe async-first ne commence pas par embaucher un candidat dont le profil LinkedIn dit « remote-friendly ». En 2026, l'erreur la plus courante reste la même : concevoir le processus de recrutement autour de réunions synchrones, de sessions « vibe check » et de lecture de CV. Résultat : l'équipe travaille à distance, mais il y a 4 appels Zoom quotidiens, chaque décision attend une réponse instantanée sur Slack, les instructions sont verbales plutôt que documentées. Pour construire une équipe async, il faut concevoir le recrutement selon cette discipline — ce n'est pas seulement « se rencontrer à une heure convenable », c'est tester la *capacité réelle du candidat à travailler en asynchrone*.

## Éliminer le préjugé synchrone : liste de critères mesurables

La première étape du recrutement async-first est de distinguer les compétences qui *requièrent vraiment* l'interaction synchrone. Les processus d'entretien classiques tentent de répondre à « peut-il penser sous pression » en 45 minutes de vidéoconférence. Dans une équipe async, la véritable question est : cette personne peut-elle lire le contexte par écrit et fournir une réponse détaillée 4 heures plus tard ?

La matrice de filtrage que Roibase utilise depuis 2023 se divise en 3 catégories :

**Compétences asynchrones obligatoires :**
- Lire un brief écrit et fournir un premier output sans poser de questions
- Temps de réponse sur une task Linear dans les 24 heures (avec justification en cas de retard)
- Feedback de 3 paragraphes en commentaire Figma — sans demander un appel synchrone

**Hybride acceptable :**
- Onboarding première semaine — 2-3 sessions synchrones normales
- Moments de pivot stratégique — quarterly planning, lancement majeur
- Bug/incident critique — ping instantané Slack acceptable

**Compétences non mesurables en async :**
- Capacité de brainstorming au tableau blanc — FigJam fonctionne en asynchrone
- « Énergie d'équipe » — se lit dans le document de culture écrite
- Prise de décision rapide — la décision est documentée dans le thread email en 48 heures

Lorsqu'on évalue le portfolio avec cette matrice, on découvre que 60 % des candidats ayant « 5 ans d'expérience distante » ont en fait travaillé à temps plein sur Zoom. Ces personnes entrent en frustration la première semaine de l'équipe async — « pourquoi personne ne répond sur Slack ? »

Le deuxième filtre consiste à demander au candidat si ses expériences précédentes ont produit des *artefacts asynchrones*. La question « Comment avez-vous documenté le processus décisionnel sur ce projet ? » reçoit une réponse red flag si la réponse est « nous en avons discuté en réunion hebdomadaire ». Si la réponse est « nous avons écrit 3 options + trade-offs dans Notion decision log, tout le monde a commenté en 2 jours », c'est un signal positif.

## Évaluation écrite : simulation du vrai travail

Remplacer l'entretien vidéo par une évaluation écrite ne signifie pas seulement « envoie un email » — c'est simuler le *contexte complet* auquel le candidat sera confronté en travaillant de manière asynchrone avec l'équipe. Roibase a formalisé cela en 2024 ; c'est maintenant obligatoire pour tous les postes : le candidat répond à un brief similaire à une tâche Linear dans 48 heures, prépare une page Notion au lieu d'une vidéo Loom, commente un fichier Figma.

**Format d'évaluation (exemple : rôle marketing ops) :**

*Brief :* « Le ROAS Google Ads du Client X a baissé de 18 % ces 4 dernières semaines. Dans Search Console, 3 keywords critiques voient une baisse d'impressions de -22 %. Dans Analytics, le bounce rate a augmenté de +9pp. Examinez le dataset ci-dessous (lien Google Sheet) et proposez un plan d'action d'une semaine. Format : page Notion, max 800 mots, au moins 1 visualisation de données. »

*Critères d'évaluation :*
- **Lecture du contexte :** A-t-il examiné les 12 onglets et s'est-il concentré sur la bonne métrique ? (poids : 25 %)
- **Clarté écrite :** Le plan d'action est-il assez spécifique pour qu'une autre personne l'exécute ? (poids : 30 %)
- **Suivi asynchrone :** A-t-il posé ses questions en commentaire Notion plutôt que sur Slack ? A-t-il progressé sur d'autres sections en attendant la réponse ? (poids : 20 %)
- **Respect de la deadline :** L'a-t-il terminé en 48 heures ? A-t-il prévenu en cas de retard ? (poids : 15 %)
- **Format output :** Hiérarchie des headings, graphique inline, utilisation des bullet points dans la page Notion (poids : 10 %)

40 % des candidats qui échouent cette évaluation sont du type « lire le brief ? Non, demander plutôt un appel Slack de 15 minutes ». Ces personnes deviennent des bloqueurs la première semaine d'une équipe async — chaque tâche exige une réunion synchrone.

À l'inverse, les candidats qui réussissent l'évaluation connaissent déjà le rythme : lire le contexte Notion, ouvrir un PR draft en 6 heures, demander du feedback en commentaire Figma. La friction d'onboarding chute de 70 %.

**Anti-pattern :** Présenter l'évaluation comme du « travail à domicile » puis dire lors d'un appel vidéo « expliquez-moi ». C'est retomber dans la synchronie. Le bon chemin : traiter l'évaluation comme une task Linear, donner tous les retours en commentaire Notion, l'échange question-réponse se fait de manière asynchrone. Le candidat travaille asynchrone du recrutement, tout comme il travaillera par la suite.

## Trial week : un vrai sprint, pas une simulation

Après CV + évaluation, l'étape suivante du recrutement classique est « vérification de références + entretien final ». En async-first, cette étape s'appelle : **trial week rémunérée** — le candidat rejoint un vrai sprint Linear pendant 5 jours, répond à de vrais briefs clients, travaille sur de vrais fichiers Figma. Pas de simulation ; production réelle.

Chez Roibase, la trial week fonctionne selon ces règles :

**Structure :**
- **Jours 1-2 :** Onboarding par documentation — workspace Notion, projet Linear, organisation Figma. Un channel #trial-week est créé sur Slack (asynchrone, délai de réponse 24 heures attendu). Première tâche : une « good first issue » du sprint en cours — faible complexité, contexte moyen. L'output du code/texte/design du candidat va dans le vrai repo.
  
- **Jours 3-4 :** Deuxième tâche — complexité moyenne, cross-fonctionnelle. Exemple : « Planifiez un test A/B de landing page pour le Client Y, créez une variante dans Figma, documentez la configuration Google Optimize. » Le candidat doit coordonner de manière asynchrone avec au moins 2 membres de l'équipe (design et analytics). La qualité de coordination est le cœur de la mesure.

- **Jour 5 :** Rétrospective — asynchrone. Page Notion avec les questions « Qu'as-tu appris ? Quel process était flou ? Que changerais-tu le premier sprint ? ». L'équipe donne aussi du feedback au même format : « Qualité du code ? Description PR suffisante ? Temps de réponse Slack ? »

**Rémunération :** Trial week fixe minimum 500 $ (junior) à 2000 $ (senior) — pas de calcul horaire, car l'asynchrone rend l'heure non pertinente. Évaluation sur l'output.

**Signaux red flag en trial week :**
- Demander un « appel pour discuter » avant chaque tâche (3+ fois = rejet automatique)
- Description PR de 2 lignes — « fixed bug » (pas de contexte = rejet)
- Demander sur Slack « c'est urgent ? » plutôt que répondre en 2 heures sans attendre un appel (pas de discipline async)
- Envoyer des screenshots en DM au lieu de commenter Figma (pas de documentation)

**Signaux green flag :**
- Après avoir complété la première tâche, corriger spontanément un gap de documentation identifié
- Ajouter ses propres questions comme append dans la description Linear task pour que les autres membres les voient
- Respecter le SLA de 24 heures de réponse tout en ne répondant pas à chaque message en 10 minutes (deep work présent)

La trial week est le point critique du recrutement async-first car elle révèle la vérité : tout le monde sur CV dit « self-starter, autonome ». Mais lors de la première véritable tâche, soit la personne attend un feedback instantané, soit elle part seule dans la mauvaise direction faute de contexte. La discipline async = lire le contexte par écrit + checkpoints intermédiaires asynchrones + respecter la deadline. Cette compétence ne se voit que pendant la trial week.

## Quand l'entretien synchrone est nécessaire : les cas d'exception

L'async-first ne signifie pas entièrement asynchrone — certains checkpoints doivent être synchrones. Chez Roibase, 3 situations exigent un appel vidéo :

**1. Vérification d'alignement culturel (1 fois, 30 min) :** Après la trial week, une fois les compétences techniques confirmées. Cet appel pose : « Comment résolvons-nous les conflits d'équipe ? (écrit ou appel ?) », « Que fais-tu si tu rates une deadline ? », « Te sentiras-tu isolé en travail asynchrone ? ». Ces questions ne peuvent pas avoir de réponses écrites, car le ton et l'hésitation comptent. Mais cet appel ne détermine pas la décision d'embauche, seulement l'approbation finale.

**2. Rôle senior leadership (2-3 appels) :** Les postes Director+ ne suffisent pas avec évaluation async + trial week, car les décisions stratégiques et aspects comme la [marquage](https://www.roibase.com.tr/fr/branding) exigent une vraie discussion. Ces appels sont aussi préparés : un scénario case est envoyé dans Notion avant, l'appel l'approfondit, puis un résumé écrit formalise la décision.

**3. Conversation co-fondateur/équité :** Split d'équité, vesting schedule, scénarios de sortie — cela ne se clarifie pas par correspondance asynchrone. 2-3 appels synchrones sont nécessaires. Mais la règle s'applique : agenda Notion avant chaque appel, résumé écrit de la décision après dans une tâche Linear.

En dehors de ces 3 exceptions, tout est asynchrone. Timeline d'exemple :

| Semaine | Étape | Format |
|---------|-------|--------|
| 1 | Examen CV + portfolio | Asynchrone (commentaire Notion) |
| 2 | Évaluation écrite | 48 heures, livraison Notion |
| 3 | Retour évaluation | Thread asynchrone, turnaround 24h |
| 4 | Trial week | Sprint Linear, tâches réelles |
| 5 | Retro + appel culturel | Retro asynchrone + 1 appel vidéo (30min) |
| 6 | Offre | Écrite, négociée dans Notion |

Temps synchrone total : 30 minutes. Recrutement classique : 6-8 heures d'appels vidéo. Différence : en recrutement async, le candidat a vu le vrai travail, l'équipe a testé la vraie productivité. Pas de théâtre « pense-t-il bien sous pression » ; l'historique Linear montre « comment a-t-il travaillé pendant 5 jours ».

## Anti-patterns du recrutement asynchrone : erreurs courantes

4 pièges où tombent les équipes découvrant le recrutement async :

**1. « Entretien asynchrone » signifiant simplement Loom au lieu d'appel vidéo :** Le candidat se présente sur Loom, tu poses des questions sur Loom — c'est non-synchrone, pas asynchrone. Vrai async : le candidat écrit une page Notion, tu ajoutes un commentaire Notion, le candidat modifie 12 heures plus tard. Format thread, pas monologue vidéo.

**2. Trial week utilisée comme « projet freelance gratuit » :** Certaines entreprises disent « teste une semaine » puis donnent un vrai deliverable client sans payer. C'est illégal + contraire à l'éthique. Trial week = période d'évaluation mutuelle. Le candidat te teste aussi — qualité du processus, outils, vitesse du feedback. Sans rémunération, tu ne retiens que les candidats sans autres offres, ce qui élimine les meilleurs.

**3. Expectation de « réponse rapide » sur l'évaluation :** Tu donnes 48 heures de deadline, puis tu favoritises celui qui livre en 6 heures. C'est contre-productif — tu récompenses la réactivité, pas le deep work. Métrique correcte : deadline respectée + qualité haute. Heure de livraison = sans importance.

**4. Standups synchrones pendant trial week :** « Nous sommes async, mais pendant la trial week, standup 15 min chaque matin pour suivre la progression. » Non. Trial week teste la pratique asynchrone — le candidat documente sa progression par écrit dans Linear, tu donnes du feedback asynchrone. Des standups synchrones te empêchent de tester la discipline async.

## Funnel de recrutement asynchrone : nos chiffres

Chez Roibase, funnel de recrutement async 2024-2026 :

- **Candidatures CV :** 100 personnes
- **Invitation évaluation écrite :** 20 personnes (élimination première : pas d'artefacts async dans le CV)
- **Évaluation complétée :** 14 personnes (6 manquent la deadline ou demandent un appel)