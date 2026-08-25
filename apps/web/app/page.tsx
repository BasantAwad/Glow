"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Send, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { SafetyNote } from "../components/SafetyNote";
import {
  ensureSession,
  startGlowSession,
  sendMessage,
} from "../lib/glow-api";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const CRISIS_PATTERN =
  /\b(suicide|suicidal|kill myself|end my life|hurt myself|self[- ]harm)\b/i;

export default function TalkPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi, I'm Glow. I'm an AI companion here to listen — not a human or a therapist. Share what's on your mind today.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const push = useCallback((msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    setError(null);
    setBusy(true);
    push({ id: `u-${Date.now()}`, role: "user", content: text });

    // Client-side crisis banner (deterministic safety lives server-side).
    if (CRISIS_PATTERN.test(text)) {
      push({
        id: `safety-${Date.now()}`,
        role: "assistant",
        content:
          "I hear you, and I'm taking what you said seriously. If you're in immediate danger, please contact your local emergency number or a crisis line right now — for example 988 in the US, or findahelpline.com for your country. I'm still here with you.",
      });
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
      push({ id: `a-${Date.now()}`, role: "assistant", content: reply });
    } catch (err) {
      console.error(err);
      setError(
        "Glow couldn't reach its support service just now. If this is urgent, please contact your local emergency services or crisis line.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 h-[calc(100vh-160px)]">
      <div className="flex flex-col items-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <span className="aurora halo mb-4 flex size-16 items-center justify-center rounded-full">
          <Sparkles className="size-6 text-primary-foreground" />
        </span>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center font-display">
          How are you feeling?
        </h1>
        <p className="mt-2 text-muted-foreground text-center">
          A calm space to think out loud.
        </p>
      </div>

      <SafetyNote />

      <div className="flex-1 overflow-y-auto mt-6 mb-4 pr-2 space-y-5 scroll-smooth">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            } animate-in fade-in slide-in-from-bottom-2 duration-300`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3.5 text-sm sm:text-base leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-none shadow-md"
                  : "glass rounded-bl-none text-foreground/90"
              }`}
            >
              {msg.content}
            </div>
            <span className="text-[11px] text-muted-foreground mt-1.5 px-1">
              {msg.role === "user" ? "You" : "Glow"}
            </span>
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-muted-foreground px-2 animate-in fade-in duration-300">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">Glow is listening…</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 glass border border-destructive/40 rounded-2xl px-5 py-4 text-sm text-destructive-foreground animate-in fade-in duration-300">
            <AlertTriangle className="size-4 mt-0.5 shrink-0 text-destructive" />
            <span>{error}</span>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      <div className="mt-auto">
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type what's on your mind…"
            disabled={busy}
            className="w-full glass rounded-full pl-6 pr-14 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all disabled:opacity-60"
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
      </div>
    </main>
  );
}
