import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sessionSet = vi.fn();

vi.mock('@/utils/storage', () => ({
  cstorage: {
    session: {
      get: async (key: string) => ({ [key]: undefined }),
      set: (...args: unknown[]) => sessionSet(...args),
    },
  },
}));

type Handler = (event: unknown) => void;

describe('installErrorCapture logging', () => {
  let handlers: Record<string, Handler>;
  let fatal: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;
  let addListener: ReturnType<typeof vi.spyOn>;

  // The module keeps an "already installed" flag, so load a fresh copy per test and capture the
  // listeners it registers instead of attaching real ones to the shared jsdom window.
  async function install() {
    vi.resetModules();
    const { Logger } = await import('@/utils/Logger');
    fatal = vi.spyOn(Logger.prototype, 'fatal').mockImplementation(() => undefined);
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { installErrorCapture } = await import('@/helpers/errorBuffer');
    installErrorCapture();
    installErrorCapture();
  }

  beforeEach(() => {
    handlers = {};
    sessionSet.mockReset();
    addListener = vi.spyOn(self, 'addEventListener').mockImplementation(((
      type: string,
      handler: Handler,
    ) => {
      handlers[type] = handler;
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers the listeners only once however often it is called', async () => {
    await install();

    expect(addListener).toHaveBeenCalledTimes(2);
  });

  it('logs an uncaught exception as fatal, with where it happened', async () => {
    await install();
    const failure = new TypeError('x is not a function');
    handlers.error({ error: failure, message: 'ignored', filename: 'app.js', lineno: 7, colno: 3 });

    expect(fatal).toHaveBeenCalledWith('Uncaught exception: x is not a function', {
      error: failure,
      filename: 'app.js',
      lineno: 7,
      colno: 3,
    });
  });

  it('falls back to the event message when the browser gives no Error object', async () => {
    await install();
    handlers.error({ error: null, message: 'Script error.', filename: '', lineno: 0, colno: 0 });

    expect(fatal).toHaveBeenCalledWith(
      'Uncaught exception: Script error.',
      expect.objectContaining({ error: null }),
    );
  });

  it('logs an unhandled promise rejection as an error, not fatal', async () => {
    await install();
    const reason = new Error('request exploded');
    handlers.unhandledrejection({ reason });

    expect(error).toHaveBeenCalledWith('Unhandled promise rejection: request exploded', {
      error: reason,
    });
    expect(fatal).not.toHaveBeenCalled();
  });

  it.each([
    ['the user stopping a search', 'user_aborted'],
    ['the time budget elapsing', 'time_budget_exceeded'],
    ['an AbortError', new DOMException('stop', 'AbortError')],
  ])('does not log a rejection caused by %s', async (_label, reason) => {
    await install();
    handlers.unhandledrejection({ reason });

    expect(error).not.toHaveBeenCalled();
  });

  it('still records every captured exception in the buffer', async () => {
    await install();
    handlers.error({ error: new Error('a'), message: 'a', filename: '', lineno: 0, colno: 0 });
    handlers.unhandledrejection({ reason: 'user_aborted' });
    await vi.waitFor(() => expect(sessionSet).toHaveBeenCalledTimes(2));
  });
});
