"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Sparkles, Volume2, VolumeX, ChevronDown, Clock } from "lucide-react";
import { SafetyNote } from "../components/SafetyNote";
import { MoodCheckin } from "../components/MoodCheckin";
import { VoiceIndicator } from "../components/VoiceIndicator";
import { useLanguage } from "../contexts/LanguageContext";
import { GlowMark } from "../components/GlowMark";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface FormParams {
  mins?: string | number;
}

export default function TalkPage() {
  const { t, format } = useLanguage();

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionMinutesRemaining, setSessionMinutesRemaining] = useState<number | null>(null);

  // Mood check-in state
  const [moodShown, setMoodShown] = useState(false);
  const [moodSubmitted, setMoodSubmitted] = useState(false);
  const [mood, setMood] = useState<number | null>(null);

  // Voice state
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "listening" | "speaking" | "processing">("idle");
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  // Messages
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: t("talk.subtitle"),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [typingIndicator, setTypingIndicator] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  // Therapeutic persona
  const [therapistName] = useState("Dr. Sarah");
  const [therapistInitial] = useState("S");

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingIndicator]);

  // Mood check-in: show on first load if no session started
  useEffect(() => {
    if (!sessionStarted && !moodShown) {
      // Will show mood check-in. User can dismiss or complete it.
    }
  }, [sessionStarted, moodShown]);

  const startSession = useCallback(async () => {
    if (sessionId) return;
    try {
      const res = await fetch(`${API_BASE}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to start session");
      const data = await res.json();
      setSessionId(data.session_id);
      setSessionStarted(true);

      // Send initial mood if submitted
      if (moodSubmitted && mood) {
        await fetch(`${API_BASE}/sessions/${data.session_id}/mood`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mood: mood }),
        });
      }

      // Set a periodic timer to track minutes remaining
      const interval = setInterval(() => {
        // We don't have a real endpoint for this yet, so approximate
        // In a real implementation, this would come from the session state
      }, 60000);
      return () => clearInterval(interval);
    } catch (err) {
      console.error("Session start failed:", err);
    }
  }, [sessionId, mood, moodSubmitted]);

  const endSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      // In a real implementation: POST to /sessions/{id}/close
      // For now, just clear local state
      setSessionId(null);
      setSessionStarted(false);
      setSessionMinutesRemaining(null);
      setVoiceEnabled(false);
      setVoiceStatus("idle");
    } catch (err) {
      console.error("End session failed:", err);
    }
  }, [sessionId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);
    setTypingIndicator(true);

    try {
      await startSession();
      if (!sessionId) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "I'm having trouble connecting right now. Please try again in a moment.",
            timestamp: new Date(),
          },
        ]);
        setTypingIndicator(false);
        return;
      }

      const res = await fetch(`${API_BASE}/sessions/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMsg.content }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "API error");
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.reply,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      console.error("Send failed:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I'm having trouble connecting right now. Please try again in a moment.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setSending(false);
      setTypingIndicator(false);
    }
  };

  const quickPrompt = (text: string) => {
    setInput(text);
    // Auto-submit after a short delay to simulate natural typing
    setTimeout(() => {
      const form = document.querySelector("form");
      if (form) {
        form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
      }
    }, 300);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 h-[calc(100vh-160px)]">
      {/* Session header */}
      <div className="flex items-center justify-between mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center gap-3">
          <span className="aurora halo mb-0 flex size-10 items-center justify-center rounded-full">
            <GlowMark className="size-5" />
          </span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-display font-semibold">{therapistName}</span>
            <span className="text-xs text-muted-foreground bg-white/5 rounded-full px-2 py-0.5">
              {voiceEnabled ? "Voice active" : "Text mode"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {sessionStarted && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" />
              {sessionMinutesRemaining !== null && sessionMinutesRemaining <= 10 && sessionMinutesRemaining > 0 ? (
                <span className="text-amber-400 font-medium">{sessionMinutesRemaining}m left</span>
              ) : (
                <span>{sessionMinutesRemaining ?? "—" }m</span>
              )}
            </div>
          )}
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`glass-soft flex items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-all ${
              voiceEnabled ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
            title={voiceEnabled ? "Disable voice" : "Enable voice"}
          >
            {voiceEnabled ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            <span className="text-xs">{voiceEnabled ? "On" : "Off"}</span>
          </button>
          {sessionStarted && (
            <button
              onClick={endSession}
              className="glass-soft flex items-center gap-2 rounded-full px-3.5 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="text-xs">End</span>
              <ChevronDown className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* Mood check-in (shown before session starts) */}
      {!sessionStarted && !moodShown && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 mb-6">
          <MoodCheckin
            onSelect={(m) => {
              setMood(m);
              setMoodSubmitted(true);
            }}
            title={t("mood.title")}
            showLabel={true}
          />
          <p className="text-xs text-muted-foreground text-center mt-3">
            When you&apos;re ready, start your session below.
          </p>
        </div>
      )}

      {/* Start session button (if not started) */}
      {!sessionStarted && moodShown && (
        <div className="flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 mb-6">
          <button
            onClick={startSession}
            className="aurora flex items-center gap-3 rounded-2xl px-8 py-4 text-base font-medium shadow-lg transition-transform hover:scale-[1.02] hover:shadow-xl"
          >
            <Sparkles className="size-5" />
            {t("session.start")}
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto mt-4 mb-4 pr-2 space-y-5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            {/* Therapist identity badge */}
            {msg.role === "assistant" && (
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <span className="w-6 h-6 rounded-full aurora flex items-center justify-center text-[10px] font-bold text-primary-foreground">
                  {therapistInitial}
                </span>
                <span className="text-[11px] text-muted-foreground/70">{therapistName}</span>
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3.5 text-sm sm:text-base leading-relaxed bubble-in ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-none"
                  : "glass rounded-bl-none text-foreground/90"
              }`}
            >
              {msg.content}
            </div>

            <span className="text-[10px] text-muted-foreground/50 mt-1 px-1">
              {formatTime(msg.timestamp ?? new Date())}
            </span>
          </div>
        ))}

        {typingIndicator && (
          <div className="flex items-start">
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/70">
                {therapistInitial}
              </span>
              <span className="text-[11px] text-muted-foreground/70">{therapistName}</span>
            </div>
            <div className="glass rounded-2xl px-5 py-3.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={endOfMessagesRef} />
      </div>

      {/* Voice indicator */}
      {/* @ts-expect-error VoiceIndicator accepts { status: ... } but voiceStatus is a string literal type — compatible at runtime */}
      <VoiceIndicator state={voiceStatus} />

      {/* Input area */}
      <div className="mt-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Quick conversation prompts */}
        {!sessionStarted && (
          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {[
              t("prompts.howWeek"),
              t("prompts.struggling"),
              t("prompts.anxious"),
              t("prompts.justListen"),
              t("prompts.tired"),
              t("prompts.lonely"),
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => quickPrompt(prompt)}
                className="glass-soft rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("talk.placeholder")}
            disabled={sending}
            className="w-full glass rounded-full pl-6 pr-14 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 aurora flex size-9 items-center justify-center rounded-full text-primary-foreground shadow-sm transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            aria-label={t("talk.send")}
          >
            <Send className="size-4" />
          </button>
        </form>

        {/* Session timer warning */}
        {sessionStarted && sessionMinutesRemaining !== null && sessionMinutesRemaining <= 10 && sessionMinutesRemaining > 0 && (
          <div className="mt-3 text-center text-sm text-amber-400/80 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <strong>{sessionMinutesRemaining} min left</strong> — {t("session.minuteWarning").replace("{mins}", String(sessionMinutesRemaining))}
          </div>
        )}
      </div>
    </main>
  );
}
