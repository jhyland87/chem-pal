/**
 * Packs the Chrome extension build directory into a .crx file.
 *
 * Usage: node tools/pack-extension.js
 *
 * Requires:
 *   - ./build/          (run `pnpm build` first)
 *   - ./ChemPal.pem     (private key for signing)
 *
 * Outputs:
 *   - ./Chem-Pal.crx
 *
 * Works on macOS, Linux, and Windows.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const BUILD_DIR = resolve(ROOT, "build");
const PEM_FILE = resolve(ROOT, "ChemPal.pem");
const OUTPUT_CRX = resolve(ROOT, "ChemPal.crx");

// Preflight checks
if (!existsSync(BUILD_DIR)) {
  console.error("❌ build/ directory not found. Run `pnpm build` first.");
  process.exit(1);
}

if (!existsSync(PEM_FILE)) {
  console.error("❌ ChemPal.pem not found in project root.");
  process.exit(1);
}

// Find Chrome/Chromium binary (cross-platform)
function findChrome() {
  const candidates =
    process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
      : process.platform === "win32"
        ? [
            `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
            `${process.env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`,
            `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/snap/bin/chromium",
          ];

  for (const path of candidates) {
    if (path && existsSync(path)) return path;
  }
  return null;
}

const chrome = findChrome();

if (!chrome) {
  console.error("❌ Could not find Chrome/Chromium. Install Chrome or set it on your PATH.");
  process.exit(1);
}

console.log(`🔑 Key:    ${PEM_FILE}`);
console.log(`📁 Source: ${BUILD_DIR}`);
console.log(`🌐 Chrome: ${chrome}`);
console.log(`📦 Packing...`);

try {
  execFileSync(chrome, [
    `--pack-extension=${BUILD_DIR}`,
    `--pack-extension-key=${PEM_FILE}`,
    "--no-message-box",
  ]);

  // Chrome outputs build.crx next to the build/ directory
  const generatedCrx = resolve(ROOT, "build.crx");

  if (existsSync(generatedCrx)) {
    const { renameSync } = await import("node:fs");
    renameSync(generatedCrx, OUTPUT_CRX);
    console.log(`✅ Packed: ${OUTPUT_CRX}`);
  } else if (existsSync(OUTPUT_CRX)) {
    console.log(`✅ Packed: ${OUTPUT_CRX}`);
  } else {
    console.error("❌ Expected .crx file was not generated.");
    process.exit(1);
  }
} catch (err) {
  console.error("❌ Chrome pack failed:", err.message);
  process.exit(1);
}
