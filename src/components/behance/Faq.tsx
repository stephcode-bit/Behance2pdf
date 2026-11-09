"use client";

import { ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: "What kind of Behance links work?",
    a: (
      <>
        Any public project page on{" "}
        <code className="font-mono text-xs">behance.net/gallery/&lt;id&gt;/&lt;slug&gt;</code>{" "}
        works best. Portfolio pages, user profiles, and search results will also
        convert, but project pages give the cleanest PDF.
      </>
    ),
  },
  {
    q: "Will the PDF include all the images?",
    a: (
      <>
        Yes. The converter scrolls through the entire page to trigger
        Behance&apos;s lazy-loaded images, waits for each one to finish loading,
        and only then renders the PDF — so every image is captured at full
        resolution.
      </>
    ),
  },
  {
    q: "Do I need a Behance account?",
    a: "No. The tool visits the page as a logged-out visitor. Pages that Behance hides behind a login wall (rare for public projects) won't be captured."
  },
  {
    q: "Is there a file size or page limit?",
    a: "There's no hard limit, but very long projects with hundreds of high-resolution images can produce PDFs of 20 MB or more. Those take 30–60 seconds to capture."
  },
  {
    q: "Are the PDFs stored anywhere?",
    a: "No. PDFs live in a temporary folder on the server and are removed automatically when the sandbox restarts. Your history is stored only in your own browser via localStorage."
  },
  {
    q: "Can I convert my own Behance portfolio?",
    a: "Yes — paste the URL of any of your own project pages. This is a great way to keep an offline backup of your case studies."
  }
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-24">
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">FAQ</p>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Questions, answered.
        </h2>
      </div>
      <Accordion type="single" collapsible className="mt-10 space-y-3">
        {FAQS.map((faq, i) => (
          <AccordionItem
            key={faq.q}
            value={`item-${i}`}
            className="rounded-2xl border border-border/70 bg-card px-5 shadow-sm data-[state=open]:border-primary/30"
          >
            <AccordionTrigger className="text-left text-base font-medium hover:no-underline">
              <span className="flex-1">{faq.q}</span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              {faq.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
