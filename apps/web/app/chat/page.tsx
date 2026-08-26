"use client";

/**
 * Chat — real conversation with presence awareness.
 *
 * - "Glow is typing…" appears while the reply streams in (honest latency cue).
 * - If YOU go quiet mid-conversation, Glow gently checks in after a pause
 *   (never pushy; at most once per quiet stretch).
 * - Your own typing state is reflected locally so the UI never feels dead.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { SafetyNote } from "../../components/SafetyNote";
import {
  ensureSession,
  startGlowSession,
  sendMessage,
} from "../../lib/glow-api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const CRISIS_PATTERN =
  /\b(suicide|suicidal|kill myself|end my life|hurt myself|self[- ]harm)\b/i;

const CHECK_INS = ["chat.checkin1", "chat.checkin2", "chat.checkin3"];

export default function ChatPage() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi, I&apos;m Glow. I&apos;m an AI companion here to listen — not a human or a therapist. What&apos;s been on your mind lately?",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false); // Glow composing → shows typing bubble
  const [userTyping, setUserTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy, userTyping]);

  /*
   * Silence check-in: if the user goes quiet mid-conversation, Glow gently
   * checks in after 45s (then once more at 90s). Runs entirely in an effect;
   * no refs touched during render.
   */
  const lastActivityRef = useRef<number>(0); // set on mount effect
  const checkInCountRef = useRef(0);
  const checkInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (lastActivityRef.current === 0) lastActivityRef.current = Date.now();
  }, []);

  const noteActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    checkInCountRef.current = 0;
  }, []);

  // Reset activity whenever messages change.
  useEffect(() => {
    lastActivityRef.current = Date.now();
    checkInCountRef.current = 0;
  }, [messages]);

  useEffect(() => {
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
            content:
              CHECK_INS[Math.min(checkInCountRef.current, CHECK_INS.length - 1)],
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
  }, [busy, userTyping, messages]);

const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    setUserTyping(false);
    setError(null);
    setBusy(true);
    noteActivity();

    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: text }]);

    if (CRISIS_PATTERN.test(text)) {
      setMessages((prev) => [
        ...prev,
        {
          id: `safety-${Date.now()}`,
          role: "assistant",
          content:
            "I hear you, and I&apos;m taking what you said seriously. If you&apos;re in immediate danger, please contact your local emergency number or a crisis line right now — for example 988 in the US, or findahelpline.com for your country. I&apos;m still here with you.",
        },
      ]);
      setBusy(false);
      return;
    }

    try {
      await ensureSession();
      if (!sessionIdRef.current) {
        const s = await startGlowSession();
        sessionIdRef.current = s.sessionId;
      }
      const reply = await sendMessage(sessionIdRef.current, text);
      // Small floor so the typing indicator is visible even on fast replies.
      await new Promise((r) => setTimeout(r, 350));
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: reply },
      ]);
      lastActivityRef.current = Date.now();
      noteActivity();
    } catch (err) {
      console.error(err);
      setError(
        "Glow couldn&apos;t reach its support service just now. If this is urgent, please contact your local emergency services or crisis line.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 h-[calc(100vh-160px)]">
      <div className="flex flex-col items-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <span className="aurora halo mb-3 flex size-14 items-center justify-center rounded-full">
          <Sparkles className="size-5 text-primary-foreground" />
        </span>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-center font-display">
          Talk it through
        </h1>
      </div>

      <SafetyNote />

      <div className="flex-1 overflow-y-auto mt-5 mb-4 pr-2 space-y-4 scroll-smooth">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            } animate-in fade-in slide-in-from-bottom-2 duration-300`}
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

        {/* Your typing indicator (subtle, right-aligned) */}
        {userTyping && !busy && (
          <div className="flex justify-end pr-1">
            <span className="text-[11px] text-muted-foreground/70 italic">
              you&apos;re typing…
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 glass border border-destructive/40 rounded-2xl px-5 py-4 text-sm animate-in fade-in duration-300">
            <AlertTriangle className="size-4 mt-0.5 shrink-0 text-destructive" />
            <span>{error}</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSend} className="relative mt-auto">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setUserTyping(e.target.value.length > 0);
            if (e.target.value.length === 0) lastActivityRef.current = Date.now();
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
    </main>
  );
}
