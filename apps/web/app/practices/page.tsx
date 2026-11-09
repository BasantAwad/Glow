"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { Play, Pause, RotateCcw, SkipForward, Check, Wind, Heart, Sparkles, Volume2, ArrowLeft } from "lucide-react";

type SoundMode = "rain" | "white-noise" | "forest" | "waves";
type ExerciseType =
  | "belly-breathing"
  | "box-breathing"
  | "4-7-8"
  | "extended-exhale"
  | "grounding-54321"
  | "body-scan"
  | "gentle-movement"
  | "soundscape";

type ExerciseState = "idle" | "running" | "paused" | "done";

interface Exercise {
  id: ExerciseType;
  title: string;
  duration: string;
  desc: string;
  bestFor: string;
  icon: string;
  color: string;
}

const EXERCISES: Exercise[] = [
  {
    id: "belly-breathing",
    title: "Easy Belly Breathing",
    duration: "2 min",
    desc: "A gentle expanding and contracting circle to slow your autonomic nervous system.",
    bestFor: "First-time users & general everyday stress",
    icon: "🌊",
    color: "from-sky-500/20 to-teal-500/10",
  },
  {
    id: "box-breathing",
    title: "Box Breathing",
    duration: "3 min",
    desc: "Equal 4-count rhythm (inhale, hold, exhale, hold) used by athletes and responders.",
    bestFor: "Focus, acute overwhelm & pre-sleep racing thoughts",
    icon: "⏹️",
    color: "from-cyan-500/20 to-blue-500/10",
  },
  {
    id: "4-7-8",
    title: "4-7-8 Calming Sequence",
    duration: "2 min",
    desc: "A deep 4-count inhale, tranquil 7-count pause, and long 8-count audible release.",
    bestFor: "Winding down, deep insomnia & physical panic",
    icon: "🌙",
    color: "from-indigo-500/20 to-purple-500/10",
  },
  {
    id: "extended-exhale",
    title: "Extended Exhale",
    duration: "2 min",
    desc: "Inhale for 4, exhale for 6, easing into 4-8. Stimulates the vagal calming reflex.",
    bestFor: "Physical anxiety, chest tightness & racing heart",
    icon: "🌬️",
    color: "from-amber-500/20 to-orange-500/10",
  },
  {
    id: "grounding-54321",
    title: "5-4-3-2-1 Sensory Grounding",
    duration: "4 min",
    desc: "Combines slow deep breaths with noticing 5 sights, 4 sensations, 3 sounds, 2 scents, 1 taste.",
    bestFor: "Dissociation, panic & spiraling thoughts",
    icon: "🌿",
    color: "from-emerald-500/20 to-green-500/10",
  },
  {
    id: "body-scan",
    title: "Gentle Body Scan",
    duration: "3 min",
    desc: "Travel mindfully from toes to crown, releasing tension held silently in muscles.",
    bestFor: "Physical tension, end-of-day decompression",
    icon: "🧘",
    color: "from-purple-500/20 to-pink-500/10",
  },
  {
    id: "gentle-movement",
    title: "Gentle Movement",
    duration: "5 min · optional",
    desc: "A slow, choice-led sequence of easy seated or standing movements. Skip or rest whenever you like.",
    bestFor: "A gentle movement break",
    icon: "🌱",
    color: "from-lime-500/20 to-emerald-500/10",
  },
  {
    id: "soundscape",
    title: "Nature Soundscapes",
    duration: "Open",
    desc: "Immersive synthesized nature audio (rain, ocean waves, white noise, mountain wind).",
    bestFor: "Background comfort while resting or working",
    icon: "🎵",
    color: "from-teal-500/20 to-emerald-500/10",
  },
];

/* ---------------------------------------------------------------------------
 * 1. Universal Paced Breathing Component
 * --------------------------------------------------------------------------- */

interface PacedBreathingProps {
  title: string;
  phases: { name: string; durationSec: number; visual: "inhale" | "hold" | "exhale"; color: string }[];
  totalCycles: number;
  bestFor: string;
}

function PacedBreathing({ title, phases, totalCycles, bestFor }: PacedBreathingProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [state, setState] = useState<ExerciseState>("idle");
  const [countdown, setCountdown] = useState(phases[0].durationSec);

  const currentPhase = phases[phaseIndex];

  useEffect(() => {
    if (state !== "running") return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Advance phase
          if (phaseIndex + 1 < phases.length) {
            setPhaseIndex((p) => p + 1);
            return phases[phaseIndex + 1].durationSec;
          } else {
            // End of cycle
            if (cycle >= totalCycles) {
              setState("done");
              return 0;
            } else {
              setCycle((c) => c + 1);
              setPhaseIndex(0);
              return phases[0].durationSec;
            }
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state, phaseIndex, cycle, phases, totalCycles]);

  const handleStart = () => {
    setCycle(1);
    setPhaseIndex(0);
    setCountdown(phases[0].durationSec);
    setState("running");
  };

  const handleReset = () => {
    setState("idle");
    setCycle(1);
    setPhaseIndex(0);
    setCountdown(phases[0].durationSec);
  };

  if (state === "done") {
    return (
      <div className="glass rounded-3xl p-8 text-center h-full flex flex-col items-center justify-center animate-in fade-in duration-500">
        <div className="aurora size-20 rounded-full flex items-center justify-center mb-6">
          <Check className="size-10 text-primary-foreground" />
        </div>
        <h3 className="font-display text-2xl font-semibold mb-2">Practice complete</h3>
        <p className="text-muted-foreground text-sm max-w-sm mb-6">
          You completed all {totalCycles} cycles of {title}. Notice the shift in your chest, shoulders, and breath.
        </p>
        <button
          onClick={handleReset}
          className="aurora halo rounded-full px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-105"
        >
          <RotateCcw className="size-4 inline mr-2" />
          Do another round
        </button>
      </div>
    );
  }

  const progressPercent = ((cycle - 1) * phases.length + phaseIndex) / (totalCycles * phases.length) * 100;

  // Scale of visual circle
  const circleScale =
    currentPhase.visual === "inhale"
      ? "scale-125 transition-transform duration-[4000ms] ease-out"
      : currentPhase.visual === "exhale"
      ? "scale-75 transition-transform duration-[6000ms] ease-in"
      : "scale-110 transition-transform duration-700 ease-in-out";

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 text-center h-full flex flex-col justify-between">
      {/* Top bar */}
      <div>
        <div className="w-full bg-white/5 rounded-full h-1.5 mb-4 overflow-hidden">
          <div className="h-full aurora transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Cycle {cycle} of {totalCycles}</span>
          <span className="opacity-70">{bestFor}</span>
        </div>
      </div>

      {/* Main visual display */}
      <div className="flex-1 flex flex-col items-center justify-center my-6">
        <div className="relative flex items-center justify-center">
          {/* Animated pulsing outer halo */}
          <div
            className={`absolute rounded-full border border-primary/20 size-48 sm:size-60 transition-all ${
              state === "running" ? "animate-ping opacity-20" : "opacity-0"
            }`}
            style={{ animationDuration: "3s" }}
          />

          {/* Central breathing circle */}
          <div
            className={`aurora halo size-36 sm:size-48 rounded-full flex flex-col items-center justify-center text-primary-foreground shadow-2xl ${circleScale}`}
          >
            <span className="text-3xl sm:text-4xl font-display font-semibold">{countdown}</span>
            <span className="text-xs uppercase tracking-widest mt-1 opacity-90">{currentPhase.name}</span>
          </div>
        </div>

        <h3 className="font-display text-2xl font-semibold mt-8 mb-1">{currentPhase.name}</h3>
        <p className="text-sm text-muted-foreground/80 max-w-xs">
          {currentPhase.visual === "inhale"
            ? "Expand gently into your belly and ribs without forcing."
            : currentPhase.visual === "hold"
            ? "Rest gently at the top. Keep your jaw and shoulders soft."
            : "Let the breath pour out like warm water. Soften completely."}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        {state === "idle" && (
          <button
            onClick={handleStart}
            className="aurora halo flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-105"
          >
            <Play className="size-4" />
            Begin practice
          </button>
        )}
        {state === "running" && (
          <button
            onClick={() => setState("paused")}
            className="glass-soft flex items-center gap-2 rounded-full px-6 py-3 text-sm transition-colors hover:text-foreground"
          >
            <Pause className="size-4" />
            Pause
          </button>
        )}
        {state === "paused" && (
          <button
            onClick={() => setState("running")}
            className="aurora flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-105"
          >
            <Play className="size-4" />
            Resume
          </button>
        )}
        {state !== "idle" && (
          <button
            onClick={handleReset}
            className="glass-soft flex items-center gap-2 rounded-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="size-4" />
          </button>
        )}
        {state === "running" && (
          <button
            onClick={() => setState("done")}
            className="glass-soft flex items-center gap-2 rounded-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipForward className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 2. 5-4-3-2-1 Grounding Sensory Exercise
 * --------------------------------------------------------------------------- */

function Grounding54321() {
  const steps = [
    { count: 5, prompt: "Acknowledge 5 things you can SEE around you", hint: "A shadow, a texture, a color, light on a wall, an everyday object", icon: "👀" },
    { count: 4, prompt: "Acknowledge 4 things you can physically FEEL", hint: "Feet on the floor, clothing against skin, warmth of your hands, texture of chair", icon: "✋" },
    { count: 3, prompt: "Acknowledge 3 distinct things you can HEAR", hint: "A fan hum, distant cars, your own steady breath, wind outside", icon: "👂" },
    { count: 2, prompt: "Acknowledge 2 things you can SMELL right now", hint: "Clean air, soap, coffee, clothing, or take in a deep neutral breath", icon: "👃" },
    { count: 1, prompt: "Acknowledge 1 thing you can TASTE or one KIND word", hint: "A lingering flavor, water, or whisper to yourself: 'I am safe right now'", icon: "🤍" },
  ];

  const [stepIdx, setStepIdx] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [done, setDone] = useState(false);

  const current = steps[stepIdx];

  const advance = () => {
    setCompleted((prev) => [...prev, stepIdx]);
    if (stepIdx + 1 < steps.length) {
      setStepIdx((i) => i + 1);
    } else {
      setDone(true);
    }
  };

  const reset = () => {
    setStepIdx(0);
    setCompleted([]);
    setDone(false);
  };

  if (done) {
    return (
      <div className="glass rounded-3xl p-8 text-center h-full flex flex-col items-center justify-center animate-in fade-in duration-500">
        <div className="aurora size-20 rounded-full flex items-center justify-center mb-6">
          <Check className="size-10 text-primary-foreground" />
        </div>
        <h3 className="font-display text-2xl font-semibold mb-2">You are anchored here</h3>
        <p className="text-muted-foreground text-sm max-w-sm mb-6">
          Your mind has returned to the physical room. Take one easy breath into your lower belly. You are here and you are safe.
        </p>
        <button
          onClick={reset}
          className="aurora halo rounded-full px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          <RotateCcw className="size-4 inline mr-2" />
          Practice again
        </button>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 text-center h-full flex flex-col justify-between">
      {/* Step dots */}
      <div className="flex justify-center gap-2 mb-4">
        {steps.map((s, idx) => (
          <div
            key={s.count}
            className={`size-2.5 rounded-full transition-all ${
              completed.includes(idx)
                ? "bg-primary"
                : idx === stepIdx
                ? "bg-primary animate-pulse scale-125"
                : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* Main card */}
      <div className="flex-1 flex flex-col items-center justify-center my-4">
        <span className="text-5xl mb-4">{current.icon}</span>
        <span className="aurora px-3 py-1 rounded-full text-xs font-semibold text-primary-foreground mb-3">
          Step {stepIdx + 1} of 5
        </span>
        <h3 className="font-display text-2xl sm:text-3xl font-semibold max-w-md mb-3 leading-snug">
          {current.prompt}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
          {current.hint}
        </p>
        <div className="glass-soft rounded-2xl px-5 py-3 text-xs text-muted-foreground/80 max-w-xs">
          Take your time. Look around the room slowly before tapping continue.
        </div>
      </div>

      {/* Action */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={advance}
          className="aurora halo flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-105"
        >
          <Check className="size-4" />
          I noticed these, continue
        </button>
        {stepIdx > 0 && (
          <button onClick={reset} className="glass-soft rounded-full px-4 py-3 text-xs text-muted-foreground hover:text-foreground">
            <RotateCcw className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 3. Body Scan Exercise
 * --------------------------------------------------------------------------- */

function BodyScanExercise() {
  const bodyParts = [
    { name: "Feet & Soles", desc: "Notice your toes, heels, and the contact with the floor. Release any curled tension." },
    { name: "Calves & Knees", desc: "Notice your lower legs. Let any heaviness sink down toward the earth." },
    { name: "Hips & Pelvis", desc: "Allow your seat to sink deeply into your chair or bed. Release holding in your hips." },
    { name: "Belly & Low Back", desc: "Feel your abdomen gently swell with each inhale. Let your low back soften." },
    { name: "Chest & Shoulders", desc: "Notice your heart beating. Let your shoulders drop half an inch away from your ears." },
    { name: "Hands & Wrists", desc: "Uncurl your fingers. Let warmth pool gently in the palms of your hands." },
    { name: "Jaw, Eyes & Brow", desc: "Unclench your back teeth. Let your tongue rest behind your lower teeth. Smooth your forehead." },
    { name: "Whole Body Resting", desc: "Breathe into your entire physical vessel as one calm, connected presence." },
  ];

  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!running || done) return;
    const timer = setTimeout(() => {
      if (step + 1 < bodyParts.length) {
        setStep((s) => s + 1);
      } else {
        setDone(true);
        setRunning(false);
      }
    }, 7000);
    return () => clearTimeout(timer);
  }, [running, step, done, bodyParts.length]);

  if (done) {
    return (
      <div className="glass rounded-3xl p-8 text-center h-full flex flex-col items-center justify-center">
        <div className="aurora size-20 rounded-full flex items-center justify-center mb-6">
          <Check className="size-10 text-primary-foreground" />
        </div>
        <h3 className="font-display text-2xl font-semibold mb-2">Body scan complete</h3>
        <p className="text-muted-foreground text-sm max-w-sm mb-6">
          Every muscle group has been offered permission to let go. Notice if your breath feels a little lower in your torso.
        </p>
        <button
          onClick={() => { setStep(0); setDone(false); setRunning(false); }}
          className="aurora halo rounded-full px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          <RotateCcw className="size-4 inline mr-2" />
          Repeat scan
        </button>
      </div>
    );
  }

  const part = bodyParts[step];

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 text-center h-full flex flex-col justify-between">
      <div className="flex justify-center gap-1.5 mb-2">
        {bodyParts.map((_, i) => (
          <div
            key={i}
            className={`size-2 rounded-full transition-all ${
              i < step ? "bg-primary" : i === step ? "bg-primary animate-pulse scale-125" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center my-6">
        <span className="text-xs text-muted-foreground mb-2">Area {step + 1} of {bodyParts.length}</span>
        <h3 className="font-display text-3xl font-semibold mb-3 text-foreground">{part.name}</h3>
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">{part.desc}</p>
        <div className="aurora size-28 rounded-full flex items-center justify-center text-3xl opacity-80 animate-pulse">
          🧘
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        {!running ? (
          <button
            onClick={() => setRunning(true)}
            className="aurora halo flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-medium text-primary-foreground"
          >
            <Play className="size-4" />
            Start body scan
          </button>
        ) : (
          <button
            onClick={() => setRunning(false)}
            className="glass-soft flex items-center gap-2 rounded-full px-6 py-3 text-sm"
          >
            <Pause className="size-4" />
            Pause
          </button>
        )}
        <button
          onClick={() => {
            if (step + 1 < bodyParts.length) setStep((s) => s + 1);
            else setDone(true);
          }}
          className="glass-soft rounded-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
        >
          <SkipForward className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 4. Ambient Web Audio Soundscape
 * --------------------------------------------------------------------------- */

function SoundscapeExercise() {
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<SoundMode>("rain");
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const startAudio = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      // Create pink/brown noise node for rain / waves
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise filter for deep calming sound
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5;
      }

      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = buffer;
      noiseNode.loop = true;

      // Filter depending on mode
      const filter = ctx.createBiquadFilter();
      if (mode === "rain") {
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(800, ctx.currentTime);
      } else if (mode === "waves") {
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(400, ctx.currentTime);
      } else if (mode === "forest") {
        filter.type = "bandpass";
        filter.frequency.setValueAtTime(1200, ctx.currentTime);
      } else {
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1500, ctx.currentTime);
      }

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNodeRef.current = gain;

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noiseNode.start();
      setPlaying(true);
    } catch {
      // AudioContext not allowed without interaction
    }
  }, [mode]);

  const stopAudio = useCallback(() => {
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  const modes: { id: SoundMode; label: string; icon: string; desc: string }[] = [
    { id: "rain", label: "Gentle Rain", icon: "🌧️", desc: "Soft steady raindrops pattering outside your window." },
    { id: "waves", label: "Ocean Tide", icon: "🌊", desc: "Long rhythmic ocean swells breaking upon a smooth sand shore." },
    { id: "forest", label: "Mountain Pines", icon: "🌲", desc: "Gentle breeze swaying through high branches and whispering needle leaves." },
    { id: "white-noise", label: "Warm Hum", icon: "🤍", desc: "A smooth neutral static hum that washes away harsh background noises." },
  ];

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 text-center h-full flex flex-col justify-between">
      <div>
        <h3 className="font-display text-2xl font-semibold mb-1">Ambient Nature Soundscapes</h3>
        <p className="text-xs text-muted-foreground">Synthesized in real-time in your browser without external tracking</p>
      </div>

      <div className="grid grid-cols-2 gap-3 my-4">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => {
              setMode(m.id);
              if (playing) {
                stopAudio();
              }
            }}
            className={`glass p-4 rounded-2xl text-left transition-all ${
              mode === m.id ? "border border-primary/40 bg-primary/10 scale-[1.02]" : "hover:bg-white/5 opacity-80"
            }`}
          >
            <span className="text-2xl block mb-2">{m.icon}</span>
            <div className="font-medium text-sm text-foreground">{m.label}</div>
            <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{m.desc}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3">
        {!playing ? (
          <button
            onClick={startAudio}
            className="aurora halo flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-105"
          >
            <Play className="size-4" />
            Play soundscape
          </button>
        ) : (
          <button
            onClick={stopAudio}
            className="glass-soft flex items-center gap-2 rounded-full px-6 py-3 text-sm text-destructive"
          >
            <Pause className="size-4" />
            Stop audio
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 5. Optional, beginner-friendly movement sequence
 * --------------------------------------------------------------------------- */

const MOVEMENT_STEPS = [
  {
    title: "Arrive and settle",
    guidance: "Sit or stand in a stable position. Let your shoulders rest and breathe naturally—there is no need to change your breath.",
    alternative: "Stay seated, or simply imagine settling into the chair.",
  },
  {
    title: "Small shoulder circles",
    guidance: "If comfortable, make a few small, slow shoulder circles. Keep the movement easy; you can also leave your shoulders still.",
    alternative: "Move one shoulder at a time, or skip this step.",
  },
  {
    title: "Easy side reach",
    guidance: "Rest one hand on your lap or a nearby support. Gently reach the other arm upward only as far as comfortable, then return to center.",
    alternative: "Keep both hands resting and picture a little more space along one side.",
  },
  {
    title: "Seated back movement",
    guidance: "With hands on your thighs, gently lengthen your spine, then soften back to neutral. Keep the range small and comfortable.",
    alternative: "Stay still and notice the support beneath you.",
  },
  {
    title: "Ankle and foot movement",
    guidance: "While seated or holding a stable support, slowly lift and lower your heels or move your feet in a comfortable way.",
    alternative: "Notice your feet resting on the floor without moving them.",
  },
  {
    title: "Pause and notice",
    guidance: "Let the movement stop. Notice the chair or floor supporting you, then finish whenever you feel ready.",
    alternative: "You can end the practice here or take another quiet moment.",
  },
];

function GentleMovementExercise() {
  const [stepIndex, setStepIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [timerRunning, setTimerRunning] = useState(false);
  const [done, setDone] = useState(false);
  const step = MOVEMENT_STEPS[stepIndex];

  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((seconds) => {
        if (seconds <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  const moveNext = () => {
    setTimerRunning(false);
    if (stepIndex + 1 === MOVEMENT_STEPS.length) {
      setDone(true);
      return;
    }
    setStepIndex((current) => current + 1);
    setSecondsLeft(30);
  };

  const reset = () => {
    setStepIndex(0);
    setSecondsLeft(30);
    setTimerRunning(false);
    setDone(false);
  };

  if (done) {
    return (
      <div className="glass rounded-3xl p-8 text-center h-full flex flex-col items-center justify-center">
        <div className="aurora size-20 rounded-full flex items-center justify-center mb-6">
          <Check className="size-10 text-primary-foreground" />
        </div>
        <h3 className="font-display text-2xl font-semibold mb-2">Movement practice finished</h3>
        <p className="text-muted-foreground text-sm max-w-sm mb-6">
          Thank you for taking a moment. You could do every step, a few steps, or none at all.
        </p>
        <button onClick={reset} className="aurora halo rounded-full px-6 py-3 text-sm font-medium text-primary-foreground">
          <RotateCcw className="size-4 inline mr-2" />
          Start again
        </button>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Optional movement · Step {stepIndex + 1} of {MOVEMENT_STEPS.length}</span>
        <span>{secondsLeft > 0 ? `${secondsLeft} sec guide` : "Timer complete"}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center my-5">
        <span className="text-5xl mb-4" aria-hidden="true">🌱</span>
        <h3 className="font-display text-2xl sm:text-3xl font-semibold mb-3">{step.title}</h3>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">{step.guidance}</p>
        <div className="glass-soft rounded-2xl p-4 mt-5 max-w-md text-left text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Seated or still option: </span>{step.alternative}
        </div>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 mb-5 text-xs leading-relaxed text-muted-foreground" role="note">
        Keep every movement optional and within a comfortable range. Skip or rest at any time; stop if you feel pain, dizziness, numbness, or uncomfortable breathing. This is general wellbeing guidance, not medical or injury advice.
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => setTimerRunning((running) => !running)}
          disabled={secondsLeft === 0}
          className="aurora halo flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {timerRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
          {timerRunning ? "Pause gentle timer" : secondsLeft === 0 ? "Timer finished" : "Start gentle timer"}
        </button>
        <button onClick={moveNext} className="glass-soft flex items-center gap-2 rounded-full px-5 py-3 text-sm">
          {stepIndex + 1 === MOVEMENT_STEPS.length ? "Finish" : "Next or skip"}
          <SkipForward className="size-4" />
        </button>
        <button onClick={reset} className="glass-soft rounded-full px-4 py-3 text-sm text-muted-foreground" aria-label="Reset movement practice">
          <RotateCcw className="size-4" />
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Main Practices Page
 * --------------------------------------------------------------------------- */

export default function PracticesPage() {
  const { t: _t } = useLanguage();
  const [selectedId, setSelectedId] = useState<ExerciseType | null>(null);

  const selectedExercise = EXERCISES.find((e) => e.id === selectedId);

  return (
    <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-140px)]">
      {/* Header */}
      {!selectedId ? (
        <div className="flex flex-col items-center mb-8 text-center animate-in fade-in duration-500">
          <span className="aurora halo mb-3 flex size-14 items-center justify-center rounded-full">
            <Wind className="size-6 text-primary-foreground" />
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            Practices & Grounding
          </h1>
          <p className="mt-2 text-muted-foreground text-sm sm:text-base max-w-md">
            Evidence-backed breathing, body awareness, and grounding techniques to regulate your nervous system.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setSelectedId(null)}
            className="glass-soft flex items-center gap-2 rounded-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to practices
          </button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{selectedExercise?.icon}</span>
            <span className="font-medium text-foreground">{selectedExercise?.title}</span>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1">
        {!selectedId ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {EXERCISES.map((ex) => (
              <div
                key={ex.id}
                onClick={() => setSelectedId(ex.id)}
                className="glass group p-6 rounded-3xl flex items-start gap-4 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 cursor-pointer"
              >
                <div className={`aurora bg-gradient-to-br ${ex.color} flex size-12 shrink-0 items-center justify-center rounded-2xl text-xl`}>
                  {ex.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                      {ex.title}
                    </h3>
                    <span className="text-[11px] font-medium text-muted-foreground bg-white/5 rounded-full px-2.5 py-0.5">
                      {ex.duration}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{ex.desc}</p>
                  <div className="mt-3 text-[11px] text-primary/80 flex items-center gap-1.5">
                    <Sparkles className="size-3" />
                    <span>{ex.bestFor}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-[560px]">
            {selectedId === "belly-breathing" && (
              <PacedBreathing
                title="Easy Belly Breathing"
                bestFor="General stress & nervous system balance"
                totalCycles={4}
                phases={[
                  { name: "Inhale gently", durationSec: 4, visual: "inhale", color: "text-cyan-400" },
                  { name: "Exhale softly", durationSec: 4, visual: "exhale", color: "text-teal-400" },
                ]}
              />
            )}
            {selectedId === "box-breathing" && (
              <PacedBreathing
                title="Box Breathing"
                bestFor="Focus, overwhelm & grounding"
                totalCycles={4}
                phases={[
                  { name: "Inhale", durationSec: 4, visual: "inhale", color: "text-cyan-400" },
                  { name: "Hold gently", durationSec: 4, visual: "hold", color: "text-blue-400" },
                  { name: "Exhale", durationSec: 4, visual: "exhale", color: "text-indigo-400" },
                  { name: "Hold gently", durationSec: 4, visual: "hold", color: "text-blue-400" },
                ]}
              />
            )}
            {selectedId === "4-7-8" && (
              <PacedBreathing
                title="4-7-8 Breathing"
                bestFor="Deep wind-down & soothing racing thoughts"
                totalCycles={4}
                phases={[
                  { name: "Inhale deep", durationSec: 4, visual: "inhale", color: "text-indigo-400" },
                  { name: "Hold tranquil", durationSec: 7, visual: "hold", color: "text-purple-400" },
                  { name: "Audible exhale", durationSec: 8, visual: "exhale", color: "text-pink-400" },
                ]}
              />
            )}
            {selectedId === "extended-exhale" && (
              <PacedBreathing
                title="Extended Exhale"
                bestFor="Physical tension & racing pulse"
                totalCycles={5}
                phases={[
                  { name: "Inhale", durationSec: 4, visual: "inhale", color: "text-amber-400" },
                  { name: "Slow long exhale", durationSec: 7, visual: "exhale", color: "text-orange-400" },
                ]}
              />
            )}
            {selectedId === "grounding-54321" && <Grounding54321 />}
            {selectedId === "body-scan" && <BodyScanExercise />}
            {selectedId === "gentle-movement" && <GentleMovementExercise />}
            {selectedId === "soundscape" && <SoundscapeExercise />}
          </div>
        )}
      </div>
    </main>
  );
}
