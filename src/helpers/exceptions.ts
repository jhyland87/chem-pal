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
