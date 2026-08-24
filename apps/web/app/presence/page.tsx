"use client";

import Script from "next/script";
import { useLanguage } from "../../contexts/LanguageContext";

export default function PresencePage() {
  const { t } = useLanguage();

  return (
    <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 h-[calc(100vh-160px)]">
      <Script src="https://unpkg.com/@tavus/embed@latest" />

      <div className="flex flex-col items-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center">
          {t("presence.title")}
        </h1>
      </div>

      <div className="flex-1 relative flex flex-col items-center justify-center min-h-[400px]">
        {/* Layer 1: Empty Background Layer (User can replace with 3D/Video background) */}
        <div className="absolute inset-0 z-0 glass rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center bg-black/10">
          <span className="text-muted-foreground/50 select-none text-sm font-medium tracking-widest uppercase">
            [ Background Layer ]
          </span>
        </div>

        {/* Layer 2: Tavus Embed UI */}
        <div className="relative z-10 w-full max-w-3xl h-[600px] flex flex-col items-center justify-center transition-all duration-500 glass rounded-3xl overflow-hidden shadow-xl p-4">
          {/* @ts-expect-error Custom Web Component from Tavus */}
          <tavus-embed 
            deployment-id="6e550748-e56b-43c4-b4a3-80b78e38c1cd" 
            style={{ width: '100%', height: '100%', borderRadius: '1rem', overflow: 'hidden' }}
          ></tavus-embed>
        </div>
      </div>
    </main>
  );
}
