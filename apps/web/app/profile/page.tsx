"use client";

/**
 * Profile & settings — the user&apos;s own space.
 * Shows account info, the optional diagnosis disclosure (editable/revocable),
 * and session entitlement. All data comes from the backend; nothing cached
 * client-side beyond the session token.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Heart, ShieldCheck, UserRound } from "lucide-react";
import { authFetch } from "../../lib/auth";

type Profile = {
  user_id: string;
  display_name: string | null;
  created_at: string;
  diagnosis_disclosed: boolean;
  diagnosis_note: string | null;
  free_sessions_remaining: number;
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingDiagnosis, setEditingDiagnosis] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authFetch("/profile");
      if (!res.ok) throw new Error("unauthorized");
      const data: Profile = await res.json();
      setProfile(data);
    } catch {
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const saveDiagnosis = async (disclosed: boolean, note?: string) => {
    setSaving(true);
    try {
      await authFetch("/profile/diagnosis", {
        method: "PUT",
        json: { diagnosis_disclosed: disclosed, diagnosis_note: note ?? undefined },
      });
      await load();
      setEditingDiagnosis(false);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-10 space-y-6">
      <div className="flex flex-col items-center mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <span className="aurora halo mb-3 flex size-16 items-center justify-center rounded-full">
          <UserRound className="size-7 text-primary-foreground" />
        </span>
        <h1 className="font-display text-3xl font-semibold">Your profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile?.display_name ? `Hi, ${profile.display_name}` : "Your private settings"}
        </p>
      </div>

      {/* Account summary */}
      <section className="glass rounded-3xl p-6 space-y-3">
        <h2 className="font-display font-semibold">Account</h2>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Member since</span>
          <span>{profile && new Date(profile.created_at).toLocaleDateString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Free sessions left</span>
          <span>{profile?.free_sessions_remaining}</span>
        </div>
      </section>

      {/* Diagnosis disclosure */}
      <section className="glass rounded-3xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Heart className="size-5 mt-0.5 shrink-0 text-primary" />
          <div>
            <h2 className="font-display font-semibold">Diagnosis disclosure</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Optional. If a professional has diagnosed you with something,
              sharing it helps Glow be more informed — but it never changes how
              much you&apos;re supported.
            </p>
          </div>
        </div>

        {!editingDiagnosis ? (
          <div className="space-y-3">
            <p className="glass-soft rounded-xl px-4 py-3 text-sm whitespace-pre-wrap">
              {profile?.diagnosis_disclosed
                ? profile.diagnosis_note || "Sharing (no details written)"
                : "Not shared"}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setNoteDraft(profile?.diagnosis_note ?? "");
                  setEditingDiagnosis(true);
                }}
                className="aurora rounded-full px-5 py-2.5 text-xs font-medium text-primary-foreground"
              >
                {profile?.diagnosis_disclosed ? "Edit" : "Share something"}
              </button>
              {profile?.diagnosis_disclosed && (
                <button
                  onClick={() => saveDiagnosis(false)}
                  disabled={saving}
                  className="glass-soft rounded-full px-5 py-2.5 text-xs"
                >
                  Remove & wipe note
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Only what you&apos;re comfortable sharing…"
              className="w-full glass-soft rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-3">
              <button
                onClick={() => saveDiagnosis(true, noteDraft)}
                disabled={saving}
                className="aurora rounded-full px-5 py-2.5 text-xs font-medium text-primary-foreground flex items-center gap-2"
              >
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                Save
              </button>
              <button
                onClick={() => setEditingDiagnosis(false)}
                className="glass-soft rounded-full px-5 py-2.5 text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <p className="flex items-start gap-2 text-[11px] text-muted-foreground/80">
          <ShieldCheck className="size-3.5 mt-0.5 shrink-0" />
          Encrypted at rest · visible only to you · never used to diagnose ·
          removing wipes the stored note entirely.
        </p>
      </section>
    </main>
  );
}
