---
title: "Apple Search Ads: Structuring Campaign Architecture as a Funnel"
description: "Discovery, competitor, brand, broad match — engineering approach to structuring Apple Search Ads campaign architecture using funnel logic and optimizing budget flow."
publishedAt: 2026-07-29
modifiedAt: 2026-07-29
category: gaming
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, asa-funnel, mobile-growth, app-campaigns, aso]
readingTime: 8
author: Roibase
---

Operating Apple Search Ads through a single campaign type erodes the distinct user journeys at different funnel stages into the same budget pool. A discovery-mode user and one performing a branded search carry completely different costs, intent, and conversion dynamics. Structuring campaign architecture as a funnel introduces disciplined budget allocation per stage and enables reading post-install metrics (D7 retention, LTV) segmented by campaign type. This article breaks down Apple Search Ads architecture into discovery, competitor, brand, and broad match layers, showing how to manage budget flow across each.

## What question is the discovery-mode user asking

Discovery campaigns are Apple Search Ads' automated expansion mechanism — Apple's algorithm surfaces your app across hundreds of queries based on category, user behavior, and semantic match. In this mode, the user isn't searching for a specific app; they carry a broad need like "tower defense game." Impression volume runs high, tap-through rate stays low, and CPA can be relatively cheap, but D7 retention may plateau at 15–20%. Discovery's function isn't brand awareness but hypothesis testing across a broad pool of latent intent.

You cannot lock down discovery into fully controlled inventory by disabling Search Match — Apple keeps this open by default. Your strategy: isolate discovery traffic into its own campaign and manage bidding from impression share targets rather than CPA goals. If you're pulling 500 daily installs at 60% impression share from discovery and D7 retention sits at 18%, you need to tighten that cohort during the first 7 days via push notification and in-app onboarding sequences. Discovery traffic occupies the funnel's top — you're conducting hypothesis testing here, not user acquisition in the traditional sense.

Budget discipline: allocate 25–30% of total ASA budget to discovery, but cap CPA at 2× the brand campaign level. Install cost from discovery may be 2× branded traffic, but because LTV is depressed, that multiplier isn't acceptable — if discovery CPA climbs to 2.5× branded, you need to pause the campaign or aggressively cut bids.

### Fuse Search Match keyword reporting with cohort analysis

Export the Search Match keyword list from discovery weekly and read D7 retention and ARPU metrics for each keyword cluster (e.g., "strategy game," "idle game") separately in your MMP (Adjust, AppsFlyer). If a cluster delivers 25%+ retention, migrate that keyword group to exact match. Apple's native Search Term Report lacks sufficient granularity — you must map keyword → install → D7 yourself via custom event tracking. This work is manual, but 1–2 hours monthly can reallocate 40% of discovery budget to higher-efficiency channels.

## Bidding behavior and legal risk in competitor campaigns

Competitor campaigns target branded keywords of rival apps (e.g., "clash of clans," "candy crush"). Apple permits this traffic but blocks creative that breaches trademark. Competitor traffic sits at 5–8% tap-through rate — a user searching for rivals clicks your ad 5–10% of the time. Strategy here isn't aggressive bidding but smart creative rotation — if your creative highlights a core feature superior to the rival (e.g., "faster progression," "no paywall"), tap-through climbs to 12%.

Isolating competitor campaigns exists because the LTV profile differs. A competitor-sourced user typically churned from their current game or seeks alternatives; this cohort's D30 retention can run 8–10% higher than discovery because category intent is confirmed. However, early IAP conversion is soft — the user is comparing. Budget allocation: 20–25% of total ASA budget, with CPA cap at 1.5× brand. If competitor CPA runs lower than brand, your rival's brand equity is weaker — you can scale competitor budget to 35%.

Legal risk management: under Apple's trademark policy, you can use another's trademark as a keyword but cannot mention the brand in creative. If the rival reports you, the campaign suspends. Mitigate by spreading competitor campaigns across 10–15 keywords — narrow focus raises suspension risk. Open a separate ad group per rival keyword and audit the Search Term Report weekly, moving Apple's auto-generated broad-match variants into negative keywords.

## Brand campaign: CPA arbitrage as defense mechanism

Your brand campaign targets your own app name and variants (e.g., "roibase game," "roi base"). Organic listing already dominates, but competitors can bid on your branded keyword — you must counter-bid or lose top placement to rivals who siphon your installs. Brand traffic hits 25–40% tap-through — the user is looking for you; the click is certain. CPA is the lowest segment, typically one-third of discovery CPA.

Budget allocation: reserve 30–35% of total budget for brand, but optimize for impression share, not CPA minimization. If impression share on branded keyword falls below 85%, rivals are stealing your traffic; raise bids to reach 95%+. A brand CPA of $0.50 is acceptable because this user would find you organically anyway — you're paying for an insurance premium against rivals blocking your own audience.

Disable Search Match in brand campaigns. Apple's auto-expansion converts branded queries into generic ones, inflating CPA. Use exact match and close variants only. Structure one ad group around a single keyword: your app name. Route all generic keywords to discovery or broad match campaigns. Brand custom product page should focus on onboarding flow — this user already knows you; narrative sell is unnecessary.

## Broad match campaign: controlled expansion as sandbox

Broad match sits between discovery and brand — you select specific keywords but permit Apple to expand them via broad-match variants. For example, "tower defense" expands to "best tower defense," "tower defense offline," "td games." This mode offers controlled expansion — not full autopilot like discovery, but not fully restricted either; you set keyword boundaries and tell Apple to search around them.

Segmenting broad match from discovery matters for budget control. In discovery, Apple goes anywhere; in broad match, you draw lines. Budget allocation: 15–20%. Strategy: take strong keywords from discovery and competitor, shift them to broad match, test for 2 weeks. If broad match CPA runs 20%+ lower than discovery, promote it to exact match. Broad match functions as a "staging" layer — where keywords test before full control.

Negative keyword discipline is critical in broad match. Apple's expansion variants can include completely off-target queries (e.g., "tower defense" → "tower building game"). Audit Search Term Report weekly; blacklist keywords with <1% CTR or CPA exceeding 2× target. This 15-minute weekly routine can recover 30% of broad match budget.

### Tighten funnel flow using bid multiplier strategy

Apple Search Ads lacks demographic targeting but supports device and location targeting. Build separate bid multiplier tables per campaign type. In discovery, reduce bids 40% in tier-2 geos (Brazil, India) because LTV from these regions is half of tier-1. In brand campaigns, maintain bids fully in tier-2 because these users are already qualified searchers. In broad match, bid 20% higher on iPad — tablet session length runs 35% longer and IAP conversion 18% higher (App Annie 2025 data).

Apply dayparting by campaign type. Keep discovery and broad match active 09:00–23:00; pause at night. Keep brand campaigns live 24/7 — if rivals bid on your branded keyword at midnight, you defend. [App Store Optimization](https://www.roibase.com.tr/fr/aso) tightens metadata and lifts organic ranking, reducing brand campaign cost — ASO serves as your defensive wall here.

## Manage budget flow via closed-loop attribution

After building funnel architecture, read post-install events from your MMP (Mobile Measurement Partner) per campaign type separately. If discovery delivers D7 retention of 18%, competitor 26%, and brand 42%, rebalance budget against this metric. Simple model: allocate total budget by LTV/CPA ratio. If brand's LTV/CPA is 4.2 and discovery's is 1.8, assign brand 2.3× more budget.

But don't wait 90 days for LTV; forecast using D7 retention and D1 ARPU as leading indicators. If a campaign type's D7 retention exceeds 30%, upshift LTV forecast 3×. Automate this by piping your MMP into BigQuery for daily cohort analysis. A simple Python linear regression takes 15 lines — forecast D90 LTV from D1 and D7 metrics with 82% accuracy (our internal test data).

Creative rotation discipline by campaign type: refresh discovery and broad match every 10 days; hold brand creative stable for 30 days. Discovery users don't know you; creative testing makes sense. Brand users have already decided; creative shifts move tap-through only 2–3%. In competitor campaigns, benchmark the rival's latest creative and update yours weekly — this is agile, cyclical work.

Structuring Apple Search Ads campaign architecture as a funnel isolates and optimizes each stage. Scan the broad pool at discovery, migrate keywords by performance into broad match and exact match, segment competitor traffic with separate budget discipline, defend your brand from rivals. Close budget flow via post-install metrics (D7, LTV), reading real-time ROI per campaign type. An unstructured ASA account collapses distinct intent levels into one pool, bleeding budget to low-LTV segments — applying this framework cuts that waste by 30–40%.