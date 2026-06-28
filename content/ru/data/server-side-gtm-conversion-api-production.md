---
title: "Server-Side GTM and Conversion API: From Zero to Production"
description: "Guide to building server-side measurement infrastructure on Cloud Run or Workers. Container template, deduplication logic, and production checklist."
publishedAt: 2026-06-28
modifiedAt: 2026-06-28
category: data
i18nKey: data-001-2026-06
tags: [server-side-gtm, conversion-api, cloud-run, container-deduplication, first-party-data]
readingTime: 8
author: Roibase
---

As the cookie era ends, if your measurement infrastructure still runs in a web container, you've accepted attribution loss. The 30-40% drop in Facebook ROAS after iOS 14.5 is no coincidence — client-side tagging no longer reflects reality. Server-side tagging and Conversion API are the new standard for moving signals to platforms independent of browser restrictions. In this article, we build a production-ready server-side GTM infrastructure from scratch on Google Cloud Run or Cloudflare Workers.

## Where Client-Side Tagging Ends, Server-Side Begins

Google Tag Manager running in a web container executes JavaScript in the visitor's browser. In this scenario, every pixel, every platform SDK sends requests from the client IP. With Safari ITP 2.0, first-party cookie lifetime dropped to 7 days; with Consent Mode v2, opt-out rates hit 60%. When the browser deletes these cookies, the platform API loses identity — the conversion signal becomes orphaned, attribution breaks.

Server-side GTM flips this logic. The web container collects minimal data from the visitor (event name, user agent, IP) and POSTs it to your server. The GTM container running on your server (Docker image) receives this event, enriches it, and sends it server-to-server to the platform API. In this flow, cookies live on the server, not the browser — you control their lifetime, ad blockers are bypassed. Meta Conversion API or Google Analytics 4's Measurement Protocol feed directly from your server — data loss drops from 60% to 10-15%.

This difference demands technical depth. Provider choice, container version, deduplication strategy, event mapping schema — all are critical. Let's build this now.

## Building a Server-Side Container on Google Cloud Run

Google Cloud Run is a serverless container runtime. It builds images from Dockerfile, scales up on demand, scales to zero when idle. The official GTM deployment method isn't Cloud Run (App Engine or manual GCE are preferred) but Cloud Run offers cost advantages — for 5-10 million events per month, roughly $10-20 instead of $30-50.

First step: open a new project in Google Cloud Console. If `gcloud` CLI is installed, the command line is faster:

```bash
gcloud projects create roibase-sgtm-prod --name="Roibase sGTM Production"
gcloud config set project roibase-sgtm-prod
gcloud services enable run.googleapis.com containerregistry.googleapis.com
```

In Google Tag Manager, create a **Server** container type. Under Settings > Container Configuration, note the **Tagging Server URL** (e.g., `https://sgtm.roibase.io`). This custom domain will point to your Cloud Run service.

The official image `gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable` is safe for production but lacks version locking. Our approach: write our own Dockerfile and pin the base image:

```dockerfile
FROM gcr.io/cloud-tagging-10302018/gtm-cloud-image:stable

ENV CONTAINER_CONFIG="<GTM container ID>"
ENV PREVIEW_SERVER_URL="https://sgtm-preview.roibase.io"

EXPOSE 8080

CMD ["/bin/sh", "-c", "/app/start_server"]
```

Deploy this image to Cloud Run:

```bash
gcloud builds submit --tag gcr.io/roibase-sgtm-prod/sgtm-container
gcloud run deploy sgtm-service \
  --image gcr.io/roibase-sgtm-prod/sgtm-container \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars CONTAINER_CONFIG=GTM-XXXXXX
```

To add a custom domain to your Cloud Run service, go to Cloud Run > Domain Mappings > Add Mapping. In your DNS provider, add a CNAME record (`sgtm.roibase.io` → Cloud Run URL). SSL certificate is provisioned automatically (Let's Encrypt).

### Cloudflare Workers Alternative

If you want to stay outside the Google ecosystem, Cloudflare Workers is more flexible. The GTM Server container Docker image doesn't run on Workers, but you can write a custom tagging proxy in Workers. The script below proxies all GTM events and forwards them to GA4 Measurement Protocol:

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  if (url.pathname === '/gtm') {
    const payload = await request.json()
    const measurementId = 'G-XXXXXXXXXX'
    const apiSecret = 'YOUR_API_SECRET'
    
    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: 'POST',
        body: JSON.stringify({
          client_id: payload.client_id,
          events: [{ name: payload.event_name, params: payload.event_params }]
        })
      }
    )
    return new Response('OK', { status: 200 })
  }
  return new Response('Not Found', { status: 404 })
}
```

Workers runtime starts in under 50ms; Cloud Run's cold start is 2-3 seconds. However, Workers lacks GTM's Visual Tag Builder — you must code each platform tag. For now, Cloud Run is more practical.

## Event Deduplication: Don't Count the Same Conversion Twice

When moving to server-side tagging, web and server containers run in parallel. Visitor makes a purchase → client-side Facebook Pixel fires → server-side container receives the same purchase event → Facebook API sees the same conversion twice. ROAS inflates to 200%, the budget optimizer receives false signals.

Solution: event deduplication. Assign each conversion a unique `event_id`; both client and server send the same ID. Facebook ignores the second event with the same `event_id`. Deduplication window is 48 hours (default).

In GTM web container, add `event_id` parameter to Facebook tag configuration:

```javascript
fbq('track', 'Purchase', {
  value: 99.99,
  currency: 'USD'
}, {
  eventID: '{{Transaction ID}}_{{Random Number}}'
});
```

In the server-side container, map the same `event_id` to your Meta Conversion API tag as a user-defined variable. GTM lacks a built-in `Event ID` variable; you must create one manually. Choose Data Layer variable type, variable name `event_id`, default value `{{Page Path}}_{{Random Number}}`.

For Google Analytics 4, it's different. GA4 already merges client-side and Measurement Protocol events (if the same `client_id` and `session_id` exist). No additional deduplication is needed, but `client_id` consistency is mandatory. In GTM web container, select **Send user-provided data** in GA4 tag configuration, map `client_id` field to GTM variable `{{GA Client ID}}`. Use the same value in the server container.

Test this logic in Preview mode before going to production. Create a Preview URL in your GTM server container and target it from the web container. In Chrome DevTools > Network tab, inspect POST requests to `/gtm` endpoint — `event_id` and `client_id` fields must appear in both client and server payloads.

## First-Party Cookies and Session Stitching

Server-side measurement's power lies in fixing user identity via first-party cookies. The web container keeps `_ga` cookie for 2 years; Safari deletes it in 7 days. A server-side container can set its own cookie (`_sgtm`) via the `Set-Cookie` header — because of subdomain matching, it bypasses ITP.

In the GTM server container, select **Client** section > choose **Google Analytics: GA4** client type. This client extracts `client_id` from incoming HTTP requests and writes it to the `_ga` cookie. However, this cookie goes into the response header, not the browser — for the browser to see it, you'd need a GET redirect from the web to the server instead of POST (complex).

Simpler approach: add `client_id` to DataLayer from the web container; the server container captures it and stores it in your own database. For example, a `user_sessions` table in BigQuery:

```sql
CREATE TABLE analytics.user_sessions (
  client_id STRING,
  session_id STRING,
  first_visit_timestamp TIMESTAMP,
  last_event_timestamp TIMESTAMP,
  device_category STRING,
  geo_country STRING
);
```

MERGE into this table on every server-side event. If the same `client_id` appears across different sessions, you can perform identity resolution — [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/ru/firstparty) deepens schema design for this kind of cross-session stitching.

### User-Agent Client Hints and IP Enrichment

The server-side container reads user agent and IP from client request headers. However, with Chrome 110+, the User-Agent string is frozen — detailed browser/OS data now lives in **User-Agent Client Hints** (UA-CH). You must parse these hints in your server container.

Define a custom JavaScript variable in GTM server container:

```javascript
function() {
  const headers = getAllEventData().headers || {};
  const uach = {
    brand: headers['sec-ch-ua'],
    mobile: headers['sec-ch-ua-mobile'],
    platform: headers['sec-ch-ua-platform']
  };
  return uach;
}
```

Pass this data to Meta Conversion API's `user_data.client_user_agent` field. For IP enrichment, use the MaxMind GeoIP2 database (mount it to your Cloud Run instance). Alternative: Google Cloud's built-in IP geolocation API (paid).

## Production Checklist: Rate Limit, Monitoring, Fallback

Before moving your server-side container to production, these checks are mandatory:

**1. Rate limiting:** Platform APIs impose max request limits (Meta Conversion API 200 req/s, GA4 Measurement Protocol 1000 req/s). In GTM container **Client** settings, set the throttle value. Limit Cloud Run max instances (`--max-instances 5`).

**2. Error handling and retry:** If a server-side tag gets HTTP 500, set up retry logic. GTM lacks built-in retry — write a custom tag template. When Meta API returns 429 (Too Many Requests), apply exponential backoff.

**3. Monitoring:** Cloud Run logs go to Stackdriver. Search error patterns with `gcloud logging read`. Critical metrics: request latency (p95 < 500ms), error rate (< 1%), container memory usage (512MB default, 1GB ideal).

**4. Fallback mechanism:** If the server container goes down, the web container still sends pixels. But server-only events (backend conversions) are lost. For fallback, write events to Pub/Sub and replay from the dead-letter queue.

**5. Consent Mode v2 integration:** GTM server container can't read CMP signals (they're client-side). In the web container, write consent state to DataLayer (`ad_storage: 'denied'`); the server container reads it and conditionally runs platform tags.

First-week metrics in production:

| Metric | Target | Tracking |
|--------|--------|----------|
| Event delivery rate | > 98% | Cloud Run logs |
| Deduplication accuracy | < 2% duplicate | Platform dashboards |
| Latency p95 | < 500ms | Cloud Monitoring |
| Cost per 1M events | < $5 | GCP Billing |

## What to Do Now

Server-side GTM infrastructure is built once and continuously optimized. First step: audit your existing web container — which tags must stay client-side (A/B test tools), which can move to the server (analytics, conversion tracking). Next: validate deduplication in test environment — over 2% duplicate rate in production is unacceptable. Cloud Run deployment is sufficient to start; when event volume exceeds 50 million per month, a GKE cluster becomes more cost-effective. Server-side measurement is no longer optional — it's required infrastructure for attribution accuracy.