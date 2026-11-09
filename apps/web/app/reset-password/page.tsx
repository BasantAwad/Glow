"use client";

/**
 * Set a new password from an emailed reset link (?token=...).
 */

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authFetch } from "../../lib/auth";
import { useLanguage } from "../../contexts/LanguageContext";

function ResetForm() {
  const { t } = useLanguage();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await authFetch("/auth/reset-password", {
        method: "POST",
        json: { token, new_password: password },
      });
      if (!res.ok) throw new Error("bad token");
      setDone(true);
    } catch {
      setError(t("auth.resetInvalid"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <form onSubmit={submit} className="glass w-full max-w-md rounded-4xl p-8 sm:p-10 space-y-5">
        <h1 className="font-display text-2xl font-semibold text-center">
          {t("auth.resetSetTitle")}
        </h1>
        {done ? (
          <>
            <p className="text-center text-sm" role="status">
              {t("auth.resetDone")}
            </p>
            <Link
              href="/login"
              className="aurora halo block w-full rounded-full px-8 py-4 text-sm font-medium text-primary-foreground text-center"
            >
              {t("auth.signIn")}
            </Link>
          </>
        ) : (
          <>
            <input
              type="password"
              required
              minLength={10}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={t("auth.password")}
              className="w-full glass-soft rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">{error}</p>
            )}
            <button
              type="submit"
              disabled={busy || !token}
              className="aurora halo w-full rounded-full px-8 py-4 text-sm font-medium text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t("auth.resetSet")}
            </button>
          </>
        )}
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
