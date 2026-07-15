---
title: "Tool Stack 2026: Daily Operations of the Roibase Team"
description: "Linear, Notion, Slack, Figma, Granola — integration patterns and how we establish async-first team discipline."
publishedAt: 2026-07-15
modifiedAt: 2026-07-15
category: lifestyle
i18nKey: lifestyle-004-2026-07
tags: [tool-stack, async-workflow, linear, notion, team-operations]
readingTime: 8
author: Roibase
---

In 2026, choosing a tool stack is no longer just "which app are you using." The real question is: how do you integrate these tools, how do you lower context-switching costs, how do you enforce async-first discipline. At Roibase, a 12-person multidisciplinary team — marketing, data, headless commerce, brand strategy — operates on a single operational stack. This article shares our five core tools and integration patterns. Key metrics: average 2.3 hours of meetings daily, async response time under 4 hours, sprint velocity predictability at 87%.

## Linear: Sprint Discipline, Not Backlog Bloat

We've used Linear since 2024. The shift from Jira: speed and forced consensus. In Linear, every issue must be bound to a cycle (sprint) — you can't bloat a backlog. Our cycles run 2 weeks, starting Monday. At each cycle start, velocity target: 40–45 story points per team member. This number comes from the average of the last six cycles — measurement, not guesswork.

Linear's strongest feature: the project-issue hierarchy. We use it this way: each client campaign is a project, epics underneath (e.g., "Q3 brand refresh"), tasks under epics. Tasks auto-post to Slack — you can create issues directly from a Slack thread with `/linear create`. No "let's move this conversation to Linear" friction. The thread links to the Linear issue; context stays intact.

One more rule: issue assignee is always a single person. If "we'll do this together," we open a parent issue with two sub-tasks underneath. This kills accountability ambiguity. In sprint retrospective, our velocity-hit rate is 87% — average of the last 12 cycles. This stability comes from Linear's due date and estimate enforcement.

## Notion: Single Source of Truth, Dual Purpose

Notion works in two layers for us: documentation and decision log. Documentation is standard — onboarding, SOPs, runbooks. The decision log is more critical. Every strategic decision (tool switch, client onboarding process revision, new hire JD) opens as a Notion page. Template: context, options (table), decision, rationale. This way, six months later, you can look back and ask "why did we choose this tool?"

Notion-Linear integration isn't native yet; we wired it through Zapier. When an epic completes in Linear, the relevant project page in Notion auto-receives a "completed" tag. Minor but important — because PMs live in Linear, stakeholders live in Notion. Both sides need to stay current.

Notion's weakest point: search. After 400+ pages accumulate, search quality drops. We enforced a tagging discipline: every page gets at least three tags (team, project type, status). We filter instead of search — this way, the search engine's hallucination problem shrinks.

### Knowledge Base vs. Chat Memory

We don't tie Notion to team chat (Slack). Chat is ephemeral; Notion is persistent. If a decision happens in chat, someone manually moves it to Notion. This friction is intentional — we don't want everything in Notion. Only reusable knowledge goes there. Slack thread retention is 90 days — threads not pinned after that auto-archive. This rule makes Notion truly "single source of truth."

## Slack: Async-First, Meeting-Last

We have 42 Slack channels. Rule: one channel per client, one per internal function (e.g., #data-ops, #brand-strategy). No private channels — transparency is default. Only HR topics go to DMs. This speeds onboarding — a new hire reads all context from channel history day one.

Async-first culture runs on Slack thread discipline. Rule: every message either gets a threaded reply or a reaction. If a message gets no reaction within 2 hours, that's a signal: "nobody owns this topic." Average response time in threads: 4.2 hours (last 30 days). This cuts the need for sync meetings.

Slack-Linear integration is bidirectional: you open issues with `/linear` in Slack, Linear updates land in Slack as notifications. This way, PMs live in Linear, developers in Slack — both stay current. Notification noise is a problem? Yes. We solved it this way: each user sets their own mention keyword (e.g., "@john-urgent"), and only that keyword triggers a push notification. Other notifications land in an asynchronously-read "Updates" channel.

## Figma: Design Handoff, No Complaints

For us, Figma isn't just UI/UX — it's brand asset management. Each client has a Figma workspace: logo variants, color palettes, typography system, slide templates all there. Developer handoff happens via Figma's inspect mode — no "what hex code is that blue" arguments.

Figma-Notion integration is manual. Once design finalizes, we embed the Figma link in the Notion project page. Stakeholders see the design without leaving Notion. We don't use Figma's comment feature — because comments stay in Figma, they don't land in Slack. All feedback lands in a Slack thread; the designer then applies it to Figma.

Figma's version control is strong, but naming discipline falls on you. Our rule: every major revision gets "v1.0," "v2.0" labeling. Minor iterations are "v1.1," "v1.2." This way, you can tell a client "you approved v2.3" — no file ambiguity.

## Granola: Turn Meetings Into Async Artifacts

We added Granola at the end of 2025. It's an AI meeting notes tool — but our use case differs. Granola isn't just transcript; it extracts action items. When a meeting ends, Granola auto-opens a Linear issue and assigns it. No "did we get that meeting into Linear" friction. It's automatic.

Granola's best feature: it webhooks the meeting summary to Slack. Five minutes after a meeting ends, the team member who didn't attend reads the summary in #meeting-notes. This creates async transparency — FOMO shrinks, unnecessary meeting attendance shrinks.

Granola doesn't have native Notion integration yet. We do this manually: critical client meeting summaries from Granola get copied into the Notion decision log. This friction is intentional — we don't want every meeting in Notion. Only strategic decisions go there.

## Integration Patterns: Placing Friction Deliberately

A tool stack's success isn't just which tools you pick — it's where you place friction. We have three deliberate friction points:

1. **Slack → Notion:** Not automatic. Chat decisions get manually moved. This keeps Notion noise-free.
2. **Figma → Linear:** No comment integration. Feedback collects in Slack. This keeps feedback in one place.
3. **Granola → Notion:** Not automatic. Critical meetings get manually moved. This keeps the Notion decision log high-quality.

These friction points run counter to "automate everything" thinking, but they're intentional. Because automation's cost: losing track of where information lives. By placing friction, we build information hierarchy: Slack is ephemeral, Linear sprint-scoped, Notion strategic.

## Numerical Results: Operational Efficiency

Q2 2026 metrics:
- Average daily meeting time: 2.3 hours (Q2 2024: 4.1 hours)
- Async response time: 4.2 hours (target: under 4 hours)
- Sprint velocity predictability: 87% (last 12 cycles)
- Median Linear issue open-to-close: 3.8 days
- Notion pages: 412 (active), filter usage vs. search: 78%

These numbers don't come from tool choice — they come from integration discipline. If Linear, Notion, Slack lived as separate silos of "best tool," context-switching cost would be double. By designing integration patterns deliberately — especially friction points — we maintain operational velocity.

A tool stack isn't a software list. Team discipline, naming conventions, async culture, accountability rules — they all work together. Just as in [Brand Identity & Branding](https://www.roibase.com.tr/de/branding) work, operational identity requires consistent patterns. Tools change; patterns persist.