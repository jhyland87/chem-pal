/**
 * Fill colours for the four quadrants of an NFPA 704 "fire diamond".
 * @category Constants
 * @group Chemical Info
 * @source
 */
export const NFPA_COLORS = {
  /** Health (left). */
  health: '#1565c0',
  /** Flammability (top). */
  fire: '#d32f2f',
  /** Instability / reactivity (right). */
  reactivity: '#fbc02d',
  /** Special notice (bottom). */
  special: '#ffffff',
} as const;

/**
 * Base URL for NIST WebBook structure images; append `Struct=C<CAS digits>&Type=Color`.
 * @category Constants
 * @group Chemical Info
 * @source
 */
export const NIST_STRUCTURE_URL = 'https://webbook.nist.gov/cgi/cbook.cgi';
