import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE } from '@/constants/common';

const sessionGet = vi.fn();
const sessionSet = vi.fn();

vi.mock('@/utils/storage', () => ({
  cstorage: {
    session: {
      get: (...args: unknown[]) => sessionGet(...args),
      set: (...args: unknown[]) => sessionSet(...args),
    },
  },
}));

const { recordError, getRecentErrors, formatErrorChain, recordException } = await import(
  '@/helpers/errorBuffer'
);

describe('errorBuffer', () => {
  let store: Record<string, unknown>;

  beforeEach(() => {
    store = {};
    sessionGet.mockReset();
    sessionSet.mockReset();
    sessionGet.mockImplementation(async (key: string) => ({ [key]: store[key] }));
    sessionSet.mockImplementation(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    });
  });

  it('returns an empty list when nothing has been recorded', async () => {
    await expect(getRecentErrors()).resolves.toEqual([]);
  });

  it('returns an empty list when the stored value is malformed', async () => {
    store[CACHE.ERROR_RING_BUFFER] = 'not-an-array';
    await expect(getRecentErrors()).resolves.toEqual([]);
  });

  it('appends an entry and stamps it with a timestamp', async () => {
    await recordError({ source: 'react', message: 'render failed' });
    const errors = await getRecentErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ source: 'react', message: 'render failed' });
    expect(typeof errors[0].ts).toBe('number');
  });

  it('keeps only the 20 most recent entries', async () => {
    for (let i = 0; i < 25; i++) {
      await recordError({ source: 'window', message: String(i) });
    }
    const errors = await getRecentErrors();
    expect(errors).toHaveLength(20);
    expect(errors.map((e) => e.message)).toEqual(
      Array.from({ length: 20 }, (_, i) => String(i + 5)),
    );
  });

  it('never throws when the underlying write fails', async () => {
    sessionSet.mockRejectedValue(new Error('storage unavailable'));
    await expect(recordError({ source: 'window', message: 'boom' })).resolves.toBeUndefined();
  });
});

describe('formatErrorChain', () => {
  it('folds a nested cause chain into the stack', () => {
    const error = new Error('outer', { cause: new Error('inner', { cause: 'root string' }) });
    const rendered = formatErrorChain(error);
    expect(rendered).toContain('outer');
    expect(rendered).toContain('Caused by:');
    expect(rendered).toContain('inner');
    expect(rendered).toContain('root string');
  });

  it('returns just the stack when there is no cause', () => {
    const rendered = formatErrorChain(new Error('lonely'));
    expect(rendered).toContain('lonely');
    expect(rendered).not.toContain('Caused by:');
  });

  it('expands AggregateError sub-errors, including non-Error reasons', () => {
    const aggregate = new AggregateError([new Error('sub one'), 'plain reason'], 'many failed');
    const rendered = formatErrorChain(aggregate);
    expect(rendered).toContain('many failed');
    expect(rendered).toContain('sub one');
    expect(rendered).toContain('plain reason');
  });
});

describe('recordException', () => {
  beforeEach(() => {
    const store: Record<string, unknown> = {};
    sessionGet.mockReset();
    sessionSet.mockReset();
    sessionGet.mockImplementation(async (key: string) => ({ [key]: store[key] }));
    sessionSet.mockImplementation(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    });
  });

  it('stores the message and a cause-folded stack under the given source', async () => {
    await recordException(new Error('outer', { cause: new Error('inner') }), 'search');
    const errors = await getRecentErrors();
    const latest = errors[errors.length - 1];
    expect(latest.source).toBe('search');
    expect(latest.message).toBe('outer');
    expect(latest.stack).toContain('inner');
  });
});
