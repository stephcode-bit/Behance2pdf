"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  Download,
  FileText,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatBytes, prettyUrl, truncateMiddle } from "@/lib/format";
import type { HistoryItem } from "@/components/behance/HistoryList";

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  starting: "Starting browser",
  navigating: "Opening Behance",
  loading: "Loading images",
  scrolling: "Capturing content",
  rendering: "Rendering PDF",
  done: "Done",
  error: "Error",
};

const SAMPLE_URL = "https://www.behance.net/gallery/184490399/Graphic-Design-Trends-2024";

const HISTORY_KEY = "behance-to-pdf:history";

interface StreamEvent {
  stage: keyof typeof STAGE_LABELS;
  message: string;
  percent: number;
  error?: string;
  pdf?: string; // base64
  filename?: string;
  size?: number;
}

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 20)));
  } catch {
    /* quota / privacy mode — ignore */
  }
}

function base64ToBlob(base64: string, mime: string): Blob {
  // Decode in chunks to avoid call-stack limits on very long strings.
  const byteChars = atob(base64);
  const byteArrays: Uint8Array[] = [];
  const sliceSize = 8192;
  for (let offset = 0; offset < byteChars.length; offset += sliceSize) {
    const slice = byteChars.slice(offset, offset + sliceSize);
    const bytes = new Uint8Array(slice.length);
    for (let i = 0; i < slice.length; i++) bytes[i] = slice.charCodeAt(i);
    byteArrays.push(bytes);
  }
  return new Blob(byteArrays as BlobPart[], { type: mime });
}

interface ConverterProps {
  onHistoryChange?: () => void;
  /** When `reconvertNonce` changes, the converter adopts `reconvertUrl` and auto-runs. */
  reconvertUrl?: string;
  reconvertNonce?: number;
}

export function Converter({ onHistoryChange, reconvertUrl, reconvertNonce }: ConverterProps) {
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<StreamEvent["stage"] | null>(null);
  const [percent, setPercent] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    pdfUrl: string;
    filename: string;
    size: number;
    sourceUrl: string;
    title: string;
  } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // When the parent signals a reconvert (URL + nonce), adopt the URL and run.
  useEffect(() => {
    if (reconvertNonce == null || !reconvertUrl) return;
    setUrl(reconvertUrl);
    // Defer the call by one tick so the URL state has propagated.
    const t = setTimeout(() => {
      void handleConvertRef.current?.(reconvertUrl);
    }, 0);
    return () => clearTimeout(t);
  }, [reconvertNonce, reconvertUrl]);

  // Keep a ref to the latest handleConvert so the effect above can call it
  // without re-subscribing every render.
  const handleConvertRef = useRef<((overrideUrl?: string) => void) | null>(null);

  const isBusy = submitting;
  const isDone = !!result;
  const isError = !!error;

  const triggerDownload = useCallback((pdfUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const handleConvert = useCallback(
    async (overrideUrl?: string) => {
      const target = (overrideUrl ?? url).trim();
      if (!target) {
        toast.error("Paste a Behance link first");
        return;
      }
      // Reset state.
      setSubmitting(true);
      setStage("starting");
      setPercent(5);
      setMessage("Launching headless browser…");
      setError(null);
      setResult(null);
      setShowPreview(false);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: target }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          let msg = `Request failed (${res.status})`;
          try {
            const data = (await res.json()) as { error?: string };
            if (data.error) msg = data.error;
          } catch {
            /* ignore */
          }
          setError(msg);
          setStage("error");
          toast.error(msg);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // SSE events are separated by \n\n.
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const rawEvent = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 2);
            if (!rawEvent.startsWith("data:")) continue;
            const json = rawEvent.slice(5).trim();
            let event: StreamEvent;
            try {
              event = JSON.parse(json) as StreamEvent;
            } catch {
              continue;
            }
            if (event.stage === "done" && event.pdf && event.filename) {
              const blob = base64ToBlob(event.pdf, "application/pdf");
              const pdfUrl = URL.createObjectURL(blob);
              const size = event.size ?? blob.size;
              setResult({
                pdfUrl,
                filename: event.filename,
                size,
                sourceUrl: target,
                title: prettyUrl(target),
              });
              setStage("done");
              setPercent(100);
              setMessage("PDF ready!");
              // Add to history.
              const item: HistoryItem = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                url: target,
                title: prettyUrl(target),
                size,
                createdAt: Date.now(),
              };
              const next = [item, ...loadHistory().filter((h) => h.url !== target)].slice(0, 20);
              saveHistory(next);
              onHistoryChange?.();
              // Auto-trigger the download.
              triggerDownload(pdfUrl, event.filename);
              toast.success("PDF ready — downloading now");
            } else if (event.stage === "error") {
              setError(event.error || event.message || "Conversion failed");
              setStage("error");
              toast.error(event.error || event.message || "Conversion failed");
            } else {
              setStage(event.stage);
              setPercent(event.percent);
              setMessage(event.message);
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Network error. Please try again.";
        setError(msg);
        setStage("error");
        toast.error(msg);
      } finally {
        setSubmitting(false);
        abortRef.current = null;
      }
    },
    [url, onHistoryChange, triggerDownload],
  );

  // Keep the ref in sync so the reconvert effect can call the latest closure.
  handleConvertRef.current = handleConvert;

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        toast.success("Pasted from clipboard");
      } else {
        toast.error("Clipboard is empty");
      }
    } catch {
      toast.error("Clipboard access was blocked by the browser");
    }
  }, []);

  const handleReset = useCallback(() => {
    if (result) URL.revokeObjectURL(result.pdfUrl);
    setResult(null);
    setShowPreview(false);
    setStage(null);
    setPercent(0);
    setMessage("");
    setError(null);
  }, [result]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setSubmitting(false);
    setStage(null);
    setPercent(0);
    setMessage("");
    toast.info("Conversion cancelled");
  }, []);

  const handleTrySample = useCallback(() => {
    setUrl(SAMPLE_URL);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isBusy) {
      e.preventDefault();
      void handleConvert();
    }
  };

  // Clean up object URLs when the component unmounts.
  useEffect(() => {
    return () => {
      if (result) URL.revokeObjectURL(result.pdfUrl);
    };
  }, [result]);

  return (
    <Card className="relative overflow-hidden rounded-3xl border-border/70 bg-card p-6 shadow-lg shadow-primary/5 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full bg-primary/5 blur-3xl"
      />

      <div className="relative space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Paste a Behance project URL
          </h2>
          <Badge variant="secondary" className="rounded-full">
            <Sparkles className="mr-1 size-3.5" />
            Free · no sign-up
          </Badge>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Input
              type="url"
              inputMode="url"
              placeholder="https://www.behance.net/gallery/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={isBusy}
              className="h-12 rounded-xl border-border bg-background pr-12 text-base shadow-sm focus-visible:ring-primary/50"
              aria-label="Behance project URL"
            />
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              disabled={isBusy}
              aria-label="Paste from clipboard"
              className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <ClipboardPaste className="size-4" />
            </button>
          </div>
          <Button
            type="button"
            onClick={() => void handleConvert()}
            disabled={isBusy || !url.trim()}
            className="h-12 rounded-xl px-6 text-base font-semibold shadow-sm transition-all hover:shadow-md disabled:opacity-60"
          >
            {isBusy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Converting…
              </>
            ) : (
              <>
                <FileText className="size-4" />
                Convert to PDF
              </>
            )}
          </Button>
        </div>

        {!isBusy && !isDone && !isError && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Tip:</span>
            <button
              type="button"
              onClick={handleTrySample}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Try a sample project
            </button>
            <span className="text-border">·</span>
            <span>
              Best with project pages:{" "}
              <code className="font-mono">/gallery/&lt;id&gt;/&lt;slug&gt;</code>
            </span>
          </div>
        )}

        {/* Live progress */}
        {isBusy && stage && (
          <div className="rounded-xl border border-border bg-background/60 p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span className="font-medium">{STAGE_LABELS[stage] ?? "Working"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="tabular-nums text-muted-foreground">{percent}%</span>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-md px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
            <Progress value={percent} className="h-2 overflow-hidden" />
            <p className="mt-2 truncate text-xs text-muted-foreground" title={message}>
              {message || "Hold tight — loading the page and its images."}
            </p>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="animate-fade-in rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-destructive">Conversion failed</p>
                <p className="text-muted-foreground">{error}</p>
                <p className="pt-1 text-xs text-muted-foreground">
                  Make sure the link is a public Behance project page. Some pages may require login.
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={handleReset}>
                Try another link
              </Button>
            </div>
          </div>
        )}

        {/* Result */}
        {isDone && result && (
          <div className="animate-fade-in-up space-y-4">
            <div className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <CheckCircle2 className="size-5" />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="font-medium leading-tight text-foreground">{result.title}</p>
                  <p className="truncate text-xs text-muted-foreground" title={result.sourceUrl}>
                    {truncateMiddle(result.sourceUrl, 70)} · {formatBytes(result.size)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => triggerDownload(result.pdfUrl, result.filename)}
                  className="h-10 rounded-xl px-5 font-semibold shadow-sm"
                >
                  <Download className="size-4" />
                  Download PDF
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPreview((v) => !v)}
                  className="h-10 rounded-xl"
                >
                  {showPreview ? (
                    <>
                      <X className="size-4" />
                      Hide preview
                    </>
                  ) : (
                    <>
                      <FileText className="size-4" />
                      Preview
                    </>
                  )}
                </Button>
                <Button type="button" variant="ghost" onClick={handleReset} className="h-10 rounded-xl">
                  New conversion
                </Button>
              </div>
            </div>

            {showPreview && (
              <div className="animate-fade-in overflow-hidden rounded-2xl border border-border bg-muted/40">
                <object
                  data={`${result.pdfUrl}#toolbar=1&view=FitH`}
                  type="application/pdf"
                  className="h-[70vh] w-full"
                  aria-label="PDF preview"
                >
                  <div className="grid h-full min-h-[300px] place-items-center p-8 text-center text-sm text-muted-foreground">
                    Your browser cannot display PDFs inline.
                    <button
                      type="button"
                      onClick={() => triggerDownload(result.pdfUrl, result.filename)}
                      className="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      <Download className="size-4" /> Download it instead
                    </button>
                  </div>
                </object>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
