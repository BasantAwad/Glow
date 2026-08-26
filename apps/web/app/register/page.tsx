"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Heart, ShieldCheck, Info } from "lucide-react";
import { apiRegister } from "../../lib/auth";
import { useLanguage } from "../../contexts/LanguageContext";

export default function RegisterPage() {
  const router = useRouter();
  const { language } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [adult, setAdult] = useState(false);
  const [diagnosisDisclosed, setDiagnosisDisclosed] = useState(false);
  const [diagnosisNote, setDiagnosisNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiRegister({
        email,
        password,
        display_name: displayName || undefined,
        is_adult_confirmed: adult,
        diagnosis_disclosed: diagnosisDisclosed,
        diagnosis_note: diagnosisDisclosed ? diagnosisNote : undefined,
        locale: language.toUpperCase(),
      });
      router.push("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass w-full max-w-lg rounded-4xl p-8 sm:p-10"
      >
        <h1 className="font-display text-3xl font-semibold text-center">
          Create your space
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          A private account keeps your journey yours alone.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="displayName" className="text-xs font-medium text-muted-foreground">
              What should Glow call you? <span className="opacity-60">(optional)</span>
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              autoComplete="nickname"
              placeholder="A name you like"
              className="mt-1.5 w-full glass-soft rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-1.5 w-full glass-soft rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
              Password <span className="opacity-60">(at least 10 characters)</span>
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={10}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1.5 w-full glass-soft rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={adult}
              onChange={(e) => setAdult(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--primary)]"
            />
            <span>I confirm I am 18 or older. Glow is currently adults-only.</span>
          </label>

          {/* Optional diagnosis disclosure */}
          <div className="glass-soft rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Heart className="size-4 mt-0.5 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed">
                Have you been diagnosed with a mental-health condition by a
                professional? If you&apos;re comfortable sharing it, Glow can be
                more informed in conversations — but this is entirely optional.
              </p>
            </div>
            <label className="mt-3 flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={diagnosisDisclosed}
                onChange={(e) => setDiagnosisDisclosed(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              <span>I&apos;d like to share (I can change or remove this anytime)</span>
            </label>
            {diagnosisDisclosed && (
              <textarea
                value={diagnosisNote}
                onChange={(e) => setDiagnosisNote(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Share only what feels right — e.g. 'generalized anxiety, diagnosed 2022'. Leave blank if you prefer."
                className="mt-3 w-full glass rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}
            <p className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground/80">
              <ShieldCheck className="size-3.5 mt-0.5 shrink-0" />
              Stored encrypted, visible only to you, never used to diagnose, and
              deletable in one tap. Glow is an AI — it doesn&apos;t replace your
              clinician.
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy || !adult}
            className="aurora halo w-full rounded-full px-8 py-4 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Create account
          </button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
              Sign in
            </Link>
          </p>

          <p className="flex items-start justify-center gap-1.5 text-center text-[11px] text-muted-foreground/70">
            <Info className="size-3 shrink-0 mt-0.5" />
            If you&apos;re in crisis right now, please contact your local emergency
            number instead — help is free regardless of any account.
          </p>
        </form>
      </motion.div>
    </main>
  );
}
