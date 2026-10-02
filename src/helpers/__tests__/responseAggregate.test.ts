import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addCapturedResponse,
  clear,
  count,
  downloadAsZip,
  initConsoleApi,
  list,
} from '@/helpers/responseAggregate';
import { getCachableResponse } from '@/helpers/request';

vi.mock('@/helpers/request', () => ({ getCachableResponse: vi.fn() }));

/** Makes `getCachableResponse` resolve to a cache entry stored at `file`. */
function stubCachable(file: string, data: { contentType?: string; content?: string }): void {
  vi.mocked(getCachableResponse).mockResolvedValue({
    hash: { file },
    data,
  } as unknown as Awaited<ReturnType<typeof getCachableResponse>>);
}

describe('responseAggregate', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'table').mockImplementation(() => {});
    clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('capture', () => {
    it('stores entries keyed by cache file and de-dupes repeats', async () => {
      stubCachable('a.com/1.json', { contentType: 'text/html', content: '<p/>' });
      const request = new Request('https://a.com/x?t=1');
      await addCapturedResponse(request, new Response('x'));
      await addCapturedResponse(request, new Response('x'));

      expect(count()).toBe(1);
      expect(list()).toEqual(['a.com/1.json']);
    });

    it('falls back to placeholder content when the cache entry is empty', async () => {
      stubCachable('a.com/2.json', {});
      await addCapturedResponse(new Request('https://a.com/'), new Response(''));

      expect(count()).toBe(1);
    });

    it('logs and keeps going when capture fails', async () => {
      vi.mocked(getCachableResponse).mockRejectedValue(new Error('bad'));
      await addCapturedResponse(new Request('https://a.com/'), new Response(''));

      expect(count()).toBe(0);
      expect(console.error).toHaveBeenCalled();
    });

    it('clear empties the store', async () => {
      stubCachable('a.com/1.json', {});
      await addCapturedResponse(new Request('https://a.com/'), new Response(''));
      clear();

      expect(count()).toBe(0);
    });
  });

  describe('downloadAsZip', () => {
    it('warns and does nothing when empty', async () => {
      const createObjectURL = vi.fn();
      vi.stubGlobal('URL', Object.assign(URL, { createObjectURL }));

      await downloadAsZip();

      expect(console.warn).toHaveBeenCalled();
      expect(createObjectURL).not.toHaveBeenCalled();
    });

    it('zips captured entries and triggers a download', async () => {
      stubCachable('a.com/1.json', { contentType: 'text/html', content: 'hi' });
      await addCapturedResponse(new Request('https://a.com/'), new Response(''));

      const createObjectURL = vi.fn(() => 'blob:x');
      const revokeObjectURL = vi.fn();
      Object.assign(URL, { createObjectURL, revokeObjectURL });
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      await downloadAsZip();

      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(click).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    });
  });

  describe('initConsoleApi', () => {
    it('does nothing outside aggregate mode', () => {
      vi.stubGlobal('__RESPONSE_AGGREGATE__', false);
      Reflect.deleteProperty(window, '__responseAggregate');

      initConsoleApi();

      expect('__responseAggregate' in window).toBe(false);
    });

    it('exposes the console API in aggregate mode', async () => {
      vi.stubGlobal('__RESPONSE_AGGREGATE__', true);
      stubCachable('a.com/1.json', {});
      await addCapturedResponse(new Request('https://a.com/'), new Response(''));

      initConsoleApi();
      const api = Reflect.get(window, '__responseAggregate');

      expect(api.count).toBe(1);
      expect(api.list()).toEqual(['a.com/1.json']);
      api.clear();
      expect(api.count).toBe(0);
    });
  });
});
