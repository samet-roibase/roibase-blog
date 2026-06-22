---
title: "Tool Stack 2026: Roibase Team's Daily Operations"
description: "Linear, Notion, Slack, Figma, Granola — integration patterns, meeting economics, and measurable productivity discipline in async-first teams."
publishedAt: 2026-06-22
modifiedAt: 2026-06-22
category: lifestyle
i18nKey: lifestyle-004-2026-06
tags: [tool-stack, async-first, workflow, productivity, linear]
readingTime: 7
author: Roibase
---

Roibase operates a 12-person team distributed across 8+ timezones. There is no meeting culture — 4–5 hours of Zoom per month, the rest flows async. This discipline cascades into tool selection and detail. Linear sprint velocity rose from 8.2 to 12.1, Notion task-to-completion time dropped from 3.7 days to 1.9 days, Slack median response time sits at 47 minutes. These figures span Q2 2024 to Q2 2026. Integration patterns rest on culture discipline before software—tool stack is scaffolding; the real work is systemic behavior.

## Linear: Sprint Discipline and Cycle Rhythm

We adopted Linear in mid-2023, migrating from Jira. The shift was not just UI—workflow rhythm was rebuilt entirely. Two-week cycles, scope lock at cycle start: new tasks don't enter mid-cycle; they queue in the backlog; prioritization happens at cycle end. This pattern made sprint velocity predictable—cycle completion rate rose from 62% in Q3 2024 to 89% in Q2 2026.

Each task in Linear carries three metrics: story point (complexity), priority (P0–P3), due date. Story points are Fibonacci (1, 2, 3, 5, 8); anything above 8 auto-splits. Priority criteria: P0 = production down, P1 = client-blocking, P2 = roadmap-critical, P3 = nice-to-have. Due dates are task-specific, not cycle-end—this distinction cuts context-switching cost.

### Linear ↔ Notion Integration

When an issue is created in Linear, a Zapier trigger adds a row to a Notion database. That row carries four fields: issue ID, title, assignee, status. Status changes in Linear trigger a webhook that updates Notion. This database feeds sprint retrospectives—closed issues embed in cycle notes; velocity charts auto-generate. This flow saved 14 minutes per meeting (manual copy-paste eliminated).

## Notion: Documentation Hub and Async Context

We use Notion in three layers: company wiki, project pages, meeting notes. The wiki spans 47 pages across 18 categories—onboarding docs, tool access guides, client SOPs, internal processes (HR, finance, tech stack). Average page length is 820 words; each page contains at least one internal cross-reference link. This interlink density accelerates wiki discovery—new hires read 38 pages in the first two weeks; onboarding completion time dropped from 9.2 days to 6.1 days.

Project pages are client-specific. Each client gets one workspace containing roadmap, weekly check-in notes, shared assets (Figma links, GA property IDs, API keys). Roadmap template: objectives (quarterly), key results (monthly), task breakdown (Linear links). Weekly check-ins are written async—sent Friday EOD; the Notion page is embedded in the email. Clients don't access Notion directly; we export PDFs. This pattern eliminated mail thread chaos—retrieving past notes took 2 seconds (Notion search) instead of 4 minutes (mail search).

Meeting notes use a template: agenda, attendees, decisions, action items (with Linear issue links). Action item checkboxes trigger a Slack webhook when checked, posting a summary to the relevant channel. This automation cut action-item amnesia by 83%—under the old system, 34% of action items were forgotten within three days.

## Slack: Channel Strategy and Notification Discipline

We maintain 24 Slack channels: 12 project, 4 internal (engineering, design, ops, random), 8 topic-based (seo-insights, data-pipeline, client-alerts). Channel naming follows convention: `prj-{client}` (projects), `int-{department}` (internal), `top-{subject}` (topic). This consistency boosts Slack search accuracy—you reach the right channel in three keystrokes.

Every channel has a pinned message: channel purpose, key links (Linear project, Notion page, shared drive), response time expectation. Response time SLA is critical: `prj-` channels expect reply within 2 hours, `int-` channels within 8 hours, `top-` channels are best-effort. This makes async flow predictable—P0 issues open in Linear, not Slack; we don't use urgent notifications.

### Slack ↔ Linear Bot

The Linear bot supports three commands: `/linear create`, `/linear list`, `/linear close`. Create spawns a task from the thread; description auto-includes the thread permalink. List shows open tasks by assignee. Close closes the issue in Linear and adds a checkmark reaction to the thread. This bot cut engineering cycle time by 1.4 days—the context switch (Slack to Linear) was a compounding cost.

## Figma: Design Handoff and Version Control

Figma spans three workspaces: Client Projects, Internal Brand, Experiments. Each project in Client Projects gets one file; each file has pages (Homepage, Product Page, Checkout Flow). Every page uses a component library. Roibase builds client-specific design systems rooted in [brand discipline](https://www.roibase.com.tr/en/branding); the component library derives from brand guidelines.

Design handoff happens by embedding Figma links in Linear issue comments. Links are not static—they bind to Figma version history. A developer clicking the link sees the latest commit; inspect mode opens automatically. This cut design-dev handoff from 2.1 days to 0.8 days—under the old process, developers asked "which version is latest?" on Slack, designers sent screenshots, and feedback loops extended.

Figma plugins: Stark (accessibility check), Content Reel (placeholder text generation), Autoflow (user flow diagram). Stark runs at every design review; any WCAG AA violation opens a Linear issue. Content Reel makes placeholder copy realistic—product-specific dummy text instead of "Lorem ipsum"—adding clarity to client reviews.

## Granola: Meeting Intelligence and Async Summary

Granola joined the stack in Q4 2025—an AI meeting note tool. It transcribes Zoom calls and generates summaries and action items. Previously, meeting notes were manual; a 30-minute call required 15 minutes of cleanup. Granola's automatic summary posts to Notion; action items open as Linear issues.

Async value is here: due to timezone spread, colleagues who couldn't attend the call read an 8-minute summary instead of a 60-minute recording. Summary format: key decisions, open questions, next steps. Open questions post to a Slack thread; async replies come in; the next meeting marks them resolved. This pattern cut meeting frequency by 40%—bi-weekly syncs became tri-weekly.

### Granola ↔ Notion Pipeline

Granola webhooks summaries to Zapier, which POSTs to the Notion API. A new row enters the meeting notes database carrying five fields: date, attendees (multiselect), summary (rich text), recording link, related project (relation). Summary action items use `@{assignee}` mentions; mentioned people receive Slack DMs. This pipeline eliminates manual follow-up—under the old system, the meeting host manually posted action items to Slack; 22% were forgotten.

## Integration Patterns and Tradeoffs

Five tools run on 12 webhooks and 6 Zapier zaps. Webhook failure rate: 0.7% monthly (3–4 errors). Zapier median execution time: 4.2 seconds. Integration cost: Zapier Professional $240/year, Linear Business $480/year (12 seats), Notion Team $192/year, Figma Professional $180/seat/year (3 designers = $540), Granola Business $360/year. Total: $1,812/year, or $151 per person annually. This cost is offset by time saved: 12 people × 2 hours/week in meeting reduction × $50/hour × 52 weeks = $62,400/year.

First tradeoff: integration complexity extends onboarding. A new hire learns 5 tools and 12 integrations; first-week documentation reading takes 6 hours. An all-in-one alternative (e.g., ClickUp) onboards faster but sacrifices workflow flexibility—Linear's cycle discipline, Figma's version control, Granola's AI summary don't exist (or are crippled) in ClickUp.

Second tradeoff: vendor lock-in risk. Five tools, five vendors; any could change pricing or drop features. Mitigation: critical data lives in Notion (JSON export is simple), Linear data gets SQL dumps (weekly backup), Figma files mirror to Git LFS (version history preserved). This backup discipline keeps migration cost low—migration to new tooling is feasible within two weeks if necessary.

Async-first workflows demand culture discipline before tool selection—notification rules, response time SLAs, documentation rigor. Tool stack makes this discipline measurable, not its creator. Roibase reviews sprint velocity, cycle completion rate, and meeting frequency quarterly; if trends reverse, workflow rules are revised. In Q2 2026, Linear cycle completion is 89%, Notion page internal link density is 3.2, Slack median response time is 47 minutes—these numbers show async discipline is sustainable.