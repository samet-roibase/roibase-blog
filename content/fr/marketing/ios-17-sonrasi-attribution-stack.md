---
title: "La Stack d'Attribution Post-iOS 17"
description: "ATT, SKAdNetwork 4 et modeled conversions : reconstruire l'attribution sur iOS en 2026 avec une stratégie pratique pour l'ère post-lookback mûre."
publishedAt: 2026-06-02
modifiedAt: 2026-06-02
category: marketing
i18nKey: marketing-003-2026-06
tags: [ios-attribution, skadnetwork, att, modeled-conversions, mobile-measurement]
readingTime: 8
author: Roibase
---

Cinq ans se sont écoulés depuis qu'Apple a déployé App Tracking Transparency sur iOS 14.5. Depuis ce jour, les hypothèses fondamentales du mobile performance marketing ont changé. L'attribution au niveau de l'utilisateur déterministe est morte, les modèles probabilistes et agrégés sont devenus inévitables. Avec iOS 17 et SKAdNetwork 4, le nouveau schéma de conversion value, la fenêtre post-lookback mature et les modeled conversions, le jeu se restructure. Dans cet article, nous vous expliquons comment reconstruire l'attribution sur iOS en 2026, quels signaux utiliser et dans quel ordre, et comment combiner MMP + tests d'incrémentalité pour prendre des décisions éclairées.

## L'Anatomie de l'Attribution Post-ATT

Avant iOS 14.5, les MMP (Adjust, AppsFlyer, Kochava) pouvaient lire l'IDFA au niveau de l'appareil et attribuer directement chaque conversion à une campagne. Avec ATT, ce mécanisme s'est fermé pour plus de 95 % des utilisateurs (données Statista 2025, taux d'opt-in autour de 7 %). Aujourd'hui, nous disposons de trois couches :

**1. Déterministe (utilisateurs IDFA opt-in) :** Pour le segment de 7 % qui accepte le suivi, le flux MMP classique fonctionne toujours. Timestamp du clic/impression, installation, événement in-app — tout au niveau utilisateur. Mais ce segment n'a plus de pouvoir représentatif ; c'est un échantillon biaisé.

**2. SKAdNetwork (agrégée, postback) :** Le cadre privacy-first d'Apple. Fenêtre d'attribution 0-72 heures ; conversion value limitée à 6 bits (0-63). Avec SKAdNetwork 4, des deuxième et troisième postbacks ont été ajoutés (8-35 jours), permettant maintenant de mesurer la rétention D7-D30.

**3. Modeled conversions :** Les conversions que les MMP prédisent par apprentissage automatique. Combinaison de données de clics/impressions agrégées + compte d'installations + signal SKAN. Moins fiable que déterministe, mais offre l'échelle.

Nous sommes obligés d'utiliser ces trois couches ensemble. Aucune seule n'est suffisante : IDFA est trop étroite, SKAN est agrégée et retardée, modeled repose sur la prédiction. Construire une stack qui équilibre ces trois est devenu une compétence clé.

## Les Apports de SKAdNetwork 4

SKAdNetwork 4 (arrivé avec iOS 16.1, maturisé sur iOS 17) apporte trois grandes innovations :

### Hiérarchie de Conversion Value et Chaîne de Postbacks

Au lieu d'une seule valeur 6-bit, il y a désormais trois postbacks : premiers 0-2 jours, deuxième 3-7 jours, troisième 8-35 jours. Chaque postback porte sa propre valeur 6-bit. Cela permet de séparer le signal IAP précoce (install-to-purchase <48h) du signal de rétention du deuxième postback (nombre de sessions D3-D7). Auparavant, nous devions compresser tous les signaux dans 64 slots, maintenant nous avons 64×3 = 192 combinaisons (en pratique, 64+64+64 encodage séquentiel).

**Exemple de mapping :**
- **Postback 1 (0-2 jours) :** Statut IAP D0 (0 = aucun événement, 1-10 = tranche de revenu, 11-20 = SKU spécifique, 21-63 = mélange personnalisé)
- **Postback 2 (3-7 jours) :** Niveau de rétention D3-D7 (0 = churn, 1-20 = bande de nombre de sessions, 21-40 = profondeur d'engagement)
- **Postback 3 (8-35 jours) :** Proxy D30 LTV (0-63 = tranche cumulative de revenu)

Pour construire correctement cette structure, il faut revoir le mapping de conversion value chaque semaine. Car à mesure que le comportement des utilisateurs change, le signal le plus informatif se déplace d'un slot à l'autre.

### Identifiant Source et Hierarchical Source ID

SKAdNetwork 4 affiche les ID des app éditeurs et des sous-réseaux publicitaires dans une hiérarchie à quatre niveaux. Vous voyez désormais non plus « ça vient de Meta » mais « Meta → Audience Network → App Publisher X » (si le réseau publicitaire l'expose). Cela permet de comparer les performances des sous-éditeurs.

En pratique, les jardins fermés comme Facebook, TikTok et Google n'exposent pas entièrement ce champ, mais cela crée une différence critique pour les réseaux programmatiques et les vidéos récompensées.

### Support d'Attribution Web-vers-App

Avec iOS 17.4, SKAdNetwork a commencé à supporter les clics web. Si un utilisateur clique sur une bannière Safari et se rend à l'App Store pour installer, cela entre également dans le postback SKAN. Pour les marques exécutant une stratégie UA web + app combinée, la possibilité de combiner ce signal avec les campagnes [Performance Marketing (PPC)](https://www.roibase.com.tr/fr/ppc) et de calculer l'incrémentalité inter-canal est maintenant possible.

## Modeled Conversions : Comment Cela Fonctionne, Quand C'est Fiable

Les modeled conversions constituent le mécanisme par lequel les MMP combinent les postbacks SKAN, les nombres agrégés d'impressions/clics et les comptages d'installations pour effectuer l'attribution probabiliste par apprentissage automatique. AppsFlyer appelle cela « predictive analytics », Adjust l'appelle « statistical modeling » — techniquement la même chose : régression + inférence bayésienne.

**Conditions pour être fiable :**
1. **Volume de données suffisant :** Au moins 500+ installations par jour, 50+ conversions par campagne (SKAN ou IDFA). En dessous, le modèle surapprenait.
2. **Cohérence du signal SKAN :** Le mapping de conversion value doit être stable. Si vous le changez quotidiennement, le modèle ne peut pas saisir les motifs historiques.
3. **Étalonnage par test d'incrémentalité :** Au minimum un test par trimestre (geo-holdout ou time-based holdout). Vous comparez les chiffres modeled aux lifts réels et appliquez une correction de biais.

**Mauvais exemple d'utilisation :** Vous lancez une nouvelle campagne, 20 installations en 3 jours, le MMP dit « modeled 15 IAP ». C'est du bruit pur — taille d'échantillon insuffisante. Attendez au moins 2 semaines.

**Bon exemple d'utilisation :** Sur 30 jours, Meta + TikTok + Google UAC ensemble livrent 50K installations, SKAN envoie 3K postbacks de conversion. Le MMP en modélise 8K. Au cours de la même période, un test geo (France vs Allemagne) holdout montre un lift de +12 %. Vous révisez le nombre modeled à 8K × 1,12 = 8,96K. C'est fiable.

## Maturité Post-Lookback : Signaux Après 35 Jours

Le troisième postback de SKAdNetwork 4 transporte des événements 8-35 jours. Après le jour 35, aucun postback SKAN n'arrive. Mais le comportement réel des utilisateurs ne s'arrête pas à 35 jours : rétention D60, LTV D90, renouvellement d'abonnement annuel et autres signaux existent.

**Approches de solution :**

1. **Projection LTV basée sur cohorte :** Ajustez une courbe LTV de cohorte en utilisant les données SKAN + modeled conversion des 35 premiers jours (généralement power law ou exponential decay). Vous extrapolez le LTV 90-180 jours. C'est une estimation, mais avec une taille de cohorte suffisante, la variance est faible.

2. **Holdout inter-canal et incrémentalité :** Pausez un canal pendant 2 semaines, mesurez les changements dans l'installation organique et le revenu in-app. Calculez l'incrémentalité nette, remplissez le signal post-35 jours avec ce test. Faites-le trimestriellement.

3. **Enrichissement d'événement côté serveur :** Envoyez les événements de fin de cycle (renouvellement d'abonnement, IAP à gros montant) qui ne figurent pas dans le postback SKAN au MMP par serveur-à-serveur. Ce n'est pas déterministe mais crée des motifs à l'échelle. Le MMP utilise ce signal comme entrée de modèle.

**Attention :** Apple n'interdit pas explicitement d'envoyer des signaux côté serveur au niveau utilisateur en dehors de SKAN, mais que le MMP le présente comme une revendication d'attribution au niveau utilisateur viole la politique. L'utiliser comme entrée de modélisation agrégée n'est pas un problème.

## Scénario de Configuration Pratique de Stack

Disons que vous avez une app fitness basée sur abonnement. Votre base d'installation iOS est de 60 %, vous ciblez 100K nouvelles installations par mois. Voici votre stack d'attribution :

| Couche | Outil | Rôle | Niveau de confiance |
|--------|------|------|---------------------|
| Postback SKAN | AppsFlyer | Valeur de conversion 0-35 jours + source ID | 95 % (Apple vérifie) |
| Modeled Conversions | Prédictif AppsFlyer | Attribution probabiliste SKAN + agrégée | 70-80 % (calibré par test geo) |
| Opt-in IDFA | Données brutes AppsFlyer | Segment déterministe de 7 % | 100 % (mais pouvoir représentatif faible) |
| Incrémentalité | GeoLift (Meta) + holdout personnalisé | Mesure de lift au niveau canal | 90 % (statistique, mais coûteux) |
| Projection LTV | dbt interne + BigQuery | Ajustement de courbe de cohorte, prédiction 90-180 jours | 60-70 % (précision du modèle) |

**Flux :**
1. Extrayez quotidiennement les postbacks SKAdNetwork pour chaque campagne.
2. Prenez les conversions modeled d'AppsFlyer, mais laissez 20 % de marge de confiance au moment du calcul du CPA au niveau campagne.
3. Exécutez un test geo-holdout mensuel (ex. : Meta pause en Espagne, continue au Portugal). Calculez le lift net.
4. Trimestriellement, mettez à jour la courbe LTV de cohorte. Régressez la corrélation du signal SKAN des 35 premiers jours sur le revenu des 90 jours.
5. Affectez le budget à partir de la moyenne pondérée de SKAN + modeled + incrémentalité.

Cette approche multi-couches est-elle coûteuse ? Oui. Mais si le trafic iOS représente 60 % et que CAC est de 30 $ + par utilisateur, le coût de l'erreur d'attribution est beaucoup plus élevé.

## Compromis et Contre-Arguments

**« Les modeled conversions ne sont pas fiables, pourquoi les utilisons-nous ? »**

Parce qu'il n'y a pas d'alternative. SKAN est agrégée, IDFA est à 7 %, ne pas avoir de signal du tout signifie voler à l'aveugle. Les modeled conversions sont imparfaites mais calibrées. Avec les tests holdout pour corriger le biais, vous obtenez une précision de 75-80 % — bien mieux que sans données.

**« SKAdNetwork 4 est-il suffisant, ou devrions-nous attendre le 5 ? »**

SKAdNetwork 5 (arrivé avec iOS 18, annoncé à l'été 2024) promet un source ID plus granulaire et une fenêtre de lookback plus longue, mais l'adoption complète n'est pas encore là. La base d'utilisateurs iOS 17 est > 70 %, iOS 18 autour de 30 %. Construire votre stack sur SKAdNetwork 4 et ajouter les fonctionnalités 5 de manière progressive est pragmatique.

**« Le test d'incrémentalité est-il nécessaire pour chaque campagne ? »**

Non. L'incrémentalité est coûteuse et lente. Un test par canal tous les trimestres suffit (Meta Q1, TikTok Q2, Google Q3). Pour les petites campagnes, faites confiance au mélange modeled + SKAN ; pour les gros mouvements de budget, testez.

---

L'attribution iOS n'est plus déterministe ; c'est maintenant une discipline probabiliste + agrégée + guidée par les tests. Mapper correctement la structure tripostback de SKAdNetwork 4, calibrer les modeled conversions avec les tests holdout et projeter le LTV post-35 jours par projection de cohorte sont les nouvelles opérations standard de 2026. Si vous construisez votre stack sur ces trois couches — SKAN + modeled + incrémentalité — vous échapperez au vol à l'aveugle sur iOS et pourrez prendre des décisions d'allocation de budget éclairées par les données.