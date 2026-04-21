/**
 * Build-mode flag derived from Vite's `import.meta.env.MODE`.
 *
 * `true` for any non-production Vite build: the dev server (`pnpm dev`),
 * `--mode=development`, `--mode=aggregate`, `--mode=mock`, and Vitest
 * (which uses `MODE === "test"`). `false` only for `--mode=production`
 * (i.e. `pnpm build:prod`).
 *
 * Vite replaces `import.meta.env.MODE` with a string literal at build time,
 * so downstream `if (!IS_DEV_BUILD)` branches collapse to dead code in prod
 * and are removed by Rollup's tree-shaking.
 *
 * @category Utils
 * @example
 * ```ts
 * import { IS_DEV_BUILD } from "@/utils/isDevBuild";
 * if (IS_DEV_BUILD) { console.debug("only fires in dev"); }
 * ```
 * @source
 */
export const IS_DEV_BUILD = import.meta.env.MODE !== "production";
