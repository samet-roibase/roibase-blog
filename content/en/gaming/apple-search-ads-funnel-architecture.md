---
title: "Apple Search Ads: Building Campaign Architecture as a Funnel"
description: "Budget flow from discovery to brand: how to structure broad match, competitor, and exact campaigns as a hierarchical funnel—ASA architecture for mobile game growth."
publishedAt: 2026-06-17
modifiedAt: 2026-06-17
category: aso
i18nKey: gaming-005-2026-06
tags: [apple-search-ads, asa-campaign-architecture, mobile-user-acquisition, app-funnel-strategy, brand-defense]
readingTime: 8
author: Roibase
---

Building Apple Search Ads campaigns as interconnected funnel layers rather than isolated silos—where budget and signals flow from discovery through brand defense—can reduce CPI by 20–40% in mobile game growth. User signals captured in broad match discovery feed into competitor exact campaigns; competitor exact flows into brand defense; each layer filters for the next. Post-iOS 18.2, custom product page attribution data makes this architecture mandatory: single-campaign approaches hide churn, budget distribution stays manual.

## Discovery Layer: Why Broad Match Must Be at the Top

Broad match campaigns are the discovery layer of Apple Search Ads hierarchy—they exist to uncover new keyword clusters and capture unexpected intent signals. Yet most studios leave broad match open on "try everything, filter later" logic, burning $500–1,000 daily with TTR (Tap-Through Rate) under 2.5%. The right approach: position broad match at the top of your funnel, but **control the CPP floor with a 3-day rolling window**.

In broad campaigns, the target isn't CPI—it's **LTV/CPI ratio**. A 0.4x ratio in the first 3 days is acceptable because that keyword data goes into your warehouse. The value is here: Search Match algorithm reveals your game's competitive set through Apple's eyes. When you launch "puzzle game" as broad match, the algorithm surfaces intent clusters like "merge," "match-3," "interior design"—these become migration candidates for your competitor exact campaigns.

Critical setting: **never add exact negatives to broad match**. Negative keywords should apply only to irrelevant categories (e.g., "poker," "casino" if you're a different game type). Exact negatives break the algorithm's learning loop and kill discovery function.

### Broad Match Daily Budget Formula

```python
daily_budget_broad = (target_monthly_installs * 0.15) * target_CPI * 1.8
# 0.15 → discovery allocation (%15)
# 1.8 → broad CPI multiplier (1.8x exact is acceptable)
```

Example: 10K monthly install target, $2.5 target CPI → $6,750/month broad budget → ~$225/day. Exceeding this ceiling means you're wasting, not discovering.

## Competitor Exact: The Intent Hijacking Layer

Keywords from broad match that include **competing game names** and **rival brand terms** should move to the second layer—competitor exact campaigns. The logic is straightforward: hijack competitor brand awareness. A user searches "Candy Crush"; you show your puzzle game—intent is already educated, you're just offering an alternative.

Competitor exact TTR runs 30–50% lower than brand exact (Apple's own data), but CPI is typically 15–25% cheaper because bid competition on competitor keywords is lighter. What matters: **customize your product page strategy by layer**. If a rival game is "time management" focused, your CPP creative should message "less waiting time"—without this differential positioning, competitor exact ROI stays negative.

Common mistake in competitor keyword selection: grab the top 20 from the gross-revenue chart. Right method: **audience overlap analysis**—pull the competing game's user demographics from Sensor Tower or data.ai; pick rivals with 60%+ overlap with your audience. If you have a hyper-casual game, don't bid on match-3 legend keywords—core motivation differs.

| Competitor Type | TTR Benchmark | CPP vs Brand Delta | Use Case |
|---|---|---|---|
| Direct competitor (same subgenre) | 3.5–5% | +15–20% | Yes, high priority |
| Adjacent genre (similar core loop) | 2.8–4% | +25–35% | Yes, test it |
| Category leader (different mechanic) | 1.5–2.5% | +50%+ | No, waste risk |

## Brand Defense: Why Your Own Name Gets Its Own Campaign

Brand exact—your game name, studio name—is the funnel's bottom layer and **cheapest conversion engine**. On Apple Search Ads, brand keyword CPT (Cost Per Tap) typically runs $0.10–0.30, while broad match sits at $1.50–3. Yet most studios skip brand campaigns thinking "users already searching for us will download organically"—that's 12–18% of install loss.

Why? Because competitors bid on *your* brand terms too. You own "Puzzle Master," but a rival bids $2 on that keyword for "Match Kingdom." Apple's auction algorithm picks the winner based on relevance + bid; if you don't bid, sometimes rivals win. Brand defense campaigns exist to block that hijack.

TTR on brand exact runs 18–35%—very high, because intent is certain. Your job here: **exact match only**, bid $0.50–1.00 (enough to outbid rivals), and craft CPP creative around "new season" or "update" messaging—users who know the game already need fresh reason to tap.

### Brand Campaign Bid Strategy

```python
if competitor_bid_on_brand:
    brand_bid = competitor_avg_bid * 1.3  # Outbid rivals
else:
    brand_bid = 0.3  # Minimal, let organic + paid blend
```

Keep **Search Match off** in brand campaigns—the algorithm sometimes expands brand terms to irrelevant keywords, creating budget leak.

## Budget Flow Between Layers: Waterfall Architecture

Rather than managing three layers with isolated budgets, running **waterfall budget allocation** lifts ROAS by 25–40%. The idea: each layer hits performance threshold, overflow budget cascades up—balancing discovery investment against conversion efficiency.

Waterfall rules:
1. **Brand exact always fully funded**—no budget ceiling if ROI is positive
2. **Competitor exact feeds brand**—if competitor campaign hits LTV/CPI > 1.2, overflow budget doesn't go to new competitor keyword tests; it stays for brand scale
3. **Broad match capped at 15%**—never exceed 15% of total ASA budget on broad, or your funnel becomes top-heavy

You can automate this with Apple Search Ads API (2026 Campaign Management API v5.0 has budget adjustment endpoints):

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

Running this endpoint daily via BigQuery + Airflow automates budget flow—when manual reallocation happens every 3 days, reaction lags and opportunity loss hits 8–12%. In Roibase's [App Store Optimization](https://www.roibase.com.tr/en/aso) work with mobile game studios, this automation is standard practice.

## Negative Keyword Strategy: Preventing Leakage Between Funnel Layers

When you run broad, competitor, and brand separately, **keyword overlap** risk emerges—the same search term triggers across all three campaigns, creating self-bidding wars. Apple's auction won't show multiple campaigns from one advertiser, but bid waste happens: the highest bid wins, others lose impressions but still reserve budget.

Solution: **cross-campaign negative sync**. Here's how:
- Every keyword added to brand exact → add as exact negative to competitor exact
- Every keyword in competitor exact → add as phrase negative to broad match
- Keywords converting in broad → move to competitor or brand in 14 days, remove from broad

You cannot do this manually (2,000+ keywords = 40 hours/week). Hourly sync via Python script or ASA automation tool is mandatory:

```python
# Pseudo-code
brand_kws = get_keywords(campaign_type="brand_exact")
comp_kws = get_keywords(campaign_type="competitor_exact")

for kw in brand_kws:
    add_negative(campaign="competitor_exact", keyword=kw, match="exact")

for kw in comp_kws:
    add_negative(campaign="broad_match", keyword=kw, match="phrase")
```

Skip negative sync and average CPI inflates 18–25%—not waste, but inefficiency. The cost of reaching the same user across three campaigns instead of one.

## The Attribution Trap in Funnel Architecture

Apple Search Ads attribution window is 30 days—a user who taps a search ad and installs within 30 days gets attributed to that campaign. But **multi-touch reality** complicates this: user sees broad match, doesn't install, searches your brand exact 5 days later, installs—attribution goes to brand, broad's contribution vanishes. This pattern drives broad budget cuts, killing discovery.

Solution: **assisted conversion modeling**. Pull impression + tap data from Apple Search Ads API, build a multi-touch attribution model in BigQuery. Using Markov chain or Shapley value, assign contribution share to each campaign. Example finding: broad match delivered 120 direct installs last 30 days but contributed to 840 assisted conversions—true value is 7x.

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

This query shows how often broad and competitor campaigns assisted brand installs—without this data, broad looks "expensive, inefficient," gets cut, and funnel breaks.

## Keeping Funnel Architecture Alive

Apple Search Ads funnel architecture isn't static—new keyword discovery every week, competitive landscape shifts monthly, genre trends pivot quarterly. Keeping your funnel alive requires **3-week review cycle**:

1. **Week 1–2:** Pull broad Search Match report → discover new keyword clusters
2. **Week 3:** Performance data → identify competitor exact migration candidates
3. **Week 4:** Monitor brand keyword hijacking → track rival bid activity

Apple Search Ads Console's manual reporting isn't enough—daily API pulls + Looker Studio dashboard are needed. In Roibase's work with mobile game studios, this dashboard surfaces: TTR by funnel stage, cross-campaign keyword overlap %, assisted conversion rate, LTV/CPI by layer.

Run funnel architecture with this discipline, and Apple Search Ads becomes your single biggest UA channel—CPI controlled, LTV transparent, scale predictable. Discovery, competitor, brand—each layer feeds signals and budget to the next. Instead of isolated campaign silos, you're building an ecosystem. As iOS privacy tightens through 2026, this architecture shifts from luxury to necessity—playing on Apple's platform, with Apple's attribution, in Apple's auction is the most stable growth channel post-IDFA.