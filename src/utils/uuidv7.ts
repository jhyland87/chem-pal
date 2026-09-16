/**
 * RFC 9562 UUIDv7 generation. Ported by hand rather than adding a dependency —
 * the format is small and fully specified, matching this project's existing
 * preference for hand-rolling well-specified primitives over pulling in a
 * package for one function (see `src/helpers/analytics.ts`'s module doc for
 * the same reasoning applied to not loading `posthog-js`).
 * @module uuidv7
 * @category Utils
 * @source
 */

/**
 * Writes a 48-bit big-endian millisecond timestamp into `bytes[0..5]`. Uses
 * division/modulo rather than bitwise operators — `Date.now()` (~1.76e12 for
 * current dates) exceeds the 32-bit range JS bitwise operators silently
 * truncate to, so `timestamp & 0xff`-style extraction would corrupt the high
 * bytes.
 * @param bytes - The 16-byte buffer to write into.
 * @param timestampMs - Epoch milliseconds to encode.
 * @source
 */
function writeTimestampBytes(bytes: Uint8Array, timestampMs: number): void {
  let remaining = timestampMs;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = remaining % 256;
    remaining = Math.floor(remaining / 256);
  }
}

/**
 * Formats a 16-byte buffer as a lowercase, hyphenated UUID string.
 * @param bytes - Exactly 16 bytes.
 * @returns The `8-4-4-4-12` hex string.
 * @source
 */
function bytesToUuidString(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generates a UUIDv7: a 48-bit millisecond timestamp followed by 74 random
 * bits (with the version and variant bits overlaid per RFC 9562). Unlike
 * `crypto.randomUUID()` (always v4, fully random), a v7 id's leading bytes
 * sort chronologically and embed its creation time — required for PostHog's
 * `$session_id` property, which PostHog validates against captured events'
 * timestamps.
 * @category Utils
 * @group Utils
 * @returns A lowercase, hyphenated UUIDv7 string.
 * @example
 * ```ts
 * generateUuidV7(); // => "018f4f3e-1a2b-7c3d-8e4f-5a6b7c8d9e0f"
 * ```
 * @source
 */
export function generateUuidV7(): string {
  const bytes = new Uint8Array(16);
  writeTimestampBytes(bytes, Date.now());

  const random = crypto.getRandomValues(new Uint8Array(10));
  bytes.set(random, 6);

  // Version: top nibble of byte 6 becomes 0111 (7).
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  // Variant: top two bits of byte 8 become 10.
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return bytesToUuidString(bytes);
}
