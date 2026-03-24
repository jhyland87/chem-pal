import { createHash } from "crypto";

/**
 * Standalone MD5 hash function that matches the logic in `src/helpers/request.ts`'s
 * `getRequestHash()`. Uses Node.js crypto instead of the browser's js-md5 library,
 * but produces the same hash for the same input.
 *
 * Hash input: `method + pathname + search + body`
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param url - Full request URL
 * @param body - Request body (empty string for GET requests)
 * @returns Object with hash, file path, and hostname
 */
export function getRequestHash(
  method: string,
  url: string,
  body: string = "",
): { hash: string; file: string; hostname: string } {
  const parsed = new URL(url);
  const input = method + (parsed.pathname ?? "") + (parsed.search ?? "") + (body ?? "");
  const hash = createHash("md5").update(input).digest("hex");

  return {
    hash,
    file: `${parsed.hostname}/${hash}.json`,
    hostname: parsed.hostname,
  };
}
