"use client";

/**
 * Language context — full-site i18n with Arabic (RTL) support.
 *
 * - All UI strings for every page live here (flat dot-keys).
 * - `dir` is exposed so pages/layout can switch to RTL for Arabic.
 * - Persisted per browser in localStorage.
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Language = "en" | "ar" | "es" | "fr";

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  ar: "العربية",
  es: "Español",
  fr: "Français",
};

const RTL_LANGUAGES: Language[] = ["ar"];

type Dict = Record<string, string>;

const en: Dict = {
  // nav / chrome
  "nav.talk": "Talk",
  "nav.presence": "Presence",
  "nav.practices": "Practices",
  "nav.reflections": "Reflections",
  "nav.chat": "Chat",
  "nav.voice": "Voice",
  "nav.avatar": "Avatar",
  "nav.wellness": "Wellness",
  "nav.billing": "Billing",
  "nav.signIn": "Sign in",
  "nav.signOut": "Sign out",
  "nav.profile": "Your profile",

  // safety
  "safety.note":
    "Glow is an AI support tool, not a human therapist or emergency service.",
  "safety.professional": "Talk with a qualified professional",
  "safety.crisis":
    "If you're in crisis right now, please contact your local emergency number — help is free regardless of any account.",

  // chat
  "chat.title": "Talk it through",
  "chat.placeholder": "Type what's on your mind…",
  "chat.listening": "Glow is listening…",
  "chat.typingYou": "you're typing…",
  "chat.error":
    "Glow couldn't reach its support service just now. If this is urgent, please contact your local emergency services or crisis line.",
  "chat.checkin1":
    "Still with you — take your time. Is there anything on your mind you'd like to explore?",
  "chat.checkin2": "No rush at all. I'm here whenever you feel like continuing.",
  "chat.checkin3": "Just checking in gently — how are you feeling right now?",
  "chat.welcome":
    "Hi, I'm Glow. I'm an AI companion here to listen — not a human or a therapist. What's been on your mind lately?",

  // voice
  "voice.title": "Voice presence",
  "voice.subtitle": "Talk naturally. Captions always on.",
  "voice.start": "Start a voice conversation",
  "voice.recording": "I'm listening — tap to finish",
  "voice.thinking": "Thinking…",
  "voice.speaking": "Speaking — tap the mic to reply",
  "voice.connecting": "Connecting…",
  "voice.disclaimer":
    "Audio is transcribed in real time and is not stored unless you consent. Glow is an AI companion — not emergency care.",

  // avatar
  "avatar.title": "Meet your companion",
  "avatar.subtitle": "A visual presence for voice conversations.",
  "avatar.loading": "Loading companion…",
  "avatar.disclaimer":
    "Avatar is presentation only. Audio transcribed live, not stored without consent.",

  // home
  "home.hero1": "A softer place to",
  "home.hero2": "untangle your thoughts.",
  "home.heroSub":
    "Glow is an AI companion for mental-health support — not a replacement for professional care, but a warm first step when getting started is the hardest part.",
  "home.cta.start": "Begin gently — it's free",
  "home.cta.login": "I already have an account",
  "home.privacyLine":
    "Private by design · encrypted at rest · crisis support never paywalled",
  "home.safetyTitle": "Safety, honestly",
  "home.safetyBody":
    "Glow is an AI, never a licensed therapist. It won't diagnose, won't judge, and will point you to real human help whenever things feel too heavy — including crisis lines that are free to call, no matter what.",
  "home.f.chat.title": "Talk it out",
  "home.f.chat.desc":
    "A companion that listens — by text or voice, whenever you need it. Nothing you share is judged.",
  "home.f.avatar.title": "See a friendly face",
  "home.f.avatar.desc":
    "Optional avatar presence with real-time voice and lip-sync for a more human conversation.",
  "home.f.journal.title": "Private journal",
  "home.f.journal.desc":
    "Expressive writing is proven to ease anxious thoughts. Your entries are encrypted, always.",
  "home.f.mood.title": "Mood insights",
  "home.f.mood.desc":
    "A daily check-in takes seconds. Gentle charts reveal your patterns over weeks, not scores.",
  "home.f.calm.title": "Calm in minutes",
  "home.f.calm.desc":
    "Guided breathing and grounding exercises — small, clinically-informed tools for hard moments.",
  "home.f.games.title": "Healing through play",
  "home.f.games.desc":
    "Lightweight games designed around focus and mindfulness, because rest is productive too.",

  // auth
  "auth.register.title": "Create your space",
  "auth.register.subtitle": "A private account keeps your journey yours alone.",
  "auth.nameLabel": "What should Glow call you?",
  "auth.nameOptional": "(optional)",
  "auth.namePlaceholder": "A name you like",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.passwordHint": "(at least 10 characters)",
  "auth.adult": "I confirm I am 18 or older. Glow is currently adults-only.",
  "auth.createAccount": "Create account",
  "auth.haveAccount": "Already have an account?",
  "auth.noAccount": "New to Glow?",
  "auth.signIn": "Sign in",
  "auth.loginTitle": "Welcome back",
  "auth.loginSubtitle": "Your space is exactly as you left it.",
  "auth.diagnosis.question":
    "Have you been diagnosed with a mental-health condition by a professional? If you're comfortable sharing it, Glow can be more informed in conversations — but this is entirely optional.",
  "auth.diagnosis.share": "I'd like to share (I can change or remove this anytime)",
  "auth.diagnosis.placeholder":
    "Share only what feels right — e.g. 'generalized anxiety, diagnosed 2022'. Leave blank if you prefer.",
  "auth.diagnosis.note":
    "Stored encrypted, visible only to you, never used to diagnose, and deletable in one tap. Glow is an AI — it doesn't replace your clinician.",

  // profile
  "profile.title": "Your profile",
  "profile.privateSettings": "Your private settings",
  "profile.account": "Account",
  "profile.memberSince": "Member since",
  "profile.freeSessions": "Free sessions left",
  "profile.diagnosisTitle": "Diagnosis disclosure",
  "profile.diagnosisDesc":
    "Optional. If a professional has diagnosed you with something, sharing it helps Glow be more informed — but it never changes how much you're supported.",
  "profile.notShared": "Not shared",
  "profile.sharingNoDetails": "Sharing (no details written)",
  "profile.edit": "Edit",
  "profile.shareSomething": "Share something",
  "profile.removeWipe": "Remove & wipe note",
  "profile.save": "Save",
  "profile.cancel": "Cancel",
  "profile.diagnosisFooter":
    "Encrypted at rest · visible only to you · never used to diagnose · removing wipes the stored note entirely.",

  // wellness
  "wellness.title": "Wellness tools",
  "wellness.subtitle": "Small practices, real evidence. All private to you.",
  "wellness.tab.journal": "Journal",
  "wellness.tab.mood": "Mood chart",
  "wellness.tab.game": "Focus game",
  "wellness.journal.titlePh": "Give today's entry a title (optional)",
  "wellness.journal.writePh":
    "Write freely — nobody grades this. Expressive writing helps externalize anxious thoughts.",
  "wellness.journal.save": "Save entry",
  "wellness.journal.first": "Your journal is waiting for its first page.",
  "wellness.mood.howToday": "How was today?",
  "wellness.mood.logged": "Logged for today. Come back tomorrow — consistency matters more than the score.",
  "wellness.mood.last14": "Last 14 days",
  "wellness.mood.empty": "No check-ins yet.",
  "wellness.mood.footer":
    "Trends over time are what matter — a single day never tells the story.",
  "wellness.game.inhale": "Breathe in…",
  "wellness.game.exhale": "Breathe out slowly…",
  "wellness.game.breaths": "breaths · best",
  "wellness.game.begin": "Begin",
  "wellness.game.finish": "Finish",
  "wellness.game.footer":
    "Paced breathing at ~5.5 breaths/min is associated with reduced physiological arousal. Not a medical treatment — just a moment of calm.",

  // billing
  "billing.title": "Support that stays affordable",
  "billing.subtitle":
    "The essentials are free forever. Crisis help is never behind a paywall — that's a promise built into the product, not the plan.",
  "billing.free.name": "Free",
  "billing.free.period": "forever",
  "billing.plus.name": "Glow Plus",
  "billing.plus.tag": "Most loved",
  "billing.perMonth": "/month",
  "billing.currentPlan": "Your current plan",
  "billing.waitlist": "Join waitlist",
  "billing.joined": "You're on the list 💜",
  "billing.footer":
    "Payments will be processed by a licensed provider once integrations are reviewed. No card details are ever stored on Glow's servers.",

  // practices
  "practices.title": "Practices",
  "practices.subtitle": "Explore mindfulness and grounding exercises.",

  // reflections
  "reflections.title": "Your week, gently noticed",
  "reflections.subtitle": "A gentle reflection on your emotional journey.",
};

const ar: Dict = {
  "nav.talk": "تحدث",
  "nav.presence": "حضور",
  "nav.practices": "تمارين",
  "nav.reflections": "تأملات",
  "nav.chat": "محادثة",
  "nav.voice": "صوت",
  "nav.avatar": "الشخصية",
  "nav.wellness": "رفاهيتك",
  "nav.billing": "الفواتير",
  "nav.signIn": "تسجيل الدخول",
  "nav.signOut": "خروج",
  "nav.profile": "ملفك الشخصي",

  "safety.note":
    "جلو أداة دعم بالذكاء الاصطناعي، وليست معالجًا بشريًا ولا خدمة طوارئ.",
  "safety.professional": "تحدث مع مختص مؤهل",
  "safety.crisis":
    "إذا كنت في حالة أزمة الآن، يرجى الاتصال برقم الطوارئ المحلي — المساعدة مجانية بغض النظر عن أي حساب.",

  "chat.title": "لنتحدث عن الأمر",
  "chat.placeholder": "اكتب ما يدور في ذهنك…",
  "chat.listening": "جلو يستمع إليك…",
  "chat.typingYou": "أنت تكتب…",
  "chat.error":
    "لم يتمكن جلو من الوصول إلى خدمة الدعم الآن. إذا كان الأمر عاجلًا، يرجى الاتصال بخدمات الطوارئ المحلية أو خط الأزمات.",
  "chat.checkin1": "ما زلت معك — خذ وقتك. هل هناك شيء تود استكشافه؟",
  "chat.checkin2": "لا داعي للعجلة إطلاقًا. أنا هنا متى شعرت بالاستمرار.",
  "chat.checkin3": "أسألك بلطف فقط — كيف تشعر الآن؟",
  "chat.welcome":
    "مرحبًا، أنا جلو. رفيق ذكي موجود للاستماع إليك — لست إنسانًا ولا معالجًا. بماذا تفكر هذه الفترة؟",

  "voice.title": "حضور صوتي",
  "voice.subtitle": "تحدث بشكل طبيعي. التسميات النصية دائمًا متاحة.",
  "voice.start": "ابدأ محادثة صوتية",
  "voice.recording": "أستمع إليك — اضغط للإنهاء",
  "voice.thinking": "أفكر…",
  "voice.speaking": "أتحدث — اضغط على الميكروفون للرد",
  "voice.connecting": "جارٍ الاتصال…",
  "voice.disclaimer":
    "يتم تحويل الصوت إلى نص في الوقت الفعلي ولا يُخزَّن إلا بموافقتك. جلو رفيق ذكي — ليس خدمة طوارئ.",

  "avatar.title": "تعرّف على رفيقك",
  "avatar.subtitle": "حضور مرئي للمحادثات الصوتية.",
  "avatar.loading": "جارٍ تحميل الرفيق…",
  "avatar.disclaimer":
    "الشخصية للعرض فقط. يتم تحويل الصوت مباشرة، ولا يُخزَّن بدون موافقتك.",

  "home.hero1": "مكان أكثر ليونة",
  "home.hero2": "لفكّ العقد في أفكارك.",
  "home.heroSub":
    "جلو رفيق ذكي لدعم الصحة النفسية — ليس بديلاً عن الرعاية المهنية، بل خطوة أولى دافئة عندما تكون البداية أصعب شيء.",
  "home.cta.start": "ابدأ بلطف — إنه مجاني",
  "home.cta.login": "لدي حساب بالفعل",
  "home.privacyLine": "خصوصية بالتصميم · مشفر · دعم الأزمات مجاني دائمًا",
  "home.safetyTitle": "الأمان بصدق",
  "home.safetyBody":
    "جلو ذكاء اصطناعي، وليس معالجًا مرخصًا. لن يشخّص ولن يحكم عليك، وسيرشدك إلى مساعدة بشرية حقيقية كلما شعرت أن الأمور ثقيلة — بما في ذلك خطوط الأزمات المجانية مهما حدث.",
  "home.f.chat.title": "تحديث عن مشاعرك",
  "home.f.chat.desc": "رفيق يستمع إليك — بالنص أو الصوت، متى احتجت. لا حكم على ما تشاركه.",
  "home.f.avatar.title": "وجه ودود",
  "home.f.avatar.desc": "شخصية اختيارية بصوت حي ومزامنة شفاه لمحادثة أكثر إنسانية.",
  "home.f.journal.title": "مفكرة خاصة",
  "home.f.journal.desc": "الكتابة التعبيرية تساعد في تخفيف الأفكار القلقة. مدخلاتك مشفرة دائمًا.",
  "home.f.mood.title": "رؤى المزاج",
  "home.f.mood.desc": "تسجيل يومي يستغرق ثوانٍ. رسوم بيانية لطيفة تكشف أنماطك عبر الأسابيع.",
  "home.f.calm.title": "هدوء في دقائق",
  "home.f.calm.desc": "تمارين تنفس وتأريض موجّهة — أدوات صغيرة مستنيرة سريريًا لل لحظات الصعبة.",
  "home.f.games.title": "الشفاء عبر اللعب",
  "home.f.games.desc": "ألعاب خفيفة مصممة حول التركيز واليقاظ الذهني، لأن الراحة إنتاجية أيضًا.",

  "auth.register.title": "أنشئ مساحتك",
  "auth.register.subtitle": "حساب خاص يحافظ على رحلتك لك وحدك.",
  "auth.nameLabel": "بماذا تريد أن يناديك جلو؟",
  "auth.nameOptional": "(اختياري)",
  "auth.namePlaceholder": "اسم تحبه",
  "auth.email": "البريد الإلكتروني",
  "auth.password": "كلمة المرور",
  "auth.passwordHint": "(10 أحرف على الأقل)",
  "auth.adult": "أؤكد أن عمري 18 عامًا أو أكثر. جلو حاليًا للبالغين فقط.",
  "auth.createAccount": "إنشاء حساب",
  "auth.haveAccount": "لدي حساب بالفعل؟",
  "auth.noAccount": "جديد على جلو؟",
  "auth.signIn": "تسجيل الدخول",
  "auth.loginTitle": "مرحبًا بعودتك",
  "auth.loginSubtitle": "مساحتك كما تركتها تمامًا.",
  "auth.diagnosis.question":
    "هل شخّصك مختص بحالة صحة نفسية؟ إذا كنت مرتاحًا لمشاركتها، يمكن لجلو أن يكون أكثر إدراكًا في المحادثات — لكن هذا اختياري تمامًا.",
  "auth.diagnosis.share": "أود المشاركة (يمكنني التغيير أو الحذف في أي وقت)",
  "auth.diagnosis.placeholder":
    "شارك فقط ما ترتاح له — مثلاً «قلق معمم، تم التشخيص 2022». اتركه فارغًا إن فضلت ذلك.",
  "auth.diagnosis.note":
    "يُخزَّن مشفرًا، ولا يراه سواك، ولا يُستخدم للتشخيص، وقابل للحذف بلمسة واحدة. جلو ذكاء اصطناعي — لا يحل محل طبيبك.",

  "profile.title": "ملفك الشخصي",
  "profile.privateSettings": "إعداداتك الخاصة",
  "profile.account": "الحساب",
  "profile.memberSince": "عضو منذ",
  "profile.freeSessions": "الجلسات المجانية المتبقية",
  "profile.diagnosisTitle": "الإفصاح عن التشخيص",
  "profile.diagnosisDesc":
    "اختياري. إذا شخّصك مختص بحالة، فإن مشاركتها تساعد جلو على فهم أفضل — لكنها لا تغير أبدًا مقدار الدعم الذي تحصل عليه.",
  "profile.notShared": "غير مشارك",
  "profile.sharingNoDetails": "مشاركة (بدون تفاصيل)",
  "profile.edit": "تعديل",
  "profile.shareSomething": "شارك شيئًا",
  "profile.removeWipe": "حذف ومحو الملاحظة",
  "profile.save": "حفظ",
  "profile.cancel": "إلغاء",
  "profile.diagnosisFooter":
    "مشفر · لا يراه سواك · لا يُستخدم للتشخيص · الحذف يمحو الملاحظة المخزنة نهائيًا.",

  "wellness.title": "أدوات الرفاهية",
  "wellness.subtitle": "ممارسات صغيرة بأدلة حقيقية. كلها خاصة بك.",
  "wellness.tab.journal": "المفكرة",
  "wellness.tab.mood": "مخطط المزاج",
  "wellness.tab.game": "لعبة التركيز",
  "wellness.journal.titlePh": "أعطِ مدخلة اليوم عنوانًا (اختياري)",
  "wellness.journal.writePh":
    "اكتب بحرية — لا أحد يقيّمك. الكتابة التعبيرية تساعد في تصريف الأفكار القلقة.",
  "wellness.journal.save": "حفظ المدخلة",
  "wellness.journal.first": "مفكرتك تنتظر صفحتها الأولى.",
  "wellness.mood.howToday": "كيف كان يومك؟",
  "wellness.mood.logged": "تم التسجيل لليوم. عد غدًا — الاستمرارية أهم من الدرجة.",
  "wellness.mood.last14": "آخر 14 يومًا",
  "wellness.mood.empty": "لا توجد تسجيلات بعد.",
  "wellness.mood.footer": "الاتجاه عبر الزمن هو المهم — يوم واحد لا يحكي القصة أبدًا.",
  "wellness.game.inhale": "شهيق…",
  "wellness.game.exhale": "زفير ببطء…",
  "wellness.game.breaths": "أنفاس · الأفضل",
  "wellness.game.begin": "ابدأ",
  "wellness.game.finish": "إنهاء",
  "wellness.game.footer":
    "التنفس الموجّه بنحو 5.5 نفس/دقيقة يرتبط بتقليل الإثارة الفسيولوجية. ليس علاجًا طبيًا — مجرد لحظة هدوء.",

  "billing.title": "دعم يبقى في المتناول",
  "billing.subtitle":
    "الأساسيات مجانية للأبد. مساعدة الأزمات لا تقف أبدًا خلف جدار الدفع — وعد مدمج في المنتج لا في الخطة.",
  "billing.free.name": "مجاني",
  "billing.free.period": "للأبد",
  "billing.plus.name": "جلو بلس",
  "billing.plus.tag": "الأكثر تفضيلًا",
  "billing.perMonth": "/شهريًا",
  "billing.currentPlan": "خطتك الحالية",
  "billing.waitlist": "انضم لقائمة الانتظار",
  "billing.joined": "أنت على القائمة 💜",
  "billing.footer":
    "ستُعالَج المدفوعات عبر مزوّد مرخص بعد مراجعة التكاملات. لا تُخزَّن تفاصيل البطاقات أبدًا على خوادم جلو.",

  "practices.title": "تمارين",
  "practices.subtitle": "استكشف تمارين اليقاظ الذهني والتأريض.",

  "reflections.title": "أسبوعك بملاحظة لطيفة",
  "reflections.subtitle": "تأمل لطيف في رحلتك العاطفية.",
};

const es: Dict = {
  "nav.talk": "Hablar", "nav.presence": "Presencia", "nav.practices": "Prácticas",
  "nav.reflections": "Reflexiones", "nav.chat": "Chat", "nav.voice": "Voz",
  "nav.avatar": "Avatar", "nav.wellness": "Bienestar", "nav.billing": "Facturación",
  "nav.signIn": "Iniciar sesión", "nav.signOut": "Salir", "nav.profile": "Tu perfil",
  "safety.note": "Glow es una herramienta de apoyo con IA, no un terapeuta humano ni un servicio de emergencia.",
  "safety.professional": "Habla con un profesional cualificado",
  "safety.crisis": "Si estás en crisis ahora mismo, contacta con tu número local de emergencias — la ayuda es gratuita sin importar la cuenta.",
  "chat.title": "Hablemos del tema", "chat.placeholder": "Escribe lo que tienes en mente…",
  "chat.listening": "Glow está escuchando…", "chat.typingYou": "estás escribiendo…",
  "chat.error": "Glow no pudo contactar el servicio de apoyo en este momento. Si es urgente, contacta a tus servicios locales de emergencia o línea de crisis.",
  "chat.checkin1": "Sigo aquí — tómate tu tiempo. ¿Hay algo que te gustaría explorar?",
  "chat.checkin2": "Sin prisa alguna. Estoy aquí cuando quieras continuar.",
  "chat.checkin3": "Solo pregunto con cariño — ¿cómo te sientes ahora?",
  "chat.welcome": "Hola, soy Glow. Soy un compañero de IA aquí para escucharte — no soy humano ni terapeuta. ¿Qué ha estado en tu mente últimamente?",
  "voice.title": "Presencia de voz", "voice.subtitle": "Habla con naturalidad. Subtítulos siempre activados.",
  "voice.start": "Comenzar conversación de voz", "voice.recording": "Te escucho — toca para terminar",
  "voice.thinking": "Pensando…", "voice.speaking": "Hablando — toca el micrófono para responder",
  "voice.connecting": "Conectando…",
  "voice.disclaimer": "El audio se transcribe en tiempo real y no se almacena sin tu consentimiento. Glow es un compañero de IA — no emergencias.",
  "avatar.title": "Conoce a tu compañero", "avatar.subtitle": "Una presencia visual para conversaciones de voz.",
  "avatar.loading": "Cargando compañero…",
  "avatar.disclaimer": "El avatar es solo presentación. Audio transcrito en vivo, no almacenado sin consentimiento.",
  "home.hero1": "Un lugar más suave", "home.hero2": "para desenredar tus pensamientos.",
  "home.heroSub": "Glow es un compañero de IA para apoyo emocional — no reemplaza el cuidado profesional, sino un primer paso cálido cuando empezar es lo más difícil.",
  "home.cta.start": "Empieza suavemente — es gratis", "home.cta.login": "Ya tengo cuenta",
  "home.privacyLine": "Privado por diseño · cifrado · apoyo en crisis nunca de pago",
  "home.safetyTitle": "Seguridad, honestamente",
  "home.safetyBody": "Glow es una IA, nunca un terapeuta licenciado. No diagnostica, no juzga y te guiará a ayuda humana real cuando las cosas pesen demasiado — incluyendo líneas de crisis gratuitas, pase lo que pase.",
  "home.f.chat.title": "Desahógate", "home.f.chat.desc": "Un compañero que escucha — por texto o voz, cuando lo necesites. Nada de lo que compartas es juzgado.",
  "home.f.avatar.title": "Un rostro amable", "home.f.avatar.desc": "Presencia opcional con voz en tiempo real y sincronización labial.",
  "home.f.journal.title": "Diario privado", "home.f.journal.desc": "La escritura expresiva alivia pensamientos ansiosos. Tus entradas están cifradas, siempre.",
  "home.f.mood.title": "Perspectivas del ánimo", "home.f.mood.desc": "Un registro diario toma segundos. Gráficos suaves revelan tus patrones semanales.",
  "home.f.calm.title": "Calma en minutos", "home.f.calm.desc": "Respiración guiada y ejercicios de arraigo — herramientas pequeñas para momentos difíciles.",
  "home.f.games.title": "Sanar jugando", "home.f.games.desc": "Juegos ligeros centrados en atención plena, porque descansar también produce.",
  "auth.register.title": "Crea tu espacio", "auth.register.subtitle": "Una cuenta privada mantiene tu viaje solo tuyo.",
  "auth.nameLabel": "¿Cómo debe llamarte Glow?", "auth.nameOptional": "(opcional)", "auth.namePlaceholder": "Un nombre que te guste",
  "auth.email": "Correo electrónico", "auth.password": "Contraseña", "auth.passwordHint": "(al menos 10 caracteres)",
  "auth.adult": "Confirmo que tengo 18 años o más. Glow es actualmente solo para adultos.",
  "auth.createAccount": "Crear cuenta", "auth.haveAccount": "¿Ya tienes cuenta?", "auth.noAccount": "¿Nuevo en Glow?", "auth.signIn": "Iniciar sesión",
  "auth.loginTitle": "Bienvenido de nuevo", "auth.loginSubtitle": "Tu espacio está tal como lo dejaste.",
  "auth.diagnosis.question": "¿Un profesional te ha diagnosticado alguna condición de salud mental? Si te sientes cómodo compartiéndolo, Glow puede estar más informado — pero es totalmente opcional.",
  "auth.diagnosis.share": "Me gustaría compartirlo (puedo cambiarlo o eliminarlo en cualquier momento)",
  "auth.diagnosis.placeholder": "Comparte solo lo que te sientas cómodo — p.ej. «ansiedad generalizada, diagnosticada 2022». Déjalo vacío si prefieres.",
  "auth.diagnosis.note": "Almacenado cifrado, visible solo para ti, nunca usado para diagnosticar, y borrable con un toque. Glow es una IA — no reemplaza a tu clínico.",
  "profile.title": "Tu perfil", "profile.privateSettings": "Tus ajustes privados", "profile.account": "Cuenta",
  "profile.memberSince": "Miembro desde", "profile.freeSessions": "Sesiones gratis restantes",
  "profile.diagnosisTitle": "Divulgación de diagnóstico",
  "profile.diagnosisDesc": "Opcional. Compartirlo ayuda a Glow a estar mejor informado — pero nunca cambia cuánto apoyo recibes.",
  "profile.notShared": "No compartido", "profile.sharingNoDetails": "Compartiendo (sin detalles)",
  "profile.edit": "Editar", "profile.shareSomething": "Compartir algo", "profile.removeWipe": "Eliminar y borrar nota",
  "profile.save": "Guardar", "profile.cancel": "Cancelar",
  "profile.diagnosisFooter": "Cifrado en reposo · visible solo para ti · nunca usado para diagnosticar · eliminar borra la nota completamente.",
  "wellness.title": "Herramientas de bienestar", "wellness.subtitle": "Prácticas pequeñas, evidencia real. Todo privado.",
  "wellness.tab.journal": "Diario", "wellness.tab.mood": "Ánimo", "wellness.tab.game": "Juego de enfoque",
  "wellness.journal.titlePh": "Dale un título a la entrada de hoy (opcional)",
  "wellness.journal.writePh": "Escribe libremente — nadie califica esto.",
  "wellness.journal.save": "Guardar entrada", "wellness.journal.first": "Tu diario espera su primera página.",
  "wellness.mood.howToday": "¿Cómo fue tu día?", "wellness.mood.logged": "Registrado por hoy. Vuelve mañana — la constancia importa más que la nota.",
  "wellness.mood.last14": "Últimos 14 días", "wellness.mood.empty": "Aún no hay registros.",
  "wellness.mood.footer": "Las tendencias a largo plazo importan — un solo día nunca cuenta la historia.",
  "wellness.game.inhale": "Inhala…", "wellness.game.exhale": "Exhala despacio…",
  "wellness.game.breaths": "respiraciones · récord", "wellness.game.begin": "Comenzar", "wellness.game.finish": "Terminar",
  "wellness.game.footer": "La respiración pausada ~5.5 resp/min se asocia con menor activación fisiológica. No es tratamiento médico.",
  "billing.title": "Apoyo que sigue siendo accesible",
  "billing.subtitle": "Lo esencial es gratis para siempre. La ayuda en crisis jamás está tras un muro de pago.",
  "billing.free.name": "Gratis", "billing.free.period": "para siempre", "billing.plus.name": "Glow Plus",
  "billing.plus.tag": "El favorito", "billing.perMonth": "/mes", "billing.currentPlan": "Tu plan actual",
  "billing.waitlist": "Unirse a lista de espera", "billing.joined": "Estás en la lista 💜",
  "billing.footer": "Los pagos serán procesados por un proveedor autorizado. Nunca almacenamos datos de tarjetas.",
  "practices.title": "Prácticas", "practices.subtitle": "Explora ejercicios de atención plena y arraigo.",
  "reflections.title": "Tu semana, gentilmente observada", "reflections.subtitle": "Una reflexión suave sobre tu viaje emocional.",
};

const fr: Dict = {
  "nav.talk": "Parler", "nav.presence": "Présence", "nav.practices": "Pratiques",
  "nav.reflections": "Réflexions", "nav.chat": "Discussion", "nav.voice": "Voix",
  "nav.avatar": "Avatar", "nav.wellness": "Bien-être", "nav.billing": "Facturation",
  "nav.signIn": "Connexion", "nav.signOut": "Déconnexion", "nav.profile": "Votre profil",
  "safety.note": "Glow est un outil de soutien par IA, non un thérapeute humain ni un service d'urgence.",
  "safety.professional": "Parler à un professionnel qualifié",
  "safety.crisis": "Si vous êtes en crise maintenant, contactez votre numéro d'urgence local — l'aide est gratuite quel que soit le compte.",
  "chat.title": "Parlons-en", "chat.placeholder": "Écrivez ce qui vous préoccupe…",
  "chat.listening": "Glow vous écoute…", "chat.typingYou": "vous écrivez…",
  "chat.error": "Glow n'a pas pu joindre son service de soutien. Si c'est urgent, contactez vos services d'urgence locaux ou une ligne de crise.",
  "chat.checkin1": "Je suis toujours là — prenez votre temps. Y a-t-il quelque chose que vous aimeriez explorer ?",
  "chat.checkin2": "Aucune urgence. Je suis là quand vous souhaitez continuer.",
  "chat.checkin3": "Je demande doucement — comment vous sentez-vous maintenant ?",
  "chat.welcome": "Bonjour, je suis Glow. Un compagnon IA ici pour écouter — ni humain ni thérapeute. Qu'est-ce qui vous préoccupe ces derniers temps ?",
  "voice.title": "Présence vocale", "voice.subtitle": "Parlez naturellement. Sous-titres toujours affichés.",
  "voice.start": "Commencer une conversation vocale", "voice.recording": "Je vous écoute — touchez pour terminer",
  "voice.thinking": "Réflexion…", "voice.speaking": "Je parle — touchez le micro pour répondre",
  "voice.connecting": "Connexion…",
  "voice.disclaimer": "L'audio est transcrit en temps réel et non stocké sans votre consentement. Glow est un compagnon IA — pas les urgences.",
  "avatar.title": "Rencontrez votre compagnon", "avatar.subtitle": "Une présence visuelle pour les conversations vocales.",
  "avatar.loading": "Chargement du compagnon…",
  "avatar.disclaimer": "L'avatar est purement visuel. Audio transcrit en direct, non stocké sans consentement.",
  "home.hero1": "Un endroit plus doux", "home.hero2": "pour démêler vos pensées.",
  "home.heroSub": "Glow est un compagnon IA de soutien psychologique — pas un remplacement aux soins professionnels, mais un premier pas chaleureux quand commencer est le plus dur.",
  "home.cta.start": "Commencer en douceur — c'est gratuit", "home.cta.login": "J'ai déjà un compte",
  "home.privacyLine": "Privé par conception · chiffré · soutien en crise jamais payant",
  "home.safetyTitle": "La sécurité, honnêtement",
  "home.safetyBody": "Glow est une IA, jamais un thérapeute agréé. Il ne diagnostique pas, ne juge pas, et vous orientera vers de l'aide humaine réelle quand tout devient trop lourd — y compris des lignes de crise gratuites, quoi qu'il arrive.",
  "home.f.chat.title": "Évacuer ses émotions", "home.f.chat.desc": "Un compagnon qui écoute — par texte ou voix, quand vous en avez besoin.",
  "home.f.avatar.title": "Un visage amical", "home.f.avatar.desc": "Présence optionnelle avec voix temps réel et synchronisation labiale.",
  "home.f.journal.title": "Journal privé", "home.f.journal.desc": "L'écriture expressive apaise les pensées anxieuses. Vos entrées sont chiffrées, toujours.",
  "home.f.mood.title": "Analyses d'humeur", "home.f.mood.desc": "Un suivi quotidien prend des secondes. Des graphiques doux révèlent vos tendances.",
  "home.f.calm.title": "Le calme en minutes", "home.f.calm.desc": "Respiration guidée et exercices d'ancrage — de petits outils pour les moments difficiles.",
  "home.f.games.title": "Guérir en jouant", "home.f.games.desc": "Des jeux légers axés sur la concentration et la pleine conscience.",
  "auth.register.title": "Créez votre espace", "auth.register.subtitle": "Un compte privé garde votre parcours rien qu'à vous.",
  "auth.nameLabel": "Comment Glow doit-il vous appeler ?", "auth.nameOptional": "(facultatif)", "auth.namePlaceholder": "Un nom que vous aimez",
  "auth.email": "E-mail", "auth.password": "Mot de passe", "auth.passwordHint": "(au moins 10 caractères)",
  "auth.adult": "Je confirme avoir 18 ans ou plus. Glow est actuellement réservé aux adultes.",
  "auth.createAccount": "Créer un compte", "auth.haveAccount": "Vous avez déjà un compte ?", "auth.noAccount": "Nouveau sur Glow ?", "auth.signIn": "Se connecter",
  "auth.loginTitle": "Bon retour", "auth.loginSubtitle": "Votre espace est exactement comme vous l'avez laissé.",
  "auth.diagnosis.question": "Un professionnel vous a-t-il diagnostiqué une trouble de santé mentale ? Si vous êtes à l'aise de le partager, Glow peut être mieux informé — mais c'est totalement facultatif.",
  "auth.diagnosis.share": "Je souhaite partager (je peux modifier ou supprimer à tout moment)",
  "auth.diagnosis.placeholder": "Partagez seulement ce qui vous semble juste — ex. « anxiété généralisée, diagnostiquée en 2022 ». Laissez vide si vous préférez.",
  "auth.diagnosis.note": "Stocké chiffré, visible uniquement par vous, jamais utilisé pour diagnostiquer, et supprimable en un geste. Glow est une IA — il ne remplace pas votre clinicien.",
  "profile.title": "Votre profil", "profile.privateSettings": "Vos paramètres privés", "profile.account": "Compte",
  "profile.memberSince": "Membre depuis", "profile.freeSessions": "Sessions gratuites restantes",
  "profile.diagnosisTitle": "Divulgation du diagnostic",
  "profile.diagnosisDesc": "Facultatif. Le partager aide Glow à être mieux informé — mais cela ne change jamais le soutien reçu.",
  "profile.notShared": "Non partagé", "profile.sharingNoDetails": "Partagé (sans détails)",
  "profile.edit": "Modifier", "profile.shareSomething": "Partager quelque chose", "profile.removeWipe": "Supprimer et effacer la note",
  "profile.save": "Enregistrer", "profile.cancel": "Annuler",
  "profile.diagnosisFooter": "Chiffré au repos · visible uniquement par vous · jamais utilisé pour diagnostiquer · la suppression efface définitivement la note.",
  "wellness.title": "Outils de bien-être", "wellness.subtitle": "Petites pratiques, preuves réelles. Tout est privé.",
  "wellness.tab.journal": "Journal", "wellness.tab.mood": "Humeur", "wellness.tab.game": "Jeu de concentration",
  "wellness.journal.titlePh": "Donnez un titre à l'entrée du jour (facultatif)",
  "wellness.journal.writePh": "Écrivez librement — personne ne note ça.",
  "wellness.journal.save": "Enregistrer l'entrée", "wellness.journal.first": "Votre journal attend sa première page.",
  "wellness.mood.howToday": "Comment était votre journée ?", "wellness.mood.logged": "Enregistré pour aujourd'hui. Revenez demain — la régularité compte plus que la note.",
  "wellness.mood.last14": "Les 14 derniers jours", "wellness.mood.empty": "Aucun enregistrement pour le moment.",
  "wellness.mood.footer": "Ce sont les tendances dans le temps qui comptent — une seule journée ne raconte jamais toute l'histoire.",
  "wellness.game.inhale": "Inspirez…", "wellness.game.exhale": "Expirez lentement…",
  "wellness.game.breaths": "respirations · record", "wellness.game.begin": "Commencer", "wellness.game.finish": "Terminer",
  "wellness.game.footer": "La respiration rythmée (~5,5 resp./min) est associée à une baisse de l'activation physiologique. Pas un traitement médical.",
  "billing.title": "Un soutien qui reste abordable",
  "billing.subtitle": "L'essentiel est gratuit pour toujours. L'aide en crise n'est jamais derrière un paywall.",
  "billing.free.name": "Gratuit", "billing.free.period": "pour toujours", "billing.plus.name": "Glow Plus",
  "billing.plus.tag": "Le plus apprécié", "billing.perMonth": "/mois", "billing.currentPlan": "Votre plan actuel",
  "billing.waitlist": "Rejoindre la liste d'attente", "billing.joined": "Vous êtes sur la liste 💜",
  "billing.footer": "Les paiements seront traités par un fournisseur agréé. Aucune donnée de carte n'est stockée sur nos serveurs.",
  "practices.title": "Pratiques", "practices.subtitle": "Explorez la pleine conscience et les exercices d'ancrage.",
  "reflections.title": "Votre semaine, doucement remarquée", "reflections.subtitle": "Une réflexion douce sur votre parcours émotionnel.",
};

const translations: Record<Language, Dict> = { en, ar, es, fr };

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
  return saved && saved in translations ? saved : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = RTL_LANGUAGES.includes(language) ? "rtl" : "ltr";
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    window.localStorage.setItem("glow.lang", lang);
  };

  const dir: "ltr" | "rtl" = RTL_LANGUAGES.includes(language) ? "rtl" : "ltr";

  const t = React.useCallback(
    (key: string) => translations[language][key] ?? en[key] ?? key,
    [language],
  );

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
