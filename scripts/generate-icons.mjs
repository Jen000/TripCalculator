// Generate PWA + Apple touch icons from an inline SVG source.
// Run: npm run icons

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public");

// Primary brand green from src/theme.ts (light mode primary).
const BG = "#1F7A63";
const FG = "#FFFFFF";

// 512x512 icon: solid brand green square with a centered white map pin.
// The pin sits comfortably inside the area iOS preserves when it rounds
// corners (roughly the inner 78% of the square).
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <path d="
    M256 88
    C 326 88 384 146 384 216
    C 384 296 312 376 268 424
    C 261 432 251 432 244 424
    C 200 376 128 296 128 216
    C 128 146 186 88 256 88 Z"
    fill="${FG}"/>
  <circle cx="256" cy="216" r="50" fill="${BG}"/>
</svg>`;

const targets = [
  // Apple touch icons — iOS expects solid (no transparency).
  { file: "apple-touch-icon.png", size: 180 },
  { file: "apple-touch-icon-152x152.png", size: 152 },
  { file: "apple-touch-icon-167x167.png", size: 167 },
  // PWA / Android.
  { file: "icon-192x192.png", size: 192 },
  { file: "icon-512x512.png", size: 512 },
  // Browser tab.
  { file: "favicon-32x32.png", size: 32 },
  { file: "favicon-16x16.png", size: 16 },
];

await mkdir(OUT_DIR, { recursive: true });

const svgBuffer = Buffer.from(SVG);

for (const { file, size } of targets) {
  const out = join(OUT_DIR, file);
  await sharp(svgBuffer)
    .resize(size, size, { fit: "contain", background: BG })
    .flatten({ background: BG }) // ensure no transparency (iOS requirement)
    .png()
    .toFile(out);
  console.log(`  ✓ ${file} (${size}x${size})`);
}

// Bundle 16/32/48 into a multi-resolution favicon.ico.
const icoSizes = [16, 32, 48];
const icoBuffers = await Promise.all(
  icoSizes.map((size) =>
    sharp(svgBuffer)
      .resize(size, size)
      .flatten({ background: BG })
      .png()
      .toBuffer()
  )
);
const ico = await pngToIco(icoBuffers);
await writeFile(join(OUT_DIR, "favicon.ico"), ico);
console.log(`  ✓ favicon.ico (multi-res: ${icoSizes.join("/")})`);

console.log("\nDone. Output in public/.");
