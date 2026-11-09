"use client";

/**
 * Email verification confirm page (?token=...).
 */

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authFetch } from "../../lib/auth";
import { useLanguage } from "../../contexts/LanguageContext";

function VerifyForm() {
  const { t } = useLanguage();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<"working" | "ok" | "err">("working");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/auth/verify-email", {
          method: "POST",
          json: { token },
        });
        if (!cancelled) setState(res.ok ? "ok" : "err");
      } catch {
        if (!cancelled) setState("err");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="glass w-full max-w-md rounded-4xl p-8 sm:p-10 space-y-5 text-center">
        <h1 className="font-display text-2xl font-semibold">
          {t("auth.verifyTitle")}
        </h1>
        {state === "working" && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("auth.verifyWorking")}
          </p>
        )}
        {state === "ok" && (
          <p className="text-sm" role="status">
            {t("auth.verifyOk")}
          </p>
        )}
        {state === "err" && (
          <p className="text-sm text-destructive" role="alert">
            {t("auth.verifyErr")}
          </p>
        )}
        <Link
          href="/login"
          className="aurora halo block w-full rounded-full px-8 py-4 text-sm font-medium text-primary-foreground text-center"
        >
          {t("auth.signIn")}
        </Link>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
