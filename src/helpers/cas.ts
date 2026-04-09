import { CAS_REGEX } from "@/constants/common";
import { isCAS } from "@/utils/typeGuards/common";

export { isCAS };

/**
 * @group Helpers
 * @groupDescription Chemical Abstracts Service (CAS) number validation and parsing utilities.
 * @source
 */

/**
 * Searches for a valid CAS number within a string.
 * Returns the first valid CAS number found, or undefined if none are found.
 * @category Helpers
 * @param data - The string to search for a CAS number
 * @returns The first valid CAS number found, or undefined
 *
 * @example
 * ```typescript
 * findCAS('Example of a valid cas: 1234-56-6..') // Returns '1234-56-6'
 * findCAS('and 50-00-0 is another valid cas #') // Returns '50-00-0'
 * findCAS('Example of an invalid cas: 1232-56-6..') // Returns undefined
 * findCAS('and 50-00-1 is another valid cas #') // Returns undefined
 * ```
 * @source
 */
export function findCAS(data: string): CAS<string> | void {
  const regex = RegExp(CAS_REGEX.source, "g");
  const match = data.match(regex);
  if (match && isCAS(match[0])) return match[0] as CAS<string>;
}

/**
 * Gets the names of a CAS number from the Cactus API.
 * @category Helpers
 * @param cas - The CAS number to get the names of
 * @returns The names of the CAS number
 * @example
 * ```typescript
 * getNamesByCAS("79-11-8")
 * // Returns ['2-chloroacetic acid', '2-chloroethanoic acid', 'Acide chloracetique', ...etc]
 * getNamesByCAS("1234567890")
 * // Returns undefined
 * ```
 * @source
 */
export async function getNamesByCAS(cas: CAS<string>): Promise<Maybe<string[]>> {
  try {
    const response = await fetch(
      `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(cas)}/names`,
    );
    const data = await response.text();
    if (!data) return;
    return data.split("\n").map((line: string) => line.trim());
  } catch (error) {
    console.error(error);
    return;
  }
}

/**
 * Gets the IUPAC name of a chemical from the Cactus API.
 * @category Helpers
 * @param name - The name of the chemical to get the IUPAC name of
 * @returns The IUPAC name of the chemical
 * @source
 */
export async function getIUPACName(name: string): Promise<Maybe<string>> {
  const response = await fetch(
    `https://cactus.nci.nih.gov/chemical/structure/${encodeURIComponent(name)}/iupac_name`,
  );
  const data = await response.text();
  if (!data) return;
  return data.trim();
}

/**
 * Gets the CAS of a chemical using the name from the Cactus API.
 * @category Helpers
 * @param name - The chemical name to lookup
 * @returns The CAS number of the chemical
 * @example
 * ```typescript
 * getCASByName("Acetic Acid")
 * // Returns '79-11-8'
 * getCASByName("Acide chloracetique")
 * // Returns '79-11-8'
 * getCASByName("adsfasfd")
 * // Returns undefined
 * ```
 * @source
 */
export async function getCASByName(name: string): Promise<Maybe<CAS<string>>> {
  try {
    const response = await fetch(
      `https://cactus.nci.nih.gov/chemical/structure/names/${encodeURIComponent(name)}`,
    );
    const data = await response.text();
    if (typeof data === "undefined") return;
    const casList = data.split("\n").find((cas) => isCAS(cas));
    return casList;
  } catch (error) {
    console.error(error);
    return;
  }
}
