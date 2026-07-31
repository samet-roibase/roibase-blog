---
title: "Server-Side GTM and Conversion API: Zero to Production"
description: "Practical guide to deploying sGTM container on Cloud Run, setting up Meta CAPI integration, and improving measurement quality through event deduplication."
publishedAt: 2026-07-31
modifiedAt: 2026-07-31
category: data
i18nKey: data-001-2026-07
tags: [server-side-gtm, conversion-api, cloud-run, event-deduplication, measurement]
readingTime: 8
author: Roibase
---

The cookie deprecation timeline was postponed for the third time in 2024. But the real inflection point in marketing measurement already happened: after iOS 14.5's ATT, Facebook pixel conversion rates dropped 30-40%, Google Analytics session stitching broke, and attribution windows narrowed from 7 days to 1 day. Server-side measurement is no longer "the future"—it's the only engineering solution to close the attribution gap. This article walks through deploying a server-side Google Tag Manager (sGTM) container on Google Cloud Run from scratch, integrating it with Meta Conversion API (CAPI), setting up event deduplication, and making it production-ready.

## The Anatomy of Server-Side Measurement

Client-side pixels run in the browser—when a user loads a page, JavaScript code collects the event and sends it directly to the platform. This process has three breaking points: ad blockers (active on 40% of user devices), ITP/ETP browser protections (7-day cookie lifespan in Safari), and consent banner rejection (30-50% opt-out rates in Europe). Server-side bypasses these by sending events from your own server, not the user's browser—consent is validated, first-party cookies are read, identity resolution is performed, and enriched data packets are POST'd to platform APIs over HTTPS.

sGTM standardizes this architecture. Tags defined in your Web Container (GA4, Meta Pixel) fire in the browser, but instead of sending the event directly to the platform, they route to your sGTM endpoint. The Server Container receives the event, extracts user_data parameters (email, phone, client IP, user agent), hashes them, and feeds them into the Meta CAPI tag. For deduplication, you generate an event_id and send the same ID to both pixel and CAPI—Meta's backend counts the same event_id as a single conversion, eliminating double counting. This setup can lift Facebook ROAS from the 30-40% post-iOS decline back to 15-20% gains (Meta 2023 benchmark).

Server-side's second major advantage: you escape the browser's attribution window limits. In Safari, ITP prevents 7-day cookies—if a user returns on day 8 and converts, the client-side pixel can't measure it. Server-side keeps first-party cookies (like `_fbc`, `_fbp`) on your own domain with 1-2 year lifespans. You can even use your CRM ID for server-side identity resolution, merging client ID, user ID, and email hash into a single profile. This integrates directly with [first-party data architecture](https://www.roibase.com.tr/en/firstparty) discipline—you consolidate identity across all signals.

## Deploying sGTM Container on Cloud Run

Google Cloud Run is the fastest path to hosting an sGTM container because a pre-built image exists, autoscaling is built-in, and cold start latency is low (100-200ms). Alternatives include App Engine or Kubernetes, but Cloud Run is optimal from an ROI standpoint—for 100K monthly events, costs run $10-15/month (Cloud Run compute + Firestore state storage).

**Step 1: Create GCP project and activate billing.** In the console, create a new project and link a billing account. Configure your local CLI with `gcloud init`.

**Step 2: Create sGTM Server Container.** In Tag Manager UI, create a new "Server" type container. From the top right, select "Manually provision tagging server"—this lets you use your own Cloud Run endpoint instead of auto-provisioned App Engine.

**Step 3: Deploy the Cloud Run service.**

```bash
gcloud run deploy sgtm-prod \
  --image=gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable \
  --platform=managed \
  --region=europe-west1 \
  --allow-unauthenticated \
  --set-env-vars=CONTAINER_CONFIG=<server_container_config_string>
```

Copy the `CONTAINER_CONFIG` string from Tag Manager UI (Settings → Container Configuration). The `--allow-unauthenticated` flag is critical—web clients need to reach this endpoint. The `europe-west1` region provides GDPR-compliant data residency in Europe.

**Step 4: Set up a custom domain.** Cloud Run assigns you a `*.run.app` domain, but this is third-party and some browsers treat cookies as SameSite=None. Map a subdomain from your own domain (e.g., `gtm.roibase.com.tr`). In Cloud Run → Domain Mappings, configure the DNS record—point the `CNAME` to the Cloud Run endpoint, and SSL is auto-provisioned with Let's Encrypt.

**Step 5: Firestore state storage.** sGTM uses Firestore for server-side state (e.g., storing claimed client-side cookies). Enable Firestore in the same GCP project and create a database in the `europe-west1` region. No extra code needed—the sGTM container auto-detects it.

After deployment, `curl https://gtm.roibase.com.tr/healthz` should return `200 OK`. Check logs with `gcloud run logs read sgtm-prod`—any `CONTAINER_CONFIG` parse errors appear here.

## Meta Conversion API Integration and Deduplication

Create a new "Facebook Conversion API" tag in your Server Container (select from Tag Templates or use the "Facebook Conversions API by Stape" Community Template for more flexibility). Basic tag configuration:

**Event Name Mapping:** Map incoming `event_name` parameters from your Web Container to Meta's standard events (purchase → Purchase, page_view → PageView). You can send custom event names, but using standard events is cleaner for pixel dedup.

**User Data Parameters:** Meta CAPI requires `em` (email), `ph` (phone), `client_ip_address`, and `client_user_agent`. sGTM auto-reads these from request headers. You need to pass email/phone from the web client—add it to your dataLayer:

```javascript
window.dataLayer.push({
  event: 'purchase',
  transaction_id: 'T12345',
  value: 99.90,
  currency: 'USD',
  user_email: 'user@example.com'
});
```

In your Tag Template, map `user_email` → `em`. sGTM SHA256-hashes this email before sending to Meta (never send plain text—GDPR/KVKK violation).

**Event Deduplication:** Add an `eventID` parameter to your client-side Facebook pixel tag. Pass this same ID to the server-side. In the sGTM CAPI tag, use the same `event_id`. Meta's backend counts the same `event_id` + `event_name` combo as a single conversion within 48 hours.

Example client-side pixel code:

```javascript
fbq('track', 'Purchase', {
  value: 99.90,
  currency: 'USD'
}, {
  eventID: 'T12345-1627384912'  // transaction_id + Unix timestamp
});
```

In the Server-side Tag, map `event_id` as `{{event.event_id}}` (Event Data → event_id field). Now both pixel and CAPI send the same event_id—double counting drops to zero.

**Testing:** Go to Meta Events Manager → Test Events, grab the test event code, add it as a `test_event_code` parameter to your sGTM tag. Trigger a page event and check Events Manager. For deduplication, fire both pixel and CAPI simultaneously—you should see "Deduplicated" in the Deduplication column.

## Production-Ready Checklist and Monitoring

Before going live, verify these 5 critical points:

**1. Consent Mode v2 integration.** For GDPR/KVKK compliance, Google Consent Mode v2 (mandatory since March 2024) is required. In your Web Container, integrate your CMP (Consent Management Platform) and push consent status (`ad_storage`, `analytics_storage`) to the dataLayer. sGTM can read this and filter events—for example, if `ad_storage: denied`, don't fire the Meta CAPI tag or send only aggregated events (without user_data).

**2. Rate limiting.** Cloud Run's default concurrency is 80 requests per container. During traffic spikes (Black Friday), you can exceed this limit. Set `--max-instances` to 10-20, and Cloud Run auto-scales. For cost control, enforce an `--max-instances` ceiling—uncontrolled scaling can bill $1000+.

**3. Error logging and alerting.** sGTM has no native logging UI—stdout/stderr from Cloud Run writes to Cloud Logging. To catch Meta CAPI HTTP 400/500 errors, log the response in your Custom Tag Template `fetch()` call. Create a Cloud Logging → Log-based Metric for "capi_error_rate" and set a Cloud Monitoring alert (threshold: 5 errors/min).

**4. Latency optimization.** sGTM response time impacts page load speed. Cloud Run cold starts take 100-200ms, warm instances 10-20ms. Keep a minimum of 1 instance running (`--min-instances=1`) to avoid cold starts, though idle costs run $5-10/month. Alternatively, in Cloud Run → CPU allocation, select "CPU is always allocated"—the instance consumes CPU even idle, eliminating cold start penalty.

**5. Server-side GA4 + CAPI simultaneously.** Move GA4 to server-side too—GA4 Server-Side tag is built into sGTM. The same event can fire to both GA4 and CAPI. Note: GA4's `client_id` and CAPI's `fbp` come from different cookies. For identity resolution, pass `user_id` in your dataLayer and use it in both GA4 and CAPI tags—this ensures cross-platform attribution consistency.

In your first production week, check Events Manager daily: match rate (email/phone match), event count (client vs server ratio), deduplication rate. Meta benchmark: 60-70% of server-side events should find user_data matches (with email hashing). If match rate falls below 30%, user_data quality is low—implement email normalization (lowercase + trim) or format phone numbers as E.164.

## Strategic Layers of Server-Side Measurement

sGTM is more than a technical container—it's a marketing data architecture decision. The first layer is event enrichment—you can enrich server-side with CRM data (reading customer LTV from BigQuery, adding product margin). For example, append a `customer_ltv` parameter to purchase events to seed Meta's value-based lookalike audiences.

The second layer is multi-platform orchestration. From the same sGTM container, you can send the same event to Meta CAPI, Google Ads Enhanced Conversions, TikTok Events API, and Snapchat CAPI. Each platform has different user_data matching rules (TikTok phone hash as SHA256, Google email as SHA256+trim)—configure this normalization in your Tag Templates.

The third layer is incrementality measurement. You can A/B test server-side events by splitting traffic—for example, don't send CAPI events to 10% of traffic and measure lift. This type of testing pairs with [data analytics and insights engineering](https://www.roibase.com.tr/en/verianalizi) discipline—you build a causal impact model in BigQuery to measure incrementality.

sGTM costs add up: cloud compute + state storage. For 1M events/month, Cloud Run runs $50-70 and Firestore $10-15. In exchange, closing the attribution gap 15-20%, lifting Meta ROAS, and reducing iOS conversion loss pays back on day one. Setup takes 2-4 weeks (testing + rollout), but once deployed, the container template clones to other accounts in a single day—scalable infrastructure.