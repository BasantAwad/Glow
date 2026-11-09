"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, Volume2, Sparkles, User, Video } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { ensureSession, startGlowSession, voiceSocketUrl, GlowApiOfflineError } from "../../lib/glow-api";

type Phase = "idle" | "connecting" | "recording" | "thinking" | "speaking";
type PresenterMode = "avatar" | "tavus";

const AVATAR_URL = process.env.NEXT_PUBLIC_GLOW_AVATAR_URL ?? "/avatar.vrm";
const TAVUS_DEPLOYMENT_ID = process.env.NEXT_PUBLIC_TAVUS_DEPLOYMENT_ID || "6e550748-e56b-43c4-b4a3-80b78e38c1cd";

interface ModeSelectorProps {
  mode: PresenterMode;
  onChange: (m: PresenterMode) => void;
  disabled: boolean;
}

function ModeSelector({ mode, onChange, disabled }: ModeSelectorProps) {
  const options: { id: PresenterMode; label: string; icon: React.ReactNode; available: boolean }[] = [
    { id: "avatar", label: "Avatar", icon: <User className="size-4" />, available: true },
    { id: "tavus", label: "Realistic", icon: <Video className="size-4" />, available: !!TAVUS_DEPLOYMENT_ID },
  ];

  return (
    <div className="flex items-center gap-1 glass rounded-full p-1 mb-8">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => !disabled && opt.available && onChange(opt.id)}
          disabled={disabled || !opt.available}
          title={!opt.available ? "Add NEXT_PUBLIC_TAVUS_DEPLOYMENT_ID to .env.local to enable" : undefined}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
            mode === opt.id
              ? "aurora halo text-primary-foreground"
              : opt.available
                ? "text-muted-foreground hover:text-foreground"
                : "text-muted-foreground/30 cursor-not-allowed"
          }`}
        >
          {opt.icon}
          {opt.label}
          {!opt.available && <span className="text-[10px] ml-1 opacity-60">soon</span>}
        </button>
      ))}
    </div>
  );
}

interface AvatarPresenterProps {
  phase: Phase;
  speaking: boolean;
  onLoaded: () => void;
  onError: (msg: string) => void;
}

function AvatarPresenter({ phase: _phase, speaking, onLoaded, onError }: AvatarPresenterProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const speakingRef = useRef(speaking);

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

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

        const w = mount.clientWidth || 480;
        const h = mount.clientHeight || 640;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(22, w / h, 0.1, 100);
        camera.position.set(0, 1.38, 2.5);
        camera.lookAt(0, 1.3, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        mount.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 1.2));
        const key = new THREE.DirectionalLight(0xd0b8ff, 1.8);
        key.position.set(1.5, 3, 2.5);
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xffcce8, 0.9);
        rim.position.set(-2, 2, -1);
        scene.add(rim);
        const fill = new THREE.DirectionalLight(0xb8e4ff, 0.5);
        fill.position.set(0, -1, 2);
        scene.add(fill);

        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));

        loader.load(
          AVATAR_URL,
          (gltf) => {
            if (disposed) return;
            const vrm = gltf.userData.vrm as {
              update: (d: number) => void;
              expressionManager?: { setValue: (n: string, w: number) => void };
              scene: import("three").Group;
            };

            if (!vrm) {
              onError("Avatar file is not a valid VRM model.");
              return;
            }

            VRMUtils.removeUnnecessaryJoints(vrm.scene);
            vrm.scene.rotation.y = Math.PI;
            scene.add(vrm.scene);
            onLoaded();

            const clock = new THREE.Clock();
            let raf = 0;
            let elapsed = 0;

            const tick = () => {
              raf = requestAnimationFrame(tick);
              if (disposed) return;
              const delta = clock.getDelta();
              elapsed += delta;

              vrm.scene.rotation.y = Math.PI + Math.sin(elapsed * 0.35) * 0.04;

              if (speakingRef.current) {
                const cycle = (elapsed * 9) % 3;
                const visemes: Array<[string, number]> =
                  cycle < 1
                    ? [["aa", 0.7], ["ih", 0.1]]
                    : cycle < 2
                      ? [["ih", 0.5], ["ou", 0.2]]
                      : [["aa", 0.4], ["ou", 0.5]];
                for (const [n, w] of visemes) {
                  vrm.expressionManager?.setValue(n, Math.min(1, w + Math.random() * 0.1));
                }
              } else {
                for (const n of ["aa", "ih", "ou", "ee", "oh"]) {
                  vrm.expressionManager?.setValue(n, 0);
                }
              }

              vrm.update(delta);
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
          },
          undefined,
          () => {
            if (disposed) return;
            onError("No avatar model found. Drop a .vrm file into apps/web/public/avatar.vrm — voice still works without it.");
          },
        );
      } catch (err) {
        console.error("[avatar]", err);
        if (!disposed) onError("3D unavailable on this device — voice still works.");
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="w-full h-full absolute inset-0" aria-label="3D avatar" />;
}

function TavusPresenter({ speaking: _speaking }: { speaking: boolean }) {
  const [embedStatus, setEmbedStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let disposed = false;
    let timeoutId: number | undefined;
    const scriptUrl = "https://unpkg.com/@tavus/embed@latest";
    const script = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);

    const markReady = () => {
      void customElements.whenDefined("tavus-embed").then(() => {
        if (!disposed) setEmbedStatus("ready");
      });
    };
    const markError = () => {
      if (!disposed) setEmbedStatus("error");
    };

    if (customElements.get("tavus-embed")) {
      void Promise.resolve().then(() => {
        if (!disposed) setEmbedStatus("ready");
      });
      return;
    }

    const embedScript = script ?? document.createElement("script");
    embedScript.addEventListener("load", markReady, { once: true });
    embedScript.addEventListener("error", markError, { once: true });
    timeoutId = window.setTimeout(markError, 15_000);

    if (!script) {
      embedScript.src = scriptUrl;
      embedScript.async = true;
      document.body.appendChild(embedScript);
    }

    return () => {
      disposed = true;
      embedScript.removeEventListener("load", markReady);
      embedScript.removeEventListener("error", markError);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  if (!TAVUS_DEPLOYMENT_ID) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm text-center p-6">
        <div>
          <Video className="size-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium mb-1">Realistic AI video companion</p>
          <p className="opacity-60 text-xs">
            Add <code className="opacity-80">NEXT_PUBLIC_TAVUS_DEPLOYMENT_ID</code> to <code className="opacity-80">.env.local</code> to enable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden rounded-3xl">
      <tavus-embed deployment-id={TAVUS_DEPLOYMENT_ID}></tavus-embed>
      {embedStatus !== "ready" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-6 text-center">
          {embedStatus === "loading" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Connecting to the AI video companion…</span>
            </div>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              The video companion could not load. You can switch to voice-only or text chat.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function PresencePage() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<PresenterMode>("tavus");
  const [phase, setPhase] = useState<Phase>("idle");
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [captionGlow, setCaptionGlow] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const procRef = useRef<ScriptProcessorNode | null>(null);
  const audioPlaybackRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const cleanupRecording = useCallback(() => {
    procRef.current?.disconnect();
    procRef.current = null;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }, []);

  useEffect(() => () => {
    cleanupRecording();
    audioRef.current?.pause();
    if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);
    audioRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
  }, [cleanupRecording]);

  const startListening = useCallback(async () => {
    setError(null);
    setPhase("connecting");
    setCaptionGlow("");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      const e = err as DOMException;
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setError("Microphone access was denied. Please allow mic permission and try again.");
      } else if (e.name === "NotFoundError") {
        setError("No microphone found. Please connect a microphone and try again.");
      } else {
        setError(`Microphone error: ${e.message}`);
      }
      setPhase("idle");
      return;
    }

    streamRef.current = stream;

    try {
      await ensureSession();
      if (!sessionIdRef.current) {
        const s = await startGlowSession();
        sessionIdRef.current = s.sessionId;
      }
      const { token } = await ensureSession();

      const ws = new WebSocket(`${voiceSocketUrl(sessionIdRef.current!)}?token=${encodeURIComponent(token)}`);
      socketRef.current = ws;

      ws.onopen = () => {
        setPhase("recording");
        audioPlaybackRef.current = false;

        const ctx = new AudioContext({ sampleRate: 16000 });
        ctxRef.current = ctx;
        ws.send(JSON.stringify({ type: "audio_config", sample_rate_hz: ctx.sampleRate }));
        const src = ctx.createMediaStreamSource(stream);
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        procRef.current = proc;
        proc.onaudioprocess = (ev) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const samples = ev.inputBuffer.getChannelData(0);
          const pcm = new ArrayBuffer(samples.length * 2);
          const view = new DataView(pcm);
          for (let i = 0; i < samples.length; i++) {
            const sample = Math.max(-1, Math.min(1, samples[i]));
            const value = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff);
            view.setInt16(i * 2, value, true);
          }
          ws.send(pcm);
        };
        src.connect(proc);
        proc.connect(ctx.destination);
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          const msg = JSON.parse(event.data) as { type: string; text?: string; message?: string };
          if (msg.type === "llm_reply" && msg.text) {
            setCaptionGlow(msg.text);
            setPhase("thinking");
          }
          if (msg.type === "turn_complete" && !audioPlaybackRef.current) {
            setPhase("idle");
            if (socketRef.current === ws) {
              socketRef.current = null;
              ws.close();
            }
          }
          if (msg.type === "stt_error" || msg.type === "error") {
            setError(String(msg.message ?? "Voice error — please try again."));
            setPhase("idle");
            if (socketRef.current === ws) {
              socketRef.current = null;
              ws.close();
            }
          }
        } else {
          const blob = new Blob([event.data as BlobPart], { type: "audio/wav" });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          audioPlaybackRef.current = true;
          audio.onplay = () => {
            setSpeaking(true);
            setPhase("speaking");
          };
          audio.onended = () => {
            audioPlaybackRef.current = false;
            audioRef.current = null;
            setSpeaking(false);
            URL.revokeObjectURL(url);
            setPhase("idle");
            if (socketRef.current === ws) {
              socketRef.current = null;
              ws.close();
            }
          };
          audio.play().catch(() => {
            audioPlaybackRef.current = false;
            audioRef.current = null;
            setSpeaking(false);
            URL.revokeObjectURL(url);
            setPhase("idle");
            if (socketRef.current === ws) {
              socketRef.current = null;
              ws.close();
            }
          });
        }
      };

      ws.onerror = () => {
        setError("Connection error — is the Glow API running?");
        cleanupRecording();
        setPhase("idle");
        if (socketRef.current === ws) {
          socketRef.current = null;
          ws.close();
        }
      };
      ws.onclose = () => {
        if (socketRef.current === ws) {
          socketRef.current = null;
          setPhase("idle");
        }
      };
    } catch (err) {
      console.error("[voice]", err);
      cleanupRecording();
      if (err instanceof GlowApiOfflineError) {
        setError(err.message);
      } else {
        setError(t("voice.error"));
      }
      setPhase("idle");
    }
  }, [cleanupRecording, t]);

  const stopListening = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
      audioPlaybackRef.current = false;
      setSpeaking(false);
      socketRef.current?.close();
      socketRef.current = null;
      setPhase("idle");
      return;
    }
    setPhase("thinking");
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "flush" }));
    } else {
      setPhase("idle");
    }
    cleanupRecording();
  }, [cleanupRecording]);

  const isActive = phase !== "idle" && phase !== "connecting";
  const canToggle = phase !== "connecting" && phase !== "thinking";

  return (
    <main className="flex-1 flex flex-col items-center max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col items-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center font-display">
          {mode === "avatar" ? "Meet your AI companion" : "AI video companion"}
        </h1>
        <p className="mt-2 text-muted-foreground text-center text-sm">Talk naturally. Captions always on.</p>
      </div>

      <ModeSelector
        mode={mode}
        onChange={(m) => {
          setMode(m);
          setLoadingAvatar(m === "avatar");
        }}
        disabled={isActive}
      />

      <p className="mb-4 max-w-sm text-center text-xs text-muted-foreground" role="note">
        Glow is AI—not a human or therapist, and not a substitute for professional or emergency care.
      </p>

      <div className="glass rounded-3xl overflow-hidden w-full max-w-sm aspect-[3/4] relative mb-2">
        {mode === "avatar" && (
          <>
            {loadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground z-10">
                <Loader2 className="size-5 animate-spin" />
                <span className="text-sm">{t("avatar.loading")}</span>
              </div>
            )}
            <AvatarPresenter
              phase={phase}
              speaking={speaking}
              onLoaded={() => setLoadingAvatar(false)}
              onError={(msg) => {
                setLoadingAvatar(false);
                setError(msg);
              }}
            />
          </>
        )}
        {mode === "tavus" && <TavusPresenter speaking={speaking} />}

        {mode !== "tavus" && phase !== "idle" && (
          <div className="absolute bottom-3 left-3 right-3 glass rounded-2xl px-4 py-2.5 flex items-center gap-2 z-20">
            {phase === "thinking" ? (
              <Loader2 className="size-3.5 animate-spin shrink-0 text-muted-foreground" />
            ) : phase === "recording" ? (
              <Mic className="size-3.5 shrink-0 animate-pulse text-primary" />
            ) : phase === "speaking" ? (
              <Volume2 className="size-3.5 shrink-0 text-primary" />
            ) : null}
            <span className="text-xs truncate text-foreground/80">
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

      {mode !== "tavus" && captionGlow && phase === "idle" && (
        <div className="glass rounded-2xl px-5 py-3 mt-4 w-full max-w-sm text-sm leading-relaxed">
          {captionGlow}
        </div>
      )}

      {mode !== "tavus" && (
        <>
          <button
            onClick={canToggle ? (isActive ? stopListening : startListening) : undefined}
            disabled={!canToggle}
            className={`aurora halo mt-6 mb-4 flex size-20 items-center justify-center rounded-full text-primary-foreground transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
              phase === "recording" ? "ring-4 ring-ring/60 animate-pulse" : ""
            }`}
            aria-label={isActive ? "Stop and send" : "Start speaking"}
          >
            {phase === "connecting" || phase === "thinking" ? (
              <Loader2 className="size-7 animate-spin" />
            ) : phase === "recording" || phase === "speaking" ? (
              <Square className="size-6" />
            ) : (
              <Mic className="size-7" />
            )}
          </button>

          <p className="text-sm text-muted-foreground flex items-center gap-2 mb-4">
            {phase === "speaking" && <Volume2 className="size-4" />}
            {phase === "idle"
              ? t("voice.start")
              : phase === "connecting"
                ? t("voice.connecting")
                : phase === "recording"
                  ? t("voice.recording")
                  : phase === "thinking"
                    ? t("voice.thinking")
                    : t("voice.speaking")}
          </p>
        </>
      )}

      {error && (
        <div className="glass border border-destructive/40 rounded-2xl px-5 py-4 text-sm w-full max-w-sm">
          {error}
        </div>
      )}

      <p className="mt-auto pt-6 text-xs text-muted-foreground/60 text-center">{t("voice.disclaimer")}</p>
    </main>
  );
}
