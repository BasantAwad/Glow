# Model Provider Decision

**Date:** 2026-08-25
**Status:** Approved for Phase 6 Implementation

## Current Deployment Constraint (2026-11-09)

The approved model remains self-hosted Qwen behind the OpenAI-compatible gateway, but this developer workstation's NVIDIA Quadro P1000 (4 GB VRAM) cannot run the planned vLLM/CUDA setup. The endpoint must remain unconfigured/unavailable rather than silently selecting a different model.

The suggested Gemini API **free tier is not approved for Glow user conversations**. Google's current Gemini API Additional Terms state that unpaid-service inputs and outputs may be used to improve/develop products, may be reviewed by humans, and that sensitive, confidential, or personal information must not be submitted. The same terms disclaim reliance on Gemini for mental-health advice. Glow user messages are sensitive by nature, so do not point production/dev sessions containing real user data at that free tier. See [Gemini API Additional Terms](https://aistudio.google.com/docs/terms) and [Gemini API pricing/data-use summary](https://aistudio.google.com/docs/pricing).

Gemini's paid tier states that prompts/outputs are not used to improve products and are processed under its Data Processing Addendum, but any paid cloud integration still requires privacy/legal/vendor review, accurate user disclosure/consent, and regional review before real user data is sent. No Gemini key or cloud model is configured by this record. Until that review or suitable infrastructure exists, Glow must fail clearly; it must not fall back silently.

## 1. Primary Text LLM Strategy
## 1. LLM Strategy
- **Provider:** `vLLM` (Local/Self-hosted)
- **Model ID:** `Qwen/Qwen2.5-14B-Instruct` (Pinned Revision: `refs/pr/1` or latest stable). *Note: We verified that an official `Qwen3-14B-Instruct` model does not yet exist from the Qwen team; Qwen2.5 is the latest official Instruct release in the 14B class.*
- **Rationale:** 
  - *Data Privacy:* The user explicitly requires that the model runs on infrastructure controlled by Gloe to eliminate third-party data processing risks. We will rely on a local OpenAI-compatible endpoint (`http://localhost:8000/v1`) running vLLM or llama.cpp.
  - *Quality:* Qwen2.5-14B-Instruct provides leading open-weight instruction-following capabilities.

### LLM Implementation Requirements
- **RAG First:** We will use Retrieval-Augmented Generation (RAG) before any fine-tuning. RAG will pull exclusively from a provenance-aware evidence registry containing only approved, real, public-domain, or properly licensed sources.
- **Fine-tuning (LoRA/QLoRA):** Strictly prohibited until the training dataset has documented ownership/licenses, informed consent, strict de-identification, language coverage verification, and clear removal rules.
- **Verification:** Before production serving, we must verify the exact checkpoint license, model card, commercial rights, supported languages, context length, hardware needs, quantization options, and serving requirements.

## 2. Speech-to-Text (STT) Strategy
- **Provider:** `Whisper large-v3` / `faster-whisper`.
- **Rationale:** Provides state-of-the-art multilingual transcription locally or via dedicated endpoints, avoiding third-party data retention. Capable of real-time streaming and chunked transcription with confidence scoring.

## 3. Text-to-Speech (TTS) Strategy
- **Provider:** `coqui/XTTS-v2` (Local Multilingual TTS).
- **Rationale:** 
  - *Evaluation:* We evaluated Suno Bark, MeloTTS, MMS-TTS, and XTTS-v2 against the strict 5-language requirement (Arabic, English, Spanish, Japanese, and Chinese). 
  - *Language Support:* Only `XTTS-v2` provides high-quality phonetic and tonal parity across all 5 required languages (MeloTTS lacks Arabic; Bark's Arabic is poor; MMS is disjointed per language).
  - *License Warning:* XTTS-v2 is released under the Coqui Public Model License (CPML), which allows non-commercial use but **requires a commercial license** for production (since Glow charges for sessions). We will proceed with XTTS-v2 for development/testing, but this commercial licensing blocker must be resolved before launch.
- **Pipeline Separation:** The TTS pipeline remains completely decoupled from the Avatar pipeline.

## 4. Avatar Strategy
- **Provider:** `Nvidia Audio2Face-3D` (Phase 6E).
- **Rationale:** To provide the visual presentation layer. This is strictly deferred until the real LLM, STT, and TTS pipelines are fully functional and validated. It will serve as a presentation layer only, possessing no clinical or conversational decision-making authority.

## 5. Security and Data Governance Policies
- **No Mocks or Stubs:** We will no longer use mock models, canned responses, fake therapy conversations, synthetic datasets, fabricated clinical documents, or invented crisis resources.
- **Fallback Behavior:** If a model cannot be downloaded, licensed, configured, or served, the system must fail clearly and document the blocker. No silent fallbacks to mocks.
- **Safety Independence:** The primary LLM must *not* be the only safety mechanism. Deterministic backend rules, a separate safety classifier, the crisis state machine, input screening, output validation, and human-reviewed evaluations are mandatory.
