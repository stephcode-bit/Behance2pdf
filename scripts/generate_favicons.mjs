/**
 * Generate favicon assets from src/app/icon.svg.
 *
 * Uses Next.js 16 file-based convention: any `icon.*`, `apple-icon.*`, or
 * `favicon.ico` file in `src/app/` is auto-detected and the correct
 * `<link>` tags are generated at build time — no manual metadata.icons
 * entries needed.
 *
 * Outputs:
 *   - src/app/favicon.ico    (32×32 PNG, served at /favicon.ico for legacy browsers)
 *   - src/app/apple-icon.png (180×180 PNG for iOS home screen / Safari)
 *
 * Run with: `node scripts/generate_favicons.mjs`
 */
import { readFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SVG_PATH = join(ROOT, "src", "app", "icon.svg");

async function main() {
  const svg = await readFile(SVG_PATH);
  const appDir = join(ROOT, "src", "app");
  await mkdir(appDir, { recursive: true });

  // 180×180 PNG for iOS / Safari apple-touch-icon.
  await sharp(svg, { density: 384 })
    .resize(180, 180, { fit: "cover", position: "center" })
    .flatten({ background: "#E11D48" })
    .png()
    .toFile(join(appDir, "apple-icon.png"));
  console.log("Wrote src/app/apple-icon.png (180×180)");

  // 32×32 PNG written as favicon.ico. Modern browsers happily serve a PNG
  // when it's named .ico, and Next.js's favicon.ico convention expects a
  // raster file at this path.
  await sharp(svg, { density: 256 })
    .resize(32, 32, { fit: "cover", position: "center" })
    .flatten({ background: "#E11D48" })
    .png()
    .toFile(join(appDir, "favicon.ico"));
  console.log("Wrote src/app/favicon.ico (32×32 PNG)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
