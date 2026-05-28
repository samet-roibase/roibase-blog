---
title: "Server-Side Conversions: Meta CAPI Correctly Set Up From Zero"
description: "How to build Meta CAPI + sGTM architecture after iOS 17 and cookie restrictions? Deduplication, event match quality, and attribution infrastructure."
publishedAt: 2026-05-28
modifiedAt: 2026-05-28
category: marketing
i18nKey: marketing-001-2026-05
tags: [meta-capi, server-side-gtm, conversion-api, event-match-quality, attribution]
readingTime: 8
author: Roibase
---

App Tracking Transparency (ATT) acceptance on iOS 17.4 dropped to 12%. Third-party cookie support ended in Chrome Q3 2025. The "Event Source" column in Meta Ads Manager shows pixel contribution fell to 40%. These numbers don't suggest browser-based measurement is insufficient—they demonstrate that measurement itself demands an entirely new architecture. Server-side conversion tracking isn't optional at this point; it's mandatory. The combination of Meta Conversions API (CAPI) with server-side Google Tag Manager (sGTM) is the only infrastructure that minimizes signal loss to acceptable levels.

## Where Browser-Based Measurement No Longer Works

Meta pixel operates through client-side JavaScript. If a user exits the page before the pixel loads, the event disappears. Safari Intelligent Tracking Prevention (ITP) reduces cookie lifetime to 7 days. Ad blocker adoption sits at 42%. Under these conditions, what the pixel sees is 60–70% of actual conversions. The remaining 30–40% are "phantom conversions"—they happened, but Meta never heard about them.

The attribution window has narrowed too. Pixel operates on 1-day click and 7-day view windows. Yet ITP can delete the cookie within 24 hours regardless. In industries with long sales cycles (B2B SaaS, finance, education), 80% of conversions arrive 7+ days later. The pixel sees none of them. Campaign ROAS looks like 1.2; reality is 2.8. Budget shifts to the wrong channel.

Cross-device scenarios collapse entirely. A user sees the ad on mobile, purchases on desktop. Because the pixel reads different cookie domains, it counts them as two separate users. CAPI is sent from the server, carrying user hashes (email SHA-256, phone SHA-256). Both devices match as one person.

## How CAPI + sGTM Infrastructure Works

Server-side conversion tracking consists of two layers: a data collection layer (sGTM container) and an API transmission layer (CAPI endpoint). sGTM is a container deployed on Google Cloud Run. It receives events from client-side GTM, enriches them, and POSTs them to CAPI. Meta's server receives the data, applies deduplication, and feeds it into the attribution model.

Data flows in this sequence:

1. Client-side GTM fires a `purchase` event (dataLayer push)
2. Event is sent to sGTM container URL as an HTTP POST
3. The "Meta Conversions API" tag inside sGTM reads event parameters
4. Adds server IP, user-agent, event_time, external_id (hashed email)
5. POSTs to CAPI endpoint: `https://graph.facebook.com/v19.0/{pixel_id}/events`
6. Meta deduplication algorithm merges pixel + server events
7. If within attribution window, conversion is assigned to campaign

sGTM's critical advantage: the client-side event and server-side event carry the same event_id. When Meta sees this ID, it collapses both events (deduplication). If pixel event arrives and within 5 minutes a server event arrives with the same event_id, Meta counts one conversion. This prevents double counting.

### How Event Match Quality Score Increases

Meta's Event Match Quality (EMQ) score ranges 0–10. It indicates how usable the event parameters are for attribution. Pixel typically scores 2.5–4.5. With CAPI it climbs to 7.5–9.5. Higher scores accelerate campaign learning phase and reduce CPA by 15–30%.

Parameters that raise EMQ score:

| Parameter | Pixel provides? | Server provides? | Weight |
|---|---|---|---|
| `external_id` (hashed email) | ❌ | ✅ | High |
| `client_user_agent` (full) | ✅ (limited) | ✅ (full) | Medium |
| `client_ip_address` | ❌ (proxy) | ✅ (real) | High |
| `fbc` (click ID) | ✅ | ✅ | High |
| `fbp` (browser ID) | ✅ | ✅ (forwarded) | Medium |
| `event_source_url` | ✅ | ✅ | Low |

The most critical parameter pixel cannot send is `external_id`. After email consent is obtained from the user via a GDPR/CCPA-compliant consent management platform (CMP), the backend hashes that email SHA-256 and sends it to sGTM. Meta matches this hash against its own user graph. Match rate sits around 60–80% (depends on email accuracy). For matched users, attribution reliability jumps to 95%.

## Architecture Setup: sGTM Container Deployment and CAPI Configuration

To deploy sGTM container on Google Cloud Run, first create a "Server" container type in GTM. Once you have the container ID (GTM-XXXXXX), deploy on Cloud Run:

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

`--min-instances=1` is critical: it prevents cold starts. First event processes in 50ms instead of 300ms. Once the container is deployed, set a custom domain in GTM: `sgtm.roibase.com.tr`. Add a CNAME in Cloudflare DNS; SSL certificate renews automatically.

In client-side GTM, under "Google Tag: GA4" settings, enable "Send to server container" and enter the container URL. Every GA4 event now flows to sGTM automatically. Inside sGTM, add a "Meta Conversions API" tag:

- **Pixel ID:** 15-digit ID from Meta Ads Manager
- **Access Token:** Events Manager > Settings > Generate Access Token (as system user)
- **Event Name:** Event name from GA4 (`purchase`, `add_to_cart`, etc.)
- **Event ID:** Same ID as client-side (for deduplication)
- **Test Event Code:** See test events in Meta's test dashboard before going live

Access token has no expiration (if using system user token). If compromised, revoke instantly. Store the token as an environment variable in sGTM, never hardcode it.

### Deduplication Strategy and Event ID Management

Deduplication prevents pixel and server events from double-counting. Meta's algorithm works like this: if the same `event_id` and `event_name` arrive within 5 minutes, only the one with the higher EMQ score counts. Usually that's the server event. But if pixel event arrived 1 second earlier and server event arrives 6 minutes later, both count separately.

Generate client-side event_id this way:

```javascript
// Before dataLayer push
const eventId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
window.dataLayer.push({
  event: 'purchase',
  transaction_id: '12345',
  value: 99.99,
  currency: 'TRY',
  event_id: eventId // same ID sent to server
});
```

On the sGTM side, this `event_id` parameter goes into the CAPI payload:

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

Remove test event code before going live. In production, incoming events appear in Meta Events Manager > Data Sources > {pixel_id} > Events within 10 seconds. EMQ score updates in real-time on the same page.

## Attribution Window and Incrementality Testing

CAPI extends the attribution window. While pixel is limited to 7-day click / 1-day view, CAPI supports 28-day click / 1-day view. For iOS users, however, SKAdNetwork attribution window is 0-day (if ATT rejected) or 3-day (if ATT accepted). CAPI cannot override this—it's a platform-level constraint.

Test attribution reliability with geo-based holdout testing. Select 10 Turkish cities: enable CAPI in 5, run pixel-only in 5. After 4 weeks, measure conversion difference between groups. CAPI group shows 22–35% higher conversions (because signal loss is lower). This difference isn't incrementality—just measurement difference. For true incrementality, run Meta Conversion Lift test: pause campaign entirely and measure organic conversions.

[Performance marketing (PPC)](https://www.roibase.com.tr/fr/ppc) strategies are built on CAPI infrastructure. When the bidding algorithm sees server-side conversions, campaign budget optimization (CBO) learns faster. Learning phase drops from 5–7 days to 2–3 days.

## Common Mistakes and Security Layer

Most frequent error: client-side and server-side event_ids don't match. Meta counts two conversions instead of one, ROAS inflates. Second mistake: sending plain-text email in the `external_id` parameter. That's GDPR noncompliance and Meta rejects the event. The hash algorithm must be SHA-256; email must be lowercase and trimmed:

```python
import hashlib
email = "user@example.com"
hashed = hashlib.sha256(email.strip().lower().encode()).hexdigest()
# Returns 64-character hash like 7d8a3c2e1f...
```

Security layer: sGTM container IP is whitelisted at Meta. Only events from approved IPs are accepted. Access token rotation window is 90 days. If leaked, revoke instantly from Events Manager—new token generates in 30 seconds.

Pixel fallback scenario: if sGTM is down (Cloud Run region fails, DNS issue), client-side pixel sends event directly to Meta. This dual-send strategy guarantees 99.95% uptime. But deduplication doesn't work in this case—both events count separately. Monitoring: sGTM container logs stream to Stackdriver; critical errors trigger Slack webhook.

Meta CAPI + sGTM architecture is the backbone of performance marketing in 2026. As iOS privacy updates continue, browser-based tracking narrows further. Companies now treat this transition not as "trend" but as "platform requirement." Campaigns with EMQ score below 7 get stuck in learning phase; CPA runs 40%+ high. Building this architecture right demands engineering discipline—copy-paste tutorials don't cut it. When server-side infrastructure joins first-party data strategy, attribution reliability climbs to 95%. Now it's time to push test events into live traffic and watch EMQ score climb.