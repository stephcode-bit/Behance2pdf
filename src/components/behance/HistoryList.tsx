"use client";

import { Clock, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes, prettyUrl, truncateMiddle } from "@/lib/format";

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  size: number | null;
  createdAt: number;
}

interface HistoryListProps {
  items: HistoryItem[];
  onClear: () => void;
  onReconvert?: (url: string) => void;
}

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

export function HistoryList({ items, onClear, onReconvert }: HistoryListProps) {
  if (items.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
      <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <h3 className="font-display text-base font-semibold tracking-tight sm:text-lg">
              Recent conversions
            </h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {items.length}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="size-3.5" />
            Clear
          </Button>
        </div>
        <ul className="scroll-thin -mx-1 max-h-80 space-y-1 overflow-y-auto pr-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={item.title}>
                  {item.title}
                </p>
                <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-muted-foreground">
                  <span className="truncate" title={item.url}>
                    {truncateMiddle(item.url, 60)}
                  </span>
                  <span className="shrink-0">· {formatBytes(item.size)}</span>
                  <span className="shrink-0">· {timeAgo(item.createdAt)}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => onReconvert?.(item.url)}
                  title="Run this conversion again"
                >
                  <RotateCw className="size-3.5" />
                  Convert again
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function HistoryEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-card/50 p-8 text-center">
      <RotateCw className="mx-auto size-5 text-muted-foreground/60" />
      <p className="mt-2 text-sm text-muted-foreground">
        Your past conversions will appear here.
      </p>
    </div>
  );
}

// Re-export prettyUrl so consumers can build history items from URLs.
export { prettyUrl };
