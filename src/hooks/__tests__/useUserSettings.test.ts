import { CACHE } from '@/constants/common';
import { getCurrencyRate } from '@/helpers/currency';
import { setLocale } from '@/helpers/i18n';
import { useUserSettings } from '@/hooks/useUserSettings';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '@/../config.json';

type Listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;

const storage = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock('@/utils/storage', () => ({
  cstorage: {
    local: { get: storage.get, set: storage.set },
    onChanged: { addListener: storage.addListener, removeListener: storage.removeListener },
  },
}));
vi.mock('@/helpers/currency', () => ({ getCurrencyRate: vi.fn() }));
vi.mock('@/helpers/i18n', () => ({ setLocale: vi.fn() }));

/** Returns the `onChanged` listener the hook registered. */
function listener(): Listener {
  return storage.addListener.mock.calls[0][0];
}

/** Fires a `user_settings` change from `area`. */
function emitChange(newValue: unknown, area = 'local', key: string = CACHE.USER_SETTINGS): void {
  act(() => listener()({ [key]: { newValue } }, area));
}

describe('useUserSettings', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    storage.get.mockReset().mockResolvedValue({});
    storage.set.mockReset().mockResolvedValue(undefined);
    storage.addListener.mockReset();
    storage.removeListener.mockReset();
    vi.mocked(getCurrencyRate).mockReset().mockResolvedValue(1);
    vi.mocked(setLocale).mockReset();
  });

  it('starts from the shipped defaults', () => {
    const { result } = renderHook(() => useUserSettings());

    expect(result.current.userSettings).toMatchObject({ currency: 'USD', location: 'US' });
  });

  it('merges stored settings over the defaults', async () => {
    storage.get.mockResolvedValue({
      [CACHE.USER_SETTINGS]: { ...defaultSettings, currency: 'USD', location: 'DE' },
    });
    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => expect(result.current.userSettings.location).toBe('DE'));
  });

  it('ignores an invalid stored value', async () => {
    storage.get.mockResolvedValue({ [CACHE.USER_SETTINGS]: { currency: 42 } });
    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => expect(storage.get).toHaveBeenCalled());
    expect(result.current.userSettings.currency).toBe('USD');
  });

  it('logs when loading fails', async () => {
    storage.get.mockRejectedValue(new Error('boom'));
    renderHook(() => useUserSettings());

    await waitFor(() => expect(console.error).toHaveBeenCalled());
  });

  describe('setUserSettings', () => {
    it('derives country from location, updates state and persists', async () => {
      const { result } = renderHook(() => useUserSettings());

      act(() => result.current.setUserSettings({ ...result.current.userSettings, location: 'DE' }));

      expect(result.current.userSettings.country).toBe('Germany');
      await waitFor(() =>
        expect(storage.set).toHaveBeenCalledWith({
          [CACHE.USER_SETTINGS]: expect.objectContaining({ location: 'DE', country: 'Germany' }),
        }),
      );
    });

    it('logs when saving fails', async () => {
      storage.set.mockRejectedValue(new Error('full'));
      const { result } = renderHook(() => useUserSettings());

      act(() => result.current.setUserSettings(result.current.userSettings));

      await waitFor(() => expect(console.error).toHaveBeenCalled());
    });
  });

  describe('language', () => {
    it('sets the base locale from a full locale code', async () => {
      renderHook(() => useUserSettings());

      await waitFor(() => expect(setLocale).toHaveBeenCalledWith('en'));
    });

    it('skips setLocale when language is unset', async () => {
      const { result } = renderHook(() => useUserSettings());
      vi.mocked(setLocale).mockClear();

      act(() => result.current.setUserSettings({ ...result.current.userSettings, language: '' }));

      expect(setLocale).not.toHaveBeenCalled();
    });
  });

  describe('currency rate', () => {
    it('fetches and persists a changed rate', async () => {
      vi.mocked(getCurrencyRate).mockResolvedValue(0.9);
      const { result } = renderHook(() => useUserSettings());

      await waitFor(() => expect(result.current.userSettings.currencyRate).toBe(0.9));
      expect(getCurrencyRate).toHaveBeenCalledWith('USD', 'USD');
      expect(storage.set).toHaveBeenCalledWith({
        [CACHE.USER_SETTINGS]: expect.objectContaining({ currencyRate: 0.9 }),
      });
    });

    it('does not write when the rate is unchanged', async () => {
      const { result } = renderHook(() => useUserSettings());

      await waitFor(() => expect(getCurrencyRate).toHaveBeenCalled());
      expect(result.current.userSettings.currencyRate).toBe(defaultSettings.currencyRate);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('skips the lookup when currency is unset', async () => {
      const { result } = renderHook(() => useUserSettings());
      await waitFor(() => expect(getCurrencyRate).toHaveBeenCalledOnce());
      vi.mocked(getCurrencyRate).mockClear();

      act(() => result.current.setUserSettings({ ...result.current.userSettings, currency: '' }));

      expect(getCurrencyRate).not.toHaveBeenCalled();
    });

    it('logs when the rate lookup fails', async () => {
      vi.mocked(getCurrencyRate).mockRejectedValue(new Error('offline'));
      renderHook(() => useUserSettings());

      await waitFor(() => expect(console.error).toHaveBeenCalled());
    });
  });

  describe('cross-surface sync', () => {
    it('applies a differing value written by another surface', async () => {
      const { result } = renderHook(() => useUserSettings());
      await waitFor(() => expect(storage.addListener).toHaveBeenCalled());

      emitChange({ ...defaultSettings, location: 'FR' });

      expect(result.current.userSettings.location).toBe('FR');
      expect(storage.set).not.toHaveBeenCalledWith(
        expect.objectContaining({
          [CACHE.USER_SETTINGS]: expect.objectContaining({ location: 'FR' }),
        }),
      );
    });

    it.each([
      ['another storage area', { ...defaultSettings, location: 'FR' }, 'sync', CACHE.USER_SETTINGS],
      ['an unrelated key', { ...defaultSettings, location: 'FR' }, 'local', 'other_key'],
      ['an invalid value', { currency: 42 }, 'local', CACHE.USER_SETTINGS],
    ])('ignores a change from %s', async (_label, value, area, key) => {
      const { result } = renderHook(() => useUserSettings());
      await waitFor(() => expect(storage.addListener).toHaveBeenCalled());

      emitChange(value, area, key);

      expect(result.current.userSettings.location).toBe('US');
    });

    it('keeps state identity on a no-op echo', async () => {
      const { result } = renderHook(() => useUserSettings());
      await waitFor(() => expect(storage.addListener).toHaveBeenCalled());
      const before = result.current.userSettings;

      emitChange({ ...before });

      expect(result.current.userSettings).toBe(before);
    });

    it('removes the listener on unmount', async () => {
      const { unmount } = renderHook(() => useUserSettings());
      await waitFor(() => expect(storage.addListener).toHaveBeenCalled());

      unmount();

      expect(storage.removeListener).toHaveBeenCalledWith(listener());
    });
  });
});
