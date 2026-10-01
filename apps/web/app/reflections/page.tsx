"use client";

/**
 * Reflections — your real session history, wired to the backend.
 *
 * Fetches actual session summaries from /sessions, shows previews,
 * and generates doctor-shareable summaries from real transcript data.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Loader2, Copy, Download, MessageCircle, Clock, AlertTriangle } from "lucide-react";
import { authFetch } from "../../lib/auth";
import { useLanguage } from "../../contexts/LanguageContext";
import { getApiErrorMessage } from "../../lib/glow-api";

type SessionSummary = {
  id: number;
  session_id: string;
  state: string;
  mode: string;
  created_at: string;
  started_at: string | null;
  closed_at: string | null;
  is_crisis: boolean;
  closure_reason: string | null;
  message_count: number;
  preview: string | null;
};

type DoctorSummary = {
  session_id: string;
  session_date: string;
  duration_minutes: number | null;
  preview: string;
  full_text: string;
};

export default function ReflectionsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [doctorSummary, setDoctorSummary] = useState<DoctorSummary | null>(null);
  const [copyCopied, setCopyCopied] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const res = await authFetch("/sessions");
      if (!res.ok) {
        if (res.status === 401) { router.push("/login"); return; }
        throw new Error("failed");
      }
      const data: SessionSummary[] = await res.json();
      setSessions(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load session history."));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void Promise.resolve().then(() => loadSessions());
  }, [loadSessions]);

  const loadDoctorSummary = useCallback(async (sessionId: string) => {
    try {
      const res = await authFetch(`/sessions/${sessionId}/doctor-summary`);
      if (res.ok) {
        const data: DoctorSummary = await res.json();
        setDoctorSummary(data);
      }
    } catch {
      // Silently fail — modal still opens with cached data
    }
  }, []);

  const openDoctor = (session: SessionSummary) => {
    setSelectedId(session.id);
    setDoctorOpen(true);
    loadDoctorSummary(session.session_id);
  };

  const copySummary = async () => {
    if (!doctorSummary) return;
    try {
      await navigator.clipboard.writeText(doctorSummary.full_text);
      setCopyCopied(true);
      setTimeout(() => setCopyCopied(false), 2000);
    } catch {
      // clipboard not available
    }
  };

  const downloadSummary = () => {
    if (!doctorSummary) return;
    const blob = new Blob([doctorSummary.full_text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `glow-summary-${doctorSummary.session_date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    setDoctorOpen(false);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const filtered = sessions.filter(
    (s) =>
      s.preview?.toLowerCase().includes(search.toLowerCase()) ||
      formatDate(s.created_at).toLowerCase().includes(search.toLowerCase())
  );

  const moodLabel = (state: string) => {
    if (state === "crisis") return "Crisis";
    if (state === "closed") return "Closed";
    if (state === "active") return "Active";
    return state;
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 h-[calc(100vh-160px)]">
      <div className="flex flex-col items-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center">
          {t("reflections.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
          {t("reflections.subtitle")}
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-6 max-w-md mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("history.searchPlaceholder")}
            className="w-full glass rounded-2xl pl-10 pr-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {filtered.length} {t("history.title").toLowerCase()}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 glass border border-destructive/30 rounded-2xl px-5 py-3 text-sm text-destructive animate-in fade-in duration-300">
          {error}
        </div>
      )}

      {/* Session list */}
      {filtered.length === 0 ? (
        <div className="glass rounded-3xl p-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col items-center justify-center">
          <MessageCircle className="size-8 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">{t("history.empty")}</p>
          {sessions.length > 0 && search && (
            <p className="text-xs text-muted-foreground/60 mt-1">No sessions match &quot;{search}&quot;</p>
          )}
          {sessions.length === 0 && (
            <button
              onClick={loadSessions}
              className="mt-4 glass-soft rounded-full px-6 py-3 text-sm hover:bg-white/10 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {filtered.map((session) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass rounded-2xl p-5 transition-all cursor-pointer hover:bg-white/5 hover:shadow-md ${
                selectedId === session.id ? "ring-2 ring-ring/40" : ""
              }`}
              onClick={() =>
                selectedId === session.id
                  ? setSelectedId(null)
                  : openDoctor(session)
              }
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-medium text-foreground">
                      {formatDate(session.created_at)}
                    </span>
                    <span className="text-[11px] text-muted-foreground bg-white/5 rounded-full px-2 py-0.5">
                      {session.message_count} messages
                    </span>
                    {session.is_crisis && (
                      <span className="flex items-center gap-1 text-[11px] text-destructive">
                        <AlertTriangle className="size-3" /> Crisis session
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground/80 line-clamp-2">
                    {session.preview || "(no transcript preview available)"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-3 text-muted-foreground/60" />
                    <span className="text-xs text-muted-foreground">
                      {session.state}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground/50">
                    {session.closure_reason?.replace(/_/g, " ") || "—"}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Doctor summary modal */}
      {doctorOpen && doctorSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDoctorOpen(false)}
          />
          <div className="relative glass rounded-3xl p-6 sm:p-8 max-w-lg w-full max-h-[85vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{t("history.doctorPrepTitle")}</h2>
              <button
                onClick={() => setDoctorOpen(false)}
                className="glass-soft rounded-full w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-6">
              {t("history.doctorPrepSubtitle")}
            </p>

            <div className="glass rounded-2xl p-4 mb-6 text-left text-sm text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed">
              {doctorSummary.full_text}
            </div>

            <div className="flex gap-3">
              <button
                onClick={copySummary}
                className={`flex-1 glass-soft rounded-full px-5 py-3 text-sm font-medium transition-all ${
                  copyCopied ? "bg-green-500/20 text-green-400" : "hover:bg-white/10"
                }`}
              >
                {copyCopied ? "Copied!" : t("history.copy")}
              </button>
              <button
                onClick={downloadSummary}
                className="flex-1 glass-soft rounded-full px-5 py-3 text-sm font-medium hover:bg-white/10 transition-all"
              >
                {t("history.download")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty hint */}
      {sessions.length === 0 && (
        <p className="text-center text-sm text-muted-foreground mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {t("history.empty")}
        </p>
      )}
    </main>
  );
}
