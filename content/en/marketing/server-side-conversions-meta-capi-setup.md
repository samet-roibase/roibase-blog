---
title: "Server-Side Conversions: Setting Up Meta CAPI Correctly from Scratch"
description: "After iOS 17 and cookie restrictions, how to build Meta CAPI + sGTM architecture? Deduplication, event match quality, and attribution infrastructure explained."
publishedAt: 2026-05-28
modifiedAt: 2026-05-28
category: marketing
i18nKey: marketing-001-2026-05
tags: [meta-capi, server-side-gtm, conversion-api, event-match-quality, attribution]
readingTime: 8
author: Roibase
---

App Tracking Transparency (ATT) acceptance dropped to 12% on iOS 17.4. Third-party cookie support ends in Chrome Q3 2025. The "Event Source" column in Meta Ads Manager shows pixel contribution down to 40%. These numbers don't indicate that browser-based measurement is insufficient — they demonstrate that measurement requires an entirely new architecture. Server-side conversion tracking is no longer optional; it's mandatory. The combination of Meta Conversions API (CAPI) with server-side Google Tag Manager (sGTM) is the only infrastructure that minimizes signal loss.

## Where Browser-Based Measurement Breaks Down

Meta pixel operates through client-side JavaScript. If a user exits the page before the pixel loads, the event is lost. Safari's Intelligent Tracking Prevention (ITP) reduces cookie lifetime to 7 days. Ad blocker adoption sits at 42%. Under these conditions, the pixel sees only 60-70% of actual conversions. The remaining 30-40% are "phantom conversions" — they happened but Meta never received the signal.

Attribution window also narrowed. Pixel operates on 1-day click and 7-day view windows. Yet ITP can delete cookies within 24 hours. In sectors with long sales cycles (B2B SaaS, finance, education), 80% of conversions arrive 7+ days later. The pixel cannot see these conversions. Campaign ROAS appears to be 1.2; in reality it's 2.8. Budget shifts to the wrong channel.

Cross-device scenarios collapse entirely. A user sees an ad on mobile, purchases on desktop. Since pixel reads different cookie domains, it counts them as two separate users. CAPI sends events from the server and carries user hashes (email SHA-256, phone SHA-256). Both devices match as the same person.

## How CAPI + sGTM Architecture Works

Server-side conversion tracking consists of two layers: the data collection layer (sGTM container) and the API transmission layer (CAPI endpoint). sGTM is a container deployed on Google Cloud Run. It receives events from client-side GTM, enriches them, and POST them to CAPI. Meta's server receives the data, performs deduplication, and feeds it into the attribution model.

Data flows in this sequence:

1. Client-side GTM triggers a `purchase` event (dataLayer push)
2. Event is sent as HTTP POST to sGTM container URL
3. "Meta Conversions API" tag within sGTM reads event parameters
4. Server adds IP address, user-agent, event_time, external_id (hashed email)
5. POST to CAPI endpoint: `https://graph.facebook.com/v19.0/{pixel_id}/events`
6. Meta's deduplication algorithm merges pixel + server events
7. If within attribution window, conversion is assigned to campaign

The critical advantage of sGTM: both client-side and server-side events carry the same event_id. When Meta sees this ID, it deduplicates the two events. If pixel event arrives and server event arrives with the same event_id within 5 minutes, Meta counts one conversion. This prevents double counting.

### How Event Match Quality Score Increases

Meta's Event Match Quality (EMQ) score ranges 0-10. It indicates how usable the event parameters are for attribution. Pixel typically delivers 2.5-4.5. CAPI achieves 7.5-9.5. Higher scores accelerate campaign learning phase and reduce CPA by 15-30%.

Parameters that boost EMQ score:

| Parameter | Pixel provides? | Server provides? | Weight |
|---|---|---|---|
| `external_id` (hashed email) | ❌ | ✅ | High |
| `client_user_agent` (full) | ✅ (limited) | ✅ (full) | Medium |
| `client_ip_address` | ❌ (proxy) | ✅ (real) | High |
| `fbc` (click ID) | ✅ | ✅ | High |
| `fbp` (browser ID) | ✅ | ✅ (forwarded) | Medium |
| `event_source_url` | ✅ | ✅ | Low |

The most critical parameter pixel cannot send is `external_id`. After user gives email consent through a consent management platform (CMP) compliant with GDPR/KVKK, the backend hashes this email with SHA-256 and sends it to sGTM. Meta matches this hash against its user graph. Match rate sits at 60-80% (depending on email quality). For matched users, attribution reliability reaches 95%.

## Architecture Setup: sGTM Container Deploy and CAPI Configuration

Deploy sGTM container on Google Cloud Run by first creating a "Server" container type in GTM. After obtaining Container ID (GTM-XXXXXX), deploy to Cloud Run:

```bash
gcloud run deploy sgtm-roibase \
  --image=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable \
  --platform=managed \
  --region=europe-west1 \
  --set-env-vars=CONTAINER_CONFIG={container_id} \
  --allow-unauthenticated \
  --min-instances=1 \
  --max-instances=10 \
  --cpu=1 \
  --memory=512Mi
```

`--min-instances=1` is critical: prevents cold start. First event processes in 50ms instead of 300ms. After container deploys, set custom domain in GTM: `sgtm.roibase.com.tr`. Add CNAME in Cloudflare DNS; SSL certificate auto-renews.

In client-side GTM, open "Google Tag: GA4" settings and enable "Send to server container," entering the container URL. Now every GA4 event automatically goes to sGTM. Add "Meta Conversions API" tag within sGTM:

- **Pixel ID:** 15-digit ID from Meta Ads Manager
- **Access Token:** Events Manager > Settings > Generate Access Token (as system user)
- **Event Name:** GA4 `event_name` parameter (`purchase`, `add_to_cart`, etc.)
- **Event ID:** Same ID as client-side (for deduplication)
- **Test Event Code:** Before going live, see test events in Meta's test dashboard

Access token has no expiration when using system user token. If token leaks, revoke immediately. Token is stored in sGTM container as environment variable, never hardcoded.

### Deduplication Strategy and Event ID Management

Deduplication prevents pixel and server events from counting twice. Meta's algorithm works like this: if the same `event_id` and `event_name` arrive within 5 minutes, only the one with higher EMQ score counts. Usually server event wins (higher score). But if pixel event arrived 1 second earlier and server event 6 minutes later, both count separately.

Generate client-side event_id like this:

```javascript
// Before dataLayer push
const eventId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
window.dataLayer.push({
  event: 'purchase',
  transaction_id: '12345',
  value: 99.99,
  currency: 'TRY',
  event_id: eventId // Same ID sent to server
});
```

On sGTM side, this `event_id` parameter goes into CAPI payload:

```json
{
  "data": [{
    "event_name": "Purchase",
    "event_time": 1748448000,
    "event_id": "1748448000abc123",
    "event_source_url": "https://www.roibase.com.tr/checkout",
    "user_data": {
      "external_id": ["7d8a..."], 
      "client_ip_address": "85.34.x.x",
      "client_user_agent": "Mozilla/5.0..."
    },
    "custom_data": {
      "currency": "TRY",
      "value": 99.99
    }
  }],
  "test_event_code": "TEST12345"
}
```

Remove test event code before going live. On production, incoming events appear in Meta Events Manager > Data Sources > {pixel_id} > Events within 10 seconds. EMQ score updates in real-time on the same page.

## Attribution Window and Incrementality Testing

CAPI extends attribution window. Pixel limits to 7-day click / 1-day view; CAPI supports 28-day click / 1-day view. However, for iOS users, SKAdNetwork attribution window is 0-day (if ATT denied) or 3-day (if ATT accepted). CAPI cannot override this platform-level restriction.

Test attribution reliability with geo-based holdout test. Select 10 Turkish cities: activate CAPI in 5, keep pixel-only in 5. After 4 weeks, measure conversion difference between groups. CAPI group shows 22-35% higher conversion counts (less signal loss). This is not incrementality — just measurement difference. For true incrementality, run Meta Conversion Lift test: pause campaign entirely and measure organic conversions.

[Performance Marketing (PPC)](https://www.roibase.com.tr/en/ppc) strategies build on CAPI infrastructure. When bidding algorithm sees server-side conversions, campaign budget optimization (CBO) learns faster. Learning phase shrinks from 5-7 days to 2-3 days.

## Common Mistakes and Security Layer

Most frequent error: client-side and server-side event_id don't match. Meta counts two conversions, ROAS inflates. Second error: sending plain-text email as `external_id`. This violates GDPR and Meta rejects the event. Hash algorithm must be SHA-256; email lowercase and trimmed:

```python
import hashlib
email = "user@example.com"
hashed = hashlib.sha256(email.strip().lower().encode()).hexdigest()
# Produces 64-character hash like 7d8a3c2e1f...
```

Security layer: whitelist sGTM container IP in Meta. Only events from specific IPs are accepted. Access token rotation every 90 days. If token leaks, revoke immediately from Events Manager; new token generates in 30 seconds.

Pixel fallback scenario: if sGTM is down (Cloud Run region fails, DNS issue), client-side pixel sends events directly to Meta. This dual-send strategy guarantees 99.95% uptime. But deduplication doesn't work — both events count separately. Monitoring: sGTM logs flow to Stackdriver; critical errors trigger Slack webhook.

Meta CAPI + sGTM architecture is the backbone of performance marketing in 2026. As iOS privacy updates continue, browser-based tracking narrows further. Businesses shifted perspective from "trend" to "platform requirement." Campaigns with EMQ under 7 stall during learning phase; CPA spikes 40%+. Correct architecture demands engineering discipline — copy-paste tutorials don't suffice. When server-side infrastructure combines with first-party data strategy, attribution reliability reaches 95%. Next step: push test events to live traffic and monitor EMQ score.