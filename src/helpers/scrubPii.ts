/**
 * Strips personally identifiable and credential-like data from text and values before they
 * are sent off the device as diagnostic logs. Pattern-based and deliberately conservative:
 * it removes what it recognizes, so it complements (not replaces) not logging sensitive
 * data in the first place.
 *
 * @module scrubPii
 * @category Helpers
 * @source
 */

/** Marker substituted for removed text or values. */
const REDACTED = '[redacted]';

/** Longest array or object-key list kept when copying a value; the rest is summarized. */
const MAX_ITEMS = 20;

/** Deepest nesting copied before a value is replaced by a type marker. */
const MAX_DEPTH = 4;

/**
 * Object keys whose values are never sent, matched case-insensitively against the whole key
 * with `-`/`_` removed. Covers credentials, contact details, and location.
 */
const SENSITIVE_KEY =
  /^(authorization|proxyauthorization|cookie|setcookie|auth|bearer|jwt|csrf|xsrf|xapikey|xauthtoken|email|mail|phone|telephone|mobile|fax|address|street|zip|zipcode|postcode|postalcode|city|country|location|latitude|longitude|lat|lng|ip|ipaddress|username|firstname|lastname|fullname|ssn|dob|birthday|.*(password|passwd|passphrase|secret|token|apikey|clientid|credential|session|cookie).*)$/i;

/**
 * Email addresses. The lookbehind makes a scan start only at the beginning of a run of local-part
 * characters; without it, a long run with no `@` is rescanned from every position (quadratic).
 */
const EMAIL = /(?<![a-z0-9._%+-])[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;

/** Absolute `http(s)`/`ws(s)`/`ftp` URLs, up to whitespace or a closing delimiter. */
const URL_PATTERN = /\b(?:https?|wss?|ftp):\/\/[^\s"'<>)\]}]+/gi;

/** Dotted-quad IPv4 addresses. */
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

/** IPv6 addresses (four or more hex groups, so clock times like `12:30:45` are left alone). */
const IPV6 = /\b(?:[0-9a-f]{1,4}:){4,7}[0-9a-f]{1,4}\b/gi;

/** The user-name segment of macOS, Linux, and Windows home-directory paths. */
const HOME_PATH = /(\/Users\/|\/home\/|[a-z]:\\Users\\)[^/\\\s]+/gi;

/** `Bearer`/`Basic` authorization credentials. */
const AUTH_SCHEME = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi;

/** JSON Web Tokens. */
const JWT = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g;

/**
 * `key=value` / `key: value` pairs whose key names a credential, including compound keys
 * such as `client_secret`, `refresh_token`, `clientSecret`, and `x-api-key`.
 */
const SECRET_PAIR =
  /(?<![\w.-])([\w.-]*(?:api[_-]?key|token|secret|password|passwd|passphrase|session|cookie|authorization|client[_-]?id|credential)[\w.-]*["']?\s*[=:]\s*)["']?(?:(?:Bearer|Basic)\s+)?[^\s"',;&]+["']?/gi;

/** Longest text scrubbed in full; the sender keeps only a few hundred characters anyway. */
const MAX_SCRUB_CHARS = 50_000;

/**
 * Reduces a URL to its origin and path, dropping credentials, the query string and the
 * fragment, any of which can carry user input or tokens.
 *
 * @param url - A URL found in text
 * @returns The URL without `user:pass@`, `?query` or `#hash`
 * @example
 * ```typescript
 * stripUrl('https://user:pw@shop.example.com/p/1?q=aspirin&token=abc#top');
 * // 'https://shop.example.com/p/1'
 * ```
 * @source
 */
function stripUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    // Not parseable (e.g. truncated); cut at the first query/fragment marker instead.
    return url.replace(/^([a-z]+:\/\/)[^/@\s]*@/i, '$1').replace(/[?#].*$/, '');
  }
}

/**
 * Removes recognizable personal and credential data from a string: email addresses, IP
 * addresses, URL credentials/queries/fragments, home-directory user names, authorization
 * headers, JWTs, and `token=...`-style pairs.
 *
 * @category Helpers
 * @group Formatters
 * @param text - The text to scrub (only the first 50,000 characters are kept)
 * @returns The text with matches replaced by markers such as `[email]`
 * @example
 * ```typescript
 * scrubText('mail me@example.com via https://x.com/a?q=1 from /Users/jo/app.js');
 * // 'mail [email] via https://x.com/a from /Users/[user]/app.js'
 * ```
 * @source
 */
export function scrubText(text: string): string {
  return text
    .slice(0, MAX_SCRUB_CHARS)
    .replace(URL_PATTERN, stripUrl)
    .replace(EMAIL, '[email]')
    .replace(SECRET_PAIR, `$1${REDACTED}`)
    .replace(AUTH_SCHEME, '$1 [token]')
    .replace(JWT, '[token]')
    .replace(IPV4, '[ip]')
    .replace(IPV6, '[ip]')
    .replace(HOME_PATH, '$1[user]');
}

/**
 * Whether an object key names sensitive data whose value must not be sent.
 *
 * @param key - The property name
 * @returns `true` for credential, contact, and location keys
 * @example
 * ```typescript
 * isSensitiveKey('Authorization'); // true
 * isSensitiveKey('access_token');  // true
 * isSensitiveKey('title');         // false
 * ```
 * @source
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key.replace(/[-_\s]/g, ''));
}

/**
 * Copies a value into a JSON-safe form with sensitive data removed: strings are scrubbed,
 * values under sensitive keys are replaced, and size, depth, and cycles are bounded.
 *
 * @category Helpers
 * @group Formatters
 * @param value - Any value passed to a logger
 * @param seen - Objects already visited on this path, used to cut cycles
 * @param depth - Current nesting depth
 * @returns A scrubbed, serializable copy
 * @example
 * ```typescript
 * scrubValue({ title: 'Aspirin', headers: { Authorization: 'Bearer abcdefgh1234' }, email: 'a@b.co' });
 * // { title: 'Aspirin', headers: { Authorization: '[redacted]' }, email: '[redacted]' }
 * ```
 * @source
 */
export function scrubValue(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (typeof value === 'string') {
    return scrubText(value);
  }
  if (typeof value === 'function') {
    return '[function]';
  }
  if (typeof value === 'symbol') {
    return scrubText(value.toString());
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (value instanceof Error) {
    return { name: value.name, message: scrubText(value.message) };
  }
  if (seen.has(value)) {
    return '[circular]';
  }
  if (depth >= MAX_DEPTH) {
    return Array.isArray(value) ? '[array]' : '[object]';
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const items = value.slice(0, MAX_ITEMS).map((item) => scrubValue(item, seen, depth + 1));
      return value.length > MAX_ITEMS ? [...items, `[${value.length - MAX_ITEMS} more]`] : items;
    }
    if (value instanceof Map || value instanceof Set) {
      return scrubValue([...value], seen, depth);
    }
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, MAX_ITEMS)) {
      result[key] = isSensitiveKey(key) ? REDACTED : scrubValue(item, seen, depth + 1);
    }
    return result;
  } finally {
    seen.delete(value);
  }
}
