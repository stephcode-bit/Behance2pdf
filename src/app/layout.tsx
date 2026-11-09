import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const sans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["variable"] as unknown as string[],
});

export const metadata: Metadata = {
  title: "Behance to PDF — Capture any project as a polished PDF",
  description:
    "Paste a Behance project URL and get an instant, high-resolution PDF of the full case study. Free, no sign-up, no watermark.",
  keywords: ["Behance", "PDF", "converter", "case study", "design", "portfolio"],
  authors: [{ name: "Behance to PDF" }],
  // Icons are auto-detected by Next.js from these files in src/app/:
  //   icon.svg          → vector favicon (modern browsers)
  //   favicon.ico       → 32×32 raster fallback (legacy browsers, /favicon.ico)
  //   apple-icon.png    → 180×180 PNG for iOS / Safari apple-touch-icon
  openGraph: {
    title: "Behance to PDF",
    description: "Capture any Behance project as a polished PDF in seconds.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Behance to PDF",
    description: "Capture any Behance project as a polished PDF in seconds.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sans.variable} ${display.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
