"use client";

/**
 * Safety & Terms body (client component so it follows the active UI
 * language). The static metadata stays in app/safety/page.tsx.
 */

import { useLanguage } from "../contexts/LanguageContext";

export function SafetyContent() {
  const { t } = useLanguage();

  const limits: Array<[string, string]> = [
    ["safetyPage.limitHumanShort", "safetyPage.limitHumanBody"],
    ["safetyPage.limitMedicalShort", "safetyPage.limitMedicalBody"],
    ["safetyPage.limitEmergencyShort", "safetyPage.limitEmergencyBody"],
    ["safetyPage.limitImperfectShort", "safetyPage.limitImperfectBody"],
  ];

  return (
    <>
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold">{t("safetyPage.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("safetyPage.lead")}
        </p>
      </header>

      <section className="glass rounded-3xl p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold">{t("safetyPage.limitsTitle")}</h2>
        <ul className="text-sm leading-relaxed text-muted-foreground list-disc pl-5 space-y-2">
          {limits.map(([short, body]) => (
            <li key={short}>
              <strong>{t(short)}</strong> {t(body)}
            </li>
          ))}
        </ul>
      </section>

      <section id="crisis" className="glass rounded-3xl p-6 space-y-3 scroll-mt-24">
        <h2 className="font-display text-lg font-semibold">{t("safetyPage.crisisTitle")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("safetyPage.crisisBody")}
        </p>
        <ul className="text-sm leading-relaxed text-muted-foreground list-disc pl-5 space-y-2">
          <li>{t("safetyPage.crisisItem1")}</li>
          <li>{t("safetyPage.crisisItem2")}</li>
          <li>{t("safetyPage.crisisItem3")}</li>
        </ul>
        <p className="text-xs text-muted-foreground/80">
          {t("safetyPage.crisisNote")}
        </p>
      </section>

      <section className="glass rounded-3xl p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold">{t("safetyPage.responsibleTitle")}</h2>
        <ul className="text-sm leading-relaxed text-muted-foreground list-disc pl-5 space-y-2">
          <li>{t("safetyPage.responsibleItem1")}</li>
          <li>{t("safetyPage.responsibleItem2")}</li>
          <li>{t("safetyPage.responsibleItem3")}</li>
        </ul>
      </section>

      <section className="glass rounded-3xl p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold">{t("safetyPage.termsTitle")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("safetyPage.termsBody")}
        </p>
      </section>

      <p className="text-xs text-muted-foreground/80">
        {t("safetyPage.updated")}
      </p>
    </>
  );
}
