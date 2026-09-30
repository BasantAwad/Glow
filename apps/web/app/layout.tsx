import type { Metadata } from "next";
import { Nunito_Sans, Quicksand } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "../contexts/LanguageContext";
import { TopNav } from "../components/TopNav";
import { PageFooter } from "../components/PageFooter";
import { CrisisBar } from "../components/CrisisBar";

const fontSans = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontDisplay = Quicksand({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Glow - AI mental-health support",
  description: "A gentle nocturnal support companion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fontSans.variable} ${fontDisplay.variable} antialiased min-h-screen flex flex-col relative`}
      >
        {/* Global Background Image */}
        <div
          className="fixed inset-0 z-[-3] bg-cover bg-center bg-no-repeat transition-opacity duration-1000"
          style={{ backgroundImage: "url('/edd65eeb-f28d-407c-80d0-6c951b814e90.jfif')" }}
        />

        {/* Ambient mood-based animated overlay */}
        <div className="fixed inset-0 z-[-2] ambient-overlay ambient-calm pointer-events-none" />

        {/* Dark overlay for readability */}
        <div className="fixed inset-0 z-[-1] bg-black/40 pointer-events-none" />

        {/* Global Shooting Star Animation Container */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="shooting-star-layer absolute inset-0 opacity-40"></div>
        </div>

        <LanguageProvider>
          <TopNav />
          <div className="flex-1 relative z-10 flex flex-col pb-12">
            {children}
          </div>
          <PageFooter />
          <CrisisBar />
        </LanguageProvider>
      </body>
    </html>
  );
}
