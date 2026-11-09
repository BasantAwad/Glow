"use client";

/**
 * Forgot-password request page. The API always returns success (no account
 * enumeration), whether or not the email exists.
 */

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { authFetch } from "../../lib/auth";
import { useLanguage } from "../../contexts/LanguageContext";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await authFetch("/auth/request-password-reset", {
        method: "POST",
        json: { email },
      });
    } catch {
      // Generic success either way.
    } finally {
      setBusy(false);
      setSent(true);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <form onSubmit={submit} className="glass w-full max-w-md rounded-4xl p-8 sm:p-10 space-y-5">
        <h1 className="font-display text-2xl font-semibold text-center">
          {t("auth.resetTitle")}
        </h1>
        <p className="text-center text-sm text-muted-foreground">
          {t("auth.resetLead")}
        </p>
        {sent ? (
          <p className="text-center text-sm" role="status">
            {t("auth.resetSent")}
          </p>
        ) : (
          <>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder={t("auth.email")}
              className="w-full glass-soft rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={busy}
              className="aurora halo w-full rounded-full px-8 py-4 text-sm font-medium text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t("auth.resetRequest")}
            </button>
          </>
        )}
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
            {t("auth.signIn")}
          </Link>
        </p>
      </form>
    </main>
  );
}
