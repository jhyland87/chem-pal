import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory stand-in for the excludedProducts IndexedDB store.
let store: Record<string, unknown> = {};
let getShouldThrow = false;
let putShouldThrow = false;
vi.mock('@/utils/idbCache', () => ({
  getExcludedProducts: async () => {
    if (getShouldThrow) throw new Error('get failed');
    return store;
  },
  putExcludedProducts: async (map: Record<string, unknown>) => {
    if (putShouldThrow) throw new Error('put failed');
    store = map;
  },
}));

const {
  addExcludedProduct,
  countExcludedProductsForSupplier,
  loadExcludedProductKeys,
  loadExcludedProducts,
  removeExcludedProduct,
} = await import('@/helpers/excludedProducts');
const { getProductIdentityKey } = await import('@/helpers/productIdentity');

describe('addExcludedProduct (identity-keyed)', () => {
  beforeEach(() => {
    store = {};
  });
  afterEach(() => vi.restoreAllMocks());

  it('keys the entry by the product identity, not the URL', async () => {
    const key = await addExcludedProduct('FAM_889460', 'Carolina', {
      title: 'Sodium Hydroxide',
      url: 'https://carolina.com/p/889425',
    });

    expect(key).toBe(getProductIdentityKey('FAM_889460', 'Carolina'));
    const keys = await loadExcludedProductKeys();
    expect(keys.has(key)).toBe(true);
    expect(store[key]).toMatchObject({
      identity: 'FAM_889460',
      url: 'https://carolina.com/p/889425',
      supplier: 'Carolina',
      title: 'Sodium Hydroxide',
    });
  });

  it('is idempotent for the same identity + supplier', async () => {
    await addExcludedProduct('ID1', 'Loudwolf', { url: 'https://a' });
    await addExcludedProduct('ID1', 'Loudwolf', { url: 'https://a' });
    expect(Object.keys(store)).toHaveLength(1);
  });

  it('keys distinct products under distinct keys', async () => {
    const k1 = await addExcludedProduct('ID1', 'Loudwolf', { url: 'https://loudwolf.com/p/1' });
    const k2 = await addExcludedProduct('ID2', 'Loudwolf', { url: 'https://loudwolf.com/p/2' });
    expect(k1).not.toBe(k2);
    expect(Object.keys(store)).toHaveLength(2);
  });

  it('returns the key but skips writing when persistence fails', async () => {
    getShouldThrow = true;
    const key = await addExcludedProduct('ID_ERR', 'Loudwolf');
    expect(key).toBe(getProductIdentityKey('ID_ERR', 'Loudwolf'));
    expect(store['ID_ERR']).toBeUndefined();
    getShouldThrow = false;
  });
});

describe('loadExcludedProducts / loadExcludedProductKeys', () => {
  beforeEach(() => {
    store = {};
    getShouldThrow = false;
    putShouldThrow = false;
  });

  it('returns the full map', async () => {
    await addExcludedProduct('A', 'Loudwolf');
    const map = await loadExcludedProducts();
    expect(Object.keys(map)).toHaveLength(1);
  });

  it('returns an empty set when the store is empty', async () => {
    const keys = await loadExcludedProductKeys();
    expect(keys.size).toBe(0);
  });
});

describe('countExcludedProductsForSupplier', () => {
  beforeEach(() => {
    store = {};
    getShouldThrow = false;
    putShouldThrow = false;
  });

  it('counts only entries for the given supplier', async () => {
    await addExcludedProduct('A', 'Loudwolf');
    await addExcludedProduct('B', 'Loudwolf');
    await addExcludedProduct('C', 'Carolina');
    expect(await countExcludedProductsForSupplier('Loudwolf')).toBe(2);
    expect(await countExcludedProductsForSupplier('Carolina')).toBe(1);
    expect(await countExcludedProductsForSupplier('Unknown')).toBe(0);
  });
});

describe('removeExcludedProduct', () => {
  beforeEach(() => {
    store = {};
    getShouldThrow = false;
    putShouldThrow = false;
  });

  it('removes an existing entry', async () => {
    const key = await addExcludedProduct('A', 'Loudwolf');
    expect(store[key]).toBeDefined();
    await removeExcludedProduct(key);
    expect(store[key]).toBeUndefined();
  });

  it('is a no-op for an absent key', async () => {
    await addExcludedProduct('A', 'Loudwolf');
    const before = Object.keys(store).length;
    await removeExcludedProduct('does-not-exist');
    expect(Object.keys(store)).toHaveLength(before);
  });

  it('swallows persistence errors', async () => {
    const key = await addExcludedProduct('A', 'Loudwolf');
    putShouldThrow = true;
    await expect(removeExcludedProduct(key)).resolves.toBeUndefined();
    putShouldThrow = false;
  });
});
