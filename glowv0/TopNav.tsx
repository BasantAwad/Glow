import { Link } from "@tanstack/react-router";
import { Globe, ChevronDown, MessageCircle, AudioLines, Sparkles, Moon } from "lucide-react";
import { GlowMark } from "./GlowMark";

const links = [
  { to: "/", label: "Talk", icon: MessageCircle },
  { to: "/presence", label: "Presence", icon: AudioLines },
  { to: "/practices", label: "Practices", icon: Sparkles },
  { to: "/reflections", label: "Reflections", icon: Moon },
] as const;

export function TopNav() {
  return (
    <header className="relative z-20 flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <Link to="/" className="flex items-center gap-3">
        <GlowMark className="size-11" />
        <span className="font-display text-2xl font-semibold">Glow</span>
      </Link>

      <nav className="order-3 flex w-full items-center justify-center gap-1 sm:order-none sm:w-auto">
        {links.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground [&.active]:glass [&.active]:text-foreground"
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <button className="glass-soft flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <Globe className="size-4" />
          English
          <ChevronDown className="size-3.5" />
        </button>
        <button className="aurora halo size-10 rounded-full" aria-label="Your profile" />
      </div>
    </header>
  );
}
