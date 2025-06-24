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

// Replace global.fetch with a vi.fn() that throws by default
const fetchMock = vi.fn(() => {
  throw new Error(
    "All fetch calls must be mocked! Use (global.fetch as vi.Mock).mockImplementation() in your test.",
  );
});
global.fetch = fetchMock;
