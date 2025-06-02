import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock specific MUI CSS file
vi.mock("@mui/x-data-grid/esm/index.css", () => ({}));

// Mock all CSS imports
vi.mock("*.css", () => ({}));
vi.mock("*.scss", () => ({}));
vi.mock("*.sass", () => ({}));
vi.mock("*.less", () => ({}));

// Suppress console methods
/**/
global.console = {
  ...global.console,
  log: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  dir: vi.fn(),
  table: vi.fn(),
  clear: vi.fn(),
};

// Ensure all fetch calls are mocked
global.fetch = vi.fn().mockImplementation(() => {
  throw new Error(
    'All fetch calls must be mocked! Use vi.spyOn(global, "fetch").mockImplementation() in your test.',
  );
});
