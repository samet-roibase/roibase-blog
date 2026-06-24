---
title: "Hiring for Async-First: Practical Filters and Interview Structure"
description: "Trial week, written assessment, and removing sync bias: an operational guide to testing candidates with real async work discipline when building remote teams."
publishedAt: 2026-06-24
modifiedAt: 2026-06-24
category: lifestyle
i18nKey: lifestyle-005-2026-06
tags: [async-first, hiring, remote-work, trial-week, team-building]
readingTime: 8
author: Roibase
---

Building an async-first team doesn't start with hiring someone who has "remote-friendly" in their LinkedIn headline. The most common mistake in 2026: running the hiring process on sync meetings, "vibe check" sessions, and CV scanning. The result: your team works remotely but there are four Zoom calls a day, every decision expects instant Slack responses, and spoken instructions replace written documentation. If you want an async team, you need to design the hiring process itself around async discipline — this isn't just "let's meet at a convenient time," it's about testing whether a candidate *actually has the capacity to do async work*.

## Removing sync bias: a measurable criteria matrix

The first step in async-first hiring is separating which competencies *actually* require synchronous interaction. Classical interview processes try to answer "can this person think under pressure" in a 45-minute video call. In an async team, the real question is: can this person read context from written briefs and deliver detailed answers four hours later?

We've been using a filtering matrix at Roibase since 2023, divided into three categories:

**Required async competencies:**
- Reading a written brief and delivering first output without asking clarifying questions
- Responding to Linear tasks within 24 hours (if delayed, explaining why in writing)
- Leaving three-paragraph feedback in Figma comments — without requesting a sync call

**Hybrid-acceptable:**
- Initial week onboarding — 2-3 sync sessions are normal
- Strategic pivot moments — quarterly planning, major feature kickoff
- Critical bugs/incidents — instant Slack pings are reasonable

**Unmeasurable in async:**
- Whiteboard brainstorming ability — FigJam handles this asynchronously
- "Team energy" — readable in written culture documents
- Fast decision-making — decisions are documented in email threads within 48 hours

When you filter portfolios through this matrix, you realize 60% of candidates claiming "5 years remote experience" were actually working full-time on Zoom. These people hit frustration in the first week: "Why isn't anyone responding on Slack?"

The second filter: ask whether the candidate has produced *asynchronous artifacts* in past roles. "How did you document decision-making in that project?" If they answer "we discussed it in weekly meetings," that's a red flag. "We wrote three options plus tradeoffs in a Notion decision log; everyone commented within two days" — green light.

## Written assessment: real work simulation

Replacing video interviews with written assessment doesn't just mean "send an email" — it means simulating the *exact context* the candidate will face working async with your team. We formalized this in 2024; it's now mandatory for every role: candidates respond to a Linear task-style brief within 48 hours, prepare a Notion page instead of recording a Loom, and leave comments on a Figma mock-up.

**Assessment format (example: marketing ops role):**

*Brief:* "Client X's Google Ads ROAS dropped 18% over the last four weeks. Search Console shows 22% impression decline across three core keywords. Analytics shows bounce rate up 9pp. Review the dataset below (Google Sheet link) and propose a one-week action plan. Format: Notion page, max 800 words, at least one data visualization."

*Evaluation criteria:*
- **Context reading:** Did they examine all 12 sheets and focus on the right metric? (Weight: 25%)
- **Written clarity:** Is the action plan specific enough that someone else could execute it? (Weight: 30%)
- **Async discipline:** Did they ask questions in Notion comments instead of Slack? Did they keep moving forward while waiting for answers? (Weight: 20%)
- **Deadline adherence:** Did they deliver within 48 hours? If delayed, did they communicate it in writing first? (Weight: 15%)
- **Output format:** Did the Notion page use heading hierarchy, inline charts, and bullet lists properly? (Weight: 10%)

About 40% of candidates who fail this assessment are the type who read the brief and immediately message "should we hop on a 15-minute call to discuss?" These people become blockers in async teams — they request sync meetings for every task.

Conversely, candidates who pass the assessment already know how they'll work: they read context in Notion, open a draft PR within six hours, and ask for feedback in Figma comments. Onboarding friction drops 70%.

**Anti-pattern:** Presenting the assessment as "homework," then asking them to "walk us through it" on a video call. That's sync again. The right approach: treat the assessment like a Linear task, give all feedback in Notion comments, run Q&A in async threads. How the candidate will work is how the hiring should work.

## Trial week: not a process, real sprint

After CV + assessment comes the "reference check + final interview" step in classical hiring. In async-first, this is: **paid trial week** — the candidate joins a real Linear sprint for five days, responds to real client briefs, works on real Figma files. Not simulation. Production.

At Roibase, trial week runs by these rules:

**Structure:**
- **Days 1-2:** Onboarding documentation — Notion workspace, Linear projects, Figma organization. A #trial-week Slack channel opens (async, 24-hour response time expected). First task: a "good first issue" from the current sprint — low complexity, medium context. The candidate's code/writing/design goes into the real repo.

- **Days 3-4:** Second task — medium complexity, cross-functional. Example: "Plan an A/B test for Client Y's landing page, create variants in Figma, document Google Optimize setup." This task requires the candidate to coordinate async with at least two team members (one design, one analytics). Coordination quality is the real measurement point.

- **Day 5:** Retrospective — also async. Notion page with questions like: "What did you learn? Which processes were unclear? What would you change in the first sprint?" The team gives feedback in the same format: "Code quality? PR descriptions sufficient? Slack response time?"

**Payment:** Trial week is a flat fee from $500 (junior roles) to $2000 (senior roles) — no hourly billing, because measuring async work by hours is meaningless. Evaluation is output-based.

**Red flag signals during trial week:**
- Asking "should we call about this" before every task (3+ times = auto-reject)
- PR descriptions of two lines — "fixed bug" (no context = reject)
- Messaging "is this urgent?" on Slack instead of expecting 2-hour responses (no async discipline)
- Sending screenshots via DM instead of Figma comments (no documentation)

**Green flag signals:**
- After completing the first task, proactively fixing related documentation gaps
- Adding their own questions to the Linear task description and pinging other team members (not DM'ing the manager)
- Maintaining 24-hour response SLA but not replying to every message in 10 minutes (deep work visible)

Trial week is the most critical point in async team building because this is where it becomes real: everyone's CV says "self-starter, autonomous," but the first real task reveals whether they're waiting for instant feedback or blindly charging ahead without context. Async discipline = reading context from documentation + async checkpoints during intermediate steps + meeting deadlines. This competency only shows in trial week.

## When sync interviews are necessary: exception cases

Async-first hiring doesn't mean fully async — some checkpoints need synchronous meetings. At Roibase, video calls are mandatory in only three situations:

**1. Cultural alignment check (once, 30 min):** After trial week, once technical competency is confirmed. This call addresses: "How do we resolve team conflict — in writing or on a call?", "What do you do when you miss a deadline?", "Do you feel isolated working async?" These can't be answered in writing because tone and hesitation matter. But this call doesn't determine the hiring decision; it's final confirmation.

**2. Senior leadership roles (2-3 calls):** Director+ positions require more than async assessment + trial week because strategic decisions and branding involve high-context, real-time discussion. Even these calls are async-prepped: scenarios are sent on Notion before the call, deeper exploration happens during it, then a written summary follows.

**3. Co-founder/equity conversation:** Equity split, vesting schedule, exit scenarios — these don't resolve via async writing. 2-3 sync sessions are necessary. But still, the rule applies: agenda in Notion before every call, decision documented in Linear after.

Outside these three exceptions, every stage is async. Example timeline:

| Week | Stage | Format |
|------|-------|--------|
| 1 | CV + portfolio review | Async (Notion comments) |
| 2 | Written assessment | 48 hours, Notion delivery |
| 3 | Assessment feedback | Async thread, 24-hour turnaround |
| 4 | Trial week | Linear sprint, real tasks |
| 5 | Retro + culture call | Async retro + 1 video call (30 min) |
| 6 | Offer | Written, negotiated in Notion |

Total sync time: 30 minutes. Classical hiring: 6-8 hours of video calls. The difference: in async hiring, the candidate has seen real work, and your team has tested real output. Instead of "can they think under pressure" theater in a video call, you have data in Linear history: "how did this person work over five days?"

## Async hiring anti-patterns: common mistakes

Four traps teams new to async hiring commonly fall into:

**1. "Async interview" that's just a Loom video:** The candidate introduces themselves on Loom, you ask questions on Loom — that's not async, that's asynchronous sync. Real async: candidate writes a Notion page, you comment on it, they edit 12 hours later. Thread format, not video monologue.

**2. Using trial week as "free freelance project":** Some companies say "test for a week," assign a real client deliverable, then don't pay. That's illegal and unethical. Trial week is a mutual evaluation period. The candidate is testing you too — your process quality, tool maturity, feedback speed. If you don't pay, you're not only creating legal risk; you're filtering out the best candidates (good candidates have other offers; they won't work unpaid).

**3. Expecting "fast answers" on assessments:** You give a 48-hour deadline but favor someone who delivers in six hours. This works against async — you're rewarding reactive work over deep work. The right metric is: on-time *and* high-quality. Delivery time doesn't matter.

**4. Running sync standups during trial week:** "We're async, but during trial week let's do 15 minutes every morning so we see how it goes." No. Trial week is when you test async discipline — the candidate writes their Linear task update in writing; you give async feedback. Add sync standups and you can't assess async capability.

## Async hiring funnel: our numbers

At Roibase, 2024-2026 async hiring funnel:

- **CV applications:** 100 people
- **Assessment invitations:** 20 people (first cut: no async artifacts in CV)
- **Assessment completion:** 14 people (6 drop: missed deadline or messaged "let's call")
- **Trial week invitations:** 8 people (assessment quality filter)
- **Trial week completion:** 7 people (1 person exits after day two — mutual decision)
- **Offers:** 3-4 people (hire 1-2 depending on role)

Conversion rate: 3-4%. Lower than classical hiring because async discipline is a rare skill. But first-year retention of hired candidates: 95% (versus 70% in classical hiring). Why: the hiring process simulates real work, so candidates already know what they're doing. No "the job wasn't what I expected" surprise.

Async hiring also opens a global talent pool. The developer we hired in 2025 is in Argentina, the designer in Poland, the marketing ops in Tokyo. Sync interviews would have made timezone coordination impossible. The async format lets candidates do their assessment on their own time, and trial week runs with no forced overlap.

## Building async-first hiring

Converting to async-first hiring is far deeper than "let's work remote." You treat the interview process like a Linear sprint, the assessment like a Notion page, the trial week like production. The result: you're testing real output, not "vibe"; documented contribution, not sync performance; async collaboration capacity, not synchronous competence. If you're building a remote-first team in 2026, convert your hiring funnel to async-first — after your third hire, you'll see the difference in the numbers.