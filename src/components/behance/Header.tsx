"use client";

import { FileText } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#top" className="group flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            <FileText className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            Behance<span className="text-primary">→</span>PDF
          </span>
        </a>
        <nav className="flex items-center gap-1 text-sm">
          <a
            href="#how-it-works"
            className="hidden rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
          >
            How it works
          </a>
          <a
            href="#faq"
            className="hidden rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
          >
            FAQ
          </a>
          <a
            href="https://www.behance.net/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-foreground transition-colors hover:bg-accent"
          >
            Browse Behance
          </a>
        </nav>
      </div>
    </header>
  );
}
