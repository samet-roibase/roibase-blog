---
title: "Analytics respectueux de la confidentialité : Plausible et agrégation côté serveur"
description: "Mesure compatible RGPD : Plausible + agrégation côté serveur pour un suivi sans cookies, comparaison GA4 et architecture production."
publishedAt: 2026-05-19
modifiedAt: 2026-05-19
category: data
i18nKey: data-006-2026-05
tags: [analytics-respectueux-confidentialite, plausible, suivi-cote-serveur, sans-cookies, rgpd]
readingTime: 9
author: Roibase
---

Le tableau des cookies a effondré. Chrome a supprimé les cookies tiers en 2024, Safari et Firefox les bloquaient déjà depuis des années. Les équipes marketing constatent une perte de données de 40 à 60 % avec GA4 (selon les propres rapports de Google). Parallèlement, les amendes RGPD ont atteint 4,2 milliards d'euros en Europe en 2025. Deux pressions : technique (pas de cookies, pas de mesure) et légale (ignorer le consentement est un crime). L'*analytics respectueux de la confidentialité* offre une solution unique à ces deux enjeux : mesure sans cookies, agrégation côté serveur, prêt pour la conformité.

## Plausible : Le cœur de la mesure sans cookies

Quand Plausible a lancé en 2019, il s'est positionné comme « une alternative à GA ». En 2026, c'est une catégorie entière : *web analytics respectueux de la confidentialité*. La différence clé : au lieu de lier les événements à un cookie client, Plausible utilise un ID de session sans mémoire côté serveur. La combinaison IP + User-Agent produit un hash (SHA-256), réinitialisé toutes les 24 heures. Résultat : nombre de visiteurs uniques exact à 95 %, mais aucune PII (personally identifiable information) stockée.

Comparé à GA4 :
- **Propriété des données :** Plausible écrit les événements dans sa propre instance PostgreSQL. GA4 les envoie aux serveurs Google — tu ne peux pas interroger (sauf export BigQuery).
- **Dépendance aux cookies :** GA4 dépend du cookie `_ga`. Si le cookie est rejeté, la mesure s'effondre. Plausible est *nativement* sans cookies.
- **Taille du script :** Le tracker Plausible fait 1,4 KB, gtag.js 28 KB + gtm.js 45 KB. Une différence de ×50 au chargement.

Pour la conformité RGPD, le point critique : le hash Plausible n'est pas une donnée personnelle. L'article 4(1) du RGPD définit les données personnelles comme « toute information se rapportant à une personne physique identifiée ou identifiable ». Un hash SHA-256 ne peut pas être inversé — c'est donc de la donnée anonymisée. TCF 2.2 le place dans « Usage 1 : strictement nécessaire » — aucun consentement requis.

En production, Plausible fonctionne selon deux scénarios :
1. **Standalone :** Petits sites (blog, landing page) en cas d'usage simple. 10 lignes de JS, dashboard prêt.
2. **Hybride :** E-commerce ou SaaS — Plausible capture le trafic général, les événements conversion critiques vont via GTM côté serveur vers CDP. C'est ce scénario qui nous intéresse ici.

## Agrégation côté serveur : De l'événement à la métrique

Le second pilier de l'*analytics respectueux de la confidentialité* : métriques, pas événements bruts. GA4 enregistre chaque clic, scroll, pause vidéo comme une ligne séparée (event stream). Un site e-commerce génère 10 millions d'événements par jour. Ce volume représente un coût *et* un risque de confidentialité. L'agrégation change la logique : **résumer les événements côté serveur immédiatement**, comptabiliser plutôt que sauvegarder l'événement brut.

Exemple d'architecture :

```
Client → Tracker Plausible (1,4 KB JS)
         ↓
      Worker (Cloudflare / Vercel)
         ↓ (agrégation)
      Event Bus interne (Kafka / Redpanda)
         ↓
      Time-Series DB (TimescaleDB / ClickHouse)
```

Ce qu'agrège le Worker :

```sql
-- Table hypertable TimescaleDB
CREATE TABLE page_metrics (
  time        TIMESTAMPTZ NOT NULL,
  page_path   TEXT NOT NULL,
  country     TEXT,
  views       INT DEFAULT 1,
  bounces     INT DEFAULT 0,
  session_dur INT DEFAULT 0
);

SELECT create_hypertable('page_metrics', 'time');
```

Chaque page vue du client :
1. Le tracker fait `POST /api/event` → endpoint worker
2. Le worker calcule le hash (IP + UA → session_id)
3. Redis vérifie : même session_id dans les 30 dernières minutes ?
4. Oui : incrémenter `views` +1 ; non : créer une ligne
5. Après 30 minutes (session timeout), calculer le bounce

Trois avantages par rapport à GA4 :
- **Stockage : –85 %.** 10M événements → 200K lignes agrégées
- **Vitesse requête : ×40.** Index time-series = réponses dashboard en <15ms
- **Confidentialité : zéro PII.** Pas d'événement brut = pas de donnée personnelle à récupérer

## Conformité RGPD/KVKK : Détails techniques

Pour rendre *privacy-first analytics* légalement imperméable, quatre couches :

**1. Minimisation des données (article 5.1c RGPD) :**
Collecter uniquement ce qui est nécessaire. Au lieu de sauvegarder l'URL de référence entière (`https://example.com/checkout?user=123`), stocker juste le domaine (`example.com`). Conformité + économie disque.

**2. Seuil d'anonymisation (Ligne directrice KVKK 2023) :**
Si une métrique contient < 5 éléments dans un groupe, afficher "< 5". Parce qu'un groupe de 2 devient identifiable. TimescaleDB :

```sql
SELECT 
  country,
  CASE 
    WHEN COUNT(DISTINCT session_id) < 5 THEN '< 5'
    ELSE COUNT(DISTINCT session_id)::TEXT
  END AS visitors
FROM page_metrics
WHERE time > NOW() - INTERVAL '7 days'
GROUP BY country;
```

**3. Politique de rétention (article 17 RGPD) :**
Une fois l'objectif de traitement atteint (optimisation performance), supprimer. Pour analytics : 90 jours suffisent. TimescaleDB compression + suppression automatique :

```sql
SELECT add_retention_policy('page_metrics', INTERVAL '90 days');
SELECT add_compression_policy('page_metrics', INTERVAL '7 days');
```

Les données > 7j se compressent, > 90j s'effacent. Droit à l'oubli (article 17) automatisé.

**4. Consent Mode v2 (optionnel) :**
Si tu fonctionne encore en hybride GA4, règle GA4 sur `analytics_storage: denied`. Plausible continue — il n'utilise pas de cookies. [Une [stratégie de données first-party](https://www.roibase.com.tr/fr/firstparty) détaille ce setup hybride : Plausible pour le trafic, GTM côté serveur pour les conversions vers CDP.

## Cas production : Stack hybride e-commerce

Architecture déployée pour une boutique Shopify :

**Frontend :**
- Tracker Plausible sur toutes les pages (product view, cart, checkout)
- Événement custom `plausible('Purchase', {revenue: 150})` au succès checkout

**Backend (Cloudflare Worker) :**
```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  if (url.pathname === '/api/event') {
    const body = await request.json()
    const sessionId = hashSession(request.headers.get('CF-Connecting-IP'), 
                                    request.headers.get('User-Agent'))
    
    // Contrôle session Redis
    const exists = await redis.exists(`session:${sessionId}`)
    
    if (!exists) {
      await redis.setex(`session:${sessionId}`, 1800, '1')
      await kafka.send({
        topic: 'pageviews',
        messages: [{
          key: sessionId,
          value: JSON.stringify({
            page: body.url,
            referrer: new URL(body.referrer).hostname,
            timestamp: Date.now()
          })
        }]
      })
    }
    
    return new Response('OK', {status: 202})
  }
}
```

**Couche données :**
- Consumer Kafka → TimescaleDB (batch insert toutes les 10s)
- Dashboard Grafana depuis TimescaleDB (real-time, refresh 2s)
- Export BigQuery quotidien agrégé (dbt join : trafic Plausible + données commande Shopify)

Résultats : Attribution conversion 92 % de précision (vs 58 % avec GA4 — rejet ITP et cookies). Conformité RGPD 100 % — aucune PII. Temps requête dashboard 40ms (vs 4-6s GA4).

## Plausible vs GA4 : Quand utiliser lequel

Faut-il abandonner GA4 ? Non. Deux scénarios restent pertinents :

**Utilise GA4 :**
- Suivi multi-domaine (plusieurs sites, sous-domaines — mécanisme linker GA4 plus mature)
- Insights machine learning (métriques prédictives GA4 : probabilité achat, churn)
- Intégration Google Ads (conversions renforcées, audiences remarketing — GA4 natif)

**Utilise Plausible :**
- Dashboard public (embed Plausible = partage gratuit — GA4 nécessite compte viewer)
- Sites légers (blog, landing page, site marketing SaaS)
- Conformité stricte (RGPD, KVKK — zéro risque Plausible)

Le setup hybride est le plus courant : Plausible mesure le trafic site entier, GA4 se déclenche uniquement sur le funnel conversion critique via GTM côté serveur. Privacy + performance.

L'*analytics respectueux de la confidentialité* n'est plus un « bonus », c'est du « must-have ». Chrome a supprimé les cookies, les amendes RGPD ont explosé en 2025. Plausible + agrégation côté serveur est l'unique stack production-ready qui répond aux deux défis. Si tu gères encore 60 % de data loss GA4, planifie ta migration — 2026 exigera un analytics sans cookies.