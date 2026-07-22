import { findCountryByName } from '@/helpers/country';
import { htmlToAscii } from '@/helpers/utils';
import { isCountryCode } from '@/utils/typeGuards/common';

/**
 * @group Suppliers
 * @groupDescription Synthetika-specific parsing of the purchase restrictions encoded in a
 * product's `shortDescription` HTML. Produces a supplier-agnostic
 * {@link PurchaseRestriction} that the general filter helpers consume.
 * @source
 */

/** Non-ISO country names the `country-list-js` library doesn't index, mapped to ISO codes. */
const COUNTRY_ALIASES: Record<string, string> = {
  USA: 'US',
  UK: 'GB',
};

/** Case-insensitive phrases that mean the product is limited to non-consumer buyers. */
const BUYER_PATTERNS: readonly RegExp[] = [
  /only be purchased by/i,
  /registered business/i,
  /government entities/i,
  /only company orders/i,
  /only available for companies/i,
  /exclusively for [a-z\s]+ customers/i,
];

/**
 * Collapses inconsistent whitespace in restriction text: normalizes nbsp and CRLF, and
 * squashes runs of spaces/tabs to a single space while preserving line breaks (which the
 * region matcher relies on as a boundary).
 * @param text - The raw text to normalize
 * @returns The whitespace-normalized text
 * @example
 * ```typescript
 * normalizeRestrictionText("a  b\r\nc"); // "a b\nc"
 * ```
 * @source
 */
function normalizeRestrictionText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Resolves a single raw country token (from a comma-separated do-not-ship list) to an ISO
 * 3166-1 alpha-2 code. Tokens are dirty in the wild — they carry stray glyphs (e.g. the
 * `ⓘ` link text), use full names (`Germany`), or non-ISO aliases (`USA`). Strips anything
 * that isn't a letter or space, then resolves via the alias map, a two-letter ISO check,
 * or a country-name lookup.
 * @param raw - The raw token, e.g. `" USA "`, `"Germany"`, `"US ⓘ"`
 * @returns The resolved country code, or undefined when the token can't be resolved
 * @example
 * ```typescript
 * resolveCountryToken("US ⓘ"); // "US"
 * resolveCountryToken("Germany"); // "DE"
 * resolveCountryToken("USA"); // "US"
 * resolveCountryToken("nonsense"); // undefined
 * ```
 * @source
 */
function resolveCountryToken(raw: string): CountryCode | undefined {
  const token = raw
    .replace(/[^a-zA-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (token.length === 0) {
    return undefined;
  }
  const alias = COUNTRY_ALIASES[token.toUpperCase()];
  if (alias !== undefined && isCountryCode(alias)) {
    return alias;
  }
  const upper = token.toUpperCase();
  if (token.length === 2 && isCountryCode(upper)) {
    return upper;
  }
  return findCountryByName(token);
}

/**
 * Parses Synthetika product text (an HTML `shortDescription`) into a
 * {@link PurchaseRestriction}. The source formatting is inconsistent (double spaces, nbsp,
 * emoji/mojibake, multiple `<p>`/`<br>` blocks), so all matching is case-insensitive over
 * whitespace-normalized text. When a delivery restriction is detected but can't be resolved
 * to a specific country or the EU, the product is flagged `restrictedDelivery` (excluded to
 * be safe). Declaration-of-use text is captured but never excludes.
 * @param html - The product's `shortDescription` HTML (or any value)
 * @returns The parsed restriction, or undefined when the text carries no restriction
 * @example
 * ```typescript
 * parseSynthetikaRestrictions("<p>We do not ship this product to: US, DE | Unless government approved</p>");
 * // { excludedCountries: ["US", "DE"], note: "We do not ship this product to: US, DE | Unless government approved" }
 * parseSynthetikaRestrictions("<p>ONLY COMPANY ORDERS</p>");
 * // { buyerRestricted: true, note: "ONLY COMPANY ORDERS" }
 * parseSynthetikaRestrictions("<p>High purity sodium chloride.</p>"); // undefined
 * ```
 * @source
 */
export function parseSynthetikaRestrictions(html?: string): PurchaseRestriction | undefined {
  if (typeof html !== 'string' || html.trim().length === 0) {
    return undefined;
  }
  const text = normalizeRestrictionText(htmlToAscii(html));
  if (text.length === 0) {
    return undefined;
  }

  const result: PurchaseRestriction = {};
  const excluded: CountryCode[] = [];

  // Region denylist: "We do not ship this product to: <comma list>". The capture stops at
  // a "|" (the "Unless government approved" caveat), a "<", or a line break.
  const denyMatch = text.match(/we do not ship this product to:\s*([^|<\n]+)/i);
  if (denyMatch) {
    for (const token of denyMatch[1].split(',')) {
      const code = resolveCountryToken(token);
      if (code !== undefined && !excluded.includes(code)) {
        excluded.push(code);
      }
    }
  }

  // Conditional region: "shipping to <country> possible only ...". Treat the named country
  // as excluded (the condition — ChemVerbots compliance, etc. — is unverifiable here).
  let conditionalResolved = false;
  const conditionalMatch = text.match(/shipping to ([a-z ]+?) possible only/i);
  if (conditionalMatch) {
    const code = resolveCountryToken(conditionalMatch[1]);
    if (code !== undefined) {
      if (!excluded.includes(code)) {
        excluded.push(code);
      }
      conditionalResolved = true;
    }
  }

  // EU-only allowlist.
  if (
    /possible only to selected eu countries/i.test(text) ||
    /not available for export outside the european union/i.test(text) ||
    /outside the eu\b/i.test(text)
  ) {
    result.euOnly = true;
  }

  // Catch-all: a "possible only to/if" delivery restriction we couldn't resolve to a
  // country or the EU. Exclude everyone to be safe.
  if (/possible only (to|if)/i.test(text) && !result.euOnly && !conditionalResolved) {
    result.restrictedDelivery = true;
  }

  if (BUYER_PATTERNS.some((pattern) => pattern.test(text))) {
    result.buyerRestricted = true;
  }

  if (
    /declaration of (intended )?use/i.test(text) ||
    /requires a written declaration/i.test(text)
  ) {
    result.declarationOfUseRequired = true;
  }

  if (excluded.length > 0) {
    result.excludedCountries = excluded;
  }

  if (Object.keys(result).length === 0) {
    return undefined;
  }
  result.note = text;
  return result;
}
