import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@e2e": path.resolve(__dirname, "..", "e2e"),
    },
  },
  test: {
    root: path.resolve(__dirname, ".."),
    include: ["e2e/**/*.e2e.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // No jsdom — e2e tests use real browser via Playwright
    environment: "node",
    // Single thread to avoid multiple browser instances
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
