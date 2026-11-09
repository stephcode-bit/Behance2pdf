# Behance → PDF

Paste a Behance project URL, get back a high-resolution PDF of the entire case
study — text, hero, and every image at full quality. No sign-up, no watermark,
no browser extension.

## Tech stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS 4 + shadcn/ui (custom warm cream + coral palette)
- **Converter:** `playwright-core` + `@sparticuz/chromium` (Lambda/Vercel-friendly Chromium binary)
- **Delivery:** Server-Sent Events stream the live progress, then a base64 PDF.

## How it works

1. The user pastes a Behance URL and clicks **Convert to PDF**.
2. `POST /api/convert` opens a `text/event-stream` response.
3. The server launches `@sparticuz/chromium` via `playwright-core`, navigates to
   the URL, scrolls through the page to trigger lazy-loaded images, waits for
   every `<img>` to finish loading, hides cookie / sign-in walls, and renders
   the page to an A4 PDF with `print_background: true`.
4. Progress events (`starting` → `navigating` → `loading` → `scrolling` →
   `rendering` → `done`) are streamed to the browser as JSON SSE events so the
   UI shows a live progress bar.
5. The final `done` event includes the PDF as base64. The frontend decodes it
   into a `Blob`, creates an object URL, and triggers a download.
6. Each successful conversion is added to a `localStorage` history list with a
   **Convert again** button.

## Local development

```bash
bun install
bun run dev
```

Open http://localhost:3000.

`@sparticuz/chromium` ships its own prebuilt Chromium binary, so no separate
`playwright install` step is needed.

## Deploy on Vercel

This project is structured for Vercel serverless functions. The
`@sparticuz/chromium` package is purpose-built for AWS Lambda / Vercel
serverless — it's a stripped-down Chromium that fits in the 250 MB
uncompressed function size limit.

### One-click deploy

1. Push this project to a GitHub repo.
2. In Vercel, **Add New → Project → Import** your repo.
3. Vercel auto-detects Next.js. Defaults are fine.
4. Click **Deploy**.

### Manual deploy

```bash
npm i -g vercel
vercel        # follow the prompts
vercel --prod # deploy to production
```

### Plan limits — read this!

The `/api/convert` route has `export const maxDuration = 300;` in
`src/app/api/convert/route.ts`. Vercel caps this at runtime based on your plan:

| Plan     | Max duration | Realistic for Behance?                  |
| -------- | -----------: | --------------------------------------- |
| Hobby    |         10 s | Only very small text-only projects      |
| Pro      |         60 s | Most projects (1–10 images)             |
| Enterprise |      300 s | Image-heavy case studies (20+ MB PDFs)   |

If you're on Hobby and want to convert larger projects, either upgrade to Pro,
or self-host on Railway / Render / Fly.io where there's no fixed timeout.

### Required build env vars

These are set in `vercel.json` under `buildEnv` so you don't have to configure
them in the Vercel dashboard:

- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` — prevents `playwright-core`'s postinstall
  hook from downloading the full Chromium build (we use `@sparticuz/chromium`'s
  Lambda binary instead, which keeps the function under the 250 MB limit).
- `PLAYWRIGHT_SKIP_BROWSER_GC=1`
- `PLAYWRIGHT_BROWSERS_PATH=0`

### Memory

The route needs more than the default 1024 MB for image-heavy PDFs. Bump it in
**Vercel dashboard → Project → Settings → Functions → Memory** to **2048 MB**
(or 3008 MB on Pro). This is a project-wide setting; the API itself doesn't
need any extra config.

## File structure

```
.
├── vercel.json                       # build env, headers
├── next.config.ts
├── package.json
├── prisma/                           # (unused; scaffold leftover)
├── public/
├── scripts/
│   └── behance_to_pdf.py             # standalone Python version (optional, not used by the app)
└── src/
    ├── app/
    │   ├── api/
    │   │   └── convert/route.ts      # POST → SSE stream of progress + base64 PDF
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx                  # landing page composition
    ├── components/
    │   ├── behance/
    │   │   ├── Converter.tsx         # URL input + live progress + result
    │   │   ├── Header.tsx
    │   │   ├── HistoryList.tsx       # localStorage history with Convert again
    │   │   ├── HowItWorks.tsx
    │   │   ├── Faq.tsx
    │   │   └── Footer.tsx
    │   └── ui/                       # shadcn/ui primitives
    ├── hooks/
    └── lib/
        ├── behance-converter.ts      # Node port of the Python script
        ├── format.ts                 # byte / URL / time formatters
        └── utils.ts
```

## Self-hosting (alternative to Vercel)

The same code also runs on any Node host that supports long-running requests
(Railway, Render, Fly.io, a VPS, Docker). On those platforms you can also use
the bundled `scripts/behance_to_pdf.py` if you prefer the Python implementation
— just replace the body of `convertBehanceToPdf` in `src/lib/behance-converter.ts`
with a `child_process.spawn("python3", [...])` call to the script.

## Notes & caveats

- Pages that Behance hides behind a login wall (rare for public projects) will
  not be captured. The converter visits the page as a logged-out visitor.
- Very long projects with hundreds of high-res images can produce PDFs of 20 MB+.
  Those take 30–60 seconds to capture — too long for Vercel Hobby.
- PDFs are not persisted on the server. The only history kept is the URL +
  timestamp in your own browser's `localStorage`.
- Not affiliated with Behance or Adobe.
