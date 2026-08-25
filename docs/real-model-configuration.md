# Real Model Configuration Status

This document tracks the strict integration of real AI models in Phase 6, explicitly mapping each component to its configuration and testing state.

## Component Status

| Component | Provider / Model ID | Hosting Strategy | Status |
| :--- | :--- | :--- | :--- |
| **LLM (Text)** | `Qwen/Qwen2.5-14B-Instruct` | Local vLLM (`http://localhost:8000/v1`) | **configured** |
| **STT (Audio In)** | `Systran/faster-whisper-large-v3` | Local `faster-whisper` inference | **configured** |
| **TTS (Audio Out)** | `hexgrad/Kokoro-82M` (Apache 2.0) | Local `kokoro-onnx` inference | **configured** |
| **E2E Context (WebSocket)** | Glow Session Orchestrator | FastAPI WebSocket (`/sessions/{session_id}/voice/stream`) | **configured** |
| **Avatar (A2F-3D)** | NVIDIA Audio2Face-3D NIM | gRPC (NVCF cloud or local NIM) | **BLOCKED** — see `docs/audio2face-decision-record.md` |

> [!CAUTION]
> **XTTS-v2 (Coqui) is permanently banned from this codebase.**
> Coqui Inc. ceased operations January 2024. The model weights are under CPML (non-commercial only).
> No commercial license is obtainable. Glow charges for sessions and cannot use XTTS-v2 in production.
> Any PR re-introducing XTTS-v2 must be rejected.

## Status Definitions
- **unconfigured**: Stubbed, fake, or using an unapproved provider.
- **configured**: Code is written for the real provider, settings are mapped, but live tests haven't proven it.
- **live-tested**: The provider was successfully invoked with real weights/API keys via `ENABLE_LIVE_PROVIDER_TESTS=1`.
- **production-approved**: Fully reviewed for data retention, clinical safety, and latency limits.

## Verification Requirements
To transition from `configured` to `live-tested`, the local environment must have the respective heavy dependencies installed (e.g. `vLLM`, `faster-whisper`, `kokoro-onnx`) and `pytest` must be run with `ENABLE_LIVE_PROVIDER_TESTS=1`. If that variable is set and the provider fails to load, the tests will explicitly **fail** — they will no longer silently skip.

## Kokoro TTS Language Status
| Language | Status |
|:---|:---|
| English | Approved for testing (Apache 2.0, native quality) |
| Spanish | Approved for testing |
| Japanese | Approved for testing |
| Mandarin Chinese | Approved for testing; evaluate prosody before production |
| **Arabic** | **BLOCKED** — community fine-tune required; license and quality unverified |

> [!IMPORTANT]
> A base-model Apache 2.0 license does not automatically cover community voice fine-tunes.
> Each Arabic fine-tune checkpoint must be individually license-verified before use.
