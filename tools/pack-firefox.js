/**
 * Packs the Firefox extension build directory into an unsigned zip.
 *
 * Usage: node tools/pack-firefox.js
 *
 * A plain zip of the build directory is a valid unsigned Firefox add-on: it
 * can be loaded via about:debugging → "Load Temporary Add-on". Unlike Chrome's
 * .crx, no signing key is involved (AMO signing is out of scope for now).
 *
 * Reads the app name from package.json "name" to derive the file name.
 *
 * Requires:
 *   - ./build-firefox/      (run `pnpm build:firefox` first)
 *
 * Outputs:
 *   - ./<app-name>-firefox.zip
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
const appName = pkg.name;

const BUILD_DIR = resolve(ROOT, "build-firefox");
const OUTPUT_ZIP = resolve(ROOT, `${appName}-firefox.zip`);

if (!existsSync(BUILD_DIR)) {
  console.error("❌ build-firefox/ directory not found. Run `pnpm build:firefox` first.");
  process.exit(1);
}

// Remove any stale archive so `zip` doesn't append to it.
rmSync(OUTPUT_ZIP, { force: true });

console.log(`📁 Source: ${BUILD_DIR}`);
console.log(`📦 Packing...`);

try {
  // Zip from inside the build dir so the manifest sits at the archive root,
  // which Firefox requires.
  execFileSync("zip", ["-r", "-q", OUTPUT_ZIP, "."], { cwd: BUILD_DIR });
  console.log(`✅ Packed: ${OUTPUT_ZIP}`);
} catch (err) {
  console.error("❌ Firefox pack failed:", err.message);
  process.exit(1);
}
