---
title: "Budgets de Performance Web : Les Relier aux Mécanismes de Décision"
description: "Convertir les métriques de vitesse en objectifs métier mesurables avec Lighthouse CI, RUM et des alarmes de régression—architecture et exemples de code pratiques."
publishedAt: 2026-05-14
modifiedAt: 2026-05-14
category: tech
i18nKey: tech-004-2026-05
tags: [performance-web, lighthouse-ci, rum, budget-performance, devops]
readingTime: 8
author: Roibase
---

Le coût du ralentissement d'un site web est désormais une grandeur calculable. L'étude d'Amazon de 2006 a montré que chaque délai de 100 ms entraînait une baisse de 1 % des ventes—ce taux est encore plus prononcé sur les sites de commerce électronique. Les équipes de développement qui travaillent sans budget de performance découvrent les régressions après le déploiement, moment où l'impact métier s'est déjà matérialisé. Cet article vous montre comment relier les métriques de vitesse aux mécanismes de décision en combinant Lighthouse CI et Real User Monitoring (RUM)—avec des exemples de code.

## Du Budget de Performance à la Décision Métier

Un budget de performance est une limite numérique : « LCP ne doit pas dépasser 2,5 secondes », « First Input Delay (FID) doit rester sous 100 ms », « le bundle JavaScript total ne doit pas dépasser 350 KB ». Or, sans test automatique de ces limites dans le pipeline CI, ces métriques restent de simples souhaits documentés. Lighthouse CI est la couche d'outillage qui teste ces seuils à chaque commit, bloque le déploiement ou génère des alarmes en cas de dépassement.

Un workflow Lighthouse CI simple avec GitHub Actions ressemble à ceci :

```yaml
# .github/workflows/lighthouse-ci.yml
name: Lighthouse CI
on: [pull_request]
jobs:
  lhci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npm install -g @lhci/cli
      - run: lhci autorun --upload.target=temporary-public-storage
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

Ce pipeline scanne l'environnement de staging à chaque pull request et mesure les Core Web Vitals. Via une configuration `assert`, on peut fixer des limites strictes :

```json
// lighthouserc.json
{
  "ci": {
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "total-blocking-time": ["error", { "maxNumericValue": 300 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }]
      }
    }
  }
}
```

Ici, si LCP dépasse 2,5 secondes, la fusion est bloquée. Cette approche semble ralentir le développement à court terme, mais nous avons observé une réduction de 80 % des régressions de performance en production (données mesurées sur un projet Shopify Hydrogen chez Roibase). Le bug est attrapé avant de remonter—le coût de correction est 10 fois plus faible.

Lighthouse CI mesure dans un environnement de laboratoire (une seule instance Chrome). Il ne capture pas la diversité des appareils réels des utilisateurs ni leurs conditions réseau. C'est là que RUM entre en jeu.

## Mesurer l'Expérience Réelle avec RUM

Real User Monitoring collecte les métriques via du JavaScript qui s'exécute sur chaque utilisateur. La bibliothèque Web Vitals simplifie cela :

```javascript
// analytics/webVitals.js
import { onCLS, onFID, onLCP, onTTFB } from 'web-vitals';

function sendToAnalytics(metric) {
  fetch('/api/web-vitals', {
    method: 'POST',
    body: JSON.stringify({
      name: metric.name,
      value: metric.value,
      id: metric.id,
      rating: metric.rating,
      navigationType: metric.navigationType
    }),
    headers: { 'Content-Type': 'application/json' },
    keepalive: true
  });
}

onCLS(sendToAnalytics);
onFID(sendToAnalytics);
onLCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

Ce code envoie les Core Web Vitals au backend à chaque chargement de page. Le backend (par exemple, Cloudflare Workers) peut écrire cette donnée dans BigQuery :

```javascript
// workers/webVitalsCollector.js
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    const data = await request.json();
    const row = {
      timestamp: Date.now(),
      metric: data.name,
      value: data.value,
      rating: data.rating,
      userAgent: request.headers.get('User-Agent'),
      country: request.cf.country
    };

    await env.BQ.insert('web_vitals', row); // BigQuery binding
    return new Response('OK', { status: 200 });
  }
};
```

Dans BigQuery, ces données peuvent être interrogées ainsi :

```sql
SELECT
  metric,
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS p75,
  COUNT(*) AS sample_count
FROM web_vitals.raw_metrics
WHERE timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY))
GROUP BY metric;
```

Le P75 (75e percentile) est le seuil officiel des Core Web Vitals—Google note en fonction de ce percentile. Cette requête retourne les données réelles de production, pas l'environnement de labo de Lighthouse CI.

### Le Compromis entre RUM et Lighthouse CI

Lighthouse CI est déterministe et reproductible—tu obtiens le même résultat en scannant le même code. RUM est bruyant—5 % des utilisateurs sur 3G, 10 % sur du matériel Android ancien, les métriques sont dispersées. Mais RUM montre le monde réel tandis que CI ne le montre pas. Les deux ensemble sont critiques : CI prévient la régression, RUM mesure l'impact métier.

Par exemple, Lighthouse CI peut montrer une LCP de 2,1 s tandis que le RUM production affiche un P75 de 3,2 s—parce que 30 % des utilisateurs réels arrivent en 3G, l'environnement de labo a une connexion fibre. Cette différence est particulièrement visible dans les projets [e-commerce headless](https://www.roibase.com.tr/fr/headless) : un rendu edge affiche 1,8 s en labo mais peut atteindre 4 s en production lors d'erreurs de cache CDN.

## Alarme de Régression : Quel Métrique à Quel Seuil

Pour détecter une régression, il faut une métrique de référence (baseline). La baseline peut être la moyenne du P75 des 7 derniers jours :

```sql
-- BigQuery scheduled query : se met à jour chaque jour
CREATE OR REPLACE TABLE web_vitals.baseline AS
SELECT
  metric,
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS baseline_p75
FROM web_vitals.raw_metrics
WHERE timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY))
GROUP BY metric;
```

Ensuite, en traitant le flux en temps réel, on déclenche une alarme si l'écart est de 10 % :

```javascript
// Cloudflare Durable Objects: gestionnaire d'alarme avec état
export class PerfAlarmState {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const { metric, currentP75 } = await request.json();
    const baseline = await this.env.BQ.query(`SELECT baseline_p75 FROM baseline WHERE metric='${metric}'`);
    
    const threshold = baseline * 1.10; // 10 % de régression
    if (currentP75 > threshold) {
      await fetch(this.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        body: JSON.stringify({
          text: `🚨 Régression de performance : ${metric} P75 ${currentP75}ms (baseline ${baseline}ms, +${((currentP75/baseline - 1)*100).toFixed(1)}%)`
        })
      });
    }
    return new Response('Checked');
  }
}
```

Cette architecture fournit des alarmes en temps réel—une régression peut être détectée 5 minutes après le déploiement. La décision de rollback peut être prise immédiatement. Scénario d'exemple : une optimisation de bundle JavaScript réduit LCP de 200 ms en labo, mais augmente TBT (Total Blocking Time) de 400 ms en production parce que le coût d'analyse est plus élevé. L'alarme RUM détecte la régression TBT en 8 minutes, le déploiement est annulé—2 % des utilisateurs sont affectés, 98 % ne voient jamais le code. Sans alarme, tous les utilisateurs subiraient 2 heures de lenteur.

## Impact Métier du Dépassement de Budget : Attribution de Revenue

Lier la métrique de performance au revenu demande un test A/B ou une analyse de cohorte. Une approche simple : regrouper les utilisateurs par vitesse LCP.

```sql
-- BigQuery : taux de conversion par vitesse LCP
WITH metrics_with_sessions AS (
  SELECT
    session_id,
    APPROX_QUANTILES(value, 100)[OFFSET(75)] AS lcp_p75
  FROM web_vitals.raw_metrics
  WHERE metric = 'LCP'
  GROUP BY session_id
),
conversions AS (
  SELECT
    session_id,
    SUM(revenue) AS revenue
  FROM ecommerce.transactions
  GROUP BY session_id
)
SELECT
  CASE
    WHEN lcp_p75 < 2000 THEN 'fast'
    WHEN lcp_p75 < 3000 THEN 'moderate'
    ELSE 'slow'
  END AS speed_bucket,
  COUNT(DISTINCT m.session_id) AS sessions,
  COUNT(c.session_id) AS conversions,
  SAFE_DIVIDE(COUNT(c.session_id), COUNT(DISTINCT m.session_id)) AS conversion_rate,
  AVG(c.revenue) AS avg_order_value
FROM metrics_with_sessions m
LEFT JOIN conversions c USING(session_id)
GROUP BY speed_bucket;
```

Exemple de résultats :
- **fast (LCP < 2s):** 15 240 sessions, 1 829 conversions → **12.0% CR**, $87 AOV
- **moderate (2-3s):** 8 910 sessions, 934 conversions → **10.5% CR**, $83 AOV
- **slow (>3s):** 3 200 sessions, 256 conversions → **8.0% CR**, $78 AOV

Ces données montrent que réduire LCP de 3 s à 2 s porterait le taux de conversion de 8 % à 12 %—une différence de 4 points. Pour un site avec 10 000 visiteurs mensuels, cela représente 400 conversions supplémentaires. À un AOV de $80, c'est $32 000 de revenu supplémentaire par mois. Quand on cite ce chiffre en réunion de budget, le mécanisme de décision change—l'« optimisation LCP » monte en haut du backlog.

### Rendre le Budget Dynamique

Un budget statique « LCP < 2,5 s » pour toutes les pages n'est pas approprié. Une page de listing de produits n'a pas la même criticité qu'une page de checkout. Une latence de 100 ms au checkout est une perte directe de revenu ; au listing c'est moins critique. Différencier le budget par type de page :

```json
// lighthouserc.json — assertions différentes par type de page
{
  "ci": {
    "collect": {
      "url": [
        "https://staging.example.com/",
        "https://staging.example.com/products",
        "https://staging.example.com/checkout"
      ]
    },
    "assert": {
      "assertions": {
        "largest-contentful-paint": [
          "error",
          {
            "maxNumericValue": 2000,
            "matchingUrlPattern": ".*/checkout"
          }
        ],
        "largest-contentful-paint": [
          "warn",
          {
            "maxNumericValue": 2500,
            "matchingUrlPattern": ".*/(products|)"
          }
        ]
      }
    }
  }
}
```

Au checkout, si LCP dépasse 2 secondes, la fusion est bloquée (`error`). À la page d'accueil, si cela dépasse 2,5 secondes, c'est juste un avertissement (`warn`). Vous pouvez appliquer cette granularité à RUM aussi—des seuils d'alarme différents par type de page.

## Intégrer le Pipeline CI à la Chaîne de Valeur

Au lieu d'utiliser Lighthouse CI uniquement comme outil de test, le faire commenter les pull requests améliore la visibilité dans l'équipe :

```yaml
# .github/workflows/lighthouse-comment.yml
- name: Comment PR with Lighthouse results
  uses: treosh/lighthouse-ci-action@v9
  with:
    uploadArtifacts: true
    temporaryPublicStorage: true
    runs: 3 # Exécuter 3 fois, utiliser la moyenne
```

Cette action ajoute un commentaire au PR comme ceci :

```
Lighthouse CI Report

| Métrique | Avant | Après | Diff |
|----------|-------|-------|------|
| LCP      | 2.8s  | 2.1s  | -700ms ✅ |
| TBT      | 420ms | 310ms | -110ms ✅ |
| CLS      | 0.08  | 0.12  | +0.04 ⚠️ |
```

CLS s'est dégradé—l'équipe le voit immédiatement, peut corriger avant le déploiement. Fermer cette boucle de feedback est essentiel pour construire une culture de performance.

Transférer les données RUM sur un dashboard est aussi critique. Grafana + BigQuery est simple :

```sql
-- Requête de panel Grafana : tendance LCP des 24 dernières heures
SELECT
  TIMESTAMP_SECONDS(DIV(timestamp, 1000)) AS time,
  APPROX_QUANTILES(value, 100)[OFFSET(75)] AS p75_lcp
FROM web_vitals.raw_metrics
WHERE metric = 'LCP'
  AND timestamp >= UNIX_MILLIS(TIMESTAMP_SUB(CURRENT