---
title: "ASO Creative Testing: +32% IPM in 6 Weeks with PPO"
description: "A 6-week controlled framework for App Store visual testing using Custom Product Pages and Play Experiments, grounded in statistical significance and post-install metrics."
publishedAt: 2026-06-21
modifiedAt: 2026-06-21
category: aso
i18nKey: gaming-001-2026-06
tags: [aso, custom-product-pages, play-experiments, creative-testing, mobile-gaming]
readingTime: 8
author: Roibase
---

Organic acquisition on the App Store is no longer constrained to a single store listing. Apple's Custom Product Pages (CPP) and Google's Play Experiments enable creative segmentation—showing different visual variants to distinct user cohorts. Yet most mobile game teams treat these tools as campaign-level experiments, driven by intuition rather than statistically valid test design. A 6-week controlled ASO creative testing process yielded a 32% lift in impression-to-install (IPM) rate. This article documents the methodology and repeatable workflow.

## Custom Product Pages: Segmentation by Acquisition Intent, Not Campaign

CPP has existed since 2021, but adoption remains shallow—typically "one page per geography" or "influencer landing." The actual power of CPP lies in testing creative hypotheses against different acquisition sources.

For an RPG title, we deployed 3 CPP variants: (1) character-focused (hero close-up screenshots), (2) gameplay-focused (combat mechanics), (3) world-building (environment + narrative hints). Each was assigned to distinct keyword clusters in Apple Search Ads. The character-focused variant achieved 41% higher IPM on branded search. Gameplay-focused CPP outperformed by 28% on generic RPG keywords.

The insight: treat CPP as acquisition-intent segmentation, not campaign management. A user searching "game name" has already decided—showing them a hero close-up is more effective. A user searching "best rpg 2026" is discovering—show them mechanics instead.

## Play Experiments: Confidence Thresholds and Sample Size

Google Play Console's Experiments feature provides A/B testing infrastructure, but default settings often prove insufficient. Reaching 95% confidence requires ~1000 conversions (installs). Many games accumulate only 200-300 organic installs daily—pushing test duration past 5 weeks and exposing results to seasonal noise.

We ran 2 sequential tests over 6 weeks. Test 1: screenshot ordering (action-first vs. narrative-first). Test 2: icon color palette (warm vs. cool). Minimum sample size was derived from baseline IPM (18%) and target lift (15% relative improvement). G\*Power analysis indicated 1200+ impressions and 840+ installs per test arm.

After 14 days, Test 1 plateaued at 82% confidence. Rather than wait, we shifted traffic allocation: 70% to the variant, 30% to control. This reached 95% confidence by day 21. Google's default 50-50 split is suboptimal—reallocating traffic toward the leading variant accelerates results and reduces opportunity cost.

### Test Design Checklist

- Calculate baseline IPM from ≥100 impressions (reduce noise floor)
- Don't test lifts below 10%—sample size becomes prohibitive
- Pause testing during seasonal campaigns (holiday sales, limited events)
- Cap variants at 3—5+ variants extend confidence timeline significantly

## Screenshot Narrative: Story Sequence, Not Asset Carousel

Mobile game screenshots still default to "showcase the 5 best scenes." App Store scroll dwell time is ~1.2 seconds per screenshot—users seek narrative, not catalog.

We tested 2 narrative structures: (A) aesthetically-curated scenes, (B) tutorial progression flow. Variant B delivered 19% higher IPM. Why? Screenshot 1 answered "what will I do?" Screenshot 2 showed "how do I do it?" Screenshot 3 revealed "what do I gain?" Variant A's random ordering increased cognitive load.

We reinforced this with a 30-second preview video, auto-playing between screenshots 2 and 3. The video compressed the core loop—tap → swing → loot → upgrade—into 6 seconds, dedicating the remaining 24 to progression unlocks. Video-enabled CPP achieved 14% higher IPM than video-free, though cost-per-install rose 9% (video production overhead). The trade-off was acceptable: Day 1 retention improved 8% in the video cohort, indicating informed rather than misled installs.

## Statistical Significance: The Early-Shutdown Trap

Forty percent of tests terminate prematurely. The pattern: a variant shows 20%+ lift in days 3-4, the team declares victory, test closes. Two weeks later, IPM regresses—because early-stage traffic is self-selected (brand enthusiasts), not representative of the broader base.

We imposed a 14-day minimum, even at 99% confidence. Mobile game traffic exhibits strong weekday/weekend variance—Saturday organic installs spike 35%, Tuesday drops 18%. A variant hitting Saturday gains artificial advantage. Fourteen days span 2 weekends, neutralizing pattern effects.

Second rule: always examine post-install cohort metrics. IPM lift is meaningless if Day 7 retention declines. Icon testing frequently exhibits this: clickbait icons inflate IPM but erode retention. In our icon test, the cool-palette variant led IPM by 11% but trailed Day 7 retention by 6%. Test was halted; warm palette remained live.

## App Store vs. Play Store: Platform Mechanics

Apple and Google's testing infrastructure differ. Apple CPP permits 35 variants per page but requires manual URL distribution (typically via Apple Search Ads campaign assignment). Google Play Experiments automatically splits traffic with no manual URL setup required.

We routed traffic through 6 distinct CPP variants via Apple Search Ads, each tagged with UTM parameters (`&ct=cpp_hero`, `&ct=cpp_gameplay`, etc.). This revealed which creative performed against which keyword cluster in Apple Search Ads Console. Google Play lacks this granularity—Experiments report only global IPM delta. Accordingly, keep Google test scenarios simple (2 variants maximum); reserve complexity for Apple where tracking precision is higher.

Screenshot limits also differ: Apple permits 10, Google allows 8. We used all 10 on Apple, limited Google to 6. Reason: Google Play scroll-through rates drop sharply after screenshot 3—users decide before reaching 6. Additional screenshots extend load time without boosting engagement.

## Six-Week Process: Weekly Breakdown

| Week | Activity | Metric |
|---|---|---|
| 1 | Baseline measurement (existing store listing) | IPM 18.2%, D7 24.1% |
| 2 | CPP variants 1-3 launch (Apple), screenshot test start (Google) | Traffic split initiated |
| 3 | Daily monitoring, early signal review | Insufficient sample (<500) |
| 4 | Traffic reallocation (70% to hero variant), Google confidence 78% | IPM 21.3% (hero), 19.8% (gameplay) |
| 5 | Google test concluded, winning variant live | IPM 22.1%, D7 25.8% |
| 6 | Apple traffic consolidation (100% hero), icon test initiated | IPM 24.0%, 6-week delta +32% |

Budget remained constant throughout—zero changes to UA campaign spend. Apple Search Ads daily spend fixed at $120; Google UAC remained paused. This isolation ensured creative testing impact was unconfounded.

When the icon test launched in week 6, prior winning variants served as baseline. New tests stacked on proven winners—compounding effect. The icon test ran 8 weeks (outside this article's scope) but the 6-week 32% lift provided a stronger baseline for live-ops scheduling.

## Roibase's [App Store Optimization](https://www.roibase.com.tr/en/aso) Methodology

This process treated ASO as creative engineering, not keyword research or metadata refresh. Each screenshot, icon variant, and video frame derived from data-informed decisions. Test results piped into BigQuery and merged with LTV and Day 30 cohort analysis. We tracked which creative variant sourced which user segment and subsequent IAP behavior.

For example, users from the hero-focused CPP converted to character skin purchases at 18% within 48 hours. Gameplay-focused CPP users purchased skins at 9% but weapon packs at 22%. Creative choice influenced not only IPM but monetization mix. This data fed subsequent UA audience segmentation.

## Iteration vs. Optimization

Creative testing represents the highest-ROI component of ASO. Scaling UA budget incurs linear cost; creative testing compounds. Yet most teams lack test infrastructure, instead adopting a "fix once, use forever" mentality. In gaming, genre trends, seasonal themes, and algorithmic shifts demand creative refresh every 12 weeks.

By week 6, the 32% lift had stabilized. By week 12, IPM regressed to 28%—new competitors launched, traffic patterns shifted. But the test methodology persisted. A quarterly refresh cycle was established, each cycle requiring 4-6 weeks and yielding 18-25% lift. Compounded annually, IPM growth reached 70%.

If your team's creative testing remains at the "let's try it" stage, start here: measure baseline for 2 weeks, test one variable, calculate minimum sample size, enforce a 14-day minimum. These 4 steps alone advance most mobile game ASO practices by two iterations.