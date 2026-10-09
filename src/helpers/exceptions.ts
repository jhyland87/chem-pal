import { SEARCH_ABORT_REASON } from '@/constants/common';
import { HttpStatus } from '@/constants/httpStatus';

/**
 * Error thrown when a response is empty.
 * @category Exceptions
 * @param message - The message to display
 * @returns The EmptyResponseError instance
 * @example
 * ```typescript
 * throw new EmptyResponseError("Response is empty");
 * ```
 * @source
 */
export class EmptyResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmptyResponseError';
  }
}

/**
 * Error thrown when an HTTP response has a non-2xx status. Carries the numeric
 * status so callers can branch on it (e.g. retrying a `403` WAF cookie
 * challenge) rather than string-matching the message.
 * @category Exceptions
 * @param status - The HTTP status code (e.g. 403)
 * @param statusText - The HTTP status text (e.g. "Forbidden")
 * @param body - The (truncated) response body, when it could be read
 * @returns The HttpError instance
 * @example
 * ```typescript
 * try {
 *   await fetchDecorator(url);
 * } catch (error) {
 *   if (error instanceof HttpError && error.status === 403) {
 *     // retry the request
 *   }
 *   if (error instanceof HttpError && error.body?.includes('INVALID_API_KEY')) {
 *     // the API told us why it refused the request
 *   }
 * }
 * ```
 * @source
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly body?: string;
  constructor(status: number, statusText: string, body?: string) {
    super(statusText ? `HTTP Error: ${status} ${statusText}` : `HTTP Error: ${status}`);
    this.name = 'HttpError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
  }
}

/**
 * Reads a human-readable message from anything that can be thrown. A `catch` variable is
 * typed `unknown`, so `error.message` doesn't type-check; this narrows it safely. Used to put
 * the cause in a logger call's message (see the last example).
 * @category Exceptions
 * @param error - Whatever was thrown or rejected with
 * @returns An `Error`'s message (its name when the message is empty), a string as-is, or
 * the string form of anything else; `"Unknown error"` if even that fails
 * @example
 * ```typescript
 * getErrorMessage(new TypeError('bad input')); // 'bad input'
 * getErrorMessage(new Error(''));              // 'Error'
 * getErrorMessage('user_aborted');             // 'user_aborted'
 * getErrorMessage({ code: 1 });                // '[object Object]'
 * getErrorMessage(undefined);                  // 'undefined'
 *
 * // In a logger call, message first and the error itself in the object:
 * logger.warn(`Failed to load: ${getErrorMessage(error)}`, { error });
 * ```
 * @source
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return String(error);
  } catch {
    // e.g. an object with a null prototype has no toString.
    return 'Unknown error';
  }
}

/**
 * True for an `AbortError`, the error a cancelled `fetch` rejects with. A user stop or a
 * search-budget timeout is expected and must not be treated as a supplier failure.
 * @category Exceptions
 * @param error - Whatever was thrown or rejected with
 * @returns `true` when the value is an `Error` named `AbortError`
 * @example
 * ```typescript
 * isAbortError(new DOMException('stop', 'AbortError')); // true
 * isAbortError('user_aborted');                        // false (see isExpectedAbort)
 * ```
 * @source
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * True when something stopped because the search was deliberately aborted: an `AbortError`,
 * or one of the bare `SEARCH_ABORT_REASON` strings that a fetch rejects with when
 * `controller.abort(reason)` is given a string. Use it to log such stops at `debug`.
 * @category Exceptions
 * @param error - Whatever was thrown or rejected with
 * @returns `true` for an expected stop, `false` for a real failure
 * @example
 * ```typescript
 * isExpectedAbort('user_aborted');                       // true
 * isExpectedAbort('time_budget_exceeded');               // true
 * isExpectedAbort(new DOMException('x', 'AbortError'));  // true
 * isExpectedAbort(new TypeError('bad response'));        // false
 * ```
 * @source
 */
export function isExpectedAbort(error: unknown): boolean {
  if (isAbortError(error)) {
    return true;
  }
  return typeof error === 'string' && Object.values<string>(SEARCH_ABORT_REASON).includes(error);
}

/**
 * True when a supplier answered `429 Too Many Requests`. That is the supplier throttling us, not
 * a bug here, so callers log it at `warn` instead of `error`.
 * @category Exceptions
 * @param error - Whatever was thrown or rejected with
 * @returns `true` for an `HttpError` with status 429
 * @example
 * ```typescript
 * isRateLimited(new HttpError(429, 'Too Many Requests')); // true
 * isRateLimited(new HttpError(403, 'Forbidden'));         // false
 * isRateLimited(new Error('HTTP Error: 429'));            // false (not an HttpError)
 * ```
 * @source
 */
export function isRateLimited(error: unknown): boolean {
  return error instanceof HttpError && error.status === HttpStatus.TOO_MANY_REQUESTS;
}
