"use client";

import { ClipboardPaste, FileDown, Globe } from "lucide-react";

const STEPS = [
  {
    icon: ClipboardPaste,
    title: "Paste the Behance URL",
    body: "Copy a project link from behance.net/gallery/… and paste it into the box above. No login, no API key, no extension to install.",
  },
  {
    icon: Globe,
    title: "We capture the full page",
    body: "A headless browser opens the project, scrolls through every section to trigger lazy-loaded images, and waits for them to finish rendering.",
  },
  {
    icon: FileDown,
    title: "Download the PDF",
    body: "You get a single A4 PDF of the entire case study — hero, text, and every image at full resolution. Ready to archive or share.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">How it works</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Three steps. About thirty seconds.
        </h2>
        <p className="mt-3 text-base text-muted-foreground">
          Behance projects are beautiful but ephemeral. This tool freezes them as a PDF you actually own.
        </p>
      </div>
      <ol className="mt-12 grid gap-4 sm:gap-6 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="group relative rounded-2xl border border-border/70 bg-card p-6 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <step.icon className="size-5" />
              </span>
              <span className="font-mono text-sm text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">
              {step.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
