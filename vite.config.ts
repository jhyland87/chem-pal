import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import path from 'path';
import { defineConfig, normalizePath, build as viteBuild, type Plugin } from 'vite';
import analyzer from 'vite-bundle-analyzer';
import graphqlLoader from 'vite-plugin-graphql-loader';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import pkg from './package.json' with { type: 'json' };
import { buildDefines } from './tools/buildDefines.js';
import { buildManifest } from './tools/buildManifest.js';

// https://vite.dev/config/

const _resolve = (p: string) => path.resolve(__dirname, p);

/**
 * Emits a browser-specific `manifest.json` into the build output, derived from
 * the shared `public/manifest.json` base. Chrome gets the base unchanged;
 * Firefox gets the MV3 transforms from {@link buildManifest}.
 *
 * @param target - The browser to build the manifest for (`"chrome"` | `"firefox"`).
 * @returns A Vite plugin that writes the transformed manifest as a build asset.
 * @source
 */
function manifestPlugin(target: string): Plugin {
  return {
    name: 'chem-pal-manifest',
    generateBundle() {
      const base = JSON.parse(readFileSync(_resolve('public/manifest.json'), 'utf-8'));
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(buildManifest(base, target, pkg.version), null, 2),
      });
    },
  };
}

/**
 * Builds the background service worker as its own self-contained IIFE, emitted
 * alongside the main bundle. Running it as a separate lib build (rather than a
 * second rollup input) guarantees a single file with the shared TS constants
 * inlined and no runtime imports — so it works as both a Chrome MV3 worker and a
 * Firefox background script. Runs in `closeBundle`, after the main build has
 * populated (and emptied) the output directory.
 * @param options - The resolved browser/mode flags from the main config.
 * @returns A Vite plugin that emits `service-worker.js` into the build output.
 * @source
 */
function serviceWorkerBuildPlugin(options: {
  browser: string;
  mode: string;
  isProd: boolean;
  isAggregate: boolean;
  isAnalyze: boolean;
  isE2e: boolean;
}): Plugin {
  const { browser, mode, isProd, isAggregate, isAnalyze, isE2e } = options;
  return {
    name: 'chem-pal-service-worker',
    apply: 'build',
    async closeBundle() {
      await viteBuild({
        configFile: false,
        mode,
        logLevel: 'warn',
        // Don't re-copy public/ here: the main build already emitted the
        // per-browser manifest (via manifestPlugin), and copying public/ again
        // would clobber it with the untransformed base manifest.json.
        publicDir: false,
        define: buildDefines(pkg, { isAggregate, isProd, isAnalyze, isE2e }),
        resolve: { alias: { '@': _resolve('./src') } },
        esbuild: {
          //pure: isProd ? ['console.log', 'console.info', 'console.debug', 'console.trace'] : [],
          drop: isProd ? ['debugger'] : [],
        },
        build: {
          outDir: browser === 'firefox' ? 'build-firefox' : 'build',
          emptyOutDir: false,
          sourcemap: !isProd,
          minify: isProd ? 'esbuild' : false,
          lib: {
            entry: _resolve('./src/service-worker.ts'),
            formats: ['iife'],
            name: 'chemPalServiceWorker',
            fileName: () => 'service-worker.js',
          },
        },
      });
    },
  };
}

export default ({ mode }: { mode: string }) => {
  //const env = "development"; //loadEnv(mode, process.cwd());
  //const isDev = true; //  mode === "development" || mode === "mock";

  //console.log("process.env:", process.env);
  const browser = process.env.BROWSER ?? 'chrome';
  // Set by build:e2e/build:e2e:firefox so the resulting build's own MODE stays
  // "production" (realistic JSX/React/minify behavior) while still letting
  // analytics.ts's trackEvent tell an e2e build apart from a real one.
  const isE2e = process.env.CHEMPAL_E2E === '1';

  // The manifest is emitted by manifestPlugin (derived per-browser); only the
  // dev-only mock service worker is statically copied.
  const staticCopyTargets: Array<{ src: string; dest: string }> = [];

  if (mode !== 'production' && mode !== 'analyze-prod') {
    staticCopyTargets.push({
      src: normalizePath(_resolve('./src/__mocks__/mockServiceWorker.js')),
      dest: 'public',
    });
  }
  // Add the _locales folder to the build
  staticCopyTargets.push({
    src: normalizePath(_resolve('./src/_locales')),
    dest: './',
  });

  const isAggregate = mode === 'aggregate';
  const isProd =
    process.env.NODE_ENV?.toLowerCase() === 'production' ||
    mode === 'production' ||
    mode === 'analyze-prod';

  // Vite derives `isProduction` — and so which JSX runtime @vitejs/plugin-react
  // emits — from NODE_ENV *in preference to* `mode`. Any NODE_ENV that isn't
  // exactly "production" (vitest sets "test"; the e2e suite shells out to this
  // build) therefore left plugin-react emitting dev `jsxDEV()` calls while
  // `buildDefines` bundled the production React, which has no such export:
  // blank page, `jsxDEV is not a function`. Pin NODE_ENV to match `isProd` here,
  // before Vite reads it, so the JSX transform and the React build always agree.
  process.env.NODE_ENV = isProd ? 'production' : 'development';
  const isAnalyze = mode === 'analyze' || mode === 'analyze-prod';

  return defineConfig({
    define: buildDefines(pkg, { isAggregate, isProd, isAnalyze, isE2e }),
    // In prod, drop noisy debug logging (console.log/info/debug/trace) so it
    // doesn't ship to the store — including calls that bypass Logger. warn/error
    // are kept so genuine problems still surface; `debugger` is stripped too.
    esbuild: {
      //pure: isProd ? ['console.log', 'console.info', 'console.debug', 'console.trace'] : [],
      drop: isProd ? ['debugger'] : [],
    },
    resolve: {
      alias: {
        '@': _resolve('./src'),
        'react-svg-credit-card-payment-icons': _resolve(
          'node_modules/react-svg-credit-card-payment-icons/dist/index.js',
        ),
      },
    },
    optimizeDeps: {
      exclude: [
        // Remove problematic test file patterns that cause esbuild errors
        // "**/__tests__/**",
        // "**/*.test.ts",
        // "**/*.test.tsx",
        // "**/*.spec.ts",
        // "**/*.spec.tsx",
      ],
    },
    css: {
      modules: {
        localsConvention: 'camelCase',
      },
    },
    plugins: [
      react(),
      graphqlLoader(),
      manifestPlugin(browser),
      serviceWorkerBuildPlugin({ browser, mode, isProd, isAggregate, isAnalyze, isE2e }),
      viteStaticCopy({
        targets: staticCopyTargets,
      }),
      isAnalyze &&
        analyzer({
          openAnalyzer: isAnalyze,
        }),
    ],
    build: {
      // Source maps in dev/aggregate only; prod ships without them to keep the
      // packaged extension small and avoid shipping source.
      sourcemap: !isProd,
      // Minify prod; leave dev/aggregate readable for debugging.
      minify: isProd ? 'esbuild' : false,
      // Extension assets are local disk reads, and every chunk the entry pulls in sits
      // one level below it — the browser discovers them all the moment it parses
      // main.js. The `<link rel="modulepreload">` tags Vite puts in the HTML therefore
      // save nothing and Chrome logs one "preloaded but not used" warning per link.
      // Drop the HTML tags only: the `js` deps stay, because __vitePreload is also what
      // loads the CSS belonging to a dynamically imported chunk.
      modulePreload: {
        resolveDependencies: (_filename, deps, { hostType }) => (hostType === 'html' ? [] : deps),
      },
      chunkSizeWarningLimit: 1000,
      outDir: browser === 'firefox' ? 'build-firefox' : 'build',
      rollupOptions: {
        external: ['chrome', 'data/currency', 'data/quantity', 'data/types', 'data/helpers'],
        input: {
          main: './index.html',
          options: './options.html',
        },
        output: {
          sourcemapExcludeSources: false, //!isDev, // Include source content in dev
          sourcemapPathTransform: (relativeSourcePath) => {
            // Make source map paths relative to project root
            return path.relative('.', relativeSourcePath);
          },
          // three.js backs the molecule loading animation, which is reached through a
          // dynamic import so the WebGL renderer never lands in the initial popup bundle.
          //
          // Nothing else is hand-assigned. Naming chunks for @mui/x-data-grid and
          // @mui/x-charts backfired: a manual chunk acts as an attractor for the shared
          // modules beneath it, so React and @mui/material were absorbed into the charts
          // chunk and the popup could no longer load React without also loading ~980KB of
          // MUI X. Rollup's default splitting already honours the lazy() boundary around
          // StatsPanel, which is the only live consumer of either package.
          manualChunks: (id: string) => {
            if (id.includes('node_modules/three/')) return 'vendor-three';
            return undefined;
          },
        },
      },
    },
  });
};
