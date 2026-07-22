import { CACHE } from '@/constants/common';
import { useUpdateAvailable } from '@/hooks/useUpdateAvailable';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const DAY_MS = 24 * 60 * 60 * 1000;
const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

let store: Record<string, unknown> = {};
let changeListeners: Array<(changes: Record<string, unknown>, area: string) => void> = [];

/**
 * Installs a chrome stub backed by an in-memory object. The shared
 * chromeStorageMock can't be used here: its `set` returns a promise that never
 * resolves, so every `await cstorage.local.set(...)` would hang.
 * @param manifest - Runtime manifest, which decides the detected install source.
 */
function setupChrome(manifest: Record<string, unknown> = {}) {
  const globalWithChrome = globalThis as unknown as { chrome: Record<string, unknown> };
  globalWithChrome.chrome = {
    ...globalWithChrome.chrome,
    runtime: { getManifest: () => manifest, reload: vi.fn() },
    tabs: { create: vi.fn() },
    storage: {
      local: {
        get: (keys: string[]) =>
          Promise.resolve(Object.fromEntries(keys.map((key) => [key, store[key]]))),
        set: (items: Record<string, unknown>) => {
          Object.assign(store, items);
          return Promise.resolve();
        },
        remove: () => Promise.resolve(),
      },
      onChanged: {
        addListener: (listener: (c: Record<string, unknown>, a: string) => void) => {
          changeListeners.push(listener);
        },
        removeListener: (listener: (c: Record<string, unknown>, a: string) => void) => {
          changeListeners = changeListeners.filter((entry) => entry !== listener);
        },
      },
    },
  };
}

/** Makes GitHub release requests resolve with a release at `tag`. */
function mockRelease(tag: string, body?: string) {
  fetchMock.mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          tag_name: tag,
          html_url: `https://example.com/${tag}`,
          draft: false,
          prerelease: false,
          body: body ?? null,
        }),
    }),
  );
}

describe('useUpdateAvailable', () => {
  beforeEach(() => {
    store = {};
    changeListeners = [];
    fetchMock.mockReset();
    setupChrome();
  });

  describe('manual installs', () => {
    it('polls GitHub and surfaces a newer release', async () => {
      mockRelease('v99.0.0');
      const { result } = renderHook(() => useUpdateAvailable());

      await waitFor(() => expect(result.current.notice).toBeDefined());
      expect(result.current.notice).toEqual({
        version: '99.0.0',
        source: 'manual',
        releaseUrl: 'https://example.com/v99.0.0',
        notes: [],
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('stamps lastCheckedAt before the request resolves', async () => {
      let resolveFetch: (value: unknown) => void = () => {};
      fetchMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = resolve;
          }),
      );
      renderHook(() => useUpdateAvailable());

      // The throttle stamp must land even if the popup closes mid-flight.
      await waitFor(() => expect(store[CACHE.UPDATE_CHECK]).toBeDefined());
      expect(store[CACHE.UPDATE_CHECK]).toMatchObject({ lastCheckedAt: expect.any(Number) });
      act(() => resolveFetch({ ok: false, status: 403, json: () => Promise.resolve({}) }));
    });

    it('reuses the cached result inside the throttle window', async () => {
      store[CACHE.UPDATE_CHECK] = {
        lastCheckedAt: Date.now() - 1000,
        latestVersion: '99.0.0',
        releaseUrl: 'https://example.com/v99.0.0',
      };
      const { result } = renderHook(() => useUpdateAvailable());

      await waitFor(() => expect(result.current.notice).toBeDefined());
      expect(result.current.notice?.version).toBe('99.0.0');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('polls again once the throttle window has elapsed', async () => {
      store[CACHE.UPDATE_CHECK] = { lastCheckedAt: Date.now() - DAY_MS - 1000 };
      mockRelease('v99.0.0');
      const { result } = renderHook(() => useUpdateAvailable());

      await waitFor(() => expect(result.current.notice).toBeDefined());
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('stays quiet for a version the user already dismissed', async () => {
      store[CACHE.UPDATE_CHECK] = {
        lastCheckedAt: Date.now(),
        latestVersion: '99.0.0',
        releaseUrl: 'https://example.com/v99.0.0',
        dismissedVersion: '99.0.0',
      };
      const { result } = renderHook(() => useUpdateAvailable());

      await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
      expect(result.current.notice).toBeUndefined();
    });

    it('stays quiet when the cached version is not newer than the running build', async () => {
      store[CACHE.UPDATE_CHECK] = { lastCheckedAt: Date.now(), latestVersion: '0.0.1' };
      const { result } = renderHook(() => useUpdateAvailable());

      await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
      expect(result.current.notice).toBeUndefined();
    });

    it('records the dismissal and hides the notice', async () => {
      mockRelease('v99.0.0');
      const { result } = renderHook(() => useUpdateAvailable());
      await waitFor(() => expect(result.current.notice).toBeDefined());

      act(() => result.current.dismiss());

      expect(result.current.notice).toBeUndefined();
      await waitFor(() =>
        expect(store[CACHE.UPDATE_CHECK]).toMatchObject({ dismissedVersion: '99.0.0' }),
      );
    });

    it('opens the release page on applyUpdate', async () => {
      mockRelease('v99.0.0');
      const { result } = renderHook(() => useUpdateAvailable());
      await waitFor(() => expect(result.current.notice).toBeDefined());

      act(() => result.current.applyUpdate());

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://example.com/v99.0.0',
        active: true,
      });
    });

    it('issues a single request across concurrent mounts', async () => {
      mockRelease('v99.0.0');
      const first = renderHook(() => useUpdateAvailable());
      const second = renderHook(() => useUpdateAvailable());

      await waitFor(() => expect(first.result.current.notice).toBeDefined());
      await waitFor(() => expect(second.result.current.notice).toBeDefined());
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // Regression: StrictMode cancels the first effect run before its request
    // lands, so the surviving run has to observe the shared poll's result rather
    // than skip it — otherwise the snackbar never appears in development.
    it('still surfaces the notice when the first mount is cancelled mid-poll', async () => {
      mockRelease('v99.0.0');
      const cancelled = renderHook(() => useUpdateAvailable());
      cancelled.unmount();
      const survivor = renderHook(() => useUpdateAvailable());

      await waitFor(() => expect(survivor.result.current.notice?.version).toBe('99.0.0'));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('web store installs', () => {
    beforeEach(() => {
      setupChrome({ update_url: 'https://clients2.google.com/service/update2/crx' });
    });

    it('never polls GitHub', async () => {
      const { result } = renderHook(() => useUpdateAvailable());
      await waitFor(() => expect(result.current.notice).toBeUndefined());
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('surfaces a staged update recorded by the service worker', async () => {
      store[CACHE.UPDATE_PENDING] = { version: '9.9.9', detectedAt: Date.now() };
      const { result } = renderHook(() => useUpdateAvailable());

      await waitFor(() => expect(result.current.notice).toBeDefined());
      expect(result.current.notice).toMatchObject({ version: '9.9.9', source: 'webstore' });
    });

    it('looks up notes for the staged version and caches them', async () => {
      store[CACHE.UPDATE_PENDING] = { version: '9.9.9', detectedAt: Date.now() };
      mockRelease('v9.9.9', '### Fixed\n\n- A bug');
      const { result } = renderHook(() => useUpdateAvailable());

      await waitFor(() => expect(result.current.notice?.notes.length).toBe(1));
      expect(result.current.notice?.notes).toEqual([{ title: 'Fixed', items: ['A bug'] }]);
      expect(store[CACHE.UPDATE_CHECK]).toMatchObject({ notesVersion: '9.9.9' });
    });

    it('reuses cached notes without a second lookup', async () => {
      store[CACHE.UPDATE_PENDING] = { version: '9.9.9', detectedAt: Date.now() };
      store[CACHE.UPDATE_CHECK] = {
        notesVersion: '9.9.9',
        notes: [{ title: 'Fixed', items: ['A bug'] }],
        releaseUrl: 'https://example.com/v9.9.9',
      };
      const { result } = renderHook(() => useUpdateAvailable());

      await waitFor(() => expect(result.current.notice).toBeDefined());
      expect(result.current.notice?.notes).toHaveLength(1);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('still prompts when the notes lookup fails', async () => {
      store[CACHE.UPDATE_PENDING] = { version: '9.9.9', detectedAt: Date.now() };
      fetchMock.mockImplementation(() => Promise.reject(new Error('offline')));
      const { result } = renderHook(() => useUpdateAvailable());

      await waitFor(() => expect(result.current.notice).toBeDefined());
      expect(result.current.notice?.notes).toEqual([]);
    });

    it('picks up an update staged while the popup is already open', async () => {
      const { result } = renderHook(() => useUpdateAvailable());
      await waitFor(() => expect(changeListeners.length).toBeGreaterThan(0));

      act(() => {
        for (const listener of changeListeners) {
          listener({ [CACHE.UPDATE_PENDING]: { newValue: { version: '9.9.9' } } }, 'local');
        }
      });

      await waitFor(() => expect(result.current.notice?.version).toBe('9.9.9'));
    });

    it('reloads the extension on applyUpdate', async () => {
      store[CACHE.UPDATE_PENDING] = { version: '9.9.9', detectedAt: Date.now() };
      const { result } = renderHook(() => useUpdateAvailable());
      await waitFor(() => expect(result.current.notice).toBeDefined());

      act(() => result.current.applyUpdate());

      expect(chrome.runtime.reload).toHaveBeenCalled();
    });

    it('stays quiet for a staged version the user already dismissed', async () => {
      store[CACHE.UPDATE_CHECK] = { dismissedVersion: '9.9.9' };
      store[CACHE.UPDATE_PENDING] = { version: '9.9.9', detectedAt: Date.now() };
      const { result } = renderHook(() => useUpdateAvailable());

      await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
      expect(result.current.notice).toBeUndefined();
    });
  });
});
