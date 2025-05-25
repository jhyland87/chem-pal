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

  describe("console-like methods", () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger("Test", LogLevel.DEBUG);
      jest.spyOn(Date.prototype, "toISOString").mockReturnValue("2024-01-01T00:00:00.000Z");
      // Mock additional console methods
      console.dir = jest.fn();
      console.clear = jest.fn();
      console.table = jest.fn();
      console.timeStamp = jest.fn();
      // Mock performance.now()
      jest
        .spyOn(performance, "now")
        .mockReturnValueOnce(1000) // First call (time start)
        .mockReturnValueOnce(2500) // Second call (timeEnd/timeLog)
        .mockReturnValueOnce(3000); // Third call (another timeEnd/timeLog)
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    describe("dir", () => {
      it("should call console.dir with object and options", () => {
        const obj = { test: "value" };
        const options = { depth: 2, colors: true };
        logger.dir(obj, options);
        expect(console.dir).toHaveBeenCalledWith(obj, options);
      });

      it("should not call console.dir when level is above DEBUG", () => {
        logger.setLogLevel(LogLevel.INFO);
        logger.dir({ test: "value" });
        expect(console.dir).not.toHaveBeenCalled();
      });
    });

    describe("count and countReset", () => {
      it("should increment counter and log count", () => {
        logger.count("test");
        logger.count("test");
        expect(console.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test] test: 1",
        );
        expect(console.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test] test: 2",
        );
      });

      it("should use 'default' label when none provided", () => {
        logger.count();
        expect(console.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test] default: 1",
        );
      });

      it("should reset counter", () => {
        logger.count("test");
        logger.countReset("test");
        logger.count("test");
        expect(console.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test] test: 1",
        );
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

        expect(console.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test] Group 1",
        );
        expect(console.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test]   Message 1",
        );
        expect(console.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test]   Group 2",
        );
        expect(console.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test]     Message 2",
        );
      });

      it("should handle groupCollapsed same as group", () => {
        logger.groupCollapsed("Collapsed Group");
        logger.log("Message");
        logger.groupEnd();

        expect(console.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test] Collapsed Group",
        );
        expect(console.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test]   Message",
        );
      });

      it("should not go below zero group depth", () => {
        logger.groupEnd(); // Try to go negative
        logger.log("Message");
        expect(console.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test] Message",
        );
      });
    });

    describe("trace", () => {
      it("should log stack trace", () => {
        logger.trace();
        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/\[.*\] \[DEBUG\] \[Test\] .*at.*/),
        );
      });

      it("should include message with stack trace", () => {
        logger.trace("Error occurred");
        expect(console.debug).toHaveBeenCalledWith(
          expect.stringMatching(/\[.*\] \[DEBUG\] \[Test\] Error occurred\n.*at.*/),
        );
      });

      it("should not log when level is above DEBUG", () => {
        logger.setLogLevel(LogLevel.INFO);
        logger.trace("Test");
        expect(console.debug).not.toHaveBeenCalled();
      });
    });

    describe("table", () => {
      it("should log tabular data", () => {
        const data = [{ id: 1, name: "Test" }];
        logger.table(data);
        expect(console.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test] Table Output:",
        );
        expect(console.table).toHaveBeenCalledWith(data, undefined);
      });

      it("should log tabular data with specific columns", () => {
        const data = [{ id: 1, name: "Test", extra: "Hidden" }];
        logger.table(data, ["name"]);
        expect(console.table).toHaveBeenCalledWith(data, ["name"]);
      });

      it("should handle invalid data", () => {
        logger.table("not an object");
        expect(console.log).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [INFO] [Test] Invalid data for table display",
        );
      });
    });

    describe("timing methods", () => {
      it("should track timer duration", () => {
        logger.time("test");
        logger.timeEnd("test");
        expect(console.debug).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [DEBUG] [Test] Timer 'test' started",
        );
        expect(console.debug).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [DEBUG] [Test] Timer 'test': 1500.00ms",
        );
      });

      it("should handle timeLog with additional data", () => {
        logger.time("test");
        logger.timeLog("test", { progress: "50%" });
        expect(console.debug).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [DEBUG] [Test] Timer 'test': 1500.00ms",
          { progress: "50%" },
        );
      });

      it("should warn when ending non-existent timer", () => {
        logger.timeEnd("nonexistent");
        expect(console.warn).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [WARN] [Test] Timer 'nonexistent' does not exist",
        );
      });

      it("should warn when logging non-existent timer", () => {
        logger.timeLog("nonexistent");
        expect(console.warn).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [WARN] [Test] Timer 'nonexistent' does not exist",
        );
      });

      it("should warn when starting duplicate timer", () => {
        logger.time("test");
        logger.time("test");
        expect(console.warn).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [WARN] [Test] Timer 'test' already exists",
        );
      });
    });

    describe("timeStamp", () => {
      it("should use console.timeStamp when available", () => {
        logger.timeStamp("event");
        expect(console.timeStamp).toHaveBeenCalledWith("event");
        expect(console.debug).toHaveBeenCalledWith(expect.stringContaining("Timestamp 'event':"));
      });

      it("should fallback to debug log when timeStamp not available", () => {
        console.timeStamp = undefined as unknown as typeof console.timeStamp;
        logger.timeStamp("event");
        expect(console.debug).toHaveBeenCalledWith(expect.stringContaining("Timestamp 'event':"));
      });

      it("should handle unlabeled timestamps", () => {
        logger.timeStamp();
        expect(console.debug).toHaveBeenCalledWith(expect.stringContaining("Timestamp: "));
      });
    });

    describe("clear", () => {
      it("should call console.clear", () => {
        logger.clear();
        expect(console.clear).toHaveBeenCalled();
      });
    });
  });
});
