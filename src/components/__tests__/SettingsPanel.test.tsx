import { IDB_STORE } from '@/constants/common';
import { SUPPLIER_CLASS_NAMES } from '@/constants/suppliers';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the icon barrels to avoid ENFILE from the full @mui/icons-material import.
vi.mock('@mui/icons-material/Delete', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/ExpandMore', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/TextDecrease', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/TextFormat', () => ({ default: () => <span /> }));
vi.mock('@mui/icons-material/TextIncrease', () => ({ default: () => <span /> }));

// i18n returns the key (with args appended) so assertions target stable ids.
vi.mock('@/helpers/i18n', () => ({
  i18n: (key: string, subs?: string[]) => (subs?.length ? `${key}:${subs.join(',')}` : key),
  getAvailableLocales: () => ['en', 'pl'],
}));

const mocks = vi.hoisted(() => ({
  getCurrencyRate: vi.fn(),
  loadExcludedProducts: vi.fn(),
  removeExcludedProduct: vi.fn(),
  clearAllCaches: vi.fn(),
  clearExcludedProducts: vi.fn(),
  clearExports: vi.fn(),
  clearPriceHistory: vi.fn(),
  clearSupplierProductDataCache: vi.fn(),
  clearSupplierQueryCache: vi.fn(),
  getAllPriceSeries: vi.fn(),
  getIdbStorageBreakdown: vi.fn(),
  storageClear: vi.fn(),
}));

vi.mock('@/helpers/currency', () => ({ getCurrencyRate: mocks.getCurrencyRate }));

vi.mock('@/helpers/excludedProducts', () => ({
  loadExcludedProducts: mocks.loadExcludedProducts,
  removeExcludedProduct: mocks.removeExcludedProduct,
}));

vi.mock('@/utils/idbCache', () => ({
  clearAllCaches: mocks.clearAllCaches,
  clearExcludedProducts: mocks.clearExcludedProducts,
  clearExports: mocks.clearExports,
  clearPriceHistory: mocks.clearPriceHistory,
  clearSupplierProductDataCache: mocks.clearSupplierProductDataCache,
  clearSupplierQueryCache: mocks.clearSupplierQueryCache,
  getAllPriceSeries: mocks.getAllPriceSeries,
  getIdbStorageBreakdown: mocks.getIdbStorageBreakdown,
}));

vi.mock('@/utils/storage', () => ({
  cstorage: { local: { clear: mocks.storageClear, get: vi.fn(), set: vi.fn(), remove: vi.fn() } },
}));

let mockContext: {
  userSettings: UserSettings;
  setUserSettings: ReturnType<typeof vi.fn>;
  advancedMode: boolean;
  setAdvancedMode: ReturnType<typeof vi.fn>;
} | null;

vi.mock('@/components/SearchPanel/hooks/useContext', () => ({
  useAppContext: () => mockContext,
}));

import SettingsPanel from '../SettingsPanel';

/** A baseline userSettings object; individual tests override fields as needed. */
function baseSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    currency: 'USD',
    location: 'US',
    language: 'en',
    caching: { enabled: true },
    display: { fontSize: 'medium' },
    suppliers: { disabled: [] },
    ...overrides,
  } as UserSettings;
}

/** Sets up mockContext with the given settings and a fresh setter spy. */
function setContext(settings: UserSettings, advancedMode = false) {
  mockContext = {
    userSettings: settings,
    setUserSettings: vi.fn(),
    advancedMode,
    setAdvancedMode: vi.fn(),
  };
  return mockContext;
}

/** Opens an accordion section by clicking its summary label. */
function openSection(sectionKey: string) {
  fireEvent.click(screen.getByText(sectionKey));
}

describe('SettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrencyRate.mockResolvedValue(1.1);
    mocks.loadExcludedProducts.mockResolvedValue({});
    mocks.removeExcludedProduct.mockResolvedValue(undefined);
    mocks.clearAllCaches.mockResolvedValue(undefined);
    mocks.clearExcludedProducts.mockResolvedValue(undefined);
    mocks.clearExports.mockResolvedValue(undefined);
    mocks.clearPriceHistory.mockResolvedValue(undefined);
    mocks.clearSupplierProductDataCache.mockResolvedValue(undefined);
    mocks.clearSupplierQueryCache.mockResolvedValue(undefined);
    mocks.storageClear.mockResolvedValue(undefined);
    mocks.getAllPriceSeries.mockResolvedValue([]);
    mocks.getIdbStorageBreakdown.mockResolvedValue({
      totalBytes: 0,
      byStore: {
        [IDB_STORE.SUPPLIER_QUERY_CACHE]: { count: 0, bytes: 0 },
        [IDB_STORE.SUPPLIER_PRODUCT_DATA_CACHE]: { count: 0, bytes: 0 },
        [IDB_STORE.PRICE_HISTORY]: { count: 0, bytes: 0 },
      },
    });
    setContext(baseSettings());
  });

  it('renders a loading message when the app context is not ready', () => {
    mockContext = null;
    render(<SettingsPanel />);

    expect(screen.getByText('settings_loading')).toBeInTheDocument();
  });

  it('renders the behavior section expanded by default', () => {
    render(<SettingsPanel />);

    expect(screen.getByText('settings_currency')).toBeInTheDocument();
    expect(screen.getByText('settings_location')).toBeInTheDocument();
    expect(screen.getByText('settings_language')).toBeInTheDocument();
  });

  it('persists a switch toggle through setUserSettings', async () => {
    const ctx = setContext(baseSettings({ caching: { enabled: true } }));
    render(<SettingsPanel />);
    openSection('settings_section_cache');

    const cachingSwitch = document.querySelector('input[name="caching"]') as HTMLInputElement;
    fireEvent.click(cachingSwitch);

    await waitFor(() =>
      expect(ctx.setUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({ caching: expect.objectContaining({ enabled: false }) }),
      ),
    );
  });

  it('disables the cache-dependent controls when caching is off', () => {
    setContext(baseSettings({ caching: { enabled: false } }));
    render(<SettingsPanel />);
    openSection('settings_section_cache');

    expect(document.querySelector('input[name="doNotCacheEmptyResults"]')).toBeDisabled();
    expect(document.querySelector('input[name="cacheTtlMinutes"]')).toBeDisabled();
    // The master switch stays enabled so caching can be turned back on.
    expect(document.querySelector('input[name="caching"]')).not.toBeDisabled();
  });

  it('persists a numeric input change through setUserSettings', async () => {
    const ctx = setContext(baseSettings({ caching: { enabled: true, ttlMinutes: 10 } }));
    render(<SettingsPanel />);
    openSection('settings_section_cache');

    const ttlInput = document.querySelector('input[name="cacheTtlMinutes"]') as HTMLInputElement;
    fireEvent.change(ttlInput, { target: { value: '30', name: 'cacheTtlMinutes' } });

    await waitFor(() =>
      expect(ctx.setUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({ caching: expect.objectContaining({ ttlMinutes: 30 }) }),
      ),
    );
  });

  it('persists a font-size button click through setUserSettings', async () => {
    const ctx = setContext(baseSettings({ display: { fontSize: 'medium' } }));
    render(<SettingsPanel />);
    openSection('settings_section_display');

    fireEvent.click(screen.getByRole('button', { name: 'settings_font_small' }));

    await waitFor(() =>
      expect(ctx.setUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({ display: expect.objectContaining({ fontSize: 'small' }) }),
      ),
    );
  });

  it('restores defaults, clearing the disabled-supplier list', async () => {
    const ctx = setContext(baseSettings({ suppliers: { disabled: [SUPPLIER_CLASS_NAMES[0]] } }));
    render(<SettingsPanel />);
    openSection('settings_section_actions');

    fireEvent.click(screen.getByText('settings_restore_defaults'));

    await waitFor(() =>
      expect(ctx.setUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          suppliers: expect.objectContaining({ disabled: [] }),
          display: expect.objectContaining({ fontSize: 'medium' }),
        }),
      ),
    );
  });

  it('restore rebuilds a clean object, dropping stale/corrupted keys', async () => {
    // Seed a profile carrying legacy + corrupted keys that must not survive.
    const corrupted = {
      ...baseSettings(),
      trackPriceHistory: true,
      suppliers: { 0: 'SupplierAladdinSci', 1: 'SupplierAmbeed' },
    } as unknown as UserSettings;
    const ctx = setContext(corrupted);
    render(<SettingsPanel />);
    openSection('settings_section_actions');

    fireEvent.click(screen.getByText('settings_restore_defaults'));

    await waitFor(() => {
      const call = ctx.setUserSettings.mock.calls.find(
        ([s]) => s?.suppliers?.disabled?.length === 0,
      );
      expect(call).toBeDefined();
      const restored = call![0];
      expect(restored).not.toHaveProperty('trackPriceHistory');
      expect(restored.suppliers).not.toHaveProperty('0');
      // Locale is preserved; the rest comes from clean defaults.
      expect(restored.currency).toBe('USD');
    });
  });

  it('full reset clears every store except app_meta after confirmation', async () => {
    // The handler ends with window.location.reload(); jsdom logs a benign
    // "Not implemented: navigation" for it, which doesn't affect these assertions.
    setContext(baseSettings());
    render(<SettingsPanel />);
    openSection('settings_section_actions');

    fireEvent.click(screen.getByText('settings_full_reset'));
    // The confirmation dialog is shown; nothing is cleared yet.
    expect(screen.getByText('settings_full_reset_confirm_title')).toBeInTheDocument();
    expect(mocks.storageClear).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('settings_full_reset_confirm'));

    await waitFor(() => {
      // clearAllCaches + clearPriceHistory + clearExports cover every IndexedDB
      // store except app_meta; storageClear wipes all of chrome.storage.local.
      expect(mocks.clearAllCaches).toHaveBeenCalled();
      expect(mocks.clearPriceHistory).toHaveBeenCalled();
      expect(mocks.clearExports).toHaveBeenCalled();
      expect(mocks.storageClear).toHaveBeenCalled();
    });
  });

  it('full reset does nothing when cancelled', () => {
    setContext(baseSettings());
    render(<SettingsPanel />);
    openSection('settings_section_actions');

    fireEvent.click(screen.getByText('settings_full_reset'));
    fireEvent.click(screen.getByText('migration_cancel'));

    expect(mocks.clearAllCaches).not.toHaveBeenCalled();
    expect(mocks.storageClear).not.toHaveBeenCalled();
  });

  it('toggling a supplier off adds it to disabledSuppliers', async () => {
    const supplier = SUPPLIER_CLASS_NAMES[0];
    const ctx = setContext(baseSettings({ suppliers: { disabled: [] } }));
    render(<SettingsPanel />);
    openSection('settings_section_supplier_status');

    const supplierSwitch = document.querySelector(`input[name="${supplier}"]`) as HTMLInputElement;
    fireEvent.click(supplierSwitch);

    await waitFor(() =>
      expect(ctx.setUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({ suppliers: expect.objectContaining({ disabled: [supplier] }) }),
      ),
    );
  });

  it('clears the supplier caches and confirms when Clear Cache is pressed', async () => {
    render(<SettingsPanel />);
    openSection('settings_section_cache');

    fireEvent.click(screen.getByText('settings_clear_cache'));

    await waitFor(() => {
      expect(mocks.clearSupplierQueryCache).toHaveBeenCalledOnce();
      expect(mocks.clearSupplierProductDataCache).toHaveBeenCalledOnce();
    });
    expect(await screen.findByText('settings_cache_cleared')).toBeInTheDocument();
  });

  it('clears price history and confirms when Clear Price History is pressed', async () => {
    render(<SettingsPanel />);
    openSection('settings_section_price_history');

    fireEvent.click(screen.getByText('settings_clear_price_history'));

    await waitFor(() => expect(mocks.clearPriceHistory).toHaveBeenCalledOnce());
    expect(await screen.findByText('settings_price_history_cleared')).toBeInTheDocument();
  });

  describe('excluded products', () => {
    const excludedMap = {
      'supplier|123': {
        title: 'Sodium Chloride',
        url: 'https://example.com/nacl',
        supplier: 'ExampleSupplier',
        excludedAt: 1_700_000_000_000,
      },
    };

    it('lists excluded products and removes one on click', async () => {
      mocks.loadExcludedProducts.mockResolvedValue(excludedMap);
      render(<SettingsPanel />);

      // Wait for the async load, then open the section.
      await waitFor(() => expect(mocks.loadExcludedProducts).toHaveBeenCalled());
      openSection('settings_section_excluded');

      const link = await screen.findByText('Sodium Chloride');
      expect(link).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /settings_remove_item/ }));
      await waitFor(() => expect(mocks.removeExcludedProduct).toHaveBeenCalledWith('supplier|123'));
    });

    it('shows the empty state when there are no excluded products', async () => {
      mocks.loadExcludedProducts.mockResolvedValue({});
      render(<SettingsPanel />);
      openSection('settings_section_excluded');

      expect(await screen.findByText('settings_excluded_empty')).toBeInTheDocument();
    });

    it('clears all excluded products via Clear All', async () => {
      mocks.loadExcludedProducts.mockResolvedValue(excludedMap);
      render(<SettingsPanel />);

      await waitFor(() => expect(mocks.loadExcludedProducts).toHaveBeenCalled());
      openSection('settings_section_excluded');
      await screen.findByText('Sodium Chloride');

      fireEvent.click(screen.getByText('settings_clear_all'));

      await waitFor(() => expect(mocks.clearExcludedProducts).toHaveBeenCalledOnce());
      await waitFor(() => expect(screen.queryByText('Sodium Chloride')).not.toBeInTheDocument());
    });
  });

  it('toggling a disabled supplier back on removes it from disabledSuppliers', async () => {
    const supplier = SUPPLIER_CLASS_NAMES[0];
    const ctx = setContext(baseSettings({ suppliers: { disabled: [supplier] } }));
    render(<SettingsPanel />);
    openSection('settings_section_supplier_status');

    const supplierSwitch = document.querySelector(`input[name="${supplier}"]`) as HTMLInputElement;
    fireEvent.click(supplierSwitch);

    await waitFor(() =>
      expect(ctx.setUserSettings).toHaveBeenCalledWith(
        expect.objectContaining({ suppliers: expect.objectContaining({ disabled: [] }) }),
      ),
    );
  });

  it('shows a currency rate hint for a non-USD currency', async () => {
    mocks.getCurrencyRate.mockResolvedValue(0.85);
    setContext(baseSettings({ currency: 'EUR' }));
    render(<SettingsPanel />);

    await waitFor(() => expect(mocks.getCurrencyRate).toHaveBeenCalledWith('USD', 'EUR'));
    expect(await screen.findByText(/settings_currency_rate_hint/)).toBeInTheDocument();
  });

  it('displays cache stats loaded from the storage breakdown', async () => {
    mocks.getIdbStorageBreakdown.mockResolvedValue({
      totalBytes: 2048,
      byStore: {
        [IDB_STORE.SUPPLIER_QUERY_CACHE]: { count: 3, bytes: 1024 },
        [IDB_STORE.SUPPLIER_PRODUCT_DATA_CACHE]: { count: 2, bytes: 1024 },
        [IDB_STORE.PRICE_HISTORY]: { count: 0, bytes: 0 },
      },
    });
    render(<SettingsPanel />);
    openSection('settings_section_cache');

    // 3 + 2 = 5 combined records shows up in the cache-stats line.
    expect(await screen.findByText(/settings_cache_stats:5/)).toBeInTheDocument();
  });
});
