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
    this.name = "EmptyResponseError";
  }
}

/**
 * Error thrown when an HTTP response has a non-2xx status. Carries the numeric
 * status so callers can branch on it (e.g. retrying a `403` WAF cookie
 * challenge) rather than string-matching the message.
 * @category Exceptions
 * @param status - The HTTP status code (e.g. 403)
 * @param statusText - The HTTP status text (e.g. "Forbidden")
 * @returns The HttpError instance
 * @example
 * ```typescript
 * try {
 *   await fetchDecorator(url);
 * } catch (error) {
 *   if (error instanceof HttpError && error.status === 403) {
 *     // retry the request
 *   }
 * }
 * ```
 * @source
 */
export class HttpError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  constructor(status: number, statusText: string) {
    super(`HTTP Error: ${status} ${statusText}`);
    this.name = "HttpError";
    this.status = status;
    this.statusText = statusText;
  }
}
