import { ProductBuilder } from '@/utils/ProductBuilder';
import { describe, expect, it } from 'vitest';

const BASE_URL = 'https://example.com';
const EBAY_URL = 'https://www.ebay.com/str/dailybiousa';
const AMAZON_URL = 'https://www.amazon.com/s?k=HiMedia';

const makeBuilder = () => new ProductBuilder<Product>(BASE_URL);

describe('ProductBuilder marketplace store URLs', () => {
  it('stores a valid eBay store URL', () => {
    const builder = makeBuilder().setSupplierEbayStoreURL(EBAY_URL);
    expect(builder.dump().supplierEbayStoreURL).toBe(EBAY_URL);
  });

  it('stores a valid Amazon store URL', () => {
    const builder = makeBuilder().setSupplierAmazonStoreURL(AMAZON_URL);
    expect(builder.dump().supplierAmazonStoreURL).toBe(AMAZON_URL);
  });

  it.each([
    ['undefined', undefined],
    ['an empty string', ''],
    ['a non-URL string', 'not a url'],
    ['a relative path', '/str/dailybiousa'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a data: URL', 'data:text/html,<script>alert(1)</script>'],
    ['a number', 42],
  ])('ignores %s', (_label, value) => {
    const builder = makeBuilder().setSupplierEbayStoreURL(value);
    expect(builder.dump().supplierEbayStoreURL).toBeUndefined();
  });

  it("does not resolve a store URL against the supplier's baseURL", () => {
    // The storefront lives on a foreign host, so a relative value is a mistake rather than
    // something to resolve into "https://example.com/str/...".
    const builder = makeBuilder().setSupplierEbayStoreURL('str/dailybiousa');
    expect(builder.dump().supplierEbayStoreURL).toBeUndefined();
  });

  it('round-trips both URLs through setData', () => {
    // Proves the dispatch-map entries exist; without them setData drops the keys with a
    // "dropping unsupported key" warning and cached products lose the storefront links.
    const builder = makeBuilder().setData({
      supplierEbayStoreURL: EBAY_URL,
      supplierAmazonStoreURL: AMAZON_URL,
    });

    const dumped = builder.dump();
    expect(dumped.supplierEbayStoreURL).toBe(EBAY_URL);
    expect(dumped.supplierAmazonStoreURL).toBe(AMAZON_URL);
  });
});

describe('ProductBuilder setSupplierPaymentMethods', () => {
  // Regression lock: the runtime PAYMENT_METHODS mirror used to omit the marketplace values,
  // so these filtered down to an empty array and the field was never set.
  it.each([['ebayonly'], ['amazononly'], ['ebay'], ['amazon']])(
    'keeps the marketplace method %s',
    (method) => {
      const builder = makeBuilder().setSupplierPaymentMethods([method]);
      expect(builder.dump().paymentMethods).toEqual([method]);
    },
  );

  it('keeps marketplace and card methods together', () => {
    const builder = makeBuilder().setSupplierPaymentMethods(['visa', 'ebayonly']);
    expect(builder.dump().paymentMethods).toEqual(['visa', 'ebayonly']);
  });
});
