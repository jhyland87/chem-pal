import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import path from "path";
import { defineConfig, normalizePath, build as viteBuild, type Plugin } from "vite";
import graphqlLoader from "vite-plugin-graphql-loader";
import { viteStaticCopy } from "vite-plugin-static-copy";
import pkg from "./package.json" with { type: "json" };
import { buildDefines } from "./tools/buildDefines.js";
import { buildManifest } from "./tools/buildManifest.js";

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
    name: "chem-pal-manifest",
    generateBundle() {
      const base = JSON.parse(readFileSync(_resolve("public/manifest.json"), "utf-8"));
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: JSON.stringify(buildManifest(base, target), null, 2),
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
}): Plugin {
  const { browser, mode, isProd, isAggregate } = options;
  return {
    name: "chem-pal-service-worker",
    apply: "build",
    async closeBundle() {
      await viteBuild({
        configFile: false,
        mode,
        logLevel: "warn",
        // Don't re-copy public/ here: the main build already emitted the
        // per-browser manifest (via manifestPlugin), and copying public/ again
        // would clobber it with the untransformed base manifest.json.
        publicDir: false,
        define: buildDefines(pkg, { isAggregate, isProd }),
        resolve: { alias: { "@": _resolve("./src") } },
        esbuild: {
          pure: isProd ? ["console.log", "console.info", "console.debug", "console.trace"] : [],
          drop: isProd ? ["debugger"] : [],
        },
        build: {
          outDir: browser === "firefox" ? "build-firefox" : "build",
          emptyOutDir: false,
          sourcemap: !isProd,
          minify: isProd ? "esbuild" : false,
          lib: {
            entry: _resolve("./src/service-worker.ts"),
            formats: ["iife"],
            name: "chemPalServiceWorker",
            fileName: () => "service-worker.js",
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
  const browser = process.env.BROWSER ?? "chrome";

  // The manifest is emitted by manifestPlugin (derived per-browser); only the
  // dev-only mock service worker is statically copied.
  const staticCopyTargets: Array<{ src: string; dest: string }> = [];

  if (mode !== "production") {
    staticCopyTargets.push({
      src: normalizePath(_resolve("./src/__mocks__/mockServiceWorker.js")),
      dest: "public",
    });
  }
  // Add the _locales folder to the build
  staticCopyTargets.push({
    src: normalizePath(_resolve("./src/_locales")),
    dest: "./",
  });

  const isAggregate = mode === "aggregate";
  const isProd = mode === "production";

  return defineConfig({
    define: buildDefines(pkg, { isAggregate, isProd }),
    // In prod, drop noisy debug logging (console.log/info/debug/trace) so it
    // doesn't ship to the store — including calls that bypass Logger. warn/error
    // are kept so genuine problems still surface; `debugger` is stripped too.
    esbuild: {
      pure: isProd ? ["console.log", "console.info", "console.debug", "console.trace"] : [],
      drop: isProd ? ["debugger"] : [],
    },
    resolve: {
      alias: {
        "@": _resolve("./src"),
        "react-svg-credit-card-payment-icons": _resolve(
          "node_modules/react-svg-credit-card-payment-icons/dist/index.js",
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
        localsConvention: "camelCase",
      },
    },
    plugins: [
      react(),
      graphqlLoader(),
      manifestPlugin(browser),
      serviceWorkerBuildPlugin({ browser, mode, isProd, isAggregate }),
      viteStaticCopy({
        targets: staticCopyTargets,
      }),
      /*
      analyzer({
        openAnalyzer: false,
      }),*/
    ],
    build: {
      // Source maps in dev/aggregate only; prod ships without them to keep the
      // packaged extension small and avoid shipping source.
      sourcemap: !isProd,
      // Minify prod; leave dev/aggregate readable for debugging.
      minify: isProd ? "esbuild" : false,
      chunkSizeWarningLimit: 1000,
      outDir: browser === "firefox" ? "build-firefox" : "build",
      rollupOptions: {
        external: ["chrome", "data/currency", "data/quantity", "data/types", "data/helpers"],
        input: {
          main: "./index.html",
          options: "./options.html",
        },
        output: {
          sourcemapExcludeSources: false, //!isDev, // Include source content in dev
          sourcemapPathTransform: (relativeSourcePath) => {
            // Make source map paths relative to project root
            return path.relative(".", relativeSourcePath);
          } /*
          // Chunk optimization
          manualChunks: true //isDev
            ? undefined
            : {
                vendor_mui_style: ["@mui/styled-engine", "@mui/styles"],
                vendor_mui_material: ["@mui/material"],
                vendor_mui_x_data_grid: ["@mui/x-data-grid"],
                vendor_tanstack: ["@tanstack/react-table"],
                vendor_lodash: ["lodash"],
                vendor_react: [
                  "react",
                  "react-dom",
                  "react-form-hook",
                  "react-icons",
                  "react-virtuoso",
                  "react-svg-credit-card-payment-icons",
                ],
              },*/,
        },
      },
    },
  });
};
