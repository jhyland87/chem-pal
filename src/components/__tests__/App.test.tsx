import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Captured hotkey handlers + per-test control. vi.hoisted runs before the mock
// factories, so they can close over these safely.
const control = vi.hoisted(() => ({
  handlers: null as Record<string, () => void> | null,
}));

const spies = vi.hoisted(() => ({
  useSearchAnalytics: vi.fn(),
  useDebugApi: vi.fn(),
  playAdvancedModeSound: vi.fn().mockResolvedValue(undefined),
  getSearchResults: vi.fn().mockResolvedValue([]),
  getMigrationStatus: vi.fn().mockResolvedValue({ pending: [] }),
}));

// --- Boundaries: nothing may leave the process (no fetch, chrome, IDB, analytics). ---

vi.mock('@/utils/storage', () => ({
  cstorage: {
    local: { get: vi.fn().mockResolvedValue({}), set: vi.fn(), remove: vi.fn(), clear: vi.fn() },
    session: { get: vi.fn().mockResolvedValue({}), set: vi.fn(), remove: vi.fn(), clear: vi.fn() },
    onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
  },
}));

vi.mock('@/utils/idbCache', () => ({
  getSearchResults: spies.getSearchResults,
  clearSearchResults: vi.fn().mockResolvedValue(undefined),
  IDB_SEARCH_RESULTS_CLEARED: 'idb-search-results-cleared',
}));

vi.mock('@/utils/SupplierCache', () => ({
  SupplierCache: { clearAll: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/helpers/currency', () => ({
  getCurrencyRate: vi.fn().mockResolvedValue(1),
  getCurrencyCodeFromLocation: () => 'USD',
}));

vi.mock('@/migrations/registry', () => ({
  getMigrationStatus: spies.getMigrationStatus,
  seedVersionIfUnset: vi.fn().mockResolvedValue(undefined),
  applyPendingMigrations: vi.fn().mockResolvedValue(undefined),
  resetToCurrentVersion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/helpers/analytics', () => ({ trackRenderError: vi.fn() }));

// --- Side-effectful hooks: stub out network/badge/analytics behavior. ---

vi.mock('@/utils/badgeController', () => ({ useBadgeController: () => {} }));
vi.mock('@/hooks/useSearchAnalytics', () => ({ useSearchAnalytics: spies.useSearchAnalytics }));
vi.mock('@/hooks/useDebugApi', () => ({ useDebugApi: spies.useDebugApi }));
vi.mock('@/helpers/advancedMode', () => ({ playAdvancedModeSound: spies.playAdvancedModeSound }));
vi.mock('@/hooks/useUpdateAvailable', () => ({
  useUpdateAvailable: () => ({
    notice: undefined,
    dismiss: vi.fn(),
    snooze: vi.fn(),
    applyUpdate: vi.fn(),
  }),
}));
vi.mock('@/hooks/useJustUpdated', () => ({
  useJustUpdated: () => ({ notice: undefined, acknowledge: vi.fn() }),
}));
vi.mock('@/hooks/useReviewPrompt', () => ({
  useReviewPrompt: () => ({ notice: undefined, onReview: vi.fn(), onDismiss: vi.fn() }),
}));

// Capture the hotkey handlers instead of installing a real key listener; keep the
// rest of the barrel (HotkeyEvent, etc.) real.
vi.mock('@/hotkeys', async () => {
  const actual = await vi.importActual<typeof import('@/hotkeys')>('@/hotkeys');
  return {
    ...actual,
    useHotkeys: (handlers: Record<string, () => void>) => {
      control.handlers = handlers;
    },
    HotkeyHelpModal: () => null,
  };
});

// --- Heavy children stubbed to markers/null (avoids MUI data grid + icon barrels). ---

vi.mock('@/components/SearchPanelHome', async () => {
  const React = await import('react');
  return { default: () => React.createElement('div', { 'data-testid': 'search-home' }) };
});
vi.mock('@/components/SearchPanel/SearchPanel', async () => {
  const React = await import('react');
  return { default: () => React.createElement('div', { 'data-testid': 'search-results' }) };
});
vi.mock('@/components/MigrationPrompt', async () => {
  const React = await import('react');
  return {
    MigrationPrompt: ({ open }: { open: boolean }) =>
      open ? React.createElement('div', { 'data-testid': 'migration-prompt' }) : null,
  };
});
vi.mock('@/components/StatsPanel', () => ({ default: () => null }));
vi.mock('@/components/DrawerSystem', () => ({ default: () => null }));
vi.mock('@/components/SpeedDialMenu', () => ({ default: () => null }));
vi.mock('@/components/StatusBadges', () => ({ StatusBadges: () => null }));
vi.mock('@/components/UpdatePrompt', () => ({ UpdatePrompt: () => null }));
vi.mock('@/components/WhatsNewPrompt', () => ({ WhatsNewPrompt: () => null }));
vi.mock('@/components/ReviewPrompt', () => ({ ReviewPrompt: () => null }));
vi.mock('@/components/StatusBar', () => ({
  default: () => null,
  StatusBarProvider: ({ children }: { children: React.ReactNode }) => children,
  useStatusBar: () => ({ flashStatusText: vi.fn() }),
}));

import App from '../../App';
import ErrorBoundary from '../ErrorBoundary';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    control.handlers = null;
    spies.getSearchResults.mockResolvedValue([]);
    spies.getMigrationStatus.mockResolvedValue({ pending: [] });
  });

  afterEach(() => {
    // Reset any URL mutation from the test-crash case.
    window.history.pushState({}, '', '/');
  });

  it('lands on the search-home panel when the cache is empty', async () => {
    render(<App />);

    expect(await screen.findByTestId('search-home')).toBeInTheDocument();
    expect(screen.queryByTestId('search-results')).not.toBeInTheDocument();
  });

  it('mounts the search-analytics hook, so search events reach PostHog', async () => {
    render(<App />);
    await screen.findByTestId('search-home');

    // Guards the wiring, not the hook's behavior (covered in its own test):
    // dropping useSearchAnalytics() from App would silently kill search analytics.
    expect(spies.useSearchAnalytics).toHaveBeenCalled();
  });

  it('lands on the results panel when the cache has results', async () => {
    spies.getSearchResults.mockResolvedValue([{ id: 'x' }]);
    render(<App />);

    expect(await screen.findByTestId('search-results')).toBeInTheDocument();
  });

  it('shows the migration prompt when migrations are pending', async () => {
    spies.getMigrationStatus.mockResolvedValue({ pending: [{ from: 1, to: 2 }] });
    render(<App />);

    expect(await screen.findByTestId('migration-prompt')).toBeInTheDocument();
    // Loading the cache is deferred until the user resolves the prompt.
    expect(spies.getSearchResults).not.toHaveBeenCalled();
  });

  it('passes advancedMode to useDebugApi and toggles it via the konami hotkey', async () => {
    render(<App />);
    await screen.findByTestId('search-home');

    // Starts disabled.
    expect(spies.useDebugApi).toHaveBeenLastCalledWith(false);

    act(() => control.handlers?.konami());

    expect(spies.playAdvancedModeSound).toHaveBeenLastCalledWith(true);
    expect(spies.useDebugApi).toHaveBeenLastCalledWith(true);

    act(() => control.handlers?.konami());

    expect(spies.playAdvancedModeSound).toHaveBeenLastCalledWith(false);
    expect(spies.useDebugApi).toHaveBeenLastCalledWith(false);
  });

  it('crashes on ?test-crash and is caught by the enclosing ErrorBoundary', async () => {
    // App's own ErrorBoundary sits inside its return; the ?test-crash throw fires
    // before that, so it's the mount-site boundary (main.tsx) that catches it.
    window.history.pushState({}, '', '/?test-crash=boom');
    render(
      <ErrorBoundary fallback={<p>fallback</p>}>
        <App />
      </ErrorBoundary>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('error-boundary-report')).toBeInTheDocument(),
    );
    expect(screen.queryByTestId('search-home')).not.toBeInTheDocument();
  });
});
