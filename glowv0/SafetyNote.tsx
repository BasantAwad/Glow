import { Heart, UserRound } from "lucide-react";

export function SafetyNote({ message }: { message?: string }) {
  return (
    <section className="glass flex flex-col items-center gap-4 rounded-4xl px-6 py-5 sm:flex-row sm:justify-between">
      <div className="flex items-center gap-4">
        <span className="aurora flex size-12 shrink-0 items-center justify-center rounded-full">
          <Heart className="size-5 text-primary-foreground" />
        </span>
        <p className="text-sm text-foreground/90 sm:text-base">
          {message ??
            "Glow is an AI support companion — not a therapist, and it can't diagnose or provide emergency care."}
        </p>
      </div>
      <button className="glass-soft flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-transform hover:scale-[1.02]">
        <UserRound className="size-4" />
        Talk with a qualified professional
      </button>
    </section>
  );
}
