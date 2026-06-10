---
title: "Tool Stack 2026: How Meeting-Free Weeks Work at Roibase"
description: "Linear, Notion, Slack, Figma, Granola — integration patterns tested over 8 years and concrete metrics for async-first team operations."
publishedAt: 2026-06-10
modifiedAt: 2026-06-10
category: lifestyle
i18nKey: lifestyle-004-2026-06
tags: [tool-stack, async-first, linear, notion, workflow-design]
readingTime: 8
author: Roibase
---

In 2026, the Roibase team averages 2 hours of meetings per week — the rest is synchronized through Linear sprints, Notion documents, and Slack threads. That number was 18 hours in 2019. The tools didn't change; the pattern of connecting them did. A task opened in Linear automatically spawns a Slack thread, links to a Notion spec document, and anchors to a Figma design frame. This essay unpacks the engineering side of that integration system — why we chose each tool, why we set specific automation rules, which metrics we track.

## Linear: Task as Context Carrier, Not Task List

We don't use Linear as an issue tracker — each card is a mini-spec. Required fields when opening a task: target metric (CTR +5%, TTI <2s), related Notion document, Figma frame link. The moment a card opens, a Slack thread spawns automatically (Zapier integration), and the team moves into async discussion. The insight from this pattern: there's no such thing as a "quick task" in Linear — every card carries at least two external contexts.

We track sprint velocity differently: not task count completed, but **average task cycle time** (hours from open to close). That dropped from 38 hours in 2025 to 29 hours in 2026. The reason: spec clarity. If a Linear card states the target metric, code review discussion drops 60% (our own data).

### Linear + Notion Integration Pattern

A rule exists: every Linear card's `Related Resources` field links to a Notion document. This is manually enforced (we don't automate it because the team, not a bot, should determine context). The Notion document typically has three sections: problem definition, proposed solution, acceptance criteria. A Linear card can be derived from a Notion spec, but never the reverse — specs are written first, tasks open second.

This discipline cut code review time from an average of 4.2 hours in 2024 to 2.7 hours. No one asks "why did you do it this way?" in review — the answer is already in Notion.

## Slack: Thread-First, Never Channel-First

We use Slack as thread-based, not channel-based. Messages in general channels are prohibited — every message either lives in a Linear task thread or a Notion-linked thread. Why? To make search structured. When you search "how does X feature work?" in Slack, the Linear task ID comes up automatically because Zapier embeds it in the thread text when it creates the thread.

Our async response time target: 4 hours (within working hours). How do we measure? Median thread response time from Slack Analytics API — 3.2 hours in Q4 2025, 2.9 hours in Q1 2026. We share this metric in sprint retrospectives but don't track individuals — cultural pressure, not individual metrics.

## Figma: Design Tokens Linked to Linear

We don't use Figma as a design tool only — design tokens are directly bound to Linear tasks. When a button component changes in Figma, every Linear card using it automatically gets tagged (Figma API + Zapier). The team sees which tasks are affected within 10 minutes.

This integration came from a company hackathon in 2024. We initially called it "over-engineering." Then during brand refresh, we updated all button states in 3 days — the old system would've taken 2 weeks. Design-code sync is the biggest bottleneck in [branding](<https://www.roibase.com.tr/ru/branding>) work — this integration cut it by 70%.

### Design Token Versioning

Design tokens in Figma aren't under Git version control, but Linear tasks record token changes with timestamps. A task notes "Button CTA color changed from #FF5733 to #E84C3D," and this log automatically goes into the design changelog in Notion. So "what was this color 3 months ago?" is answered in 30 seconds.

## Granola: The Meeting Glue

We said 2 hours of meetings per week — half are client calls, half sprint planning. After every meeting, Granola auto-generates transcript + action items. Action items become Linear cards (manual but templated), transcripts embed into Notion. A team member who missed the meeting catches up in 10 minutes — no one spends time writing meeting notes.

Granola's critical feature: auto-categorizes action items (design, dev, marketing). When opening a Linear card post-call, it auto-suggests the right label. This small detail cut task assignment time from 15 minutes to 3 minutes after a client call.

## Notion: Single Source, Multiple Layers

We use Notion not as wiki, but as state machine. Every document is in one of three states: Draft (being written), Review (linked to Linear task, async discussion ongoing), Canonical (source document, immutable). State changes are manual but the rule is clear: moving from Review to Canonical requires at least two team members' "approve" reactions (in the Slack thread).

Canonical documents don't change — if edits are needed, a new version opens, and the old one is archived. This discipline means every answer to "why was this decision made?" is traceable — check the archive, look at that period's Linear tasks, re-read the Slack thread.

### Database Views and Auto-Tagging

Notion has 4 primary databases: Specs, Decisions, Experiments, Changelogs. Each is auto-tagged with Linear and Slack (Zapier + Notion API). When a Spec is created, Notion auto-populates "related tasks" from the Linear API — which cards reference this spec? This query runs daily at 9 AM, keeping the document current.

## Three Core Rules of Integration Patterns

Eight years of trial and error taught us this: every tool owns a single "source of truth" field; other tools bind to it.

- **Linear:** Task state and timeline source. Notion can write specs, but only Linear changes task state.
- **Notion:** Spec and decision document source. Linear tasks link to Notion, but Notion docs never update Linear cards.
- **Slack:** Async discussion source. Threads auto-spawn but content manually migrates to Notion (no auto-sync because signal-to-noise breaks down).

Second rule: every automation must be reversible. Zapier workflows can also be manually triggered — the team can disable "open Slack thread on new Linear task" for a sprint if needed (noise reduction during heavy dev cycles). Automation supports culture; it doesn't enforce it.

Third rule: metrics tracked at team level, never individual. Slack response time, Linear cycle time, Notion approval duration — all shared in sprint retros, none used in performance reviews. Goal is system optimization, not individual competition.

## Why These Tools, Not Others

We didn't choose Jira over Linear because Jira doesn't incentivize spec-writing — tasks open fast, context added later. Linear does the opposite: description is required, can't be blank. That tiny UX difference creates a cultural shift.

We didn't choose Confluence over Notion because Confluence is enterprise-versioning-focused — too complex for small teams. Notion database views are flexible, Linear and Slack integrations are lightweight.

We didn't choose Discord over Slack because Discord threads are gamified; Slack threads are business-native. Slack search API works natively with Linear task IDs.

We didn't choose Adobe XD over Figma because Figma's API is open and Zapier-compatible. XD's API is restricted.

We didn't choose Otter.ai over Granola because Granola extracts action items natively — Otter produces transcripts but you extract items manually.

Our tool stack isn't static. In 2024, we moved from Loom to Tella (faster uploads, Linear embed support). In 2025, we tried Make.com over Zapier but returned (Zapier error logs are more readable). Tool selection shifts; integration pattern stays: every tool owns one "source of truth" field, others bind to it.