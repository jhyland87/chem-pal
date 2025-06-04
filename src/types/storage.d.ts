declare global {
  /**
   * Base response wrapper for all Macklin API responses.
   * All API endpoints return data in this format, with a status code,
   * message, and typed data payload.
   *
   * @example
   * ```json
   * {
   *   "code": 200,
   *   "message": "success",
   *   "data": { ... }
   * }
   * ```
   */
  interface MacklinApiResponse<T = unknown> {
    /** HTTP status code returned by the API */
    code: number;
    /** Status message or error description */
    message: string;
    /** Typed response data */
    data: T;
  }

  interface StorageSettings {
    hideColumns: string[];
  }
}

export {};
