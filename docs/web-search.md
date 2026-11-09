# Web Search Tool — Guardrails and Operation

**Status:** Opt-in, disabled by default. Enabled with both
`GLOW_WEB_SEARCH_ENABLED=true` and a free-tier key.

## What it is

The primary OpenAI-compatible model may call a single `web_search` function
for **general factual questions** the user directly asks (services,
definitions, how things work). The gateway executes it via Tavily
(default) or Brave Search and returns title + short snippet results as an
untrusted tool result, then asks the model to summarise in its own words.

## What it is NOT

- **Not the main knowledge source.** The curated, licensed evidence corpus
  (`evidence_entries`, clinician-approved) stays authoritative. The system
  prompt instructs the model that approved evidence overrides web results on
  any clinical matter. When no approved evidence was retrieved, the existing
  "evidence limit" note still applies: no claimed evidence base, no clinical
  instructions.
- **Not for crisis, diagnosis, or medication.** The deterministic safety
  plane runs before generation; crisis turns never reach the tool, and the
  prompt explicitly forbids searching for feelings, crisis content,
  diagnosis, or medication questions.
- **Not a medical information service.** Results are informational only,
  must be paraphrased (never copied at length), and must never be presented
  as personalised advice.

## Privacy boundaries

- Only the search *query* leaves the server (never the transcript).
- Queries are truncated to 200 characters and stripped of control characters.
- The model is instructed not to include sensitive personal details in a
  query; if a useful query would leak them, it must ask the user to rephrase.
- When a search is used, the model discloses it naturally in its reply
  ("I looked this up so I wouldn't guess") and may name the source.
- Free-tier search providers process queries under their own terms; review
  their data-processing terms before enabling in production.

## Operational limits

- **Per-session budget:** `GLOW_SEARCH_MAX_PER_SESSION` (default 5). The
  gateway is constructed per request, so the counter is process-local
  (module-level dict). Multi-process production should back this with Redis
  or the database.
- **Per-turn cap:** at most 3 search rounds inside one turn (tool-loop cap),
  each returning at most `GLOW_SEARCH_MAX_RESULTS` (default 3) results with
  snippets truncated to 300 characters.
- **Timeout:** `GLOW_SEARCH_TIMEOUT_SEC` (default 8s). Failures return an
  "unavailable/no results" tool result — the conversation never breaks.
- **Model compatibility:** providers that reject the tools payload (HTTP 400,
  e.g. some free models without function calling) are retried once without
  tools, then fail over to the existing fallback chain as usual.

## Configuration

```ini
GLOW_WEB_SEARCH_ENABLED=true
GLOW_SEARCH_PROVIDER=tavily        # or brave
GLOW_SEARCH_API_KEY=<free-tier-key>
GLOW_SEARCH_MAX_RESULTS=3
GLOW_SEARCH_MAX_PER_SESSION=5
GLOW_SEARCH_TIMEOUT_SEC=8
```

Free tiers (keys obtainable by the operator, no card required):
Tavily ~1,000 searches/month; Brave Search ~2,000 searches/month.

## Open review items

- Privacy review of the search provider's data-processing terms.
- Qualified clinical review of the "informational content only" boundary.
- DB/Redis-backed per-session budget for multi-process deployments.
- Whether to surface search usage in the chat UI (today it is disclosed
  in-band by the model only).
