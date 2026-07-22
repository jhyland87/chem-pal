import {
  resetConsoleMock,
  restoreConsoleMock,
  setupConsoleMock,
} from '@/suppliers/__tests__/helpers/consoleTestUtils';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger, LogLevel } from '../Logger';

// Define the extended Window interface
interface ExtendedWindow extends Window {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  LOG_LEVEL?: string;
}

describe('Logger', () => {
  let logger: Logger;
  let consoleSpies: ReturnType<typeof setupConsoleMock>;

  beforeAll(() => {
    consoleSpies = setupConsoleMock();
  });

  beforeEach(() => {
    resetConsoleMock();
    logger = new Logger('Test');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    // Reset environment variables
    delete (window as ExtendedWindow).LOG_LEVEL;
    delete process.env.LOG_LEVEL;
  });

  afterAll(() => {
    vi.useRealTimers();
    restoreConsoleMock();
  });

  describe('initialization', () => {
    it('should create logger with default DEBUG level in dev builds when no level specified', () => {
      delete process.env.LOG_LEVEL;
      // Vitest runs with MODE === "test" which is treated as a dev build,
      // so the build-mode default is DEBUG.
      expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
    });

    it('should create logger with specified level', () => {
      const logger = new Logger('Test', LogLevel.DEBUG);
      expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
    });

    it('should use window.LOG_LEVEL when available', () => {
      (window as ExtendedWindow).LOG_LEVEL = 'WARN';
      const logger = new Logger('Test');
      expect(logger.getLogLevel()).toBe(LogLevel.WARN);
    });

    it('should fall back to process.env.LOG_LEVEL when window.LOG_LEVEL not available', () => {
      process.env.LOG_LEVEL = 'ERROR';
      const logger = new Logger('Test');
      expect(logger.getLogLevel()).toBe(LogLevel.ERROR);
    });

    it('should fall back to the build-mode default when an invalid level is specified', () => {
      (window as ExtendedWindow).LOG_LEVEL = 'INVALID';
      const logger = new Logger('Test');
      // Build-mode default under Vitest (MODE === "test") is DEBUG.
      expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
    });
  });

  describe('log level management', () => {
    it('should update log level when setLogLevel is called', () => {
      logger.setLogLevel(LogLevel.ERROR);
      expect(logger.getLogLevel()).toBe(LogLevel.ERROR);
    });

    it('should stop environment syncing when setLogLevel is called', () => {
      logger.setLogLevel(LogLevel.ERROR);
      (window as ExtendedWindow).LOG_LEVEL = 'DEBUG';

      // Log something to trigger environment check
      logger.error('test');
      expect(logger.getLogLevel()).toBe(LogLevel.ERROR);
    });

    it('should update level when environment changes and syncing enabled', () => {
      (window as ExtendedWindow).LOG_LEVEL = 'DEBUG';

      // Log something to trigger environment check
      logger.debug('test');
      expect(logger.getLogLevel()).toBe(LogLevel.DEBUG);
    });
  });

  describe('logging behavior', () => {
    beforeEach(() => {
      // Mock Date.toISOString for consistent timestamps in tests
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T00:00:00.000Z');
    });

    it('should format messages with timestamp, level, and prefix', () => {
      logger.info('test message');
      expect(consoleSpies.info).toHaveBeenCalledWith(
        '[2024-01-01T00:00:00.000Z] [INFO] [Test] test message',
      );
    });

    it('should pass through additional arguments', () => {
      const additionalArg = { key: 'value' };
      logger.info('test message', additionalArg);
      expect(consoleSpies.info).toHaveBeenCalledWith(
        '[2024-01-01T00:00:00.000Z] [INFO] [Test] test message',
        additionalArg,
      );
    });

    describe('log level filtering', () => {
      it('should log all levels when level is DEBUG', () => {
        logger.setLogLevel(LogLevel.DEBUG);

        logger.debug('debug message');
        logger.info('info message');
        logger.warn('warn message');
        logger.error('error message');

        expect(consoleSpies.debug).toHaveBeenCalled();
        expect(consoleSpies.info).toHaveBeenCalled();
        expect(consoleSpies.warn).toHaveBeenCalled();
        expect(consoleSpies.error).toHaveBeenCalled();
      });

      it('should only log INFO and above when level is INFO', () => {
        logger.setLogLevel(LogLevel.INFO);

        logger.debug('debug message');
        logger.info('info message');
        logger.warn('warn message');
        logger.error('error message');

        expect(consoleSpies.debug).not.toHaveBeenCalled();
        expect(consoleSpies.info).toHaveBeenCalled();
        expect(consoleSpies.warn).toHaveBeenCalled();
        expect(consoleSpies.error).toHaveBeenCalled();
      });

      it('should only log WARN and above when level is WARN', () => {
        logger.setLogLevel(LogLevel.WARN);

        logger.debug('debug message');
        logger.info('info message');
        logger.warn('warn message');
        logger.error('error message');

        expect(consoleSpies.debug).not.toHaveBeenCalled();
        expect(consoleSpies.info).not.toHaveBeenCalled();
        expect(consoleSpies.warn).toHaveBeenCalled();
        expect(consoleSpies.error).toHaveBeenCalled();
      });

      it('should only log ERROR when level is ERROR', () => {
        logger.setLogLevel(LogLevel.ERROR);

        logger.debug('debug message');
        logger.info('info message');
        logger.warn('warn message');
        logger.error('error message');

        expect(consoleSpies.debug).not.toHaveBeenCalled();
        expect(consoleSpies.info).not.toHaveBeenCalled();
        expect(consoleSpies.warn).not.toHaveBeenCalled();
        expect(consoleSpies.error).toHaveBeenCalled();
      });
    });

    describe('environment change notification', () => {
      it('should log level change when environment changes and new level allows INFO', () => {
        // Start from a level that suppresses the change message so the
        // assertion isn't polluted by the default DEBUG behavior.
        (window as ExtendedWindow).LOG_LEVEL = 'ERROR';
        logger.error('prime to ERROR');
        consoleSpies.info.mockClear();

        (window as ExtendedWindow).LOG_LEVEL = 'INFO';
        logger.info('trigger check');
        expect(consoleSpies.info).toHaveBeenCalledWith(
          expect.stringContaining('Log level changed from ERROR to INFO'),
        );
      });

      it('should not log level change when environment changes to higher level', () => {
        (window as ExtendedWindow).LOG_LEVEL = 'ERROR';

        logger.error('trigger check');
        expect(consoleSpies.info).not.toHaveBeenCalledWith(
          expect.stringContaining('Log level changed'),
        );
      });
    });
  });

  describe('multiple logger instances', () => {
    let envLogger: Logger;
    let fixedLogger: Logger;

    beforeEach(() => {
      // Create one logger that follows environment and one with fixed level
      envLogger = new Logger('EnvLogger');
      fixedLogger = new Logger('FixedLogger', LogLevel.WARN);

      // Mock Date.toISOString for consistent timestamps in tests
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T00:00:00.000Z');
    });

    it('should maintain independent log levels', () => {
      envLogger.info('env logger info');
      fixedLogger.info('fixed logger info');

      // Initially, envLogger is INFO (default) and fixedLogger is WARN
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringContaining('[EnvLogger] env logger info'),
      );
      expect(consoleSpies.info).not.toHaveBeenCalledWith(
        expect.stringContaining('[FixedLogger] fixed logger info'),
      );
    });

    it('should only affect env-synced logger when environment changes', () => {
      // Change environment to DEBUG
      (window as ExtendedWindow).LOG_LEVEL = 'DEBUG';

      // Trigger environment check for both loggers
      envLogger.debug('env logger debug');
      fixedLogger.debug('fixed logger debug');

      // envLogger should now be DEBUG level, fixedLogger should still be WARN
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining('[EnvLogger] env logger debug'),
      );
      expect(consoleSpies.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('[FixedLogger] fixed logger debug'),
      );

      // Verify fixedLogger still only logs WARN and above
      fixedLogger.warn('fixed logger warn');
      expect(consoleSpies.warn).toHaveBeenCalledWith(
        expect.stringContaining('[FixedLogger] fixed logger warn'),
      );
    });

    it('should handle multiple environment changes for env-synced logger', () => {
      // Start with DEBUG
      (window as ExtendedWindow).LOG_LEVEL = 'DEBUG';
      envLogger.debug('first debug message');
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining('[EnvLogger] first debug message'),
      );

      // Change to ERROR
      (window as ExtendedWindow).LOG_LEVEL = 'ERROR';
      envLogger.debug('should not show');
      envLogger.error('should show');
      expect(consoleSpies.debug).toHaveBeenCalledTimes(1); // Only the first debug message
      expect(consoleSpies.error).toHaveBeenCalledWith(
        expect.stringContaining('[EnvLogger] should show'),
      );

      // Fixed logger should remain unchanged throughout
      fixedLogger.info('still warn level');
      fixedLogger.warn('this should show');
      expect(consoleSpies.info).not.toHaveBeenCalledWith(
        expect.stringContaining('[FixedLogger] still warn level'),
      );
      expect(consoleSpies.warn).toHaveBeenCalledWith(
        expect.stringContaining('[FixedLogger] this should show'),
      );
    });

    it('should allow env-synced logger to become fixed and vice versa', () => {
      // Start with environment DEBUG
      (window as ExtendedWindow).LOG_LEVEL = 'DEBUG';
      envLogger.debug('env sync works');
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining('[EnvLogger] env sync works'),
      );

      // Fix the env logger to ERROR
      envLogger.setLogLevel(LogLevel.ERROR);
      (window as ExtendedWindow).LOG_LEVEL = 'DEBUG';
      envLogger.debug('should not show after fixing');
      expect(consoleSpies.debug).toHaveBeenCalledTimes(1); // Only the first debug message

      // Allow fixed logger to follow env
      delete (window as ExtendedWindow).LOG_LEVEL; // Reset to default INFO
      fixedLogger = new Logger('FixedLogger'); // Recreate as env-synced
      fixedLogger.info('should show at info level');
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringContaining('[FixedLogger] should show at info level'),
      );
    });
  });

  describe('sub / child loggers', () => {
    beforeEach(() => {
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T00:00:00.000Z');
    });

    it("should append the suffix to the prefix with a '|' separator", () => {
      const parent = new Logger('SupplierBase');
      parent.sub('httpPostFormData').log('Hello');
      expect(consoleSpies.log).toHaveBeenCalledWith(
        '[2024-01-01T00:00:00.000Z] [INFO] [SupplierBase|httpPostFormData] Hello',
      );
    });

    it('should stack separators when chained to any depth', () => {
      logger.sub('a').sub('b').sub('c').info('x');
      expect(consoleSpies.info).toHaveBeenCalledWith(
        '[2024-01-01T00:00:00.000Z] [INFO] [Test|a|b|c] x',
      );
    });

    it('should pass through additional arguments', () => {
      const additionalArg = { key: 'value' };
      logger.sub('child').info('test message', additionalArg);
      expect(consoleSpies.info).toHaveBeenCalledWith(
        '[2024-01-01T00:00:00.000Z] [INFO] [Test|child] test message',
        additionalArg,
      );
    });

    it('should not mutate the parent prefix', () => {
      logger.sub('child');
      logger.info('parent message');
      expect(consoleSpies.info).toHaveBeenCalledWith(
        '[2024-01-01T00:00:00.000Z] [INFO] [Test] parent message',
      );
    });

    it('should inherit env syncing from an env-synced parent', () => {
      const child = new Logger('Parent').sub('child');
      (window as ExtendedWindow).LOG_LEVEL = 'DEBUG';
      child.debug('child debug');
      expect(consoleSpies.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Parent|child] child debug'),
      );
    });

    it('should inherit a fixed level from a fixed-level parent', () => {
      const child = new Logger('Parent', LogLevel.WARN).sub('child');
      // A conflicting environment level must be ignored by the fixed-level child.
      (window as ExtendedWindow).LOG_LEVEL = 'DEBUG';

      child.info('suppressed info');
      child.warn('shown warn');

      expect(consoleSpies.info).not.toHaveBeenCalledWith(
        expect.stringContaining('[Parent|child] suppressed info'),
      );
      expect(consoleSpies.warn).toHaveBeenCalledWith(
        expect.stringContaining('[Parent|child] shown warn'),
      );
      expect(child.getLogLevel()).toBe(LogLevel.WARN);
    });
  });

  describe('colorized output', () => {
    it('emits a %c format string (time, prefix chip, message) when a color is set', () => {
      const logger = new Logger('SupplierAmbeed', LogLevel.DEBUG, '#fa938e');
      logger.info('hi');
      expect(consoleSpies.info).toHaveBeenCalledWith(
        // Timestamp is locale-formatted, so match the stable tail rather than the exact time.
        expect.stringMatching(/^%c.* %cSupplierAmbeed%c hi$/),
        expect.stringContaining('border-left:5px solid #4d7df2'),
        expect.stringContaining('background:#fa938e'),
        expect.stringContaining('color:inherit'),
      );
    });

    it('encodes the level as the left border color, not a text tag', () => {
      const logger = new Logger('Sup', LogLevel.DEBUG, '#fa938e');
      logger.error('boom');
      const [format, borderStyle] = consoleSpies.error.mock.calls.at(-1) ?? [];
      // No level word in the visible text; the border carries the severity color.
      expect(String(format)).toContain('%cSup%c boom');
      expect(String(format)).not.toContain('ERROR');
      expect(String(borderStyle)).toContain('border-left:5px solid #e5484d');
    });

    it('uses a contrasting chip text color for the prefix', () => {
      const logger = new Logger('Sup', LogLevel.DEBUG, '#5c6bc0');
      logger.info('x');
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('border-left:5px solid'),
        expect.stringContaining('color:#ffffff'),
        expect.anything(),
      );
    });

    it('passes extra arguments through after the style args', () => {
      const logger = new Logger('Sup', LogLevel.DEBUG, '#fa938e');
      const meta = { a: 1 };
      logger.warn('w', meta);
      expect(consoleSpies.warn).toHaveBeenCalledWith(
        expect.stringContaining('%cSup%c w'),
        expect.stringContaining('border-left:5px solid #f5a623'),
        expect.stringContaining('background:#fa938e'),
        expect.anything(),
        meta,
      );
    });

    it('propagates the color to child loggers via sub()', () => {
      const child = new Logger('Sup', LogLevel.DEBUG, '#82ca9d').sub('http');
      child.info('x');
      expect(consoleSpies.info).toHaveBeenCalledWith(
        expect.stringContaining('%cSup|http%c x'),
        expect.anything(),
        // #82ca9d → rgb(130, 202, 157); the chip is now dimmed (alpha < 1).
        expect.stringContaining('rgba(130, 202, 157'),
        expect.anything(),
      );
    });

    it('dims the chip a step further for each sub() level', () => {
      const chipOf = (logger: Logger): string => {
        logger.info('x');
        return String(consoleSpies.info.mock.calls.at(-1)?.[2]);
      };
      const base = new Logger('Sup', LogLevel.DEBUG, '#82ca9d');
      // Base is the solid hex; nesting switches to progressively lower alpha.
      expect(chipOf(base)).toContain('background:#82ca9d');
      expect(chipOf(base.sub('a'))).toContain('rgba(130, 202, 157, 0.88)');
      expect(chipOf(base.sub('a').sub('b'))).toContain('rgba(130, 202, 157, 0.76)');
    });

    it('toggles colorization on and off via setColor', () => {
      const logger = new Logger('Sup', LogLevel.DEBUG);
      logger.info('plain');
      expect(consoleSpies.info).toHaveBeenLastCalledWith(
        '[2024-01-01T00:00:00.000Z] [INFO] [Sup] plain',
      );

      logger.setColor('#8884d8');
      logger.info('colored');
      expect(consoleSpies.info).toHaveBeenLastCalledWith(
        expect.stringContaining('%c'),
        expect.stringContaining('border-left:5px solid'),
        expect.stringContaining('background:#8884d8'),
        expect.anything(),
      );

      logger.setColor(undefined);
      logger.info('plain again');
      expect(consoleSpies.info).toHaveBeenLastCalledWith(
        '[2024-01-01T00:00:00.000Z] [INFO] [Sup] plain again',
      );
    });

    it('leaves uncolored loggers as a single plain string', () => {
      const logger = new Logger('Sup', LogLevel.DEBUG);
      logger.log('hello');
      expect(consoleSpies.log.mock.calls.at(-1)).toEqual([
        '[2024-01-01T00:00:00.000Z] [INFO] [Sup] hello',
      ]);
    });
  });

  describe('console-like methods', () => {
    beforeEach(() => {
      vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T00:00:00.000Z');
    });

    describe('dir', () => {
      it('should call console.dir with object and options', () => {
        const obj = { test: 'value' };
        const options = { depth: 2, colors: true };
        logger.setLogLevel(LogLevel.DEBUG);
        logger.dir(obj, options);
        expect(consoleSpies.dir).toHaveBeenCalledWith(obj, options);
      });

      it('should not call console.dir when level is above DEBUG', () => {
        logger.setLogLevel(LogLevel.INFO);
        logger.dir({ test: 'value' });
        expect(consoleSpies.dir).not.toHaveBeenCalled();
      });
    });

    describe('group methods', () => {
      it('should increment group depth and log group label', () => {
        logger.group('Group 1');
        logger.log('Message 1');
        logger.group('Group 2');
        logger.log('Message 2');
        logger.groupEnd();
        logger.groupEnd();

        expect(consoleSpies.log).toHaveBeenCalledWith(
          '[2024-01-01T00:00:00.000Z] [INFO] [Test] Group 1',
        );
        expect(consoleSpies.log).toHaveBeenCalledWith(
          '[2024-01-01T00:00:00.000Z] [INFO] [Test]   Message 1',
        );
        expect(consoleSpies.log).toHaveBeenCalledWith(
          '[2024-01-01T00:00:00.000Z] [INFO] [Test]   Group 2',
        );
        expect(consoleSpies.log).toHaveBeenCalledWith(
          '[2024-01-01T00:00:00.000Z] [INFO] [Test]     Message 2',
        );
      });

      it('should handle groupCollapsed same as group', () => {
        logger.groupCollapsed('Collapsed Group');
        logger.log('Message');
        logger.groupEnd();

        expect(consoleSpies.log).toHaveBeenCalledWith(
          '[2024-01-01T00:00:00.000Z] [INFO] [Test] Collapsed Group',
        );
        expect(consoleSpies.log).toHaveBeenCalledWith(
          '[2024-01-01T00:00:00.000Z] [INFO] [Test]   Message',
        );
      });

      it('should not go below zero group depth', () => {
        logger.groupEnd(); // Try to go negative
        logger.log('Message');
        expect(consoleSpies.log).toHaveBeenCalledWith(
          '[2024-01-01T00:00:00.000Z] [INFO] [Test] Message',
        );
      });
    });

    describe('trace', () => {
      it('should log stack trace', () => {
        logger.setLogLevel(LogLevel.DEBUG);
        logger.trace();
        expect(consoleSpies.debug).toHaveBeenCalledWith(
          expect.stringMatching(/\[.*\] \[DEBUG\] \[Test\] .*at.*/),
        );
      });

      it('should include message with stack trace', () => {
        logger.setLogLevel(LogLevel.DEBUG);
        logger.trace('Error occurred');
        expect(consoleSpies.debug).toHaveBeenCalledWith(
          expect.stringMatching(/\[.*\] \[DEBUG\] \[Test\] Error occurred\n.*at.*/),
        );
      });

      it('should not log when level is above DEBUG', () => {
        logger.setLogLevel(LogLevel.INFO);
        logger.trace('Test');
        expect(consoleSpies.debug).not.toHaveBeenCalled();
      });
    });

    describe('table', () => {
      it('should log tabular data', () => {
        const data = [{ id: 1, name: 'Test' }];
        logger.table(data);
        expect(consoleSpies.log).toHaveBeenCalledWith(
          '[2024-01-01T00:00:00.000Z] [INFO] [Test] Table Output:',
        );
        expect(consoleSpies.table).toHaveBeenCalledWith(data, undefined);
      });

      it('should log tabular data with specific columns', () => {
        const data = [{ id: 1, name: 'Test', extra: 'Hidden' }];
        logger.table(data, ['name']);
        expect(consoleSpies.table).toHaveBeenCalledWith(data, ['name']);
      });

      it('should handle invalid data', () => {
        logger.table('not an object');
        expect(consoleSpies.log).toHaveBeenCalledWith(
          '[2024-01-01T00:00:00.000Z] [INFO] [Test] Invalid data for table display',
        );
      });
    });

    describe('clear', () => {
      it('should call console.clear', () => {
        logger.clear();
        expect(consoleSpies.clear).toHaveBeenCalled();
      });
    });

    describe('log and debug formatting', () => {
      it('should format log() output at INFO level', () => {
        logger.log('app started');
        expect(consoleSpies.log).toHaveBeenCalledWith(
          '[2024-01-01T00:00:00.000Z] [INFO] [Test] app started',
        );
      });

      it('should format debug() output at DEBUG level with pass-through args', () => {
        const payload = { userId: 123 };
        logger.debug('processing', payload);
        expect(consoleSpies.debug).toHaveBeenCalledWith(
          '[2024-01-01T00:00:00.000Z] [DEBUG] [Test] processing',
          payload,
        );
      });
    });

    describe('count and countReset', () => {
      it('should increment a named counter on each call', () => {
        logger.count('api-requests');
        logger.count('api-requests');
        expect(consoleSpies.log).toHaveBeenCalledWith(
          '[2024-01-01T00:00:00.000Z] [INFO] [Test] api-requests: 1',
        );
        expect(consoleSpies.log).toHaveBeenCalledWith(
          '[2024-01-01T00:00:00.000Z] [INFO] [Test] api-requests: 2',
        );
      });

      it("should use the 'default' label when none is provided", () => {
        logger.count();
        expect(consoleSpies.log).toHaveBeenCalledWith(
          '[2024-01-01T00:00:00.000Z] [INFO] [Test] default: 1',
        );
      });

      it('should restart the count after countReset', () => {
        logger.count('hits');
        logger.count('hits');
        logger.countReset('hits');
        logger.count('hits');
        expect(consoleSpies.log).toHaveBeenLastCalledWith(
          '[2024-01-01T00:00:00.000Z] [INFO] [Test] hits: 1',
        );
      });

      it('should not log counts when level is above INFO', () => {
        logger.setLogLevel(LogLevel.WARN);
        logger.count('hidden');
        expect(consoleSpies.log).not.toHaveBeenCalled();
      });
    });

    describe('timers', () => {
      beforeEach(() => {
        let now = 1000;
        // Deterministic, monotonically increasing durations for timer output.
        vi.spyOn(performance, 'now').mockImplementation(() => {
          now += 500;
          return now;
        });
      });

      it('should log a started message when a timer begins', () => {
        logger.time('task');
        expect(consoleSpies.debug).toHaveBeenCalledWith(
          "[2024-01-01T00:00:00.000Z] [DEBUG] [Test] Timer 'task' started",
        );
      });

      it('should warn when starting a timer that already exists', () => {
        logger.time('task');
        logger.time('task');
        expect(consoleSpies.warn).toHaveBeenCalledWith(
          expect.stringContaining("Timer 'task' already exists"),
        );
      });

      it('should log the elapsed time on timeEnd', () => {
        logger.time('task');
        logger.timeEnd('task');
        expect(consoleSpies.debug).toHaveBeenCalledWith(
          expect.stringMatching(/\[DEBUG\] \[Test\] Timer 'task': \d+\.\d{2}ms/),
        );
      });

      it('should warn on timeEnd for a non-existent timer', () => {
        logger.timeEnd('missing');
        expect(consoleSpies.warn).toHaveBeenCalledWith(
          expect.stringContaining("Timer 'missing' does not exist"),
        );
      });

      it('should log elapsed time without stopping the timer on timeLog', () => {
        logger.time('task');
        logger.timeLog('task', { step: 1 });
        expect(consoleSpies.debug).toHaveBeenCalledWith(
          expect.stringMatching(/\[DEBUG\] \[Test\] Timer 'task': \d+\.\d{2}ms/),
          { step: 1 },
        );
      });

      it('should warn on timeLog for a non-existent timer', () => {
        logger.timeLog('missing');
        expect(consoleSpies.warn).toHaveBeenCalledWith(
          expect.stringContaining("Timer 'missing' does not exist"),
        );
      });
    });

    describe('timeStamp', () => {
      it('should log a labeled timestamp at DEBUG level', () => {
        logger.timeStamp('checkpoint');
        expect(consoleSpies.debug).toHaveBeenCalledWith(
          expect.stringContaining("[DEBUG] [Test] Timestamp 'checkpoint':"),
        );
      });

      it('should log an unlabeled timestamp at DEBUG level', () => {
        logger.timeStamp();
        expect(consoleSpies.debug).toHaveBeenCalledWith(
          expect.stringMatching(/\[DEBUG\] \[Test\] Timestamp: .+/),
        );
      });

      it('should not log when level is above DEBUG', () => {
        logger.setLogLevel(LogLevel.INFO);
        logger.timeStamp('checkpoint');
        expect(consoleSpies.debug).not.toHaveBeenCalled();
      });
    });

    describe('setEnvLogLevel', () => {
      it('should write the level to window and process env so new loggers pick it up', () => {
        Logger.setEnvLogLevel(LogLevel.ERROR);
        expect((window as ExtendedWindow).LOG_LEVEL).toBe(LogLevel.ERROR);
        expect(process.env.LOG_LEVEL).toBe(LogLevel.ERROR);
        expect(new Logger('Fresh').getLogLevel()).toBe(LogLevel.ERROR);
      });
    });
  });
});
