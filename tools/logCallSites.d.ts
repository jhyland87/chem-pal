/**
 * Type declarations for the plain-JS `logCallSites` tool, so tests and `vite.config.ts` can
 * import it without `allowJs`.
 */
import type { Plugin } from 'vite';

/** Options for {@link injectCallSites}. */
export interface InjectCallSitesOptions {
  /** Logger methods to instrument. Defaults to `warn` and `error`. */
  levels?: readonly string[];
  /** Absolute path of the `src` directory that reported file paths are relative to. */
  srcRoot: string;
}

/** Whether a file under `src/` should be scanned for logger calls. */
export function isInstrumentable(file: string, srcRoot: string): boolean;

/**
 * Rewrites the instrumented logger calls in one module, or returns `undefined` when none
 * matched.
 */
export function injectCallSites(
  code: string,
  file: string,
  options: InjectCallSitesOptions,
): { code: string; map: object } | undefined;

/** Vite plugin that instruments logger calls in the app's own source. */
export function logCallSitesPlugin(options?: { levels?: readonly string[]; root?: string }): Plugin;
