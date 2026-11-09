import type { Metadata } from "next";
import { SafetyContent } from "../../components/SafetyContent";

export const metadata: Metadata = {
  title: "Safety & Terms — Glow",
  description: "Safety information, limitations, and terms for using Glow.",
};

export default function SafetyPage() {
  return (
    <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 space-y-8">
      <SafetyContent />
    </main>
  );
}
