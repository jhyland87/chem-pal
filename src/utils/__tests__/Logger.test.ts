import { Logger, LogLevel } from "../Logger";

// Define the extended Window interface
interface ExtendedWindow extends Window {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  LOG_LEVEL?: string;
}

describe("Logger", () => {
  // Store original console methods
  const originalConsole = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  // Mock console methods before each test
  beforeEach(() => {
    console.debug = jest.fn();
    console.info = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();

    // Reset environment variables
    delete (window as ExtendedWindow).LOG_LEVEL;
    delete process.env.LOG_LEVEL;
  });

  // Restore original console methods after each test
  afterEach(() => {
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe("initialization", () => {
    it("should create logger with default INFO level when no level specified", () => {
      const logger = new Logger("Test");
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
      const logger = new Logger("Test", LogLevel.DEBUG);
      logger.setLogLevel(LogLevel.ERROR);
      expect(logger.getLogLevel()).toBe(LogLevel.ERROR);
    });

    it("should stop environment syncing when setLogLevel is called", () => {
      const logger = new Logger("Test");
      logger.setLogLevel(LogLevel.ERROR);
      (window as ExtendedWindow).LOG_LEVEL = "DEBUG";

      // Log something to trigger environment check
      logger.error("test");
      expect(logger.getLogLevel()).toBe(LogLevel.ERROR);
    });

    it("should update level when environment changes and syncing enabled", () => {
      const logger = new Logger("Test");
      (window as ExtendedWindow).LOG_LEVEL = "DEBUG";

      // Log something to trigger environment check
      logger.debug("test");
      expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
    });
  });

  describe("logging behavior", () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger("Test");
      // Mock Date.toISOString for consistent timestamps in tests
      jest.spyOn(Date.prototype, "toISOString").mockReturnValue("2024-01-01T00:00:00.000Z");
    });

    it("should format messages with timestamp, level, and prefix", () => {
      logger.info("test message");
      expect(console.info).toHaveBeenCalledWith(
        "[2024-01-01T00:00:00.000Z] [INFO] [Test] test message",
      );
    });

    it("should pass through additional arguments", () => {
      const additionalArg = { key: "value" };
      logger.info("test message", additionalArg);
      expect(console.info).toHaveBeenCalledWith(
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

        expect(console.debug).toHaveBeenCalled();
        expect(console.info).toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();
      });

      it("should only log INFO and above when level is INFO", () => {
        logger.setLogLevel(LogLevel.INFO);

        logger.debug("debug message");
        logger.info("info message");
        logger.warn("warn message");
        logger.error("error message");

        expect(console.debug).not.toHaveBeenCalled();
        expect(console.info).toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();
      });

      it("should only log WARN and above when level is WARN", () => {
        logger.setLogLevel(LogLevel.WARN);

        logger.debug("debug message");
        logger.info("info message");
        logger.warn("warn message");
        logger.error("error message");

        expect(console.debug).not.toHaveBeenCalled();
        expect(console.info).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();
      });

      it("should only log ERROR when level is ERROR", () => {
        logger.setLogLevel(LogLevel.ERROR);

        logger.debug("debug message");
        logger.info("info message");
        logger.warn("warn message");
        logger.error("error message");

        expect(console.debug).not.toHaveBeenCalled();
        expect(console.info).not.toHaveBeenCalled();
        expect(console.warn).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();
      });
    });

    describe("environment change notification", () => {
      it("should log level change when environment changes and new level allows INFO", () => {
        const logger = new Logger("Test");
        (window as ExtendedWindow).LOG_LEVEL = "DEBUG";

        logger.debug("trigger check");
        expect(console.info).toHaveBeenCalledWith(
          expect.stringContaining("Log level changed from INFO to DEBUG"),
        );
      });

      it("should not log level change when environment changes to higher level", () => {
        const logger = new Logger("Test");
        (window as ExtendedWindow).LOG_LEVEL = "ERROR";

        logger.error("trigger check");
        expect(console.info).not.toHaveBeenCalledWith(expect.stringContaining("Log level changed"));
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
      jest.spyOn(Date.prototype, "toISOString").mockReturnValue("2024-01-01T00:00:00.000Z");
    });

    it("should maintain independent log levels", () => {
      envLogger.info("env logger info");
      fixedLogger.info("fixed logger info");

      // Initially, envLogger is INFO (default) and fixedLogger is WARN
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining("[EnvLogger] env logger info"),
      );
      expect(console.info).not.toHaveBeenCalledWith(
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
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining("[EnvLogger] env logger debug"),
      );
      expect(console.debug).not.toHaveBeenCalledWith(
        expect.stringContaining("[FixedLogger] fixed logger debug"),
      );

      // Verify fixedLogger still only logs WARN and above
      fixedLogger.warn("fixed logger warn");
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("[FixedLogger] fixed logger warn"),
      );
    });

    it("should handle multiple environment changes for env-synced logger", () => {
      // Start with DEBUG
      (window as ExtendedWindow).LOG_LEVEL = "DEBUG";
      envLogger.debug("first debug message");
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining("[EnvLogger] first debug message"),
      );

      // Change to ERROR
      (window as ExtendedWindow).LOG_LEVEL = "ERROR";
      envLogger.debug("should not show");
      envLogger.error("should show");
      expect(console.debug).toHaveBeenCalledTimes(1); // Only the first debug message
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("[EnvLogger] should show"),
      );

      // Fixed logger should remain unchanged throughout
      fixedLogger.info("still warn level");
      fixedLogger.warn("this should show");
      expect(console.info).not.toHaveBeenCalledWith(
        expect.stringContaining("[FixedLogger] still warn level"),
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("[FixedLogger] this should show"),
      );
    });

    it("should allow env-synced logger to become fixed and vice versa", () => {
      // Start with environment DEBUG
      (window as ExtendedWindow).LOG_LEVEL = "DEBUG";
      envLogger.debug("env sync works");
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining("[EnvLogger] env sync works"),
      );

      // Fix the env logger to ERROR
      envLogger.setLogLevel(LogLevel.ERROR);
      (window as ExtendedWindow).LOG_LEVEL = "DEBUG";
      envLogger.debug("should not show after fixing");
      expect(console.debug).toHaveBeenCalledTimes(1); // Only the first debug message

      // Allow fixed logger to follow env
      delete (window as ExtendedWindow).LOG_LEVEL; // Reset to default INFO
      fixedLogger = new Logger("FixedLogger"); // Recreate as env-synced
      fixedLogger.info("should show at info level");
      expect(console.info).toHaveBeenCalledWith(
        expect.stringContaining("[FixedLogger] should show at info level"),
      );
    });
  });
});
