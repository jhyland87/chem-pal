import { APP_ACTION, CACHE, DRAWER_INDEX, PANEL } from '@/constants/common';
import { getCountryName } from '@/helpers/country';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  localSet: vi.fn().mockResolvedValue(undefined),
  sessionSet: vi.fn().mockResolvedValue(undefined),
}));

// Mock the storage boundary so the reducer's fire-and-forget persistence is a spy
// and never touches chrome.storage. (No external/network calls in tests.)
vi.mock('@/utils/storage', () => ({
  cstorage: {
    local: { set: mocks.localSet, get: vi.fn(), remove: vi.fn(), clear: vi.fn() },
    session: { set: mocks.sessionSet, get: vi.fn(), remove: vi.fn(), clear: vi.fn() },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
}));

import { appReducer, initialAppState, type AppState } from '../appReducer';

/** Flush the startTransition-scheduled async persistence so its spy has been called. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** A minimal userSettings object for reducer inputs. */
function settings(overrides: Partial<UserSettings> = {}): UserSettings {
  return { currency: 'USD', location: 'US', language: 'en', ...overrides } as UserSettings;
}

describe('appReducer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialAppState', () => {
    it('seeds the search-home panel with the drawer closed and detected settings', () => {
      expect(initialAppState.panel).toBe(PANEL.SEARCH_HOME);
      expect(initialAppState.drawerTab).toBe(DRAWER_INDEX.CLOSED);
      expect(initialAppState.selectedSuppliers).toEqual([]);
      expect(initialAppState.bookmarksFolderId).toBeNull();
      expect(initialAppState.userSettings?.currency).toBeTypeOf('string');
      expect(initialAppState.userSettings?.language).toBeTypeOf('string');
    });
  });

  describe('UPDATE_SETTINGS', () => {
    it('syncs country from location and persists to local storage', async () => {
      const next = appReducer(
        {},
        { type: APP_ACTION.UPDATE_SETTINGS, settings: settings({ location: 'US' }) },
      );

      expect(next.userSettings?.country).toBe(getCountryName('US'));
      expect(next.userSettings?.currency).toBe('USD');

      await flush();
      expect(mocks.localSet).toHaveBeenCalledWith({ [CACHE.USER_SETTINGS]: next.userSettings });
    });
  });

  describe('SET_CURRENCY_RATE', () => {
    it('is a no-op (same reference) when there are no settings yet', () => {
      const state: Partial<AppState> = {};
      expect(appReducer(state, { type: APP_ACTION.SET_CURRENCY_RATE, rate: 1.1 })).toBe(state);
    });

    it('is a no-op when the rate is unchanged', () => {
      const state: Partial<AppState> = { userSettings: settings({ currencyRate: 1.1 }) };
      expect(appReducer(state, { type: APP_ACTION.SET_CURRENCY_RATE, rate: 1.1 })).toBe(state);
      expect(mocks.localSet).not.toHaveBeenCalled();
    });

    it('stores a changed rate and persists it', async () => {
      const state: Partial<AppState> = { userSettings: settings({ currencyRate: 1 }) };
      const next = appReducer(state, { type: APP_ACTION.SET_CURRENCY_RATE, rate: 1.25 });

      expect(next.userSettings?.currencyRate).toBe(1.25);
      await flush();
      expect(mocks.localSet).toHaveBeenCalledWith({ [CACHE.USER_SETTINGS]: next.userSettings });
    });
  });

  describe('SET_PANEL', () => {
    it('switches the panel and persists it to session storage', async () => {
      const next = appReducer({}, { type: APP_ACTION.SET_PANEL, panel: PANEL.RESULTS });

      expect(next.panel).toBe(PANEL.RESULTS);
      await flush();
      expect(mocks.sessionSet).toHaveBeenCalledWith({ [CACHE.PANEL]: PANEL.RESULTS });
    });
  });

  describe('SET_SPEED_DIAL_VISIBILITY', () => {
    it('sets visibility without persisting anything', () => {
      const next = appReducer({}, { type: APP_ACTION.SET_SPEED_DIAL_VISIBILITY, visible: true });

      expect(next.speedDialVisibility).toBe(true);
      expect(mocks.localSet).not.toHaveBeenCalled();
      expect(mocks.sessionSet).not.toHaveBeenCalled();
    });
  });

  describe('LOAD_FROM_STORAGE', () => {
    it('merges the loaded data over the current state', () => {
      const next = appReducer(
        { panel: PANEL.SEARCH_HOME, speedDialVisibility: false },
        {
          type: APP_ACTION.LOAD_FROM_STORAGE,
          data: { panel: PANEL.RESULTS, selectedSuppliers: [] },
        },
      );

      expect(next.panel).toBe(PANEL.RESULTS);
      expect(next.speedDialVisibility).toBe(false);
    });
  });

  describe('HYDRATE_SETTINGS', () => {
    it('re-applies changed settings without writing back to storage', async () => {
      const state: Partial<AppState> = { userSettings: settings({ currency: 'USD' }) };
      const next = appReducer(state, {
        type: APP_ACTION.HYDRATE_SETTINGS,
        settings: settings({ currency: 'EUR' }),
      });

      expect(next.userSettings?.currency).toBe('EUR');
      await flush();
      expect(mocks.localSet).not.toHaveBeenCalled();
    });

    it('is a no-op (same reference) when the incoming settings are identical', () => {
      const current = settings({ currency: 'USD' });
      const state: Partial<AppState> = { userSettings: current };
      expect(
        appReducer(state, { type: APP_ACTION.HYDRATE_SETTINGS, settings: settings({ currency: 'USD' }) }),
      ).toBe(state);
    });
  });

  describe('SET_DRAWER_TAB', () => {
    it('sets the drawer tab', () => {
      const next = appReducer({}, { type: APP_ACTION.SET_DRAWER_TAB, tab: DRAWER_INDEX.HISTORY });
      expect(next.drawerTab).toBe(DRAWER_INDEX.HISTORY);
    });
  });

  describe('SET_SELECTED_SUPPLIERS', () => {
    it('stores the selection and persists it to local storage', async () => {
      const suppliers = ['SupplierAmbeed'] as AppState['selectedSuppliers'];
      const next = appReducer(
        {},
        { type: APP_ACTION.SET_SELECTED_SUPPLIERS, suppliers },
      );

      expect(next.selectedSuppliers).toBe(suppliers);
      await flush();
      expect(mocks.localSet).toHaveBeenCalledWith({ [CACHE.SELECTED_SUPPLIERS]: suppliers });
    });
  });

  describe('SET_BOOKMARKS_FOLDER_ID', () => {
    it('stores the id and persists it to local storage', async () => {
      const next = appReducer({}, { type: APP_ACTION.SET_BOOKMARKS_FOLDER_ID, id: 'folder-42' });

      expect(next.bookmarksFolderId).toBe('folder-42');
      await flush();
      expect(mocks.localSet).toHaveBeenCalledWith({ [CACHE.BOOKMARKS_FOLDER_ID]: 'folder-42' });
    });
  });

  describe('unknown action', () => {
    it('returns the current state unchanged (same reference)', () => {
      const state: Partial<AppState> = { panel: PANEL.RESULTS };
      expect(appReducer(state, { type: 'NOPE' } as unknown as Parameters<typeof appReducer>[1])).toBe(
        state,
      );
    });
  });
});
