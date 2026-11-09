"use client";

/**
 * Privacy page body (client component so it follows the active UI language).
 * The static metadata stays in app/privacy/page.tsx.
 */

import { useLanguage } from "../contexts/LanguageContext";

export function PrivacyContent() {
  const { t } = useLanguage();

  return (
    <>
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-semibold">{t("privacyPage.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("privacyPage.lead")}
        </p>
      </header>

      <section className="glass rounded-3xl p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold">{t("privacyPage.whatTitle")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("privacyPage.whatBody")}
        </p>
      </section>

      <section className="glass rounded-3xl p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold">{t("privacyPage.accountTitle")}</h2>
        <ul className="text-sm leading-relaxed text-muted-foreground list-disc pl-5 space-y-2">
          <li>{t("privacyPage.accountItem1")}</li>
          <li>{t("privacyPage.accountItem2")}</li>
          <li>{t("privacyPage.accountItem3")}</li>
        </ul>
      </section>

      <section className="glass rounded-3xl p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold">{t("privacyPage.journalTitle")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("privacyPage.journalBody")}
        </p>
      </section>

      <section className="glass rounded-3xl p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold">{t("privacyPage.aiTitle")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("privacyPage.aiBody")}
        </p>
      </section>

      <section className="glass rounded-3xl p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold">{t("privacyPage.securityTitle")}</h2>
        <ul className="text-sm leading-relaxed text-muted-foreground list-disc pl-5 space-y-2">
          <li>{t("privacyPage.securityItem1")}</li>
          <li>{t("privacyPage.securityItem2")}</li>
          <li>{t("privacyPage.securityItem3")}</li>
        </ul>
      </section>

      <section className="glass rounded-3xl p-6 space-y-3">
        <h2 className="font-display text-lg font-semibold">{t("privacyPage.choicesTitle")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("privacyPage.choicesBody")}
        </p>
      </section>

      <p className="text-xs text-muted-foreground/80">
        {t("privacyPage.updated")}
      </p>
    </>
  );
}
