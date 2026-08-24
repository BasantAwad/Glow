"use client";

import { useLanguage } from "../../contexts/LanguageContext";
import { Sparkles, Wind, BookOpen, Music } from "lucide-react";

export default function PracticesPage() {
  const { t } = useLanguage();

  const practices = [
    { title: "Box Breathing", desc: "A simple 4-second breathing technique to ground yourself.", icon: Wind },
    { title: "Body Scan", desc: "Release tension systematically from head to toe.", icon: Sparkles },
    { title: "Journaling Prompt", desc: "Guided writing to externalize anxious thoughts.", icon: BookOpen },
    { title: "Soundscape", desc: "Binaural beats and gentle rain to soothe the nervous system.", icon: Music },
  ];

  return (
    <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col items-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center">
          {t("practices.title")}
        </h1>
        <p className="mt-3 text-muted-foreground text-center text-lg">
          {t("practices.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        {practices.map((practice, i) => (
          <div 
            key={i} 
            className="glass p-6 rounded-3xl flex items-start gap-4 transition-transform hover:scale-[1.02] cursor-pointer"
          >
            <div className="aurora flex size-12 shrink-0 items-center justify-center rounded-full mt-1">
              <practice.icon className="size-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground/90">{practice.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{practice.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
