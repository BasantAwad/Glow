"use client";

/**
 * Billing — plans and entitlement, wired to Paymob checkout.
 * Free tier = 3 sessions. Paid sessions are 700 EGP each via Paymob
 * (cards, mobile wallets — Egypt-local payment methods).
 * Crisis support is never paywalled; this page manages convenience only.
 */

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { authFetch } from "../../lib/auth";

type Status = {
  free_sessions_remaining: number;
  paid_credits: number;
  may_start_session: boolean;
  price_egp: number;
};

const getPlans = (t: (k: string) => string) => [
  {
    id: "free",
    name: t("billing.free.name"),
    price: "0",
    period: t("billing.free.period"),
    features: [
      "3 support sessions",
      "Text conversations",
      "Journal & mood tracking",
      "Breathing exercises & games",
      "Crisis resources — always free",
    ],
  },
  {
    id: "session",
    name: t("billing.payPerSession"),
    price: "700",
    currency: "EGP",
    period: t("billing.perSession"),
    highlight: true,
    features: [
      "One full 60-minute conversation",
      "Voice + avatar modes included",
      "Secure card & mobile wallet payment via Paymob",
      "Everything in Free",
      "Crisis resources — always free",
    ],
  },
];

export default function BillingPage() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await authFetch("/billing/status");
      if (res.ok) setStatus(await res.json());
    } catch {
      /* page still renders */
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadStatus());
  }, [loadStatus]);

  const startCheckout = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/billing/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Could not start payment");
      // Redirect to Paymob's hosted checkout (PCI scope stays with Paymob).
      window.location.href = data.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment could not start");
      setBusy(false);
    }
  };

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
      <div className="flex flex-col items-center mb-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold">
          Support that stays affordable
        </h1>
        <p className="mt-3 max-w-lg text-sm sm:text-base text-muted-foreground">
          {t("billing.subtitle")}
        </p>
        {status && (
          <p className="mt-4 glass rounded-full px-5 py-2 text-xs text-muted-foreground">
            You have{" "}
            <span className="font-semibold text-foreground">
              {status.free_sessions_remaining}
            </span>{" "}
            session{status.free_sessions_remaining === 1 ? "" : "s"} available
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {getPlans(t).map((plan) => {
          const isCurrent = plan.id === "free" && status && status.free_sessions_remaining > 0;
          return (
            <div
              key={plan.id}
              className={`glass rounded-3xl p-8 relative transition-transform hover:-translate-y-1 ${
                plan.highlight ? "ring-1 ring-primary/50 shadow-xl shadow-primary/10" : ""
              }`}
            >
              {plan.highlight && (
                <span className="aurora absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-[11px] font-medium text-primary-foreground whitespace-nowrap">
                  Pay as you go
                </span>
              )}
              <h2 className="font-display text-xl font-semibold">{plan.name}</h2>
              <p className="mt-3">
                <span className="font-display text-4xl font-semibold">{plan.price}</span>{" "}
                <span className="text-sm text-muted-foreground">
                  {plan.currency ? `${plan.currency} ` : ""}
                  {plan.period}
                </span>
              </p>
              <ul className="mt-6 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="size-4 mt-0.5 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <p className="glass-soft mt-8 w-full rounded-full px-6 py-3.5 text-center text-sm">
                  {t("billing.currentPlan")}
                </p>
              ) : plan.highlight ? (
                <button
                  onClick={startCheckout}
                  disabled={busy}
                  className="aurora halo mt-8 w-full rounded-full px-6 py-3.5 text-sm font-medium text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Buy a session — 700 EGP
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-6 text-center text-sm text-destructive">
          {error}
        </p>
      )}

      <p className="mt-10 flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground/70">
        <ShieldCheck className="size-3.5 shrink-0" />
        Payments processed securely by Paymob — cards and Egyptian mobile
        wallets. No card details ever touch Glow&apos;s servers.
      </p>
    </main>
  );
}
