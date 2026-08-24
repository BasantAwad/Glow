"use client";

import { Heart, UserRound } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

export function SafetyNote() {
  const { t } = useLanguage();
  return (
    <section className="glass flex flex-col items-center gap-4 rounded-4xl px-6 py-5 sm:flex-row sm:justify-between">
      <div className="flex items-center gap-4">
        <span className="aurora flex size-12 shrink-0 items-center justify-center rounded-full">
          <Heart className="size-5 text-primary-foreground" />
        </span>
        <p className="text-sm text-foreground/90 sm:text-base">
          {t("safety.note")}
        </p>
      </div>
      <button className="glass-soft flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-transform hover:scale-[1.02]">
        <UserRound className="size-4" />
        Talk with a qualified professional
      </button>
    </section>
  );
}
