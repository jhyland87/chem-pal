import { vi } from "vitest";

/**
 * Creates spy functions for essential console methods.
 * This allows tests to verify console output while preserving the original behavior.
 *
 * @returns An object containing spies for essential console methods
 *
 * @example
 * ```typescript
 * describe("MyTest", () => {
 *   let consoleSpies: ReturnType<typeof createConsoleMock>;
 *
 *   beforeAll(() => {
 *     consoleSpies = setupConsoleMock();
 *   });
 * });
 * ```
 */
export const createConsoleMock = () => {
  const consoleMock = {
    log: vi.spyOn(console, "log"),
    error: vi.spyOn(console, "error"),
    debug: vi.spyOn(console, "debug"),
    warn: vi.spyOn(console, "warn"),
    info: vi.spyOn(console, "info"),
    table: vi.spyOn(console, "table"),
    dir: vi.spyOn(console, "dir"),
    clear: vi.spyOn(console, "clear"),
  };

  return consoleMock;
};

/**
 * Sets up spies for essential console methods.
 * This should be called at the start of your test suite.
 *
 * @returns The spy functions for direct access if needed
 *
 * @example
 * ```typescript
 * describe("MyTest", () => {
 *   beforeAll(() => {
 *     setupConsoleMock();
 *   });
 * });
 * ```
 */
export const setupConsoleMock = () => {
  return createConsoleMock();
};

/**
 * Clears all console spy function calls.
 * This should be called in beforeEach or afterEach to ensure a clean state.
 *
 * @example
 * ```typescript
 * describe("MyTest", () => {
 *   beforeEach(() => {
 *     resetConsoleMock();
 *   });
 * });
 * ```
 */
export const resetConsoleMock = () => {
  vi.clearAllMocks();
};

/**
 * Restores all console spy functions to their original state.
 * This should be called in afterAll to clean up after tests.
 *
 * @example
 * ```typescript
 * describe("MyTest", () => {
 *   afterAll(() => {
 *     restoreConsoleMock();
 *   });
 * });
 * ```
 */
export const restoreConsoleMock = () => {
  vi.restoreAllMocks();
};
