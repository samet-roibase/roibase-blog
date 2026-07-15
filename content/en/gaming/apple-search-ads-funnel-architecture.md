---
title: "Apple Search Ads: Building Campaign Architecture as a Funnel"
description: "Structural guide to organizing discovery, competitor, brand, and broad match campaigns as funnel layers and optimizing budget flow through performance signals."
publishedAt: 2026-07-15
modifiedAt: 2026-07-15
category: gaming
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, aso, mobile-growth, funnel-architecture, campaign-structure]
readingTime: 8
author: Roibase
---

Managing Apple Search Ads as isolated campaign types instead of an interconnected funnel architecture changes the rules of the performance game. Discovery, competitor, brand, and broad match modes may seem independent, but when organized as funnel layers, each campaign feeds signals upward to those above it and receives qualified traffic from those below. As of mid-2026, most mobile gaming growth teams still manage campaigns in silos, which costs them 30–40% in CPT efficiency. This guide explains how to architect your campaigns using funnel logic, direct budget flow according to performance signals, and why [App Store Optimization](https://www.roibase.com.tr/en/aso) integration is critical.

## Funnel Logic: Each Campaign Type Sits at a Different Layer

Apple Search Ads has four core campaign types: discovery (Search tab), competitor (rival brand queries), brand (your own brand queries), and broad match (wide category terms). Rather than viewing them as separate channels, think of them hierarchically: discovery sits at the top, capturing unaware users. Broad match sits in the middle—intent signals exist but competition is high. Competitor targets a narrower slice of already-qualified users who have searched for a rival. Brand sits at the bottom—these users already know you. Reverse this hierarchy and your budget distribution collapses. Allocate 60% to brand and you'll get conversions, but you won't grow your user pool. Go the opposite direction and give discovery 70%, and your CPT drops—but retention crumbles because cold traffic hits your funnel without proper warm-up.

In funnel logic, each layer feeds signals to the layers above it. If discovery users hit D7 retention above 12%, you write that segment's profile into your broad match negative keyword list, making broad targeting tighter. If competitor campaigns show IPM (installs per mille) below 8%, that rival's user base doesn't overlap with yours—kill the campaign. When brand CPA suddenly jumps 40%, your [App Store Optimization](https://www.roibase.com.tr/en/aso) rank has dropped; the problem isn't the campaign, it's metadata. Manage campaigns in isolation and these signals vanish.

Budget flow follows the same logic. Discovery gets 40–50% upfront because it fills the user pool. After 3–4 weeks, once retention profiles stabilize, you shift to 30% broad match and 30% discovery. Brand stays fixed at 15–20% because already-aware users cost less but the pool is finite. Competitor is optional—tier-1 markets (US, UK) can justify 10–15%, but emerging markets (LATAM, SEA) don't because brand awareness is low.

## Discovery Campaigns: Your Cold Traffic Testing Lab

Discovery campaigns appear on the Search tab. Users open the app, and at the bottom they see "You might also like" suggestions. Intent signals are weak—the user may not even be searching in your game's category. Your goal here isn't install volume; it's extracting user segment profiles. Use discovery as your A/B test arena: deploy 4–5 different creative sets (via custom product pages), expose each to 5,000 impressions for a week, then cross-check IPM against D1 retention. Anything below 4% IPM gets cut. IPM between 6–8% paired with sub-35% D1 retention means your creative is misleading—fix the closing scene.

Discovery's budget logic is: spend aggressively the first two weeks (50% of total budget), then drop to 30% once data stabilizes. Never cut it entirely because without discovery, you lose the cold-traffic testing signal that feeds your broad match and competitor strategies. By 2026, Apple Search Ads' machine learning stabilizes in 72 hours—CPA hits a plateau by day three. If volatility persists into day five, your targeting is too broad. Add age, gender, or geography filters.

You don't use keywords in discovery—Apple matches automatically. You can apply negative keywords, especially terms tied to competitor game types. (If yours is match-3, make "battle royale" negative.) One trap: Apple also suggests based on category. If your game lands in "Casual" but plays like a "Puzzle," you've picked the wrong category in metadata. The fix isn't campaign tuning—it's [App Store Optimization](https://www.roibase.com.tr/en/aso) metadata correction (category change + subtitle refinement). If discovery underperforms, the first step is an ASO audit, not budget increases.

## Competitor and Broad Match: Quality Filtering and Budget Dynamics

Competitor campaigns only make sense in tier-1 markets. In Turkey, Brazil, Indonesia—where brand awareness is lower—users search general category terms, not rival names. A million US users search "Candy Crush"; Turkey sees 50,000. Allocating budget to competitor campaigns in Turkey yields negative ROI. If you're in tier-1, keep competitor tight: target only 3–5 games you directly compete with. Each keyword needs minimum 5% TTR (tap-through rate); below that, your creative can't pull rival users. Change icon + screenshot sets.

In competitor campaigns, bid aggressively: up to 120% of your maximum CPA because rival users are qualified—they've played a similar game. After two weeks, measure LTV and D30 retention. If competitor users convert 15% worse on retention, that segment doesn't mesh with your game mechanics—shut it down. Common mistake: "If the rival is big, their users will work for us too." Wrong. A PUBG Mobile user is nothing like an Among Us player, even if both are in the "battle royale" bucket.

Broad match campaigns target category terms: "puzzle game," "strategy rpg," "idle game." Keywords can be set to exact or broad. Start broad, pull the search terms report in one week, and negative-keyword anything irrelevant. Example: your game uses merge mechanics, but broad match is pulling "match-3" queries. Add "match-3" as negative. Broad match budget should sit at 25–35%—more and you waste discovery segment insights; less and you miss volume.

## Brand Campaign: Defense and ASO Health Indicator

Brand campaigns target your game's own name. "But we're already #1 organically, why spend?" is the wrong question. Even if you rank first organically, competitors can bid on your brand name in Search Ads—they'll appear when users type your game's name. Brand campaigns protect that traffic. Plus, CPA here is the lowest on your funnel (often 1/5th of discovery), so allocating 15–20% of budget yields positive ROI.

Brand campaigns serve a second function: they're your ASO health indicator. If brand CPA suddenly spikes (30% in two weeks), your organic rank has dropped. Organic visibility falls, so more users tap your Search Ads placement, Apple charges you more. You can't fix this with campaign optimization—you fix it with ASO metadata updates (keyword density, subtitle, IAP naming) and rating/review management. Use brand campaigns as an early-warning system.

Bid aggressively on brand keywords: up to 150% of maximum CPA. If a competitor also bids on your brand, a bidding war happens; if you lose, traffic goes to them. Some teams bid low on brand because "organic will cover it"—that strategy only works without competition. In tier-1 markets, competition always exists, so brand campaigns are active defense, not passive.

## Budget Flow Scenario: 4-Week Pilot

Say you have $15,000 over 30 days and you're launching a new idle RPG in the US. Week one: discovery 50% ($1,875), broad 25% ($937), brand 20% ($750), competitor 5% ($187). Competitor is low because no segment profile exists yet. Over the first seven days, discovery brings 2,500 installs. You measure D1 retention—32% comes back. You wait a week to measure D7.

By day 14, D7 retention lands at 18% (acceptable for idle RPG). Discovery users break down as 60% male 25–34, 30% female 18–24. You add these filters to broad match campaigns. Revise budget: discovery 35%, broad 35%, brand 20%, competitor 10%. Segment profile now exists, so broad match will work with better targeting.

By day 21, competitor campaigns delivered 150 installs with 22% D1 retention—10 points lower than discovery. That segment doesn't fit your game. Kill competitor, shift that 10% to broad match. Final week: discovery 30%, broad 45%, brand 25%. This distribution now stays fixed because the funnel has balanced. After 30 days: 7,200 total installs, $2.08 blended CPA, 9.5% D30 retention—solid baseline for tier-1 idle RPG.

## Measurement and Iteration: Which Signals You Watch

Once you've built funnel architecture, measurement happens at three levels: campaign (CPA, IPM, TTR), funnel (D1/D7/D30 retention), and economics (LTV/CAC). Each campaign type has its own metrics. Discovery lives on IPM and D1 retention alone—don't wait for LTV because this is cold traffic. Broad match hinges on D7 retention—below 15% is unacceptable. Competitor prioritizes TTR—below 5% means weak creative. Brand flags ASO problems via CPA spikes.

Your weekly iteration loop runs like this: Monday morning, pull campaign metrics from Apple Search Ads Console, get retention data from your MMP (Adjust, AppsFlyer), read LTV projections from your BI dashboard. By Friday, decide: which creative sets close, which keywords go negative, which campaigns get budget increases. Every two weeks, make bigger moves: rebalance funnel budget distribution, test new geos, refresh ASO metadata.

One trap: Apple Search Ads constantly nags you to raise budget. Don't increase every time it prompts. First check if you're spending 100% of the current allocation—if below 80%, you're not getting enough impressions, so targeting is the problem, not budget. Above 95% and CPA is in-target? Increase, but no more than 20%—sudden spikes break the learning curve.

## ASO Integration: Feed Campaign Metadata

Apple Search Ads campaigns can't run independently from [App Store Optimization](https://www.roibase.com.tr/en/aso). The metadata your campaigns display—icon, screenshot, subtitle, promotional text—comes from your App Store page. If discovery shows low IPM but competitor shows high, your icon feels generic. Competitor searchers have high intent already, so they tap even if the icon is plain. Cold traffic (discovery) judges by visuals; weak icons get scrolled.

Custom product pages (CPPs) plug this gap. Apple now lets you assign different CPPs per campaign. Discovery gets bold, animated screenshot sets. Brand gets minimal, logo-forward design. Competitor gets rival comparison (within guidelines). Skip this separation and you're running all campaigns on one-size-fits-all metadata. Funnel conversion can't optimize. During your [App Store Optimization](https://www.roibase.com.tr/en/aso) process, build CPP strategy in parallel with campaign architecture.

ASO metadata refreshes every 4–6 weeks as Apple's algorithm shifts. Keyword density updates, rating/review management prevents churn signals, IAP naming tests price. Changes directly impact campaign performance. Example: you swap "merge" for "build" in your subtitle. One week later, broad match reports jump in "build game" queries—add that keyword manually. ASO and Search Ads belong to the same team, working the same sprint cycle.

## Conclusion: Architecture Isn't One-Time Setup, It's a Dynamic System

Building campaign architecture as a funnel doesn't finish in 30 days. First 30 days is pilot, next 60 is stabilization, then continuous iteration. Budget flow shifts 10–15% monthly because your game's live ops calendar (events, seasons, IAP sales) reshapes campaign dynamics. Discovery runs hot and two weeks later broad match jumps because the user pool is full. Brand CPA rises and you fix ASO—you don't raise campaign budget.

Before building this structure, ask: Is segment profiling clear? Do you have a retention baseline? Is ASO metadata testable? Is your MMP (mobile measurement partner) integration healthy? Without these four pieces, funnel architecture disappoints. With them, first 90 days shows 30–40% budget efficiency gains—each campaign type works in its proper layer, fed by the right signals. Now look at your current campaign split. If it's not funnel-based, this month's pilot should follow the 4-week model outlined above.