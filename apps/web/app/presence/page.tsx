"use client";

/**
 * Realistic video presence.
 *
 * The 3D avatar option was removed by request. This page now offers only the
 * realistic video companion (Tavus embed). If no deployment id is configured,
 * it shows a clear placeholder instead of pretending to connect.
 */

import { useEffect, useState } from "react";
import { Loader2, Video } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";

const TAVUS_DEPLOYMENT_ID =
  process.env.NEXT_PUBLIC_TAVUS_DEPLOYMENT_ID || "6e550748-e56b-43c4-b4a3-80b78e38c1cd";

function TavusPresenter() {
  const [embedStatus, setEmbedStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let disposed = false;
    let timeoutId: number | undefined;
    const scriptUrl = "https://unpkg.com/@tavus/embed@latest";
    const script = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);

    const markReady = () => {
      void customElements.whenDefined("tavus-embed").then(() => {
        if (!disposed) setEmbedStatus("ready");
      });
    };
    const markError = () => {
      if (!disposed) setEmbedStatus("error");
    };

    if (customElements.get("tavus-embed")) {
      void Promise.resolve().then(() => {
        if (!disposed) setEmbedStatus("ready");
      });
      return;
    }

    const embedScript = script ?? document.createElement("script");
    embedScript.addEventListener("load", markReady, { once: true });
    embedScript.addEventListener("error", markError, { once: true });
    timeoutId = window.setTimeout(markError, 15_000);

    if (!script) {
      embedScript.src = scriptUrl;
      embedScript.async = true;
      document.body.appendChild(embedScript);
    }

    return () => {
      disposed = true;
      embedScript.removeEventListener("load", markReady);
      embedScript.removeEventListener("error", markError);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  if (!TAVUS_DEPLOYMENT_ID) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm text-center p-6">
        <div>
          <Video className="size-8 mx-auto mb-3 opacity-40" />
          <p className="font-medium mb-1">Realistic AI video companion</p>
          <p className="opacity-60 text-xs">
            Add <code className="opacity-80">NEXT_PUBLIC_TAVUS_DEPLOYMENT_ID</code> to{" "}
            <code className="opacity-80">.env.local</code> to enable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative overflow-hidden rounded-3xl">
      <tavus-embed deployment-id={TAVUS_DEPLOYMENT_ID}></tavus-embed>
      {embedStatus !== "ready" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-6 text-center">
          {embedStatus === "loading" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              <span>Connecting to the AI video companion…</span>
            </div>
          ) : (
            <p role="status" className="text-sm text-muted-foreground">
              The video companion could not load. Please check your connection or try again later.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function PresencePage() {
  const { t } = useLanguage();

  return (
    <main className="flex-1 flex flex-col items-center max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col items-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-center font-display">
          AI video companion
        </h1>
        <p className="mt-2 text-muted-foreground text-center text-sm">
          A realistic presence for a calmer conversation.
        </p>
      </div>

      <p className="mb-4 max-w-sm text-center text-xs text-muted-foreground" role="note">
        Glow is AI—not a human or therapist, and not a substitute for professional or emergency
        care.
      </p>

      <div className="glass rounded-3xl overflow-hidden w-full max-w-sm aspect-[3/4] relative mb-2">
        <TavusPresenter />
      </div>

      <p className="mt-auto pt-6 text-xs text-muted-foreground/60 text-center">
        {t("voice.disclaimer")}
      </p>
    </main>
  );
}
