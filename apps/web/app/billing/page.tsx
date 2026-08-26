"use client";

/**
 * Billing — plans and entitlement. Crisis support is never paywalled;
 * this page only manages optional premium sessions.
 * Payment processing is intentionally not wired to a live provider yet
 * (server-side provider selection is a documented launch blocker).
 */

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "0",
    period: "forever",
    features: [
      "3 support sessions",
      "Text conversations",
      "Journal & mood tracking",
      "Breathing exercises & games",
      "Crisis resources — always free",
    ],
    cta: null,
  },
  {
    id: "plus",
    name: "Glow Plus",
    price: "9",
    period: "/month",
    highlight: true,
    features: [
      "Unlimited sessions",
      "Voice conversations",
      "Avatar companion",
      "Priority response times",
      "Everything in Free",
      "Crisis resources — always free",
    ],
    cta: "Join waitlist",
  },
];

export default function BillingPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  const handlePlan = async (id: string) => {
    if (id !== "plus") return;
    setBusy(id);
    // Real payment integration pending provider review (see docs/launch-checklist).
    await new Promise((r) => setTimeout(r, 600));
    setJoined(true);
    setBusy(null);
  };

  return (
    <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
      <div className="flex flex-col items-center mb-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold">
          Support that stays affordable
        </h1>
        <p className="mt-3 max-w-lg text-sm sm:text-base text-muted-foreground">
          The essentials are free forever. Crisis help is never behind a
          paywall — that&apos;s a promise built into the product, not the plan.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`glass rounded-3xl p-8 relative transition-transform hover:-translate-y-1 ${
              plan.highlight ? "ring-1 ring-primary/50 shadow-xl shadow-primary/10" : ""
            }`}
          >
            {plan.highlight && (
              <span className="aurora absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-[11px] font-medium text-primary-foreground">
                Most loved
              </span>
            )}
            <h2 className="font-display text-xl font-semibold">{plan.name}</h2>
            <p className="mt-3">
              <span className="font-display text-4xl font-semibold">${plan.price}</span>{" "}
              <span className="text-sm text-muted-foreground">{plan.period}</span>
            </p>
            <ul className="mt-6 space-y-2.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check className="size-4 mt-0.5 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
            {plan.cta && !joined ? (
              <button
                onClick={() => handlePlan(plan.id)}
                disabled={busy === plan.id}
                className="aurora halo mt-8 w-full rounded-full px-6 py-3.5 text-sm font-medium text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy === plan.id && <Loader2 className="size-4 animate-spin" />}
                {plan.cta}
              </button>
            ) : joined && plan.id === "plus" ? (
              <p className="aurora mt-8 w-full rounded-full px-6 py-3.5 text-center text-sm font-medium text-primary-foreground opacity-80">
                You&apos;re on the list 💜
              </p>
            ) : plan.cta ? null : (
              <button className="glass-soft mt-8 w-full rounded-full px-6 py-3.5 text-sm">
                Your current plan
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-[11px] text-muted-foreground/70">
        Payments will be processed by a licensed provider once integrations are
        reviewed. No card details are ever stored on Glow&apos;s servers.
      </p>
    </main>
  );
}
