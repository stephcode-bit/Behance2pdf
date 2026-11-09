"use client";

import { useCallback, useState } from "react";
import { useSyncExternalStore } from "react";
import { Header } from "@/components/behance/Header";
import { Converter } from "@/components/behance/Converter";
import { HowItWorks } from "@/components/behance/HowItWorks";
import { Faq } from "@/components/behance/Faq";
import { Footer } from "@/components/behance/Footer";
import {
  HistoryList,
  type HistoryItem,
} from "@/components/behance/HistoryList";
import { Image as ImageIcon, ShieldCheck, Zap } from "lucide-react";

const HISTORY_KEY = "behance-to-pdf:history";
const EMPTY: HistoryItem[] = [];

// Module-level cache so the snapshot returned to useSyncExternalStore is a
// stable reference between renders unless the underlying data actually changes.
let cachedRaw: string | null = "__unread__";
let cachedParsed: HistoryItem[] = EMPTY;

function readHistory(): HistoryItem[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (raw === cachedRaw) return cachedParsed;
    cachedRaw = raw;
    if (!raw) {
      cachedParsed = EMPTY;
      return cachedParsed;
    }
    const parsed = JSON.parse(raw) as HistoryItem[];
    cachedParsed = Array.isArray(parsed) ? parsed.slice(0, 20) : EMPTY;
    return cachedParsed;
  } catch {
    cachedParsed = EMPTY;
    return cachedParsed;
  }
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  // `storage` events only fire in *other* tabs. To stay in sync within this
  // same tab we also listen on a custom event dispatched after writes.
  window.addEventListener("behance-history:changed", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("behance-history:changed", callback);
  };
}

function notifyHistoryChanged() {
  if (typeof window === "undefined") return;
  cachedRaw = "__unread__";
  window.dispatchEvent(new Event("behance-history:changed"));
}

export default function Page() {
  const history = useSyncExternalStore(subscribe, readHistory, () => EMPTY);
  const [reconvert, setReconvert] = useState<{ url: string; nonce: number }>({ url: "", nonce: 0 });

  const refresh = useCallback(() => {
    notifyHistoryChanged();
  }, []);

  const clearHistory = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }
    notifyHistoryChanged();
    // Also nudge any other open tabs.
    window.dispatchEvent(new StorageEvent("storage", { key: HISTORY_KEY }));
  }, []);

  const handleReconvert = useCallback((url: string) => {
    setReconvert({ url, nonce: Date.now() });
    // Scroll to the converter so the user sees the conversion start.
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  return (
    <div id="top" className="flex min-h-screen flex-col">
      <Header />

      {/* Hero + Converter */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(244, 63, 94, 0.08) 0%, rgba(244, 63, 94, 0) 60%)",
          }}
        />
        <div className="mx-auto max-w-3xl px-4 pt-16 pb-10 sm:px-6 sm:pt-24 sm:pb-12">
          <div className="animate-fade-in-up text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              Captures the full case study — every image, every section
            </span>

            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
              Turn any Behance project into a{" "}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10 text-primary">polished PDF</span>
                <svg
                  aria-hidden
                  viewBox="0 0 220 14"
                  className="absolute -bottom-1 left-0 z-0 h-3 w-full text-primary/30"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M2 10 Q 110 2 218 9"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Paste a Behance link, get back a high-resolution PDF of the entire
              project — text, hero, and every image at full quality. No sign-up,
              no watermark, no extension.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Zap className="size-3.5 text-primary" />
                ~30 second capture
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ImageIcon className="size-3.5 text-primary" />
                Full-resolution images
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" />
                No data stored
              </span>
            </div>
          </div>

          <div className="animate-fade-in-up mt-10 [animation-delay:120ms]">
            <Converter
              onHistoryChange={refresh}
              reconvertUrl={reconvert.url}
              reconvertNonce={reconvert.nonce}
            />
          </div>

          {history.length > 0 && (
            <div className="animate-fade-in mt-8">
              <HistoryList
                items={history}
                onClear={clearHistory}
                onReconvert={handleReconvert}
              />
            </div>
          )}
        </div>
      </section>

      <HowItWorks />
      <Faq />
      <Footer />
    </div>
  );
}
