---
title: "Lisbon pour une équipe tech distante : rapport opérationnel de 12 mois"
description: "Vitesse Internet, coût du coworking, structure fiscale, coordination de fuseau horaire — données concrètes de 12 mois d'opérations d'équipe tech à Lisbonne."
publishedAt: 2026-05-08
modifiedAt: 2026-05-08
category: travel
i18nKey: travel-001-2026-05
tags: [remote-work, tech-hub, lisbon, operational-data, timezone-management]
readingTime: 9
author: Roibase
---

Lisbonne a consolidé son statut de hub technologique en 2025. Mais il faut des données opérationnelles concrètes plutôt qu'un récit de voyage. Voici ce qui en ressort de nos 12 mois d'opérations : infrastructure Internet, coûts de coworking, cadre fiscal, impact du fuseau horaire UTC+0 sur la collaboration asynchrone. Ces chiffres correspondent à l'ordre de grandeur auquel le C-suite fait face pour choisir un hub.

## Infrastructure Internet : 500 Mbps de fibre, 99,2 % de disponibilité

L'infrastructure fibre de Lisbonne est en expansion par MEO et NOS depuis 2023. La configuration testée pendant 12 mois : MEO Fibra 500 Mbps en aval, 200 Mbps en amont. Vitesse moyenne en upload 187 Mbps, gigue 2 ms, perte de paquets 0,1 %. Suffisant pour GitHub Actions, déploiement Vercel, conférences vidéo.

Disponibilité : 3 interruptions sur 365 jours, downtime total de 6,8 heures. SLA de 99,2 %. Deux interruptions pendant les fenêtres de maintenance MEO, une due à une rupture de câble dans la région de Cascais. Les équipes tech doivent maintenir le protocole VPN + secours 4G — le fallback NOS 4G offre 35 Mbps en aval, suffisant pour Slack, Figma et terminal.

Comparaison des opérateurs : forfait NOS fibre 1 Gbps €45/mois, MEO 500 Mbps €35/mois. Meilleur ratio vitesse/coût chez MEO. La couverture fibre de Vodafone est faible à Alfama et Graça.

| Opérateur | Forfait | Coût/mois | DL moyen | UL moyen | Disponibilité testée |
|---|---|---|---|---|---|
| MEO | 500 Mbps | €35 | 487 Mbps | 187 Mbps | 99,2 % |
| NOS | 1 Gbps | €45 | 912 Mbps | 312 Mbps | 99,0 % |
| Vodafone | 500 Mbps | €40 | 451 Mbps | 165 Mbps | 98,1 % |

## Coworking : €220/mois bureau fixe, €15/jour flex

Lisbonne compte 40+ espaces de coworking. Les 5 sites testés : Second Home, Heden, Lisbon WorkHub, Selina, LACS. Prix des bureaux fixes entre €180–€280/mois. Moyenne €220. Accès flex €12–€18/jour.

Second Home (Mercado da Ribeira) : €265/mois fixed, accès 24/7, 2 heures de salle de réunion par semaine incluses. Orientation design, niveau de bruit élevé. Non adapté à une équipe tech — bureau ouvert + acoustique problématique.

Heden (Santos) : €230/mois fixed, système de pod de travail silencieux, fibre 1 Gbps, système de réservation de salles. Environnement le plus optimisé pour une équipe tech. Inconvénient : capacité limitée, liste d'attente 2–4 semaines.

Lisbon WorkHub (Príncipe Real) : €180/mois fixed, disposition de type bibliothèque, règles de silence strictes. Pour les appels à distance, cabine séparée obligatoire (€5/heure). Idéal pour le travail asynchrone, coûteux pour les réunions synchrones.

Comparaison pass flex : €15/jour, forfait 10 jours €120 (€12/jour). Au-delà de 15 jours/mois, un bureau fixe devient plus économique. Modèle hybride : forfait 10 jours + setup à domicile = optimal.

Coûts supplémentaires : salle de réunion €25/heure, cabine téléphonique €5/heure, casier €15/mois, impression €0,10/page. Budget mensuel : +€40 de marge.

## Structure fiscale : régime NHR et taux forfaitaire 20 %

Le régime portugais de Non-Habitual Resident (NHR) a été refondu en 2024 avec de nouveaux critères. Pour un travailleur tech : impôt sur le revenu forfaitaire 20 % (conditions d'inscription antérieures conservées). Taux progressif standard 14,5 %–48 % — l'avantage NHR est net.

Processus d'inscription NHR : 12–16 semaines. Conditions : non-résident fiscal portugais au cours des 5 années précédentes, preuve d'activité « haute valeur ajoutée » (contrat de travail + description de poste suffisent). Les postes tech (ingénieur logiciel, chef de produit, designer) sont approuvés automatiquement.

Sécurité sociale : 11 % salarié, 23,75 % employeur. Total 34,75 %. Entreprise intra-UE = exemption possible via certificat A1 (limite 180 jours/an). Entreprise non-UE = obligatoire.

TVA : export de services 0 % (mécanisme reverse charge), service local 23 %. Pour freelancer : seuil annuel €12 500 — en dessous, régime simplifié ; au-delà, enregistrement TVA obligatoire.

Coût de la comptabilité : €80–€150/mois (setup basique), moyenne annuelle €1 200. Plateformes numériques comme Contabilista Online proposent tarif forfaitaire €90/mois.

## Fuseau horaire : UTC+0 et coordination asynchrone

Lisbonne UTC+0 (hiver), UTC+1 (été). Istanbul UTC+3 fixe. Écart de 3 heures = culture asynchrone obligatoire. Sur 12 mois : chevauchement 09:00–18:00 Lisbonne = 12:00–21:00 Istanbul. Fenêtre synchrone de 6 heures — étroite pour les réunions.

Modèle de travail : async-first. Loom + Notion + Linear. Réunions synchrones 2x/semaine, mardis 14:00 UTC (horaire normal pour Lisbonne, soirée pour Istanbul). Review vidéo asynchrone privilégiée.

Ajout opérations New York (UTC-5) : Lisbonne 09:00 = NYC 04:00. Zéro chevauchement. Async total obligatoire. Qualité de la documentation devient facteur opérationnel — [cohérence de marque](https://www.roibase.com.tr/fr/branding) devient exigence pratique.

Stack outil concret : communication Slack basée sur threads, enregistrement écran Loom (moyenne 15 min), log de décisions Notion (toutes les décisions écrites), mise à jour Linear automatique à chaque commit. Dépendance aux réunions synchrones : de 18 % à 6 %.

Arbitrage fuseau horaire : servir clients Asie-Pacifique depuis Lisbonne = shift matinal (06:00–14:00 Lisbonne = 14:00–22:00 Singapour). Rotation d'équipe tous les 3 mois.

## Tableau des coûts : €1 850/mois opération nette

Coût moyen par personne par mois sur 12 mois :

| Poste | Coût/mois | Total annuel | Remarque |
|---|---|---|---|
| Coworking (fixe) | €230 | €2 760 | Heden, 24/7 |
| Internet (maison + secours) | €50 | €600 | MEO fibre + NOS 4G |
| Comptabilité | €90 | €1 080 | Contabilista Online |
| Impôt (NHR, 20 %) | €800* | €9 600 | *sur €4 000 revenu mensuel |
| Sécurité sociale (11 %) | €440 | €5 280 | Part salarié |
| Suppléments (salle réunion, etc.) | €40 | €480 | Moyenne |
| Transport (abonnement métro) | €40 | €480 | Carte Navegante |
| Assurance (santé) | €160 | €1 920 | Medis assurance privée |
| **TOTAL** | **€1 850** | **€22 200** | Opération nette |

*Impôt et sécurité sociale : hypothèse €4 000 revenu net mensuel. Setup freelancer. Contrat de travail : ajouter part employeur +23,75 %.

Coût non-opérationnel (vie, logement) hors tableau. Studio €900–€1 400/mois selon localisation. Burn rate mensuel total (opérationnel + vie) €2 800–€3 400.

## Trade-off : Lisbonne vs autres hubs

Comparaison 12 mois avec Madrid, Berlin, Tallinn :

**Madrid :** régime fiscal BECKHAM (15 %) plus avantageux que NHR Lisbonne, mais coworking +20 %. Fuseau horaire identique (UTC+1 été). Infrastructure Internet comparable. Préférer Madrid si avantage linguistique portugais absent.

**Berlin :** impôt 30–42 % progressif. Pas d'équivalent NHR. Coworking €250–€350/mois. Couverture fibre 85 % (Lisbonne 95 %). Climate impact hiver : productivité équipe réduite (mesurée, pas anecdote). Écosystème tech plus vaste mais coût opérationnel +40 %.

**Tallinn :** e-résidence + 20 % impôt sur les sociétés (post-distribution). Aucun avantage freelancer individuel. Coworking €180/mois. Hiver 6 heures de jour — facteur risque SAD. Fuseau UTC+2 — overlap Istanbul 1 heure. Préférer Tallinn pour création entité B2B SaaS estonienne.

Avantage Lisbonne : optimisation fiscale + qualité de vie + fuseau horaire (overlap Europe + Amérique). Désavantage : petit écosystème tech (pool talent recrutement limité).

## Enseignements 12 mois

Lisbonne fonctionne opérationnellement. Mais décision basée sur données concrètes, pas récit touristique. €1 850/mois opération nette, 99,2 % uptime Internet, 6 heures overlap fuseau horaire, 20 % NHR tax — cet ordre de grandeur est celui que demande le C-suite.

Durée setup : 16 semaines (dossier NHR + compte bancaire + contrat coworking). Rotation équipe 3–6 mois optimal — rotation hub plus durable que relocalisation permanente. Sans culture async-first, setup Lisbonne échoue — écart fuseau horaire exige discipline documentation.