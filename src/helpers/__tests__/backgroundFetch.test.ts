import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backgroundFetch } from '@/helpers/backgroundFetch';

const sendMessage = vi.fn();
const originalChrome = globalThis.chrome;

const OK_REPLY = {
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: { 'content-type': 'application/json' },
  body: '{"a":1}',
};

describe('backgroundFetch', () => {
  beforeEach(() => {
    sendMessage.mockReset().mockResolvedValue(OK_REPLY);
    globalThis.chrome = {
      ...originalChrome,
      runtime: { sendMessage },
    } as unknown as typeof chrome;
  });

  afterEach(() => {
    globalThis.chrome = originalChrome;
  });

  it('rebuilds a Response from the worker reply', async () => {
    const response = await backgroundFetch('https://example.com/');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toEqual({ a: 1 });
  });

  it('sends an undefined init when none is given', async () => {
    await backgroundFetch('https://example.com/');

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'BACKGROUND_FETCH',
      url: 'https://example.com/',
      init: undefined,
    });
  });

  it.each([
    ['plain object', { 'x-a': '1' }],
    ['Headers', new Headers({ 'x-a': '1' })],
    ['entry array', [['x-a', '1']] as Array<[string, string]>],
  ])('flattens %s headers into a record', async (_label, headers) => {
    await backgroundFetch('https://example.com/', { method: 'POST', body: 'q', headers });

    expect(sendMessage.mock.calls[0][0].init).toEqual({
      method: 'POST',
      body: 'q',
      headers: { 'x-a': '1' },
    });
  });

  it('leaves headers undefined when init omits them', async () => {
    await backgroundFetch('https://example.com/', { method: 'GET' });

    expect(sendMessage.mock.calls[0][0].init.headers).toBeUndefined();
  });

  it.each([
    [{ error: 'boom' }, 'backgroundFetch| boom'],
    [undefined, 'backgroundFetch| Unknown background fetch failure'],
    [{ unexpected: true }, 'backgroundFetch| Unknown background fetch failure'],
  ])('throws on reply %j', async (reply, message) => {
    sendMessage.mockResolvedValue(reply);

    await expect(backgroundFetch('https://example.com/')).rejects.toThrow(message);
  });
});
