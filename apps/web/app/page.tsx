"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { SafetyNote } from "../components/SafetyNote";
import { useLanguage } from "../contexts/LanguageContext";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function TalkPage() {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: t("talk.subtitle"), // "Share what's on your mind today."
    },
  ]);
  const [input, setInput] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Simulate AI response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "I'm listening. Tell me more about how you're feeling.",
        },
      ]);
    }, 1000);
  };

  return (
    <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 h-[calc(100vh-160px)]">
      <div className="flex flex-col items-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <span className="aurora halo mb-4 flex size-16 items-center justify-center rounded-full">
          <Sparkles className="size-6 text-primary-foreground" />
        </span>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center">
          {t("talk.title")}
        </h1>
        <p className="mt-2 text-muted-foreground text-center">
          {t("talk.subtitle")}
        </p>
      </div>

      <SafetyNote />

      <div className="flex-1 overflow-y-auto mt-6 mb-4 pr-2 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            } animate-in fade-in slide-in-from-bottom-2 duration-300`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-5 py-3.5 text-sm sm:text-base leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-none"
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
        <div ref={endOfMessagesRef} />
      </div>

      <div className="mt-auto">
        <form onSubmit={handleSend} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("talk.placeholder")}
            className="w-full glass rounded-full pl-6 pr-14 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 aurora flex size-9 items-center justify-center rounded-full text-primary-foreground shadow-sm transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
            aria-label={t("talk.send")}
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </main>
  );
}
