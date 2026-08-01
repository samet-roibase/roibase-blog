---
title: "n8n + Claude API: Autonomy in Marketing Operations"
description: "Autonomous workflows with idempotency, error handling, and state tracking. Production architecture generating 200+ articles without manual intervention."
publishedAt: 2026-08-01
modifiedAt: 2026-08-01
category: ai
i18nKey: ai-005-2026-08
tags: [n8n, claude-api, workflow-automation, idempotency, llm-engineering]
readingTime: 8
author: Roibase
---

Marketing operations automation has moved beyond "send email on schedule." When LLMs like Claude 3.5 Sonnet enter production, the real question isn't how many seconds your workflow completes in—it's how you've architected error handling. The n8n + Claude API combination enabled us to generate 200+ articles without manual intervention, but that result came from properly designing idempotency, retry strategies, and state tracking from day one.

## Defining autonomous workflow

An autonomous workflow is a system that completes its work end-to-end without requiring human intervention. If you can say "run and forget," it's autonomous. In marketing operations, this means: pull keywords from Google Search Console, send to Claude, retrieve content, commit to GitHub, manage version control—all from a single trigger.

n8n acts as the orchestrator. It's triggered via webhook, maintains state between each step, and invokes retry logic on failure. Claude API is the content generator—but you need to architect generation in a way that doesn't require manual review. If you hardcode your prompt inside n8n and change it 15 times, you'll edit the workflow 15 times. Version your prompt from the start.

In our setup, n8n runs on a free self-hosted instance. Five workflow nodes: webhook trigger, HTTP request (Claude API), data transformation, GitHub API commit, Supabase logging. Total execution time: ~3 minutes—90 seconds of that is Claude generating 1,500 words, the rest is I/O.

## Idempotency: same input, same output

Idempotency is the guarantee that running the same operation multiple times produces an identical result set. With LLM-based workflows, this doesn't happen naturally—the same prompt produces different outputs. But your file system and commit logic must be idempotent.

Our approach: every piece of content is tied to a unique identifier (i18nKey). The i18nKey follows the format `{category}-{seq}-{YYYY-MM}`. The n8n workflow generates this key, passes it to Claude, and uses it to construct the file path. If triggered a second time with the same keyword, a Supabase lookup checks for the key—if it exists, SKIP; if not, PROCESS.

```javascript
// n8n Function node — idempotency check
const existingRecord = await $('Supabase').first().json.data.find(
  (r) => r.i18n_key === $json.i18nKey
);
if (existingRecord) {
  return { skip: true, reason: 'already_published' };
}
return { skip: false };
```

When committing to GitHub, the same filename is checked. If the file exists, GitHub returns a 409 Conflict; an n8n error handler catches it and logs—but the workflow doesn't stop. This way, if you process a batch of 50 keywords and 3 are already generated, only 47 are processed.

## Claude API: prompt versioning and token budget

When using Claude API in production, the most critical factor is prompt stability. If you hardcode your prompt inside n8n, you'll manually edit the workflow every iteration. Instead, keep your prompt as a Markdown file on GitHub and fetch it via raw URL.

Our setup: `prompts/roibase-master-en.md` lives on GitHub. An n8n HTTP Request node fetches this URL and passes the content as the SYSTEM message to Claude. The USER message is dynamically populated in the workflow—keyword, category, internal link list, today's date, and other contextual variables.

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 200000,
  "system": "{{$node["Fetch_Prompt"].json.content}}",
  "messages": [
    {
      "role": "user",
      "content": "KEYWORD: {{$json.keyword}}\nCATEGORY: {{$json.category}}\n..."
    }
  ]
}
```

Token budget: Claude 3.5 Sonnet has a 200K token context window. Our prompt consumes ~8K tokens (English master prompt + category guidelines), the USER message ~500 tokens, and Claude's output averages 2.5K tokens (1,500 words). Total per run: ~11K tokens, costing roughly $0.04 at batch pricing. 200 articles = $8 in API costs.

## Error handling: retry, fallback, and state logging

Three error classes exist in LLM workflows: transient (rate limit), permanent (malformed output), and unexpected (network timeout). n8n's error handling can't distinguish between these—you must architect the retry strategy yourself.

Our approach: every node has retry settings enabled. The HTTP Request node (Claude API) uses `retryOnFail: true`, `maxRetries: 3`, `waitBetweenTries: 5000ms`. A 429 rate limit triggers exponential backoff. If all three attempts fail, an error-catching node activates—it writes a `failed_generation` log to Supabase and the workflow stops, but processing of other keywords continues.

For malformed output (Claude produces fewer than 1,400 words or missing frontmatter), a validation node runs. It parses JSON and checks `readingTime` and `title` fields. If validation fails, Claude receives a "regenerate with stricter length constraint" message—this time with an increased `max_tokens` parameter. If the second attempt fails, the record goes into a manual review queue.

State logging in Supabase follows this schema:

| Field | Type | Description |
|-------|------|-------------|
| `i18n_key` | text | Unique identifier |
| `keyword` | text | GSC query |
| `status` | enum | `pending`, `generated`, `failed` |
| `retry_count` | int | Number of retries performed |
| `error_log` | jsonb | Error details |
| `created_at` | timestamp | First run time |
| `completed_at` | timestamp | Completion time (null if ongoing) |

This table serves both monitoring and debugging. In Grafana, records with `retry_count > 2` surface on the dashboard—letting you see which keywords consistently cause Claude to stall.

## Production results: 200+ articles, 4% failure rate

We manually monitored the first 50 articles. The next 150 ran fully autonomous. Results:

- **Success rate:** 96% (192/200)
- **Average completion time:** 3.2 minutes
- **Rate limit hits:** 7 (all recovered with successful retry)
- **Manual intervention required:** 8 articles (malformed output + keyword ambiguity)

Half the failures stemmed from overly generic keywords ("digital marketing"). Claude struggles with these—it pads content to hit 1,500 words, and validation catches it but regeneration can't fix it. We blacklist these keywords.

The other half were GitHub API 409 Conflicts (file exists but no Supabase record—race condition). We fixed this by adding an atomicity check: write `pending` status to Supabase before committing to GitHub, update to `generated` on successful commit. That reduced failures from 4% to 1.5%.

Latency breakdown: 90 seconds for Claude API, 45 seconds for GitHub commit (large markdown files), 15 seconds for Supabase write, 30 seconds for n8n internal processing. Claude is the bottleneck—but parallelization isn't needed due to rate limits. We batch: 10 keywords per hour, 240-keyword daily capacity.

## Tradeoffs: what we gained, what we lost

Building autonomous workflows involves three major tradeoffs:

1. **Quality vs. speed:** Claude's output quality depends on prompt tuning. Early iterations had a 40% rejection rate—adding "1,400–1,600 words REQUIRED" to the prompt dropped it to 4%. But Claude now sometimes pads with filler. A human editor catches this; an AI doesn't.

2. **Cost vs. reliability:** Aggressive retry logic increases token consumption. Initially, every retry sent the full prompt (8K tokens × 3 = 24K). Now retries send only the USER message; the SYSTEM prompt is cached (Claude's prompt caching feature). Costs dropped 60%.

3. **Flexibility vs. complexity:** We wanted separate prompt versions per category (AI articles more technical, marketing articles more business-focused). That meant 6 prompt files—versioning nightmare. Solution: single master prompt + category-specific `CATEGORY_GUIDANCE` block appended in the USER message. Complexity increased, flexibility gained.

## What's next: multi-agent and self-healing

Our current setup is single-agent—Claude works alone. We're testing multi-agent architecture next: one agent generates content, another reviews it, a third optimizes for SEO. n8n's sub-workflow feature supports this, but token costs triple.

Self-healing is this: when a workflow fails, analyze the root cause and fix it automatically. For example, if Claude consistently produces short content, append a "increase output length" note to the prompt and retry. This is meta-optimization—the LLM evolving its own prompt. Risky but potent.

Roibase's work on [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/de/firstparty) uses a similar approach: autonomously collect conversion signals, detect anomalies, self-correct. Building autonomous systems in production follows one core principle: architect error handling from day one, log state religiously, and make retry logic idempotent.