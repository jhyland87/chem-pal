/**
 * This can be used to check if a SynthetikaSearchResponse is valid
 * @category Type Guards
 * @param data - The data to verify (raw response from Synthetika)
 * @returns True if the data is a SynthetikaSearchResponse, false otherwise
 * @example
 * ```typescript
 * const response = await fetch("https://synthetikaeu.com/webapi/front/en_US/products/usd/search/sodium%20chloride");
 * if (isSynthetikaSearchResponse(response)) {
 *   console.log(response.count);
 * }
 * ```
 */
export function isSynthetikaSearchResponse(data: unknown): data is SynthetikaSearchResponse {
  if (!data || typeof data !== "object") {
    console.log("isSynthetikaSearchResponse: data is falsey or not an object");
    return false;
  }

  const requiredFields = {
    count: "number",
    pages: "number",
    page: "number",
    list: Array.isArray,
  };

  if (
    !Object.entries(requiredFields).every(([field, type]) => {
      const isPresent = field in data;
      if (!isPresent) {
        console.log(`isSynthetikaSearchResponse: data is missing required field: ${field}`);
        return false;
      }

      if (typeof type === "string") {
        if (typeof data[field as keyof typeof data] !== type) {
          console.log(`isSynthetikaSearchResponse: data[${field}] is not a ${type}`);
          return false;
        }
      }

      if (typeof type === "function") {
        if (!type(data[field as keyof typeof data])) {
          console.log(`isSynthetikaSearchResponse: data[${field}] is not an array`);
          return false;
        }
      }

      return true;
    })
  ) {
    console.log("isSynthetikaSearchResponse: data is missing required fields");
    return false;
  }

  return true;
}

/**
 * This can be used to check if a SynthetikaSearchResponse is valid
 * @category Type Guards
 * @param data - The data to verify (raw response from Synthetika)
 * @returns True if the data is a SynthetikaSearchResponse, false otherwise
 * @example
 * ```typescript
 * const response = await fetch("https://synthetikaeu.com/webapi/front/en_US/products/usd/search/sodium%20chloride");
 * assertIsSynthetikaSearchResponse(response);
 * const data = await response.json();
 * if (isSynthetikaSearchResponse(data)) {
 *   console.log(data.count);
 * }
 * ```
 */
export function assertIsSynthetikaSearchResponse(
  data: unknown,
): asserts data is SynthetikaSearchResponse {
  if (!data || typeof data !== "object") {
    throw new Error("isSynthetikaSearchResponse: data is falsey or not an object");
  }

  if (!isSynthetikaSearchResponse(data)) {
    throw new Error("isSynthetikaSearchResponse: data is not a SynthetikaSearchResponse");
  }
}

/**
 * This can be used to typeguard a SynthetikaProduct
 * @category Type Guards
 * @param data - The data to typeguard
 * @returns True if the data is a SynthetikaProduct, false otherwise
 * @example
 * ```typescript
 * const product = { id: 1, name: "Product 1", url: "https://example.com" };
 * if (isSynthetikaProduct(product)) {
 *   console.log(product.name);
 * }
 * ```
 */
export function isSynthetikaProduct(data: unknown): data is SynthetikaProduct {
  if (!data || typeof data !== "object") {
    console.log("isSynthetikaProduct: data is falsey or not an object");
    return false;
  }

  const requiredFields = {
    /* eslint-disable */
    id: "number",
    name: "string",
    url: "string",
    category: "object",
    code: "string",
    can_buy: "boolean",
    availability: "object",
    price: "object",
    shortDescription: "string",
    producer: "object",
    /* eslint-enable */
  };

  if (
    !Object.entries(requiredFields).every(([field, type]) => {
      const isPresent = field in data;
      if (!isPresent) {
        console.log(`isSynthetikaProduct: data is missing required field: ${field}`);
        return false;
      }

      if (typeof data[field as keyof typeof data] !== type) {
        console.log(`isSynthetikaProduct: data[${field}] is not a ${type}`);
        return false;
      }

      return true;
    })
  ) {
    console.log("isSynthetikaProduct: data is missing required fields");
    return false;
  }

  return true;
}

/**
 * This can be used to typeguard the .price.gross and .price.net fields of a SynthetikaProduct
 * @category Type Guards
 * @param data - The data to typeguard
 * @returns True if the data is a SynthetikaProductPrice, false otherwise
 * @example
 * ```typescript
 * const product = { price: { gross: { final: "100" }, net: { final: "90" } } };
 * if (isSynthetikaProductPrice(product.price)) {
 *   console.log(product.price.gross.final);
 * }
 * ```
 */
export function isSynthetikaProductPrice(data: unknown): data is SynthetikaProductPrice {
  if (!data || typeof data !== "object") {
    console.log("isSynthetikaProductPrice: data is falsey or not an object");
    return false;
  }

  if (!("base" in data) || !("final" in data)) {
    console.log("isSynthetikaProductPrice: data is missing base or final");
    return false;
  }

  return true;
}

/**
 * This can be used to verify the .price.gross and .price.net fields of a SynthetikaProduct
 * @category Type Guards
 * @param data - The data to verify (raw response from Synthetika)
 * @returns True if the data is a SynthetikaProductPrice, false otherwise
 * @example
 * ```typescript
 * const product = { price: { gross: { final: "100" }, net: { final: "90" } } };
 * assertIsSynthetikaProductPrice(product.price.gross);
 * assertIsSynthetikaProductPrice(product.price.net);
 * console.log(product.price.gross.final);
 * ```
 */
export function assertIsSynthetikaProductPrice(
  data: unknown,
): asserts data is SynthetikaProductPrice {
  if (!data || typeof data !== "object") {
    console.log("isSynthetikaProductPrice: data is falsey or not an object");
    throw new Error("isSynthetikaProductPrice: data is falsey or not an object");
  }

  if (!("base" in data) || !("final" in data)) {
    console.log("isSynthetikaProductPrice: data is missing base or final");
    throw new Error("isSynthetikaProductPrice: data is missing base or final");
  }
}
