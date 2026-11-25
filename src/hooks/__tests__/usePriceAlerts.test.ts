import type { PriceAlert } from '@/helpers/priceAlerts';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';
import type { ChangedListener } from '@/utils/storage';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadPriceAlerts: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@/helpers/priceAlerts', () => ({
  loadPriceAlerts: mocks.loadPriceAlerts,
  isPriceAlertKey: (key: string) => key.startsWith('price_alert:'),
}));

vi.mock('@/utils/storage', () => ({
  cstorage: { onChanged: { addListener: mocks.addListener, removeListener: mocks.removeListener } },
}));

vi.mock('@/utils/Logger', () => ({
  Logger: class {
    warn = mocks.warn;
  },
}));

/** Builds a minimal alert for the hook to return. */
const makeAlert = (id: string): PriceAlert =>
  ({ id, title: id, supplier: 'S', failures: 0, lastPrices: {}, createdAt: 1 }) as PriceAlert;

/** The listener the hook registered on storage. */
const listener = (): ChangedListener => mocks.addListener.mock.calls[0][0];

describe('usePriceAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadPriceAlerts.mockResolvedValue([makeAlert('a')]);
  });

  it('starts empty and loads the alerts', async () => {
    const { result } = renderHook(() => usePriceAlerts());
    expect(result.current).toEqual([]);
    await waitFor(() => expect(result.current).toEqual([makeAlert('a')]));
  });

  it('reloads when a price alert key changes in local storage', async () => {
    const { result } = renderHook(() => usePriceAlerts());
    await waitFor(() => expect(result.current).toHaveLength(1));

    mocks.loadPriceAlerts.mockResolvedValue([makeAlert('a'), makeAlert('b')]);
    act(() => listener()({ 'price_alert:b': {} }, 'local'));

    await waitFor(() => expect(result.current).toHaveLength(2));
  });

  it('ignores other keys and other storage areas', async () => {
    const { result } = renderHook(() => usePriceAlerts());
    await waitFor(() => expect(result.current).toHaveLength(1));
    mocks.loadPriceAlerts.mockClear();

    act(() => listener()({ user_settings: {} }, 'local'));
    act(() => listener()({ 'price_alert:a': {} }, 'session'));

    expect(mocks.loadPriceAlerts).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => usePriceAlerts());
    const registered = listener();
    unmount();
    expect(mocks.removeListener).toHaveBeenCalledWith(registered);
  });

  it('swallows a load failure and keeps the list empty', async () => {
    mocks.loadPriceAlerts.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => usePriceAlerts());

    await waitFor(() => expect(mocks.warn).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });
});
