---
title: "Hiring for Async-First: Practical Filters and Interview Structure"
description: "Trial week, written assessment, and removing synchronous bias — measurable hiring design for building remote teams."
publishedAt: 2026-05-18
modifiedAt: 2026-05-18
category: lifestyle
i18nKey: lifestyle-005-2026-05
tags: [async-first, remote-hiring, trial-week, written-assessment, team-culture]
readingTime: 7
author: Roibase
---

Building an async-first team means designing your hiring process async too. The "let's close this in 3 rounds quickly" approach is a remnant of synchronous culture — ultimately, you end up hiring someone who talks well on a crowded Zoom call but can't write. Roibase has been hiring developers, analysts, and strategists outside Istanbul since 2018. Our process: written assessment, trial week, decision criteria in a document. In this piece, we break down the mechanics of async-first hiring.

## Identify synchronous interview bias

The classic interview format rewards synchronous communication. The person who responds quickly, shows charisma, makes eye contact gets high marks. But in an async team, these skills aren't critical. Writing detailed analysis on a Linear issue, responding without losing context 3 hours later, turning ambiguity into documentation — that's the real competency.

At Roibase in 2020, we ran an experiment: two developer profiles. The first gave a perfect explanation on a video call; the second showed hesitations verbally but presented their solution design clearly in a 2-page written assessment. We hired the second. 8 months later, their Linear issue resolution speed was 34% higher — they met expectations.

If you let synchronous factors into hiring, you build synchronous dependency in your team. For an async-first team, the filtering mechanism itself must be async.

## Written assessment: show your decision-making style

The first concrete step in async hiring: skip the CV, start with a written assessment. Give the candidate 2-3 questions, 48 hours to respond, expect 400-600 words. Sample questions: "Did you experience a dependency conflict on your last project? Walk us through your solution process." Or: "How do you resolve disagreements on a team? Use a real scenario."

**Evaluation criteria:**
- Structure: are intro, analysis, and conclusion sections clear?
- Detail: did they include concrete numbers, tool names, timelines?
- Context: can someone else read and understand it?
- Tone: explanatory rather than defensive?

We eliminate 60% at this stage. Candidates who delay responses 3+ days, send single-paragraph answers, or hide behind jargon are out. In an async-first culture, writing discipline is a prerequisite — testing this before trial week cuts costs.

### Response time: not speed, but prioritization

Responding within 48 hours simulates async work. The candidate might be full-time elsewhere, in a different time zone. What matters isn't fast — it's systematic. We prefer someone who sends half an answer in 24 hours over someone who delivers a detailed analysis in 40 hours, wait — we prefer the detailed analysis. The point is: they prioritized the task and gave it proper thought, not a rushed take.

## Trial week: paid, real work

Trial week is the most critical filter for an async team. The candidate gets 5 days of access to your team's tools: Linear, Notion, Figma, GitHub. You give them a real task — not a project simulation, but a priority:low issue from your current backlog. At the end, you pay them: daily rate × 5 days.

**Trial week criteria:**
- Issue solution quality (40% weight)
- Context sharing in Linear comments (30%)
- How they ask when stuck — async doc or Slack panic? (20%)
- Time-to-first-response: when did the first commit land? (10%)

In 2023, a data analyst candidate built a dashboard during trial week. They documented their BigQuery query in Notion, explained their assumptions, flagged missing data early. First commit arrived 18 hours later (expectation: 24 hours). We hired them. 6 months in, project setup costs dropped 40% — because documentation discipline existed from day one.

Unpaid trial weeks create ethical problems and bad filters. Paid tasks let you test real time management.

## Sync call: not decision-making, culture introduction

Async-first hiring doesn't ban synchronous meetings — but **not for decisions**. A 30-minute video call serves this purpose: introduce team culture, clarify async expectations, encourage the candidate to keep asking questions.

The only thing we ask on the call: "What stayed unclear during trial week?" Their answer tests async communication style. If they say "why did you do it that way" instead of "I couldn't find that context in the docs," their async fit is lower. If they say "that code pattern isn't documented," that's good async thinking.

Some candidates come expecting Zoom — that's your moment to teach async philosophy. "Code review here might come back in 3 hours, or 24 if there's no urgency. Does that work for you?" is a sharp filter. Eliminating poor fits early saves time.

## Decision: scoring in a document, approval without meetings

When trial week ends, decision-making is also async. Each team member scores from the Linear issue: criteria on a 1-5 scale. A decision document in Notion: score table, team comments, final recommendation. Hiring lead closes the document, requests approval in Slack. No objections within 48 hours = hire.

**Example scoring table:**

| Criterion | Weight | Score (1-5) | Notes |
|-----------|--------|-------------|-------|
| Issue solution | 40% | 4 | Clean code, low test coverage |
| Async communication | 30% | 5 | Detailed Linear comments |
| Context sharing | 20% | 4 | One commit message incomplete |
| Time response | 10% | 5 | First PR in 16 hours |

This table removes the need for sync calls. Not "how I felt" — "what I saw in the document." Decision closes in 2 days, no meeting.

## Objection mechanism: transparency in docs

The hire decision is open in Notion (candidate anonymized). If a team member objects, they fill a "counter-argument" section: which criterion they'd score differently, what data point supports it. Hiring lead responds within 24 hours. Objections run ~15% — usually new data points shift evaluation.

This reinforces async culture. Teams trust documents. Decisions are transparent. The founder's "I'll handle it" shortcut gets blocked. As boutique agencies like Roibase scale, this discipline flows into [branding](https://www.roibase.com.tr/fr/branding) — "this is how our team works" becomes an external message.

## Async hiring cost: saves time

At first, async hiring seems slower — trial week is 5 days, written assessment is 2 days. But bad hiring costs 3-6 months. Async filters eliminate unsuitable profiles early. Someone who looks good in a sync interview but doesn't fit async culture costs more if you hire them and hit friction in month 2.

Over the last 3 years, Roibase hired 12 people using async hiring. First-6-month attrition: 8% — industry average is 25%. Why: trial week simulates real work, filtering happens early. Forcing sync to move faster is tempting short-term; it breaks team culture long-term.

Building an async-first team means async hiring. Trial week, written assessment, document-based decisions — these are mechanical steps. You can run sync calls, but decisions don't happen there. Async hiring discipline sets expectations from day one.