/**
 * Available logging levels in ascending order of severity:
 * DEBUG → INFO → WARN → ERROR
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
 * A flexible logging utility that supports different log levels and prefixed output.
 * Works in both Node.js and browser environments. Each logger instance can either maintain
 * its own fixed log level or automatically sync with environment variables.
 *
 * Features:
 * - Environment-aware log level configuration (process.env.LOG_LEVEL or window.LOG_LEVEL)
 * - Automatic environment variable monitoring (when using dynamic log levels)
 * - Instance-specific log levels
 * - Formatted output with timestamps
 * - Support for additional metadata in logs
 *
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
   * Retrieves the log level from environment variables.
   * Checks the following in order:
   * 1. window.LOG_LEVEL (Browser)
   * 2. process.env.LOG_LEVEL (Node.js)
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
  private _prefix: string;

  /**
   * The current minimum log level for this logger instance.
   * Messages with a level lower than this will not be logged.
   * Can be changed at runtime using setLogLevel().
   */
  private _currentLogLevel: LogLevel;

  /**
   * Controls whether this logger instance should automatically sync its log level
   * with environment variables. When true, the logger checks environment variables
   * before each log operation to detect changes. When false, the logger maintains
   * a fixed log level regardless of environment changes.
   */
  private _useEnvOverride: boolean;

  /**
   * Creates a new Logger instance with the specified prefix and optional initial log level.
   *
   * @param prefix - A string that will be included in all log messages for this instance
   * @param initialLogLevel - Optional log level to set at initialization. If provided,
   *                         the logger will use this fixed level and ignore environment
   *                         variables. If not provided, the logger will automatically
   *                         sync with environment variables (process.env.LOG_LEVEL or
   *                         window.LOG_LEVEL) and update its level when they change.
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
    this._prefix = prefix;
    this._useEnvOverride = !initialLogLevel;
    this._currentLogLevel = initialLogLevel ?? Logger.getEnvLogLevel();
  }

  /**
   * Sets a fixed minimum log level for this logger instance. This disables automatic
   * environment variable syncing - the logger will maintain this level regardless
   * of environment changes until setLogLevel is called again.
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
    this._useEnvOverride = false;
    this._currentLogLevel = level;
  }

  /**
   * Gets the current minimum log level for this logger instance.
   * Note that if this logger is syncing with environment variables,
   * this value may change between calls as the environment changes.
   *
   * @returns The current log level
   */
  public getLogLevel(): LogLevel {
    return this._currentLogLevel;
  }

  /**
   * Formats a log message with timestamp, level, and prefix.
   */
  private _formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${this._prefix}] ${message}`;
  }

  /**
   * Determines if a message at the given level should be logged based on the current log level.
   * If environment syncing is enabled, checks for environment changes before making the determination.
   *
   * Internal method - not intended for external use.
   *
   * @param messageLevel - The level of the message being logged
   * @returns true if the message should be logged, false otherwise
   */
  private _shouldLog(messageLevel: LogLevel): boolean {
    // If using environment override, check for changes
    if (this._useEnvOverride) {
      const envLevel = Logger.getEnvLogLevel();
      if (envLevel !== this._currentLogLevel) {
        const oldLevel = this._currentLogLevel;
        this._currentLogLevel = envLevel;
        // Only log the level change if it would be visible at the new level
        if (Logger.logLevelPriority[LogLevel.INFO] >= Logger.logLevelPriority[envLevel]) {
          console.info(
            this._formatMessage(
              LogLevel.INFO,
              `Log level changed from ${oldLevel} to ${envLevel} due to environment update`,
            ),
          );
        }
      }
    }
    return Logger.logLevelPriority[messageLevel] >= Logger.logLevelPriority[this._currentLogLevel];
  }

  /**
   * Logs a debug message if the current log level is DEBUG or lower.
   * If environment syncing is enabled, checks environment variables before logging.
   *
   * @param message - The message to log
   * @param args - Additional arguments to pass to console.debug
   *
   * @example
   * ```typescript
   * const logger = new Logger('App', LogLevel.DEBUG);
   * logger.debug('Processing payload', { userId: 123, action: 'login' });
   * // [2024-03-19T10:30:15.123Z] [DEBUG] [App] Processing payload { userId: 123, action: 'login' }
   * ```
   */
  public debug(message: string, ...args: unknown[]): void {
    if (!this._shouldLog(LogLevel.DEBUG)) return;
    console.debug(this._formatMessage(LogLevel.DEBUG, message), ...args);
  }

  /**
   * Logs an info message if the current log level is INFO or lower.
   * If environment syncing is enabled, checks environment variables before logging.
   *
   * @param message - The message to log
   * @param args - Additional arguments to pass to console.info
   *
   * @example
   * ```typescript
   * const logger = new Logger('App', LogLevel.INFO);
   * logger.info('User logged in', { userId: 123 });
   * // [2024-03-19T10:30:15.124Z] [INFO] [App] User logged in { userId: 123 }
   * ```
   */
  public info(message: string, ...args: unknown[]): void {
    if (!this._shouldLog(LogLevel.INFO)) return;
    console.info(this._formatMessage(LogLevel.INFO, message), ...args);
  }

  /**
   * Logs a warning message if the current log level is WARN or lower.
   * If environment syncing is enabled, checks environment variables before logging.
   *
   * @param message - The message to log
   * @param args - Additional arguments to pass to console.warn
   *
   * @example
   * ```typescript
   * const logger = new Logger('App', LogLevel.WARN);
   * logger.warn('High memory usage', { memoryUsed: '85%' });
   * // [2024-03-19T10:30:15.125Z] [WARN] [App] High memory usage { memoryUsed: '85%' }
   * ```
   */
  public warn(message: string, ...args: unknown[]): void {
    if (!this._shouldLog(LogLevel.WARN)) return;
    console.warn(this._formatMessage(LogLevel.WARN, message), ...args);
  }

  /**
   * Logs an error message if the current log level is ERROR or lower.
   * If environment syncing is enabled, checks environment variables before logging.
   *
   * @param message - The message to log
   * @param args - Additional arguments to pass to console.error
   *
   * @example
   * ```typescript
   * const logger = new Logger('App', LogLevel.ERROR);
   * logger.error('Failed to connect to database', new Error('Connection timeout'));
   * // [2024-03-19T10:30:15.126Z] [ERROR] [App] Failed to connect to database Error: Connection timeout
   * ```
   */
  public error(message: string, ...args: unknown[]): void {
    if (!this._shouldLog(LogLevel.ERROR)) return;
    console.error(this._formatMessage(LogLevel.ERROR, message), ...args);
  }
}
