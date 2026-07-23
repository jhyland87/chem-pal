import { isPopulatedObject } from './common';

/**
 * Type guard for the ScienceLab (BigCommerce) product-attributes AJAX response.
 * Narrows an unknown parsed value to {@link ScienceLabAttributeResponse} by
 * requiring that it be an object carrying a `data` object. The variant price is
 * read from `data.price.without_tax.value`, which callers still null-check.
 * @category Typeguards
 * @param value - The parsed AJAX response to test
 * @returns True when `value` carries a `data` object
 * @example
 * ```typescript
 * const parsed = await this.httpPostJson({ path, body });
 * if (isScienceLabAttributeResponse(parsed)) {
 *   const price = parsed.data?.price?.without_tax?.value;
 * }
 * ```
 * @source
 */
export function isScienceLabAttributeResponse(
  value: unknown,
): value is ScienceLabAttributeResponse {
  return isPopulatedObject(value) && isPopulatedObject(value.data);
}
