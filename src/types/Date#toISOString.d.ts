// In TS, interfaces are "open" and can be extended
interface Date {
  /**
   * Give a more precise return type to the method `toISOString()`:
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString
   */
  toISOString(): ISOString;
}

type Year = `${number}${number}${number}${number}`;
type Month = `${number}${number}`;
type Day = `${number}${number}`;
type Hours = `${number}${number}`;
type Minutes = `${number}${number}`;
type Seconds = `${number}${number}`;
type Milliseconds = `${number}${number}${number}`;

/**
 * Represent a string like `2021-01-08`
 */
type DateISODate = `${Year}-${Month}-${Day}`;

/**
 * Represent a string like `14:42:34.678`
 */
type DateISOTime = `${Hours}:${Minutes}:${Seconds}.${Milliseconds}`;

/**
 * Represent a string like `2021-01-08T14:42:34.678Z` (format: ISO 8601).
 *
 * It is not possible to type more precisely (list every possible values for months, hours etc) as
 * it would result in a warning from TypeScript:
 *   "Expression produces a union type that is too complex to represent. ts(2590)
 */
type ISOString = `${DateISODate}T${DateISOTime}Z`;