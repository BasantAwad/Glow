"use client";

/**
 * Chat — real conversation with presence awareness.
 *
 * - Mode selection at start: "Just listen" | "Help me think" | "Guide me"
 * - Voice / text input toggle
 * - "Glow is typing…" appears while the reply streams in
 * - Silence check-in after 45s / 90s of quiet
 * - Crisis handling is server-side only — client displays server response
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2, AlertTriangle, Mic, MicOff, MessageSquare } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { SafetyNote } from "../../components/SafetyNote";
import {
  ensureSession,
  startGlowSession,
  sendMessage,
  getApiErrorMessage,
} from "../../lib/glow-api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type SessionMode = "listen_only" | "guided" | "open";
type InputMode = "text" | "voice";

const MODE_OPTIONS: { mode: SessionMode; label: string; desc: string; emoji: string }[] = [
  {
    mode: "listen_only",
    label: "Just listen",
    desc: "I need to get something off my chest",
    emoji: "🌱",
  },
  {
    mode: "open",
    label: "Be here with me",
    desc: "I want to talk and see where it goes",
    emoji: "💬",
  },
  {
    mode: "guided",
    label: "Help me think",
    desc: "I'd like some gentle guidance",
    emoji: "🧭",
  },
];

const CHECK_INS = ["chat.checkin1", "chat.checkin2", "chat.checkin3"];

function ModeSelection({ onSelect }: { onSelect: (mode: SessionMode) => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <span className="aurora halo mb-6 flex size-16 items-center justify-center rounded-full">
        <Sparkles className="size-6 text-primary-foreground" />
      </span>
      <h2 className="font-display text-2xl font-semibold text-center mb-2">
        How can I be here for you?
      </h2>
      <p className="text-muted-foreground text-sm text-center mb-8 max-w-xs">
        There&apos;s no wrong answer. You can change this anytime.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {MODE_OPTIONS.map((opt, i) => (
          <button
            key={opt.mode}
            onClick={() => onSelect(opt.mode)}
            className="glass group flex items-center gap-4 rounded-2xl px-6 py-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/10"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span className="text-2xl">{opt.emoji}</span>
            <div>
              <div className="font-medium text-foreground">{opt.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <p className="mt-8 text-xs text-muted-foreground/60 text-center max-w-xs">
        Glow is an AI, not a therapist. If you&apos;re in immediate danger, please call emergency services or a crisis line.
      </p>
    </div>
  );
}

export default function ChatPage() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState<SessionMode | null>(null);
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, userTyping]);

  /* Silence check-in */
  const lastActivityRef = useRef<number>(0);
  const checkInCountRef = useRef(0);
  const checkInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (lastActivityRef.current === 0) lastActivityRef.current = Date.now();
  }, []);

  const noteActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    checkInCountRef.current = 0;
  }, []);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    checkInCountRef.current = 0;
  }, [messages]);

  useEffect(() => {
    if (!sessionMode) return; // Don't start check-ins before mode is chosen
    let cancelled = false;

    const arm = () => {
      if (cancelled) return;
      if (checkInTimerRef.current) clearTimeout(checkInTimerRef.current);
      if (checkInCountRef.current >= 2) return;
      const delay = checkInCountRef.current === 0 ? 45_000 : 90_000;
      checkInTimerRef.current = setTimeout(() => {
        if (busy || userTyping || Date.now() - lastActivityRef.current < delay / 2) {
          arm();
          return;
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `checkin-${Date.now()}`,
            role: "assistant",
            content: t(CHECK_INS[Math.min(checkInCountRef.current, CHECK_INS.length - 1)]),
          },
        ]);
        checkInCountRef.current += 1;
        arm();
      }, delay);
    };

    arm();
    return () => {
      cancelled = true;
      if (checkInTimerRef.current) clearTimeout(checkInTimerRef.current);
    };
  }, [busy, userTyping, messages, sessionMode, t]);

  /* Mode selection handler */
  const handleModeSelect = async (mode: SessionMode) => {
    setSessionMode(mode);
    setBusy(true);
    setError(null);

    try {
      await ensureSession();
      const s = await startGlowSession(mode);
      sessionIdRef.current = s.sessionId;

      const greeting =
        mode === "listen_only"
          ? "I'm here, and I'm listening. Take all the time you need — there's no rush. What's on your mind?"
          : mode === "guided"
          ? "I'm glad you're here. I'll ask a gentle question or two as we go — no pressure, just at your pace. What would you like to start with?"
          : "Hey, I'm glad you're here. What's been on your mind lately?";

      setMessages([{ id: "welcome", role: "assistant", content: greeting }]);
    } catch (err) {
      setError(getApiErrorMessage(err, "Couldn't start the session. Please try again."));
      setSessionMode(null); // Go back to mode selection
    } finally {
      setBusy(false);
    }
  };

  /* Voice recording */
  const startRecording = async () => {
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        // For now, show a message that voice transcription is processing
        // Full STT integration requires the backend voice endpoint
        setInput("[Voice message recorded — transcription coming soon]");
        setIsRecording(false);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setVoiceError("Microphone access denied. Please allow microphone access and try again.");
      setInputMode("text");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  /* Send message */
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy || !sessionIdRef.current) return;

    setInput("");
    setUserTyping(false);
    setError(null);
    setBusy(true);
    noteActivity();

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: text }]);

    try {
      // Crisis detection and all safety checks happen server-side.
      // The server returns either a normal reply or a crisis response_override.
      const reply = await sendMessage(sessionIdRef.current, text);
      await new Promise((r) => setTimeout(r, 350)); // Minimum typing indicator
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: reply },
      ]);
      lastActivityRef.current = Date.now();
      noteActivity();
    } catch (err) {
      const msg = getApiErrorMessage(err, "Glow couldn't respond just now.");
      setError(
        `${msg} If this is urgent, please contact your local emergency services or a crisis line.`
      );
    } finally {
      setBusy(false);
    }
  };

  /* Show mode selection before session starts */
  if (!sessionMode) {
    return (
      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 h-[calc(100vh-160px)]">
        <SafetyNote />
        {busy ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Starting your session…</span>
          </div>
        ) : (
          <ModeSelection onSelect={handleModeSelect} />
        )}
        {error && (
          <div className="flex items-start gap-3 glass border border-destructive/40 rounded-2xl px-5 py-4 text-sm mt-4">
            <AlertTriangle className="size-4 mt-0.5 shrink-0 text-destructive" />
            <span>{error}</span>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 h-[calc(100vh-160px)]">
      {/* Header */}
      <div className="flex flex-col items-center mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <span className="aurora halo mb-3 flex size-12 items-center justify-center rounded-full">
          <Sparkles className="size-4 text-primary-foreground" />
        </span>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-center font-display">
          {sessionMode === "listen_only" ? "I'm listening" : sessionMode === "guided" ? "Let's think together" : "Talk it through"}
        </h1>
        <p className="text-xs text-muted-foreground/60 mt-1">
          {sessionMode === "listen_only" ? "🌱 Just listening mode" : sessionMode === "guided" ? "🧭 Guided mode" : "💬 Open conversation"}
        </p>
      </div>

      <SafetyNote />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mt-4 mb-4 pr-2 space-y-4 scroll-smooth">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3 text-sm sm:text-base leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-none shadow-md"
                  : "glass rounded-bl-none text-foreground/90"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Glow typing indicator */}
        {busy && (
          <div className="flex animate-in fade-in duration-200">
            <div className="glass rounded-2xl rounded-bl-none px-5 py-4 flex items-center gap-1.5">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="size-2 rounded-full bg-muted-foreground/70 animate-bounce"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* User typing indicator */}
        {userTyping && !busy && (
          <div className="flex justify-end pr-1">
            <span className="text-[11px] text-muted-foreground/70 italic">you&apos;re typing…</span>
          </div>
        )}

        {/* Voice error */}
        {voiceError && (
          <div className="flex items-start gap-3 glass border border-amber-500/40 rounded-2xl px-5 py-4 text-sm animate-in fade-in duration-300">
            <AlertTriangle className="size-4 mt-0.5 shrink-0 text-amber-500" />
            <span>{voiceError}</span>
          </div>
        )}

        {/* General error */}
        {error && (
          <div className="flex items-start gap-3 glass border border-destructive/40 rounded-2xl px-5 py-4 text-sm animate-in fade-in duration-300">
            <AlertTriangle className="size-4 mt-0.5 shrink-0 text-destructive" />
            <span>{error}</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input area */}
      <div className="mt-auto space-y-2">
        {/* Voice/Text toggle */}
        <div className="flex justify-center gap-2">
          <button
            onClick={() => { setInputMode("text"); setIsRecording(false); setVoiceError(null); }}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all ${
              inputMode === "text"
                ? "aurora text-primary-foreground"
                : "glass-soft text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare className="size-3" />
            Text
          </button>
          <button
            onClick={() => setInputMode("voice")}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all ${
              inputMode === "voice"
                ? "aurora text-primary-foreground"
                : "glass-soft text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mic className="size-3" />
            Voice
          </button>
        </div>

        {inputMode === "text" ? (
          <form onSubmit={handleSend} className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setUserTyping(e.target.value.length > 0);
                if (e.target.value.length === 0) lastActivityRef.current = Date.now();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e as unknown as React.FormEvent);
                }
              }}
              placeholder={t("chat.placeholder")}
              disabled={busy}
              className="w-full glass rounded-full pl-6 pr-14 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!input.trim() || busy}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 aurora halo flex size-9 items-center justify-center rounded-full text-primary-foreground transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              aria-label="Send message"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-center gap-4">
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={busy}
                className="aurora halo flex size-14 items-center justify-center rounded-full text-primary-foreground transition-transform hover:scale-105 disabled:opacity-50"
                aria-label="Start recording"
              >
                <Mic className="size-6" />
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex size-14 items-center justify-center rounded-full bg-destructive/80 text-white transition-transform hover:scale-105 animate-pulse"
                aria-label="Stop recording"
              >
                <MicOff className="size-6" />
              </button>
            )}
            {isRecording && (
              <span className="text-sm text-muted-foreground animate-pulse">Recording… tap to stop</span>
            )}
            {input && !isRecording && (
              <button
                onClick={(e) => handleSend(e as unknown as React.FormEvent)}
                disabled={busy}
                className="aurora halo flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-primary-foreground"
              >
                <Send className="size-4" />
                Send
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
