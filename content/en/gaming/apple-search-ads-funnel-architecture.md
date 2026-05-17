---
title: "Apple Search Ads: Building Campaign Architecture as a Funnel"
description: "A guide to transforming Apple Search Ads campaign structure into funnel architecture by combining discovery, competitor, brand, and broad match modes using budget flow logic."
publishedAt: 2026-05-17
modifiedAt: 2026-05-17
category: gaming
i18nKey: gaming-005-2026-05
tags: [apple-search-ads, asa-campaign-architecture, mobile-user-acquisition, aso-strategy, funnel-structure]
readingTime: 8
author: Roibase
---

Managing Apple Search Ads with a single campaign type is like acquiring all users at the same price point. In 2026, competition density in the App Store has made this approach economically unsustainable. The CPA gap between discovery search and exact brand match spans 4–7x. Campaign architecture that ignores this spread breaks your D7 LTV/CAC ratio within the first week. The funnel approach partitions budget into intent-level tiers, optimizing for the right metric at each stage.

## Discovery Search: The Entry Tier of Budget Flow

Discovery campaigns operate in Apple Search Ads' broad match mode, delivering visibility while users search at the category level. On generic queries like "puzzle game" or "strategy rpg," if your app signals category strength sufficiently, TTR (Tap-Through Rate) reaches 3–5%. The goal at this stage is not conversion, but assembling a pool of quality users. Custom product page (CPP) creative testing is critical—test 3 CPP variants within the same campaign and aggregate IPM (Install Per Mille) data within 2 weeks. Roibase's [App Store Optimization](/en/aso) work merges CPP creative strategy with ASA campaign architecture at this point.

In discovery campaigns, bid strategy should target impression share, not max CPA. If broad match impression volume stays low, the campaign cannot learn. Targeting a minimum of 50K impressions in the first 7 days is necessary for Apple's machine learning algorithm to capture intent patterns. Standard practice: start initial bid at 150% of category average CPI, then reduce to 120% after 3 days. Budget pacing should be "standard," not "accelerated"—sudden traffic spikes can depress D1 retention by 8–12%.

The measurement metric in discovery is not install, but D1 retention and initial session length. If a user from a generic keyword stays 4+ minutes in the first session, flag this signal for remarketing at the competitor or brand stage. Apple's SKAdNetwork 4.0 conversion value structure enables this granular segmentation—low, medium, and high intent buckets can be split based on session data within the first 24 hours.

## Competitor Campaigns: Intent Hijacking and Benchmark Arbitrage

Competitor campaigns target rival game names via exact and broad match combinations. On modifier queries like "clash of clans alternative" or "candy crush similar," users already signal active churn—dissatisfied with their current game, seeking alternatives. This segment's D7 retention may be 15–22% lower than organic, but CPI runs 40–60% cheaper. The arbitrage opportunity lies in this gap: the churned user's LTV is lower, but acquisition cost is much lower, compressing payback to 14–21 days.

Creative strategy in competitor campaigns must be aggressive. CPPs that directly reference a rival game's core mechanic can push TTR to 8–12%. However, Apple's editorial review policy blocks specific trademark usage—"like [brand]" is prohibited, but "for fans of match-3 games" passes. Creativity within this boundary is key: use the rival's signature color palette, UI pattern, or character silhouette to create implicit association.

Bid strategy in the competitor segment should be dynamic. When a rival game releases an update and retention spikes, that keyword's CPI rises 30–50% due to lower churn. Rather than holding bids flat and losing impressions, increase bids 20% to preserve volume—the rival's update normalizes retention in 2–3 weeks, and you can cut bids then. Automate hourly bid adjustments via the Apple Search Ads API for this tactic.

### Competitor Segment Quality Control

Fraud risk runs high in competitor traffic. Install farms generate fake installs on competitor keywords, draining campaign budget. To prevent this:

- Pause keywords where D0 retention falls below 15% within 48 hours
- Within the same ASA campaign, audit device fingerprint patterns from 3+ competitor keywords (fraud typically originates from the same device farm)
- Analyze source keyword distribution of users landing in the "tier-3" bucket on SKAdNetwork conversion value once weekly

## Brand Defense: Organic Cannibalization and CPI Arbitrage

Brand campaigns protect your own game name via exact match. On searches like "Roibase Game" or "roibase rpg," competitors bid and siphon organic impressions. Without brand campaign investment, you rank #1 organically but impression share caps at 60–70%—the rest goes to rivals. A modest brand campaign bid ($0.5–1.5) pushes impression share to 95%+ and CPI to $0.2–0.8 because users already intent to install.

The metric to optimize in brand campaigns is not CPI, but organic cannibalization rate. If opening a brand campaign drops organic installs 20%+, paid impressions are cannibalizing organic traffic. Two strategies: either cut brand bid 50% to reach 80% impression share (leaving room for organic), or hold aggressive bids and capture the uplift—total installs rise, sending ranking signals to the App Store algorithm, and 3–4 weeks later organic install volume recovers.

Creative variation is unnecessary in the brand segment. Users already know your game; CPP A/B testing shifts TTR by only 1–2%. Instead, update App Store screenshot sets seasonally: holiday-themed graphics at year-end, Halloween themes in October—organic conversion lifts 6–9%.

## Broad Match Expansion: Trade-off Between Volume and Quality

Broad match mode lets Apple Search Ads' machine learning expand keywords automatically. When successful patterns from discovery scale to broad match, the algorithm discovers new intent-aligned queries. Uncontrolled, this spirals into ultra-generic keywords like "free games" or "best new apps"—and CPI triples or quadruples.

Negative keyword management in broad match campaigns is critical. Download the search terms report every 48 hours and add keywords with <1% CTR to your negative list. However, if you add as exact negative, the entire intent pattern blocks—risking volume loss. For example, adding "free puzzle" as exact negative is correct, but adding "free" as phrase negative also blocks "free to play puzzle."

To optimize bid in broad match, use cohort-based CPA targets. Set CPA target to 60% of D7 LTV for the first 3 days, then reduce to 50% in days 4–7. This way, the algorithm captures high volume during initial learning while shifting to quality during optimization. Automate this via Python scripts polling the Apple Search Ads API every 6 hours and adjusting bids based on cohort retention data.

### Broad Match Budget Allocation

Broad match campaigns should not exceed 25–35% of total ASA budget. The reason: volume is unpredictable. Apple's algorithm opens new keywords based on trends, creating sudden spikes. Without caps, broad match can consume 70% of daily budget in a single day. Use campaign-level daily caps plus portfolio-level budget management to control this.

## Funnel Architecture: Budget Waterfall and Remarketing Signals

Link the four campaign types as a funnel by setting priority: Discovery → Competitor → Broad → Brand. Discovery gathers the initial user pool; users hitting D1 retention >40% signal into competitor and broad campaigns (via SKAdNetwork postback); brand acts purely as remarketing in the final stage.

Apple Search Ads' Custom Audience feature activates here: export users who installed from discovery and completed 5+ levels in the first session as an audience segment, then apply as a bid modifier (+30–50%) to competitor campaigns. If these users search competitor keywords again, higher bids capture them—because initial signal has validated quality.

To measure funnel architecture, use marginal CPA instead of blended CPA. Calculate each campaign type's incremental contribution: pause brand for 1 week, measure organic install change, net difference is brand's incremental value. Repeat for competitor, broad, and discovery over 4 weeks. Some campaigns may show negative incremental (cannibalizing organic)—cut their budget.

The final funnel stage integrates with the [Premium Publisher Program](/en/premiumyayinci). If ASA users hit D30 retention >25%, seed this cohort into premium publisher networks for lookalike expansion. ASA provides the quality seed audience; premium networks find programmatic lookalikes. Running correlation analysis between the two channels with a 14-day lag shows ASA quality signals lift programmatic campaign performance 18–25%.

Building Apple Search Ads campaign architecture as a funnel means defining cost and metric targets suited to each intent level. Allocate 20% of budget to discovery, 25% to broad, 30% to competitor, 15% to brand, and 10% as test budget. This split optimizes blended CPA while preserving volume. In 2026, visibility in the App Store matters more than installs themselves—funnel architecture makes that visibility economically sustainable.