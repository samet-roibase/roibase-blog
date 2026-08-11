---
title: "Server-Side Conversions: Setting Up Meta CAPI from Scratch"
description: "sGTM + Conversion API architecture, deduplication logic, and event match quality optimization — evidence-based setup for post-iOS 17 attribution."
publishedAt: 2026-08-11
modifiedAt: 2026-08-11
category: marketing
i18nKey: marketing-001-2026-08
tags: [conversion-api, server-side-gtm, meta-ads, attribution, first-party-data]
readingTime: 8
author: Roibase
---

Since iOS 14.5, browser-based pixels no longer produce reliable signals. When Meta Pixel's event loss rate exceeds 30%, campaign algorithms operate blind. Conversion API is therefore not optional — modern paid media doesn't work without server-side event flow. The problem is setup complexity: sGTM, deduplication, event match quality, and parameter mapping must all align correctly. Otherwise, duplicate events corrupt algorithm performance or missing signals cause optimization to break.

## Why Conversion API Differs from Pixel

Meta Pixel runs in the browser. Safari ITP, Firefox ETP, and consent banner rejection block events. iOS Safari's 7-day cookie limit constrains attribution windows. 2025 Google analytics shows %27 of browsers reject third-party cookies by default (Statcounter data). Pixel alone no longer delivers %100 event coverage.

Conversion API sends events server-side via HTTP POST. No browser limits. User consent technically doesn't block event transmission (you guarantee GDPR compliance — this is a technical document). Server-side events are merged with pixel events via deduplication ID. Meta's algorithm won't count the same conversion twice, but signal quality improves. Event match quality (EMQ) score derives from this fusion — higher EMQ means better targeting, lower CPA.

Server-side setup also provides first-party data control. Unlike pixel, you can add parameters to the `user_data` object: `external_id`, `client_user_agent`, `fbc` (click ID), `fbp` (browser ID). This enriched signal lifts attribution confidence. Per Meta documentation, when EMQ score climbs above 6/10, campaign performance improves %15-25.

### Event Match Quality Score Calculation

Meta's event match quality score weights these parameters:

| Parameter | Weight | Format |
|---|---|---|
| `em` (email) | High | SHA-256 hash, lowercase trim |
| `ph` (phone) | High | E.164 format (+90... style) |
| `fn`, `ln` | Medium | SHA-256 hash |
| `client_ip_address` | Medium | IPv4/IPv6 raw |
| `client_user_agent` | Medium | Raw string |
| `fbc`, `fbp` | High | Click/browser ID |
| `external_id` | Critical | User CRM ID |

Send all parameters, EMQ lands 8-10. Send only `em` + `client_ip_address`, you stay 4-6. On iOS users, `client_ip_address` may be proxied — `external_id` and `fbc` become critical.

## sGTM-Based CAPI Setup

Server-side Google Tag Manager (sGTM) is the most common architecture for Conversion API. Direct backend integration is an alternative but sGTM offers: event collection from web client, deduplication ID management, single endpoint for multiple platforms (Meta, Google, TikTok).

Setup steps:

1. **Deploy sGTM container in cloud.** Google Cloud Run or App Engine recommended. Don't use shared hosting like Taobao App Engine — latency gets high.
2. **Send events from client-side GTM via `dataLayer.push`.** Example:

```javascript
dataLayer.push({
  'event': 'purchase',
  'ecommerce': {
    'transaction_id': 'T12345',
    'value': 99.90,
    'currency': 'USD'
  },
  'user_data': {
    'email_address': 'user@example.com',
    'phone_number': '+905551234567',
    'address': {
      'city': 'Istanbul',
      'country': 'TR'
    }
  }
});
```

3. **Configure Meta Conversion API tag in sGTM.** Event Name Mapping: `purchase` → `Purchase`, `add_to_cart` → `AddToCart`. For each event, sync `event_id` parameter client-side — mandatory for deduplication.

4. **Generate `event_id` logic in client-side GTM.** Create a unique ID (timestamp + random string). Send the same ID to both pixel and sGTM:

```javascript
const eventId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);

// Pixel event
fbq('track', 'Purchase', {value: 99.90, currency: 'USD'}, {eventID: eventId});

// sGTM event
dataLayer.push({
  'event': 'purchase',
  'event_id': eventId,
  ...
});
```

5. **In sGTM tag, map `event_id` to CAPI.** In Meta tag template, enter the `{{Event ID}}` variable in the "Deduplication Event ID" field.

When set up correctly, the same event won't appear twice in Meta Events Manager. You'll see pixel + server event fusion in the "Matched Events" column. If EMQ score is high, you'll get a "Good" or "Great" badge.

## Deduplication Logic and Edge Cases

Deduplication works via `event_id` + `event_time` matching. Meta deduplicate events with the same `event_id` within 48 hours. Issues arise in these scenarios:

- **Client-side event arrives late:** User exits checkout, returns 2 days later, and browser event fires late. Server event already sent; pixel event can't deduplicate. Solution: sync `event_time` parameter to transaction timestamp.
- **Offline conversion:** Phone sales require manual server event. Set `event_time` to actual transaction time, pull `event_id` from CRM.
- **Multiple server instances:** Microservices may process the same transaction twice, sending duplicate events. Solution: derive `event_id` from transaction ID (deterministic hash), use as idempotency key.

Meta documentation expects %95 of events to arrive within 5 minutes. Events exceeding 1 hour may drop from attribution window. Server event latency is critical — on GCP Cloud Run, median latency must stay under 200ms.

## Enrich User Data Parameters

CAPI's power comes from detail in the `user_data` object. Minimum setup sends only `em` + `client_ip_address`, but EMQ score stays low. Optimal setup:

| Parameter | Source | Normalization |
|---|---|---|
| `em` | Form input / CRM | Lowercase, trim, SHA-256 |
| `ph` | Checkout form | E.164 format, SHA-256 |
| `fn`, `ln` | Billing form | Lowercase, trim, SHA-256 |
| `ct`, `st`, `zp`, `country` | Address data | Lowercase, no space |
| `external_id` | CRM user ID | Plain text or hash |
| `client_ip_address` | Request header | Raw IPv4/IPv6 |
| `client_user_agent` | Request header | Raw string |
| `fbc` | URL param `fbclid` | Raw string |
| `fbp` | Cookie `_fbp` | Raw string |

`external_id` is especially important: send unique user ID from your CRM, and Meta can perform cross-device attribution. Same user clicks mobile, purchases desktop — `external_id` matches them.

Use hash correctly:

```javascript
// ❌ Wrong
const emailHash = btoa(email); // Base64 encoding, not hashing

// ✅ Correct
const emailHash = sha256(email.trim().toLowerCase());
```

Meta's Advanced Matching auto-normalizes on pixel side, but server-side events require you to guarantee normalization.

## Testing and Validation

Meta Events Manager has a "Test Events" tool. When sending test events from sGTM, add the `test_event_code` parameter:

```javascript
// sGTM tag settings
Test Event Code: TEST12345
```

You'll see test events in real-time in Events Manager. Check EMQ score, matched parameters, and deduplication status here.

Before going to production, validation checklist:

- [ ] At least 1 purchase event from pixel + server arriving deduplicated?
- [ ] EMQ score above 7/10?
- [ ] `event_time` within 5 seconds of client timestamp?
- [ ] PII hashes in correct format? (Cross-check with Meta's hash tool)
- [ ] sGTM latency under 500ms? (Check via Cloud Monitoring)

If you don't link CAPI setup to [performance marketing](https://www.roibase.com.tr/en/ppc) strategy, high signal quality won't optimize campaigns. Bidding strategy, creative testing, and audience segmentation require separate architecture — CAPI only provides the attribution foundation.

## Conversion Lift and Attribution Window

Server-side events don't extend the attribution window but reduce signal loss. Meta's default: 7-day click / 1-day view. iOS users' pixel likelihood of delivering 7-day signal is low — browser cookie gets cleared. Server event still captures the conversion.

Measure CAPI's lift with an incrementality test. Run pixel only in holdout group, pixel + CAPI in test group. Over 4 weeks, if conversion rate delta hits %15-25, CAPI works. Without conversion lift, high EMQ score alone is meaningless — if you have high EMQ but low lift, something else is broken (creative, offer, audience fit).

Meta's Aggregated Event Measurement (AEM) on iOS imposes 8 conversion event limit. CAPI doesn't remove this limit but compensates for pixel event loss. If iOS users exceed %40, CAPI becomes critical.

When server-side event stack is set up correctly, campaign algorithm gets reliable signal. When EMQ score exceeds 8/10, CPA drops %20-30 (Roibase internal case study, e-commerce vertical, 2025 Q4). Setup looks complex but modern paid media doesn't make it optional — it's required infrastructure.