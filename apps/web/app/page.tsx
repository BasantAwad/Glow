"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageCircle,
  AudioLines,
  BookHeart,
  LineChart,
  Wind,
  Gamepad2,
  Sparkles,
} from "lucide-react";
import { GlowMark } from "../components/GlowMark";
import { useLanguage } from "../contexts/LanguageContext";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

const getFeatures = (t: (k: string) => string) => [
  {
    icon: MessageCircle,
    title: t("home.f.chat.title"),
    desc: t("home.f.chat.desc"),
    href: "/chat",
  },
  {
    icon: AudioLines,
    title: t("home.f.avatar.title"),
    desc: t("home.f.avatar.desc"),
    href: "/presence",
  },
  {
    icon: BookHeart,
    title: t("home.f.journal.title"),
    desc: t("home.f.journal.desc"),
    href: "/wellness",
  },
  {
    icon: LineChart,
    title: t("home.f.mood.title"),
    desc: t("home.f.mood.desc"),
    href: "/wellness",
  },
  {
    icon: Wind,
    title: t("home.f.calm.title"),
    desc: t("home.f.calm.desc"),
    href: "/practices",
  },
  {
    icon: Gamepad2,
    title: t("home.f.games.title"),
    desc: t("home.f.games.desc"),
    href: "/games",
  },
];

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative flex flex-col items-center text-center px-6 pt-20 pb-28">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={0}
          className="aurora halo mb-8 flex size-20 items-center justify-center rounded-full"
        >
          <GlowMark className="size-14" />
        </motion.div>

        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={1}
          className="font-display max-w-3xl text-4xl sm:text-6xl font-semibold leading-tight tracking-tight"
        >
          {t("home.hero1")}
          <span className="block bg-gradient-to-r from-violet-300 via-pink-200 to-amber-200 bg-clip-text text-transparent">
            {t("home.hero2")}
          </span>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={2}
          className="mt-6 max-w-xl text-muted-foreground text-base sm:text-lg leading-relaxed"
        >
          {t("home.heroSub")}
        </motion.p>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={3}
          className="mt-10 flex flex-col sm:flex-row items-center gap-4"
        >
          <Link
            href="/register"
            className="aurora halo rounded-full px-8 py-4 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03]"
          >
            {t("home.cta.start")}
          </Link>
          <Link
            href="/login"
            className="glass-soft rounded-full px-8 py-4 text-sm font-medium transition-colors hover:text-foreground"
          >
            {t("home.cta.login")}
          </Link>
        </motion.div>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={4}
          className="mt-8 text-xs text-muted-foreground/70 flex items-center gap-2"
        >
          <Sparkles className="size-3" />
          {t("home.privacyLine")}
        </motion.p>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {getFeatures(t).map((f, i) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              custom={i % 3}
            >
              <Link
                href={f.href}
                className="glass group block h-full rounded-3xl p-6 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10"
              >
                <span className="aurora mb-4 flex size-11 items-center justify-center rounded-2xl">
                  <f.icon className="size-5 text-primary-foreground" />
                </span>
                <h3 className="font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Safety strip */}
      <section className="max-w-3xl mx-auto px-6 pb-24 text-center">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="glass rounded-4xl px-8 py-10"
        >
          <h2 className="font-display text-2xl font-semibold">{t("home.safetyTitle")}</h2>
          <p className="mt-4 text-sm sm:text-base leading-relaxed text-muted-foreground">
            Glow is an AI, never a licensed therapist. It won&apos;t diagnose, won&apos;t
            judge, and will point you to real human help whenever things feel
            too heavy — including crisis lines that are free to call, no matter
            what.
          </p>
        </motion.div>
      </section>
    </main>
  );
}
