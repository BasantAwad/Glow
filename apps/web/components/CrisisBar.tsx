"use client";

import Link from "next/link";
import { LifeBuoy, PhoneCall, ShieldAlert } from "lucide-react";

export function CrisisBar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 px-4 py-2 sm:px-6 pointer-events-none">
      <div className="pointer-events-auto flex items-center justify-center gap-2 overflow-x-auto">
        <Link
          href="/safety#crisis"
          className="glass-soft flex items-center gap-2 rounded-full px-4 py-2 text-xs sm:text-sm font-medium text-destructive whitespace-nowrap hover:scale-[1.02] transition-transform"
        >
          <ShieldAlert className="size-4 shrink-0" />
          <span>Urgent help: contact local emergency services</span>
        </Link>
        <Link
          href="/safety#crisis"
          className="glass-soft hidden sm:flex items-center gap-2 rounded-full px-4 py-2 text-sm text-foreground/80 whitespace-nowrap"
        >
          <PhoneCall className="size-4 shrink-0" />
          <span>Find local crisis support</span>
        </Link>
        <Link
          href="/safety"
          className="glass-soft hidden md:flex items-center gap-2 rounded-full px-4 py-2 text-sm text-foreground/70 whitespace-nowrap"
        >
          <LifeBuoy className="size-4 shrink-0" />
          <span>Safety info</span>
        </Link>
        <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap shrink-0 hidden lg:inline">
          Glow is AI support, not emergency care.
        </span>
      </div>
    </div>
  );
}
