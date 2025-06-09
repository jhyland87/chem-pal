/**
 * Omit properties from an object.
 *
 * @param data - The object to omit properties from.
 * @param path - The property or properties to omit.
 * @returns The object with the specified properties omitted.
 *
 * @example
 * ```typescript
 * const data = {
 *   name: "John",
 *   age: 30,
 *   city: "New York",
 * };
 * omit(data, "age"); // { name: "John", city: "New York" }
 * omit(data, ["age", "city"]); // { name: "John" }
 * ```
 */
export function omit<T extends object, K extends keyof T>(
  data: T,
  path: MaybeArray<K>,
): Omit<T, K> {
  if (!path) {
    return data;
  }
  if (typeof path === "string") {
    path = [path];
  } else if (!Array.isArray(path)) {
    throw new Error("path must be a string or an array of strings");
  }

  return Object.fromEntries(
    Object.entries(data).filter(([key]) => !path.includes(key as K)),
  ) as Omit<T, K>;
}

/**
 * Type guard to validate if a value has the minimal required properties of a Product.
 * This is a less strict validation than isProduct as it only checks for the minimum required fields.
 * Useful for validating partial product data during construction.
 *
 * @param product - The value to validate
 * @param requiredProps - The required properties and their expected types
 * @returns Type predicate indicating if the value has minimal required product properties
 * @typeguard
 *
 * @example
 * ```typescript
 * if ( ! checkObjectStructure(data, {
 *   title: "string",
 *   price: "number",
 *   quantity: "number"
 * })) {
 *   throw new Error("data is not complete - " + JSON.stringify(data));
 * }
 * ```
 */
export function checkObjectStructure(data: unknown, requiredProps: Record<string, string>) {
  if (typeof data !== "object" || data === null) {
    console.warn("data is not an object - ", data);
    return false;
  }

  const hasRequiredProps = Object.entries(requiredProps).every(([key, expectedType]) => {
    const item = data as Record<string, unknown>;
    if (!(key in item) || typeof item[key] !== expectedType) {
      console.warn(`Invalid type for ${key}. Expected ${expectedType} but got ${typeof item[key]}`);
      return false;
    }
    return true;
  });

  if (hasRequiredProps === false) {
    console.warn("data is not valid - ", data);
    return false;
  }

  return true;
}
