# Real Model Configuration Status

This document tracks the strict integration of real AI models in Phase 6, explicitly mapping each component to its configuration and testing state.

## Component Status

| Component | Provider / Model ID | Hosting Strategy | Status |
| :--- | :--- | :--- | :--- |
| **LLM (Text)** | `Qwen/Qwen2.5-14B-Instruct` | Local vLLM (`http://localhost:8000/v1`) | **unreachable** |
| **STT (Audio In)** | `Systran/faster-whisper-large-v3` | Local `faster-whisper` inference | **present_non_placeholder** |
| **TTS (Audio Out)** | `hexgrad/Kokoro-82M` (Apache 2.0) | Local `kokoro-onnx` inference | **present_non_placeholder** |
| **E2E Context** | Glow Session Orchestrator | FastAPI WebSocket (`/sessions/{session_id}/voice/stream`) | **present_non_placeholder** |
| **Avatar (A2F)** | NVIDIA Audio2Face-3D NIM | gRPC (NVCF cloud or local NIM) | **blocked** |

> [!CAUTION]
> **XTTS-v2 (Coqui) is permanently banned from this codebase.**
> Coqui Inc. ceased operations January 2024. The model weights are under CPML (non-commercial only).
> No commercial license is obtainable. Glow charges for sessions and cannot use XTTS-v2 in production.
> Any PR re-introducing XTTS-v2 must be rejected.

## Status Definitions
- **missing**: Environment variable is absent.
- **present_non_placeholder**: Environment variable is populated and correctly formatted.
- **invalid_format**: Environment variable is populated but format is incorrect.
- **not_required**: Environment variable is not needed for this configuration.
- **unreachable**: Network endpoint configured but fails to respond.
- **reachable**: Network endpoint responds to a health check but not fully tested.
- **live_tested**: Provider was successfully invoked with real payloads.
- **production_reviewed**: Fully reviewed for data retention, clinical safety, and latency limits.
- **blocked**: Development is intentionally halted due to unresolved prerequisites.

## Local Qwen Inference Requirements
To verify the local Qwen server, the following must be documented and proven:
1. **Model ID**: `Qwen/Qwen2.5-14B-Instruct`
2. **Pinned Revision**: Checksum validation required before launch.
3. **Serving Command**: `vllm serve Qwen/Qwen2.5-14B-Instruct --host 0.0.0.0 --port 8000` (Version: vLLM 0.6.0+)
4. **Hardware Requirements**: GPU with at least 16GB VRAM (or multi-GPU).
5. **Reachability**: `GLOW_LLM_API_BASE` (`http://localhost:8000/v1`) must respond.
6. **Model Verification**: `/v1/models` must return `Qwen/Qwen2.5-14B-Instruct`.
7. **Testing**: A real multi-turn smoke test must succeed.

*Current State*: `unreachable`. The vLLM server is not currently running.

## Kokoro TTS Language Status
| Language | Status |
|:---|:---|
| English | Approved for testing (Apache 2.0, native quality) |
| Spanish | Approved for testing |
| Japanese | Approved for testing |
| Mandarin Chinese | Approved for testing; evaluate prosody before production |
| **Arabic** | **blocked** — community fine-tune required; license and quality unverified |
