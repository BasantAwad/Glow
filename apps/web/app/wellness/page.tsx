"use client";

/**
 * Wellness hub — journal, mood chart, and light games.
 * Journal + mood data persist server-side (encrypted content), scoped per user.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BookHeart,
  LineChart,
  Loader2,
  Plus,
  Target,
  Sparkles,
} from "lucide-react";
import { authFetch } from "../../lib/auth";
import { useLanguage } from "../../contexts/LanguageContext";

type JournalEntry = {
  id: number;
  created_at: string;
  title: string | null;
  content: string;
  mood_at_write: number | null;
};

type MoodEntry = { day_utc: string; mood: number; note: string | null };

const MOOD_FACES = ["😞", "🙁", "😐", "🙂", "😊", "😄", "🤩"]; // 1..7

export default function WellnessPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"journal" | "mood" | "game">("journal");

  /* ---- journal state ---- */
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);

  /* ---- mood state ---- */
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [todayMood, setTodayMood] = useState<number | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const loadJournal = useCallback(async () => {
    const res = await authFetch("/journal");
    if (res.ok) setEntries(await res.json());
  }, []);

  const loadMoods = useCallback(async () => {
    const res = await authFetch("/mood");
    if (res.ok) {
      const data: MoodEntry[] = await res.json();
      setMoods(data);
      setTodayMood(data.find((m) => m.day_utc === today)?.mood ?? null);
    }
  }, [today]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const j = await authFetch("/journal");
      if (!cancelled && j.ok) setEntries(await j.json());
      const m = await authFetch("/mood");
      if (!cancelled && m.ok) {
        const data: MoodEntry[] = await m.json();
        setMoods(data);
        setTodayMood(data.find((x) => x.day_utc === today)?.mood ?? null);
      }
    };
    void run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveEntry = async () => {
    if (!draftContent.trim()) return;
    setSavingEntry(true);
    try {
      await authFetch("/journal", {
        method: "POST",
        json: {
          title: draftTitle || undefined,
          content: draftContent,
          mood_at_write: todayMood ?? undefined,
        },
      });
      setDraftTitle("");
      setDraftContent("");
      await loadJournal();
    } finally {
      setSavingEntry(false);
    }
  };

  const setMood = async (mood: number) => {
    setTodayMood(mood);
    await authFetch("/mood", { method: "POST", json: { mood } });
    loadMoods();
  };

  return (
    <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10">
      <div className="flex flex-col items-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="font-display text-3xl font-semibold">{t("wellness.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          Small practices, real evidence. All private to you.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-8">
        {(
          [
            ["journal", t("wellness.tab.journal"), BookHeart],
            ["mood", t("wellness.tab.mood"), LineChart],
            ["game", t("wellness.tab.game"), Target],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-colors ${
              tab === key ? "aurora halo text-primary-foreground" : "glass-soft"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Journal */}
      {tab === "journal" && (
        <section className="space-y-6 animate-in fade-in duration-300">
          <div className="glass rounded-3xl p-6 space-y-4">
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              maxLength={120}
              placeholder={t("wellness.journal.titlePh")}
              className="w-full glass-soft rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <textarea
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              rows={6}
              maxLength={20000}
              placeholder={t("wellness.journal.writePh")}
              className="w-full glass-soft rounded-xl px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={saveEntry}
              disabled={!draftContent.trim() || savingEntry}
              className="aurora rounded-full px-6 py-2.5 text-xs font-medium text-primary-foreground flex items-center gap-2 disabled:opacity-50"
            >
              {savingEntry ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Save entry
            </button>
          </div>

          {(entries ?? []).map((e) => (
            <article key={e.id} className="glass rounded-3xl p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-display font-semibold">{e.title || t("wellness.journal.entryTitle")}</h3>
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {new Date(e.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                {e.content}
              </p>
            </article>
          ))}
          {entries?.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Your journal is waiting for its first page.
            </p>
          )}
        </section>
      )}

      {/* Mood */}
      {tab === "mood" && (
        <section className="space-y-6 animate-in fade-in duration-300">
          <div className="glass rounded-3xl p-6 text-center">
            <h3 className="font-display font-semibold">{t("wellness.mood.howToday")}</h3>
            <div className="mt-5 flex justify-center gap-2 sm:gap-3">
              {MOOD_FACES.map((face, i) => {
                const v = i + 1;
                return (
                  <button
                    key={v}
                    onClick={() => setMood(v)}
                    aria-label={`Mood ${v} of 7`}
                    className={`text-3xl sm:text-4xl rounded-2xl p-2 transition-all hover:scale-110 ${
                      todayMood === v
                        ? "bg-primary/30 ring-2 ring-ring scale-110"
                        : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    {face}
                  </button>
                );
              })}
            </div>
            {todayMood && (
              <p className="mt-4 text-xs text-muted-foreground">
                Logged for today. Come back tomorrow — consistency matters more than the score.
              </p>
            )}
          </div>

          <div className="glass rounded-3xl p-6">
            <h3 className="font-display font-semibold mb-4">{t("wellness.mood.last14")}</h3>
            {moods.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("wellness.mood.empty")}</p>
            ) : (
              <div className="flex items-end gap-1.5 h-32">
                {moods.slice(-14).map((m) => (
                  <div key={m.day_utc} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <span className="absolute -top-5 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                      {MOOD_FACES[m.mood - 1]} {m.day_utc.slice(5)}
                    </span>
                    <div
                      className="w-full rounded-t-lg aurora transition-all"
                      style={{ height: `${(m.mood / 7) * 100}%`, minHeight: "8px" }}
                    />
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-[11px] text-muted-foreground/70">
              Trends over time are what matter — a single day never tells the story.
            </p>
          </div>
        </section>
      )}

      {/* Game */}
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

