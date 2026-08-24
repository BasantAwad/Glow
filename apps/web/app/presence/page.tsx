"use client";

import Script from "next/script";
import { useLanguage } from "../../contexts/LanguageContext";
import { useState } from "react";

export default function PresencePage() {
  const { t } = useLanguage();
  const [selectedPersona, setSelectedPersona] = useState("Dr. Sarah");

  const personas = [
    { id: "dr-sarah", name: "Dr. Sarah", trait: "Empathetic & Warm" },
    { id: "dr-alex", name: "Dr. Alex", trait: "Direct & Practical" },
    { id: "dr-mei", name: "Dr. Mei", trait: "Calm & Reflective" }
  ];

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
          <div className="absolute top-4 left-4 right-4 z-20 flex justify-center space-x-2 bg-white/10 p-2 rounded-xl backdrop-blur-md">
            {personas.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPersona(p.name)}
                className={`px-4 py-2 rounded-lg transition-all text-sm font-medium ${
                  selectedPersona === p.name ? 'bg-primary text-primary-foreground shadow-md' : 'bg-transparent text-foreground/70 hover:bg-white/20'
                }`}
              >
                {p.name} <span className="text-xs opacity-70 block">{p.trait}</span>
              </button>
            ))}
          </div>
          <span className="text-muted-foreground/50 select-none text-sm font-medium tracking-widest uppercase mt-20">
            [ Avatar Layer: {selectedPersona} ]
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
