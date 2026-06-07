---
title: "Privacy-First Analytics: Plausible + Agrégation Côté Serveur"
description: "Architecture de mesure sans cookies : suivi compatible RGPD/CNIL avec Plausible Analytics, agrégation serveur et alternative pratique à GA4."
publishedAt: 2026-06-07
modifiedAt: 2026-06-07
category: data
i18nKey: data-006-2026-06
tags: [privacy-first-analytics, cookieless-tracking, plausible, rgpd-conformite, server-side-aggregation]
readingTime: 9
author: Roibase
---

Google Analytics 4 n'a rien résolu. Les Consent Management Platforms sont une pile compressée de chaque outil, et beaucoup d'organisations souffrent toujours de pertes de données entre 40 et 60 %. L'obligation du Consent Mode v2 en Europe, l'augmentation des audits CNIL en France et les restrictions de durée de vie des cookies après ITP 2.0 d'Apple convergent vers une seule question : « Et si nous n'utilisions pas du tout les cookies ? » Plausible Analytics répond « oui » à cette question, une alternative open source que l'on peut approfondir avec l'agrégation côté serveur. Dans cet article, nous expliquons l'architecture sans cookies de Plausible, sa conformité RGPD/CNIL et ce qu'il échange différemment de GA4, en le ramenant à une architecture concrète.

## Pourquoi Plausible Peut Être Sans Cookies

Plausible n'identifie pas l'utilisateur, ne suit pas la session, pourtant vous pouvez voir la distribution des sources de trafic, la performance des pages et les tunnels de conversion. Cela est possible grâce à un décalage de priorité entre les unités de mesure. GA4 fonctionne dans la hiérarchie événement > utilisateur > session ; Plausible fonctionne dans la hiérarchie pageview > referrer > goal. Quand un visiteur arrive sur site.com/produit depuis un referrer X, Plausible enregistre cette information : `{timestamp, url, referrer, device_type, country}`. Pour ces cinq champs, aucun cookie, aucun fingerprinting, aucun localStorage n'est nécessaire. L'adresse IP est anonymisée avec un hash quotidien tournant—cela permet de marquer que la deuxième visite du même utilisateur dans les 24 heures « n'est pas un bounce » mais aucune identité persistante n'est conservée.

Les outils d'analytics classiques construisent un identifiant persistant pour répondre à la question « utilisateur unique ». Plausible ne pose pas cette question. Au lieu de cela, il dit « 340 personnes sont venus sur la page /pricing aujourd'hui, 12 % ont rempli le formulaire ». Si l'optimisation marketing se concentre sur le variant de landing page, la distribution des canaux et la conversion des tunnels—ce qui est suffisant pour 80 % des sites SaaS, e-commerce et lead-gen—le modèle sans cookies n'entraîne aucune perte. Vous n'avez pas besoin du panneau User Explorer de GA4 car User Explorer est de toute façon risqué du point de vue RGPD.

Exemple pratique : une entreprise B2B SaaS veut mesurer le taux de conversion du formulaire de démo. Avec Plausible, vous définissez l'événement `pageview:/demo` comme objectif, puis utilisez la fonction Funnel de Plausible pour suivre le flux `/pricing → /demo → /merci`. Si ce flux montre 1200 démarrages, 480 formulaires et 89 pages de remerciement sur 7 jours, la conversion est de 7,4 %. Avec GA4, pour effectuer la même mesure, vous devez contrôler User ID, Client ID et Session ID, être prêt à lire les conversions modélisées en Consent Mode. Avec Plausible, ces valeurs sont directement à l'écran.

## Conformité RGPD et CNIL : Différence de Perspective

L'article 4 du RGPD définit les données « anonymisées » comme des données qui « ne se rapportent pas à une personne physique identifiée ou identifiable ». L'approche de hachage IP de Plausible respecte cette définition : l'adresse IP passe par un hash SHA-256 avec un salt tournant quotidien, le hash n'est pas conservé, il est simplement conservé en mémoire pendant cette journée pour détecter les visites en doublon. La décision de la CJUE (C-582/14 Breyer) classe l'adresse IP comme « donnée personnelle », donc un hash sans salt n'est pas suffisant—Plausible élimine ce risque avec salt tournant + politique de suppression.

Dans le modèle GA4, même avec Consent Mode v2, les données modélisées « prédisent » le comportement de l'utilisateur—ce processus de prédiction peut toucher à l'article 22 du RGPD sur la « prise de décision automatisée ». La CNIL n'a pas encore clarifi é ce point, mais la position prudente est de préférer les données réelles aux données modélisées. Plausible enregistre des pageviews réels, pas des prédictions. De plus, en France, la CNIL a clarifié que les cookies d'analytics nécessitent un consentement explicite. Avec Plausible, puisque vous ne stockez pas d'identifiants persistants, le cookie n'entre pas en jeu—techniquement, vous n'avez pas besoin de banner de consentement. Cependant, par prudence, certains cabinets juridiques recommandent quand même une mention « nous mesurons les pages de manière anonyme ».

Le coût de conformité change aussi radicalement à ce point. Une moyenne boutique en ligne pour la pile GA4 + GTM + OneTrust facture ~€12 000–18 000 par an en licences (hors GA360). Le plan Plausible Business est €99/mois, soit €1 188/an—90 % d'économies. L'entreprise peut aussi simplifier sa Politique de Cookies de 4 pages à 1 paragraphe : « aucun cookie tiers ». Le fichier journal à soumettre à la CNIL est aussi plus simple : les événements agrégés de Plausible, sans champs user_id, client_id, session_id.

### Les Limites de la Mesure Sans Banner de Consentement

Sans cookies ≠ sans consentement requis—ne pas confondre. Plausible traite l'adresse IP, donc techniquement traite des données, sauf que ces données ne « relèvent pas de l'analyse » dans le sens RGPD. Le considérant 26 du RGPD dit « les données anonymes sont en dehors du champ d'application du RGPD » mais certaines autorités de protection des données (par exemple le BfDI allemand) peuvent still considérer le hash IP comme « techniquement réversible ». En France, la CNIL n'a pas encore créé de jurisprudence à ce niveau, mais pour les entreprises opérant en Europe, il faut suivre la guidance de l'EDPB. En pratique, les sociétés qui utilisent Plausible either (1) ne mettent aucun banner et justifient « données anonymes » (risque juridique plus élevé), soit (2) ajoutent « nous effectuons une mesure anonyme pour l'analytics » dans leur politique de confidentialité (plus sûr juridiquement).

## Approfondissement avec l'Agrégation Côté Serveur

Le dashboard de Plausible affiche des métriques au niveau des pages, mais la plupart des équipes marketing posent cette question : « Quelle campagne amène des utilisateurs qui regardent 50+ pages ? » Cette segmentation au niveau utilisateur n'est pas une fonctionnalité native de Plausible, mais elle peut être ajoutée avec l'agrégation côté serveur. L'architecture fonctionne comme ceci : l'API Plausible Events expose chaque pageview en JSON, vous extrayez ce stream dans BigQuery, créez une session avec dbt, puis analysez cross-session dans un outil BI (Looker, Metabase).

Exemple de modèle dbt (simplifié) :

```sql
WITH raw_events AS (
  SELECT
    timestamp,
    page_url,
    referrer,
    country,
    device,
    -- Le hash IP peut servir de proxy de session sur une fenêtre de 24 heures
    farm_fingerprint(concat(ip_hash, date(timestamp))) AS session_id
  FROM {{ source('plausible','events') }}
)
SELECT
  session_id,
  min(timestamp) AS session_start,
  count(*) AS pageviews,
  countif(page_url like '%/checkout%') AS checkout_views,
  any_value(referrer) AS entry_referrer
FROM raw_events
GROUP BY session_id
```

Avec ce modèle, vous pouvez produire des insights comme « 30 % des sessions avec 5+ pageviews proviennent de la recherche organique »—ce modèle n'existe pas dans l'interface Plausible mais existe dans BigQuery. Le point critique : Session ID est toujours non persistant, juste un hash de 24 heures. Vous reconstituez des sessions du point de vue RGPD, mais pas des identités utilisateur. Pour préserver cette différence, utilisez `farm_fingerprint(concat(ip_hash, date(timestamp)))`—quand la date change, le hash change aussi, le suivi multi-jour est impossible.

Le travail de Roibase sur [First-Party Veri & Architecture de Mesure](https://www.roibase.com.tr/fr/firstparty) construit ces pipelines hybrides : Plausible sans cookies en frontend, sGTM + Conversion API côté serveur, BigQuery pour l'agrégation de session au centre. Cette pile vous permet de rester conforme RGPD tout en optimisant les tunnels sans avoir besoin de l'User Explorer de GA4.

## Comparaison GA4 : Ce Que Vous Gagnez, Ce Que Vous Perdez

Les points forts de GA4 : suivi multi-appareils (User ID), métriques prédictives (probabilité d'achat), intégration Google Ads, conversion modélisée. Plausible ne fait aucune de ces choses. Le compromis est clair : GA4 répond à « qui est cet utilisateur, que fera-t-il », Plausible répond à « comment cette page/campagne performe-t-elle ». Pour l'e-commerce, lequel est critique ? Si vous analysez les cohortes de lifetime value et la rétention, GA4 est nécessaire. Si la priorité est de trouver le gagnant du test A/B de la landing page, de comparer le ROI des canaux PPC et d'identifier les points de chute du tunnel, Plausible suffit.

Scénario concret : une marque DTC avec 50 000 visiteurs mensuels. Taux de consentement GA4 45 % (trafic européen), Plausible 100 % (pas de consentement requis). GA4 voit 22 500 utilisateurs, Plausible voit 50 000 pageviews. GA4 tente de combler le vide avec conversion modélisée mais il y a une incertitude de modèle. Plausible enregistre les pageviews bruts, zéro incertitude de modèle. Si la décision marketing est la distribution du budget par canal (organique 30 %, réseaux sociaux payants 25 %, direct 20 %), les données de Plausible sont plus fiables—zéro sampling, zéro biais de consentement. La segmentation au niveau utilisateur de GA4 (par exemple « utilisateurs qui ont ajouté 3+ produits au panier mais n'ont pas finalisé ») n'est pas native dans Plausible, elle doit être construite manuellement via l'agrégation BigQuery décrite ci-dessus.

La différence de coût est aussi pertinente : GA4 est gratuit, mais à mesure que vous approchez les limites de GA360 (volume d'événements, rétention de données), la tarification démarre à €150 000/an. Le plan Plausible Business à €99/mois gère 10M pageviews/mois. Pour petite-moyenne échelle, Plausible est économique ; pour grande échelle (50M+ événements/mois), la solution auto-hébergée de Plausible est nécessaire—mais cela ajoute les coûts d'infrastructure.

L'écosystème d'intégration avantage GA4 : export BigQuery, Looker Studio, Google Ads, Firebase, Search Console connexion native. Les intégrations de Plausible passent par l'API Events et nécessitent une configuration personnalisée. Par exemple, le flux Plausible → BigQuery nécessite un connecteur Airbyte ou une Cloud Function. GA4 → BigQuery est click-and-run. Cette différence est un compromis qui nécessite une capacité technique.

## Pour Quelles Entreprises le Modèle Privacy-First a du Sens

Trois profils se distinguent. Première : B2B SaaS, logiciels d'entreprise, conseil—déjà trafic majoritairement anonyme, pas besoin d'User ID, funnel simple. Deuxième : marques DTC opérant fortement en Europe—risque de sanction RGPD élevé, taux de consentement bas, cookieless devient une nécessité. Troisième : éditeurs de contenu—pageview et referrer suffisent, ils ne font déjà pas de profilage au niveau utilisateur.

À l'inverse, pour les acteurs de l'e-commerce la décision est plus complexe. Amazon, Trendyol et autres marketplaces doivent absolument faire du suivi au niveau utilisateur car le moteur de recommandation, la récupération du panier abandonné et la tarification dynamique dépendent de l'historique utilisateur. Ces sociétés peuvent utiliser Plausible non pas à la place de GA4 mais à côté de GA4—pages publiques (blog, centre d'aide) avec Plausible, funnel de paiement avec GA4. Le modèle hybride se généralise : site marketing sans cookies, application produit avec cookies. Techniquement, c'est possible via séparation de sous-domaine (www.site.com Plausible, app.site.com GA4).

Pour les startups, notre recommandation : commencez avec Plausible à la phase MVP, ajoutez GA4 après le seed funding. Pendant les 6 premiers mois, vous ne faites pas d'analyse de cohorte utilisateur de toute façon, le ROI de canal et la performance de landing page suffisent. Après Series A, la rétention, le LTV et la modélisation prédictive entrent en jeu, c'est à ce moment que vous construisez la pile GA4. Cette approche réduit le risque de conformité et introduit progressivement la complexité d'analytics.

---

L'analytics privacy-first évolue de « qu'est-ce que nous perdons » à « qu'est-ce que nous gagnons ». L'architecture Plausible + agrégation côté serveur garantit trois valeurs : conformité RGPD/CNIL, couverture de données 100 % (zéro biais de consentement), coût faible. En échange, vous abandonnez le profilage au niveau utilisateur et les métriques prédictives. Si votre stratégie marketing se concentre sur l'optimisation des canaux, l'amélioration du tunnel et la performance des pages—ce qui est suffisant pour la plupart des entreprises—le modèle sans cookies n'est pas qu'un outil de conformité, c