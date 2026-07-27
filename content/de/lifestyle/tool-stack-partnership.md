---
title: "Tool Stack 2026: Anatomy of Daily Operations at Roibase"
description: "Linear sprint velocity, Notion docs hierarchy, async-first Slack — 12-person team with meeting-free weeks and measurable workflow discipline"
publishedAt: 2026-07-27
modifiedAt: 2026-07-27
category: lifestyle
i18nKey: lifestyle-004-2026-07
tags: [tool-stack, async-workflow, linear, notion, operational-discipline]
readingTime: 8
author: Roibase
---

Tool stack articles typically end with "we use X, it's great." This one is different — it shows the integration patterns, numerical criteria, and tradeoffs behind 8 years of operational discipline evolution at Roibase. Linear sprint velocity climbed from 1.2 to 2.8, Notion docs hierarchy went through 3 iterations, Slack async response time dropped from 4 hours to 45 minutes. This shift didn't come from tool selection—it came from systemic design that binds tools to team culture.

## Linear: Not Sprint Velocity, Context Switch Cost

When we migrated from Jira to Linear in 2024, the expectation wasn't speed—it was reducing context-switching cost. In Jira, an issue's lifecycle meant 9 screen transitions, 3 dropdown menus, 2 manual webhook triggers. In Linear, the same lifecycle is 2 keyboard shortcuts and 1 drag-drop. The difference isn't time; it's attention economy—a developer spending 30 seconds wondering "where do I write this field?" instead of 3 seconds reflexively completing it.

In sprint planning, we don't use velocity metrics—we use cycle time distribution. Linear's built-in analytics hide misleading averages like "average 4.2 days" and expose P50/P75/P90 percentiles. Our P90 cycle time is 11 days—acceptable, because outliers are usually dependency blockers. P50 is 2.8 days—that's critical path speed. Watching distribution instead of velocity transformed "acceleration" pressure into "predictability" discipline.

Integration point: Linear webhooks write real-time to our "Active Sprint" database in Notion. No manual sync—when a developer changes status in Linear, Notion's roadmap view updates within 200ms. This single source of truth pattern means the PM checks Notion before asking "where's that issue?" on Slack. In async-first culture, asking questions and waiting for answers is costly—webhooks reduce that cost to zero.

### Linear Triage Flow: Inbox Zero Discipline

Linear has inbox zero discipline—automatic triage every morning at 09:00. New issues land in Linear Inbox; the PM triages within 30 minutes: priority label + assignee + project link. Untriaged issues auto-post to #triage-needed Slack after 24 hours. This forcing function keeps backlog entropy in check—200 issues opened in 3 months, 198 triaged, average triage latency 4.2 hours.

## Notion: Docs Hierarchy and Read-Time Optimization

We use Notion as a decision log, not a wiki. Every document carries 3 metadata fields: `decision-owner`, `last-reviewed-date`, `status` (draft/active/archived). Active status older than 90 days triggers automatic review reminder to Slack. This prevents doc decay as scale grows—180 Notion pages created in 6 months, 12 archived, the rest under active review.

Hierarchy is 3-tiered: `Company > Team > Project`. Company-level docs (brand guidelines, hiring process) are readable by all but editable only by founder/leads. Team-level docs (sprint retro, tech debt registry) are editable by team members. Project-level docs (feature spec, A/B test results) are owned by assignees. This permission model prevents "everyone edits everything" chaos.

Read-time optimization: Every Notion page starts with estimated reading time (words / 200). Docs longer than 5 minutes must include a TL;DR block—written by the doc owner, not AI summary. The TL;DR lets readers decide "does this affect me?" in 30 seconds. Data from 6 months: TL;DR addition dropped page bounce rate from 42% to 18%.

Integration: Figma files embed into Notion—but as live embeds, not screenshots. When a designer changes something in Figma, the product spec in Notion auto-updates. This pattern eliminates "is this doc current?" questions. Also, Granola meeting transcripts auto-post to Notion—2 minutes after a meeting ends, a structured summary becomes a Notion page.

## Slack: Async-First, Sync-When-Critical

Slack doesn't follow real-time chat pattern—every channel is async-first. Send a message, expect a response within 4 hours. Faster response needed? Add `@urgent` mention—this changes notification tier. 6-month `@urgent` usage: 38 messages. Total messages: 14,200. So 0.27% of messages are truly urgent.

Thread discipline: Every message must continue in threads. Only topic starters post to main channel; discussion stays in threads. When you scroll the channel, you see "this topic has 12 messages" and don't need to read all of them. Thread completion rate is 91%—messages resolve and close in threads, not spill to main.

Integration: When a Linear issue opens, a Slack thread auto-creates. When it closes, "✅ Resolved" reaction adds to the thread. This tracks issue lifecycle in Slack but doesn't detach it from Linear—single source of truth stays intact. Granola meeting summaries also post to Slack, but the same summary lives in Notion—readers consume from wherever they already are.

### Slack Channel Taxonomy

With 12 people, we run 18 Slack channels—but taxonomy is clean: `#general` (company-wide), `#dev` (engineering), `#growth` (marketing/sales), `#client-{name}` (client-specific), `#random` (off-topic). 6 client channels—so 2 people follow 1 client on average. This separation controls noise-to-signal. `#general` averages 8 messages/day—enough visibility for critical announcements, no spam.

## Figma: Component Library and Design Token Sync

We use Figma as a design system source, not a mockup tool. Component library holds 240 components—buttons, inputs, cards, modals, layout primitives. Each component links to design tokens: `color-primary-500`, `spacing-md`, `font-body-regular`. These tokens sync to code via Figma API—designer changes `color-primary-500` in Figma, a GitHub PR auto-opens, CSS variables update.

This sync pattern kills manual design-dev handoff. Designer marks "ready for dev" in Figma, a Linear issue auto-opens with Figma link embedded. Developer opens the issue; Figma file, component spec, token values are all ready. No manual "how many pixels is this padding?"—inspect mode is built-in.

Design review runs weekly, 1 hour, async—designer asks questions in Figma comments, developer answers. No real-time meetings. 6 months: 24 design reviews, none required sync. Async review lets developers answer without context-switching.

Integration: Figma file embeds in Notion with version control. Every major design revision becomes a Figma branch; Notion embed has a branch selector. You can revert to old revisions and track design evolution. Roibase's [branding](https://www.roibase.com.tr/de/branding) service delivers client brand identity evolution timelines the same way—each logo iteration is a Figma branch, displayed in Notion timeline view.

## Granola: Meeting Transcript and Action Item Extraction

Granola is an AI meeting assistant—but not a note-taking tool; it's a decision extraction engine. During meetings, it generates real-time transcripts. At the end, it produces 3 outputs: (1) structured summary, (2) action item list (with owner + due date), (3) decision log (who decided what). All 3 auto-post to Notion.

6-month data: 42 client meetings, 18 internal syncs, 60 total. Average meeting length 38 minutes, Granola summary takes 4.2 minutes to read. Action item extraction accuracy is 89%—9 of 10 items extracted with correct owner + due date. The remaining 11% we fix manually. This accuracy kills "who was doing what again?" post-meeting arguments.

Integration: Action items can auto-open as Linear issues—but need manual approval first. Granola offers "send to Linear" button, PM approves, issue opens. This approval step prevents AI from creating irrelevant action items. 60 meetings produced 180 action items, 162 sent to Linear, 10% rejected (irrelevant or duplicate).

## Tool Stack Tradeoff: Integration vs. Ownership

Using 5 tools (Linear, Notion, Slack, Figma, Granola) is more complex than one monolithic platform. But the tradeoff is clear: best-of-breed selection improved team efficiency 34% (6-month tracking: task completion rate rose from 68% to 91%). Integration costs exist—webhooks, API syncs, error handling—but that's one-time. Operational gains repeat daily.

Ownership pattern: Each tool has 1 responsible owner. Linear → Tech Lead, Notion → PM, Slack → Ops Manager, Figma → Design Lead, Granola → Founder. The owner ensures the tool fits team workflow, identifies new integration needs, makes upgrade decisions. This ownership prevents "everyone uses it but no one owns it" drift.

Tool-change threshold stays high—adding a new tool requires 3 criteria: (1) can it integrate with existing stack? (2) does it break single source of truth pattern? (3) does it fit async-first culture? 6 months brought 12 tool proposals; 2 got accepted (Granola + 1 internal analytics tool). The rest got rejected—mismatch with existing stack or solving problems the current combination already solves.

## Tool Stack's Measurable Cultural Impact

Tool choice is culture choice. Linear sprint discipline, Notion documentation discipline, Slack async discipline—these aren't tool features; they're cultural patterns tools enforce. Over 6 months, the team grew (8 to 12 people), but meeting hours dropped (12/week to 6/week). This paradox exists because of async-first tool stack.

We measure operational discipline: Linear cycle time P50, Notion doc review latency, Slack async response time, Figma-to-code sync frequency, Granola action item accuracy. These metrics get discussed quarterly at founder/lead level. Tools aren't just instruments—they're the measurable surface of team performance. Now go audit your own tool stack: test single source of truth pattern, create forcing functions for async discipline, collect metrics. Productivity isn't shortcut; it's systemic design.