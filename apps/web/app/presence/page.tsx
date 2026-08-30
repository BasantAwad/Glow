"use client";

import Script from "next/script";
import { useLanguage } from "../../contexts/LanguageContext";
import { useState } from "react";

export default function PresencePage() {
  const { t, language } = useLanguage();
  const [therapistGender, setTherapistGender] = useState<"female" | "male">("female");
  const [sessionStarted, setSessionStarted] = useState(false);

  // Tavus deployment IDs for each therapist gender
  const deploymentIds = {
    female: "6e550748-e56b-43c4-b4a3-80b78e38c1cd",
    male: "b86bb58d-1465-48f5-9294-772f003265fd",
  };

  // Conversational context passed to Tavus based on locale
  const contextMap: Record<string, string> = {
    en: "The user is speaking English. Respond warmly, naturally, and in English.",
    es: "El usuario está hablando en español. Responde cálidamente, naturalmente, y en español.",
    fr: "L'utilisateur parle français. Répondez chaleureusement, naturellement, et en français.",
    ar: "المستخدم يتحدث العربية. رد بتف warmth، بشكل طبيعي، بالعربية.",
  };
  const conversationalContext: string = (contextMap[language] || contextMap.en);

  return (
    <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 h-[calc(100vh-160px)]">
      <Script src="https://unpkg.com/@tavus/embed@latest" />

      <div className="flex flex-col items-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center">
          {t("presence.title")}
        </h1>
        <p className="mt-2 text-muted-foreground text-center">
          Choose your therapist below.
        </p>
      </div>

      {/* Therapist gender selector */}
      <div className="flex items-center gap-3 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <span className="text-sm text-muted-foreground">Choose your therapist:</span>
        <button
          onClick={() => setTherapistGender("female")}
          className={`px-5 py-2.5 rounded-xl transition-all text-sm font-medium ${
            therapistGender === "female"
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-transparent text-foreground/70 hover:bg-white/20"
          }`}
        >
          Female Therapist
        </button>
        <button
          onClick={() => setTherapistGender("male")}
          className={`px-5 py-2.5 rounded-xl transition-all text-sm font-medium ${
            therapistGender === "male"
              ? "bg-primary text-primary-foreground shadow-md"
              : "bg-transparent text-foreground/70 hover:bg-white/20"
          }`}
        >
          Male Therapist
        </button>
      </div>

      {/* Start session button */}
      {!sessionStarted && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 mb-6">
          <button
            onClick={() => setSessionStarted(true)}
            className="aurora flex items-center gap-3 rounded-2xl px-8 py-4 text-base font-medium shadow-lg transition-transform hover:scale-[1.02] hover:shadow-xl"
          >
            <Sparkles className="size-5" />
            {t("session.start")}
          </button>
        </div>
      )}

      <div className="flex-1 relative flex flex-col items-center justify-center min-h-[400px]">
        {/* Tavus Embed — single therapist, gender switchable, locale-aware */}
        <div className="relative z-10 w-full max-w-3xl h-[600px] flex flex-col items-center justify-center transition-all duration-500 glass rounded-3xl overflow-hidden shadow-xl p-4">
          <tavus-embed
            deployment-id={deploymentIds[therapistGender]}
            conversational-context={conversationalContext}
            style={{ width: "100%", height: "100%", borderRadius: "1rem", overflow: "hidden" }}
          ></tavus-embed>
        </div>
      </div>
    </main>
  );
}

// Import Sparkles for the start button
import { Sparkles } from "lucide-react";
