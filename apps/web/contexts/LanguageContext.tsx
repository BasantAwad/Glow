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
       "nav": {
           "talk": "Talk",
           "presence": "Presence",
           "practices": "Practices",
           "reflections": "Reflections",
           "chat": "Chat",
           "voice": "Voice",
           "avatar": "Avatar",
           "wellness": "Wellness",
           "billing": "Billing",
           "signIn": "Sign in",
           "signOut": "Sign out",
           "profile": "Your profile"
       },
       "safety": {
           "note": "Glow is an AI support tool, not a human therapist or emergency service.",
           "professional": "Talk with a qualified professional",
           "crisis": "If you're in crisis right now, please contact your local emergency number — help is free regardless of any account."
       },
       "chat": {
           "title": "Talk it through",
           "placeholder": "Type what's on your mind…",
           "listening": "Glow is listening…",
           "typingYou": "you're typing…",
           "error": "Glow couldn't reach its support service just now. If this is urgent, please contact your local emergency services or crisis line.",
           "checkin1": "Still with you — take your time. Is there anything on your mind you'd like to explore?",
           "checkin2": "No rush at all. I'm here whenever you feel like continuing.",
           "checkin3": "Just checking in gently — how are you feeling right now?",
           "welcome": "Hi, I'm Glow. I'm an AI companion here to listen — not a human or a therapist. What's been on your mind lately?"
       },
       "voice": {
           "title": "Voice presence",
           "subtitle": "Talk naturally. Captions always on.",
           "start": "Start a voice conversation",
           "recording": "I'm listening — tap to finish",
           "thinking": "Thinking…",
           "speaking": "Speaking — tap the mic to reply",
           "connecting": "Connecting…",
           "disclaimer": "Audio is transcribed in real time and is not stored unless you consent. Glow is an AI companion — not emergency care.",
           "error": "Microphone or connection unavailable. Check browser permissions."
       },
       "avatar": {
           "title": "Meet your companion",
           "subtitle": "A visual presence for voice conversations.",
           "loading": "Loading companion…",
           "disclaimer": "Avatar is presentation only. Audio transcribed live, not stored without consent."
       },
       "home": {
           "hero1": "A softer place to",
           "hero2": "untangle your thoughts.",
           "heroSub": "Glow is an AI companion for mental-health support — not a replacement for professional care, but a warm first step when getting started is the hardest part.",
           "cta": {
               "start": "Begin gently — it's free",
               "login": "I already have an account"
           },
           "privacyLine": "Private by design · encrypted at rest · crisis support never paywalled",
           "safetyTitle": "Safety, honestly",
           "safetyBody": "Glow is an AI, never a licensed therapist. It won't diagnose, won't judge, and will point you to real human help whenever things feel too heavy — including crisis lines that are free to call, no matter what.",
           "f": {
               "chat": {
                   "title": "Talk it out",
                   "desc": "A companion that listens — by text or voice, whenever you need it. Nothing you share is judged."
               },
               "avatar": {
                   "title": "See a friendly face",
                   "desc": "Optional avatar presence with real-time voice and lip-sync for a more human conversation."
               },
               "journal": {
                   "title": "Private journal",
                   "desc": "Expressive writing is proven to ease anxious thoughts. Your entries are encrypted, always."
               },
               "mood": {
                   "title": "Mood insights",
                   "desc": "A daily check-in takes seconds. Gentle charts reveal your patterns over weeks, not scores."
               },
               "calm": {
                   "title": "Calm in minutes",
                   "desc": "Guided breathing and grounding exercises — small, clinically-informed tools for hard moments."
               },
               "games": {
                   "title": "Healing through play",
                   "desc": "Lightweight games designed around focus and mindfulness, because rest is productive too."
               },
               "breathing": {
                   "title": "Breathing Pacer",
                   "desc": "Follow the circle — inhale, hold, exhale. A simple rhythm exercise.",
                   "inhale": "Breathe in…",
                   "hold": "Hold…",
                   "exhale": "Breathe out slowly…",
                   "done": "You did it!",
                   "complete": "Session complete",
                   "again": "Breathe again",
                   "skip": "Skip",
                   "hint": "4 seconds in, 4 seconds hold, 6 seconds out — repeat 4 times."
               },
               "moodmatch": {
                   "title": "Mood Match",
                   "desc": "Flip the cards and pair emotions. A gentle memory game.",
                   "turns": "Turns",
                   "matched": "Matched",
                   "win": "All matched!",
                   "start": "Start game",
                   "playAgain": "Play again"
               },
               "focustap": {
                   "title": "Focus Tap",
                   "desc": "Tap in rhythm with the pulse. Trains attention and timing.",
                   "start": "Start tapping",
                   "wait": "Wait for the beat…",
                   "tap": "Tap now!",
                   "miss": "Missed the beat",
                   "done": "Session complete",
                   "score": "Score",
                   "stop": "Stop",
                   "hint": "Tap exactly when the circle turns green. 10 beats per round.",
                   "playAgain": "Play again"
               },
               "gratitudes": {
                   "title": "Gratitude Garden",
                   "desc": "Plant a seed for each thing you're grateful for.",
                   "prompt": "What's one thing you're grateful for right now?",
                   "placeholder": "e.g. the warm sun this morning",
                   "plant": "Plant",
                   "remove": "Remove",
                   "empty": "Your garden is empty. Plant your first seed!",
                   "plants": "seeds planted",
                   "water": "Tend your garden — small moments grow."
               }
           }
       },
       "auth": {
           "register": {
               "title": "Create your space",
               "subtitle": "A private account keeps your journey yours alone."
           },
           "nameLabel": "What should Glow call you?",
           "nameOptional": "(optional)",
           "namePlaceholder": "A name you like",
           "email": "Email",
           "password": "Password",
           "passwordHint": "(at least 10 characters)",
           "adult": "I confirm I am 18 or older. Glow is currently adults-only.",
           "createAccount": "Create account",
           "haveAccount": "Already have an account?",
           "noAccount": "New to Glow?",
           "signIn": "Sign in",
           "loginTitle": "Welcome back",
           "loginSubtitle": "Your space is exactly as you left it.",
           "diagnosis": {
               "question": "Have you been diagnosed with a mental-health condition by a professional? If you're comfortable sharing it, Glow can be more informed in conversations — but this is entirely optional.",
               "share": "I'd like to share (I can change or remove this anytime)",
               "placeholder": "Share only what feels right — e.g. 'generalized anxiety, diagnosed 2022'. Leave blank if you prefer.",
               "note": "Stored encrypted, visible only to you, never used to diagnose, and deletable in one tap. Glow is an AI — it doesn't replace your clinician."
           },
           "ageLabel": "Age",
           "ageHint": "Glow is adults-only (18+).",
           "genderLabel": "How would you describe your gender?",
           "genderHint": "Personal context only — choose whatever fits, or prefer not to say.",
           "genderPlaceholder": "Choose…",
           "genderFemale": "Female",
           "genderMale": "Male",
           "genderNonBinary": "Non-binary",
           "genderPreferNotToSay": "Prefer not to say",
           "medicationLabel": "Current medications",
           "medicationOptional": "(optional)",
           "medicationPlaceholder": "e.g. none, or names/doses only if you're comfortable",
           "medicationHint": "Stored encrypted, visible only to you, removable anytime.",
           "resetTitle": "Reset your password",
           "resetLead": "Enter your account email and we'll send you a secure reset link.",
           "resetRequest": "Send reset link",
           "resetSent": "If an account exists for that email, a reset link is on its way. Check your inbox (and spam folder).",
           "resetSetTitle": "Choose a new password",
           "resetSet": "Set new password",
           "resetInvalid": "This reset link is invalid or has expired. Request a new one from the sign-in page.",
           "resetDone": "Your password has been updated. You can sign in now.",
           "verifyTitle": "Confirm your email",
           "verifyWorking": "Confirming...",
           "verifyOk": "Your email is confirmed. Thank you!",
           "verifyErr": "This verification link is invalid or has expired.",
           "forgotPassword": "Forgot password?"
       },
       "profile": {
           "title": "Your profile",
           "privateSettings": "Your private settings",
           "account": "Account",
           "memberSince": "Member since",
           "freeSessions": "Free sessions left",
           "diagnosisTitle": "Diagnosis disclosure",
           "diagnosisDesc": "Optional. If a professional has diagnosed you with something, sharing it helps Glow be more informed — but it never changes how much you're supported.",
           "notShared": "Not shared",
           "sharingNoDetails": "Sharing (no details written)",
           "edit": "Edit",
           "shareSomething": "Share something",
           "removeWipe": "Remove & wipe note",
           "save": "Save",
           "cancel": "Cancel",
           "diagnosisFooter": "Encrypted at rest · visible only to you · never used to diagnose · removing wipes the stored note entirely.",
           "medicationTitle": "Medication disclosure",
           "medicationDesc": "Optional. Sharing current medications can help Glow be more informed — but it is entirely your choice, and never used to diagnose.",
           "medicationHint": "Encrypted at rest · visible only to you · never used to diagnose or prescribe · removing wipes the stored data entirely."
       },
       "wellness": {
           "title": "Wellness tools",
           "subtitle": "Small practices, real evidence. All private to you.",
           "tab": {
               "journal": "Journal",
               "mood": "Mood chart",
               "game": "Focus game"
           },
           "journal": {
               "titlePh": "Give today's entry a title (optional)",
               "writePh": "Write freely — nobody grades this. Expressive writing helps externalize anxious thoughts.",
               "save": "Save entry",
               "first": "Your journal is waiting for its first page.",
               "entryTitle": "Untitled entry"
           },
           "mood": {
               "howToday": "How was today?",
               "logged": "Logged for today. Come back tomorrow — consistency matters more than the score.",
               "last14": "Last 14 days",
               "empty": "No check-ins yet.",
               "footer": "Trends over time are what matter — a single day never tells the story."
           },
           "game": {
               "inhale": "Breathe in…",
               "exhale": "Breathe out slowly…",
               "breaths": "breaths · best",
               "begin": "Begin",
               "finish": "Finish",
               "footer": "Paced breathing at ~5.5 breaths/min is associated with reduced physiological arousal. Not a medical treatment — just a moment of calm."
           }
       },
       "billing": {
           "title": "Support that stays affordable",
           "subtitle": "The essentials are free forever. Crisis help is never behind a paywall — that's a promise built into the product, not the plan.",
           "free": {
               "name": "Free",
               "period": "forever"
           },
           "plus": {
               "name": "Glow Plus",
               "tag": "Most loved"
           },
           "payPerSession": "Pay per session",
           "perMonth": "/month",
           "currentPlan": "Your current plan",
           "waitlist": "Join waitlist",
           "joined": "You're on the list 💜",
           "footer": "Payments will be processed by a licensed provider once integrations are reviewed. No card details are ever stored on Glow's servers.",
           "perSession": "/ session",
           "buy": "Buy a session",
           "egp": "EGP"
       },
       "practices": {
           "title": "Practices",
           "subtitle": "Explore mindfulness and grounding exercises."
       },
       "reflections": {
           "title": "Your session history",
           "subtitle": "Every conversation you've had with Glow, saved privately."
       },
       "crisis": {
           "emergency": "Emergency",
           "line": "Crisis line",
           "professional": "Find a therapist",
           "aiNote": "Glow is AI support — not a substitute for professional care."
       },
       "mood": {
           "title": "How are you feeling right now?",
           "subtitle": "Pick what feels closest — even if it's not exact.",
           "veryLow": "Very low",
           "low": "Low",
           "okay": "Okay",
           "good": "Good",
           "great": "Great"
       },
       "prompts": {
           "howWeek": "How has your week been?",
           "struggling": "I've been struggling with sleep",
           "anxious": "I feel anxious but I'm not sure why",
           "justListen": "I just need someone to listen",
           "tired": "I'm really tired all the time",
           "lonely": "I've been feeling lonely lately"
       },
       "session": {
           "start": "Start session",
           "end": "End session",
           "minuteWarning": "We have about {mins} minutes left — is there anything you want to cover?",
           "ending": "Wrapping up..."
       },
       "practice": {
           "boxBreathing": "Box Breathing",
           "boxBreathingDesc": "A simple 4-second breathing technique to calm your nervous system.",
           "bodyScan": "Body Scan",
           "bodyScanDesc": "Release tension by noticing each part of your body.",
           "journaling": "Journaling Prompt",
           "journalingDesc": "Write down what's on your mind, one sentence at a time.",
           "soundscape": "Soundscape",
           "soundscapeDesc": "Gentle ambient sound to help you settle.",
           "step": "Step {n} of {total}",
           "breatheIn": "Breathe in...",
           "breatheHold": "Hold...",
           "breatheOut": "Breathe out...",
           "done": "Done. How do you feel now?",
           "start": "Start exercise",
           "pause": "Pause",
           "resume": "Resume",
           "next": "Next",
           "repeat": "Repeat",
           "skip": "Skip"
       },
       "history": {
           "title": "Your session history",
           "empty": "No sessions yet. Start your first conversation to see it here.",
           "searchPlaceholder": "Search sessions...",
           "date": "Session on {date}",
           "summary": "Summary",
           "view": "View",
           "export": "Export for doctor",
           "doctorPrepTitle": "What to tell your doctor",
           "doctorPrepSubtitle": "A summary of what you shared, ready to show at your appointment.",
           "copy": "Copy",
           "download": "Download",
           "noSessions": "Complete a session first to generate a doctor summary."
       },
       "language": {
           "label": "Language"
       },
       "navLang": {
           "en": "English",
           "es": "Español",
           "fr": "Français",
           "ar": "العربية"
       },
       "privacyPage": {
           "title": "Privacy",
           "lead": "This page describes how the Glow prototype/app handles information. It is provided for transparency and is not legal advice.",
           "whatTitle": "What Glow is",
           "whatBody": "Glow is an AI support tool for reflection and conversation. It is not a human therapist, not emergency care, and not a medical or diagnostic service.",
           "accountTitle": "Account and session data",
           "accountItem1": "Account information you provide (such as email/display name) is used to sign you in and manage your account.",
           "accountItem2": "Authentication uses server-issued tokens. The app may also use an HttpOnly auth cookie where supported for session persistence.",
           "accountItem3": "Conversation/session data handling depends on your consent choices and deployment configuration. In this codebase, message storage is designed to be consent-aware and encrypted at rest when transcript retention is enabled.",
           "journalTitle": "Journal and mood entries",
           "journalBody": "If you use journaling or mood check-ins, those entries are stored for your account so you can view them later. Journal content is designed to be encrypted at rest by the backend. You should only write what you are comfortable storing.",
           "aiTitle": "AI processing",
           "aiBody": "When an external AI provider is configured, text you submit may be sent to that provider to generate responses. Deployment operators are responsible for selecting providers, reviewing their terms, and configuring data processing appropriately. When using the local development fallback, responses are generated by a rule-based engine in the app process.",
           "securityTitle": "Security",
           "securityItem1": "Use HTTPS in production and set secure cookie/CORS settings for your deployed domains.",
           "securityItem2": "Secrets (auth keys, master keys, provider tokens) must be stored in environment variables or a secret manager, never in source control.",
           "securityItem3": "No system can guarantee absolute security. Report suspected issues to the deployment operator.",
           "choicesTitle": "Your choices",
           "choicesBody": "Depending on the deployed features, you may be able to manage consent, review saved entries, and request account/data actions. Availability depends on the specific deployment and applicable laws.",
           "updated": "Last updated: 2026-11-09 (prototype documentation). Production deployments should provide operator contact details and jurisdiction-specific notices."
       },
       "safetyPage": {
           "title": "Safety & Terms",
           "lead": "Please read this before using Glow. These terms are provided for transparency and are not legal advice.",
           "limitsTitle": "Important limitations",
           "limitHumanShort": "Not a human.",
           "limitHumanBody": "Glow is an AI support tool, not a person.",
           "limitMedicalShort": "Not medical care.",
           "limitMedicalBody": "Glow does not provide medical advice, diagnosis, treatment, or prescriptions.",
           "limitEmergencyShort": "Not emergency care.",
           "limitEmergencyBody": "Glow is not designed for emergencies or crisis intervention as a substitute for professional help.",
           "limitImperfectShort": "May be imperfect.",
           "limitImperfectBody": "AI responses can be incomplete, inaccurate, or unsuitable. Use your judgment and seek qualified help when needed.",
           "crisisTitle": "If you need urgent help",
           "crisisBody": "If you are in immediate danger, feel unable to stay safe, or need urgent medical or mental health help, contact your local emergency number or a trusted person right now.",
           "crisisItem1": "Use the emergency number for your country or region.",
           "crisisItem2": "If possible, contact a local crisis hotline or mental health service in your area.",
           "crisisItem3": "Reach out to someone you trust and ask them to stay with you while you get help.",
           "crisisNote": "Crisis resources vary by location and must be verified by qualified local reviewers before being presented as official recommendations. This prototype does not claim a complete, verified global crisis directory.",
           "responsibleTitle": "Using Glow responsibly",
           "responsibleItem1": "Use Glow for support, reflection, and planning small next steps — not as a replacement for professional care.",
           "responsibleItem2": "Do not rely on Glow for medication decisions, diagnosis, or urgent risk situations.",
           "responsibleItem3": "Protect your account credentials and use Glow on devices you trust.",
           "termsTitle": "Terms (prototype)",
           "termsBody": "By using this deployment, you agree to use it lawfully and understand its limitations. Operators may update features, availability, and policies. Production deployments should provide complete terms, privacy notices, operator identity, and contact information appropriate to their jurisdiction.",
           "updated": "Last updated: 2026-11-09 (prototype documentation)."
       },
       "learnPage": {
           "label": "Learn",
           "title": "Body and mind, together",
           "lead": "Physical health and mental health shape each other. These outside pages explain the connection in depth — reading them is optional, and none of them replace care from a professional who knows you.",
           "footer": "External links open in a new tab. Glow does not reproduce these articles; summaries here are original. If you are in crisis, please use the crisis support links in the footer — help is free regardless of account.",
           "blurb1": "How mental health affects physical health and the other way round — with practical self-help ideas around exercise, eating well, and talking to your GP.",
           "blurb2": "Why changes in one area so often mirror changes in the other, from stress and sleep to exercise, nutrition, and mindfulness — explained in plain terms.",
           "blurb3": "An overview of what the research shows about how body and mind influence each other, including the biological pathways involved.",
           "blurb4": "Lesson material from the American Psychological Association's Global Psychology Alliance on integrating physical and mental health care."
       },
       "yoga": {
           "seatedOptionLabel": "Seated or still option:"
       },
       "studio": {
           "guidedReflection": "Guided Reflection",
           "freeFlow": "Free-Flow Notebook",
           "encrypted": "AES-GCM Envelope Encrypted",
           "chooseTheme": "Choose a Reflection Theme",
           "shuffle": "Shuffle Prompt",
           "todaysPrompt": "Today's Gentle Prompt",
           "useInJournal": "Use in Journal",
           "type": "Type",
           "pen": "Pen",
           "typeHint": "Type with your keyboard",
           "penHint": "Write with your mouse, finger, or stylus",
           "chooseInk": "Choose ink color",
           "decorateHint": "Decorate with stickers",
           "stickers": "Stickers",
           "uploadHint": "Upload a photo sticker from your device",
           "photo": "Photo",
           "stampHint": "Tap to stamp:",
           "stampOnPage": "Stamp on page",
           "uploadFromDevice": "Upload from device",
           "clearStickers": "Clear stickers",
           "penWidth": "Pen width",
           "eraser": "Eraser",
           "undo": "Undo",
           "clearPen": "Clear pen",
           "penHowto": "Draw with a mouse, finger, or stylus. Switch to Type anytime — both are saved together.",
           "titlePh": "Title of this page (optional)...",
           "bodyPh": "Write whatever is in your heart... This page is entirely yours, unjudged and private.",
           "dragHint": "Drag to move. Select to resize, rotate, or crop.",
           "words": "{n} words",
           "saved": "Saved safely to your journal",
           "clearPage": "Clear page",
           "save": "Save to Journal",
           "previous": "Previous Keepsakes",
           "entries": "{n} entries",
           "loading": "Loading...",
           "untitled": "Untitled Reflection",
           "penPage": "· pen page",
           "penText": "· pen + text",
           "stickersCount": "· {n} stickers",
           "exportHint": "Export entry to text file",
           "handwrittenAlt": "Handwritten journal page",
           "handwrittenPage": "[Handwritten page]",
           "decoratedPage": "[Decorated page]",
           "waitingTitle": "Your journal is waiting for its first page",
           "waitingBody": "Type, draw with your mouse, choose a paper theme, or add a photo sticker from your device.",
           "cropTitle": "Crop photo sticker",
           "cancel": "Cancel",
           "applyCrop": "Apply crop",
           "selectedPhoto": "Selected photo",
           "size": "Size",
           "rotate": "Rotate",
           "crop": "Crop",
           "remove": "Remove",
           "done": "Done",
           "cropPreviewAlt": "Crop preview",
           "cropHint": "Drag the crop box? No — trim edges with the sliders. Try sliders below.",
           "top": "Top",
           "right": "Right",
           "bottom": "Bottom",
           "left": "Left",
           "resetCrop": "Reset crop",
           "selectedEmojiPrefix": "Selected"
       },
       "moodTracker": {
           "heading": "How was today?",
           "intro": "You can check in as many times as you need today. Feelings are allowed to change, overlap, and contradict each other.",
           "overall": "Overall, this moment feels",
           "extra": "What else is present? Pick as many as fit",
           "selected": "{n}/8 selected",
           "noteLabel": "Anything you want to remember about this moment?",
           "notePh": "Optional — a few words are enough.",
           "savedMsg": "Check-in saved. Thank you for noticing yourself.",
           "todayMany": "{n} check-ins today — more are always welcome.",
           "todayNone": "No check-in yet today.",
           "add": "Add this check-in",
           "weather": "Today's emotional weather",
           "moments": "{n} moments",
           "daysHint": "Every dot is one check-in. Days can hold several different feelings.",
           "noCheckin": "No check-in",
           "multiLegend": "· numbers above a day show multiple check-ins",
           "low": "low",
           "okay": "okay",
           "good": "good",
           "trends": "Trends over time are what matter — a single day, or a single feeling, never tells the whole story.",
           "palette": "This week's emotional palette",
           "last7": "Last 7 days",
           "paletteBody": "A wider palette is not a problem to fix. It is information about what you have been carrying.",
           "groupHeavy": "Heavy",
           "groupActivated": "Activated",
           "groupCalm": "Calm",
           "groupLow": "Low energy",
           "hintHeavy": "Sadness, grief, loneliness",
           "hintActivated": "Anxiety, anger, pressure",
           "hintCalm": "Peace, hope, connection",
           "hintLow": "Fatigue, fog, quiet"
       }
},
  es: {
       "nav": {
           "talk": "Hablar",
           "presence": "Presencia",
           "practices": "Prácticas",
           "reflections": "Reflexiones",
           "chat": "Chat",
           "voice": "Voz",
           "avatar": "Avatar",
           "wellness": "Bienestar",
           "billing": "Facturación",
           "signIn": "Iniciar sesión",
           "signOut": "Salir",
           "profile": "Tu perfil"
       },
       "safety": {
           "note": "Glow es una herramienta de apoyo con IA, no un terapeuta humano ni un servicio de emergencia.",
           "professional": "Habla con un profesional cualificado",
           "crisis": "Si estás en crisis ahora mismo, contacta con tu número local de emergencias — la ayuda es gratuita sin importar la cuenta."
       },
       "chat": {
           "title": "Hablemos del tema",
           "placeholder": "Escribe lo que tienes en mente…",
           "listening": "Glow está escuchando…",
           "typingYou": "estás escribiendo…",
           "error": "Glow no pudo contactar el servicio de apoyo en este momento. Si es urgente, contacta a tus servicios locales de emergencia o línea de crisis.",
           "checkin1": "Sigo aquí — tómate tu tiempo. ¿Hay algo que te gustaría explorar?",
           "checkin2": "Sin prisa alguna. Estoy aquí cuando quieras continuar.",
           "checkin3": "Solo pregunto con cariño — ¿cómo te sientes ahora?",
           "welcome": "Hola, soy Glow. Soy un compañero de IA aquí para escucharte — no soy humano ni terapeuta. ¿Qué ha estado en tu mente últimamente?"
       },
       "voice": {
           "title": "Presencia de voz",
           "subtitle": "Habla con naturalidad. Subtítulos siempre activados.",
           "start": "Comenzar conversación de voz",
           "recording": "Te escucho — toca para terminar",
           "thinking": "Pensando…",
           "speaking": "Hablando — toca el micrófono para responder",
           "connecting": "Conectando…",
           "disclaimer": "El audio se transcribe en tiempo real y no se almacena sin tu consentimiento. Glow es un compañero de IA — no emergencias.",
           "error": "Micrófono o conexión no disponibles. Revisa los permisos del navegador."
       },
       "avatar": {
           "title": "Conoce a tu compañero",
           "subtitle": "Una presencia visual para conversaciones de voz.",
           "loading": "Cargando compañero…",
           "disclaimer": "El avatar es solo presentación. Audio transcrito en vivo, no almacenado sin consentimiento."
       },
       "home": {
           "hero1": "Un lugar más suave",
           "hero2": "para desenredar tus pensamientos.",
           "heroSub": "Glow es un compañero de IA para apoyo emocional — no reemplaza el cuidado profesional, sino un primer paso cálido cuando empezar es lo más difícil.",
           "cta": {
               "start": "Empieza suavemente — es gratis",
               "login": "Ya tengo cuenta"
           },
           "privacyLine": "Privado por diseño · cifrado · apoyo en crisis nunca de pago",
           "safetyTitle": "Seguridad, honestamente",
           "safetyBody": "Glow es una IA, nunca un terapeuta licenciado. No diagnostica, no juzga y te guiará a ayuda humana real cuando las cosas pesen demasiado — incluyendo líneas de crisis gratuitas, pase lo que pase.",
           "f": {
               "chat": {
                   "title": "Desahógate",
                   "desc": "Un compañero que escucha — por texto o voz, cuando lo necesites. Nada de lo que compartas es juzgado."
               },
               "avatar": {
                   "title": "Un rostro amable",
                   "desc": "Presencia opcional con voz en tiempo real y sincronización labial."
               },
               "journal": {
                   "title": "Diario privado",
                   "desc": "La escritura expresiva alivia pensamientos ansiosos. Tus entradas están cifradas, siempre."
               },
               "mood": {
                   "title": "Perspectivas del ánimo",
                   "desc": "Un registro diario toma segundos. Gráficos suaves revelan tus patrones semanales."
               },
               "calm": {
                   "title": "Calma en minutos",
                   "desc": "Respiración guiada y ejercicios de arraigo — herramientas pequeñas para momentos difíciles."
               },
               "games": {
                   "title": "Sanar jugando",
                   "desc": "Juegos ligeros centrados en atención plena, porque descansar también produce."
               },
               "breathing": {
                   "again": "Respira de nuevo",
                   "complete": "Sesión completada",
                   "desc": "Sigue el círculo — inhala, mantén, exhala. Un ejercicio de ritmo sencillo.",
                   "done": "¡Lo lograste!",
                   "exhale": "Exhala lentamente…",
                   "hint": "4 segundos inhalando, 4 reteniendo, 6 exhalando — repite 4 veces.",
                   "hold": "Mantén…",
                   "inhale": "Inhala…",
                   "skip": "Omitir",
                   "title": "Ritmo de respiración"
               },
               "focustap": {
                   "desc": "Toca al ritmo del pulso. Entrena la atención y el tiempo.",
                   "done": "Sesión completada",
                   "hint": "Toca justo cuando el círculo se ponga verde. 10 pulsos por ronda.",
                   "miss": "Fallaste el ritmo",
                   "playAgain": "Jugar de nuevo",
                   "score": "Puntos",
                   "start": "Empezar a tocar",
                   "stop": "Detener",
                   "tap": "¡Toca ahora!",
                   "title": "Toque de concentración",
                   "wait": "Espera el pulso…"
               },
               "gratitudes": {
                   "desc": "Planta una semilla por cada cosa que agradeces.",
                   "empty": "Tu jardín está vacío. ¡Planta tu primera semilla!",
                   "placeholder": "p. ej., el cálido sol de esta mañana",
                   "plant": "Plantar",
                   "plants": "semillas plantadas",
                   "prompt": "¿Por qué cosa estás agradecido(a) ahora mismo?",
                   "remove": "Quitar",
                   "title": "Jardín de gratitud",
                   "water": "Cuida tu jardín — los pequeños momentos crecen."
               },
               "moodmatch": {
                   "desc": "Voltea las cartas y empareja emociones. Un juego de memoria suave.",
                   "matched": "Pareja encontrada",
                   "playAgain": "Jugar de nuevo",
                   "start": "Empezar juego",
                   "title": "Pareja de emociones",
                   "turns": "Turnos",
                   "win": "¡Todo emparejado!"
               }
           }
       },
       "auth": {
           "register": {
               "title": "Crea tu espacio",
               "subtitle": "Una cuenta privada mantiene tu viaje solo tuyo."
           },
           "nameLabel": "¿Cómo debe llamarte Glow?",
           "nameOptional": "(opcional)",
           "namePlaceholder": "Un nombre que te guste",
           "email": "Correo electrónico",
           "password": "Contraseña",
           "passwordHint": "(al menos 10 caracteres)",
           "adult": "Confirmo que tengo 18 años o más. Glow es actualmente solo para adultos.",
           "createAccount": "Crear cuenta",
           "haveAccount": "¿Ya tienes cuenta?",
           "noAccount": "¿Nuevo en Glow?",
           "signIn": "Iniciar sesión",
           "loginTitle": "Bienvenido de nuevo",
           "loginSubtitle": "Tu espacio está tal como lo dejaste.",
           "diagnosis": {
               "question": "¿Un profesional te ha diagnosticado alguna condición de salud mental? Si te sientes cómodo compartiéndolo, Glow puede estar más informado — pero es totalmente opcional.",
               "share": "Me gustaría compartirlo (puedo cambiarlo o eliminarlo en cualquier momento)",
               "placeholder": "Comparte solo lo que te sientas cómodo — p.ej. «ansiedad generalizada, diagnosticada 2022». Déjalo vacío si prefieres.",
               "note": "Almacenado cifrado, visible solo para ti, nunca usado para diagnosticar, y borrable con un toque. Glow es una IA — no reemplaza a tu clínico."
           },
           "ageLabel": "Edad",
           "ageHint": "Glow es solo para adultos (18+).",
           "genderLabel": "¿Cómo describirías tu género?",
           "genderHint": "Solo contexto personal — elige lo que encaje o prefiere no decirlo.",
           "genderPlaceholder": "Elegir…",
           "genderFemale": "Mujer",
           "genderMale": "Hombre",
           "genderNonBinary": "No binario",
           "genderPreferNotToSay": "Prefiero no decirlo",
           "medicationLabel": "Medicación actual",
           "medicationOptional": "(opcional)",
           "medicationPlaceholder": "p. ej., ninguno, o nombres/dosis solo si te sientes cómodo",
           "medicationHint": "Se almacena cifrado, visible solo para ti, y eliminable en cualquier momento.",
           "resetTitle": "Restablece tu contraseña",
           "resetLead": "Ingresa el correo de tu cuenta y te enviaremos un enlace seguro de restablecimiento.",
           "resetRequest": "Enviar enlace",
           "resetSent": "Si existe una cuenta para ese correo, un enlace de restablecimiento va en camino. Revisa tu bandeja (y la carpeta de spam).",
           "resetSetTitle": "Elige una nueva contraseña",
           "resetSet": "Establecer nueva contraseña",
           "resetInvalid": "Este enlace es inválido o ha caducado. Solicita uno nuevo desde la página de inicio de sesión.",
           "resetDone": "Tu contraseña fue actualizada. Ya puedes iniciar sesión.",
           "verifyTitle": "Confirma tu correo",
           "verifyWorking": "Confirmando...",
           "verifyOk": "Tu correo está confirmado. ¡Gracias!",
           "verifyErr": "Este enlace de verificación es inválido o ha caducado.",
           "forgotPassword": "¿Olvidaste tu contraseña?"
       },
       "profile": {
           "title": "Tu perfil",
           "privateSettings": "Tus ajustes privados",
           "account": "Cuenta",
           "memberSince": "Miembro desde",
           "freeSessions": "Sesiones gratis restantes",
           "diagnosisTitle": "Divulgación de diagnóstico",
           "diagnosisDesc": "Opcional. Compartirlo ayuda a Glow a estar mejor informado — pero nunca cambia cuánto apoyo recibes.",
           "notShared": "No compartido",
           "sharingNoDetails": "Compartiendo (sin detalles)",
           "edit": "Editar",
           "shareSomething": "Compartir algo",
           "removeWipe": "Eliminar y borrar nota",
           "save": "Guardar",
           "cancel": "Cancelar",
           "diagnosisFooter": "Cifrado en reposo · visible solo para ti · nunca usado para diagnosticar · eliminar borra la nota completamente.",
           "medicationTitle": "Divulgación de medicación",
           "medicationDesc": "Opcional. Compartir tu medicación actual puede ayudar a Glow a estar mejor informado, pero es totalmente tu elección y nunca se usa para diagnosticar.",
           "medicationHint": "Cifrado en reposo · visible solo para ti · nunca se usa para diagnosticar ni recetar · al eliminarlo se borra todo."
       },
       "wellness": {
           "title": "Herramientas de bienestar",
           "subtitle": "Prácticas pequeñas, evidencia real. Todo privado.",
           "tab": {
               "journal": "Diario",
               "mood": "Ánimo",
               "game": "Juego de enfoque"
           },
           "journal": {
               "titlePh": "Dale un título a la entrada de hoy (opcional)",
               "writePh": "Escribe libremente — nadie califica esto.",
               "save": "Guardar entrada",
               "first": "Tu diario espera su primera página.",
               "entryTitle": "Entrada sin título"
           },
           "mood": {
               "howToday": "¿Cómo fue tu día?",
               "logged": "Registrado por hoy. Vuelve mañana — la constancia importa más que la nota.",
               "last14": "Últimos 14 días",
               "empty": "Aún no hay registros.",
               "footer": "Las tendencias a largo plazo importan — un solo día nunca cuenta la historia."
           },
           "game": {
               "inhale": "Inhala…",
               "exhale": "Exhala despacio…",
               "breaths": "respiraciones · récord",
               "begin": "Comenzar",
               "finish": "Terminar",
               "footer": "La respiración pausada ~5.5 resp/min se asocia con menor activación fisiológica. No es tratamiento médico."
           }
       },
       "billing": {
           "title": "Apoyo que sigue siendo accesible",
           "subtitle": "Lo esencial es gratis para siempre. La ayuda en crisis jamás está tras un muro de pago.",
           "free": {
               "name": "Gratis",
               "period": "para siempre"
           },
           "plus": {
               "name": "Glow Plus",
               "tag": "El favorito"
           },
           "payPerSession": "Pago por sesión",
           "perMonth": "/mes",
           "currentPlan": "Tu plan actual",
           "waitlist": "Unirse a lista de espera",
           "joined": "Estás en la lista 💜",
           "footer": "Los pagos serán procesados por un proveedor autorizado. Nunca almacenamos datos de tarjetas.",
           "perSession": "/ sesión",
           "buy": "Comprar una sesión",
           "egp": "EGP"
       },
       "practices": {
           "title": "Prácticas",
           "subtitle": "Explora ejercicios de atención plena y arraigo."
       },
       "reflections": {
           "title": "Tu semana, gentilmente observada",
           "subtitle": "Una reflexión suave sobre tu viaje emocional."
       },
       "language": {
           "label": "Idioma"
       },
       "navLang": {
           "en": "English",
           "es": "Español",
           "fr": "Français",
           "ar": "العربية"
       },
       "crisis": {
           "aiNote": "Glow es apoyo con IA — no sustituye la atención profesional.",
           "emergency": "Emergencia",
           "line": "Línea de crisis",
           "professional": "Buscar un terapeuta"
       },
       "history": {
           "copy": "Copiar",
           "date": "Sesión del {date}",
           "doctorPrepSubtitle": "Un resumen de lo que compartiste, listo para mostrar en tu cita.",
           "doctorPrepTitle": "Qué contarle a tu médico",
           "download": "Descargar",
           "empty": "Aún no hay sesiones. Empieza tu primera conversación para verla aquí.",
           "export": "Exportar para el médico",
           "noSessions": "Completa primero una sesión para generar un resumen para tu médico.",
           "searchPlaceholder": "Buscar sesiones...",
           "summary": "Resumen",
           "title": "Tu historial de sesiones",
           "view": "Ver"
       },
       "mood": {
           "good": "Bien",
           "great": "Muy bien",
           "low": "Bajo",
           "okay": "Más o menos",
           "subtitle": "Elige lo que se sienta más cercano, aunque no sea exacto.",
           "title": "¿Cómo te sientes ahora mismo?",
           "veryLow": "Muy bajo"
       },
       "practice": {
           "bodyScan": "Escaneo corporal",
           "bodyScanDesc": "Libera la tensión notando cada parte de tu cuerpo.",
           "boxBreathing": "Respiración en caja",
           "boxBreathingDesc": "Una técnica sencilla de respiración de 4 segundos para calmar tu sistema nervioso.",
           "breatheHold": "Mantén...",
           "breatheIn": "Inhala...",
           "breatheOut": "Exhala...",
           "done": "Listo. ¿Cómo te sientes ahora?",
           "journaling": "Consigna de diario",
           "journalingDesc": "Escribe lo que tienes en mente, una frase a la vez.",
           "next": "Siguiente",
           "pause": "Pausa",
           "repeat": "Repetir",
           "resume": "Continuar",
           "skip": "Omitir",
           "soundscape": "Paisaje sonoro",
           "soundscapeDesc": "Sonido ambiental suave para ayudarte a calmarte.",
           "start": "Empezar ejercicio",
           "step": "Paso {n} de {total}"
       },
       "prompts": {
           "anxious": "Me siento ansioso pero no sé por qué",
           "howWeek": "¿Cómo ha sido tu semana?",
           "justListen": "Solo necesito que alguien me escuche",
           "lonely": "Me he sentido solo últimamente",
           "struggling": "Me cuesta dormir",
           "tired": "Estoy muy cansado todo el tiempo"
       },
       "session": {
           "end": "Terminar sesión",
           "ending": "Concluyendo...",
           "minuteWarning": "Nos quedan unos {mins} minutos — ¿hay algo que quieras tratar?",
           "start": "Empezar sesión"
       },
       "privacyPage": {
           "title": "Privacidad",
           "lead": "Esta página describe cómo la aplicación Glow maneja la información. Se ofrece por transparencia y no es asesoría legal.",
           "whatTitle": "Qué es Glow",
           "whatBody": "Glow es una herramienta de apoyo con IA para la reflexión y la conversación. No es un terapeuta humano, ni atención de emergencia, ni un servicio médico o de diagnóstico.",
           "accountTitle": "Datos de cuenta y de sesión",
           "accountItem1": "La información de cuenta que proporcionas (como correo/nombre visible) se usa para iniciar sesión y gestionar tu cuenta.",
           "accountItem2": "La autenticación usa tokens emitidos por el servidor. La app también puede usar una cookie HttpOnly para mantener la sesión cuando es compatible.",
           "accountItem3": "El manejo de los datos de conversación/sesión depende de tus opciones de consentimiento y de la configuración del despliegue. El almacenamiento de mensajes está diseñado para respetar el consentimiento y cifrarse en reposo cuando la conservación de transcripciones está activada.",
           "journalTitle": "Entradas de diario y estado de ánimo",
           "journalBody": "Si usas el diario o el registro de estado de ánimo, esas entradas se guardan en tu cuenta para que puedas verlas más tarde. El contenido del diario está diseñado para cifrarse en reposo en el servidor. Escribe solo lo que te resulte cómodo guardar.",
           "aiTitle": "Procesamiento con IA",
           "aiBody": "Cuando se configura un proveedor externo de IA, el texto que envías puede enviarse a ese proveedor para generar respuestas. Los responsables del despliegue deben elegir proveedores, revisar sus términos y configurar el procesamiento de datos adecuadamente. Con el motor local de desarrollo, las respuestas las genera un motor de reglas en el proceso de la app.",
           "securityTitle": "Seguridad",
           "securityItem1": "Usa HTTPS en producción y configura cookies seguras y CORS para tus dominios desplegados.",
           "securityItem2": "Los secretos (claves de autenticación, claves principales, tokens de proveedores) deben guardarse en variables de entorno o un gestor de secretos, nunca en el código.",
           "securityItem3": "Ningún sistema puede garantizar seguridad absoluta. Comunica cualquier problema sospechoso al responsable del despliegue.",
           "choicesTitle": "Tus opciones",
           "choicesBody": "Según las funciones desplegadas, podrás gestionar el consentimiento, revisar entradas guardadas y solicitar acciones sobre tu cuenta/datos. La disponibilidad depende del despliegue concreto y de las leyes aplicables.",
           "updated": "Última actualización: 2026-11-09 (documentación del prototipo). Los despliegues de producción deben incluir datos de contacto del operador y avisos específicos de la jurisdicción."
       },
       "safetyPage": {
           "title": "Seguridad y términos",
           "lead": "Lee esto antes de usar Glow. Estos términos se ofrecen por transparencia y no son asesoría legal.",
           "limitsTitle": "Limitaciones importantes",
           "limitHumanShort": "No es humano.",
           "limitHumanBody": "Glow es una herramienta de apoyo con IA, no una persona.",
           "limitMedicalShort": "No es atención médica.",
           "limitMedicalBody": "Glow no proporciona consejos médicos, diagnóstico, tratamiento ni recetas.",
           "limitEmergencyShort": "No es atención de emergencia.",
           "limitEmergencyBody": "Glow no está diseñado para emergencias ni intervenciones de crisis como sustituto de la ayuda profesional.",
           "limitImperfectShort": "Puede ser imperfecto.",
           "limitImperfectBody": "Las respuestas de la IA pueden ser incompletas, inexactas o inadecuadas. Usa tu criterio y busca ayuda profesional cuando la necesites.",
           "crisisTitle": "Si necesitas ayuda urgente",
           "crisisBody": "Si estás en peligro inmediato, sientes que no puedes mantenerte seguro o necesitas ayuda médica o de salud mental urgente, contacta ahora mismo con tu número de emergencia local o con una persona de confianza.",
           "crisisItem1": "Usa el número de emergencia de tu país o región.",
           "crisisItem2": "Si es posible, contacta con una línea de crisis local o un servicio de salud mental de tu zona.",
           "crisisItem3": "Contacta a alguien de confianza y pídele que se quede contigo mientras recibes ayuda.",
           "crisisNote": "Los recursos de crisis varían según el lugar y deben ser verificados por revisores locales calificados antes de presentarse como recomendaciones oficiales. Este prototipo no afirma tener un directorio mundial de crisis completo y verificado.",
           "responsibleTitle": "Usar Glow con responsabilidad",
           "responsibleItem1": "Usa Glow para apoyo, reflexión y planificar pequeños próximos pasos, no como reemplazo de la atención profesional.",
           "responsibleItem2": "No dependas de Glow para decisiones sobre medicación, diagnóstico o situaciones de riesgo urgente.",
           "responsibleItem3": "Protege tus credenciales de cuenta y usa Glow en dispositivos en los que confíes.",
           "termsTitle": "Términos (prototipo)",
           "termsBody": "Al usar este despliegue, aceptas usarlo legalmente y entiendes sus limitaciones. Los operadores pueden actualizar las funciones, la disponibilidad y las políticas. Los despliegues de producción deben incluir términos completos, avisos de privacidad, identidad del operador e información de contacto apropiados para su jurisdicción.",
           "updated": "Última actualización: 2026-11-09 (documentación del prototipo)."
       },
       "learnPage": {
           "label": "Aprender",
           "title": "Cuerpo y mente, juntos",
           "lead": "La salud física y mental se influyen mutuamente. Estas páginas externas explican la conexión en detalle — leerlas es opcional, y ninguna reemplaza la atención de un profesional que te conozca.",
           "footer": "Los enlaces externos se abren en una pestaña nueva. Glow no reproduce estos artículos; los resúmenes aquí son originales. Si estás en crisis, usa los enlaces de apoyo de crisis del pie de página — la ayuda es gratuita sin importar la cuenta.",
           "blurb1": "Cómo la salud mental afecta a la salud física y viceversa — con ideas prácticas de autocuidado sobre ejercicio, buena alimentación y hablar con tu médico de cabecera.",
           "blurb2": "Por qué los cambios en una esfera suelen reflejarse en la otra, desde el estrés y el sueño hasta el ejercicio, la nutrición y la atención plena — explicado en términos sencillos.",
           "blurb3": "Un panorama de lo que la investigación muestra sobre cómo el cuerpo y la mente se influyen mutuamente, incluidas las vías biológicas implicadas.",
           "blurb4": "Material de lecciones de la Global Psychology Alliance de la Asociación Estadounidense de Psicología sobre la integración de la salud física y mental."
       },
       "yoga": {
           "seatedOptionLabel": "Opción sentada o quieta:"
       },
       "studio": {
           "guidedReflection": "Reflexión guiada",
           "freeFlow": "Cuaderno libre",
           "encrypted": "Cifrado AES-GCM",
           "chooseTheme": "Elige un tema de reflexión",
           "shuffle": "Mezclar consigna",
           "todaysPrompt": "Consigna amable de hoy",
           "useInJournal": "Usar en el diario",
           "type": "Escribir",
           "pen": "Lápiz",
           "typeHint": "Escribe con tu teclado",
           "penHint": "Escribe con ratón, dedo o lápiz óptico",
           "chooseInk": "Elige el color de tinta",
           "decorateHint": "Decora con pegatinas",
           "stickers": "Pegatinas",
           "uploadHint": "Sube una foto como pegatina desde tu dispositivo",
           "photo": "Foto",
           "stampHint": "Toca para estampar:",
           "stampOnPage": "Estampar en la página",
           "uploadFromDevice": "Subir desde el dispositivo",
           "clearStickers": "Quitar pegatinas",
           "penWidth": "Grosor del trazo",
           "eraser": "Borrador",
           "undo": "Deshacer",
           "clearPen": "Borrar trazo",
           "penHowto": "Dibuja con ratón, dedo o lápiz óptico. Cambia a Escribir cuando quieras — se guarda todo junto.",
           "titlePh": "Título de esta página (opcional)...",
           "bodyPh": "Escribe lo que haya en tu corazón... Esta página es enteramente tuya, sin juicios y privada.",
           "dragHint": "Arrastra para mover. Selecciona para cambiar tamaño, girar o recortar.",
           "words": "{n} palabras",
           "saved": "Guardado a salvo en tu diario",
           "clearPage": "Vaciar página",
           "save": "Guardar en el diario",
           "previous": "Recuerdos anteriores",
           "entries": "{n} entradas",
           "loading": "Cargando...",
           "untitled": "Reflexión sin título",
           "penPage": "· página de lápiz",
           "penText": "· lápiz + texto",
           "stickersCount": "· {n} pegatinas",
           "exportHint": "Exportar entrada a archivo de texto",
           "handwrittenAlt": "Página de diario manuscrita",
           "handwrittenPage": "[Página manuscrita]",
           "decoratedPage": "[Página decorada]",
           "waitingTitle": "Tu diario espera su primera página",
           "waitingBody": "Escribe, dibuja con el ratón, elige un tema de papel o añade una pegatina con foto de tu dispositivo.",
           "cropTitle": "Recortar pegatina con foto",
           "cancel": "Cancelar",
           "applyCrop": "Aplicar recorte",
           "selectedPhoto": "Foto seleccionada",
           "size": "Tamaño",
           "rotate": "Girar",
           "crop": "Recortar",
           "remove": "Quitar",
           "done": "Listo",
           "cropPreviewAlt": "Vista previa del recorte",
           "cropHint": "Ajusta los bordes con los deslizadores, abajo.",
           "top": "Arriba",
           "right": "Derecha",
           "bottom": "Abajo",
           "left": "Izquierda",
           "resetCrop": "Restablecer recorte",
           "selectedEmojiPrefix": "Seleccionada"
       },
       "moodTracker": {
           "heading": "¿Cómo ha sido hoy?",
           "intro": "Puedes registrarte tantas veces como necesites hoy. Los sentimientos pueden cambiar, superponerse y contradecirse.",
           "overall": "En general, este momento se siente",
           "extra": "¿Qué más está presente? Elige lo que encaje",
           "selected": "{n}/8 seleccionados",
           "noteLabel": "¿Algo que quieras recordar de este momento?",
           "notePh": "Opcional — unas pocas palabras bastan.",
           "savedMsg": "Registro guardado. Gracias por notarte a ti mismo/a.",
           "todayMany": "{n} registros hoy — más siempre son bienvenidos.",
           "todayNone": "Aún sin registros hoy.",
           "add": "Añadir este registro",
           "weather": "El clima emocional de hoy",
           "moments": "{n} momentos",
           "daysHint": "Cada punto es un registro. Los días pueden albergar varios sentimientos.",
           "noCheckin": "Sin registros",
           "multiLegend": "· los números sobre un día muestran múltiples registros",
           "low": "bajo",
           "okay": "más o menos",
           "good": "bien",
           "trends": "Lo que importa son las tendencias en el tiempo — un solo día, o un solo sentimiento, nunca cuenta toda la historia.",
           "palette": "La paleta emocional de esta semana",
           "last7": "Últimos 7 días",
           "paletteBody": "Una paleta más amplia no es un problema que arreglar. Es información sobre lo que has estado cargando.",
           "groupHeavy": "Pesado",
           "groupActivated": "Activado",
           "groupCalm": "Calma",
           "groupLow": "Baja energía",
           "hintHeavy": "Tristeza, duelo, soledad",
           "hintActivated": "Ansiedad, ira, presión",
           "hintCalm": "Paz, esperanza, conexión",
           "hintLow": "Cansancio, niebla mental, quietud"
       }
},
  fr: {
       "nav": {
           "talk": "Parler",
           "presence": "Présence",
           "practices": "Pratiques",
           "reflections": "Réflexions",
           "chat": "Discussion",
           "voice": "Voix",
           "avatar": "Avatar",
           "wellness": "Bien-être",
           "billing": "Facturation",
           "signIn": "Connexion",
           "signOut": "Déconnexion",
           "profile": "Votre profil"
       },
       "safety": {
           "note": "Glow est un outil de soutien par IA, non un thérapeute humain ou un service d'urgence.",
           "professional": "Parler à un professionnel qualifié",
           "crisis": "Si vous êtes en crise maintenant, contactez votre numéro d'urgence local — l'aide est gratuite quel que soit le compte."
       },
       "chat": {
           "title": "Parlons-en",
           "placeholder": "Écrivez ce qui vous préoccupe…",
           "listening": "Glow vous écoute…",
           "typingYou": "vous écrivez…",
           "error": "Glow n'a pas pu joindre son service de soutien. Si c'est urgent, contactez vos services d'urgence locaux ou une ligne de crise.",
           "checkin1": "Je suis toujours là — prenez votre temps. Y a-t-il quelque chose que vous aimeriez explorer ?",
           "checkin2": "Aucune urgence. Je suis là quand vous souhaitez continuer.",
           "checkin3": "Je demande doucement — comment vous sentez-vous maintenant ?",
           "welcome": "Bonjour, je suis Glow. Un compagnon IA ici pour écouter — ni humain ni thérapeute. Qu'est-ce qui vous préoccupe ces derniers temps ?"
       },
       "voice": {
           "title": "Présence vocale",
           "subtitle": "Parlez naturellement. Sous-titres toujours affichés.",
           "start": "Commencer une conversation vocale",
           "recording": "Je vous écoute — touchez pour terminer",
           "thinking": "Réflexion…",
           "speaking": "Je parle — touchez le micro pour répondre",
           "connecting": "Connexion…",
           "disclaimer": "L'audio est transcrit en temps réel et non stocké sans votre consentement. Glow est un compagnon IA — pas les urgences.",
           "error": "Micro ou connexion indisponible. Vérifiez les permissions du navigateur."
       },
       "avatar": {
           "title": "Rencontrez votre compagnon",
           "subtitle": "Une présence visuelle pour les conversations vocales.",
           "loading": "Chargement du compagnon…",
           "disclaimer": "L'avatar est purement visuel. Audio transcrit en direct, non stocké sans consentement."
       },
       "home": {
           "hero1": "Un endroit plus doux",
           "hero2": "pour démêler vos pensées.",
           "heroSub": "Glow est un compagnon IA de soutien psychologique — pas un remplacement aux soins professionnels, mais un premier pas chaleureux quand commencer est le plus dur.",
           "cta": {
               "start": "Commencer en douceur — c'est gratuit",
               "login": "J'ai déjà un compte"
           },
           "privacyLine": "Privé par conception · chiffré · soutien en crise jamais payant",
           "safetyTitle": "La sécurité, honnêtement",
           "safetyBody": "Glow est une IA, jamais un thérapeute agréé. Il ne diagnostique pas, ne juge pas, et vous orientera vers de l'aide humaine réelle quand tout devient trop lourd — y compris des lignes de crise gratuites, quoi qu'il arrive.",
           "f": {
               "chat": {
                   "title": "Évacuer ses émotions",
                   "desc": "Un compagnon qui écoute — par texte ou voix, quand vous en avez besoin."
               },
               "avatar": {
                   "title": "Un visage amical",
                   "desc": "Présence optionnelle avec voix temps réel et synchronisation labiale."
               },
               "journal": {
                   "title": "Journal privé",
                   "desc": "L'écriture expressive apaise les pensées anxieuses. Vos entrées sont chiffrées, toujours."
               },
               "mood": {
                   "title": "Analyses d'humeur",
                   "desc": "Un suivi quotidien prend des secondes. Des graphiques doux révèlent vos tendances."
               },
               "calm": {
                   "title": "Le calme en minutes",
                   "desc": "Respiration guidée et exercices d'ancrage — de petits outils pour les moments difficiles."
               },
               "games": {
                   "title": "Guérir en jouant",
                   "desc": "Des jeux légers axés sur la concentration et la pleine conscience."
               },
               "breathing": {
                   "again": "Respirez à nouveau",
                   "complete": "Séance terminée",
                   "desc": "Suivez le cercle — inspirez, retenez, expirez. Un exercice de rythme simple.",
                   "done": "Bravo !",
                   "exhale": "Expirez lentement…",
                   "hint": "4 secondes d'inspiration, 4 secondes de rétention, 6 secondes d'expiration — répétez 4 fois.",
                   "hold": "Retenez…",
                   "inhale": "Inspirez…",
                   "skip": "Passer",
                   "title": "Rythme de respiration"
               },
               "focustap": {
                   "desc": "Touchez en rythme avec l'impulsion. Entraîne l'attention et le sens du rythme.",
                   "done": "Séance terminée",
                   "hint": "Touchez exactement lorsque le cercle devient vert. 10 battements par manche.",
                   "miss": "Rythme manqué",
                   "playAgain": "Rejouer",
                   "score": "Score",
                   "start": "Commencer à toucher",
                   "stop": "Arrêter",
                   "tap": "Touchez maintenant !",
                   "title": "Toucher de concentration",
                   "wait": "Attendez le rythme…"
               },
               "gratitudes": {
                   "desc": "Plantez une graine pour chaque chose dont vous êtes reconnaissant.",
                   "empty": "Votre jardin est vide. Plantez votre première graine !",
                   "placeholder": "p. ex. le soleil chaud de ce matin",
                   "plant": "Planter",
                   "plants": "graines plantées",
                   "prompt": "De quoi êtes-vous reconnaissant en ce moment ?",
                   "remove": "Retirer",
                   "title": "Jardin de gratitude",
                   "water": "Prenez soin de votre jardin — les petits moments grandissent."
               },
               "moodmatch": {
                   "desc": "Retournez les cartes et associez les émotions. Un jeu de mémoire en douceur.",
                   "matched": "Paire trouvée",
                   "playAgain": "Rejouer",
                   "start": "Démarrer le jeu",
                   "title": "Jeu des émotions",
                   "turns": "Tours",
                   "win": "Tout est associé !"
               }
           }
       },
       "auth": {
           "register": {
               "title": "Créez votre espace",
               "subtitle": "Un compte privé garde votre parcours rien qu'à vous."
           },
           "nameLabel": "Comment Glow doit-il vous appeler ?",
           "nameOptional": "(facultatif)",
           "namePlaceholder": "Un nom que vous aimez",
           "email": "E-mail",
           "password": "Mot de passe",
           "passwordHint": "(au moins 10 caractères)",
           "adult": "Je confirme avoir 18 ans ou plus. Glow est actuellement réservé aux adultes.",
           "createAccount": "Créer un compte",
           "haveAccount": "Vous avez déjà un compte ?",
           "noAccount": "Nouveau sur Glow ?",
           "signIn": "Se connecter",
           "loginTitle": "Bon retour",
           "loginSubtitle": "Votre espace est exactement comme vous l'avez laissé.",
           "diagnosis": {
               "question": "Un professionnel vous a-t-il diagnostiqué une trouble de santé mentale ? Si vous êtes à l'aise de le partager, Glow peut être mieux informé — mais c'est totalement facultatif.",
               "share": "Je souhaite partager (je peux modifier ou supprimer à tout moment)",
               "placeholder": "Partagez seulement ce qui vous semble juste — ex. « anxiété généralisée, diagnostiquée en 2022 ». Laissez vide si vous préférez.",
               "note": "Stocké chiffré, visible uniquement par vous, jamais utilisé pour diagnostiquer, et supprimable en un geste. Glow est une IA — il ne remplace pas votre clinicien."
           },
           "ageLabel": "Âge",
           "ageHint": "Glow est réservé aux adultes (18+).",
           "genderLabel": "Comment décririez-vous votre genre ?",
           "genderHint": "Contexte personnel uniquement — choisissez ce qui vous convient, ou préférez ne pas le dire.",
           "genderPlaceholder": "Choisir…",
           "genderFemale": "Femme",
           "genderMale": "Homme",
           "genderNonBinary": "Non binaire",
           "genderPreferNotToSay": "Je préfère ne pas le dire",
           "medicationLabel": "Médicaments actuels",
           "medicationOptional": "(optionnel)",
           "medicationPlaceholder": "p. ex. aucun, ou noms/dosages uniquement si vous êtes à l'aise",
           "medicationHint": "Stocké chiffré, visible uniquement par vous, retirable à tout moment.",
           "resetTitle": "Réinitialiser votre mot de passe",
           "resetLead": "Saisissez l'e-mail de votre compte et nous vous enverrons un lien de réinitialisation sécurisé.",
           "resetRequest": "Envoyer le lien",
           "resetSent": "Si un compte existe pour cet e-mail, un lien de réinitialisation est en route. Vérifiez votre boîte de réception (et vos spams).",
           "resetSetTitle": "Choisissez un nouveau mot de passe",
           "resetSet": "Définir le nouveau mot de passe",
           "resetInvalid": "Ce lien est invalide ou expiré. Demandez-en un nouveau depuis la page de connexion.",
           "resetDone": "Votre mot de passe a été mis à jour. Vous pouvez vous connecter.",
           "verifyTitle": "Confirmez votre e-mail",
           "verifyWorking": "Confirmation en cours...",
           "verifyOk": "Votre e-mail est confirmé. Merci !",
           "verifyErr": "Ce lien de vérification est invalide ou expiré.",
           "forgotPassword": "Mot de passe oublié ?"
       },
       "profile": {
           "title": "Votre profil",
           "privateSettings": "Vos paramètres privés",
           "account": "Compte",
           "memberSince": "Membre depuis",
           "freeSessions": "Sessions gratuites restantes",
           "diagnosisTitle": "Divulgation du diagnostic",
           "diagnosisDesc": "Facultatif. Le partager aide Glow à être mieux informé — mais cela ne change jamais le soutien reçu.",
           "notShared": "Non partagé",
           "sharingNoDetails": "Partagé (sans détails)",
           "edit": "Modifier",
           "shareSomething": "Partager quelque chose",
           "removeWipe": "Supprimer et effacer la note",
           "save": "Enregistrer",
           "cancel": "Annuler",
           "diagnosisFooter": "Chiffré au repos · visible uniquement par vous · jamais utilisé pour diagnostiquer · la suppression efface définitivement la note.",
           "medicationTitle": "Déclaration des médicaments",
           "medicationDesc": "Optionnel. Partager vos médicaments actuels peut aider Glow à être plus informé — mais c'est entièrement votre choix, et jamais utilisé pour diagnostiquer.",
           "medicationHint": "Chiffré au repos · visible uniquement par vous · jamais utilisé pour diagnostiquer ou prescrire · le retrait efface tout."
       },
       "wellness": {
           "title": "Outils de bien-être",
           "subtitle": "Petites pratiques, preuves réelles. Tout est privé.",
           "tab": {
               "journal": "Journal",
               "mood": "Humeur",
               "game": "Jeu de concentration"
           },
           "journal": {
               "titlePh": "Donnez un titre à l'entrée du jour (facultatif)",
               "writePh": "Écrivez librement — personne ne note ça.",
               "save": "Enregistrer l'entrée",
               "first": "Votre journal attend sa première page.",
               "entryTitle": "Entrée sans titre"
           },
           "mood": {
               "howToday": "Comment était votre journée ?",
               "logged": "Enregistré pour aujourd'hui. Revenez demain — la régularité compte plus que la note.",
               "last14": "Les 14 derniers jours",
               "empty": "Aucun enregistrement pour le moment.",
               "footer": "Ce sont les tendances dans le temps qui comptent — une seule journée ne raconte jamais toute l'histoire."
           },
           "game": {
               "inhale": "Inspirez…",
               "exhale": "Expirez lentement…",
               "breaths": "respirations · record",
               "begin": "Commencer",
               "finish": "Terminer",
               "footer": "La respiration rythmée (~5,5 resp./min) est associée à une baisse de l'activation physiologique. Pas un traitement médical."
           }
       },
       "billing": {
           "title": "Un soutien qui reste abordable",
           "subtitle": "L'essentiel est gratuit pour toujours. L'aide en crise n'est jamais derrière un paywall.",
           "free": {
               "name": "Gratuit",
               "period": "pour toujours"
           },
           "plus": {
               "name": "Glow Plus",
               "tag": "Le plus apprécié"
           },
           "payPerSession": "Paiement à la séance",
           "perMonth": "/mois",
           "currentPlan": "Votre plan actuel",
           "waitlist": "Rejoindre la liste d'attente",
           "joined": "Vous êtes sur la liste 💜",
           "footer": "Les paiements seront traités par un fournisseur agréé. Aucune donnée de carte n'est stockée sur nos serveurs.",
           "perSession": "/ séance",
           "buy": "Acheter une séance",
           "egp": "EGP"
       },
       "practices": {
           "title": "Pratiques",
           "subtitle": "Explorez la pleine conscience et les exercices d'ancrage."
       },
       "reflections": {
           "title": "Votre semaine, doucement remarquée",
           "subtitle": "Une réflexion douce sur votre parcours émotionnel."
       },
       "language": {
           "label": "Langue"
       },
       "navLang": {
           "en": "English",
           "es": "Español",
           "fr": "Français",
           "ar": "العربية"
       },
       "crisis": {
           "aiNote": "Glow est un soutien par IA — pas un substitut aux soins professionnels.",
           "emergency": "Urgence",
           "line": "Ligne de crise",
           "professional": "Trouver un thérapeute"
       },
       "history": {
           "copy": "Copier",
           "date": "Séance du {date}",
           "doctorPrepSubtitle": "Un résumé de ce que vous avez partagé, prêt à montrer lors de votre rendez-vous.",
           "doctorPrepTitle": "Ce qu'il faut dire à votre médecin",
           "download": "Télécharger",
           "empty": "Aucune séance pour le moment. Commencez votre première conversation pour la voir ici.",
           "export": "Exporter pour le médecin",
           "noSessions": "Terminez d'abord une séance pour générer un résumé pour votre médecin.",
           "searchPlaceholder": "Rechercher des séances...",
           "summary": "Résumé",
           "title": "Votre historique de séances",
           "view": "Voir"
       },
       "mood": {
           "good": "Bien",
           "great": "Très bien",
           "low": "Bas",
           "okay": "Moyen",
           "subtitle": "Choisissez ce qui s'en rapproche le plus — même si ce n'est pas exact.",
           "title": "Comment vous sentez-vous en ce moment ?",
           "veryLow": "Très bas"
       },
       "practice": {
           "bodyScan": "Scan corporel",
           "bodyScanDesc": "Relâchez la tension en remarquant chaque partie de votre corps.",
           "boxBreathing": "Respiration en boîte",
           "boxBreathingDesc": "Une technique de respiration simple de 4 secondes pour apaiser votre système nerveux.",
           "breatheHold": "Retenez...",
           "breatheIn": "Inspirez...",
           "breatheOut": "Expirez...",
           "done": "Terminé. Comment vous sentez-vous maintenant ?",
           "journaling": "Consigne d'écriture",
           "journalingDesc": "Écrivez ce qui vous vient à l'esprit, une phrase à la fois.",
           "next": "Suivant",
           "pause": "Pause",
           "repeat": "Répéter",
           "resume": "Reprendre",
           "skip": "Passer",
           "soundscape": "Ambiance sonore",
           "soundscapeDesc": "Son d'ambiance doux pour vous apaiser.",
           "start": "Démarrer l'exercice",
           "step": "Étape {n} sur {total}"
       },
       "prompts": {
           "anxious": "Je me sens anxieux mais je ne sais pas pourquoi",
           "howWeek": "Comment s'est passée votre semaine ?",
           "justListen": "J'ai juste besoin que quelqu'un m'écoute",
           "lonely": "Je me sens seul ces derniers temps",
           "struggling": "J'ai du mal à dormir",
           "tired": "Je suis vraiment fatigué tout le temps"
       },
       "session": {
           "end": "Terminer la séance",
           "ending": "Conclusion...",
           "minuteWarning": "Il nous reste environ {mins} minutes — y a-t-il quelque chose que vous voulez aborder ?",
           "start": "Démarrer la séance"
       },
       "privacyPage": {
           "title": "Confidentialité",
           "lead": "Cette page décrit la façon dont Glow traite vos informations. Elle est fournie par transparence et ne constitue pas un avis juridique.",
           "whatTitle": "Ce qu'est Glow",
           "whatBody": "Glow est un outil de soutien par IA pour la réflexion et la conversation. Ce n'est pas un thérapeute humain, ni une urgence, ni un service médical ou de diagnostic.",
           "accountTitle": "Données de compte et de session",
           "accountItem1": "Les informations que vous fournissez (e-mail/nom d'affichage) servent à vous connecter et à gérer votre compte.",
           "accountItem2": "L'authentification utilise des tokens émis par le serveur. L'application peut aussi utiliser un cookie HttpOnly pour maintenir la session lorsque cela est pris en charge.",
           "accountItem3": "La gestion des conversations et de vos sessions dépend de vos choix de consentement et de la configuration du déploiement. Le stockage des messages est conçu pour respecter votre consentement et être chiffré au repos lorsque la conservation des transcriptions est activée.",
           "journalTitle": "Entrées de journal et d'humeur",
           "journalBody": "Si vous utilisez le journal ou les suivis d'humeur, ces entrées sont conservées pour votre compte afin que vous puissiez les consulter plus tard. Le contenu du journal est conçu pour être chiffré au repos côté serveur. N'écrivez que ce que vous êtes à l'aise à conserver.",
           "aiTitle": "Traitement par IA",
           "aiBody": "Lorsqu'un fournisseur d'IA externe est configuré, le texte que vous saisissez peut être envoyé à ce fournisseur pour générer des réponses. Les opérateurs du déploiement doivent choisir les fournisseurs, examiner leurs conditions et configurer le traitement des données de manière appropriée. Avec le moteur local de développement, les réponses sont générées par un moteur de règles dans le processus de l'application.",
           "securityTitle": "Sécurité",
           "securityItem1": "Utilisez HTTPS en production et définissez des paramètres de cookies sécurisés et CORS pour vos domaines déployés.",
           "securityItem2": "Les secrets (clés d'authentification, clés principales, tokens fournisseurs) doivent être stockés dans des variables d'environnement ou un gestionnaire de secrets, jamais dans le contrôle de version.",
           "securityItem3": "Aucun système ne peut garantir une sécurité absolue. Signalez tout problème suspecté à l'opérateur du déploiement.",
           "choicesTitle": "Vos choix",
           "choicesBody": "Selon les fonctions déployées, vous pourrez gérer votre consentement, consulter les entrées enregistrées et demander des actions sur votre compte/vos données. La disponibilité dépend du déploiement spécifique et des lois applicables.",
           "updated": "Dernière mise à jour : 2026-11-09 (documentation du prototype). Les déploiements de production doivent fournir les coordonnées de l'opérateur et des notices spécifiques à la juridiction."
       },
       "safetyPage": {
           "title": "Sécurité et conditions",
           "lead": "Veuillez lire ceci avant d'utiliser Glow. Ces conditions sont fournies par transparence et ne constituent pas un avis juridique.",
           "limitsTitle": "Limitations importantes",
           "limitHumanShort": "Pas humain.",
           "limitHumanBody": "Glow est un outil de soutien par IA, pas une personne.",
           "limitMedicalShort": "Pas de soins médicaux.",
           "limitMedicalBody": "Glow ne fournit ni conseils médicaux, ni diagnostic, ni traitement, ni ordonnances.",
           "limitEmergencyShort": "Pas de soins d'urgence.",
           "limitEmergencyBody": "Glow n'est pas conçu pour les urgences ni l'intervention de crise en remplacement de l'aide professionnelle.",
           "limitImperfectShort": "Peut être imparfait.",
           "limitImperfectBody": "Les réponses de l'IA peuvent être incomplètes, inexactes ou inadaptées. Utilisez votre jugement et cherchez de l'aide qualifiée en cas de besoin.",
           "crisisTitle": "Si vous avez besoin d'aide en urgence",
           "crisisBody": "Si vous êtes en danger immédiat, si vous ne vous sentez pas en sécurité ou si vous avez besoin d'une aide médicale ou mentale urgente, contactez immédiatement votre numéro d'urgence local ou une personne de confiance.",
           "crisisItem1": "Utilisez le numéro d'urgence de votre pays ou région.",
           "crisisItem2": "Si possible, contactez une ligne de crise locale ou un service de santé mentale dans votre région.",
           "crisisItem3": "Contactez une personne de confiance et demandez-lui de rester avec vous pendant que vous obtenez de l'aide.",
           "crisisNote": "Les ressources de crise varient selon l'endroit et doivent être vérifiées par des réviseurs locaux qualifiés avant d'être présentées comme des recommandations officielles. Ce prototype ne prétend pas disposer d'un répertoire mondial de crise complet et vérifié.",
           "responsibleTitle": "Utiliser Glow de manière responsable",
           "responsibleItem1": "Utilisez Glow pour le soutien, la réflexion et la planification de petits pas — pas comme remplacement des soins professionnels.",
           "responsibleItem2": "Ne comptez pas sur Glow pour les décisions médicamenteuses, le diagnostic ou les situations de risque urgent.",
           "responsibleItem3": "Protégez vos identifiants de compte et utilisez Glow sur des appareils de confiance.",
           "termsTitle": "Conditions (prototype)",
           "termsBody": "En utilisant ce déploiement, vous acceptez de l'utiliser légalement et vous comprenez ses limites. Les opérateurs peuvent mettre à jour les fonctionnalités, la disponibilité et les politiques. Les déploiements de production doivent fournir des conditions complètes, des notices de confidentialité, l'identité de l'opérateur et des coordonnées appropriées à leur juridiction.",
           "updated": "Dernière mise à jour : 2026-11-09 (documentation du prototype)."
       },
       "learnPage": {
           "label": "Apprendre",
           "title": "Corps et esprit, ensemble",
           "lead": "La santé physique et mentale se façonnent mutuellement. Ces pages externes expliquent ce lien en profondeur — les lire est facultatif, et aucune ne remplace l'attention d'un professionnel qui vous connaît.",
           "footer": "Les liens externes s'ouvrent dans un nouvel onglet. Glow ne reproduit pas ces articles ; les résumés ici sont originaux. Si vous êtes en crise, utilisez les liens de soutien en bas de page — l'aide est gratuite quel que soit le compte.",
           "blurb1": "Comment la santé mentale affecte la santé physique et inversement — avec des idées pratiques d'auto-assistance sur l'exercice, l'alimentation et parler à votre médecin traitant.",
           "blurb2": "Pourquoi les changements dans un domaine reflètent souvent ceux de l'autre, du stress et du sommeil à l'exercice, la nutrition et la pleine conscience — expliqué simplement.",
           "blurb3": "Un aperçu de ce que montre la recherche sur la façon dont le corps et l'esprit s'influencent mutuellement, y compris les voies biologiques en jeu.",
           "blurb4": "Documents de cours de la Global Psychology Alliance de l'American Psychological Association sur l'intégration des soins physiques et mentaux."
       },
       "yoga": {
           "seatedOptionLabel": "Option assise ou immobile :"
       },
       "studio": {
           "guidedReflection": "Réflexion guidée",
           "freeFlow": "Carnet libre",
           "encrypted": "Chiffré AES-GCM",
           "chooseTheme": "Choisissez un thème de réflexion",
           "shuffle": "Mélanger la consigne",
           "todaysPrompt": "Consigne douce du jour",
           "useInJournal": "Utiliser dans le journal",
           "type": "Écrire",
           "pen": "Plume",
           "typeHint": "Écrivez avec votre clavier",
           "penHint": "Écrivez à la souris, au doigt ou au stylet",
           "chooseInk": "Choisir la couleur d'encre",
           "decorateHint": "Décorez avec des autocollants",
           "stickers": "Autocollants",
           "uploadHint": "Téléversez une photo comme autocollant depuis votre appareil",
           "photo": "Photo",
           "stampHint": "Touchez pour tamponner :",
           "stampOnPage": "Tamponner sur la page",
           "uploadFromDevice": "Téléverser depuis l'appareil",
           "clearStickers": "Retirer les autocollants",
           "penWidth": "Épaisseur du trait",
           "eraser": "Gomme",
           "undo": "Annuler",
           "clearPen": "Effacer le trait",
           "penHowto": "Dessinez à la souris, au doigt ou au stylet. Passez à Écrire quand vous voulez — tout est sauvegardé ensemble.",
           "titlePh": "Titre de cette page (optionnel)...",
           "bodyPh": "Écrivez ce qui est dans votre cœur... Cette page est entièrement à vous, sans jugement et privée.",
           "dragHint": "Faites glisser pour déplacer. Sélectionnez pour redimensionner, pivoter ou recadrer.",
           "words": "{n} mots",
           "saved": "Enregistré en sécurité dans votre journal",
           "clearPage": "Vider la page",
           "save": "Enregistrer dans le journal",
           "previous": "Souvenirs précédents",
           "entries": "{n} entrées",
           "loading": "Chargement...",
           "untitled": "Réflexion sans titre",
           "penPage": "· page à la plume",
           "penText": "· plume + texte",
           "stickersCount": "· {n} autocollants",
           "exportHint": "Exporter l'entrée en fichier texte",
           "handwrittenAlt": "Page de journal manuscrite",
           "handwrittenPage": "[Page manuscrite]",
           "decoratedPage": "[Page décorée]",
           "waitingTitle": "Votre journal attend sa première page",
           "waitingBody": "Écrivez, dessinez à la souris, choisissez un thème de papier ou ajoutez une photo depuis votre appareil.",
           "cropTitle": "Recadrer l'autocollant photo",
           "cancel": "Annuler",
           "applyCrop": "Appliquer le recadrage",
           "selectedPhoto": "Photo sélectionnée",
           "size": "Taille",
           "rotate": "Pivoter",
           "crop": "Recadrer",
           "remove": "Retirer",
           "done": "Terminé",
           "cropPreviewAlt": "Aperçu du recadrage",
           "cropHint": "Ajustez les bords avec les curseurs, ci-dessous.",
           "top": "Haut",
           "right": "Droite",
           "bottom": "Bas",
           "left": "Gauche",
           "resetCrop": "Réinitialiser le recadrage",
           "selectedEmojiPrefix": "Sélectionné"
       },
       "moodTracker": {
           "heading": "Comment s'est passée la journée ?",
           "intro": "Vous pouvez vous enregistrer autant de fois que nécessaire aujourd'hui. Les sentiments peuvent changer, se chevaucher et se contredire.",
           "overall": "Dans l'ensemble, ce moment ressemble à",
           "extra": "Qu'est-ce qui est aussi présent ? Choisissez ce qui correspond",
           "selected": "{n}/8 sélectionnés",
           "noteLabel": "Quelque chose à retenir de ce moment ?",
           "notePh": "Optionnel — quelques mots suffisent.",
           "savedMsg": "Enregistrement sauvegardé. Merci de vous être remarqué.",
           "todayMany": "{n} enregistrements aujourd'hui — plus sont toujours bienvenus.",
           "todayNone": "Aucun enregistrement aujourd'hui.",
           "add": "Ajouter cet enregistrement",
           "weather": "La météo émotionnelle du jour",
           "moments": "{n} moments",
           "daysHint": "Chaque point est un enregistrement. Les jours peuvent contenir plusieurs sentiments.",
           "noCheckin": "Aucun enregistrement",
           "multiLegend": "· les chiffres au-dessus d'un jour indiquent plusieurs enregistrements",
           "low": "bas",
           "okay": "moyen",
           "good": "bien",
           "trends": "Ce qui compte, ce sont les tendances sur le temps — un seul jour, ou un seul sentiment, ne raconte jamais toute l'histoire.",
           "palette": "La palette émotionnelle de cette semaine",
           "last7": "7 derniers jours",
           "paletteBody": "Une palette plus large n'est pas un problème à corriger. C'est une information sur ce que vous avez porté.",
           "groupHeavy": "Lourd",
           "groupActivated": "Activé",
           "groupCalm": "Calme",
           "groupLow": "Basse énergie",
           "hintHeavy": "Tristesse, deuil, solitude",
           "hintActivated": "Anxiété, colère, pression",
           "hintCalm": "Paix, espoir, lien",
           "hintLow": "Fatigue, brouillard mental, quiétude"
       }
},
  ar: {
       "nav": {
           "talk": "تحدث",
           "presence": "حضور",
           "practices": "تمارين",
           "reflections": "تأملات",
           "chat": "محادثة",
           "voice": "صوت",
           "avatar": "الشخصية",
           "wellness": "رفاهيتك",
           "billing": "الفواتير",
           "signIn": "تسجيل الدخول",
           "signOut": "خروج",
           "profile": "ملفك الشخصي"
       },
       "safety": {
           "note": "جلو أداة دعم بالذكاء الاصطناعي، وليست معالجًا بشريًا ولا خدمة طوارئ.",
           "professional": "تحدث مع مختص مؤهل",
           "crisis": "إذا كنت في حالة أزمة الآن، يرجى الاتصال برقم الطوارئ المحلي — المساعدة مجانية بغض النظر عن أي حساب."
       },
       "chat": {
           "title": "لنتحدث عن الأمر",
           "placeholder": "اكتب ما يدور في ذهنك…",
           "listening": "جلو يستمع إليك…",
           "typingYou": "أنت تكتب…",
           "error": "لم يتمكن جلو من الوصول إلى خدمة الدعم الآن. إذا كان الأمر عاجلًا، يرجى الاتصال بخدمات الطوارئ المحلية أو خط الأزمات.",
           "checkin1": "ما زلت معك — خذ وقتك. هل هناك شيء تود استكشافه؟",
           "checkin2": "لا داعي للعجلة إطلاقًا. أنا هنا متى شعرت بالاستمرار.",
           "checkin3": "أسألك بلطف فقط — كيف تشعر الآن؟",
           "welcome": "مرحبًا، أنا جلو. رفيق ذكي موجود للاستماع إليك — لست إنسانًا ولا معالجًا. بماذا تفكر هذه الفترة؟"
       },
       "voice": {
           "title": "حضور صوتي",
           "subtitle": "تحدث بشكل طبيعي. التسميات النصية دائمًا متاحة.",
           "start": "ابدأ محادثة صوتية",
           "recording": "أستمع إليك — اضغط للإنهاء",
           "thinking": "أفكر…",
           "speaking": "أتحدث — اضغط على الميكروفون للرد",
           "connecting": "جارٍ الاتصال…",
           "disclaimer": "يتم تحويل الصوت إلى نص في الوقت الفعلي ولا يُخزَّن إلا بموافقتك. جلو رفيق ذكي — ليس خدمة طوارئ.",
           "error": "الميكروفون أو الاتصال غير متاح. تحقق من أذونات المتصفح."
       },
       "avatar": {
           "title": "تعرّف على رفيقك",
           "subtitle": "حضور مرئي للمحادثات الصوتية.",
           "loading": "جارٍ تحميل الرفيق…",
           "disclaimer": "الشخصية للعرض فقط. يتم تحويل الصوت مباشرة، ولا يُخزَّن بدون موافقتك."
       },
       "home": {
           "hero1": "مكان أكثر ليونة",
           "hero2": "لفكّ العقد في أفكارك.",
           "heroSub": "جلو رفيق ذكي لدعم الصحة النفسية — ليس بديلاً عن الرعاية المهنية، بل خطوة أولى دافئة عندما تكون البداية أصعب شيء.",
           "cta": {
               "start": "ابدأ بلطف — إنه مجاني",
               "login": "لدي حساب بالفعل"
           },
           "privacyLine": "خصوصية بالتصميم · مشفر · دعم الأزمات مجاني دائمًا",
           "safetyTitle": "الأمان بصدق",
           "safetyBody": "جلو ذكاء اصطناعي، وليس معالجًا مرخصًا. لن يشخّص ولن يحكم عليك، وسيرشدك إلى مساعدة بشرية حقيقية كلما شعرت أن الأمور ثقيلة — بما في ذلك خطوط الأزمات المجانية مهما حدث.",
           "f": {
               "chat": {
                   "title": "تحديث عن مشاعرك",
                   "desc": "رفيق يستمع إليك — بالنص أو الصوت، متى احتجت. لا حكم على ما تشاركه."
               },
               "avatar": {
                   "title": "وجه ودود",
                   "desc": "شخصية اختيارية بصوت حي ومزامنة شفاه لمحادثة أكثر إنسانية."
               },
               "journal": {
                   "title": "مفكرة خاصة",
                   "desc": "الكتابة التعبيرية تساعد في تخفيف الأفكار القلقة. مدخلاتك مشفرة دائمًا."
               },
               "mood": {
                   "title": "رؤى المزاج",
                   "desc": "تسجيل يومي يستغرق ثوانٍ. رسوم بيانية لطيفة تكشف أنماطك عبر الأسابيع."
               },
               "calm": {
                   "title": "هدوء في دقائق",
                   "desc": "تمارين تنفس وتأريض موجّهة — أدوات صغيرة مستنيرة سريريًا لل لحظات الصعبة."
               },
               "games": {
                   "title": "الشفاء عبر اللعب",
                   "desc": "ألعاب خفيفة مصممة حول التركيز واليقاظ الذهني، لأن الراحة إنتاجية أيضًا."
               },
               "breathing": {
                   "again": "تنفس مرة أخرى",
                   "complete": "اكتملت الجلسة",
                   "desc": "تتبّع الدائرة — اشهق، توقف، ازفر. تمرين إيقاع بسيط.",
                   "done": "أحسنت!",
                   "exhale": "ازفر ببطء…",
                   "hint": "٤ ثوانٍ للشهيق، ٤ للثبات، ٦ للزفير — كرر ٤ مرات.",
                   "hold": "اثبت…",
                   "inhale": "اشهق…",
                   "skip": "تخطي",
                   "title": "منظم التنفس"
               },
               "focustap": {
                   "desc": "انقر على الإيقاع مع النبض. يدرّب الانتباه والتوقيت.",
                   "done": "اكتملت الجلسة",
                   "hint": "انقر تماماً عندما يتحول لون الدائرة إلى الأخضر. ١٠ نبضات في كل جولة.",
                   "miss": "فاتك الإيقاع",
                   "playAgain": "العب مجدداً",
                   "score": "النقاط",
                   "start": "ابدأ النقر",
                   "stop": "إيقاف",
                   "tap": "انقر الآن!",
                   "title": "نقرة التركيز",
                   "wait": "انتظر النبض…"
               },
               "gratitudes": {
                   "desc": "ازرع بذرة مقابل كل شيء تمتن له.",
                   "empty": "حديقتك فارغة. ازرع بذرتك الأولى!",
                   "placeholder": "مثلاً: شمس دافئة هذا الصباح",
                   "plant": "ازرع",
                   "plants": "بذور مزروعة",
                   "prompt": "ما الشيء الذي تمتن له في هذه اللحظة؟",
                   "remove": "إزالة",
                   "title": "حديقة الامتنان",
                   "water": "اعتنِ بحديقتك — اللحظات الصغيرة تنمو."
               },
               "moodmatch": {
                   "desc": "اقلب البطاقات وطابق المشاعر. لعبة ذاكرة لطيفة.",
                   "matched": "تم التطابق",
                   "playAgain": "العب مجدداً",
                   "start": "ابدأ اللعبة",
                   "title": "تطابق المشاعر",
                   "turns": "الجولات",
                   "win": "تم تطابق الكل!"
               }
           }
       },
       "auth": {
           "register": {
               "title": "أنشئ مساحتك",
               "subtitle": "حساب خاص يحافظ على رحلتك لك وحدك."
           },
           "nameLabel": "بماذا تريد أن يناديك جلو؟",
           "nameOptional": "(اختياري)",
           "namePlaceholder": "اسم تحبه",
           "email": "البريد الإلكتروني",
           "password": "كلمة المرور",
           "passwordHint": "(10 أحرف على الأقل)",
           "adult": "أؤكد أن عمري 18 عامًا أو أكثر. جلو حاليًا للبالغين فقط.",
           "createAccount": "إنشاء حساب",
           "haveAccount": "لدي حساب بالفعل؟",
           "noAccount": "جديد على جلو؟",
           "signIn": "تسجيل الدخول",
           "loginTitle": "مرحبًا بعودتك",
           "loginSubtitle": "مساحتك كما تركتها تمامًا.",
           "diagnosis": {
               "question": "هل شخّصك مختص بحالة صحة نفسية؟ إذا كنت مرتاحًا لمشاركتها، يمكن لجلو أن يكون أكثر إدراكًا في المحادثات — لكن هذا اختياري تمامًا.",
               "share": "أود المشاركة (يمكنني التغيير أو الحذف في أي وقت)",
               "placeholder": "شارك فقط ما ترتاح له — مثلاً «قلق معمم، تم التشخيص 2022». اتركه فارغًا إن فضلت ذلك.",
               "note": "يُخزَّن مشفرًا، ولا يراه سواك، ولا يُستخدم للتشخيص، وقابل للحذف بلمسة واحدة. جلو ذكاء اصطناعي — لا يحل محل طبيبك."
           },
           "ageLabel": "العمر",
           "ageHint": "جلو مخصص للبالغين فقط (١٨+).",
           "genderLabel": "كيف تصف جنسك؟",
           "genderHint": "سياق شخصي فقط — اختر ما يناسبك أو فضّل عدم القول.",
           "genderPlaceholder": "اختر…",
           "genderFemale": "أنثى",
           "genderMale": "ذكر",
           "genderNonBinary": "غير ثنائي",
           "genderPreferNotToSay": "أفضل عدم القول",
           "medicationLabel": "الأدوية الحالية",
           "medicationOptional": "(اختياري)",
           "medicationPlaceholder": "مثلاً: لا شيء، أو الأسماء/الجرعات فقط إذا كنت مرتاحاً",
           "medicationHint": "يُخزَّن مشفراً، ويظهر لك فقط، ويمكن إزالته في أي وقت.",
           "resetTitle": "إعادة تعيين كلمة المرور",
           "resetLead": "أدخل بريد حسابك وسنرسل لك رابط إعادة تعيين آمناً.",
           "resetRequest": "إرسال الرابط",
           "resetSent": "إذا كان هناك حساب لهذا البريد، فسيصلك رابط إعادة التعيين قريباً. تحقق من بريدك الوارد (ومجلد الرسائل غير المرغوبة).",
           "resetSetTitle": "اختر كلمة مرور جديدة",
           "resetSet": "تعيين كلمة المرور الجديدة",
           "resetInvalid": "هذا الرابط غير صالح أو منتهي. اطلب رابطاً جديداً من صفحة تسجيل الدخول.",
           "resetDone": "تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.",
           "verifyTitle": "تأكيد البريد الإلكتروني",
           "verifyWorking": "جارٍ التأكيد...",
           "verifyOk": "تم تأكيد بريدك الإلكتروني. شكراً لك!",
           "verifyErr": "رابط التحقق هذا غير صالح أو منتهي.",
           "forgotPassword": "نسيت كلمة المرور؟"
       },
       "profile": {
           "title": "ملفك الشخصي",
           "privateSettings": "إعداداتك الخاصة",
           "account": "الحساب",
           "memberSince": "عضو منذ",
           "freeSessions": "الجلسات المجانية المتبقية",
           "diagnosisTitle": "الإفصاح عن التشخيص",
           "diagnosisDesc": "اختياري. إذا شخّصك مختص بحالة، فإن مشاركتها تساعد جلو على فهم أفضل — لكنها لا تغير أبدًا مقدار الدعم الذي تحصل عليه.",
           "notShared": "غير مشارك",
           "sharingNoDetails": "مشاركة (بدون تفاصيل)",
           "edit": "تعديل",
           "shareSomething": "شارك شيئًا",
           "removeWipe": "حذف ومحو الملاحظة",
           "save": "حفظ",
           "cancel": "إلغاء",
           "diagnosisFooter": "مشفر · لا يراه سواك · لا يُستخدم للتشخيص · الحذف يمحو الملاحظة المخزنة نهائيًا.",
           "medicationTitle": "الإفصاح عن الأدوية",
           "medicationDesc": "اختياري. مشاركة أدويتك الحالية يمكن أن تساعد جلو على أن يكون أكثر اطلاعاً — لكنه خيارك بالكامل، ولا يُستخدم أبداً للتشخيص.",
           "medicationHint": "مشفر في الراحة · يظهر لك فقط · لا يُستخدم أبداً للتشخيص أو الوصف · الإزالة تمسح كل شيء."
       },
       "wellness": {
           "title": "أدوات الرفاهية",
           "subtitle": "ممارسات صغيرة بأدلة حقيقية. كلها خاصة بك.",
           "tab": {
               "journal": "المفكرة",
               "mood": "مخطط المزاج",
               "game": "لعبة التركيز"
           },
           "journal": {
               "titlePh": "أعطِ مدخلة اليوم عنوانًا (اختياري)",
               "writePh": "اكتب بحرية — لا أحد يقيّمك. الكتابة التعبيرية تساعد في تصريف الأفكار القلقة.",
               "save": "حفظ المدخلة",
               "first": "مفكرتك تنتظر صفحتها الأولى.",
               "entryTitle": "مدخلة بدون عنوان"
           },
           "mood": {
               "howToday": "كيف كان يومك؟",
               "logged": "تم التسجيل لليوم. عد غدًا — الاستمرارية أهم من الدرجة.",
               "last14": "آخر 14 يومًا",
               "empty": "لا توجد تسجيلات بعد.",
               "footer": "الاتجاه عبر الزمن هو المهم — يوم واحد لا يحكي القصة أبدًا."
           },
           "game": {
               "inhale": "شهيق…",
               "exhale": "زفير ببطء…",
               "breaths": "أنفاس · الأفضل",
               "begin": "ابدأ",
               "finish": "إنهاء",
               "footer": "التنفس الموجّه بنحو 5.5 نفس/دقيقة يرتبط بتقليل الإثارة الفسيولوجية. ليس علاجًا طبيًا — مجرد لحظة هدوء."
           }
       },
       "billing": {
           "title": "دعم يبقى في المتناول",
           "subtitle": "الأساسيات مجانية للأبد. مساعدة الأزمات لا تقف أبدًا خلف جدار الدفع — وعد مدمج في المنتج لا في الخطة.",
           "free": {
               "name": "مجاني",
               "period": "للأبد"
           },
           "plus": {
               "name": "جلو بلس",
               "tag": "الأكثر تفضيلًا"
           },
           "payPerSession": "الدفع لكل جلسة",
           "perMonth": "/شهريًا",
           "currentPlan": "خطتك الحالية",
           "waitlist": "انضم لقائمة الانتظار",
           "joined": "أنت على القائمة 💜",
           "footer": "ستُعالَج المدفوعات عبر مزوّد مرخص بعد مراجعة التكاملات. لا تُخزَّن تفاصيل البطاقات أبدًا على خوادم جلو.",
           "perSession": "/ جلسة",
           "buy": "اشترِ جلسة",
           "egp": "جنيه"
       },
       "practices": {
           "title": "تمارين",
           "subtitle": "استكشف تمارين اليقاظ الذهني والتأريض."
       },
       "reflections": {
           "title": "أسبوعك بملاحظة لطيفة",
           "subtitle": "تأمل لطيف في رحلتك العاطفية."
       },
       "language": {
           "label": "اللغة"
       },
       "navLang": {
           "en": "English",
           "es": "Español",
           "fr": "Français",
           "ar": "العربية"
       },
       "crisis": {
           "aiNote": "جلو دعم بالذكاء الاصطناعي — وليس بديلاً عن الرعاية المهنية.",
           "emergency": "الطوارئ",
           "line": "خط الأزمات",
           "professional": "ابحث عن معالج"
       },
       "history": {
           "copy": "نسخ",
           "date": "جلسة بتاريخ {date}",
           "doctorPrepSubtitle": "ملخص لما شاركته، جاهز لعرضه في موعدك.",
           "doctorPrepTitle": "ما تخبره لطبيبك",
           "download": "تنزيل",
           "empty": "لا توجد جلسات بعد. ابدأ محادثتك الأولى لتراها هنا.",
           "export": "تصدير للطبيب",
           "noSessions": "أكمل جلسة أولاً لإنشاء ملخص للطبيب.",
           "searchPlaceholder": "بحث في الجلسات...",
           "summary": "ملخص",
           "title": "سجل جلساتك",
           "view": "عرض"
       },
       "mood": {
           "good": "جيد",
           "great": "رائع",
           "low": "منخفض",
           "okay": "لا بأس",
           "subtitle": "اختر الأقرب لشعورك — حتى إن لم يكن دقيقاً تماماً.",
           "title": "كيف تشعر الآن؟",
           "veryLow": "منخفض جداً"
       },
       "practice": {
           "bodyScan": "مسح الجسد",
           "bodyScanDesc": "خفّف التوتر بملاحظة كل جزء من جسدك.",
           "boxBreathing": "تنفس الصندوق",
           "boxBreathingDesc": "تقنية تنفس بسيطة من ٤ ثوانٍ لتهدئة جهازك العصبي.",
           "breatheHold": "اثبت...",
           "breatheIn": "اشهق...",
           "breatheOut": "ازفر...",
           "done": "انتهى. كيف تشعر الآن؟",
           "journaling": "موجه اليوميات",
           "journalingDesc": "اكتب ما يدور في ذهنك، جملة واحدة في كل مرة.",
           "next": "التالي",
           "pause": "إيقاف مؤقت",
           "repeat": "تكرار",
           "resume": "استئناف",
           "skip": "تخطي",
           "soundscape": "مشهد صوتي",
           "soundscapeDesc": "صوت محيط لطيف يساعدك على الهدوء.",
           "start": "ابدأ التمرين",
           "step": "الخطوة {n} من {total}"
       },
       "prompts": {
           "anxious": "أشعر بالقلق لكن لا أعرف لماذا",
           "howWeek": "كيف كان أسبوعك؟",
           "justListen": "أحتاج فقط إلى من يستمع إليّ",
           "lonely": "شعرت بالوحدة مؤخراً",
           "struggling": "أجد صعوبة في النوم",
           "tired": "أشعر بالتعب الشديد طوال الوقت"
       },
       "session": {
           "end": "إنهاء الجلسة",
           "ending": "جارٍ الاختتام...",
           "minuteWarning": "تبقى حوالي {mins} دقائق — هل هناك شيء تريد تغطيته؟",
           "start": "بدء الجلسة"
       },
       "privacyPage": {
           "title": "الخصوصية",
           "lead": "تصف هذه الصفحة كيفية تعامل تطبيق جلو مع المعلومات. تُقدَّم من أجل الشفافية وليست مشورة قانونية.",
           "whatTitle": "ما هو جلو",
           "whatBody": "جلو أداة دعم بالذكاء الاصطناعي للتأمل والمحادثة. ليست معالجاً بشرياً، ولا طوارئ، ولا خدمة طبية أو تشخيصية.",
           "accountTitle": "بيانات الحساب والجلسة",
           "accountItem1": "تُستخدم معلومات الحساب التي تقدمها (مثل البريد الإلكتروني/الاسم المعروض) لتسجيل دخولك وإدارة حسابك.",
           "accountItem2": "يستخدم المصادقة رموزاً صادرة عن الخادم. قد يستخدم التطبيق أيضاً ملف تعريف ارتباط HttpOnly للحفاظ على الجلسة عند الدعم.",
           "accountItem3": "يعتمد التعامل مع بيانات المحادثة/الجلسة على خيارات موافقتك وإعدادات النشر. تم تصميم تخزين الرسائل لاحترام الموافقة والتشفير عند تفعيل الاحتفاظ بالنصوص.",
           "journalTitle": "إدخالات اليوميات والمزاج",
           "journalBody": "إذا كنت تستخدم اليوميات أو تسجيل المزاج، تُخزَّن تلك الإدخالات لحسابك لتتمكن من عرضها لاحقاً. محتوى اليوميات مصمم ليُشفَّر في الراحة في الخلفية. اكتب فقط ما ترتاح لتخزينه.",
           "aiTitle": "المعالجة بالذكاء الاصطناعي",
           "aiBody": "عند تكوين مزود ذكاء اصطناعي خارجي، قد يتم إرسال النص الذي تقدمه إلى ذلك المزود لإنشاء الردود. يتحمل مشغلو النشر مسؤولية اختيار المزودين ومراجعة شروطهم وتكوين معالجة البيانات بشكل مناسب. عند استخدام المحرك المحلي للتطوير، تُنشأ الردود بواسطة محرك قواعد داخل عملية التطبيق.",
           "securityTitle": "الأمان",
           "securityItem1": "استخدم HTTPS في الإنتاج واضبط إعدادات ملفات تعريف الارتباط الآمنة وCORS لنطاقاتك المنشورة.",
           "securityItem2": "يجب تخزين الأسرار (مفاتيح المصادقة والمفاتيح الرئيسية ورموز المزودين) في متغيرات بيئة أو مدير أسرار، ولا تضعها أبداً في التحكم بالكود.",
           "securityItem3": "لا يمكن لأي نظام ضمان الأمان المطلق. أبلغ عن أي مشكلات مشتبه بها إلى مشغل النشر.",
           "choicesTitle": "خياراتك",
           "choicesBody": "حسب الميزات المنشورة، قد تتمكن من إدارة الموافقة ومراجعة الإدخالات المحفوظة وطلب إجراءات على حسابك/بياناتك. يعتمد التوفر على النشر المحدد والقوانين المعمول بها.",
           "updated": "آخر تحديث: 2026-11-09 (توثيق النموذج الأولي). يجب أن تتضمن عمليات النشر الإنتاجية بيانات اتصال بالمشغل وإشعارات خاصة بالاختصاص."
       },
       "safetyPage": {
           "title": "الأمان والشروط",
           "lead": "يرجى قراءة هذا قبل استخدام جلو. تُقدَّم هذه الشروط للشفافية وليست مشورة قانونية.",
           "limitsTitle": "قيود مهمة",
           "limitHumanShort": "ليست إنساناً.",
           "limitHumanBody": "جلو أداة دعم بالذكاء الاصطناعي، وليست شخصاً.",
           "limitMedicalShort": "ليست رعاية طبية.",
           "limitMedicalBody": "لا يقدم جلو نصيحة طبية أو تشخيصاً أو علاجاً أو وصفات.",
           "limitEmergencyShort": "ليست رعاية طارئة.",
           "limitEmergencyBody": "لم يُصمم جلو للطوارئ أو التدخل في الأزمات كبديل عن المساعدة المهنية.",
           "limitImperfectShort": "قد يكون غير مثالي.",
           "limitImperfectBody": "قد تكون ردود الذكاء الاصطناعي ناقصة أو غير دقيقة أو غير مناسبة. استخدم حكمك واطلب المساعدة المختصة عند الحاجة.",
           "crisisTitle": "إذا كنت تحتاج مساعدة عاجلة",
           "crisisBody": "إذا كنت في خطر فوري، أو تشعر أنك لا تستطيع البقاء آمناً، أو تحتاج مساعدة طبية أو نفسية عاجلة، فاتصل برقم الطوارئ المحلي أو شخص تثق به فوراً.",
           "crisisItem1": "استخدم رقم الطوارئ الخاص ببلدك أو منطقتك.",
           "crisisItem2": "إذا أمكن، اتصل بخط أزمات محلي أو خدمة صحة نفسية في منطقتك.",
           "crisisItem3": "تواصل مع شخص تثق به واطلب منه البقاء معك أثناء حصولك على المساعدة.",
           "crisisNote": "تختلف موارد الأزمات حسب الموقع ويجب أن يتحقق منها مراجعون محليون مؤهلون قبل عرضها كتوصيات رسمية. لا يدّعي هذا النموذج الأولي وجود دليل أزمات عالمي كامل وموثّق.",
           "responsibleTitle": "استخدام جلو بمسؤولية",
           "responsibleItem1": "استخدم جلو للدعم والتأمل وتخطيط خطوات صغيرة تالية — وليس كبديل عن الرعاية المهنية.",
           "responsibleItem2": "لا تعتمد على جلو في قرارات الأدوية أو التشخيص أو حالات الخطر العاجل.",
           "responsibleItem3": "احمِ بيانات اعتماد حسابك واستخدم جلو على أجهزة تثق بها.",
           "termsTitle": "الشروط (نموذج أولي)",
           "termsBody": "باستخدامك هذا النشر، توافق على استخدامه بشكل قانوني وتفهم حدوده. قد يحدّث المشغلون الميزات والتوفر والسياسات. يجب أن تتضمن عمليات النشر الإنتاجية شروطاً كاملة وإشعارات خصوصية وهوية المشغل ومعلومات اتصال مناسبة لاختصاصهم.",
           "updated": "آخر تحديث: 2026-11-09 (توثيق النموذج الأولي)."
       },
       "learnPage": {
           "label": "تعلّم",
           "title": "الجسد والعقل، معاً",
           "lead": "الصحة الجسدية والصحة النفسية تشكلان بعضهما البعض. تشرح هذه الصفحات الخارجية هذا الترابط بعمق — القراءة اختيارية، ولا يغني أي منها عن رعاية مختص يعرفك.",
           "footer": "تُفتح الروابط الخارجية في تبويب جديد. لا ينسخ جلو هذه المقالات؛ الملخصات هنا أصلية. إذا كنت في أزمة، استخدم روابط دعم الأزمات في التذييل — المساعدة مجانية بغض النظر عن الحساب.",
           "blurb1": "كيف تؤثر الصحة النفسية في الصحة الجسدية والعكس — مع أفكار عملية للمساعدة الذاتية حول التمارين والأكل الجيد والتحدث مع طبيبك.",
           "blurb2": "لماذا تنعكس التغييرات في جانب واحد غالباً على الجانب الآخر، من التوتر والنوم إلى التمارين والتغذية واليقظة الذهنية — مشروحاً بلغة بسيطة.",
           "blurb3": "نظرة عامة على ما تُظهره الأبحاث حول كيفية تأثير الجسد والعقل في بعضهما البعض، بما في ذلك المسارات البيولوجية المعنية.",
           "blurb4": "مواد دراسية من Global Psychology Alliance التابعة للجمعية الأمريكية لعلم النفس حول دمج الرعاية الجسدية والنفسية."
       },
       "yoga": {
           "seatedOptionLabel": "خيار الجلوس أو الثبات:"
       },
       "studio": {
           "guidedReflection": "التأمل الموجّه",
           "freeFlow": "دفتر حر",
           "encrypted": "مشفر AES-GCM",
           "chooseTheme": "اختر موضوع تأمل",
           "shuffle": "خلط الموجه",
           "todaysPrompt": "موجه لطيف لليوم",
           "useInJournal": "استخدم في اليوميات",
           "type": "كتابة",
           "pen": "قلم",
           "typeHint": "اكتب بلوحة المفاتيح",
           "penHint": "اكتب بالفأرة أو الإصبع أو القلم",
           "chooseInk": "اختر لون الحبر",
           "decorateHint": "زيّن بالملصقات",
           "stickers": "ملصقات",
           "uploadHint": "ارفع صورة كملصق من جهازك",
           "photo": "صورة",
           "stampHint": "انقر للختم:",
           "stampOnPage": "اختم على الصفحة",
           "uploadFromDevice": "رفع من الجهاز",
           "clearStickers": "إزالة الملصقات",
           "penWidth": "عرض القلم",
           "eraser": "ممحاة",
           "undo": "تراجع",
           "clearPen": "مسح القلم",
           "penHowto": "ارسم بالفأرة أو الإصبع أو القلم. انتقل إلى الكتابة متى شئت — كل شيء يُحفظ معاً.",
           "titlePh": "عنوان هذه الصفحة (اختياري)...",
           "bodyPh": "اكتب ما في قلبك... هذه الصفحة لك بالكامل، بلا حكم وبخصوصية.",
           "dragHint": "اسحب للتحريك. حدّد لتغيير الحجم أو التدوير أو القص.",
           "words": "{n} كلمة",
           "saved": "حُفظ بأمان في يومياتك",
           "clearPage": "مسح الصفحة",
           "save": "احفظ في اليوميات",
           "previous": "تذكارات سابقة",
           "entries": "{n} إدخال",
           "loading": "جارٍ التحميل...",
           "untitled": "تأمل بدون عنوان",
           "penPage": "· صفحة قلم",
           "penText": "· قلم + نص",
           "stickersCount": "· {n} ملصقات",
           "exportHint": "تصدير الإدخال إلى ملف نصي",
           "handwrittenAlt": "صفحة يوميات مكتوبة بخط اليد",
           "handwrittenPage": "[صفحة مكتوبة بخط اليد]",
           "decoratedPage": "[صفحة مزخرفة]",
           "waitingTitle": "يومياتك تنتظر صفحتها الأولى",
           "waitingBody": "اكتب، ارسم بالفأرة، اختر موضوع ورق، أو أضف ملصق صورة من جهازك.",
           "cropTitle": "قص ملصق الصورة",
           "cancel": "إلغاء",
           "applyCrop": "تطبيق القص",
           "selectedPhoto": "الصورة المحددة",
           "size": "الحجم",
           "rotate": "تدوير",
           "crop": "قص",
           "remove": "إزالة",
           "done": "تم",
           "cropPreviewAlt": "معاينة القص",
           "cropHint": "اضبط الحواف بالمنزلقات أدناه.",
           "top": "أعلى",
           "right": "يمين",
           "bottom": "أسفل",
           "left": "يسار",
           "resetCrop": "إعادة ضبط القص",
           "selectedEmojiPrefix": "محدّد"
       },
       "moodTracker": {
           "heading": "كيف كان اليوم؟",
           "intro": "يمكنك التسجيل بقدر ما تحتاج اليوم. يمكن للمشاعر أن تتغير وتتداخل وتتناقض.",
           "overall": "بشكل عام، هذه اللحظة تبدو",
           "extra": "ما الذي يوجد أيضاً؟ اختر ما يناسبك",
           "selected": "{n}/8 محدد",
           "noteLabel": "هل شيء تريد تذكره عن هذه اللحظة؟",
           "notePh": "اختياري — بضع كلمات تكفي.",
           "savedMsg": "حُفظ التسجيل. شكراً لملاحظة نفسك.",
           "todayMany": "{n} تسجيلات اليوم — المزيد مرحب به دائماً.",
           "todayNone": "لا تسجيلات بعد اليوم.",
           "add": "أضف هذا التسجيل",
           "weather": "طقس اليوم العاطفي",
           "moments": "{n} لحظات",
           "daysHint": "كل نقطة تسجيل واحد. يمكن للأيام أن تحمل مشاعر متعددة.",
           "noCheckin": "لا يوجد تسجيل",
           "multiLegend": "· الأرقام فوق اليوم تُظهر تسجيلات متعددة",
           "low": "منخفض",
           "okay": "لا بأس",
           "good": "جيد",
           "trends": "ما يهم هو الاتجاهات عبر الزمن — اليوم الواحد أو الشعور الواحد لا يرويان القصة كاملة أبداً.",
           "palette": "لوحة هذا الأسبوع العاطفية",
           "last7": "آخر ٧ أيام",
           "paletteBody": "اللوحة الأوسع ليست مشكلة تُصلح. إنها معلومات عن ما كنت تحمله.",
           "groupHeavy": "ثقيل",
           "groupActivated": "مُفعَّل",
           "groupCalm": "هدوء",
           "groupLow": "طاقة منخفضة",
           "hintHeavy": "حزن، حداد، وحدة",
           "hintActivated": "قلق، غضب، ضغط",
           "hintCalm": "سلام، أمل، تواصل",
           "hintLow": "إرهاق، ضباب ذهني، هدوء"
       }
},
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

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Start with the server-rendered default, then restore the saved language
  // after mount. Reading localStorage during the first render would make the
  // client markup differ from the server markup (hydration mismatch).
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem("glow.lang") as Language | null;
    if (saved && saved in flatTranslations) {
      setLanguageState(saved);
    }
  }, []);

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
