import {
  resetConsoleMock,
  restoreConsoleMock,
  setupConsoleMock,
} from "@/suppliers/__tests__/helpers/consoleTestUtils";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger, LogLevel } from "../Logger";

// Define the extended Window interface
interface ExtendedWindow extends Window {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  LOG_LEVEL?: string;
}

describe("Logger", () => {
  let logger: Logger;
  let consoleSpies: ReturnType<typeof setupConsoleMock>;

  beforeAll(() => {
    consoleSpies = setupConsoleMock();
  });

  beforeEach(() => {
    resetConsoleMock();
    logger = new Logger("Test");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));

    // Reset environment variables
    delete (window as ExtendedWindow).LOG_LEVEL;
    delete process.env.LOG_LEVEL;
  });

  afterAll(() => {
    vi.useRealTimers();
    restoreConsoleMock();
  });

  describe("initialization", () => {
    it("should create logger with default INFO level when no level specified", () => {
      delete process.env.LOG_LEVEL;
      expect(logger.getLogLevel()).toBe(LogLevel.INFO);
    });

    it("should create logger with specified level", () => {
      const logger = new Logger("Test", LogLevel.DEBUG);
      expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
    });

    it("should use window.LOG_LEVEL when available", () => {
      (window as ExtendedWindow).LOG_LEVEL = "DEBUG";
      const logger = new Logger("Test");
      expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
    });

    it("should fall back to process.env.LOG_LEVEL when window.LOG_LEVEL not available", () => {
      process.env.LOG_LEVEL = "ERROR";
      const logger = new Logger("Test");
      expect(logger.getLogLevel()).toBe(LogLevel.ERROR);
    });

    it("should default to INFO when invalid level specified in environment", () => {
      (window as ExtendedWindow).LOG_LEVEL = "INVALID";
      const logger = new Logger("Test");
      expect(logger.getLogLevel()).toBe(LogLevel.INFO);
    });
  });

  describe("log level management", () => {
    it("should update log level when setLogLevel is called", () => {
      logger.setLogLevel(LogLevel.ERROR);
      expect(logger.getLogLevel()).toBe(LogLevel.ERROR);
    });

    it("should stop environment syncing when setLogLevel is called", () => {
      logger.setLogLevel(LogLevel.ERROR);
      (window as ExtendedWindow).LOG_LEVEL = "DEBUG";

      // Log something to trigger environment check
      logger.error("test");
      expect(logger.getLogLevel()).toBe(LogLevel.ERROR);
    });

    it("should update level when environment changes and syncing enabled", () => {
      (window as ExtendedWindow).LOG_LEVEL = "DEBUG";

      // Log something to trigger environment check
      logger.debug("test");
      expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
    });
  });

  describe("logging behavior", () => {
    beforeEach(() => {
      // Mock Date.toISOString for consistent timestamps in tests
      vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2024-01-01T00:00:00.000Z");
    });

    it("should format messages with timestamp, level, and prefix", () => {
      logger.info("test message");
      expect(consoleSpies.info).toHaveBeenCalledWith(
        "[2024-01-01T00:00:00.000Z] [INFO] [Test] test message",
      );
    });

    it("should pass through additional arguments", () => {
      const additionalArg = { key: "value" };
      logger.info("test message", additionalArg);
      expect(consoleSpies.info).toHaveBeenCalledWith(
        "[2024-01-01T00:00:00.000Z] [INFO] [Test] test message",
        additionalArg,
      );
    });

    describe("log level filtering", () => {
      it("should log all levels when level is DEBUG", () => {
        logger.setLogLevel(LogLevel.DEBUG);

        logger.debug("debug message");
        logger.info("info message");
        logger.warn("warn message");
        logger.error("error message");

        expect(consoleSpies.debug).toHaveBeenCalled();
        expect(consoleSpies.info).toHaveBeenCalled();
        expect(consoleSpies.warn).toHaveBeenCalled();
        expect(consoleSpies.error).toHaveBeenCalled();
      });

      it("should only log INFO and above when level is INFO", () => {
        logger.setLogLevel(LogLevel.INFO);

        logger.debug("debug message");
        logger.info("info message");
        logger.warn("warn message");
        logger.error("error message");

        expect(consoleSpies.debug).not.toHaveBeenCalled();
        expect(consoleSpies.info).toHaveBeenCalled();
        expect(consoleSpies.warn).toHaveBeenCalled();
        expect(consoleSpies.error).toHaveBeenCalled();
      });

      it("should only log WARN and above when level is WARN", () => {
        logger.setLogLevel(LogLevel.WARN);

        logger.debug("debug message");
        logger.info("info message");
        logger.warn("warn message");
        logger.error("error message");

        expect(consoleSpies.debug).not.toHaveBeenCalled();
        expect(consoleSpies.info).not.toHaveBeenCalled();
        expect(consoleSpies.warn).toHaveBeenCalled();
        expect(consoleSpies.error).toHaveBeenCalled();
      });

      it("should only log ERROR when level is ERROR", () => {
        logger.setLogLevel(LogLevel.ERROR);

        logger.debug("debug message");
        logger.info("info message");
        logger.warn("warn message");
        logger.error("error message");

        expect(consoleSpies.debug).not.toHaveBeenCalled();
        expect(consoleSpies.info).not.toHaveBeenCalled();
        expect(consoleSpies.warn).not.toHaveBeenCalled();
        expect(consoleSpies.error).toHaveBeenCalled();
      });
    });

    describe("environment change notification", () => {
      it("should log level change when environment changes and new level allows INFO", () => {
        (window as ExtendedWindow).LOG_LEVEL = "DEBUG";

        logger.debug("trigger check");
        expect(consoleSpies.info).toHaveBeenCalledWith(
          expect.stringContaining("Log level changed from INFO to DEBUG"),
        );
      });

      it("should not log level change when environment changes to higher level", () => {
        (window as ExtendedWindow).LOG_LEVEL = "ERROR";

        logger.error("trigger check");
        expect(consoleSpies.info).not.toHaveBeenCalledWith(
          expect.stringContaining("Log level changed"),
        );
      });
    });
  });

  describe("multiple logger instances", () => {
    let envLogger: Logger;
    let fixedLogger: Logger;

    beforeEach(() => {
      // Create one logger that follows environment and one with fixed level
      envLogger = new Logger("EnvLogger");
      fixedLogger = new Logger("FixedLogger", LogLevel.WARN);

      // Mock Date.toISOString for consistent timestamps in tests
      vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2024-01-01T00:00:00.000Z");
    });

    it("should maintain independent log levels", () => {
      envLogger.info("env logger info");
      fixedLogger.info("fixed logger info");

      // Initially, envLogger is INFO (default) and fixedLogger is WARN
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringContaining("[EnvLogger] env logger info"),
      );
      expect(consoleSpies.info).not.toHaveBeenCalledWith(
        expect.stringContaining("[FixedLogger] fixed logger info"),
      );
    });

    it("should only affect env-synced logger when environment changes", () => {
      // Change environment to DEBUG
      (window as ExtendedWindow).LOG_LEVEL = "DEBUG";

      // Trigger environment check for both loggers
      envLogger.debug("env logger debug");
      fixedLogger.debug("fixed logger debug");

      // envLogger should now be DEBUG level, fixedLogger should still be WARN
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("[EnvLogger] env logger debug"),
      );
      expect(consoleSpies.debug).not.toHaveBeenCalledWith(
        expect.stringContaining("[FixedLogger] fixed logger debug"),
      );

      // Verify fixedLogger still only logs WARN and above
      fixedLogger.warn("fixed logger warn");
      expect(consoleSpies.warn).toHaveBeenCalledWith(
        expect.stringContaining("[FixedLogger] fixed logger warn"),
      );
    });

    it("should handle multiple environment changes for env-synced logger", () => {
      // Start with DEBUG
      (window as ExtendedWindow).LOG_LEVEL = "DEBUG";
      envLogger.debug("first debug message");
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("[EnvLogger] first debug message"),
      );

      // Change to ERROR
      (window as ExtendedWindow).LOG_LEVEL = "ERROR";
      envLogger.debug("should not show");
      envLogger.error("should show");
      expect(consoleSpies.debug).toHaveBeenCalledTimes(1); // Only the first debug message
      expect(consoleSpies.error).toHaveBeenCalledWith(
        expect.stringContaining("[EnvLogger] should show"),
      );

      // Fixed logger should remain unchanged throughout
      fixedLogger.info("still warn level");
      fixedLogger.warn("this should show");
      expect(consoleSpies.info).not.toHaveBeenCalledWith(
        expect.stringContaining("[FixedLogger] still warn level"),
      );
      expect(consoleSpies.warn).toHaveBeenCalledWith(
        expect.stringContaining("[FixedLogger] this should show"),
      );
    });

    it("should allow env-synced logger to become fixed and vice versa", () => {
      // Start with environment DEBUG
      (window as ExtendedWindow).LOG_LEVEL = "DEBUG";
      envLogger.debug("env sync works");
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining("[EnvLogger] env sync works"),
      );

      // Fix the env logger to ERROR
      envLogger.setLogLevel(LogLevel.ERROR);
      (window as ExtendedWindow).LOG_LEVEL = "DEBUG";
      envLogger.debug("should not show after fixing");
      expect(consoleSpies.debug).toHaveBeenCalledTimes(1); // Only the first debug message

      // Allow fixed logger to follow env
      delete (window as ExtendedWindow).LOG_LEVEL; // Reset to default INFO
      fixedLogger = new Logger("FixedLogger"); // Recreate as env-synced
      fixedLogger.info("should show at info level");
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringContaining("[FixedLogger] should show at info level"),
      );
    });
  });

  describe("console-like methods", () => {
    beforeEach(() => {
      vi.spyOn(Date.prototype, "toISOString").mockReturnValue("2024-01-01T00:00:00.000Z");
    });

    describe("dir", () => {
      it("should call console.dir with object and options", () => {
        const obj = { test: "value" };
        const options = { depth: 2, colors: true };
        logger.setLogLevel(LogLevel.DEBUG);
        logger.dir(obj, options);
        expect(consoleSpies.dir).toHaveBeenCalledWith(obj, options);
      });

      it("should not call console.dir when level is above DEBUG", () => {
        logger.setLogLevel(LogLevel.INFO);
        logger.dir({ test: "value" });
        expect(consoleSpies.dir).not.toHaveBeenCalled();
      });
    });

    describe("group methods", () => {
      it("should increment group depth and log group label", () => {
        logger.group("Group 1");
        logger.log("Message 1");
        logger.group("Group 2");
        logger.log("Message 2");
        logger.groupEnd();
        logger.groupEnd();

        expect(consoleSpies.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test] Group 1",
        );
        expect(consoleSpies.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test]   Message 1",
        );
        expect(consoleSpies.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test]   Group 2",
        );
        expect(consoleSpies.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test]     Message 2",
        );
      });

      it("should handle groupCollapsed same as group", () => {
        logger.groupCollapsed("Collapsed Group");
        logger.log("Message");
        logger.groupEnd();

        expect(consoleSpies.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test] Collapsed Group",
        );
        expect(consoleSpies.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test]   Message",
        );
      });

      it("should not go below zero group depth", () => {
        logger.groupEnd(); // Try to go negative
        logger.log("Message");
        expect(consoleSpies.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test] Message",
        );
      });
    });

    describe("trace", () => {
      it("should log stack trace", () => {
        logger.setLogLevel(LogLevel.DEBUG);
        logger.trace();
        expect(consoleSpies.debug).toHaveBeenCalledWith(
          expect.stringMatching(/\[.*\] \[DEBUG\] \[Test\] .*at.*/),
        );
      });

      it("should include message with stack trace", () => {
        logger.setLogLevel(LogLevel.DEBUG);
        logger.trace("Error occurred");
        expect(consoleSpies.debug).toHaveBeenCalledWith(
          expect.stringMatching(/\[.*\] \[DEBUG\] \[Test\] Error occurred\n.*at.*/),
        );
      });

      it("should not log when level is above DEBUG", () => {
        logger.setLogLevel(LogLevel.INFO);
        logger.trace("Test");
        expect(consoleSpies.debug).not.toHaveBeenCalled();
      });
    });

    describe("table", () => {
      it("should log tabular data", () => {
        const data = [{ id: 1, name: "Test" }];
        logger.table(data);
        expect(consoleSpies.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test] Table Output:",
        );
        expect(consoleSpies.table).toHaveBeenCalledWith(data, undefined);
      });

      it("should log tabular data with specific columns", () => {
        const data = [{ id: 1, name: "Test", extra: "Hidden" }];
        logger.table(data, ["name"]);
        expect(consoleSpies.table).toHaveBeenCalledWith(data, ["name"]);
      });

      it("should handle invalid data", () => {
        logger.table("not an object");
        expect(consoleSpies.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test] Invalid data for table display",
        );
      });
    });

    describe("clear", () => {
      it("should call console.clear", () => {
        logger.clear();
        expect(consoleSpies.clear).toHaveBeenCalled();
      });
    });
  });
});
