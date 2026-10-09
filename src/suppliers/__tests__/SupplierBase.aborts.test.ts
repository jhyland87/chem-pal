// ProductBuilder must be imported before SupplierBase/SupplierLabStuff (module-init cycle).
import '@/utils/ProductBuilder';
import { HttpError, isExpectedAbort } from '@/helpers/exceptions';
import { Logger } from '@/utils/Logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierLabStuff } from '../SupplierLabStuff';

/** The protected request methods under test. */
type Internals = {
  fetch: (url: string, init: unknown) => Promise<unknown>;
  httpGet: (options: { path: string }) => Promise<unknown>;
  httpGetHtml: (options: { path: string }) => Promise<unknown>;
  httpGetJson: (options: { path: string }) => Promise<unknown>;
};

/** A supplier with its own controller, plus the internals the tests drive. */
function makeSupplier() {
  const controller = new AbortController();
  const supplier = new SupplierLabStuff('acetone', 5, controller);
  return { controller, internals: supplier as unknown as Internals };
}

describe('SupplierBase abort handling', () => {
  let debug: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // jsdom's AbortSignal isn't the one Node's Request accepts, and httpGet only reads `.url`
    // from the request it builds, so a minimal stand-in keeps these tests off the network layer.
    vi.stubGlobal(
      'Request',
      class FakeRequest {
        constructor(
          public readonly url: string,
          public readonly init?: unknown,
        ) {}
      },
    );
    debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('httpGet', () => {
    it.each([
      ['the time budget elapsing', 'time_budget_exceeded'],
      ['the user stopping the search', 'user_aborted'],
      ['an AbortError', new DOMException('stop', 'AbortError')],
    ])('logs %s at debug and not as an error', async (_label, thrown) => {
      const { internals } = makeSupplier();
      vi.spyOn(internals, 'fetch').mockRejectedValue(thrown);

      await expect(internals.httpGet({ path: '/x' })).resolves.toBeUndefined();

      expect(debug).toHaveBeenCalledWith('Request was aborted', expect.any(Object));
      expect(error).not.toHaveBeenCalled();
    });

    it('still logs a real failure as an error, with the cause in the message and no signal', async () => {
      const { internals } = makeSupplier();
      vi.spyOn(internals, 'fetch').mockRejectedValue(new TypeError('socket closed'));

      await internals.httpGet({ path: '/x' });

      expect(error).toHaveBeenCalledOnce();
      const [message, details] = error.mock.calls[0];
      expect(message).toBe('Error received during fetch: socket closed');
      expect(details).toEqual({ error: expect.any(TypeError) });
    });

    it('skips the request entirely once the search has been aborted', async () => {
      const { controller, internals } = makeSupplier();
      const fetchSpy = vi.spyOn(internals, 'fetch');
      controller.abort('user_aborted');

      await expect(internals.httpGet({ path: '/x' })).resolves.toBeUndefined();

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(debug).toHaveBeenCalledWith(
        'Request was aborted before fetch',
        expect.objectContaining({ reason: 'user_aborted' }),
      );
    });
  });

  describe('rate limiting', () => {
    it('logs a 429 from a supplier as a warning, not an error', async () => {
      const { internals } = makeSupplier();
      vi.spyOn(internals, 'fetch').mockRejectedValue(new HttpError(429, 'Too Many Requests'));

      await expect(internals.httpGet({ path: '/x' })).resolves.toBeUndefined();

      expect(warn).toHaveBeenCalledWith(
        'Rate limited during fetch: HTTP Error: 429 Too Many Requests',
        { error: expect.any(HttpError) },
      );
      expect(error).not.toHaveBeenCalled();
    });

    it('still logs other HTTP failures, such as a 403, as errors', async () => {
      const { internals } = makeSupplier();
      vi.spyOn(internals, 'fetch').mockRejectedValue(new HttpError(403, 'Forbidden'));

      await internals.httpGet({ path: '/x' });

      expect(error).toHaveBeenCalledWith(
        'Error received during fetch: HTTP Error: 403 Forbidden',
        expect.any(Object),
      );
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('httpGetHtml', () => {
    it('reports an aborted search as an AbortError, not a malformed response', async () => {
      const { controller, internals } = makeSupplier();
      vi.spyOn(internals, 'httpGet').mockResolvedValue(undefined);
      controller.abort('time_budget_exceeded');

      const failure = await internals
        .httpGetHtml({ path: '/x' })
        .catch((caught: unknown) => caught);

      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).name).toBe('AbortError');
      expect((failure as Error).message).toContain('time_budget_exceeded');
      expect(isExpectedAbort(failure)).toBe(true);
    });

    it('still reports a missing response as a TypeError when nothing was aborted', async () => {
      const { internals } = makeSupplier();
      vi.spyOn(internals, 'httpGet').mockResolvedValue(undefined);

      await expect(internals.httpGetHtml({ path: '/x' })).rejects.toThrow(
        new TypeError('httpGetHtml| Invalid GET response: undefined'),
      );
    });
  });

  describe('httpGetJson', () => {
    it('logs a missing response at debug when the search was aborted', async () => {
      const { controller, internals } = makeSupplier();
      vi.spyOn(internals, 'httpGet').mockResolvedValue(undefined);
      controller.abort('user_aborted');

      await expect(internals.httpGetJson({ path: '/x' })).resolves.toBeUndefined();

      expect(debug).toHaveBeenCalledWith(
        'No JSON response because the search was aborted',
        expect.any(Object),
      );
      expect(error).not.toHaveBeenCalled();
    });

    it('logs a missing response at debug when the request failed, since httpGet already reported it', async () => {
      const { internals } = makeSupplier();
      vi.spyOn(internals, 'httpGet').mockResolvedValue(undefined);

      await expect(internals.httpGetJson({ path: '/x' })).resolves.toBeUndefined();

      expect(debug).toHaveBeenCalledWith(
        'No JSON response because the request failed',
        expect.any(Object),
      );
      expect(error).not.toHaveBeenCalled();
    });

    it('still logs a response that is not JSON as an error', async () => {
      const { internals } = makeSupplier();
      vi.spyOn(internals, 'httpGet').mockResolvedValue(
        new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } }),
      );

      await expect(internals.httpGetJson({ path: '/x' })).resolves.toBeUndefined();

      expect(error).toHaveBeenCalledWith('Invalid HTTP GET JSON response', expect.any(Object));
    });
  });
});
