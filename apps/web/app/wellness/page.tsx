"use client";

/**
 * Wellness Hub — expressive journal studio, multi-emotion mood rhythm chart,
 * and a paced-breathing focus game.
 *
 * Journal entries are client-composed and server-side envelope-encrypted
 * using AES-GCM via the backend KMS service.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookHeart,
  Check,
  Heart,
  LineChart,
  Loader2,
  Plus,
  Sparkles,
  Sun,
  Target,
} from "lucide-react";
import { authFetch } from "../../lib/auth";
import { useLanguage } from "../../contexts/LanguageContext";
import JournalStudio from "../../components/JournalStudio";

/* -------------------------------------------------------------------------- */
/* Types & constants                                                          */
/* -------------------------------------------------------------------------- */

type MoodEntry = {
  id: number;
  day_utc: string;
  mood: number;
  emotions: string[];
  note: string | null;
  created_at: string;
};

type Emotion = {
  label: string;
  emoji: string;
  nameEs?: string;
  nameFr?: string;
  nameAr?: string;
};

const MOOD_FACES = ["😞", "🙁", "😐", "🙂", "😊", "😄", "🤩"]; // 1..7
const MOOD_LABELS = [
  "Very low",
  "Low",
  "A little low",
  "Okay",
  "Good",
  "Really good",
  "Great",
];

const EMOTION_GROUPS: {
  id: string;
  label: string;
  hint: string;
  labelEs?: string;
  labelFr?: string;
  labelAr?: string;
  hintEs?: string;
  hintFr?: string;
  hintAr?: string;
  emotions: Emotion[];
}[] = [
  {
    id: "heavy",
    label: "Heavy",
    hint: "Sadness, grief, loneliness",
    emotions: [
      { label: "sad", emoji: "😢" , nameEs: "Triste", nameFr: "Triste", nameAr: "حزين" },
      { label: "lonely", emoji: "🫂" , nameEs: "Solo", nameFr: "Seul", nameAr: "وحيد" },
      { label: "hopeless", emoji: "🌧️" , nameEs: "Sin esperanza", nameFr: "Sans espoir", nameAr: "يائس" },
      { label: "grieving", emoji: "🕯️" , nameEs: "En duelo", nameFr: "En deuil", nameAr: "يحدّ" },
      { label: "ashamed", emoji: "🫥" , nameEs: "Avergonzado", nameFr: "Honteux", nameAr: "خجل" },
      { label: "numb", emoji: "🌫️" , nameEs: "Adormecido", nameFr: "Engourdi", nameAr: "خدر" },
    ],
  
    labelEs: "Pesado", labelFr: "Lourd", labelAr: "ثقيل",
    hintEs: "Tristeza, duelo, soledad", hintFr: "Tristesse, deuil, solitude", hintAr: "حزن، حداد، وحدة",},
  {
    id: "activated",
    label: "Activated",
    hint: "Anxiety, anger, pressure",
    emotions: [
      { label: "anxious", emoji: "😰" , nameEs: "Ansioso", nameFr: "Anxieux", nameAr: "قلق" },
      { label: "overwhelmed", emoji: "🌪️" , nameEs: "Abrumado", nameFr: "Débordé", nameAr: "مُرهَق" },
      { label: "angry", emoji: "🔥" , nameEs: "Enojado", nameFr: "En colère", nameAr: "غاضب" },
      { label: "restless", emoji: "⚡" , nameEs: "Inquieto", nameFr: "Agité", nameAr: "متململ" },
      { label: "scared", emoji: "😨" , nameEs: "Asustado", nameFr: "Effrayé", nameAr: "خائف" },
      { label: "stressed", emoji: "😖" , nameEs: "Estresado", nameFr: "Stressé", nameAr: "مُجهد" },
    ],
  
    labelEs: "Activado", labelFr: "Activé", labelAr: "مُفعَّل",
    hintEs: "Ansiedad, ira, presión", hintFr: "Anxiété, colère, pression", hintAr: "قلق، غضب، ضغط",},
  {
    id: "calm",
    label: "Calm",
    hint: "Peace, hope, connection",
    emotions: [
      { label: "calm", emoji: "😌" , nameEs: "En calma", nameFr: "Calme", nameAr: "هادئ" },
      { label: "hopeful", emoji: "🌱" , nameEs: "Esperanzado", nameFr: "Plein d'espoir", nameAr: "مفعم بالأمل" },
      { label: "grateful", emoji: "🙏" , nameEs: "Agradecido", nameFr: "Reconnaissant", nameAr: "ممتن" },
      { label: "content", emoji: "🍃" , nameEs: "Contento", nameFr: "Apaisé", nameAr: "راضٍ" },
      { label: "safe", emoji: "🛡️" , nameEs: "Seguro", nameFr: "En sécurité", nameAr: "آمن" },
      { label: "peaceful", emoji: "🕊️" , nameEs: "En paz", nameFr: "Paisible", nameAr: "مطمئن" },
    ],
  
    labelEs: "Calma", labelFr: "Calme", labelAr: "هدوء",
    hintEs: "Paz, esperanza, conexión", hintFr: "Paix, espoir, lien", hintAr: "سلام، أمل، تواصل",},
  {
    id: "tired",
    label: "Low energy",
    hint: "Fatigue, fog, quiet",
    emotions: [
      { label: "tired", emoji: "😴" , nameEs: "Cansado", nameFr: "Fatigué", nameAr: "متعب" },
      { label: "drained", emoji: "🪫" , nameEs: "Agotado", nameFr: "Épuisé", nameAr: "مُستنزف" },
      { label: "foggy", emoji: "🌁" , nameEs: "Con niebla mental", nameFr: "Brouillardeux", nameAr: "ضبابي" },
      { label: "bored", emoji: "😐" , nameEs: "Aburrido", nameFr: "Ennuyé", nameAr: "ملول" },
      { label: "aching", emoji: "🤕" , nameEs: "Adolorido", nameFr: "Douloureux", nameAr: "مُوجع" },
      { label: "quiet", emoji: "🤫" , nameEs: "Tranquilo", nameFr: "Silencieux", nameAr: "هادئ" },
    ],
  
    labelEs: "Baja energía", labelFr: "Basse énergie", labelAr: "طاقة منخفضة",
    hintEs: "Cansancio, niebla mental, quietud", hintFr: "Fatigue, brouillard mental, quiétude", hintAr: "إرهاق، ضباب ذهني، هدوء",},
];

const EMOTION_EMOJI: Record<string, string> = Object.fromEntries(
  EMOTION_GROUPS.flatMap((g) => g.emotions.map((e) => [e.label, e.emoji])),
);

function dayKey(offsetDays = 0): string {
  return new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function moodColor(mood: number): string {
  if (mood <= 2) return "#f43f5e";
  if (mood <= 3) return "#fb923c";
  if (mood <= 4) return "#facc15";
  if (mood <= 5) return "#4ade80";
  if (mood <= 6) return "#34d399";
  return "#22d3ee";
}

function shortDayLabel(key: string): string {
  const date = new Date(`${key}T12:00:00`);
  return date.toLocaleDateString(undefined, { day: "numeric" });
}

/* -------------------------------------------------------------------------- */
/* Mood tracker                                                               */
/* -------------------------------------------------------------------------- */

function MoodTracker() {
  const { t, language } = useLanguage();
  const loc = language === "en" ? "" : (language[0].toUpperCase() + language.slice(1)) as "" | "Es" | "Fr" | "Ar";
  const moodLabel = (mood: number) => {
    const keys = ["mood.veryLow", "mood.low", "mood.okay", "mood.okay", "mood.good", "mood.good", "mood.great"] as const;
    return t(keys[mood - 1] as keyof typeof keys[keyof typeof keys]);
  };
  const emotionDisplayName = (label: string) => {
    for (const g of EMOTION_GROUPS) {
      for (const e of g.emotions) {
        if (e.label === label) {
          return loc === "Es"
            ? e.nameEs ?? label
            : loc === "Fr"
              ? e.nameFr ?? label
              : loc === "Ar"
                ? e.nameAr ?? label
                : label[0].toUpperCase() + label.slice(1);
        }
      }
    }
    return label;
  };
  const [moods, setMoods] = useState<MoodEntry[] | null>(null);
  const [selectedMood, setSelectedMood] = useState(4);
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [todayKey, setTodayKey] = useState<string | null>(null);

  useEffect(() => {
    setTodayKey(dayKey());
  }, []);

  const loadMoods = useCallback(async () => {
    try {
      const res = await authFetch("/mood");
      if (res.ok) setMoods((await res.json()) as MoodEntry[]);
    } catch {
      // Offline or unauthenticated — keep the page usable.
    }
  }, []);

  useEffect(() => {
    void loadMoods();
  }, [loadMoods]);

  const toggleEmotion = (label: string) => {
    setSelectedEmotions((prev) =>
      prev.includes(label)
        ? prev.filter((e) => e !== label)
        : prev.length >= 8
          ? prev
          : [...prev, label],
    );
  };

  const saveCheckin = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await authFetch("/mood", {
        method: "POST",
        json: {
          mood: selectedMood,
          emotions: selectedEmotions,
          note: note.trim() || undefined,
        },
      });
      if (res.ok) {
        setSelectedEmotions([]);
        setNote("");
        setSaved(true);
        window.setTimeout(() => setSaved(false), 4000);
        await loadMoods();
      }
    } finally {
      setSaving(false);
    }
  };

  const allEntries = moods ?? [];
  const todayEntries = todayKey
    ? allEntries.filter((entry) => entry.day_utc === todayKey)
    : [];

  const days = todayKey
    ? Array.from({ length: 14 }, (_, index) => dayKey(13 - index))
    : [];
  const byDay = new Map<string, MoodEntry[]>();
  for (const entry of allEntries) {
    const list = byDay.get(entry.day_utc) ?? [];
    list.push(entry);
    byDay.set(entry.day_utc, list);
  }

  const recentEmotionCounts = new Map<string, number>();
  const cutoff = dayKey(6);
  for (const entry of allEntries) {
    if (entry.day_utc < cutoff) continue;
    for (const emotion of entry.emotions) {
      recentEmotionCounts.set(emotion, (recentEmotionCounts.get(emotion) ?? 0) + 1);
    }
  }
  const topEmotions = [...recentEmotionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxEmotionCount = Math.max(1, ...topEmotions.map(([, count]) => count));

  return (
    <section className="space-y-6 animate-in fade-in duration-300">
      {/* Check-in card */}
      <div className="glass rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <h3 className="font-display text-xl sm:text-2xl font-semibold">
            {t("wellness.mood.howToday")}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {t("moodTracker.intro")}
          </p>
        </div>

        {/* Overall mood */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("moodTracker.overall")}
            </span>
            <span className="text-xs font-medium text-foreground">
              {moodLabel(selectedMood)}
            </span>
          </div>
          <div className="flex justify-center gap-1.5 sm:gap-3 flex-wrap">
            {MOOD_FACES.map((face, index) => {
              const value = index + 1;
              const active = selectedMood === value;
              return (
                <button
                  key={value}
                  onClick={() => setSelectedMood(value)}
                  aria-label={`Mood ${value} of 7: ${moodLabel(value)}`}
                  aria-pressed={active}
                  className={`text-3xl sm:text-4xl rounded-2xl p-2 sm:p-3 transition-all hover:scale-110 ${
                    active
                      ? "bg-primary/20 ring-2 ring-primary scale-110 shadow-md"
                      : "opacity-60 hover:opacity-100 glass-soft"
                  }`}
                >
                  {face}
                </button>
              );
            })}
          </div>
        </div>

        {/* Multiple emotions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("moodTracker.extra")}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {t("moodTracker.selected").replace("{n}", String(selectedEmotions.length))}
            </span>
          </div>

          <div className="space-y-3">
            {EMOTION_GROUPS.map((group) => (
              <div key={group.id} className="space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-medium text-foreground/80">
                    {loc === "Es" ? group.labelEs ?? group.label : loc === "Fr" ? group.labelFr ?? group.label : loc === "Ar" ? group.labelAr ?? group.label : group.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {loc === "Es" ? group.hintEs ?? group.hint : loc === "Fr" ? group.hintFr ?? group.hint : loc === "Ar" ? group.hintAr ?? group.hint : group.hint}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {group.emotions.map((emotion) => {
                    const active = selectedEmotions.includes(emotion.label);
                    return (
                      <button
                        key={emotion.label}
                        onClick={() => toggleEmotion(emotion.label)}
                        aria-pressed={active}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] sm:text-xs transition-all ${
                          active
                            ? "border-primary/50 bg-primary/15 text-foreground ring-1 ring-primary/30"
                            : "border-border/50 glass-soft text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span aria-hidden>{emotion.emoji}</span>
                        <span>
                          {loc === "Es"
                            ? emotion.nameEs ?? emotion.label
                            : loc === "Fr"
                              ? emotion.nameFr ?? emotion.label
                              : loc === "Ar"
                                ? emotion.nameAr ?? emotion.label
                                : emotion.label[0].toUpperCase() + emotion.label.slice(1)}
                        </span>
                        {active && <Check className="size-3 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Note */}
        <div className="space-y-1.5">
          <label
            htmlFor="mood-note"
            className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {t("moodTracker.noteLabel")}
          </label>
          <input
            id="mood-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={280}
            placeholder={t("moodTracker.notePh")}
            className="w-full rounded-2xl border border-border/50 bg-background/40 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground min-h-5">
            {saved ? (
              <span className="flex items-center gap-1.5 text-emerald-500 font-medium animate-in fade-in">
                <Check className="size-3.5" /> {t("moodTracker.savedMsg")}
              </span>
            ) : todayEntries.length > 0 ? (
              <span>
                {t("moodTracker.todayMany").replace("{n}", String(todayEntries.length))}
              </span>
            ) : (
              <span>{t("moodTracker.todayNone")}</span>
            )}
          </div>
          <button
            onClick={() => void saveCheckin()}
            disabled={saving}
            className="aurora halo rounded-full px-6 py-2.5 text-xs font-medium text-primary-foreground flex items-center gap-2 disabled:opacity-50 transition-transform active:scale-95"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            {t("moodTracker.add")}
          </button>
        </div>
      </div>

      {/* Today's check-ins */}
      {todayEntries.length > 0 && (
        <div className="glass rounded-3xl p-6 sm:p-8 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-base flex items-center gap-2">
              <Heart className="size-4 text-primary" />
              {t("moodTracker.weather")}
            </h3>
            <span className="text-xs text-muted-foreground">{t("moodTracker.moments").replace("{n}", String(todayEntries.length))}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {todayEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-border/40 glass-soft px-3 py-2.5 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">
                    {MOOD_FACES[entry.mood - 1]} {moodLabel(entry.mood)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(entry.created_at).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {entry.emotions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {entry.emotions.map((emotion) => (
                      <span
                        key={`${entry.id}-${emotion}`}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary capitalize"
                      >
                        {EMOTION_EMOJI[emotion] ?? "•"} {emotionDisplayName(emotion)}
                      </span>
                    ))}
                  </div>
                )}
                {entry.note && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{entry.note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 14-day chart */}
      <div className="glass rounded-3xl p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-base">{t("wellness.mood.last14")}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Every dot is one check-in. Days can hold several different feelings.
            </p>
          </div>
          <LineChart className="size-4 text-primary shrink-0" />
        </div>

        {!moods ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : allEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {t("wellness.mood.empty")}
          </p>
        ) : (
          <div className="space-y-2">
            <div className="relative h-40">
              {/* Soft grid lines */}
              {[0, 25, 50, 75, 100].map((top) => (
                <div
                  key={top}
                  className="absolute left-0 right-0 border-t border-border/30"
                  style={{ top: `${top}%` }}
                />
              ))}

              <div className="relative z-10 flex h-full items-stretch gap-1">
                {days.map((day) => {
                  const entries = byDay.get(day) ?? [];
                  return (
                    <div
                      key={day}
                      className="group relative flex-1 rounded-lg hover:bg-primary/5 transition-colors"
                      title={
                        entries.length
                          ? entries
                              .map(
                                (entry) =>
                                  `${moodLabel(entry.mood)}${
                                    entry.emotions.length
                                      ? ` — ${entry.emotions.map((e) => emotionDisplayName(e)).join(", ")}`
                                      : ""
                                  }`,
                              )
                              .join("\n")
                          : t("moodTracker.noCheckin")
                      }
                    >
                      {entries.map((entry, index) => {
                        const count = entries.length;
                        const spread = count > 1 ? 22 : 0;
                        const offset = count > 1 ? (index - (count - 1) / 2) * spread : 0;
                        return (
                          <span
                            key={entry.id}
                            className="absolute size-2.5 rounded-full border border-white/60 shadow-sm transition-transform group-hover:scale-125"
                            style={{
                              bottom: `calc(${((entry.mood - 1) / 6) * 100}% - 5px)`,
                              left: `calc(50% + ${offset}%)`,
                              transform: "translateX(-50%)",
                              backgroundColor: moodColor(entry.mood),
                            }}
                          />
                        );
                      })}
                      {entries.length > 1 && (
                        <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[9px] font-medium text-muted-foreground/70">
                          {entries.length}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-1">
              {days.map((day) => (
                <span
                  key={day}
                  className="flex-1 text-center text-[10px] text-muted-foreground"
                >
                  {shortDayLabel(day)}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: moodColor(1) }} />
                {t("moodTracker.low")}
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: moodColor(4) }} />
                {t("moodTracker.okay")}
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: moodColor(7) }} />
                {t("moodTracker.good")}
              </span>
              <span>{t("moodTracker.multiLegend")}</span>
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground/70 text-center">
          {t("moodTracker.trends")}
        </p>
      </div>

      {/* Emotion frequency */}
      {topEmotions.length > 0 && (
        <div className="glass rounded-3xl p-6 sm:p-8 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-base flex items-center gap-2">
              <Sun className="size-4 text-amber-500" />
              {t("moodTracker.palette")}
            </h3>
            <span className="text-xs text-muted-foreground">{t("moodTracker.last7")}</span>
          </div>
          <div className="space-y-2">
            {topEmotions.map(([emotion, count]) => (
              <div key={emotion} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-muted-foreground capitalize">
                  {EMOTION_EMOJI[emotion] ?? "•"} {emotionDisplayName(emotion)}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full aurora rounded-full transition-all"
                    style={{ width: `${(count / maxEmotionCount) * 100}%` }}
                  />
                </div>
                <span className="w-5 text-right text-[10px] text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/70">
            {t("moodTracker.paletteBody")}
          </p>
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Breathing focus game                                                       */
/* -------------------------------------------------------------------------- */

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
        setScore((s) => s + 1);
      }
    }, 500);
  };

  const stop = () => {
    if (cycleRef.current) clearInterval(cycleRef.current);
    setRunning(false);
    setPhase("idle");
    setBest((b) => Math.max(b, score));
  };

  useEffect(
    () => () => {
      if (cycleRef.current) clearInterval(cycleRef.current);
    },
    [],
  );

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
          <button onClick={stop} className="glass-soft mt-8 rounded-full px-8 py-3.5 text-sm">
            Finish
          </button>
        )}
      </div>
      <p className="text-center text-[11px] text-muted-foreground/70">
        Paced breathing at ~5.5 breaths/min is associated with reduced physiological arousal. Not a
        medical treatment — just a moment of calm.
      </p>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function WellnessPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"journal" | "mood" | "game">("journal");

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
          Private, encrypted expressive journaling, a mood rhythm that can hold more than one
          feeling, and gentle resting practices.
        </p>
      </div>

      {/* Main tabs */}
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

      {tab === "journal" && <JournalStudio />}
      {tab === "mood" && <MoodTracker />}
      {tab === "game" && <BreathingGame />}
    </main>
  );
}
