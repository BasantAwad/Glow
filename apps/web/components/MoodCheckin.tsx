"use client";

import { useState } from "react";
import { Sun, Cloud, CloudRain, CloudMoon, Snowflake } from "lucide-react";

type Mood = 1 | 2 | 3 | 4 | 5;

interface MoodCheckinProps {
  onSelect: (mood: Mood) => void;
  title?: string;
  showLabel?: boolean;
}

const moods: { value: Mood; icon: typeof Sun; label: string }[] = [
  { value: 1, icon: CloudRain, label: "Very low" },
  { value: 2, icon: Cloud, label: "Low" },
  { value: 3, icon: Cloud, label: "Okay" },
  { value: 4, icon: Sun, label: "Good" },
  { value: 5, icon: Sun, label: "Great" },
];

export function MoodCheckin({
  onSelect,
  title = "How are you feeling right now?",
  showLabel = true,
}: MoodCheckinProps) {
  const [selected, setSelected] = useState<Mood | null>(null);

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 text-center max-w-md mx-auto">
      <h3 className="text-lg font-semibold text-foreground/90 mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Pick what feels closest — even if it&apos;s not exact.
      </p>

      <div className="flex justify-center gap-3 sm:gap-4">
        {moods.map((m) => (
          <button
            key={m.value}
            onClick={() => {
              setSelected(m.value);
              onSelect(m.value);
            }}
            className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 sm:p-4 transition-all ${
              selected === m.value
                ? "bg-primary/10 border border-primary/30 shadow-md"
                : "hover:bg-white/5 border border-transparent"
            }`}
          >
            <m.icon
              className={`size-6 sm:size-7 ${
                selected === m.value
                  ? "text-primary"
                  : "text-muted-foreground/70 group-hover:text-muted-foreground"
              }`}
            />
            {showLabel && (
              <span
                className={`text-xs sm:text-sm ${
                  selected === m.value
                    ? "text-primary font-medium"
                    : "text-muted-foreground/70"
                }`}
              >
                {m.label}
              </span>
            )}
          </button>
        ))}
      </div>

      {selected && (
        <p className="mt-4 text-sm text-foreground/60">
          You picked{" "}
          <span className="font-medium text-foreground/80">{moods[selected - 1].label.toLowerCase()}</span>
          {" — "}
          {selected <= 2
            ? "I&apos;m glad you&apos;re here. Want to talk about what&apos;s bringing it down?"
            : selected === 3
            ? "Okay is okay. Want to tell me a bit about today?"
            : "That&apos;s good to hear. Want to share what&apos;s helping?"}
        </p>
      )}
    </div>
  );
}
