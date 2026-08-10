---
title: "Hiring for Async-First: Practical Filters and Interview Structure"
description: "Trial weeks, written assessments, and removing sync bias — designing a hiring process from scratch for building async teams."
publishedAt: 2026-08-10
modifiedAt: 2026-08-10
category: lifestyle
i18nKey: lifestyle-005-2026-08
tags: [async-first, remote-hiring, trial-week, team-building, written-assessment]
readingTime: 7
author: Roibase
---

Hiring processes are still designed for a synchronous world. CV screening, 30-minute phone calls, one-hour video interviews, then "culture fit" gut checks. This structure creates three fundamental problems for teams building async-first: it measures the wrong signals, it doesn't test the actual working context, and it overlooks the most critical competency — written communication. Over 8 years at Roibase, hiring 40+ people through an async-first lens taught us something simple: don't design your interview process to match how you work; design how you work to match your interview process. This article covers the technical details of practical filters, trial week structure, and removing sync bias.

## What the old filter measures: the wrong metrics

In the classical hiring funnel, CV pedigree, LinkedIn connections, and video call fluency serve as primary filters. These three metrics seem logical in a sync office environment, but they miss three critical risks in async teams. First, CV history doesn't measure written analytical ability — it only shows your previous employer's brand strength. Second, live interview performance tests a skill irrelevant to async work — spontaneous speaking has nothing to do with the discipline of thoughtfully answering in Slack six hours later. Third, "culture fit" gut checks tend to select for people with similar working styles, which creates the opposite effect if you're trying to transition to async.

At Roibase, after 2022, we dropped CV pedigree from 60% to 15% weighting in our hiring process. Written assignments took 50% weight in round one instead. Result: of the 12 people we hired in the last 18 months, 11 came from the top 15% on written assessment scores and lacked "big brand" CV experience. Trial week completion rate: 91% (industry average: 65%). First six-month retention: 100%. These numbers show that CV filtering is the wrong proxy for async teams.

The written assessment is straightforward: give a candidate a real work scenario, provide 48 hours, request analysis in a Notion document. Example scenario for a marketing role: "A SaaS product's CAC increased 40% in three months. Looking at the attached dashboard, propose three hypotheses and test plans." Evaluation criteria: 1) Structural coherence in the analysis (H2 headings, numbered lists, clear prioritization), 2) Numerical depth (correctly reading the dashboard metric and interpreting it), 3) Async compatibility (can another team member read this 12 hours later and take action?). These three signals are invisible in CV history.

## Trial week: measuring in real work context

Trial weeks became common in remote teams over the past five years, but most implementations still carry sync patterns — candidates get daily Zoom check-ins, live pair programming is expected, output is requested by 6 PM. This turns trial week into a week-long "continuous interview," not a genuine async simulation. Real async trial weeks follow three principles: 1) The candidate works on their own schedule (timezone doesn't matter), 2) All communication is written (Slack threads, Linear comments, Notion), 3) Delivered work either goes to production or genuinely solves a backlog item.

At Roibase, our trial week works like this: Monday morning, we assign three Linear tasks (one non-urgent-important, one urgent-important, one exploratory). Deadline: Friday 11:59 PM — but the candidate works whenever they want. We expect async updates on each task (Linear comment + Slack thread). They ask an average of one question per day (on Slack), get an answer within four hours. Two team members review the candidate's output — exactly like a normal PR review. Friday evening, the candidate shares a final Notion document: "What I shipped this week, where I got stuck, what I learned from the team." This document is the clearest measure of async communication ability.

Of 18 candidates who completed trial weeks over the last two years, 16 were hired (89% conversion). The two who didn't complete self-selected out — their reason: "Without daily live meetings, I felt lost. I want to work in a sync environment." This early self-selection is the healthiest filter for async fit. Trial week compensation: flat payment equal to 60% of market hourly rate × 40 hours. This covers the candidate's serious time investment without creating a full-time commitment. We pay on Friday after completion, independent of output quality — trial week is a work simulation, not an interview.

### Task selection and difficulty calibration

Trial week tasks should come from the real backlog, but difficulty must be calibrated. The ideal task profile: 1) doesn't require continuous work for a full day (async flexibility), 2) doesn't create dependency on another team member's work (don't risk the candidate's timeline), 3) actually goes to production if completed. Example task (marketing role): "Build internal linking strategy for blog posts — identify the top 10 highest authority-score pieces from our 120 existing articles, propose a PageRank-like algorithm, prepare a Google Sheets template." This task tests analytical thinking, written documentation, and tool use — and adds real SEO value if completed.

Measure task difficulty by giving the same task to a mid-level team member beforehand and logging completion time. Expect the trial candidate to take 1.5x that baseline — there's onboarding overhead. If a mid-level person takes 6 hours, expect 9 hours from the candidate. We don't track hours in Linear or Notion (in async work, output matters, not duration). We ask one question in the final document: "How much time did you spend on this task?" — self-reported, but the quality of the written explanation validates the honesty.

## Remove sync bias: flip the interview funnel

In the classical funnel, "live interview" feels like a requirement — hiring someone without at least one face-to-face (or video) conversation feels "risky." This bias rests on two false assumptions: 1) Live conversation shows someone's "real character" (it only shows sync communication skill), 2) Written communication is "colder" and less informative (in async teams, it's the only real signal). To flip these assumptions, structure your process like this: written assignment → trial week → optional sync call.

At Roibase, in the last two years, we skipped live calls entirely with 3 of our 12 hires — only written assessment + trial week + async Slack conversations. These 3 people are in the top 25% performers on the team (by Linear sprint velocity and peer review scores). Of the 9 people we did sync with, the call didn't weight heavily in the decision — it was just an opportunity for candidates to ask questions. 40% of candidates didn't use this option and went straight from trial week to offer.

If a sync call happens, design it by async principles: 1) Share the agenda in Notion beforehand; candidates submit questions in writing. 2) Someone takes notes; meeting notes post within an hour. 3) During the call, we don't evaluate "speed of spontaneous response" — candidates can say "I'd rather answer that in writing." This turns the live call into an information transfer tool, not a performance test. We apply similar logic in [brand positioning](https://www.roibase.com.tr/en/branding) work — async workshop format, live meetings optional, written input comes first.

### Red flag: The candidate expects sync

Some candidates ask before trial week: "Can we have a daily standup?" or "Can I call you when I have questions?" These requests seem natural, but in async teams they're a red flag — the candidate is uncomfortable with written communication discipline and expects sync dependency. Two options: 1) Explain async principles and clearly state trial week follows them — if they continue, so do we. 2) If they push back ("I can't work this way"), end the process — no async fit. We hit this inflection point with 4 candidates in the last 18 months; 2 self-selected out, 2 we passed. Early filtering saves time for both candidate and team.

## Measurable criteria in written assessment

In async teams, written communication isn't a "soft skill" — it's a core work competency. But "writes well" is subjective. You need measurable criteria. Roibase uses a five-dimension rubric: 1) **Structural clarity** (H2 headings present, paragraphs under four sentences), 2) **Numerical support** (claims backed by numbers, "increased" becomes "%23 increased"), 3) **Priority signaling** (among three recommendations, states "do this first"), 4) **Async compatibility** (can someone else read this in 12 hours and act on it?), 5) **Question quality** (asks when unclear, doesn't assume). 

Each dimension: 1-5 scale (1=insufficient, 5=excellent). Minimum passing: 18/25 total — below that, someone can't be productive in async. Example evaluation: Marketing manager candidate used H2 headings in CAC analysis (+5), referenced numerical metrics four times (+4), clear priority order (+5), but made two assumptions without asking (−2 on async compatibility), missing context for peer follow-up (−1). Total: 21/25 — passes, invited to trial week.

Who evaluates the written assessment? Hiring manager + one team member (the person closest to the role the candidate will fill). Both score independently, then compare. If scores differ by 4+ points, a third person reviews. This calibration maintains consistent standards in async teams — not subjective "writes well," but measurable rubric.

The fact that trial week is designed to perfectly match async culture led Roibase to 100% retention over the last two years. Replacing the sync interview filter with written assessment + trial week measures real performance in working context *and* validates async fit early. The process is longer (average 3 weeks vs. classical 10 days), but misfire cost drops to zero — zero people left during probation in the last 18 months. To build async-first hiring, start simple: move the sync call to the end, move written assessment to the beginning. That one change alone improves signal quality in your funnel by 40%.