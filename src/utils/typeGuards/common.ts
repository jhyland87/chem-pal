import { type Product } from "@/types";
import type { RequiredProductFields } from "@/types/product";

/**
 * Type guard to validate if a value is a valid HTTP Response object.
 * Checks for the presence of essential Response properties and methods.
 *
 * @param value - The value to validate
 * @returns Type predicate indicating if the value is a Response object
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid Response object
 * const response = new Response('{"data": "test"}', {
 *   headers: { 'Content-Type': 'application/json' }
 * });
 * if (isHttpResponse(response)) {
 *   console.log('Valid HTTP response:', response.status);
 * }
 *
 * // Invalid Response object
 * const invalidResponse = { status: 200 }; // Missing required properties
 * if (!isHttpResponse(invalidResponse)) {
 *   console.log('Not a valid HTTP response');
 * }
 * ```
 */
export function isHttpResponse(value: unknown): value is Response {
  return (
    value !== null &&
    typeof value === "object" &&
    "ok" in value &&
    "status" in value &&
    "statusText" in value &&
    "json" in value &&
    "text" in value &&
    typeof (value as Response).json === "function" &&
    typeof (value as Response).text === "function"
  );
}

/**
 * Type guard to validate if a Response object contains JSON content.
 * Checks both the Content-Type header and ensures it's a valid Response object.
 *
 * @param response - The Response object to validate
 * @returns Type predicate indicating if the response contains JSON content
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid JSON response
 * const jsonResponse = new Response('{"data": "test"}', {
 *   headers: { 'Content-Type': 'application/json' }
 * });
 * if (isJsonResponse(jsonResponse)) {
 *   const data = await jsonResponse.json();
 *   console.log('JSON data:', data);
 * }
 *
 * // Non-JSON response
 * const htmlResponse = new Response('<html>...</html>', {
 *   headers: { 'Content-Type': 'text/html' }
 * });
 * if (!isJsonResponse(htmlResponse)) {
 *   console.log('Not a JSON response');
 * }
 * ```
 */
export function isJsonResponse(response: unknown): response is Response {
  if (!isHttpResponse(response)) return false;
  const contentType = (response as Response).headers.get("Content-Type");
  return (
    contentType !== null && (contentType.includes("/json") || contentType.includes("/javascript"))
  );
}

/**
 * Type guard to validate if a Response object contains HTML content.
 * Checks both the Content-Type header and ensures it's a valid Response object.
 *
 * @param response - The Response object to validate
 * @returns Type predicate indicating if the response contains HTML content
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid HTML response
 * const htmlResponse = new Response('<html><body>Hello</body></html>', {
 *   headers: { 'Content-Type': 'text/html' }
 * });
 * if (isHtmlResponse(htmlResponse)) {
 *   const text = await htmlResponse.text();
 *   console.log('HTML content:', text);
 * }
 *
 * // Non-HTML response
 * const jsonResponse = new Response('{"data": "test"}', {
 *   headers: { 'Content-Type': 'application/json' }
 * });
 * if (!isHtmlResponse(jsonResponse)) {
 *   console.log('Not an HTML response');
 * }
 * ```
 */
export function isHtmlResponse(response: unknown): response is Response {
  if (!isHttpResponse(response)) return false;
  const contentType = (response as Response).headers.get("Content-Type");
  return (
    contentType !== null &&
    (contentType.includes("text/html") || contentType.includes("application/xhtml+xml"))
  );
}

/**
 * Type guard to validate if a value has the minimal required properties of a search result.
 * Checks for the presence and correct types of all required fields for a search result.
 *
 * @param value - The value to validate
 * @returns Type predicate indicating if the value has required search result properties
 * @typeguard
 *
 * @example
 * ```typescript
 * // Valid search result
 * const validResult = {
 *   title: "Sodium Chloride",
 *   price: 29.99,
 *   quantity: 500,
 *   uom: "g",
 *   supplier: "ChemSupplier",
 *   url: "/products/nacl",
 *   currencyCode: "USD",
 *   currencySymbol: "$"
 * };
 *
 * if (isValidResult(validResult)) {
 *   console.log('Valid search result:', validResult.title);
 * }
 *
 * // Invalid search result
 * const invalidResult = {
 *   title: "Sodium Chloride",
 *   price: "29.99", // Wrong type (string instead of number)
 *   quantity: 500
 *   // Missing required fields
 * };
 * if (!isValidResult(invalidResult)) {
 *   console.log('Invalid search result');
 * }
 * ```
 */
export function isValidResult(value: unknown): value is RequiredProductFields {
  if (!value || typeof value !== "object") return false;

  const requiredProps: Record<keyof RequiredProductFields, string> = {
    title: "string",
    price: "number",
    quantity: "number",
    uom: "string",
    supplier: "string",
    url: "string",
    currencyCode: "string",
    currencySymbol: "string",
  };

  return Object.entries(requiredProps).every(([key, expectedType]) => {
    return key in value && typeof value[key as keyof typeof value] === expectedType;
  });
}

/**
 * Type guard to validate if a value has the minimal required properties of a Product.
 * This is a less strict validation than isProduct as it only checks for the minimum required fields.
 * Useful for validating partial product data during construction.
 *
 * @param product - The value to validate
 * @returns Type predicate indicating if the value has minimal required product properties
 * @typeguard
 *
 * @example
 * ```typescript
 * const minimalProduct = {
 *   title: "Sodium Chloride",
 *   price: 29.99,
 *   quantity: 500,
 *   uom: "g",
 *   supplier: "ChemSupplier",
 *   url: "/products/nacl",
 *   currencyCode: "USD",
 *   currencySymbol: "$"
 * };
 *
 * if (isMinimalProduct(minimalProduct)) {
 *   console.log('Valid minimal product:', minimalProduct.title);
 * } else {
 *   console.log('Invalid minimal product');
 * }
 *
 * // Example with missing required fields
 * const invalidProduct = {
 *   title: "Sodium Chloride",
 *   price: 29.99,
 *   quantity: 500
 *   // Missing other required fields
 * };
 * if (!isMinimalProduct(invalidProduct)) {
 *   console.log('Invalid minimal product - missing required fields');
 * }
 * ```
 */
export function isMinimalProduct(product: unknown): product is RequiredProductFields {
  if (!product || typeof product !== "object") return false;

  const requiredProps: Record<keyof RequiredProductFields, string> = {
    title: "string",
    price: "number",
    quantity: "number",
    uom: "string",
    supplier: "string",
    url: "string",
    currencyCode: "string",
    currencySymbol: "string",
  };

  return Object.entries(requiredProps).every(([key, expectedType]) => {
    return key in product && typeof product[key as keyof typeof product] === expectedType;
  });
}

/**
 * Type guard to validate if a value is a complete Product object.
 * Checks for the presence and correct types of all required product fields.
 * This is a stricter validation than isMinimalProduct as it ensures all required fields are present.
 *
 * @param product - The value to validate
 * @returns Type predicate indicating if the value is a complete Product object
 * @typeguard
 *
 * @example
 * ```typescript
 * const completeProduct = {
 *   title: "Sodium Chloride",
 *   price: 29.99,
 *   quantity: 500,
 *   uom: "g",
 *   supplier: "ChemSupplier",
 *   url: "/products/nacl",
 *   currencyCode: "USD",
 *   currencySymbol: "$",
 *   description: "High purity sodium chloride",
 *   cas: "7647-14-5"
 * };
 *
 * if (isProduct(completeProduct)) {
 *   console.log('Valid complete product:', completeProduct.title);
 * } else {
 *   console.log('Invalid product object');
 * }
 *
 * // Example with missing required fields
 * const partialProduct = {
 *   title: "Sodium Chloride",
 *   price: 29.99
 *   // Missing required fields
 * };
 * if (!isProduct(partialProduct)) {
 *   console.log('Invalid product - missing required fields');
 * }
 * ```
 */
export function isProduct(product: unknown): product is Product {
  if (typeof product !== "object" || product === null) return false;

  const requiredProps: Record<keyof RequiredProductFields, string> = {
    title: "string",
    price: "number",
    quantity: "number",
    uom: "string",
    supplier: "string",
    url: "string",
    currencyCode: "string",
    currencySymbol: "string",
  };

  return Object.entries(requiredProps).every(([key, expectedType]) => {
    return key in product && typeof product[key as keyof typeof product] === expectedType;
  });
}
