/**
 * Release-update detection.
 *
 * Two independent paths, chosen by {@link getInstallSource}:
 * - **manual / unpacked** (and Firefox/AMO) — the browser never auto-updates, so
 *   we poll the GitHub releases API and point the user at the release page.
 * - **Chrome Web Store** — Chrome stages the update itself and fires
 *   `chrome.runtime.onUpdateAvailable` in the service worker; nothing here runs.
 * @module updates
 * @category Helpers
 * @source
 */

import semver from "semver";

/**
 * How long to wait between GitHub release polls on the manual-install path.
 * @category Helpers
 */
export const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * How the running extension was installed.
 * @category Helpers
 */
export type InstallSource = "webstore" | "manual";

/**
 * The subset of the GitHub release payload this module consumes.
 * @group Types
 */
interface GithubRelease {
  /** Release tag, typically `v1.2.3`. */
  tag_name: string;
  /** Public URL of the release page. */
  html_url: string;
  /** True for unpublished drafts. */
  draft: boolean;
  /** True for pre-releases. */
  prerelease: boolean;
  /** Release notes markdown. The API sends `null` when the body is empty. */
  body?: string | null;
}

/**
 * One group of release-note bullets, e.g. everything under an `### Added`
 * heading.
 * @category Helpers
 * @group Types
 */
export interface ReleaseSection {
  /** Heading text, or `undefined` for bullets that precede any heading. */
  title?: string;
  /** Bullet lines, stripped of markdown markers. */
  items: string[];
}

/**
 * A newer release than the one currently running.
 * @category Helpers
 * @group Types
 */
export interface UpdateInfo {
  /** The newer version, without any leading `v` (e.g. `"1.3.0"`). */
  version: string;
  /** URL of the GitHub release page for {@link UpdateInfo.version}. */
  releaseUrl: string;
  /** Parsed release notes; empty when the release body had no bullets. */
  notes: ReleaseSection[];
}

// Bounds what a release body can push into storage and into the modal.
const MAX_NOTE_SECTIONS = 8;
const MAX_NOTE_ITEMS_PER_SECTION = 12;
const MAX_NOTE_ITEM_LENGTH = 300;

/**
 * Reduces a markdown bullet to display text: unwraps links to their label and
 * drops emphasis, code, and image markers. Deliberately not a full markdown
 * parser — the modal renders plain text.
 * @param text - Raw markdown from a bullet line.
 * @returns Plain text suitable for rendering.
 * @example
 * ```ts
 * stripMarkdown("Fixed **search** in [#42](https://…)"); // "Fixed search in #42"
 * ```
 * @source
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses a GitHub release body into headed groups of bullets for display.
 * Recognizes `##`/`###` headings and `-`/`*`/`+` bullets, ignoring prose,
 * and drops the trailing "Full Changelog" link GitHub appends. Continuation
 * lines of a wrapped bullet are folded into that bullet.
 * @category Helpers
 * @param body - The release body markdown, if any.
 * @returns Sections in document order; empty when there's nothing to show.
 * @example
 * ```ts
 * parseReleaseNotes("### Added\n\n- Options page\n- Advanced mode\n");
 * // [{ title: "Added", items: ["Options page", "Advanced mode"] }]
 * ```
 * @source
 */
export function parseReleaseNotes(body: string | undefined): ReleaseSection[] {
  if (!body) return [];

  const sections: ReleaseSection[] = [];
  let current: ReleaseSection | undefined;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    // GitHub appends this to generated notes; it's noise in the modal.
    if (/^\*{0,2}Full Changelog\*{0,2}\s*:/i.test(line)) continue;

    const heading = /^#{2,4}\s+(.*\S)\s*$/.exec(line);
    if (heading) {
      current = { title: stripMarkdown(heading[1]), items: [] };
      sections.push(current);
      continue;
    }

    const bullet = /^[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      const item = stripMarkdown(bullet[1]);
      if (!item) continue;
      current ??= { items: [] };
      if (sections.at(-1) !== current) sections.push(current);
      if (current.items.length < MAX_NOTE_ITEMS_PER_SECTION) {
        current.items.push(item.slice(0, MAX_NOTE_ITEM_LENGTH));
      }
      continue;
    }

    // A wrapped continuation of the previous bullet.
    const items = current?.items;
    if (line && items && items.length > 0) {
      const merged = `${items[items.length - 1]} ${stripMarkdown(line)}`.trim();
      items[items.length - 1] = merged.slice(0, MAX_NOTE_ITEM_LENGTH);
    }
  }

  return sections.filter((section) => section.items.length > 0).slice(0, MAX_NOTE_SECTIONS);
}

/**
 * Narrows an unknown JSON body to {@link GithubRelease}. The GitHub API returns
 * a `{ message, documentation_url }` object for errors with the same 200-shaped
 * `Content-Type`, so the fields have to be checked rather than assumed.
 * @param value - Parsed JSON body from the releases endpoint.
 * @returns True when `value` carries every field this module reads.
 * @example
 * ```ts
 * isGithubRelease({ tag_name: "v1.3.0", html_url: "…", draft: false, prerelease: false }); // true
 * isGithubRelease({ message: "API rate limit exceeded" }); // false
 * ```
 * @source
 */
function isGithubRelease(value: unknown): value is GithubRelease {
  if (typeof value !== "object" || value === null) return false;
  if (!("tag_name" in value) || typeof value.tag_name !== "string") return false;
  if (!("html_url" in value) || typeof value.html_url !== "string") return false;
  if (!("draft" in value) || typeof value.draft !== "boolean") return false;
  if (!("prerelease" in value) || typeof value.prerelease !== "boolean") return false;
  // `body` is optional and nullable; anything else means an unexpected shape.
  if ("body" in value && value.body !== null && typeof value.body !== "string") return false;
  return true;
}

/**
 * Converts a GitHub release tag into a plain semver string, stripping a leading
 * `v`/`V`. Returns `undefined` for anything semver can't parse, so callers never
 * hand an invalid version to `semver.gt` (which throws).
 * @category Helpers
 * @param tag - The raw `tag_name` from a GitHub release.
 * @returns The normalized version, or `undefined` if the tag isn't valid semver.
 * @example
 * ```ts
 * normalizeTag("v1.3.0");     // "1.3.0"
 * normalizeTag("1.3.0");      // "1.3.0"
 * normalizeTag("2024-05");    // undefined
 * ```
 * @source
 */
export function normalizeTag(tag: string): string | undefined {
  return semver.valid(tag.replace(/^[vV]/, "")) ?? undefined;
}

/**
 * Reports how the extension was installed, so callers know whether the browser
 * will update it automatically.
 *
 * @category Helpers
 * @remarks
 * Detection reads `chrome.runtime.getManifest().update_url`, which the Chrome
 * Web Store injects into the *runtime* manifest — our shipped `manifest.json`
 * has no such key. This needs no permission, unlike
 * `chrome.management.getSelf().installType`. Caveats:
 * - Firefox never injects an update URL, so AMO installs report `"manual"` and
 *   take the GitHub path. Harmless: AMO auto-updates silently, so a newer
 *   release is normally only visible in the window between a GitHub release and
 *   AMO approval.
 * - A future self-hosted CRX carrying its own `update_url` would be reported as
 *   `"webstore"`.
 * - Enterprise policy installs also carry an `update_url` and are correctly
 *   treated as auto-updating.
 * @returns `"webstore"` when the browser manages updates, otherwise `"manual"`.
 * @example
 * ```ts
 * getInstallSource(); // "manual" for an unpacked build loaded from dist/
 * ```
 * @source
 */
export function getInstallSource(): InstallSource {
  const manifest = chrome.runtime.getManifest();
  return "update_url" in manifest && manifest.update_url ? "webstore" : "manual";
}

/**
 * Fetches the latest published release from the project's GitHub repository.
 * Never throws — network failures, non-2xx responses (notably the 403 returned
 * once the 60 req/hr unauthenticated rate limit is hit), and unrecognized bodies
 * all resolve to `undefined`.
 * @category Helpers
 * @returns The latest release, or `undefined` if it couldn't be retrieved.
 * @example
 * ```ts
 * const release = await getLatestRelease();
 * release?.tag_name; // "v1.3.0"
 * ```
 * @source
 */
export async function getLatestRelease(): Promise<GithubRelease | undefined> {
  return fetchRelease("releases/latest");
}

/**
 * Fetches a specific release by tag. Used on the Web Store path, where
 * `chrome.runtime.onUpdateAvailable` reports only a version number and the
 * release notes have to be looked up separately.
 * @category Helpers
 * @param version - The version to look up, with or without a leading `v`.
 * @returns The release, or `undefined` if it couldn't be retrieved.
 * @example
 * ```ts
 * const release = await getReleaseByTag("1.3.0");
 * release?.html_url; // "https://github.com/owner/repo/releases/tag/v1.3.0"
 * ```
 * @source
 */
export async function getReleaseByTag(version: string): Promise<GithubRelease | undefined> {
  const tag = `v${normalizeVersion(version)}`;
  return fetchRelease(`releases/tags/${encodeURIComponent(tag)}`);
}

/**
 * Strips a leading `v` so callers can pass either form.
 * @param version - A version or tag string.
 * @returns The bare version number.
 * @source
 */
function normalizeVersion(version: string): string {
  return version.trim().replace(/^[vV]/, "");
}

/**
 * Fetches and validates a release from the project's GitHub repository. Never
 * throws — network failures, non-2xx responses (notably the 403 returned once
 * the 60 req/hr unauthenticated rate limit is hit), and unrecognized bodies all
 * resolve to `undefined`.
 * @param endpoint - Path under the repo's API root, e.g. `"releases/latest"`.
 * @returns The release, or `undefined` if it couldn't be retrieved.
 * @source
 */
async function fetchRelease(endpoint: string): Promise<GithubRelease | undefined> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${__GITHUB_OWNER__}/${__GITHUB_REPO__}/${endpoint}`,
    );
    if (!response.ok) return undefined;
    const data: unknown = await response.json();
    return isGithubRelease(data) ? data : undefined;
  } catch (error) {
    console.error("Failed to fetch release:", { endpoint, error });
    return undefined;
  }
}

/**
 * Looks up the release notes for a specific version.
 * @category Helpers
 * @param version - The version to look up, with or without a leading `v`.
 * @returns The parsed notes and release page URL; `notes` is empty when the
 * release has no usable body, and the result is `undefined` on failure.
 * @example
 * ```ts
 * await getReleaseNotes("1.3.0");
 * // { releaseUrl: "https://github.com/…", notes: [{ title: "Added", items: ["…"] }] }
 * ```
 * @source
 */
export async function getReleaseNotes(
  version: string,
): Promise<{ releaseUrl: string; notes: ReleaseSection[] } | undefined> {
  const release = await getReleaseByTag(version);
  if (!release) return undefined;
  return { releaseUrl: release.html_url, notes: parseReleaseNotes(release.body ?? undefined) };
}

/**
 * Checks whether a stable release newer than the running build is available.
 * Drafts and pre-releases are ignored, as are tags that aren't valid semver.
 * @category Helpers
 * @returns Details of the newer release, or `undefined` when up to date (or when
 * the check couldn't complete).
 * @example
 * ```ts
 * // running 1.2.0, latest release tagged v1.3.0
 * await getAvailableUpdate();
 * // { version: "1.3.0", releaseUrl: "https://github.com/…", notes: [{ title: "Added", … }] }
 * // running 1.3.0
 * await getAvailableUpdate(); // undefined
 * ```
 * @source
 */
export async function getAvailableUpdate(): Promise<UpdateInfo | undefined> {
  const release = await getLatestRelease();
  if (!release || release.draft || release.prerelease) return undefined;

  const version = normalizeTag(release.tag_name);
  if (!version || semver.prerelease(version) !== null) return undefined;
  if (!semver.gt(version, __APP_VERSION__)) return undefined;

  return {
    version,
    releaseUrl: release.html_url,
    notes: parseReleaseNotes(release.body ?? undefined),
  };
}
