/**
 * HTTP status codes the extension compares against or documents. Use these instead of bare
 * numbers so a check like `error.status === HttpStatus.FORBIDDEN` explains itself.
 *
 * Deliberately a short list of the codes that matter when talking to supplier sites, not the
 * full registry; add a member here when a new code is needed. It replaced the
 * `http-status-codes` package, whose ~60-entry enum was bundled for the sake of one constant.
 *
 * @module httpStatus
 * @category Constants
 * @group Constants
 * @source
 */

/**
 * Common HTTP status codes, named in `UPPER_SNAKE_CASE` after their reason phrases.
 * @category Constants
 * @group Constants
 * @example
 * ```ts
 * if (response.status === HttpStatus.OK) return parse(response);
 * if (response.status === HttpStatus.TOO_MANY_REQUESTS) await backOff();
 * HttpStatus.NOT_FOUND; // => 404
 * ```
 * @source
 */
export enum HttpStatus {
  // 2xx: success
  /** The request succeeded. */
  OK = 200,
  /** The request succeeded and created a resource. */
  CREATED = 201,
  /** The request was accepted for processing, which may not have finished. */
  ACCEPTED = 202,
  /** The request succeeded and there is no body to return. */
  NO_CONTENT = 204,
  /** Only part of the resource was returned, as a range request asked for. */
  PARTIAL_CONTENT = 206,

  // 3xx: redirection
  /** The resource has permanently moved. */
  MOVED_PERMANENTLY = 301,
  /** The resource is temporarily at another URL. */
  FOUND = 302,
  /** The response lives at another URL and should be fetched with GET. */
  SEE_OTHER = 303,
  /** The cached copy is still valid. */
  NOT_MODIFIED = 304,
  /** Temporary redirect that keeps the request method. */
  TEMPORARY_REDIRECT = 307,
  /** Permanent redirect that keeps the request method. */
  PERMANENT_REDIRECT = 308,

  // 4xx: client error
  /** The server could not understand the request. */
  BAD_REQUEST = 400,
  /** Authentication is required or has failed. */
  UNAUTHORIZED = 401,
  /** Reserved for payment; some storefronts use it for paywalled content. */
  PAYMENT_REQUIRED = 402,
  /** The server understood the request but refuses it (often a bot challenge). */
  FORBIDDEN = 403,
  /** The resource does not exist. */
  NOT_FOUND = 404,
  /** The request method is not allowed for this resource. */
  METHOD_NOT_ALLOWED = 405,
  /** The server cannot produce a response matching the `Accept` headers. */
  NOT_ACCEPTABLE = 406,
  /** The server timed out waiting for the request. */
  REQUEST_TIMEOUT = 408,
  /** The request conflicts with the current state of the resource. */
  CONFLICT = 409,
  /** The resource is gone and will not return. */
  GONE = 410,
  /** The request body is larger than the server allows. */
  PAYLOAD_TOO_LARGE = 413,
  /** The request body's media type is not supported. */
  UNSUPPORTED_MEDIA_TYPE = 415,
  /** The request was well-formed but could not be processed. */
  UNPROCESSABLE_ENTITY = 422,
  /** Too many requests were sent; the client is being rate limited. */
  TOO_MANY_REQUESTS = 429,
  /** The resource is unavailable for legal reasons. */
  UNAVAILABLE_FOR_LEGAL_REASONS = 451,

  // 5xx: server error
  /** The server hit an unexpected error. */
  INTERNAL_SERVER_ERROR = 500,
  /** The server does not support the requested functionality. */
  NOT_IMPLEMENTED = 501,
  /** A gateway or proxy got an invalid response from upstream. */
  BAD_GATEWAY = 502,
  /** The server is overloaded or down for maintenance. */
  SERVICE_UNAVAILABLE = 503,
  /** A gateway or proxy timed out waiting for upstream. */
  GATEWAY_TIMEOUT = 504,
}
