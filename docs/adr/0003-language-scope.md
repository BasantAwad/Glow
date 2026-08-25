# ADR 0003 — Language Scope for Therapy Conversations

**Date:** 2026-08-25  
**Status:** Accepted  
**Deciders:** Glow engineering team

---

## Context

Glow's planned scope includes Arabic, English, Spanish, Japanese, and Simplified Chinese. However, the safety and crisis-detection behavior of the AI system has been designed and reviewed only in English. Running therapy-style AI conversations in other languages without qualified per-language review poses serious clinical risk:

1. **Crisis detection:** Keyword and pattern matching in `safety.py` is English-only. A user expressing suicidal ideation in Arabic will not be reliably detected by the current safety pre-generation check.
2. **Crisis response templates:** The deterministic crisis response text (shown when the FSM escalates) has not been translated or reviewed by a qualified clinician in any non-English language.
3. **Cultural context:** Mental health communication norms, idioms, and crisis expressions differ significantly across languages and cultures. English safety patterns cannot be safely transliterated.
4. **Egypt pilot:** The primary pilot population is Egypt-based Arabic speakers. This creates an immediate practical tension — the product is intended for Arabic speakers, but Arabic therapy-mode safety is not yet validated.

---

## Decision

### English only for therapy mode (Phase 1 through Phase 6D completion)

**English** is the only language approved for therapy-style conversations in which the AI system:
- Accepts emotional/mental-health disclosures
- Generates empathetic or supportive responses
- Processes crisis-risk signals

### Non-English language modes — restricted scope

Arabic, Spanish, Japanese, and Simplified Chinese are permitted **only** for:
- Informational content (product onboarding, consent forms, terms, FAQ)
- Session UI navigation (button labels, status messages, error text)
- Clinical resource listings (links to professionals, crisis lines) — where content is static and reviewed

### Feature flags

The following feature flags default to `disabled` and must remain so until the named review is complete:

| Flag | Blocks | Required review |
|---|---|---|
| `therapy_ar` | Arabic therapy conversations | Qualified Arabic-language clinical review |
| `therapy_es` | Spanish therapy conversations | Qualified Spanish-language clinical review |
| `therapy_ja` | Japanese therapy conversations | Qualified Japanese-language clinical review |
| `therapy_zh` | Simplified Chinese therapy conversations | Qualified Simplified Chinese-language clinical review |

Each flag also requires:
- Safety pre-generation patterns for that language
- Crisis response templates in that language
- Crisis resource registry entries verified for relevant jurisdiction(s)

### Arabic TTS

`KokoroTtsGateway` supports English natively (Apache 2.0 checkpoint). Arabic TTS requires evaluation of a community Arabic Kokoro fine-tune (e.g. Nabra-Kokoro-Arabic). That fine-tune must:
- Carry a compatible license (Apache 2.0 or equivalent)
- Be evaluated for voice quality in a therapy-context setting
- Not be used for therapy responses until the `therapy_ar` feature flag is unblocked

### Voice interface language restriction

The voice WebSocket endpoint (`/sessions/{id}/voice/stream`) must refuse to start a voice session in a language where the corresponding `therapy_*` flag is disabled, returning a clear `ProviderNotConfiguredError`-equivalent status with the reason.

---

## Consequences

- Arabic pilot users in Egypt will initially interact in English or through informational Arabic content only
- No therapy-style AI response may be generated for a non-English locale unless the corresponding feature flag is enabled
- The UI must not present voice or therapy features as available in a language where they are disabled
- Safety test coverage requirement: before enabling any language, a regression test suite for that language's crisis patterns must pass

---

## How to enable a non-English language

1. Engage a qualified clinician with expertise in that language and cultural context
2. Review and add crisis detection patterns in `safety.py`
3. Review and translate crisis response templates
4. Verify crisis resource registry entries for the applicable jurisdiction(s)
5. Evaluate TTS quality for the language in a therapy-context setting
6. Run safety regression tests for that language
7. Obtain written clinical approval
8. Set the corresponding feature flag to `enabled` via admin API (not hardcoded)

---

## Deferred decisions

| Decision | Gate |
|---|---|
| Arabic therapy enablement | Per-language clinical review |
| Spanish therapy enablement | Per-language clinical review |
| Japanese therapy enablement | Per-language clinical review |
| Simplified Chinese therapy enablement | Per-language clinical review |
| Arabic Kokoro fine-tune evaluation | TTS quality + license review |
