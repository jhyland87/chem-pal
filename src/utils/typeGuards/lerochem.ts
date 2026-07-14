import { isPopulatedObject } from "./common";

/**
 * Type guard for the schema.org Product `ld+json` block on a LeroChem product
 * page. Narrows an unknown parsed value to {@link LeroChemProductLd} by checking
 * it is an object whose `@type` is "Product".
 * @param value - The parsed `ld+json` value to test
 * @returns True when `value` is a schema.org Product object
 * @example
 * ```typescript
 * const parsed: unknown = JSON.parse(scriptText);
 * if (isLeroChemProductLd(parsed)) {
 *   console.log(parsed.offers?.price); // typed access
 * }
 * ```
 * @source
 */
export function isLeroChemProductLd(value: unknown): value is LeroChemProductLd {
  return isPopulatedObject(value) && value["@type"] === "Product";
}

/**
 * Type guard for the `#product-details` `data-product` dataset (a PrestaShop
 * product combination). Narrows an unknown parsed value to
 * {@link LeroChemDataProduct}; only requires that it be a populated object, as
 * every field is optional.
 * @param value - The parsed `data-product` value to test
 * @returns True when `value` is an object usable as a LeroChem data-product
 * @example
 * ```typescript
 * const parsed: unknown = JSON.parse(el.getAttribute("data-product") ?? "null");
 * if (isLeroChemDataProduct(parsed)) {
 *   console.log(parsed.price_amount);
 * }
 * ```
 * @source
 */
export function isLeroChemDataProduct(value: unknown): value is LeroChemDataProduct {
  return isPopulatedObject(value);
}

/**
 * Type guard for the PrestaShop product `refresh` AJAX response. Narrows an
 * unknown parsed value to {@link LeroChemVariantRefresh} by requiring that it be
 * an object carrying a string `product_details` HTML fragment.
 * @param value - The parsed AJAX response to test
 * @returns True when `value` carries a `product_details` HTML string
 * @example
 * ```typescript
 * const parsed = await this.httpPostJson({ path, params, body });
 * if (isLeroChemVariantRefresh(parsed)) {
 *   const dom = createDOM(parsed.product_details ?? "");
 * }
 * ```
 * @source
 */
export function isLeroChemVariantRefresh(value: unknown): value is LeroChemVariantRefresh {
  return isPopulatedObject(value) && typeof value.product_details === "string";
}
