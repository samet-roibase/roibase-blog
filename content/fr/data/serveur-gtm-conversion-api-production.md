---
title: "GTM côté serveur et API de conversion : de zéro à la production"
description: "Guide de mise en place d'une infrastructure de mesure côté serveur sur Cloud Run ou Workers. Template de conteneur, logique de dédupla et checklist production."
publishedAt: 2026-06-28
modifiedAt: 2026-06-28
category: data
i18nKey: data-001-2026-06
tags: [server-side-gtm, conversion-api, cloud-run, container-deduplication, first-party-data]
readingTime: 9
author: Roibase
---

À l'heure où l'ère des cookies s'éteint, si votre infrastructure de mesure fonctionne encore dans un conteneur web, vous avez accepté les pertes d'attribution. Les chiffres de ROAS Facebook en baisse de 30 à 40 % depuis iOS 14.5 ne sont pas un hasard — c'est la preuve que le tagging côté client ne reflète plus la réalité. Le tagging côté serveur et l'API de conversion sont devenus le nouveau standard, permettant de transmettre ces signaux à la plateforme indépendamment des restrictions du navigateur. Dans cet article, nous construisons une infrastructure GTM côté serveur prête pour la production, de zéro à la mise en ligne, sur Google Cloud Run ou Cloudflare Workers.

## Où s'arrête le tagging côté client, où commence le côté serveur

Le Google Tag Manager fonctionnant dans un conteneur web exécute JavaScript dans le navigateur du visiteur. Dans ce scénario, chaque pixel, chaque SDK de plateforme envoie des requêtes depuis l'IP du client. Avec Safari ITP 2.0, la durée de vie des cookies first-party a chuté à 7 jours, et avec Consent Mode v2, le taux de refus a atteint 60 %. Quand le navigateur supprime ces cookies, l'API de la plateforme perd l'identité — le signal de conversion devient orphelin, l'attribution s'effondre.

Le GTM côté serveur inverse cette logique. Le conteneur web collecte un minimum de données auprès du visiteur (nom d'événement, user-agent, IP), puis envoie ces données en POST vers votre propre serveur. Le conteneur GTM exécuté dans votre serveur (image Docker) reçoit cet événement, l'enrichit et l'envoie à l'API de la plateforme via une connexion serveur-à-serveur. Dans ce flux, les cookies ne sont pas stockés dans le navigateur mais sur votre serveur — vous contrôlez leur durée de vie, les bloqueurs de publicités sont contournés. L'API de conversion Meta ou le protocole de mesure de Google Analytics 4 sont alimentés directement depuis votre serveur — la perte de données passe de 60 % à 10-15 %.

Cette différence exige une profondeur technique. Le choix du fournisseur cloud, la version du conteneur, la stratégie de déduplication, le schéma de mappage des événements — tout est critique. Construisons cela maintenant.

## Mettre en place un conteneur côté serveur sur Google Cloud Run

Google Cloud Run est un runtime de conteneur serverless. Il construit une image à partir d'un Dockerfile, scale à la demande et descend à zéro en inactivité. Ce n'est pas la méthode officielle de déploiement pour GTM côté serveur (App Engine ou GCE manuel sont préférés), mais Cloud Run offre un avantage coût — pour 5 à 10 millions d'événements par mois, vous payez ~$10-20 au lieu de $30-50.

La première étape est d'ouvrir un nouveau projet dans Google Cloud Console. Si vous avez la CLI `gcloud` installée, la ligne de commande est plus rapide :

```bash
gcloud projects create roibase-sgtm-prod --name="Roibase sGTM Production"
gcloud config set project roibase-sgtm-prod
gcloud services enable run.googleapis.com containerregistry.googleapis.com
```

Dans Google Tag Manager, créez un conteneur de type **Serveur**. Dans Paramètres > Configuration du conteneur, notez l'**URL du serveur de tagging** (par exemple, `https://sgtm.roibase.io`). Ce domaine personnalisé pointera vers votre service Cloud Run.

L'image officielle Google `gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable` est sûre pour la production mais n'a pas de verrouillage de version. Notre approche consiste à écrire notre propre Dockerfile en fixant l'image de base :

```dockerfile
FROM gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable

ENV CONTAINER_CONFIG="<GTM container ID>"
ENV PREVIEW_SERVER_URL="https://sgtm-preview.roibase.io"

EXPOSE 8080

CMD ["/bin/sh", "-c", "/app/start_server"]
```

Déployez cette image sur Cloud Run :

```bash
gcloud builds submit --tag gcr.io/roibase-sgtm-prod/sgtm-container
gcloud run deploy sgtm-service \
  --image gcr.io/roibase-sgtm-prod/sgtm-container \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars CONTAINER_CONFIG=GTM-XXXXXX
```

Pour ajouter un domaine personnalisé au service Cloud Run, allez dans Cloud Run > Mappages de domaines > Ajouter un mappage. Dans votre fournisseur DNS, ajoutez un enregistrement CNAME (`sgtm.roibase.io` → URL Cloud Run). Le certificat SSL est provisionné automatiquement (Let's Encrypt).

### Alternative Cloudflare Workers

Si vous voulez rester en dehors de l'écosystème Google, Cloudflare Workers est plus flexible. L'image du conteneur GTM Server ne fonctionne pas sur Workers, mais vous pouvez écrire un proxy de tagging personnalisé. Le script suivant fait proxy de tous les événements GTM et les transmet au protocole de mesure GA4 :

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  if (url.pathname === '/gtm') {
    const payload = await request.json()
    const measurementId = 'G-XXXXXXXXXX'
    const apiSecret = 'YOUR_API_SECRET'
    
    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: 'POST',
        body: JSON.stringify({
          client_id: payload.client_id,
          events: [{ name: payload.event_name, params: payload.event_params }]
        })
      }
    )
    return new Response('OK', { status: 200 })
  }
  return new Response('Not Found', { status: 404 })
}
```

Le runtime Workers démarre en moins de 50 ms, tandis que le cold start de Cloud Run est de 2-3 secondes. Cependant, Workers n'a pas le Visual Tag Builder de GTM — vous devez coder chaque balise de plateforme. Pour l'instant, Cloud Run est plus pratique.

## Déduplication d'événements : ne pas compter deux fois la même conversion

Lors du passage au tagging côté serveur, les conteneurs web et serveur fonctionnent en parallèle. Un visiteur effectue un achat → le pixel Facebook côté client se déclenche → le conteneur côté serveur reçoit également le même événement de purchase → l'API Facebook le voit deux fois. Le ROAS gonfle à 200 %, l'optimiseur de budget reçoit un mauvais signal.

La solution : la déduplication des événements. Attribuez à chaque conversion un `event_id` unique, envoyez le même ID depuis le client et le serveur. L'API Meta ignore le deuxième événement avec le même `event_id`. La fenêtre de déduplication est de 48 heures (par défaut).

Dans la balise Facebook du conteneur web de GTM, ajoutez le paramètre `event_id` :

```javascript
fbq('track', 'Purchase', {
  value: 99.99,
  currency: 'TRY'
}, {
  eventID: '{{Transaction ID}}_{{Random Number}}'
});
```

Dans le conteneur côté serveur, mappez le même `event_id` en tant que variable définie par l'utilisateur dans la balise API de conversion Meta. GTM n'a pas de variable `Event ID` intégrée — vous devez en créer une manuellement. Choisissez le type de variable Data Layer, nommez-la `event_id`, avec une valeur par défaut `{{Page Path}}_{{Random Number}}`.

Pour Google Analytics 4, c'est différent. GA4 fusionne déjà les événements côté client et Measurement Protocol (s'ils ont le même `client_id` et `session_id`). Pas de déduplication supplémentaire nécessaire, mais la cohérence du `client_id` est essentielle. Dans la configuration de la balise GA4 du conteneur web, sélectionnez **Envoyer les données fournies par l'utilisateur**, et mappez `client_id` à la variable GTM `{{GA Client ID}}`. Utilisez la même valeur dans le conteneur côté serveur.

Testez cette logique en mode Preview avant la production. Dans le conteneur serveur GTM, créez une URL de preview, ciblez-la depuis le conteneur web. Dans Chrome DevTools > onglet Network, inspectez les requêtes POST vers l'endpoint `/gtm` — les champs `event_id` et `client_id` doivent être présents dans les deux payloads (client et serveur).

## Cookies first-party et stitching de session

La force de la mesure côté serveur réside dans la consolidation de l'identité utilisateur via des cookies first-party. Le conteneur web maintient le cookie `_ga` pendant 2 ans, mais Safari le raccourcit à 7 jours. Le conteneur côté serveur peut définir son propre cookie (par exemple, `_sgtm`) via l'en-tête `Set-Cookie` — étant donné que le match de sous-domaine fonctionne, il contourne l'ITP.

Dans le conteneur serveur GTM, sous la section **Client**, sélectionnez le type de client **Google Analytics: GA4**. Ce client extrait `client_id` de la requête HTTP entrante et l'écrit dans le cookie `_ga`. Cependant, ce cookie est ajouté à l'en-tête de réponse et non au navigateur — pour que le navigateur le voie, vous devriez faire une redirection GET depuis le conteneur web vers le serveur (compliqué).

Une approche plus simple : ajoutez `client_id` au DataLayer depuis le conteneur web, laissez le conteneur côté serveur le capturer et le stocker dans votre propre base de données. Par exemple, une table BigQuery `user_sessions` :

```sql
CREATE TABLE analytics.user_sessions (
  client_id STRING,
  session_id STRING,
  first_visit_timestamp TIMESTAMP,
  last_event_timestamp TIMESTAMP,
  device_category STRING,
  geo_country STRING
);
```

Chaque événement côté serveur entrant est fusionné avec cette table. Si le même `client_id` apparaît dans des sessions différentes, vous pouvez faire une résolution d'identité — [l'architecture de mesure et de données first-party](https://www.roibase.com.tr/fr/firstparty) approfondit le design de schéma nécessaire pour ce type de stitching cross-session.

### User-Agent Client Hints et enrichissement IP

Le conteneur côté serveur extrait le user-agent et l'IP de l'en-tête de requête du client. Cependant, depuis Chrome 110, la chaîne User-Agent est gelée — les données détaillées du navigateur/OS se trouvent maintenant dans **User-Agent Client Hints** (UA-CH). Vous devez parser ces hints dans votre conteneur serveur.

Dans le conteneur GTM côté serveur, définissez une variable JavaScript personnalisée :

```javascript
function() {
  const headers = getAllEventData().headers || {};
  const uach = {
    brand: headers['sec-ch-ua'],
    mobile: headers['sec-ch-ua-mobile'],
    platform: headers['sec-ch-ua-platform']
  };
  return uach;
}
```

Transmettez cette donnée au champ `user_data.client_user_agent` de l'API de conversion Meta. Pour l'enrichissement IP, utilisez la base de données MaxMind GeoIP2 (montez-la sur votre instance Cloud Run). Alternative : l'API de géolocalisation IP intégrée de Google Cloud (payante).

## Checklist production : rate limiting, monitoring, fallback

Avant de mettre le conteneur côté serveur en production, les vérifications suivantes sont obligatoires :

**1. Rate limiting :** Les API de plateforme imposent des limites de requêtes par seconde (API de conversion Meta 200 req/s, protocole de mesure GA4 1000 req/s). Dans les paramètres **Client** du conteneur GTM, définissez la valeur de throttle. Limitez le nombre maximum d'instances Cloud Run (`--max-instances 5`).

**2. Gestion des erreurs et retry :** Si une balise côté serveur reçoit HTTP 500, mettez en place une logique de retry. GTM n'a pas de retry intégré — vous devez écrire un modèle de balise personnalisé. Si l'API Meta retourne 429 (Too Many Requests), appliquez un backoff exponentiel.

**3. Monitoring :** Les logs de Cloud Run vont dans Stackdriver. Utilisez `gcloud logging read` pour identifier les patterns d'erreur. Métriques critiques : latence des requêtes (p95 < 500ms), taux d'erreur (< 1 %), utilisation mémoire du conteneur (512MB par défaut, 1GB idéal).

**4. Mécanisme de fallback :** Si le conteneur serveur tombe en panne, le conteneur web continue à envoyer des pixels. Cependant, les événements serveur uniquement (dénouements backend) seront perdus. Pour le fallback, écrivez les événements dans Pub/Sub et rejouez-les depuis la dead-letter queue.

**5. Intégration de Consent Mode v2 :** Le conteneur serveur GTM ne peut pas lire le signal du CMP (il s'exécute côté client). Écrivez l'état du consentement dans le DataLayer depuis le conteneur web (`ad_storage: 'denied'`), que le conteneur côté serveur lira pour exécuter les balises de plateforme conditionnellement.

Métriques de la première semaine en production :

| Métrique | Cible | Surveillance |
|----------|-------|--------------|
| Taux de livraison d'événements | > 98% | Logs Cloud Run |
| Précision de déduplication | < 2% de doublons | Dashboards de plateforme |
| Latence p95 | < 500ms | Cloud Monitoring |
| Coût par 1M d'événements | < $5 | Facturation GCP |

## Ce qu'il faut faire maintenant

Une infrastructure GTM côté serveur est mise en place une fois et optimisée en continu. Le premier pas est d'auditer votre conteneur web actuel — quelles balises doivent rester côté client (outils de test A/B), lesquelles peuvent être déplacées côté serv