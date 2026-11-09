import chromium from "@sparticuz/chromium";
import type { Browser, Page } from "playwright-core";

/**
 * Node.js port of scripts/behance_to_pdf.py.
 *
 * Uses @sparticuz/chromium (Lambda/Vercel-optimized Chromium binary) instead
 * of a system Chromium install so the same code runs in:
 *   - local dev (Linux x64_64 sandbox)
 *   - Vercel serverless functions
 *   - AWS Lambda
 *
 * Conversion progress is reported through a caller-supplied callback so the
 * API route can stream it to the browser as Server-Sent Events.
 */

export interface ProgressEvent {
  stage: ProgressStage;
  message: string;
  percent: number;
}

export type ProgressStage =
  | "starting"
  | "navigating"
  | "loading"
  | "scrolling"
  | "rendering"
  | "done"
  | "error";

export interface ConvertResult {
  pdf: Buffer;
  filename: string;
  size: number;
}

export interface ConvertOptions {
  url: string;
  onProgress?: (event: ProgressEvent) => void;
}

const CONTENT_SELECTORS = [
  'div[class*="project-content" i]',
  'div[class*="ProjectPage" i]',
  'img[src*="mir-im"]',
  'img[srcset*="mir-im"]',
  'div[class*="ImageImage" i]',
  "img",
];

const HIDE_CSS = `
div[class*="cookie" i], div[id*="cookie" i], div[class*="Cookie" i],
div[class*="cc-" i], #onetrust-banner-sdk, #onetrust-consent-sdk,
div[class*="SignupWall" i], div[class*="signup-wall" i],
div[class*="login-wall" i], div[class*="LoginWall" i],
div[class*="GlobalNav" i], div[class*="global-nav" i],
div[class*="site-header" i], header[class*="fixed" i],
div[class*="upsell" i], div[class*="Upsell" i],
div[class*="Banner" i][class*="cookie" i],
div[role="dialog"][aria-label*="cookie" i]
{ display: none !important; }
`;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function emit(onProgress: ConvertOptions["onProgress"], event: ProgressEvent) {
  try {
    onProgress?.(event);
  } catch {
    /* never let progress reporting crash the converter */
  }
}

async function hideClutter(page: Page) {
  try {
    await page.addStyleTag({ content: HIDE_CSS });
  } catch {
    /* ignore */
  }
}

async function scrollPage(page: Page, onProgress: ConvertOptions["onProgress"]) {
  let totalHeight = 3000;
  try {
    totalHeight = await page.evaluate(
      "() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)",
    );
  } catch {
    /* keep default */
  }

  const step = 600;
  let pos = 0;
  let seen = 0;
  let lastChange = Date.now();

  while (pos < totalHeight) {
    try {
      await page.evaluate((y) => window.scrollTo(0, y), pos);
    } catch {
      /* ignore */
    }
    await sleep(450);
    try {
      const newTotal = await page.evaluate(
        "() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)",
      );
      if (newTotal > totalHeight) {
        totalHeight = newTotal;
        lastChange = Date.now();
      }
    } catch {
      /* ignore */
    }
    pos += step;
    seen += 1;
    if (Date.now() - lastChange > 4000 && pos >= totalHeight) break;
    if (seen > 60) break;
    const pct = Math.min(95, Math.round(40 + (pos / Math.max(totalHeight, 1)) * 40));
    emit(onProgress, {
      stage: "scrolling",
      message: `Loading project content (${pct}%)`,
      percent: pct,
    });
  }
  try {
    await page.evaluate(() => window.scrollTo(0, 0));
  } catch {
    /* ignore */
  }
}

async function waitForImages(page: Page, onProgress: ConvertOptions["onProgress"]) {
  try {
    await page.waitForFunction(
      `() => {
        const imgs = Array.from(document.images);
        if (imgs.length === 0) return true;
        return imgs.every(img => img.complete && img.naturalWidth > 0);
      }`,
      { timeout: 20000 },
    );
  } catch {
    /* don't fail if some images never finish */
  }
  emit(onProgress, { stage: "rendering", message: "Rendering PDF…", percent: 90 });
}

function filenameFromUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length >= 3 && parts[1] === "gallery") {
      const slug = parts[2];
      return `behance-${slug}.pdf`;
    }
    if (parts.length) {
      return `behance-${parts.join("-")}.pdf`;
    }
    return "behance.pdf";
  } catch {
    return "behance.pdf";
  }
}

async function launchBrowser(): Promise<Browser> {
  // @sparticuz/chromium gives us a Lambda-friendly Chromium binary and the
  // recommended args. On non-AWS Linux (our preview), the same binary still
  // runs, we just add --no-sandbox because we're root in the sandbox.
  const executablePath = await chromium.executablePath();
  const args = [
    ...chromium.args,
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--font-render-hinting=none",
  ];
  // Dynamically import playwright-core so the package doesn't get pulled into
  // any client bundle.
  const { chromium: pwChromium } = await import("playwright-core");
  return pwChromium.launch({
    headless: true,
    executablePath,
    args,
  });
}

export async function convertBehanceToPdf({
  url,
  onProgress,
}: ConvertOptions): Promise<ConvertResult> {
  emit(onProgress, { stage: "starting", message: "Launching headless browser…", percent: 5 });

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1800 },
      deviceScaleFactor: 1,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/126.0.0.0 Safari/537.36",
      locale: "en-US",
      timezoneId: "America/Los_Angeles",
    });

    // Block heavy ad / media / beacon traffic to speed up the page.
    await context.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["document", "stylesheet", "image", "font", "script", "xhr", "fetch"].includes(type)) {
        route.continue().catch(() => undefined);
      } else {
        route.abort().catch(() => undefined);
      }
    });

    const page = await context.newPage();

    emit(onProgress, { stage: "navigating", message: "Opening Behance page…", percent: 15 });
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    } catch (err) {
      // Page was slow or timed out — try to continue anyway.
      emit(onProgress, {
        stage: "navigating",
        message: "Page was slow; continuing anyway…",
        percent: 20,
      });
      void err;
    }

    await sleep(1500);
    await hideClutter(page);

    // Wait for any of the known Behance content markers.
    for (const sel of CONTENT_SELECTORS) {
      try {
        await page.waitForSelector(sel, { timeout: 12000 });
        break;
      } catch {
        /* try the next one */
      }
    }

    emit(onProgress, { stage: "loading", message: "Loading images…", percent: 30 });
    await scrollPage(page, onProgress);
    await waitForImages(page, onProgress);
    await hideClutter(page);

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: false,
    });

    const filename = filenameFromUrl(url);
    emit(onProgress, { stage: "done", message: "PDF ready!", percent: 100 });

    return { pdf, filename, size: pdf.length };
  } finally {
    try {
      await browser.close();
    } catch {
      /* ignore */
    }
  }
}
