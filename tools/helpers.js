/**
 * Shared helpers for the scripts in `tools/`.
 *
 * Path resolution, file reading, the plugin version and terminal colouring were
 * copy-pasted into several generators; they live here instead so there is one
 * definition of each. Deliberately free of third-party imports, so any script
 * can pull in a colour helper without dragging a rendering dependency along
 * with it (see `tools/svg.js` for the svg2img wrapper).
 *
 * @module helpers
 */
import fs from "fs/promises";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import manifest from "../public/manifest.json" with { type: "json" };

/**
 * Absolute path to the repository root. Resolved from this module's own
 * location (`tools/`), so it is the same value no matter which script imports
 * it or what the process working directory happens to be.
 */
export const __rootDir = path.resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Resolve a repository-relative path to an absolute one.
 *
 * @param {string} filename - Path relative to the repository root
 * @returns {string} The absolute path
 */
export const _realpath = (filename) => path.resolve(__rootDir, filename);

/**
 * Get the basename of a file path, for tidier log lines.
 *
 * @param {string} filename - The path to reduce
 * @returns {string} The final path segment
 */
export const _basename = (filename) => path.basename(filename);

/**
 * Read a UTF-8 encoded file.
 *
 * @param {string} filename - Absolute path to the file
 * @returns {Promise<string>} The file's contents
 */
export const _readFile = async (filename) => await fs.readFile(filename, "utf8");

/**
 * The plugin version to stamp on generated artwork, taken from the manifest.
 * Prefers `version_name` (which may carry a `-beta.N` suffix) over the bare
 * `version`, which Chrome restricts to dotted integers.
 *
 * @returns {string} The plugin version, e.g. `"1.3.0"`
 */
export function getPluginVersion() {
  return manifest.version_name || manifest.version;
}

// Using ASCII color codes instead of chalk because these show up in github actions output.
export const _r = (text) => `\x1b[31m${text}\x1b[0m`; // red
export const _g = (text) => `\x1b[32m${text}\x1b[0m`; // green
export const _y = (text) => `\x1b[33m${text}\x1b[0m`; // yellow
export const _b = (text) => `\x1b[34m${text}\x1b[0m`; // blue
export const _m = (text) => `\x1b[35m${text}\x1b[0m`; // magenta
export const _c = (text) => `\x1b[36m${text}\x1b[0m`; // cyan
export const _w = (text) => `\x1b[37m${text}\x1b[0m`; // white
