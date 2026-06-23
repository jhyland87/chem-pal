import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import path from "path";
import { defineConfig, type Plugin } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { buildManifest } from "./tools/buildManifest.js";
// https://vite.dev/config/

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
      const base = JSON.parse(readFileSync(path.resolve(__dirname, "public/manifest.json"), "utf-8"));
      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: JSON.stringify(buildManifest(base, target), null, 2),
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
      src: "src/__mocks__/mockServiceWorker.js",
      dest: "public",
    });
  }

  const isAggregate = mode === "aggregate";
  const isProd = mode === "production";

  return defineConfig({
    define: {
      "process.env.NODE_ENV": JSON.stringify("development"),
      //"process.env": JSON.stringify(env),
      __RESPONSE_AGGREGATE__: JSON.stringify(isAggregate),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "react-svg-credit-card-payment-icons": path.resolve(
          __dirname,
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
      manifestPlugin(browser),
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
