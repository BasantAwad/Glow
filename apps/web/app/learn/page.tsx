import type { Metadata } from "next";
import { LearnContent } from "../../components/LearnContent";

export const metadata: Metadata = {
  title: "Learn — Glow",
  description: "Reading on the physical-health and mental-health connection.",
};

export default function LearnPage() {
  return (
    <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8">
      <LearnContent />
    </main>
  );
}
