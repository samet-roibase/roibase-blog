---
title: "Apple Search Ads: Building Campaign Architecture as a Funnel"
description: "Structure Apple Search Ads campaigns across discovery, competitor, brand, and broad match layers. Engineer your budget flow to optimize D7 retention and LTV by campaign type."
publishedAt: 2026-07-29
modifiedAt: 2026-07-29
category: gaming
i18nKey: gaming-005-2026-07
tags: [apple-search-ads, asa-funnel, mobile-growth, app-campaigns, aso]
readingTime: 8
author: Roibase
---

Running Apple Search Ads through a single campaign type collapses user intent across the funnel into one budget pool. A user in discovery mode and one executing a branded search carry entirely different costs, intent signals, and conversion dynamics. Architecting your campaigns as a funnel—isolating discovery, competitor, brand, and broad match into separate layers—imposes budget discipline on each stage and lets you read post-install metrics (D7 retention, LTV) by campaign type instead of blending them. This post walks through how to structure Apple Search Ads across these layers and manage budget flow based on user intent stage.

## What question is the discovery-mode user asking

Discovery campaigns are Apple Search Ads' automatic expansion mechanism—the algorithm surfaces your app across hundreds of queries based on category, user behavior, and semantic intent. The user here is not searching for your app specifically; they're asking a broad question like "tower defense game." Impression volume is high, tap-through rate low, and CPA relatively cheap, but D7 retention often lands in the 15–20% band. Discovery's job is not brand awareness but hypothesis testing on a wide pool of potential intent.

You cannot fully isolate discovery into a controlled pool—Apple keeps Search Match open by default. Your strategy should be to ring-fence discovery traffic in its own campaign and manage bidding not from a CPA target but from an impression share target. If you're pulling 500 installs per day at 60% impression share from discovery and seeing 18% D7 retention, you need to tighten that cohort in the first seven days through push sequencing and onboarding flow refinement. Discovery traffic is the funnel's top layer—you are not acquiring users here; you are stress-testing hypotheses.

Budget discipline: allocate 25–30% of total ASA spend to discovery, but cap CPA at 2x your brand campaign target. Discovery installs may cost twice as much as branded traffic, but if the LTV gap doesn't justify it, you've miscalibrated. If discovery CPA creeps to 2.5x brand, pause the campaign or slash bids aggressively.

### Marry Search Match keyword reports to cohort analysis

Export your discovery campaign's Search Match keyword list weekly and measure D7 retention and ARPU for each keyword cluster (e.g., "strategy game," "idle game") in your MMP (Adjust, AppsFlyer). If a cluster returns 25%+ retention, migrate it to an exact match campaign. Apple's Search Term Report lacks the granularity you need—map keyword → install → D7 yourself via custom event tracking. It's manual, but one to two hours of monthly analysis can redirect 40% of discovery spend to higher-intent channels.

## Competitor campaigns: bidding posture and legal surface area

Competitor campaigns target rival app branded keywords (e.g., "clash of clans," "candy crush"). Apple allows this but blocks creatives that cross into trademark infringement. Tap-through rate on competitor traffic is 5–8%—when a user searching for a competitor sees your listing, maybe 5–10% tap. The play is not aggressive bidding but smart creative rotation. If your creative highlights a superior version of the competitor's core mechanic (e.g., "faster progression," "no paywall"), CTR can jump to 12%.

Why isolate competitor campaigns: LTV profile is different. A user coming from competitor search is typically churned from their current game or actively shopping—their D30 retention can run 8–10 points higher than discovery because category intent is proven. But early IAP conversion is suppressed; the user is comparing. Budget: 20–25% of total ASA spend, CPA cap at 1.5x brand. If competitor CPA runs below brand, your rival's brand equity is weaker—scale competitor to 35% of spend.

Legal risk management: per Apple's trademark policy, you can keyword on another brand but cannot use the brand name in creative. If the competitor reports you, Apple suspends the campaign. Spread competitor campaigns across 10–15 apps—concentrating on one increases suspend risk. Create a separate ad group per competitor keyword and audit the Search Term Report weekly; flag any broad-match variants Apple auto-added and move them to your negative keyword list.

## Brand campaign: CPA arbitrage as defense mechanism

Your brand campaign targets your own app name and close variants (e.g., "roibase game," "roi base"). Organic listing ranks first, but competitors can bid on your branded keywords—if they do, you must counter-bid or they'll steal your own traffic. Brand CTR runs 25–40%—users are looking for you. CPA is lowest here, often one-third of discovery CPA.

Budget allocation: 30–35% of total spend on brand, but the goal is not CPA minimization but impression share maximization. If your branded keywords hold <85% impression share, competitors are siphoning your traffic. Raise bids to 95%+ share. A $0.50 CPA on brand is acceptable because those users would have found you organically anyway—you're paying an insurance premium to block competitor blocking.

Disable Search Match on brand campaigns. Apple's automatic expansion turns branded queries into generic ones, inflating CPA. Use exact match and close variants only. Structure one ad group around one keyword: your app name. Push all generic keywords to discovery or broad match. Your brand campaign's custom product page should lead directly into your onboarding funnel—this user already knows you; you don't need to tell your origin story.

## Broad match: controlled expansion as sandbox

Broad match sits between discovery and brand—you pick specific keywords but allow Apple to expand them via broad-match variants. For example, the keyword "tower defense" expands into "best tower defense," "tower defense offline," "td games." The advantage: controlled expansion. Unlike discovery (full autopilot), you draw the boundary; you're telling Apple "search around this" rather than "search anywhere."

Why separate broad match from discovery: budget control. Discovery can go anywhere; broad match stays in your keyword perimeter. Budget: 15–20%. The play: pull top-performing keywords from discovery and competitor, park them in broad match, test for two weeks. If broad match CPA runs 20%+ lower than discovery, promote that keyword to exact match. Broad match is a staging layer—keywords are tested before full control.

Negative keyword discipline is critical on broad match. Apple's expansions can drift (e.g., "tower defense" → "tower building game"). Review the Search Term Report weekly; move any keywords with <1% CTR or CPA above 2x your target to negatives. Fifteen minutes of weekly upkeep can free up 30% of broad match spend.

### Tighten funnel flow via bid multiplier strategy

Apple Search Ads lacks demographic targeting but offers device and location multipliers. Build a separate bid multiplier table for each campaign type. For discovery, cut bids 40% on tier-2 geos (Brazil, India) because LTV from those regions runs half of tier-1. On brand, hold bids even in tier-2—users searching for you are already qualified. On broad match, bid 20% higher on iPad—tablet users run 35% longer sessions and 18% higher IAP conversion (App Annie 2025 baseline).

Apply dayparting by campaign type. Run discovery and broad match 09:00–23:00; kill overnight traffic. Keep brand 24/7. If competitors bid on your brand at night, you must defend. Tighten your [App Store Optimization](https://www.roibase.com.tr/en/aso) metadata to strengthen organic rank—ASO is your defensive wall; as organic rank improves, brand campaign cost drops.

## Manage budget flow via closed-loop attribution

Once architecture is live, read post-install events by campaign type in your MMP. If discovery users show 18% D7 retention, competitor 26%, and brand 42%, your budget split should rebalance accordingly. Simple model: weight spend by LTV/CPA ratio. If brand LTV/CPA is 4.2 and discovery is 1.8, allocate 2.3x spend to brand.

Do not wait 90 days for LTV. Use D7 retention and D1 ARPU as leading indicators. If a campaign type's D7 retention exceeds 30%, revise LTV estimate upward 3x. Automate this by piping your MMP into BigQuery and running daily cohort analysis. Fifteen lines of Python—a simple linear regression on D1 and D7 predicts D90 LTV at 82% accuracy (internal test data).

Rotate creatives by campaign type: discovery and broad match every 10 days; brand every 30 days. On discovery, you're introducing yourself—creative testing matters. On brand, the user has decided—creative swaps move CTR only 2–3%. On competitor, benchmark against the rival's latest mechanic and refresh your creative weekly—it's an agile cycle.

Apple Search Ads architecture as a funnel gives you the power to isolate and optimize each stage of intent. Cast a wide net in discovery, migrate performing keywords into exact match, manage competitor traffic under separate budget discipline, defend your brand against siphoning. Close the loop with post-install metrics (D7, LTV) and read real-time ROI per campaign type. An unstructured ASA account blends intent levels, diffusing budget toward low-LTV segments. This framework cuts that leakage by 30–40%.