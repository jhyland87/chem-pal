import { getContrastText, hexToRgba } from '@/theme/colors';
import { IS_DEV_BUILD } from '@/utils/isDevBuild';

/**
 * Available logging levels in ascending order of severity:
 * TRACE → DEBUG → INFO → WARN → ERROR → FATAL
 *
 * @category Utils
 * @example
 * ```typescript
 * const logger = new Logger('App');
 * logger.debug('This is a debug message');
 * ```
 * @source
 */
export enum LogLevel {
  /** Finer-grained detail than debug, such as each step of a request or stream */
  TRACE = 'trace',
  /** Detailed information for debugging purposes */
  DEBUG = 'debug',
  /** General information about program execution */
  INFO = 'info',
  /** Potentially harmful situations that don't affect program execution */
  WARN = 'warn',
  /** Error conditions that affect program execution */
  ERROR = 'error',
  /** The app or a whole page can't continue, e.g. an uncaught exception or a crashed UI */
  FATAL = 'fatal',
}

/**
 * Every severity bucket a remote log sink can opt into, least to most severe.
 * `Logger.info` and `Logger.log` both map to `'log'`.
 * @category Utils
 * @group Constants
 * @example
 * ```typescript
 * REMOTE_LOG_LEVELS.includes('warn'); // true
 * ```
 * @source
 */
export const REMOTE_LOG_LEVELS = ['trace', 'debug', 'log', 'warn', 'error', 'fatal'] as const;

/**
 * A severity bucket a remote log sink can opt into.
 * @category Utils
 * @group Types
 * @example
 * ```typescript
 * const levels: RemoteLogLevel[] = ['log', 'warn', 'error'];
 * ```
 * @source
 */
export type RemoteLogLevel = (typeof REMOTE_LOG_LEVELS)[number];

/**
 * Narrows an arbitrary value to a {@link RemoteLogLevel}.
 * @category Utils
 * @group Types
 * @param value - The value to test
 * @returns `true` if the value is one of the remote log levels
 * @example
 * ```typescript
 * isRemoteLogLevel('warn');  // true
 * isRemoteLogLevel('fatal'); // false
 * ```
 * @source
 */
export function isRemoteLogLevel(value: unknown): value is RemoteLogLevel {
  return REMOTE_LOG_LEVELS.some((level) => level === value);
}

/**
 * One log call as handed to a {@link RemoteLogSink}.
 * - `level` - The remote severity bucket of the call.
 * - `prefix` - The emitting logger's prefix (includes any `sub()` segments).
 * - `message` - The message passed to the logger, before any formatting.
 * - `args` - The extra arguments passed to the logger, unsanitized.
 * - `location` - Where the call lives in the source, as `path:line#function`, when the build
 *   recorded it (see `tools/logCallSites.js`); otherwise `undefined`.
 * - `context` - Key/value pairs describing what the app was doing when the call was made, such
 *   as the active search query (see {@link Logger.setContext}); `undefined` when there are none.
 * @category Utils
 * @group Types
 * @example
 * ```typescript
 * const record: RemoteLogRecord = {
 *   level: 'warn',
 *   prefix: 'SupplierBase|fetch',
 *   message: 'Request failed',
 *   args: [new Error('timeout')],
 *   location: 'suppliers/SupplierBase.ts:1431#SupplierBase.fetch',
 * };
 * ```
 * @source
 */
export interface RemoteLogRecord {
  level: RemoteLogLevel;
  prefix: string;
  message: string;
  args: readonly unknown[];
  location?: string;
  context?: Readonly<Record<string, string>>;
}

/**
 * A destination that receives log calls in addition to the console, such as PostHog Logs.
 * `isEnabled` is checked first so a disabled level costs no more than one function call.
 * - `isEnabled` - Whether records at this level are currently wanted.
 * - `emit` - Receives a record. Must not throw.
 * @category Utils
 * @group Types
 * @example
 * ```typescript
 * const sink: RemoteLogSink = {
 *   isEnabled: (level) => level === 'error',
 *   emit: (record) => queue.push(record),
 * };
 * Logger.setRemoteSink(sink);
 * ```
 * @source
 */
export interface RemoteLogSink {
  isEnabled(level: RemoteLogLevel): boolean;
  emit(record: RemoteLogRecord): void;
}

/** Default log level when nothing is set via window/process env. DEBUG in dev, WARN in prod. */
const DEFAULT_LOG_LEVEL_FOR_BUILD: LogLevel = IS_DEV_BUILD ? LogLevel.DEBUG : LogLevel.WARN;

/** Separator inserted between a parent prefix and a child prefix in `Logger.sub()`. */
const SUB_LOGGER_SEPARATOR = '|';

/** Narrows an arbitrary string to a `LogLevel` enum member. */
function isLogLevel(value: string): value is LogLevel {
  return (Object.values(LogLevel) as string[]).includes(value);
}

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
 * @category Utils
 * @summary
 * A simple logger that works on both the commandline and in the browser, and can directly replace the console object (for most cases).
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
 * @source
 */
export class Logger {
  /**
   * Maps log levels to their priority values for comparison.
   * Higher numbers indicate higher priority levels.
   * Used internally to determine if a message should be logged based on the current log level.
   *
   * Priority: TRACE=0, DEBUG=1, INFO=2, WARN=3, ERROR=4, FATAL=5
   * @source
   */
  private static readonly logLevelPriority: Record<LogLevel, number> = {
    [LogLevel.TRACE]: 0,
    [LogLevel.DEBUG]: 1,
    [LogLevel.INFO]: 2,
    [LogLevel.WARN]: 3,
    [LogLevel.ERROR]: 4,
    [LogLevel.FATAL]: 5,
  };

  /**
   * Text color used for each level tag in colorized (browser) output.
   * @source
   */
  private static readonly levelColors: Record<LogLevel, string> = {
    [LogLevel.TRACE]: '#b8bcc2',
    [LogLevel.DEBUG]: '#9aa0a6',
    [LogLevel.INFO]: '#4d7df2',
    [LogLevel.WARN]: '#f5a623',
    [LogLevel.ERROR]: '#e5484d',
    [LogLevel.FATAL]: '#b3141b',
  };

  /**
   * How each public level method maps to its internal level, its remote bucket, and the console
   * method that prints it. `log` and `info` are both INFO and both send as the remote `log` level;
   * `trace` prints through `console.debug` and `fatal` through `console.error`, since the console
   * has no equivalents (and `console.trace` would add a stack to every call).
   * @source
   */
  private static readonly methodLevels: Record<
    'trace' | 'debug' | 'info' | 'log' | 'warn' | 'error' | 'fatal',
    {
      level: LogLevel;
      remote: RemoteLogLevel;
      console: 'debug' | 'info' | 'log' | 'warn' | 'error';
    }
  > = {
    trace: { level: LogLevel.TRACE, remote: 'trace', console: 'debug' },
    debug: { level: LogLevel.DEBUG, remote: 'debug', console: 'debug' },
    info: { level: LogLevel.INFO, remote: 'log', console: 'info' },
    log: { level: LogLevel.INFO, remote: 'log', console: 'log' },
    warn: { level: LogLevel.WARN, remote: 'warn', console: 'warn' },
    error: { level: LogLevel.ERROR, remote: 'error', console: 'error' },
    fatal: { level: LogLevel.FATAL, remote: 'fatal', console: 'error' },
  };

  /**
   * Context shared by every logger (e.g. the active search query), merged into the record each
   * remote log carries. Unset when nothing is in progress.
   * @source
   */
  private static globalContext?: Readonly<Record<string, string>>;

  /**
   * The registered remote sink, shared by every logger instance. Unset by default, in
   * which case logging is console-only.
   * @source
   */
  private static remoteSink?: RemoteLogSink;

  /**
   * Stores named counters for the `count()` and `countReset()` methods.
   * Keys are counter labels, values are the current count.
   * @source
   */
  private counters: Record<string, number> = {};

  /**
   * Context for this logger only, merged over the global context. Used where an object always
   * belongs to one search (a supplier instance), so its late logs keep the right query.
   * @source
   */
  private context?: Readonly<Record<string, string>>;

  /**
   * Stores active timers for the `time()`, `timeEnd()`, and `timeLog()` methods.
   * Keys are timer labels, values are the start timestamps in milliseconds.
   * @source
   */
  private timers: Record<string, number> = {};

  /**
   * Tracks the current nesting level for the `group()` and `groupCollapsed()` methods.
   * Incremented by group/groupCollapsed, decremented by groupEnd.
   * Used to determine the indentation level of log messages.
   * @source
   */
  private groupDepth = 0;

  /**
   * The indentation string used for each group level.
   * Each nested group will add this string to the message prefix.
   * Default is two spaces per level of nesting.
   * @source
   */
  private readonly groupIndent = '  ';

  /**
   * Retrieves the log level from environment variables.
   * Checks the following in order:
   * 1. `window.LOG_LEVEL` (Browser)
   * 2. `process.env.LOG_LEVEL` (Node.js)
   * 3. Falls back to the build-mode default — `DEBUG` in dev builds,
   *    `WARN` in production builds (see `DEFAULT_LOG_LEVEL_FOR_BUILD`).
   *
   * @example
   * ```typescript
   * // Dynamic logger that syncs with environment
   * const appLogger = new Logger('App');
   * appLogger.getEnvLogLevel(); // Returns LogLevel.DEBUG in dev, LogLevel.WARN in prod
   * window.LOG_LEVEL = "DEBUG";
   * appLogger.getEnvLogLevel(); // Returns LogLevel.DEBUG
   * appLogger.debug("This will be logged");
   * ```
   *
   * @returns The environment-specified log level, or the build-mode default if not set
   * @source
   */
  private static getEnvLogLevel(): LogLevel {
    try {
      // Check browser environment first
      if (typeof window !== 'undefined') {
        // Read the non-standard global without widening the Window type.
        const windowLevel = Reflect.get(window, 'LOG_LEVEL');
        const normalized = typeof windowLevel === 'string' ? windowLevel.toLowerCase() : undefined;
        if (normalized && isLogLevel(normalized)) {
          return normalized;
        }
      }

      // Fall back to Node.js environment check
      if (typeof process !== 'undefined' && process.env) {
        const nodeLevel = process.env.LOG_LEVEL?.toLowerCase();
        if (nodeLevel && isLogLevel(nodeLevel)) {
          return nodeLevel;
        }
      }

      return DEFAULT_LOG_LEVEL_FOR_BUILD;
    } catch (err) {
      // Log the error for debugging purposes but continue with default
      console.warn('Error determining log level:', err);
      return DEFAULT_LOG_LEVEL_FOR_BUILD;
    }
  }

  public static setEnvLogLevel(level: LogLevel): void {
    Reflect.set(window, 'LOG_LEVEL', level);
    if (typeof process !== 'undefined' && process.env) {
      process.env.LOG_LEVEL = level;
    }
  }

  /**
   * Registers (or clears) the sink that receives `debug`/`info`/`log`/`warn`/`error` calls
   * from every logger instance, independent of the console log level.
   *
   * The sink is registered here rather than imported so `Logger` stays free of the
   * analytics and storage modules that themselves create loggers.
   * @param sink - The sink to register, or `undefined` to detach the current one
   * @example
   * ```typescript
   * Logger.setRemoteSink({ isEnabled: () => true, emit: (record) => send(record) });
   * new Logger('App').warn('Heads up'); // also reaches the sink as level 'warn'
   * Logger.setRemoteSink(undefined);
   * ```
   * @source
   */
  public static setRemoteSink(sink?: RemoteLogSink): void {
    Logger.remoteSink = sink;
  }

  /**
   * Sets (or clears) the context every logger attaches to its remote logs, such as the query of
   * the search in progress. Console output is unchanged.
   *
   * @param context - Key/value pairs to attach, or `undefined` to clear
   * @example
   * ```typescript
   * Logger.setContext({ search_query: 'acetone' });
   * new Logger('Any').warn('Slow response'); // remote log carries search_query: 'acetone'
   * Logger.setContext(undefined);
   * ```
   * @source
   */
  public static setContext(context?: Readonly<Record<string, string>>): void {
    Logger.globalContext = context;
  }

  /**
   * Reads the current global context.
   *
   * @returns The context set by {@link Logger.setContext}, or `undefined` when none is set
   * @example
   * ```typescript
   * Logger.setContext({ search_query: 'acetone' });
   * Logger.getContext(); // { search_query: 'acetone' }
   * ```
   * @source
   */
  public static getContext(): Readonly<Record<string, string>> | undefined {
    return Logger.globalContext;
  }

  /**
   * The identifier prefix that will be included in all log messages from this instance.
   * Used to distinguish logs from different parts of the application.
   * @source
   */
  private prefix: string;

  /**
   * Optional hex color for this logger. When set, browser output is colorized
   * with the prefix shown as a chip in this color; unset means plain output.
   * @source
   */
  private color?: string;

  private _currentLogLevel: LogLevel;

  /**
   * The current minimum log level for this logger instance.
   * Messages with a level lower than this will not be logged.
   * Can be changed at runtime using `setLogLevel()`.
   * @source
   */
  private get currentLogLevel(): LogLevel {
    if (this.useEnvOverride) {
      return Logger.getEnvLogLevel();
    }
    return this._currentLogLevel;
  }

  /**
   * Controls whether this logger instance should automatically sync its log level
   * with environment variables. When true, the logger checks environment variables
   * before each log operation to detect changes. When false, the logger maintains
   * a fixed log level regardless of environment changes.
   * @source
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
   * @param color - Optional hex color (e.g. `"#fa938e"`). When set, browser output is
   *                colorized with the prefix rendered as a chip in this color.
   *
   * @example
   * ```typescript
   * // Dynamic logger that syncs with environment
   * const appLogger = new Logger('App');
   *
   * // Fixed level loggers that ignore environment
   * const debugLogger = new Logger('API', LogLevel.DEBUG);
   * const errorLogger = new Logger('DB', LogLevel.ERROR);
   *
   * // Colorized logger (prefix shown as a colored chip in the browser console)
   * const supplierLogger = new Logger('SupplierAmbeed', undefined, '#4db6ac');
   * ```
   * @source
   */
  constructor(prefix: string, initialLogLevel?: LogLevel, color?: string) {
    this.prefix = prefix;
    this.color = color;
    this.useEnvOverride = !initialLogLevel;
    this._currentLogLevel = initialLogLevel ?? this.currentLogLevel;
  }

  /**
   * Sets (or clears) the color used to colorize this logger's browser output.
   *
   * @param color - A hex color string, or undefined to disable colorization
   *
   * @example
   * ```typescript
   * const logger = new Logger('SupplierAmbeed');
   * logger.setColor('#4db6ac'); // prefix now rendered as a teal chip
   * ```
   * @source
   */
  public setColor(color?: string): void {
    this.color = color;
  }

  /**
   * Sets (or clears) context attached to this logger's remote logs only. It is merged over, and
   * wins against, the global context from {@link Logger.setContext}.
   *
   * @param context - Key/value pairs to attach, or `undefined` to clear
   * @example
   * ```typescript
   * const logger = new Logger('SupplierBase');
   * logger.setContext({ search_query: 'acetone' });
   * ```
   * @source
   */
  public setContext(context?: Readonly<Record<string, string>>): void {
    this.context = context;
  }

  /**
   * Creates a child logger whose prefix is this logger's prefix with `suffix`
   * appended after a `|` separator. Useful for scoping log lines to a specific
   * operation without reconstructing a logger or restating the log level.
   *
   * The child is a new, independent instance (its own counters/timers/groups) that
   * inherits this logger's level configuration: an env-synced parent yields an
   * env-synced child, and a fixed-level parent seeds the child with that same level.
   * Because `sub()` returns a `Logger`, calls chain to any depth.
   * @param suffix - The prefix segment to append for the child logger
   * @returns A new `Logger` whose prefix is the parent prefix, a `|`, then `suffix`
   * @example
   * ```typescript
   * const logger = new Logger('SupplierBase');
   * const l = logger.sub('httpPostFormData');
   * l.log('Hello');
   * // [2024-01-01T00:00:00.000Z] [INFO] [SupplierBase|httpPostFormData] Hello
   *
   * logger.sub('a').sub('b').sub('c').info('x');
   * // [2024-01-01T00:00:00.000Z] [INFO] [SupplierBase|a|b|c] x
   * ```
   * @source
   */
  public sub(suffix: string): Logger {
    return new Logger(
      `${this.prefix}${SUB_LOGGER_SEPARATOR}${suffix}`,
      this.useEnvOverride ? undefined : this._currentLogLevel,
      this.color,
    );
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
   * @source
   */
  public setLogLevel(level: LogLevel): void {
    this.useEnvOverride = false;
    this._currentLogLevel = level;
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
   * @source
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
   * @source
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const indentation = this.groupIndent.repeat(this.groupDepth);
    return `[${timestamp}] [${level.toUpperCase()}] [${this.prefix}] ${indentation}${message}`;
  }

  /**
   * Builds the argument list to spread into a `console` call. For uncolored loggers
   * (or non-browser consoles that would print `%c` literally) this is the single
   * plain string from `formatMessage`. When a color is set in a browser, it returns
   * a `%c` format string plus the CSS style arguments: a muted timestamp carrying a
   * thick left border in the level's color, the prefix as a chip in the logger's
   * color (dimmed a step per `sub()` depth), and a reset for the message.
   *
   * @param level - The log level for the message
   * @param message - The message to format
   * @returns The arguments to spread into `console.log`/`info`/etc.
   *
   * @example
   * ```typescript
   * // Uncolored: ["[2024-01-01T00:00:00.000Z] [INFO] [MyApp] hi"]
   * // Colored:   ["%c... %cMyApp%c hi", "border-left:5px solid #4d7df2; ...", ...styles]
   * console.info(...this.formatArgs(LogLevel.INFO, "hi"));
   * ```
   * @source
   */
  private formatArgs(level: LogLevel, message: string): unknown[] {
    if (this.color === undefined || typeof window === 'undefined') {
      return [this.formatMessage(level, message)];
    }
    // Short local time reads better than a full ISO string in a live devtools console.
    const timestamp = new Date().toLocaleTimeString();
    const indentation = this.groupIndent.repeat(this.groupDepth);
    // Each sub() adds a `|` segment; dim the chip a step per level of nesting.
    const subDepth = this.prefix.split(SUB_LOGGER_SEPARATOR).length - 1;
    const chipAlpha = Math.max(0.4, Math.round((1 - subDepth * 0.12) * 100) / 100);
    const chipBackground = subDepth <= 0 ? this.color : hexToRgba(this.color, chipAlpha);
    return [
      `%c${timestamp} %c${this.prefix}%c ${indentation}${message}`,
      `border-left:5px solid ${Logger.levelColors[level]}; padding-left:8px; color:#6b7280;`,
      `background:${chipBackground}; color:${getContrastText(this.color)}; padding:1px 6px; border-radius:4px; font-weight:600;`,
      'color:inherit; background:transparent; font-weight:normal; padding:0;',
    ];
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
   * @source
   */
  private shouldLog(messageLevel: LogLevel): boolean {
    // If using environment override, check for changes
    if (this.useEnvOverride) {
      const envLevel = Logger.getEnvLogLevel();
      if (envLevel !== this._currentLogLevel) {
        const oldLevel = this._currentLogLevel;
        this._currentLogLevel = envLevel;
        // Only log the level change if it would be visible at the new level
        if (Logger.logLevelPriority[LogLevel.INFO] >= Logger.logLevelPriority[envLevel]) {
          console.info(
            this.formatMessage(
              LogLevel.INFO,
              `Log level changed from ${oldLevel.toUpperCase()} to ${envLevel.toUpperCase().toUpperCase()} due to environment update`,
            ),
          );
        }
      }
    }
    return Logger.logLevelPriority[messageLevel] >= Logger.logLevelPriority[this.currentLogLevel];
  }

  /**
   * Hands a log call to the registered remote sink, if it wants this level. Runs before the
   * console gate, so the sink's levels are independent of the console log level.
   *
   * @param level - The remote severity bucket of the call
   * @param message - The message passed to the logger
   * @param args - The extra arguments passed to the logger
   * @param location - Where the call lives in the source (`path:line#function`), if known
   * @example
   * ```typescript
   * this.forwardRemote('warn', 'Request failed', [error], 'suppliers/Foo.ts:12#Foo.fetch');
   * ```
   * @source
   */
  private forwardRemote(
    level: RemoteLogLevel,
    message: string,
    args: readonly unknown[],
    location?: string,
  ): void {
    const sink = Logger.remoteSink;
    if (sink === undefined || !sink.isEnabled(level)) {
      return;
    }
    try {
      const context =
        Logger.globalContext || this.context
          ? { ...Logger.globalContext, ...this.context }
          : undefined;
      sink.emit({ level, prefix: this.prefix, message, args, location, context });
    } catch (err) {
      // A broken sink must never break the caller's logging.
      console.debug('Remote log sink failed:', err);
    }
  }

  /**
   * Shared body of every level method: hands the call to the remote sink (independent of the
   * console level), then writes it to the console if the logger's level allows.
   *
   * @param method - The public level method that was called
   * @param location - Where the call lives in the source (`path:line#function`), if known
   * @param message - The message passed to the logger
   * @param args - The extra arguments passed to the logger
   * @example
   * ```typescript
   * this.write('warn', undefined, 'Request failed', [error]);
   * ```
   * @source
   */
  private write(
    method: keyof typeof Logger.methodLevels,
    location: string | undefined,
    message: string,
    args: readonly unknown[],
  ): void {
    const { level, remote, console: consoleMethod } = Logger.methodLevels[method];
    this.forwardRemote(remote, message, args, location);
    if (!this.shouldLog(level)) return;
    console[consoleMethod](...this.formatArgs(level, message), ...args);
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
   * @source
   */
  public debug(message: string, ...args: unknown[]): void {
    this.write('debug', undefined, message, args);
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
   * @source
   */
  public info(message: string, ...args: unknown[]): void {
    this.write('info', undefined, message, args);
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
   * @source
   */
  public warn(message: string, ...args: unknown[]): void {
    this.write('warn', undefined, message, args);
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
   * // Convention: put the cause in the message and pass details as one object, with the
   * // caught error under the `error` key (remote logs read the stack from it)
   * try {
   *   throw new Error('Connection timeout');
   * } catch (error) {
   *   logger.error(`Database error: ${getErrorMessage(error)}`, { error });
   *   // Output: [2024-01-01T00:00:00.000Z] [ERROR] [MyApp] Database error: Connection timeout { error: ... }
   * }
   *
   * // More details go in the same object
   * logger.error('Operation failed', { code: 500, reason: 'Timeout', endpoint: '/api/data' });
   * ```
   * @source
   */
  public error(message: string, ...args: unknown[]): void {
    this.write('error', undefined, message, args);
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
   * @source
   */
  public log(message: string, ...args: unknown[]): void {
    this.write('log', undefined, message, args);
  }

  /**
   * Logs a debug message with its source location. Identical to `debug()` except the first argument is the call's source location.
   * The build rewrites `logger.debug(...)` calls to this form (see `tools/logCallSites.js`) so
   * remote logs can report the file, line and function; write plain `debug()` in source.
   *
   * @param location - Where the call lives, as `path:line#function`
   * @param message - The message to log
   * @param args - Additional arguments
   * @example
   * ```typescript
   * logger.debugAt('suppliers/Foo.ts:12#Foo.fetch', 'Request failed', { status: 503 });
   * ```
   * @source
   */
  public debugAt(location: string, message: string, ...args: unknown[]): void {
    this.write('debug', location, message, args);
  }

  /**
   * Logs an info message with its source location. Identical to `info()` except the first argument is the call's source location.
   * The build rewrites `logger.info(...)` calls to this form (see `tools/logCallSites.js`) so
   * remote logs can report the file, line and function; write plain `info()` in source.
   *
   * @param location - Where the call lives, as `path:line#function`
   * @param message - The message to log
   * @param args - Additional arguments
   * @example
   * ```typescript
   * logger.infoAt('suppliers/Foo.ts:12#Foo.fetch', 'Request failed', { status: 503 });
   * ```
   * @source
   */
  public infoAt(location: string, message: string, ...args: unknown[]): void {
    this.write('info', location, message, args);
  }

  /**
   * Logs a general message (INFO level) with its source location. Identical to `log()` except the first argument is the call's source location.
   * The build rewrites `logger.log(...)` calls to this form (see `tools/logCallSites.js`) so
   * remote logs can report the file, line and function; write plain `log()` in source.
   *
   * @param location - Where the call lives, as `path:line#function`
   * @param message - The message to log
   * @param args - Additional arguments
   * @example
   * ```typescript
   * logger.logAt('suppliers/Foo.ts:12#Foo.fetch', 'Request failed', { status: 503 });
   * ```
   * @source
   */
  public logAt(location: string, message: string, ...args: unknown[]): void {
    this.write('log', location, message, args);
  }

  /**
   * Logs a warning with its source location. Identical to `warn()` except the first argument is the call's source location.
   * The build rewrites `logger.warn(...)` calls to this form (see `tools/logCallSites.js`) so
   * remote logs can report the file, line and function; write plain `warn()` in source.
   *
   * @param location - Where the call lives, as `path:line#function`
   * @param message - The message to log
   * @param args - Additional arguments
   * @example
   * ```typescript
   * logger.warnAt('suppliers/Foo.ts:12#Foo.fetch', 'Request failed', { status: 503 });
   * ```
   * @source
   */
  public warnAt(location: string, message: string, ...args: unknown[]): void {
    this.write('warn', location, message, args);
  }

  /**
   * Logs an error with its source location. Identical to `error()` except the first argument is the call's source location.
   * The build rewrites `logger.error(...)` calls to this form (see `tools/logCallSites.js`) so
   * remote logs can report the file, line and function; write plain `error()` in source.
   *
   * @param location - Where the call lives, as `path:line#function`
   * @param message - The message to log
   * @param args - Additional arguments
   * @example
   * ```typescript
   * logger.errorAt('suppliers/Foo.ts:12#Foo.fetch', 'Request failed', { status: 503 });
   * ```
   * @source
   */
  public errorAt(location: string, message: string, ...args: unknown[]): void {
    this.write('error', location, message, args);
  }

  /**
   * Logs a trace message: very fine-grained detail, such as each step of a request. Hidden from the console unless the level is `TRACE`, and sent remotely only when `trace` is selected.
   *
   * @param message - The message to log
   * @param args - Additional details, passed as one object
   * @example
   * ```typescript
   * logger.trace('Received product from stream', { detail: 1 });
   * ```
   * @source
   */
  public trace(message: string, ...args: unknown[]): void {
    this.write('trace', undefined, message, args);
  }

  /**
   * Logs a trace message: very fine-grained detail, such as each step of a request. Hidden from the console unless the level is `TRACE`, and sent remotely only when `trace` is selected with its source location. Identical to `trace()` except the first
   * argument is the call's location; the build rewrites `logger.trace(...)` to this form, so
   * write plain `trace()` in source.
   *
   * @param location - Where the call lives, as `path:line#function`
   * @param message - The message to log
   * @param args - Additional details
   * @example
   * ```typescript
   * logger.traceAt('suppliers/Foo.ts:12#Foo.fetch', 'Received product from stream', { detail: 1 });
   * ```
   * @source
   */
  public traceAt(location: string, message: string, ...args: unknown[]): void {
    this.write('trace', location, message, args);
  }

  /**
   * Logs a fatal error: the app or a whole page cannot continue, such as an uncaught exception or a crashed UI. Always shown in the console.
   *
   * @param message - The message to log
   * @param args - Additional details, passed as one object
   * @example
   * ```typescript
   * logger.fatal('Uncaught exception', { detail: 1 });
   * ```
   * @source
   */
  public fatal(message: string, ...args: unknown[]): void {
    this.write('fatal', undefined, message, args);
  }

  /**
   * Logs a fatal error: the app or a whole page cannot continue, such as an uncaught exception or a crashed UI. Always shown in the console with its source location. Identical to `fatal()` except the first
   * argument is the call's location; the build rewrites `logger.fatal(...)` to this form, so
   * write plain `fatal()` in source.
   *
   * @param location - Where the call lives, as `path:line#function`
   * @param message - The message to log
   * @param args - Additional details
   * @example
   * ```typescript
   * logger.fatalAt('suppliers/Foo.ts:12#Foo.fetch', 'Uncaught exception', { detail: 1 });
   * ```
   * @source
   */
  public fatalAt(location: string, message: string, ...args: unknown[]): void {
    this.write('fatal', location, message, args);
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
   * @source
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
   * @source
   */
  public count(label = 'default'): void {
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
   * @source
   */
  public countReset(label = 'default'): void {
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
   * @source
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
   * @source
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
   * @source
   */
  public groupEnd(): void {
    if (this.groupDepth > 0) {
      this.groupDepth--;
    }
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
   * @source
   */
  public table(tabularData: unknown, properties?: readonly string[]): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    if (typeof tabularData !== 'object' || tabularData === null) {
      console.log(this.formatMessage(LogLevel.INFO, 'Invalid data for table display'));
      return;
    }
    console.log(this.formatMessage(LogLevel.INFO, 'Table Output:'));
    console.table(tabularData, properties);
  }

  /**
   * Clears the console if possible.
   * @source
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
   * @source
   */
  public time(label = 'default'): void {
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
   * @source
   */
  public timeEnd(label = 'default'): void {
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
   * @source
   */
  public timeLog(label = 'default', ...args: unknown[]): void {
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
   * @source
   */
  public timeStamp(label?: string): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const timestamp = new Date().toISOString();
    const message = label ? `Timestamp '${label}': ${timestamp}` : `Timestamp: ${timestamp}`;

    if (typeof console.timeStamp === 'function') {
      // Browser environment with timeStamp support
      console.timeStamp(label);
      console.debug(this.formatMessage(LogLevel.DEBUG, message));
    } else {
      // Fallback for environments without timeStamp
      console.debug(this.formatMessage(LogLevel.DEBUG, message));
    }
  }
}

if (typeof window !== 'undefined') {
  Reflect.set(window, 'Logger', Logger);
}
