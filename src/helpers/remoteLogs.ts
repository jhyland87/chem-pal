import { analytics as analyticsConfig, defaultSettings } from '@/../config.json';
import { CACHE } from '@/constants/common';
import { canSendAnalytics, getFingerprintDistinctId, getSessionId } from '@/helpers/analytics';
import { scrubText, scrubValue } from '@/helpers/scrubPii';
import {
  isRemoteLogLevel,
  Logger,
  type RemoteLogLevel,
  type RemoteLogRecord,
  type RemoteLogSink,
} from '@/utils/Logger';
import { cstorage } from '@/utils/storage';
import { isTraceId } from '@/utils/traceId';
import type { CaptureLogOptions, LogSeverityLevel, PostHog } from 'posthog-js';

/**
 * Forwards `Logger` output to PostHog Logs.
 *
 * Uses the `posthog-js` bundle that inlines the logs extension and never loads external
 * scripts (MV3 forbids them), and imports it lazily so the popup bundle and the service
 * worker never evaluate it. Autocapture, session replay, surveys and feature flags are all
 * switched off, so the only request is the logs ingest POST. Gated by the same
 * `shareUsageData` opt-out as the rest of the analytics, and a no-op in the service worker,
 * which has no `window`.
 *
 * @module remoteLogs
 * @category Helpers
 * @source
 */

/** Log-capture settings from `config.json` (`analytics.logs`). */
const LOG_CONFIG = analyticsConfig.logs;

/**
 * How many logs a rate window lets through before `trace` and `debug` start being dropped. The rest
 * of `maxLogsPerInterval` is kept for `log`, `warn`, `error` and `fatal`, so a burst of detail can't
 * crowd out the logs that matter (posthog-js itself drops whatever exceeds the window's cap).
 */
const LOW_PRIORITY_LIMIT = Math.floor(LOG_CONFIG.maxLogsPerInterval * LOG_CONFIG.lowPriorityShare);

/** Maps a remote level to the PostHog severity it is sent as. */
const SEVERITY_BY_LEVEL: Record<RemoteLogLevel, LogSeverityLevel> = {
  trace: 'trace',
  debug: 'debug',
  log: 'info',
  warn: 'warn',
  error: 'error',
  fatal: 'fatal',
};

/**
 * Builds a level set from a stored or configured value, ignoring unknown entries.
 *
 * @param value - A possibly-array value, such as `userSettings.remoteLogLevels`
 * @returns The valid levels, or `undefined` when the value isn't an array
 * @example
 * ```typescript
 * parseLevels(['warn', 'bogus']); // Set { 'warn' }
 * parseLevels('warn');            // undefined
 * ```
 * @source
 */
function parseLevels(value: unknown): ReadonlySet<RemoteLogLevel> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return new Set(value.filter(isRemoteLogLevel));
}

/** Levels sent when the user hasn't chosen any, from `config.json` `defaultSettings`. */
const DEFAULT_LEVELS: ReadonlySet<RemoteLogLevel> =
  parseLevels(defaultSettings.remoteLogLevels) ?? new Set();

/** The posthog-js instance once loaded. */
let client: PostHog | undefined;

/** Whether records may currently be handed to PostHog; `beforeSend` drops them otherwise. */
let active = false;

/** The levels currently being forwarded. */
let enabledLevels: ReadonlySet<RemoteLogLevel> = DEFAULT_LEVELS;

/** Records emitted before posthog-js finished loading, sent once it has. */
let pending: CaptureLogOptions[] = [];

/** Identity attached to every record at send time. */
let identity: { distinctId: string; sessionId: string } | undefined;

/** Start (ms since epoch) of the current rate window. */
let windowStart = 0;

/** Logs let through in the current rate window. */
let windowCount = 0;

/** Low-priority logs dropped since the last log that was sent, reported on that next log. */
let shedCount = 0;

/** Guards `applySettings` against overlapping runs. */
let applying = false;

/** Set when settings changed while `applySettings` was already running. */
let reapply = false;

/** Whether the storage-change listener has been attached. */
let watching = false;

/**
 * Trims a string to a maximum length, marking the cut.
 *
 * @param text - The text to trim
 * @param max - The maximum number of characters to keep
 * @returns The text, or its first `max` characters followed by an ellipsis
 * @example
 * ```typescript
 * truncate('abcdef', 3); // 'abc…'
 * truncate('abc', 3);    // 'abc'
 * ```
 * @source
 */
function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Renders one logger argument as a bounded string with personal data scrubbed.
 *
 * @param arg - Any value passed to a logger call
 * @returns A string of at most `maxArgChars` characters
 * @example
 * ```typescript
 * stringifyArg({ a: 1 }); // '{"a":1}'
 * stringifyArg(undefined); // 'undefined'
 * ```
 * @source
 */
function stringifyArg(arg: unknown): string {
  const max = LOG_CONFIG.maxArgChars;
  if (typeof arg === 'string') {
    return truncate(scrubText(arg), max);
  }
  if (typeof arg === 'function') {
    return '[function]';
  }
  if (typeof arg === 'symbol') {
    return truncate(scrubText(arg.toString()), max);
  }
  if (typeof arg !== 'object' || arg === null) {
    return truncate(String(arg), max);
  }
  // scrubValue yields a bounded, cycle-free copy, so stringifying it can't throw.
  return truncate(JSON.stringify(scrubValue(arg)) ?? Object.prototype.toString.call(arg), max);
}

/**
 * Separates an `Error` from a logger argument. A bare `Error` is taken whole; for a plain
 * object, the first top-level property holding an `Error` is taken (the `{ error }` style
 * every warn/error call uses) and the rest of the object is returned.
 *
 * @param arg - One logger argument
 * @returns The `Error` found (if any) and whatever is left of the argument to log as-is
 * @example
 * ```typescript
 * splitError(new Error('boom'));                  // { error: Error('boom'), rest: undefined }
 * splitError({ error: new Error('x'), id: 7 });   // { error: Error('x'), rest: { id: 7 } }
 * splitError({ id: 7 });                          // { rest: { id: 7 } }
 * ```
 * @source
 */
function splitError(arg: unknown): { error?: Error; rest: unknown } {
  if (arg instanceof Error) {
    return { error: arg, rest: undefined };
  }
  const plain =
    typeof arg === 'object' &&
    arg !== null &&
    (Object.getPrototypeOf(arg) === Object.prototype || Object.getPrototypeOf(arg) === null);
  if (!plain) {
    return { rest: arg };
  }
  const entries = Object.entries(arg);
  const found = entries.find(([, value]) => value instanceof Error);
  if (!found || !(found[1] instanceof Error)) {
    return { rest: arg };
  }
  const rest = Object.fromEntries(entries.filter(([key]) => key !== found[0]));
  return { error: found[1], rest: Object.keys(rest).length > 0 ? rest : undefined };
}

/**
 * Flattens a logger call's extra arguments into bounded, scrubbed log attributes. The first
 * `Error`, whether passed bare or as a property of an object argument (`{ error }`), becomes
 * `error_name`/`error_message`/`error_stack`; everything else becomes `arg_0`, `arg_1`, ...
 *
 * @param args - The extra arguments passed to the logger
 * @returns Attributes that are all strings (plus an omitted-count when args were dropped)
 * @example
 * ```typescript
 * describeArgs([new Error('boom'), { id: 7 }]);
 * // { error_name: 'Error', error_message: 'boom', error_stack: '...', arg_0: '{"id":7}' }
 * describeArgs([{ error: new Error('boom'), id: 7 }]);
 * // { error_name: 'Error', error_message: 'boom', error_stack: '...', arg_0: '{"id":7}' }
 * ```
 * @source
 */
function describeArgs(args: readonly unknown[]): Record<string, string | number> {
  const attributes: Record<string, string | number> = {};
  let index = 0;
  for (const original of args.slice(0, LOG_CONFIG.maxArgs)) {
    let arg = original;
    if (attributes.error_name === undefined) {
      const { error, rest } = splitError(original);
      if (error) {
        attributes.error_name = error.name;
        attributes.error_message = truncate(scrubText(error.message), LOG_CONFIG.maxArgChars);
        if (error.stack) {
          attributes.error_stack = truncate(scrubText(error.stack), LOG_CONFIG.maxStackChars);
        }
        if (rest === undefined) {
          continue;
        }
        arg = rest;
      }
    }
    attributes[`arg_${index}`] = stringifyArg(arg);
    index += 1;
  }
  if (args.length > LOG_CONFIG.maxArgs) {
    attributes.args_omitted = args.length - LOG_CONFIG.maxArgs;
  }
  return attributes;
}

/**
 * Turns a log's context (e.g. the active search query) into bounded, scrubbed attributes.
 *
 * @param context - The context the logger carried when the call was made, if any
 * @returns One attribute per context entry; empty when there is no context
 * @example
 * ```typescript
 * contextAttributes({ search_query: 'acetone' }); // { search_query: 'acetone' }
 * contextAttributes(undefined);                   // {}
 * ```
 * @source
 */
function contextAttributes(context?: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(context ?? {}).map(([key, value]) => [
      key,
      truncate(scrubText(value), LOG_CONFIG.maxArgChars),
    ]),
  );
}

/** Matches a build-injected call location: `path:line` with an optional `#function`. */
const LOCATION_PATTERN = /^(.+?):(\d+)(?:#(.+))?$/;

/**
 * Converts a call location recorded at build time into OpenTelemetry source attributes.
 *
 * @param location - `path:line#function` as injected by `tools/logCallSites.js`, if any
 * @returns `code.filepath`, `code.lineno` and (when known) `code.function`; empty when the
 * call wasn't instrumented or the value is malformed
 * @example
 * ```typescript
 * locationAttributes('suppliers/SupplierBase.ts:1431#SupplierBase.fetch');
 * // { 'code.filepath': 'suppliers/SupplierBase.ts', 'code.lineno': 1431,
 * //   'code.function': 'SupplierBase.fetch' }
 * locationAttributes(undefined); // {}
 * ```
 * @source
 */
function locationAttributes(location?: string): Record<string, string | number> {
  const match = location === undefined ? null : LOCATION_PATTERN.exec(location);
  if (!match) {
    return {};
  }
  const [, filepath, line, fn] = match;
  return {
    'code.filepath': filepath,
    'code.lineno': Number(line),
    ...(fn ? { 'code.function': fn } : {}),
  };
}

/**
 * Names the extension page the log came from.
 *
 * @returns `'options'` on the options page, otherwise `'app'`
 * @example
 * ```typescript
 * pageContext(); // 'app'
 * ```
 * @source
 */
function pageContext(): string {
  return typeof location !== 'undefined' && location.pathname.includes('options')
    ? 'options'
    : 'app';
}

/**
 * Converts a logger call into a bounded PostHog log record.
 *
 * @param record - The log call handed over by `Logger`
 * @returns A record with a truncated body and sanitized attributes
 * @example
 * ```typescript
 * toCaptureLog({ level: 'warn', prefix: 'Cache', message: 'Miss', args: [] });
 * // { body: 'Miss', level: 'warn', attributes: { logger: 'Cache', context: 'app', ... } }
 * ```
 * @source
 */
function toCaptureLog(record: RemoteLogRecord): CaptureLogOptions {
  const traceId = record.context?.trace_id;
  return {
    // The OpenTelemetry trace id lets PostHog group a search's logs; it is also kept as an
    // attribute (below) so it's visible and filterable in the log details.
    ...(isTraceId(traceId) ? { trace_id: traceId } : {}),
    body: truncate(scrubText(record.message), LOG_CONFIG.maxMessageChars),
    level: SEVERITY_BY_LEVEL[record.level],
    attributes: {
      logger: record.prefix,
      context: pageContext(),
      app_version: __APP_VERSION__,
      ...contextAttributes(record.context),
      ...locationAttributes(record.location),
      ...describeArgs(record.args),
    },
  };
}

/**
 * The sink registered with `Logger`: buffers records until posthog-js has loaded, then
 * passes them straight through.
 */
const sink: RemoteLogSink = {
  isEnabled: (level) => enabledLevels.has(level),
  emit: (record) => {
    const log = toCaptureLog(record);
    if (client) {
      client.captureLog(log);
      return;
    }
    if (pending.length < LOG_CONFIG.preInitBufferSize) {
      pending.push(log);
    }
  },
};

/**
 * Reads the log levels the user chose, falling back to the configured defaults.
 *
 * @returns The levels to forward
 * @example
 * ```typescript
 * await readConfiguredLevels(); // Set { 'log', 'warn', 'error' }
 * ```
 * @source
 */
async function readConfiguredLevels(): Promise<ReadonlySet<RemoteLogLevel>> {
  try {
    const stored = await cstorage.local.get(CACHE.USER_SETTINGS);
    const settings = stored[CACHE.USER_SETTINGS];
    if (settings && typeof settings === 'object') {
      return parseLevels(Reflect.get(settings, 'remoteLogLevels')) ?? DEFAULT_LEVELS;
    }
  } catch {
    return DEFAULT_LEVELS;
  }
  return DEFAULT_LEVELS;
}

/**
 * Pre-send filter: drops everything while sending is switched off, sheds `trace` and `debug`
 * when a rate window is nearly full (reporting how many on the next log as `logs_shed_before`),
 * and stamps the shared analytics identity on what remains. Runs before PostHog adds its own
 * context.
 *
 * @param log - The record about to be queued
 * @returns The record with identity attributes, or `null` to drop it
 * @example
 * ```typescript
 * beforeSend({ body: 'x', attributes: {} }); // { body: 'x', attributes: { distinct_id: 'fp_...', ... } }
 * ```
 * @source
 */
function beforeSend(log: CaptureLogOptions): CaptureLogOptions | null {
  if (!active || !identity) {
    return null;
  }
  const now = Date.now();
  if (now - windowStart >= LOG_CONFIG.flushIntervalMs) {
    windowStart = now;
    windowCount = 0;
  }
  // Once the window is mostly full, shed the lowest-priority logs so the rest are never dropped.
  if ((log.level === 'trace' || log.level === 'debug') && windowCount >= LOW_PRIORITY_LIMIT) {
    shedCount += 1;
    return null;
  }
  windowCount += 1;
  const shed = shedCount;
  shedCount = 0;
  return {
    ...log,
    attributes: {
      ...log.attributes,
      distinct_id: identity.distinctId,
      session_id: identity.sessionId,
      ...(shed > 0 ? { logs_shed_before: shed } : {}),
    },
  };
}

/**
 * Loads posthog-js and initializes it for logs only, or resumes it after an opt-out.
 * Flushes anything buffered while it was loading.
 *
 * @returns A promise that resolves once logging is live
 * @example
 * ```typescript
 * await startClient();
 * ```
 * @source
 */
async function startClient(): Promise<void> {
  active = true;
  if (client) {
    client.opt_in_capturing({ captureEventName: false });
    return;
  }

  identity = { distinctId: getFingerprintDistinctId(), sessionId: await getSessionId() };
  const { default: posthog } = await import('posthog-js/full/no-external');
  posthog.init(analyticsConfig.apiKey, {
    api_host: analyticsConfig.host,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    disable_session_recording: true,
    disable_surveys: true,
    advanced_disable_flags: true,
    persistence: 'memory',
    bootstrap: { distinctID: identity.distinctId, sessionID: identity.sessionId },
    logs: {
      serviceName: LOG_CONFIG.serviceName,
      environment: import.meta.env.MODE,
      serviceVersion: __APP_VERSION__,
      flushIntervalMs: LOG_CONFIG.flushIntervalMs,
      maxBufferSize: LOG_CONFIG.maxBufferSize,
      maxLogsPerInterval: LOG_CONFIG.maxLogsPerInterval,
      beforeSend,
    },
  });
  client = posthog;
  for (const log of pending) {
    posthog.captureLog(log);
  }
  pending = [];
}

/**
 * Stops sending immediately: detaches the sink, drops buffered and queued records, and
 * opts posthog-js out.
 *
 * @example
 * ```typescript
 * stopSending();
 * ```
 * @source
 */
function stopSending(): void {
  active = false;
  windowStart = 0;
  windowCount = 0;
  shedCount = 0;
  Logger.setRemoteSink(undefined);
  pending = [];
  if (client) {
    client.reset();
    client.opt_out_capturing();
  }
}

/**
 * Re-evaluates whether and what to send from the current opt-out and level settings.
 * Runs are serialized; a change that lands mid-run triggers one more pass.
 *
 * @returns A promise that resolves once settings have been applied
 * @example
 * ```typescript
 * await applySettings();
 * ```
 * @source
 */
async function applySettings(): Promise<void> {
  if (applying) {
    reapply = true;
    return;
  }
  applying = true;
  try {
    do {
      reapply = false;
      enabledLevels = await readConfiguredLevels();
      if (await canSendAnalytics()) {
        Logger.setRemoteSink(sink);
        await startClient();
      } else {
        stopSending();
      }
    } while (reapply);
  } finally {
    applying = false;
  }
}

/**
 * Starts forwarding `Logger` output to PostHog Logs on the current extension page. Safe to
 * call more than once. Does nothing outside a page with a DOM (the service worker), in
 * tests, or in the e2e build; stops again if the user opts out of usage sharing.
 *
 * @category Helpers
 * @group Bug reporting
 * @returns A promise that resolves once the initial settings have been applied
 * @example
 * ```typescript
 * void initRemoteLogs();
 * new Logger('Cache').warn('Miss'); // also sent to PostHog Logs when enabled
 * ```
 * @source
 */
export async function initRemoteLogs(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  if (import.meta.env.MODE === 'test' || __IS_E2E_BUILD__) {
    return;
  }
  // Register right away so startup logs are buffered; applySettings detaches it if sending is off.
  Logger.setRemoteSink(sink);
  if (!watching) {
    watching = true;
    cstorage.onChanged.addListener((changes) => {
      if (CACHE.USER_SETTINGS in changes) {
        void applySettings();
      }
    });
  }
  await applySettings();
}
