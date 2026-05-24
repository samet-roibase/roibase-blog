---
title: "Server-Side GTM et Conversion API : De Zéro à la Production"
description: "Déploiement Cloud Run, template container, déduplication d'événements — comment nous avons construit la stack de mesure server-side en production, pièges rencontrés."
publishedAt: 2026-05-24
modifiedAt: 2026-05-24
category: data
i18nKey: data-001-2026-05
tags: [server-side-gtm, conversion-api, cloud-run, first-party-data, event-deduplication]
readingTime: 9
author: Roibase
---

Dépréciation des cookies, Consent Mode v2, ATT iOS — la surface de fiabilité de la mesure client-side s'est rétrécie chaque année. En 2024, Meta a dû accepter de voir %23 d'événements client-side en moins, et Google Analytics 4 a enregistré une baisse de %18 du nombre de sessions. La mesure server-side n'est plus l'« avenir », c'est désormais « obligatoire ». Chez Roibase, depuis fin 2025, nous déployons entièrement les nouveaux clients sur une stack sGTM + Conversion API. Dans cet article, nous partageons ce que nous avons appris lors du passage en production, pourquoi nous avons pris telles décisions et quels composants doivent absolument faire partie de votre stack.

## Où déployer le Container sGTM

Le Google Tag Manager Server Container peut s'exécuter sur App Engine, Cloud Run, Docker manuel, ou des solutions tierces. En 2026, deux options se démarquent : Cloud Run et Cloudflare Workers. App Engine est considéré comme legacy — pas de scaling automatique, cold start de 8+ secondes. Workers est moins cher mais l'intégration avec l'écosystème GTM nécessite des middlewares supplémentaires.

Nous avons choisi Cloud Run : l'image container officielle de GTM s'exécute directement, scaling horizontal automatique, cold start inférieur à 2 secondes. Le calcul du coût est important : 1M requêtes/mois + instance 512 Mo × 3 zones = ~$35/mois. Avec Cloudflare Workers, ce serait $5/mois, mais les outils de debug sont faibles et l'intégration des variables personnalisées doit être configurée manuellement.

Commande de déploiement :

```bash
gcloud run deploy sgtm-prod \
  --image=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable \
  --platform=managed \
  --region=europe-west1 \
  --memory=512Mi \
  --min-instances=1 \
  --max-instances=10 \
  --allow-unauthenticated \
  --set-env-vars="CONTAINER_CONFIG=$(cat container.json | base64)"
```

`min-instances=1` est critique — sur un site e-commerce, le time de spin-up d'une instance à partir de zéro peut faire perdre des conversions. Coût additionnel : +$8/mois, mais vous garantissez 100% de disponibilité. `container.json` est la configuration du container exportée depuis l'interface GTM — vous pouvez la synchroniser via CI/CD plutôt que manuellement.

Structure de sous-domaine : `sgtm.example.com` → IP Cloud Run. Nous n'utilisons pas de Load Balancer, l'IP anycast globale de Cloud Run suffit. SSL est automatique avec les certificats gérés par Cloud Run, prêt en 3 minutes.

## Déduplication d'Événements : Deux Signaux, Une Conversion

Le plus grand piège de la mesure server-side : la même conversion est envoyée à la fois depuis le navigateur et depuis le serveur, la plateforme la compte en double. Dans Meta Conversion API, le paramètre `event_id` résout ce problème — si le client et le serveur partagent le même ID, Meta nettoie la duplication dans une fenêtre de 28 heures.

Flux d'exemple : l'utilisateur complète une commande, le navigateur déclenche l'événement `purchase` dans GTM → Meta Pixel. Simultanément, le frontend poste vers notre endpoint `/api/track` → sGTM → Meta Conversion API. Les deux signaux transportent `event_id: order_12345_ts1716547200`.

```javascript
// Variable GTM côté client : event_id
function() {
  var orderId = {{Order ID}};
  var timestamp = Math.floor(Date.now() / 1000);
  return orderId + '_ts' + timestamp;
}
```

Dans sGTM, nous mappons le même `event_id` au tag Meta Conversion API. Important : la composante timestamp n'est pas obligatoire, mais elle prévient les collisions uniques — le même order_id peut être réutilisé dans des sessions différentes.

Pour Google Ads, c'est différent : le paramètre `gclid` suffit, pas de d'ID de déduplication supplémentaire. Mais dans Google Analytics 4, si vous envoyez à la fois `client_id` + `session_id` depuis le client et le serveur, GA4 exécute une dédup automatique — fonctionnalité ajoutée en 2024 Q3.

Validation de dédup : dans Meta Events Manager, le score « Event Match Quality » doit être supérieur à %80. Si ce score est bas — en particulier si les hashs `em` (email), `ph` (téléphone), `fn` (prénom) manquent — l'événement serveur est classé comme « low confidence » et la fiabilité du nettoyage de duplication s'en trouve réduite.

## Template Container : Quels Tags Doivent Être Inclus par Défaut

Le Google Tag Manager Server Container commence vide, il faut ajouter manuellement chaque tag. Après avoir construit 15+ containers, nous avons créé un repo template — un nouveau client passe en production en 5 minutes.

**Tags obligatoires :**
- **Meta Conversion API** (via Meta Business Extension)
- **Google Analytics 4** (avec client server-side)
- **Google Ads Conversion** (avec Enhanced Conversion)
- **Snapchat Conversion API** (pour les clients gaming/fashion)
- **TikTok Events API** (si ciblage Gen Z)

**Optionnels mais recommandés :**
- **Firestore/BigQuery log writer** — enregistrez chaque événement brut, critique pour la piste d'audit + la modélisation d'attribution
- **Variable de vérification du consentement** — parser la chaîne TCF 2.2 et vérifiez les consentements purpose 1 (stockage) et purpose 2 (mesure), si refus envoyez `action_source=physical_store` à Meta (ce n'est pas un bypass de consentement, juste un signal agrégé)
- **Enrichissement IP utilisateur** — extrayez `X-Forwarded-For` de l'en-tête de la requête Cloud Run, cela améliore la précision de la géolocalisation de Conversion API de %12

Structure exemple du repo template :

```
sgtm-template/
├── clients/
│   └── ga4-client.json
├── tags/
│   ├── meta-capi.json
│   ├── google-ads.json
│   └── bigquery-log.json
├── variables/
│   ├── event-id.json
│   ├── user-data.json
│   └── consent-status.json
└── triggers/
    ├── all-events.json
    └── conversion-only.json
```

Chaque fichier JSON est exporté depuis l'interface GTM — vous ne pouvez pas l'importer directement via CLI `gcloud`, mais vous pouvez l'automatiser avec des scripts en CI/CD. Il existe un provider Terraform pour GTM, mais c'est du community-maintained, pas officiel.

### Variable de Données Utilisateur : Envoi Sans Hachage

Meta et Google exigent que les PII (informations personnelles identifiables) soient hachées : email → SHA256, téléphone → format E.164 + SHA256. Dans GTM côté client, le hachage se fait en JavaScript, mais dans sGTM, c'est plus sûr côté serveur — il n'apparaît pas en texte brut dans les devtools du navigateur.

```javascript
// Variable personnalisée sGTM : hashed_email
const crypto = require('crypto');
const getEventData = require('getEventData');

const email = getEventData('user_data.email_address');
if (!email) return undefined;

return crypto.createHash('sha256')
  .update(email.toLowerCase().trim())
  .digest('hex');
```

Pour le téléphone, le format E.164 est : `+33612345678` (code pays + numéro). Dans les projets Roibase, %40 des données téléphoniques sont rejetées à cause d'erreurs de format — vous devez ajouter de la validation.

## Conversion API et Enhanced Conversion : Quelle est la Différence

Meta Conversion API et Google Enhanced Conversion sont des protocoles différents mais servent le même but : augmenter le taux d'appariement avec les données first-party. Conversion API fonctionne par événement — chaque clic, ajout au panier, achat est un POST HTTP séparé. Enhanced Conversion fonctionne par tag — les données utilisateur ne sont envoyées qu'au moment de la conversion (achat, inscription).

Configuration du tag sGTM pour Google Enhanced Conversion :

```json
{
  "type": "google_ads_remarketing",
  "enhancedConversionData": {
    "email": "{{Hashed Email}}",
    "phone": "{{Hashed Phone}}",
    "address": {
      "first_name": "{{Hashed First Name}}",
      "last_name": "{{Hashed Last Name}}",
      "country": "FR",
      "postal_code": "{{Postal Code}}"
    }
  }
}
```

Chez Meta, l'objet `user_data` est envoyé pour chaque événement — `ViewContent`, `AddToCart`, `Purchase`, tous avec le même hash.

Différence pratique : Google Enhanced Conversion n'agit que sur le pixel de conversion — si le trafic n'est pas énorme, le taux d'appariement reste faible. Meta CAPI reçoit les données utilisateur pour chaque événement, l'audience de retargeting devient plus riche. C'est pourquoi sur l'e-commerce, le setup de Meta CAPI est prioritaire, Google EC vient en second.

## Monitoring et Debug : Quelles Métriques Surveiller

Avec une stack server-side en production, le monitoring est indispensable. Il n'y a pas de mode prévisualisation côté server-side comme avec GTM côté client — vous débuguez sur le trafic en direct.

**Métriques critiques :**
- **Nombre d'instances Cloud Run** — même si min=1, le trafic en pics peut monter à 10 instances, mettez des alertes pour contrôler les coûts
- **Temps de réponse P95** — au-delà de 500ms, les conversions commencent à être perdues, surtout sur la page de paiement
- **Score Meta Event Match Quality** (vérification manuelle depuis Events Manager) — en dessous de %80, cela signifie que les données utilisateur manquent
- **Ratio count événement serveur / événement client** (depuis GA4) — idéalement entre 1.1 et 1.3 (le serveur en voit un peu plus, les blocages côté client expliquent la différence), en dessous de 0.8 il y a une erreur serveur

Requête Cloud Logging :

```sql
resource.type="cloud_run_revision"
resource.labels.service_name="sgtm-prod"
jsonPayload.event_name="purchase"
severity="ERROR"
```

Les logs d'erreur ne s'écrivent pas via `console.log` dans GTM — vous devez utiliser l'API `logToConsole()`, qui écrit dans Cloud Logging.

Schéma de table BigQuery pour les logs :

| Champ | Type | Description |
|---|---|---|
| event_timestamp | TIMESTAMP | Heure serveur (UTC) |
| event_name | STRING | purchase, add_to_cart, etc. |
| user_id | STRING | Haché |
| client_id | STRING | ID client GA4 |
| event_id | STRING | ID déduplication |
| platform | STRING | meta, google_ads, snapchat |
| response_code | INTEGER | Statut HTTP |

Cette table s'inscrit dans le contexte de [Stratégie de Données First-Party et Architecture de Mesure](https://www.roibase.com.tr/fr/firstparty), elle est écrite dans le data warehouse BigQuery et liée via dbt à des modèles en aval (attribution, prédiction LTV).

## Consent Mode v2 et Server-Side : Comment Intégrer

Depuis mars 2024, Google Consent Mode v2 est obligatoire en EEA — le statut de consentement `ad_storage` et `analytics_storage` doit être envoyé à chaque hit. Server-side, cette information ne vient pas de GTM côté client, vous devez l'envoyer manuellement.

Deux méthodes :
1. **Query parameter :** `sgtm.example.com/g/collect?consent=granted` — facile mais visible dans l'URL, problèmes de cache
2. **En-tête HTTP :** `X-Consent-Status: analytics_storage=granted,ad_storage=denied` — méthode recommandée

Variable personnalisée dans sGTM :

```javascript
const getRequestHeader = require('getRequestHeader');
const consentHeader = getRequestHeader('x-consent-status');

if (!consentHeader) return {analytics_storage: 'denied', ad_storage: 'denied'};

const pairs = consentHeader.split(',');
const consent = {};
pairs.forEach(pair => {
  const [key, value] = pair.split('=');
  consent[key.trim()] = value.trim();
});

return consent;
```

Vous mappez cette variable aux tags GA4 et Google Ads. Pour Meta CAPI, il n'y a pas de paramètre de consentement — le contrôle est indirect via `action_source` : `action_source=website` signifie consentement accordé, `action_source=physical_store` signifie mode agrégé (pas de consentement, mais comptabilisé comme attribuable hors ligne).

## Ce Qu'il Faut Tester la Première Semaine

Lors du passage en production, l'exécution parallèle est obligatoire : les pixels côté client ne s'arrêtent pas, server-side fonctionne en parallèle. Surveillez les deux pendant deux semaines, puis éteignez côté client.

**Checklist de test :**
- [ ] Le nombre d'événements dans Meta Events Manager est-il ±%10 du nombre côté client
- [ ] Y a-t-il une baisse du nombre de sessions dans GA4 (server-side devrait en voir plus)
- [ ] Le nombre de conversions dans Google Ads a-t-il changé (Enhanced Conversion attendu +%8-15)
- [ ] Le coût de Cloud Run a-t-il dépassé $50/mois (normal $30-40/mois pour 1M événements)
- [ ] La dédup fonctionne-t-elle — Events Manager ne montre-t-il pas d'avertissement d'événement dupliqué
- [ ] Le nombre d'événements quotidiens dans la table BigQuery correspond-t-il aux données frontend analytics

Les premiers problèmes qui surgiront la première semaine : erreurs de format dans le hachage de données utilisateur (%30-