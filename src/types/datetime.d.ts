/**
 * Extension of the native Date interface to provide more precise typing for toISOString method.
 */
interface Date {
  /**
   * Returns a string representation of a date in ISO 8601 format.
   * @returns  A string in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
   * See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toISOString
   */
  toISOString(): ISOString;
}

/**
 * Represents a four-digit year string.
 * @example "2024"
 */
export type Year = `${number}${number}${number}${number}`;

/**
 * Represents a two-digit month string.
 * @example "01" for January, "12" for December
 */
export type Month = `${number}${number}`;

/**
 * Represents a two-digit day string.
 * @example "01", "31"
 */
export type Day = `${number}${number}`;

/**
 * Represents a two-digit hours string in 24-hour format.
 * @example "00" for midnight, "23" for 11 PM
 */
export type Hours = `${number}${number}`;

/**
 * Represents a two-digit minutes string.
 * @example "00", "59"
 */
export type Minutes = `${number}${number}`;

/**
 * Represents a two-digit seconds string.
 * @example "00", "59"
 */
export type Seconds = `${number}${number}`;

/**
 * Represents a three-digit milliseconds string.
 * @example "000", "999"
 */
export type Milliseconds = `${number}${number}${number}`;

/**
 * Represents a date string in ISO 8601 format (YYYY-MM-DD).
 * @example "2021-01-08"
 */
export type DateISODate = `${Year}-${Month}-${Day}`;

/**
 * Represents a time string in ISO 8601 format (HH:mm:ss.sss).
 * @example "14:42:34.678"
 */
export type DateISOTime = `${Hours}:${Minutes}:${Seconds}.${Milliseconds}`;

/**
 * Represents a complete ISO 8601 datetime string with UTC timezone (Z).
 * This type combines date and time components into the format: YYYY-MM-DDTHH:mm:ss.sssZ
 *
 * Note: The type cannot be more precisely constrained (e.g., with specific value ranges for months, hours)
 * as it would result in a TypeScript complexity warning (ts(2590)).
 *
 * @example "2021-01-08T14:42:34.678Z"
 */
export type ISOString = `${DateISODate}T${DateISOTime}Z`;
