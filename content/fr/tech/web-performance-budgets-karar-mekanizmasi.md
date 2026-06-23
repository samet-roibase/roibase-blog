---
title: "Web Performance Budgets : Les Intégrer aux Mécanismes de Décision"
description: "Intégrez Lighthouse CI, RUM et les alertes de régression de performance au système. La méthodologie derrière la réduction du TBT de 2190ms à 200ms."
publishedAt: 2026-06-23
modifiedAt: 2026-06-23
category: tech
i18nKey: tech-004-2026-06
tags: [web-performance, lighthouse-ci, rum, core-web-vitals, performance-budget]
readingTime: 9
author: Roibase
---

En 2026, la performance web n'est plus « faire une page rapide » — c'est une discipline d'ingénierie où des décisions sont prises en continu. Vous déployez un site e-commerce, le score Lighthouse chute de 92 à 68, le taux de conversion passe de 3,2 % à 2,7 % — mais personne ne le remarque parce que le monitoring se limite à « le serveur est-il down ? ». Lier un performance budget au mécanisme décisionnel signifie attraper les régressions avant le déploiement, évaluer chaque commit par rapport aux seuils LCP/TBT/CLS, et alimenter votre pipeline d'attribution avec les données RUM. Cet article montre comment intégrer Lighthouse CI, le monitoring synthétique, RUM et l'architecture d'alertes dans un système unifié.

## Qu'est-ce qu'un Performance Budget et Pourquoi c'est un Système qui doit le Mesurer, Pas un Humain

Un performance budget définit des seuils numériques de ressources par page : taille JavaScript maximale (par ex. 200 KB gzippé), TBT maximal (Total Blocking Time, 200 ms), LCP maximal (Largest Contentful Paint, 2,5 secondes). Ces chiffres ne sont pas arbitraires — les seuils Core Web Vitals de Google définissent la bande « bon », mais vous devez en dériver des limites plus strictes à partir des données de votre funnel de conversion sectoriel.

Le scénario classique « Lighthouse 95 en dev, 72 en production » se produit pour ces raisons : un test synthétique s'exécute en laboratoire (Fast 4G, cache vide, chargement de page unique), tandis que RUM teste le vrai utilisateur avec son 3G, son cache rempli, ses chemins de navigation réels. La différence entre les deux est normale, mais les deux doivent être surveillés. Lighthouse CI détecte les régressions de bundle size à chaque PR ; RUM montre la réalité production : « 22 % des utilisateurs mobiles ont un LCP dépassant 4 secondes ». Si vous définissez le budget uniquement comme « dépasser un score de 75 », vous pouvez ajouter 100 KB au bundle et augmenter le score de 74 à 76 — la page s'alourdit, mais le score est vert. C'est pourquoi vous devez maintenir des budgets *par métrique* (LCP, TBT, CLS) *et* par ressource (JS, CSS, image en MB).

Un autre point : pour enforcer le budget, la review humaine ne suffit pas. « On regarde la performance en code review » ne tient pas à l'échelle avec 20 PR/jour. Le système doit mesurer, le système doit échouer, les humains doivent seulement enquêter sur pourquoi.

## Lighthouse CI : Gating de Performance par Commit

Lighthouse CI exécute un audit Lighthouse automatiquement sur chaque commit ou PR et rapporte les résultats à GitHub ou à votre dashboard interne. Intégrez-le à votre pipeline CI comme ceci :

```yaml
# .github/workflows/lighthouse-ci.yml
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci && npm run build
      - name: Run Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

Dans votre config `.lighthouserc.json`, définissez les budgets :

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/"],
      "numberOfRuns": 3
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "total-byte-weight": ["error", { "maxNumericValue": 512000 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "categories:performance": ["error", { "minScore": 0.85 }]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

Avec cette configuration, si une PR ajoute 50 KB de JavaScript supplémentaire et que le TBT dépasse 200 ms, le CI échoue et la fusion est bloquée. Chez Roibase, en travaillant avec des clients qui passaient à l'[architecture Headless Commerce](https://www.roibase.com.tr/fr/headless), nous avons utilisé cette approche pour réduire le TBT moyen de 2190 ms à 200 ms — chaque ajout de bibliothèque a été testé contre le budget.

### Les Limites de Lighthouse CI et les Décisions Structurelles

Lighthouse CI effectue des tests synthétiques : une bande passante fixe (Moto G4, émulation 4G lent), un ralentissement CPU fixe (4x), une seule page. Un vrai utilisateur est sur un appareil différent, suit des chemins différents (page produit → panier → paiement), voit des variantes A/B. C'est pourquoi vous devez positionner Lighthouse CI comme *la barre minimale* — si elle passe, c'est déployable, mais passer ne signifie pas 100 points en production. Pour mesurer la réalité production, vous avez besoin de RUM.

## RUM (Real User Monitoring) : Transformer la Réalité Production en Données Décisionnelles

RUM recueille des métriques des vrais utilisateurs : Navigation Timing API, PerformanceObserver, CrUX (Chrome User Experience Report). Un vendeur les collecte (Speedcurve, Sentry Performance, Cloudflare Web Analytics) ou vous avez votre propre stack (web-vitals + BigQuery).

Une intégration minimale avec `web-vitals` :

```javascript
// app.js
import { onCLS, onFID, onLCP, onTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    navigationType: metric.navigationType,
    page: window.location.pathname,
    deviceType: /mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
  });
  
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  } else {
    fetch('/api/vitals', { method: 'POST', body, keepalive: true });
  }
}

onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onLCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

Téléchargez ces données dans BigQuery, puis combinez-les avec vos données d'attribution marketing à l'aide de dbt :

```sql
-- models/performance_impact.sql
WITH vitals AS (
  SELECT
    session_id,
    AVG(CASE WHEN metric_name = 'LCP' THEN value END) AS avg_lcp,
    AVG(CASE WHEN metric_name = 'CLS' THEN value END) AS avg_cls
  FROM {{ ref('raw_vitals') }}
  GROUP BY session_id
),
conversions AS (
  SELECT session_id, revenue, converted
  FROM {{ ref('ga4_sessions') }}
)
SELECT
  CASE
    WHEN v.avg_lcp <= 2500 THEN 'good'
    WHEN v.avg_lcp <= 4000 THEN 'needs_improvement'
    ELSE 'poor'
  END AS lcp_band,
  COUNT(*) AS sessions,
  SUM(c.converted) AS conversions,
  SAFE_DIVIDE(SUM(c.converted), COUNT(*)) AS cvr
FROM vitals v
LEFT JOIN conversions c USING(session_id)
GROUP BY lcp_band;
```

Ce tableau vous donne une donnée concrète : « LCP sous 2,5 secondes = CVR 3,4 %, au-dessus = CVR 2,1 % ». Quand vous rapportez ce point au CMO, la demande abstraite « optimisons la performance » devient concrète : « réduire LCP à moins de 2,5 s = revenus supplémentaires de 18K$ par mois ».

## Lier les Alertes de Régression à l'Intégration Slack/PagerDuty

Une fois que vous collectez les données RUM, vous devez détecter les régressions avec des alertes de seuil. Si votre moyenne sur 7 jours est LCP 2,2 secondes mais qu'aujourd'hui elle est montée à 3,1 secondes, c'est une régression de déploiement ou un problème CDN. Ne détectez pas cela via un dashboard manuel — automatisez-le.

### Alerting Basé sur les Métriques avec DataDog

DataDog parse automatiquement les métriques RUM et détecte les anomalies. Définissez un monitor :

```json
{
  "name": "LCP Regression - Desktop",
  "type": "metric alert",
  "query": "avg(last_1h):avg:rum.largest_contentful_paint{device:desktop} > 2500",
  "message": "LCP desktop a dépassé 2500ms dans la dernière heure. Dernier déploiement : {{deploy.id}}. @slack-perf-alerts @pagerduty",
  "tags": ["service:ecommerce", "env:production"],
  "thresholds": {
    "critical": 2500,
    "warning": 2200
  }
}
```

Quand cette alerte se déclenche, elle tombe dans un canal Slack, ouvre un incident PagerDuty, et réveille le développeur de garde. Si le message d'alerte inclut un ID de déploiement (provenant de votre tag CI), vous trouvez le commit responsable en 30 secondes.

### Rediriger les Échecs de Seuil Lighthouse CI vers des Alertes

Certaines équipes ne laissent pas le Lighthouse CI fail juste bloquer les PR — elles l'envoient aussi à Slack :

```yaml
# .github/workflows/lighthouse-ci.yml (étape supplémentaire)
- name: Notify Slack on Failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "Lighthouse CI FAILED on PR #${{ github.event.pull_request.number }}",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Performance budget exceeded*\nPR: <${{ github.event.pull_request.html_url }}|#${{ github.event.pull_request.number }}>\nBranch: `${{ github.head_ref }}`"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_PERF }}
```

Ainsi, quand un ingénieur ouvre une PR, il voit immédiatement à la fois le ✗ rouge en CI *et* une notification Slack si le budget est dépassé — l'attention est captée instantanément.

## Intégrer les Budgets aux Systèmes Feature Flag

Certaines features sont intrinsèquement lourdes : un widget de chat en direct (80 KB JS), un moteur de personnalisation (150 KB + coût runtime), un lecteur vidéo (200 KB). Au lieu de les ouvrir à tous les utilisateurs, testez-les sur un segment où le performance budget n'est pas dépassé (par ex. desktop + connexion rapide), puis déployez progressivement.

Vous pouvez définir des règles dans LaunchDarkly ou votre propre système :

```javascript
// featureFlags.js
import { getConnectionSpeed } from './utils';

export function shouldEnableChatWidget(user, vitals) {
  const is4G = getConnectionSpeed() === '4g';
  const goodLCP = vitals.lcp < 2000;
  
  return is4G && goodLCP && user.tier === 'premium';
}
```

De cette façon, la décision « ajoutons un widget de chat » ne crée pas un risque « tous les utilisateurs verront le LCP augmenter de 300 ms » — elle est activée uniquement sur le segment qui satisfait les conditions, les données RUM sont collectées, l'impact CVR est mesuré, puis vous faites un full rollout ou revertez. Quand vous partagez cette décision tradeoff avec le marketing et le product, vous pouvez être précis : « Le chat augmente le CVR de +0,4 % mais fait monter le LCP à 2,8 secondes — net +8K$ de revenu mais l'UX baisse. On continue ? »

## Enforcing le Performance Budget en Commerce Headless

L'architecture headless commerce (par ex. Shopify Hydrogen, Next.js + Shopify API) est généralement plus rapide que les thèmes Liquid parce que vous contrôlez le JavaScript côté client et pouvez faire de l'hydratation sélective. Mais puisque le contrôle est le vôtre, le risque de régression l'est aussi — une mise à jour npm peut ajouter 70 KB au bundle.

Chez Roibase, dans nos engagements de [Services Shopify Partner](https://www.roibase.com.tr/fr/shopify), nous appliquons ce workflow lors des migrations headless :

1. **Établir une baseline :** Collectez les données RUM du thème Liquid existant (30 jours). Enregistrez les valeurs médiane LCP, TBT, CLS.
2. **Gate le prototype headless avec Lighthouse CI :** Chaque commit doit respecter le budget dans `.lighthouserc.json`. Le premier déploiement doit être 20 % meilleur que la baseline.
3. **Comparaison RUM en production :** Pour les 7 premiers jours, testez A/B les deux versions (par ex. 10 % du traffic sur la nouvelle headless), comparez les métriques RUM.
4. **Configurer les alertes de régression :** Après la migration, définissez les monitors DataDog pour LCP < 2,5s, TBT < 200ms.
5. **Audit trimestriel :** Chaque trimestre, auditez la taille du bundle et nettoyez les dépendances inutilisées.

Chez un client e-commerce, ce processus a produit