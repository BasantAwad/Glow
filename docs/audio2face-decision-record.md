# Audio2Face-3D Decision Record

**Status:** Proposed (Blocked pending review)
**Phase:** 6E Pre-requisite

This record defines the technical architecture for the NVIDIA Audio2Face-3D (A2F) integration in Phase 6E, strictly adhering to the non-negotiable policy on real, privacy-preserving provider interactions.

## 1. API Version and Protocol
- **Service:** NVIDIA Audio2Face-3D NIM (NVIDIA Inference Microservice)
- **Protocol:** gRPC (Unary or Streaming). It does NOT use a standard REST/JSON HTTP endpoint.
- **Endpoint Target:** Configurable local NVCF deployment or NVIDIA API endpoint (`grpc.nvcf.nvidia.com:443`).

## 2. Dependency and License
- **Dependency:** `grpcio`, `grpcio-tools`, and the proprietary NVIDIA ACE Protobuf definitions (often distributed as an `nvidia_ace` python wheel in their sample repositories).
- **License:** The integration client itself is Apache 2.0 (via the NVIDIA samples), but the actual NIM usage/weights requires an NVIDIA AI Enterprise license or adherence to the NVIDIA API terms for commercial deployment.

## 3. Audio Format and Chunk Contract
- **Format:** 16-bit PCM WAV (or raw PCM bytes), typically at 16kHz or 22.05kHz, Mono.
- **Contract:** The A2F gRPC endpoint accepts an audio byte stream and returns a stream of `BlendShapeData` frames synchronously or asynchronously.

## 4. Rigged 3D Avatar Asset
- **Asset:** We will use a standard `.gltf` or `.glb` avatar rigged with standard ARKit blendshapes (52 standard morph targets).
- **Source:** Placeholder asset provided by the developer, or a standard open-source MetaHuman/ReadyPlayerMe mesh that maps 1:1 with ARKit.

## 5. Renderer
- **Engine:** `WebGL` / `Three.js` (via `React-Three-Fiber`).
- **Rationale:** Keeps the client fully web-based without requiring users to download a native Unity or Unreal Engine application. 

## 6. Blendshape Mapping and Animation Format
- **Mapping:** The A2F gRPC response outputs NVIDIA-specific or ARKit-specific blendshape multipliers (float arrays).
- **Format:** We will serialize these float arrays into JSON frames along with timestamps. The React-Three-Fiber client will parse these JSON frames and apply the floats to the corresponding morph target dictionaries on the `.glb` mesh in the `useFrame` render loop.

## 7. Delivery Architecture
- **Transport:** WebSocket (`/sessions/{session_id}/avatar/stream`).
- **Flow:**
  1. The TTS Gateway (`XTTSv2Gateway`) generates audio bytes.
  2. The server forks the audio: one path to the user (for sound), one path to the A2F gRPC client.
  3. The A2F gRPC client receives blendshapes from NVIDIA.
  4. The server relays these blendshapes over the WebSocket to the React client.
  5. The React client plays the audio and interpolates the blendshapes synchronously.

## 8. Requirements, Constraints & Fallbacks
- **GPU Requirements:** A2F NIM requires an NVIDIA RTX/Data Center GPU (e.g., A10G, A100, H100) if hosted locally.
- **Latency:** End-to-end (LLM -> TTS -> A2F) must remain under ~800ms to preserve conversational immersion.
- **Session Limits:** Determined by the underlying hardware concurrency limits; A2F streams are highly compute-intensive.
- **Fallback Behavior:** If A2F gRPC connection fails, the WebSocket emits an `avatar_error` frame. The React client degrades gracefully to a static 2D image (or pulsing audio visualizer) while still playing the TTS voice, ensuring the therapy session can continue uninterrupted.
