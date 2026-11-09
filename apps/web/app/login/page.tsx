"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { apiLogin, clearStoredAuth } from "../../lib/auth";
import { useLanguage } from "../../contexts/LanguageContext";
import { getApiErrorMessage } from "../../lib/glow-api";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    clearStoredAuth(); // fresh session each login
    setBusy(true);
    try {
      await apiLogin(email, password);
      router.push("/chat");
    } catch (err) {
      setError(getApiErrorMessage(err, "Sign in failed. Please try again."));
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
        className="glass w-full max-w-md rounded-4xl p-8 sm:p-10"
      >
        <h1 className="font-display text-3xl font-semibold text-center">{t("auth.loginTitle")}</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t("auth.loginSubtitle")}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              {t("auth.email")}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-1.5 w-full glass-soft rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
              {t("auth.password")}
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1.5 w-full glass-soft rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          <p className="text-center text-sm">
            <Link href="/forgot-password" className="underline underline-offset-4 text-primary hover:text-foreground">
              {t("auth.forgotPassword")}
            </Link>
          </p>

          <button
            type="submit"
            disabled={busy}
            className="aurora halo w-full rounded-full px-8 py-4 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {t("auth.signIn")}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link href="/register" className="underline underline-offset-4 hover:text-foreground">
              {t("auth.createAccount")}
            </Link>
          </p>
        </form>
      </motion.div>
    </main>
  );
}
