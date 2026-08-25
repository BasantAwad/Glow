# Audio2Face-3D Integration Decision Record

**Status:** BLOCKED / PROPOSED — Phase 6E must NOT begin until every blocker in the summary table (§ bottom) is resolved with evidence and the smoke test in §10 passes.
**Last Updated:** 2026-08-25

> [!CAUTION]
> No production avatar code may be written until this document is completed and the smoke test at `apps/api/tests/test_a2f_gateway_smoke.py` passes against the real NVIDIA provider with a real, consented audio fixture.

---

## 1. Exact NVIDIA Product, Version, and Official Documentation

### Verified Facts
| Item | Value | Source |
|:---|:---|:---|
| Product name | NVIDIA Audio2Face-3D | https://build.nvidia.com/nvidia/audio2face-3d |
| Deployment type | NIM (NVIDIA Inference Microservice) | NVIDIA API Catalog |
| Deployment modes | (A) NVCF cloud API, (B) self-hosted Docker/Helm | NVIDIA NGC / ACE docs |
| Official samples repo | https://github.com/NVIDIA/Audio2Face-3D-Samples | Apache 2.0 license |
| Protobuf location | `proto/` directory of the samples repo | Verified from repo |
| PyPI package | `nvidia-audio2face-3d` | https://pypi.org/project/nvidia-audio2face-3d/ |
| Companion package | `nvidia-ace` (shared ACE protobuf types) | https://pypi.org/project/nvidia-ace/ |
| gRPC service stub | `A2FControllerServiceStub` from `nvidia_audio2face_3d.audio2face_pb2_grpc` | Verified from nvidia_pipecat integration |
| Request message | `AudioWithEmotion` from `nvidia_audio2face_3d.messages_pb2` | Verified from nvidia_pipecat integration |
| Stream header message | `AudioWithEmotionStreamHeader` | Verified from nvidia_pipecat integration |
| Response stream type | `A2F3DAnimationDataStream` | Verified from nvidia_pipecat integration |

### Unresolved
- **[UNRESOLVED]** The exact PyPI **package version** of `nvidia-audio2face-3d` to pin must be recorded after installation via `pip show nvidia-audio2face-3d`. Do not use an unpinned version in production.
- **[UNRESOLVED]** The **function-id** for the current production A2F-3D NIM must be retrieved from https://build.nvidia.com/nvidia/audio2face-3d (the "Try API" tab) and recorded here. Note: some older function IDs are deprecated; verify the current one.
- **[UNRESOLVED]** The exact `A2F3DAnimationDataStream` field path to blendshape weights must be confirmed by running `python -c "from nvidia_audio2face_3d import messages_pb2; help(messages_pb2.A2F3DAnimationDataStream)"` and recording the field hierarchy here verbatim.

---

## 2. Deployment Mode

### Verified Options

| Mode | Endpoint | Auth | Data leaves Gloe? | Cost model |
|:---|:---|:---|:---|:---|
| NVCF Cloud (API Catalog) | `grpc.nvcf.nvidia.com:443` | Bearer token + function-id in gRPC metadata | **YES** — audio bytes transmitted to NVIDIA servers | Pay-as-you-go via https://build.nvidia.com/ |
| Self-hosted NIM (Docker) | `localhost:50051` or internal cluster | API gateway layer; no built-in gRPC auth | **NO** | NVIDIA AI Enterprise license required |

### Decision Required
- **[UNRESOLVED — LEGAL]** Gloe must decide which deployment mode to use. Cloud mode is simpler to start but requires legal review of audio transmission (see §6). Self-hosted mode eliminates the data transmission concern but requires GPU infrastructure and an NVIDIA AI Enterprise license.

---

## 3. Endpoint, Authentication, SDK Version, and Message Names

### Verified Facts
- **Cloud endpoint:** `grpc.nvcf.nvidia.com:443` (TLS)
- **Authentication metadata keys:**
  ```
  authorization: Bearer <NVIDIA_API_KEY>
  function-id:   <function-id from build.nvidia.com>
  ```
- **Python SDK install:** `pip install nvidia-audio2face-3d nvidia-ace grpcio`
- **Service name:** `A2FControllerServiceStub`
- **Streaming RPC method:** `ProcessAudioStream` (client-streaming → server-streaming)
- **Request messages:** `AudioWithEmotion` wrapping either `AudioWithEmotionStreamHeader` (first message) or `AudioBuffer` (subsequent messages)
- **Response messages:** `A2F3DAnimationDataStream` containing blendshape weight frames

### Unresolved
- **[UNRESOLVED]** Exact `pip show nvidia-audio2face-3d` version string to pin.
- **[UNRESOLVED]** Exact function-id.
- **[UNRESOLVED]** Complete protobuf field path: `A2F3DAnimationDataStream.<field>.<field>.blend_shape_weights[i].values` — verify from installed package before writing client code.
- **[UNRESOLVED]** License of the `nvidia-audio2face-3d` PyPI package itself — confirm via `pip show` and inspect `LICENSE` file after installation.

---

## 4. Audio Format, Sample Rate, Encoding, Chunk Size, Stream Duration, Frame Rate

### Verified Facts
| Parameter | Required Value | Source |
|:---|:---|:---|
| Encoding | 16-bit signed PCM | NVIDIA HuggingFace model card + ACE samples |
| Sample rate | **Exactly 16 000 Hz** | NVIDIA docs — model internally resamples to 16 kHz |
| Channels | **Mono (1)** | NVIDIA ACE samples |
| Container | WAV (RIFF) for file-based; raw PCM bytes for streaming | ACE sample client |
| Chunk size | Must be measured from reference client `nim_a2f_3d_client.py` | **[UNRESOLVED]** |
| Max stream duration | Not yet documented publicly | **[UNRESOLVED — inspect proto or observe from service]** |
| Output frame rate | Must be measured from real service call | **[UNRESOLVED]** |

### Audio Routing from TTS
- Kokoro TTS outputs WAV at **24 000 Hz, 16-bit PCM, mono**.
- Before forwarding to A2F-3D, the server **must resample** the TTS output from 24 000 Hz to 16 000 Hz.
- Resampling library: `librosa` or `scipy.signal.resample_poly` (both Apache 2.0 / BSD).
- Raw audio bytes must never be written to disk. Resampling must be in-memory.

---

## 5. Output Channel Names, Count, and Order

### Verified Facts
- **Channel count:** 52 (ARKit standard facial blend shapes)
- **Data type:** Float array, one value per channel, per frame
- **Value range:** [0.0, 1.0] per ARKit specification

### Canonical ARKit 52 Channel Names (in standard order)
`browDownLeft`, `browDownRight`, `browInnerUp`, `browOuterUpLeft`, `browOuterUpRight`,
`cheekPuff`, `cheekSquintLeft`, `cheekSquintRight`,
`eyeBlinkLeft`, `eyeBlinkRight`, `eyeLookDownLeft`, `eyeLookDownRight`, `eyeLookInLeft`, `eyeLookInRight`, `eyeLookOutLeft`, `eyeLookOutRight`, `eyeLookUpLeft`, `eyeLookUpRight`, `eyeSquintLeft`, `eyeSquintRight`, `eyeWideLeft`, `eyeWideRight`,
`jawForward`, `jawLeft`, `jawOpen`, `jawRight`,
`mouthClose`, `mouthDimpleLeft`, `mouthDimpleRight`, `mouthFrownLeft`, `mouthFrownRight`, `mouthFunnel`, `mouthLeft`, `mouthLowerDownLeft`, `mouthLowerDownRight`, `mouthPressLeft`, `mouthPressRight`, `mouthPucker`, `mouthRight`, `mouthRollLower`, `mouthRollUpper`, `mouthShrugLower`, `mouthShrugUpper`, `mouthSmileLeft`, `mouthSmileRight`, `mouthStretchLeft`, `mouthStretchRight`, `mouthUpperUpLeft`, `mouthUpperUpRight`,
`noseSneerLeft`, `noseSneerRight`, `tongueOut`

### Unresolved
- **[UNRESOLVED]** Confirm that NVIDIA's output channel order matches the canonical ARKit order above. Inspect the proto definition's `blend_shape_names` field (or equivalent) from the installed package and record the actual order here. Do not assume order; a one-position mismatch will produce wrong facial animation.

---

## 6. Legal Terms: NVCF Audio Processing, Model Use, Commercial Use, Output Redistribution

### Verified Facts
- **NIM Software License:** NVIDIA Software License Agreement + NVIDIA Product-Specific Terms for AI Products. Source: NVIDIA.
- **Model License:** NVIDIA Open Model License. Intended for commercial deployment. Source: NVIDIA.
- **Audio2Emotion restriction:** The `Audio2Emotion` sub-model is restricted from use as a standalone emotion-recognition system; it must be used in connection with the Audio2Face project.
- **Commercial use:** Supported via NVIDIA AI Enterprise (per-GPU license) or NVCF pay-as-you-go API.
- **Sample code:** Apache 2.0 (NVIDIA Audio2Face-3D-Samples GitHub repo).

### Unresolved Legal Questions (each is a blocker)
- **[UNRESOLVED — LEGAL]** Do the NVCF terms permit transmission of audio from therapy sessions? Specifically: does the NVCF data processing agreement include a prohibition on using customer data for model training? Gloe's legal team must obtain and review the current NVIDIA NIM EULA and data processing addendum.
- **[UNRESOLVED — LEGAL]** Are blendshape animation outputs considered derivative works under the NVIDIA Open Model License? What are the redistribution restrictions if Gloe embeds animation frame data in session recordings or client-side caches?
- **[UNRESOLVED — LEGAL]** Does NVCF regional data processing comply with applicable health-data regulations for Gloe's user regions (Egypt, etc.)? If not, the self-hosted NIM deployment must be used instead.
- **[UNRESOLVED — LEGAL]** Confirm the license of the `nvidia-audio2face-3d` PyPI package specifically (not just the sample code).

---

## 7. Avatar Asset — Real Licensed Selection Required

### Why Previous Candidates Were Rejected
| Candidate | Reason rejected |
|:---|:---|
| ReadyPlayerMe | Platform shut down January 31, 2026 (acquired by Netflix). CC BY-NC 4.0 — non-commercial only. Cannot produce new exports. |
| MetaHuman (Unreal) | Requires Unreal Engine runtime; incompatible with React-Three-Fiber WebGL renderer. |
| "Placeholder" or fabricated asset | Explicitly prohibited. |

### Requirements for the Selected Asset
1. License must explicitly permit **commercial use** and **web redistribution** in a product that charges for sessions.
2. Must be a `.glb` / `.gltf` file containing **exactly 52 named morph targets** matching or mappable to the ARKit canonical list above.
3. The asset's exact **URL/source, version, SHA-256 file hash**, creator name, and license text copy must be recorded here.
4. The asset must be verified with `gltf-transform inspect <file.glb>` or https://gltf-viewer.donmccurdy.com/ to confirm morph-target names.
5. A copy of the license must be stored at `docs/licenses/avatar/`.

### Candidates to Evaluate (not approved; each needs individual license inspection)
- **Sketchfab CC0 models tagged "ARKit blendshapes"** — CC0 permits commercial use; each model must be individually verified.
- **Synty Studios polygon character** (commercial purchase, clear license) — requires purchase.
- **Custom Blender mesh + ARKit Blendshape Helper add-on** — mesh must be original or CC0; the add-on is MIT.
- **VRoid Studio + HANA Tool export** — individual model VRM license varies; verify each model's terms.

### Status
**[UNRESOLVED — BLOCKER]** No avatar asset has been selected, licensed, downloaded, or hash-verified.

---

## 8. Blendshape Mapping Table

Cannot be completed until §7 (avatar asset) is resolved.

### What Must Be Documented After Asset Selection
For each of the 52 NVIDIA output channels:

| NVIDIA channel index | NVIDIA channel name | Avatar morph-target name | Notes |
|:---|:---|:---|:---|
| 0 | browDownLeft | `<avatar-specific-name>` | or "MISSING" |
| … | … | … | … |

Additional mapping rules that must be documented:
- **Normalization:** A2F output is [0, 1]; confirm avatar morph scale is also [0, 1] or document rescaling formula.
- **Clamping:** Specify clamp behavior for values outside [0, 1] after any rescaling.
- **Neutral pose:** All 52 weights at 0.0 must produce the neutral rest pose.
- **Jaw/eye bone coupling:** Document whether `jawOpen` and `eyeBlink*` require secondary bone rotation on the avatar rig.
- **Calibration procedure:** Define how to measure and correct for face-relative offset errors.
- **Missing targets:** List channels that have no equivalent morph target; define the fallback (zero, ignore, bone-only).

**[UNRESOLVED — blocked on §7]**

---

## 9. Synchronization Design

### Design (specified; awaiting avatar and real frame-rate data from §4 to finalize)

| Concern | Decision |
|:---|:---|
| **Timing authority** | Browser `AudioContext.currentTime` (monotonic, high-resolution). **Not** server wall clock. **Not** client Date.now(). |
| **Utterance identity** | Each TTS synthesis produces a unique opaque `utterance_id` (UUID). All A2F frames for that utterance carry the same `utterance_id`. |
| **Audio delivery** | TTS audio is sent as a single `audio/wav` blob per utterance. The browser schedules it via `AudioBufferSourceNode.start(scheduledTime)` where `scheduledTime` is derived from `AudioContext.currentTime` at the moment the blob arrives. |
| **Frame timestamps** | Each blendshape frame carries `time_code_s` (float, seconds from utterance audio start, as reported by A2F). The server tags the WebSocket message with the same `scheduled_audio_start_context_time` that was sent to the client when the audio blob was delivered. |
| **Client interpolation** | On each `requestAnimationFrame`, compute `offset = AudioContext.currentTime - scheduledTime`. Apply the blendshape frame whose `time_code_s` is nearest to `offset`, using linear interpolation between adjacent frames. |
| **Jitter buffer** | Hold N frames ahead of the playback cursor. N must be calculated after measuring the real A2F frame rate (§4). Placeholder: N=3. |
| **Late frames** | A frame is "late" if its `time_code_s < AudioContext.currentTime - scheduledTime - (1/fps)`. Late frames are discarded. A `dropped_frame` counter is incremented (redacted, no PII in logs). |
| **Frozen state** | When the buffer empties, hold the last-known blendshape state until the next valid frame, then interpolate from frozen state to avoid snapping. |
| **Backpressure** | Server checks WebSocket `bufferedAmount` before sending each frame. If `bufferedAmount > 64 KB`, the server pauses sending until drained. |
| **Barge-in / cancellation** | On barge-in: server sends `{v:1, type:"avatar_cancel", utterance_id}`. Client clears the jitter buffer, resets to neutral pose (all zeros), and discards any frames for that `utterance_id`. Audio is cancelled independently via the Glow session control plane. |
| **Reconnect** | Avatar stream reconnects independently per utterance. If the WebSocket disconnects mid-utterance, the avatar holds the neutral pose. Audio playback (already buffered) continues. The next utterance triggers a fresh WebSocket connection. |

### Unresolved
- **[UNRESOLVED]** Actual A2F output frame rate must be measured from the real service (§4) before jitter buffer size N is finalized.
- **[UNRESOLVED]** Confirm that A2F's `time_code` field is seconds from audio start, not absolute wall-clock time.

---

## 10. Smoke Test Specification and Fixture Policy

The smoke test file is at `apps/api/tests/test_a2f_gateway_smoke.py`.

### Fixture Requirements (non-negotiable)
- The test uses a **real human-recorded audio fixture**, not synthetic audio.
- File: `apps/api/tests/fixtures/a2f_smoke_sentence_16k_mono.wav`
- Content: A natural English sentence (e.g., "Hello, this is a technical audio test."), 3–5 seconds.
- Encoding: 16-bit PCM, 16 000 Hz, Mono.
- **Consent:** The recording must be made by a team member or contractor who has signed a written consent form permitting storage in this private repository and transmission to NVIDIA's NVCF endpoint. The consent form must be stored at `docs/licenses/a2f_smoke_recording_consent.pdf`.
- **Silent fixtures are explicitly rejected.** The test checks RMS amplitude and fails if the recording appears to be silence. A synthetic silence file cannot prove that A2F generates real facial movement.

### What the Test Validates
1. gRPC connection established within the timeout.
2. At least one `A2F3DAnimationDataStream` response message received.
3. Each frame contains exactly 52 float channels.
4. All values are finite (no NaN / Inf).
5. All values are in [0.0, 1.0].
6. Frame time-codes are strictly monotonically increasing.
7. gRPC stream closes cleanly.
8. Time-to-first-frame latency is measured and logged.

### What the Test Does NOT Validate
- Facial-movement quality — must be assessed by human review against the real avatar.
- Non-zero values are NOT used as a correctness proof (silence may produce near-zero output; the schema and structure are what the smoke test verifies).
- Business logic, session safety, or therapy outcomes.

### Smoke Test Status
**[BLOCKED]** The following must be resolved before the smoke test can run:
1. Consented audio fixture recorded and committed.
2. Consent document stored at `docs/licenses/a2f_smoke_recording_consent.pdf`.
3. `NVIDIA_API_KEY`, `A2F_FUNCTION_ID`, `A2F_ENDPOINT` env vars set.
4. `nvidia-audio2face-3d` and `grpcio` installed.
5. Exact protobuf field path for blendshape weights confirmed (§1).

---

## 11. TTS: Kokoro-82M — Detailed License and Language Status

### Verified Facts
| Item | Status |
|:---|:---|
| Model ID | `hexgrad/Kokoro-82M` |
| Base model license | **Apache 2.0** ✅ Verified: permits commercial use |
| Built-in voice files (`af_heart`, `af_sky`, etc.) | **Apache 2.0** ✅ Same repository, same license; no separate per-voice license |
| Official source | https://huggingface.co/hexgrad/Kokoro-82M |

### Language Quality Status (as of 2025–2026)
| Language | Base model support | Quality | Status |
|:---|:---|:---|:---|
| English (US/UK) | ✅ Native | High — rated top open-source | **Approved for testing** |
| Spanish | ✅ Supported | Good | **Approved for testing** |
| Japanese | ✅ Supported | Good | **Approved for testing** |
| Mandarin Chinese | ✅ Supported | Good (prosodic nuance may lag larger models) | **Approved for testing; evaluate before production** |
| Arabic | ⚠️ Not natively supported in base model | N/A | **[UNRESOLVED — BLOCKER]** Community fine-tunes exist (e.g., Nabra) but each must be individually evaluated for license, quality, and dialect coverage before being approved for Arabic therapy sessions. A community fine-tune's Apache 2.0 claim must be verified against its own model card; the base model's license does not automatically cover derivative fine-tunes. |

### Actions Required Before Production Approval
- **[UNRESOLVED]** Download the exact checkpoint, compute and record SHA-256 hash, store in `docs/real-model-configuration.md`.
- **[UNRESOLVED — Arabic]** Identify a specific Arabic Kokoro fine-tune, verify its license, quality on MSA and Egyptian dialect, and record provenance.
- **[UNRESOLVED]** Evaluate and document Kokoro output quality (latency, naturalness, pronunciation) for each supported language on representative non-clinical sentences before enabling the language for production sessions.

### Confirmed Ban
**XTTS-v2 (Coqui) is permanently banned** from this codebase. CPML prohibits commercial use. Coqui Inc. no longer exists; no commercial license is obtainable. Any PR re-introducing XTTS-v2 must be rejected.

---

## 12. Fallback State

### Defined (non-placeholder)
When the A2F gRPC stream fails, is unavailable, or credentials are missing:

1. **No-avatar mode (immediate):** The client receives `{v:1, type:"avatar_error", code:503, msg:"avatar_unavailable"}`. The avatar panel displays plain text captions of the TTS response. No avatar image or animation is shown.
2. **TTS continues independently:** The TTS audio pipeline is completely decoupled from A2F. Voice playback continues.
3. **Text fallback (TTS also unavailable):** The LLM text response is shown in the chat interface. The session continues.
4. **No placeholder avatar image.** A static fallback avatar image may be added once a licensed asset is selected and verified (§7). Until then, text/captions are the sole fallback.

---

## Blocker Summary Table

| # | Item | Blocker | Owner |
|:---|:---|:---|:---|
| 1 | Exact `nvidia-audio2face-3d` package version pinned | **Engineering** |
| 1 | Exact function-id retrieved from build.nvidia.com | **Engineering** |
| 1 | Exact protobuf field path for blendshape weights confirmed | **Engineering** |
| 3 | PyPI package license verified after `pip show` | **Engineering / Legal** |
| 2 | Deployment mode decision (cloud vs. self-hosted) | **Product / Legal** |
| 4 | A2F output chunk size and frame rate measured from real service | **Engineering** |
| 5 | NVIDIA output channel order confirmed against installed proto | **Engineering** |
| 6 | NVCF data processing terms reviewed for health-data compliance | **Legal** |
| 6 | NVIDIA Open Model License output redistribution terms clarified | **Legal** |
| 7 | Production avatar asset selected, licensed, downloaded, hash-verified | **Art + Legal** |
| 8 | Complete blendshape mapping table (blocked on §7) | **Engineering** |
| 9 | Actual A2F frame rate measured to finalize jitter buffer N | **Engineering** |
| 10 | Consented smoke-test audio fixture recorded and committed | **Engineering + HR/Consent** |
| 10 | Consent document stored at `docs/licenses/a2f_smoke_recording_consent.pdf` | **Engineering + HR/Consent** |
| 11 | Kokoro checkpoint SHA-256 recorded | **Engineering** |
| 11 | Arabic Kokoro fine-tune identified, licensed, and quality-tested | **Engineering + Legal** |
| 11 | All 5 languages evaluated for production quality | **Engineering** |
| 12 | Smoke test passes against real NVIDIA provider | **Engineering** |
