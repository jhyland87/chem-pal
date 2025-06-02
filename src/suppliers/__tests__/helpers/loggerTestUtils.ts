import Logger from "@/utils/Logger";
import { vi } from "vitest";

/**
 * Creates spy functions for a Logger instance's methods.
 * This allows tests to verify logger output while preserving the original behavior.
 *
 * @param logger The Logger instance to spy on
 * @returns An object containing spies for all logger methods
 *
 * @example
 * ```typescript
 * describe("MyTest", () => {
 *   let logger: Logger;
 *   let loggerSpies: ReturnType<typeof spyOnLogger>;
 *
 *   beforeEach(() => {
 *     logger = new Logger("Test");
 *     loggerSpies = spyOnLogger(logger);
 *   });
 * });
 * ```
 */
export const spyOnLogger = (logger: Logger) => {
  const spies = {
    debug: vi.spyOn(logger, "debug"),
    info: vi.spyOn(logger, "info"),
    warn: vi.spyOn(logger, "warn"),
    error: vi.spyOn(logger, "error"),
    log: vi.spyOn(logger, "log"),
    table: vi.spyOn(logger, "table"),
    trace: vi.spyOn(logger, "trace"),
    dir: vi.spyOn(logger, "dir"),
    group: vi.spyOn(logger, "group"),
    groupCollapsed: vi.spyOn(logger, "groupCollapsed"),
    groupEnd: vi.spyOn(logger, "groupEnd"),
    time: vi.spyOn(logger, "time"),
    timeEnd: vi.spyOn(logger, "timeEnd"),
    timeLog: vi.spyOn(logger, "timeLog"),
    clear: vi.spyOn(logger, "clear"),
    count: vi.spyOn(logger, "count"),
    countReset: vi.spyOn(logger, "countReset"),
    timeStamp: vi.spyOn(logger, "timeStamp"),
  };

  return spies;
};

/**
 * Clears all logger spy function calls.
 * This should be called in beforeEach or afterEach to ensure a clean state.
 *
 * @example
 * ```typescript
 * describe("MyTest", () => {
 *   beforeEach(() => {
 *     resetLoggerSpies();
 *   });
 * });
 * ```
 */
export const resetLoggerSpies = () => {
  vi.clearAllMocks();
};

/**
 * Restores all logger spy functions to their original state.
 * This should be called in afterAll to clean up after tests.
 *
 * @example
 * ```typescript
 * describe("MyTest", () => {
 *   afterAll(() => {
 *     restoreLoggerSpies();
 *   });
 * });
 * ```
 */
export const restoreLoggerSpies = () => {
  vi.restoreAllMocks();
};
