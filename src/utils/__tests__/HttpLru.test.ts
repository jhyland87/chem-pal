import type { FetchDecoratorResponse } from '@/helpers/fetch';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storageMock = {
  local: {
    get: vi.fn(async (_keys: string[]) => ({}) as Record<string, unknown>),
    set: vi.fn(async (_items: Record<string, unknown>) => {}),
  },
};

vi.mock('@/utils/storage', () => ({ cstorage: storageMock }));

const makeResponse = (id: string): FetchDecoratorResponse =>
  ({ data: { id }, requestHash: id }) as unknown as FetchDecoratorResponse;

// HttpLru is a singleton (static #instance). Re-import a fresh module per test
// so getInstance() rebuilds state instead of returning a stale instance.
const freshHttpLru = async () => {
  vi.resetModules();
  const mod = await import('@/utils/HttpLru');
  return mod.HttpLru;
};

describe('HttpLru', () => {
  beforeEach(() => {
    storageMock.local.get.mockReset();
    storageMock.local.get.mockResolvedValue({});
    storageMock.local.set.mockReset();
    storageMock.local.set.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('creates a fresh instance when storage is empty', async () => {
      const HttpLru = await freshHttpLru();
      const cache = await HttpLru.getInstance();
      expect(cache).toBeInstanceOf(HttpLru);
      expect(await cache.get('missing')).toBeNull();
    });

    it('returns the same singleton on subsequent calls', async () => {
      const HttpLru = await freshHttpLru();
      const first = await HttpLru.getInstance();
      const second = await HttpLru.getInstance();
      expect(first).toBe(second);
      // Storage is only read on first construction.
      expect(storageMock.local.get).toHaveBeenCalledTimes(1);
    });

    it('restores persisted state from storage', async () => {
      const node = { key: 'a', value: makeResponse('a'), prev: null, next: null };
      storageMock.local.get.mockResolvedValue({
        httplru: { cache: { a: node }, head: node, tail: node },
      });
      const HttpLru = await freshHttpLru();
      const cache = await HttpLru.getInstance();
      const restored = await cache.get('a');
      expect(restored).toEqual(node.value);
    });
  });

  describe('get / put', () => {
    it('returns null for a cache miss', async () => {
      const HttpLru = await freshHttpLru();
      const cache = await HttpLru.getInstance();
      expect(await cache.get('nope')).toBeNull();
    });

    it('stores and retrieves a value', async () => {
      const HttpLru = await freshHttpLru();
      const cache = await HttpLru.getInstance();
      const value = makeResponse('x');
      await cache.put('x', value);
      expect(await cache.get('x')).toEqual(value);
    });

    it('persists to storage on put', async () => {
      const HttpLru = await freshHttpLru();
      const cache = await HttpLru.getInstance();
      await cache.put('x', makeResponse('x'));
      expect(storageMock.local.set).toHaveBeenCalled();
      const [payload] = storageMock.local.set.mock.calls.at(-1)!;
      expect(payload).toHaveProperty('httplru');
    });

    it('updates the value when putting an existing key', async () => {
      const HttpLru = await freshHttpLru();
      const cache = await HttpLru.getInstance();
      await cache.put('x', makeResponse('v1'));
      await cache.put('x', makeResponse('v2'));
      expect(await cache.get('x')).toEqual(makeResponse('v2'));
    });
  });

  describe('hash convenience wrappers', () => {
    it('putByHash then getByHash round-trips', async () => {
      const HttpLru = await freshHttpLru();
      const cache = await HttpLru.getInstance();
      const value = makeResponse('h');
      await cache.putByHash('hash1', value);
      expect(await cache.getByHash('hash1')).toEqual(value);
    });

    it('getByHash returns null on a miss', async () => {
      const HttpLru = await freshHttpLru();
      const cache = await HttpLru.getInstance();
      expect(await cache.getByHash('absent')).toBeNull();
    });
  });

  describe('eviction and LRU ordering', () => {
    it('evicts the least recently used entry when capacity is exceeded', async () => {
      const HttpLru = await freshHttpLru();
      const cache = await HttpLru.getInstance(2);
      await cache.put('a', makeResponse('a'));
      await cache.put('b', makeResponse('b'));
      // Access "a" so "b" becomes least recently used.
      await cache.get('a');
      await cache.put('c', makeResponse('c'));

      expect(await cache.get('b')).toBeNull();
      expect(await cache.get('a')).toEqual(makeResponse('a'));
      expect(await cache.get('c')).toEqual(makeResponse('c'));
    });

    it('evicts the tail when nothing has been re-accessed', async () => {
      const HttpLru = await freshHttpLru();
      const cache = await HttpLru.getInstance(2);
      await cache.put('a', makeResponse('a'));
      await cache.put('b', makeResponse('b'));
      await cache.put('c', makeResponse('c'));
      expect(await cache.get('a')).toBeNull();
      expect(await cache.get('b')).toEqual(makeResponse('b'));
      expect(await cache.get('c')).toEqual(makeResponse('c'));
    });

    it('moving the head node is a no-op that keeps it retrievable', async () => {
      const HttpLru = await freshHttpLru();
      const cache = await HttpLru.getInstance(3);
      await cache.put('a', makeResponse('a'));
      // "a" is currently the head; getting it exercises the head short-circuit.
      expect(await cache.get('a')).toEqual(makeResponse('a'));
      expect(await cache.get('a')).toEqual(makeResponse('a'));
    });

    it('promotes a middle node to the head on access', async () => {
      const HttpLru = await freshHttpLru();
      const cache = await HttpLru.getInstance(3);
      await cache.put('a', makeResponse('a'));
      await cache.put('b', makeResponse('b'));
      await cache.put('c', makeResponse('c'));
      // "b" is in the middle; accessing it promotes it to head.
      expect(await cache.get('b')).toEqual(makeResponse('b'));
      // Now add another with capacity 3 to force eviction of the LRU ("a").
      await cache.put('d', makeResponse('d'));
      expect(await cache.get('a')).toBeNull();
      expect(await cache.get('b')).toEqual(makeResponse('b'));
    });
  });
});
