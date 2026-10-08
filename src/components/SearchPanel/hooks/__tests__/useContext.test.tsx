import { AppContext } from '@/context';
import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  session: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
  local: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
  onChanged: { addListener: vi.fn() },
}));
vi.mock('@/utils/storage', () => ({ cstorage: storage }));

// The storage hooks hand `use()` a brand-new promise on every render, which under a real
// Suspense boundary never settles. So the promise is captured here (and `use` returns a
// placeholder), letting the tests assert what it resolves to. Context reads pass through.
const sink = vi.hoisted(() => ({ promise: undefined as Promise<unknown> | undefined }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    use: (resource: unknown) => {
      if (resource instanceof Promise) {
        sink.promise = resource;
        return undefined;
      }
      return actual.use(resource as never);
    },
  };
});

import {
  useAppContext,
  useChromeStorage,
  useChromeStorageEnhanced,
  useReactiveChromeStorage,
} from '../useContext';

const contextValue = {
  userSettings: { showHelp: true },
  setUserSettings: vi.fn(),
  searchResults: [],
  setSearchResults: vi.fn(),
  setDrawerTab: vi.fn(),
  toggleDrawer: vi.fn(),
  setSelectedSuppliers: vi.fn(),
  pendingSearchQuery: null,
  setPendingSearchQuery: vi.fn(),
  searchFilters: {},
  setSearchFilters: vi.fn(),
  setBookmarksFolderId: vi.fn(),
} as unknown as AppContextProps;

function providerWrapper({ children }: { children: ReactNode }) {
  return createElement(AppContext.Provider, { value: contextValue }, children);
}

describe('useAppContext (use() variant)', () => {
  it('returns the context value when rendered inside its provider', () => {
    const { result } = renderHook(() => useAppContext(), { wrapper: providerWrapper });
    expect(result.current).toBe(contextValue);
  });

  it('reads the default (undefined) when rendered outside any provider', () => {
    // AppContext defaults to undefined; use() reads that default without throwing.
    const { result } = renderHook(() => useAppContext());
    expect(result.current).toBeUndefined();
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  sink.promise = undefined;
  storage.session.get.mockResolvedValue({});
  storage.session.set.mockResolvedValue(undefined);
  storage.local.get.mockResolvedValue({});
  storage.local.set.mockResolvedValue(undefined);
  storage.session.remove.mockResolvedValue(undefined);
  storage.local.remove.mockResolvedValue(undefined);
});

/** The value the hook's `use()` promise resolved to. */
const resolved = () => sink.promise as Promise<unknown>;

describe('useChromeStorage', () => {
  it.each([
    ['the stored session value', { theme: 'dark' }, 'dark'],
    ['the default when nothing is stored', {}, 'light'],
  ])('resolves to %s', async (_label, stored, expected) => {
    storage.session.get.mockResolvedValue(stored);
    renderHook(() => useChromeStorage('theme', 'light'));

    expect(await resolved()).toBe(expected);
    expect(storage.session.get).toHaveBeenCalledWith(['theme']);
  });

  it('writes a new value to session storage', () => {
    const { result } = renderHook(() => useChromeStorage('theme', 'light'));

    result.current[1]('dark');

    expect(storage.session.set).toHaveBeenCalledWith({ theme: 'dark' });
  });
});

describe('useChromeStorageEnhanced', () => {
  const mount = (...args: Parameters<typeof useChromeStorageEnhanced<string>>) =>
    renderHook(() => useChromeStorageEnhanced(...args)).result;

  it.each([
    ['session', undefined, 'session'],
    ['session', { storage: 'session' as const }, 'session'],
    ['local', { storage: 'local' as const }, 'local'],
  ] as const)('reads from the %s area for options %j', async (_label, options, area) => {
    storage[area].get.mockResolvedValue({ key: 'stored' });
    mount('key', 'default', options);

    expect(await resolved()).toBe('stored');
    expect(storage[area].get).toHaveBeenCalledWith(['key']);
  });

  it('resolves to the default when the key is unset', async () => {
    mount('key', 'default');
    expect(await resolved()).toBe('default');
  });

  it('deserializes the stored value', async () => {
    storage.session.get.mockResolvedValue({ key: '{"a":1}' });
    mount('key', 'default', {
      serializer: { serialize: (v) => v, deserialize: (v) => `parsed:${v}` },
    });
    expect(await resolved()).toBe('parsed:{"a":1}');
  });

  it('resolves to the default when deserializing fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    storage.session.get.mockResolvedValue({ key: 'bad' });
    mount('key', 'default', {
      serializer: {
        serialize: (v) => v,
        deserialize: () => {
          throw new Error('nope');
        },
      },
    });

    expect(await resolved()).toBe('default');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('resolves to the default when storage cannot be read', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    storage.session.get.mockRejectedValue(new Error('denied'));
    mount('key', 'default');

    expect(await resolved()).toBe('default');
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('saves with and without a serializer', async () => {
    await mount('key', 'default').current.setValue('v1');
    expect(storage.session.set).toHaveBeenCalledWith({ key: 'v1' });

    await mount('key', 'default', {
      storage: 'local',
      serializer: { serialize: (v) => `ser:${v}`, deserialize: (v) => v },
    }).current.setValue('v2');
    expect(storage.local.set).toHaveBeenCalledWith({ key: 'ser:v2' });
  });

  it('removes the key', async () => {
    await mount('key', 'default', { storage: 'local' }).current.removeValue();
    expect(storage.local.remove).toHaveBeenCalledWith(['key']);
  });

  it.each([
    ['save', 'set'],
    ['remove', 'remove'],
  ] as const)('rethrows a failed %s', async (label, method) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    storage.session[method].mockRejectedValue(new Error('quota'));
    const { current } = mount('key', 'default');

    await expect(label === 'save' ? current.setValue('x') : current.removeValue()).rejects.toThrow(
      'quota',
    );
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('useReactiveChromeStorage', () => {
  it.each([
    ['the stored value', { key: 'stored' }, 'stored'],
    ['the default when nothing is stored', {}, 'default'],
  ])('resolves to %s and subscribes to changes', async (_label, stored, expected) => {
    storage.session.get.mockResolvedValue(stored);
    renderHook(() => useReactiveChromeStorage('key', 'default'));

    expect(await resolved()).toBe(expected);
    expect(storage.onChanged.addListener).toHaveBeenCalled();
  });

  it.each([
    ['a changed value', { newValue: 'changed' }, 'changed'],
    ['a removed value', { newValue: undefined }, 'default'],
  ])(
    'resolves to %s when the change lands before the initial load',
    async (_label, change, expected) => {
      storage.session.get.mockReturnValue(new Promise(() => undefined));
      renderHook(() => useReactiveChromeStorage('key', 'default'));

      const listener = storage.onChanged.addListener.mock.calls[0][0];
      listener({ other: { newValue: 'ignored' } });
      listener({ key: change });

      expect(await resolved()).toBe(expected);
    },
  );

  it('writes a new value to session storage', () => {
    const { result } = renderHook(() => useReactiveChromeStorage('key', 'default'));

    result.current[1]('next');

    expect(storage.session.set).toHaveBeenCalledWith({ key: 'next' });
  });
});
