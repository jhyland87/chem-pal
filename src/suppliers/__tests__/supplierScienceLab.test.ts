import { parseQuantity } from '@/helpers/quantity';
import { canUserBuy } from '@/helpers/purchaseRestriction';
import { isMinimalProduct } from '@/utils/typeGuards/common';
// ProductBuilder must be imported before SupplierBase (module-init cycle).
import { ProductBuilder } from '@/utils/ProductBuilder';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  humanizeSlug,
  parseConcentration,
  slugFromUrl,
  SupplierScienceLab,
} from '../SupplierScienceLab';

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, `../__fixtures__/sciencelab/${name}`), 'utf8');

// The real product sitemap (xmlsitemap.php?type=products), all 1,681 products.
const sitemapXml = fixture('xmlsitemap-products.xml');
const variantAttributes = JSON.parse(fixture('variant-attributes.json'));
const variantAttributesNoPricing = JSON.parse(fixture('variant-attributes-nopricing.json'));

// Per-variant prices keyed by the attribute value id embedded in each radio, so
// the mocked product-attributes endpoint returns a distinct, realistic price per
// size (anchored to each page's ld+json min/max price).
const VARIANT_PRICES: Record<string, number> = {
  '4125': 108, // hexametaphosphate 500g
  '4126': 342, // hexametaphosphate 2.5Kg
  '4127': 1140, // hexametaphosphate 12Kg
  '4162': 36, // metasilicate 500g
  '4163': 108, // metasilicate 2.5Kg
  '1337': 67, // perchloric 500ml
  '1338': 99, // perchloric 1L
  '2156': 52, // diethyl 1L
  '4418': 47, // sodium sulfite 1L (dropdown)
  '4419': 89, // sodium sulfite 4L (dropdown)
};

/** Builds a product-attributes response of the real shape for a given price. */
const variantResponse = (price: number) => ({
  content: '',
  data: { price: { without_tax: { formatted: `$${price}.00`, value: price, currency: 'USD' } } },
});

type ScienceLabInternals = {
  fetchSitemapPage: (page: number) => Promise<string | undefined>;
  fetchVariantPrice: (p: string, a: string, v: string) => Promise<number | undefined>;
  queryProducts: (q: string, l?: number) => Promise<ProductBuilder<Product>[] | void>;
  getProductData: (b: ProductBuilder<Product>) => Promise<ProductBuilder<Product> | void>;
};

const makeSupplier = () => new SupplierScienceLab('sodium hexametaphosphate', 5);

/**
 * Runs getProductData against a product-page fixture with the cache bypassed and
 * each size variant priced from VARIANT_PRICES (via the attribute value id in
 * the POST body). Returns the finished product dump.
 */
const runGetProductData = async (pageFixture: string, url: string) => {
  const supplier = makeSupplier() as unknown as ScienceLabInternals;
  vi.spyOn(supplier as never, 'httpGetHtml').mockResolvedValue(fixture(pageFixture) as never);
  vi.spyOn(supplier as never, 'getProductDataWithCache').mockImplementation(((
    b: ProductBuilder<Product>,
    fetcher: (b: ProductBuilder<Product>) => unknown,
  ) => fetcher(b)) as never);
  vi.spyOn(supplier as never, 'httpPostJson').mockImplementation((async (opts: {
    body?: string;
  }) => {
    const params = new URLSearchParams(opts.body ?? '');
    let valueId: string | undefined;
    for (const [key, value] of params) {
      if (key.startsWith('attribute[')) {
        valueId = value;
      }
    }
    const price = valueId ? VARIANT_PRICES[valueId] : undefined;
    return price === undefined ? { content: '', data: {} } : variantResponse(price);
  }) as never);

  const builder = new ProductBuilder<Product>('https://sciencelab.com');
  builder.setBasicInfo('humanized guess', url, 'ScienceLab');
  await supplier.getProductData(builder as unknown as ProductBuilder<Product>);
  return builder.dump();
};

describe('SupplierScienceLab slugFromUrl', () => {
  it('returns the root-level slug for a product URL', () => {
    expect(slugFromUrl('https://sciencelab.com/isopropyl-alcohol-70-v-v/')).toBe(
      'isopropyl-alcohol-70-v-v',
    );
  });

  it('rejects nested (category/CMS) URLs', () => {
    expect(slugFromUrl('https://sciencelab.com/brands/acme/')).toBeNull();
    expect(slugFromUrl('not a url')).toBeNull();
  });
});

describe('SupplierScienceLab humanizeSlug', () => {
  it('recovers percent, ratio, locant, and decimal notation from slugs', () => {
    expect(humanizeSlug('isopropyl-alcohol-70-v-v-aqueous-solution')).toBe(
      'isopropyl alcohol 70% (v/v) aqueous solution',
    );
    expect(humanizeSlug('sodium-thiosulfate-0-100-normal-aqueous-solution')).toBe(
      'sodium thiosulfate 0.100 normal aqueous solution',
    );
    expect(humanizeSlug('p-xylene-certified-grade')).toBe('p-xylene certified grade');
    expect(humanizeSlug('sodium-hexametaphosphate-anhydrous')).toBe(
      'sodium hexametaphosphate anhydrous',
    );
  });
});

describe('SupplierScienceLab parseConcentration', () => {
  it.each<[string, string | undefined]>([
    // Percentage, with and without a method marker (bare markers normalized).
    ['Isopropyl Alcohol 70% (v/v) Aqueous Solution', '70% (v/v)'],
    ['Zinc Sulfate 10% (w/v) Aqueous Solution', '10% (w/v)'],
    ['Sulfuric Acid, 20% (w/w) Aqueous Solution', '20% (w/w)'],
    ['Ammonium Acetate 20% w/v Solution', '20% (w/v)'],
    ['Gibbeberellic Acid, 90+%', '90+%'],
    ['Nitric Acid 68-71%, Reagent ACS Grade', '68-71%'],
    ['N-Hexane, Special, HPLC, (>95% as n-Hexane)', '>95%'],
    // Molarity, normality, mass concentration, stabilizer marker.
    ['Sodium Persulfate 0.7 Molar Solution', '0.7 Molar'],
    ['Nitric Acid 6.0 Normal Aqueous Solution', '6.0 Normal'],
    ['Bromide Standard (w/w) 800 PPM as Br', '800 ppm (w/w)'],
    ['Chemical Oxygen Demand Standard  1,000ppm (w/w) Aqueous Solution', '1,000 ppm (w/w)'],
    ['Sodium Diethyldithiocarbamate 1g/L Aqueous Solution', '1 g/L'],
    ['Tetrahydrofuran, (w/BHT) , HPLC Grade', '(w/BHT)'],
    // Molarity/normality/ppm outrank a percentage that describes the solvent.
    ['Tetrabutylammonium Hydroxide  0.1 Normal in 90% Isopropanol', '0.1 Normal'],
    ['Bismuth AA Standard, 1000 ppm Bi in 3% HNO3', '1000 ppm'],
    ['Sulfuric Acid, 1.8 Normal 0.004% Manganese Sulfate', '1.8 Normal'],
    // Percentage outranks an equivalent g/L restatement of the same value.
    ['Hydroquinone 1% (w/v) 10 g/L Solution', '1% (w/v)'],
    // No concentration stated.
    ['Sodium Chloride, ACS Grade', undefined],
    ['Sodium Hexametaphosphate Anhydrous', undefined],
  ])('parses %s', (title, expected) => {
    expect(parseConcentration(title)).toBe(expected);
  });
});

describe('SupplierScienceLab queryProducts', () => {
  it('returns only close matches from the full 1,681-product catalog', async () => {
    const supplier = makeSupplier();
    const internals = supplier as unknown as ScienceLabInternals;
    // Page 1 yields the whole catalog; page 2 is empty, ending the walk.
    vi.spyOn(supplier as never, 'fetchSitemapPage')
      .mockResolvedValueOnce(sitemapXml as never)
      .mockResolvedValue(undefined as never);

    const results = await internals.queryProducts('sodium hexametaphosphate', 15);
    const titles = results?.map((b) => b.dump().title) ?? [];

    expect(titles.length).toBeGreaterThan(0);
    // The exact match sits deep in the catalog (index 921) — it only surfaces if
    // scoring is correct at scale (guarding the fuzzball `extract` bug that
    // per-item `fuzzyScoreAst` scoring fixes).
    expect(titles[0]).toBe('sodium hexametaphosphate anhydrous');
    // token_set_ratio + the 80 cutoff keep only genuinely close titles: every
    // result actually names the queried compound, and unrelated "sodium …"
    // products (which WRatio floated to ~86) are gone.
    expect(titles.every((t) => t?.includes('hexametaphosphate'))).toBe(true);
    expect(titles.some((t) => t?.includes('thiosulfate') || t?.includes('sulfite'))).toBe(false);
    // Ranked by score, highest first.
    const scores = results?.map((b) => b.dump().matchPercentage ?? 0) ?? [];
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe('SupplierScienceLab constructor', () => {
  it('floors the results limit at 15, honoring a larger explicit limit', () => {
    const asLimit = (s: SupplierScienceLab) => (s as unknown as { limit: number }).limit;
    expect(asLimit(new SupplierScienceLab('acetone'))).toBe(15);
    expect(asLimit(new SupplierScienceLab('acetone', 5))).toBe(15);
    expect(asLimit(new SupplierScienceLab('acetone', 25))).toBe(25);
  });
});

describe('SupplierScienceLab getProductData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // Each real product page, exercising a different mix: full spec table vs
  // solution (no CAS/formula), multi-size vs single-size, minPrice vs price
  // offer, and graded vs ungraded titles.
  const cases = [
    {
      name: 'sodium hexametaphosphate (full spec table, 3 sizes)',
      fixture: 'product-page.html',
      url: 'https://sciencelab.com/sodium-hexametaphosphate-anhydrous/',
      title: 'Sodium Hexametaphosphate Anhydrous',
      sku: 'SLS3412',
      concentration: undefined,
      price: 108,
      cas: '10124-56-8',
      formula: 'Na₆O₁₈P₆',
      grade: 'Ungraded',
      restriction: true,
      baseSize: '500g',
      variants: [
        { title: '500g', price: 108 },
        { title: '2.5Kg', price: 342 },
        { title: '12Kg', price: 1140 },
      ],
    },
    {
      name: 'sodium metasilicate (laboratory grade, 2 sizes)',
      fixture: 'product-page-metasilicate.html',
      url: 'https://sciencelab.com/sodium-metasilicate-anhydrous-laboratory-grade/',
      title: 'Sodium Metasilicate, Anhydrous, Laboratory Grade',
      sku: 'SLS3593',
      concentration: undefined,
      price: 36,
      cas: '6834-92-0',
      formula: 'Na₂SiO₃',
      grade: 'Lab Grade',
      restriction: true,
      baseSize: '500g',
      variants: [
        { title: '500g', price: 36 },
        { title: '2.5Kg', price: 108 },
      ],
    },
    {
      name: 'perchloric acid titrant (solution: no CAS/formula, 2 sizes)',
      fixture: 'product-page-perchloric.html',
      url: 'https://sciencelab.com/perchloric-acid-titrant-solution-0-001-normal-acetous-in-acetic-acid/',
      title: 'Perchloric Acid Titrant Solution 0.001 Normal Acetous in Acetic Acid',
      sku: 'SLP6601',
      concentration: '0.001 Normal',
      price: 67,
      cas: undefined,
      formula: undefined,
      grade: 'Ungraded',
      restriction: true,
      baseSize: '500ml',
      variants: [
        { title: '500ml', price: 67 },
        { title: '1L', price: 99 },
      ],
    },
    {
      name: 'sodium diethyldithiocarbamate (single size, price offer)',
      fixture: 'product-page-diethyl.html',
      url: 'https://sciencelab.com/sodium-diethyldithiocarbamate-1g-l-aqueous-solution/',
      title: 'Sodium Diethyldithiocarbamate 1g/L Aqueous Solution',
      sku: 'SLS8597',
      concentration: '1 g/L',
      price: 52,
      cas: undefined,
      formula: undefined,
      grade: 'Ungraded',
      restriction: true,
      baseSize: '1L',
      variants: [{ title: '1L', price: 52 }],
    },
    {
      name: 'sodium sulfite (dropdown/select variants, not radios)',
      fixture: 'product-page-select.html',
      url: 'https://sciencelab.com/sodium-sulfite-5-w-v-aqueous-solution/',
      title: 'Sodium Sulfite, 5% (w/v) Aqueous Solution',
      sku: 'SLS2212',
      concentration: '5% (w/v)',
      price: 47,
      cas: undefined,
      formula: undefined,
      grade: 'Ungraded',
      restriction: true,
      baseSize: '1L',
      variants: [
        { title: '1L', price: 47 },
        { title: '4L', price: 89 },
      ],
    },
  ];

  for (const c of cases) {
    it(`parses ${c.name}`, async () => {
      const dump = await runGetProductData(c.fixture, c.url);

      // Real store title replaces the humanized guess.
      expect(dump.title).toBe(c.title);
      expect(dump.sku).toBe(c.sku);
      expect(dump.currencyCode).toBe('USD');
      expect(dump.currencySymbol).toBe('$');
      expect(dump.availability).toBeTruthy();
      // Base price is the smallest size (ld+json minPrice / price), never clobbered.
      expect(dump.price).toBe(c.price);
      expect(dump.cas).toBe(c.cas);
      expect(dump.formula).toBe(c.formula);
      expect(dump.grade).toBe(c.grade);
      expect(dump.concentration).toBe(c.concentration);
      // "Special Considerations" is captured as an informational note only —
      // never restrictedDelivery/buyerRestricted, which would hide the product
      // via canUserBuy.
      expect(dump.purchaseRestriction?.restrictedDelivery).toBeUndefined();
      expect(dump.purchaseRestriction?.buyerRestricted).toBeUndefined();
      if (c.restriction) {
        expect(dump.purchaseRestriction?.note).toContain('hazmat');
      }
      // Base quantity anchored to the smallest size variant.
      const baseQty = parseQuantity(c.baseSize);
      expect(dump.quantity).toBe(baseQty?.quantity);
      expect(dump.uom?.toLowerCase()).toBe(baseQty?.uom?.toLowerCase());
      // Every size variant, priced via the product-attributes endpoint.
      expect(dump.variants?.map((v) => v.title)).toEqual(c.variants.map((v) => v.title));
      expect(dump.variants?.map((v) => v.price)).toEqual(c.variants.map((v) => v.price));
      expect(isMinimalProduct(dump)).toBe(true);
      // Regression guard: the Special Considerations note must not make the
      // product un-buyable — otherwise canUserBuy hides every ScienceLab product.
      expect(canUserBuy(dump as unknown as Variant, 'US')).toBe(true);
      expect(canUserBuy(dump as unknown as Variant, undefined)).toBe(true);
    });
  }

  it('falls back to the product:price:amount meta tag when the offer has no price', async () => {
    const supplier = makeSupplier() as unknown as ScienceLabInternals;
    // A minimal page: a price meta tag, but no ld+json offer and no variants.
    const html =
      '<html><head>' +
      '<meta property="og:title" content="Test Reagent" />' +
      '<meta property="product:price:amount" content="42" />' +
      '<meta property="og:availability" content="instock" />' +
      '</head><body></body></html>';
    vi.spyOn(supplier as never, 'httpGetHtml').mockResolvedValue(html as never);
    vi.spyOn(supplier as never, 'getProductDataWithCache').mockImplementation(((
      b: ProductBuilder<Product>,
      fetcher: (b: ProductBuilder<Product>) => unknown,
    ) => fetcher(b)) as never);

    const builder = new ProductBuilder<Product>('https://sciencelab.com');
    builder.setBasicInfo('test reagent', 'https://sciencelab.com/test-reagent/', 'ScienceLab');
    await supplier.getProductData(builder as unknown as ProductBuilder<Product>);

    expect(builder.dump().price).toBe(42);
  });
});

describe('SupplierScienceLab fetchVariantPrice', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the without-tax value from the product-attributes response', async () => {
    const supplier = makeSupplier() as unknown as ScienceLabInternals;
    vi.spyOn(supplier as never, 'httpPostJson').mockResolvedValue(variantAttributes as never);

    // The captured fixture prices this combination at $109.
    expect(await supplier.fetchVariantPrice('667', '667', '1337')).toBe(109);
  });

  it('returns undefined when the response carries no price (call-for-price / OOS)', async () => {
    const supplier = makeSupplier() as unknown as ScienceLabInternals;
    vi.spyOn(supplier as never, 'httpPostJson').mockResolvedValue(
      variantAttributesNoPricing as never,
    );

    expect(await supplier.fetchVariantPrice('665', '658', '1338')).toBeUndefined();
  });

  it('returns undefined when the POST throws', async () => {
    const supplier = makeSupplier() as unknown as ScienceLabInternals;
    vi.spyOn(supplier as never, 'httpPostJson').mockRejectedValue(new Error('network') as never);

    expect(await supplier.fetchVariantPrice('665', '658', '1338')).toBeUndefined();
  });
});
