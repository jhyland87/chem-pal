// ProductBuilder is imported first to satisfy the supplier module-init cycle that the
// transitive typeGuards import can otherwise trip.
import '@/utils/ProductBuilder';
import { parseSynthetikaRestrictions } from '@/suppliers/synthetikaRestrictions';
import { describe, expect, it } from 'vitest';

/** Wraps restriction text in a `<p>` the way Synthetika's shortDescription arrives. */
const p = (text: string) => `<p>${text}</p>`;

describe('parseSynthetikaRestrictions - region denylists', () => {
  it("parses ISO-code lists and strips the '| Unless government approved' caveat", () => {
    const r = parseSynthetikaRestrictions(
      p(
        '✈︎ Shipping Limitations: We do not ship this product to: US, DE | Unless government approved',
      ),
    );
    expect(r?.excludedCountries).toEqual(['US', 'DE']);
  });

  it('parses a single ISO code with a trailing link glyph', () => {
    const r = parseSynthetikaRestrictions(
      '<p>✈︎ Shipping Limitations: We do not ship this product to: US <a href="x">ⓘ</a></p>',
    );
    expect(r?.excludedCountries).toEqual(['US']);
  });

  it('parses a three-code list', () => {
    const r = parseSynthetikaRestrictions(p('We do not ship this product to: DE, DK, SE'));
    expect(r?.excludedCountries).toEqual(['DE', 'DK', 'SE']);
  });

  it('resolves full country names, including the USA alias', () => {
    expect(
      parseSynthetikaRestrictions(p('We do not ship this product to: USA'))?.excludedCountries,
    ).toEqual(['US']);
    expect(
      parseSynthetikaRestrictions(
        p('We do not ship this product to: Germany, Austria, Switzerland, Finland'),
      )?.excludedCountries,
    ).toEqual(['DE', 'AT', 'CH', 'FI']);
  });

  it('resolves a mixed ISO + name list and a long list', () => {
    expect(
      parseSynthetikaRestrictions(p('We do not ship this product to: Germany, USA'))
        ?.excludedCountries,
    ).toEqual(['DE', 'US']);
    expect(
      parseSynthetikaRestrictions(
        p(
          'We do not ship this product to: Germany, USA, Italy, Greece, Cyprus, Bulgaria, Sweden, Netherlands, Belgium',
        ),
      )?.excludedCountries,
    ).toEqual(['DE', 'US', 'IT', 'GR', 'CY', 'BG', 'SE', 'NL', 'BE']);
  });
});

describe('parseSynthetikaRestrictions - conditional region', () => {
  it('excludes the named country in a ChemVerbots-style condition', () => {
    const r = parseSynthetikaRestrictions(
      p('shipping to germany possible only to ChemVerbots compliant clients'),
    );
    expect(r?.excludedCountries).toEqual(['DE']);
    expect(r?.restrictedDelivery).toBeUndefined();
  });
});

describe('parseSynthetikaRestrictions - EU-only', () => {
  it("flags euOnly for 'selected EU countries'", () => {
    expect(
      parseSynthetikaRestrictions(p('⚠️ Delivery possible only to selected EU countries!')),
    ).toMatchObject({ euOnly: true });
  });

  it("flags euOnly for 'not available for export outside the European Union'", () => {
    expect(
      parseSynthetikaRestrictions(
        p(' This product is not available for export outside the European Union.'),
      ),
    ).toMatchObject({ euOnly: true });
  });
});

describe('parseSynthetikaRestrictions - buyer restrictions', () => {
  it.each([
    [
      'registered business / government',
      'This product can only be purchased by registered business or government entities.',
    ],
    [
      'only available for companies',
      'Only available for companies. Sale requires a written declaration of intended use.',
    ],
    ['ONLY COMPANY ORDERS', 'ONLY COMPANY ORDERS'],
    [
      'exclusively for … customers',
      'This product is available exclusively for professional and industrial customers.',
    ],
  ])('flags buyerRestricted for: %s', (_label, text) => {
    expect(parseSynthetikaRestrictions(p(text))?.buyerRestricted).toBe(true);
  });

  it('keeps CMR classification prefix from suppressing the buyer flag', () => {
    const r = parseSynthetikaRestrictions(
      p(
        '⚠️ EU: This product is classified as CMR in category 1A/1B Annex VI. CLP Regulation (EC) No. 1272/2008 and therefore can only be purchased by registered business or government entities.',
      ),
    );
    expect(r?.buyerRestricted).toBe(true);
  });
});

describe('parseSynthetikaRestrictions - declaration of use (informational)', () => {
  it('flags declarationOfUseRequired without buyerRestricted when standalone', () => {
    const r = parseSynthetikaRestrictions(p('✉️ Declaration of use is required.'));
    expect(r?.declarationOfUseRequired).toBe(true);
    expect(r?.buyerRestricted).toBeUndefined();
  });

  it('sets both when companies-only text also requires a declaration', () => {
    const r = parseSynthetikaRestrictions(
      p('⚠️ Only available for companies. Sale requires a written declaration of intended use.'),
    );
    expect(r?.buyerRestricted).toBe(true);
    expect(r?.declarationOfUseRequired).toBe(true);
  });
});

describe('parseSynthetikaRestrictions - no restriction', () => {
  it.each([
    [
      'service note',
      '⚠️ Please ensure the legality of the submitted compounds before sending them.',
    ],
    ['clean description', 'High purity sodium chloride suitable for analytical use.'],
    ['empty', ''],
  ])('returns undefined for: %s', (_label, text) => {
    expect(parseSynthetikaRestrictions(text ? p(text) : text)).toBeUndefined();
  });

  it('returns undefined for non-string input', () => {
    expect(parseSynthetikaRestrictions(undefined)).toBeUndefined();
  });
});

describe('parseSynthetikaRestrictions - inconsistent formatting', () => {
  it('normalizes nbsp and double spaces', () => {
    const r = parseSynthetikaRestrictions('<p>We do not ship this product to:  US,  DE</p>');
    expect(r?.excludedCountries).toEqual(['US', 'DE']);
  });

  it('preserves the original text in note', () => {
    const r = parseSynthetikaRestrictions(p('ONLY COMPANY ORDERS'));
    expect(r?.note).toContain('ONLY COMPANY ORDERS');
  });
});
