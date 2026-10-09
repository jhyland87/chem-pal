import { Logger } from '@/utils/Logger';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Validation warnings are on under Vitest (the build counts as a dev build). A supplier that has
// no value for a field sends '' or nothing; that is "no data", not an invalid value.
describe('ProductBuilder validation warnings', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const builder = () => new ProductBuilder('https://example.com');

  describe.each([
    ['setDescription'],
    ['setShortDescription'],
    ['setSku'],
    ['setTitle'],
    ['setPermalink'],
    ['setVendor'],
  ] as const)('%s', (setter) => {
    it.each([
      ['an empty string', ''],
      ['a whitespace-only string', '   '],
      ['undefined', undefined],
      ['null', null],
    ])('does not warn for %s', (_label, value) => {
      builder()[setter](value);

      expect(warn).not.toHaveBeenCalled();
    });

    it.each([
      ['an object', { not: 'a string' }],
      ['an array', [1, 2]],
      ['a boolean', true],
    ])('still warns for %s', (_label, value) => {
      builder()[setter](value);

      expect(warn).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(`${setter}|`),
        expect.objectContaining({ builder: expect.anything() }),
      );
    });
  });

  it('still stores a valid description', () => {
    expect(builder().setDescription('High purity sodium chloride').dump().description).toBe(
      'High purity sodium chloride',
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
