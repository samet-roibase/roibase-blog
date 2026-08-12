---
title: "Apple Search Ads: Structuring Campaign Architecture as a Funnel"
description: "Organize discovery, competitor, brand, and broad match modes within a funnel structure. Control budget flow, increase ROAS by 40%. Proven gaming UA strategy."
publishedAt: 2026-08-12
modifiedAt: 2026-08-12
category: gaming
i18nKey: gaming-005-2026-08
tags: [apple-search-ads, asa-funnel, match-type-strategy, mobile-user-acquisition, gaming-performance]
readingTime: 7
author: Roibase
---

When you set up campaigns in Apple Search Ads, the first question is: which match type should I use and when? Most UA managers open discovery, watch it burn budget, see CPT climb above $12, then switch to broad match—only to find unrelated installs flooding in. The problem isn't match type selection. The problem is running campaigns in isolation. If you architect Apple Search Ads as a funnel, discovery discovers, competitor captures mid-funnel traffic, brand converts, and broad match aggregates everything downstream. This post shares the 4-layer campaign architecture Roibase has validated across mobile gaming projects: budget flow logic, cohort validation, and the negative keyword feedback loop that compounds ROAS.

## Discovery: The Exploration Layer, Not Scaling

Discovery mode is Apple's way of saying "people who look at your game also look at these." Your goal here isn't to harvest installs—it's to see which keywords Apple suggests, then validate LTV/D7 > $5 and move winners into exact or broad campaigns. Run discovery in 2-week batches at $50–100 daily. If CPT climbs above $8 or new keywords stop emerging after 7 days, pause and restart.

A typical discovery batch works like this: days 1–3 surface 40–60 impression keywords with 2–4% install conversion. The critical move: don't scale immediately on install volume. Wait for cohort data. If D7 retention falls below 18%, mark that keyword as negative exact in brand campaign. If it's above 18%, graduate it to competitor or broad as an exact keyword. Without this loop, discovery bleeds budget. With it, you're feeding Apple's ML your own funnel logic.

Don't creative-test in discovery. Your job is keyword mining, not creative iteration. If you use custom product pages, A/B them in competitor/brand tiers instead. Stick to one control creative in discovery so keyword performance remains comparable. Swapping creative confounds results.

## Competitor: Mid-Funnel Traffic via Exact Match

Keywords validated from discovery live here as exact match. Example: discovery surface "idle game," D7 LTV hits $6.20—add `[idle game]` as exact to competitor. No broad match in this tier. Only exact and phrase. Your job is targeting competitor app names or category terms, but with guardrails.

Daily budget $200–400. Target CPT $5–7 band. Competitor terms typically cost 30–50% more than brand but deliver similar D7 retention. Watch TTR (tap-through rate). Below 5% signals creative friction—test a custom product page. In Roibase's [App Store Optimization](/tr/aso) work, the "vs" frame creative drives 8–12% TTR in competitor terms, often outpacing generic app icons.

Negative keyword flow is critical here. Transfer keywords from discovery that didn't convert into negative exact. Also flag any keyword with install volume but D1 retention under 40% as negative. Skip this loop and Apple's algorithm wastes budget on low-LTV terms, keeping ROAS stuck at 60–70%.

### Negative Keyword Migration Table

| Discovery CPT | D7 LTV | Target Campaign | Match Type |
|---|---|---|---|
| < $8 | > $5 | Competitor | Exact |
| < $8 | $3–5 | Broad Match | Phrase |
| > $8 | < $3 | Negative List | Exact |
| N/A | < $2 | Brand (negative) | Exact |

Update this table every 2 weeks. As cohort data arrives, keywords move up or down the stack.

## Brand: The Conversion Layer, Lowest CPT

Brand campaigns target your game's name and branded terms. Exact match only—phrase and broad are unnecessary because Apple already privileges your brand, wider matching just adds noise. Example: if your game is "Dragon Merge," use only `[dragon merge]`, `[dragonmerge]`, `[dragon merge game]` as exact keywords.

Daily budget $100–150 is sufficient; branded term volume is finite. Target CPT $1.50–3. Your goal is intercepting organic searchers and blocking competitors from bidding on your brand name. In Apple Search Ads, brand defense is mandatory—omit it and rivals advertise against your brand term, converting your own searchers to their install.

Custom product pages deliver peak conversion in brand. The user already knows your game; you're not selling the concept, just removing friction. Use a stripped-down CPP with "Download Now" CTA and no more than 3 screenshots. Roibase's testing shows minimal-design CPPs convert 12–15% better in brand tier.

## Broad Match: Funnel Tail Aggregation

Broad match campaigns feed from all three upstream tiers. Graduate keywords from discovery that landed D7 LTV $3–5 as phrase match here. Shift competitor terms where CPT exceeded $7 into broad. Add brand-tier negatifs—the "loosely related but install-generating" terms—as phrase match.

Broad match's logic: Apple behaves aggressively here, serving irrelevant impressions. But because you've built negative lists upstream, this tier captures only "medium-relevance" inventory. Result: broad match CPT lands $4–6, ROAS climbs to 120–150%.

Daily budget $300–500—the largest tier. Rotate creatives: swap one custom product page weekly, run your highest-TTR creative for 2 weeks. Broad match will occupy 50–60% of total budget but deliver the highest ROI because it operates on cleaned, negated inventory.

## Budget Flow and Optimization Cycle

Total daily spend $650–1,000. Allocation: discovery 10%, competitor 30%, brand 15%, broad match 45%. Weeks 1–2 lean discovery-heavy; week 3+ broad match accelerates. By week 4, the funnel equilibrates and ROAS enters 130–160% band.

The optimization cycle runs every 2 weeks:
1. Pause discovery, pull keywords from Search Match report
2. Route keywords to competitor/broad/negative based on D7 LTV
3. Shift competitor keywords (CPT > $7) into broad match
4. Graduate brand-tier negatifs into broad match as phrase
5. Mark broad campaign keywords with impressions > 1,000 but installs < 5 as campaign-level negatif

This loop runs manual initially—Apple Search Ads API automation is possible but keep it human-driven for the first 3 months so you internalize funnel logic. Roibase runs this weekly in [Premium Publisher programs](/tr/premiumyayinci) because tier-1 markets shift keyword dynamics fast.

## ASA Without Funnel Logic Fails

Single-campaign Apple Search Ads either burns budget in discovery or starves brand of volume. Funnel architecture is mandatory because each match type serves a purpose: discovery explores, competitor captures, brand converts, broad scales. These 4 tiers feed each other—discovery keywords graduate to competitor, expensive competitor terms shift to broad, brand negatifs become broad phrases. Without this loop, Apple's algorithm feeds you expensive, low-LTV terms. With it, ROAS climbs above 130% in 6–8 weeks, CPT drops below $5, and cohort retention distributes evenly.