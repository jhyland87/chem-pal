/** An OpenTelemetry trace id: 32 lowercase hex characters, not all zero. */
const TRACE_ID_PATTERN = /^(?!0{32}$)[0-9a-f]{32}$/;

/**
 * Generates a random OpenTelemetry trace id, used to tie together every log from one search.
 * It carries no information about the user or the query.
 * @category Utils
 * @group Types
 * @returns 32 lowercase hex characters
 * @example
 * ```typescript
 * generateTraceId(); // '4bf92f3577b34da6a3ce929d0e0e4736'
 * ```
 * @source
 */
export function generateTraceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  // An all-zero id is invalid in OpenTelemetry (a 1-in-2^128 chance, but cheap to rule out).
  return TRACE_ID_PATTERN.test(id) ? id : generateTraceId();
}

/**
 * Whether a value is a well-formed trace id, so a malformed one is never sent as the `trace_id`.
 * @category Utils
 * @group Types
 * @param value - The value to test
 * @returns `true` for 32 lowercase hex characters that are not all zero
 * @example
 * ```typescript
 * isTraceId('4bf92f3577b34da6a3ce929d0e0e4736'); // true
 * isTraceId('00000000000000000000000000000000'); // false
 * isTraceId('not-a-trace-id');                   // false
 * ```
 * @source
 */
export function isTraceId(value: unknown): value is string {
  return typeof value === 'string' && TRACE_ID_PATTERN.test(value);
}
