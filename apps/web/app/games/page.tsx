"use client";

/**
 * Games — lightweight focus & mindfulness mini-games.
 *
 * Each game is a self-contained React component with its own state machine.
 * No backend required — scores are kept in-session only (no PII).
 *
 * Games included:
 *  - Breathing Pacer: follow the expanding/contracting circle.
 *  - Mood Match: pair emotion words with their faces (memory-style).
 *  - Focus Tap: tap in rhythm — a simple tempo-following exercise.
 *  - Gratitude Garden: plant a seed for each thing you're grateful for.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Check,
  Flower2,
  Heart,
  Brain,
  Wind,
  Loader2,
} from "lucide-react";

/* ---------------------------------------------------------------------------
 * Shared types
 * --------------------------------------------------------------------------- */

type GameId = "breathing" | "moodmatch" | "focustap" | "gratitudes";

interface GameDef {
  id: GameId;
  titleKey: string;
  descKey: string;
  icon: React.ElementType;
  color: string;
}

const games: GameDef[] = [
  {
    id: "breathing",
    titleKey: "games.breathing.title",
    descKey: "games.breathing.desc",
    icon: Wind,
    color: "from-cyan-500/20 to-blue-500/10",
  },
  {
    id: "moodmatch",
    titleKey: "games.moodmatch.title",
    descKey: "games.moodmatch.desc",
    icon: Heart,
    color: "from-purple-500/20 to-pink-500/10",
  },
  {
    id: "focustap",
    titleKey: "games.focustap.title",
    descKey: "games.focustap.desc",
    icon: Brain,
    color: "from-amber-500/20 to-orange-500/10",
  },
  {
    id: "gratitudes",
    titleKey: "games.gratitudes.title",
    descKey: "games.gratitudes.desc",
    icon: Flower2,
    color: "from-emerald-500/20 to-teal-500/10",
  },
];

/* ---------------------------------------------------------------------------
 * 1. Breathing Pacer
 * --------------------------------------------------------------------------- */

function BreathingPacer({ t }: { t: (key: string) => string }) {
  const [phase, setPhase] = useState<"idle" | "inhale" | "hold" | "exhale" | "done">("idle");
  const [cycle, setCycle] = useState(0);
  const MAX_CYCLES = 4;

  const start = () => {
    setCycle(0);
    setPhase("inhale");
  };

  useEffect(() => {
    if (phase === "done") return;
    let timer: ReturnType<typeof setTimeout>;
    if (phase === "inhale") {
      timer = setTimeout(() => setPhase("hold"), 4000);
    } else if (phase === "hold") {
      timer = setTimeout(() => setPhase("exhale"), 4000);
    } else if (phase === "exhale") {
      timer = setTimeout(() => {
        if (cycle + 1 >= MAX_CYCLES) {
          setPhase("done");
        } else {
          setCycle((c) => c + 1);
          setPhase("inhale");
        }
      }, 6000);
    }
    return () => clearTimeout(timer);
  }, [phase, cycle]);

  const reset = () => {
    setPhase("idle");
    setCycle(0);
  };

  const getLabel = () => {
    if (phase === "idle") return "";
    if (phase === "inhale") return t("games.breathing.inhale");
    if (phase === "hold") return t("games.breathing.hold");
    if (phase === "exhale") return t("games.breathing.exhale");
    if (phase === "done") return t("games.breathing.done");
    return "";
  };

  const sizeClass = phase === "inhale" ? "scale-125" : phase === "exhale" ? "scale-90" : "scale-100";

  return (
    <div className="glass rounded-3xl p-8 sm:p-10 text-center h-full flex flex-col items-center justify-center">
      {phase === "done" ? (
        <>
          <div className="aurora halo rounded-full w-20 h-20 flex items-center justify-center mb-4">
            <Check className="size-8 text-primary-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">{t("games.breathing.complete")}</h3>
          <p className="text-sm text-muted-foreground mb-6">{cycle} full breaths completed.</p>
          <button onClick={reset} className="glass-soft rounded-full px-6 py-3 text-sm">
            {t("games.breathing.again")}
          </button>
        </>
      ) : (
        <>
          <div className={`aurora halo rounded-full transition-all duration-1000 ease-in-out ${sizeClass}`}>
            <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/10 flex items-center justify-center">
              <span className="text-4xl sm:text-5xl">{phase === "inhale" ? "🌬️" : phase === "exhale" ? "💨" : "⏸️"}</span>
            </div>
          </div>
          <p className="mt-8 text-sm text-muted-foreground h-5">{getLabel()}</p>
          <p className="text-xs text-muted-foreground/60">
            Cycle {cycle + 1} of {MAX_CYCLES}
          </p>
          <div className="mt-8 flex gap-3">
            {phase === "idle" && (
              <button onClick={start} className="aurora halo rounded-full px-8 py-3.5 text-sm font-medium text-primary-foreground flex items-center gap-2">
                <Play className="size-4" /> {t("games.start")}
              </button>
            )}
            {(phase === "inhale" || phase === "hold" || phase === "exhale") && (
              <button onClick={reset} className="glass-soft rounded-full px-6 py-3 text-sm">
                <SkipForward className="size-4 inline mr-1" /> {t("games.skip")}
              </button>
            )}
          </div>
        </>
      )}
      <p className="mt-6 text-[11px] text-muted-foreground/60">
        {t("games.breathing.hint")}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 2. Mood Match (memory pairing game)
 * --------------------------------------------------------------------------- */

function MoodMatch({ t }: { t: (key: string) => string }) {
  const MOODS = [
    { emoji: "😞", label: "low" },
    { emoji: "😐", label: "okay" },
    { emoji: "🙂", label: "good" },
    { emoji: "😊", label: "happy" },
    { emoji: "😄", label: "great" },
    { emoji: "🤩", label: "amazing" },
  ];

  const [cards, setCards] = useState<{ id: number; emoji: string; label: string; flipped: boolean; matched: boolean }[]>([]);
  const [turn, setTurn] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [matched, setMatched] = useState(0);
  const [started, setStarted] = useState(false);

  const init = () => {
    const deck = [...MOODS, ...MOODS]
      .sort(() => Math.random() - 0.5)
      .map((m, i) => ({ id: i, emoji: m.emoji, label: m.label, flipped: false, matched: false }));
    setCards(deck);
    setTurn(0);
    setSelected(null);
    setLocked(false);
    setMatched(0);
    setStarted(true);
  };

  const flip = (idx: number) => {
    if (locked || selected === idx || cards[idx].flipped || cards[idx].matched) return;
    const updated = cards.map((c, i) => (i === idx ? { ...c, flipped: true } : c));
    setCards(updated);
    if (selected === null) {
      setSelected(idx);
    } else {
      const first = cards[selected];
      const second = cards[idx];
      if (first.label === second.label && first.id !== second.id) {
        // Match
        setLocked(true);
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) => (i === selected || i === idx ? { ...c, matched: true } : c))
          );
          setMatched((m) => m + 1);
          setTurn((t) => t + 1);
          setSelected(null);
          setLocked(false);
        }, 600);
      } else {
        // No match — flip back
        setLocked(true);
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) => (i === selected || i === idx ? { ...c, flipped: false } : c))
          );
          setTurn((t) => t + 1);
          setSelected(null);
          setLocked(false);
        }, 900);
      }
    }
  };

  if (!started) {
    return (
      <div className="glass rounded-3xl p-8 sm:p-10 text-center h-full flex flex-col items-center justify-center">
        <div className="aurora halo rounded-full w-16 h-16 flex items-center justify-center mb-4">
          <Heart className="size-7 text-primary-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">{t("games.moodmatch.title")}</h3>
        <p className="text-sm text-muted-foreground max-w-xs mb-6">{t("games.moodmatch.desc")}</p>
        <button onClick={init} className="aurora halo rounded-full px-8 py-3.5 text-sm font-medium text-primary-foreground flex items-center gap-2">
          <Play className="size-4" /> {t("games.start")}
        </button>
      </div>
    );
  }

  const allMatched = matched === MOODS.length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-muted-foreground">{t("games.moodmatch.turns")}: {turn}</p>
          <p className="text-xs text-muted-foreground">{t("games.moodmatch.matched")}: {matched}/{MOODS.length}</p>
        </div>
        {allMatched && (
          <div className="aurora halo rounded-full px-4 py-1.5 text-xs font-medium text-primary-foreground">
            {t("games.moodmatch.win")}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3 flex-1">
        {cards.map((card) => (
          <button
            key={card.id}
            onClick={() => flip(card.id)}
            disabled={card.matched || locked || card.flipped}
            className={`aspect-square rounded-2xl flex items-center justify-center text-3xl transition-all ${
              card.matched
                ? "bg-green-500/10 border border-green-500/30"
                : card.flipped
                ? "bg-primary/20 border border-primary/40"
                : "bg-white/5 border border-white/10 hover:bg-white/10"
            } ${locked ? "opacity-70" : ""}`}
          >
            {card.flipped || card.matched ? (
              <span title={card.label}>{card.emoji}</span>
            ) : (
              <span className="text-2xl opacity-30">?</span>
            )}
          </button>
        ))}
      </div>
      {allMatched && (
        <button
          onClick={init}
          className="mt-4 glass-soft rounded-full px-6 py-3 text-sm"
        >
          {t("games.playAgain")}
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 3. Focus Tap (rhythm game)
 * --------------------------------------------------------------------------- */

function FocusTap({ t }: { t: (key: string) => string }) {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<"idle" | "waiting" | "tap" | "miss" | "done">("idle");
  const [score, setScore] = useState(0);
  const [beat, setBeat] = useState(0);
  const [tempo, setTempo] = useState(600);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const BPM = 60;
  const interval = 60000 / BPM;

  const start = () => {
    setScore(0);
    setBeat(0);
    setRunning(true);
    setPhase("waiting");
    nextBeat();
  };

  const nextBeat = useCallback(() => {
    if (!running) return;
    setPhase("waiting");
    timeoutRef.current = setTimeout(() => {
      if (!running) return;
      setPhase("tap");
      // Auto-miss if user doesn't tap within 500ms
      timeoutRef.current = setTimeout(() => {
        if (running && phase === "tap") {
          setPhase("miss");
          setTimeout(() => {
            if (!running) return;
            setBeat((b) => b + 1);
            if (beat + 1 >= 10) {
              setRunning(false);
              setPhase("done");
            } else {
              setPhase("waiting");
              nextBeat();
            }
          }, 500);
        }
      }, interval - 500);
    }, 0);
  }, [running, phase, beat, interval]);

  const tap = () => {
    if (phase === "tap") {
      setScore((s) => s + 1);
      setPhase("idle");
      clearTimeout(timeoutRef.current!);
      setBeat((b) => {
        const next = b + 1;
        if (next >= 10) {
          setRunning(false);
          setPhase("done");
        } else {
          setPhase("waiting");
          nextBeat();
        }
        return next;
      });
    }
  };

  const stop = () => {
    setRunning(false);
    clearTimeout(timeoutRef.current ?? undefined);
    setPhase("idle");
  };

  useEffect(() => () => { clearTimeout(timeoutRef.current ?? undefined); }, []);

  if (phase === "done") {
    return (
      <div className="glass rounded-3xl p-8 sm:p-10 text-center h-full flex flex-col items-center justify-center">
        <div className="aurora halo rounded-full w-20 h-20 flex items-center justify-center mb-4">
          <Check className="size-8 text-primary-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">{t("games.focustap.done")}</h3>
        <p className="text-4xl font-display font-semibold mb-2">{score}/{beat + 1}</p>
        <p className="text-sm text-muted-foreground mb-6">{t("games.focustap.score")}</p>
        <button onClick={start} className="aurora halo rounded-full px-8 py-3.5 text-sm font-medium text-primary-foreground flex items-center gap-2">
          <Play className="size-4" /> {t("games.playAgain")}
        </button>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-8 sm:p-10 text-center h-full flex flex-col items-center justify-center">
      <div
        className={`aurora halo rounded-full transition-all duration-200 ${
          phase === "tap" ? "size-24 bg-green-400/30" :
          phase === "waiting" ? "size-20 bg-primary/20" :
          phase === "miss" ? "size-28 bg-red-400/20" :
          "size-16"
        }`}
      >
        {phase === "tap" && <span className="text-2xl">👆</span>}
        {phase === "miss" && <span className="text-2xl">💔</span>}
        {phase === "waiting" && <span className="text-xl animate-pulse">●</span>}
      </div>
      <p className="mt-6 text-sm text-muted-foreground h-5">
        {phase === "idle" && t("games.focustap.start")}
        {phase === "waiting" && t("games.focustap.wait")}
        {phase === "tap" && t("games.focustap.tap")}
        {phase === "miss" && t("games.focustap.miss")}
      </p>
      <p className="text-xs text-muted-foreground mt-2">
        {t("games.focustap.score")}: {score}
      </p>
      <div className="mt-6 flex gap-3">
        {phase === "idle" && (
          <button onClick={start} className="aurora halo rounded-full px-8 py-3.5 text-sm font-medium text-primary-foreground flex items-center gap-2">
            <Play className="size-4" /> {t("games.start")}
          </button>
        )}
        {(phase === "waiting" || phase === "tap" || phase === "miss") && (
          <button onClick={stop} className="glass-soft rounded-full px-6 py-3 text-sm">
            {t("games.stop")}
          </button>
        )}
        {phase === "tap" && (
          <button
            onClick={tap}
            className="aurora halo rounded-full w-16 h-16 flex items-center justify-center text-primary-foreground text-2xl transition-transform active:scale-90"
          >
            👆
          </button>
        )}
      </div>
      <p className="mt-6 text-[11px] text-muted-foreground/60">
        {t("games.focustap.hint")}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 4. Gratitude Garden
 * --------------------------------------------------------------------------- */

interface Plant {
  id: number;
  text: string;
  emoji: string;
  plantedAt: number;
}

const PLANT_EMOJIS = ["🌱", "🌿", "🌸", "🌻", "🌺", "🌷", "🌹", "🌼", "🍀", "🌿"];

function GratitudeGarden({ t }: { t: (key: string) => string }) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [draft, setDraft] = useState("");
  const [plantedCount, setPlantedCount] = useState(0);

  const plant = () => {
    const text = draft.trim();
    if (!text || plants.length >= 12) return;
    const newPlant: Plant = {
      id: plantedCount,
      text,
      emoji: PLANT_EMOJIS[plants.length % PLANT_EMOJIS.length],
      plantedAt: Date.now(),
    };
    setPlants((prev) => [...prev, newPlant]);
    setPlantedCount((c) => c + 1);
    setDraft("");
  };

  const remove = (id: number) => {
    setPlants((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="glass rounded-3xl p-6 mb-4">
        <p className="text-sm font-medium mb-3">{t("games.gratitudes.prompt")}</p>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && plant()}
            placeholder={t("games.gratitudes.placeholder")}
            className="flex-1 glass-soft rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            maxLength={200}
          />
          <button
            onClick={plant}
            disabled={!draft.trim() || plants.length >= 12}
            className="aurora halo rounded-full px-5 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50 flex items-center gap-2"
          >
            <Flower2 className="size-3.5" /> {t("games.gratitudes.plant")}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {plants.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            {t("games.gratitudes.empty")}
          </p>
        ) : (
          plants.map((p) => (
            <div
              key={p.id}
              className="glass rounded-2xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <span className="text-2xl">{p.emoji}</span>
              <span className="text-sm flex-1 text-foreground/90">{p.text}</span>
              <button
                onClick={() => remove(p.id)}
                className="text-muted-foreground/50 hover:text-destructive transition-colors text-lg leading-none"
                aria-label={t("games.gratitudes.remove")}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {plants.length > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground/60 text-center">
          {plants.length} {t("games.gratitudes.plants")} · {t("games.gratitudes.water")}
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Page
 * --------------------------------------------------------------------------- */

export default function GamesPage() {
  const { t } = useLanguage();
  const [active, setActive] = useState<GameId | null>(null);

  return (
    <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 h-[calc(100vh-160px)]">
      <div className="flex flex-col items-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center font-display">
          {t("games.title")}
        </h1>
        <p className="mt-3 text-muted-foreground text-center text-lg max-w-lg">
          {t("games.subtitle")}
        </p>
      </div>

      {active ? (
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <button
              onClick={() => setActive(null)}
              className="glass-soft flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← {t("games.back")}
            </button>
            <span className="text-sm text-muted-foreground/70">
              {(() => {
                const g = games.find((gg) => gg.id === active);
                if (!g) return null;
                const Icon = g.icon;
                return (
                  <span className="inline-flex items-center gap-1">
                    <Icon className="size-4" />
                    {t(g.titleKey)}
                  </span>
                );
              })()}
            </span>
          </div>
          <div className="h-[calc(100%-80px)]">
            {active === "breathing" && <BreathingPacer t={t} />}
            {active === "moodmatch" && <MoodMatch t={t} />}
            {active === "focustap" && <FocusTap t={t} />}
            {active === "gratitudes" && <GratitudeGarden t={t} />}
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-5 relative z-10">
          {games.map((g) => (
            <div
              key={g.id}
              onClick={() => setActive(g.id)}
              className="glass p-6 rounded-3xl flex items-start gap-4 transition-all hover:scale-[1.01] cursor-pointer group border border-transparent hover:border-white/10"
            >
              <div
                className={`aurora bg-gradient-to-br ${g.color} flex size-12 shrink-0 items-center justify-center rounded-full mt-1`}
              >
                <g.icon className="size-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground/90 group-hover:text-foreground transition-colors">
                  {t(g.titleKey)}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 group-hover:text-muted-foreground/80 transition-colors">
                  {t(g.descKey)}
                </p>
              </div>
              <Play className="size-5 text-muted-foreground/30 group-hover:text-primary-foreground group-hover:scale-110 transition-all ml-auto mt-1" />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
