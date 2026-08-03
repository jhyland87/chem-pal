// ProductBuilder must be imported before SupplierBase/SupplierLabProServices to avoid a
// module-initialization cycle.
import { ProductBuilder } from '@/utils/ProductBuilder';
import { describe, expect, it, vi } from 'vitest';
import benzoicSearch from '../__fixtures__/labproservices/benzoic-search.json';
import { SupplierLabProServices } from '../SupplierLabProServices';

type LabProInternals = {
  initProductBuilders(items: Magento2ProductItem[]): ProductBuilder<Product>[];
  queryProducts(query: string, limit: number): Promise<ProductBuilder<Product>[] | void>;
};

const asInternals = (supplier: SupplierLabProServices) =>
  supplier as unknown as LabProInternals;

const items = (benzoicSearch as unknown as { data: { products: { items: Magento2ProductItem[] } } })
  .data.products.items;

/** Finds a fixture item by its SKU. */
const itemBySku = (sku: string): Magento2ProductItem => {
  const item = items.find((i) => i.sku === sku);
  if (!item) {
    throw new Error(`Fixture item not found: ${sku}`);
  }
  return item;
};

const makeSupplier = (query = 'benzoic', limit = 20) =>
  new SupplierLabProServices(query, limit, new AbortController());

describe('SupplierLabProServices.initProductBuilders', () => {
  it('prices from final_price, not regular_price, when a discount applies', () => {
    // B1085-500GM-EA: regular_price 280.5 / final_price 153.7
    const [builder] = asInternals(makeSupplier()).initProductBuilders([
      itemBySku('B1085-500GM-EA'),
    ]);
    const dump = builder.dump();
    expect(dump.price).toBe(153.7);
    expect(dump.currencyCode).toBe('USD');
  });

  it('uses final_price for undiscounted products too', () => {
    // H4026-1GM-EA: regular_price === final_price === 117.95
    const [builder] = asInternals(makeSupplier()).initProductBuilders([itemBySku('H4026-1GM-EA')]);
    expect(builder.dump().price).toBe(117.95);
  });

  it('builds the product URL and permalink with no store-path segment', () => {
    const item = itemBySku('B1085-500GM-EA');
    const [builder] = asInternals(makeSupplier()).initProductBuilders([item]);
    const dump = builder.dump();
    const expected = `https://www.labproservices.com/${item.url_key}.html`;
    expect(dump.url).toBe(expected);
    expect(dump.permalink).toBe(expected);
    expect(dump.permalink).not.toContain('/us_en/');
  });

  it('parses the quantity from the SKU/name', () => {
    const [builder] = asInternals(makeSupplier()).initProductBuilders([
      itemBySku('B1085-500GM-EA'),
    ]);
    const dump = builder.dump();
    expect(dump.quantity).toBe(500);
    expect(dump.uom).toMatch(/g/i);
  });
});

describe('SupplierLabProServices.queryProducts', () => {
  it('posts the category-scoped query and returns builders', async () => {
    const supplier = makeSupplier('benzoic', 20);
    const postSpy = vi
      .spyOn(supplier as never, 'httpPostJson')
      .mockResolvedValue(benzoicSearch as never);

    const builders = await asInternals(supplier).queryProducts('benzoic', 20);

    expect(builders).toBeDefined();
    expect(builders?.length).toBeGreaterThan(0);

    expect(postSpy).toHaveBeenCalledTimes(1);
    const call = postSpy.mock.calls[0][0] as {
      path: string;
      body: { query: string; variables: Record<string, unknown> };
    };
    expect(call.path).toBe('/graphql');
    expect(call.body.variables.categoryId).toBe('8295');
    expect(call.body.variables.search).toBe('benzoic');
    expect(call.body.variables.pageSize).toBe(20);
    expect(call.body.query).toContain('category_id');
  });

  it('returns void when the response has no items', async () => {
    const supplier = makeSupplier('nonexistent', 20);
    vi.spyOn(supplier as never, 'httpPostJson').mockResolvedValue({
      data: { products: { items: [] } },
    } as never);

    const builders = await asInternals(supplier).queryProducts('nonexistent', 20);
    expect(builders).toBeUndefined();
  });
});
