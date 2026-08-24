"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, ChevronDown, MessageCircle, AudioLines, Sparkles, Moon } from "lucide-react";
import { GlowMark } from "./GlowMark";
import { useLanguage } from "../contexts/LanguageContext";

export function TopNav() {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();

  const links = [
    { to: "/", label: t("nav.talk"), icon: MessageCircle },
    { to: "/presence", label: t("nav.presence"), icon: AudioLines },
    { to: "/practices", label: t("nav.practices"), icon: Sparkles },
    { to: "/reflections", label: t("nav.reflections"), icon: Moon },
  ];

  const toggleLanguage = () => {
    if (language === "en") setLanguage("es");
    else if (language === "es") setLanguage("fr");
    else setLanguage("en");
  };

  return (
    <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <Link href="/" className="flex items-center gap-3">
        <GlowMark className="size-11" />
        <span className="font-display text-2xl font-semibold">Glow</span>
      </Link>

      <nav className="order-3 flex w-full items-center justify-center gap-1 sm:order-none sm:w-auto">
        {links.map(({ to, label, icon: Icon }) => {
          const isActive = pathname === to;
          return (
            <Link
              key={to}
              href={to}
              className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-sm transition-colors hover:text-foreground ${
                isActive ? "glass text-foreground" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <button 
          onClick={toggleLanguage}
          className="glass-soft flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Globe className="size-4" />
          {language === "en" ? "English" : language === "es" ? "Español" : "Français"}
          <ChevronDown className="size-3.5" />
        </button>
        <button className="aurora halo size-10 rounded-full" aria-label="Your profile" />
      </div>
    </header>
  );
}
