---
title: "Consent Mode v2 et TCF 2.2 : Comment gérer la perte de modélisation"
description: "Guide pratique pour minimiser la perte de données de conversion en conformité GDPR. Implémentation Consent Mode de Google, intégration TCF 2.2 et architecture sGTM pour une récupération de modélisation jusqu'à 70-80%."
publishedAt: 2026-07-16
modifiedAt: 2026-07-16
category: marketing
i18nKey: marketing-006-2026-07
tags: [consent-mode, tcf, gdpr, conversion-modeling, gtm]
readingTime: 8
author: Roibase
---

Google Consent Mode v2 et IAB TCF 2.2 sont désormais obligatoires. Depuis mars 2024, le trafic EEA + Royaume-Uni ne peut plus accéder au remarketing et au ciblage d'audiences Google Ads sans Consent Mode. Mais en garantissant la conformité juridique, vous rencontrez un nouveau défi : 40 à 70 % des utilisateurs refusent les cookies d'analyse, et la perte de conversions atteint 15 à 35 %. L'infrastructure de modélisation de consentement de Google tente de combler cette lacune — mais seulement si elle est correctement configurée. Dans cet article, nous expliquons les couches d'implémentation, l'intégration TCF et la liste de contrôle de qualité des données en utilisant des scénarios réels.

## Qu'est-ce que Consent Mode v2 et pourquoi la modélisation est-elle inévitable

Consent Mode est un protocole qui envoie l'état de consentement de l'utilisateur (granted/denied) en tant que signal aux API de plateforme. Dans v2, deux nouveaux paramètres ont été ajoutés : `ad_user_data` (les données peuvent-elles être collectées pour la personnalisation) et `ad_personalization` (l'utilisateur peut-il être ajouté à une audience de remarketing). Sans ces deux paramètres, le trafic EEA ne peut pas accéder au ciblage par persona dans Google Ads.

Le problème classique de Consent Mode est le suivant : si l'utilisateur refuse les cookies d'analyse, Google Analytics ne peut pas enregistrer l'événement de conversion. Dans cette situation, votre campagne Google Ads ne dispose pas des données de conversion — l'algorithme d'enchères fonctionne à l'aveugle. C'est là qu'intervient la modélisation de consentement : Google tente d'estimer le nombre de conversions manquantes en prédisant le comportement des utilisateurs qui ont refusé le consentement à partir de cohortes similaires qui ont consenti.

Pour que la modélisation fonctionne, elle a besoin de deux entrées critiques : (1) suffisamment de données de consentement accordé (minimum 100 conversions par jour, idéalement 1000+), (2) l'état de consentement est correctement envoyé (`gtag('consent', 'update', {...})`). Si ces deux éléments manquent, la modélisation bascule en mode « insufficient data » et la perte ne se comble pas.

### Facteurs affectant la perte de modélisation

Selon la documentation Q4 2024 de Google, la modélisation de consentement offre une récupération moyenne de 70 % pour les comptes où le taux de refus de consentement est d'environ 50 %. Autrement dit, si vous avez une perte de consentement de 50 %, la modélisation peut la réduire à 15 %. Mais ce taux dépend de ces variables :

- **Volume de trafic avec consentement accordé :** En dessous de 100 par jour, le modèle est faible.
- **Implémentation du CMP :** Un CMP conforme à IAB TCF v2.2 (OneTrust, Cookiebot, Usercentrics) avec un mappage correct des purposes + vendors améliore la qualité du signal.
- **Utilisation de GTM côté serveur :** Avec sGTM, l'état de consentement peut aussi être contrôlé sur le backend, ce qui ajoute du contexte first-party et renforce l'entrée de modélisation.
- **Diversité des types de conversions :** Si vous suivez en même temps le paiement du panier, l'ajout au panier et les pages vues, le modèle apprend à partir d'un tunnel plus large.

Quand la modélisation est faible, la stratégie d'enchères Google Ads (Target ROAS, Max Conversions) est moins performante car le signal de conversion réelle est incomplet. Pour compenser, vous devez importer les conversions hors ligne ou utiliser CAPI (Conversions API) pour intégrer le backend à Google.

## Intégration TCF 2.2 : mappage des purposes et liste des vendors

IAB Transparency and Consent Framework (TCF) 2.2 divise le consentement des utilisateurs en 10 catégories de purposes. Google Ads a besoin au minimum du Purpose 1 (stocker/accéder aux informations) et du Purpose 2 (personnalisation). La chaîne de consentement TCF est générée par le CMP et lue via le callback `__tcfapi` avant d'être convertie en Consent Mode dans GTM.

En pratique, cela fonctionne ainsi : quand l'utilisateur clique sur « Accepter » dans la bannière du CMP, celui-ci définit `tcData.purpose.consents` avec `{1: true, 2: true, ...}`. Cet objet est lu dans une variable Custom JavaScript de GTM et mappé de la manière suivante :

```javascript
var tcData = window.__tcfapi || {};
var purposes = tcData.purpose.consents;

if (purposes[1] && purposes[2]) {
  gtag('consent', 'update', {
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted'
  });
} else {
  gtag('consent', 'update', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });
}
```

En effectuant ce mappage, trois points doivent être vérifiés :

1. **Vérification de la liste des vendors :** Si Google (vendor ID 755) figure dans la liste TCF des vendors et que l'utilisateur l'a approuvé, le signal peut être envoyé. Sinon, `ad_storage: 'denied'` doit rester.
2. **Modèle d'intérêt légitime :** Les purposes 2-7-9-10 peuvent également fonctionner via l'*intérêt légitime*. En France, ce modèle est plus courant qu'en Turquie.
3. **Période de renouvellement du consentement :** Dans TCF 2.2, le consentement doit être renouvelé tous les 13 mois. Si votre CMP n'a pas de mécanisme de rafraîchissement automatique, le consentement doit basculer à `denied` après expiration.

### Sélection du CMP et liste de contrôle QA

Lors du choix d'un CMP, le certificat de conformité TCF 2.2 est indispensable. OneTrust et Cookiebot sont certifiés, mais vous pouvez ajouter des purposes personnalisés dans la configuration et casser la norme IAB. Liste de contrôle QA :

| Étape | Point de contrôle |
|---|---|
| 1 | Ordre de chargement du CMP : avant le conteneur GTM ? (pas de race condition ?) |
| 2 | `__tcfapi('getTCData', 2, callback)` répond-il ? |
| 3 | Le mappage des purposes 1, 2, 7, 9, 10 est-il correct ? |
| 4 | Le vendor 755 (Google) est-il approuvé ? |
| 5 | Après l'update du consentement, l'événement `consent_update` arrive-t-il à la couche de données GTM ? |
| 6 | Les événements GA4 envoient-ils un ping même quand `ad_storage: denied` ? (le ping de consentement refusé est obligatoire) |

L'étape 6 est critique : même quand le consentement est refusé, un ping `gtag('event', ...)` doit être envoyé — seul le cookie ne sera pas défini. Ces pings alimentent la modélisation de Google.

## Architecture hybride avec GTM côté serveur

Le moyen le plus efficace d'améliorer la qualité du signal dans Consent Mode v2 est de configurer une architecture « consentement hybride » sur GTM côté serveur (sGTM). Dans ce modèle :

1. **Côté client :** L'état de consentement de l'utilisateur est lu depuis le CMP et envoyé à Google via `gtag('consent', 'update', ...)`.
2. **Côté serveur :** Le conteneur sGTM vérifie l'en-tête de consentement dans les requêtes HTTP entrantes. Si le consentement est accordé, l'événement côté serveur (par ex. achèvement du paiement) reçu du backend est directement envoyé au point de terminaison Google Ads Conversion.

L'avantage de cette approche est que même pour les utilisateurs qui rejettent ATT sur iOS ou utilisent un bloqueur de publicités, un signal de conversion côté serveur peut être envoyé. En effet, l'événement côté serveur est indépendant des cookies du navigateur de l'utilisateur — il est lié à l'ID de commande du backend. Google le fait correspondre via le `gclid` (Google Click ID).

Scénario exemple : l'utilisateur utilise un bloqueur de publicités, GTM côté client n'a jamais été chargé. Mais au paiement, votre backend envoie une requête HTTP à sGTM :

```json
{
  "event_name": "purchase",
  "client_id": "hashed_user_id",
  "gclid": "abc123",
  "value": 250.00,
  "currency": "EUR",
  "consent_ad_storage": "denied"
}
```

Quand sGTM transmet cet événement à Google Ads, puisque `consent_ad_storage: denied`, il ne définit pas de cookie mais fournit une entrée pour la modélisation des conversions. Pour ce faire, vous avez besoin du tag Google Ads Conversion Linker sGTM + mappage Client ID côté serveur.

### Étapes d'implémentation sGTM

1. **Configurez le conteneur sGTM :** Déployez-le sur Google Cloud Run ou Cloudflare Workers.
2. **Envoyez les événements depuis le backend :** Envoyez l'événement d'achèvement du paiement avec Order ID + gclid + flag de consentement.
3. **Configurez le tag Google Ads dans sGTM :** Saisissez l'ID de conversion + label de conversion. Dans l'onglet « User-Provided Data », effectuez le mappage `client_id`.
4. **Ajoutez l'application du consentement :** Avec un Template personnalisé sGTM, vérifiez le consentement — si `ad_user_data: denied`, le masquage IP + hachage user_id sont obligatoires.

Le point critique dans cette architecture est que le `client_id` envoyé depuis le backend doit être un hash SHA-256 pour la conformité GDPR. Envoyer une adresse e-mail ou un ID utilisateur brut est considéré comme une violation de transfert de données.

## Signaler et optimiser la perte de modélisation

Dans l'interface Google Ads, allez à « Conversions > Measurement ». Une colonne « Modeled conversions » montre le nombre de conversions estimées pour les utilisateurs qui ont refusé le consentement. Voici comment la lire :

- **Observed conversions :** Conversions réelles des utilisateurs avec consentement accordé.
- **Modeled conversions :** Conversions estimées pour les utilisateurs avec consentement refusé.
- **Total conversions :** Somme de Observed + Modeled.

Pour calculer la perte de modélisation, utilisez cette formule simple : `(1 - (Modeled / (Trafic Total × Taux Refus Consentement))) × 100`. Par exemple :

- Trafic total : 10 000 clics
- Taux de refus de consentement : 50 % (5 000 personnes ont refusé)
- Conversions observées : 150
- Conversions modélisées : 60

Conversions attendues (si le consentement était général) : `150 × 2 = 300` (puisque 50 % a refusé). En réalité, vous en avez 210 au total (150 + 60). Perte : `(1 - (210 / 300)) × 100 = 30 %`.

### Tactiques pour améliorer la modélisation

Optimisez ces points pour améliorer les performances de modélisation :

1. **Augmentez le volume de trafic avec consentement accordé :** Rendez le bouton « Accepter » plus visible dans la bannière du CMP. Mais ne recourez pas à du dark pattern — limitez-vous à l'amélioration du layout et ne trompez pas l'utilisateur.
2. **Ajoutez des événements d'entonnoir :** Ne suivez pas que purchase, mais aussi add-to-cart, begin_checkout et autres événements d'intention. Le modèle capture un signal d'intention plus large.
3. **Importer des conversions hors ligne :** Importez les vraies données de commandes depuis votre backend vers Google Ads. Cela contourne la modélisation mais il y a une limite d'API (2 000 conversions/jour/compte).
4. **Conversions améliorées :** Envoyez les hashes d'email/téléphone avec l'événement de conversion. Cela crée une correspondance first-party et améliore la précision de la modélisation.

Note : les conversions améliorées se situent dans une zone grise en termes de GDPR. L'envoi d'un hash d'e-mail est légal si l'utilisateur a consenti, mais envoyer cette donnée (même hachée) si le consentement est refusé est une violation. C'est pourquoi vous devez déclencher les conversions améliorées uniquement quand `ad_user_data: granted`.

## Les compromis du monde réel : conformité vs. performance

Enfin, voyez les compromis de trois approches différentes en matière de stratégie de consentement :

| Approche | Taux refus consentement | Récupération modélisation | Impact ROAS | Risque GDPR |
|---|---|---|---|---|
| **Stricte (pas de pré-coché)** | 60-70 % | 60-70 % | -25 % ROAS | Faible |
| **Équilibrée (intérêt légitime)** | 40-50 % | 70-80 % | -15 % ROAS | Moyen (ambigu en France) |
| **Agressive (pré-coché)** | 20-30 % | 80-90 % | -5 % ROAS | Élevé (violation GDPR) |

La recommandation de Roibase : **Approche équilibrée + sGTM.** Utilisez l'intérêt légitime dans votre CMP et maintenez les