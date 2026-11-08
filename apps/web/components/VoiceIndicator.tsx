"use client";

import { useEffect, useState } from "react";

const STATUS = ["idle", "listening", "speaking", "processing"] as const;
type VoiceStatusType = typeof STATUS[number];

export function VoiceIndicator({ state }: { state: { status: VoiceStatusType } }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (state.status !== "idle") {
      const timer = setTimeout(() => setDismissed(true), 4000);
      return () => {
        clearTimeout(timer);
        setDismissed(false);
      };
    }
  }, [state.status]);

  if (state.status === "idle" || dismissed) return null;

  const statusLabels: Record<VoiceStatusType, string> = {
    listening: "Listening...",
    speaking: "Speaking...",
    processing: "Thinking...",
    idle: "",
  };

  const statusColors: Record<VoiceStatusType, string> = {
    listening: "text-cyan-400",
    speaking: "text-amber-400",
    processing: "text-purple-400",
    idle: "",
  };

  return (
    <div className="fixed top-20 right-6 z-30 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="glass rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg">
        {/* Status icon */}
        <div className={`shrink-0 ${state.status === "listening" ? "pulse-dot" : ""} rounded-full ${state.status === "listening" ? "bg-cyan-400/20" : state.status === "speaking" ? "bg-amber-400/20" : "bg-purple-400/20"}`}>
          {state.status === "listening" && (
            <svg className="size-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
          {state.status === "speaking" && (
            <svg className="size-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
          {state.status === "processing" && (
            <svg className="size-4 text-purple-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          )}
        </div>

        {/* Label */}
        <span className={`text-sm font-medium ${statusColors[state.status]}`}>
          {statusLabels[state.status]}
        </span>

        {/* Waveform for speaking/listening */}
        {(state.status === "listening" || state.status === "speaking") && (
          <div className="waveform">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="waveform-bar" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
