import { CACHE } from '@/constants/common';
import { HttpError } from '@/helpers/exceptions';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory stand-in for chrome.storage.local, shared by every supplier instance in a test.
const storageState = { data: {} as Record<string, unknown>, failReads: false, failWrites: false };

vi.mock('@/utils/storage', () => ({
  cstorage: {
    local: {
      get: vi.fn(async (keys: string[]) => {
        if (storageState.failReads) throw new Error('storage read failed');
        return Object.fromEntries(
          keys.filter((k) => k in storageState.data).map((k) => [k, storageState.data[k]]),
        );
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        if (storageState.failWrites) throw new Error('storage write failed');
        Object.assign(storageState.data, items);
      }),
      remove: vi.fn(async (key: string) => {
        delete storageState.data[key];
      }),
    },
  },
}));

vi.mock('@/utils/SupplierCache', () => ({
  SupplierCache: class {
    constructor(..._args: unknown[]) {}
    getProductIdentityCacheKey(identity: string) {
      return `id:${identity}`;
    }
  },
}));

const { SupplierBaseSearchanise } = await import('@/suppliers/SupplierBaseSearchanise');
const { SupplierLaballey } = await import('@/suppliers/SupplierLaballey');
const { cstorage } = await import('@/utils/storage');

/** Minimal concrete Searchanise supplier. */
class TestSearchanise extends SupplierBaseSearchanise {
  public static readonly supplierName = 'TestSearchanise';
  public static readonly baseURL = 'https://shop.example';
  public static readonly shipping = 'worldwide' as ShippingRange;
  public static readonly country = 'US' as CountryCode;
  public static readonly paymentMethods = [] as PaymentMethod[];

  protected override fuzzyFilterAst<X>(results: X[]): X[] {
    return results;
  }
}

const STORAGE_KEY = `${CACHE.SEARCHANISE_CREDENTIALS}:TestSearchanise`;
const FRESH = { apiKey: '4p4M0R6q0N', host: 'searchserverapi1.com' };
const STALE = { apiKey: '8B7o0X1o7c', host: 'searchserverapi.com' };

/** Homepage HTML embedding `window.Searchanise`, shaped like a live storefront. */
const homepage = (apiObject: Record<string, unknown> = {}) =>
  `<html><script>window.Searchanise = ${JSON.stringify({
    host: 'https://searchserverapi1.com',
    api_key: FRESH.apiKey,
    SearchInput: '#search,form input[name="q"]',
    options: { ResultsDiv: '#snize_results' },
    ...apiObject,
  })};</script></html>`;

const searchResults = () => ({
  totalItems: 1,
  startIndex: 0,
  itemsPerPage: 200,
  currentItemCount: 1,
  items: [
    {
      title: 'Acetone 500 mL',
      description: 'Acetone ACS',
      price: '12.00',
      list_price: '12.00',
      link: 'https://shop.example/acetone',
      product_id: '1',
      original_product_id: '1',
      product_code: 'ACE-500',
      quantity: '5',
      vendor: 'Example',
      image_link: 'https://shop.example/acetone.jpg',
    },
  ],
});

/** A `/getresults` reply: Searchanise answers errors as plain text, results as JSON text. */
const reply = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/javascript;charset=UTF-8' } });

/**
 * Builds a supplier with the network boundary stubbed.
 * @param http - Responses to feed `httpGetHtml` (homepage) and `httpGet` (`/getresults`)
 */
function makeSupplier(http: { html?: () => Promise<string>; get?: ReturnType<typeof vi.fn> } = {}) {
  const supplier = new TestSearchanise('acetone', 10, new AbortController());
  const html = vi.fn(http.html ?? (async () => homepage()));
  const get = http.get ?? vi.fn(async () => reply(JSON.stringify(searchResults())));
  Object.assign(supplier, { httpGetHtml: html, httpGet: get });
  return { supplier, html, get, anySupplier: supplier as any };
}

beforeEach(() => {
  storageState.data = {};
  storageState.failReads = false;
  storageState.failWrites = false;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SupplierBaseSearchanise', () => {
  describe('extractAssignedJson', () => {
    const { anySupplier } = makeSupplier();

    it('extracts the object from a real-shaped page', () => {
      expect(anySupplier.extractAssignedJson(homepage())).toMatchObject({
        host: 'https://searchserverapi1.com',
        api_key: FRESH.apiKey,
      });
    });

    it('handles JSON-escaped slashes, as served by real storefronts', () => {
      const html =
        '<script>window.Searchanise = {"host":"https:\\/\\/searchserverapi1.com","api_key":"4p4M0R6q0N"};</script>';
      expect(anySupplier.extractAssignedJson(html)).toEqual({
        host: 'https://searchserverapi1.com',
        api_key: '4p4M0R6q0N',
      });
    });

    it.each([
      ['braces inside strings', '{"a":"}{","b":{"c":1}}', { a: '}{', b: { c: 1 } }],
      ['escaped quotes inside strings', '{"a":"say \\"}\\" now"}', { a: 'say "}" now' }],
    ])('is not confused by %s', (_label, literal, expected) => {
      expect(
        anySupplier.extractAssignedJson(`window.Searchanise = ${literal}; var x = {};`),
      ).toEqual(expected);
    });

    it('supports a custom variable name', () => {
      expect(anySupplier.extractAssignedJson('var cfg = {"a":1};', 'var cfg')).toEqual({ a: 1 });
    });

    it.each([
      ['no assignment', '<html>nothing here</html>'],
      ['an unterminated object', 'window.Searchanise = {"api_key":"4p4M0R6q0N"'],
      ['invalid JSON', 'window.Searchanise = {api_key: 1};'],
    ])('returns undefined for %s', (_label, text) => {
      expect(anySupplier.extractAssignedJson(text)).toBeUndefined();
    });
  });

  describe('isApiKeyRejected', () => {
    const { anySupplier } = makeSupplier();

    it.each([
      ['ENGINE_REMOVED', true],
      ['INVALID_API_KEY', true],
      ['  ENGINE_REMOVED\n', true],
      ['{"totalItems":12,"items":[]}', false],
      ['', false],
      [undefined, false],
      [null, false],
      [400, false],
      [`{"items":[{"title":"ENGINE_REMOVED"}],"pad":"${'x'.repeat(300)}"}`, false],
    ])('%j -> %s', (body, expected) => {
      expect(anySupplier.isApiKeyRejected(body)).toBe(expected);
    });
  });

  describe('retrieveCredentials', () => {
    it('reads the key and allow-listed host from the homepage', async () => {
      const { anySupplier, html } = makeSupplier();
      await expect(anySupplier.retrieveCredentials()).resolves.toEqual(FRESH);
      expect(html).toHaveBeenCalledWith({ path: '/' });
    });

    it.each([
      ['a bare hostname', 'searchserverapi.com', 'searchserverapi.com'],
      ['an unknown host', 'https://evil.example.com', 'searchserverapi.com'],
      ['a host with a path', 'https://searchserverapi1.com/getresults', 'searchserverapi1.com'],
    ])('resolves %s', async (_label, host, expected) => {
      const { anySupplier } = makeSupplier({ html: async () => homepage({ host }) });
      await expect(anySupplier.retrieveCredentials()).resolves.toEqual({
        apiKey: FRESH.apiKey,
        host: expected,
      });
    });

    it.each([
      ['no Searchanise object', async () => '<html></html>'],
      ['an object without a valid key', async () => homepage({ api_key: 'short' })],
      ['an empty page', async () => ''],
      [
        'a failed fetch',
        async () => {
          throw new TypeError('Invalid GET response');
        },
      ],
    ])('returns undefined for %s', async (_label, html) => {
      const { anySupplier } = makeSupplier({ html });
      await expect(anySupplier.retrieveCredentials()).resolves.toBeUndefined();
    });

    it('rethrows a search abort', async () => {
      const { anySupplier } = makeSupplier({
        html: async () => {
          throw new DOMException('aborted', 'AbortError');
        },
      });
      await expect(anySupplier.retrieveCredentials()).rejects.toThrow('aborted');
    });
  });

  describe('ensureCredentials', () => {
    it('uses the in-memory key without touching storage or the network', async () => {
      const { supplier, anySupplier, html } = makeSupplier();
      anySupplier.apiKey = FRESH.apiKey;
      await expect(anySupplier.ensureCredentials()).resolves.toBe(true);
      expect(html).not.toHaveBeenCalled();
      expect(cstorage.local.get).not.toHaveBeenCalled();
      expect(supplier).toBeDefined();
    });

    it('adopts stored credentials without scraping', async () => {
      storageState.data[STORAGE_KEY] = FRESH;
      const { anySupplier, html } = makeSupplier();
      await expect(anySupplier.ensureCredentials()).resolves.toBe(true);
      expect(anySupplier.apiKey).toBe(FRESH.apiKey);
      expect(anySupplier.apiHost).toBe(FRESH.host);
      expect(html).not.toHaveBeenCalled();
    });

    it('scrapes on a miss, then caches the result with no expiry', async () => {
      const { anySupplier, html } = makeSupplier();
      await expect(anySupplier.ensureCredentials()).resolves.toBe(true);
      expect(html).toHaveBeenCalledTimes(1);
      expect(anySupplier.apiKey).toBe(FRESH.apiKey);
      expect(anySupplier.apiHost).toBe(FRESH.host);
      expect(storageState.data[STORAGE_KEY]).toEqual(FRESH);

      // A second supplier instance (a later search) reuses the cached credentials.
      const next = makeSupplier();
      await expect(next.anySupplier.ensureCredentials()).resolves.toBe(true);
      expect(next.html).not.toHaveBeenCalled();
      expect(next.anySupplier.apiKey).toBe(FRESH.apiKey);
    });

    it.each([
      ['an unknown host', { apiKey: FRESH.apiKey, host: 'evil.example.com' }],
      ['a malformed key', { apiKey: 'nope', host: FRESH.host }],
      ['garbage', 'not-an-object'],
    ])('ignores a stored record with %s and scrapes again', async (_label, stored) => {
      storageState.data[STORAGE_KEY] = stored;
      const { anySupplier, html } = makeSupplier();
      await expect(anySupplier.ensureCredentials()).resolves.toBe(true);
      expect(html).toHaveBeenCalledTimes(1);
      expect(storageState.data[STORAGE_KEY]).toEqual(FRESH);
    });

    it('returns false and stores nothing when the scrape fails', async () => {
      const { anySupplier } = makeSupplier({ html: async () => '<html></html>' });
      await expect(anySupplier.ensureCredentials()).resolves.toBe(false);
      expect(anySupplier.apiKey).toBe('');
      expect(storageState.data[STORAGE_KEY]).toBeUndefined();
    });

    it('survives storage read and write failures', async () => {
      storageState.failReads = true;
      storageState.failWrites = true;
      const { anySupplier } = makeSupplier();
      await expect(anySupplier.ensureCredentials()).resolves.toBe(true);
      expect(anySupplier.apiKey).toBe(FRESH.apiKey);
    });
  });

  describe('queryProducts', () => {
    it('searches with a cached key and never scrapes', async () => {
      storageState.data[STORAGE_KEY] = FRESH;
      const { supplier, anySupplier, html, get } = makeSupplier();
      const results = await anySupplier.queryProducts('acetone');
      expect(results).toHaveLength(1);
      expect(html).not.toHaveBeenCalled();
      expect(get).toHaveBeenCalledTimes(1);
      expect(get.mock.calls[0][0]).toMatchObject({
        path: '/getresults',
        host: FRESH.host,
        params: { api_key: FRESH.apiKey },
      });
      expect(supplier).toBeDefined();
    });

    it('scrapes the key on the first search', async () => {
      const { anySupplier, html, get } = makeSupplier();
      await anySupplier.queryProducts('acetone');
      expect(html).toHaveBeenCalledTimes(1);
      expect(get.mock.calls[0][0]).toMatchObject({
        host: FRESH.host,
        params: { api_key: FRESH.apiKey },
      });
    });

    describe.each([
      ['a 200 ENGINE_REMOVED reply', () => reply('ENGINE_REMOVED')],
      [
        'a 400 INVALID_API_KEY reply',
        () => Promise.reject(new HttpError(400, 'Bad Request', 'INVALID_API_KEY')),
      ],
      [
        'a 400 ENGINE_REMOVED reply',
        () => Promise.reject(new HttpError(400, 'Bad Request', 'ENGINE_REMOVED')),
      ],
    ])('when Searchanise answers with %s', (_label, rejection) => {
      it('drops the dead key, re-scrapes once, and retries', async () => {
        storageState.data[STORAGE_KEY] = STALE;
        const get = vi
          .fn()
          .mockImplementationOnce(async () => rejection())
          .mockImplementationOnce(async () => reply(JSON.stringify(searchResults())));
        const { anySupplier, html } = makeSupplier({ get });

        const results = await anySupplier.queryProducts('acetone');

        expect(results).toHaveLength(1);
        expect(html).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledTimes(2);
        expect(get.mock.calls[0][0].params.api_key).toBe(STALE.apiKey);
        expect(get.mock.calls[1][0]).toMatchObject({
          host: FRESH.host,
          params: { api_key: FRESH.apiKey },
        });
        expect(storageState.data[STORAGE_KEY]).toEqual(FRESH);
      });

      it('gives up after one retry when the new key is rejected too', async () => {
        storageState.data[STORAGE_KEY] = STALE;
        const get = vi.fn(async () => rejection());
        const { anySupplier, html } = makeSupplier({ get });

        await expect(anySupplier.queryProducts('acetone')).resolves.toBeUndefined();

        expect(get).toHaveBeenCalledTimes(2);
        expect(html).toHaveBeenCalledTimes(1);
      });
    });

    it('does not rescrape for an unrelated failure', async () => {
      storageState.data[STORAGE_KEY] = FRESH;
      const get = vi.fn(async () => {
        throw new HttpError(500, 'Server Error', 'oops');
      });
      const { anySupplier, html } = makeSupplier({ get });

      await expect(anySupplier.queryProducts('acetone')).resolves.toBeUndefined();

      expect(get).toHaveBeenCalledTimes(1);
      expect(html).not.toHaveBeenCalled();
      expect(storageState.data[STORAGE_KEY]).toEqual(FRESH);
    });

    it('stops without a request when no key can be found', async () => {
      const { anySupplier, get } = makeSupplier({ html: async () => '<html></html>' });
      await expect(anySupplier.queryProducts('acetone')).resolves.toBeUndefined();
      expect(get).not.toHaveBeenCalled();
    });

    it('returns nothing for a body that is not JSON', async () => {
      storageState.data[STORAGE_KEY] = FRESH;
      const get = vi.fn(async () => reply('<html>maintenance</html>'));
      const { anySupplier } = makeSupplier({ get });
      await expect(anySupplier.queryProducts('acetone')).resolves.toBeUndefined();
      expect(get).toHaveBeenCalledTimes(1);
    });
  });

  describe('requiredHosts', () => {
    it('covers the storefront and every allow-listed Searchanise API host', () => {
      expect(SupplierLaballey.requiredHosts).toEqual([
        'https://www.laballey.com/*',
        'https://searchserverapi.com/*',
        'https://searchserverapi1.com/*',
      ]);
    });
  });

  describe('Laballey', () => {
    it('no longer hardcodes an api key', () => {
      const instance = new SupplierLaballey('acetone', 10, new AbortController());
      expect((instance as any).apiKey).toBe('');
    });
  });
});
