/**
 * A flexible logging utility that supports different log levels and prefixed output.
 *
 * @remarks
 * Works in both Node.js and browser environments. Each logger instance can either maintain
 * its own fixed log level or automatically sync with environment variables. Instances of
 * Logger should be mostly accurate substitutions for the console object as it includes
 * all of the main methods of the console object, as well as some of the less commonly used
 * methods methods (table, timer, group, etc).
 *
 * Features:
 * - Environment-aware log level configuration (`process.env.LOG_LEVEL` or `window.LOG_LEVEL`)
 * - Automatic environment variable monitoring (when using dynamic log levels)
 * - Instance-specific log levels
 * - Formatted output with timestamps
 * - Support for additional metadata in logs
 * - Can substitute for the console object
 * @category Logging
 * @group Utils
 * @groupDescription Core utility classes for logging, including level-based logging, timestamps, and console method compatibility.
 * @module Logger
 * @example
 * ```typescript
 * // Create a logger that automatically syncs with environment variables
 * const envLogger = new Logger('App');
 * // LOG_LEVEL=DEBUG
 * envLogger.debug('Will show if LOG_LEVEL is DEBUG');  // Shows
 * // LOG_LEVEL=INFO
 * envLogger.debug('Will not show if LOG_LEVEL is INFO'); // Hidden
 *
 * // Create a logger with a fixed log level (ignores environment)
 * const fixedLogger = new Logger('API', LogLevel.DEBUG);
 * fixedLogger.debug('Always shows regardless of LOG_LEVEL');
 *
 * // Switch from environment sync to fixed level
 * envLogger.setLogLevel(LogLevel.WARN);  // Now ignores LOG_LEVEL changes
 * ```
 */

/**
 * Available logging levels in ascending order of severity:
 * DEBUG → INFO → WARN → ERROR
 * @category Logging
 * @group Utils
 * @module Logger
 * @groupDescription Log level definitions and their usage in the application.
 */
export enum LogLevel {
  /** Detailed information for debugging purposes */
  DEBUG = "DEBUG",
  /** General information about program execution */
  INFO = "INFO",
  /** Potentially harmful situations that don't affect program execution */
  WARN = "WARN",
  /** Error conditions that affect program execution */
  ERROR = "ERROR",
}

/**
 * The logger class.
 *
 * @category Logging
 * @group Utils
 * @module Logger
 * @groupDescription Core utility classes for logging, including level-based logging, timestamps, and console method compatibility.
 * @example
 * ```typescript
 * // Create a logger that automatically syncs with environment variables
 * const envLogger = new Logger('App');
 * // LOG_LEVEL=DEBUG
 * envLogger.debug('Will show if LOG_LEVEL is DEBUG');  // Shows
 * // LOG_LEVEL=INFO
 * envLogger.debug('Will not show if LOG_LEVEL is INFO'); // Hidden
 *
 * // Create a logger with a fixed log level (ignores environment)
 * const fixedLogger = new Logger('API', LogLevel.DEBUG);
 * fixedLogger.debug('Always shows regardless of LOG_LEVEL');
 *
 * // Switch from environment sync to fixed level
 * envLogger.setLogLevel(LogLevel.WARN);  // Now ignores LOG_LEVEL changes
 * ```
 */
export class Logger {
  /**
   * Maps log levels to their priority values for comparison.
   * Higher numbers indicate higher priority levels.
   * Used internally to determine if a message should be logged based on the current log level.
   *
   * Priority: DEBUG=0, INFO=1, WARN=2, ERROR=3
   */
  private static readonly logLevelPriority: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
  };

  /**
   * Stores named counters for the `count()` and `countReset()` methods.
   * Keys are counter labels, values are the current count.
   */
  private counters: Record<string, number> = {};

  /**
   * Stores active timers for the `time()`, `timeEnd()`, and `timeLog()` methods.
   * Keys are timer labels, values are the start timestamps in milliseconds.
   */
  private timers: Record<string, number> = {};

  /**
   * Tracks the current nesting level for the `group()` and `groupCollapsed()` methods.
   * Incremented by group/groupCollapsed, decremented by groupEnd.
   * Used to determine the indentation level of log messages.
   */
  private groupDepth = 0;

  /**
   * The indentation string used for each group level.
   * Each nested group will add this string to the message prefix.
   * Default is two spaces per level of nesting.
   */
  private readonly groupIndent = "  ";

  /**
   * Retrieves the log level from environment variables.
   * Checks the following in order:
   * 1. `window.LOG_LEVEL` (Browser)
   * 2. `process.env.LOG_LEVEL` (Node.js)
   * Returns LogLevel.INFO if no valid log level is found or if any errors occur.
   *
   * @example
   * ```typescript
   * // Dynamic logger that syncs with environment
   * const appLogger = new Logger('App');
   * appLogger.getEnvLogLevel(); // Returns LogLevel.INFO
   * appLogger.debug("This will not be logged");
   * window.LOG_LEVEL = "DEBUG";
   * appLogger.getEnvLogLevel(); // Returns LogLevel.DEBUG
   * appLogger.debug("This will be logged");
   * ```
   *
   * @returns The environment-specified log level or LogLevel.INFO if not set
   */
  private static getEnvLogLevel(): LogLevel {
    try {
      // Check browser environment first
      if (typeof window !== "undefined") {
        // Check for global window property
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const globalWindow = window as Window & { LOG_LEVEL?: string };
        const windowLevel = globalWindow.LOG_LEVEL;
        if (windowLevel && windowLevel in LogLevel) {
          return LogLevel[windowLevel as keyof typeof LogLevel];
        }
      }

      // Fall back to Node.js environment check
      if (typeof process !== "undefined" && process.env) {
        const nodeLevel = process.env.LOG_LEVEL;
        if (nodeLevel && nodeLevel in LogLevel) {
          return LogLevel[nodeLevel as keyof typeof LogLevel];
        }
      }

      return LogLevel.INFO;
    } catch (err) {
      // Log the error for debugging purposes but continue with default
      console.warn("Error determining log level:", err);
      return LogLevel.INFO;
    }
  }

  /**
   * The identifier prefix that will be included in all log messages from this instance.
   * Used to distinguish logs from different parts of the application.
   */
  private prefix: string;

  /**
   * The current minimum log level for this logger instance.
   * Messages with a level lower than this will not be logged.
   * Can be changed at runtime using `setLogLevel()`.
   */
  private currentLogLevel: LogLevel;

  /**
   * Controls whether this logger instance should automatically sync its log level
   * with environment variables. When true, the logger checks environment variables
   * before each log operation to detect changes. When false, the logger maintains
   * a fixed log level regardless of environment changes.
   */
  private useEnvOverride: boolean;

  /**
   * Creates a new Logger instance with the specified prefix and optional initial log level.
   *
   * @param prefix - A string that will be included in all log messages for this instance
   * @param initialLogLevel - Optional log level to set at initialization. If provided,
   *                         the logger will use this fixed level and ignore environment
   *                         variables. If not provided, the logger will automatically
   *                         sync with environment variables (`process.env.LOG_LEVEL` or
   *                         `window.LOG_LEVEL`) and update its level when they change.
   *
   * @example
   * ```typescript
   * // Dynamic logger that syncs with environment
   * const appLogger = new Logger('App');
   *
   * // Fixed level loggers that ignore environment
   * const debugLogger = new Logger('API', LogLevel.DEBUG);
   * const errorLogger = new Logger('DB', LogLevel.ERROR);
   * ```
   */
  constructor(prefix: string, initialLogLevel?: LogLevel) {
    this.prefix = prefix;
    this.useEnvOverride = !initialLogLevel;
    this.currentLogLevel = initialLogLevel ?? Logger.getEnvLogLevel();
  }

  /**
   * Sets a fixed minimum log level for this logger instance. This disables automatic
   * environment variable syncing - the logger will maintain this level regardless
   * of environment changes until `setLogLevel` is called again.
   *
   * @param level - The new minimum log level to fix this logger instance at
   *
   * @example
   * ```typescript
   * const logger = new Logger('App'); // Initially syncs with environment
   * logger.setLogLevel(LogLevel.WARN); // Now fixed at WARN, ignores environment
   * ```
   */
  public setLogLevel(level: LogLevel): void {
    this.useEnvOverride = false;
    this.currentLogLevel = level;
  }

  /**
   * Gets the current minimum log level for this logger instance.
   * Note that if this logger is syncing with environment variables,
   * this value may change between calls as the environment changes.
   *
   * @returns The current log level
   *
   * @example
   * ```typescript
   * const logger = new Logger('MyApp', LogLevel.WARN);
   * logger.getLogLevel(); // Returns: LogLevel.WARN
   *
   * // With environment sync
   * const envLogger = new Logger('MyApp');
   * envLogger.getLogLevel(); // Returns: LogLevel.INFO (default)
   *
   * window.LOG_LEVEL = 'DEBUG';
   * envLogger.debug('trigger check');
   * envLogger.getLogLevel(); // Returns: LogLevel.DEBUG
   *
   * // After setting fixed level
   * envLogger.setLogLevel(LogLevel.ERROR);
   * envLogger.getLogLevel(); // Returns: LogLevel.ERROR (now fixed)
   * ```
   */
  public getLogLevel(): LogLevel {
    return this.currentLogLevel;
  }

  /**
   * Formats a log message with timestamp, level, and prefix.
   *
   * @param level - The log level for the message
   * @param message - The message to format
   * @returns The formatted message string
   *
   * @example
   * ```typescript
   * // Internal method usage:
   * this.formatMessage(LogLevel.INFO, "User logged in");
   * // Returns: "[2024-01-01T00:00:00.000Z] [INFO] [MyApp] User logged in"
   *
   * this.formatMessage(LogLevel.ERROR, "Database connection failed");
   * // Returns: "[2024-01-01T00:00:00.000Z] [ERROR] [MyApp] Database connection failed"
   * ```
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const indentation = this.groupIndent.repeat(this.groupDepth);
    return `[${timestamp}] [${level}] [${this.prefix}] ${indentation}${message}`;
  }

  /**
   * Determines if a message at the given level should be logged based on the current log level.
   * If environment syncing is enabled, checks for environment changes before making the determination.
   *
   * @param messageLevel - The level of the message being logged
   * @returns true if the message should be logged, false otherwise
   *
   * @example
   * ```typescript
   * // Internal method usage:
   * const logger = new Logger('MyApp', LogLevel.INFO);
   *
   * logger.shouldLog(LogLevel.DEBUG); // Returns: false
   * logger.shouldLog(LogLevel.INFO);  // Returns: true
   * logger.shouldLog(LogLevel.WARN);  // Returns: true
   * logger.shouldLog(LogLevel.ERROR); // Returns: true
   *
   * // With environment sync:
   * const envLogger = new Logger('MyApp');
   * window.LOG_LEVEL = 'DEBUG';
   * envLogger.shouldLog(LogLevel.DEBUG); // Updates level and returns true
   * ```
   */
  private shouldLog(messageLevel: LogLevel): boolean {
    // If using environment override, check for changes
    if (this.useEnvOverride) {
      const envLevel = Logger.getEnvLogLevel();
      if (envLevel !== this.currentLogLevel) {
        const oldLevel = this.currentLogLevel;
        this.currentLogLevel = envLevel;
        // Only log the level change if it would be visible at the new level
        if (Logger.logLevelPriority[LogLevel.INFO] >= Logger.logLevelPriority[envLevel]) {
          console.info(
            this.formatMessage(
              LogLevel.INFO,
              `Log level changed from ${oldLevel} to ${envLevel} due to environment update`,
            ),
          );
        }
      }
    }
    return Logger.logLevelPriority[messageLevel] >= Logger.logLevelPriority[this.currentLogLevel];
  }

  /**
   * Logs a debug message if the current log level is `DEBUG` or lower.
   * If environment syncing is enabled, checks environment variables before logging.
   *
   * @param message - The message to log
   * @param args - Additional arguments to pass to `console.debug`
   *
   * @example
   * ```typescript
   * const logger = new Logger('App', LogLevel.DEBUG);
   * logger.debug('Processing payload', { userId: 123, action: 'login' });
   * // [2024-03-19T10:30:15.123Z] [DEBUG] [App] Processing payload { userId: 123, action: 'login' }
   * ```
   */
  public debug(message: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    console.debug(this.formatMessage(LogLevel.DEBUG, message), ...args);
  }

  /**
   * Logs an info message if the current log level is `INFO` or lower.
   * If environment syncing is enabled, checks environment variables before logging.
   *
   * @param message - The message to log
   * @param args - Additional arguments to pass to `console.info`
   *
   * @example
   * ```typescript
   * const logger = new Logger('App', LogLevel.INFO);
   * logger.info('User logged in', { userId: 123 });
   * // [2024-03-19T10:30:15.124Z] [INFO] [App] User logged in { userId: 123 }
   * ```
   */
  public info(message: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    console.info(this.formatMessage(LogLevel.INFO, message), ...args);
  }

  /**
   * Logs a warning message if the current log level is `WARN` or lower.
   * If environment syncing is enabled, checks environment variables before logging.
   *
   * @param message - The message to log
   * @param args - Additional arguments to pass to `console.warn`
   *
   * @example
   * ```typescript
   * const logger = new Logger('App', LogLevel.WARN);
   * logger.warn('High memory usage', { memoryUsed: '85%' });
   * // [2024-03-19T10:30:15.125Z] [WARN] [App] High memory usage { memoryUsed: '85%' }
   * ```
   */
  public warn(message: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    console.warn(this.formatMessage(LogLevel.WARN, message), ...args);
  }

  /**
   * Logs an error message if the current log level is `ERROR` or lower.
   * If environment syncing is enabled, checks environment variables before logging.
   *
   * @param message - The message to log
   * @param args - Additional arguments to pass to `console.error`
   *
   * @example
   * ```typescript
   * const logger = new Logger('MyApp');
   *
   * // Basic error
   * logger.error('Failed to connect to database');
   * // Output: [2024-01-01T00:00:00.000Z] [ERROR] [MyApp] Failed to connect to database
   *
   * // Error with additional details
   * try {
   *   throw new Error('Connection timeout');
   * } catch (err) {
   *   logger.error('Database error:', err);
   *   // Output: [2024-01-01T00:00:00.000Z] [ERROR] [MyApp] Database error: Error: Connection timeout
   * }
   *
   * // Multiple arguments
   * logger.error('Operation failed', { code: 500, reason: 'Timeout' }, 'at endpoint: /api/data');
   * ```
   */
  public error(message: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    console.error(this.formatMessage(LogLevel.ERROR, message), ...args);
  }

  /**
   * General purpose logging method. Uses `INFO` level.
   * If environment syncing is enabled, checks environment variables before logging.
   *
   * @param message - The message to log
   * @param args - Additional arguments to pass to `console.log`
   *
   * @example
   * ```typescript
   * const logger = new Logger('MyApp');
   *
   * // Basic logging
   * logger.log('Application started');
   * // Output: [2024-01-01T00:00:00.000Z] [INFO] [MyApp] Application started
   *
   * // Logging with additional data
   * logger.log('User settings', { theme: 'dark', notifications: true });
   * // Output: [2024-01-01T00:00:00.000Z] [INFO] [MyApp] User settings { theme: 'dark', notifications: true }
   *
   * // Multiple arguments
   * logger.log('Process completed', 'Duration:', 1234, 'ms');
   * // Output: [2024-01-01T00:00:00.000Z] [INFO] [MyApp] Process completed Duration: 1234 ms
   * ```
   */
  public log(message: string, ...args: unknown[]): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    console.log(this.formatMessage(LogLevel.INFO, message), ...args);
  }

  /**
   * Displays an interactive listing of the properties of an object.
   * Uses DEBUG level.
   *
   * @param item - The object to inspect
   * @param options - Optional `console.dir` options
   *
   * @example
   * ```typescript
   * const logger = new Logger('MyApp', LogLevel.DEBUG);
   *
   * // Basic object inspection
   * const user = { id: 1, name: 'John', settings: { theme: 'dark' } };
   * logger.dir(user);
   *
   * // With custom options
   * logger.dir(user, { depth: 1, colors: true });
   *
   * // Complex object
   * const response = await fetch('/api/data');
   * const data = await response.json();
   * logger.dir(data, { depth: null }); // Show all levels
   * ```
   */
  public dir(item: unknown, options?: { depth?: number; colors?: boolean }): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    console.dir(item, options);
  }
  /**
   * Logs the number of times this method has been called with a given label.
   * Uses `INFO` level.
   *
   * @param label - The counter label
   *
   * @example
   * ```typescript
   * const logger = new Logger('MyApp');
   *
   * // Count API calls
   * logger.count('api-requests');
   * // Output: [2024-01-01T00:00:00.000Z] [INFO] [MyApp] api-requests: 1
   *
   * logger.count('api-requests');
   * // Output: [2024-01-01T00:00:00.000Z] [INFO] [MyApp] api-requests: 2
   *
   * // Using default label
   * logger.count();
   * // Output: [2024-01-01T00:00:00.000Z] [INFO] [MyApp] default: 1
   *
   * // Multiple counters
   * logger.count('errors');
   * logger.count('api-requests');
   * // Output: [2024-01-01T00:00:00.000Z] [INFO] [MyApp] errors: 1
   * // Output: [2024-01-01T00:00:00.000Z] [INFO] [MyApp] api-requests: 3
   * ```
   */
  public count(label = "default"): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    this.counters[label] = (this.counters[label] || 0) + 1;
    console.log(this.formatMessage(LogLevel.INFO, `${label}: ${this.counters[label]}`));
  }

  /**
   * Resets the counter for a given label.
   *
   * @param label - The counter label to reset
   *
   * @example
   * ```typescript
   * const logger = new Logger('MyApp');
   *
   * // Count and reset
   * logger.count('api-requests');  // Output: api-requests: 1
   * logger.count('api-requests');  // Output: api-requests: 2
   * logger.countReset('api-requests');
   * logger.count('api-requests');  // Output: api-requests: 1
   *
   * // Reset default counter
   * logger.count();               // Output: default: 1
   * logger.countReset();
   * logger.count();               // Output: default: 1
   *
   * // Reset non-existent counter (silent operation)
   * logger.countReset('unknown');
   * ```
   */
  public countReset(label = "default"): void {
    delete this.counters[label];
  }

  /**
   * Creates a new inline group in the console output.
   * Subsequent console messages will be indented.
   * Uses `INFO` level.
   *
   * @param label - The group label
   *
   * @example
   * ```typescript
   * const logger = new Logger('MyApp');
   *
   * // Basic grouping
   * logger.group('User Authentication');
   * logger.log('Checking credentials...');
   * logger.log('User authenticated');
   * logger.groupEnd();
   *
   * // Nested groups
   * logger.group('API Response');
   * logger.log('Status: 200');
   * logger.group('Response Body');
   * logger.log('Data loaded');
   * logger.groupEnd();
   * logger.log('Request completed');
   * logger.groupEnd();
   *
   * // Group without label
   * logger.group();
   * logger.log('Grouped message');
   * logger.groupEnd();
   * ```
   */
  public group(label?: string): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    if (label) {
      console.log(this.formatMessage(LogLevel.INFO, label));
    }
    this.groupDepth++;
  }

  /**
   * Creates a new inline group in the console output, but starts collapsed.
   * Subsequent console messages will be indented.
   * Uses `INFO` level.
   *
   * @param label - The group label
   *
   * @example
   * ```typescript
   * const logger = new Logger('MyApp');
   *
   * // Collapsed debug information
   * logger.groupCollapsed('Debug Details');
   * logger.log('Environment:', process.env.NODE_ENV);
   * logger.log('Platform:', process.platform);
   * logger.log('Memory Usage:', process.memoryUsage());
   * logger.groupEnd();
   *
   * // Nested collapsed groups
   * logger.groupCollapsed('Request Details');
   * logger.log('URL:', request.url);
   * logger.groupCollapsed('Headers');
   * logger.log(request.headers);
   * logger.groupEnd();
   * logger.log('Body:', request.body);
   * logger.groupEnd();
   * ```
   */
  public groupCollapsed(label?: string): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    if (label) {
      console.log(this.formatMessage(LogLevel.INFO, label));
    }
    this.groupDepth++;
  }

  /**
   * Exits the current inline group in the console.
   */
  public groupEnd(): void {
    if (this.groupDepth > 0) {
      this.groupDepth--;
    }
  }

  /**
   * Outputs a stack trace to the console.
   * Uses `DEBUG` level.
   *
   * @param message - Optional message to include
   *
   * @example
   * ```typescript
   * const logger = new Logger('MyApp', LogLevel.DEBUG);
   *
   * // Basic trace
   * logger.trace();
   * // Output: [2024-01-01T00:00:00.000Z] [DEBUG] [MyApp]
   * //    at Function.method (/path/to/file.ts:10:10)
   * //    at Object.<anonymous> (/path/to/file.ts:5:5)
   *
   * // Trace with message
   * logger.trace('User authentication failed');
   * // Output: [2024-01-01T00:00:00.000Z] [DEBUG] [MyApp] User authentication failed
   * //    at Function.authenticate (/path/to/auth.ts:15:10)
   * //    at Object.<anonymous> (/path/to/handler.ts:8:5)
   *
   * // In error handling
   * try {
   *   throw new Error('Something went wrong');
   * } catch (error) {
   *   logger.trace('Error caught:');
   * }
   * ```
   */
  public trace(message?: string): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    const err = new Error();
    const stack = err.stack?.split("\n").slice(2).join("\n") || "";
    const traceMessage = message ? `${message}\n${stack}` : stack;
    console.debug(this.formatMessage(LogLevel.DEBUG, traceMessage));
  }

  /**
   * Displays tabular data as a table.
   * Uses `INFO` level.
   *
   * @param tabularData - Data to display in table format
   * @param properties - Optional array of property names to display
   *
   * @example
   * ```typescript
   * const logger = new Logger('MyApp');
   *
   * // Simple array of objects
   * const users = [
   *   { id: 1, name: 'John', role: 'admin' },
   *   { id: 2, name: 'Jane', role: 'user' }
   * ];
   * logger.table(users);
   *
   * // Specify columns to display
   * logger.table(users, ['name', 'role']);
   *
   * // Array of arrays
   * const matrix = [
   *   [1, 2, 3],
   *   [4, 5, 6]
   * ];
   * logger.table(matrix);
   *
   * // Object with nested data
   * const data = {
   *   users: { count: 2, active: 1 },
   *   posts: { count: 10, draft: 3 }
   * };
   * logger.table(data);
   * ```
   */
  public table(tabularData: unknown, properties?: readonly string[]): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    if (typeof tabularData === "object" && tabularData !== null) {
      console.log(this.formatMessage(LogLevel.INFO, "Table Output:"));
      console.table(tabularData, properties);
    } else {
      console.log(this.formatMessage(LogLevel.INFO, "Invalid data for table display"));
    }
  }

  /**
   * Clears the console if possible.
   */
  public clear(): void {
    console.clear();
  }

  /**
   * Creates a new timing with the specified label.
   * Uses `DEBUG` level for output.
   *
   * @param label - The timer label
   *
   * @example
   * ```typescript
   * const logger = new Logger('Performance');
   *
   * // Start a named timer
   * logger.time('database-query');
   * // Output: [2024-01-01T00:00:00.000Z] [DEBUG] [Performance] Timer 'database-query' started
   *
   * // Start default timer
   * logger.time();
   * // Output: [2024-01-01T00:00:00.000Z] [DEBUG] [Performance] Timer 'default' started
   *
   * // Attempting to start an existing timer
   * logger.time('database-query');
   * // Output: [2024-01-01T00:00:00.000Z] [WARN] [Performance] Timer 'database-query' already exists
   * ```
   */
  public time(label = "default"): void {
    if (this.timers[label]) {
      this.warn(`Timer '${label}' already exists`);
      return;
    }
    this.timers[label] = performance.now();
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, `Timer '${label}' started`));
    }
  }

  /**
   * Stops a timer and logs the elapsed time.
   * Uses `DEBUG` level for output.
   *
   * @param label - The timer label
   *
   * @example
   * ```typescript
   * const logger = new Logger('Performance');
   *
   * // Basic timer usage
   * logger.time('operation');
   * await someAsyncOperation();
   * logger.timeEnd('operation');
   * // Output: [2024-01-01T00:00:00.000Z] [DEBUG] [Performance] Timer 'operation': 1234.56ms
   *
   * // Attempting to end non-existent timer
   * logger.timeEnd('invalid-timer');
   * // Output: [2024-01-01T00:00:00.000Z] [WARN] [Performance] Timer 'invalid-timer' does not exist
   *
   * // Using default timer
   * logger.time();
   * await someAsyncOperation();
   * logger.timeEnd();
   * // Output: [2024-01-01T00:00:00.000Z] [DEBUG] [Performance] Timer 'default': 1234.56ms
   * ```
   */
  public timeEnd(label = "default"): void {
    if (!this.timers[label]) {
      this.warn(`Timer '${label}' does not exist`);
      return;
    }

    const duration = performance.now() - this.timers[label];
    delete this.timers[label];

    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(
        this.formatMessage(LogLevel.DEBUG, `Timer '${label}': ${duration.toFixed(2)}ms`),
      );
    }
  }

  /**
   * Logs the current value of a timer without stopping it.
   * Uses `DEBUG`  level for output.
   *
   * @param label - The timer label
   * @param args - Additional data to log with the timer
   *
   * @example
   * ```typescript
   * const logger = new Logger('Performance');
   *
   * // Log progress during a long operation
   * logger.time('long-task');
   *
   * for (const item of items) {
   *   await processItem(item);
   *   logger.timeLog('long-task', { processedItem: item.id });
   *   // Output: [2024-01-01T00:00:00.000Z] [DEBUG] [Performance] Timer 'long-task': 1234.56ms { processedItem: 123 }
   * }
   *
   * logger.timeEnd('long-task');
   *
   * // Attempting to log non-existent timer
   * logger.timeLog('invalid-timer');
   * // Output: [2024-01-01T00:00:00.000Z] [WARN] [Performance] Timer 'invalid-timer' does not exist
   * ```
   */
  public timeLog(label = "default", ...args: unknown[]): void {
    if (!this.timers[label]) {
      this.warn(`Timer '${label}' does not exist`);
      return;
    }

    const duration = performance.now() - this.timers[label];

    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(
        this.formatMessage(LogLevel.DEBUG, `Timer '${label}': ${duration.toFixed(2)}ms`),
        ...args,
      );
    }
  }

  /**
   * Adds a timestamp marker to the timeline in browser devtools.
   * In non-browser environments, logs a timestamp message.
   * Uses DEBUG level.
   *
   * @param label - Optional label for the timestamp
   *
   * @example
   * ```typescript
   * const logger = new Logger('Timeline');
   *
   * // Add labeled timestamp
   * logger.timeStamp('User Clicked Button');
   * // In Browser DevTools: Adds timeline marker 'User Clicked Button'
   * // In Console: [2024-01-01T00:00:00.000Z] [DEBUG] [Timeline] Timestamp 'User Clicked Button': 2024-01-01T00:00:00.000Z
   *
   * // Add unlabeled timestamp
   * logger.timeStamp();
   * // In Browser DevTools: Adds timeline marker
   * // In Console: [2024-01-01T00:00:00.000Z] [DEBUG] [Timeline] Timestamp: 2024-01-01T00:00:00.000Z
   *
   * // Useful for marking significant events in application flow
   * async function handleUserAction() {
   *   logger.timeStamp('Action Started');
   *   await processAction();
   *   logger.timeStamp('Action Completed');
   * }
   * ```
   */
  public timeStamp(label?: string): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const timestamp = new Date().toISOString();
    const message = label ? `Timestamp '${label}': ${timestamp}` : `Timestamp: ${timestamp}`;

    if (typeof console.timeStamp === "function") {
      // Browser environment with timeStamp support
      console.timeStamp(label);
      console.debug(this.formatMessage(LogLevel.DEBUG, message));
    } else {
      // Fallback for environments without timeStamp
      console.debug(this.formatMessage(LogLevel.DEBUG, message));
    }
  }
}
