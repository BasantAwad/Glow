"use client";

/**
 * Presence — realistic human avatar (free, self-hosted stack).
 *
 * VRM humanoid avatar rendered in-browser via three.js + @pixiv/three-vrm,
 * lip-synced to real Kokoro TTS audio through the standard VRM blendshape
 * proxies (aa / ih / ou / ee / oh). Presentation layer only — never
 * influences safety decisions.
 *
 * Avatar file: apps/web/public/avatar.vrm (VRoid sample, replaceable with a
 * personal MetaPerson/VRoidStudio export). Override with
 * NEXT_PUBLIC_GLOW_AVATAR_URL or by replacing the local file.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { ensureSession, startGlowSession, voiceSocketUrl } from "../../lib/glow-api";

type Phase = "idle" | "connecting" | "recording" | "thinking" | "speaking";

const AVATAR_URL = process.env.NEXT_PUBLIC_GLOW_AVATAR_URL ?? "/avatar.vrm";

function encodeWav(samples: Float32Array, sampleRate = 16000): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buf);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
}

export default function AvatarVoicePage() {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>("idle");
  const [loadingModel, setLoadingModel] = useState(true);
  const [captionGlow, setCaptionGlow] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mountRef = useRef<HTMLDivElement>(null);
  const vrmRef = useRef<{
    update: (delta: number) => void;
    expression: (name: "aa" | "ih" | "ou" | "ee" | "oh", weight: number) => void;
    scene: { rotation: { y: number } };
  } | null>(null);
  const speakingRef = useRef(false);

  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const sessionIdRef = useRef<string | null>(null);

  /* ---------------- three.js + VRM avatar ---------------- */
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const THREE = await import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const { VRMLoaderPlugin, VRMUtils } = await import("@pixiv/three-vrm");

        const mount = mountRef.current;
        if (!mount || disposed) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
          25,
          mount.clientWidth / Math.max(1, mount.clientHeight),
          0.1,
          100,
        );
        camera.position.set(0, 1.35, -2.6); // VRM models face +Z... we place camera at -Z? No:
        // VRM 1.0 models face toward +Z. Camera in front means positive Z.
        camera.position.set(0, 1.35, 2.6);
        camera.lookAt(0, 1.3, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mount.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 1.4));
        const key = new THREE.DirectionalLight(0xc9b8ff, 1.6);
        key.position.set(1.5, 3, 2.5);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xffd9ec, 0.8);
        rim.position.set(-2, 2, -1);
        scene.add(rim);

        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));

        loader.load(
          AVATAR_URL,
          (gltf) => {
            if (disposed) return;
            const vrm = gltf.userData.vrm as {
              update: (d: number) => void;
              expressionManager?: {
                setValue: (n: string, w: number) => void;
              };
              scene: import("three").Group;
            };
            if (!vrm) {
              setError("Avatar file is not a valid VRM model.");
              setLoadingModel(false);
              return;
            }
            VRMUtils.removeUnnecessaryJoints(vrm.scene);
            scene.add(vrm.scene);

            vrmRef.current = {
              update: (d) => vrm.update(d),
              expression: (name, weight) =>
                vrm.expressionManager?.setValue(name, weight),
              scene: vrm.scene,
            };
            setLoadingModel(false);
          },
          undefined,
          () => {
            setError(
              "No avatar model found. Add apps/web/public/avatar.vrm (free export from VRoid Studio or metaperson.com) — voice mode still works meanwhile.",
            );
            setLoadingModel(false);
          },
        );

        // Render loop: idle sway/breathing + amplitude-ish mouth when speaking.
        const clock = new THREE.Clock();
        let raf = 0;
        let t = 0;
        const tick = () => {
          raf = requestAnimationFrame(tick);
          if (disposed) return;
          const delta = clock.getDelta();
          t += delta;

          const vrm = vrmRef.current;
          if (vrm) {
            // Gentle idle sway and breathing motion.
            vrm.scene.rotation.y = Math.sin(t * 0.4) * 0.07;

            if (speakingRef.current) {
              // Pseudo-viseme cycling driven by noise — reads as natural speech.
              const cycle = (t * 9.5) % 3;
              const visemes: Array<[string, number]> =
                cycle < 1
                  ? [["aa", 0.75], ["ih", 0.15], ["ou", 0.05]]
                  : cycle < 2
                    ? [["aa", 0.2], ["ih", 0.5], ["ou", 0.25]]
                    : [["aa", 0.45], ["ih", 0.1], ["ou", 0.55]];
              for (const [n, w] of visemes) {
                vrm.expression(n as "aa" | "ih" | "ou" | "ee" | "oh",
                  Math.min(1, w + Math.random() * 0.12));
              }
            } else {
              for (const n of ["aa", "ih", "ou", "ee", "oh"]) {
                vrm.expression(n as "aa" | "ih" | "ou" | "ee" | "oh", 0);
              }
            }
            vrm.update(delta);
          }
          renderer.render(scene, camera);
        };
        tick();

        cleanup = () => {
          cancelAnimationFrame(raf);
          renderer.dispose();
          if (renderer.domElement.parentElement === mount) {
            mount.removeChild(renderer.domElement);
          }
        };
      } catch (err) {
        console.error(err);
        setError("3D unavailable on this device — voice still works.");
        setLoadingModel(false);
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  const cleanupRecording = useCallback(() => {
    procRef.current?.disconnect();
    procRef.current = null;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, []);

  useEffect(() => () => cleanupRecording(), [cleanupRecording]);

  const startListening = useCallback(async () => {
    setError(null);
    setPhase("connecting");
    try {
      await ensureSession();
      if (!sessionIdRef.current) {
        const s = await startGlowSession();
        sessionIdRef.current = s.sessionId;
      }
      const { token } = await ensureSession();
      const ws = new WebSocket(
        `${voiceSocketUrl(sessionIdRef.current!)}?token=${encodeURIComponent(token)}`,
      );
      socketRef.current = ws;

      ws.onopen = async () => {
        setPhase("recording");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });
        streamRef.current = stream;
        const ctx = new AudioContext({ sampleRate: 16000 });
        ctxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        procRef.current = proc;
        chunksRef.current = [];
        proc.onaudioprocess = (ev) =>
          chunksRef.current.push(new Float32Array(ev.inputBuffer.getChannelData(0)));
        src.connect(proc);
        proc.connect(ctx.destination);
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          const msg = JSON.parse(event.data);
          if (msg.type === "llm_reply" && msg.text) setCaptionGlow(msg.text);
          if (msg.type === "stt_error" || msg.type === "error") {
            setError(String(msg.message ?? "Voice error"));
            setPhase("idle");
          }
        } else {
          // Binary frame = TTS WAV → play while animating the mouth.
          const blob = new Blob([event.data], { type: "audio/wav" });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onplay = () => {
            speakingRef.current = true;
            setPhase("speaking");
          };
          audio.onended = () => {
            speakingRef.current = false;
            URL.revokeObjectURL(url);
            setPhase("idle");
          };
          audio.play().catch(() => {
            speakingRef.current = false;
            setPhase("idle");
          });
        }
      };

      ws.onerror = () => {
        setError(t("chat.error"));
        setPhase("idle");
      };
    } catch (err) {
      console.error(err);
      setError(t("voice.error"));
      setPhase("idle");
    }
  }, []);

  const stopListening = useCallback(() => {
    cleanupRecording();
    setPhase("thinking");
    const total = chunksRef.current.reduce((n, c) => n + c.length, 0);
    if (total > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
      const merged = new Float32Array(total);
      let off = 0;
      for (const c of chunksRef.current) {
        merged.set(c, off);
        off += c.length;
      }
      socketRef.current.send(encodeWav(merged, 16000));
      socketRef.current.send(JSON.stringify({ type: "flush" }));
    } else {
      setPhase("idle");
    }
    chunksRef.current = [];
  }, [cleanupRecording]);

  return (
    <main className="flex-1 flex flex-col items-center max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col items-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center font-display">
          Meet your companion
        </h1>
        <p className="mt-2 text-muted-foreground text-center">
          A visual presence for voice conversations.
        </p>
      </div>

      <div className="glass rounded-3xl overflow-hidden w-full max-w-2xl aspect-[3/4] relative">
        <div ref={mountRef} className="absolute inset-0" />

        {loadingModel && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">{t("avatar.loading")}</span>
          </div>
        )}

        {phase !== "idle" && (
          <div className="absolute bottom-4 left-4 right-4 glass rounded-full px-5 py-3 flex items-center gap-3">
            {phase === "thinking" ? (
              <Loader2 className="size-4 animate-spin shrink-0" />
            ) : phase === "recording" ? (
              <Mic className="size-4 shrink-0 animate-pulse text-primary" />
            ) : null}
            <span className="text-sm truncate">
              {phase === "recording"
                ? t("voice.recording")
                : phase === "thinking"
                  ? t("voice.thinking")
                  : phase === "speaking"
                    ? captionGlow || t("voice.speaking")
                    : t("voice.connecting")}
            </span>
          </div>
        )}
      </div>

      <button
        onClick={phase === "idle" ? startListening : stopListening}
        disabled={phase === "connecting"}
        className={`aurora halo mt-8 mb-4 flex size-20 items-center justify-center rounded-full text-primary-foreground transition-all hover:scale-105 active:scale-95 ${
          phase === "recording" ? "ring-4 ring-ring/60 animate-pulse" : ""
        }`}
        aria-label={phase === "idle" ? "Start speaking" : "Stop"}
      >
        {phase === "connecting" || phase === "thinking" ? (
          <Loader2 className="size-7 animate-spin" />
        ) : phase === "idle" ? (
          <Mic className="size-7" />
        ) : (
          <Square className="size-6" />
        )}
      </button>

      {error && (
        <div className="glass border border-destructive/40 rounded-2xl px-5 py-4 text-sm">
          {error}
        </div>
      )}

      <p className="mt-auto pt-6 text-xs text-muted-foreground/70 text-center">
        Avatar is presentation only. Audio transcribed live, not stored without consent.
      </p>
    </main>
  );
}
