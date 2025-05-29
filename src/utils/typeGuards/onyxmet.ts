import type { SearchResultItem } from "@/types/onyxmet";

/**
 * Type guard to validate if an object matches the SearchResultItem structure.
 * Checks for the presence and correct types of required properties in Onyxmet search results.
 * Required properties:
 * - label: Product name/title
 * - image: Product image URL or identifier
 * - description: Product description text
 * - href: Product URL or path
 *
 * @param product - The object to validate
 * @returns Type predicate indicating if the object is a valid SearchResultItem
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid search result item
 * const validItem = {
 *   label: "Sodium Chloride",
 *   image: "nacl.jpg",
 *   description: "High purity NaCl",
 *   href: "/products/nacl"
 * };
 * if (isSearchResultItem(validItem)) {
 *   console.log("Valid item:", validItem.label);
 * }
 *
 * // Invalid search result item (missing properties)
 * const invalidItem = {
 *   label: "Sodium Chloride",
 *   image: "nacl.jpg"
 *   // Missing description and href
 * };
 * if (!isSearchResultItem(invalidItem)) {
 *   console.log("Invalid item - missing required properties");
 * }
 *
 * // Invalid search result item (wrong type)
 * const wrongType = "not an object";
 * if (!isSearchResultItem(wrongType)) {
 *   console.log("Invalid item - not an object");
 * }
 * ```
 */
export function isSearchResultItem(product: unknown): product is SearchResultItem {
  return (
    typeof product === "object" &&
    product !== null &&
    "label" in product &&
    "image" in product &&
    "description" in product &&
    "href" in product
  );
}
