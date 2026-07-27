---
title: "Tool Stack 2026: The Anatomy of Daily Operations at Roibase"
description: "Linear sprint velocity, Notion docs hierarchy, async-first Slack — 12-person team with meeting-free weeks and measurable workflow discipline"
publishedAt: 2026-07-27
modifiedAt: 2026-07-27
category: lifestyle
i18nKey: lifestyle-004-2026-07
tags: [tool-stack, async-workflow, linear, notion, operational-discipline]
readingTime: 8
author: Roibase
---

Tool stack articles typically end with "we use X, it's great." This one is different — it shows the integration patterns, numerical benchmarks, and tradeoffs behind Roibase's operational discipline evolved over 8 years. Linear sprint velocity increased from 1.2 to 2.8, Notion docs hierarchy went through 3 iterations, Slack async response time dropped from 4 hours to 45 minutes. This change didn't come from tool selection — it came from the systemic design that binds tools to team culture.

## Linear: Not Sprint Velocity, But Context Switch Cost

When we migrated from Jira to Linear in 2024, the goal wasn't speed — it was reducing context switching cost. In Jira, an issue's lifecycle meant 9 screen transitions, 3 dropdown menus, 2 manual webhook triggers. In Linear, the same lifecycle takes 2 keyboard shortcuts and 1 drag-drop. The difference isn't time, it's attention economy — a developer thinking "where do I write this field?" for 30 seconds versus reflexively completing it in 3 seconds.

In sprint planning, we don't use velocity metrics — we use cycle time distribution. Linear's built-in analytics hides misleading averages like "4.2 days average" and shows P50/P75/P90 percentiles. Our P90 cycle time is 11 days — acceptable because outlier issues are typically dependency blockers. P50 is 2.8 days — the real speed of critical path. Watching distribution instead of velocity transformed "acceleration" pressure into "predictability" discipline.

Integration point: Linear webhooks write to Notion's "Active Sprint" database in real-time. No manual sync — when a developer changes status in Linear, the Notion roadmap view updates within 200ms. This single source of truth pattern means the PM checks Notion before asking "where's that issue?" on Slack. In async-first culture, asking questions carries cost — webhooks reduced it to zero.

### Linear Triage Flow: Inbox Zero Discipline

Linear inbox zero is systematic — automatic triage every morning at 09:00. New issues drop into Linear Inbox; PM triages within 30 minutes: priority label + assignee + project link. Untriaged issues automatically fall into #triage-needed Slack after 24 hours. This forcing function keeps backlog entropy controlled — 200 issues opened in 3 months, 198 triaged, average triage latency 4.2 hours.

## Notion: Docs Hierarchy and Read-Time Optimization

We use Notion as decision log, not wiki. Every document carries 3 metadata fields: `decision-owner`, `last-reviewed-date`, `status` (draft/active/archived). Active status older than 90 days triggers automatic review reminder to Slack. This prevents docs from rotting as scale increases — 180 Notion pages created in 6 months, 12 archived, rest under active review.

Hierarchy is 3-layered: `Company > Team > Project`. Company-level docs (brand guideline, hiring process) are readable to all but editable only by founder/leads. Team-level docs (sprint retro, tech debt registry) are editable by team members. Project-level docs (feature spec, A/B test result) are owned by assigned person. This permission model prevents "everyone edits everything" chaos.

Read-time optimization: Every Notion page starts with estimated reading time (words / 200). Docs longer than 5 minutes must contain an automatic TL;DR block — written by the document owner, not AI summary. TL;DR lets the reader decide "does this concern me?" in 30 seconds. After adding TL;DR, page bounce rate dropped from 42% to 18%.

Integration: Figma files embed in Notion — but live embed, not screenshot. When designers make changes in Figma, the Notion product spec updates automatically. This pattern eliminates the "is this doc current?" question. Also, Granola meeting transcripts auto-post to Notion — 2 minutes after meeting ends, structured summary exists as a Notion page.

## Slack: Async-First, Sync-When-Critical

No real-time chat pattern in Slack — every channel is async-first. Send a message, expect response within 4 hours. Faster response needed? Add `@urgent` mention to the message — it changes notification tier. In 6 months, `@urgent` usage: 38 messages. Total messages: 14,200. So 0.27% are genuinely urgent.

Thread discipline: Every message must continue in thread. Only topic starter posts to main channel; discussion stays in thread. This way, scrolling the channel shows "12 messages on this topic" without forcing you to read all. Thread completion rate: 91% — messages get answered in thread and close there.

Integration: Linear issues create automatic Slack threads. Issue closure adds "✅ Resolved" reaction to thread. This tracks issue lifecycle in Slack without separating from Linear — single source of truth preserved. Granola meeting summaries also post to Slack, but same summary exists in Notion — reader can follow from wherever they are.

### Slack Channel Taxonomy

12-person team, 18 Slack channels — but taxonomy is clean: `#general` (company-wide), `#dev` (engineering), `#growth` (marketing/sales), `#client-{name}` (client-specific), `#random` (off-topic). 6 client channels — average 2 people per client. This separation keeps noise/signal controlled. `#general` averages 8 messages/day — critical announcement visibility without spam.

## Figma: Component Library and Design Token Sync

Figma isn't a mockup tool — it's the design system source. Component library holds 240 components — buttons, inputs, cards, modals, layout primitives. Every component links to design tokens: `color-primary-500`, `spacing-md`, `font-body-regular`. Tokens sync to code via Figma API — when a designer changes `color-primary-500` in Figma, an automatic PR opens on GitHub, CSS variables update.

This sync pattern makes design-dev handoff non-manual. When a designer marks "ready for dev," Linear auto-creates an issue with Figma link embedded. When a developer opens the issue, Figma file, component spec, design token values are all ready. No "what's this padding in pixels?" question — inspect mode is built-in.

Design review cycle: 1 async review hour per week — designer asks questions in Figma comments, developer responds. No real-time meetings. 24 design reviews in 6 months, none required sync. Async review lets developers answer without context switch.

Integration: Figma file embeds in Notion — with version control. Every major design revision branches in Figma; Notion embed includes branch selector. This lets you revert to old revisions, track design evolution. Roibase's [branding](https://www.roibase.com.tr/en/branding) services use this pattern for client brand identity evolution — every logo iteration is a Figma branch, Notion timeline view.

## Granola: Meeting Transcripts and Action Item Extraction

Granola is the AI meeting assistant — but not a note-taking tool, an action item extraction engine. Real-time transcript during meeting, then 3 outputs: (1) structured summary, (2) action item list (owner + due date), (3) decision log (who decided what). All 3 auto-post to Notion.

6 months of data: 42 client meetings, 18 internal syncs, 60 total. Each meeting averaged 38 minutes; Granola summary takes 4.2 minutes to read. Action item extraction accuracy: 89% — 9 of 10 items correctly extracted with owner + due date. Remaining 11% manual correction. This accuracy eliminates "who was doing what again?" discussions after meetings.

Integration: Action items can auto-create Linear issues — but manual approval is required. Granola offers "send to Linear" button; PM approves; issue opens. This approval step prevents AI from creating irrelevant items. From 60 meetings, 180 action items extracted, 162 sent to Linear, 10% rejected (irrelevant or duplicate).

## Tool Stack Tradeoff: Integration vs. Ownership

Using 5 tools (Linear, Notion, Slack, Figma, Granola) is more complex than one monolithic platform. But tradeoff is clear: best-of-breed selection increased team productivity 34% (6-month track: task completion rate rose from 68% to 91%). Integration cost exists — webhooks, API sync, error handling — but it's one-time. Operational gain continues daily.

Ownership pattern: Each tool has 1 responsible owner. Linear → Tech Lead, Notion → PM, Slack → Ops Manager, Figma → Design Lead, Granola → Founder. Owner ensures tool fits team workflow, identifies new integration needs, makes upgrade decisions. This ownership prevents "everyone uses it but no one owns it."

Tool-change threshold stays high — adding a new tool requires 3 criteria: (1) integrates with current stack? (2) breaks single source of truth? (3) fits async-first culture? 12 tool proposals came in 6 months; 2 approved (Granola + 1 internal analytics). Rest rejected — solvable with existing stack.

## Tool Stack's Measurable Cultural Impact

Tool choice is culture choice. Linear sprint discipline, Notion documentation discipline, Slack async discipline — these aren't tool features, they're cultural patterns tools enforce. In 6 months, team grew (8 to 12 people) but meeting hours decreased (12/week to 6/week). This paradox is possible because of async-first tool stack.

Operational discipline is measurable: Linear cycle time P50, Notion doc review latency, Slack async response time, Figma-to-code sync frequency, Granola action item accuracy. These metrics are discussed quarterly at founder/lead level. Tool isn't just instrument — it's the measurable surface of team performance. Now: test single source of truth pattern in your own stack, establish forcing functions for async-first discipline, collect metrics. Productivity isn't shortcuts; it's systemic design.