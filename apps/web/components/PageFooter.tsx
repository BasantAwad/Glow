import Link from "next/link";
import { FileText, Lock, LifeBuoy, BookHeart } from "lucide-react";

const items = [
  { href: "/safety", icon: FileText, label: "Safety & terms" },
  { href: "/privacy", icon: Lock, label: "Privacy" },
  { href: "/learn", icon: BookHeart, label: "Learn" },
  { href: "/safety#crisis", icon: LifeBuoy, label: "Crisis support" },
];

export function PageFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-6 py-10 text-sm text-muted-foreground">
      {items.map(({ href, icon: Icon, label }) => (
        <Link key={label} href={href} className="flex items-center gap-2 hover:text-foreground transition-colors">
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </footer>
  );
}
