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

    it('extracts a "DOWNLOAD SDS" link wrapped in a paragraph into sdsUrl and strips it from the description', async () => {
      const supplier = makeSupplier() as unknown as DiyChemicalsInternals;
      const item = baseItem({
        name: 'EDTA 40% 1 Gallon',
        description:
          '<p><a class="button primary is-primary is-medium" ' +
          'href="https://diychemicals.com/wp-content/uploads/2024/03/EDTA-40-MSDS-DIYChemicals-Chemboys.pdf" ' +
          'rel="noopener" target="_blank"><br />\n<span>DOWNLOAD SDS</span><br />\n</a></p>\n' +
          '<h1><strong>EDTA 40% Solution – Chelating Agent – CAS# 64-02-8</strong></h1>',
      });

      const [builder] = supplier.initProductBuilders([item]);
      const product = await builder.build();

      expect(product?.sdsUrl).toBe(
        'https://diychemicals.com/wp-content/uploads/2024/03/EDTA-40-MSDS-DIYChemicals-Chemboys.pdf',
      );
      expect(product?.description).not.toContain('DOWNLOAD SDS');
      expect(product?.description).not.toContain('.pdf');
    });

    it('extracts a bare "DOWNLOAD SDS" anchor with no wrapping paragraph', async () => {
      const supplier = makeSupplier() as unknown as DiyChemicalsInternals;
      const item = baseItem({
        name: 'Sodium Thiosulfate 1 Gallon',
        description:
          '<a href="https://diychemicals.com/wp-content/uploads/2024/02/Sodium-Thiosulfate-Pentahydrate-MSDS-DIYChemicals-Chemboys.pdf" ' +
          'target="_blank" class="button primary is-primary is-medium" rel="noopener">\n\t\t<span>DOWNLOAD SDS</span>\n\t</a>\n\n' +
          '<h2>Sodium Thiosulfate Pentahydrate Crystals</h2>',
      });

      const [builder] = supplier.initProductBuilders([item]);
      const product = await builder.build();

      expect(product?.sdsUrl).toBe(
        'https://diychemicals.com/wp-content/uploads/2024/02/Sodium-Thiosulfate-Pentahydrate-MSDS-DIYChemicals-Chemboys.pdf',
      );
      expect(product?.description).not.toContain('DOWNLOAD SDS');
    });

    it('extracts a trailing "DOWNLOAD SDS" link that appears after the main description body', async () => {
      const supplier = makeSupplier() as unknown as DiyChemicalsInternals;
      const item = baseItem({
        name: 'SLES 70% 1 Gallon',
        description:
          '<h1>SLES 70%</h1><p>Sodium Laureth Sulfate, a foaming surfactant.</p>' +
          '<h2>Safety Data Sheet</h2>' +
          '<p>Review the SDS before handling for hazards, protective equipment, storage and safe handling information.</p>' +
          '<p><a href="https://diychemicals.com/wp-content/uploads/2024/02/SLES-70-MSDS-DIYChemicals-Chemboys.pdf" ' +
          'target="_blank" class="button primary is-primary is-medium" rel="noopener">DOWNLOAD SDS</a></p>',
      });

      const [builder] = supplier.initProductBuilders([item]);
      const product = await builder.build();

      expect(product?.sdsUrl).toBe(
        'https://diychemicals.com/wp-content/uploads/2024/02/SLES-70-MSDS-DIYChemicals-Chemboys.pdf',
      );
      expect(product?.description).not.toContain('DOWNLOAD SDS');
      // The instructional text around it is untouched — only the anchor is removed.
      expect(product?.description).toContain('Review the SDS before handling');
    });

    it('ignores an unrelated PDF link whose URL does not mention SDS', async () => {
      const supplier = makeSupplier() as unknown as DiyChemicalsInternals;
      const item = baseItem({
        name: 'Decyl Glucoside 1 Gallon',
        description:
          '<h1>Decyl Glucoside</h1><p>A mild, plant-derived surfactant. ' +
          '<a href="https://diychemicals.com/wp-content/uploads/2024/spec-sheet.pdf">Spec Sheet</a></p>',
      });

      const [builder] = supplier.initProductBuilders([item]);
      const product = await builder.build();

      expect(product?.sdsUrl).toBeUndefined();
      // Left untouched — only a confirmed SDS link is extracted/stripped.
      expect(product?.description).toContain('Spec Sheet');
    });

    it('leaves sdsUrl unset and the description untouched when there is no SDS link', async () => {
      const supplier = makeSupplier() as unknown as DiyChemicalsInternals;
      const item = baseItem({
        name: 'Decyl Glucoside 1 Gallon',
        description: '<h1>Decyl Glucoside</h1><p>A mild, plant-derived surfactant.</p>',
      });

      const [builder] = supplier.initProductBuilders([item]);
      const product = await builder.build();

      expect(product?.sdsUrl).toBeUndefined();
      expect(product?.description).toContain('Decyl Glucoside');
      expect(product?.description).toContain('A mild, plant-derived surfactant.');
    });
  });
});
