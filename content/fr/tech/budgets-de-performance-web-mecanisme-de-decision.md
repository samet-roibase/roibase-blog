---
title: "Budgets de Performance Web : Les Lier au Mécanisme de Décision"
description: "Intégrer Lighthouse CI, RUM et les alarmes de régression de perf dans le pipeline CI/CD pour arrêter le ralentissement au moment du déploiement — cas d'usage réels."
publishedAt: 2026-07-30
modifiedAt: 2026-07-30
category: tech
i18nKey: tech-004-2026-07
tags: [web-performance, lighthouse-ci, rum, performance-budget, core-web-vitals]
readingTime: 9
author: Roibase
---

Découvrir une régression de performance après le déploiement en production, c'est comme être surpris par le taux de change après avoir fait une transaction : trop tard. Selon le rapport Commerce Signals de Google 2026, chaque 100 ms supplémentaires de LCP engendre une augmentation de 3,5 % des taux de rebond. Tout comme nous capturons les bugs avant le déploiement, nous devons capturer les ralentissements dans le pipeline CI/CD lui-même. Cet article montre comment intégrer Lighthouse CI, RUM, la surveillance synthétique et les budgets de performance pour arrêter les déploiements — avec code et chiffres concrets.

## Qu'est-ce qu'un Budget de Performance et Pourquoi c'est Obligatoire en CI/CD

Un budget de performance définit la limite supérieure des ressources que votre page peut consommer. Par exemple : « Page d'accueil : LCP < 2s, Total Blocking Time < 200ms, JS bundle < 400KB ». Cela fonctionne comme un SLA : si un chiffre dépasse le seuil, le build échoue et le déploiement est bloqué.

L'approche classique — générer un rapport Lighthouse manuel chaque fin de sprint et l'examiner — révélerait une régression avec deux semaines de retard. Avec la moderne approche, le budget est intégré à l'IC. À chaque pull request, Lighthouse CI s'exécute : il rend la page dans un Chromium headless, mesure les métriques de performance et les compare au budget. Si le budget est dépassé, l'action GitHub retourne une erreur et le merge est bloqué.

Scénario concret : sur une vitrine Shopify Hydrogen, un nouveau widget de recommandation de produits augmente la taille du bundle de 340 KB à 510 KB. Le pipeline CI le détecte immédiatement et marque le PR en rouge. Le widget n'est déployé qu'après optimisation via lazy-loading. Sans cela, le code aurait atteint la production, causant 4 secondes de temps de blocage supplémentaire sur 3G mobile — deux jours de perte de chiffre d'affaires.

Lighthouse CI récupère l'URL de déploiement de prévisualisation, la rend dans Chromium et mesure les Core Web Vitals + des métriques personnalisées par rapport à un fichier JSON de budget.

```json
// lighthouserc.json
{
  "ci": {
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2000 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "speed-index": ["error", { "maxNumericValue": 3000 }],
        "resource-summary:script:size": ["error", { "maxNumericValue": 400000 }]
      }
    },
    "collect": {
      "numberOfRuns": 3,
      "url": ["https://preview-{PR_NUMBER}.vercel.app"],
      "settings": {
        "throttling": {
          "rttMs": 150,
          "throughputKbps": 1638.4,
          "cpuSlowdownMultiplier": 4
        }
      }
    }
  }
}
```

`numberOfRuns: 3` réduit la variabilité — la valeur médiane est prise. Le `throttling` simule les conditions 3G mobile — le pire scénario de l'utilisateur réel.

## Automatiser Lighthouse CI avec GitHub Actions

Pour exécuter Lighthouse dans le pipeline, nous utilisons un déploiement de prévisualisation Vercel + GitHub Actions. À chaque PR, Vercel génère une URL de prévisualisation et Lighthouse CI l'analyse. Les résultats apparaissent sous forme de commentaire dans la PR. Si le budget est dépassé, le CI échoue.

```yaml
# .github/workflows/lighthouse.yml
name: Lighthouse CI
on: [pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - name: Wait for Vercel Preview
        uses: patrickedqvist/wait-for-vercel-preview@v1.3.1
        id: vercel_preview
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          max_timeout: 300
      - name: Run Lighthouse CI
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_TOKEN }}
        run: |
          npm install -g @lhci/cli
          lhci autorun --collect.url=${{ steps.vercel_preview.outputs.url }}
      - name: Comment PR
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: ${{ steps.vercel_preview.outputs.url }}
          uploadArtifacts: true
          temporaryPublicStorage: true
```

L'étape `wait-for-vercel-preview` est critique : si Lighthouse s'exécute avant la fin du déploiement Vercel, il retournera un 404. Avec `max_timeout: 300`, nous attendons 5 minutes. Une fois le déploiement terminé, Lighthouse commence.

Le résultat apparaît sur la PR comme ceci :

```
Lighthouse CI Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Performance: 92/100 (+2)
❌ LCP: 2.3s (budget: 2.0s) — FAILED
✅ TBT: 180ms (budget: 200ms)
✅ CLS: 0.08 (budget: 0.1)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Le LCP est de 2.3s, ce qui dépasse le budget de 2.0s : le CI échoue et le merge est bloqué. Le dev investigue, découvre qu'une `loading="eager"` manque sur l'image hero, la corrige, le CI redémarre, le LCP baisse à 1.9s et le merge s'ouvre.

Cette approche est cruciale pour les projets [Headless Commerce](https://www.roibase.com.tr/fr/headless). Les storefronts Hydrogen ou Next.js Commerce ajoutent de nouveaux composants chaque jour. Un seul `await fetch()` non déplié peut bloquer le thread principal. Lighthouse CI capture les dépassements via la taille du bundle et le TBT.

## Surveiller les Vrais Chiffres en Production avec RUM

Lighthouse CI effectue une surveillance synthétique — elle s'exécute dans un environnement contrôlé de laboratoire. Les vrais utilisateurs ont des appareils, des réseaux et des états de cache différents. Pour cela, le RUM (Real User Monitoring) est indispensable. RUM collecte les métriques réelles émises par les utilisateurs vivants.

Vous pouvez envoyer le RUM à votre propre backend avec la bibliothèque Web Vitals :

```typescript
// analytics/web-vitals.ts
import { onCLS, onFID, onLCP, onTTFB, onINP } from 'web-vitals';

function sendToAnalytics(metric: Metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now()
  });

  // Beacon API — envoie même si la page se ferme
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/vitals', body);
  } else {
    fetch('/api/vitals', { method: 'POST', body, keepalive: true });
  }
}

onCLS(sendToAnalytics);
onLCP(sendToAnalytics);
onINP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

Le backend `/api/vitals` écrit cette métrique dans BigQuery ou Cloudflare Analytics. Le rapport quotidien agrégé ressemble à ceci :

| Date       | LCP p75 | INP p75 | CLS p75 | Vues de page |
|------------|---------|---------|---------|--------------|
| 2026-07-28 | 1.8s    | 140ms   | 0.06    | 12,400       |
| 2026-07-29 | 2.1s    | 180ms   | 0.09    | 13,100       |
| 2026-07-30 | 3.2s    | 320ms   | 0.14    | 11,800       |

Un déploiement a eu lieu le 29 juillet. Le LCP a sauté de 2.1s à 3.2s, l'INP de 180ms à 320ms. Le taux de rebond a augmenté de 4,2 %. Le RUM l'a montré en 2 heures en production — tandis que Lighthouse CI en lab avait mesuré < 2.0s sur une connexion meilleure.

La décision de rollback a été prise sur la base du RUM : déploiement annulé, LCP est revenu à 1.9s.

### Pipeline d'Alarme RUM

Afficher les métriques RUM sur un tableau de bord seul ne suffit pas. Une alarme Slack instantanée en cas de régression est nécessaire. Vous pouvez configurer une requête programmée dans BigQuery :

```sql
-- Requête programmée BigQuery (toutes les heures)
WITH current_hour AS (
  SELECT
    APPROX_QUANTILES(lcp_value, 100)[OFFSET(75)] AS lcp_p75,
    APPROX_QUANTILES(inp_value, 100)[OFFSET(75)] AS inp_p75
  FROM `project.dataset.web_vitals`
  WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 HOUR)
),
baseline AS (
  SELECT
    APPROX_QUANTILES(lcp_value, 100)[OFFSET(75)] AS lcp_p75_baseline
  FROM `project.dataset.web_vitals`
  WHERE timestamp BETWEEN TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 8 HOUR)
    AND TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 2 HOUR)
)
SELECT
  c.lcp_p75,
  b.lcp_p75_baseline,
  (c.lcp_p75 - b.lcp_p75_baseline) / b.lcp_p75_baseline * 100 AS lcp_regression_pct
FROM current_hour c, baseline b
WHERE (c.lcp_p75 - b.lcp_p75_baseline) / b.lcp_p75_baseline > 0.15
```

Cette requête vérifie si le LCP p75 s'est dégradé de plus de 15 % par rapport à la baseline. Si c'est le cas, une Cloud Function est déclenchée qui envoie une alerte à un webhook Slack :

```
⚠️ Performance Regression Detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LCP p75: 3.2s (+68% vs baseline 6h)
Baseline: 1.9s
URL: /product/xyz
Deploy: #4521 (30 min ago)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Compromis : Synthétique vs RUM — Quand Utiliser Quel Chiffre

Lighthouse CI et RUM se complètent — ce n'est pas l'un ou l'autre, mais les deux en parallèle.

**Lighthouse CI (synthétique) :**
- **Avantage :** Environnement contrôlé, reproductible, s'exécute à chaque commit
- **Inconvénient :** Ne voit pas la variabilité des appareils réels, ne simule pas l'état du cache
- **Usage :** Prévention des régressions en CI — « Ce PR risque-t-il de ralentir le site ? »

**RUM (utilisateurs réels) :**
- **Avantage :** Données réelles d'utilisateurs, capture les edge cases (ex. « Safari sur iPhone 11, LCP = 5s »)
- **Inconvénient :** Données bruyantes (beaucoup de valeurs aberrantes), ne prévient pas avant le déploiement
- **Usage :** Monitoring en production — « Le nouveau déploiement a-t-il dégradé la perf ? »

Un système robuste utilise les deux. Le CI bloque au pipeline si Lighthouse dépasse le budget. Si le déploiement passe, le RUM valide les vrais chiffres en 2 heures. Si RUM montre une régression, rollback.

Exemple : sur une vitrine Shopify, un nouveau sélecteur de variante affiche 380ms de TBT dans Lighthouse CI (budget : 200ms). La PR est rejetée. Le dev code-split le composant et ajoute lazy-loading. Lighthouse CI mesure 150ms, merge autorisé. 4 heures après le déploiement, le RUM montre INP p75 passant de 120ms à 145ms — acceptable (budget 200ms). Le déploiement reste.

## Intégrer les Alarmes de Régression au Pipeline de Déploiement

Si l'alarme RUM fonctionne indépendamment du déploiement, on perd le contexte. « LCP s'est dégradé » — mais par quel déploiement ? C'est pourquoi nous injectons les métadonnées de déploiement dans chaque événement RUM.

Vercel ou Netlify fournissent la variable `VERCEL_GIT_COMMIT_SHA`. Nous l'injectons en frontend pour inclure le commit SHA dans chaque événement RUM :

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      deploymentId: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
      deploymentTime: Date.now()
    }
  }
});

// analytics/web-vitals.ts
function sendToAnalytics(metric: Metric) {
  const config = useRuntimeConfig();
  const body = JSON.stringify({
    ...metric,
    deploymentId: config.public.deploymentId,
    