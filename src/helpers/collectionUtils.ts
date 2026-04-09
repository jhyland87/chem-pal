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
 * @source
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
 * Check object structure when provided an obeject and similar structure with variable types
 * as the values
 *
 * @param data - The value to validate
 * @param requiredProps - The required properties and their expected types
 * @returns Type predicate indicating if the value has minimal required product properties
 * @typeguard
 *
 * @example Basic usage
 * ```typescript
 * if ( ! checkObjectStructure(data, {
 *   title: "string",
 *   price: "number",
 *   quantity: "number"
 * })) {
 *   throw new Error("data is not complete - " + JSON.stringify(data));
 * }
 * ```
 * @example Type guard usage
 * ```typescript
 * function isValidProduct(product: unknown): product is SomeProduct {
 *   return  checkObjectStructure(product, {
 *     title: "string",
 *     price: "number",
 *     quantity: "number"
 *   });
 * }
 * ```
 * @example Assert usage
 * ```typescript
 * function assertIsValidProduct(product: unknown): asserts product is SomeProduct {
 *    if ( ! checkObjectStructure(product, {
 *      title: "string",
 *      price: "number",
 *      quantity: "number"
 *    })) {
 *      throw new Error("product is not complete - " + JSON.stringify(product));
 *    }
 * }
 * ```
 * @source
 */
interface NestedProps {
  [key: string]: PropValidator;
}
type ArrayValidator = [NestedProps];
type PropValidator = string | ((val: unknown) => boolean) | NestedProps | ArrayValidator;

export function checkObjectStructure(
  data: unknown,
  requiredProps: Record<string, PropValidator>,
): boolean {
  if (typeof data !== "object" || data === null) {
    console.warn("data is not an object - ", data);
    return false;
  }

  const record = data as Record<string, unknown>;
  const hasRequiredProps = Object.entries(requiredProps).every(([key, validator]) => {
    if (!(key in record)) {
      console.warn(`Missing required property: ${key}`);
      return false;
    }
    if (typeof validator === "function") {
      if (!validator(record[key])) {
        console.warn(`Validation failed for ${key}`);
        return false;
      }
    } else if (Array.isArray(validator)) {
      // Array validator — check value is an array and every element matches the schema
      if (!Array.isArray(record[key])) {
        console.warn(`Expected array for ${key} but got ${typeof record[key]}`);
        return false;
      }
      const elementSchema = validator[0];
      if (!record[key].every((element: unknown) => checkObjectStructure(element, elementSchema))) {
        console.warn(`Array element validation failed for ${key}`);
        return false;
      }
    } else if (typeof validator === "object") {
      // Nested object validation — recurse
      if (!checkObjectStructure(record[key], validator)) {
        console.warn(`Nested validation failed for ${key}`);
        return false;
      }
    } else if (typeof record[key] !== validator) {
      console.warn(`Invalid type for ${key}. Expected ${validator} but got ${typeof record[key]}`);
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
