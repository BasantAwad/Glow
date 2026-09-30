"use client";

/**
 * Language context — full-site i18n with Arabic (RTL) support.
 *
 * All UI strings live here and are flattened for simple dotted-key lookups.
 * `dir` is exposed so pages/layout can switch to RTL for Arabic.
 * Persisted per browser in localStorage.
 */

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Language = "en" | "ar" | "es" | "fr";

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  ar: "العربية",
  es: "Español",
  fr: "Français",
};

const RTL_LANGUAGES: Language[] = ["ar"];

type Dict = Record<string, string>;

const translations = {
  en: {
    nav: {
      talk: "Talk",
      presence: "Presence",
      practices: "Practices",
      reflections: "Reflections",
      chat: "Chat",
      voice: "Voice",
      avatar: "Avatar",
      wellness: "Wellness",
      billing: "Billing",
      signIn: "Sign in",
      signOut: "Sign out",
      profile: "Your profile",
    },
    safety: {
      note: "Glow is an AI support tool, not a human therapist or emergency service.",
      professional: "Talk with a qualified professional",
      crisis: "If you're in crisis right now, please contact your local emergency number — help is free regardless of any account.",
    },
    chat: {
      title: "Talk it through",
      placeholder: "Type what's on your mind…",
      listening: "Glow is listening…",
      typingYou: "you're typing…",
      error: "Glow couldn't reach its support service just now. If this is urgent, please contact your local emergency services or crisis line.",
      checkin1: "Still with you — take your time. Is there anything on your mind you'd like to explore?",
      checkin2: "No rush at all. I'm here whenever you feel like continuing.",
      checkin3: "Just checking in gently — how are you feeling right now?",
      welcome: "Hi, I'm Glow. I'm an AI companion here to listen — not a human or a therapist. What's been on your mind lately?",
    },
    voice: {
      title: "Voice presence",
      subtitle: "Talk naturally. Captions always on.",
      start: "Start a voice conversation",
      recording: "I'm listening — tap to finish",
      thinking: "Thinking…",
      speaking: "Speaking — tap the mic to reply",
      connecting: "Connecting…",
      disclaimer: "Audio is transcribed in real time and is not stored unless you consent. Glow is an AI companion — not emergency care.",
      error: "Microphone or connection unavailable. Check browser permissions.",
    },
    avatar: {
      title: "Meet your companion",
      subtitle: "A visual presence for voice conversations.",
      loading: "Loading companion…",
      disclaimer: "Avatar is presentation only. Audio transcribed live, not stored without consent.",
    },
    home: {
      hero1: "A softer place to",
      hero2: "untangle your thoughts.",
      heroSub: "Glow is an AI companion for mental-health support — not a replacement for professional care, but a warm first step when getting started is the hardest part.",
      cta: { start: "Begin gently — it's free", login: "I already have an account" },
      privacyLine: "Private by design · encrypted at rest · crisis support never paywalled",
      safetyTitle: "Safety, honestly",
      safetyBody: "Glow is an AI, never a licensed therapist. It won't diagnose, won't judge, and will point you to real human help whenever things feel too heavy — including crisis lines that are free to call, no matter what.",
      f: {
        chat: { title: "Talk it out", desc: "A companion that listens — by text or voice, whenever you need it. Nothing you share is judged." },
        avatar: { title: "See a friendly face", desc: "Optional avatar presence with real-time voice and lip-sync for a more human conversation." },
        journal: { title: "Private journal", desc: "Expressive writing is proven to ease anxious thoughts. Your entries are encrypted, always." },
        mood: { title: "Mood insights", desc: "A daily check-in takes seconds. Gentle charts reveal your patterns over weeks, not scores." },
        calm: { title: "Calm in minutes", desc: "Guided breathing and grounding exercises — small, clinically-informed tools for hard moments." },
        games: { title: "Healing through play", desc: "Lightweight games designed around focus and mindfulness, because rest is productive too." },
      },
    },
    auth: {
      register: { title: "Create your space", subtitle: "A private account keeps your journey yours alone." },
      nameLabel: "What should Glow call you?",
      nameOptional: "(optional)",
      namePlaceholder: "A name you like",
      email: "Email",
      password: "Password",
      passwordHint: "(at least 10 characters)",
      adult: "I confirm I am 18 or older. Glow is currently adults-only.",
      createAccount: "Create account",
      haveAccount: "Already have an account?",
      noAccount: "New to Glow?",
      signIn: "Sign in",
      loginTitle: "Welcome back",
      loginSubtitle: "Your space is exactly as you left it.",
      diagnosis: {
        question: "Have you been diagnosed with a mental-health condition by a professional? If you're comfortable sharing it, Glow can be more informed in conversations — but this is entirely optional.",
        share: "I'd like to share (I can change or remove this anytime)",
        placeholder: "Share only what feels right — e.g. 'generalized anxiety, diagnosed 2022'. Leave blank if you prefer.",
        note: "Stored encrypted, visible only to you, never used to diagnose, and deletable in one tap. Glow is an AI — it doesn't replace your clinician.",
      },
    },
    profile: {
      title: "Your profile",
      privateSettings: "Your private settings",
      account: "Account",
      memberSince: "Member since",
      freeSessions: "Free sessions left",
      diagnosisTitle: "Diagnosis disclosure",
      diagnosisDesc: "Optional. If a professional has diagnosed you with something, sharing it helps Glow be more informed — but it never changes how much you're supported.",
      notShared: "Not shared",
      sharingNoDetails: "Sharing (no details written)",
      edit: "Edit",
      shareSomething: "Share something",
      removeWipe: "Remove & wipe note",
      save: "Save",
      cancel: "Cancel",
      diagnosisFooter: "Encrypted at rest · visible only to you · never used to diagnose · removing wipes the stored note entirely.",
    },
    wellness: {
      title: "Wellness tools",
      subtitle: "Small practices, real evidence. All private to you.",
      tab: { journal: "Journal", mood: "Mood chart", game: "Focus game" },
      journal: {
        titlePh: "Give today's entry a title (optional)",
        writePh: "Write freely — nobody grades this. Expressive writing helps externalize anxious thoughts.",
        save: "Save entry",
        first: "Your journal is waiting for its first page.",
        entryTitle: "Untitled entry",
      },
      mood: {
        howToday: "How was today?",
        logged: "Logged for today. Come back tomorrow — consistency matters more than the score.",
        last14: "Last 14 days",
        empty: "No check-ins yet.",
        footer: "Trends over time are what matter — a single day never tells the story.",
      },
      game: {
        inhale: "Breathe in…",
        exhale: "Breathe out slowly…",
        breaths: "breaths · best",
        begin: "Begin",
        finish: "Finish",
        footer: "Paced breathing at ~5.5 breaths/min is associated with reduced physiological arousal. Not a medical treatment — just a moment of calm.",
      },
    },
    billing: {
      title: "Support that stays affordable",
      subtitle: "The essentials are free forever. Crisis help is never behind a paywall — that's a promise built into the product, not the plan.",
      free: { name: "Free", period: "forever" },
      plus: { name: "Glow Plus", tag: "Most loved" },
      payPerSession: "Pay per session",
      perMonth: "/month",
      currentPlan: "Your current plan",
      waitlist: "Join waitlist",
      joined: "You're on the list 💜",
      footer: "Payments will be processed by a licensed provider once integrations are reviewed. No card details are ever stored on Glow's servers.",
      perSession: "/ session",
      buy: "Buy a session",
      egp: "EGP",
    },
    practices: {
      title: "Practices",
      subtitle: "Explore mindfulness and grounding exercises.",
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
    language: { label: "Language" },
    navLang: { en: "English", es: "Español", fr: "Français", ar: "العربية" },
  },
  es: {
    nav: { talk: "Hablar", presence: "Presencia", practices: "Prácticas", reflections: "Reflexiones", chat: "Chat", voice: "Voz", avatar: "Avatar", wellness: "Bienestar", billing: "Facturación", signIn: "Iniciar sesión", signOut: "Salir", profile: "Tu perfil" },
    safety: { note: "Glow es una herramienta de apoyo con IA, no un terapeuta humano ni un servicio de emergencia.", professional: "Habla con un profesional cualificado", crisis: "Si estás en crisis ahora mismo, contacta con tu número local de emergencias — la ayuda es gratuita sin importar la cuenta." },
    chat: { title: "Hablemos del tema", placeholder: "Escribe lo que tienes en mente…", listening: "Glow está escuchando…", typingYou: "estás escribiendo…", error: "Glow no pudo contactar el servicio de apoyo en este momento. Si es urgente, contacta a tus servicios locales de emergencia o línea de crisis.", checkin1: "Sigo aquí — tómate tu tiempo. ¿Hay algo que te gustaría explorar?", checkin2: "Sin prisa alguna. Estoy aquí cuando quieras continuar.", checkin3: "Solo pregunto con cariño — ¿cómo te sientes ahora?", welcome: "Hola, soy Glow. Soy un compañero de IA aquí para escucharte — no soy humano ni terapeuta. ¿Qué ha estado en tu mente últimamente?" },
    voice: { title: "Presencia de voz", subtitle: "Habla con naturalidad. Subtítulos siempre activados.", start: "Comenzar conversación de voz", recording: "Te escucho — toca para terminar", thinking: "Pensando…", speaking: "Hablando — toca el micrófono para responder", connecting: "Conectando…", disclaimer: "El audio se transcribe en tiempo real y no se almacena sin tu consentimiento. Glow es un compañero de IA — no emergencias.", error: "Micrófono o conexión no disponibles. Revisa los permisos del navegador." },
    avatar: { title: "Conoce a tu compañero", subtitle: "Una presencia visual para conversaciones de voz.", loading: "Cargando compañero…", disclaimer: "El avatar es solo presentación. Audio transcrito en vivo, no almacenado sin consentimiento." },
    home: { hero1: "Un lugar más suave", hero2: "para desenredar tus pensamientos.", heroSub: "Glow es un compañero de IA para apoyo emocional — no reemplaza el cuidado profesional, sino un primer paso cálido cuando empezar es lo más difícil.", cta: { start: "Empieza suavemente — es gratis", login: "Ya tengo cuenta" }, privacyLine: "Privado por diseño · cifrado · apoyo en crisis nunca de pago", safetyTitle: "Seguridad, honestamente", safetyBody: "Glow es una IA, nunca un terapeuta licenciado. No diagnostica, no juzga y te guiará a ayuda humana real cuando las cosas pesen demasiado — incluyendo líneas de crisis gratuitas, pase lo que pase.", f: { chat: { title: "Desahógate", desc: "Un compañero que escucha — por texto o voz, cuando lo necesites. Nada de lo que compartas es juzgado." }, avatar: { title: "Un rostro amable", desc: "Presencia opcional con voz en tiempo real y sincronización labial." }, journal: { title: "Diario privado", desc: "La escritura expresiva alivia pensamientos ansiosos. Tus entradas están cifradas, siempre." }, mood: { title: "Perspectivas del ánimo", desc: "Un registro diario toma segundos. Gráficos suaves revelan tus patrones semanales." }, calm: { title: "Calma en minutos", desc: "Respiración guiada y ejercicios de arraigo — herramientas pequeñas para momentos difíciles." }, games: { title: "Sanar jugando", desc: "Juegos ligeros centrados en atención plena, porque descansar también produce." } } },
    auth: { register: { title: "Crea tu espacio", subtitle: "Una cuenta privada mantiene tu viaje solo tuyo." }, nameLabel: "¿Cómo debe llamarte Glow?", nameOptional: "(opcional)", namePlaceholder: "Un nombre que te guste", email: "Correo electrónico", password: "Contraseña", passwordHint: "(al menos 10 caracteres)", adult: "Confirmo que tengo 18 años o más. Glow es actualmente solo para adultos.", createAccount: "Crear cuenta", haveAccount: "¿Ya tienes cuenta?", noAccount: "¿Nuevo en Glow?", signIn: "Iniciar sesión", loginTitle: "Bienvenido de nuevo", loginSubtitle: "Tu espacio está tal como lo dejaste.", diagnosis: { question: "¿Un profesional te ha diagnosticado alguna condición de salud mental? Si te sientes cómodo compartiéndolo, Glow puede estar más informado — pero es totalmente opcional.", share: "Me gustaría compartirlo (puedo cambiarlo o eliminarlo en cualquier momento)", placeholder: "Comparte solo lo que te sientas cómodo — p.ej. «ansiedad generalizada, diagnosticada 2022». Déjalo vacío si prefieres.", note: "Almacenado cifrado, visible solo para ti, nunca usado para diagnosticar, y borrable con un toque. Glow es una IA — no reemplaza a tu clínico." } },
    profile: { title: "Tu perfil", privateSettings: "Tus ajustes privados", account: "Cuenta", memberSince: "Miembro desde", freeSessions: "Sesiones gratis restantes", diagnosisTitle: "Divulgación de diagnóstico", diagnosisDesc: "Opcional. Compartirlo ayuda a Glow a estar mejor informado — pero nunca cambia cuánto apoyo recibes.", notShared: "No compartido", sharingNoDetails: "Compartiendo (sin detalles)", edit: "Editar", shareSomething: "Compartir algo", removeWipe: "Eliminar y borrar nota", save: "Guardar", cancel: "Cancelar", diagnosisFooter: "Cifrado en reposo · visible solo para ti · nunca usado para diagnosticar · eliminar borra la nota completamente." },
    wellness: { title: "Herramientas de bienestar", subtitle: "Prácticas pequeñas, evidencia real. Todo privado.", tab: { journal: "Diario", mood: "Ánimo", game: "Juego de enfoque" }, journal: { titlePh: "Dale un título a la entrada de hoy (opcional)", writePh: "Escribe libremente — nadie califica esto.", save: "Guardar entrada", first: "Tu diario espera su primera página.", entryTitle: "Entrada sin título" }, mood: { howToday: "¿Cómo fue tu día?", logged: "Registrado por hoy. Vuelve mañana — la constancia importa más que la nota.", last14: "Últimos 14 días", empty: "Aún no hay registros.", footer: "Las tendencias a largo plazo importan — un solo día nunca cuenta la historia." }, game: { inhale: "Inhala…", exhale: "Exhala despacio…", breaths: "respiraciones · récord", begin: "Comenzar", finish: "Terminar", footer: "La respiración pausada ~5.5 resp/min se asocia con menor activación fisiológica. No es tratamiento médico." } },
    billing: { title: "Apoyo que sigue siendo accesible", subtitle: "Lo esencial es gratis para siempre. La ayuda en crisis jamás está tras un muro de pago.", free: { name: "Gratis", period: "para siempre" }, plus: { name: "Glow Plus", tag: "El favorito" }, payPerSession: "Pago por sesión", perMonth: "/mes", currentPlan: "Tu plan actual", waitlist: "Unirse a lista de espera", joined: "Estás en la lista 💜", footer: "Los pagos serán procesados por un proveedor autorizado. Nunca almacenamos datos de tarjetas.", perSession: "/ sesión", buy: "Comprar una sesión", egp: "EGP" },
    practices: { title: "Prácticas", subtitle: "Explora ejercicios de atención plena y arraigo." },
    reflections: { title: "Tu semana, gentilmente observada", subtitle: "Una reflexión suave sobre tu viaje emocional." },
    language: { label: "Idioma" },
    navLang: { en: "English", es: "Español", fr: "Français", ar: "العربية" },
  },
  fr: { nav: { talk: "Parler", presence: "Présence", practices: "Pratiques", reflections: "Réflexions", chat: "Discussion", voice: "Voix", avatar: "Avatar", wellness: "Bien-être", billing: "Facturation", signIn: "Connexion", signOut: "Déconnexion", profile: "Votre profil" }, safety: { note: "Glow est un outil de soutien par IA, non un thérapeute humain ou un service d'urgence.", professional: "Parler à un professionnel qualifié", crisis: "Si vous êtes en crise maintenant, contactez votre numéro d'urgence local — l'aide est gratuite quel que soit le compte." }, chat: { title: "Parlons-en", placeholder: "Écrivez ce qui vous préoccupe…", listening: "Glow vous écoute…", typingYou: "vous écrivez…", error: "Glow n'a pas pu joindre son service de soutien. Si c'est urgent, contactez vos services d'urgence locaux ou une ligne de crise.", checkin1: "Je suis toujours là — prenez votre temps. Y a-t-il quelque chose que vous aimeriez explorer ?", checkin2: "Aucune urgence. Je suis là quand vous souhaitez continuer.", checkin3: "Je demande doucement — comment vous sentez-vous maintenant ?", welcome: "Bonjour, je suis Glow. Un compagnon IA ici pour écouter — ni humain ni thérapeute. Qu'est-ce qui vous préoccupe ces derniers temps ?" }, voice: { title: "Présence vocale", subtitle: "Parlez naturellement. Sous-titres toujours affichés.", start: "Commencer une conversation vocale", recording: "Je vous écoute — touchez pour terminer", thinking: "Réflexion…", speaking: "Je parle — touchez le micro pour répondre", connecting: "Connexion…", disclaimer: "L'audio est transcrit en temps réel et non stocké sans votre consentement. Glow est un compagnon IA — pas les urgences.", error: "Micro ou connexion indisponible. Vérifiez les permissions du navigateur." }, avatar: { title: "Rencontrez votre compagnon", subtitle: "Une présence visuelle pour les conversations vocales.", loading: "Chargement du compagnon…", disclaimer: "L'avatar est purement visuel. Audio transcrit en direct, non stocké sans consentement." }, home: { hero1: "Un endroit plus doux", hero2: "pour démêler vos pensées.", heroSub: "Glow est un compagnon IA de soutien psychologique — pas un remplacement aux soins professionnels, mais un premier pas chaleureux quand commencer est le plus dur.", cta: { start: "Commencer en douceur — c'est gratuit", login: "J'ai déjà un compte" }, privacyLine: "Privé par conception · chiffré · soutien en crise jamais payant", safetyTitle: "La sécurité, honnêtement", safetyBody: "Glow est une IA, jamais un thérapeute agréé. Il ne diagnostique pas, ne juge pas, et vous orientera vers de l'aide humaine réelle quand tout devient trop lourd — y compris des lignes de crise gratuites, quoi qu'il arrive.", f: { chat: { title: "Évacuer ses émotions", desc: "Un compagnon qui écoute — par texte ou voix, quand vous en avez besoin." }, avatar: { title: "Un visage amical", desc: "Présence optionnelle avec voix temps réel et synchronisation labiale." }, journal: { title: "Journal privé", desc: "L'écriture expressive apaise les pensées anxieuses. Vos entrées sont chiffrées, toujours." }, mood: { title: "Analyses d'humeur", desc: "Un suivi quotidien prend des secondes. Des graphiques doux révèlent vos tendances." }, calm: { title: "Le calme en minutes", desc: "Respiration guidée et exercices d'ancrage — de petits outils pour les moments difficiles." }, games: { title: "Guérir en jouant", desc: "Des jeux légers axés sur la concentration et la pleine conscience." } } }, auth: { register: { title: "Créez votre espace", subtitle: "Un compte privé garde votre parcours rien qu'à vous." }, nameLabel: "Comment Glow doit-il vous appeler ?", nameOptional: "(facultatif)", namePlaceholder: "Un nom que vous aimez", email: "E-mail", password: "Mot de passe", passwordHint: "(au moins 10 caractères)", adult: "Je confirme avoir 18 ans ou plus. Glow est actuellement réservé aux adultes.", createAccount: "Créer un compte", haveAccount: "Vous avez déjà un compte ?", noAccount: "Nouveau sur Glow ?", signIn: "Se connecter", loginTitle: "Bon retour", loginSubtitle: "Votre espace est exactement comme vous l'avez laissé.", diagnosis: { question: "Un professionnel vous a-t-il diagnostiqué une trouble de santé mentale ? Si vous êtes à l'aise de le partager, Glow peut être mieux informé — mais c'est totalement facultatif.", share: "Je souhaite partager (je peux modifier ou supprimer à tout moment)", placeholder: "Partagez seulement ce qui vous semble juste — ex. « anxiété généralisée, diagnostiquée en 2022 ». Laissez vide si vous préférez.", note: "Stocké chiffré, visible uniquement par vous, jamais utilisé pour diagnostiquer, et supprimable en un geste. Glow est une IA — il ne remplace pas votre clinicien." } }, profile: { title: "Votre profil", privateSettings: "Vos paramètres privés", account: "Compte", memberSince: "Membre depuis", freeSessions: "Sessions gratuites restantes", diagnosisTitle: "Divulgation du diagnostic", diagnosisDesc: "Facultatif. Le partager aide Glow à être mieux informé — mais cela ne change jamais le soutien reçu.", notShared: "Non partagé", sharingNoDetails: "Partagé (sans détails)", edit: "Modifier", shareSomething: "Partager quelque chose", removeWipe: "Supprimer et effacer la note", save: "Enregistrer", cancel: "Annuler", diagnosisFooter: "Chiffré au repos · visible uniquement par vous · jamais utilisé pour diagnostiquer · la suppression efface définitivement la note." }, wellness: { title: "Outils de bien-être", subtitle: "Petites pratiques, preuves réelles. Tout est privé.", tab: { journal: "Journal", mood: "Humeur", game: "Jeu de concentration" }, journal: { titlePh: "Donnez un titre à l'entrée du jour (facultatif)", writePh: "Écrivez librement — personne ne note ça.", save: "Enregistrer l'entrée", first: "Votre journal attend sa première page.", entryTitle: "Entrée sans titre" }, mood: { howToday: "Comment était votre journée ?", logged: "Enregistré pour aujourd'hui. Revenez demain — la régularité compte plus que la note.", last14: "Les 14 derniers jours", empty: "Aucun enregistrement pour le moment.", footer: "Ce sont les tendances dans le temps qui comptent — une seule journée ne raconte jamais toute l'histoire." }, game: { inhale: "Inspirez…", exhale: "Expirez lentement…", breaths: "respirations · record", begin: "Commencer", finish: "Terminer", footer: "La respiration rythmée (~5,5 resp./min) est associée à une baisse de l'activation physiologique. Pas un traitement médical." } }, billing: { title: "Un soutien qui reste abordable", subtitle: "L'essentiel est gratuit pour toujours. L'aide en crise n'est jamais derrière un paywall.", free: { name: "Gratuit", period: "pour toujours" }, plus: { name: "Glow Plus", tag: "Le plus apprécié" }, payPerSession: "Paiement à la séance", perMonth: "/mois", currentPlan: "Votre plan actuel", waitlist: "Rejoindre la liste d'attente", joined: "Vous êtes sur la liste 💜", footer: "Les paiements seront traités par un fournisseur agréé. Aucune donnée de carte n'est stockée sur nos serveurs.", perSession: "/ séance", buy: "Acheter une séance", egp: "EGP" }, practices: { title: "Pratiques", subtitle: "Explorez la pleine conscience et les exercices d'ancrage." }, reflections: { title: "Votre semaine, doucement remarquée", subtitle: "Une réflexion douce sur votre parcours émotionnel." }, language: { label: "Langue" }, navLang: { en: "English", es: "Español", fr: "Français", ar: "العربية" }, },
  ar: { nav: { talk: "تحدث", presence: "حضور", practices: "تمارين", reflections: "تأملات", chat: "محادثة", voice: "صوت", avatar: "الشخصية", wellness: "رفاهيتك", billing: "الفواتير", signIn: "تسجيل الدخول", signOut: "خروج", profile: "ملفك الشخصي" }, safety: { note: "جلو أداة دعم بالذكاء الاصطناعي، وليست معالجًا بشريًا ولا خدمة طوارئ.", professional: "تحدث مع مختص مؤهل", crisis: "إذا كنت في حالة أزمة الآن، يرجى الاتصال برقم الطوارئ المحلي — المساعدة مجانية بغض النظر عن أي حساب." }, chat: { title: "لنتحدث عن الأمر", placeholder: "اكتب ما يدور في ذهنك…", listening: "جلو يستمع إليك…", typingYou: "أنت تكتب…", error: "لم يتمكن جلو من الوصول إلى خدمة الدعم الآن. إذا كان الأمر عاجلًا، يرجى الاتصال بخدمات الطوارئ المحلية أو خط الأزمات.", checkin1: "ما زلت معك — خذ وقتك. هل هناك شيء تود استكشافه؟", checkin2: "لا داعي للعجلة إطلاقًا. أنا هنا متى شعرت بالاستمرار.", checkin3: "أسألك بلطف فقط — كيف تشعر الآن؟", welcome: "مرحبًا، أنا جلو. رفيق ذكي موجود للاستماع إليك — لست إنسانًا ولا معالجًا. بماذا تفكر هذه الفترة؟" }, voice: { title: "حضور صوتي", subtitle: "تحدث بشكل طبيعي. التسميات النصية دائمًا متاحة.", start: "ابدأ محادثة صوتية", recording: "أستمع إليك — اضغط للإنهاء", thinking: "أفكر…", speaking: "أتحدث — اضغط على الميكروفون للرد", connecting: "جارٍ الاتصال…", disclaimer: "يتم تحويل الصوت إلى نص في الوقت الفعلي ولا يُخزَّن إلا بموافقتك. جلو رفيق ذكي — ليس خدمة طوارئ.", error: "الميكروفون أو الاتصال غير متاح. تحقق من أذونات المتصفح." }, avatar: { title: "تعرّف على رفيقك", subtitle: "حضور مرئي للمحادثات الصوتية.", loading: "جارٍ تحميل الرفيق…", disclaimer: "الشخصية للعرض فقط. يتم تحويل الصوت مباشرة، ولا يُخزَّن بدون موافقتك." }, home: { hero1: "مكان أكثر ليونة", hero2: "لفكّ العقد في أفكارك.", heroSub: "جلو رفيق ذكي لدعم الصحة النفسية — ليس بديلاً عن الرعاية المهنية، بل خطوة أولى دافئة عندما تكون البداية أصعب شيء.", cta: { start: "ابدأ بلطف — إنه مجاني", login: "لدي حساب بالفعل" }, privacyLine: "خصوصية بالتصميم · مشفر · دعم الأزمات مجاني دائمًا", safetyTitle: "الأمان بصدق", safetyBody: "جلو ذكاء اصطناعي، وليس معالجًا مرخصًا. لن يشخّص ولن يحكم عليك، وسيرشدك إلى مساعدة بشرية حقيقية كلما شعرت أن الأمور ثقيلة — بما في ذلك خطوط الأزمات المجانية مهما حدث.", f: { chat: { title: "تحديث عن مشاعرك", desc: "رفيق يستمع إليك — بالنص أو الصوت، متى احتجت. لا حكم على ما تشاركه." }, avatar: { title: "وجه ودود", desc: "شخصية اختيارية بصوت حي ومزامنة شفاه لمحادثة أكثر إنسانية." }, journal: { title: "مفكرة خاصة", desc: "الكتابة التعبيرية تساعد في تخفيف الأفكار القلقة. مدخلاتك مشفرة دائمًا." }, mood: { title: "رؤى المزاج", desc: "تسجيل يومي يستغرق ثوانٍ. رسوم بيانية لطيفة تكشف أنماطك عبر الأسابيع." }, calm: { title: "هدوء في دقائق", desc: "تمارين تنفس وتأريض موجّهة — أدوات صغيرة مستنيرة سريريًا لل لحظات الصعبة." }, games: { title: "الشفاء عبر اللعب", desc: "ألعاب خفيفة مصممة حول التركيز واليقاظ الذهني، لأن الراحة إنتاجية أيضًا." } } }, auth: { register: { title: "أنشئ مساحتك", subtitle: "حساب خاص يحافظ على رحلتك لك وحدك." }, nameLabel: "بماذا تريد أن يناديك جلو؟", nameOptional: "(اختياري)", namePlaceholder: "اسم تحبه", email: "البريد الإلكتروني", password: "كلمة المرور", passwordHint: "(10 أحرف على الأقل)", adult: "أؤكد أن عمري 18 عامًا أو أكثر. جلو حاليًا للبالغين فقط.", createAccount: "إنشاء حساب", haveAccount: "لدي حساب بالفعل؟", noAccount: "جديد على جلو؟", signIn: "تسجيل الدخول", loginTitle: "مرحبًا بعودتك", loginSubtitle: "مساحتك كما تركتها تمامًا.", diagnosis: { question: "هل شخّصك مختص بحالة صحة نفسية؟ إذا كنت مرتاحًا لمشاركتها، يمكن لجلو أن يكون أكثر إدراكًا في المحادثات — لكن هذا اختياري تمامًا.", share: "أود المشاركة (يمكنني التغيير أو الحذف في أي وقت)", placeholder: "شارك فقط ما ترتاح له — مثلاً «قلق معمم، تم التشخيص 2022». اتركه فارغًا إن فضلت ذلك.", note: "يُخزَّن مشفرًا، ولا يراه سواك، ولا يُستخدم للتشخيص، وقابل للحذف بلمسة واحدة. جلو ذكاء اصطناعي — لا يحل محل طبيبك." } }, profile: { title: "ملفك الشخصي", privateSettings: "إعداداتك الخاصة", account: "الحساب", memberSince: "عضو منذ", freeSessions: "الجلسات المجانية المتبقية", diagnosisTitle: "الإفصاح عن التشخيص", diagnosisDesc: "اختياري. إذا شخّصك مختص بحالة، فإن مشاركتها تساعد جلو على فهم أفضل — لكنها لا تغير أبدًا مقدار الدعم الذي تحصل عليه.", notShared: "غير مشارك", sharingNoDetails: "مشاركة (بدون تفاصيل)", edit: "تعديل", shareSomething: "شارك شيئًا", removeWipe: "حذف ومحو الملاحظة", save: "حفظ", cancel: "إلغاء", diagnosisFooter: "مشفر · لا يراه سواك · لا يُستخدم للتشخيص · الحذف يمحو الملاحظة المخزنة نهائيًا." }, wellness: { title: "أدوات الرفاهية", subtitle: "ممارسات صغيرة بأدلة حقيقية. كلها خاصة بك.", tab: { journal: "المفكرة", mood: "مخطط المزاج", game: "لعبة التركيز" }, journal: { titlePh: "أعطِ مدخلة اليوم عنوانًا (اختياري)", writePh: "اكتب بحرية — لا أحد يقيّمك. الكتابة التعبيرية تساعد في تصريف الأفكار القلقة.", save: "حفظ المدخلة", first: "مفكرتك تنتظر صفحتها الأولى.", entryTitle: "مدخلة بدون عنوان" }, mood: { howToday: "كيف كان يومك؟", logged: "تم التسجيل لليوم. عد غدًا — الاستمرارية أهم من الدرجة.", last14: "آخر 14 يومًا", empty: "لا توجد تسجيلات بعد.", footer: "الاتجاه عبر الزمن هو المهم — يوم واحد لا يحكي القصة أبدًا." }, game: { inhale: "شهيق…", exhale: "زفير ببطء…", breaths: "أنفاس · الأفضل", begin: "ابدأ", finish: "إنهاء", footer: "التنفس الموجّه بنحو 5.5 نفس/دقيقة يرتبط بتقليل الإثارة الفسيولوجية. ليس علاجًا طبيًا — مجرد لحظة هدوء." } }, billing: { title: "دعم يبقى في المتناول", subtitle: "الأساسيات مجانية للأبد. مساعدة الأزمات لا تقف أبدًا خلف جدار الدفع — وعد مدمج في المنتج لا في الخطة.", free: { name: "مجاني", period: "للأبد" }, plus: { name: "جلو بلس", tag: "الأكثر تفضيلًا" }, payPerSession: "الدفع لكل جلسة", perMonth: "/شهريًا", currentPlan: "خطتك الحالية", waitlist: "انضم لقائمة الانتظار", joined: "أنت على القائمة 💜", footer: "ستُعالَج المدفوعات عبر مزوّد مرخص بعد مراجعة التكاملات. لا تُخزَّن تفاصيل البطاقات أبدًا على خوادم جلو.", perSession: "/ جلسة", buy: "اشترِ جلسة", egp: "جنيه" }, practices: { title: "تمارين", subtitle: "استكشف تمارين اليقاظ الذهني والتأريض." }, reflections: { title: "أسبوعك بملاحظة لطيفة", subtitle: "تأمل لطيف في رحلتك العاطفية." }, language: { label: "اللغة" }, navLang: { en: "English", es: "Español", fr: "Français", ar: "العربية" } },
} as const;

const flatTranslations: Record<Language, Dict> = {
  en: flatten(translations.en),
  es: flatten(translations.es),
  fr: flatten(translations.fr),
  ar: flatten(translations.ar),
};

function flatten(obj: Record<string, any>, prefix = ""): Dict {
  return Object.entries(obj).reduce<Dict>((acc, [key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(acc, flatten(value, nextKey));
    } else if (typeof value === "string") {
      acc[nextKey] = value;
    }
    return acc;
  }, {});
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  dir: "ltr" | "rtl";
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem("glow.lang") as Language | null;
  return saved && saved in flatTranslations ? saved : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = RTL_LANGUAGES.includes(language) ? "rtl" : "ltr";
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("glow.lang", lang);
    }
  };

  const dir: "ltr" | "rtl" = RTL_LANGUAGES.includes(language) ? "rtl" : "ltr";

  const t = React.useCallback((key: string) => flatTranslations[language][key] ?? flatTranslations.en[key] ?? key, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, dir, t }}>
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
