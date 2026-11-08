"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Globe,
  ChevronDown,
  MessageCircle,
  AudioLines,
  Sparkles,
  Moon,
  Home,
  BookHeart,
  CreditCard,
  LogOut,
  UserRound,
  Wind,
  Gamepad2,
} from "lucide-react";
import { GlowMark } from "./GlowMark";
import { useLanguage, LANGUAGE_LABELS } from "../contexts/LanguageContext";
import type { Language } from "../contexts/LanguageContext";
import { getStoredAuth, clearStoredAuth } from "../lib/auth";

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const auth = typeof window !== "undefined" ? getStoredAuth() : null;
  const signedIn = Boolean(auth?.token);

  const links = [
    { to: "/", label: t("nav.talk"), icon: Home },
    { to: "/chat", label: t("nav.chat"), icon: MessageCircle },
    { to: "/presence", label: t("nav.avatar"), icon: Sparkles },
    { to: "/practices", label: "Practices", icon: Wind },
    { to: "/games", label: "Games", icon: Gamepad2 },
    { to: "/wellness", label: t("nav.wellness"), icon: BookHeart },
    { to: "/billing", label: t("nav.billing"), icon: CreditCard },
  ];

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
              className={`flex items-center gap-2 rounded-full px-3.5 py-2.5 text-sm transition-colors hover:text-foreground ${
                isActive ? "glass text-foreground" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-4" />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <select
          value={language}
          onChange={(e) => {
            const lang = e.target.value as Language;
            setLanguage(lang);
            void fetch("/api/locale-sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ locale: lang.toUpperCase() }),
            }).catch(() => {});
          }}
          className="glass-soft hidden sm:block rounded-full px-4 py-2 text-sm text-muted-foreground bg-transparent cursor-pointer"
          aria-label="Language"
        >
          {(Object.keys(LANGUAGE_LABELS) as Language[]).map((l) => (
            <option key={l} value={l} className="text-black">
              {LANGUAGE_LABELS[l]}
            </option>
          ))}
        </select>

        {signedIn ? (
          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              aria-label={t("nav.profile")}
              className={`aurora halo flex size-10 items-center justify-center rounded-full transition-opacity hover:opacity-90 ${
                pathname === "/profile" ? "ring-2 ring-ring/70" : ""
              }`}
            >
              <UserRound className="size-4 text-primary-foreground" />
            </Link>
            <button
              onClick={() => {
                clearStoredAuth();
                router.push("/");
              }}
              aria-label="Sign out"
              className="glass-soft flex size-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="aurora halo rounded-full px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
