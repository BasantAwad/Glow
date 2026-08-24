import { FileText, Lock, LifeBuoy } from "lucide-react";

const items = [
  { icon: FileText, label: "Your reflections" },
  { icon: Lock, label: "Privacy" },
  { icon: LifeBuoy, label: "Safety and crisis support" },
];

export function PageFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 px-6 py-10 text-sm text-muted-foreground">
      {items.map(({ icon: Icon, label }) => (
        <span key={label} className="flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </span>
      ))}
    </footer>
  );
}
