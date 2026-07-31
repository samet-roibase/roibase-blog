---
title: "Server-Side GTM et Conversion API : De zéro à la production"
description: "Guide pratique pour déployer un conteneur sGTM sur Cloud Run, intégrer la Meta Conversion API et améliorer la qualité des mesures avec la déduplication d'événements."
publishedAt: 2026-07-31
modifiedAt: 2026-07-31
category: data
i18nKey: data-001-2026-07
tags: [server-side-gtm, conversion-api, cloud-run, event-deduplication, measurement]
readingTime: 9
author: Roibase
---

Le calendrier de dépréciation des cookies a été reporté une troisième fois en 2024. Mais le véritable point de rupture dans la mesure marketing a déjà eu lieu : après iOS 14.5 et l'ATT, les taux de conversion du pixel Facebook ont chuté de 30-40%, l'assemblage de sessions dans Google Analytics s'est fragmenté, les fenêtres d'attribution se sont rétrécies de 7 jours à 1 jour. La mesure côté serveur n'est plus « l'avenir » — c'est la seule solution d'ingénierie pour combler le fossé d'attribution. Dans cet article, nous expliquons étape par étape comment déployer un conteneur Google Tag Manager côté serveur (sGTM) sur Google Cloud Run, l'intégrer à la Meta Conversion API (CAPI), mettre en place la déduplication d'événements et le rendre prêt pour la production.

## L'anatomie de la mesure côté serveur

Les pixels côté client s'exécutent dans le navigateur — dès que l'utilisateur charge la page, le code JavaScript collecte l'événement et l'envoie à la plateforme. Ce processus comporte trois points de rupture : les bloqueurs de publicités (actifs chez 40% des utilisateurs), les mécanismes de protection du navigateur comme ITP/ETP (Safari offre un cycle de vie des cookies de 7 jours), et le refus au niveau de la banneau de consentement (30-50% de taux de refus RGPD en Europe). Le flux côté serveur contourne ces ruptures parce que les événements proviennent de votre propre serveur, pas du navigateur de l'utilisateur — le signal de consentement est mesuré, le cookie propriétaire est lu, la résolution d'identité est effectuée, et les paquets de données enrichis sont POST via HTTPS vers les API des plateformes.

sGTM standardise cette architecture. Les tags définis dans le Web Container (GA4, Meta Pixel) se déclenchent dans le navigateur, mais au lieu d'envoyer l'événement directement à la plateforme, il est acheminé vers votre endpoint sGTM. Le Server Container reçoit cet événement, extrait les paramètres user_data (email, téléphone, IP du client, user agent), les hache et les alimente au tag Meta CAPI. Pour la déduplication, un event_id est généré et envoyé à la fois via le pixel et la CAPI — le backend Meta traite le même event_id comme une seule conversion, ce qui élimine les doubles comptages. Cette architecture peut augmenter les valeurs Facebook ROAS de 30-40% de baisse à 15-20% (données de référence Meta 2023).

Le deuxième grand avantage du côté serveur est de libérer votre fenêtre d'attribution des limites du navigateur. Sur Safari, ITP empêche l'utilisation de cookies de 7 jours — si un utilisateur revient le 8ème jour et effectue un achat, le pixel côté client ne peut pas mesurer cette conversion. Côté serveur, le cookie propriétaire (par exemple `_fbc`, `_fbp`) est conservé sur votre propre domaine et a une durée de vie de 1-2 ans. Vous pouvez même effectuer une résolution d'identité côté serveur à l'aide de votre ID CRM. Cela fonctionne main dans la main avec la [discipline architecturale de données propriétaires](https://www.roibase.com.tr/fr/firstparty) — vous fusionnez l'ID client, l'ID utilisateur et le hash de l'email en un seul profil.

## Déploiement d'un conteneur sGTM sur Cloud Run

Google Cloud Run est le chemin le plus rapide pour héberger un conteneur sGTM car il existe une image de conteneur pré-construite, l'autoscaling est intégré et le temps de démarrage à froid est faible (100-200 ms). Les alternatives pourraient être Cloud App Engine ou Kubernetes, mais du point de vue du ROI, Cloud Run est optimal — pour 100 K événements par mois, le coût s'élève à environ 10-15$ (calcul Cloud Run + stockage d'état Firestore).

**Étape 1 : Créer un projet GCP et activer la facturation.** Dans la Console, créez un nouveau projet et associez un compte de facturation. Configurez la CLI locale avec `gcloud init`.

**Étape 2 : Créer un conteneur serveur sGTM.** Dans Tag Manager UI, créez un nouveau conteneur de type « Serveur ». En haut à droite, sélectionnez « Configurer manuellement le serveur de tagging » — cela vous permet d'utiliser votre propre endpoint Cloud Run au lieu d'App Engine automatisé.

**Étape 3 : Déployer le service Cloud Run.**

```bash
gcloud run deploy sgtm-prod \
  --image=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable \
  --platform=managed \
  --region=europe-west1 \
  --allow-unauthenticated \
  --set-env-vars=CONTAINER_CONFIG=<server_container_config_string>
```

La chaîne `CONTAINER_CONFIG` est copiée depuis l'interface Tag Manager (Paramètres → Configuration du conteneur). Le drapeau `--allow-unauthenticated` est important — les clients web doivent pouvoir accéder à ce endpoint. La région `europe-west1` assure la conformité RGPD avec la résidence des données en Europe.

**Étape 4 : Configurer un domaine personnalisé.** Cloud Run vous fournit un domaine `*.run.app`, mais il est considéré comme tiers par certains navigateurs. Utilisez un sous-domaine de votre propre domaine (par exemple `gtm.roibase.com.tr`). Dans Cloud Run → Domain Mappings, configurez l'enregistrement DNS — redirection CNAME vers l'endpoint Cloud Run + certificat SSL automatique via Let's Encrypt.

**Étape 5 : Stockage d'état Firestore.** sGTM utilise Firestore pour le stockage d'état côté serveur (par exemple, pour conserver les cookies côté client revendiqués). Activez Firestore dans le même projet GCP, créez une base de données dans la région `europe-west1`. Aucun code supplémentaire n'est nécessaire — le conteneur sGTM le découvrira automatiquement.

Après le déploiement, l'appel `curl https://gtm.roibase.com.tr/healthz` devrait retourner `200 OK`. Vérifiez les logs avec `gcloud run logs read sgtm-prod` — toute erreur d'analyse `CONTAINER_CONFIG` s'affichera ici.

## Intégration de la Meta Conversion API et déduplication

Dans le Server Container, créez un nouveau tag « Facebook Conversion API » (sélectionnez-le dans Tag Templates ou utilisez « Facebook Conversions API by Stape » de la Community Template Gallery — plus flexible). La configuration de base du tag :

**Mappage des noms d'événements :** Mappez `event_name` provenant du Web Container aux événements standards de Meta (purchase → Purchase, page_view → PageView). Vous pouvez envoyer un nom d'événement personnalisé au lieu de `event_name`, mais utiliser un événement standard est plus propre pour la dédup avec le pixel Facebook.

**Paramètres de données utilisateur :** Meta CAPI nécessite obligatoirement `em` (email), `ph` (téléphone), `client_ip_address`, `client_user_agent`. sGTM les lit automatiquement à partir des en-têtes de requête. L'email/téléphone doit être envoyé depuis le client web — par exemple, ajoutez-le à la dataLayer :

```javascript
window.dataLayer.push({
  event: 'purchase',
  transaction_id: 'T12345',
  value: 99.90,
  currency: 'USD',
  user_email: 'user@example.com'
});
```

Dans le Tag Template, mappez `user_email` → `em`. sGTM hache cet email en SHA256 et l'envoie à Meta (n'envoyez jamais de texte en clair — violation RGPD/KVKK).

**Déduplication d'événements :** Ajoutez le paramètre `eventID` au tag pixel Facebook côté client. Envoyez également cet ID au côté serveur. Dans le tag CAPI sGTM, utilisez le même `event_id`. Le backend Meta traite la même combinaison `event_id` + `event_name` au cours des 48 prochaines heures comme une seule conversion, ce qui empêche le double comptage.

Exemple de code pixel côté client :

```javascript
fbq('track', 'Purchase', {
  value: 99.90,
  currency: 'USD'
}, {
  eventID: 'T12345-1627384912'  // transaction_id + Unix timestamp
});
```

Dans le Tag côté serveur, mappez le paramètre `event_id` à `{{event.event_id}}` (Event Data → champ event_id). De cette façon, à la fois le pixel et la CAPI envoient le même event_id — le double comptage tombe à 0%.

**Test :** Accédez à Meta Events Manager → Test Events, obtenez le code d'événement de test, ajoutez le paramètre `test_event_code` au tag sGTM. Déclenchez la page et voyez si l'événement arrive dans Events Manager. Pour la déduplication, déclenchez à la fois l'événement pixel et CAPI en même temps — vous devriez voir « Deduplicated » dans la colonne « Deduplication » du Events Manager.

## Checklist prête pour la production et surveillance

Avant de mettre en production, vérifiez 5 points critiques :

**1. Intégration du Consent Mode v2.** Pour la conformité RGPD/KVKK, le Google Consent Mode v2 (obligatoire depuis mars 2024). Configurez l'intégration CMP (Consent Management Platform) dans le Web Container, pushez l'état de consentement de l'utilisateur (`ad_storage`, `analytics_storage`) dans la dataLayer. sGTM peut lire cet état de consentement et filtrer l'événement — par exemple, si `ad_storage: denied`, ne pas déclencher le tag Meta CAPI ou envoyer uniquement un événement agrégé (sans user_data).

**2. Limitation de débit.** Cloud Run concurrence par défaut de 80 requêtes/conteneur. Lors de pics de trafic instantanés (Black Friday par exemple), vous pourriez dépasser la limite de débit. Réglez `--max-instances` entre 10 et 20, Cloud Run scale automatiquement. Pour contrôler les coûts, définissez une limite `--max-instances` — une scale incontrôlée peut générer une facture de 1000$+.

**3. Enregistrement des erreurs et alertes.** sGTM n'a pas de mécanisme de logging natif — les logs écrits sur stdout/stderr dans Cloud Run vont à Cloud Logging. Pour capturer les erreurs HTTP 400/500 retournées par la Meta CAPI, enregistrez la réponse `fetch()` dans un Custom Tag Template. Dans Cloud Logging → Log-based Metrics, créez une métrique « capi_error_rate », configurez une alerte dans Cloud Monitoring (seuil : 5 erreurs/min et plus).

**4. Optimisation de la latence.** Le temps de réponse sGTM affecte le temps de chargement des pages web. Le démarrage à froid de Cloud Run est 100-200 ms, une instance chaude 10-20 ms. Gardez au minimum 1 instance active (`--min-instances=1`) — évitez les démarrages à froid mais le coût inactif est $5-10/mois. Alternativement : Cloud Run → CPU allocation sélectionnez « CPU is always allocated » — l'instance consomme du CPU même inactif, pas de démarrage à froid.

**5. GA4 côté serveur + CAPI en même temps.** Migrez aussi GA4 vers le côté serveur — le tag GA4 Server-Side est intégré à sGTM. Le même événement peut aller à la fois vers GA4 et CAPI. Attention : le `client_id` de GA4 + le `fbp` de CAPI sont lus à partir de cookies différents. Pour la résolution d'identité, envoyez `user_id` dans la dataLayer et utilisez-le dans GA4 et CAPI — cela assure la cohérence de l'attribution cross-plateforme.

Pendant la première semaine en production, consultez quotidiennement Events Manager : taux de correspondance (correspondance email/téléphone), nombre d'événements (ratio client vs serveur), taux de déduplication. Benchmark Meta : 60-70% des événements côté serveur doivent trouver une correspondance user_data (si l'email est hashé). Si le taux de correspondance est inférieur à 30%, la qualité des user_data est faible — normalisez l'email (minuscules + trim) ou envoyez le numéro de téléphone au format E.164.

## Les couches stratégiques de la mesure côté serveur

sGTM n'est pas simplement un conteneur technique, c'est une décision architecturale concernant les données marketing. La première couche est l'enrichissement des événements — côté serveur, vous pouvez enrichir les données avec vos données CRM (lecture LTV des clients depuis BigQuery, ajout d'informations de marge du catalogue de produits). Par exemple, vous pouvez ajouter un paramètre `customer_ltv` à l'événement d'achat pour alimenter le seed d'audience lookalike de Meta basé sur la valeur.

La deuxième couche est l'orchestration multi-plateforme. À partir du même conteneur sGTM, vous pouvez envoyer le même événement à Meta CAPI, Google Ads Enhanced Conversions, TikTok Events API, Snapchat CAPI. Chaque plateforme utilise des règles de matching user_data différentes (TikTok phone hash SHA256, Google email SHA256 + trim) — configurez cette normalisation dans les Tag Templates.

La troisième couche est la mesure de l'incrémentalité. Vous pouvez tester A/B les événements côté serveur avec des splits contrôle/traitement — par exemple, ne pas envoyer d'événements CAPI à 10% du trafic et mesurer le lift. Ce type de test s'intègre à la discipline [analyse des données et ingénierie des insights](https://www.roibase.com.tr/fr/verianalizi) — vous construisez un modèle causal impact dans BigQuery et calculez l'incrémentalité.

Le coût de sGTM est la somme du calcul cloud + du stockage d'état. Pour 1M d'événements/mois, comptez $50-70 pour Cloud Run, $10-15 pour Firestore. En ret