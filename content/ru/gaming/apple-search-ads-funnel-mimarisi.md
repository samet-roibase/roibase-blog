---
title: "Apple Search Ads: Building Campaign Architecture as a Funnel"
description: "A guide to transforming Apple Search Ads campaign structure into funnel architecture by integrating discovery, competitor, brand, and broad match modes with budget flow logic."
publishedAt: 2026-05-17
modifiedAt: 2026-05-17
category: gaming
i18nKey: gaming-005-2026-05
tags: [apple-search-ads, asa-campaign-architecture, mobile-user-acquisition, aso-strategy, funnel-structure]
readingTime: 8
author: Roibase
---

Managing Apple Search Ads with a single campaign type is like acquiring all users at the same price. By 2026, competition density in the App Store has made this approach economically unsustainable. In the competitive landscape, the CPA difference between discovery search and exact brand match ranges from 4-7x. Campaign architecture that ignores this gap breaks the D7 LTV/CAC ratio within the first week. The funnel approach divides budget into layers aligned with user intent level, optimizing each stage for the right metric.

## Discovery Search: The Starting Layer of Budget Flow

Discovery campaigns operate in Apple Search Ads' broad match mode, providing visibility when users search at the category level. On generic queries like "puzzle game" or "strategy rpg," if the app sends strong enough signals, TTR (Tap-Through Rate) reaches the 3-5% band. At this stage, the goal isn't conversion but building a quality user pool. Custom product page (CPP) creative testing is critical in this layer — test 3 different CPP variants within the same campaign and collect IPM (Install Per Mille) data within 2 weeks. Roibase's [App Store Optimization](/en/aso) work bridges CPP creative strategy with ASA campaign architecture at this point.

In discovery campaigns, bid strategy should target impression share rather than max CPA. If impression volume stays low in broad match, the campaign can't learn effectively. Targeting a minimum of 50K impressions in the first 7 days is necessary for Apple's machine learning algorithm to capture intent patterns. To achieve this, start with an initial bid at 150% of the category average CPI and drop to 120% after 3 days. Budget pacing should be "standard," not "accelerated" — sudden traffic spikes reduce D1 retention by 8-12%.

The measurement metric in discovery isn't installs but D1 retention and initial session length. If a user arrives from a generic keyword and spends 4+ minutes in their first session, this signals are flagged for remarketing in the competitor or brand stage. Apple's SKAdNetwork 4.0 conversion value structure allows this granular segmentation — low, medium, and high intent buckets can be separated based on session data within the first 24 hours.

## Competitor Campaigns: Intent Hijacking and Benchmark Arbitrage

Competitor campaigns target rival game names through exact and broad match combinations. On modified searches like "clash of clans alternative" or "candy crush similar," the user is already showing active churn signals — dissatisfied with their current game, seeking an alternative. This segment's D7 retention can be 15-22% lower than organic users, but CPI is 40-60% cheaper. The arbitrage opportunity lies in this gap: a churned user from a competitor game has lower LTV but much lower acquisition cost, compressing payback period to 14-21 days.

Creative strategy in competitor campaigns must be aggressive. CPP visuals that directly reference the rival game's core mechanic push TTR to 8-12%. However, Apple's editorial review policy blocks specific trademark use — "like [brand]" is forbidden, but "for fans of match-3 games" is acceptable. Creativity within this constraint is key: using the rival game's signature color palette, UI patterns, or character silhouettes creates implicit association.

Bid strategy in the competitor segment should be dynamic. When a rival game releases an update and retention spikes, that keyword's CPI increases 30-50% because churn drops. Rather than maintaining a fixed bid and losing impressions, raising the bid by 20% preserves volume — because the competitor's update typically reverts retention to baseline in 2-3 weeks, allowing you to lower the bid again. Implementing this tactic requires hourly bid adjustment automation through the Apple Search Ads API.

### Competitor Segment Quality Control

Fraud risk is high in competitor traffic. Install farms generate fake installs on competitor keywords, draining campaign budget. To prevent this:

- Pause keywords where D0 retention drops below 15% within 48 hours
- Within the same ASA campaign, check device fingerprint patterns for users from 3+ different competitor keywords (fraud typically originates from the same device farm)
- Analyze source keyword distribution for users landing in the "tier-3" bucket in SKAdNetwork conversion value weekly

## Brand Defense: Organic Cannibalization and CPI Arbitrage

Brand campaigns protect your own game name with exact match. On searches like "Roibase Game" or "roibase rpg," rival games also bid and siphon organic impressions. Without bidding in Apple Search Ads on brand keywords, you rank organically at #1 but impression share stays at 60-70% — the rest goes to competitors. Opening a brand campaign with a low bid ($0.5-1.5) boosts impression share to 95%+ and CPI drops to $0.2-0.8 because the user is already searching for the game with high install intent.

In brand campaigns, the metric to optimize is CPI while managing organic cannibalization. If organic installs drop 20%+ after launching a brand campaign, it signals paid impressions are stealing organic traffic. Two strategies apply: either lower brand bid by 50% to reduce impression share to 80% (giving organic some room), or maintain aggressive bidding and leverage the low CPI to grow the D1 retention cohort. The second approach increases total installs and sends a ranking signal to the App Store algorithm — organic visibility rises, and within 3-4 weeks organic install volume recovers.

Creative variation isn't necessary in the brand segment. The user already knows the game; A/B testing CPP won't move TTR beyond 1-2%. Instead, updating the App Store screenshot set by seasonality is more effective: thematic screenshots for New Year or Halloween increase organic conversion rate by 6-9%.

## Broad Match Expansion: Trade-off Between Volume and Quality

Broad match mode allows Apple Search Ads' machine learning algorithm to perform keyword expansion. When successful keyword patterns from discovery campaigns are fed into broad match, the algorithm automatically discovers new queries with similar intent. However, uncontrolled expansion can drift toward ultra-generic keywords like "free games" or "best new apps," and CPI multiplies 3-4x.

Negative keyword management is critical in broad match campaigns. Download the search terms report every 48 hours and add keywords with CTR below 1% to your negative list. However, if negative keywords are added as phrase match instead of exact match, the entire intent pattern gets blocked — causing potential volume loss. For example, adding "free puzzle" as an exact negative is correct, but adding "free" as a phrase negative also blocks quality queries like "free to play puzzle."

To optimize bid in broad match, use cohort-based CPA targets. Set the CPA target at 60% of D7 LTV for the first 3 days, then drop to 50% for the next 4 days. This allows the algorithm to capture high volume during the initial learning phase while shifting focus to quality in the optimization phase. Automating this bid adjustment with Apple Search Ads API is standard practice — a Python script pulling data every 6 hours and updating bids based on cohort retention data.

### Broad Match Budget Allocation

Broad match campaigns' budget share shouldn't exceed 25-35% of total ASA budget. This is because volume is unpredictable: the Apple algorithm opens new keywords based on trends and creates sudden spikes. Without budget caps, broad match can consume 70% of daily budget in a single day. Use a combination of campaign-level daily caps and portfolio-level budget management.

## Funnel Architecture: Budget Waterfall and Remarketing Signals

To bind the four campaign types together as a funnel, establish a budget waterfall strategy: set priority in order — Discovery → Competitor → Broad → Brand. The discovery campaign builds the initial user pool; users with D1 retention above 40% from this pool signal to competitor and broad campaigns (via SKAdNetwork postback); brand campaigns activate only in the final stage for remarketing.

Apple Search Ads' Custom Audience feature enters here: export users from the discovery campaign who installed and completed 5+ levels in their first session, then use this segment in competitor campaigns as a bid modifier (+30-50% bid). When these users search on competitor keywords again, they're captured with higher bid — because the initial signal has validated quality.

To measure funnel architecture, use marginal CPA instead of blended CPA. Calculate each campaign type's incremental contribution: pause brand campaigns for 1 week, measure organic install change, the net difference is brand campaign's incremental contribution. Repeat for competitor, broad, and discovery. This test takes 4 weeks but reveals each campaign type's true ROI — if some campaigns show negative incremental results (cannibalizing organic), cut their budget.

The final stage of funnel architecture integrates with the [Premium Publisher Program](/en/premiumyayinci). If ASA users show D30 retention above 25%, use this cohort as seed audience for lookalike expansion in premium publisher networks. ASA traffic creates quality seed audience; the premium network then programmatically finds users matching this profile. Correlation analysis with a 14-day lag between channels shows ASA quality signals improve programmatic campaign performance by 18-25%.

Building Apple Search Ads campaign architecture as a funnel means defining cost and metric targets appropriate for each intent level. When budget allocation is set — 20% to discovery, 25% to broad, 30% to competitor, 15% to brand, and 10% remaining as test budget — blended CPA is optimized while volume is preserved. In 2026, visibility in the App Store is harder to achieve than getting installs — funnel architecture is the structural solution that makes this visibility economically sustainable.