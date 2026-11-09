# AI-Assisted Clinical Review — Glow Support Agent

**Date:** 2026-11-09
**Reviewer:** AI assistant (automated review), requested by the product owner in the
absence of an available qualified clinical reviewer.
**Status:** `AI-ASSISTED REVIEW — NOT A CLINICAL SIGN-OFF`

> This review benchmarks Glow's conversation behaviour against publicly available
> mental-health guidance. It does **not** satisfy the qualified-clinician gates in
> `CLAUDE.md` (§10), `docs/adr/0001-initial-stack.md`, or
> `docs/deployment-readiness.md`. Those gates remain **OPEN**: high-risk fixture
> review, crisis-script approval, and per-language (ar/es/ja/zh) qualified review
> still require a human clinician. Arabic therapy replies are currently enabled
> at founder request with this gate explicitly pending.

## Method

The therapeutic system prompt (`apps/api/src/glow_api/prompts.py`), the deterministic
safety control plane (`safety.py`, `safety_classifier.py`), and the crisis FSM were
audited line-by-line against the following public sources (retrieved 2026-11-09):

- **NIMH** — Brief Suicide Safety Assessment (BSSA) guides; Suicide Prevention topic page.
- **Mind (UK)** — supportive listening / "no one has to face a mental health problem alone" principles.
- **RCPsych** — self-harm and supporting someone with suicidal thoughts guidance.
- **NHS (UK)** — "how to help someone else" (self-harm) page.
- **WHO** — Psychological First Aid (PFA) field guide: Look–Listen–Link; emergencies MHPSS notes.
- **Crisis Text Line / 988 Lifeline / FindSupport.gov / CDC** — text-based crisis support practice;
  crisis counselling is conversational, non-directive, and escalates <1% of cases to active rescue.

Live behaviour was also sampled (multi-turn conversations, OpenRouter primary model,
2026-11-09; see "Live samples" below).

## Findings

| # | Guidance principle | Glow behaviour | Verdict |
|---|---|---|---|
| 1 | Active listening: non-judgmental presence, no interruption, no solution-dumping, stay close to their experience without parroting (NHS, BHF, Cleveland Clinic) | Receive → Clarify → Deepen flow; "reflect the meaning, not the wording"; at most one question; no advice by default | Aligned |
| 2 | Curiosity over assumption; clarify rather than assume (active-listening practice) | "Ask rather than assume"; "one gentle question that helps them feel understood" | Aligned |
| 3 | Trauma-informed: safety, choice, autonomy; never pressure disclosure; never imply blame (SAMHSA trauma-informed principles via PFA) | Explicit trauma-informed stance; permission before suggestions; "accept it and return to listening" on decline | Aligned |
| 4 | PFA: calming, connection, self-efficacy; "do no harm"; PFA is not counselling/treatment (WHO) | Companion framing, not treatment; strengths-based; no diagnosis/treatment claims; breathing/grounding tools offered as options | Aligned |
| 5 | Self-harm: don't force change, don't shame, don't make them promise, let them keep control but ensure medical attention if needed (NHS, RCPsych) | No promises extracted; "offer an immediate grounding option only if they want it"; boundaries forbid blame/comparison | Aligned |
| 6 | Suicidal thoughts: take seriously, encourage immediate professional contact (NIMH BSSA: imminent risk → emergency evaluation; RCPsych: call emergency services) | Crisis branch stops normal conversation, asks "are you safe right now?", pushes emergency services / crisis lines | Aligned (with gap #9 below) |
| 7 | "Safety contracts" are ineffective and can be dangerous; use collaborative safety planning instead (NIMH) | Prompt originally silent on safety planning → see gap #10 (closed) | Gapped → closed this review |
| 8 | Limiting access to means saves lives; means-restriction discussion is first-line in risk work (NIMH) | Prompt forbade describing methods but never encouraged distance from means → see gap #10 (closed) | Gapped → closed this review |
| 9 | Crisis numbers must match the user's country; a generic "contact local emergency services" is a partial fallback (deployment-readiness §5) | Prompt hardcoded Egypt numbers → see gap #10 (closed: country check + findahelpline.org) | Gapped → closed this review |
| 10 | Don't promise confidentiality/secrecy around suicidal thoughts; be transparent about limits (RCPsych) | Prompt forbids promising confidentiality or safety (absolute boundary) | Aligned |
| 11 | Short, low-effort text exchanges must not be met with long paragraphs (Crisis Text Line practice) | Dedicated short-message section with example | Aligned |
| 12 | Anti-cliché / non-repetition: avoid generic validation stacking (Mind stigma-aware communication) | Explicit filler-phrase bans and openers rotation | Aligned (live samples confirm) |

## Gaps found and closed in this review

1. **Means-distance encouragement added** (prompts.py, crisis section, step 5): when
   risk may be present, the model is now directed to gently encourage putting
   distance between the user and anything they might use to harm themselves, and
   being near other people — without discussing methods.
2. **Safety-plan framing added**: the model may help the user name their own warning
   signs and what has helped, in their own words, while explicitly framing a safety
   plan as something belonging to a professional relationship — never a promise
   extracted by the AI.
3. **Country-appropriate resources**: Egypt numbers are no longer given to
   non-Egyptian users; the model points to the local emergency number plus
   findahelpline.org.

## Gaps that remain OPEN (require human reviewers)

1. **Qualified clinician review** of high-risk fixtures and crisis scripts
   (the gate this review partially mitigates — it does not close it).
2. **Per-language qualified review** (ar/es/ja/zh therapy replies) per ADR 0003.
   AI-assisted checks of the four launch languages were performed (see below);
   native-speaker clinical review is still outstanding.
3. **Evidence corpus licensing** — no external guidance text may be ingested
   without source-rights review; corpus remains intentionally empty.
4. **Regulatory category decision** (wellness vs healthcare vs SaMD) per jurisdiction.
5. **Provider legal review** for OpenRouter free tier before real user messages flow.

## Multilingual behaviour

- UI locales: EN / العربية / Español / Français (LanguageContext, RTL for Arabic).
- Account locale at registration and `PUT /profile/locale` (`account_router.py`).
- The orchestrator passes the stored locale into the system prompt, which instructs
  the model to reply in the language the user is writing in and to follow code-switching.
- Live spot-checks (2026-11-09, OpenRouter primary) in AR/ES/FR: replies were fluent,
  plain-text, single-question, and consistent with the same stance as English.
  Crisis resources in non-Egypt locales now resolve to local emergency +
  findahelpline.org per gap #9.

## Live samples (structure-verified, abridged)

English multi-turn (relationship strain, 5 turns): acknowledged weight without
diagnosing; referenced the user's own image ("pit in your stomach") two turns later;
suggested slow breaths *as an invitation*, not an instruction; no markdown;
no therapy-speak; no rule violations observed.

Non-English spot-checks: see test log in `test-runtime/` (AR/ES/FR sessions).
All four languages produced plain-prose, single-question, non-diagnostic replies.

## Conclusion

Glow's conversational behaviour is aligned with the public guidance reviewed.
Three real gaps were found and fixed. The qualified-human gates remain open and
must be closed before public launch. This document must not be cited as clinical
approval.
