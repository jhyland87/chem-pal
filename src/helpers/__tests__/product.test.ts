import {
  flattenProductVariants,
  getExportableProductData,
  hasExpandableDetail,
  isParentPurchasableUnit,
  isPresent,
  resolveDisplayedVariants,
  resolveProductImages,
  samePurchasableUnit,
  variantRowTitle,
} from '@/helpers/product';
import { describe, expect, it } from 'vitest';

/** Minimal base product with only the required fields populated. */
const baseProduct = {
  supplier: 'Carolina Chemical',
  title: 'Sodium Chloride',
  url: 'https://example.com/nacl',
  price: 10,
  currencyCode: 'USD',
  currencySymbol: '$',
  quantity: 500,
  uom: 'g',
} as Product;

describe('isPresent', () => {
  it.each([
    ['non-empty string', 'NaCl', true],
    ['number', 42, true],
    ['zero', 0, true],
    ['empty string', '', false],
    ['whitespace string', '   ', false],
    ['NaN', Number.NaN, false],
    ['undefined', undefined, false],
    ['null', null, false],
  ])('returns %s => %s', (_label, value, expected) => {
    expect(isPresent(value)).toBe(expected);
  });
});

describe.concurrent('resolveProductImages', () => {
  it('uses the thumbnail for display and the full image on click', ({ expect }) => {
    const images = resolveProductImages({
      ...baseProduct,
      images: [
        { href: 'full.jpg', type: 'image', altText: 'front' },
        { href: 't.jpg', type: 'thumbnail' },
      ],
    });
    expect(images).toEqual([{ thumbSrc: 't.jpg', fullSrc: 'full.jpg', altText: 'front' }]);
  });

  it('falls back to the full image when there is no thumbnail', ({ expect }) => {
    const images = resolveProductImages({
      ...baseProduct,
      images: [{ href: 'full.jpg', type: 'image' }],
    });
    expect(images).toEqual([{ thumbSrc: 'full.jpg', fullSrc: 'full.jpg', altText: undefined }]);
  });

  it('pairs each full image with its thumbnail by position', ({ expect }) => {
    const images = resolveProductImages({
      ...baseProduct,
      images: [
        { href: 'a.jpg', type: 'image' },
        { href: 'a-t.jpg', type: 'thumbnail' },
        { href: 'b.jpg', type: 'image' },
        { href: 'b-t.jpg', type: 'thumbnail' },
      ],
    });
    expect(images).toEqual([
      { thumbSrc: 'a-t.jpg', fullSrc: 'a.jpg', altText: undefined },
      { thumbSrc: 'b-t.jpg', fullSrc: 'b.jpg', altText: undefined },
    ]);
  });

  it('reuses the default thumbnail for images that lack their own', ({ expect }) => {
    const images = resolveProductImages({
      ...baseProduct,
      images: [
        { href: 'a.jpg', type: 'image' },
        { href: 'b.jpg', type: 'image' },
        { href: 't.jpg', type: 'thumbnail' },
      ],
    });
    expect(images.map((image) => image.thumbSrc)).toEqual(['t.jpg', 't.jpg']);
  });

  it('cycles thumbnails alone when there are no full images', ({ expect }) => {
    const images = resolveProductImages({
      ...baseProduct,
      images: [{ href: 't.jpg', type: 'thumbnail' }],
    });
    expect(images).toEqual([{ thumbSrc: 't.jpg', fullSrc: 't.jpg', altText: undefined }]);
  });

  it('derives a single CACTUS structure image from CAS when there is no photo', ({ expect }) => {
    const images = resolveProductImages({ ...baseProduct, cas: '69-57-8' } as Product);
    expect(images).toHaveLength(1);
    expect(images[0].thumbSrc).toBe('https://cactus.nci.nih.gov/chemical/structure/69-57-8/image');
    expect(images[0].fullSrc).toContain('/69-57-8/image?width=500&height=500');
  });

  it('url-encodes the identifier for SMILES fallbacks', ({ expect }) => {
    // Double-cast through unknown: a raw SMILES string doesn't satisfy the branded Smiles<string>.
    const images = resolveProductImages({
      ...baseProduct,
      smiles: '[K+].[O-]',
    } as unknown as Product);
    expect(images[0].thumbSrc).toBe(
      'https://cactus.nci.nih.gov/chemical/structure/%5BK%2B%5D.%5BO-%5D/image',
    );
  });

  it('returns an empty array with no image and no chemical identifier', ({ expect }) => {
    expect(resolveProductImages(baseProduct)).toEqual([]);
  });
});

describe.concurrent('hasExpandableDetail', () => {
  it('is true when the product has an image', ({ expect }) => {
    expect(
      hasExpandableDetail({ ...baseProduct, images: [{ href: 't.jpg', type: 'image' }] }),
    ).toBe(true);
  });

  it('is true when the product has variants', ({ expect }) => {
    expect(hasExpandableDetail({ ...baseProduct, variants: [{ title: '500g' }] })).toBe(true);
  });

  it('is true when the product has a populated detail field', ({ expect }) => {
    expect(hasExpandableDetail({ ...baseProduct, cas: '7647-14-5' } as Product)).toBe(true);
  });

  it('is true when the product has only a CAS (structure image derivable)', ({ expect }) => {
    expect(hasExpandableDetail({ ...baseProduct, formula: 'NaCl' })).toBe(true);
  });

  it('is false when there is nothing to show', ({ expect }) => {
    expect(hasExpandableDetail(baseProduct)).toBe(false);
  });

  it('is false for an empty-string detail field', ({ expect }) => {
    // Double-cast through unknown: "" doesn't satisfy the branded CAS<string> template type.
    expect(hasExpandableDetail({ ...baseProduct, cas: '' } as unknown as Product)).toBe(false);
  });
});

describe.concurrent('samePurchasableUnit', () => {
  it('matches the same size, case-insensitive on uom', ({ expect }) => {
    expect(
      samePurchasableUnit(
        { quantity: 1, uom: 'mg' } as Variant,
        {
          quantity: 1,
          uom: 'MG',
        } as Variant,
      ),
    ).toBe(true);
  });

  it('does not match a different quantity or uom', ({ expect }) => {
    expect(
      samePurchasableUnit(
        { quantity: 1, uom: 'mg' } as Variant,
        {
          quantity: 5,
          uom: 'mg',
        } as Variant,
      ),
    ).toBe(false);
    expect(
      samePurchasableUnit(
        { quantity: 1, uom: 'mg' } as Variant,
        {
          quantity: 1,
          uom: 'g',
        } as Variant,
      ),
    ).toBe(false);
  });

  it('detects a supplier-listed parent whose id/sku differ (Ambeed case)', ({ expect }) => {
    // Parent P001064386/sku BD01081502 vs variant 3272919/sku A1159477 — ids differ,
    // but both are the 1 mg unit, so the parent is a duplicate of the 1 mg variant.
    const parent = { quantity: 1, uom: 'mg', usdPrice: 29, id: 'P001064386' } as Variant;
    const oneMg = { quantity: 1, uom: 'mg', usdPrice: 29, id: '3272919' } as Variant;
    const fiveMg = { quantity: 5, uom: 'mg', usdPrice: 74, id: '3272918' } as Variant;
    expect(samePurchasableUnit(parent, oneMg)).toBe(true);
    expect(samePurchasableUnit(parent, fiveMg)).toBe(false);
  });

  it('falls back to rounded USD price when a size is missing', ({ expect }) => {
    expect(samePurchasableUnit({ usdPrice: 29 } as Variant, { usdPrice: 29.004 } as Variant)).toBe(
      true,
    );
    expect(samePurchasableUnit({ usdPrice: 29 } as Variant, { usdPrice: 74 } as Variant)).toBe(
      false,
    );
  });

  it('is false when neither size nor price is available', ({ expect }) => {
    expect(samePurchasableUnit({ title: 'a' } as Variant, { title: 'b' } as Variant)).toBe(false);
  });
});

describe.concurrent('getExportableProductData', () => {
  const images = [
    { href: 'https://cdn/shop/120x120x2/image.jpeg', type: 'thumbnail' as const },
    { href: 'https://cdn/shop/image.jpeg', type: 'image' as const },
  ];

  it('splits the image list into images and thumbnails href arrays', ({ expect }) => {
    const result = getExportableProductData({ ...baseProduct, images });
    expect(result.images).toEqual(['https://cdn/shop/image.jpeg']);
    expect(result.thumbnails).toEqual(['https://cdn/shop/120x120x2/image.jpeg']);
  });

  it('applies the same image split to each variant', ({ expect }) => {
    const result = getExportableProductData({
      ...baseProduct,
      variants: [{ title: '500 g', images }],
    } as Product);
    const [variant] = result.variants as Array<Record<string, unknown>>;
    expect(variant.images).toEqual(['https://cdn/shop/image.jpeg']);
    expect(variant.thumbnails).toEqual(['https://cdn/shop/120x120x2/image.jpeg']);
  });

  it('omits images/thumbnails keys when there are none of that kind', ({ expect }) => {
    const result = getExportableProductData({
      ...baseProduct,
      images: [{ href: 'https://cdn/shop/image.jpeg', type: 'image' }],
    });
    expect(result.images).toEqual(['https://cdn/shop/image.jpeg']);
    expect('thumbnails' in result).toBe(false);
  });

  it('renders price with the currency symbol and drops internal noise keys', ({ expect }) => {
    const result = getExportableProductData({
      ...baseProduct,
      cacheKey: 'ck-1',
      _id: 3,
      baseQuantity: 500,
    } as Product);
    expect(result.price).toBe('$10');
    expect('currencySymbol' in result).toBe(false);
    expect('cacheKey' in result).toBe(false);
    expect('_id' in result).toBe(false);
    expect('baseQuantity' in result).toBe(false);
  });
});

/** A product whose variants exercise the ungrouped-row flattening. */
const variantProduct = {
  supplier: 'LiMac',
  title: 'Sodium borohydride, min 95%',
  url: 'https://example.com/nabh4',
  cas: '16940-66-2',
  price: 106.57,
  currencyCode: 'USD',
  currencySymbol: '$',
  quantity: 50,
  uom: 'g',
} as Product;

describe.concurrent('isParentPurchasableUnit', () => {
  it('matches a variant of the same size as the parent', ({ expect }) => {
    expect(isParentPurchasableUnit(variantProduct, { quantity: 50, uom: 'g' })).toBe(true);
  });

  it('does not match a variant of a different size', ({ expect }) => {
    expect(isParentPurchasableUnit(variantProduct, { quantity: 100, uom: 'g' })).toBe(false);
  });
});

describe.concurrent('resolveDisplayedVariants', () => {
  it('returns the product itself when it has no variants', ({ expect }) => {
    expect(resolveDisplayedVariants(variantProduct)).toEqual([variantProduct]);
  });

  it('does not prepend the parent when a variant is the same purchasable unit', ({ expect }) => {
    const variants: Variant[] = [
      { title: 'Sodium borohydride, min 95%', quantity: 50, uom: 'g' },
      { title: '100g', quantity: 100, uom: 'g' },
    ];
    const product = { ...variantProduct, variants } as Product;
    expect(resolveDisplayedVariants(product)).toEqual(variants);
  });
});

describe.concurrent('variantRowTitle', () => {
  it('prepends the product name when the variant title is just a quantity', ({ expect }) => {
    expect(variantRowTitle(variantProduct, { title: '100g' })).toBe(
      'Sodium borohydride, min 95% 100g',
    );
  });

  it('leaves the title alone when it already contains the product name', ({ expect }) => {
    const parent = { ...variantProduct, title: 'Some Product 10g' } as Product;
    expect(variantRowTitle(parent, { title: 'Some Product 100g' })).toBe('Some Product 100g');
  });

  it('does not prepend when the variant equals the parent name', ({ expect }) => {
    expect(variantRowTitle(variantProduct, { title: 'Sodium borohydride, min 95%' })).toBe(
      'Sodium borohydride, min 95%',
    );
  });

  it('falls back to the product title when the variant has no title', ({ expect }) => {
    expect(variantRowTitle(variantProduct, { quantity: 100, uom: 'g' })).toBe(
      'Sodium borohydride, min 95%',
    );
  });
});

describe.concurrent('flattenProductVariants', () => {
  it('passes variantless products through unchanged', ({ expect }) => {
    expect(flattenProductVariants([variantProduct])).toEqual([variantProduct]);
  });

  it('emits a parent row plus one row per non-parent variant', ({ expect }) => {
    const variants: Variant[] = [
      { title: 'Sodium borohydride, min 95%', quantity: 50, uom: 'g', price: 106.57 },
      {
        title: '100g',
        quantity: 100,
        uom: 'g',
        price: 195.99,
        url: 'https://example.com/nabh4-100g',
      },
      { title: '((!)) 10kg', quantity: 10, uom: 'kg', price: 4818.48 },
    ];
    const product = { ...variantProduct, variants } as Product;
    const rows = flattenProductVariants([product]);

    // parent (50 g, same unit as the first variant → not duplicated) + 100 g + 10 kg
    expect(rows).toHaveLength(3);

    // parent row keeps its variants for the detail panel and has no back-reference
    expect(rows[0]).toBe(product);
    expect(rows[0].parentProduct).toBeUndefined();
    expect(rows[0].variants).toHaveLength(3);

    // variant rows drop the nested variants, inherit shared fields, link to parent
    for (const row of rows.slice(1)) {
      expect(row.variants).toBeUndefined();
      expect(row.cas).toBe('16940-66-2');
      expect(row.parentProduct?.title).toBe('Sodium borohydride, min 95%');
      expect(row.parentProduct?.url).toBe('https://example.com/nabh4');
    }

    // variant-specific fields are overlaid and the title is disambiguated
    expect(rows[1].price).toBe(195.99);
    expect(rows[1].quantity).toBe(100);
    expect(rows[1].title).toBe('Sodium borohydride, min 95% 100g');
    expect(rows[2].title).toBe('Sodium borohydride, min 95% ((!)) 10kg');
  });

  it('does not mutate the input products', ({ expect }) => {
    const variants: Variant[] = [{ title: '100g', quantity: 100, uom: 'g' }];
    const product = { ...variantProduct, variants } as Product;
    flattenProductVariants([product]);
    expect(product.variants).toBe(variants);
    expect(product.parentProduct).toBeUndefined();
  });
});
