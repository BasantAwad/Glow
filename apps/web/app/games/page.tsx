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
 *  4. Pattern Tracing: Real path tracing across several shapes
 *  5. Memory Garden: Plant a flower for each positive moment
 *  6. Rhythm Tap: 60 BPM gentle pulse
 *  7. Wish Lanterns: Release a thought into a quiet night sky
 *  8. Bubble Drift: Tap soft floating bubbles and let them go
 *  9. Star Connect: Draw a constellation one star at a time
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  Palette,
  Wind,
  Sparkles,
  Flower2,
  Compass,
  RotateCcw,
  Download,
  Check,
  ArrowLeft,
  Undo2,
  Circle,
  Moon,
  Star,
} from "lucide-react";

type GameId =
  | "color-glow"
  | "breathing-bubble"
  | "sand-garden"
  | "pattern-tracing"
  | "memory-garden"
  | "rhythm-tap"
  | "wish-lanterns"
  | "bubble-drift"
  | "star-connect";

type Locale = "en" | "es" | "fr" | "ar";

function localeSuffix(language: Locale): "" | "Es" | "Fr" | "Ar" {
  return language === "en" ? "" : (language[0].toUpperCase() + language.slice(1)) as "" | "Es" | "Fr" | "Ar";
}

interface GameDef {
  id: GameId;
  title: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  titleEs?: string;
  titleFr?: string;
  titleAr?: string;
  descEs?: string;
  descFr?: string;
  descAr?: string;
}

const GAME_DEFS: GameDef[] = [
  {
    id: "color-glow",
    title: "Color Glow",
    desc: "Color calming mandalas and night skies with soothing pastel palettes. No right or wrong.",
    icon: Palette,
    color: "from-pink-500/20 to-violet-500/10",
    titleEs: "Brillo de color",
    titleFr: "Éclat coloré",
    titleAr: "لمعان الألوان",
    descEs: "Colorea mandalas apacibles y cielos nocturnos con paletas pastel. Sin aciertos ni errores.",
    descFr: "Coloriez des mandalas apaisants et des ciels nocturnes aux palettes pastel. Sans bonnes ni mauvaises réponses.",
    descAr: "لوّن mandalas مهدّئة وسماوات ليلية بلوحات ناعمة. لا صواب ولا خطأ.",
  },
  {
    id: "breathing-bubble",
    title: "Breathing Bubble",
    desc: "Expand a gentle glowing bubble on your inhale, watch it float calmly as you exhale.",
    icon: Wind,
    color: "from-cyan-500/20 to-blue-500/10",
    titleEs: "Burbuja de respiración",
    titleFr: "Bulle de respiration",
    titleAr: "فقاعة التنفس",
    descEs: "Expande una burbuja luminosa suave al inhalar y mírala flotar calmada al exhalar.",
    descFr: "Faites grandir une bulle lumineuse douce à l'inspiration, puis regardez-la flotter calmement à l'expiration.",
    descAr: "وسّع فقاعة مضيئة ناعمة مع الشهيق، وشاهدها تطفو بهدوء مع الزفير.",
  },
  {
    id: "sand-garden",
    title: "Zen Sand Garden",
    desc: "Drag your finger to rake peaceful ripples in dry raked sand and place smooth river stones.",
    icon: Compass,
    color: "from-amber-500/20 to-orange-500/10",
    titleEs: "Jardín de arena zen",
    titleFr: "Jardin de sable zen",
    titleAr: "حديقة الرمال الهادئة",
    descEs: "Arrastra tu dedo para rastrillar ondas pacíficas en la arena y colocar piedras lisas de río.",
    descFr: "Faites glisser votre doigt pour ratisser des ondulations paisibles dans le sable et placer de lisses galets.",
    descAr: "اسحب إصبعك لرسم تموجات هادئة في الرمل وضع حجارة نهرية ناعمة.",
  },
  {
    id: "pattern-tracing",
    title: "Pattern Tracing",
    desc: "Trace slow flowing spiral curves. Synchronizes hand-eye focus with a resting pulse.",
    icon: Sparkles,
    color: "from-teal-500/20 to-emerald-500/10",
    titleEs: "Trazar patrones",
    titleFr: "Tracer des motifs",
    titleAr: "تتبّع الأنماط",
    descEs: "Traza curvas espirales lentas. Sincroniza la mirada con un pulso en descanso.",
    descFr: "Tracez lentement des spirales fluides. Synchronise le regard avec un pouls apaisé.",
    descAr: "تتبّع منحنيات حلزونية بطيئة. يزامن العين مع نبض هادئ.",
  },
  {
    id: "memory-garden",
    title: "Memory Garden",
    desc: "Plant a blossom for each small thing that went okay today. Nurture your private garden.",
    icon: Flower2,
    color: "from-emerald-500/20 to-green-500/10",
    titleEs: "Jardín de recuerdos",
    titleFr: "Jardin des souvenirs",
    titleAr: "حديقة الذكريات",
    descEs: "Planta una flor por cada cosa pequeña que salió bien hoy. Cuida tu jardín privado.",
    descFr: "Plantez une fleur pour chaque petite chose qui s'est bien passée aujourd'hui. Cultivez votre jardin privé.",
    descAr: "ازرع زهرة لكل شيء صغير سار على ما يرام اليوم. اعتنِ بحديقتك الخاصة.",
  },
  {
    id: "rhythm-tap",
    title: "Gentle Rhythm Tap",
    desc: "Tap in sync with a steady 60 BPM heartbeat pulse. Grounds a racing autonomic pulse.",
    icon: Compass,
    color: "from-purple-500/20 to-indigo-500/10",
    titleEs: "Toque de ritmo suave",
    titleFr: "Rythme doux",
    titleAr: "نقرة الإيقاع الهادئة",
    descEs: "Toca en sincronía con un pulso constante de 60 BPM. Ancla un pulso acelerado.",
    descFr: "Touchez en synchronie avec un pouls régulier de 60 BPM. Ancre un pouls qui s'emballe.",
    descAr: "انقر بالتزامن مع نبض ثابت بمعدل ٦٠ في الدقيقة. يثبّت نبضاً متسارعاً.",
  },
  {
    id: "wish-lanterns",
    title: "Wish Lanterns",
    desc: "Write a wish, a worry, or a goodbye and watch it drift up into a quiet night sky.",
    icon: Moon,
    color: "from-amber-500/20 to-rose-500/10",
    titleEs: "Faroles de deseos",
    titleFr: "Lanternes à souhaits",
    titleAr: "فوانيس الأمنيات",
    descEs: "Escribe un deseo, una preocupación o una despedida y míralo elevarse a un cielo nocturno tranquilo.",
    descFr: "Écrivez un souhait, une inquiétude ou un au revoir et regardez-le s'élever dans un ciel nocturne silencieux.",
    descAr: "اكتب أمنية أو قلقاً أو وداعاً وشاهده يرتفع في سماء ليلية هادئة.",
  },
  {
    id: "bubble-drift",
    title: "Bubble Drift",
    desc: "Soft bubbles float past. Tap one to let it go. Nothing to win, nothing to lose.",
    icon: Circle,
    color: "from-sky-500/20 to-cyan-500/10",
    titleEs: "Deriva de burbujas",
    titleFr: "Dérive de bulles",
    titleAr: "انجراف الفقاعات",
    descEs: "Burbujas suaves flotan. Toca una para dejarla ir. Nada que ganar, nada que perder.",
    descFr: "De douces bulles passent. Touchez-en une pour la laisser partir. Rien à gagner, rien à perdre.",
    descAr: "تطفو فقاعات ناعمة. انقر واحداً لتُفلته. لا شيء لتكسبه ولا شيء لتخسره.",
  },
  {
    id: "star-connect",
    title: "Star Connect",
    desc: "Tap stars to draw a constellation. Every shape you make is the right shape.",
    icon: Star,
    color: "from-indigo-500/20 to-violet-500/10",
    titleEs: "Conectar estrellas",
    titleFr: "Relier les étoiles",
    titleAr: "وصل النجوم",
    descEs: "Toca estrellas para dibujar una constelación. Cada forma que crees es la correcta.",
    descFr: "Touchez des étoiles pour dessiner une constellation. Chaque forme que vous créez est la bonne.",
    descAr: "انقر النجوم لرسم كوكبة. كل شكل تصنعه صحيح.",
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

const TRACE_SHAPES = [
  {
    id: "spiral",
    name: "Golden Spiral",
    nameEs: "Espiral dorada",
    nameFr: "Spirale dorée",
    nameAr: "الحلزون الذهبي",
    d: "M 160 160 m 0, 0 a 15,15 0 0,1 25,15 a 35,35 0 0,1 -40,35 a 65,65 0 0,1 -65,-55 a 100,100 0 0,1 90,-95 a 135,135 0 0,1 135,120",
  },
  {
    id: "wave",
    name: "Ocean Wave",
    nameEs: "Ola del océano",
    nameFr: "Vague océane",
    nameAr: "موجة المحيط",
    d: "M 20 170 C 55 70, 95 70, 135 170 S 215 270, 255 170 S 295 70, 320 130",
  },
  {
    id: "infinity",
    name: "Infinity",
    nameEs: "Infinito",
    nameFr: "Infini",
    nameAr: "لا نهائي",
    d: "M 160 160 C 105 90, 30 110, 30 160 C 30 210, 105 230, 160 160 C 215 90, 290 110, 290 160 C 290 210, 215 230, 160 160",
  },
  {
    id: "heart",
    name: "Heart",
    nameEs: "Corazón",
    nameFr: "Cœur",
    nameAr: "قلب",
    d: "M 160 270 C 60 210, 30 140, 80 95 C 120 60, 155 85, 160 120 C 165 85, 200 60, 240 95 C 290 140, 260 210, 160 270",
  },
  {
    id: "star",
    name: "Star",
    nameEs: "Estrella",
    nameFr: "Étoile",
    nameAr: "نجمة",
    d: "M 160 30 L 190 120 L 285 120 L 208 175 L 237 265 L 160 210 L 83 265 L 112 175 L 35 120 L 130 120 Z",
  },
  {
    id: "circle",
    name: "Breathing Circle",
    nameEs: "Círculo de respiración",
    nameFr: "Cercle de respiration",
    nameAr: "دائرة التنفس",
    d: "M 160 30 A 130 130 0 1 1 159.9 30",
  },
];

function PatternTracingGame() {
  const { language } = useLanguage();
  const loc = localeSuffix(language as Locale);
  const [shapeId, setShapeId] = useState(TRACE_SHAPES[0].id);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [pathLength, setPathLength] = useState(0);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [hint, setHint] = useState("Start at the glowing dot, then follow the path.");

  const pathRef = useRef<SVGPathElement | null>(null);
  const samplesRef = useRef<Array<{ x: number; y: number }>>([]);
  const indexRef = useRef(0);
  const tracingRef = useRef(false);

  const shape = TRACE_SHAPES.find((item) => item.id === shapeId) ?? TRACE_SHAPES[0];
  const startPoint = samplesRef.current[0] ?? null;
  const progressPoint = samplesRef.current[indexRef.current] ?? null;

  const buildSamples = useCallback(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    const count = 260;
    samplesRef.current = Array.from({ length: count + 1 }, (_, index) => {
      const point = path.getPointAtLength((index / count) * total);
      return { x: point.x, y: point.y };
    });
    setPathLength(total);
    setProgress(0);
    setDone(false);
    setCursor(null);
    indexRef.current = 0;
    tracingRef.current = false;
    setHint("Start at the glowing dot, then follow the path.");
  }, []);

  useEffect(() => {
    // Effects run after the path is committed, so it can be measured
    // synchronously. Scheduling this on requestAnimationFrame is a real
    // failure mode: rAF never fires in backgrounded/throttled tabs, which
    // would leave the shape unmeasurable and the game unable to start.
    buildSamples();
  }, [shapeId, buildSamples]);

  const toSvgPoint = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * 320,
      y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * 320,
    };
  };

  const startTrace = (event: React.PointerEvent<SVGSVGElement>) => {
    const point = toSvgPoint(event);
    const samples = samplesRef.current;
    if (samples.length === 0) return;
    const start = samples[0];
    if (Math.hypot(point.x - start.x, point.y - start.y) > 30) {
      setHint("Start at the glowing dot, then follow the path.");
      return;
    }
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Capture is a convenience for keeping drag events flowing; a
      // failure here must never prevent tracing from starting.
    }
    tracingRef.current = true;
    indexRef.current = 0;
    setProgress(0);
    setDone(false);
    setCursor(point);
    setHint("Follow the path slowly. There is no timer.");
  };

  const moveTrace = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!tracingRef.current) return;
    const point = toSvgPoint(event);
    const samples = samplesRef.current;
    if (samples.length === 0) return;
    setCursor(point);

    const from = indexRef.current;
    const lookAhead = Math.min(samples.length - 1, from + 16);
    let best = from;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = from; index <= lookAhead; index += 1) {
      const distance = Math.hypot(point.x - samples[index].x, point.y - samples[index].y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    }

    if (bestDistance <= 24 && best > from) {
      indexRef.current = best;
      const ratio = best / (samples.length - 1);
      setProgress(ratio);
      if (ratio >= 0.995) {
        tracingRef.current = false;
        setProgress(1);
        setDone(true);
        setHint("You followed the whole shape. Notice how your hand slowed down.");
      }
    }
  };

  const endTrace = () => {
    tracingRef.current = false;
    setCursor(null);
  };

  const resetTrace = () => {
    buildSamples();
  };

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 text-center h-auto min-h-[560px] flex flex-col justify-between items-center">
      <div className="space-y-2">
        <h3 className="font-display text-2xl font-semibold">Trace Something Real</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Nothing moves on its own. Your hand has to follow the path from the glowing start dot to
          the end.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5 my-3">
        {TRACE_SHAPES.map((item) => (
          <button
            key={item.id}
            onClick={() => setShapeId(item.id)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
              shapeId === item.id
                ? "aurora halo text-primary-foreground"
                : "glass-soft text-muted-foreground hover:text-foreground"
            }`}
          >
            {loc === "Es" ? item.nameEs : loc === "Fr" ? item.nameFr : loc === "Ar" ? item.nameAr : item.name}
          </button>
        ))}
      </div>

      <div className="flex-1 flex items-center justify-center my-2">
        <svg
          width="320"
          height="320"
          viewBox="0 0 320 320"
          className="touch-none cursor-crosshair max-w-full"
          onPointerDown={startTrace}
          onPointerMove={moveTrace}
          onPointerUp={endTrace}
          onPointerCancel={endTrace}
          onPointerLeave={endTrace}
        >
          <path
            ref={pathRef}
            d={shape.d}
            fill="none"
            stroke="transparent"
            strokeWidth="1"
          />
          <path
            d={shape.d}
            fill="none"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="26"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={shape.d}
            fill="none"
            stroke="url(#glowGradient)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${pathLength * progress} ${Math.max(pathLength, 1)}`}
          />

          {startPoint && (
            <circle
              cx={startPoint.x}
              cy={startPoint.y}
              r={progress > 0 ? 5 : 9}
              fill="#a855f7"
              opacity={progress > 0 ? 0.35 : 0.95}
            >
              {progress === 0 && (
                <animate attributeName="r" values="7;11;7" dur="2.4s" repeatCount="indefinite" />
              )}
            </circle>
          )}

          {cursor && !done && (
            <circle cx={cursor.x} cy={cursor.y} r="6" fill="#f0abfc" opacity="0.9" />
          )}
          {progressPoint && progress > 0 && !done && (
            <circle cx={progressPoint.x} cy={progressPoint.y} r="4" fill="#ffffff" opacity="0.9" />
          )}

          <defs>
            <linearGradient id="glowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="w-full max-w-sm space-y-2">
        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full aurora transition-all duration-150"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        {done ? (
          <div className="flex items-center justify-center gap-2 text-primary font-medium text-sm animate-in fade-in">
            <Check className="size-4" />
            <span>Traced completely</span>
            <button onClick={resetTrace} className="text-xs underline ml-2">
              Trace again
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{hint}</span>
            <span className="shrink-0">{Math.round(progress * 100)}%</span>
          </div>
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
 * 7. Wish Lanterns
 * --------------------------------------------------------------------------- */

type Lantern = {
  id: string;
  text: string;
  left: number;
  drift: number;
  duration: number;
};

function WishLanternsGame() {
  const [wish, setWish] = useState("");
  const [lanterns, setLanterns] = useState<Lantern[]>([]);
  const [released, setReleased] = useState<string[]>([]);

  const releaseLantern = (event: React.FormEvent) => {
    event.preventDefault();
    const text = wish.trim();
    if (!text) return;
    setLanterns((prev) => [
      ...prev,
      {
        id: `lantern-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text,
        left: 10 + Math.random() * 78,
        drift: (Math.random() - 0.5) * 150,
        duration: 11 + Math.random() * 7,
      },
    ]);
    setReleased((prev) => [text, ...prev].slice(0, 5));
    setWish("");
  };

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 flex flex-col min-h-[560px]">
      <style>{`
        @keyframes glow-lantern-rise {
          0% { transform: translate3d(0, 0, 0) scale(0.72); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translate3d(var(--drift), -470px, 0) scale(1.08); opacity: 0; }
        }
        @keyframes glow-star-twinkle {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
      `}</style>

      <div className="text-center space-y-1">
        <h3 className="font-display text-2xl font-semibold">Wish Lanterns</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Put one thought into a lantern. You do not have to solve it tonight — just let it rise.
        </p>
      </div>

      <div className="relative flex-1 my-4 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#0b1026] via-[#141b3d] to-[#2a1c3d]">
        {Array.from({ length: 28 }).map((_, index) => (
          <span
            key={index}
            className="absolute rounded-full bg-white"
            style={{
              left: `${(index * 37 + 11) % 97}%`,
              top: `${(index * 53 + 7) % 78}%`,
              width: `${1 + (index % 3)}px`,
              height: `${1 + (index % 3)}px`,
              animation: `glow-star-twinkle ${2.5 + (index % 5) * 0.6}s ease-in-out ${(index % 7) * 0.35}s infinite`,
            }}
          />
        ))}
        <div className="absolute right-8 top-7 size-14 rounded-full bg-amber-100/85 shadow-[0_0_45px_rgba(253,230,138,0.65)]" />
        <div className="absolute right-5 top-4 size-16 rounded-full bg-[#141b3d]" />

        {lanterns.map((lantern) => (
          <button
            key={lantern.id}
            title={lantern.text}
            onClick={() => setLanterns((prev) => prev.filter((item) => item.id !== lantern.id))}
            onAnimationEnd={() =>
              setLanterns((prev) => prev.filter((item) => item.id !== lantern.id))
            }
            className="absolute bottom-0 cursor-pointer"
            style={
              {
                left: `${lantern.left}%`,
                "--drift": `${lantern.drift}px`,
                animation: `glow-lantern-rise ${lantern.duration}s ease-in forwards`,
              } as React.CSSProperties
            }
            aria-label={`Lantern: ${lantern.text}`}
          >
            <span className="relative block h-16 w-12">
              <span className="absolute inset-0 rounded-[18px] border border-amber-200/50 bg-gradient-to-t from-amber-500/95 via-amber-300/85 to-rose-300/70 shadow-[0_0_30px_rgba(251,191,36,0.55)]" />
              <span className="absolute inset-x-2 bottom-1 h-2 rounded-full bg-amber-100/70 blur-[1px]" />
              <span className="absolute -bottom-2 left-1/2 size-2 -translate-x-1/2 rounded-full bg-amber-300 shadow-[0_0_14px_rgba(251,191,36,0.95)]" />
            </span>
          </button>
        ))}

        {lanterns.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 text-white/70">
            <Moon className="size-8 mb-2 opacity-70" />
            <p className="text-xs">Your lanterns will appear here.</p>
          </div>
        )}
      </div>

      <form onSubmit={releaseLantern} className="flex flex-col sm:flex-row gap-2">
        <input
          value={wish}
          onChange={(event) => setWish(event.target.value)}
          maxLength={140}
          placeholder="A wish, a worry, or something you want to set down..."
          className="flex-1 glass rounded-full px-5 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!wish.trim()}
          className="aurora halo rounded-full px-6 py-3 text-xs font-medium text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Sparkles className="size-3.5" />
          Release lantern
        </button>
      </form>

      {released.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {released.map((text, index) => (
            <span
              key={`${text}-${index}`}
              className="max-w-full truncate rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] text-amber-600 dark:text-amber-300"
            >
              {text}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 8. Bubble Drift
 * --------------------------------------------------------------------------- */

type DriftBubble = {
  id: string;
  size: number;
  left: number;
  drift: number;
  duration: number;
};

function BubbleDriftGame() {
  const [bubbles, setBubbles] = useState<DriftBubble[]>([]);
  const [released, setReleased] = useState(0);

  useEffect(() => {
    const spawn = () => {
      setBubbles((prev) => {
        if (prev.length >= 15) return prev;
        return [
          ...prev,
          {
            id: `bubble-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            size: 26 + Math.random() * 58,
            left: 6 + Math.random() * 82,
            drift: (Math.random() - 0.5) * 120,
            duration: 9 + Math.random() * 7,
          },
        ];
      });
    };
    spawn();
    const interval = setInterval(spawn, 1700);
    return () => clearInterval(interval);
  }, []);

  const popBubble = (id: string) => {
    setBubbles((prev) => prev.filter((bubble) => bubble.id !== id));
    setReleased((count) => count + 1);
  };

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 flex flex-col min-h-[560px]">
      <style>{`
        @keyframes glow-bubble-rise {
          0% { transform: translate3d(0, 60px, 0) scale(0.7); opacity: 0; }
          10% { opacity: 0.9; }
          85% { opacity: 0.8; }
          100% { transform: translate3d(var(--drift), -470px, 0) scale(1.06); opacity: 0; }
        }
      `}</style>

      <div className="text-center space-y-1">
        <h3 className="font-display text-2xl font-semibold">Bubble Drift</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Bubbles drift upward on their own. Tap one when you feel ready to let it go.
        </p>
      </div>

      <div className="relative flex-1 my-4 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#071a2c] via-[#0c2b42] to-[#1c3b4d]">
        {bubbles.map((bubble) => (
          <button
            key={bubble.id}
            onClick={() => popBubble(bubble.id)}
            onAnimationEnd={() =>
              setBubbles((prev) => prev.filter((item) => item.id !== bubble.id))
            }
            aria-label="Let this bubble go"
            className="absolute bottom-0 rounded-full border border-white/40 transition-transform hover:scale-110"
            style={
              {
                left: `${bubble.left}%`,
                width: `${bubble.size}px`,
                height: `${bubble.size}px`,
                "--drift": `${bubble.drift}px`,
                animation: `glow-bubble-rise ${bubble.duration}s ease-in forwards`,
                background:
                  "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.85), rgba(186,230,253,0.32) 32%, rgba(125,211,252,0.18) 62%, rgba(167,139,250,0.12) 100%)",
                boxShadow:
                  "inset 0 0 18px rgba(255,255,255,0.35), 0 0 22px rgba(125,211,252,0.25)",
              } as React.CSSProperties
            }
          >
            <span className="absolute left-[22%] top-[18%] size-2 rounded-full bg-white/80 blur-[1px]" />
          </button>
        ))}

        <div className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[11px] text-white/55">
          {released === 0
            ? "No pressure. Watch them float for a while."
            : `${released} bubble${released === 1 ? "" : "s"} released — nothing was lost.`}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>Bubbles are not tasks. You can simply watch.</span>
        <button
          onClick={() => {
            setBubbles([]);
            setReleased(0);
          }}
          className="glass-soft rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <RotateCcw className="size-3" />
          Clear sky
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * 9. Star Connect
 * --------------------------------------------------------------------------- */

const CONSTELLATION_STARS = [
  { id: "s1", x: 18, y: 34 },
  { id: "s2", x: 31, y: 20 },
  { id: "s3", x: 44, y: 31 },
  { id: "s4", x: 55, y: 16 },
  { id: "s5", x: 68, y: 30 },
  { id: "s6", x: 82, y: 22 },
  { id: "s7", x: 74, y: 47 },
  { id: "s8", x: 60, y: 58 },
  { id: "s9", x: 46, y: 50 },
  { id: "s10", x: 32, y: 62 },
  { id: "s11", x: 20, y: 52 },
  { id: "s12", x: 50, y: 76 },
  { id: "s13", x: 66, y: 72 },
  { id: "s14", x: 36, y: 84 },
];

function StarConnectGame() {
  const [selected, setSelected] = useState<string[]>([]);
  const [constellations, setConstellations] = useState(0);

  const starById = new Map(CONSTELLATION_STARS.map((star) => [star.id, star]));

  const toggleStar = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) {
        return prev[prev.length - 1] === id ? prev.slice(0, -1) : prev;
      }
      return [...prev, id];
    });
  };

  const finishConstellation = () => {
    if (selected.length < 3) return;
    setConstellations((count) => count + 1);
    setSelected([]);
  };

  return (
    <div className="glass rounded-3xl p-6 sm:p-8 flex flex-col min-h-[560px]">
      <div className="text-center space-y-1">
        <h3 className="font-display text-2xl font-semibold">Star Connect</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Tap stars in any order. Lines appear between them. There is no correct constellation.
        </p>
      </div>

      <div className="relative flex-1 my-4 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#080b1f] via-[#10162f] to-[#1b1636]">
        {Array.from({ length: 40 }).map((_, index) => (
          <span
            key={index}
            className="absolute rounded-full bg-white/70"
            style={{
              left: `${(index * 29 + 7) % 98}%`,
              top: `${(index * 41 + 13) % 94}%`,
              width: `${1 + (index % 2)}px`,
              height: `${1 + (index % 2)}px`,
              opacity: 0.2 + (index % 5) * 0.12,
            }}
          />
        ))}

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <defs>
            <linearGradient id="constellationGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a5b4fc" />
              <stop offset="50%" stopColor="#f0abfc" />
              <stop offset="100%" stopColor="#fde68a" />
            </linearGradient>
          </defs>
          {selected.slice(0, -1).map((id, index) => {
            const from = starById.get(id);
            const to = starById.get(selected[index + 1]);
            if (!from || !to) return null;
            return (
              <line
                key={`${id}-${selected[index + 1]}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="url(#constellationGradient)"
                strokeWidth="0.55"
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {CONSTELLATION_STARS.map((star, index) => {
          const active = selected.includes(star.id);
          return (
            <button
              key={star.id}
              onClick={() => toggleStar(star.id)}
              aria-label={`Star ${index + 1}${active ? ", selected" : ""}`}
              aria-pressed={active}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-1 transition-all hover:scale-125 ${
                active ? "text-amber-200" : "text-white/70"
              }`}
              style={{
                left: `${star.x}%`,
                top: `${star.y}%`,
                filter: active
                  ? "drop-shadow(0 0 8px rgba(253,230,138,0.95))"
                  : "drop-shadow(0 0 4px rgba(255,255,255,0.45))",
              }}
            >
              <Star className={`size-4 ${active ? "fill-amber-200" : "fill-white/20"}`} />
            </button>
          );
        })}

        {selected.length === 0 && constellations === 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[11px] text-white/55">
            Tap any star to begin.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="text-muted-foreground">
          {constellations > 0
            ? `${constellations} constellation${constellations === 1 ? "" : "s"} drawn`
            : `${selected.length} star${selected.length === 1 ? "" : "s"} connected`}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelected((prev) => prev.slice(0, -1))}
            disabled={selected.length === 0}
            className="glass-soft rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 flex items-center gap-1"
          >
            <Undo2 className="size-3" />
            Undo
          </button>
          <button
            onClick={() => setSelected([])}
            disabled={selected.length === 0}
            className="glass-soft rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Clear
          </button>
          <button
            onClick={finishConstellation}
            disabled={selected.length < 3}
            className="aurora halo rounded-full px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
          >
            Keep this shape
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Main Games Hub Page
 * --------------------------------------------------------------------------- */

export default function GamesPage() {
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null);
  const { language } = useLanguage();
  const loc = localeSuffix(language as Locale);

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
                      {g[`title${loc}` as keyof GameDef] as string || g.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                      {(g[`desc${loc}` as keyof GameDef] as string | undefined) || g.desc}
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
            {selectedGame === "wish-lanterns" && <WishLanternsGame />}
            {selectedGame === "bubble-drift" && <BubbleDriftGame />}
            {selectedGame === "star-connect" && <StarConnectGame />}
          </div>
        )}
      </div>
    </main>
  );
}
