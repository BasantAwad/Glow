import type { Metadata } from "next";
import { PrivacyContent } from "../../components/PrivacyContent";

export const metadata: Metadata = {
  title: "Privacy — Glow",
  description: "How Glow handles your information.",
};

export default function PrivacyPage() {
  return (
    <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 space-y-8">
      <PrivacyContent />
    </main>
  );
}
