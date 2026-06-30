---
title: "Cross-Channel Orchestration: Paid + Email + Push Attribution"
description: "Build multi-channel marketing attribution using identity graphs, lifecycle event mapping, and hold-out groups. Practical architecture and testing methodology."
publishedAt: 2026-06-30
modifiedAt: 2026-06-30
category: marketing
i18nKey: marketing-007-2026-06
tags: [cross-channel-attribution, identity-graph, lifecycle-marketing, incrementality-testing, marketing-orchestration]
readingTime: 8
author: Roibase
---

Paid media brings users to your site, email attempts to retain them through their lifecycle, push notifications re-engage them — but which channel actually triggered the conversion? Platform-based attribution incentivizes each channel to claim the conversion for itself, making true incrementality unmeasurable. This leaves budget allocation to chance. Cross-channel orchestration solves this by unifying user identity in a central identity graph, triggering lifecycle events from a shared orchestrator, and measuring each channel's true contribution through hold-out groups.

## Why Identity Graph Is Attribution's Foundation

Most multi-touch attribution models fall into the same trap: they try to sequence touchpoints without knowing who the user actually is. A visitor arrives via Google Ads, returns via email, clicks a push notification and purchases — but without proving these are the same person, each channel can claim its own "last-click" credit.

An identity graph solves this by consolidating all signals about the same user across channels (cookies, device IDs, email hashes, customer IDs) into a single profile. This ensures the entire journey from first touch to purchase appears on one timeline. However, most identity graph vendors optimize only for match-rate — what orchestration requires is that the graph integrate with real-time event streams and enable lifecycle triggers to be routed intelligently.

Example scenario: A user signs up via Meta Ads, email triggers 3 days later, push notification goes out on day 7, Google Ads retarget captures the purchase on day 8. The identity graph records this sequence, but without an orchestration layer, each channel operates independently: email segmentation, push scheduling, retargeting audience are all configured in separate systems. This results in sending the same user 4 messages in 24 hours or delaying a lifecycle event.

### Connecting the Graph to the Orchestrator

An identity resolution layer (Segment, mParticle, RudderStack, or custom CDP) listens to the event stream. Each event carries a `user_id` or `anonymous_id` — the system resolves this against the graph and returns all known identifiers. This profile information flows to the orchestration engine (Braze, Iterable, Airship, or custom event-driven pipeline). The orchestrator decides which channel sends which message based on the lifecycle state machine — but writes this decision to a shared event log so downstream attribution models see all touchpoints.

Critical: the orchestrator must not treat channels as silos. Email service providers, push vendors, and paid platforms may be separate systems, but when the orchestrator sends a "send" command, it must carry the same `journey_id` and `event_timestamp` context. This ensures the downstream multi-touch attribution model (linear, time-decay, Shapley value) can properly sequence each touch.

## Lifecycle Event Mapping: Synchronizing Channels on a Shared Timeline

Lifecycle marketing traditionally centers on email: welcome series, abandon cart, winback. When these flows are isolated from other channels, they conflict with paid media retargeting strategies. If a user receives an email offer on day 2, and simultaneously lands in a Google Ads remarketing list for the same offer, that's budget overlap.

A shared lifecycle event map prevents these conflicts. Each lifecycle state (onboarding, engaged, at-risk, churned) is defined in a central state machine, and each state transition triggers an event. This event reaches all channels — but each channel decides "how to message" within its own context. Email sends HTML, push increments a badge counter, paid media updates an audience segment.

Example state transition:

```
USER_STATE_CHANGE
  user_id: abc123
  from_state: onboarding
  to_state: engaged
  trigger: completed_purchase
  timestamp: 2026-06-28T14:22:00Z
  attributes:
    total_spend: 89.00
    category: electronics
```

The orchestrator publishes this event. The email system sees the "engaged" state transition and launches a cross-sell campaign. Push sees the "electronics" interest and queues a new product launch notification. The paid platform (Google Ads Customer Match) updates the "engaged" audience segment and includes it in a high-intent campaign.

Key advantage: every channel sees the same state transition at the same timestamp. The attribution question "did email trigger first, or did the paid media audience sync?" disappears — because both channels reference the `completed_purchase` event and share the same `journey_id` context.

### Keeping the State Machine Conflict-Free

If multiple channels can update lifecycle state simultaneously, conflict risk rises. For example, email may try to mark "at-risk" immediately while push reads "engaged." Prevent this by centralizing state transition authority in a single service — typically the orchestrator. Channels read state but don't write directly; they only trigger events (e.g., "email_clicked"), and the orchestrator processes these against transition rules, then broadcasts updates.

This approach — coordinating signals through a central orchestrator while allowing independent channel execution — is fundamental to [Digital Marketing](https://www.roibase.com.tr/en/dijitalpazarlama) infrastructure maturity: lifecycle logic stays synchronized at one point while each channel operates autonomously.

## Measuring True Incrementality with Hold-Out Groups

Cross-channel orchestration is configured, attribution touch logs are shared — but you still don't know: "would these users convert anyway without these channels?" Only randomized hold-out groups answer this. The combined impact of paid + email + push is not the sum of their individual effects (synergy or cannibalization may apply). Measuring this requires hold-out testing.

A hold-out test removes a cohort of users (typically 10–20%) from the system entirely: this group receives no email, push, or retargeting. The control group receives all channels normally. Test runs for minimum 2–4 weeks (to complete a full lifecycle cycle). At the end, the conversion rate gap between hold-out and control is the true incremental lift of orchestration.

Example scenario: 10,000 users are randomly assigned. 80% control (8,000), 20% hold-out (2,000). After 30 days:
- Control group: 320 conversions (4.0% CVR)
- Hold-out group: 60 conversions (3.0% CVR)
- Incremental lift: +1.0pp, or +33% relative uplift

This proves orchestration is working. But breaking the test by channel goes deeper: comparing "email hold-out," "push hold-out," and "paid hold-out" groups (factorial design) reveals each channel's isolated contribution.

### Anchoring the Hold-Out Group to the Orchestrator

Hold-out assignment must be stored in the identity graph and checked at every channel execution. When a user enters an email trigger, the orchestrator queries: "is this user in hold-out?" If yes, it writes `suppressed_by_holdout` to the event log. The same check applies to push and paid audience syncs.

Critical mistake: enforcing hold-out on email but not paid media. The test becomes invalid — the hold-out group still sees retargeting, so the "no channel" scenario never occurs. A centralized hold-out rule in the orchestrator layer guarantees this consistency.

## Fitting Attribution Model to Multi-Touch Flow

You've built the identity graph and lifecycle orchestrator, measured incrementality with hold-out groups — now decide how to credit touchpoints. Traditional "last-click" breaks when channels operate separately; cross-channel stacks, with all touches in one event log, enable multi-touch attribution (MTA) directly.

Common models:
- **Linear:** Every touchpoint gets equal credit (simple, but over-rewards early touches)
- **Time-decay:** Touches closer to conversion earn more credit (may undervalue mid-funnel lifecycle events)
- **Position-based (U-shape):** First and last touch get 40% each, middle 20% (classic but arbitrary)
- **Data-driven (Shapley value):** Calculates marginal contribution per touchpoint (most accurate, higher computational cost)

At Roibase, we combine Shapley with hold-out results: use hold-out lift as total incremental value, then normalize Shapley credit against it. This lets you show each channel's "true budget contribution" in concrete terms.

### Attribution Window and Lifecycle Overlap

In multi-touch modeling, attribution window is critical. If email uses a 7-day window and paid media uses 1 day, you credit the same user by different rules — adding noise. Define a centralized attribution window for all channels in the orchestrator (e.g., 14 days) and keep lifecycle state transitions within it. If "at-risk" → "engaged" transition triggers email, and paid retargeting fires in the same window, both are visible to the model.

## Production Considerations for Orchestration Stack

Cross-channel orchestration works in theory; in practice, latency, data freshness, and vendor API limits create friction. A few pragmatic points:

**Identity resolution latency:** User arrives via Google Ads; email hash resolution takes 200ms — meanwhile the push trigger fires for an "unknown user." Email and push don't know they're the same person. Solution: in the orchestrator, use a "delayed execution queue" — event reaches the orchestrator immediately, but channel execution waits 1–2 seconds for identity resolution to complete.

**Event log volume:** High-traffic sites generate thousands of events per second (every pageview, click, state transition). The orchestrator can't process this in real-time without stream processing (Kafka, Flink). But critical logic like hold-out decisions must be instant, so keep orchestrator logic stateless and identity checks cached against the graph.

**Vendor API rate limits:** Email providers (SendGrid, Postmark), push vendors (OneSignal), and paid platforms (Google Ads Customer Match) all have upload limits. The orchestrator publishes events immediately, but each channel batches and executes async. This means 5–10 minutes between event trigger and message delivery — acceptable because the orchestrator logs the touchpoint at event time, not execution time.

**A/B testing vs. orchestration conflict:** If you're running email template A/B tests while lifecycle orchestration is active, the orchestrator must write `variant_id` to the event log. Otherwise the attribution model sees "email touchpoint" but not which creative ran — blocking creative optimization. The orchestrator must add variant context to channel execution.

Cross-channel orchestration unifies paid, email, and push into one synchronized system — without removing each channel's autonomy. Each channel keeps its own execution logic; they share only the "when and to whom" decision through the orchestrator. Combined with hold-out testing and multi-touch attribution, this architecture lets you measure each channel's true incrementality and allocate budget based on evidence.