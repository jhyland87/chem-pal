import reactSWC from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [reactSWC()],
  test: {
    //reporters: ["html", "text","c"],
    pool: "vmThreads",
    poolOptions: {
      vmThreads: {
        maxThreads: 4,
        minThreads: 1,
      },
    },
    environment: "jsdom",
    globals: true,
    fileParallelism: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    exclude: [
      "**/node_modules/**",
      //"**/src/components/**",
      "src/mixins/__tests__/tanstack.test.ts",
      "src/helpers/__tests__/productBuilder.test.ts",
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
      "src/suppliers/**",
      // disabling all component testing for now
      //"src/components/**",
      "src/__tests__/**",
    ],
    deps: {
      web: {
        transformCss: true,
      },
    },
    coverage: {
      enabled: false,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.d.ts",
        "**/__mocks__/**",
        "**/__tests__/**",
        "**/__fixtures__/**",
        "**/node_modules/**",
        "**/*.test.{js,ts,jsx,tsx}",
        "**/*.spec.{js,ts,jsx,tsx}",
        "src/utils/typeGuards/index.ts",
        "src/components/index.ts",
        "src/components/SearchPanel/index.ts",
        "src/icons/index.ts",
        "src/components/SearchPanel/Inputs/index.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    //include: ["@mui/x-data-grid"],
  },
});
