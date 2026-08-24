# Real Model Configuration Status

This document tracks the strict integration of real AI models in Phase 6, explicitly mapping each component to its configuration and testing state.

## Component Status

| Component | Provider / Model ID | Hosting Strategy | Status |
| :--- | :--- | :--- | :--- |
| **LLM (Text)** | `Qwen/Qwen2.5-14B-Instruct` | Local vLLM (`http://localhost:8000/v1`) | **configured** |
| **STT (Audio In)** | `Systran/faster-whisper-large-v3` | Local `faster-whisper` inference | **configured** |
| **TTS (Audio Out)** | `coqui/XTTS-v2` | Local `TTS` API | **configured** |
| **E2E Context (WebSocket)** | Glow Session Orchestrator | FastAPI WebSocket (`/sessions/{session_id}/voice/stream`) | **configured** |

## Status Definitions
- **unconfigured**: Stubbed, fake, or using an unapproved provider.
- **configured**: Code is written for the real provider, settings are mapped, but live tests haven't proven it.
- **live-tested**: The provider was successfully invoked with real weights/API keys via `ENABLE_LIVE_PROVIDER_TESTS=1`.
- **production-approved**: Fully reviewed for data retention, clinical safety, and latency limits.

## Verification Requirements
To transition from `configured` to `live-tested`, the local environment must have the respective heavy dependencies installed (e.g. `vLLM`, `faster-whisper`, `TTS`), weights downloaded, and `pytest` run with `ENABLE_LIVE_PROVIDER_TESTS=1`. If this variable is set and the provider fails to load, the tests will explicitly **fail**. They will no longer silently skip.
