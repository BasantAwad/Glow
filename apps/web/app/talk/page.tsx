"use client";

/**
 * Voice session — real pipeline.
 *
 * Mic audio (WAV, 16 kHz mono) → Glow WebSocket → faster-whisper STT →
 * safety-checked LLM reply → Kokoro TTS audio back to the browser.
 * Captions are always shown; the transcript is never stored client-side
 * beyond the visible caption.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, Volume2 } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { ensureSession, startGlowSession, voiceSocketUrl } from "../../lib/glow-api";

type Phase = "idle" | "connecting" | "recording" | "thinking" | "speaking";

function encodeWav(samples: Float32Array, sampleRate = 16000): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buf);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
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

export default function PresencePage() {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<Phase>("idle");
  const [captionUser, setCaptionUser] = useState("");
  const [captionGlow, setCaptionGlow] = useState("");
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const sessionIdRef = useRef<string | null>(null);

  const cleanupRecording = useCallback(() => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
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
        // Record mic as raw PCM chunks; assembled into WAV on stop.
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });
        streamRef.current = stream;
        const ctx = new AudioContext({ sampleRate: 16000 });
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = proc;
        chunksRef.current = [];
        proc.onaudioprocess = (ev) => {
          chunksRef.current.push(new Float32Array(ev.inputBuffer.getChannelData(0)));
        };
        src.connect(proc);
        proc.connect(ctx.destination); // needed for ScriptProcessor to fire
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          const msg = JSON.parse(event.data);
          if (msg.type === "stt_final" && msg.text) setCaptionUser(msg.text);
          if (msg.type === "llm_reply" && msg.text) {
            setCaptionGlow(msg.text);
            setPhase("speaking");
          }
          if (msg.type === "stt_error" || msg.type === "error") {
            setError(String(msg.message ?? "Voice error"));
            setPhase("recording");
          }
        } else {
          // Binary = TTS audio (WAV). Play it, then allow next turn.
          const blob = new Blob([event.data], { type: "audio/wav" });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => {
            URL.revokeObjectURL(url);
            setPhase("recording");
          };
          audio.play().catch(() => setPhase("recording"));
        }
      };

      ws.onerror = () => {
        setError(t("chat.error"));
        setPhase("idle");
      };
      ws.onclose = () => {
        if (phase !== "idle") setPhase("idle");
      };
    } catch (err) {
      console.error(err);
      setError(t("voice.error"));
      setPhase("idle");
    }
  }, [phase]);

  const stopListening = useCallback(() => {
    cleanupRecording();
    setPhase("thinking");

    // Assemble recorded PCM into one WAV and send.
    const ctx = audioCtxRef.current;
    const total = chunksRef.current.reduce((n, c) => n + c.length, 0);
    if (total > 0 && socketRef.current?.readyState === WebSocket.OPEN) {
      const merged = new Float32Array(total);
      let off = 0;
      for (const c of chunksRef.current) {
        merged.set(c, off);
        off += c.length;
      }
      const wav = encodeWav(merged, 16000);
      socketRef.current.send(wav);
      socketRef.current.send(JSON.stringify({ type: "flush" }));
    } else {
      setPhase("idle");
    }
    chunksRef.current = [];
  }, [cleanupRecording]);

  const phaseLabel: Record<Phase, string> = {
    idle: t("voice.start"),
    connecting: t("voice.connecting"),
    recording: t("voice.recording"),
    thinking: t("voice.thinking"),
    speaking: t("voice.speaking"),
  };

  return (
    <main className="flex-1 flex flex-col items-center max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col items-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center font-display">
          Voice presence
        </h1>
        <p className="mt-2 text-muted-foreground text-center">
          Talk naturally. Captions always on.
        </p>
      </div>

      {/* Breathing orb */}
      <div className="relative my-8 select-none">
        <div
          className={`aurora halo rounded-full transition-all duration-1000 ease-in-out ${
            phase === "recording"
              ? "size-40 opacity-100 animate-pulse"
              : phase === "thinking"
                ? "size-28 opacity-70"
                : phase === "speaking"
                  ? "size-36 opacity-90"
                  : "size-24 opacity-50"
          }`}
        />
      </div>

      <button
        onClick={phase === "recording" || phase === "speaking" || phase === "thinking" ? stopListening : startListening}
        disabled={phase === "connecting"}
        className={`aurora halo mb-6 flex size-20 items-center justify-center rounded-full text-primary-foreground transition-all hover:scale-105 active:scale-95 ${
          phase === "recording" ? "ring-4 ring-ring/60 animate-pulse" : ""
        }`}
        aria-label={phase === "recording" ? "Stop and send" : "Start speaking"}
      >
        {phase === "connecting" || phase === "thinking" ? (
          <Loader2 className="size-7 animate-spin" />
        ) : phase === "recording" || phase === "speaking" ? (
          <Square className="size-6" />
        ) : (
          <Mic className="size-7" />
        )}
      </button>

      <p className="text-sm text-muted-foreground flex items-center gap-2 mb-8">
        {phase === "speaking" && <Volume2 className="size-4" />}
        {phaseLabel[phase]}
      </p>

      {(captionUser || captionGlow) && (
        <div className="w-full space-y-4">
          {captionUser && (
            <div className="glass rounded-2xl px-5 py-3.5 self-end max-w-[85%] ml-auto w-fit text-sm text-foreground/80">
              {captionUser}
            </div>
          )}
          {captionGlow && (
            <div className="glass rounded-2xl px-5 py-3.5 max-w-[85%] w-fit text-sm leading-relaxed whitespace-pre-wrap">
              {captionGlow}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="glass border border-destructive/40 rounded-2xl px-5 py-4 text-sm mt-6">
          {error}
        </div>
      )}

      <p className="mt-auto pt-8 text-xs text-muted-foreground/70 text-center">
        {t("voice.disclaimer")}
      </p>
    </main>
  );
}
