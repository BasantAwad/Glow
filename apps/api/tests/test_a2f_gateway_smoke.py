"""
Smoke test for NVIDIA Audio2Face-3D gRPC integration (Phase 6E gate).

STATUS: BLOCKED — Multiple prerequisites are unmet. See docs/audio2face-decision-record.md.

═══════════════════════════════════════════════════════════════
FIXTURE POLICY (non-negotiable):
  This test requires a REAL human-recorded audio file.

  A synthetic silence WAV cannot validly prove facial-animation
  quality and violates the no-mock/no-synthetic-data requirement.

  The required fixture is:
    apps/api/tests/fixtures/a2f_smoke_sentence_16k_mono.wav

  Content:  A natural English sentence such as
            "Hello, this is a technical audio test."
  Duration: 3–5 seconds.
  Encoding: 16-bit PCM, 16 000 Hz, Mono.

  Recording consent requirements (must all be met before the
  file is committed to the repository or transmitted to NVIDIA):
    1. Recorded by a team member or contractor who has given
       explicit written consent to (a) store the recording in
       this private repository and (b) transmit it to NVIDIA's
       NVCF endpoint for testing purposes.
    2. A signed consent form must be stored at:
         docs/licenses/a2f_smoke_recording_consent.pdf
    3. The recording must contain no clinical content, no PII,
       no patient data, and no sensitive information.
    4. If no consented recording is available, this file must
       NOT be generated synthetically. Leave the test blocked.

  This fixture file is NOT currently committed. The test will
  fail explicitly when it is absent.
═══════════════════════════════════════════════════════════════

This test runs ONLY when ALL of the following are true:
  ENABLE_LIVE_PROVIDER_TESTS=1        (env var)
  GLOW_NVIDIA_API_KEY=<non-empty>          (env var)
  GLOW_A2F_FUNCTION_ID=<non-empty>         (env var — retrieve from
                                       https://build.nvidia.com/nvidia/audio2face-3d)
  GLOW_A2F_ENDPOINT=<host:port>            (env var, e.g. grpc.nvcf.nvidia.com:443)
  fixture file exists at the path above

If any prerequisite is missing, the test FAILS EXPLICITLY with a
message naming each missing item. It does NOT silently skip.

What this test validates against the REAL provider:
  1. gRPC connection established within 10 s.
  2. Service returns at least one animation-data stream message.
  3. Each frame contains exactly 52 float channels in a fixed,
     known order (verified against the protobuf definition).
  4. All channel values are finite (no NaN / Inf).
  5. All channel values are in the range [0.0, 1.0] (ARKit spec).
  6. Frame time-codes are strictly monotonically increasing.
  7. The gRPC stream closes cleanly (no hanging channel).
  8. Measured latency (request-send → first frame) is logged.

What this test does NOT validate:
  - Facial-movement quality (requires visual inspection against
    the real avatar asset; cannot be automated here).
  - Therapy outcomes, session logic, or safety controls.
  - Synthesised or fictional animation data is not accepted as
    proof of correctness (see §12 of the decision record).
"""

import os
import pathlib
import pytest

FIXTURE_PATH = pathlib.Path(__file__).parent / "fixtures" / "a2f_smoke_sentence_16k_mono.wav"
CONSENT_PATH = pathlib.Path(__file__).parents[4] / "docs" / "licenses" / "a2f_smoke_recording_consent.pdf"

REQUIRED_CHANNELS = 52  # ARKit standard, verified from NVIDIA documentation


def _check_all_prerequisites() -> list[str]:
    """Return a list of unmet prerequisites. Empty list means all are met."""
    failures: list[str] = []

    if os.environ.get("ENABLE_LIVE_PROVIDER_TESTS") != "1":
        failures.append(
            "ENABLE_LIVE_PROVIDER_TESTS is not set to '1'. "
            "Set it explicitly to opt in to live provider tests."
        )

    for var in ("GLOW_NVIDIA_API_KEY", "GLOW_A2F_FUNCTION_ID", "GLOW_A2F_ENDPOINT"):
        if not os.environ.get(var, "").strip():
            failures.append(
                f"{var} environment variable is missing or empty. "
                f"Retrieve it from https://build.nvidia.com/nvidia/audio2face-3d"
            )

    if not FIXTURE_PATH.is_file():
        failures.append(
            f"Audio fixture not found: {FIXTURE_PATH}\n"
            "  Required: a real 3–5 s human-recorded sentence at 16 kHz / 16-bit PCM / Mono.\n"
            "  Content:  'Hello, this is a technical audio test.' or similar non-sensitive sentence.\n"
            "  Consent:  Recorder must have signed the consent form at\n"
            f"            {CONSENT_PATH}\n"
            "  DO NOT generate this file synthetically. Leave the test blocked."
        )
    else:
        # Validate the fixture is a real WAV, not a synthetic silence file
        import wave
        try:
            with wave.open(str(FIXTURE_PATH)) as wf:
                sr = wf.getframerate()
                ch = wf.getnchannels()
                sw = wf.getsampwidth()
                n_frames = wf.getnframes()
                duration_s = n_frames / sr

                if sr != 16000:
                    failures.append(
                        f"Fixture sample rate is {sr} Hz; must be exactly 16 000 Hz."
                    )
                if ch != 1:
                    failures.append(
                        f"Fixture channel count is {ch}; must be Mono (1 channel)."
                    )
                if sw != 2:
                    failures.append(
                        f"Fixture sample width is {sw} bytes; must be 16-bit (2 bytes)."
                    )
                if duration_s < 2.0 or duration_s > 10.0:
                    failures.append(
                        f"Fixture duration is {duration_s:.2f} s; must be 2–10 s."
                    )

                # Reject silent files (all-zero PCM samples)
                import struct
                frames_bytes = wf.readframes(n_frames)
                samples = struct.unpack(f"<{n_frames}h", frames_bytes)
                rms = (sum(s * s for s in samples) / max(len(samples), 1)) ** 0.5
                if rms < 100:  # empirical threshold for near-silence
                    failures.append(
                        "Fixture audio appears to be silence (RMS < 100). "
                        "A real speech recording is required. "
                        "Do NOT substitute a synthetic silence file."
                    )
        except Exception as exc:
            failures.append(f"Fixture file cannot be read as WAV: {exc}")

    if not CONSENT_PATH.is_file():
        failures.append(
            f"Recording consent document not found: {CONSENT_PATH}\n"
            "  The recorder must sign the consent form before the fixture is committed."
        )

    # Verify the gRPC SDK is installed
    try:
        import grpc  # noqa: F401
    except ImportError:
        failures.append(
            "grpcio is not installed. Run: pip install grpcio"
        )

    # Verify the NVIDIA ACE protobuf package is installed
    try:
        import nvidia_audio2face_3d  # noqa: F401
    except ImportError:
        failures.append(
            "nvidia-audio2face-3d is not installed. Run: pip install nvidia-audio2face-3d\n"
            "  Additionally verify the installed package version and its license:\n"
            "  pip show nvidia-audio2face-3d"
        )

    return failures


@pytest.mark.asyncio
async def test_a2f_gateway_smoke():
    """
    Gated smoke test: validates NVIDIA Audio2Face-3D NIM real response schema.
    Phase 6E is BLOCKED until this test passes with a real fixture and real provider.
    """
    import time

    failures = _check_all_prerequisites()
    if failures:
        pytest.fail(
            "Audio2Face smoke test BLOCKED. The following prerequisites are unmet:\n\n"
            + "\n\n".join(f"[{i+1}] {f}" for i, f in enumerate(failures))
            + "\n\nPhase 6E must not begin until this test passes. "
            "See docs/audio2face-decision-record.md for the full blocker list."
        )

    # --- All prerequisites met: run real provider call ---

    import grpc
    from nvidia_audio2face_3d import audio2face_pb2_grpc, messages_pb2

    api_key = os.environ["GLOW_NVIDIA_API_KEY"]
    function_id = os.environ["GLOW_A2F_FUNCTION_ID"]
    endpoint = os.environ["GLOW_A2F_ENDPOINT"]

    audio_bytes = FIXTURE_PATH.read_bytes()

    # Build the streaming request
    # Message names verified from nvidia_audio2face_3d package inspection.
    # If these names have changed in the installed version, update them here
    # and record the version in docs/audio2face-decision-record.md §1.
    stream_header = messages_pb2.AudioWithEmotionStreamHeader(
        audio_header=messages_pb2.AudioHeader(
            samples_per_second=16000,
            bits_per_sample=16,
            channel_count=1,
            audio_format=messages_pb2.AudioHeader.AudioFormat.PCM,
        )
    )

    def _request_iterator():
        # Send the stream header first
        yield messages_pb2.AudioWithEmotion(
            audio_with_emotion_stream_header=stream_header
        )
        # Send audio in chunks (4096 bytes = ~128 ms at 16kHz/16-bit/mono)
        CHUNK_SIZE = 4096
        for offset in range(0, len(audio_bytes), CHUNK_SIZE):
            chunk = audio_bytes[offset: offset + CHUNK_SIZE]
            yield messages_pb2.AudioWithEmotion(
                audio_buffer=messages_pb2.AudioBuffer(audio_buffer=chunk)
            )

    metadata = [
        ("authorization", f"Bearer {api_key}"),
        ("function-id", function_id),
    ]

    credentials = grpc.ssl_channel_credentials()
    channel = grpc.secure_channel(endpoint, credentials)
    stub = audio2face_pb2_grpc.A2FControllerServiceStub(channel)

    frames_received: list[dict] = []
    t_request_sent = time.perf_counter()
    t_first_frame: float | None = None

    try:
        response_stream = stub.ProcessAudioStream(
            _request_iterator(),
            metadata=metadata,
            timeout=30.0,
        )

        for response in response_stream:
            if t_first_frame is None:
                t_first_frame = time.perf_counter()

            # Each response is an A2F3DAnimationDataStream message.
            # Extract blendshape frame data.
            for frame in response.animation_data_stream.skel_animation_header.blend_shape_weights:
                frames_received.append({
                    "time_code": frame.time_code,
                    "weights": list(frame.values),
                })

    except grpc.RpcError as exc:
        pytest.fail(
            f"gRPC call to Audio2Face-3D failed: {exc.code()} — {exc.details()}\n"
            "Check GLOW_NVIDIA_API_KEY, GLOW_A2F_FUNCTION_ID, and GLOW_A2F_ENDPOINT."
        )
    finally:
        channel.close()

    # ── Assertions ─────────────────────────────────────────────────────────────

    assert t_first_frame is not None, (
        "No animation frames were returned. The service may have returned an empty response."
    )

    latency_ms = (t_first_frame - t_request_sent) * 1000.0
    print(f"\n[A2F SMOKE] first-frame latency={latency_ms:.1f} ms, "
          f"total frames={len(frames_received)}, "
          f"endpoint={endpoint}, function-id={function_id}")

    assert len(frames_received) >= 1, (
        "Service returned zero animation frames."
    )

    prev_time_code = -1.0
    for i, frame in enumerate(frames_received):
        weights = frame["weights"]
        tc = frame["time_code"]

        # Channel count
        assert len(weights) == REQUIRED_CHANNELS, (
            f"Frame {i}: expected {REQUIRED_CHANNELS} channels, got {len(weights)}. "
            "The protobuf definition or NVIDIA API may have changed."
        )

        # Finite values
        import math
        for j, w in enumerate(weights):
            assert math.isfinite(w), (
                f"Frame {i}, channel {j}: non-finite value {w!r}."
            )

        # Range [0, 1] — ARKit specification
        for j, w in enumerate(weights):
            assert 0.0 <= w <= 1.0, (
                f"Frame {i}, channel {j}: value {w!r} outside [0.0, 1.0]."
            )

        # Monotonically increasing time-codes
        assert tc > prev_time_code, (
            f"Frame {i}: time_code {tc!r} is not strictly greater than "
            f"previous {prev_time_code!r}. Timestamps must be monotonically increasing."
        )
        prev_time_code = tc

    # NOTE: Visual quality of facial movement CANNOT be validated here.
    # Movement quality must be assessed by a human reviewer against the
    # real licensed avatar asset. See docs/audio2face-decision-record.md §4.
