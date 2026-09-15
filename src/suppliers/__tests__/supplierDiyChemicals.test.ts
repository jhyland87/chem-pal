import { AVAILABILITY } from '@/constants/common';
import { ProductBuilder } from '@/utils/ProductBuilder';
import { describe, expect, it } from 'vitest';
import { SupplierDiyChemicals } from '..';

type DiyChemicalsInternals = {
  getAdditionalQuantityStrings: (item: WooCommerceSearchResponseItem) => string[];
  initProductBuilders: (results: WooCommerceSearchResponseItem[]) => ProductBuilder<Product>[];
};

const makeSupplier = (): InstanceType<typeof SupplierDiyChemicals> =>
  new SupplierDiyChemicals('test', 1);

const baseItem = (
  overrides: Partial<WooCommerceSearchResponseItem> = {},
): WooCommerceSearchResponseItem =>
  ({
    id: 67068,
    name: 'Decyl Glucoside',
    type: 'variable',
    description: '',
    short_description: '',
    permalink: 'https://diychemicals.com/product/decyl-glucoside/',
    is_in_stock: true,
    is_purchasable: true,
    sold_individually: false,
    sku: '',
    prices: {
      price: '2999',
      regular_price: '2999',
      sale_price: '2999',
      currency_code: 'USD',
      currency_symbol: '$',
      currency_minor_unit: 2,
      currency_decimal_separator: '.',
      currency_thousand_separator: ',',
      currency_prefix: '$',
      currency_suffix: '',
    },
    attributes: [],
    variations: [],
    ...overrides,
  }) as unknown as WooCommerceSearchResponseItem;

describe('SupplierDiyChemicals', () => {
  describe('getAdditionalQuantityStrings', () => {
    it('returns every term name across all attributes', () => {
      const supplier = makeSupplier() as unknown as DiyChemicalsInternals;
      const item = baseItem({
        attributes: [
          {
            id: 2,
            name: 'Size',
            taxonomy: 'pa_size',
            has_variations: true,
            terms: [
              { id: 303, name: '1 Gallon', slug: '1-gallon' },
              { id: 775, name: '4 Gallon Pack', slug: '4-gallon-pack' },
            ],
          },
        ],
      });

      expect(supplier.getAdditionalQuantityStrings(item)).toEqual(['1 Gallon', '4 Gallon Pack']);
    });

    it('returns an empty array when attributes is missing or not an array', () => {
      const supplier = makeSupplier() as unknown as DiyChemicalsInternals;
      expect(
        supplier.getAdditionalQuantityStrings(
          baseItem({
            attributes: undefined as unknown as WooCommerceSearchResponseItem['attributes'],
          }),
        ),
      ).toEqual([]);
      expect(supplier.getAdditionalQuantityStrings(baseItem({ attributes: [] }))).toEqual([]);
    });

    it('tolerates attributes whose terms are missing', () => {
      const supplier = makeSupplier() as unknown as DiyChemicalsInternals;
      const item = baseItem({
        attributes: [
          {
            id: 1,
            name: 'Item Form',
            taxonomy: 'pa_item-form',
            has_variations: false,
            terms: undefined as unknown as { id: number; name: string; slug: string }[],
          },
        ],
      });
      expect(supplier.getAdditionalQuantityStrings(item)).toEqual([]);
    });
  });

  describe('initProductBuilders integration', () => {
    it('derives quantity from an attribute term when the variation value is a slug', async () => {
      const supplier = makeSupplier() as unknown as DiyChemicalsInternals;
      const item = baseItem({
        name: 'Decyl Glucoside',
        attributes: [
          {
            id: 2,
            name: 'Size',
            taxonomy: 'pa_size',
            has_variations: true,
            terms: [{ id: 775, name: '4 Gallon Pack', slug: '4-gallon-pack' }],
          },
        ],
        variations: [
          { id: 67399, attributes: [{ name: 'Size', value: '4-gallon-pack' }] },
        ] as unknown as WooCommerceSearchResponseItem['variations'],
      });

      const [builder] = supplier.initProductBuilders([item]);
      const product = await builder.build();

      expect(product?.quantity).toBe(4);
      expect(product?.uom).toBe('gal');
    });

    it('normalizes a singular "quart" mentioned in the description to the canonical "qt" uom', async () => {
      // Regression case: "Sodium Silicate Solution 40% / Waterglass" only states
      // its smallest size in prose ("Available in 1 quart, 1 gallon, ...") — the
      // "Size" attribute terms for that product are bare "Quart"/"Gallon" (no
      // digit), so parseQuantity can't use them. The description text was the
      // only candidate carrying a digit, and "quart" (unabbreviated singular)
      // was missing from UOM_ALIASES, which silently fell through to storing
      // the raw string "quart" as the uom instead of the canonical "qt" -
      // breaking unit-price calculation downstream.
      const supplier = makeSupplier() as unknown as DiyChemicalsInternals;
      const item = baseItem({
        name: 'Sodium Silicate Solution 40% / Waterglass',
        description: 'Available in 1 quart, 1 gallon, 4-gallon pack, and 5 gallon package sizes.',
        attributes: [
          {
            id: 2,
            name: 'Size',
            taxonomy: 'pa_size',
            has_variations: true,
            terms: [
              { id: 294, name: 'Quart', slug: 'quart' },
              { id: 291, name: 'Gallon', slug: 'gallon' },
            ],
          },
        ],
      });

      const [builder] = supplier.initProductBuilders([item]);
      const product = await builder.build();

      expect(product?.quantity).toBe(1);
      expect(product?.uom).toBe('qt');
    });

    it('sets url to the Store API endpoint and permalink to the human-facing page', async () => {
      const supplier = makeSupplier() as unknown as DiyChemicalsInternals;
      const item = baseItem({ name: 'Decyl Glucoside 1 Gallon' });

      const [builder] = supplier.initProductBuilders([item]);
      const product = await builder.build();

      // `url` is what ChemPal queried (the Store API endpoint)...
      expect(product?.url).toContain('/wp-json/wc/store/v1/products/67068');
      // ...while `permalink` is the page the user opens in the browser.
      expect(product?.permalink).toBe('https://diychemicals.com/product/decyl-glucoside/');
      expect(product?.permalink).not.toBe(product?.url);
    });

    it("sets availability from the item's is_in_stock flag", async () => {
      const supplier = makeSupplier() as unknown as DiyChemicalsInternals;

      // Name carries a size so build() reaches a minimal product.
      const inStock = await supplier
        .initProductBuilders([baseItem({ name: 'Decyl Glucoside 1 Gallon' })])[0]
        .build();
      expect(inStock?.availability).toBe(AVAILABILITY.IN_STOCK);

      const outOfStock = await supplier
        .initProductBuilders([
          baseItem({ name: 'Decyl Glucoside 1 Gallon', is_in_stock: false }),
        ])[0]
        .build();
      expect(outOfStock?.availability).toBe(AVAILABILITY.OUT_OF_STOCK);
    });
  });
});
