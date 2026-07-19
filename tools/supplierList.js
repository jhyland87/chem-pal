/**
 * Shared parser for the active supplier list.
 *
 * `src/suppliers/index.ts` is the single source of truth for which suppliers are
 * live — disabled ones are left in the file as commented-out exports. Several
 * build-time generators need that list, so the parsing lives here rather than
 * being duplicated per script.
 *
 * @module supplierList
 */

import fs from "fs/promises";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const _dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = path.resolve(_dirname, "../src/suppliers/index.ts");

/**
 * Reads the active supplier class names from the suppliers barrel. Only
 * uncommented `export { SupplierX } from "./SupplierX";` lines count, so a
 * supplier commented out of the barrel drops out of every generated artifact.
 *
 * @returns {Promise<string[]>} Class names in declaration order, e.g. ["SupplierAladdinSci", …]
 */
export async function getSupplierClassNames() {
  const content = await fs.readFile(INDEX_PATH, "utf-8");
  const matches = content.matchAll(/^(?:export\s{\s(?<supplier>Supplier\w+)\s}\sfrom)/gm);
  return Array.from(matches)
    .map((match) => match.groups?.supplier)
    .filter(Boolean);
}

/**
 * The same list with the `Supplier` prefix stripped, for display purposes.
 *
 * @returns {Promise<string[]>} Bare names, e.g. ["AladdinSci", "AlchemieLabs", …]
 */
export async function getSupplierNames() {
  const classNames = await getSupplierClassNames();
  return classNames.map((name) => name.replace(/^Supplier/, ""));
}
