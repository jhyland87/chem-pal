import { report as reportConfig } from '@/../config.json';
import { formatErrorChain, getRecentErrors, type CapturedError } from '@/helpers/errorBuffer';
import { getInstallSource } from '@/helpers/updates';
import { getIdbStorageBreakdown } from '@/utils/idbCache';

/**
 * Assembles diagnostics for a bug report and builds prefilled submission URLs
 * for the two credential-free paths: a GitHub issue form and a Google Form.
 * Nothing is submitted here — the caller opens a tab the user reviews and sends.
 *
 * Ported from the `dev/bug-report.js` blueprint; repo owner/name come from the
 * `__GITHUB_OWNER__` / `__GITHUB_REPO__` build defines and the form config lives
 * in `config.json` (`report`).
 *
 * @module bugReport
 * @category Helpers
 * @source
 */

/** Optional caller-supplied context attached to a report. */
export interface ReportContext {
  /** The page URL where the problem occurred. */
  url?: string;
  /** A short label for what the user was doing (e.g. `"render-crash"`). */
  action?: string;
  /** Any extra structured payload to include verbatim in the logs. */
  extra?: Record<string, unknown>;
}

/**
 * A fully-assembled diagnostics snapshot, ready to render into a report.
 * @category Helpers
 * @group Bug reporting
 */
export interface Diagnostics {
  /** Primary error message (or a placeholder for a manual report). */
  message: string;
  /** Primary error stack, when a specific error triggered the report. */
  stack: string;
  /** Extension version. */
  version: string;
  /** Browser user-agent string. */
  userAgent: string;
  /** UI language. */
  language: string;
  /** Page URL where the report was opened. */
  url: string;
  /** What the user was doing, if known. */
  action: string;
  /** Whether the extension auto-updates (`"webstore"`) or was sideloaded (`"manual"`). */
  installSource: string;
  /** Compact per-store IndexedDB usage summary. */
  storage: string;
  /** Recent captured exceptions from the ring buffer. */
  recentErrors: CapturedError[];
  /** Any caller-supplied extra payload. */
  extra?: Record<string, unknown>;
  /** ISO timestamp of when the report was assembled. */
  timestamp: string;
}

/**
 * Truncates text to a character budget, appending a marker (and a note that the
 * full detail is on the clipboard) when it has to cut.
 * @param text - The text to bound.
 * @param limit - Maximum length to keep.
 * @returns The original text, or a truncated copy with a marker.
 * @example
 * ```ts
 * truncate("a".repeat(10), 4); // => "aaaa\n…[truncated — full log copied to clipboard]"
 * ```
 * @source
 */
export function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n…[truncated — full log copied to clipboard]`;
}

/**
 * Reads the browser platform from the newer `userAgentData` API when present,
 * falling back to the classic `navigator.userAgent`.
 * @returns A human-readable environment string.
 * @source
 */
function readUserAgent(): string {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform;
  return platform ? `${navigator.userAgent} (${platform})` : navigator.userAgent;
}

/**
 * Reads the extension version, preferring the build-time constant and falling
 * back to the live manifest.
 * @returns The version string, or `"unknown"`.
 * @source
 */
function readVersion(): string {
  if (typeof __APP_VERSION__ === 'string' && __APP_VERSION__) return __APP_VERSION__;
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return 'unknown';
  }
}

/**
 * Builds a compact one-line-per-store IndexedDB usage summary. Never throws —
 * returns a short note when the breakdown can't be read.
 * @returns A multi-line storage summary, or a fallback note.
 * @source
 */
async function readStorageSummary(): Promise<string> {
  try {
    const { byStore, totalBytes } = await getIdbStorageBreakdown();
    const lines = Object.entries(byStore)
      .filter(([, { count }]) => count > 0)
      .map(
        ([store, { count, bytes }]) => `  ${store}: ${count} recs, ${Math.round(bytes / 1024)} KB`,
      );
    const total = `Total: ${Math.round(totalBytes / 1024)} KB across ${lines.length} store(s)`;
    return lines.length ? `${total}\n${lines.join('\n')}` : total;
  } catch {
    return 'Storage: unavailable';
  }
}

/**
 * Reads the install source, tolerating a missing `chrome.runtime`.
 * @returns `"webstore"`, `"manual"`, or `"unknown"`.
 * @source
 */
function readInstallSource(): string {
  try {
    return getInstallSource();
  } catch {
    return 'unknown';
  }
}

/**
 * Collects a full diagnostics snapshot. When called with a specific `error`, its
 * message and stack lead the report; otherwise the report is "manual" and the
 * ring buffer of recent exceptions stands in for the stack.
 * @param error - The error that triggered the report, if any.
 * @param context - Optional page URL, action label, and extra payload.
 * @returns The assembled diagnostics.
 * @example
 * ```ts
 * const diag = await collectDiagnostics(err, { action: "render-crash" });
 * diag.message; // err.message
 * ```
 * @source
 */
export async function collectDiagnostics(
  error?: unknown,
  context: ReportContext = {},
): Promise<Diagnostics> {
  const recentErrors = await getRecentErrors();
  const isError = error instanceof Error;
  const message = isError ? error.message : error ? String(error) : 'Manual bug report';
  const stack = isError ? formatErrorChain(error) : '';

  return {
    message,
    stack,
    version: readVersion(),
    userAgent: readUserAgent(),
    language: navigator.language,
    url: context.url ?? globalThis.location?.href ?? 'n/a',
    action: context.action ?? 'n/a',
    installSource: readInstallSource(),
    storage: await readStorageSummary(),
    recentErrors,
    extra: context.extra,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Formats the always-short environment block (fits any URL budget).
 * @param d - The diagnostics snapshot.
 * @returns A newline-delimited metadata block.
 * @source
 */
export function formatMetadata(d: Diagnostics): string {
  return [
    `Extension: ${d.version}`,
    `Install:   ${d.installSource}`,
    `When:      ${d.timestamp}`,
    `Action:    ${d.action}`,
    `Page:      ${d.url}`,
    `Browser:   ${d.userAgent}`,
    `Locale:    ${d.language}`,
    '',
    'Storage:',
    d.storage,
  ].join('\n');
}

/**
 * Formats the unbounded part — the primary stack, recent exceptions, and any
 * extra payload. This is what gets truncated to fit a URL budget.
 * @param d - The diagnostics snapshot.
 * @returns A newline-delimited logs block.
 * @source
 */
export function formatLogs(d: Diagnostics): string {
  const lines: string[] = [];
  if (d.stack) lines.push('Stack:', d.stack);
  if (d.recentErrors.length) {
    lines.push('', `Recent exceptions (${d.recentErrors.length}):`);
    for (const e of d.recentErrors) {
      lines.push(`- [${e.source}] ${e.message}`);
      if (e.stack) lines.push(e.stack);
    }
  }
  if (d.extra) lines.push('', 'Extra:', JSON.stringify(d.extra, null, 2));
  return lines.join('\n') || '(no logs captured)';
}

/**
 * Formats the complete diagnostics — metadata plus logs — for the review dialog
 * and the clipboard.
 * @param d - The diagnostics snapshot.
 * @returns The full report text.
 * @source
 */
export function formatDiagnostics(d: Diagnostics): string {
  return `${formatMetadata(d)}\n\n${formatLogs(d)}`;
}

/**
 * Builds a prefilled GitHub issue-form URL. Because a `template` is set, GitHub
 * prefills by field **id** (`version`, `diagnostics`, `logs`) rather than `body`.
 * The `logs` field is shrunk last so the whole URL stays within the configured
 * character budget.
 * @param d - The diagnostics snapshot.
 * @returns An absolute `issues/new` URL.
 * @example
 * ```ts
 * buildGithubUrl(diag); // "https://github.com/owner/repo/issues/new?template=…"
 * ```
 * @source
 */
export function buildGithubUrl(d: Diagnostics): string {
  const base = `https://github.com/${__GITHUB_OWNER__}/${__GITHUB_REPO__}/issues/new`;
  const { template, labels } = reportConfig.github;
  const maxChars = reportConfig.maxChars.github;

  const build = (logs: string): string => {
    const params = new URLSearchParams();
    params.set('template', template);
    if (labels.length) params.set('labels', labels.join(','));
    params.set('title', `[Bug] ${d.message}`.slice(0, 120));
    params.set('version', d.version);
    params.set('diagnostics', formatMetadata(d));
    params.set('logs', logs);
    return `${base}?${params.toString()}`;
  };

  const fullLogs = formatLogs(d);
  let url = build(fullLogs);
  if (url.length <= maxChars) return url;

  // Too long: shrink the raw logs and mark them as truncated. Each pass trims a
  // bit more than the overflow to absorb URL-encoding expansion and the marker.
  const marker = '\n…[truncated — full log copied to clipboard]';
  let raw = fullLogs;
  do {
    const overflow = url.length - maxChars;
    raw = raw.slice(0, Math.max(0, raw.length - overflow - marker.length - 16));
    url = build(raw + marker);
  } while (url.length > maxChars && raw.length > 0);
  return url;
}

/**
 * Builds a prefilled Google Form `viewform` URL. Field ids come from
 * `config.json` (`report.googleForm.entries`); the `logs` value is truncated to
 * the form-specific budget (Google Forms drops prefills on very long URLs).
 * @param d - The diagnostics snapshot.
 * @returns An absolute `viewform` URL, or `undefined` when no form is configured.
 * @example
 * ```ts
 * buildGoogleFormUrl(diag); // "https://docs.google.com/forms/d/e/…/viewform?usp=pp_url&…"
 * ```
 * @source
 */
export function buildGoogleFormUrl(d: Diagnostics): string | undefined {
  const { id, entries } = reportConfig.googleForm;
  if (!id) return undefined;

  const params = new URLSearchParams();
  params.set('usp', 'pp_url');
  params.set(entries.summary, d.message.slice(0, 120));
  params.set(entries.version, d.version);
  params.set(entries.diagnostics, formatMetadata(d));
  params.set(entries.logs, truncate(formatLogs(d), reportConfig.maxChars.formLogs));
  // `description` is left blank on purpose — the user writes that part.
  return `https://docs.google.com/forms/d/e/${id}/viewform?${params.toString()}`;
}

/**
 * Opens a URL in a new browser tab, using `chrome.tabs.create` inside the
 * extension and falling back to `window.open` elsewhere.
 * @param url - The URL to open.
 * @returns Nothing.
 * @example
 * ```ts
 * openTab(buildGithubUrl(diag));
 * ```
 * @source
 */
export function openTab(url: string): void {
  if (typeof chrome?.tabs?.create === 'function') {
    chrome.tabs.create({ url });
  } else {
    window.open(url, '_blank', 'noopener');
  }
}
