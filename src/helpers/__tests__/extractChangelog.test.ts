import { extractSection, normalizeVersion } from "../../../tools/extractChangelog.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CHANGELOG = [
  "# Changelog",
  "",
  "Preamble prose that must never be picked up.",
  "",
  "## [Unreleased]",
  "",
  "### Added",
  "",
  "- Something upcoming",
  "",
  "## [1.2.0] - 2026-07-18",
  "",
  "### Added",
  "",
  "- Options page",
  "",
  "### Fixed",
  "",
  "- Search failing",
  "",
  "## [1.1.0] - 2026-07-14",
  "",
  "Released before this changelog existed.",
  "",
].join("\n");

describe("normalizeVersion", () => {
  it.each([
    ["v1.3.0", "1.3.0"],
    ["V1.3.0", "1.3.0"],
    ["1.3.0", "1.3.0"],
    ["  v1.3.0  ", "1.3.0"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeVersion(input)).toBe(expected);
  });
});

describe("extractSection", () => {
  it("returns only the requested version's body", () => {
    expect(extractSection(CHANGELOG, "1.2.0")).toBe(
      ["### Added", "", "- Options page", "", "### Fixed", "", "- Search failing"].join("\n"),
    );
  });

  it("matches a tag with a leading v", () => {
    expect(extractSection(CHANGELOG, "v1.2.0")).toBe(extractSection(CHANGELOG, "1.2.0"));
  });

  it("stops at the next version heading", () => {
    expect(extractSection(CHANGELOG, "1.2.0")).not.toContain("1.1.0");
    expect(extractSection(CHANGELOG, "1.2.0")).not.toContain("Something upcoming");
  });

  it("handles the Unreleased section", () => {
    expect(extractSection(CHANGELOG, "Unreleased")).toBe(
      ["### Added", "", "- Something upcoming"].join("\n"),
    );
  });

  it("never returns the file preamble", () => {
    expect(extractSection(CHANGELOG, "1.2.0")).not.toContain("Preamble");
  });

  // The workflow treats undefined as "fall back to --generate-notes".
  it("returns undefined for a version with no section", () => {
    expect(extractSection(CHANGELOG, "9.9.9")).toBeUndefined();
  });

  it("returns undefined for a section with no content", () => {
    expect(extractSection("## [1.0.0]\n\n## [0.9.0]\n\n- x\n", "1.0.0")).toBeUndefined();
  });

  it("handles CRLF line endings", () => {
    expect(extractSection(CHANGELOG.replace(/\n/g, "\r\n"), "1.2.0")).toContain("- Options page");
  });
});

describe("the repo's own CHANGELOG.md", () => {
  const changelog = readFileSync(
    path.resolve(__dirname, "../../../CHANGELOG.md"),
    "utf8",
  );

  // Guards the release workflow: a tag with no section silently falls back to
  // the near-empty auto-generated notes.
  it("has a section for the current package version", () => {
    expect(extractSection(changelog, __APP_VERSION__)).toBeDefined();
  });

  it("produces notes the extension can render", async () => {
    const { parseReleaseNotes } = await import("@/helpers/updates");
    const sections = parseReleaseNotes(extractSection(changelog, __APP_VERSION__));
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.every((section) => section.items.length > 0)).toBe(true);
  });
});
