import { defaultSettings, search } from '@/../config.json';
import { APP_ACTION, CACHE, DRAWER_INDEX, PANEL } from '@/constants/common';
import { diff } from '@/helpers/collectionUtils';
import { getCountryName } from '@/helpers/country';
import { getCurrencyCodeFromLocation } from '@/helpers/currency';
import { getUserLanguage, getUserLocation } from '@/helpers/utils';
import { cstorage } from '@/utils/storage';
import { isValidUserSettings } from '@/utils/typeGuards/common';
import { startTransition } from 'react';

/**
 * The consolidated App state managed by React's `useActionState`. Split out of
 * `App.tsx` so the reducer and its transitions can be unit-tested in isolation.
 * @group State
 * @source
 */
export interface AppState {
  /** The active user settings (theme, currency, caching, suppliers, …). */
  userSettings?: UserSettings;
  /** The active panel (SearchHome / Results / Stats). */
  panel: PANEL;
  /** Whether the SpeedDial FAB is currently shown. */
  speedDialVisibility: boolean;
  /** The open drawer tab, or `CLOSED`. */
  drawerTab: DRAWER_INDEX;
  /** Suppliers selected for search filtering. */
  selectedSuppliers: SupplierClassName[];
  /** Cached ID of the ChemPal Favorites bookmarks folder. */
  bookmarksFolderId: string | null;
}

/**
 * The discriminated union of actions accepted by {@link appReducer}.
 * @group State
 * @source
 */
export type AppAction =
  | { type: typeof APP_ACTION.UPDATE_SETTINGS; settings: UserSettings }
  | { type: typeof APP_ACTION.SET_CURRENCY_RATE; rate: number }
  | { type: typeof APP_ACTION.SET_PANEL; panel: PANEL }
  | { type: typeof APP_ACTION.SET_SPEED_DIAL_VISIBILITY; visible: boolean }
  | { type: typeof APP_ACTION.LOAD_FROM_STORAGE; data: Partial<AppState> }
  | { type: typeof APP_ACTION.HYDRATE_SETTINGS; settings: UserSettings }
  | { type: typeof APP_ACTION.SET_DRAWER_TAB; tab: DRAWER_INDEX }
  | { type: typeof APP_ACTION.SET_SELECTED_SUPPLIERS; suppliers: SupplierClassName[] }
  | { type: typeof APP_ACTION.SET_BOOKMARKS_FOLDER_ID; id: string | null };

/**
 * Builds the initial App state: the shipped `defaultSettings` merged with the
 * user's detected location/language/currency, landing on the search-home panel
 * with the drawer closed. Detection helpers are pure (no network), so this is
 * safe to evaluate at import time — matching the original module-level behavior.
 * @returns A fresh partial App state used to seed `useActionState`.
 * @category Utils
 * @group State
 * @source
 */
function buildInitialAppState(): Partial<AppState> {
  const state: Partial<AppState> = {};
  if (isValidUserSettings(defaultSettings)) {
    state.userSettings = defaultSettings;
  }

  const location = getUserLocation();
  state.userSettings = {
    ...state.userSettings,
    currency: getCurrencyCodeFromLocation(location),
    location,
    country: getCountryName(location),
    language: getUserLanguage(),
    suppliers: {
      ...state.userSettings?.suppliers,
      resultLimit: search.defaultResultsLimitPerSupplier,
    },
  } satisfies UserSettings;

  state.panel = PANEL.SEARCH_HOME;
  state.speedDialVisibility = false;
  state.drawerTab = DRAWER_INDEX.CLOSED;
  state.selectedSuppliers = [];
  state.bookmarksFolderId = null;
  return state;
}

/**
 * The initial state passed to `useActionState` in `App.tsx`.
 * @group State
 */
export const initialAppState: Partial<AppState> = buildInitialAppState();

/**
 * The App state reducer driving `useActionState`. Pure with respect to the
 * returned state; the persistence side effects (writing to `cstorage`) are
 * fire-and-forget inside `startTransition`, mirroring the original inline
 * reducer. `UPDATE_SETTINGS` keeps `country` in sync with `location`;
 * `HYDRATE_SETTINGS` re-applies an external settings write without echoing it
 * back to storage (early-returning on a no-op diff).
 * @param currentState - The current App state.
 * @param action - The action to apply.
 * @returns The next App state (the same reference when nothing changed).
 * @category Utils
 * @group State
 * @example
 * ```ts
 * const next = appReducer({ panel: PANEL.SEARCH_HOME }, { type: APP_ACTION.SET_PANEL, panel: PANEL.RESULTS });
 * // next.panel === PANEL.RESULTS, and cstorage.session persists the selection
 * ```
 * @source
 */
export function appReducer(
  currentState: Partial<AppState>,
  action: AppAction,
): Partial<AppState> {
  switch (action.type) {
    // Applies new user settings (theme, currency, caching, suppliers, etc.) and
    // persists them to cstorage.local. Also fetches the updated currency rate.
    // Dispatched by child components via appContext.setUserSettings().
    case APP_ACTION.UPDATE_SETTINGS: {
      // Keep `country` (full name) in sync with `location` (country code) on
      // every settings change, so consumers like Ambeed can read it directly.
      const newSettings: UserSettings = {
        ...action.settings,
        country: getCountryName(action.settings.location),
      };

      startTransition(() => {
        (async () => {
          try {
            await cstorage.local.set({ [CACHE.USER_SETTINGS]: newSettings });
          } catch (error) {
            console.error('Failed to update settings:', { error });
          }
        })();
      });

      return {
        ...currentState,
        userSettings: newSettings,
      };
    }

    // Merges the freshly-fetched USD→currency rate into state and persists it.
    // Dispatched from the currency-watching effect (the rate is async, so it
    // can't be resolved inside UPDATE_SETTINGS); this is what makes the price
    // column reconvert immediately when the user changes currency.
    case APP_ACTION.SET_CURRENCY_RATE: {
      const current = currentState.userSettings;
      if (!current || current.currencyRate === action.rate) return currentState;
      const updatedSettings: UserSettings = { ...current, currencyRate: action.rate };

      startTransition(() => {
        (async () => {
          try {
            await cstorage.local.set({ [CACHE.USER_SETTINGS]: updatedSettings });
          } catch (error) {
            console.error('Failed to persist currency rate:', { error });
          }
        })();
      });

      return {
        ...currentState,
        userSettings: updatedSettings,
      };
    }

    // Switches the active panel (0 = SearchHome, 1 = Results, 2 = Stats) and
    // persists the selection to cstorage.session so it survives popup re-opens.
    // Dispatched by child components via appContext.setPanel().
    case APP_ACTION.SET_PANEL: {
      startTransition(() => {
        (async () => {
          try {
            await cstorage.session.set({ [CACHE.PANEL]: action.panel });
          } catch (error) {
            console.error('Failed to save panel:', { error });
          }
        })();
      });

      return {
        ...currentState,
        panel: action.panel,
      };
    }

    // Toggles the SpeedDial FAB visibility based on mouse proximity to the
    // bottom-right corner of the popup. Dispatched by the mousemove listener.
    case APP_ACTION.SET_SPEED_DIAL_VISIBILITY:
      return {
        ...currentState,
        speedDialVisibility: action.visible,
      };

    // Hydrates app state from chrome.storage on initial mount. Merges saved
    // panel, userSettings, and selectedSuppliers into the current state.
    // Dispatched once by the mount useEffect.
    case APP_ACTION.LOAD_FROM_STORAGE:
      return {
        ...currentState,
        ...action.data,
      };

    // Re-hydrates user settings when they change in another extension surface
    // (e.g. the options page writes user_settings while this popup is open).
    // Unlike UPDATE_SETTINGS this does NOT write back to storage — doing so
    // would echo the change and loop. Early-return when nothing actually
    // changed so the surface that made the edit doesn't re-render on its own
    // storage echo. The currency-rate and locale effects key off
    // userSettings.currency/.language, so they only re-run on real changes.
    case APP_ACTION.HYDRATE_SETTINGS: {
      const current = currentState.userSettings;
      if (current && diff(current, action.settings).length === 0) return currentState;
      return {
        ...currentState,
        userSettings: action.settings,
      };
    }

    // Opens a specific drawer tab or closes the drawer (tab = -1).
    // Used by setDrawerTab() for direct tab selection and toggleDrawer()
    // for open/close toggling.
    case APP_ACTION.SET_DRAWER_TAB:
      return {
        ...currentState,
        drawerTab: action.tab,
      };

    // Updates the list of selected suppliers for search filtering and persists
    // the selection to cstorage.local. Dispatched via appContext.setSelectedSuppliers().
    case APP_ACTION.SET_SELECTED_SUPPLIERS: {
      startTransition(() => {
        (async () => {
          try {
            await cstorage.local.set({
              [CACHE.SELECTED_SUPPLIERS]: action.suppliers,
            });
          } catch (error) {
            console.error('Failed to save selectedSuppliers:', { error });
          }
        })();
      });

      return {
        ...currentState,
        selectedSuppliers: action.suppliers,
      };
    }

    // Persists the ChemPal Favorites bookmarks folder ID to cstorage.local
    // so we don't need to scan the bookmark tree on every popup open.
    case APP_ACTION.SET_BOOKMARKS_FOLDER_ID: {
      startTransition(() => {
        (async () => {
          try {
            await cstorage.local.set({
              [CACHE.BOOKMARKS_FOLDER_ID]: action.id,
            });
          } catch (error) {
            console.error('Failed to save bookmarksFolderId:', { error });
          }
        })();
      });

      return {
        ...currentState,
        bookmarksFolderId: action.id,
      };
    }

    default:
      return currentState;
  }
}
