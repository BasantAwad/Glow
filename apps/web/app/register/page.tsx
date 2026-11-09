"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Heart, ShieldCheck, Info } from "lucide-react";
import { apiRegister } from "../../lib/auth";
import { useLanguage } from "../../contexts/LanguageContext";
import { getApiErrorMessage } from "../../lib/glow-api";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { language } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"" | "female" | "male" | "non_binary" | "prefer_not_to_say">("");
  const [medications, setMedications] = useState("");
  const [adult, setAdult] = useState(false);
  const [diagnosisDisclosed, setDiagnosisDisclosed] = useState(false);
  const [diagnosisNote, setDiagnosisNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const ageNum = Number.parseInt(age, 10);
    if (!Number.isInteger(ageNum) || ageNum < 18) {
      setError("Glow is currently adults-only (18+).");
      return;
    }
    if (!gender) {
      setError("Please choose how you'd like to describe your gender.");
      return;
    }
    setBusy(true);
    try {
      await apiRegister({
        email,
        password,
        display_name: displayName || undefined,
        is_adult_confirmed: adult,
        diagnosis_disclosed: diagnosisDisclosed,
        diagnosis_note: diagnosisDisclosed ? diagnosisNote : undefined,
        locale: language.toUpperCase(),
        age: ageNum,
        gender,
        medications: medications.trim() ? medications.trim() : undefined,
      });
      router.push("/chat");
    } catch (err) {
      setError(getApiErrorMessage(err, "Registration failed. Please check your details and try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass w-full max-w-lg rounded-4xl p-8 sm:p-10"
      >
        <h1 className="font-display text-3xl font-semibold text-center">
          {t("auth.register.title")}
        </h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {t("auth.register.subtitle")}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label htmlFor="displayName" className="text-xs font-medium text-muted-foreground">
              {t("auth.nameLabel")} <span className="opacity-60">{t("auth.nameOptional")}</span>
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              autoComplete="nickname"
              placeholder={t("auth.namePlaceholder")}
              className="mt-1.5 w-full glass-soft rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              {t("auth.email")}
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              className="mt-1.5 w-full glass-soft rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
              {t("auth.password")} <span className="opacity-60">{t("auth.passwordHint")}</span>
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={10}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1.5 w-full glass-soft rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="age" className="text-xs font-medium text-muted-foreground">
                {t("auth.ageLabel")}
              </label>
              <input
                id="age"
                type="number"
                required
                min={18}
                max={110}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                inputMode="numeric"
                className="mt-1.5 w-full glass-soft rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground/70">{t("auth.ageHint")}</p>
            </div>
            <div>
              <label htmlFor="gender" className="text-xs font-medium text-muted-foreground">
                {t("auth.genderLabel")}
              </label>
              <select
                id="gender"
                required
                value={gender}
                onChange={(e) => setGender(e.target.value as typeof gender)}
                className="mt-1.5 w-full glass-soft rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t("auth.genderPlaceholder")}</option>
                <option value="female">{t("auth.genderFemale")}</option>
                <option value="male">{t("auth.genderMale")}</option>
                <option value="non_binary">{t("auth.genderNonBinary")}</option>
                <option value="prefer_not_to_say">{t("auth.genderPreferNotToSay")}</option>
              </select>
              <p className="mt-1.5 text-[11px] text-muted-foreground/70">{t("auth.genderHint")}</p>
            </div>
          </div>

          <div>
            <label htmlFor="medications" className="text-xs font-medium text-muted-foreground">
              {t("auth.medicationLabel")} <span className="opacity-60">{t("auth.medicationOptional")}</span>
            </label>
            <textarea
              id="medications"
              value={medications}
              onChange={(e) => setMedications(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder={t("auth.medicationPlaceholder")}
              className="mt-1.5 w-full glass-soft rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground/70">{t("auth.medicationHint")}</p>
          </div>

          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={adult}
              onChange={(e) => setAdult(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--primary)]"
            />
            <span>{t("auth.adult")}</span>
          </label>

          {/* Optional diagnosis disclosure */}
          <div className="glass-soft rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Heart className="size-4 mt-0.5 shrink-0 text-primary" />
              <p className="text-sm leading-relaxed">
                {t("auth.diagnosis.question")}
              </p>
            </div>
            <label className="mt-3 flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={diagnosisDisclosed}
                onChange={(e) => setDiagnosisDisclosed(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              <span>{t("auth.diagnosis.share")}</span>
            </label>
            {diagnosisDisclosed && (
              <textarea
                value={diagnosisNote}
                onChange={(e) => setDiagnosisNote(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder={t("auth.diagnosis.placeholder")}
                className="mt-3 w-full glass rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            )}
            <p className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground/80">
              <ShieldCheck className="size-3.5 mt-0.5 shrink-0" />
              {t("auth.diagnosis.note")}
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy || !adult}
            className="aurora halo w-full rounded-full px-8 py-4 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.01] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {t("auth.createAccount")}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            {t("auth.haveAccount")}{" "}
            <Link href="/login" className="underline underline-offset-4 hover:text-foreground">
              {t("auth.signIn")}
            </Link>
          </p>

          <p className="flex items-start justify-center gap-1.5 text-center text-[11px] text-muted-foreground/70">
            <Info className="size-3 shrink-0 mt-0.5" />
            {t("safety.crisis")}
          </p>
        </form>
      </motion.div>
    </main>
  );
}
