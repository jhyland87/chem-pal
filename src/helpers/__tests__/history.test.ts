import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSearchHistory = vi.fn();
const addSearchHistoryEntry = vi.fn();

vi.mock('@/utils/idbCache', () => ({
  getSearchHistory: (...args: unknown[]) => getSearchHistory(...args),
  addSearchHistoryEntry: (...args: unknown[]) => addSearchHistoryEntry(...args),
}));

const { getHistory, addHistory } = await import('@/helpers/history');

describe('getHistory', () => {
  beforeEach(() => {
    getSearchHistory.mockReset();
    addSearchHistoryEntry.mockReset();
  });

  it('returns whatever getSearchHistory yields', async () => {
    const entries = [{ type: 'search', query: 'salt', resultCount: 3, timestamp: 1 }];
    getSearchHistory.mockResolvedValue(entries);
    await expect(getHistory()).resolves.toBe(entries);
    expect(getSearchHistory).toHaveBeenCalledTimes(1);
  });
});

describe('addHistory', () => {
  beforeEach(() => {
    getSearchHistory.mockReset();
    addSearchHistoryEntry.mockReset();
    addSearchHistoryEntry.mockResolvedValue(undefined);
  });

  it('no-ops on a falsy entry', async () => {
    await addHistory(undefined as unknown as HistoryEntry);
    expect(addSearchHistoryEntry).not.toHaveBeenCalled();
  });

  it('stamps a timestamp and persists a search entry', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(123456);
    const entry: HistoryEntry = { type: 'search', query: 'salt', resultCount: 2 } as HistoryEntry;

    await addHistory(entry);

    expect(addSearchHistoryEntry).toHaveBeenCalledTimes(1);
    const passed = addSearchHistoryEntry.mock.calls[0][0] as SearchHistoryEntry;
    expect(passed.timestamp).toBe(123456);
    expect(passed.query).toBe('salt');
    vi.restoreAllMocks();
  });

  it('does not persist non-search entries (e.g. product)', async () => {
    const entry = { type: 'product', data: { title: 'x' } } as unknown as HistoryEntry;
    await addHistory(entry);
    expect(addSearchHistoryEntry).not.toHaveBeenCalled();
  });
});
