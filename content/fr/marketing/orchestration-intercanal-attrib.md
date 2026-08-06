---
title: "Orchestration Intercanal : Attribution Paid + Email + Push"
description: "Intégrer identity graph, lifecycle event mapping et groupes de contrôle pour mesurer la performance cross-canal avec rigueur d'ingénierie."
publishedAt: 2026-08-06
modifiedAt: 2026-08-06
category: marketing
i18nKey: marketing-007-2026-08
tags: [attribution-intercanal, identity-graph, lifecycle-marketing, test-incrementalite, hold-out-groups]
readingTime: 8
author: Roibase
---

La moitié du budget paid media s'écoule en email, la moitié de l'email en push — mais quelle moitié génère vraiment la conversion ? Le problème d'orchestration intercanal en 2026 ne se résout plus en lisant des rapports de performance par canal. Le dashboard Google Ads affiche un ROAS de 4.2, l'équipe email rapporte une hausse de 18 % de conversions sur la dernière campagne. Si le même utilisateur a été exposé aux deux canaux, lequel est le déclencheur ? Répondre "last-touch" ou "modèle multi-touch" n'est plus suffisant. Il faut une infrastructure d'attribution fondée sur un identity graph, validée par lifecycle event mapping et groupes de contrôle.

## Identity Graph : Du Canal à la Personne

Pour orchestrer en cross-canal, il faut d'abord résoudre la question « qui ». Le `GCLID` en paid, le `user_id` en email, le `device_token` en push — chaque canal génère un identifiant différent. Un identity graph est la structure de données qui fusionne ces fragments en une seule personne. Sur BigQuery ou Snowflake, c'est une table nœud-arête : un nœud = un utilisateur, les arêtes = relations entre identifiants.

Une structure typique : le nœud `user_123` porte les arêtes `email:user@domain.com`, `device_token:abc123`, `gclid:xyz789`. Pour construire ce graphe, tu dois fusionner les identifiants à chaque session. Quand l'utilisateur se connecte par email, on lie `user_id` + `device_token`. Quand le clic paid atterrit, le `GCLID` se propage au cookie de session ; l'événement de conversion unit ces trois éléments. Si tu utilises une CDP (Customer Data Platform) comme Segment ou mParticle, cette fusion est native. Sinon, un modèle de snapshot quotidien en dbt suffit :

```sql
WITH user_edges AS (
  SELECT user_id, email, device_token, gclid, session_timestamp
  FROM events
  WHERE user_id IS NOT NULL AND (email IS NOT NULL OR device_token IS NOT NULL)
),
merged_graph AS (
  SELECT DISTINCT user_id,
         FIRST_VALUE(email) OVER (PARTITION BY user_id ORDER BY session_timestamp) AS primary_email,
         FIRST_VALUE(device_token) OVER (PARTITION BY user_id ORDER BY session_timestamp DESC) AS latest_device
  FROM user_edges
)
SELECT * FROM merged_graph;
```

Avant de mettre en production, mesure le taux d'erreur de déduplication. Si plus de 5 % de chevauchement existe (même device_token lié à deux user_id différents), revois la qualité de tes identifiants. Une précision d'identity resolution inférieure à 95 % rend les résultats d'attribution peu fiables.

## Lifecycle Event Mapping : Ordre et Timing des Canaux

L'identity graph répond « qui », le lifecycle event mapping répond « quand et sur quel canal ». Pour l'attribution intercanal, enregistre chaque touchpoint du parcours utilisateur comme un événement horodaté. Exemple de table :

| user_id | event_type | channel | timestamp | campaign_id | revenue |
|---------|------------|---------|-----------|-------------|---------|
| user_123 | ad_click | google_ads | 2026-08-01 10:15 | camp_A | null |
| user_123 | email_open | klaviyo | 2026-08-02 09:00 | email_B | null |
| user_123 | push_click | onesignal | 2026-08-03 14:30 | push_C | null |
| user_123 | purchase | web | 2026-08-03 15:00 | null | 120 |

Pour construire cette table, le tracking server-side est impératif. Les pixels côté client perdent 40-60 % des événements avec la disparition des cookies tiers (selon les rapports du Privacy Sandbox de Chrome en 2025, la perte moyenne s'élève à 52 %). Avec un GTM server-side + cookies first-party, la perte d'événements descend sous 5 %.

Avec le lifecycle event mapping, tu conduis ces analyses :

1. **Time-to-conversion par séquence de canaux :** Si le parcours « Google Ads → Email → Purchase » prend 48 heures en moyenne, tandis que « Email → Push → Purchase » s'achève en 12 heures, push accélère la conversion.

2. **Matrice de chevauchement de canaux :** Combien d'utilisateurs reçoivent une annonce payante ET un email le même jour ? Si le chevauchement dépasse 30 %, une coordination du timing est nécessaire.

3. **Analyse des points de rupture :** Si 60 % des utilisateurs abandonnent entre email et push, le taux de permission push est trop bas.

Exécute ces analyses en pandas Python ou avec des window functions SQL. Sur BigQuery, la fonction `LAG()` ramène l'événement précédent sur la même ligne et crée une matrice de transition de canaux.

## Groupes de Contrôle : Preuve d'Incrémentalité

Ce que dit ton modèle d'attribution et la vraie incrémentalité diffèrent. Le modèle peut affirmer : « Le paid media contribue 40 % des conversions des 7 derniers jours » — mais ces utilisateurs n'auraient-ils pas acheté sans la publicité ? La réponse vient d'un test hold-out.

Un test hold-out fonctionne ainsi : divise aléatoirement l'audience en deux. Le groupe treatment reçoit tous les canaux (paid + email + push), le groupe contrôle n'accède pas à un canal spécifique. Par exemple, pour tester l'incrémentalité du paid media, exclus le groupe contrôle des listes de remarketing Google Ads mais maintiens email et push normaux. Après 14-30 jours, la différence de conversion rate entre les deux groupes est ton vrai lift.

Exemple de structure de test :

- **Groupe treatment :** 50 000 utilisateurs, paid + email + push
- **Groupe contrôle :** 50 000 utilisateurs, email + push (pas de paid)
- **Durée :** 21 jours
- **Métrique mesurée :** Conversion rate, revenue par utilisateur

Si le treatment affiche 3.2 % de conversions et le contrôle 2.8 %, le lift du paid est +0.4 points (soit +14 % en valeur relative). Si ton modèle d'attribution crédite le paid de 40 % mais le test montre seulement 14 %, le modèle surestime.

Pour que le test hold-out réussisse :

- **L'assignation doit être aléatoire :** Partager selon le dernier chiffre du user_id crée un biais d'échantillonnage.
- **La taille d'échantillon doit suffire :** Un calculateur A/B test classique (95 % de confiance, 80 % de puissance) nécessite environ 10 000 utilisateurs par groupe.
- **Synchronise avec la saisonnalité :** Lancer avant Black Friday fausse les résultats.

## Moteur d'Orchestration : La Mécanique de Décision

Fusionne ton identity graph, ton lifecycle event mapping et les résultats hold-out, tu obtiens un moteur de décision capable de répondre : « Quel canal cette personne devrait-elle recevoir maintenant ? » Un moteur basé sur des règles simples peut déjà générer un impact significatif :

```python
def next_channel(user_id, event_history):
    last_event = event_history[-1]
    hours_since_last = (now - last_event.timestamp).hours
    
    if last_event.channel == 'google_ads' and hours_since_last < 24:
        return 'email'  # Réchauffer après paid
    elif last_event.channel == 'email' and last_event.event_type == 'open' and hours_since_last < 6:
        return 'push'  # Push rapide après email ouvert
    elif hours_since_last > 72:
        return 'paid'  # 3 jours sans activité, relancer
    else:
        return None  # Attendre
```

En production, cette logique s'exécute via un DAG Airflow ou un processeur d'événements temps réel (Kafka + Flink). Quand l'utilisateur déclenche un événement, le système récupère son historique des 7 derniers jours, ajoute un score d'incrémentalité (issu du test hold-out), choisit le canal optimal.

Pour une orchestration avancée, intègre un modèle ML : avec LightGBM, prédit « Quelle est la probabilité de conversion si je contacte l'utilisateur X par le canal Y à l'heure Z ? » Les features incluent : segment utilisateur, dernier canal d'interaction, jours depuis inscription, valeur moyenne de commande, fréquence de chevauchement de canaux. La sortie du modèle devient un score de priorité pour chaque canal ; tu sélectionnes le plus élevé.

## Trade-off : Coordination versus Agilité

Quand l'orchestration intercanal s'automatise complètement, un effet secondaire émerge : les équipes canaux ne décident plus de manière autonome. L'équipe email voulant lancer une campagne demain peut s'entendre dire « Ces utilisateurs ont reçu une annonce payante il y a 2 jours ; attends 48 heures ». Cette coordination est théoriquement correcte mais casse la flexibilité opérationnelle.

Gère ce trade-off ainsi :

1. **Autorise les overrides canaux :** Pour les campagnes critiques (lancement produit, vente flash), une équipe peut contourner les règles d'orchestration.
2. **Définis des fenêtres de test :** La première semaine du mois, c'est « libre-service »—les équipes testent indépendamment. Les 3 autres semaines, orchestration active.
3. **Partage le dashboard d'incrémentalité :** Laisse chaque propriétaire de canal voir sa contribution réelle ; la transparence renforce la confiance.

Quantifie aussi le coût de la coordination. Un moteur d'orchestration prend 8-12 semaines à déployer (identity graph + data pipeline + infrastructure hold-out + logique de décision). Pour un petit groupe, le ROI peut prendre 6-9 mois. Si ton budget marketing annuel dépasse $500K, l'investissement vaut le coup. En dessous, une simple séquence de canaux (paid → email → push) suffit.

---

L'orchestration intercanal n'est plus optionnelle. Sans identity graph, tu comptes le même utilisateur trois fois et crois à une fausse efficacité. Sans lifecycle event mapping, tu ignores quelle séquence fonctionne. Sans tests hold-out, ton modèle d'attribution suréstime. En 2026, les équipes qui cassent les silos canal et basculent sur l'orchestration par personne diminuent le CAC de 20-30 % et augmentent la LTV de 15-25 %. Ton stack est-il prêt ?