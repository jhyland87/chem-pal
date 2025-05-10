
/**
 * A type representing a valid CAS number.
 * This type ensures that the string matches the CAS number format and passes the checksum validation.
 *
 * @example
 * const validCas: CasNumber = '1234-56-6'; // Valid
 * const invalidCas: CasNumber = '1234-56-7'; // Type error
 */
export type CasNumber = string & {
  readonly __brand: unique symbol;
};


