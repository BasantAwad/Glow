"use client";

/**
 * Wellness Hub — Realistic Dual-Mode Journal (Guided & Free Notebook),
 * Mood Insights Chart, and Mindful Relaxation Pacer.
 *
 * Journal entries are client-composed and server-side envelope-encrypted
 * using AES-GCM via the backend KMS service.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookHeart,
  LineChart,
  Loader2,
  Plus,
  Sparkles,
  BookOpen,
  Feather,
  Palette,
  Sticker,
  RefreshCw,
  Download,
  Trash2,
  Smile,
  ShieldCheck,
  Check,
  ChevronRight,
  Target,
} from "lucide-react";
import { authFetch } from "../../lib/auth";
import { useLanguage } from "../../contexts/LanguageContext";

/* -------------------------------------------------------------------------- */
/* Types & Constants                                                          */
/* -------------------------------------------------------------------------- */

type PlacedSticker = {
  id: string;
  emoji: string;
  x: number; // percentage 0..100
  y: number; // percentage 0..100
  rotation: number; // deg -15..15
};

type JournalEntry = {
  id: number;
  created_at: string;
  title: string | null;
  content: string;
  mood_at_write: number | null;
};

type MoodEntry = { day_utc: string; mood: number; note: string | null };

const MOOD_FACES = ["😞", "🙁", "😐", "🙂", "😊", "😄", "🤩"]; // 1..7

const INK_COLORS = [
  { id: "slate", label: "Fountain Slate", hex: "#1e293b", darkHex: "#f1f5f9" },
  { id: "indigo", label: "Midnight Blue", hex: "#1d4ed8", darkHex: "#93c5fd" },
  { id: "emerald", label: "Forest Emerald", hex: "#047857", darkHex: "#6ee7b7" },
  { id: "terracotta", label: "Warm Terracotta", hex: "#c2410c", darkHex: "#fdba74" },
  { id: "plum", label: "Rose Plum", hex: "#be185d", darkHex: "#f472b6" },
  { id: "teal", label: "Ocean Teal", hex: "#0f766e", darkHex: "#5eead4" },
];

const PAPER_THEMES = [
  {
    id: "parchment",
    name: "Classic Parchment",
    bg: "bg-[#fdfaf3] dark:bg-[#181a20]",
    border: "border-[#e5dfce] dark:border-[#2a2e39]",
    ruleColor: "rgba(180, 165, 140, 0.25)",
    marginColor: "rgba(239, 68, 68, 0.4)",
    spine: "bg-[#78350f]/20",
  },
  {
    id: "lavender",
    name: "Lavender Dusk",
    bg: "bg-[#faf7fd] dark:bg-[#1c1826]",
    border: "border-[#e5dcf2] dark:border-[#322944]",
    ruleColor: "rgba(168, 140, 210, 0.22)",
    marginColor: "rgba(217, 70, 239, 0.4)",
    spine: "bg-[#581c87]/20",
  },
  {
    id: "sage",
    name: "Sage Whisper",
    bg: "bg-[#f6faf7] dark:bg-[#16201b]",
    border: "border-[#dcebe0] dark:border-[#23352b]",
    ruleColor: "rgba(130, 180, 150, 0.22)",
    marginColor: "rgba(34, 197, 94, 0.4)",
    spine: "bg-[#14532d]/20",
  },
  {
    id: "midnight",
    name: "Midnight Stars",
    bg: "bg-[#111622] dark:bg-[#0d121c]",
    border: "border-[#253047] dark:border-[#1e2738]",
    ruleColor: "rgba(100, 140, 200, 0.2)",
    marginColor: "rgba(96, 165, 250, 0.4)",
    spine: "bg-[#1e3a8a]/30",
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
  },
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
  },
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
  },
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
  },
];

/* -------------------------------------------------------------------------- */
/* Main Component                                                             */
/* -------------------------------------------------------------------------- */

export default function WellnessPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"journal" | "mood" | "game">("journal");

  /* ---- Journal State ---- */
  const [journalMode, setJournalMode] = useState<"guided" | "free">("guided");
  const [selectedPromptCategory, setSelectedPromptCategory] = useState(GUIDED_CATEGORIES[0].id);
  const [activePromptIndex, setActivePromptIndex] = useState(0);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [selectedInk, setSelectedInk] = useState(INK_COLORS[0]);
  const [paperTheme, setPaperTheme] = useState(PAPER_THEMES[0]);
  const [stickers, setStickers] = useState<PlacedSticker[]>([]);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);

  /* ---- Mood State ---- */
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [todayMood, setTodayMood] = useState<number | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  /* ---- Loaders ---- */
  const loadJournal = useCallback(async () => {
    try {
      const res = await authFetch("/journal");
      if (res.ok) {
        setEntries(await res.json());
      }
    } catch {
      // offline or unauthenticated fallback
    }
  }, []);

  const loadMoods = useCallback(async () => {
    try {
      const res = await authFetch("/mood");
      if (res.ok) {
        const data: MoodEntry[] = await res.json();
        setMoods(data);
        setTodayMood(data.find((m) => m.day_utc === today)?.mood ?? null);
      }
    } catch {
      // fallback
    }
  }, [today]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const j = await authFetch("/journal");
        if (!cancelled && j.ok) setEntries(await j.json());
      } catch { /* offline */ }
      try {
        const m = await authFetch("/mood");
        if (!cancelled && m.ok) {
          const data: MoodEntry[] = await m.json();
          setMoods(data);
          setTodayMood(data.find((x) => x.day_utc === today)?.mood ?? null);
        }
      } catch { /* offline */ }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [today]);

  /* ---- Actions ---- */
  const currentCategory = GUIDED_CATEGORIES.find((c) => c.id === selectedPromptCategory) || GUIDED_CATEGORIES[0];
  const currentPrompt = currentCategory.prompts[activePromptIndex % currentCategory.prompts.length];

  const cyclePrompt = () => {
    setActivePromptIndex((prev) => (prev + 1) % currentCategory.prompts.length);
  };

  const applyPromptToDraft = (promptText: string) => {
    if (!draftTitle) {
      setDraftTitle(promptText.slice(0, 70));
    }
    setDraftContent((prev) => (prev ? `${prev}\n\n[Prompt: ${promptText}]\n` : `[Prompt: ${promptText}]\n\n`));
  };

  const addSticker = (emoji: string) => {
    setStickers((prev) => {
      const idx = prev.length;
      const x = 12 + ((idx * 37) % 65);
      const y = 14 + ((idx * 53) % 60);
      const rotation = ((idx * 19) % 31) - 15;
      const newSticker: PlacedSticker = {
        id: `stk-${idx}-${emoji}-${prev.length}`,
        emoji,
        x,
        y,
        rotation,
      };
      return [...prev, newSticker];
    });
  };

  const removeSticker = (id: string) => {
    setStickers((prev) => prev.filter((s) => s.id !== id));
  };

  const saveEntry = async () => {
    if (!draftContent.trim()) return;
    setSavingEntry(true);
    setSavedSuccess(false);

    // Embed sticker & theme metadata cleanly as a structured trailer
    let finalContent = draftContent;
    if (stickers.length > 0 || paperTheme.id !== "parchment" || selectedInk.id !== "slate") {
      const meta = {
        stickers,
        paper: paperTheme.id,
        ink: selectedInk.id,
      };
      finalContent = `${draftContent}\n\n<!-- glow-decorations: ${JSON.stringify(meta)} -->`;
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
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3500);
        await loadJournal();
      }
    } finally {
      setSavingEntry(false);
    }
  };

  const setMood = async (mood: number) => {
    setTodayMood(mood);
    try {
      await authFetch("/mood", { method: "POST", json: { mood } });
      await loadMoods();
    } catch {
      // fallback
    }
  };

  const downloadKeepsake = (entryTitle: string | null, content: string, date: string) => {
    const cleanContent = content.replace(/\n\n<!-- glow-decorations: .* -->$/g, "");
    const header = `Glow Private Journal\nDate: ${new Date(date).toLocaleString()}\nTitle: ${entryTitle || "Untitled"}\n${"-".repeat(40)}\n\n`;
    const blob = new Blob([header + cleanContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `glow-journal-${new Date(date).toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col items-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center gap-2 mb-2 px-3 py-1 rounded-full glass-soft text-xs text-primary font-medium">
          <BookHeart className="size-3.5" />
          <span>{t("wellness.title")}</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-center tracking-tight">
          Your Mindful Sanctuary
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
          Private, encrypted expressive journaling, gentle mood rhythm tracking, and resting practices.
        </p>
      </div>

      {/* Main Tabs */}
      <div className="flex justify-center gap-2 mb-8">
        {(
          [
            ["journal", "Private Notebook", BookHeart],
            ["mood", t("wellness.tab.mood"), LineChart],
            ["game", t("wellness.tab.game"), Target],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-xs sm:text-sm font-medium transition-all ${
              tab === key
                ? "aurora halo text-primary-foreground shadow-md"
                : "glass-soft text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Tab: Journal Notebook                                                */}
      {/* -------------------------------------------------------------------- */}
      {tab === "journal" && (
        <section className="space-y-8 animate-in fade-in duration-300">
          {/* Dual Mode Switcher: Guided vs Free */}
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
                <Sparkles className="size-3.5" />
                Guided Reflection
              </button>
              <button
                onClick={() => setJournalMode("free")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                  journalMode === "free"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                <Feather className="size-3.5" />
                Free-Flow Notebook
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4 text-emerald-500" />
              <span>AES-GCM Envelope Encrypted</span>
            </div>
          </div>

          {/* Guided Mode Toolbar & Prompt Card */}
          {journalMode === "guided" && (
            <div className="glass rounded-3xl p-5 space-y-4 border border-border/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
                  Choose a Reflection Theme
                </span>
                <button
                  onClick={cyclePrompt}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  <RefreshCw className="size-3" />
                  Shuffle Prompt
                </button>
              </div>

              {/* Theme Selector Pills */}
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
                      <div className="text-xs font-medium truncate">{cat.title}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Active Prompt Box */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-[11px] font-medium text-primary">Today&apos;s Gentle Prompt</div>
                  <p className="text-sm font-serif italic text-foreground leading-relaxed">
                    &ldquo;{currentPrompt}&rdquo;
                  </p>
                </div>
                <button
                  onClick={() => applyPromptToDraft(currentPrompt)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium transition-colors"
                >
                  <Plus className="size-3" />
                  Use in Journal
                </button>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- */}
          {/* Authentic Real Notebook Container                                */}
          {/* ---------------------------------------------------------------- */}
          <div className="relative group">
            {/* Real Notebook Edge / Cover Shadow */}
            <div
              className={`relative rounded-3xl overflow-hidden border shadow-xl transition-all ${paperTheme.bg} ${paperTheme.border}`}
            >
              {/* Notebook Top Bar: Tooling (Paper Vibe, Ink Color, Sticker Stamp) */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-border/30 bg-muted/20">
                <div className="flex items-center gap-3">
                  {/* Left Spiral / Binding Accent */}
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-border" />
                    <span className="size-2 rounded-full bg-border" />
                    <span className="size-2 rounded-full bg-border" />
                  </div>
                  <span className="text-xs font-mono font-medium text-muted-foreground">
                    {new Date().toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                {/* Customization Toolbar */}
                <div className="flex items-center gap-2">
                  {/* Ink Color Button */}
                  <div className="relative">
                    <button
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg glass-soft text-xs text-muted-foreground hover:text-foreground"
                      title="Choose Pen Ink Color"
                    >
                      <Palette className="size-3.5" />
                      <span
                        className="size-2.5 rounded-full border border-border"
                        style={{ backgroundColor: selectedInk.hex }}
                      />
                    </button>

                    {showColorPicker && (
                      <div className="absolute right-0 top-8 z-30 p-2 rounded-xl glass shadow-xl border border-border flex gap-1.5 animate-in fade-in zoom-in-95">
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
                            title={ink.label}
                          >
                            {selectedInk.id === ink.id && <Check className="size-3 text-white" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Paper Vibe Theme Picker */}
                  <div className="flex items-center gap-1">
                    {PAPER_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => setPaperTheme(theme)}
                        className={`size-4 rounded-full border transition-all ${
                          paperTheme.id === theme.id ? "scale-125 ring-1.5 ring-primary" : "opacity-60"
                        }`}
                        style={{
                          backgroundColor: theme.id === "midnight" ? "#111622" : theme.id === "lavender" ? "#faf7fd" : theme.id === "sage" ? "#f6faf7" : "#fdfaf3",
                        }}
                        title={theme.name}
                      />
                    ))}
                  </div>

                  {/* Sticker Stamp Bar Toggle */}
                  <button
                    onClick={() => setShowStickerPicker(!showStickerPicker)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      showStickerPicker ? "bg-primary text-primary-foreground" : "glass-soft text-muted-foreground hover:text-foreground"
                    }`}
                    title="Decorate with Calming Stickers"
                  >
                    <Sticker className="size-3.5" />
                    <span>Stickers</span>
                  </button>
                </div>
              </div>

              {/* Sticker Selector Palette Dropdown / Ribbon */}
              {showStickerPicker && (
                <div className="px-5 py-2.5 bg-primary/5 border-b border-border/30 flex flex-wrap items-center gap-2 animate-in fade-in duration-200">
                  <span className="text-[11px] text-muted-foreground mr-1">Tap to stamp:</span>
                  {STICKER_PALETTE.map((stk) => (
                    <button
                      key={stk}
                      onClick={() => addSticker(stk)}
                      className="text-lg p-1 hover:scale-125 transition-transform"
                      title="Stamp on page"
                    >
                      {stk}
                    </button>
                  ))}
                  {stickers.length > 0 && (
                    <button
                      onClick={() => setStickers([])}
                      className="ml-auto text-[11px] text-muted-foreground hover:text-rose-500 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="size-3" />
                      Clear stickers
                    </button>
                  )}
                </div>
              )}

              {/* -------------------------------------------------------------- */}
              {/* Notebook Paper Surface with Ruled Lines & Red Margin Line       */}
              {/* -------------------------------------------------------------- */}
              <div
                className="relative min-h-[380px] p-6 sm:p-8"
                style={{
                  backgroundImage: `repeating-linear-gradient(transparent, transparent 31px, ${paperTheme.ruleColor} 31px, ${paperTheme.ruleColor} 32px)`,
                  backgroundSize: "100% 32px",
                }}
              >
                {/* Vertical Red / Margin Guide Line */}
                <div
                  className="absolute top-0 bottom-0 left-12 sm:left-16 w-px pointer-events-none"
                  style={{ backgroundColor: paperTheme.marginColor }}
                />

                {/* Spine Stitch Perforations */}
                <div className="absolute top-0 bottom-0 left-3 flex flex-col justify-around py-4 pointer-events-none opacity-40">
                  {[...Array(12)].map((_, i) => (
                    <span key={i} className="size-1.5 rounded-full bg-muted-foreground/30" />
                  ))}
                </div>

                {/* Canvas Overlay for Placed Stickers */}
                {stickers.map((stk) => (
                  <div
                    key={stk.id}
                    onClick={() => removeSticker(stk.id)}
                    className="absolute select-none cursor-pointer hover:scale-125 transition-transform group/stk"
                    style={{
                      left: `${stk.x}%`,
                      top: `${stk.y}%`,
                      transform: `rotate(${stk.rotation}deg)`,
                    }}
                    title="Click to remove sticker"
                  >
                    <span className="text-2xl drop-shadow-sm">{stk.emoji}</span>
                    <span className="hidden group-hover/stk:inline-block absolute -top-2 -right-2 text-[9px] bg-rose-500 text-white rounded-full size-3.5 text-center leading-3">
                      ×
                    </span>
                  </div>
                ))}

                {/* Notebook Title Input */}
                <div className="pl-10 sm:pl-12 mb-3">
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    maxLength={100}
                    placeholder="Title of this page (optional)..."
                    className="w-full bg-transparent font-serif text-lg sm:text-xl font-medium focus:outline-none placeholder:text-muted-foreground/40 placeholder:font-sans"
                    style={{
                      color: selectedInk.hex,
                      lineHeight: "32px",
                    }}
                  />
                </div>

                {/* Notebook Textarea Lined to Exactly 32px height */}
                <div className="pl-10 sm:pl-12">
                  <textarea
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    rows={9}
                    maxLength={15000}
                    placeholder="Write whatever is in your heart... This page is entirely yours, unjudged and private."
                    className="w-full bg-transparent resize-y font-serif text-sm sm:text-base focus:outline-none placeholder:text-muted-foreground/40 placeholder:font-sans placeholder:italic"
                    style={{
                      color: selectedInk.hex,
                      lineHeight: "32px",
                      paddingTop: "4px",
                    }}
                  />
                </div>
              </div>

              {/* Notebook Footer Bar: Word Count & Save */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-border/30 bg-muted/10">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {draftContent.trim() ? draftContent.trim().split(/\s+/).length : 0} words
                  </span>
                  {stickers.length > 0 && (
                    <span>· {stickers.length} sticker{stickers.length > 1 ? "s" : ""} placed</span>
                  )}
                  {savedSuccess && (
                    <span className="flex items-center gap-1 text-emerald-500 font-medium animate-in fade-in">
                      <Check className="size-3.5" />
                      Saved safely to your journal
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {draftContent.trim() && (
                    <button
                      onClick={() => {
                        setDraftTitle("");
                        setDraftContent("");
                        setStickers([]);
                      }}
                      className="px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-rose-500 transition-colors"
                    >
                      Clear page
                    </button>
                  )}
                  <button
                    onClick={saveEntry}
                    disabled={!draftContent.trim() || savingEntry}
                    className="aurora halo rounded-full px-6 py-2 text-xs font-medium text-primary-foreground flex items-center gap-2 disabled:opacity-50 transition-transform active:scale-95 shadow-sm"
                  >
                    {savingEntry ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                    Save to Journal
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Past Journal Entries / Keepsake Gallery                          */}
          {/* ---------------------------------------------------------------- */}
          <div className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                <BookOpen className="size-4 text-primary" />
                Previous Keepsakes
              </h2>
              <span className="text-xs text-muted-foreground">
                {entries ? `${entries.length} entries` : "Loading..."}
              </span>
            </div>

            {(entries ?? []).map((e) => {
              // Extract stickers/decorations if present in content
              const metaMatch = e.content.match(/\n\n<!-- glow-decorations: (.*) -->$/);
              let decoMeta: { stickers?: PlacedSticker[]; paper?: string; ink?: string } | null = null;
              let displayContent = e.content;
              if (metaMatch) {
                try {
                  decoMeta = JSON.parse(metaMatch[1]);
                  displayContent = e.content.replace(/\n\n<!-- glow-decorations: .* -->$/, "");
                } catch {
                  // ignore parse error
                }
              }

              return (
                <article
                  key={e.id}
                  className="glass rounded-2xl p-5 border border-border/50 hover:border-primary/30 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <h3 className="font-display font-semibold text-base text-foreground">
                        {e.title || "Untitled Reflection"}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(e.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                        {e.mood_at_write && (
                          <span className="flex items-center gap-1">
                            · Mood {MOOD_FACES[e.mood_at_write - 1]}
                          </span>
                        )}
                        {decoMeta?.stickers && decoMeta.stickers.length > 0 && (
                          <span className="flex items-center gap-0.5">
                            · {decoMeta.stickers.slice(0, 3).map((s) => s.emoji).join(" ")}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => downloadKeepsake(e.title, e.content, e.created_at)}
                      className="p-2 rounded-lg glass-soft hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Export entry to text file"
                    >
                      <Download className="size-3.5" />
                    </button>
                  </div>

                  <p className="font-serif text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 pl-3 border-l-2 border-primary/30">
                    {displayContent}
                  </p>
                </article>
              );
            })}

            {entries?.length === 0 && (
              <div className="text-center py-12 glass rounded-2xl space-y-2 border border-border/40">
                <BookHeart className="size-8 text-muted-foreground/50 mx-auto" />
                <p className="text-sm font-medium text-foreground">Your journal is waiting for its first page</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Take a breath, choose a gentle prompt or write freely. Nothing here is graded.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Tab: Mood Rhythm                                                     */}
      {/* -------------------------------------------------------------------- */}
      {tab === "mood" && (
        <section className="space-y-6 animate-in fade-in duration-300">
          <div className="glass rounded-3xl p-6 sm:p-8 text-center space-y-4">
            <h3 className="font-display text-xl font-semibold">{t("wellness.mood.howToday")}</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Checking in takes 5 seconds. There are no right or wrong answers — every feeling has room to exist.
            </p>
            <div className="mt-5 flex justify-center gap-2 sm:gap-4 flex-wrap">
              {MOOD_FACES.map((face, i) => {
                const v = i + 1;
                return (
                  <button
                    key={v}
                    onClick={() => setMood(v)}
                    aria-label={`Mood ${v} of 7`}
                    className={`text-3xl sm:text-4xl rounded-2xl p-2 sm:p-3 transition-all hover:scale-110 ${
                      todayMood === v
                        ? "bg-primary/20 ring-2 ring-primary scale-110 shadow-md"
                        : "opacity-60 hover:opacity-100 glass-soft"
                    }`}
                  >
                    {face}
                  </button>
                );
              })}
            </div>
            {todayMood && (
              <p className="text-xs text-emerald-500 font-medium animate-in fade-in">
                Logged for today. Come back tomorrow — consistency matters more than the score.
              </p>
            )}
          </div>

          <div className="glass rounded-3xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-base">{t("wellness.mood.last14")}</h3>
              <span className="text-xs text-muted-foreground">Patterns over days</span>
            </div>

            {moods.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">{t("wellness.mood.empty")}</p>
            ) : (
              <div className="flex items-end gap-2 h-36 pt-6">
                {moods.slice(-14).map((m) => (
                  <div key={m.day_utc} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                    <span className="absolute -top-7 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity bg-popover px-1.5 py-0.5 rounded shadow">
                      {MOOD_FACES[m.mood - 1]} {m.day_utc.slice(5)}
                    </span>
                    <div
                      className="w-full rounded-t-lg aurora transition-all"
                      style={{ height: `${(m.mood / 7) * 100}%`, minHeight: "10px" }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {m.day_utc.slice(8)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground/70 text-center pt-2">
              Trends over time are what matter — a single day never tells the whole story.
            </p>
          </div>
        </section>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Tab: Mindful Breathing Focus Game                                    */}
      {/* -------------------------------------------------------------------- */}
      {tab === "game" && <BreathingGame />}
    </main>
  );
}

/** Breathing-focus mini game: expand/shrink circle, tap on the beat.
 *  Grounded in paced-breathing research (slow exhale > inhale calms arousal). */
function BreathingGame() {
  const { t } = useLanguage();
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<"inhale" | "exhale" | "idle">("idle");
  const [running, setRunning] = useState(false);
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<"inhale" | "exhale">("inhale");
  const tRef = useRef(0);

  const start = () => {
    setScore(0);
    setRunning(true);
    phaseRef.current = "inhale";
    tRef.current = 0;
    setPhase("inhale");
    // 4s in, 6s out — classic 4-6 paced breathing
    cycleRef.current = setInterval(() => {
      tRef.current += 0.5;
      if (phaseRef.current === "inhale" && tRef.current >= 4) {
        phaseRef.current = "exhale";
        setPhase("exhale");
        tRef.current = 0;
      } else if (phaseRef.current === "exhale" && tRef.current >= 6) {
        phaseRef.current = "inhale";
        setPhase("inhale");
        tRef.current = 0;
        setScore((s) => s + 1); // one full breath completed
      }
    }, 500);
  };

  const stop = () => {
    if (cycleRef.current) clearInterval(cycleRef.current);
    setRunning(false);
    setPhase("idle");
    setBest((b) => Math.max(b, score));
  };

  useEffect(() => () => { if (cycleRef.current) clearInterval(cycleRef.current); }, []);

  return (
    <section className="animate-in fade-in duration-300 space-y-6">
      <div className="glass rounded-3xl p-10 flex flex-col items-center">
        <div
          className={`aurora halo rounded-full transition-all ease-in-out ${
            running && phase === "inhale"
              ? "size-40 duration-[4000ms]"
              : running && phase === "exhale"
                ? "size-24 duration-[6000ms]"
                : "size-28 duration-700"
          }`}
        />
        <p className="mt-8 text-sm text-muted-foreground h-5">
          {running ? (phase === "inhale" ? t("wellness.game.inhale") : t("wellness.game.exhale")) : ""}
        </p>
        <div className="mt-6 flex items-center gap-6">
          <span className="font-display text-3xl font-semibold">{score}</span>
          <span className="text-xs text-muted-foreground">
            breaths · best {Math.max(best, score)}
          </span>
        </div>
        {!running ? (
          <button
            onClick={start}
            className="aurora halo mt-8 rounded-full px-8 py-3.5 text-sm font-medium text-primary-foreground flex items-center gap-2"
          >
            <Sparkles className="size-4" />
            Begin
          </button>
        ) : (
          <button
            onClick={stop}
            className="glass-soft mt-8 rounded-full px-8 py-3.5 text-sm"
          >
            Finish
          </button>
        )}
      </div>
      <p className="text-center text-[11px] text-muted-foreground/70">
        Paced breathing at ~5.5 breaths/min is associated with reduced
        physiological arousal. Not a medical treatment — just a moment of calm.
      </p>
    </section>
  );
}
