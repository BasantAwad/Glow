"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

type Language = "en" | "es" | "fr" | "ar";

type Translations = {
  [key in Language]: Record<string, any>;
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
      placeholder: "Type a message, or choose a starter below...",
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
      subtitle: "Guided exercises to ground, breathe, and reflect.",
    },
    reflections: {
      title: "Your week, gently noticed",
      subtitle: "A gentle reflection on your emotional journey.",
    },
    crisis: {
      emergency: "Emergency",
      line: "Crisis line",
      professional: "Find a therapist",
      aiNote: "Glow is AI support — not a substitute for professional care.",
    },
    mood: {
      title: "How are you feeling right now?",
      subtitle: "Pick what feels closest — even if it's not exact.",
      veryLow: "Very low",
      low: "Low",
      okay: "Okay",
      good: "Good",
      great: "Great",
    },
    prompts: {
      howWeek: "How has your week been?",
      struggling: "I've been struggling with sleep",
      anxious: "I feel anxious but I'm not sure why",
      justListen: "I just need someone to listen",
      tired: "I'm really tired all the time",
      lonely: "I've been feeling lonely lately",
    },
    session: {
      start: "Start session",
      end: "End session",
      minuteWarning: "We have about {mins} minutes left — is there anything you want to cover?",
      ending: "Wrapping up...",
    },
    practice: {
      boxBreathing: "Box Breathing",
      boxBreathingDesc: "A simple 4-second breathing technique to calm your nervous system.",
      bodyScan: "Body Scan",
      bodyScanDesc: "Release tension by noticing each part of your body.",
      journaling: "Journaling Prompt",
      journalingDesc: "Write down what's on your mind, one sentence at a time.",
      soundscape: "Soundscape",
      soundscapeDesc: "Gentle ambient sound to help you settle.",
      step: "Step {n} of {total}",
      breatheIn: "Breathe in...",
      breatheHold: "Hold...",
      breatheOut: "Breathe out...",
      done: "Done. How do you feel now?",
      start: "Start exercise",
      pause: "Pause",
      resume: "Resume",
      next: "Next",
      repeat: "Repeat",
      skip: "Skip",
    },
    history: {
      title: "Your session history",
      empty: "No sessions yet. Start your first conversation to see it here.",
      searchPlaceholder: "Search sessions...",
      date: "Session on {date}",
      summary: "Summary",
      view: "View",
      export: "Export for doctor",
      doctorPrepTitle: "What to tell your doctor",
      doctorPrepSubtitle: "A summary of what you shared, ready to show at your appointment.",
      copy: "Copy",
      download: "Download",
      noSessions: "Complete a session first to generate a doctor summary.",
    },
    language: {
      label: "Language",
    },
    navLang: {
      en: "English",
      es: "Español",
      fr: "Français",
      ar: "العربية",
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
      placeholder: "Escribe un mensaje, o elige un inicio abajo...",
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
      subtitle: "Ejercicios guiados para calmarte y reflexionar.",
    },
    reflections: {
      title: "Tu semana, observada suavemente",
      subtitle: "Una reflexión suave sobre tu viaje emocional.",
    },
    crisis: {
      emergency: "Emergencia",
      line: "Línea de crisis",
      professional: "Buscar terapeuta",
      aiNote: "Glow es apoyo de IA — no sustituye a un profesional.",
    },
    mood: {
      title: "¿Cómo te sientes ahora?",
      subtitle: "Elige lo que más se parezca, aunque no sea exacto.",
      veryLow: "Muy mal",
      low: "Mal",
      okay: "Más o menos",
      good: "Bien",
      great: "Genial",
    },
    prompts: {
      howWeek: "¿Cómo ha sido tu semana?",
      struggling: "He estado luchando con el sueño",
      anxious: "Me siento ansioso pero no sé por qué",
      justListen: "Solo necesito que alguien me escuche",
      tired: "Estoy muy cansado todo el tiempo",
      lonely: "Me he sentido solo recientemente",
    },
    session: {
      start: "Iniciar sesión",
      end: "Terminar sesión",
      minuteWarning: "Nos quedan about {mins} minutos — ¿hay algo que quieras cubrir?",
      ending: "Cerrando...",
    },
    practice: {
      boxBreathing: "Respiración en caja",
      boxBreathingDesc: "Una técnica simple de 4 segundos para calmar el sistema nervioso.",
      bodyScan: "Escaneo corporal",
      bodyScanDesc: "Suelta la tensión notando cada parte de tu cuerpo.",
      journaling: "Escritura guiada",
      journalingDesc: "Escribe lo que tienes en mente, una frase a la vez.",
      soundscape: "Pa cyb",
      soundscapeDesc: "Sonido ambiental suave para ayudarte a calmarte.",
      step: "Paso {n} de {total}",
      breatheIn: "Inhala...",
      breatheHold: "Mantén...",
      breatheOut: "Exhala...",
      done: "Hecho. ¿Cómo te sientes ahora?",
      start: "Iniciar ejercicio",
      pause: "Pausar",
      resume: "Reanudar",
      next: "Siguiente",
      repeat: "Repetir",
      skip: "Saltar",
    },
    history: {
      title: "Tu historial de sesiones",
      empty: "Aún no hay sesiones. Comienza tu primera conversación para verlo aquí.",
      searchPlaceholder: "Buscar sesiones...",
      date: "Sesión el {date}",
      summary: "Resumen",
      view: "Ver",
      export: "Exportar para médico",
      doctorPrepTitle: "Qué decir a tu médico",
      doctorPrepSubtitle: "Un resumen de lo que compartiste, listo para tu cita.",
      copy: "Copiar",
      download: "Descargar",
      noSessions: "Completa una sesión primero para generar un resumen para el médico.",
    },
    language: {
      label: "Idioma",
    },
    navLang: {
      en: "English",
      es: "Español",
      fr: "Français",
      ar: "العربية",
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
      placeholder: "Tapez un message, ou choisissez un début ci-dessous...",
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
      subtitle: "Exercices guidés pour vous calmer et réfléchir.",
    },
    reflections: {
      title: "Votre semaine, doucement remarquée",
      subtitle: "Une réflexion douce sur votre parcours émotionnel.",
    },
    crisis: {
      emergency: "Urgence",
      line: "Ligne de crise",
      professional: "Trouver un thérapeute",
      aiNote: "Glow est une aide IA — pas un substitut professionnel.",
    },
    mood: {
      title: "Comment vous sentez-vous maintenant ?",
      subtitle: "Choisissez ce qui se rapproche le plus, même si ce n'est pas exact.",
      veryLow: "Très bas",
      low: "Bas",
      okay: "Correct",
      good: "Bien",
      great: "Super",
    },
    prompts: {
      howWeek: "Comment votre semaine a-t-elle été ?",
      struggling: "J'ai du mal à dormir",
      anxious: "Je me sens anxieux mais je ne sais pas pourquoi",
      justListen: "J'ai juste besoin que quelqu'un m'écoute",
      tired: "Je suis très fatigué tout le temps",
      lonely: "Je me suis senti seul récemment",
    },
    session: {
      start: "Démarrer la session",
      end: "Terminer la session",
      minuteWarning: "Il reste environ {mins} minutes — y a-t-il quelque chose que vous voulez aborder ?",
      ending: "Clôture...",
    },
    practice: {
      boxBreathing: "Respiration en carré",
      boxBreathingDesc: "Une technique simple de 4 secondes pour calmer le système nerveux.",
      bodyScan: "Balayage corporel",
      bodyScanDesc: "Libérez la tension en remarquant chaque partie de votre corps.",
      journaling: "Journal guidé",
      journalingDesc: "Écrivez ce qui vous passe par la tête, une phrase à la fois.",
      soundscape: "Ambiance sonore",
      soundscapeDesc: "Un son ambient doux pour vous apaiser.",
      step: "Étape {n} sur {total}",
      breatheIn: "Inspirez...",
      breatheHold: "Retenez...",
      breatheOut: "Expirez...",
      done: "Fini. Comment vous sentez-vous maintenant ?",
      start: "Démarrer l'exercice",
      pause: "Pause",
      resume: "Reprendre",
      next: "Suivant",
      repeat: "Répéter",
      skip: "Passer",
    },
    history: {
      title: "Votre historique de sessions",
      empty: "Pas encore de sessions. Commencez votre première conversation pour les voir ici.",
      searchPlaceholder: "Rechercher des sessions...",
      date: "Session du {date}",
      summary: "Résumé",
      view: "Voir",
      export: "Exporter pour le médecin",
      doctorPrepTitle: "Ce qu'il faut dire à votre médecin",
      doctorPrepSubtitle: "Un résumé de ce que vous avez partagé, prêt pour votre rendez-vous.",
      copy: "Copier",
      download: "Télécharger",
      noSessions: "Complétez d'abord une session pour générer un résumé pour le médecin.",
    },
    language: {
      label: "Langue",
    },
    navLang: {
      en: "English",
      es: "Español",
      fr: "Français",
      ar: "العربية",
    },
  },
  ar: {
    nav: {
      talk: "تحدث",
      presence: "حضور",
      practices: "تمارين",
      reflections: "تأملات",
    },
    safety: {
      note: "غلو أداة دعم بالذكاء الاصطناعي، ليست معالجًا بشريًا ولا خدمة طوارئ.",
    },
    talk: {
      title: "تحدث مع غلو",
      subtitle: "شارك ما يدور في ذهنك اليوم.",
      placeholder: "اكتب رسالة، أو اختر بداية من الأسفل...",
      send: "إرسال",
    },
    presence: {
      title: "الحضور",
      start: "ابدأ التحدث",
      stop: "توقف عن التحدث",
      expressions: "تعبيرات",
      neutral: "محايد",
      smile: "يبتسم",
      empathetic: "متعاطف",
    },
    practices: {
      title: "تمارين",
      subtitle: "تمارين إرشادية لتهدئة نفسك والتأمل.",
    },
    reflections: {
      title: "أسبوعك، بل observation لطيفة",
      subtitle: "تأمل لطيف في رحلتك العاطفية.",
    },
    crisis: {
      emergency: "طوارئ",
      line: "خط الأزمة",
      professional: "ابحث عن معالج",
      aiNote: "غلو دعم بالذكاء الاصطناعي — ليس بديلاً عن الرعاية المهنية.",
    },
    mood: {
      title: "كيف تشعر الآن؟",
      subtitle: "اختر ما يقرب أكثر، حتى لو لم يكن دقيقًا.",
      veryLow: "منخفض جدًا",
      low: "منخفض",
      okay: "مقبول",
      good: "جيد",
      great: "ممتاز",
    },
    prompts: {
      howWeek: "كيف كانت أسبوعك؟",
      struggling: "أواجه صعوبة في النوم",
      anxious: "أشعر بالقلق لكن لا أعرف لماذا",
      justListen: "أ فقط أحتاج إلى شخص يستمع",
      tired: "أنا متعب جدًا طوال الوقت",
      lonely: "شعرت بالوحدة مؤخرًا",
    },
    session: {
      start: "بدء الجلسة",
      end: "إنهاء الجلسة",
      minuteWarning: "متبقي حوالي {mins} دقيقة — هل هناك شيء تريد تغطيته؟",
      ending: "ختام...",
    },
    practice: {
      boxBreathing: "التنفس المربع",
      boxBreathingDesc: "تقنية بسيطة لمدة 4 ثوانٍ لتهدئة الجهاز العصبي.",
      bodyScan: "فحص الجسم",
      bodyScanDesc: "أطلق التوتر من خلال ملاحظة كل جزء من جسدك.",
      journaling: "كتابة إرشادية",
      journalingDesc: "اكتب ما يدور في ذهنك، جملة تلو الأخرى.",
      soundscape: "صوت مهدئ",
      soundscapeDesc: "صوت هادئ لمساعدتك على الاسترخاء.",
      step: "الخطوة {n} من {total}",
      breatheIn: "استنشق...",
      breatheHold: "احتفظ...",
      breatheOut: "زفير...",
      done: "تم. كيف تشعر الآن؟",
      start: "ابدأ التمرين",
      pause: "إيقاف",
      resume: "استمر",
      next: "التالي",
      repeat: "كرر",
      skip: "تخطى",
    },
    history: {
      title: "سجل جلساتك",
      empty: "لا توجد جلسات بعد. ابدأ محادثتك الأولى لتراها هنا.",
      searchPlaceholder: "البحث في الجلسات...",
      date: "جلسة في {date}",
      summary: "ملخص",
      view: "عرض",
      export: "تحميل للطبيب",
      doctorPrepTitle: "ماذا تقول لطبيبك",
      doctorPrepSubtitle: "ملخص لما شاركته، جاهز لموفارك.",
      copy: "نسخ",
      download: "تحميل",
      noSessions: "أكمل جلسة أولاً لتوليد ملخص للطبيب.",
    },
    language: {
      label: "اللغة",
    },
    navLang: {
      en: "English",
      es: "Español",
      fr: "Français",
      ar: "العربية",
    },
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  format: (str: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");

  const t = (key: string, params?: Record<string, string | number>) => {
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

  // Formatting function that handles {placeholder} style interpolation
  const format = (str: string, params: Record<string, string | number> = {}) => {
    return str.replace(/\{(\w+)\}/g, (_, k) => {
      return params[k] !== undefined ? String(params[k]) : `{${k}}`;
    });
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, format }}>
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
