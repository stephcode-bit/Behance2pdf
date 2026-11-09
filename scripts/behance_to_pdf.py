#!/usr/bin/env python3
"""
Behance URL -> PDF converter using Playwright.

Usage:
    python3 behance_to_pdf.py <url> <output_pdf> <progress_file>

Behavior:
  - Launches headless Chromium.
  - Navigates to the Behance URL with a realistic desktop user agent.
  - Waits for the project hero / main image to appear.
  - Auto-scrolls the page in steps to trigger lazy-loaded images.
  - Waits for all <img> elements to finish loading (network-idle).
  - Hides cookie banners / sign-in walls / fixed headers for a cleaner PDF.
  - Renders the full page to a multi-page A4 PDF.

Progress is written as JSON lines to <progress_file> so the Node API can
stream status updates back to the browser.
"""

import sys
import os
import json
import time
import traceback
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
except ImportError:
    print("Playwright is not installed in this Python environment.", file=sys.stderr)
    sys.exit(2)


def write_progress(progress_file: str, stage: str, message: str, percent: int):
    """Append a JSON progress line to the progress file."""
    try:
        with open(progress_file, "a", encoding="utf-8") as f:
            f.write(json.dumps({
                "stage": stage,
                "message": message,
                "percent": percent,
                "ts": time.time(),
            }) + "\n")
            f.flush()
    except Exception:
        # Progress writing must never crash the converter.
        pass


def hide_clutter(page):
    """Hide cookie banners, sticky headers, sign-in prompts, etc."""
    selectors_to_hide = [
        'div[class*="cookie" i]',
        'div[id*="cookie" i]',
        'div[class*="Cookie" i]',
        'div[class*="cc-" i]',
        '#onetrust-banner-sdk',
        '#onetrust-consent-sdk',
        'div[class*="SignupWall" i]',
        'div[class*="signup-wall" i]',
        'div[class*="login-wall" i]',
        'div[class*="LoginWall" i]',
        'div[class*="GlobalNav" i]',
        'div[class*="global-nav" i]',
        'div[class*="site-header" i]',
        'header[class*="fixed" i]',
        'div[class*="upsell" i]',
        'div[class*="Upsell" i]',
        'div[class*="Banner" i][class*="cookie" i]',
        'div[role="dialog"][aria-label*="cookie" i]',
    ]
    css = ""
    for sel in selectors_to_hide:
        css += f'{sel} {{ display: none !important; }}\n'
    try:
        page.add_style_tag(content=css)
    except Exception:
        pass


def scroll_page(page, progress_file: str):
    """Scroll through the page in steps so lazy images load."""
    try:
        total_height = page.evaluate("() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)")
    except Exception:
        total_height = 3000

    step = 600
    pos = 0
    seen = 0
    last_change = time.time()
    while pos < total_height:
        try:
            page.evaluate(f"window.scrollTo(0, {pos});")
        except Exception:
            pass
        time.sleep(0.45)
        try:
            new_total = page.evaluate("() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)")
        except Exception:
            new_total = total_height
        if new_total > total_height:
            total_height = new_total
            last_change = time.time()
        pos += step
        seen += 1
        # Stop if the page hasn't grown in 4 seconds AND we've scrolled past the end.
        if time.time() - last_change > 4 and pos >= total_height:
            break
        # Safety cap so we don't loop forever on infinite-scroll trickery.
        if seen > 60:
            break
        pct = min(95, int(40 + (pos / max(total_height, 1)) * 40))
        write_progress(progress_file, "scrolling", f"Loading project content ({pct}%)", pct)
    # Scroll back to top so the PDF starts from the beginning.
    try:
        page.evaluate("window.scrollTo(0, 0);")
    except Exception:
        pass


def wait_for_images(page, progress_file: str):
    """Wait until every <img> on the page has a non-empty natural width."""
    try:
        page.wait_for_function(
            """() => {
                const imgs = Array.from(document.images);
                if (imgs.length === 0) return true;
                return imgs.every(img => img.complete && img.naturalWidth > 0);
            }""",
            timeout=20000,
        )
    except Exception:
        # Don't fail if some images never finish; we already gave them a chance.
        pass
    write_progress(progress_file, "rendering", "Rendering PDF...", 90)


def convert(url: str, output_pdf: str, progress_file: str):
    write_progress(progress_file, "starting", "Launching headless browser...", 5)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--font-render-hinting=none",
            ],
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 1800},
            device_scale_factor=1,
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/126.0.0.0 Safari/537.36"
            ),
            locale="en-US",
            timezone_id="America/Los_Angeles",
        )
        # Block heavy ads / trackers so the page loads faster.
        context.route("**/*", lambda route: route.continue_() if route.request.resource_type in (
            "document", "stylesheet", "image", "font", "script", "xhr", "fetch"
        ) else route.abort())

        page = context.new_page()

        write_progress(progress_file, "navigating", "Opening Behance page...", 15)
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
        except PWTimeout:
            write_progress(progress_file, "navigating", "Page was slow; continuing anyway...", 20)
        except Exception as e:
            write_progress(progress_file, "error", f"Could not open page: {e}", 0)
            browser.close()
            return False

        # Give React/Vue a moment to mount.
        time.sleep(1.5)
        hide_clutter(page)

        # Try to wait for some known Behance content markers (any one is fine).
        content_selectors = [
            'div[class*="project-content" i]',
            'div[class*="ProjectPage" i]',
            'img[src*="mir-im"]',  # Behance CDN image
            'img[srcset*="mir-im"]',
            'div[class*="ImageImage" i]',
            'img',
        ]
        for sel in content_selectors:
            try:
                page.wait_for_selector(sel, timeout=12000)
                break
            except Exception:
                continue

        write_progress(progress_file, "loading", "Loading images...", 30)
        scroll_page(page, progress_file)
        wait_for_images(page, progress_file)

        # Final pass: hide clutter again after dynamic content has loaded.
        hide_clutter(page)

        # Generate the PDF.
        Path(output_pdf).parent.mkdir(parents=True, exist_ok=True)
        try:
            page.pdf(
                path=output_pdf,
                format="A4",
                print_background=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
                prefer_css_page_size=False,
            )
        except Exception as e:
            write_progress(progress_file, "error", f"PDF generation failed: {e}", 0)
            browser.close()
            return False

        write_progress(progress_file, "done", "PDF ready!", 100)
        browser.close()
        return True


def main():
    if len(sys.argv) < 4:
        print("Usage: behance_to_pdf.py <url> <output_pdf> <progress_file>", file=sys.stderr)
        sys.exit(2)
    url, output_pdf, progress_file = sys.argv[1], sys.argv[2], sys.argv[3]
    # Reset progress file.
    try:
        os.remove(progress_file)
    except OSError:
        pass
    try:
        ok = convert(url, output_pdf, progress_file)
        sys.exit(0 if ok else 1)
    except Exception as e:
        write_progress(progress_file, "error", f"Unexpected error: {e}", 0)
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
