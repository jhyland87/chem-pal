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
