---
title: "n8n + Claude API: Autonomy in Marketing Operations"
description: "Production architecture for autonomous workflows: idempotency, error handling, and state tracking. Design that powered 200+ articles without manual intervention."
publishedAt: 2026-08-01
modifiedAt: 2026-08-01
category: ai
i18nKey: ai-005-2026-08
tags: [n8n, claude-api, workflow-automation, idempotency, llm-engineering]
readingTime: 8
author: Roibase
---

Automation in marketing operations has moved beyond "send email on schedule." When LLMs like Claude 3.5 Sonnet enter production, the real question isn't how many seconds your workflow completes in — it's how you've architected error handling. The n8n + Claude API combination gave us the ability to generate 200+ articles without manual intervention. But that outcome came from proper idempotency design, retry strategy, and state tracking.

## Defining an autonomous workflow

An autonomous workflow completes end-to-end without human intervention. If you can "run and forget," it's autonomous. In marketing operations, this means: pull keywords from Google Search Console, send to Claude, receive content, commit to GitHub, manage versioning — all triggered once.

n8n is the orchestrator here. It's triggered via webhook, maintains state between steps, and deploys retry logic on failure. Claude API is the content generator — but you need to structure generation so it never requires manual supervision. If you hardcode your prompt inside n8n, every refinement means updating the workflow in 15 places. Version your prompt from the start.

Our setup runs on a self-hosted n8n instance. Five workflow nodes: webhook trigger, HTTP request to Claude API, data transformation, GitHub API commit, Supabase logging. Total execution: ~3 minutes. 90 seconds is Claude generating 1,500 words; the rest is I/O.

## Idempotency: same input, same output guarantee

Idempotency means running the same operation multiple times yields an identical result set. LLM-based workflows don't naturally provide this — the same prompt produces different output. But your file system and commit logic must be idempotent.

Our approach: every piece of content is tied to a unique identifier (i18nKey). Format: `{category}-{seq}-{YYYY-MM}`. The n8n workflow generates this key, passes it to Claude, and uses it for the file path. If triggered a second time with the same keyword, Supabase checks for the key — if present, SKIP; if absent, PROCESS.

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

When committing to GitHub, the same filename is checked. If the file exists, GitHub returns a 409 Conflict. The n8n error handler catches this and logs it — the workflow doesn't crash. In a batch of 50 keywords, if 3 were already generated, only 47 are processed.

## Claude API: prompt versioning and token budget

Running Claude API in production requires one critical thing: prompt stability. Hardcoding your prompt inside n8n means manual workflow edits on every iteration. Instead, store your prompt as a Markdown file in GitHub and fetch it via raw URL.

Our setup: `prompts/roibase-master-en.md` lives in GitHub. An n8n HTTP Request node fetches this URL, passes its content as the SYSTEM message to Claude. The USER message is dynamically populated in the workflow — keyword, category, internal link list, today's date, and other contextual variables.

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

Token budget: Claude 3.5 Sonnet's context window is 200K tokens. Our prompt consumes ~8K (master prompt + category guidance), USER message ~500 tokens, Claude's output ~2.5K tokens (1,500 words). Total: ~11K tokens per run. With batch pricing, cost per run is ~$0.04. 200 articles = $8 in API costs.

## Error handling: retry, fallback, and state logging

LLM workflows encounter three error classes: transient (rate limit), permanent (malformed output), and unexpected (network timeout). n8n's error handler can't distinguish between them — you must architect the retry strategy.

Our approach: explicit retry settings on each node. The HTTP Request (Claude API) node has `retryOnFail: true`, `maxRetries: 3`, `waitBetweenTries: 5000ms`. On rate limit (429), exponential backoff applies. If all 3 attempts fail, an error catching node fires — it writes a `failed_generation` log to Supabase, the workflow halts, but other keywords continue processing.

For malformed output (Claude produces fewer than 1,400 words or missing frontmatter), a validation node activates. It parses JSON, checks `readingTime` and `title` fields. If validation fails, Claude receives: "regenerate with stricter length constraint" — this time `max_tokens` increases. On the second attempt, if still invalid, the item falls into a manual review queue.

State logging in Supabase uses this schema:

| Field | Type | Purpose |
|-------|------|---------|
| `i18n_key` | text | Unique identifier |
| `keyword` | text | GSC query |
| `status` | enum | `pending`, `generated`, `failed` |
| `retry_count` | int | Number of retries performed |
| `error_log` | jsonb | Error details |
| `created_at` | timestamp | First run timestamp |
| `completed_at` | timestamp | Completion time (null if ongoing) |

This table serves both monitoring and debugging. In Grafana, records with `retry_count > 2` appear on the dashboard — showing which keywords consistently cause Claude to stall.

## Production results: 200+ articles, 4% failure rate

We manually supervised the first 50 articles. The next 150 ran fully autonomous. Results:

- **Success rate:** 96% (192/200)
- **Average completion time:** 3.2 minutes
- **Rate limit hits:** 7 (all recovered via retry)
- **Manual intervention required:** 8 articles (malformed output + keyword ambiguity)

Half the failures came from overly generic keywords ("digital marketing" equivalents). Claude struggles to reach 1,500 words on such broad topics — it generates filler. The validation node catches this but regeneration can't fix it. Solution: blacklist the keyword.

The other half: GitHub API returned 409 Conflict (file exists but no Supabase record — race condition). We fixed this by adding an atomicity check: write `pending` status to Supabase before committing to GitHub; only update to `generated` after successful commit. Failure rate dropped from 4% to 1.5%.

Latency breakdown: 90 seconds Claude API, 45 seconds GitHub commit (large Markdown files), 15 seconds Supabase write, 30 seconds n8n internal processing. Claude is the bottleneck — but parallelization isn't worth it due to rate limits. We batch process: 10 keywords per hour, 240 per day capacity.

## Tradeoffs: what we gained, what we lost

Building autonomous workflows involves three major tradeoffs:

1. **Quality vs speed:** Claude's output quality depends on prompt tuning. Early versions had 40% rejection — adding "1,400–1,600 words MANDATORY" to the prompt dropped it to 4%. But Claude sometimes generates filler to hit the target. Humans notice; automation doesn't.

2. **Cost vs reliability:** Aggressive retry logic increases token spend. Initially, every retry sent the full prompt (8K tokens × 3 = 24K). Now retries send only the USER message; the SYSTEM prompt is cached (Claude's prompt caching feature, available since May 2025). Cost dropped 60%.

3. **Flexibility vs complexity:** We wanted category-specific prompts (AI content more technical, marketing content more business-focused). That's 6 separate prompt files — versioning nightmare. Solution: single master prompt + category-specific `CATEGORY_GUIDANCE` block appended to USER message. Complexity increased, but flexibility improved.

## Next steps: multi-agent and self-healing

Current setup is single-agent — Claude works alone. Next iteration tests multi-agent architecture: one agent generates content, another reviews, a third optimizes for SEO. n8n's sub-workflow feature supports this, but token cost triples.

Self-healing means: when a workflow fails, analyze root cause and fix itself. Example: if Claude consistently produces short content, append "output length must increase" to the prompt and retry. Meta-optimization — the LLM evolving its own prompt. Risky but effective.

In Roibase's [First-Party Data & Measurement Architecture](https://www.roibase.com.tr/en/firstparty) work, we use similar principles: autonomously collect conversion signals, detect anomalies, self-correct. Building autonomous systems in production boils down to one core principle: architect error handling from day one, log state thoroughly, and make retry logic idempotent.