"use client";

import { useState, useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { Play, Pause, RotateCcw, SkipForward, Check } from "lucide-react";

type Mode = "rain" | "white-noise" | "forest";

type ExerciseType = "box-breathing" | "body-scan" | "journaling" | "soundscape";
type ExerciseState = "idle" | "running" | "paused" | "done";

interface Exercise {
  id: ExerciseType;
  titleKey: string;
  descKey: string;
  icon: string;
  color: string;
}

const exercises: Exercise[] = [
  {
    id: "box-breathing",
    titleKey: "practice.boxBreathing",
    descKey: "practice.boxBreathingDesc",
    icon: "🌬️",
    color: "from-cyan-500/20 to-blue-500/10",
  },
  {
    id: "body-scan",
    titleKey: "practice.bodyScan",
    descKey: "practice.bodyScanDesc",
    icon: "🧘",
    color: "from-purple-500/20 to-pink-500/10",
  },
  {
    id: "journaling",
    titleKey: "practice.journaling",
    descKey: "practice.journalingDesc",
    icon: "✍️",
    color: "from-amber-500/20 to-orange-500/10",
  },
  {
    id: "soundscape",
    titleKey: "practice.soundscape",
    descKey: "practice.soundscapeDesc",
    icon: "🎵",
    color: "from-emerald-500/20 to-teal-500/10",
  },
];

function BoxBreathingExercise({ t }: { t: (key: string) => string }) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<ExerciseState>("idle");
  const [cycles, setCycles] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(1);

  const totalSteps = 4; // inhale, hold, exhale, hold
  const totalCycles = 4;

  const stepNames = [
    () => t("practice.breatheIn"),
    () => t("practice.breatheHold"),
    () => t("practice.breatheOut"),
    () => t("practice.breatheHold"),
  ];

  const stepDurations = [4, 4, 4, 4]; // seconds

  useEffect(() => {
    if (state !== "running") return;

    const duration = stepDurations[step] * 1000;
    const timer = setTimeout(() => {
      if (step < totalSteps - 1) {
        setStep(step + 1);
      } else {
        // Completed one cycle
        if (currentCycle >= totalCycles) {
          setState("done");
        } else {
          setCurrentCycle(currentCycle + 1);
          setStep(0);
        }
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [step, state, currentCycle]);

  const start = () => {
    setStep(0);
    setCurrentCycle(1);
    setState("running");
  };

  const pause = () => setState("paused");
  const resume = () => setState("running");
  const reset = () => {
    setStep(0);
    setCurrentCycle(1);
    setState("idle");
  };

  const skip = () => {
    setStep(0);
    setCurrentCycle(1);
    setState("done");
  };

  const progress = ((currentCycle - 1) / totalCycles) * 100 + (step / totalSteps) * (100 / totalCycles);

  if (state === "done") {
    return (
      <div className="glass rounded-3xl p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col items-center justify-center">
        <div className="aurora w-16 h-16 rounded-full flex items-center justify-center mb-4">
          <Check className="size-8 text-primary-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">{t("practice.done")}</h3>
        <p className="text-sm text-muted-foreground mb-6">
          {currentCycle} cycles completed. Notice how your body feels.
        </p>
        <div className="flex gap-3">
          <button onClick={reset} className="glass-soft rounded-full px-6 py-3 text-sm font-medium hover:bg-white/10 transition-colors">
            <RotateCcw className="size-4 inline mr-2" />
            {t("practice.repeat")}
          </button>
          <button onClick={() => window.location.reload()} className="glass-soft rounded-full px-6 py-3 text-sm font-medium hover:bg-white/10 transition-colors">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass rounded-3xl p-6 sm:p-8 text-center h-full flex flex-col ${state === "running" ? "animate-in fade-in slide-in-from-bottom-4 duration-500" : ""}`}>
      {/* Progress bar */}
      <div className="w-full bg-white/5 rounded-full h-1.5 mb-6 overflow-hidden">
        <div
          className="h-full rounded-full aurora transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step indicator */}
      <div className="text-sm text-muted-foreground mb-2">
        {t("practice.step").replace("{n}", String(currentCycle)).replace("{total}", String(totalCycles))}
      </div>

      {/* Main step content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className={`text-3xl sm:text-4xl font-display font-semibold mb-4 transition-all duration-300 ${
          step === 0 ? "text-cyan-400" : step === 1 ? "text-purple-400" : step === 2 ? "text-amber-400" : "text-purple-400"
        }`}>
          {stepNames[step]()}
        </div>

        {/* Visual circle that pulses with breathing */}
        <div className="relative mb-6">
          <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center transition-all duration-1000 ${
            step === 0 ? "bg-cyan-400/20 scale-110" : step === 1 ? "bg-purple-400/20 scale-105" : step === 2 ? "bg-amber-400/20 scale-95" : "bg-purple-400/20 scale-105"
          }`}>
            <div className="text-4xl sm:text-5xl">{step === 0 ? "🌬️" : step === 1 ? "⏸️" : step === 2 ? "💨" : "⏸️"}</div>
          </div>
          {/* Decorative rings */}
          <div className="absolute inset-0 rounded-full border border-white/5 animate-pulse" style={{ animationDuration: "4s" }} />
        </div>

        <div className="text-xs text-muted-foreground mb-6">
          Cycle {currentCycle} of {totalCycles}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mt-4">
        {state === "idle" && (
          <button onClick={start} className="aurora flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium shadow-lg hover:scale-[1.02] transition-transform">
            <Play className="size-4" />
            {t("practice.start")}
          </button>
        )}
        {state === "running" && (
          <button onClick={pause} className="glass-soft flex items-center gap-2 rounded-full px-5 py-3 text-sm hover:bg-white/10 transition-colors">
            <Pause className="size-4" />
            {t("practice.pause")}
          </button>
        )}
        {state === "paused" && (
          <button onClick={resume} className="glass-soft flex items-center gap-2 rounded-full px-5 py-3 text-sm hover:bg-white/10 transition-colors">
            <Play className="size-4" />
            {t("practice.resume")}
          </button>
        )}
        <button onClick={reset} className="glass-soft flex items-center gap-2 rounded-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <RotateCcw className="size-4" />
        </button>
        <button onClick={skip} className="glass-soft flex items-center gap-2 rounded-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <SkipForward className="size-4" />
          {t("practice.skip")}
        </button>
      </div>
    </div>
  );
}

function BodyScanExercise({ t }: { t: (key: string) => string }) {
  const [step, setStep] = useState<number>(0);
  const [state, setState] = useState<ExerciseState>("idle");

  const bodyParts = [
    { name: "Feet", desc: "Notice your toes, heels, the soles of your feet." },
    { name: "Legs", desc: "Move your attention up to your calves and knees." },
    { name: "Hips", desc: "Notice any tension in your hips and pelvis." },
    { name: "Belly", desc: "Feel your stomach rise and fall with each breath." },
    { name: "Chest", desc: "Notice your chest expanding and contracting." },
    { name: "Hands", desc: "Feel your fingers, palms, and wrists." },
    { name: "Shoulders", desc: "Are your shoulders tense? Let them drop slightly." },
    { name: "Face", desc: "Notice your jaw, eyes, forehead. Soften them." },
    { name: "Whole body", desc: "Feel your entire body as one. Breathe into it." },
  ];

  useEffect(() => {
    if (state !== "running") return;
    const timer = setTimeout(() => {
      if (step < bodyParts.length - 1) {
        setStep(step + 1);
      } else {
        setState("done");
      }
    }, 8000); // 8 seconds per body part
    return () => clearTimeout(timer);
  }, [step, state]);

  if (state === "done") {
    return (
      <div className="glass rounded-3xl p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col items-center justify-center">
        <div className="aurora w-16 h-16 rounded-full flex items-center justify-center mb-4">
          <Check className="size-8 text-primary-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">{t("practice.done")}</h3>
        <p className="text-sm text-muted-foreground mb-6">
          You scanned your whole body. Notice any areas that feel different now.
        </p>
        <button onClick={() => window.location.reload()} className="glass-soft rounded-full px-6 py-3 text-sm font-medium hover:bg-white/10 transition-colors">
          Done
        </button>
      </div>
    );
  }

  const bodyPart = bodyParts[step];

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 text-center h-full flex flex-col">
      {/* Progress */}
      <div className="flex justify-center gap-1.5 mb-4">
        {bodyParts.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i < step ? "bg-primary/60" : i === step ? "bg-primary animate-pulse" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      <div className="text-sm text-muted-foreground mb-1">
        Step {step + 1} of {bodyParts.length}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-2xl sm:text-3xl font-display font-semibold text-foreground mb-3">
          {bodyPart.name}
        </div>
        <div className="text-sm text-muted-foreground/80 max-w-md">
          {bodyPart.desc}
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Notice any sensations — tension, warmth, numbness, nothing at all. Whatever you notice is okay.
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 mt-4">
        {state === "idle" && (
          <button onClick={() => setState("running")} className="aurora flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium shadow-lg hover:scale-[1.02] transition-transform">
            <Play className="size-4" />
            {t("practice.start")}
          </button>
        )}
        {state === "running" && (
          <button onClick={() => setState("paused")} className="glass-soft flex items-center gap-2 rounded-full px-5 py-3 text-sm hover:bg-white/10 transition-colors">
            <Pause className="size-4" />
            {t("practice.pause")}
          </button>
        )}
        {state === "paused" && (
          <button onClick={() => setState("running")} className="glass-soft flex items-center gap-2 rounded-full px-5 py-3 text-sm hover:bg-white/10 transition-colors">
            <Play className="size-4" />
            {t("practice.resume")}
          </button>
        )}
        <button onClick={() => { setStep(0); setState("idle"); }} className="glass-soft flex items-center gap-2 rounded-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <RotateCcw className="size-4" />
        </button>
        <button onClick={() => { setStep(0); setState("done"); }} className="glass-soft flex items-center gap-2 rounded-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <SkipForward className="size-4" />
          {t("practice.skip")}
        </button>
      </div>
    </div>
  );
}

function JournalingExercise({ t }: { t: (key: string) => string }) {
  const [state, setState] = useState<ExerciseState>("idle");
  const [currentPrompt, setCurrentPrompt] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [writing, setWriting] = useState("");

  const promptList = [
    "What's the heaviest thing on your mind right now?",
    "What's something you wish someone would say to you?",
    "If you could change one thing about today, what would it be?",
    "What's a small thing that felt okay today?",
  ];

  useEffect(() => {
    if (state === "running" && currentPrompt < promptList.length) {
      const timer = setTimeout(() => {
        setAnswers((prev: string[]) => [...prev, writing]);
        setWriting("");
        if (currentPrompt + 1 < promptList.length) {
          setCurrentPrompt(currentPrompt + 1);
        } else {
          setState("done");
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentPrompt, writing, state]);

  if (state === "done") {
    const fullText = answers.join("\n\n") + (writing ? "\n\n" + writing : "");
    return (
      <div className="glass rounded-3xl p-6 sm:p-8 text-center h-full flex flex-col">
        <div className="aurora w-16 h-16 rounded-full flex items-center justify-center mb-4 mx-auto">
          <Check className="size-8 text-primary-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">{t("practice.done")}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          You wrote {answers.length} reflections. Here's what you shared:
        </p>
        <div className="glass rounded-2xl p-4 mb-6 text-left text-sm text-foreground/80 whitespace-pre-wrap max-w-lg mx-auto">
          {fullText}
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => navigator.clipboard.writeText(fullText).then(() => alert("Copied!"))}
            className="glass-soft rounded-full px-5 py-3 text-sm hover:bg-white/10 transition-colors"
          >
            Copy
          </button>
          <button
            onClick={() => {
              const blob = new Blob([fullText], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `journaling-${new Date().toISOString().slice(0, 10)}.txt`;
              a.click();
            }}
            className="glass-soft rounded-full px-5 py-3 text-sm hover:bg-white/10 transition-colors"
          >
            Download
          </button>
          <button onClick={() => window.location.reload()} className="glass-soft rounded-full px-5 py-3 text-sm hover:bg-white/10 transition-colors">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 text-center h-full flex flex-col">
      <div className="text-sm text-muted-foreground mb-1">
        Prompt {currentPrompt + 1} of {promptList.length}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-base sm:text-lg font-semibold text-foreground mb-6 max-w-md">
          {promptList[currentPrompt]}
        </div>

        <textarea
          value={writing}
          onChange={(e) => setWriting(e.target.value)}
          placeholder="Write whatever comes to mind..."
          className="w-full max-w-lg glass rounded-2xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring transition-all"
          rows={4}
          disabled={state !== "running"}
        />

        <div className="mt-2 text-xs text-muted-foreground/50">
          {writing.length} characters
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 mt-4">
        {state === "idle" && (
          <button onClick={() => { setCurrentPrompt(0); setAnswers([]); setWriting(""); setState("running"); }} className="aurora flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium shadow-lg hover:scale-[1.02] transition-transform">
            <Play className="size-4" />
            {t("practice.start")}
          </button>
        )}
        {state === "running" && (
          <button onClick={() => setState("paused")} className="glass-soft flex items-center gap-2 rounded-full px-5 py-3 text-sm hover:bg-white/10 transition-colors">
            <Pause className="size-4" />
            {t("practice.pause")}
          </button>
        )}
        {state === "paused" && (
          <button onClick={() => setState("running")} className="glass-soft flex items-center gap-2 rounded-full px-5 py-3 text-sm hover:bg-white/10 transition-colors">
            <Play className="size-4" />
            {t("practice.resume")}
          </button>
        )}
        <button onClick={() => { setCurrentPrompt(0); setAnswers([]); setWriting(""); setState("idle"); }} className="glass-soft flex items-center gap-2 rounded-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <RotateCcw className="size-4" />
        </button>
      </div>
    </div>
  );
}

function SoundscapeExercise({ t }: { t: (key: string) => string }) {
  const [state, setState] = useState<ExerciseState>("idle");
  const [mode, setMode] = useState<Mode>("rain");

  // Visual representation of soundscape
  useEffect(() => {
    if (state === "running") {
      const handleKey = (e: KeyboardEvent) => {
        if (e.key === "1") setMode("rain");
        if (e.key === "2") setMode("white-noise");
        if (e.key === "3") setMode("forest");
      };
      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    }
  }, [state]);

  if (state === "done") {
    return (
      <div className="glass rounded-3xl p-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col items-center justify-center">
        <div className="aurora w-16 h-16 rounded-full flex items-center justify-center mb-4">
          <Check className="size-8 text-primary-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">{t("practice.done")}</h3>
        <p className="text-sm text-muted-foreground">
          Take a moment to notice how you feel after this soundscape.
        </p>
        <button onClick={() => window.location.reload()} className="glass-soft rounded-full px-6 py-3 text-sm font-medium hover:bg-white/10 transition-colors mt-6">
          Done
        </button>
      </div>
    );
  }

  const modeLabels = {
    rain: "🌧️ Gentle Rain",
    "white-noise": "🤍 White Noise",
    forest: "🌲 Forest",
  };

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 text-center h-full flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-5xl sm:text-6xl mb-6 animate-pulse">
          {mode === "rain" ? "🌧️" : mode === "white-noise" ? "🤍" : "🌲"}
        </div>

        <div className="text-xl font-semibold mb-2">
          {modeLabels[mode as keyof typeof modeLabels]}
        </div>

        <div className="text-sm text-muted-foreground mb-6 max-w-sm">
          {mode === "rain" && "Soft rain falling — steady, soothing, like the world is washing clean."}
          {mode === "white-noise" && "A smooth hum that covers the edges of everything else."}
          {mode === "forest" && "Leaves rustling, birds distant, earth breathing."}
        </div>

        <div className="flex gap-2 mb-6">
          {(["rain", "white-noise", "forest"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-full px-4 py-2 text-sm transition-all ${
                mode === m
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-white/5 text-muted-foreground hover:text-foreground"
              }`}
            >
              {modeLabels[m].replace(/ [.]/g, "")}
            </button>
          ))}
        </div>

        <div className="text-xs text-muted-foreground/50">
          Press 1, 2, or 3 to switch while playing
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 mt-4">
        {state === "idle" && (
          <button onClick={() => setState("running")} className="aurora flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium shadow-lg hover:scale-[1.02] transition-transform">
            <Play className="size-4" />
            {t("practice.start")}
          </button>
        )}
        {state === "running" && (
          <button onClick={() => setState("paused")} className="glass-soft flex items-center gap-2 rounded-full px-5 py-3 text-sm hover:bg-white/10 transition-colors">
            <Pause className="size-4" />
            {t("practice.pause")}
          </button>
        )}
        {state === "paused" && (
          <button onClick={() => setState("running")} className="glass-soft flex items-center gap-2 rounded-full px-5 py-3 text-sm hover:bg-white/10 transition-colors">
            <Play className="size-4" />
            {t("practice.resume")}
          </button>
        )}
        {state === "running" || state === "paused" ? (
          <button onClick={() => setState("done")} className="glass-soft flex items-center gap-2 rounded-full px-5 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <SkipForward className="size-4" />
            {t("practice.skip")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function PracticesPage() {
  const { t } = useLanguage();
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  return (
    <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 h-[calc(100vh-160px)]">
      <div className="flex flex-col items-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center">
          {t("practices.title")}
        </h1>
        <p className="mt-3 text-muted-foreground text-center text-lg max-w-lg">
          {t("practices.subtitle")}
        </p>
      </div>

      {selectedExercise ? (
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <button
              onClick={() => setSelectedExercise(null)}
              className="glass-soft flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
            <span className="text-sm text-muted-foreground/70">
              {selectedExercise.icon} {t(selectedExercise.titleKey)}
            </span>
          </div>
          <div className="h-[calc(100%-80px)]">
            {selectedExercise.id === "box-breathing" && <BoxBreathingExercise t={t} />}
            {selectedExercise.id === "body-scan" && <BodyScanExercise t={t} />}
            {selectedExercise.id === "journaling" && <JournalingExercise t={t} />}
            {selectedExercise.id === "soundscape" && <SoundscapeExercise t={t} />}
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
          {exercises.map((ex, i) => (
            <div
              key={ex.id}
              onClick={() => setSelectedExercise(ex)}
              className={`glass p-6 rounded-3xl flex items-start gap-4 transition-all hover:scale-[1.01] cursor-pointer group border border-transparent hover:border-white/10`}
            >
              <div className={`aurora bg-gradient-to-br ${ex.color} flex size-12 shrink-0 items-center justify-center rounded-full mt-1`}>
                <span className="text-xl">{ex.icon}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground/90 group-hover:text-foreground transition-colors">
                  {t(ex.titleKey)}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 group-hover:text-muted-foreground/80 transition-colors">
                  {t(ex.descKey)}
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
