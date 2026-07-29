import {
  formatDisplayPrice,
  formatUnitPrice,
  formatUnitPriceExact,
  getUnitPrice,
} from '@/helpers/price';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('formatDisplayPrice', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats a USD price with the default USD settings', () => {
    const result = formatDisplayPrice(
      { price: 19.99, usdPrice: 19.99, currencyCode: 'USD' },
      { currency: 'USD', currencyRate: 1 },
    );
    expect(result).toBe('$19.99');
  });

  it('falls back to USD at rate 1 when userSettings is undefined', () => {
    expect(formatDisplayPrice({ price: 5, usdPrice: 5, currencyCode: 'USD' }, undefined)).toBe(
      '$5.00',
    );
  });

  it("converts a USD-anchored price into the user's currency at the given rate", () => {
    const result = formatDisplayPrice(
      { price: 17, usdPrice: 20, currencyCode: 'USD' },
      { currency: 'EUR', currencyRate: 0.9 },
    );
    // 20 * 0.9 = 18, formatted in EUR.
    expect(result).toBe('€18.00');
  });

  it('renders a non-USD product without a usdPrice anchor in its native currency', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = formatDisplayPrice(
      { price: 42, currencyCode: 'GBP' },
      { currency: 'EUR', currencyRate: 0.9 },
    );
    expect(result).toBe('£42.00');
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it('uses the currency symbol, not the code, for currencies Intl renders as a code', () => {
    // ANG's Intl currency symbol is "ANG"; the symbol map has the proper glyph "ƒ".
    const result = formatDisplayPrice(
      { price: 43.5, usdPrice: 43.5, currencyCode: 'USD' },
      { currency: 'ANG', currencyRate: 1 },
    );
    expect(result).toBe('ƒ43.50');
  });

  it('returns an empty string when neither price nor usdPrice is present', () => {
    expect(formatDisplayPrice({ currencyCode: 'USD' }, { currency: 'USD', currencyRate: 1 })).toBe(
      '',
    );
  });
});

describe('getUnitPrice', () => {
  it('divides USD price by the base-unit quantity (mass -> per gram)', () => {
    expect(getUnitPrice({ usdPrice: 40, price: 40, quantity: 500, uom: 'g' })).toBe(0.08);
    expect(getUnitPrice({ usdPrice: 20, price: 20, quantity: 1, uom: 'kg' })).toBe(0.02);
  });

  it('divides by millilitres for volume units', () => {
    expect(getUnitPrice({ usdPrice: 10, price: 10, quantity: 2, uom: 'l' })).toBe(0.005);
  });

  it('divides by pieces for countable units', () => {
    expect(getUnitPrice({ usdPrice: 19.99, price: 19.99, quantity: 1, uom: 'pcs' })).toBe(19.99);
  });

  it('falls back to raw price when there is no USD anchor', () => {
    expect(getUnitPrice({ price: 8, quantity: 2, uom: 'g' })).toBe(4);
  });

  it('returns undefined when price, quantity, or unit is missing/unconvertible', () => {
    expect(getUnitPrice({ quantity: 100, uom: 'g' })).toBeUndefined();
    expect(getUnitPrice({ usdPrice: 10, uom: 'g' })).toBeUndefined();
    expect(getUnitPrice({ usdPrice: 10, quantity: 0, uom: 'g' })).toBeUndefined();
    expect(getUnitPrice({ usdPrice: 10, quantity: 100, uom: 'xyz' })).toBeUndefined();
  });
});

describe('formatUnitPrice', () => {
  it('formats a per-gram price with the unit suffix', () => {
    expect(
      formatUnitPrice(
        { price: 40, usdPrice: 40, currencyCode: 'USD', quantity: 500, uom: 'g' },
        { currency: 'USD', currencyRate: 1 },
      ),
    ).toBe('$0.08/g');
  });

  it('collapses a sub-cent unit price to "<$0.01"', () => {
    // 5 USD / 1000 g = $0.005/g, below one cent
    expect(
      formatUnitPrice(
        { price: 5, usdPrice: 5, currencyCode: 'USD', quantity: 1, uom: 'kg' },
        undefined,
      ),
    ).toBe('<$0.01/g');
  });

  it('renders an exactly-one-cent unit price normally, not as "<$0.01"', () => {
    // 10 USD / 1000 g = $0.01/g, at the threshold
    expect(
      formatUnitPrice(
        { price: 10, usdPrice: 10, currencyCode: 'USD', quantity: 1, uom: 'kg' },
        undefined,
      ),
    ).toBe('$0.01/g');
  });

  it('normalizes volume to millilitres', () => {
    expect(
      formatUnitPrice(
        { price: 10, usdPrice: 10, currencyCode: 'USD', quantity: 2, uom: 'l' },
        { currency: 'USD', currencyRate: 1 },
      ),
    ).toBe('<$0.01/mL');
  });

  it('converts into the user currency at the given rate, capped at two decimals', () => {
    expect(
      formatUnitPrice(
        { price: 40, usdPrice: 40, currencyCode: 'USD', quantity: 500, uom: 'g' },
        { currency: 'EUR', currencyRate: 0.9 },
      ),
    ).toBe('€0.07/g');
  });

  it('collapses a sub-cent price in a non-USD currency using its symbol', () => {
    // 5 USD * 0.9 / 1000 g = €0.0045/g, below one cent
    expect(
      formatUnitPrice(
        { price: 5, usdPrice: 5, currencyCode: 'USD', quantity: 1, uom: 'kg' },
        { currency: 'EUR', currencyRate: 0.9 },
      ),
    ).toBe('<€0.01/g');
  });

  it('returns an empty string when there is no unit price to show', () => {
    expect(formatUnitPrice({ currencyCode: 'USD', quantity: 100, uom: 'g' }, undefined)).toBe('');
    expect(
      formatUnitPrice(
        { price: 10, usdPrice: 10, currencyCode: 'USD', quantity: 1, uom: 'xyz' },
        undefined,
      ),
    ).toBe('');
  });
});

describe('formatUnitPriceExact', () => {
  it('reveals the full-precision value that the display collapses to "<$0.01"', () => {
    // 5 USD / 1000 g = $0.005/g — shown as "<$0.01/g", exact is "$0.005/g"
    expect(
      formatUnitPriceExact(
        { price: 5, usdPrice: 5, currencyCode: 'USD', quantity: 1, uom: 'kg' },
        undefined,
      ),
    ).toBe('$0.005/g');
  });

  it('keeps the extra decimals the two-decimal display rounds away', () => {
    // 40 USD * 0.9 / 500 g = €0.072/g — display rounds to "€0.07/g"
    expect(
      formatUnitPriceExact(
        { price: 40, usdPrice: 40, currencyCode: 'USD', quantity: 500, uom: 'g' },
        { currency: 'EUR', currencyRate: 0.9 },
      ),
    ).toBe('€0.072/g');
  });

  it('matches the display for values that need no extra precision', () => {
    const product = { price: 40, usdPrice: 40, currencyCode: 'USD', quantity: 500, uom: 'g' };
    expect(formatUnitPriceExact(product, undefined)).toBe('$0.08/g');
    expect(formatUnitPrice(product, undefined)).toBe('$0.08/g');
  });

  it('returns an empty string when there is no unit price to show', () => {
    expect(formatUnitPriceExact({ currencyCode: 'USD', quantity: 100, uom: 'g' }, undefined)).toBe(
      '',
    );
  });
});
