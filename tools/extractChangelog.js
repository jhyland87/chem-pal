/**
 * Extracts a single version's section out of `CHANGELOG.md`, so the release
 * workflow can publish hand-written notes instead of GitHub's auto-generated
 * ones. `--generate-notes` derives its content from merged pull requests, which
 * yields nothing but a compare link for releases whose commits landed directly
 * on the default branch.
 *
 * Usable as a module (for tests) or as a CLI:
 *
 * ```sh
 * node tools/extractChangelog.js 1.3.0            # prints the section to stdout
 * node tools/extractChangelog.js v1.3.0 notes.md  # writes it to notes.md
 * ```
 *
 * Exits non-zero when the version has no section, letting the caller fall back
 * to `--generate-notes` rather than failing the release.
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CHANGELOG = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "CHANGELOG.md",
);

/**
 * Strips a leading `v` and any build metadata so `v1.3.0` and `1.3.0` match the
 * same heading.
 * @param version - A version or tag string.
 * @returns The bare version number.
 * @example
 * normalizeVersion("v1.3.0"); // "1.3.0"
 * @source
 */
export function normalizeVersion(version) {
  return String(version).trim().replace(/^[vV]/, "");
}

/**
 * Pulls the body of the `## [<version>]` section out of changelog markdown.
 * Everything up to the next `## ` heading is returned, with the heading line
 * itself and surrounding blank lines removed.
 * @param changelog - Full contents of a Keep a Changelog style file.
 * @param version - The version to extract, with or without a leading `v`.
 * @returns The section body, or `undefined` when the version has no section or
 * its section is empty.
 * @example
 * extractSection("## [1.3.0] - 2026-01-01\n\n### Added\n\n- Thing\n", "v1.3.0");
 * // "### Added\n\n- Thing"
 * @source
 */
export function extractSection(changelog, version) {
  const target = normalizeVersion(version);
  const lines = changelog.split(/\r?\n/);

  let start = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^##\s+\[?([^\]\s]+)\]?/.exec(lines[index]);
    if (match && normalizeVersion(match[1]) === target) {
      start = index + 1;
      break;
    }
  }
  if (start === -1) return undefined;

  let end = lines.length;
  for (let index = start; index < lines.length; index += 1) {
    if (/^##\s/.test(lines[index])) {
      end = index;
      break;
    }
  }

  const body = lines.slice(start, end).join("\n").trim();
  return body.length > 0 ? body : undefined;
}

/**
 * Reads the changelog from disk and extracts one version's section.
 * @param version - The version or tag to extract.
 * @param changelogPath - Path to the changelog; defaults to the repo's own.
 * @returns The section body, or `undefined` when absent.
 * @example
 * readSection("v1.3.0"); // "### Added\n\n- …"
 * @source
 */
export function readSection(version, changelogPath = DEFAULT_CHANGELOG) {
  return extractSection(readFileSync(changelogPath, "utf8"), version);
}

// CLI entry point; skipped when imported by tests.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , version, outFile] = process.argv;
  if (!version) {
    console.error("Usage: node tools/extractChangelog.js <version> [outFile]");
    process.exit(2);
  }
  const section = readSection(version);
  if (!section) {
    console.error(`No CHANGELOG.md section found for ${version}`);
    process.exit(1);
  }
  if (outFile) {
    writeFileSync(outFile, `${section}\n`);
  } else {
    process.stdout.write(`${section}\n`);
  }
}
