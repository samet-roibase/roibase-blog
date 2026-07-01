---
title: "Apple Search Ads: Building Campaign Architecture as a Funnel"
description: "Discovery, competitor, brand, broad match — ASA campaign structure that manages budget flow with funnel logic. Install-to-LTV optimization in tier-1 markets."
publishedAt: 2026-07-01
modifiedAt: 2026-07-01
category: gaming
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, asa-campaign-architecture, mobile-user-acquisition, funnel-optimization, gaming-growth]
readingTime: 8
author: Roibase
---

If you're managing Apple Search Ads campaigns with only a single broad match layer, you're spending 40% of your budget on the wrong users. In 2026, ASA's algorithmic learning capacity has increased, but without funnel logic, the machine teaches itself wrong signals. Discovery yields cheaper installs, brand delivers higher D7 LTV — but mixing them kills both. Building campaign architecture as funnel layers isn't just budget efficiency; it's feeding attribution signals correctly.

## Discovery Layer: Using Broad Match as an Exploration Engine

The discovery campaign exists to use ASA's wide network to find new user segments. Broad match, generic keywords, category terms — high install volume, low IPM, but you're generating learning signals. The algorithm doesn't yet know which profile fits your game, and neither do you. Discovery's role is pinpointing which users show engagement within the first 72 hours.

Budget allocation in the discovery layer should be 25-30% of total ASA spending. Go higher and CPI looks cheap but LTV doesn't come back. Go lower and you're cycling within the competitor-found audience instead of reaching new segments. Example: if your monthly ASA budget is $50K, allocate $12-15K to discovery. Campaign goal should be CPIn (cost-per-install), not CPT, because volume matters here, not tap quality.

Keyword strategy:

- Category terms (e.g., "puzzle game", "strategy rpg")
- Broad intent queries ("free games", "offline games")
- Competitor game names (broad match triggers related games too)

In discovery campaigns, narrowing the negative keyword list constricts your learning space. Run the first 2 weeks without any negatives, collect search term reports, then from week 3 onward block search terms with D1 retention below 15%.

## Competitor Layer: Using Exact Match to Steal Rival Users

The competitor campaign targets ASA's highest-intent traffic. A user typing a rival game's name has clear download intent — your job is offering an alternative. Broad match captures "near-miss" searches for competitor names, but the competitor layer should run exact match because budget control is critical. A user searching for a rival game either wants that game, wants alternatives, or is already playing it and seeking something new.

Budget share: 20-25% range. As you add competitor games, this can grow, but don't treat all rivals equally. Tier-1 competitors (market leader, mechanically similar to yours) won't have the same CPI as tier-2 (different mechanics, same user profile). Tier-1 rivals warrant 120-150% bid multiplier; tier-2, 80-100%.

Creative differentiation is decisive in competitor campaigns. The user knows the rival game — your custom product page should compare without explicitly naming. Example: if the rival uses turn-based combat, highlight "real-time PvP". [App Store Optimization](https://www.roibase.com.tr/en/aso) work tailoring CPP variants for this layer lifts IPM by 18-25%.

Negative signals matter: don't re-target users who previously downloaded and deleted a rival's game with that game's keyword. ASA lacks native "previous downloader" signals, but if D1 retention drops below 10%, that segment is burned.

## Brand Layer: Exact Match to Protect Existing Users

Brand campaign is ASA's defensive line. Users searching your game's name already know you — but competitors bid on your brand terms. Without a brand campaign, competitor ads appear above yours, causing 8-12% user loss. This layer generates the lowest CPI but small volume; LTV is highest because users arrive intentionally.

Budget allocation: 10-15% — small but unbroken. Pause your brand campaign and competitors notice within 48 hours, raising their bids. Keyword strategy is game name and variants only:

| Keyword type | Example | Match type |
|---|---|---|
| Game name | "Your Game Name" | Exact |
| Abbreviation | "YGN" | Exact |
| Typo variants | "Your Gam Name" | Broad (typo only) |

Don't test creatives in brand campaigns. Users already know the game; consistency in visuals matters — app icon, game logo, known characters. Custom product page variants confuse them.

Keep bid strategy modest because Apple favors you on brand terms. Even if a rival bids 150% on their brand, your 100% bid ranks above. Never drop to zero — a $0.50 minimum bid prevents rivals from pushing organic listings. 

## Broad Match Mode: Different Use Across Layers

Broad match in ASA isn't one setting; it serves different purposes per layer. In discovery, broad match is an exploration tool — maximum reach, minimal negatives. In competitor, broad match is risky: it triggers irrelevant queries and fragments budget. In brand, broad match applies only to typo variants.

Broad match's learning jumped in 2026, but control mechanisms remain essential. ASA's algorithm learns which search term converts, but can't determine which user profile delivers D7 LTV. So broad match campaigns need 14-day review cycles:

1. **Days 1-7:** Run without any negatives, gather search term reports
2. **Days 8-14:** Add negatives for terms with D1 retention <15%, raise bids 10%
3. **Days 15-21:** Check D7 LTV data, refresh negative list

In broad match campaigns, bid multipliers should be 80-90% for discovery, 100-120% for competitor. When the algorithm hunts "similar queries," bid signals guide it — low bids extend learning time.

## Managing Budget Flow as Funnel Logic

Once campaign layers are built, budget flow works as a funnel. Discovery installs are high-volume but LTV uncertain; competitor installs are mid-volume but LTV predictable; brand installs are low-volume but LTV high. Budget allocation isn't fixed — adjust weekly per LTV reports:

**Week 1 (exploration phase):**
- Discovery 35%
- Competitor 25%
- Brand 15%
- Reserve 25% (held for testing)

**Weeks 2-4 (learning phase):**
- Discovery 30% (ratio falls as negative list grows)
- Competitor 30% (increase for winning competitors)
- Brand 15%
- Reserve 25%

**Week 5+ (optimization phase):**
- Discovery 25%
- Competitor 35% (scale for positive-LTV rivals)
- Brand 15%
- Reserve 25% (seasonal events, feature launches)

Never distribute reserve budget to static campaigns. Save it for seasonal events, new feature launches, or when a rival updates their game. Sudden budget spikes disrupt algorithmic learning; gradual reserve allocation is more efficient.

## Measurement Layer: Ensuring Funnel Architecture Attribution Works

Once campaign layers are live, attribution signals must not corrupt. ASA works natively with SKAdNetwork, but post-install metrics like D7 LTV require MMP integration. AppsFlyer, Adjust, Singular link ASA campaign IDs to cohort analysis. Each layer — discovery, competitor, brand — needs its own campaign ID so you slice LTV by layer.

Without measurement infrastructure, funnel architecture is just budget splitting, not optimization. Each layer has its own success metric:

| Layer | Primary metric | Secondary metric | Negative signal |
|---|---|---|---|
| Discovery | IPM (installs per mille) | D1 retention | CPI >$3 and D1 <15% |
| Competitor | D7 LTV | CPIn | D7 LTV <$2 |
| Brand | CR (conversion rate) | D30 LTV | CPIn >$1.50 |

Analyze metrics on 14-day cycles, not daily, because ASA's algorithm completes learning in 10-14 days. Daily tweaks corrupt signals.

## Testing and Scaling Campaign Architecture

Start with 3 campaigns (discovery, competitor, brand). Under $10K monthly budget? Use multiple ad groups in one campaign, but this structure muddles the LTV layer. Ideal entry-level budget is $15K monthly — enough volume per layer and faster learning.

When scaling, deepen existing layers rather than add new ones. Example: split competitor campaigns into tier-1 and tier-2; segment discovery by geography (tier-1 countries vs. emerging). Each split resets learning, so scale decisions come after LTV stabilizes.

Don't create duplicate test campaigns. ASA makes the algorithm compete with itself. Instead, test product page variants with Creative Sets; apply winning variants across all campaigns. Within the [Premium Publisher Program](https://www.roibase.com.tr/en/premiumyayinci), combine ASA creative test results with cross-channel data (UAC, Meta) to accelerate iteration speed.

Once funnel architecture is built, maintenance is light but continuous. Weekly search term reports, 14-day LTV reports, monthly cohort analysis — skipping this cycle blocks self-optimization. ASA sends you signals; you must return correct signals. Profiles learned in discovery feed into competitor strategy; LTV won in competitor informs brand defense. Campaign architecture works as a dynamic learning loop, not a static checklist.