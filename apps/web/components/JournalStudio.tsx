"use client";

/**
 * Private journal studio.
 *
 * Supports typed pages, freehand pen pages, multiple paper themes, emoji
 * stamps, and user-uploaded photo stickers that can be dragged, resized,
 * rotated, and cropped. Decorations are stored as compact metadata inside the
 * encrypted journal entry, so they survive a reload.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookHeart,
  BookOpen,
  Check,
  Crop,
  Download,
  Eraser,
  Feather,
  ImagePlus,
  Keyboard,
  Loader2,
  Palette,
  PenLine,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sticker,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { authFetch } from "../lib/auth";
import { useLanguage } from "../contexts/LanguageContext";

type StickerKind = "emoji" | "image";
type CropInsets = { top: number; right: number; bottom: number; left: number };

type PlacedSticker = {
  id: string;
  kind: StickerKind;
  emoji?: string;
  src?: string;
  x: number; // center, percentage of page width
  y: number; // center, percentage of page height
  width: number; // percentage of page width
  rotation: number; // degrees
  crop?: CropInsets;
};

type JournalEntry = {
  id: number;
  created_at: string;
  title: string | null;
  content: string;
  mood_at_write: number | null;
};

type JournalMeta = {
  stickers?: PlacedSticker[];
  paper?: string;
  ink?: string;
  drawing?: string;
  mode?: "type" | "draw" | "mixed";
};

type PaperPattern = "ruled" | "grid" | "dots" | "blank";

type PaperTheme = {
  id: string;
  name: string;
  bg: string;
  border: string;
  ruleColor: string;
  marginColor: string;
  spine: string;
  swatch: string;
  pattern: PaperPattern;
  dark?: boolean;
  nameEs?: string;
  nameFr?: string;
  nameAr?: string;
};

type GuidedCategory = {
  id: string;
  title: string;
  desc: string;
  icon: string;
  prompts: string[];
  titleEs?: string;
  titleFr?: string;
  titleAr?: string;
  descEs?: string;
  descFr?: string;
  descAr?: string;
  promptsEs?: string[];
  promptsFr?: string[];
  promptsAr?: string[];
};

type Locale = "en" | "es" | "fr" | "ar";

function localeSuffix(language: Locale): "" | "Es" | "Fr" | "Ar" {
  return language === "en" ? "" : (language[0].toUpperCase() + language.slice(1)) as "" | "Es" | "Fr" | "Ar";
}

const INK_COLORS = [
  { id: "slate", label: "Fountain Slate",
      labelEs: "Pizarra de fuente", labelFr: "Ardoise de fontaine", labelAr: "لون حجر نافورة", hex: "#1e293b", darkHex: "#f1f5f9" },
  { id: "indigo", label: "Midnight Blue",
      labelEs: "Azul medianoche", labelFr: "Bleu de minuit", labelAr: "أزرق منتصف الليل", hex: "#1d4ed8", darkHex: "#93c5fd" },
  { id: "emerald", label: "Forest Emerald",
      labelEs: "Esmeralda bosque", labelFr: "Émeraude forêt", labelAr: "زمرد غابة", hex: "#047857", darkHex: "#6ee7b7" },
  { id: "terracotta", label: "Warm Terracotta",
      labelEs: "Terracota cálida", labelFr: "Terre cuite chaude", labelAr: "طين حراري دافئ", hex: "#c2410c", darkHex: "#fdba74" },
  { id: "plum", label: "Rose Plum",
      labelEs: "Ciruela rosa", labelFr: "Prune rosée", labelAr: "برقوق وردي", hex: "#be185d", darkHex: "#f472b6" },
  { id: "teal", label: "Ocean Teal",
      labelEs: "Verde océano", labelFr: "Bleu-vert océan", labelAr: "أخضر المحيط", hex: "#0f766e", darkHex: "#5eead4" },
];

const PAPER_THEMES: PaperTheme[] = [
  {
    id: "parchment",
    name: "Classic Parchment",
    nameEs: "Pergamino clásico", nameFr: "Parchemin classique", nameAr: "رقّ كلاسيكي",
    bg: "bg-[#fdfaf3] dark:bg-[#181a20]",
    border: "border-[#e5dfce] dark:border-[#2a2e39]",
    ruleColor: "rgba(180, 165, 140, 0.25)",
    marginColor: "rgba(239, 68, 68, 0.4)",
    spine: "bg-[#78350f]/20",
    swatch: "#fdfaf3",
    pattern: "ruled",
  },
  {
    id: "lavender",
    name: "Lavender Dusk",
    nameEs: "Crepúsculo lavanda", nameFr: "Crépuscule lavande", nameAr: "غروب الخزامى",
    bg: "bg-[#faf7fd] dark:bg-[#1c1826]",
    border: "border-[#e5dcf2] dark:border-[#322944]",
    ruleColor: "rgba(168, 140, 210, 0.22)",
    marginColor: "rgba(217, 70, 239, 0.4)",
    spine: "bg-[#581c87]/20",
    swatch: "#faf7fd",
    pattern: "ruled",
  },
  {
    id: "sage",
    name: "Sage Whisper",
    nameEs: "Susurro de salvia", nameFr: "Murmure de sauge", nameAr: "همس المريمية",
    bg: "bg-[#f6faf7] dark:bg-[#16201b]",
    border: "border-[#dcebe0] dark:border-[#23352b]",
    ruleColor: "rgba(130, 180, 150, 0.22)",
    marginColor: "rgba(34, 197, 94, 0.4)",
    spine: "bg-[#14532d]/20",
    swatch: "#f6faf7",
    pattern: "ruled",
  },
  {
    id: "midnight",
    name: "Midnight Stars",
    nameEs: "Estrellas de medianoche", nameFr: "Étoiles de minuit", nameAr: "نجوم منتصف الليل",
    bg: "bg-[#111622] dark:bg-[#0d121c]",
    border: "border-[#253047] dark:border-[#1e2738]",
    ruleColor: "rgba(100, 140, 200, 0.2)",
    marginColor: "rgba(96, 165, 250, 0.4)",
    spine: "bg-[#1e3a8a]/30",
    swatch: "#111622",
    pattern: "ruled",
    dark: true,
  },
  {
    id: "ocean",
    name: "Ocean Calm",
    nameEs: "Calma oceánica", nameFr: "Calme océanique", nameAr: "هدوء المحيط",
    bg: "bg-[#eef7fa] dark:bg-[#0e1a20]",
    border: "border-[#cfe6ee] dark:border-[#1c3038]",
    ruleColor: "rgba(56, 189, 248, 0.2)",
    marginColor: "rgba(14, 116, 144, 0.4)",
    spine: "bg-[#0e7490]/20",
    swatch: "#eef7fa",
    pattern: "ruled",
  },
  {
    id: "rose",
    name: "Rose Quartz",
    nameEs: "Cuarzo rosa", nameFr: "Quartz rose", nameAr: "كوارتز وردي",
    bg: "bg-[#fdf4f6] dark:bg-[#21151a]",
    border: "border-[#f1d8df] dark:border-[#3a242c]",
    ruleColor: "rgba(244, 114, 182, 0.18)",
    marginColor: "rgba(190, 24, 93, 0.35)",
    spine: "bg-[#9d174d]/20",
    swatch: "#fdf4f6",
    pattern: "ruled",
  },
  {
    id: "autumn",
    name: "Autumn Leaf",
    nameEs: "Hoja de otoño", nameFr: "Feuille d'automne", nameAr: "ورقة الخريف",
    bg: "bg-[#fcf6ed] dark:bg-[#201a13]",
    border: "border-[#eddfc8] dark:border-[#3a2f21]",
    ruleColor: "rgba(217, 119, 6, 0.18)",
    marginColor: "rgba(180, 83, 9, 0.38)",
    spine: "bg-[#92400e]/20",
    swatch: "#fcf6ed",
    pattern: "ruled",
  },
  {
    id: "graph",
    name: "Quiet Graph",
    nameEs: "Cuadrícula tranquila", nameFr: "Grille calme", nameAr: "شبكة هادئة",
    bg: "bg-[#fbfcfd] dark:bg-[#151a21]",
    border: "border-[#dde5ea] dark:border-[#26313b]",
    ruleColor: "rgba(100, 116, 139, 0.16)",
    marginColor: "rgba(100, 116, 139, 0.3)",
    spine: "bg-[#334155]/20",
    swatch: "#fbfcfd",
    pattern: "grid",
  },
  {
    id: "dotted",
    name: "Soft Dots",
    nameEs: "Puntos suaves", nameFr: "Points doux", nameAr: "نقاط ناعمة",
    bg: "bg-[#fbf9f4] dark:bg-[#1a1917]",
    border: "border-[#e8e1d5] dark:border-[#302d28]",
    ruleColor: "rgba(146, 129, 102, 0.25)",
    marginColor: "rgba(146, 129, 102, 0.2)",
    spine: "bg-[#78716c]/20",
    swatch: "#fbf9f4",
    pattern: "dots",
  },
  {
    id: "blank",
    name: "Blank Canvas",
    nameEs: "Lienzo en blanco", nameFr: "Toile vierge", nameAr: "لوحة فارغة",
    bg: "bg-white dark:bg-[#141414]",
    border: "border-[#e5e5e5] dark:border-[#2b2b2b]",
    ruleColor: "transparent",
    marginColor: "transparent",
    spine: "bg-transparent",
    swatch: "#ffffff",
    pattern: "blank",
  },
];

const STICKER_PALETTE = [
  "🌱", "🌸", "✨", "☕", "🌙", "☀️",
  "🦋", "🤍", "🕯️", "🌿", "🎨", "⭐",
  "🌊", "☁️", "🪴", "🕊️",
];

const GUIDED_CATEGORIES = [
  {
    id: "release",
    title: "Grounding & Release",
    desc: "Unburden heavy feelings and find quiet footing.",
    icon: "🌿",
    prompts: [
      "What is one heavy thought you can put down on this page and not carry for the rest of today?",
      "Name three small things that brought you a moment of comfort or stillness recently.",
      "What is currently outside your control, and what is one small thing gently within your control?",
      "Take a slow breath. What is your body telling you right now without words?",
    ],
  
    titleEs: "Anclaje y liberación", titleFr: "Ancrage et libération", titleAr: "التثبيت والتخلي",
    descEs: "Alivia los sentimientos pesados y encuentra un apoyo tranquilo.", descFr: "Déchargez les sentiments lourds et retrouvez un appui tranquille.", descAr: "خفف المشاعر الثقيلة واعثر على موطئ قدم هادئ.",
    promptsEs: [
        "¿Qué pensamiento pesado puedes dejar en esta página y no cargar el resto del día?",
        "Nombra tres cosas pequeñas que te trajeron un momento de consuelo o calma recientemente.",
        "¿Qué está fuera de tu control ahora, y qué es una pequeña cosa suavemente dentro de tu control?",
        "Respira despacio. ¿Qué te dice tu cuerpo ahora mismo sin palabras?",
      ], promptsFr: [
        "Quelle pensée lourde pouvez-vous déposer sur cette page et ne pas porter le reste de la journée ?",
        "Nommez trois petites choses qui vous ont apporté un moment de réconfort ou d'apaisement récemment.",
        "Qu'est-ce qui échappe actuellement à votre contrôle, et quelle est une petite chose doucement en votre pouvoir ?",
        "Prenez une respiration lente. Que vous dit votre corps en ce moment, sans mots ?",
      ], promptsAr: [
        "ما الفكرة الثقيلة التي يمكنك وضعها على هذه الصفحة وعدم حملها بقية اليوم؟",
        "اذكر ثلاثة أشياء صغيرة جلبت لك لحظة راحة أو سكينة مؤخراً.",
        "ما الذي يخرج عن سيطرتك الآن، وما الشيء الصغير الواقع بلطف ضمن سيطرتك؟",
        "خذ نفساً بطيئاً. ماذا يخبرك جسدك الآن دون كلمات؟",
      ],},
  {
    id: "kindness",
    title: "Self-Compassion",
    desc: "Speak gently to yourself as you would to a dear friend.",
    icon: "💛",
    prompts: [
      "If a close friend felt exactly how you are feeling right now, what gentle words would you tell them?",
      "What is something you survived or handled this week that you haven't given yourself credit for?",
      "What do you need permission to feel or say 'no' to today?",
      "Write three kind sentences addressed to yourself at the start of this day.",
    ],
  
    titleEs: "Autocompasión", titleFr: "Bienveillance envers soi", titleAr: "اللطف مع الذات",
    descEs: "Háblate con dulzura como lo harías con un amigo querido.", descFr: "Parlez-vous avec douceur comme vous le feriez à un ami cher.", descAr: "تحدث إلى نفسك بلطف كما تتحدث لصديق عزيز.",
    promptsEs: [
        "Si un amigo cercano se sintiera exactamente como te sientes ahora, ¿qué palabras amables le dirías?",
        "¿Qué algo sobreviviste o manejaste esta semana por lo que no te has dado crédito?",
        "¿A qué necesitas permiso para sentir o para decir «no» hoy?",
        "Escribe tres frases amables dirigidas a ti mismo al comienzo de este día.",
      ], promptsFr: [
        "Si un ami proche ressentait exactement ce que vous ressentez, quelles paroles douces lui diriez-vous ?",
        "Qu'avez-vous traversé ou géré cette semaine sans vous en donner le mérite ?",
        "À quoi avez-vous besoin d'autorisation pour ressentir ou dire « non » aujourd'hui ?",
        "Écrivez trois phrases bienveillantes adressées à vous-même au début de cette journée.",
      ], promptsAr: [
        "لو شعر صديق مقرب بما تشعر به الآن بالضبط، ما الكلمات اللطيفة التي ستقولها له؟",
        "ما الشيء الذي نجوت منه أو تدبرته هذا الأسبوع ولم تعطِ نفسك الفضل عليه؟",
        "ما الشيء الذي تحتاج إلى إذن لتشعر به أو لتقول له «لا» اليوم؟",
        "اكتب ثلاث جمل لطيفة موجهة إلى نفسك في بداية هذا اليوم.",
      ],},
  {
    id: "untangle",
    title: "Untangling Thoughts",
    desc: "Pour out swirling ideas and separate noise from what matters.",
    icon: "🌅",
    prompts: [
      "Brain-dump everything currently swirling in your head — no grammar, no filter, just let it out.",
      "What is the underlying fear or worry beneath your current fatigue or frustration?",
      "What is the single next kind, manageable step you can take in the next 15 minutes?",
      "If you stripped away everyone else's expectations, what does your heart want right now?",
    ],
  
    titleEs: "Desenredando pensamientos", titleFr: "Démêler les pensées", titleAr: "فك تشابك الأفكار",
    descEs: "Vuelca las ideas que giran y separa el ruido de lo que importa.", descFr: "Versez vos idées tournoyantes et séparez le bruit de l'essentiel.", descAr: "أفرغ الأفكار المتصاعدة وافصل الضجيج عما يهم.",
    promptsEs: [
        "Vacía todo lo que gira en tu cabeza — sin gramática, sin filtro, déjalo salir.",
        "¿Cuál es el miedo o preocupación subyacente bajo tu cansancio o frustración actual?",
        "¿Cuál es el único próximo paso amable y manejable que puedes dar en los próximos 15 minutos?",
        "Si quitaras todas las expectativas de los demás, ¿qué quiere tu corazón ahora mismo?",
      ], promptsFr: [
        "Videz tout ce qui tourne dans votre tête — sans grammaire, sans filtre, laissez-le juste sortir.",
        "Quelle est la peur ou l'inquiétude sous-jacente sous votre fatigue ou frustration actuelle ?",
        "Quelle est l'unique prochaine petite étape bienveillante et faisable dans les 15 prochaines minutes ?",
        "Si vous retiriez toutes les attentes des autres, que veut votre cœur en ce moment ?",
      ], promptsAr: [
        "أفرغ كل ما يدور في رأسك — بلا قواعد ولا فلتر، دعه يخرج فقط.",
        "ما الخوف أو القلق الذي يكمُن تحت تعبك أو إحباطك الحالي؟",
        "ما الخطوة اللطيفة الوحيدة القابلة للتنفيذ التي يمكنك اتخاذها في الدقائق الـ15 القادمة؟",
        "لو أزلت توقعات كل الآخرين، ماذا يريد قلبك الآن؟",
      ],},
  {
    id: "evening",
    title: "Evening Warmth",
    desc: "Wind down peacefully and close the day with grace.",
    icon: "🌙",
    prompts: [
      "What was the most soothing moment of your day, no matter how small or brief?",
      "What is one thing you choose to forgive yourself for before going to sleep?",
      "What is one soft hope or quiet blessing you wish to hold onto for tomorrow?",
      "Write a short thank-you note to a part of your body that carried you through today.",
    ],
  
    titleEs: "Calidez de la tarde", titleFr: "Douceur du soir", titleAr: "دفء المساء",
    descEs: "Relájate tranquilamente y cierra el día con gracia.", descFr: "Apprivoisez-vous en paix et clôturez la journée en douceur.", descAr: "استرخِ بسلام واختتم اليوم برفق.",
    promptsEs: [
        "¿Cuál fue el momento más reconfortante de tu día, por pequeño o breve que fuera?",
        "¿Qué es una cosa que eliges perdonarte antes de dormir?",
        "¿Cuál es una esperanza suave o una bendición tranquila que deseas guardar para mañana?",
        "Escribe una breve nota de agradecimiento a una parte de tu cuerpo que te acompañó hoy.",
      ], promptsFr: [
        "Quel a été le moment le plus apaisant de votre journée, aussi petit ou bref soit-il ?",
        "Qu'est-ce qu'une chose que vous choisissez de vous pardonner avant de vous endormir ?",
        "Quelle est une douce espérance ou une tranquille bénédiction que vous souhaitez garder pour demain ?",
        "Écrivez un court mot de remerciement à une partie de votre corps qui vous a porté aujourd'hui.",
      ], promptsAr: [
        "ما أكثر لحظة مريحة في يومك، مهما كانت صغيرة أو قصيرة؟",
        "ما الشيء الذي تختار مسامحة نفسك عليه قبل النوم؟",
        "ما الأمل الناعم أو النعمة الهادئة التي تتمنى التمسك بها لغد؟",
        "اكتب ملاحظة شكر قصيرة لجزء من جسدك حملك عبر اليوم.",
      ],},
];

const MOOD_FACES = ["😞", "🙁", "😐", "🙂", "😊", "😄", "🤩"];

const DECORATION_RE = /\n\n<!-- glow-decorations: ([\s\S]*) -->\s*$/;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function themeBackground(theme: PaperTheme): React.CSSProperties {
  if (theme.pattern === "blank") return {};
  if (theme.pattern === "grid") {
    return {
      backgroundImage: `linear-gradient(${theme.ruleColor} 1px, transparent 1px), linear-gradient(90deg, ${theme.ruleColor} 1px, transparent 1px)`,
      backgroundSize: "24px 24px",
    };
  }
  if (theme.pattern === "dots") {
    return {
      backgroundImage: `radial-gradient(${theme.ruleColor} 1.2px, transparent 1.2px)`,
      backgroundSize: "20px 20px",
    };
  }
  return {
    backgroundImage: `repeating-linear-gradient(transparent, transparent 31px, ${theme.ruleColor} 31px, ${theme.ruleColor} 32px)`,
    backgroundSize: "100% 32px",
  };
}

function parseEntry(content: string): { text: string; meta: JournalMeta | null } {
  const match = content.match(DECORATION_RE);
  if (!match) return { text: content, meta: null };
  try {
    const meta = JSON.parse(match[1]) as JournalMeta;
    return { text: content.slice(0, match.index).trim(), meta };
  } catch {
    return { text: content, meta: null };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = src;
  });
}

async function fileToStickerDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const maxSide = 420;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function StickerView({
  sticker,
  selected,
}: {
  sticker: PlacedSticker;
  selected?: boolean;
}) {
  if (sticker.kind === "image" && sticker.src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={sticker.src}
        alt=""
        draggable={false}
        className={`block h-auto w-full select-none ${selected ? "rounded-md ring-2 ring-primary/70" : ""}`}
      />
    );
  }
  return (
    <span
      className={`block select-none text-center leading-none ${selected ? "rounded-md ring-2 ring-primary/70" : ""}`}
      style={{ fontSize: `${sticker.width * 0.75}cqw` }}
    >
      {sticker.emoji}
    </span>
  );
}

export default function JournalStudio() {
  const { language, t } = useLanguage();
  const loc = localeSuffix(language as Locale);
  const [journalMode, setJournalMode] = useState<"guided" | "free">("guided");
  const [selectedPromptCategory, setSelectedPromptCategory] = useState(GUIDED_CATEGORIES[0].id);
  const [activePromptIndex, setActivePromptIndex] = useState(0);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [inputMode, setInputMode] = useState<"type" | "draw">("type");
  const [selectedInk, setSelectedInk] = useState(INK_COLORS[0]);
  const [paperTheme, setPaperTheme] = useState(PAPER_THEMES[0]);
  const [stickers, setStickers] = useState<PlacedSticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [todayMood, setTodayMood] = useState<number | null>(null);
  const [todayLabel, setTodayLabel] = useState("");

  const [penWidth, setPenWidth] = useState(4);
  const [eraser, setEraser] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropInsets>({ top: 0, right: 0, bottom: 0, left: 0 });

  const pageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const drawingRef = useRef(false);
  const drawingHistoryRef = useRef<ImageData[]>([]);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const selectedSticker = stickers.find((s) => s.id === selectedStickerId) ?? null;
  const cropTarget = stickers.find((s) => s.id === cropTargetId) ?? null;

  const currentCategory =
    GUIDED_CATEGORIES.find((c) => c.id === selectedPromptCategory) || GUIDED_CATEGORIES[0];
  const localizedPrompts =
    loc === "Es"
      ? currentCategory.promptsEs ?? currentCategory.prompts
      : loc === "Fr"
        ? currentCategory.promptsFr ?? currentCategory.prompts
        : loc === "Ar"
          ? currentCategory.promptsAr ?? currentCategory.prompts
          : currentCategory.prompts;
  const currentPrompt = localizedPrompts[activePromptIndex % localizedPrompts.length];
  const cyclePrompt = () => {
    setActivePromptIndex((prev) => (prev + 1) % localizedPrompts.length);
  };

  useEffect(() => {
    setTodayLabel(
      new Date().toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    );
  }, []);

  const loadJournal = useCallback(async () => {
    try {
      const res = await authFetch("/journal");
      if (res.ok) setEntries(await res.json());
    } catch {
      // offline or unauthenticated fallback
    }
  }, []);

  const loadTodayMood = useCallback(async () => {
    try {
      const res = await authFetch("/mood");
      if (!res.ok) return;
      const data = (await res.json()) as Array<{ day_utc: string; mood: number }>;
      const today = new Date().toISOString().slice(0, 10);
      const todays = data.filter((m) => m.day_utc === today);
      setTodayMood(todays.length ? todays[todays.length - 1].mood : null);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadJournal();
    void loadTodayMood();
  }, [loadJournal, loadTodayMood]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    drawingHistoryRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  }, []);

  const applyPromptToDraft = (promptText: string) => {
    if (!draftTitle) setDraftTitle(promptText.slice(0, 70));
    setInputMode("type");
    setDraftContent((prev) =>
      prev ? `${prev}\n\n[Prompt: ${promptText}]\n` : `[Prompt: ${promptText}]\n\n`,
    );
  };

  /* ----------------------------- stickers ----------------------------- */

  const addEmojiSticker = (emoji: string) => {
    const id = `stk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newSticker: PlacedSticker = {
      id,
      kind: "emoji",
      emoji,
      x: 24 + Math.random() * 52,
      y: 22 + Math.random() * 48,
      width: 9,
      rotation: Math.round((Math.random() - 0.5) * 24),
    };
    setStickers((prev) => [...prev, newSticker]);
    setSelectedStickerId(id);
  };

  const addPhotoStickers = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const chosen = Array.from(files).slice(0, 6);
    for (const file of chosen) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const src = await fileToStickerDataUrl(file);
        const id = `stk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setStickers((prev) => [
          ...prev,
          {
            id,
            kind: "image",
            src,
            x: 50,
            y: 50,
            width: 24,
            rotation: 0,
          },
        ]);
        setSelectedStickerId(id);
      } catch {
        // Skip unreadable files without interrupting the journal.
      }
    }
  };

  const updateSticker = (id: string, patch: Partial<PlacedSticker>) => {
    setStickers((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeSticker = (id: string) => {
    setStickers((prev) => prev.filter((s) => s.id !== id));
    setSelectedStickerId((current) => (current === id ? null : current));
    setCropTargetId((current) => (current === id ? null : current));
  };

  const handleStickerPointerDown = (event: React.PointerEvent<HTMLDivElement>, sticker: PlacedSticker) => {
    event.stopPropagation();
    event.preventDefault();
    setSelectedStickerId(sticker.id);
    dragRef.current = {
      id: sticker.id,
      startX: event.clientX,
      startY: event.clientY,
      origX: sticker.x,
      origY: sticker.y,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handleStickerPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const page = pageRef.current;
    if (!drag || !page) return;
    const rect = page.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dx = ((event.clientX - drag.startX) / rect.width) * 100;
    const dy = ((event.clientY - drag.startY) / rect.height) * 100;
    updateSticker(drag.id, {
      x: clamp(drag.origX + dx, 2, 98),
      y: clamp(drag.origY + dy, 2, 98),
    });
  };

  const handleStickerPointerUp = () => {
    dragRef.current = null;
  };

  const openCrop = (sticker: PlacedSticker) => {
    setCropTargetId(sticker.id);
    setCrop(sticker.crop ?? { top: 0, right: 0, bottom: 0, left: 0 });
  };

  const applyCrop = async () => {
    const target = cropTarget;
    if (!target?.src) {
      setCropTargetId(null);
      return;
    }
    try {
      const img = await loadImage(target.src);
      const left = clamp(crop.left, 0, 45);
      const right = clamp(crop.right, 0, 45);
      const top = clamp(crop.top, 0, 45);
      const bottom = clamp(crop.bottom, 0, 45);
      const sx = img.width * (left / 100);
      const sy = img.height * (top / 100);
      const sw = img.width * (1 - (left + right) / 100);
      const sh = img.height * (1 - (top + bottom) / 100);
      // Clamped insets keep sw/sh above zero for any real image. Tiny
      // images (e.g. 1x1) still round up to a 1px canvas instead of
      // silently failing and leaving the crop dialog stuck open.
      if (!Number.isFinite(sw) || !Number.isFinite(sh) || sw <= 0 || sh <= 0) return;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(sw));
      canvas.height = Math.max(1, Math.round(sh));
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const src = canvas.toDataURL("image/webp", 0.85);
      updateSticker(target.id, { src, crop: undefined });
    } catch {
      // Leave the sticker untouched if the image cannot be decoded, but
      // still close the dialog so the user is never trapped in it.
    } finally {
      setCropTargetId(null);
    }
  };

  /* ------------------------------ pen -------------------------------- */

  const canvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / Math.max(1, rect.width)),
      y: (event.clientY - rect.top) * (canvas.height / Math.max(1, rect.height)),
    };
  };

  const startStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drawingRef.current = true;
    const { x, y } = canvasPoint(event);
    ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
    ctx.strokeStyle = eraser ? "rgba(0,0,0,1)" : selectedInk.hex;
    ctx.lineWidth = penWidth * (canvas.width / Math.max(1, canvas.getBoundingClientRect().width));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    setHasDrawing(true);
  };

  const moveStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { x, y } = canvasPoint(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (drawingHistoryRef.current.length >= 18) drawingHistoryRef.current.shift();
    drawingHistoryRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  };

  const undoStroke = () => {
    if (drawingHistoryRef.current.length <= 1) return;
    drawingHistoryRef.current.pop();
    const previous = drawingHistoryRef.current[drawingHistoryRef.current.length - 1];
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !previous) return;
    ctx.putImageData(previous, 0, 0);
  };

  const clearDrawing = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawingHistoryRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
    setHasDrawing(false);
  };

  /* ------------------------------ save ------------------------------- */

  const saveEntry = async () => {
    const hasText = draftContent.trim().length > 0;
    if (!hasText && !hasDrawing && stickers.length === 0) return;
    setSavingEntry(true);
    setSavedSuccess(false);

    const drawing = hasDrawing && canvasRef.current
      ? canvasRef.current.toDataURL("image/webp", 0.82)
      : undefined;

    let finalContent = hasText
      ? draftContent
      : hasDrawing
        ? "[Handwritten page]"
        : "[Decorated page]";

    const meta: JournalMeta = {
      stickers,
      paper: paperTheme.id,
      ink: selectedInk.id,
      drawing,
      mode: hasDrawing && hasText ? "mixed" : hasDrawing ? "draw" : "type",
    };
    if (
      stickers.length > 0 ||
      paperTheme.id !== "parchment" ||
      selectedInk.id !== "slate" ||
      drawing
    ) {
      finalContent = `${finalContent}\n\n<!-- glow-decorations: ${JSON.stringify(meta)} -->`;
    }

    try {
      const res = await authFetch("/journal", {
        method: "POST",
        json: {
          title: draftTitle.trim() || undefined,
          content: finalContent,
          mood_at_write: todayMood ?? undefined,
        },
      });
      if (res.ok) {
        setDraftTitle("");
        setDraftContent("");
        setStickers([]);
        setSelectedStickerId(null);
        clearDrawing();
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3500);
        await loadJournal();
      }
    } finally {
      setSavingEntry(false);
    }
  };

  const downloadKeepsake = (entryTitle: string | null, content: string, date: string) => {
    const { text } = parseEntry(content);
    const header = `Glow Private Journal\nDate: ${new Date(date).toLocaleString()}\nTitle: ${entryTitle || "Untitled"}\n${"-".repeat(40)}\n\n`;
    const blob = new Blob([header + text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `glow-journal-${new Date(date).toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inkColor = paperTheme.dark ? selectedInk.darkHex : selectedInk.hex;
  const wordCount = draftContent.trim() ? draftContent.trim().split(/\s+/).length : 0;
  const canSave = draftContent.trim().length > 0 || hasDrawing || stickers.length > 0;

  return (
    <section className="space-y-6 animate-in fade-in duration-300">
      {/* Mode + privacy */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl glass-soft border border-border/40">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setJournalMode("guided")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              journalMode === "guided"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <Sparkles className="size-3.5" />{t("studio.guidedReflection")}</button>
          <button
            onClick={() => setJournalMode("free")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
              journalMode === "free"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <Feather className="size-3.5" />{t("studio.freeFlow")}</button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-emerald-500" />
          <span>{t("studio.encrypted")}</span>
        </div>
      </div>

      {/* Guided prompts */}
      {journalMode === "guided" && (
        <div className="glass rounded-3xl p-5 space-y-4 border border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">{t("studio.chooseTheme")}</span>
            <button
              onClick={cyclePrompt}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
            >
              <RefreshCw className="size-3" />{t("studio.shuffle")}</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {GUIDED_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedPromptCategory(cat.id);
                  setActivePromptIndex(0);
                }}
                className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                  selectedPromptCategory === cat.id
                    ? "border-primary/50 bg-primary/10 text-foreground ring-1 ring-primary/30"
                    : "border-border/40 hover:bg-muted/40 text-muted-foreground"
                }`}
              >
                <span className="text-base">{cat.icon}</span>
                <div className="overflow-hidden">
                  <div className="text-xs font-medium truncate">
                    {loc === "Es"
                      ? cat.titleEs ?? cat.title
                      : loc === "Fr"
                        ? cat.titleFr ?? cat.title
                        : loc === "Ar"
                          ? cat.titleAr ?? cat.title
                          : cat.title}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-primary">{t("studio.todaysPrompt")}</div>
              <p className="text-sm font-serif italic text-foreground leading-relaxed">
                &ldquo;{currentPrompt}&rdquo;
              </p>
            </div>
            <button
              onClick={() => applyPromptToDraft(currentPrompt)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium transition-colors"
            >
              <Plus className="size-3" />{t("studio.useInJournal")}</button>
          </div>
        </div>
      )}

      {/* Notebook */}
      <div className="relative group">
        <div className={`relative rounded-3xl overflow-hidden border shadow-xl transition-all ${paperTheme.bg} ${paperTheme.border}`}>
          {/* Top toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border/30 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-border" />
                <span className="size-2 rounded-full bg-border" />
                <span className="size-2 rounded-full bg-border" />
              </div>
              <span className="text-xs font-mono font-medium text-muted-foreground">
                {todayLabel || "\u00a0"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Input mode */}
              <div className="flex items-center rounded-lg glass-soft p-0.5">
                <button
                  onClick={() => setInputMode("type")}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    inputMode === "type" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                  title={t("studio.typeHint")}
                >
                  <Keyboard className="size-3" />
                  Type
                </button>
                <button
                  onClick={() => setInputMode("draw")}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                    inputMode === "draw" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
                  title={t("studio.penHint")}
                >
                  <PenLine className="size-3" />
                  Pen
                </button>
              </div>

              {/* Ink */}
              <div className="relative">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg glass-soft text-xs text-muted-foreground hover:text-foreground"
                  title={t("studio.chooseInk")}
                >
                  <Palette className="size-3.5" />
                  <span
                    className="size-2.5 rounded-full border border-border"
                    style={{ backgroundColor: inkColor }}
                  />
                </button>
                {showColorPicker && (
                  <div className="absolute right-0 top-8 z-40 p-2 rounded-xl glass shadow-xl border border-border flex gap-1.5 animate-in fade-in zoom-in-95">
                    {INK_COLORS.map((ink) => (
                      <button
                        key={ink.id}
                        onClick={() => {
                          setSelectedInk(ink);
                          setShowColorPicker(false);
                        }}
                        className={`size-6 rounded-full border transition-transform hover:scale-110 flex items-center justify-center ${
                          selectedInk.id === ink.id ? "ring-2 ring-primary scale-110" : ""
                        }`}
                        style={{ backgroundColor: ink.hex }}
                        title={
                          loc === "Es"
                            ? (ink.labelEs ?? ink.label)
                            : loc === "Fr"
                              ? (ink.labelFr ?? ink.label)
                              : loc === "Ar"
                                ? (ink.labelAr ?? ink.label)
                                : ink.label
                        }
                      >
                        {selectedInk.id === ink.id && <Check className="size-3 text-white" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Themes */}
              <div className="flex items-center gap-1 overflow-x-auto max-w-[170px] sm:max-w-none py-0.5">
                {PAPER_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setPaperTheme(theme)}
                    className={`size-4 shrink-0 rounded-full border transition-all ${
                      paperTheme.id === theme.id ? "scale-125 ring-2 ring-primary" : "opacity-70 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: theme.swatch }}
                    title={
                      loc === "Es"
                        ? theme.nameEs ?? theme.name
                        : loc === "Fr"
                          ? theme.nameFr ?? theme.name
                          : loc === "Ar"
                            ? theme.nameAr ?? theme.name
                            : theme.name
                    }
                  />
                ))}
              </div>

              {/* Sticker controls */}
              <button
                onClick={() => setShowStickerPicker(!showStickerPicker)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  showStickerPicker
                    ? "bg-primary text-primary-foreground"
                    : "glass-soft text-muted-foreground hover:text-foreground"
                }`}
                title={t("studio.decorateHint")}
              >
                <Sticker className="size-3.5" />{t("studio.stickers")}</button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg glass-soft text-xs text-muted-foreground hover:text-foreground"
                title={t("studio.uploadHint")}
              >
                <ImagePlus className="size-3.5" />
                Photo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  void addPhotoStickers(event.currentTarget.files);
                  event.currentTarget.value = "";
                }}
              />
            </div>
          </div>

          {/* Selected sticker toolbar */}
          {selectedSticker && (
            <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-2.5 border-b border-border/30 bg-primary/5 text-xs">
              <span className="font-medium text-foreground">
                {selectedSticker.kind === "image" ? t("studio.selectedPhoto") : selectedSticker.emoji}
              </span>
              <label className="flex items-center gap-2 text-muted-foreground">
                {t("studio.size")}
                <input
                  type="range"
                  min={4}
                  max={60}
                  value={selectedSticker.width}
                  onChange={(e) => updateSticker(selectedSticker.id, { width: Number(e.target.value) })}
                  className="w-20 accent-primary"
                />
              </label>
              <label className="flex items-center gap-2 text-muted-foreground">
                {t("studio.rotate")}
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={selectedSticker.rotation}
                  onChange={(e) => updateSticker(selectedSticker.id, { rotation: Number(e.target.value) })}
                  className="w-20 accent-primary"
                />
                <span className="w-8 text-right">{Math.round(selectedSticker.rotation)}°</span>
              </label>
              {selectedSticker.kind === "image" && (
                <button
                  onClick={() => openCrop(selectedSticker)}
                  className="flex items-center gap-1 rounded-lg bg-primary/15 px-2.5 py-1 text-primary hover:bg-primary/25"
                >
                  <Crop className="size-3.5" />
                  {t("studio.crop")}
                </button>
              )}
              <button
                onClick={() => removeSticker(selectedSticker.id)}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-rose-500 hover:bg-rose-500/10"
              >
                <Trash2 className="size-3.5" />
                {t("studio.remove")}
              </button>
              <button
                onClick={() => setSelectedStickerId(null)}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                {t("studio.done")}
              </button>
            </div>
          )}

          {/* Sticker palette */}
          {showStickerPicker && (
            <div className="px-4 sm:px-5 py-2.5 bg-primary/5 border-b border-border/30 flex flex-wrap items-center gap-2 animate-in fade-in duration-200">
              <span className="text-[11px] text-muted-foreground mr-1">{t("studio.stampHint")}</span>
              {STICKER_PALETTE.map((stk) => (
                <button
                  key={stk}
                  onClick={() => addEmojiSticker(stk)}
                  className="text-lg p-1 hover:scale-125 transition-transform"
                  title={t("studio.stampOnPage")}
                >
                  {stk}
                </button>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 rounded-lg bg-primary/15 px-2.5 py-1 text-[11px] text-primary hover:bg-primary/25"
              >
                <Upload className="size-3" />{t("studio.uploadFromDevice")}</button>
              {stickers.length > 0 && (
                <button
                  onClick={() => {
                    setStickers([]);
                    setSelectedStickerId(null);
                  }}
                  className="ml-auto text-[11px] text-muted-foreground hover:text-rose-500 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="size-3" />{t("studio.clearStickers")}</button>
              )}
            </div>
          )}

          {/* Pen controls */}
          {inputMode === "draw" && (
            <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-2.5 bg-muted/20 border-b border-border/30 text-xs">
              <span className="text-muted-foreground">{t("studio.penWidth")}</span>
              <input
                type="range"
                min={1}
                max={14}
                value={penWidth}
                onChange={(e) => setPenWidth(Number(e.target.value))}
                className="w-24 accent-primary"
              />
              <button
                onClick={() => setEraser((value) => !value)}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 ${
                  eraser ? "bg-primary text-primary-foreground" : "glass-soft text-muted-foreground"
                }`}
              >
                <Eraser className="size-3.5" />{t("studio.eraser")}</button>
              <button
                onClick={undoStroke}
                className="flex items-center gap-1 rounded-lg glass-soft px-2.5 py-1 text-muted-foreground hover:text-foreground"
              >
                <Undo2 className="size-3.5" />{t("studio.undo")}</button>
              <button
                onClick={clearDrawing}
                className="flex items-center gap-1 rounded-lg glass-soft px-2.5 py-1 text-muted-foreground hover:text-rose-500"
              >
                <RotateCcw className="size-3.5" />{t("studio.clearPen")}</button>
              <span className="ml-auto text-[11px] text-muted-foreground">{t("studio.penHowto")}</span>
            </div>
          )}

          {/* Paper surface */}
          <div
            ref={pageRef}
            onClick={(event) => {
              if (event.target === event.currentTarget) setSelectedStickerId(null);
            }}
            className="relative min-h-[420px] p-6 sm:p-8 [container-type:inline-size]"
            style={themeBackground(paperTheme)}
          >
            {/* Margin + spine */}
            <div
              className="absolute top-0 bottom-0 left-12 sm:left-16 w-px pointer-events-none"
              style={{ backgroundColor: paperTheme.marginColor }}
            />
            <div className="absolute top-0 bottom-0 left-3 flex flex-col justify-around py-4 pointer-events-none opacity-40">
              {[...Array(12)].map((_, i) => (
                <span key={i} className="size-1.5 rounded-full bg-muted-foreground/30" />
              ))}
            </div>

            {/* Title */}
            <div className="relative z-10 pl-10 sm:pl-12 mb-3">
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                maxLength={100}
                placeholder={t("studio.titlePh")}
                className="w-full bg-transparent font-serif text-lg sm:text-xl font-medium focus:outline-none placeholder:text-muted-foreground/40 placeholder:font-sans"
                style={{ color: inkColor, lineHeight: "32px" }}
              />
            </div>

            {/* Typed page */}
            <div className={`relative z-10 pl-10 sm:pl-12 ${inputMode === "type" ? "block" : "hidden"}`}>
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                rows={9}
                maxLength={15000}
                placeholder={t("studio.bodyPh")}
                className="w-full bg-transparent resize-y font-serif text-sm sm:text-base focus:outline-none placeholder:text-muted-foreground/40 placeholder:font-sans placeholder:italic"
                style={{ color: inkColor, lineHeight: "32px", paddingTop: "4px" }}
              />
            </div>

            {/* Handwritten page */}
            <div className={`relative z-10 pl-10 sm:pl-12 ${inputMode === "draw" ? "block" : "hidden"}`}>
              <canvas
                ref={canvasRef}
                width={900}
                height={600}
                className="w-full touch-none rounded-xl border border-border/30 bg-transparent"
                style={{ aspectRatio: "3 / 2", cursor: eraser ? "cell" : "crosshair" }}
                onPointerDown={startStroke}
                onPointerMove={moveStroke}
                onPointerUp={endStroke}
                onPointerCancel={endStroke}
                onPointerLeave={endStroke}
              />
            </div>

            {/* Placed stickers */}
            {stickers.map((stk) => (
              <div
                key={stk.id}
                onPointerDown={(event) => handleStickerPointerDown(event, stk)}
                onPointerMove={handleStickerPointerMove}
                onPointerUp={handleStickerPointerUp}
                onPointerCancel={handleStickerPointerUp}
                onClick={(event) => event.stopPropagation()}
                className="absolute z-20 cursor-move touch-none select-none"
                style={{
                  left: `${stk.x}%`,
                  top: `${stk.y}%`,
                  width: `${stk.width}%`,
                  transform: `translate(-50%, -50%) rotate(${stk.rotation}deg)`,
                  zIndex: selectedStickerId === stk.id ? 30 : 20,
                }}
                title={t("studio.dragHint")}
              >
                <StickerView sticker={stk} selected={selectedStickerId === stk.id} />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-border/30 bg-muted/10">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>{t("studio.words").replace("{n}", String(wordCount))}</span>
              {hasDrawing && <span>{t("studio.penPage")}</span>}
              {stickers.length > 0 && (
                <span>{t("studio.stickersCount").replace("{n}", String(stickers.length))}</span>
              )}
              {savedSuccess && (
                <span className="flex items-center gap-1 text-emerald-500 font-medium animate-in fade-in">
                  <Check className="size-3.5" />{t("studio.saved")}</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {canSave && (
                <button
                  onClick={() => {
                    setDraftTitle("");
                    setDraftContent("");
                    setStickers([]);
                    setSelectedStickerId(null);
                    clearDrawing();
                  }}
                  className="px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-rose-500 transition-colors"
                >{t("studio.clearPage")}</button>
              )}
              <button
                onClick={saveEntry}
                disabled={!canSave || savingEntry}
                className="aurora halo rounded-full px-6 py-2 text-xs font-medium text-primary-foreground flex items-center gap-2 disabled:opacity-50 transition-transform active:scale-95 shadow-sm"
              >
                {savingEntry ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                {t("studio.save")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Past entries */}
      <div className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />{t("studio.previous")}</h2>
          <span className="text-xs text-muted-foreground">
            {entries ? t("studio.entries").replace("{n}", String(entries.length)) : t("studio.loading")}
          </span>
        </div>

        {(entries ?? []).map((entry) => {
          const { text, meta } = parseEntry(entry.content);
          const theme = PAPER_THEMES.find((t) => t.id === meta?.paper) ?? PAPER_THEMES[0];
          return (
            <article
              key={entry.id}
              className="glass rounded-2xl p-4 sm:p-5 border border-border/50 hover:border-primary/30 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <h3 className="font-display font-semibold text-base text-foreground">
                    {entry.title || t("studio.untitled")}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(entry.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                    {entry.mood_at_write && (
                      <span>· Mood {MOOD_FACES[entry.mood_at_write - 1]}</span>
                    )}
                    {meta?.mode === "draw" && <span>{t("studio.penPage")}</span>}
                    {meta?.mode === "mixed" && <span>{t("studio.penText")}</span>}
                    {meta?.stickers && meta.stickers.length > 0 && (
                      <span>{t("studio.stickersCount").replace("{n}", String(meta.stickers.length))}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => downloadKeepsake(entry.title, entry.content, entry.created_at)}
                  className="p-2 rounded-lg glass-soft hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title={t("studio.exportHint")}
                >
                  <Download className="size-3.5" />
                </button>
              </div>

              <div
                className={`relative overflow-hidden rounded-xl border ${theme.bg} ${theme.border} [container-type:inline-size]`}
                style={{ ...themeBackground(theme), minHeight: "150px" }}
              >
                {meta?.drawing && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={meta.drawing}
                    alt={t("studio.handwrittenAlt")}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                )}
                {text && text !== "[Handwritten page]" && text !== "[Decorated page]" && (
                  <p
                    className="relative z-10 whitespace-pre-wrap p-4 pl-8 font-serif text-sm leading-relaxed"
                    style={{ color: theme.dark ? "#e2e8f0" : "#1e293b" }}
                  >
                    {text}
                  </p>
                )}
                {meta?.stickers?.map((stk) => (
                  <div
                    key={stk.id}
                    className="absolute z-20 select-none"
                    style={{
                      left: `${stk.x}%`,
                      top: `${stk.y}%`,
                      width: `${stk.width}%`,
                      transform: `translate(-50%, -50%) rotate(${stk.rotation}deg)`,
                    }}
                  >
                    <StickerView sticker={stk} />
                  </div>
                ))}
              </div>
            </article>
          );
        })}

        {entries?.length === 0 && (
          <div className="text-center py-12 glass rounded-2xl space-y-2 border border-border/40">
            <BookHeart className="size-8 text-muted-foreground/50 mx-auto" />
            <p className="text-sm font-medium text-foreground">{t("studio.waitingTitle")}</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">{t("studio.waitingBody")}</p>
          </div>
        )}
      </div>

      {/* Crop modal */}
      {cropTarget?.src && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass w-full max-w-lg rounded-3xl border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                <Crop className="size-4 text-primary" />{t("studio.cropTitle")}</h3>
              <button
                onClick={() => setCropTargetId(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("studio.cancel")}
              </button>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-border bg-[linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%),linear-gradient(45deg,#e5e7eb_25%,transparent_25%,transparent_75%,#e5e7eb_75%)] bg-[length:20px_20px] bg-[position:0_0,10px_10px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cropTarget.src}
                alt={t("studio.cropPreviewAlt")}
                className="mx-auto max-h-[280px] w-auto object-contain"
                style={{
                  clipPath: `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)`,
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {(["top", "right", "bottom", "left"] as const).map((side) => (
                <label key={side} className="flex items-center gap-2 text-muted-foreground capitalize">
                  {t(`studio.${side}` as "studio.top")}
                  <input
                    type="range"
                    min={0}
                    max={45}
                    value={crop[side]}
                    onChange={(e) => setCrop((prev) => ({ ...prev, [side]: Number(e.target.value) }))}
                    className="flex-1 accent-primary"
                  />
                  <span className="w-8 text-right">{crop[side]}%</span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setCrop({ top: 0, right: 0, bottom: 0, left: 0 })}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("studio.resetCrop")}
              </button>
              <button
                onClick={() => void applyCrop()}
                className="aurora halo rounded-full px-5 py-2 text-xs font-medium text-primary-foreground"
              >
                {t("studio.applyCrop")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
