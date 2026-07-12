---
title: "Budgets de Performance Web : Les Lier aux Mécanismes de Décision"
description: "Lighthouse CI, RUM et alarmes de régression transforment la performance web en KPI mesurable. Liez la décision aux chiffres."
publishedAt: 2026-07-12
modifiedAt: 2026-07-12
category: tech
i18nKey: tech-004-2026-07
tags: [web-performance, lighthouse-ci, rum, core-web-vitals, devops]
readingTime: 9
author: Roibase
---

La performance web n'est pas « ça doit être bon », c'est un chiffre qui affecte la décision. En 2026, la métrique INP, qui remplace FID, provoque une baisse de 15-20 % des conversions mobiles si elle dépasse 200 ms (Google Chrome UX Report 2025 cohort). Pour maintenir ce seuil, il faut contrôle automatique dans le pipeline CI, pas des estimations. Lighthouse CI, RUM et système d'alarmes de régression : quels seuils placer où, quelle métrique commande quelle partie de la décision ? Cet article détaille l'architecture qui lie le budget de performance du test à la prise de décision, avec des chiffres concrets.

## Qu'est-ce qu'un Budget de Performance et Comment le Lier au Plan Sprint

Un budget de performance est la limite supérieure pour le temps de chargement d'une page, la taille du bundle et les métriques d'exécution. Le bundle total ne dépassera pas 250 KB, FCP ne dépassera pas 1,2 s, INP ne dépassera pas 200 ms — ce sont les budgets. Définis au démarrage du sprint, ils deviennent critère de fusion des PR. Si une nouvelle fonctionnalité dépasse ces seuils, soit vous refactorisez le code, soit vous reportez la fonctionnalité, soit vous augmentez le budget (mais en acceptant la perte de conversion).

Pour définir les budgets, trois sources sont utilisées : (1) les seuils Core Web Vitals de Google (LCP <2,5 s, INP <200 ms, CLS <0,1), (2) les benchmarks p75 du RUM (si 75 % de votre trafic reste sous ce seuil, c'est « bon »), (3) le rapport de corrélation de conversion (si LCP augmente de 100 ms, votre conversion baisse de 2 %, augmenter de 2,5 s à 3 s signifie une perte de 10 %). Le budget n'est pas un seul chiffre, il est ventilé par métrique :

| Métrique | Seuil | Source |
|----------|-------|--------|
| LCP | <2,5 s | CWV officiel |
| INP | <200 ms | CWV 2024+ |
| CLS | <0,1 | CWV officiel |
| Total JS | <300 KB gzip | HTTP Archive p75 |
| FCP | <1,8 s | RUM interne |

Vous écrivez ce tableau dans un fichier `performance.config.json`, Lighthouse CI lit ce fichier et échoue si une PR dépasse le seuil.

## Lighthouse CI : Critère de Fusion des PR

Lighthouse CI est un outil (open-source par Google) qui exécute Lighthouse sur chaque PR et écrit les résultats dans les logs CI (GitHub Actions, GitLab CI, CircleCI). Le flux de base : (1) une PR est ouverte, (2) le CI build, (3) la commande `lhci autorun` visite la page dans l'environnement de test, (4) les scores Lighthouse sont comparés au budget dans performance.config.json, (5) une violation de seuil bloque la fusion.

Configuration exemple (`.lighthouserc.json`) :

```json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000/", "http://localhost:3000/product/sample"],
      "numberOfRuns": 3
    },
    "assert": {
      "preset": "lighthouse:no-pwa",
      "assertions": {
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "interactive": ["error", {"maxNumericValue": 3500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-byte-weight": ["warn", {"maxNumericValue": 307200}]
      }
    },
    "upload": {
      "target": "temporary-public-storage"
    }
  }
}
```

Cette config échoue si LCP >2,5 s, la taille totale dépasse 300 KB (warning, n'empêche pas la fusion). Trois exécutions sont faites car une seule a une variance réseau élevée. Le compromis de Lighthouse CI : il s'exécute sur un serveur de développement local, ne peut pas simuler le CDN de production. Les résultats sont un « pire cas », mais les seuils ne doivent jamais être dépassés.

### Lighthouse CI + Vercel Preview : Test en Staging Réaliste

Les plateformes comme Vercel/Netlify créent automatiquement une URL de preview pour chaque PR. Quand vous liez Lighthouse CI à cette URL, vous testez dans un environnement proche de la production. Exemple GitHub Actions :

```yaml
- name: Run Lighthouse CI
  env:
    LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_TOKEN }}
  run: |
    npm install -g @lhci/cli
    lhci autorun --collect.url=${{ steps.vercel.outputs.preview-url }}
```

`steps.vercel.outputs.preview-url` vient de l'action Vercel. Avec cette configuration, vous testez la mise en cache CDN, SSR au bord, optimisation d'images. Un commentaire sur la PR reporte la violation, une notification Slack est envoyée (webhook intégré).

## RUM : Étalonnage du Budget à partir des Données Utilisateurs Réels

Lighthouse CI est un test synthétique — environnement contrôlé, réseau constant. RUM (Real User Monitoring) est collecté auprès de vraies visites. La différence est critique : Lighthouse simule 3G, RUM capture 4G/5G/fiber mélangés ; Lighthouse teste cache froid, RUM capture l'effet cache des visites répétées. Si vous configurez budgets sur Lighthouse seul, vous manquez l'expérience réelle.

Pour RUM, utilisez la bibliothèque Web Vitals (Google, standard) qui mesure les CWV à chaque chargement et envoie les données à un endpoint. Exemple :

```javascript
import {onCLS, onINP, onLCP} from 'web-vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    rating: metric.rating
  });
  navigator.sendBeacon('/analytics', body);
}

onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onLCP(sendToAnalytics);
```

L'endpoint backend `/analytics` écrit ces données dans BigQuery (plutôt que GA4 si vous préférez les données first-party, car GA4 échantillonne). Vous calculez le p75 dans BigQuery :

```sql
SELECT
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS p75_lcp
FROM metrics
WHERE name = 'LCP' AND date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY);
```

Si le résultat est 2,8 s et votre budget est 2,5 s, soit vous augmentez le budget à 2,8 s, soit vous optimisez le code. Le p75 est préféré car cela signifie que 75 % des utilisateurs restent en dessous, et Google calcule aussi le score CWV selon le p75.

### RUM + Segmentation : Budgets Différents par Appareil/Région

Tout le trafic ne mérite pas le même budget. LCP mobile est 40 % plus élevé que desktop (Chrome UX Report 2025), le trafic indien est 60 % plus lent que celui des USA. Vous pouvez différencier les budgets selon le segment RUM :

| Segment | Budget LCP | Budget INP |
|---------|------------|------------|
| Desktop | 2,2 s | 180 ms |
| Mobile | 3,0 s | 220 ms |
| Inde | 3,5 s | 250 ms |

Pour cela, ajoutez `deviceType` et `country` à votre beacon RUM (GeoIP lookup backend), puis groupez par `GROUP BY device` dans BigQuery. Lighthouse CI n'a pas de config multi-segmentée, mais vous pouvez créer des workflows distincts (`lhci-mobile.json`, `lhci-desktop.json`).

## Alarmes de Régression : Slack s'Active Quand la Performance Baisse

Budget défini, CI contrôle, RUM collecte — mais si regression en production, vous réagissez comment ? Si LCP monte de 2,3 s à 2,9 s après un déploiement, alertez en 5 min, pas 3 heures. Lancez un job qui analyse RUM toutes les 5 min (Cloudflare Workers Cron, AWS Lambda EventBridge, GCP Cloud Scheduler).

Logique d'alarme (pseudo-code) :

```javascript
// Worker exécuté toutes les 5 min
async function checkRegression() {
  const current = await query('SELECT AVG(value) FROM metrics WHERE name="LCP" AND timestamp > NOW() - INTERVAL 5 MINUTE');
  const baseline = await query('SELECT AVG(value) FROM metrics WHERE name="LCP" AND timestamp BETWEEN NOW() - INTERVAL 1 DAY AND NOW() - INTERVAL 1 HOUR');
  
  if (current > baseline * 1.15) { // +15%
    await sendSlack({
      text: `🚨 LCP regression: ${current}ms (baseline ${baseline}ms)`,
      channel: '#performance-alerts'
    });
  }
}
```

Baseline remonte à 1 h en arrière car le déploiement vient peut-être de finir. Le seuil 15 % est calibré — 10 % est trop sensible (faux positifs), 25 % est trop tard. Vous pouvez intégrer PagerDuty, Opsgenie pour on-call.

### Root Cause de Regression : Lighthouse Diff

Alarm arrive, LCP patine — pourquoi ? Lighthouse CI ne fait que contrôler les seuils, pas l'analyse causale. Utilisez Lighthouse Diff pour voir les différences entre deux builds. Commande `lhci compare` :

```bash
lhci compare --base=build-1234 --head=build-1235 --preset=lighthouse:all
```

Output : « unused-javascript increased by 45 KB », « server-response-time +120 ms ». Ces chiffres resserrent le diagnostic. Utilisez webpack-bundle-analyzer ou `next build --analyze` pour voir d'où viennent les 45 KB, et les server logs pour tracer le délai de 120 ms.

## Lier la Performance à la Conversion : Modèle d'Attribution

Les budgets sont des chiffres techniques, mais pour décider, il faut conversion. Il faut dire « si LCP monte de 2,5 s à 3 s, conversion baisse de 4 % ». Rapport de corrélation via A/B test ou cohort analysis. A/B test : 50 % du trafic reçoit une build ralentie (délai +500 ms via Lighthouse simulation), conversion comparée. Cohort analysis : RUM data, LCP <2 s vs LCP >3 s, conversion rate calculée.

Google Analytics 4 + BigQuery export, corrélation SQL :

```sql
SELECT
  CASE 
    WHEN lcp < 2000 THEN 'fast'
    WHEN lcp BETWEEN 2000 AND 4000 THEN 'medium'
    ELSE 'slow'
  END AS lcp_bucket,
  COUNT(DISTINCT user_pseudo_id) AS users,
  COUNTIF(event_name = 'purchase') / COUNT(DISTINCT session_id) AS conversion_rate
FROM analytics_events
LEFT JOIN rum_metrics ON analytics_events.session_id = rum_metrics.session_id
GROUP BY lcp_bucket;
```

Tableau résultant :

| Bucket LCP | Conversion Rate |
|------------|-----------------|
| fast | 4,2 % |
| medium | 3,6 % |
| slow | 2,9 % |

La réduction de LCP de 3 s à 2,5 s déplace conversion de 3,6 % à 4,2 %, soit +16,7 %. 100K visites/mois → +1670 conversions, AOV $50 → +$83K revenue. Ce rapport se présente au CFO, pas au CTO. C'est comme ça que la priorité du sprint perf se décide.

### Violation de Budget : Décision Trade-off

Une feature arrive, bundle +50 KB, budget explose. Trois choix : (1) refactoriser (code-split, lazy-load), (2) augmenter le budget et accepter la perte de conversion, (3) reporter. Décision quantifiée : +50 KB → LCP +200 ms (Lighthouse trace), LCP +200 ms → conversion -2 % (RUM correlation), feature apporte +5 % lift → net +3 % gain → go. Si feature lift = +1 %, net = -1 % loss → report.

Créez un « performance cost estimator » interne : input bundle delta, output LCP delta + impact conversion. Modèle simple régression : chaque 10 KB bundle = +30 ms LCP, chaque 100 ms LCP = -0,8 % conversion (tiré de vos RUM data). PM voit le tool, ajuste la roadmap.

## Commerce Headless : Budget de Performance Lié à la Vitesse Produit

E-commerce = performance = revenue. Avec [commerce headless](https://www.roibase.com.tr/fr/headless) (Shopify Hydrogen, Remix, Next.js), vous contrôlez le frontend mais latence API backend aussi. Storefront API Shopify → 150 ms moyen, à inclure dans le budget. LCP = TTFB (150 ms) + FCP (800 ms) + delta LCP (600 ms) = 1550 ms. Budget 2500 ms → 950 ms de marge.

Sources de régression headless : (1) complexité query API (+2 levels GraphQL = +50 ms), (2) nombre de components SSR (+20 components = +100 ms hydration), (3) script tiers (tag analytics = +200 ms). Lighthouse CI ne les distingue pas, il faut trace log RUM. Ajoutez `Server-Timing` header dans Next.js Middleware :

```javascript
export function middleware(req) {
  const start = Date.now();
  const res = NextResponse.next();
  res.headers.set('Server-Timing', `api;dur=${Date.now() - start}`);
  return res;
}
```

Visible dans Chrome DevTools Network, ajouté à beacon RUM, alarme de régression lancée.

Lier budget de performance web aux mécanismes de décision exige trois couches : (1) Lighthouse CI contrôle seuils dans CI/CD, (2) RUM étalonne budgets selon vraies données utilisateur, (3) alarmes de régression + corrélation conversion = attribution business. Budget n'est pas monolithique : segmenté par appar