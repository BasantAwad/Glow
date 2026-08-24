export function GlowMark({ className = "size-10" }: { className?: string }) {
  return (
    <span
      className={`aurora halo inline-flex items-center justify-center rounded-full ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="size-1/2 text-primary-foreground/90">
        <path
          d="M10 18c1.6 2.4 4 3.6 6 3.6S20.4 20.4 22 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="11" cy="13" r="1.5" fill="currentColor" />
        <circle cx="21" cy="13" r="1.5" fill="currentColor" />
      </svg>
    </span>
  );
}
