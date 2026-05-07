---
title: "Server-Side GTM et Conversion API : De Zéro à la Production"
description: "Configuration du tagging server-side sur Cloud Run et Workers, déduplication d'événements, templates de container et stratégies de monitoring en production."
publishedAt: 2026-05-07
modifiedAt: 2026-05-07
category: data
i18nKey: data-001-2026-05
tags: [server-side-gtm, conversion-api, cloud-run, event-deduplication, privacy-sandbox]
readingTime: 9
author: Roibase
---

La mesure basée sur le navigateur est morte. Les cookies tiers ont disparu, l'ITP s'est réduit à 12 heures, Consent Mode v2 est devenu obligatoire. Les marques qui ne envoient pas les événements directement aux endpoints API de Meta et Google via server-side se retrouvent dans l'obscurité totale en matière d'attribution. Server-side Google Tag Manager (sGTM) et la Conversion API ne sont plus optionnels en 2026 — c'est une exigence de production. Cet article explique comment déployer un container sGTM prêt pour la production sur Cloud Run à partir de zéro, configurer la déduplication d'événements et identifier les métriques critiques à monitorer.

## Pourquoi le Tagging Server-Side Nécessite un Container

La GTM JavaScript classique exécutée dans le navigateur charge une bibliothèque de scripts et collecte les données depuis l'user-agent. Server-side GTM fonctionne exactement à l'inverse : un container Node.js s'exécutant sur votre serveur reçoit des POST HTTP en provenance du client, enrichit les événements (parsing de l'IP, user-agent, ID first-party depuis les cookies) et les transmet aux API cibles (Meta CAPI, Google Ads Conversion, GA4 Measurement Protocol). Cette architecture apporte trois avantages fondamentaux : (1) tu contournes les restrictions du navigateur — pas d'ITP, pas d'adblocker, pas de CORS ; (2) tu contrôles le hachage des données personnelles — email et téléphone sont hachés en SHA-256 côté serveur, jamais renvoyés au navigateur ; (3) tu distribues un seul événement vers plusieurs plateformes en parallèle — un POST unique depuis le client déclenche 4 requêtes différentes en fan-out côté serveur.

Google recommande le déploiement via App Engine ou Cloud Run. App Engine offre un coût fixe et l'auto-scaling automatique, mais laisse peu de place à la personnalisation. Cloud Run est préféré car avec une instance minimale=1, tu garantis une latence stable 24/7 et peux personnaliser l'image container via un Dockerfile maison (par exemple, injection de secrets depuis des variables d'environnement ou des scripts de démarrage). L'alternative Cloudflare Workers déploie avec une latence plus faible au démarrage (~5ms contre 200ms), mais les limitations du sandbox Node.js rendent certains tags de GTM non fonctionnels (notamment les templates personnalisés qui nécessitent des modules natifs).

Le processus de déploiement comprend : (1) créer un nouveau projet dans Google Cloud Console, (2) utiliser `gcloud` CLI pour télécharger l'image container sGTM, (3) créer un service Cloud Run et configurer les variables d'environnement (`CONTAINER_CONFIG`, `PREVIEW_SERVER_URL`), (4) lier un domaine personnalisé (ex. `gtm.roibase.com.tr`) — essentiel pour la context first-party, (5) ajouter l'URL du serveur de tagging dans la GTM web (`serverContainerUrl`). Le premier déploiement prend 15 minutes, les suivants descendent à 2 minutes avec la CI/CD.

## Déduplication d'Événements : Lier le Signal Client et Serveur à un ID Unique

Le problème critique du server-side GTM est la déduplication. Si la même conversion est envoyée à la fois depuis le navigateur (tag GA4 client-side) et depuis le serveur (client GA4 server-side), la plateforme compte 2 conversions. Pour Meta CAPI et Google Ads Conversion, un système d'ID de déduplication d'événements est obligatoire. Fonctionnement : chaque événement reçoit un `event_id` unique (ou en terminologie Meta `event_name + event_id`), client et serveur envoient le même ID, et la plateforme supprime les doublons sur une fenêtre de 24 heures si elle détecte une collision d'ID.

Stratégies d'ID de déduplication :

| Méthode | Avantage | Risque |
|---------|----------|--------|
| UUID v4 (aléatoire) | Aucun risque de collision | Sync client-serveur requise (localStorage/cookie) |
| ID de transaction (e-commerce) | Naturellement unique | Absent pour les événements hors transaction (lead, signup) |
| Session ID + timestamp | Facile à générer | Chevauchement possible des sessions |
| `_ga` client ID + timestamp d'événement | Basé sur l'ID first-party | Risque de désynchronisation d'horloge client/serveur |

Configuration Roibase production : `SHA-256(_ga + event_name + unix_ms)` — lors du push dans le DataLayer côté navigateur, on remplit le champ `event_id` avec ce hash, le tag GA4 server-side lit le même champ et l'envoie au Measurement Protocol. Pour Meta CAPI, on injecte côté serveur les paramètres supplémentaires `event_source_url` et `action_source=website` car le Pixel Facebook client-side ne les envoie pas, mais ils sont obligatoires pour la validation server-side.

```javascript
// Exemple de push DataLayer (client-side)
window.dataLayer.push({
  event: 'purchase',
  event_id: sha256(_ga + 'purchase' + Date.now()),
  transaction_id: 'ORD-12345',
  value: 299.00,
  currency: 'EUR'
});
```

Dans le container server-side, on crée une variable personnalisée pour mapper `{{Event ID}}` vers les tags GA4 et CAPI. GA4 Measurement Protocol supporte le paramètre `&ep.event_id=`, Meta CAPI a un champ `event_id` au niveau racine. Pour Google Ads Conversion, la combinaison `gclid + conversion_action_id` fournit la déduplication — le `gclid` est lu depuis le cookie côté serveur, puis le tag Ads envoie `gclid + conversion_value` à la Conversion Tracking API.

## Templates de Container et Configuration Personnalisée du Client

Un container sGTM se compose de 3 éléments fondamentaux : **Client** (parse les requêtes HTTP entrantes et les transforme en objets événement), **Tag** (envoie l'événement à une API externe), **Variable** (partage les données entre les tags). Le client par défaut "GA4" de Google ne suffit pas car il n'écoute que l'endpoint `/g/collect`. On écrit un client personnalisé pour gérer à la fois GA4 et des endpoints personnalisés (`/event`, `/purchase`) dans le même container.

Exemple de template client personnalisé :

```javascript
const claimRequest = require('claimRequest');
const getRequestBody = require('getRequestBody');
const JSON = require('JSON');
const logToConsole = require('logToConsole');

claimRequest();

const body = getRequestBody();
const eventData = JSON.parse(body);

// Normaliser l'objet événement
const normalizedEvent = {
  event_name: eventData.event || 'unknown',
  user_data: {
    client_id: eventData.client_id,
    user_agent: eventData.user_agent,
    ip_override: eventData.ip_address
  },
  event_id: eventData.event_id,
  timestamp_micros: eventData.timestamp * 1000000
};

logToConsole('Normalized event:', normalizedEvent);
runContainer(normalizedEvent, () => {
  returnResponse();
});
```

Ce client capture les POST vers `/event`, analyse le body JSON et le transforme en modèle d'événement sGTM. L'appel `runContainer()` déclenche l'exécution des tags — quand le tag GA4 voit `event_name=purchase`, il envoie au Measurement Protocol ; quand le tag Meta CAPI détecte `user_data.email`, il le hache en SHA-256 et l'envoie à `/events`.

La configuration production exécute 4 clients : (1) client GA4 par défaut (`/g/collect`), (2) client JSON personnalisé (`/event`), (3) client Meta Pixel (`/tr/` endpoint — pour la compatibilité SDK Facebook), (4) client de contrôle de santé (`/health`) — la sonde liveness de Cloud Run teste cet endpoint pour vérifier l'état du container. Chaque client a un ordre de priorité — si deux clients prétendent au même chemin, celui avec la priorité la plus élevée gagne.

Maintenir les templates personnalisés sous contrôle de version est critique. Les modifications apportées dans l'interface web de Google Tag Manager ne sont pas enregistrées dans l'historique git. Notre workflow : stocker les templates dans le dépôt en tant que fichiers `.tpl`, utiliser `gtm-template-push` CLI dans la pipeline CI pour les déployer vers le workspace sGTM, les tester dans le container staging, puis les promouvoir en production. Ainsi, une régression se résout en un git revert unique.

## Monitoring Production : Quelles Métriques Sont Critiques

Après le déploiement du server-side GTM, ne reste pas dans l'obscurité — 4 couches de monitoring sont nécessaires : (1) santé du container (uptime, latence, taux d'erreur), (2) débit d'événements (événements/seconde, taux de succès des tags), (3) précision de la déduplication (delta entre comptage événements client et serveur), (4) validation de la plateforme en aval (Meta Event Quality Score, statut de suivi des conversions Google Ads).

Métriques natives de Cloud Run :

- **Request count** — nombre de POST vers `/event` par minute
- **Request latency (p50, p95, p99)** — la médiane au-dessus de 120ms indique un problème (normal 40-80ms)
- **Instance count du container** — si min=1, doit toujours être 1 ; se scale en cas de pics
- **Error rate (5xx)** — au-delà de 0,1% indique un problème récurrent dans les tags en aval

La Console sGTM propose un onglet "Logs" avec des logs de débogage au niveau événement, mais en production, `console.log` à chaque événement crée une surcharge I/O. Notre setup : active la journalisation de débogage uniquement si le paramètre `?gtm_debug=1` est présent ; en trafic production, c'est désactivé. Les erreurs critiques (tag HTTP 4xx/5xx) sont enregistrées dans Google Cloud Logging en tant que JSON structuré, déclenchant une policy d'alerte — par exemple, 10+ erreurs "Invalid access token" en 3 minutes depuis Meta CAPI déclenche une notification Slack.

Pour le monitoring du débit d'événements, on crée une métrique personnalisée : dans les tags sGTM, on ajoute un appel `sendHttpGet('https://metrics.roibase.com.tr/increment?metric=capi_event')`, le service de métrique maintient un compteur au format Prometheus. Ainsi, dans le dashboard Grafana, on voit en temps réel le flux d'événements — si GA4 client-side envoie 1000 événements/min mais CAPI serveur-side n'en reçoit que 850, c'est soit une collision d'ID de déduplication soit une perte réseau.

La validation de plateforme en aval est la partie la plus critique. Meta Events Manager propose un Event Match Quality (EMQ) score — en dessous de 6,5/10, c'est "faible qualité", indiquant un hachage incorrect ou des champs PII manquants. Google Ads Conversion Tracking doit afficher "Status: Eligible" — "Rarely used" ou "Below threshold" signifie volume insuffisant (minimum 15 conversions/30 jours). Dans GA4 DebugView, filtre les événements server-side avec `traffic_type=server_side`, puis compare la métrique `event_count` côté client — un écart supérieur à 20% justifie une investigation.

## Résolution d'Identité et Signaux de Correspondance Utilisateur

La puissance du server-side GTM réside dans la possibilité d'envoyer des signaux PII (Personally Identifiable Information) aux plateformes de manière contrôlée. Meta CAPI accepte 7 paramètres de correspondance utilisateur différents : `em` (hash email), `ph` (hash téléphone), `fn` (prénom), `ln` (nom de famille), `ct` (ville), `st` (région), `zp` (code postal), `country`, `external_id` (CRM ID). Plus tu envoies de signaux, plus le score EMQ grimpe — avec seulement `em`, tu obtiens 4,2/10 ; avec `em + ph + fn + ln`, tu montes à 7,8/10. Google Enhanced Conversions fonctionne de façon similaire : ajouter `sha256_email_address` et `sha256_phone_number` au tag Ads Conversion améliore la précision d'attribution de 40% (données de test bêta Google 2025).

Pipeline de résolution d'identité production Roibase : (1) l'utilisateur saisi email/téléphone dans le formulaire web, (2) JavaScript côté client hache en SHA-256 (jamais de texte brut dans le navigateur), (3) la valeur hachée est poussée dans le DataLayer, (4) sGTM récupère le hash et l'envoie à Meta CAPI comme `user_data.em`, et à Google comme `user_data.sha256_email_address`. Ce flux respecte RGPD/KVKK car aucune PII brute n'atterrit dans les logs serveur — SHA-256 est unidirectionnel, irréversible.

Signal additionnel : on lit les cookies `fbp` (Facebook Browser ID) et `fbc` (Facebook Click ID) côté serveur et les envoie à CAPI. Le cookie `fbp` est défini client-side par le Pixel, mais expire après 7 jours à cause de l'ITP ; on le relit côté serveur et le réécrire avec un TTL de 90 jours (contourner l'ITP car set depuis le domaine first-party). Le cookie `fbc` porte le `fbclid` query param depuis les annonces Facebook — parser cet ID côté serveur et l'ajouter au champ `fbc` de CAPI prolonge l'attribution Meta de 24 heures à 28 jours.

Le mécanisme Google `gclid` (Google Click ID) fonctionne de façon similaire. La GTM côté client lit `gclid` depuis l'URL, l'écrit dans le cookie `_gcl_aw`, TTL 90 jours. Le tag Ads serveur-side lit ce cookie et l'ajoute comme paramètre `gclid` à la Conversion Tracking API. La plateforme Google utilise la combinaison `gclid + conversion_action_id` comme clé unique — si tu envoies 2 conversions avec le même `gclid`, elle déduplique. Dans notre setup, si aucun cookie `gclid` n'existe (trafic direct), on utilise `_ga` client