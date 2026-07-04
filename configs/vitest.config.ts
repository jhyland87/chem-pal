import reactSWC from "@vitejs/plugin-react-swc";
import path from "node:path";
import graphqlLoader from "vite-plugin-graphql-loader";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // graphqlLoader mirrors vite.config.ts so `.gql` imports (e.g. the Wix query) transform in tests too.
  plugins: [reactSWC(), graphqlLoader()],
  test: {
    root: path.resolve(__dirname, ".."),
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
    setupFiles: [path.resolve(__dirname, "vitest.setup.ts")],
    include: ["src/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}"],
    exclude: [
      "**/node_modules/**",
      //"**/src/components/**",
      "src/helpers/__tests__/productBuilder.test.ts",
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
      "src/suppliers/__fixtures__/**",
      "src/suppliers/__tests__/supplierMacklin.test.ts",
      //"src/suppliers/__tests__/supplierLaboratoriumDiscounter.test.ts",
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
      "@": path.resolve(__dirname, "..", "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    //include: ["@mui/x-data-grid"],
  },
});
