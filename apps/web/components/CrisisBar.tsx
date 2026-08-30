"use client";

import { useLanguage } from "../contexts/LanguageContext";

export function CrisisBar() {
  const { t } = useLanguage();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-2 sm:px-6">
      <div className="flex items-center justify-between gap-3 overflow-x-auto">
        {/* Emergency contact */}
        <a
          href="tel:999"
          className="glass-soft flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-destructive whitespace-nowrap transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-destructive/50"
        >
          <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 1 0-9 9" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          <span>
            {t("crisis.emergency")}
            <span className="text-muted-foreground font-normal"> &nbsp;999</span>
          </span>
        </a>

        {/* Crisis line */}
        <a
          href="tel:111"
          className="glass-soft flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground/80 whitespace-nowrap transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-ring/50"
        >
          <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>
            {t("crisis.line")}
            <span className="text-muted-foreground font-normal">&nbsp;111</span>
          </span>
        </a>

        {/* Professional help */}
        <a
          href="https://www.nhs.uk/service-search/mental-health"
          target="_blank"
          rel="noopener noreferrer"
          className="glass-soft flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-foreground/70 whitespace-nowrap transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-ring/50"
        >
          <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>{t("crisis.professional")}</span>
        </a>

        {/* Glow is AI note */}
        <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap shrink-0">
          {t("crisis.aiNote")}
        </span>
      </div>
    </div>
  );
}
