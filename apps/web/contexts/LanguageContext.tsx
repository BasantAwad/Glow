"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

type Language = "en" | "es" | "fr";

type Translations = {
  [key in Language]: {
    nav: {
      talk: string;
      presence: string;
      practices: string;
      reflections: string;
    };
    safety: {
      note: string;
    };
    talk: {
      title: string;
      subtitle: string;
      placeholder: string;
      send: string;
    };
    presence: {
      title: string;
      start: string;
      stop: string;
      expressions: string;
      neutral: string;
      smile: string;
      empathetic: string;
    };
    practices: {
      title: string;
      subtitle: string;
    };
    reflections: {
      title: string;
      subtitle: string;
    };
  };
};

const translations: Translations = {
  en: {
    nav: {
      talk: "Talk",
      presence: "Presence",
      practices: "Practices",
      reflections: "Reflections",
    },
    safety: {
      note: "Glow is an AI support tool, not a human therapist or emergency service.",
    },
    talk: {
      title: "Talk with Glow",
      subtitle: "Share what's on your mind today.",
      placeholder: "Type a message...",
      send: "Send",
    },
    presence: {
      title: "Presence",
      start: "Start Speaking",
      stop: "Stop Speaking",
      expressions: "Expressions",
      neutral: "Neutral",
      smile: "Smile",
      empathetic: "Empathetic",
    },
    practices: {
      title: "Practices",
      subtitle: "Explore mindfulness and grounding exercises.",
    },
    reflections: {
      title: "Your week, gently noticed",
      subtitle: "A gentle reflection on your emotional journey.",
    },
  },
  es: {
    nav: {
      talk: "Hablar",
      presence: "Presencia",
      practices: "Prácticas",
      reflections: "Reflexiones",
    },
    safety: {
      note: "Glow es una herramienta de apoyo con IA, no un terapeuta humano ni servicio de emergencia.",
    },
    talk: {
      title: "Habla con Glow",
      subtitle: "Comparte lo que tienes en mente hoy.",
      placeholder: "Escribe un mensaje...",
      send: "Enviar",
    },
    presence: {
      title: "Presencia",
      start: "Empezar a hablar",
      stop: "Dejar de hablar",
      expressions: "Expresiones",
      neutral: "Neutral",
      smile: "Sonreír",
      empathetic: "Empático",
    },
    practices: {
      title: "Prácticas",
      subtitle: "Explora ejercicios de atención plena.",
    },
    reflections: {
      title: "Tu semana, observada suavemente",
      subtitle: "Una reflexión suave sobre tu viaje emocional.",
    },
  },
  fr: {
    nav: {
      talk: "Parler",
      presence: "Présence",
      practices: "Pratiques",
      reflections: "Réflexions",
    },
    safety: {
      note: "Glow est un outil de soutien par IA, non un thérapeute humain ou un service d'urgence.",
    },
    talk: {
      title: "Parlez avec Glow",
      subtitle: "Partagez ce que vous avez à l'esprit aujourd'hui.",
      placeholder: "Tapez un message...",
      send: "Envoyer",
    },
    presence: {
      title: "Présence",
      start: "Commencer à parler",
      stop: "Arrêter de parler",
      expressions: "Expressions",
      neutral: "Neutre",
      smile: "Sourire",
      empathetic: "Empathique",
    },
    practices: {
      title: "Pratiques",
      subtitle: "Explorez des exercices de pleine conscience.",
    },
    reflections: {
      title: "Votre semaine, doucement remarquée",
      subtitle: "Une réflexion douce sur votre parcours émotionnel.",
    },
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  const t = (key: string) => {
    const keys = key.split(".");
    let current: any = translations[language];
    for (const k of keys) {
      if (current[k] === undefined) {
        return key; // fallback to key path if not found
      }
      current = current[k];
    }
    return current as string;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
