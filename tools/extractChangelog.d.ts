/**
 * Type declarations for the plain-JS `extractChangelog` tool, so tests and any
 * TypeScript caller can import it without `allowJs`.
 */

/** Strips a leading `v` and surrounding whitespace from a version or tag. */
export function normalizeVersion(version: string): string;

/** Returns the body of the `## [<version>]` section, or `undefined` if absent. */
export function extractSection(changelog: string, version: string): string | undefined;

/** Reads the changelog from disk and extracts one version's section. */
export function readSection(version: string, changelogPath?: string): string | undefined;
