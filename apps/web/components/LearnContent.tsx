"use client";

/**
 * Learn page body (client component so it follows the active UI language).
 * The static metadata stays in app/learn/page.tsx.
 *
 * Link-only references: the linked articles remain copyrighted by their
 * publishers; Glow does not reproduce or ingest their content.
 */

import { ArrowUpRight, BookHeart, HeartPulse } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

const RESOURCES = [
  {
    title: "Physical health and mental health",
    source: "Mental Health Foundation (UK)",
    url: "https://www.mentalhealth.org.uk/explore-mental-health/a-z-topics/physical-health-and-mental-health",
    blurbKey: "learnPage.blurb1",
  },
  {
    title: "The Connection Between Mental Health and Physical Health",
    source: "Verywell Mind (medically reviewed)",
    url: "https://www.verywellmind.com/the-mental-and-physical-health-connection-7255857",
    blurbKey: "learnPage.blurb2",
  },
  {
    title: "The Bidirectional Link Between Physical and Mental Health",
    source: "Simply Psychology",
    url: "https://www.simplypsychology.com/articles/physical-health-mental-health-link",
    blurbKey: "learnPage.blurb3",
  },
  {
    title: "Physical & Mental Health (Lesson 6)",
    source: "APA Global Psychology Alliance",
    url: "https://www.apa.org/international/networks/global-psychology-alliance/lesson-6-physical-mental-health.pdf",
    blurbKey: "learnPage.blurb4",
  },
];

export function LearnContent() {
  const { t } = useLanguage();

  return (
    <>
      <div className="flex flex-col items-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center gap-2 mb-2 px-3 py-1 rounded-full glass-soft text-xs text-primary font-medium">
          <BookHeart className="size-3.5" />
          <span>{t("learnPage.label")}</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-center tracking-tight">
          {t("learnPage.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground text-center max-w-lg">
          {t("learnPage.lead")}
        </p>
      </div>

      <div className="space-y-4">
        {RESOURCES.map((resource) => (
          <a
            key={resource.url}
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="glass group block p-6 rounded-3xl transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10"
          >
            <div className="flex items-start gap-4">
              <div className="aurora bg-gradient-to-br from-rose-500/20 to-red-500/10 flex size-12 shrink-0 items-center justify-center rounded-2xl">
                <HeartPulse className="size-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    {resource.title}
                  </h2>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <p className="text-[11px] font-medium text-primary/80 mt-0.5">{resource.source}</p>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{t(resource.blurbKey)}</p>
              </div>
            </div>
          </a>
        ))}
      </div>

      <p className="mt-8 text-center text-[11px] text-muted-foreground/70">
        {t("learnPage.footer")}
      </p>
    </>
  );
}
