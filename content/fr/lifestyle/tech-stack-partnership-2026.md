---
title: "Tech Stack 2026 : Les Opérations Quotidiennes de l'Équipe Roibase"
description: "Linear, Notion, Slack, Figma, Granola — patterns d'intégration en mode asynchrone, économie des réunions et discipline de productivité mesurable."
publishedAt: 2026-06-22
modifiedAt: 2026-06-22
category: techstack-partnership
i18nKey: lifestyle-004-2026-06
tags: [tech-stack, async-first, workflow, productivité, linear]
readingTime: 9
author: Roibase
---

L'équipe Roibase, composée de 12 personnes réparties sur 8+ fuseaux horaires, fonctionne sans culture des réunions — 4 à 5 heures de Zoom par mois, le reste en flux asynchrone. Cette discipline conditionne chaque choix d'outil. Linear a porté la vélocité sprint de 8,2 à 12,1 points, Notion a réduit le délai task-to-completion de 3,7 jours à 1,9 jour, et Slack affiche un temps de réponse médian de 47 minutes. Ces chiffres couvrent la période Q2 2024 – Q2 2026. Les patterns d'intégration reposent sur la discipline culturelle avant tout — la tech stack n'est que le cadre, le vrai travail c'est le comportement systémique.

## Linear : Discipline de Sprint et Rythme de Cycle

Linear a été adopté mi-2023 lors de la migration depuis Jira. Le changement ne s'est pas limité à l'UI — le rythme de workflow a été entièrement reconstruit. Cycle de 2 semaines, discipline de "scope lock" en début de cycle. Scope lock = aucune nouvelle tâche ne rentre pendant le cycle, elle est dirigée vers le backlog et réordonnée en fin de cycle. Ce pattern a rendu la vélocité sprint prédictible — le taux de completion de cycle est passé de 62 % en Q3 2024 à 89 % en Q2 2026.

Chaque tâche dans Linear porte trois métadonnées : story point (complexité), priority (P0-P3), due date. Les points sont estimés en Fibonacci (1, 2, 3, 5, 8), toute tâche au-delà de 8 est automatiquement découpée. Les critères de priorité : P0 = production down, P1 = client-blocking, P2 = roadmap-critical, P3 = nice-to-have. La due date n'est pas universelle (fin de cycle), elle est task-spécifique — cette distinction réduit le coût du context switching.

### Intégration Linear ↔ Notion

Lorsqu'une issue est créée dans Linear, un déclencheur Zapier ajoute une ligne à la base de données Notion. Cette ligne porte quatre champs : issue ID, title, assignee, status. Quand le status change dans Linear, un webhook met à jour Notion. Cette base de données Notion alimente les retrospectives de sprint — les issues closes sont embed dans les notes de cycle, le calcul de vélocité est automatisé. Ce flux économise 14 minutes de réunion (plus de copier-coller manuel).

## Notion : Hub de Documentation et Contexte Asynchrone

Notion est utilisé sur trois couches : company wiki, project pages, meeting notes. Le wiki compte 47 pages, 18 catégories — documentation onboarding, guide d'accès aux outils, SOP client, processus internes (RH, finance, tech stack). La page moyenne fait 820 mots, chacune contient au minimum 1 lien de cross-référence interne. Cette densité de liens accélère la découverte — un nouveau membre lit en moyenne 38 pages ses deux premières semaines, et la durée d'onboarding est passée de 9,2 à 6,1 jours.

Les project pages sont client-spécifiques. Un workspace par client, contenant roadmap, notes de check-in hebdomadaires, assets partagés (lien Figma, property ID GA, clé API). Le template roadmap : objectives (trimestriels), key results (mensuels), task breakdown (lien Linear). Les notes de check-in hebdomadaires sont rédigées en asynchrone — mail client envoyé vendredi EOD avec lien Notion embed. Le client n'a pas accès direct à Notion, un export PDF est fourni. Ce pattern a éliminé le chaos des fils mail — retrouver une note passée prend 2 secondes (recherche Notion) au lieu de 4 minutes (recherche mail).

Le template de réunion : agenda, attendees, decisions, action items (lien issue Linear). La section action items est en format checklist — cocher une case déclenche un webhook Slack qui poste un résumé sur le canal concerné. Cette automation a réduit de 83 % les oublis de follow-up — avant, 34 % des action items étaient oubliés dans les 3 jours.

## Slack : Stratégie de Canaux et Discipline de Notification

Slack compte 24 canaux — 12 par projet, 4 internes (engineering, design, ops, random), 8 par thème (seo-insights, data-pipeline, client-alerts). La convention de nommage : `prj-{client}` (projets), `int-{department}` (internes), `top-{subject}` (thèmes). Cette cohérence améliore la précision de recherche — tu trouves ton canal en 3 frappes.

Chaque canal a un message épinglé : description du canal, liens clés (projet Linear, page Notion, drive partagé), attente de temps de réponse. Ce dernier point est critique : canaux `prj-` = réponse en 2 heures, canaux `int-` = 8 heures, canaux `top-` = best-effort. Cet SLA rend le flux asynchrone prédictible — une issue P0 est créée dans Linear (pas d'@here sur Slack), les notifications urgentes sont bannies.

### Bot Slack ↔ Linear

Le bot Linear supporte 3 commandes : `/linear create`, `/linear list`, `/linear close`. Create crée une tâche depuis le thread Slack, la description inclut automatiquement le permalink du thread. List affiche les tâches ouvertes de l'assignee. Close ferme l'issue dans Linear et ajoute une réaction emoji (✅) au thread. Ce bot a réduit de 1,4 jour le cycle de développement — le coût du context switch (Slack → Linear) s'était accumulé.

## Figma : Handoff Design et Version Control

Trois workspaces Figma : Client Projects, Internal Brand, Experiments. Chaque projet client = 1 file, organisée en pages (Homepage, Product Page, Checkout Flow). Chaque page utilise une design system — Roibase établit un système de composants spécifique au client, dérivé des guidelines de [marque](https://www.roibase.com.tr/fr/branding).

Le handoff design se fait en embedant un lien Figma dans le commentaire d'issue Linear. Le lien n'est pas statique — il est lié à l'historique de versions Figma. Le développeur clique, voit le dernier commit, l'inspect mode s'ouvre automatiquement. Ce flux a réduit le handoff design-dev de 2,1 à 0,8 jour — avant, le dev demandait "quelle est la dernière version ?", le designer envoyait un screenshot, les boucles de feedback s'allongeaient.

Les plugins Figma : Stark (audit accessibilité), Content Reel (génération de texte placeholder), Autoflow (diagrammes user flow). Stark tourne à chaque design review — si une non-conformité WCAG AA est détectée, une issue Linear est créée. Content Reel génère du texte dummy réaliste — au lieu de "Lorem ipsum", du texte spécifique au produit pour plus de contexte lors de la review client.

## Granola : Intelligence de Réunion et Résumé Asynchrone

Granola a intégré la stack Q4 2025 — outil de notes de réunion alimenté par IA. Retranscrit les appels Zoom, génère des résumés, extrait les action items. Avant, les notes étaient manuelles — un appel de 30 minutes demandait 15 minutes de nettoyage. Le résumé automatique de Granola va directement à Notion, les action items s'ouvrent comme issues Linear.

La valeur asynchrone de Granola : avec les décalages horaires, ceux qui ne pouvaient pas assister à l'appel lisent un résumé de 8 minutes au lieu de regarder 60 minutes d'enregistrement. Le format : key decisions, open questions, next steps. Les questions ouvertes sont postées sur un thread Slack, les réponses arrivent en asynchrone, marquées comme résolues à la réunion suivante. Ce pattern a réduit de 40 % la fréquence des réunions — avant, une sync tous les 15 jours, maintenant tous les 21 jours.

### Pipeline Granola ↔ Notion

Le webhook Granola envoie le résumé à Zapier, qui POST à l'API Notion. Une nouvelle ligne est ajoutée à la base de données meeting notes : date, attendees (multiselect), summary (rich text), recording link, related project (relation). Dans le résumé, les action items sont taggés avec `@{assignee}`, la personne reçoit un DM Slack. Ce pipeline élimine le besoin de follow-up manuel — avant, l'host postait manuellement les action items sur Slack, 22 % en étaient oubliés.

## Patterns d'Intégration et Tradeoffs

Les 5 outils tournent via 12 webhooks et 6 zaps Zapier. Le taux d'échec webhook : 0,7 % (3-4 erreurs par mois), temps d'exécution zap médian 4,2 secondes. Coût d'intégration : Zapier Professional $240/an, Linear Business $480/an (12 seats), Notion Team $192/an, Figma Professional $540/an (3 designers), Granola Business $360/an. Total $1812/an, soit $151 par personne. Ce coût est amorti par le gain de temps du flux asynchrone — calcul : 12 personnes × 2 heures/semaine d'économie réunion × $50/heure × 52 semaines = $62 400/an.

Premier tradeoff : la complexité d'intégration allonge l'onboarding. Un nouveau member apprend 5 outils + 12 intégrations, 6 heures de documentation la première semaine. Une alternative (outil all-in-one comme ClickUp) serait plus rapide en onboarding, mais moins flexible — le cycle rhythm de Linear, le version control de Figma, le résumé IA de Granola n'existent pas (ou limités) sur ClickUp.

Deuxième tradeoff : le risque de vendor lock-in. Cinq outils = cinq vendors, chacun peut changer ses prix ou deprecier des features. Mitigation : données critiques stockées dans Notion (export JSON facile), Linear fait des exports SQL hebdomadaires (backup), les files Figma sont mirrées sur Git LFS (historique conservé). Cette discipline de backup rend une migration possible en 2 semaines si nécessaire.

La discipline async-first requiert une culture avant tout — discipline de notifications, SLA de temps de réponse, qualité de documentation. La tech stack le rend mesurable mais ne le crée pas. Roibase revoit les métriques (vélocité sprint, cycle completion, fréquence réunion) chaque trimestre et ajuste les règles de workflow si une tendance s'inverse. En Q2 2026 : Linear cycle completion 89 %, densité de lien Notion 3,2, temps de réponse Slack médian 47 minutes — ces chiffres montrent que la discipline asynchrone est soutenable.