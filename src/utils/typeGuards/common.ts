import { CAS_REGEX, UOM } from "@/constants/common";
import { CURRENCY_CODE_MAP, CURRENCY_SYMBOL_MAP } from "@/constants/currency";
import { z } from "zod";

/**
 * @categoryDescription Typeguards
 * These functions are available for common typeguards that are used throughout the application.
 * @showCategories
 * @module
 */

const httpResponseSchema = z.object({
  ok: z.boolean(),
  status: z.number(),
  statusText: z.string(),
  json: z.custom<Function>((val) => typeof val === "function"),
  text: z.custom<Function>((val) => typeof val === "function"),
});

/**
 * Type guard to validate if a value is a valid HTTP Response object.
 * Checks for the presence of essential Response properties and methods.
 *
 * @category Typeguards
 * @param value - The value to validate
 * @returns Type predicate indicating if the value is a Response object
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
 * @source
 */
export function isHttpResponse(value: unknown): value is Response {
  return httpResponseSchema.safeParse(value).success;
}

/**
 * Type guard to validate if a value is a valid UOM.
 * Checks if the value is a string and if it is in the UOM array.
 *
 * @category Typeguards
 * @param uom - The value to validate
 * @returns Type predicate indicating if the value is a valid UOM
 *
 * @example
 * ```typescript
 * // Valid UOM
 * const validUOM = "g";
 * if (isUOM(validUOM)) {
 *   console.log('Valid UOM:', validUOM);
 * }
 *
 * // Invalid UOM
 * const invalidUOM = 123; // Number instead of string
 * if (!isUOM(invalidUOM)) {
 *   console.log('Invalid UOM:', invalidUOM);
 * }
 * ```
 * @source
 */
export function isUOM(uom: unknown): uom is UOM {
  return typeof uom === "string" && (Object.values(UOM) as string[]).includes(uom);
}

/**
 * Type guard to validate if a Response object contains JSON content.
 * Checks both the Content-Type header and ensures it's a valid Response object.
 *
 * @category Typeguards
 * @param response - The Response object to validate
 * @returns Type predicate indicating if the response contains JSON content
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
 * @source
 */
export function isJsonResponse(response: unknown): response is Response {
  if (!isHttpResponse(response)) {
    return false;
  }
  const contentType = response.headers.get("Content-Type");
  return (
    contentType !== null && (contentType.includes("/json") || contentType.includes("/javascript"))
  );
}

/**
 * Type guard to validate if a Response object contains JSON content.
 * Checks both the Content-Type header and ensures it's a valid Response object.
 *
 * @category Typeguards
 * @param response - The Response object to validate
 * @returns Type predicate indicating if the response contains JSON content
 *
 * @example
 * ```typescript
 * // Valid JSON response
 * const jsonResponse = new Response('{"data": "test"}', {
 *   headers: { 'Content-Type': 'application/json' }
 * });
 * assertJsonResponse(jsonResponse);
 * ```
 * @source
 */
export function assertJsonResponse(response: unknown): asserts response is Response {
  if (!isJsonResponse(response)) {
    throw new TypeError("assertJsonResponse| Invalid JSON response", { cause: response });
  }
}

/**
 * Type guard to validate if a Response object contains HTML content.
 * Checks both the Content-Type header and ensures it's a valid Response object.
 *
 * @category Typeguards
 * @param response - The Response object to validate
 * @returns Type predicate indicating if the response contains HTML content
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
 * @source
 */
export function isHtmlResponse(response: unknown): response is Response {
  if (!isHttpResponse(response)) return false;
  const contentType = response.headers.get("Content-Type");
  return (
    contentType !== null &&
    (contentType.includes("text/") ||
      contentType.includes("application/xhtml+xml") ||
      contentType.includes("json-amazonui-streaming"))
  );
}

/**
 * Asserts that a Response object contains HTML content.
 * Throws a TypeError if the response is not a valid HTML response.
 *
 * @category Typeguards
 * @param response - The Response object to validate
 * @throws TypeError if the response is not a valid HTML response
 * @example
 * ```typescript
 * const htmlResponse = new Response('<html><body>Hello</body></html>', {
 *   headers: { 'Content-Type': 'text/html' }
 * });
 * assertHtmlResponse(htmlResponse);
 * ```
 * @source
 */
export function assertHtmlResponse(response: unknown): asserts response is Response {
  if (!isHtmlResponse(response)) {
    throw new TypeError("assertHtmlResponse| Invalid HTML response", { cause: response });
  }
}

const validResultSchema = z.object({
  title: z.string(),
  price: z.number(),
  quantity: z.number(),
  uom: z.string(),
  supplier: z.string(),
  url: z.string(),
  currencyCode: z.string(),
  currencySymbol: z.string(),
});

/**
 * Type guard to validate if a value has the minimal required properties of a search result.
 * Checks for the presence and correct types of all required fields for a search result.
 *
 * @category Typeguards
 * @param value - The value to validate
 * @returns Type predicate indicating if the value has required search result properties
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
 * @source
 */
export function isValidResult(value: unknown): value is RequiredProductFields {
  return validResultSchema.safeParse(value).success;
}

/**
 * Checks a product object for missing or incorrectly typed minimal required fields.
 * Returns an array of field names that are missing or have the wrong type.
 *
 * @category Typeguards
 * @param product - The product object to validate
 * @returns Array of missing or invalid field names (empty if all fields are valid)
 * @throws TypeError if product is null or not an object
 * @example
 * ```typescript
 * const product = { title: "NaCl", price: 29.99 };
 * const missing = checkMissingMinimalProductFields(product);
 * // ["quantity", "uom", "supplier", "url", "currencyCode", "currencySymbol"]
 * ```
 * @source
 */
export function checkMissingMinimalProductFields(product: unknown): string[] {
  if (!product || typeof product !== "object") {
    throw new TypeError("checkMissingMinimalProductFields| Invalid product", { cause: product });
  }

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

  const record = product as Record<string, unknown>;
  const result = Object.entries(requiredProps).reduce(
    (acc: string[], [key, expectedType]: [string, string]) => {
      if (key in record === false) {
        console.debug("checkMissingMinimalProductFields| No value found in product", {
          product,
          key,
        });
        return [...acc, key];
      }

      if (typeof record[key] !== expectedType) {
        console.debug("checkMissingMinimalProductFields| Property not the correct type", {
          product,
          key,
          expectedType,
          actualType: typeof record[key],
        });
        return [...acc, key];
      }

      return acc;
    },
    [],
  );
  if (result.length > 0) {
    console.warn("checkMissingMinimalProductFields| Results for product is", { product, result });
  }
  return result;
}

/**
 * Type guard to validate if a value has the minimal required properties of a Product.
 * This is a less strict validation than isProduct as it only checks for the minimum required fields.
 * Useful for validating partial product data during construction.
 *
 * @category Typeguards
 * @param product - The value to validate
 * @returns Type predicate indicating if the value has minimal required product properties
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
 * @source
 */
export function isMinimalProduct(product: unknown): product is RequiredProductFields {
  try {
    const missingFields = checkMissingMinimalProductFields(product);
    if (missingFields.length > 0) {
      console.debug("isMinimalProduct| Product is missing minimal fields", {
        product,
        missingFields,
      });
      return false;
    }
    return true;
  } catch (error) {
    console.warn("isMinimalProduct| The product is invalid", { product, error });
    return false;
  }
}

/**
 * Checks a product object for missing or incorrectly typed complete required fields.
 * Returns an array of field names that are missing or have the wrong type.
 *
 * @category Typeguards
 * @param product - The product object to validate
 * @returns Array of missing or invalid field names (empty if all fields are valid)
 * @throws TypeError if product is null or not an object
 * @example
 * ```typescript
 * const product = { title: "NaCl", price: 29.99, quantity: 500, uom: "g" };
 * const missing = checkCompleteProductFields(product);
 * // ["supplier", "url", "currencyCode", "currencySymbol"]
 * ```
 * @source
 */
export function checkCompleteProductFields(product: unknown): string[] {
  if (!product || typeof product !== "object") {
    throw new TypeError("checkCompleteProductFields| Invalid product", { cause: product });
  }

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

  const record = product as Record<string, unknown>;
  const result = Object.entries(requiredProps).reduce(
    (acc: string[], [key, expectedType]: [string, string]) => {
      if (key in record === false) {
        console.debug("checkCompleteProductFields| No value found in product", { product, key });
        return [...acc, key];
      }

      if (typeof record[key] !== expectedType) {
        console.debug("checkCompleteProductFields| Property not the correct type", {
          product,
          key,
          expectedType,
          actualType: typeof record[key],
        });
        return [...acc, key];
      }

      return acc;
    },
    [],
  );
  if (result.length > 0) {
    console.warn("checkCompleteProductFields| Results for product is", { product, result });
  }
  return result;
}

/**
 * Asserts that a product object contains all required fields with correct types.
 * Throws a TypeError listing any missing or invalid fields.
 *
 * @category Typeguards
 * @param product - The product object to assert
 * @throws TypeError if any required fields are missing or have incorrect types
 * @example
 * ```typescript
 * try {
 *   assertCompleteProductFields(product);
 *   // product is now typed as RequiredProductFields
 * } catch (error) {
 *   console.error("Invalid product:", error.message);
 * }
 * ```
 * @source
 */
export function assertCompleteProductFields(
  product: unknown,
): asserts product is RequiredProductFields {
  const missingFields = checkCompleteProductFields(product);
  if (missingFields.length > 0) {
    throw new TypeError(
      `Product does not contain or has invalid data for the following required fields: ${missingFields.join(", ")} `,
    );
  }
}

/**
 * Type guard to validate if a value is a complete Product object.
 * Checks for the presence and correct types of all required product fields.
 * This is a stricter validation than isMinimalProduct as it ensures all required fields are present.
 *
 * @category Typeguards
 * @param product - The value to validate
 * @returns Type predicate indicating if the value is a complete Product object
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
 * @source
 */
export function isProduct(product: unknown): product is Product {
  try {
    assertCompleteProductFields(product);
    return true;
  } catch (error) {
    console.warn("isProduct| The product is invalid", { product, error });
    return false;
  }
}

/**
 * Type guard to validate if a value is a valid currency symbol.
 * Checks if the value is a string and if it is in the CURRENCY_SYMBOL_MAP.
 *
 * @category Typeguards
 * @param symbol - The value to validate
 * @returns Type predicate indicating if the value is a valid currency symbol
 *
 * @example
 * ```typescript
 * const validSymbol = "$";
 * if (isCurrencySymbol(validSymbol)) {
 *   console.log("Valid currency symbol:", validSymbol);
 * } else {
 *   console.log("Invalid currency symbol:", validSymbol);
 * }
 * ```
 * @source
 */
export function isCurrencySymbol(symbol: unknown): symbol is CurrencySymbol {
  return (
    typeof symbol === "string" && (Object.values(CURRENCY_CODE_MAP) as string[]).includes(symbol)
  );
}

/**
 * Type guard to validate if a value is a valid currency code.
 * Checks if the value is a string and if it is in the CURRENCY_SYMBOL_MAP.
 *
 * @category Typeguards
 * @param code - The value to validate
 * @returns Type predicate indicating if the value is a valid currency code
 *
 * @example
 * ```typescript
 * const validCode = "USD";
 * if (isCurrencyCode(validCode)) {
 *   console.log("Valid currency code:", validCode);
 * } else {
 *   console.log("Invalid currency code:", validCode);
 * }
 * ```
 * @source
 */
export function isCurrencyCode(code: unknown): code is CurrencyCode {
  return (
    typeof code === "string" && (Object.values(CURRENCY_SYMBOL_MAP) as string[]).includes(code)
  );
}

/**
 * Checks if an object is empty.
 *
 * @category Typeguards
 * @param obj - The object to check
 * @returns True if the object is empty, false otherwise
 * @example Empty object
 * ```typescript
 * isPopulatedObject({}) // Returns false
 * ```
 * @example Populated object
 * ```typescript
 * isPopulatedObject({ a: 1 }) // Returns true
 * ```
 * @example Null (which is considered an 'object' in JavaScript)
 * ```typescript
 * isPopulatedObject(null) // Returns false
 * ```
 * @source
 */
export function isPopulatedObject(obj: unknown): obj is Record<string, unknown> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    Array.isArray(obj) === false &&
    Object.entries(obj).length > 0
  );
}

/**
 * Checks if an array is populated.
 *
 * @category Typeguards
 * @param arr - The array to check
 * @returns True if the array is populated, false otherwise
 * @example Populated array
 * ```typescript
 * isPopulatedArray([1, 2, 3]) // Returns true
 * ```
 * @example Empty array
 * ```typescript
 * isPopulatedArray([]) // Returns false
 * ```
 * @source
 */
export function isPopulatedArray(arr: unknown): arr is unknown[] {
  return Array.isArray(arr) === true && arr.length > 0;
}

const parsedPriceSchema = z.object({
  currencyCode: z.string(),
  currencySymbol: z.string(),
  price: z.number(),
});

/**
 * Type guard to validate if a value is a valid ParsedPrice object.
 * Checks for the presence and correct types of currencyCode, currencySymbol, and price.
 *
 * @category Typeguards
 * @param data - The value to validate
 * @returns Type predicate indicating if the value is a valid ParsedPrice
 * @example
 * ```typescript
 * const parsed = parsePrice('$1,234.56');
 * if (isParsedPrice(parsed)) {
 *   console.log(parsed.currencyCode); // 'USD'
 * }
 * ```
 * @source
 */
export function isParsedPrice(data: unknown): data is ParsedPrice {
  return parsedPriceSchema.safeParse(data).success;
}

const quantityObjectSchema = z.object({
  quantity: z.number(),
  uom: z.string(),
});

/**
 * Type guard to validate if a value is a valid QuantityObject.
 * Checks for the presence and correct types of quantity (number) and uom (string).
 *
 * @category Typeguards
 * @param value - The value to validate
 * @returns Type predicate indicating if the value is a valid QuantityObject
 * @example
 * ```typescript
 * const qty = parseQuantity('100g');
 * if (isQuantityObject(qty)) {
 *   console.log(`${qty.quantity}${qty.uom}`);
 * }
 * ```
 * @source
 */
export function isQuantityObject(value: unknown): value is QuantityObject {
  return quantityObjectSchema.safeParse(value).success;
}

/**
 * Type guard to validate a CAS (Chemical Abstracts Service) number.
 * CAS numbers follow a specific format (XXXXXXX-XX-X) and include a checksum digit.
 *
 * @category Typeguards
 * @param cas - The CAS number to validate
 * @returns Type predicate indicating if the value is a valid CAS number
 * @example
 * ```typescript
 * isCAS('1234-56-6') // Returns true
 * isCAS('50-00-0') // Returns true
 * isCAS('1234-56-999') // Returns false
 * ```
 * @see https://www.cas.org/training/documentation/chemical-substances/checkdig
 * @source
 */
export function isCAS(cas: unknown): cas is CAS<string> {
  if (typeof cas !== "string") return false;
  const regex = RegExp(`^${CAS_REGEX.source}$`);
  const match = cas.match(regex);
  if (!match || !match.groups?.seg_a || !match.groups?.seg_b || !match.groups?.seg_checksum)
    return false;

  const segA = match.groups.seg_a;
  const segB = match.groups.seg_b;
  const segChecksum = match.groups.seg_checksum;

  if (parseInt(segA) === 0 && parseInt(segB) === 0) return false;

  const segABCalc = Array.from(segA + segB)
    .map(Number)
    .reverse()
    .reduce((acc, curr, idx) => acc + (idx + 1) * curr, 0);

  return segABCalc % 10 === Number(segChecksum);
}

/**
 * Type guard to validate if a value is a full URL.
 * Attempts to construct a URL object from the value.
 *
 * @category Typeguards
 * @param val - The value to validate
 * @returns Type predicate indicating if the value is a valid URL
 * @example
 * ```typescript
 * isFullURL("https://www.google.com") // Returns true
 * isFullURL("not a url") // Returns false
 * ```
 * @source
 */
export function isFullURL(val: unknown): val is URL {
  try {
    new URL(val as string);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard to validate if a value is a Request instance.
 *
 * @category Typeguards
 * @param req - The value to validate
 * @returns Type predicate indicating if the value is a Request
 * @source
 */
export function isRequest(req: unknown): req is Request {
  return req instanceof Request;
}
