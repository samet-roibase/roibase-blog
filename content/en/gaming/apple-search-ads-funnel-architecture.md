---
title: "Apple Search Ads: Building Campaign Architecture as a Funnel"
description: "Structure discovery, competitor, brand, and broad match modes with funnel logic. Integrate ASA campaigns with LTV and optimize by D7 ROAS, not install volume."
publishedAt: 2026-06-03
modifiedAt: 2026-06-03
category: gaming
i18nKey: gaming-005-2026-06
tags: [apple-search-ads, asa-funnel, mobile-acquisition, match-type-strategy, gaming-ua]
readingTime: 8
author: Roibase
---

Using Apple Search Ads as a keyword-based PPC tool ended in 2021. In 2026, ASA is a funnel operation. Campaign layers spanning discovery to brand are budgeted by LTV estimates and optimized by D7 ROAS, not install count. Most teams still run broad match in a single campaign and complain that "we can't scale." The problem isn't budget—it's architectural design.

## Discovery Campaign: Mining the Cold Traffic Pool

Discovery campaign is built to read search behavior from users who've never heard of your app on the App Store. Broad match targets 200-500 generic keywords, daily budget stays low (tier-1: $50-100), but search impression share approaches 100%. The goal isn't install volume—it's collecting Search Match data.

Analyze the Search Match report 72 hours after campaign launch. Which queries generated impressions, which keywords drove installs, which are spam? This data validates or contradicts your ASO strategy. For example, if metadata emphasizes "puzzle" but Search Match shows high TTR on "idle game" queries, there's a mismatch between ASO and UA.

CPT (cost per tap) in discovery is 35-50% lower because competition is sparse on unknown keywords. But conversion rate (tap-to-install) is weak. This is normal. Discovery's job is feeding the funnel, not generating install volume. 200-300 weekly installs is enough; 15% goes to your negative keyword list, the rest filters to competitor and brand layers.

### Discovery Budget Rule

Discovery's daily budget shouldn't exceed 10-15% of total ASA spend. Example: on $30k monthly ASA spend, allocate $100/day to discovery. Budget is fixed, no CPA target, manual bidding ($0.30-$0.50 tier-1). After 14 days, high-performing keywords from Search Match migrate to your competitor campaign as exact match.

## Competitor Campaign: Bidding on Rival Brands

Competitor layer targets rival game brand names via exact match. "Candy Crush," "Clash of Clans," "Subway Surfers"—brand terms live here. Strategy is opportunistic, not aggressive. If a competitor max-bids their own brand term, your bid stays at 60-70%, position one isn't the target.

Competitor campaign CPT is 80% higher than discovery, but TTR climbs to 12-18% (vs. 3-5% in discovery). Install conversion is weak because the user was searching for another game. D1 retention stays at 25-30%, compared to 45-50% on organic installs. But in some scenarios, it expands your total LTV pool.

Competitor layer's KPI is "incremental ROAS." When you pause a rival keyword, does your total install count drop 10%? If yes, the campaign drives incrementality. If no, the same user already came through discovery or brand—cannibalization. A 14-day incrementality test is mandatory.

| Match Type | CPT (tier-1) | TTR | D7 ROAS Target | Budget Share |
|---|---|---|---|---|
| Discovery (broad) | $0.40 | 3-5% | Test mode | 10% |
| Competitor (exact) | $1.20 | 12-18% | 80%+ | 25% |
| Brand (exact) | $0.60 | 25-35% | 200%+ | 50% |
| Generic (broad) | $0.70 | 6-9% | 120%+ | 15% |

## Brand Campaign: Protecting Your Own Brand

Brand campaign runs to prevent competitors from capturing users searching your game's name. Terms like "Roibase Puzzle," "Roibase Game," "Roibase RPG" are exact-matched. Max bidding is used here because organic ranking can lose to competitor ads.

Brand campaign CPT is lowest (tier-1: $0.40-$0.80). TTR is 25-35%, install CR is 60-70%, D7 retention 50%+. This user already knows your game; they were going to install. The question: "Would this user complete an organic install without the brand campaign?" Usually yes—but if competitors bid your brand term, the campaign becomes mandatory.

Brand budget represents 40-50% of total ASA spend. This looks large, but it's a defensive position. When competitors target your brand keywords, you must defend—MAD (mutually assured destruction) equilibrium. By 2026, nearly every game on tier-1 runs brand defense; those that don't lose 10-15% of organic installs.

### Brand Campaign Pause Test

If competitors don't target your brand terms, pause the campaign for 7 days. Does organic install count drop? If no, the campaign inflates UA spend without incremental value. If yes (typical: 8-12% drop), keep it active but apply a CPA cap—set the ceiling at 15% of organic user LTV.

## Broad Match Mode: Discovery Isn't Scale

Broad match shouldn't be confused with discovery. Discovery uses broad match but runs low bid + low budget. Broad match scale campaign runs high bid + high budget to win impression share on generic terms. Keywords like "puzzle game," "idle rpg," "strategy mobile" live here.

Broad match risk: irrelevant queries. You bid on "puzzle," but Search Match shows you on "puzzle solver app," "puzzle table." Your negative keyword list must exceed 200 terms. Manual control is mandatory the first 7 days—daily Search Match review.

Broad match budget shouldn't exceed 15-20% of total ASA spend. Example: on $30k monthly, allocate $5k to broad match. CPA target is 20-30% higher than exact match campaigns because it operates higher in the funnel. D7 ROAS target is 100-120%. If it falls below, lower the bid—don't pause. The campaign continues collecting data.

## Budget Flow: Shifting Through Funnel Stages

Healthy ASA architecture moves users from discovery to brand. A user exposed to your game in discovery often searches your game's name on the App Store within 48-72 hours—now your brand campaign captures them. Apple's "Custom Product Page" attribution data measures this flow: which campaign drives first touch, which drives install?

Budget distribution works like this: discovery stays fixed ($100/day), competitor and broad match adjust weekly by CPA performance (±10-20%), brand campaign runs always-on at maximum budget. When total spend falls below D7 ROAS target, pause competitor first, then broad match; discovery and brand continue.

Example flow: In May, discovery drove 250 installs. 12% (30 users) searched your brand term within 72 hours and installed via brand campaign. That cohort's average LTV was 40% higher than direct discovery installs. This proves discovery creates not just direct value but indirect brand lift.

### Funnel Attribution Table

```
Campaign         | Spend    | Installs | Direct LTV | Assisted Installs | Blended LTV
----------------|----------|----------|------------|-------------------|-------------
Discovery       | $3,000   | 250      | $4.20      | 30 (brand)        | $5.80
Competitor      | $7,500   | 420      | $6.10      | 15 (brand)        | $6.50
Brand           | $15,000  | 1,200    | $12.40     | —                 | $12.40
Broad Match     | $4,500   | 310      | $5.30      | 22 (brand)        | $6.00
```

## Campaign Budget Optimization: Apple's New Algorithm

Since 2025, Apple Search Ads has been testing "Campaign Budget Optimization" (CBO). It mirrors Google App Campaigns' portfolio bid strategy: single budget, multiple campaigns, machine learning routes spend to best-performing campaigns. CBO is risky in gaming UA. The algorithm ignores D7 ROAS targets and maximizes install volume only.

Enable CBO and brand campaign will claim 70-80% of budget because CPA is lowest there. Discovery and competitor dry up. Result: installs don't fall initially, but funnel-top feeding stops; three weeks later, brand campaign installs begin declining. Use CBO only when combining similar-CPA campaigns—brand + broad match, for example.

## Which Layer Gets Paused When It Underperforms?

Pause decisions hinge on incrementality, not CPA. If competitor campaign runs 30% above CPA target but pausing it drops total installs 8%, the campaign is incremental—keep it, optimize the bid. If broad match matches CPA target but pausing changes nothing, it's cannibalizing—shut it down.

Discovery never pauses. Budget can shrink, but not to zero. Discovery's job isn't immediate ROAS—it's testing ASO hypotheses and feeding Search Match data. Brand campaign never pauses either. If competitors target your brand term, you maintain defense.

Integrating ASA funnel architecture with [App Store Optimization](https://www.roibase.com.tr/en/aso) strategy is non-negotiable. Keywords emphasized in metadata must align with terms targeted in ASA campaigns. If a keyword shows unexpected high TTR in discovery, adding it to ASO metadata lifts install CR by 10-15%.