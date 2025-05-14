import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
//import { analyzer } from 'vite-bundle-analyzer'
// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: "public/manifest.json",
          dest: ".",
        },
        {
          src: "src/service-worker.js",
          dest: ".",
        },
      ],
    }),
    // analyzer({
    //   openAnalyzer: false
    // })
  ],
  build: {
    chunkSizeWarningLimit: 1500,
    outDir: "build",
    rollupOptions: {
      input: {
        main: "./index.html",
      },
      output: {
        manualChunks: (id: string) => {
          if (id.includes("node_modules")) {
            if (id.includes("lodash")) {
              return "lodash";
            }

            if (id.includes("@mui") || id.includes("@material-ui")) {
              return "vendor_mui";
            }

            if (id.includes("react")) {
              return "react";
            }

            return "vendor"; // all other package goes here
          }
          return "default";
        },
      },
    },
  },
});
