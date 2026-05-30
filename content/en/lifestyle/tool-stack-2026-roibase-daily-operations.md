---
title: "Tool Stack 2026: Roibase Team's Daily Operations"
description: "Linear, Notion, Slack, Figma, Granola — integration patterns and measurable productivity discipline in a 12-person growth team."
publishedAt: 2026-05-30
modifiedAt: 2026-05-30
category: lifestyle
i18nKey: lifestyle-004-2026-05
tags: [tool-stack, async-workflow, linear, notion, team-operations]
readingTime: 6
author: Roibase
---

Tool stack conversations usually devolve into "here's the catalog of apps we use." But the real issue isn't the tools in isolation — it's integration patterns, context-switching cost, async-first discipline. Roibase's 12-person team has been remote-first since 2018. By 2026, our daily operations are shaped by 5 tools: Linear, Notion, Slack, Figma, Granola. Rather than listing them off, we're opening up the integration layer — where data lives, what triggers workflows, which notification layers stay muted.

## Linear: Not Sprints, Flow Metrics

Linear is marketed as project management, but at Roibase it functions as a "work-in-progress visibility layer." We don't do sprint planning — we skip cycle tracking and milestones. Instead, every issue gets **priority (P0/P1/P2)** and **estimate (1-3-5-8)**. Priority isn't personal preference; it's system-determined: P0 = blocks production deployment today, P1 = must close within the sprint, P2 = backlog.

**Flow metrics:**
- **Cycle time:** average 2.3 days from issue creation to close (Q4 2025 data). Any issue exceeding 5 days auto-escalates to P0.
- **Work-in-progress limit:** maximum 3 open issues per person. To pick up a 4th, you close one or hand it off.
- **Merge-to-close time:** span between PR merge and Linear issue closure — target <30 minutes (CI/CD + QA automation).

Linear's Slack integration is disabled. Instead of notification bombardment, we run a **digest system**: every morning at 09:00, Slack gets a daily summary (P0 count, avg cycle time, WIP distribution). No one @mentions in Linear — everyone reads the morning digest anyway.

### Linear → Notion Synchronization

Completed Linear issues are archived to Notion weekly (Zapier workflow). Notion has a "Retrospective Database" — each closed issue is tagged to which service it belonged. For example, issues under the `branding` project are reported under [Markalaşma & Brand Identity](https://www.roibase.com.tr/en/branding) service. This data drives capacity planning every 3 months: how much engineering time is spent per service?

## Notion: Source of Truth, Not a Wiki

We don't use Notion as a wiki — it's our "decision log." Every strategic choice (e.g., "server-side or client-side tracking for Campaign X?") is written in Notion as an **RFC (Request for Comments)**. RFC template:

```
## Decision
[One sentence — what we're doing]

## Context
[Why it matters now]

## Alternatives
[At least 2 options + tradeoff table]

## Measurement
[How do we know in 4 weeks if this was right]

## Owner
[Who's accountable]
```

RFCs open with a 48-hour async comment window. No meeting calls — everyone reads on their own time, leaves feedback. After 48 hours, the decision owner writes the final call, and the action moves to Linear.

**Data layers inside Notion:**
1. **RFC Database** — all decisions
2. **Retrospective Database** — completed work from Linear
3. **Client Playbook** — per-client operational notes (dashboard location, API key location)
4. **Brand Assets** — Figma links, tone-of-voice docs

Notion search gets complaints, but we don't search — every database is filterable and tagged. Search need usually means "data went in the wrong place."

## Slack: Async-First, Real-Time-Second

Slack notifications are disabled across the team. Only `@channel` and `@here` are enabled — with strict rules: nothing but P0 incidents. Messaging splits across 3 channels:

1. **#daily-digest:** Linear/Notion summaries, CI/CD deploy logs
2. **#async-questions:** Questions where immediate reply isn't expected (24-hour SLA)
3. **#sync-now:** Real-time coordination needed (production incident, live campaign optimization)

**Response time expectations:**
- `#sync-now` → 15 minutes
- `#async-questions` → 24 hours
- DMs → 48 hours (no DM culture; we use channels)

Threads are mandatory. Replying to the main channel is forbidden — every message opens a thread. This keeps parallel conversations from tangling.

### Slack → Granola Integration

Granola is a meeting note tool — we use it only for client calls. No internal meetings (0–1 sync calls per week). After a client call, Granola AI posts the transcript to Slack; the team reads it async. Action items auto-convert to Linear issues (Zapier trigger).

Granola's killer feature: it highlights numerical commitments from the transcript ("A/B test results in 2 weeks," "CTR must jump 15%"). These get automatic reminders — nothing slips.

## Figma: Design Handoff, Not Design System

Figma isn't just design — it's the "frontend spec" layer. Every UI component is defined as a variant. Developers don't extract code from Figma (no "copy CSS") — but they read component behavior from it. For example, a button's `hover`, `active`, `disabled` states exist as frames. Code implements the same state logic.

**Figma → Linear connection:**
Every Figma file has a `Linear Issue` plugin. When design is approved, the designer opens a Linear issue and pastes the Figma link in the description. Developer picks it up; the design is already clear — no questions needed.

Figma comments don't flow to Slack (no notification spam). Instead, a weekly "Figma Digest" converts open comments into Linear issues.

## Integration Pattern: Where Does Data Live?

Tool stack conversations usually start with "which tool do you use?" The real question should be "which data is canonical where?" At Roibase:

| Data type | Source of truth | Synced to |
|---|---|---|
| Active work (WIP) | Linear | Slack daily digest |
| Completed work (retrospective) | Notion | Linear (archived) |
| Strategic decisions | Notion (RFC) | Linear (action items) |
| Client meeting notes | Granola | Slack thread |
| UI spec | Figma | Linear issue description |
| Brand assets | Notion | Figma (embed link) |

No dual source-of-truth. If data looks canonical in 2 places, one is wrong.

## Notification Discipline: When Silent, When Loud

The biggest risk in modern tool stacks is notification creep. Roibase's notification strategy:

**Completely off:**
- Linear mentions (we use Slack threads instead)
- Figma comments (weekly digest)
- Notion page updates (no one watches)

**Digest-based:**
- Linear daily summary (09:00 AM)
- Figma open comments summary (Friday 17:00)
- CI/CD deploy log (post-deploy Slack summary)

**Real-time:**
- `@channel` (P0 incidents only)
- Granola client call summary (5 minutes after call)
- Production errors (Sentry → Slack, `#sync-now` only)

When we set up a tool, the first question is: "Real-time notification or digest?" Default answer: digest.

## What to Do Now

Instead of "we should adopt tool X," ask "where should this data be canonical?" Roibase's 2026 stack is Linear/Notion/Slack/Figma/Granola, but these tools can swap — what matters is integration pattern, notification discipline, async-first culture. If your team still complains "we're not getting tool X notifications," the problem isn't the tool — data ownership is unclear.