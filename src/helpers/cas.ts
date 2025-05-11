import { CAS } from '../types/cas';

/**
 * The regex for a valid CAS number.
 * {@link https://regex101.com/r/xPF1Yp/2 Regex test}
 * {@link https://www.cas.org/training/documentation/chemical-substances/checkdig CAS Standardized format}
 * @type {RegExp}
 */
export const CAS_REGEX: RegExp = /(?<seg_a>\d{2,7})-(?<seg_b>\d{2})-(?<seg_checksum>\d)/

/**
 * Check if a string is a valid CAS number
 *
 * CAS numbers are always in a format of three segments of numerical values:
 *    1234-56-6
 *
 * The first segment can be from 2 to 7 intigers (needs to be at least one non-zero value),
 * and the second is always 2 integers. These are basically just unique numbers, but there's no
 * established numbering system or other restrictions.
 * The third segment is one integer, and that is the checksum of the first two segments.
 *
 * {@link https://regex101.com/r/xPF1Yp/2 Regex test}
 *   `(?P<seg_a>\d{2,7})-(?P<seg_b>\d{2})-(?P<checksum>\d)
 *
 * The checksum is calculated by taking the first two segments and iterating over each
 * individual intiger in reverse order, multiplying each by its position, then taking
 * the modulous of the sum of those values.
 *
 * For example, 1234-56-6 is valid because the result of the below equation matches the checksum, (which is 6)
 *     (6*1 + 5*2 + 4*3 + 3*4 + 2*5 + 1*6) % 10 == 6
 *
 * 151-21-3
 *
 *
 * This can be simplified in the below aggregation:
 *     cas_chars = [1, 2, 3, 4, 5, 6]
 *     sum([(idx+1)*int(n) for idx, n in enumerate(cas_chars[::-1])]) % 10
 *
 * 1*1 + 2*2 + 1*3 + 5*4 + 1*5 = 36 % 10 = 6
 * {@link https://www.cas.org/training/documentation/chemical-substances/checkdig CAS Standardized format}
 * {@link https://www.allcheminfo.com/chemistry/cas-number-lookup.html CAS lookup}
 *
 *
 * @param {string} cas - The CAS number to check.
 * @returns {boolean} - True if the CAS number is valid, false otherwise.
 * @example
 *     isCas('1234-56-6') // true
 *     isCas('50-00-0') // true
 *     isCas('1234-56-999') // false
 *     isCas('1234-56') // false
 *     isCas('1234-56-0') // false
 *     isCas('0000-00-0') // false
 *     isCas('00-10-0') // false
 */
export function isCas(cas: string): boolean {
  const regex = RegExp(`^${CAS_REGEX.source}$`)
  const match = cas.match(regex);
  if (!match
    || !match.groups?.seg_a
    || !match.groups?.seg_b
    || !match.groups?.seg_checksum)
    return false;

  const segA = match.groups.seg_a;
  const segB = match.groups.seg_b;
  const segChecksum = match.groups.seg_checksum;

  if (parseInt(segA) === 0 && parseInt(segB) === 0) return false;

  const segABCalc = Array.from(segA + segB)
    .map(Number)
    .reverse()
    .reduce((acc, curr, idx) => acc + (idx + 1) * curr, 0)

  return segABCalc % 10 === Number(segChecksum);
}

/**
 * searches for a Chemical Abstracts Service (CAS) number within a given string and returns it if found.
 *
 * @param {string} data - The string to search for a CAS number in.
 * @returns {string|undefined} - The CAS number if found, undefined otherwise.
 * @example
 *     findCas('Example of a valid cas: 1234-56-6..') // '1234-56-6'
 *     findCas('and 50-00-0 is another valid cas #') // '50-00-0'
 *     findCas('Example of an invalid cas: 1232-56-6..') // undefined
 *     findCas('and 50-00-1 is another valid cas #') // undefined
 */
export function findCas(data: string): CAS<string> | undefined {
  const regex = RegExp(CAS_REGEX.source, 'g')
  const match = data.match(regex);
  if (match && isCas(match[0])) return match[0] as CAS<string>;
}