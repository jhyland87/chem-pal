import { isPlainContainer } from "@/utils/typeGuards/common";

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

type DiffChange =
  | { type: "created"; path: (string | number)[]; value: unknown }
  | { type: "deleted"; path: (string | number)[]; value: unknown }
  | { type: "modified"; path: (string | number)[]; oldValue: unknown; newValue: unknown };

/**
 * Deep-diffs two arbitrary values and returns the list of changes as a flat
 * array of `DiffChange` entries.
 *
 * Walk semantics:
 *   - Both `null` / `undefined` → empty result (no change).
 *   - Old missing, new present → `{ type: "created", path, value }`.
 *   - New missing, old present → `{ type: "deleted", path, value }`.
 *   - Primitive (or non-plain-container, e.g. `Date`, `Map`) on either side →
 *     a single `"modified"` entry when `Object.is` says they differ.
 *   - Array vs. object on opposite sides → wholesale `"modified"` entry.
 *   - Plain object / array on both sides → recurses per-key; the union of
 *     both sides' keys is walked so missing keys surface as created/deleted.
 *
 * Claude may or may not have stolen this right from Lodash ¯\_(ツ)_/¯
 * @param oldObj - Previous value. Pass `null`/`undefined` for "nothing there".
 * @param newObj - New value. Pass `null`/`undefined` for "gone".
 * @param path - Accumulator used by the recursion; callers should omit it.
 * @returns List of `DiffChange` entries — empty when the values are equal.
 * @example
 * ```typescript
 * diff({ a: 1, b: 2 }, { a: 1, b: 3 });
 * // [{ type: "modified", path: ["b"], oldValue: 2, newValue: 3 }]
 *
 * diff({ a: 1, b: 2, c: 3 }, { a: 1, b: 2, d: 4 });
 * // [
 * //   { type: "deleted", path: ["c"], value: 3 },
 * //   { type: "created", path: ["d"], value: 4 },
 * // ]
 *
 * diff({ user: { name: "Ann" } }, { user: { name: "Bea" } });
 * // [{ type: "modified", path: ["user", "name"], oldValue: "Ann", newValue: "Bea" }]
 *
 * diff([1, 2, 3], [1, 2, 3, 4]);
 * // [{ type: "created", path: [3], value: 4 }]
 *
 * diff({ a: 1 }, { a: 1 }); // []
 * ```
 * @source
 */
export function diff(
  oldObj: unknown,
  newObj: unknown,
  path: (string | number)[] = [],
): DiffChange[] {
  // Both missing — no change
  if (oldObj == null && newObj == null) return [];

  // Creation: old is missing, new exists
  if (oldObj == null) {
    return [{ type: "created", path, value: newObj }];
  }

  // Deletion: new is missing, old exists
  if (newObj == null) {
    return [{ type: "deleted", path, value: oldObj }];
  }

  // Primitive comparison (or type mismatch between object and primitive)
  if (!isPlainContainer(oldObj) || !isPlainContainer(newObj)) {
    return Object.is(oldObj, newObj)
      ? []
      : [{ type: "modified", path, oldValue: oldObj, newValue: newObj }];
  }

  // Array/object type mismatch — treat as wholesale replacement
  if (Array.isArray(oldObj) !== Array.isArray(newObj)) {
    return [{ type: "modified", path, oldValue: oldObj, newValue: newObj }];
  }

  // Recurse into container
  const changes: DiffChange[] = [];
  const keys = new Set<string | number>();

  if (Array.isArray(oldObj) && Array.isArray(newObj)) {
    const maxLen = Math.max(oldObj.length, newObj.length);
    for (let i = 0; i < maxLen; i++) keys.add(i);
  } else {
    for (const k of Object.keys(oldObj as object)) keys.add(k);
    for (const k of Object.keys(newObj as object)) keys.add(k);
  }

  for (const key of keys) {
    const oldVal = (oldObj as Record<string | number, unknown>)[key];
    const newVal = (newObj as Record<string | number, unknown>)[key];
    changes.push(...diff(oldVal, newVal, [...path, key]));
  }

  return changes;
}
