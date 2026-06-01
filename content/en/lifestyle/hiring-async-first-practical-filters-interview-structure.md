---
title: "Hiring for Async-First: Practical Filters and Interview Structure"
description: "Trial week, written assessment, breaking sync bias — redesigning recruitment for async-first team culture"
publishedAt: 2026-06-01
modifiedAt: 2026-06-01
category: lifestyle
i18nKey: lifestyle-005-2026-06
tags: [async-first, hiring, remote-work, team-culture, knowledge-work]
readingTime: 8
author: Roibase
---

Classical interview structure is optimized for synchronous communication: 45-minute Zoom, whiteboard challenge, pressure to answer immediately. If you're building an async-first team, this process measures the wrong signals. Fast talking ≠ quality thinking. Silence ≠ ignorance. Roibase has worked remotely for 8 years, fully async for the last 3 — we've redesigned our hiring process 4 times. This article shares the practical filters, trial week mechanism, and how we broke the sync bias.

## Why synchronous interviews mislead async teams

In classical interview format, candidates spend 45 minutes pitching themselves, hiring teams decide based on real-time performance. This format rewards extroverted communication — but the critical skill in async teams is different: writing structured context, making autonomous decisions under uncertainty, adapting to async feedback loops.

In 2023, Roibase reviewed the last 12 hires: we found 3 people with high interview scores but low Linear ticket throughput in their first 90 days. Common trait: brilliant in sync meetings, but context-deficient in Asana/Linear comments, 12-hour lag in Slack threads. Counter-examples exist too — 2 people quiet in interviews but with flawless RFCs (request for comment), hitting 6-month code review approval rates our team envied.

The gap comes from this: sync environments reward "fast answers," async environments reward "considered answers." Interview format measures the first, daily work requires the second. To break this mismatch, we redesigned the hiring pipeline around async signals.

## First filter: Not CV, written assignment

We screen CVs but our real first filter is a 2-hour written assessment. Candidates answer 3 open-ended questions in writing — Google Doc, within 48 hours, references allowed.

Example questions (product manager role):
- "You launched a feature, adoption hit 3% in week one. Which metrics do you examine, what do you test changing first? How do you document the decision?"
- "How should product roadmap be shaped in an async team? Linear milestone, Notion RFC, Slack poll — what's each for?"
- "Engineering says 'this creates technical debt,' founding team says 'direct revenue impact.' How do you resolve this conflict async?"

Evaluation criteria:
- **Structural clarity:** Headers, bullet points, sections — is structure deliberate?
- **Context building:** Are assumptions explicit? Uncertainties named?
- **Reference discipline:** Own experience vs. sourced knowledge — is the distinction clear?
- **Autonomy signal:** "Should I ask you" or "in these 3 scenarios I'd decide this way"?

In 2024, 47 candidates entered written assessment, 12 passed. 10 of 12 reached final hiring — 17% false positive rate. CV filtering ran 60%. Written assessment directly measures async capability.

### For technical roles: RFC review instead of code challenge

We don't do whiteboard challenges for developer hiring. Instead we provide a real RFC (architectural decision record), ask candidates to "review this design, suggest alternatives, write tradeoffs." GitHub comment format, markdown, 4-hour window.

Example RFC: "PostgreSQL to BigQuery ETL pipeline — dbt + Airflow vs Fivetran. Which fits us?" Candidate runs technical analysis *and* demonstrates async code review culture. Result: first-30-day code review quality was 40% higher (2025 cohort).

## Trial week: Real work, real observation

Candidates passing written assessment get offered a paid trial week (1/4 gross salary, 20 hours). They take a real project — not production but production-adjacent. Ticket in Linear, channel in Slack, context in Notion.

Trial week rules:
- **Async-only:** No Zoom, Loom video or written update
- **Autonomous scope:** Not "do this," but "solve this problem, method is yours"
- **Real feedback loop:** Team members async-comment, candidate iterates

Observation criteria:
1. **First 24 hours, question quality:** Naming uncertainty or just "what do I do"?
2. **48 hours, first commit/draft:** Starting iteration without perfection paralysis?
3. **72 hours, async feedback response:** Defensive or "understood, changing this"?
4. **Final day delivery:** Shipping defined scope without creep?

30% of trial week candidates fail — but this is early fail, far cheaper than 90-day probation fail. In 2025, 15 trial week candidates, 10 converted to full-time, 9 of 10 still here at 12 months — 90% retention.

## Breaking sync bias: Silent interview

After trial week comes final interview, but format is inverted: "silent interview." 30 minutes, candidate doesn't speak — we send questions via Google Doc in advance, candidate writes answers, we read during interview and ask follow-ups.

This format tests 3 things:
- **Preparation discipline:** Writing answers requires more thinking than spontaneous speech
- **Distillation:** Structured prose over verbal rambling
- **Async empathy:** Reader-centered writing, not speaker-centered

Example question: "What counts as success in your first 90 days? Write with metrics." Not "adapting well" but "merging my first RFC, dropping code review cycle time to 24 hours, building async alignment with 3 stakeholders."

After silent interview, 15 minutes sync Q&A — mostly candidate's questions of us. In 2024, 8 final interviews, 7 converted, 1 candidate self-selected out (wasn't ready for async). 

## Onboarding: Reinforcing async discipline

After hire decision, we strengthen the async muscle through required practices in first 30 days:

| Days | Activity | Measurement |
|-----|----------|-------|
| 1-7 | Read Notion handbook, ask 10 questions (written) | Question quality (uncertainty vs. info verification) |
| 8-14 | First Linear ticket: documentation update | Commit message clarity, PR description |
| 15-21 | First async RFC (small scope) | Peer review comment count, approval time |
| 22-30 | Review another team's RFC | Constructive feedback signal |

This builds async muscle — by day 30, even a code-first developer has strengthened written-context capacity. At Roibase, work on [brand positioning](https://www.roibase.com.tr/en/branding) uses similar discipline: brand voice docs, guidelines, tone-of-voice — all async alignment tools.

## Counter-argument: Doesn't async hiring take longer?

Yes, 2 weeks longer than classical pipeline. Written assessment 48 hours, trial week 5 days, silent interview 1 week prep. But this time is minimal next to the 6-month opportunity cost of wrong hire. In 2022, Roibase sync-pipeline hires: 2 people left month 4 — cost of bad hire: ~€40K (salary + team disruption). In 2024, async pipeline: 7 people, still here at 12 months — cost of good hire: initial investment compounding.

Other counter: "Fast-moving startup can't afford async hiring." Response: speed = right hires, not fast hires. Building async team with sync-filtered pipeline is logical error — measuring wrong signals.

## Second-order effects of async hiring

This structure creates spillovers:
- **Employer brand:** Candidate pool shifts — "work without meetings" seekers arrive
- **Retention:** First-90-day cultural fit 40% faster (2025 cohort vs 2022)
- **Referral quality:** Team members refer friends with similar async capability

In the last 12 months, 9 of 23 Roibase applications came from "async-first hiring process" search — the pipeline itself signals brand.

---

Building async teams doesn't start with *who* you hire — it starts with *how* you hire. CV screening, 45-minute interview, "culture fit" intuition — these are sync-era tools. Written assessment, trial week, silent interview — these are async-era filters. Process takes longer, but signal quality is higher. As knowledge work goes fully async in 2026, hiring should too.