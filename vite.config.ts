import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, loadEnv } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
// https://vite.dev/config/

export default ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd());
  const isDev = mode === "development" || mode === "mock";

  //console.log("process.env:", process.env);
  const staticCopyTargets = [
    {
      src: "public/manifest.json",
      dest: ".",
    },
    {
      src: "src/service-worker.js",
      dest: ".",
    },
    {
      src: "src/__mocks__/mockServiceWorker.js",
      dest: "public",
    },
  ];

  if (isDev) {
    staticCopyTargets.push({
      src: "src/__mocks__/mockServiceWorker.js",
      dest: "public",
    });
  }

  return defineConfig({
    define: {
      "process.env": env,
    },
    resolve: {
      alias: {
        icons: path.resolve(__dirname, "./src/assets/icons"),
        constants: path.resolve(__dirname, "./src/constants"),
        helpers: path.resolve(__dirname, "./src/helpers"),
        types: path.resolve(__dirname, "./src/types"),
      },
    },
    plugins: [
      react(),
      viteStaticCopy({
        targets: staticCopyTargets,
      }),
      /*
      analyzer({
        openAnalyzer: false,
      }),*/
    ],
    build: {
      // Enable source maps for both dev and prod
      sourcemap: true,
      // Improve source map quality
      minify: isDev ? false : "esbuild",
      // Preserve original file structure in source maps
      chunkSizeWarningLimit: 1000,
      outDir: "build",
      rollupOptions: {
        external: ["chrome", "data/currency", "data/quantity", "data/types", "data/helpers"],
        input: {
          main: "./index.html",
        },
        output: {
          sourcemapExcludeSources: !isDev, // Include source content in dev
          sourcemapPathTransform: (relativeSourcePath) => {
            // Make source map paths relative to project root
            return path.relative(".", relativeSourcePath);
          },
          // Chunk optimization
          manualChunks: isDev
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
                ],
              },
        },
      },
    },
  });
};
