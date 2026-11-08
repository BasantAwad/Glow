"use client";

/**
 * Relaxation & Calming Mini-Games
 *
 * Designed exclusively for anxiety de-escalation, sensory grounding, and non-demanding focus.
 * No timers, no scores, no leaderboards, no failure states.
 *
 * Games:
 *  1. Color Glow: Interactive Canvas coloring with peaceful scenes
 *  2. Breathing Bubble: Inhale to inflate, release to float
 *  3. Sand Garden: Zen sand raking with pebbles
 *  4. Pattern Tracing: Mindful path tracing synced with breath
 *  5. Memory Garden: Plant a flower for each positive moment
 *  6. Rhythm Tap: 60 BPM gentle pulse
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  Palette,
  Wind,
  Sparkles,
  Flower2,
  Compass,
  Volume2,
  VolumeX,
  RotateCcw,
  Download,
  Check,
  ArrowLeft,
  Undo2,
} from "lucide-react";

type GameId = "color-glow" | "breathing-bubble" | "sand-garden" | "pattern-tracing" | "memory-garden" | "rhythm-tap";

interface GameDef {
  id: GameId;
  title: string;
  desc: string;
  icon: React.ElementType;
  color: string;
}

const GAME_DEFS: GameDef[] = [
  {
    id: "color-glow",
    title: "Color Glow",
    desc: "Color calming mandalas and night skies with soothing pastel palettes. No right or wrong.",
    icon: Palette,
    color: "from-pink-500/20 to-violet-500/10",
  },
  {
    id: "breathing-bubble",
    title: "Breathing Bubble",
    desc: "Expand a gentle glowing bubble on your inhale, watch it float calmly as you exhale.",
    icon: Wind,
    color: "from-cyan-500/20 to-blue-500/10",
  },
  {
    id: "sand-garden",
    title: "Zen Sand Garden",
    desc: "Drag your finger to rake peaceful ripples in dry raked sand and place smooth river stones.",
    icon: Compass,
    color: "from-amber-500/20 to-orange-500/10",
  },
  {
    id: "pattern-tracing",
    title: "Pattern Tracing",
    desc: "Trace slow flowing spiral curves. Synchronizes hand-eye focus with a resting pulse.",
    icon: Sparkles,
    color: "from-teal-500/20 to-emerald-500/10",
  },
  {
    id: "memory-garden",
    title: "Memory Garden",
    desc: "Plant a blossom for each small thing that went okay today. Nurture your private garden.",
    icon: Flower2,
    color: "from-emerald-500/20 to-green-500/10",
  },
  {
    id: "rhythm-tap",
    title: "Gentle Rhythm Tap",
    desc: "Tap in sync with a steady 60 BPM heartbeat pulse. Grounds a racing autonomic pulse.",
    icon: Compass,
    color: "from-purple-500/20 to-indigo-500/10",
  },
];

/* ---------------------------------------------------------------------------
 * 1. Color Glow Mini-Game
 * --------------------------------------------------------------------------- */

function ColorGlowGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentColor, setCurrentColor] = useState("#818cf8"); // Soft indigo
  const [brushSize, setBrushSize] = useState(12);
  const [isDrawing, setIsDrawing] = useState(false);
  const historyRef = useRef<ImageData[]>([]);

  const PALETTE = [
    "#f472b6", // Rose
    "#c084fc", // Lavender
    "#818cf8", // Soft Indigo
    "#38bdf8", // Sky Blue
    "#34d399", // Mint Green
    "#fbbf24", // Warm Amber
    "#fb923c", // Peach
    "#ffffff", // Moonlight White
    "#1e293b", // Deep Charcoal
  ];

  // Initialize scene
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fill background
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw peaceful lotus/mandala guide lines in soft faint white
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1.5;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    // Concentric circles
    [40, 80, 130, 180].forEach((r) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Petal rays
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * 180, cy + Math.sin(angle) * 180);
      ctx.stroke();
    }

    // Save initial state
    historyRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  }, []);

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = currentColor;
    ctx.fillStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 8;
    ctx.shadowColor = currentColor;

    ctx.arc(x, y, brushSize / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.closePath();

    // Push to undo stack (max 15 steps)
    if (historyRef.current.length >= 15) historyRef.current.shift();
    historyRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  };

  const undo = () => {
    if (historyRef.current.length <= 1) return;
    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    const canvas = canvasRef.current;
    if (!canvas || !prev) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.putImageData(prev, 0, 0);
  };

  const saveArtwork = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `glow-artwork-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 flex flex-col items-center">
      <div className="flex flex-wrap items-center justify-between w-full max-w-lg mb-4 gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold">Color Glow Mandala</h3>
          <p className="text-xs text-muted-foreground">Paint glowing colors along the guide lines.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            className="glass-soft rounded-full p-2.5 text-muted-foreground hover:text-foreground transition-colors"
            title="Undo"
          >
            <Undo2 className="size-4" />
          </button>
          <button
            onClick={saveArtwork}
            className="aurora halo rounded-full px-4 py-2 text-xs font-medium text-primary-foreground flex items-center gap-1.5"
          >
            <Download className="size-3.5" />
            Save
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/10 touch-none mb-6">
        <canvas
          ref={canvasRef}
          width={440}
          height={440}
          className="cursor-crosshair bg-slate-950 w-full max-w-[360px] sm:max-w-[440px] aspect-square block"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>

      {/* Color Palette */}
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-lg">
        {PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setCurrentColor(c)}
            style={{ backgroundColor: c }}
            className={`size-8 rounded-full transition-transform ${
              currentColor === c ? "scale-125 ring-2 ring-primary ring-offset-2 ring-offset-slate-900" : "hover:scale-110"
            }`}
          />
        ))}
        <div className="h-6 w-[1px] bg-white/10 mx-2" />
        <input
          type="range"
          min="4"
          max="32"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
          className="w-24 accent-primary"
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 2. Breathing Bubble Game
 * --------------------------------------------------------------------------- */

function BreathingBubbleGame() {
  const [phase, setPhase] = useState<"idle" | "inhale" | "hold" | "exhale" | "popped">("idle");
  const [cycle, setCycle] = useState(0);

  const startBubble = () => {
    setPhase("inhale");
  };

  useEffect(() => {
    if (phase === "idle" || phase === "popped") return;
    let timer: ReturnType<typeof setTimeout>;

    if (phase === "inhale") {
      timer = setTimeout(() => setPhase("hold"), 4000);
    } else if (phase === "hold") {
      timer = setTimeout(() => setPhase("exhale"), 3000);
    } else if (phase === "exhale") {
      timer = setTimeout(() => {
        setCycle((c) => c + 1);
        setPhase("popped");
        setTimeout(() => setPhase("inhale"), 1500);
      }, 5000);
    }

    return () => clearTimeout(timer);
  }, [phase]);

  const sizeClass =
    phase === "inhale"
      ? "scale-[2.2] transition-transform duration-[4000ms] ease-out"
      : phase === "hold"
      ? "scale-[2.2] animate-pulse duration-700"
      : phase === "exhale"
      ? "scale-100 transition-transform duration-[5000ms] ease-in"
      : "scale-0 transition-transform duration-300";

  return (
    <div className="glass rounded-3xl p-8 text-center h-[520px] flex flex-col justify-between items-center">
      <div>
        <h3 className="font-display text-2xl font-semibold">Breathing Bubble</h3>
        <p className="text-xs text-muted-foreground mt-1">Inhale as the bubble swells. Let it float gently on exhale.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative w-full overflow-hidden">
        {/* Shimmering iridescent bubble */}
        <div
          className={`size-24 rounded-full bg-gradient-to-tr from-cyan-400/40 via-pink-400/30 to-indigo-400/50 backdrop-blur-md shadow-2xl border border-white/40 flex items-center justify-center text-primary-foreground ${sizeClass}`}
        >
          <div className="size-6 rounded-full bg-white/40 blur-[2px] absolute top-3 left-4" />
        </div>

        <span className="font-display text-2xl font-semibold mt-16 capitalize">
          {phase === "idle" ? "Ready" : phase === "popped" ? "Soft Release ✨" : phase}
        </span>
        <span className="text-xs text-muted-foreground mt-1">
          {phase === "inhale"
            ? "Breathe in slowly..."
            : phase === "hold"
            ? "Hold gently..."
            : phase === "exhale"
            ? "Exhale smoothly..."
            : "Completed breaths: " + cycle}
        </span>
      </div>

      {phase === "idle" ? (
        <button
          onClick={startBubble}
          className="aurora halo rounded-full px-8 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-105"
        >
          Begin breathing bubble
        </button>
      ) : (
        <button
          onClick={() => setPhase("idle")}
          className="glass-soft rounded-full px-6 py-2.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Reset
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 3. Zen Sand Garden Game
 * --------------------------------------------------------------------------- */

function SandGardenGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRaking, setIsRaking] = useState(false);
  const stones = useRef<{ x: number; y: number; r: number }[]>([
    { x: 120, y: 140, r: 24 },
    { x: 280, y: 220, r: 32 },
    { x: 190, y: 310, r: 18 },
  ]);

  const initGarden = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Soft warm dry sand background
    ctx.fillStyle = "#272421";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Initial peaceful horizontal rake lines
    ctx.strokeStyle = "rgba(255, 235, 205, 0.08)";
    ctx.lineWidth = 3;
    for (let y = 10; y < canvas.height; y += 14) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw smooth river stones with shadows
    stones.current.forEach((s) => {
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#4a453f";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();

      // Stone highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.beginPath();
      ctx.arc(s.x - s.r / 3, s.y - s.r / 3, s.r / 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }, []);

  useEffect(() => {
    initGarden();
  }, [initGarden]);

  const rake = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isRaking) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    // Draw 3 concentric rake tine grooves
    [-8, 0, 8].forEach((offset) => {
      ctx.beginPath();
      ctx.arc(x + offset, y + offset, 6, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(245, 222, 179, 0.15)";
      ctx.fill();
    });
  };

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 flex flex-col items-center">
      <div className="flex items-center justify-between w-full max-w-md mb-4">
        <div>
          <h3 className="font-display text-xl font-semibold">Zen Sand Garden</h3>
          <p className="text-xs text-muted-foreground">Slowly rake lines in the sand around the stones.</p>
        </div>
        <button
          onClick={initGarden}
          className="glass-soft rounded-full px-4 py-2 text-xs flex items-center gap-1.5 hover:text-foreground"
        >
          <RotateCcw className="size-3.5" />
          Smooth Sand
        </button>
      </div>

      <div className="rounded-3xl overflow-hidden border border-white/10 shadow-2xl touch-none">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="cursor-pointer max-w-[340px] sm:max-w-[400px] aspect-square block"
          onMouseDown={() => setIsRaking(true)}
          onMouseMove={rake}
          onMouseUp={() => setIsRaking(false)}
          onTouchStart={() => setIsRaking(true)}
          onTouchMove={rake}
          onTouchEnd={() => setIsRaking(false)}
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 4. Pattern Tracing Game
 * --------------------------------------------------------------------------- */

function PatternTracingGame() {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.buttons !== 1 && e.type !== "pointermove") return;
    setProgress((p) => {
      const next = p + 1.2;
      if (next >= 100) {
        setDone(true);
        return 100;
      }
      return next;
    });
  };

  return (
    <div className="glass rounded-3xl p-8 text-center h-[520px] flex flex-col justify-between items-center">
      <div>
        <h3 className="font-display text-2xl font-semibold">Golden Spiral Tracing</h3>
        <p className="text-xs text-muted-foreground mt-1">Slowly drag along the spiral path. Match your breath to your pace.</p>
      </div>

      <div className="flex-1 flex items-center justify-center my-4">
        <svg
          width="320"
          height="320"
          viewBox="0 0 320 320"
          className="touch-none cursor-pointer"
          onPointerMove={handlePointer}
        >
          {/* Background spiral track */}
          <path
            d="M 160 160 m 0, 0 a 15,15 0 0,1 25,15 a 35,35 0 0,1 -40,35 a 65,65 0 0,1 -65,-55 a 100,100 0 0,1 90,-95 a 135,135 0 0,1 135,120"
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="24"
            strokeLinecap="round"
          />

          {/* Glowing traced path */}
          <path
            d="M 160 160 m 0, 0 a 15,15 0 0,1 25,15 a 35,35 0 0,1 -40,35 a 65,65 0 0,1 -65,-55 a 100,100 0 0,1 90,-95 a 135,135 0 0,1 135,120"
            fill="none"
            stroke="url(#glowGradient)"
            strokeWidth="12"
            strokeDasharray="1000"
            strokeDashoffset={1000 - progress * 10}
            strokeLinecap="round"
          />

          <defs>
            <linearGradient id="glowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="w-full max-w-xs">
        <div className="w-full bg-white/5 rounded-full h-1.5 mb-3 overflow-hidden">
          <div className="h-full aurora transition-all duration-200" style={{ width: `${progress}%` }} />
        </div>
        {done ? (
          <div className="flex items-center justify-center gap-2 text-primary font-medium text-sm animate-in fade-in">
            <Check className="size-4" />
            <span>Harmonized and grounded</span>
            <button onClick={() => { setProgress(0); setDone(false); }} className="text-xs underline ml-2">Trace again</button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Drag slowly along the spiral ({Math.round(progress)}%)</span>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 5. Memory Garden Game
 * --------------------------------------------------------------------------- */

function MemoryGardenGame() {
  const [flowers, setFlowers] = useState<{ id: string; text: string; icon: string }[]>([
    { id: "1", text: "Drank a warm cup of tea quietly", icon: "🌸" },
    { id: "2", text: "Walked in the cool fresh evening air", icon: "🌼" },
  ]);
  const [input, setInput] = useState("");

  const plantFlower = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const icons = ["🌸", "🌷", "🌻", "🌺", "🌼", "🌿", "🌱"];
    const chosen = icons[Math.floor(Math.random() * icons.length)];
    setFlowers((prev) => [...prev, { id: String(Date.now()), text: input.trim(), icon: chosen }]);
    setInput("");
  };

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 flex flex-col justify-between h-[520px]">
      <div>
        <h3 className="font-display text-2xl font-semibold">Memory Garden</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Plant a quiet blossom for each small thing that went okay today.
        </p>
      </div>

      {/* Garden Canvas */}
      <div className="flex-1 my-4 glass-soft rounded-2xl p-6 overflow-y-auto flex flex-wrap gap-4 items-end content-end min-h-[220px]">
        {flowers.map((f) => (
          <div
            key={f.id}
            className="flex flex-col items-center group animate-in zoom-in-50 duration-500 cursor-pointer"
            title={f.text}
          >
            <span className="text-4xl transition-transform group-hover:scale-125 mb-1">{f.icon}</span>
            <span className="text-[11px] text-muted-foreground/80 max-w-[100px] truncate text-center">
              {f.text}
            </span>
          </div>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={plantFlower} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="One small thing that was okay today..."
          className="flex-1 glass rounded-full px-5 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="aurora halo rounded-full px-6 py-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          Plant
        </button>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 6. Gentle Rhythm Tap (60 BPM)
 * --------------------------------------------------------------------------- */

function RhythmTapGame() {
  const [active, setActive] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 200);
    }, 1000); // 60 BPM = 1 beat per second

    return () => clearInterval(interval);
  }, [active]);

  return (
    <div className="glass rounded-3xl p-8 text-center h-[520px] flex flex-col justify-between items-center">
      <div>
        <h3 className="font-display text-2xl font-semibold">Gentle Rhythm Pulse</h3>
        <p className="text-xs text-muted-foreground mt-1">A slow 60 BPM pulse. Match your taps or heartbeat to it.</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div
          className={`size-32 rounded-full flex items-center justify-center transition-all ${
            pulse
              ? "aurora halo scale-125 shadow-2xl text-primary-foreground"
              : "glass scale-100 text-muted-foreground opacity-60"
          }`}
          style={{ transitionDuration: "180ms" }}
        >
          <span className="text-2xl font-display font-semibold">60 BPM</span>
        </div>
        <p className="text-xs text-muted-foreground mt-8">Resting resting pulse rate reference</p>
      </div>

      <button
        onClick={() => setActive((a) => !a)}
        className="aurora halo rounded-full px-8 py-3 text-sm font-medium text-primary-foreground"
      >
        {active ? "Stop rhythm" : "Start 60 BPM rhythm"}
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Main Games Hub Page
 * --------------------------------------------------------------------------- */

export default function GamesPage() {
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null);

  const selectedDef = GAME_DEFS.find((g) => g.id === selectedGame);

  return (
    <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 min-h-[calc(100vh-140px)]">
      {!selectedGame ? (
        <div className="flex flex-col items-center mb-8 text-center animate-in fade-in duration-500">
          <span className="aurora halo mb-3 flex size-14 items-center justify-center rounded-full">
            <Sparkles className="size-6 text-primary-foreground" />
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">
            Mindful Mini-Games
          </h1>
          <p className="mt-2 text-muted-foreground text-sm sm:text-base max-w-md">
            No scores, no countdowns, and no failure states. Gentle tactile interactions to ease rumination.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setSelectedGame(null)}
            className="glass-soft flex items-center gap-2 rounded-full px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to games
          </button>
          <span className="text-xs font-medium text-foreground">{selectedDef?.title}</span>
        </div>
      )}

      <div className="flex-1">
        {!selectedGame ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {GAME_DEFS.map((g) => {
              const Icon = g.icon;
              return (
                <div
                  key={g.id}
                  onClick={() => setSelectedGame(g.id)}
                  className="glass group p-6 rounded-3xl flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 cursor-pointer"
                >
                  <div>
                    <div className={`aurora bg-gradient-to-br ${g.color} flex size-12 items-center justify-center rounded-2xl mb-4`}>
                      <Icon className="size-5 text-primary-foreground" />
                    </div>
                    <h3 className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                      {g.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {g.desc}
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-1 text-xs font-medium text-primary">
                    <span>Play quietly</span>
                    <span>→</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            {selectedGame === "color-glow" && <ColorGlowGame />}
            {selectedGame === "breathing-bubble" && <BreathingBubbleGame />}
            {selectedGame === "sand-garden" && <SandGardenGame />}
            {selectedGame === "pattern-tracing" && <PatternTracingGame />}
            {selectedGame === "memory-garden" && <MemoryGardenGame />}
            {selectedGame === "rhythm-tap" && <RhythmTapGame />}
          </div>
        )}
      </div>
    </main>
  );
}
