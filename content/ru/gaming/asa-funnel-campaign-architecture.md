---
title: "Apple Search Ads: Building Campaign Architecture as a Funnel"
description: "From discovery to brand: budget flow across broad match, competitor, and exact campaigns—how to structure ASA into hierarchical funnel layers for 20-40% CPP reduction."
publishedAt: 2026-06-17
modifiedAt: 2026-06-17
category: gaming
i18nKey: gaming-005-2026-06
tags: [apple-search-ads, asa-campaign-architecture, mobile-user-acquisition, app-funnel-strategy, brand-defense]
readingTime: 8
author: Roibase
---

Structuring Apple Search Ads campaigns as interconnected funnel layers—not isolated silos—that pass budget and signals between stages can reduce CPP by 20-40% in mobile game growth. Discovery signals captured in broad match flow into competitor exact, then into brand defense—each layer filters for the next. Post-iOS 18.2, custom product page attribution data makes this architecture mandatory: single-campaign approaches hide churn, budget allocation stays overly manual.

## Discovery Layer: Why Broad Match Must Sit at the Top

Broad match campaigns are the discovery tier in ASA hierarchy—their purpose is uncovering new keyword clusters and unexpected intent signals. But most studios leave this mode open with a "test everything, filter later" mindset, burning $500-1,000 daily with TTR (Tap-Through Rate) below 2.5%. The correct approach: place broad match at the funnel's top tier, but control CPP via a **3-day rolling window** threshold.

In broad campaigns, the target isn't CPP itself, but **LTV/CPI ratio**—a 0.4x ratio in the first 3 days is acceptable because keyword data flows to your warehouse. This data's value lies here: Search Match's algorithm shows you your game's competitive set from Apple's perspective. When you launch "puzzle game" on broad match, the algorithm surfaces intent clusters like "merge," "match-3," "interior design"—candidates for migration into competitor exact campaigns.

Critical setting: **do not add exact negatives to broad campaigns**. Negatives should only apply to irrelevant categories (e.g., "poker," "casino" if your genre differs). Exact negatives cut the learning loop, killing discovery function.

### Budget Ceiling Formula for Broad Match

```python
daily_budget_broad = (target_monthly_installs * 0.15) * target_CPI * 1.8
# 0.15 → discovery allocation (%15)
# 1.8 → broad CPI multiplier (1.8x exact acceptable)
```

Example: 10K monthly install target, $2.5 target CPI → $6,750/month broad budget → ~$225/day. Exceeding this ceiling means broad becomes waste, not discovery.

## Competitor Exact: Intent Hijacking Layer

From broad match output, extract **competitor game names** and **competitor brand terms**, then move them to the second tier—competitor exact campaigns. This layer's logic is straightforward: hijack competitor brand awareness. User searches "Candy Crush," you show your puzzle game—intent is already educated; you're simply offering an alternative.

Competitor exact's TTR runs 30-50% lower than brand exact (per Apple's own benchmarks), but CPP is typically 15-25% cheaper because bid competition on competitor keywords is lighter. The critical move: **shift custom product page strategy** at this layer. If competitor's game is "time management," your CPP creative should message "less waiting time"—without this differential positioning, competitor exact ROI stays negative.

Wrong approach to competitor selection: grab top 20 from grossing charts. Right method: **audience overlap analysis**—pull competitor demographic from Sensor Tower or data.ai, select those with 60%+ user overlap with you. Hyper-casual game? Don't bid on match-3 legend keywords—audience core motivation differs.

| Competitor Type | TTR Benchmark | CPP vs Brand Delta | Worth Bidding |
|---|---|---|---|
| Direct competitor (same subgenre) | 3.5-5% | +15-20% | Yes, high priority |
| Adjacent genre (similar core loop) | 2.8-4% | +25-35% | Yes, test it |
| Category leader (different mechanic) | 1.5-2.5% | +50%+ | No, waste risk |

## Brand Defense: Why Your Own Name Gets Its Own Campaign

Brand exact—your game name, studio name—is the funnel's bottom tier and its **cheapest conversion layer**. In Apple Search Ads, brand keyword CPT (Cost Per Tap) typically runs $0.10-0.30, whereas broad match sits $1.5-3. But many studios skip brand campaigns thinking "users already searching for us convert organically"—this costs 12-18% in install loss.

Why? Because competitors bid on your brand keywords too. You own "Puzzle Master," but rival "Match Kingdom" bids $2 on your brand term. Apple's auction algorithm selects winners by relevance + bid mix—if you don't bid, competitors sometimes rank above you. Brand defense campaigns exist to prevent this hijacking.

Brand campaign TTR ranges 18-35%—very high, because intent is certain. What you do here: **exact match only**, bid $0.5-1 (enough to outbid rivals), and CPP creative should message "new season" or "update"—users already know the game; you're giving fresh reason to tap.

### Brand Campaign Bid Strategy

```python
if competitor_bid_on_brand:
    brand_bid = competitor_avg_bid * 1.3  # Outbid competitor
else:
    brand_bid = 0.3  # Minimal bid, organic + paid blend
```

In brand campaigns, **turn off Search Match**—the algorithm sometimes expands brand keywords into unrelated terms, creating budget leak.

## Budget Flow Between Funnel Tiers: Waterfall Architecture

Instead of managing three tiers with isolated budgets, deploy **waterfall budget allocation** to lift ROAS 25-40%. Logic: when each tier hits performance threshold, overflow budget passes up—balancing discovery investment with conversion efficiency.

Waterfall rules:
1. **Brand exact always fully funded**—if ROI is positive, no budget ceiling
2. **Competitor exact → feed to brand**—if competitor LTV/CPI > 1.2, overflow goes to new competitor keyword tests, not brand
3. **Broad match → 15% cap**—never exceed 15% of total ASA budget here, or funnel becomes top-heavy

Automate this with Apple Search Ads API (Campaign Management API v5.0 has budget adjustment endpoint in 2026):

```json
{
  "campaignId": 123456,
  "budgetAdjustment": {
    "type": "waterfall",
    "source": "competitor_exact",
    "condition": "LTV_CPI > 1.5",
    "action": "reallocate_to_brand",
    "amount": "overflow"
  }
}
```

Running this endpoint daily via BigQuery + Airflow is standard in Roibase's [App Store Optimization](https://www.roibase.com.tr/ru/aso) work—manual adjustments every 3 days cause lag; opportunity loss hits 8-12%.

## Negative Keyword Strategy: Plugging Leaks Between Funnel Tiers

Running broad, competitor, and brand separately creates **keyword overlap risk**—same search term triggers all three, you bid against yourself. Apple's auction doesn't show multiple campaigns for the same advertiser, but wastes bid: highest bid wins, others get no impression but reserve budget.

Solution: **cross-campaign negative sync**. Here's how:
- Every keyword in brand exact → add as negative exact to competitor exact
- Every keyword in competitor exact → add as negative phrase to broad match
- Keywords converting in broad → migrate to competitor or brand after 14 days, add negative to broad

This sync can't be manual (2,000+ keywords takes 40 hours weekly). Python script or ASA automation tool is mandatory:

```python
# Pseudo-code
brand_kws = get_keywords(campaign_type="brand_exact")
comp_kws = get_keywords(campaign_type="competitor_exact")

for kw in brand_kws:
    add_negative(campaign="competitor_exact", keyword=kw, match="exact")

for kw in comp_kws:
    add_negative(campaign="broad_match", keyword=kw, match="phrase")
```

Without negative sync, average CPI inflates 18-25%—not true waste, but inefficiency. You're reaching the same user across three campaigns simultaneously.

## The Attribution Trap in Funnel Architecture

Apple Search Ads uses 30-day attribution—if a user taps ad and installs within 30 days, it credits that campaign. But **multi-touch reality**: user saw broad match ad, didn't install, searched brand exact 5 days later, installed—attribution goes to brand, broad's contribution vanishes. This biases teams to cut broad budget, killing discovery.

Solution: **assisted conversion modeling**. Pull impression + tap data from Apple Search Ads API, build multi-touch attribution in BigQuery. Markov chain or Shapley value allocates each campaign's true contribution. Example finding: broad campaign drove 120 direct installs last 30 days but assisted 840 conversions—7x real value.

```sql
-- BigQuery multi-touch example
WITH touch_chain AS (
  SELECT user_id, campaign_type, timestamp,
    LEAD(campaign_type) OVER (PARTITION BY user_id ORDER BY timestamp) as next_touch
  FROM asa_events
)
SELECT campaign_type, COUNT(*) as assisted_conversions
FROM touch_chain
WHERE next_touch = 'brand_exact'
GROUP BY campaign_type;
```

This query shows how often broad and competitor campaigns assisted brand installs—without it, broad looks "expensive, inefficient," gets cut, funnel collapses.

## Keeping the Architecture Live

Apple Search Ads funnel architecture isn't static—new keyword discovery weekly, competitive landscape shifts monthly, genre trends shift quarterly. Keep it alive with a **3-week review cycle**:

1. **Weeks 1-2:** Broad match Search Match report → new keyword cluster discovery
2. **Week 3:** Keyword performance data → migration candidates for competitor exact
3. **Week 4:** Brand keyword hijack check → competitor bid activity monitoring

Manual reports in Apple Search Ads Console aren't enough—API daily pulls + Looker Studio dashboard required. In Roibase's mobile game clients, this dashboard surfaces real-time: funnel stage TTR, cross-campaign keyword overlap %, assisted conversion rate, LTV/CPI by layer.

When you run funnel architecture with this discipline, Apple Search Ads becomes your single biggest UA channel—CPI controlled, LTV visible, scale predictable. Discovery, competitor, brand—each tier feeds signal and budget to the next, building ecosystem instead of isolated campaigns. As iOS privacy tightens through 2026, this architecture shifts from luxury to necessity: on Apple's platform, with Apple's attribution, in Apple's auction, it's the most stable post-IDFA growth channel.